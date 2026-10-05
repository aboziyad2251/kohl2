-- Run after the workflow migration in a transaction against the ISOLATED DB.
-- All fixtures and schema changes are rolled back by the operator wrapper.
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$ begin
 if value is distinct from true then raise exception 'Assertion failed: %',label; end if;
end $$;
create function pg_temp.assert_denied(actor uuid, op text, body jsonb) returns void language plpgsql as $$ begin
 perform public.portal_workflow(actor,op,body);
 raise exception 'Expected denial: %',op;
exception when insufficient_privilege then return;
end $$;
create function pg_temp.assert_invalid(actor uuid, op text, body jsonb) returns void language plpgsql as $$ begin
 perform public.portal_workflow(actor,op,body);
 raise exception 'Expected invalid workflow: %',op using errcode='P0002';
exception when sqlstate 'P0001' then return;
end $$;

do $$
declare ids uuid[]:=array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 roles text[]:=array['ADMIN','CEO','TENANT','TENANT','OWNER','OWNER','BROKER','BROKER'];
 props uuid[]:=array[gen_random_uuid(),gen_random_uuid()]; leases uuid[]:=array[gen_random_uuid(),gen_random_uuid()];
 aid uuid; task uuid; other_task uuid; due uuid; payment uuid:=gen_random_uuid(); response jsonb; i integer; actor uuid; lessor uuid;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 select id into lessor from public.lessors limit 1;
 for i in 1..8 loop
  insert into auth.users(id,email,raw_user_meta_data) values(ids[i],ids[i]::text||'@test.invalid','{"role":"ADMIN"}');
  insert into portal_private.accounts(user_id,full_name,mobile,role,is_active) values(ids[i],'Fake portal fixture','0500000000',roles[i],true);
 end loop;
 for i in 1..2 loop
  insert into public.properties(id,property_name,property_type,address,city,lessor_id) values(props[i],'Isolated property','Residential','Test address','Test city',lessor);
  insert into public.contracts(id,contract_number,type,property_id,lessor_id,tenant_name,tenant_national_id,rent_amount,payment_schedule,start_date,end_date,status)
   values(leases[i],'TEST-'||leases[i]::text,'RESIDENTIAL',props[i],lessor,'Private Tenant','0000000000',12000,'Monthly',current_date-30,current_date+335,'active');
  insert into portal_private.tenant_lease_links values(ids[i+2],leases[i],now());
  insert into portal_private.owner_property_links(owner_user_id,property_id,ownership_share,effective_from) values(ids[i+4],props[i],100,current_date-60);
  insert into portal_private.broker_office_agreements(broker_user_id,agreement_number,commission_type,commission_value,percentage_basis,effective_from)
   values(ids[i+6],'TEST-'||ids[i+6]::text,'PERCENTAGE',5,'DEAL_VALUE',current_date-60) returning id into aid;
  insert into portal_private.broker_contract_links(broker_user_id,contract_id,agreement_id) values(ids[i+6],leases[i],aid);
 end loop;
 for i in 3..8 loop
  response:=public.portal_workflow(ids[i],'DASHBOARD');
  perform pg_temp.assert_true(jsonb_array_length(response->'contracts')=1,'Each external role has only one assigned contract');
  perform pg_temp.assert_true(response->'contracts'->0->>'id'=leases[case when i%2=1 then 1 else 2 end]::text,'No cross-account contract');
  perform pg_temp.assert_true(jsonb_array_length(response->'audit')=0,'No customer audit exposure');
  if roles[i]='OWNER' then perform pg_temp.assert_true(response->'contracts'->0->'tenant_name'='null'::jsonb,'Owner personal information hidden'); end if;
  if roles[i]='BROKER' then perform pg_temp.assert_true(jsonb_array_length(response->'payments')=0 and jsonb_array_length(response->'maintenance')=0,'Broker cannot see owner finances or maintenance'); end if;
  perform pg_temp.assert_denied(ids[i],'KPI_SAVE',jsonb_build_object('broker_user_id',ids[7]));
 end loop;
 perform pg_temp.assert_true(portal_private.contract_value(12000,'2024-01-01','2024-12-31')=12000,'Leap-year contract value');
 perform pg_temp.assert_true(portal_private.contract_value(12000,'2024-01-01','2025-12-31')=24000,'Multi-year contract value');
 response:=public.portal_workflow(ids[3],'MAINTENANCE_CREATE',jsonb_build_object('property_id',props[1],'contract_id',leases[1],'category','Plumbing','description','Test request'));
 task:=(response->>'id')::uuid;
 perform pg_temp.assert_denied(ids[4],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','cancelled'));
 perform pg_temp.assert_denied(ids[6],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','cancelled'));
 perform pg_temp.assert_denied(ids[7],'MAINTENANCE_CREATE',jsonb_build_object('property_id',props[1],'contract_id',leases[1],'category','Test','description','Test'));
 perform pg_temp.assert_denied(ids[3],'MAINTENANCE_CREATE',jsonb_build_object('property_id',props[2],'contract_id',leases[2],'category','Test','description','Test'));
 perform pg_temp.assert_invalid(ids[1],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','completed'));
 perform public.portal_workflow(ids[1],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','under_review'));
 perform pg_temp.assert_invalid(ids[1],'MAINTENANCE_QUOTE',jsonb_build_object('task_id',task,'cost',100,'cost_bearer','owner','cost_customer_id',ids[6]));
 perform public.portal_workflow(ids[1],'MAINTENANCE_QUOTE',jsonb_build_object('task_id',task,'cost',100,'cost_bearer','tenant','cost_customer_id',ids[3]));
 perform public.portal_workflow(ids[1],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','awaiting_customer_approval'));
 perform pg_temp.assert_denied(ids[1],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','awaiting_manager_approval'));
 perform public.portal_workflow(ids[3],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','awaiting_manager_approval','note','Customer approved'));
 perform pg_temp.assert_denied(ids[3],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','scheduled','scheduled_at',now()));
 perform public.portal_workflow(ids[2],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','scheduled','scheduled_at',now()));
 perform public.portal_workflow(ids[2],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','in_progress'));
 perform public.portal_workflow(ids[2],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','completed'));
 perform public.portal_workflow(ids[2],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',task,'status','closed'));
 perform pg_temp.assert_true((select count(*)=8 from portal_private.maintenance_history where task_id=task),'Full maintenance status history');
 response:=public.portal_workflow(ids[5],'MAINTENANCE_CREATE',jsonb_build_object('property_id',props[1],'category','Test','description','Owner request'));
 other_task:=(response->>'id')::uuid;
 perform public.portal_workflow(ids[5],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',other_task,'status','cancelled'));
 perform pg_temp.assert_invalid(ids[1],'MAINTENANCE_TRANSITION',jsonb_build_object('task_id',other_task,'status','under_review'));
 perform pg_temp.assert_true((select count(*)>=12 from portal_private.payment_dues where contract_id=leases[1] and generated),'Rent schedule derives from annual rent');
 select id into due from portal_private.payment_dues where contract_id=leases[1] order by due_date limit 1;
 insert into public.financial_transactions(id,transaction_date,transaction_type,category,amount,net_profit,payment_method,property_id,contract_id,description)
  values(payment,current_date,'INCOME','RENTAL_PAYMENT',1000,1000,'Cash',props[1],leases[1],'Isolated rent receipt');
 perform public.portal_workflow(ids[1],'PAYMENT_LINK',jsonb_build_object('payment_id',payment,'due_id',due));
 perform pg_temp.assert_denied(ids[4],'PAYMENT_DOCUMENT',jsonb_build_object('payment_id',payment));
 perform pg_temp.assert_denied(ids[5],'PAYMENT_DOCUMENT',jsonb_build_object('payment_id',payment));
 response:=public.portal_workflow(ids[3],'PAYMENT_DOCUMENT',jsonb_build_object('payment_id',payment));
 perform pg_temp.assert_true(response->'snapshot'->>'tenant_name'='Private Tenant','Receipt sourced from verified payment');
 perform public.portal_workflow(ids[1],'COMMISSION_SAVE',jsonb_build_object('broker_user_id',ids[7],'contract_id',leases[1],'type','FIXED','value',700,'basis',null,'payout_status','approved','closed_at',now()));
 response:=public.portal_workflow(ids[7],'DASHBOARD');
 perform pg_temp.assert_true((response->'commissions'->0->>'amount')::numeric=700,'Fixed commission calculated');
 select agreement_id into aid from portal_private.broker_contract_links where broker_user_id=ids[7] and contract_id=leases[1];
 perform public.portal_admin(ids[1],'SAVE',jsonb_build_object('user_id',ids[7],'role','BROKER','full_name','Fake broker','mobile','0500000000','owners','[]'::jsonb,'leases','[]'::jsonb,'broker_contracts',jsonb_build_array(leases[1]),'agreement_id',aid),gen_random_uuid());
 response:=public.portal_workflow(ids[7],'DASHBOARD');
 perform pg_temp.assert_true((response->'commissions'->0->>'amount')::numeric=700 and response->'commissions'->0->>'status'='approved','Assignment edits preserve commission and payout metadata');
 perform public.portal_workflow(ids[1],'COMMISSION_SAVE',jsonb_build_object('broker_user_id',ids[7],'contract_id',leases[1],'type','PERCENTAGE','value',5,'basis','DEAL_VALUE','payout_status','approved','closed_at',now()));
 response:=public.portal_workflow(ids[7],'DASHBOARD');
 perform pg_temp.assert_true(abs((response->'commissions'->0->>'amount')::numeric-600)<2,'Percentage commission calculated');
 perform pg_temp.assert_true((select count(*)>0 from portal_private.portal_audit where actor_user_id=ids[1] and before_value is not null and after_value is not null),'Executive before/after audit');
 update portal_private.accounts set is_active=false where user_id=ids[3];
 perform pg_temp.assert_denied(ids[3],'DASHBOARD','{}');
 perform pg_temp.assert_true(not has_function_privilege('authenticated','public.portal_workflow(uuid,text,jsonb)','execute'),'RPC not callable directly by clients');
 perform pg_temp.assert_true(not has_function_privilege('anon','public.portal_workflow(uuid,text,jsonb)','execute'),'Anonymous RPC denied');
 raise notice 'Portal scope, role spoofing, workflow, quote assignment, cancellation, receipts, commissions, audit and deactivation checks passed';
end $$;
