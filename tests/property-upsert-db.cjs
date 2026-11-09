const assert=require('assert/strict'),{fixture,migrate,actor,ids}=require('./fixtures/erp-db.cjs'),{loadTS}=require('./load-ts.cjs');const {buildPreview}=loadTS('lib/properties/import-match.ts');
(async()=>{const db=await fixture();for(const name of ['20261028131651_comprehensive_audit_trail.sql','20261028131715_smart_property_upsert.sql'])await migrate(db,name);
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',deed='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',first='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 await db.query("insert into public.lessors values($1,'Synthetic owner')",[owner]);await db.query("insert into public.ownership_documents values($1,'D-123',$2)",[deed,owner]);
 await db.query("insert into public.properties(id,property_name,property_type,address,city,lessor_id,ownership_document_id,property_code,unit_number,rooms,amenities) values($1,'Existing fixture','Residential','Fixture address','Jeddah',$2,$3,'CODE-1','101',3,'{\"furnished\":true,\"parking_spaces\":2}')",[first,owner,deed]);
 await actor(db,'admin','service_role');
 const rpc=async(name,args)=>{const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query('select public.'+name+'('+placeholders+') result',args)).rows[0].result;};
 const context=()=>rpc('property_import_context',[ids.admin]);
 const preview=async rows=>{const c=await context(),p={version:c.version,source_name:'fixture.xlsx',sheet_name:'Properties',rows:buildPreview(rows,c)};return {...await rpc('store_property_import_preview',[ids.admin,p]),p};};
 let p=await preview([{source_row:2,values:{property_id:first,rooms:0,furnished:false,parking_spaces:0}},{source_row:3,values:{property_name:'New distant fixture',property_type:'Residential',city:'Riyadh',address:'Different street',lessor_id:owner,area_sqm:120,elevator:true}}]);
 assert.equal((await db.query('select count(*)::int n from public.properties')).rows[0].n,1); // preview writes no properties
 await assert.rejects(rpc('commit_property_import',[ids.admin,p.request_id,[{source_row:2,action:'UPDATE',target_id:first}]]),/Resolve every row/);
 const decisions=[{source_row:2,action:'UPDATE',target_id:first},{source_row:3,action:'NEW'}];let result=await rpc('commit_property_import',[ids.admin,p.request_id,decisions]);assert.equal(result.created,1);assert.equal(result.updated,1);
 let saved=(await db.query('select * from public.properties where id=$1',[first])).rows[0];assert.equal(saved.rooms,0);assert.equal(saved.amenities.furnished,false);assert.equal(saved.amenities.parking_spaces,0);assert.equal(saved.rooms_edited,true);assert.equal(saved.ownership_document_id,deed);
 const replay=await rpc('commit_property_import',[ids.admin,p.request_id,decisions]);assert.equal(replay.replayed,true);assert.equal((await db.query('select count(*)::int n from public.properties')).rows[0].n,2);
 await assert.rejects(rpc('commit_property_import',[ids.admin,p.request_id,decisions.map(d=>({...d,action:'SKIP'}))]),/decisions changed/);
 p=await preview([{source_row:2,values:{property_id:first,price:500}}]);await db.query("update public.properties set rooms=1 where id=$1",[first]);await assert.rejects(rpc('commit_property_import',[ids.admin,p.request_id,[{source_row:2,action:'UPDATE',target_id:first}]]),/Catalog changed/);
 p=await preview([{source_row:2,values:{property_name:'Existing fixture'}}]);await assert.rejects(rpc('commit_property_import',[ids.admin,p.request_id,[{source_row:2,action:'UPDATE',target_id:owner}]]),/proposed existing/);
 // Later-row unique violation rolls the complete import and its success audits back.
 p=await preview([{source_row:2,values:{property_id:first,price:700}},{source_row:3,values:{property_name:'Bad duplicate code',property_type:'Residential',city:'Jeddah',address:'Unique address',lessor_id:owner,property_code:'CODE-1'}}]);
 const before=(await db.query('select count(*)::int n from public.audit_logs')).rows[0].n;
 await assert.rejects(rpc('commit_property_import',[ids.admin,p.request_id,[{source_row:2,action:'UPDATE',target_id:first},{source_row:3,action:'NEW'}]]),/duplicate key/);
 assert.equal((await db.query('select price from public.properties where id=$1',[first])).rows[0].price,null);assert.equal((await db.query('select count(*)::int n from public.audit_logs')).rows[0].n,before);
 p=await preview([{source_row:2,values:{property_id:first,rooms:2}},{source_row:3,values:{property_id:first,rooms:4}}]);await assert.rejects(rpc('commit_property_import',[ids.admin,p.request_id,[{source_row:2,action:'UPDATE',target_id:first},{source_row:3,action:'UPDATE',target_id:first}]]),/same property/);
 // Explicit unit clearing must not resurrect legacy spreadsheet values.
 await db.query("update public.properties set spreadsheet_details='{\"apartment_number\":\"101\"}' where id=$1",[first]);
 p=await preview([{source_row:2,values:{property_id:first,unit_number:null}}]);await rpc('commit_property_import',[ids.admin,p.request_id,[{source_row:2,action:'UPDATE',target_id:first}]]);
 saved=(await db.query('select * from public.properties where id=$1',[first])).rows[0];assert.equal(saved.unit_number,null);assert.equal(saved.unit_number_edited,true);assert.equal(saved.spreadsheet_details.apartment_number,'101');
 await assert.rejects(rpc('property_import_context',[ids.owner]),/Operational staff/);
 await actor(db,'employee');await assert.rejects(rpc('property_import_context',[ids.admin]),/permission denied/);await assert.rejects(db.query('select * from portal_private.property_import_previews'),/permission denied/);
 console.log('PASS import DB: no writes during preview, atomic create/update/amenities, explicit decisions, stale context, duplicate targets, replay, full rollback on unique failure and service-only actor-scoped plans.');await db.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
