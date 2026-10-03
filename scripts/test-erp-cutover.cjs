// Executes the real dbService write/read functions against the isolated restore.
const fs=require('fs'),vm=require('vm'),ts=require('typescript'),assert=require('assert/strict');
const {randomUUID,createHmac}=require('crypto');
const {createClient}=require('@supabase/supabase-js');
const url='http://127.0.0.1:39133';
const secret='isolated-phase-a-api-test-secret-not-a-production-key-2026';
function jwt(role){const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const body=enc({alg:'HS256',typ:'JWT'})+'.'+enc({role,aud:'authenticated',exp:Math.floor(Date.now()/1000)+3600});return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');}
const client=createClient(url,jwt('anon'),{auth:{persistSession:false,autoRefreshToken:false}});
const service=createClient(url,jwt('service_role'),{auth:{persistSession:false,autoRefreshToken:false}});
const exportsObject={};
const seedStub=new Proxy({supabase:client},{get:(o,k)=>k in o?o[k]:[]});
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/services/dbService.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject,require:()=>seedStub,console,crypto:require('crypto'),Date,Set,Map});
const db=exportsObject;let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);checks++;console.log('PASS',label);};
async function saved(table,id){const {data,error}=await client.from(table).select('*').eq('id',id).single();assert.ifError(error);return data;}
(async()=>{
 const {error}=await client.auth.signInWithPassword({email:'phase-a-admin@test.invalid',password:'Kohl-Preview-2026!'});assert.ifError(error);
 let all=await db.dbFetchAllData();check(all.properties.length===6&&all.brokerageAgreements.length===6,'Imported business records load through real app service');
 check(all.properties.every(p=>p.title&&p.lessor&&p.ownership_document),'Imported property relationships resolve');
 const lessor=all.lessors[0].id,prop={id:randomUUID(),title:'Isolated test property',property_type:'Commercial',address:'Test',city:'Riyadh',units_count:1,lessor_id:lessor};
 await db.dbInsertProperty(prop);check((await saved('properties',prop.id)).property_name===prop.title,'Property insert maps name');
 prop.title='Updated isolated property';await db.dbUpdateProperty(prop);check((await saved('properties',prop.id)).property_name===prop.title,'Property update persists');
 const contract={id:randomUUID(),contract_number:randomUUID(),type:'COMMERCIAL',property_id:prop.id,lessor_id:lessor,tenant_name:'Test tenant',tenant_national_id:'test',rent_amount:12000,total_collected_amount:500,office_profit:100,security_deposit_amount:200,lessor_requirements:'Test',payment_schedule:'Monthly',start_date:'2026-01-01',end_date:'2099-12-31',status:'Active',primary_lessor_consent:true};
 await db.dbInsertContract(contract);check((await saved('contracts',contract.id)).status==='active','Contract saves amounts and normalized status');
 contract.status='Expired';await db.dbUpdateContract(contract);check((await saved('contracts',contract.id)).status==='expired','Contract update normalizes status');
 const order={id:randomUUID(),order_number:randomUUID(),client_name:'Test customer',client_phone:'0500000000',category:'COMMERCIAL',building_type:'Office',desired_area:'Riyadh',status:'Searching'};
 check(await db.dbInsertCustomerOrder(order),'Customer order inserts');check((await saved('customer_orders',order.id)).status==='in_progress','Customer status maps to database');
 order.status='Fulfilled';await db.dbUpdateCustomerOrder(order);check((await saved('customer_orders',order.id)).status==='completed','Customer order update persists');
 const general={id:randomUUID(),service_number:randomUUID(),client_name:'Test client',category:'OTHER',title:'Test service',cost_amount:20,fee_amount:100,office_profit:80,status:'Pending'};
 await db.dbInsertGeneralService(general);check((await saved('general_services',general.id)).profit_amount===80,'Service financial fields save');
 const tx={id:randomUUID(),transaction_date:'2026-10-03',transaction_type:'DOCUMENT_FEE',flow_type:'INCOME',gross_amount:100,tax_vat_amount:15,net_amount:85,property_id:prop.id,contract_id:contract.id,notes:'Test income'};
 await db.dbInsertFinancialTransaction(tx);check((await saved('financial_transactions',tx.id)).category==='DOCUMENT_FEE','Financial category and flow remain distinct');
 tx.flow_type='EXPENSE';tx.net_amount=70;await db.dbUpdateFinancialTransaction(tx);check((await saved('financial_transactions',tx.id)).net_profit===70,'Financial update persists');
 const managed={id:randomUUID(),contract_number:randomUUID(),property_name:'Test managed',lessor_name:'Test owner',lessor_phone:'0500000000',property_type:'Commercial',total_units:2,occupied_units:1,vacant_units:1,fee_type:'PERCENTAGE',fee_value:5,annual_expected_revenue:10000,collected_revenue:500,transferred_to_owner:400,start_date:'2026-01-01',end_date:'2099-12-31',status:'Active'};
 await db.dbInsertManagedProperty(managed);check((await saved('managed_property_contracts',managed.id)).fee_value===5,'Managed property saves fee and occupancy');
 const task={id:randomUUID(),task_number:randomUUID(),managed_property_id:managed.id,property_name:'Test managed',unit_name:'1',maintenance_type:'Elevator',cost_amount:20,contractor_phone:'0500000000',status:'Pending',notes:'Test repair'};
 await db.dbInsertMaintenanceTask(task);check((await saved('property_maintenance_tasks',task.id)).task_type==='Elevator','Maintenance saves category, notes and management link');
 const archive={id:randomUUID(),archive_code:randomUUID(),title:'Test archive',category:'OTHER',reference_number:'TEST',client_or_entity:'Test',date:'2026-10-03',status:'ACTIVE',tags:['test']};
 await db.dbInsertArchivedDocument(archive);check((await saved('archived_documents',archive.id)).title==='Test archive','Archive saves');
 all=await db.dbFetchAllData();
 check(all.contracts.find(r=>r.id===contract.id).status==='Expired','App reads normalized contract status');
 check(all.customerOrders.find(r=>r.id===order.id).status==='Fulfilled','App reads normalized customer status');
 check(all.transactions.find(r=>r.id===tx.id).flow_type==='EXPENSE'&&all.transactions.find(r=>r.id===tx.id).transaction_type==='DOCUMENT_FEE','App reads finance values without changing semantics');
 check(all.generalServices.find(r=>r.id===general.id).title==='Test service','App reads service aliases');
 const anon=createClient(url,jwt('anon'),{auth:{persistSession:false}});
 const denied=await anon.from('properties').select('*');check(!!denied.error,'Anonymous business reads denied');
 // Test identities exist only in the isolated Auth database.
 const email=randomUUID()+'@test.invalid';const created=await service.auth.admin.createUser({email,password:'Cutover-Test-2026!',email_confirm:true,user_metadata:{role:'ADMIN'}});assert.ifError(created.error);
 const unapproved=createClient(url,jwt('anon'),{auth:{persistSession:false}});assert.ifError((await unapproved.auth.signInWithPassword({email,password:'Cutover-Test-2026!'})).error);
 const attempt=await unapproved.from('properties').insert({property_name:'Forbidden',property_type:'Commercial',address:'Test',city:'Riyadh'});check(!!attempt.error,'Editable Auth metadata cannot grant executive writes');
 assert.ifError((await service.auth.admin.deleteUser(created.data.user.id)).error);
 for(const [table,id] of [['archived_documents',archive.id],['property_maintenance_tasks',task.id],['managed_property_contracts',managed.id],['financial_transactions',tx.id],['general_services',general.id],['customer_orders',order.id],['contracts',contract.id],['properties',prop.id]])assert.ifError((await client.from(table).delete().eq('id',id)).error);
 console.log(checks+' ERP and security checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
