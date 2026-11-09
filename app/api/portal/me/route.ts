import { auditAccess } from '@/lib/audit/server';
import { NextRequest } from 'next/server';
import { requireIdentity, adminClient, apiError, json } from '@/lib/portal/server';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        const { profile, user } = await requireIdentity(req);
        let kr_reports=false;
        if(!profile.account.history_only&&['ADMIN','CEO','HR','EMPLOYEE'].includes(profile.account.role)){
            if(['ADMIN','CEO'].includes(profile.account.role))kr_reports=true;
            else {const {data,error}=await adminClient().rpc('kr_report_access',{actor:user.id,operation:'CHECK',payload:{}});kr_reports=!error&&data===true;}
        }
        const audit_viewer=!profile.account.history_only&&['ADMIN','CEO','HR','EMPLOYEE'].includes(profile.account.role)&&await auditAccess(user.id).catch(()=>false)===true;
        return json({ ...profile, kr_reports, audit_viewer, email: user.email });
    }
    catch (error) {
        return apiError(error);
    }
}
