-- PROPOSED ONLY. Do not execute on any database before the user's migration approval.
begin;
create table portal_private.broker_payout_requests (
 id uuid primary key,
 broker_user_id uuid not null references portal_private.accounts(user_id),
 contract_id uuid not null references public.contracts(id),
 contract_number text not null,
 amount numeric(18,2) not null check(amount>0),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 note text not null default '' check(length(note)<=1000),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 decided_by uuid references portal_private.accounts(user_id),
 decision_note text not null default '' check(length(decision_note)<=1000),
 history jsonb not null check(jsonb_typeof(history)='array'),
 check((status='pending' and decided_at is null and decided_by is null) or
       (status<>'pending' and decided_at is not null and decided_by is not null)),
 check(status<>'rejected' or length(btrim(decision_note))>0)
);
create unique index broker_payout_one_open on portal_private.broker_payout_requests(broker_user_id,contract_id) where status in ('pending','approved');
create index broker_payout_owner_date on portal_private.broker_payout_requests(broker_user_id,created_at desc,id);
create index broker_payout_status_date on portal_private.broker_payout_requests(status,created_at desc,id);
alter table portal_private.broker_payout_requests enable row level security;
revoke all on portal_private.broker_payout_requests from public,anon,authenticated;
-- Private table is accessible only through the following narrow JWT-scoped RPC.
create function public.broker_payout_requests(operation text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid(); account portal_private.accounts; broker portal_private.accounts;
 request portal_private.broker_payout_requests; link portal_private.broker_contract_links;
 deal public.contracts; agreement portal_private.broker_office_agreements;
 calculated numeric; target_contract uuid; target_broker uuid; desired text; memo text;
 result jsonb; total bigint; page integer; filter_status text; request_id uuid;
begin
 select * into account from portal_private.accounts where user_id=who and is_active for share;
 if not found or account.role not in ('BROKER','ADMIN','CEO') then raise insufficient_privilege; end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise invalid_parameter_value; end if;
 if operation='LIST' then
  if payload-array['page','status']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  page:=coalesce((payload->>'page')::integer,0);filter_status:=coalesce(payload->>'status','all');
  if page<0 or page>100000 or filter_status not in ('all','pending','approved','rejected') then raise invalid_parameter_value; end if;
  select count(*) into total from portal_private.broker_payout_requests r where
   (account.role in ('ADMIN','CEO') or r.broker_user_id=who) and (filter_status='all' or r.status=filter_status);
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.created_at desc,rows.id),'[]') into result from (
   select r.*,a.full_name as broker_name from portal_private.broker_payout_requests r join portal_private.accounts a on a.user_id=r.broker_user_id
   where (account.role in ('ADMIN','CEO') or r.broker_user_id=who) and (filter_status='all' or r.status=filter_status)
   order by r.created_at desc,r.id limit 50 offset page*50) rows;
  return jsonb_build_object('requests',result,'total',total,'page',page,'eligible_contract_ids',
   coalesce((select jsonb_agg(l.contract_id) from portal_private.broker_contract_links l
    join portal_private.broker_office_agreements a on a.id=l.agreement_id
    join public.contracts c on c.id=l.contract_id
    where account.role='BROKER' and l.broker_user_id=who and l.closed_at is not null and l.closed_at<=now() and l.payout_status<>'paid'
    and (case coalesce(l.commission_type,a.commission_type) when 'FIXED' then coalesce(l.commission_value,a.commission_value)
     else round((case coalesce(l.percentage_basis,a.percentage_basis) when 'OFFICE_COMMISSION' then coalesce(c.office_profit,0)
      else portal_private.contract_value(c.rent_amount,c.start_date,c.end_date) end)*coalesce(l.commission_value,a.commission_value)/100,2) end)>0
    and not exists(select 1 from portal_private.broker_payout_requests r where r.broker_user_id=who and r.contract_id=l.contract_id and r.status in ('pending','approved'))),'[]'));
 elsif operation='SUBMIT' then
  if account.role<>'BROKER' then raise insufficient_privilege; end if;
  if payload-array['request_id','contract_id','note']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  request_id:=(payload->>'request_id')::uuid;target_contract:=(payload->>'contract_id')::uuid;target_broker:=who;
 elsif operation='DECIDE' then
  if account.role not in ('ADMIN','CEO') then raise insufficient_privilege; end if;
  if payload-array['request_id','status','note']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  request_id:=(payload->>'request_id')::uuid;desired:=payload->>'status';
  if desired is null or desired not in ('approved','rejected') then raise invalid_parameter_value; end if;
  select * into request from portal_private.broker_payout_requests where id=request_id;
  if not found then raise insufficient_privilege; end if;
  target_contract:=request.contract_id;target_broker:=request.broker_user_id;
 else raise invalid_parameter_value; end if;
 memo:=btrim(coalesce(payload->>'note',''));
 if request_id is null or target_contract is null or length(memo)>1000 or (desired='rejected' and memo='') then raise invalid_parameter_value; end if;
 -- Common lock order serializes duplicate submits and concurrent decisions.
 select * into link from portal_private.broker_contract_links where broker_user_id=target_broker and contract_id=target_contract for update;
 if operation='SUBMIT' and not found then raise insufficient_privilege; end if;
 select * into request from portal_private.broker_payout_requests where id=request_id for update;
 if operation='SUBMIT' and found then
  if request.broker_user_id<>who or request.contract_id<>target_contract or request.note<>memo then raise insufficient_privilege; end if;
  return to_jsonb(request);
 end if;
 if operation='DECIDE' then
  if request.status<>'pending' then
   if request.status=desired and request.decided_by=who and request.decision_note=memo then return to_jsonb(request); end if;
   raise serialization_failure using message='Decision already recorded';
  end if;
 end if;
 -- Rejection remains possible if the commission was unassigned or paid meanwhile.
 if operation='SUBMIT' or desired='approved' then
  select * into broker from portal_private.accounts where user_id=target_broker and role='BROKER' and is_active for share;
  if not found or link.contract_id is null or link.closed_at is null or link.closed_at>now() or link.payout_status='paid' then raise invalid_parameter_value using message='Commission not eligible'; end if;
  select * into deal from public.contracts where id=target_contract for share;
  select * into agreement from portal_private.broker_office_agreements where id=link.agreement_id for share;
  calculated:=case coalesce(link.commission_type,agreement.commission_type) when 'FIXED' then coalesce(link.commission_value,agreement.commission_value)
   else round((case coalesce(link.percentage_basis,agreement.percentage_basis) when 'OFFICE_COMMISSION' then coalesce(deal.office_profit,0)
    else portal_private.contract_value(deal.rent_amount,deal.start_date,deal.end_date) end)*coalesce(link.commission_value,agreement.commission_value)/100,2) end;
  calculated:=round(calculated,2);
  if calculated is null or calculated<=0 then raise invalid_parameter_value; end if;
 end if;
 if operation='SUBMIT' then
  insert into portal_private.broker_payout_requests(id,broker_user_id,contract_id,contract_number,amount,note,history)
   values(request_id,who,target_contract,deal.contract_number,calculated,memo,
    jsonb_build_array(jsonb_build_object('status','pending','actor_name',account.full_name,'note',memo,'at',now()))) returning * into request;
 else
  if desired='approved' and calculated<>request.amount then raise serialization_failure using message='Commission amount changed; reject and request again'; end if;
  update portal_private.broker_payout_requests set status=desired,decided_at=now(),decided_by=who,decision_note=memo,
   history=history||jsonb_build_array(jsonb_build_object('status',desired,'actor_name',account.full_name,'note',memo,'at',now()))
   where id=request_id returning * into request;
 end if;
 return to_jsonb(request);
end $$;
revoke all on function public.broker_payout_requests(text,jsonb) from public,anon;
grant execute on function public.broker_payout_requests(text,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
