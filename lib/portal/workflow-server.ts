import 'server-only';
import { adminClient, PortalError } from './server';
export async function workflow(actor: string, operation: string, payload: unknown = {}) {
    const { data, error } = await adminClient().rpc('portal_workflow', { actor, operation, payload });
    if (error) {
        console.error('[portal-workflow]', operation, error.code);
        throw new PortalError(error.code === '42501' ? 403 : 400, error.code === '42501' ? 'You cannot access this record or action' : 'The record or workflow change is invalid');
    }
    return data;
}
