// Trusted operator CLI, never a public application route.
// Run only during the reviewed cutover with a verified internal-user JSON file.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const file = process.argv[2];
if (!file || !process.argv.includes('--confirm')) {
  throw new Error('Usage: node --env-file=.env.local scripts/bootstrap-portal-users.mjs <verified-user-file.json> --confirm');
}
const url = process.env.SUPABASE_SERVER_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const origin = process.env.APP_ORIGIN;
const database = process.env.PORTAL_BOOTSTRAP_DATABASE || 'postgres';
if (!/^(postgres|kohl_portal_phasea_test_auth2)$/.test(database)) throw new Error('Unrecognized bootstrap database');
if (!url || !secret || !origin) throw new Error('Server URL, service role key and APP_ORIGIN required');
const users = z.array(z.object({ email: z.string().email(), full_name: z.string().min(2),
  mobile: z.string().regex(/^05\d{8}$/), role: z.enum(['ADMIN','CEO','HR','EMPLOYEE']),
  password: z.string().min(6).max(128).optional(),
  employee_id: z.string().uuid().nullable().default(null),
})).min(1).parse(JSON.parse(fs.readFileSync(file,'utf8')));
if (users.some(u => u.role === 'EMPLOYEE' && !u.employee_id)) throw new Error('Employees require verified employee UUIDs');
const client = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const quote = value => value == null ? 'null' : "'" + String(value).replaceAll("'","''") + "'";
const query = sql => execFileSync('ssh',['kohl-vps',`docker exec -i supabase-db psql -X -v ON_ERROR_STOP=1 -U postgres -d ${database}`],{input:sql,stdio:['pipe','pipe','pipe']});

for (const user of users) {
  const {data,error} = user.password
    ? await client.auth.admin.createUser({email:user.email,password:user.password,email_confirm:true,
      user_metadata:{full_name:user.full_name}})
    : await client.auth.admin.generateLink({type:'invite',email:user.email,
      options:{redirectTo:new URL('/auth/set-password',origin).toString()}});
  if (error || !data.user) throw new Error('Unable to provision identity; stop and review the Auth configuration');
  const id=data.user.id, request=randomUUID();
  // Preserve existing roles. SQL credentials are operator-held; this cannot be
  // called through the Data API or by an external user.
  query(`begin;
    do $$ begin
      if exists(select 1 from portal_private.accounts where user_id=${quote(id)}::uuid and role<>${quote(user.role)})
      then raise exception 'Existing role differs; manual verified review required'; end if;
    end $$;
    insert into portal_private.accounts(user_id,full_name,mobile,role,is_active,employee_id)
    values(${quote(id)}::uuid,${quote(user.full_name)},${quote(user.mobile)},${quote(user.role)},true,${quote(user.employee_id)}::uuid)
    on conflict(user_id) do update set full_name=excluded.full_name,mobile=excluded.mobile,employee_id=excluded.employee_id,updated_at=now();
    insert into portal_private.access_audit(target_user_id,action,changes,request_id)
    values(${quote(id)}::uuid,'OPERATOR_BOOTSTRAP',jsonb_build_object('role',${quote(user.role)},'source','verified operator file'),${quote(request)}::uuid);
    commit;`);
  if (user.password) {
    query(`insert into portal_private.access_audit(target_user_id,action,changes,request_id)
      values(${quote(id)}::uuid,'BOOTSTRAP_PASSWORD',jsonb_build_object('source','verified operator file'),${quote(request)}::uuid);`);
    console.log(user.role, 'created; password provisioned');
    continue;
  }
  const {error:mailError}=await client.auth.admin.inviteUserByEmail(user.email,{redirectTo:new URL('/auth/set-password',origin).toString()});
  query(`begin;
    update portal_private.accounts set invitation_status=${quote(mailError?'FAILED':'SENT')},updated_at=now() where user_id=${quote(id)}::uuid;
    insert into portal_private.access_audit(target_user_id,action,changes,request_id)
    values(${quote(id)}::uuid,'BOOTSTRAP_INVITATION',jsonb_build_object('status',${quote(mailError?'FAILED':'SENT')}),${quote(request)}::uuid);
    commit;`);
  console.log(user.role, mailError ? 'created; invite delivery failed' : 'created; invitation sent');
  if (mailError) throw new Error('Stop: fix SMTP before continuing bootstrap');
}
