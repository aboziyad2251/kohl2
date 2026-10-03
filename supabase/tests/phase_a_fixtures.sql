-- ONLY for an isolated database whose name begins kohl_portal_phasea_test.
do $$ begin
 if current_database() not like 'kohl_portal_phasea_test%' then raise exception 'Test database required'; end if;
end $$;
insert into auth.users(id,aud,role,email) values
 ('10000000-0000-4000-8000-000000000001','authenticated','authenticated','admin@test.invalid'),
 ('10000000-0000-4000-8000-000000000002','authenticated','authenticated','ceo@test.invalid'),
 ('10000000-0000-4000-8000-000000000003','authenticated','authenticated','owner1@test.invalid'),
 ('10000000-0000-4000-8000-000000000004','authenticated','authenticated','owner2@test.invalid'),
 ('10000000-0000-4000-8000-000000000005','authenticated','authenticated','tenant1@test.invalid'),
 ('10000000-0000-4000-8000-000000000006','authenticated','authenticated','tenant2@test.invalid'),
 ('10000000-0000-4000-8000-000000000007','authenticated','authenticated','broker1@test.invalid'),
 ('10000000-0000-4000-8000-000000000008','authenticated','authenticated','broker2@test.invalid'),
 ('10000000-0000-4000-8000-000000000009','authenticated','authenticated','hr@test.invalid'),
 ('10000000-0000-4000-8000-000000000010','authenticated','authenticated','employee@test.invalid');
insert into public.lessors(id,name,national_id_or_cr,phone) values
 ('20000000-0000-4000-8000-000000000001','Fixture lessor','fixture-lessor','0500000000');
insert into public.properties(id,property_name,property_type,address,city,lessor_id) values
 ('30000000-0000-4000-8000-000000000001','Fixture property 1','Residential','Fixture','Riyadh','20000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','Fixture property 2','Residential','Fixture','Riyadh','20000000-0000-4000-8000-000000000001');
insert into public.contracts(id,contract_number,type,property_id,lessor_id,tenant_name,rent_amount,payment_schedule,start_date,end_date,status,notes) values
 ('40000000-0000-4000-8000-000000000001','FIXTURE-1','RESIDENTIAL','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Fixture tenant 1',12000,'Monthly','2026-01-01','2099-12-31','active','PRIVATE NOTE'),
 ('40000000-0000-4000-8000-000000000002','FIXTURE-2','RESIDENTIAL','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','Fixture tenant 2',12000,'Monthly','2026-01-01','2099-12-31','active','PRIVATE NOTE');
insert into public.employees(id,employee_number,name,national_id_or_iqama,job_title,phone,email) values
 ('50000000-0000-4000-8000-000000000001','FIXTURE-EMP','Fixture employee','test-employee','Agent','0500000000','employee@test.invalid');
insert into portal_private.accounts(user_id,full_name,mobile,role,is_active,employee_id)
 select id,split_part(email,'@',1),'0500000000',case split_part(email,'@',1)
 when 'admin' then 'ADMIN' when 'ceo' then 'CEO' when 'hr' then 'HR' when 'employee' then 'EMPLOYEE'
 when 'owner1' then 'OWNER' when 'owner2' then 'OWNER' when 'tenant1' then 'TENANT' when 'tenant2' then 'TENANT' else 'BROKER' end,
 true,case when email='employee@test.invalid' then '50000000-0000-4000-8000-000000000001'::uuid else null end from auth.users;
insert into portal_private.owner_property_links(owner_user_id,property_id,ownership_share,effective_from) values
 ('10000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001',100,'2026-01-01'),
 ('10000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002',100,'2026-01-01');
insert into portal_private.tenant_lease_links(tenant_user_id,contract_id) values
 ('10000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000002');
insert into portal_private.broker_office_agreements(id,broker_user_id,agreement_number,commission_type,commission_value,percentage_basis,effective_from) values
 ('60000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000007','BROKER-FIXTURE-1','PERCENTAGE',2.5,'DEAL_VALUE','2026-01-01'),
 ('60000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000008','BROKER-FIXTURE-2','FIXED',500,null,'2026-01-01');
insert into portal_private.broker_contract_links values
 ('10000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000008','40000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002');
update public.contracts set assigned_agent_id='50000000-0000-4000-8000-000000000001' where contract_number='FIXTURE-1';
