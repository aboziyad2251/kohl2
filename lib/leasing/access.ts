// These are the complete application API boundaries of a leasing-only session.
// PostgREST permissions and the session-scoped RPC independently enforce scope.
export function leasingApiAllowed(path: string, method: string) {
  return (path === '/api/portal/me' && method === 'GET')
    || (path === '/api/operations' && ['GET','POST'].includes(method))
    || (path === '/api/auth/leasing-switch' && ['GET','POST'].includes(method))
    || (path === '/api/auth/logout' && method === 'POST');
}
export const leasingActions = new Set(['LIST','CONTACT_CREATE','CASE_CREATE','CASE_UPDATE','FOLLOWUP_ADD','FOLLOWUP_DONE','ASSISTANT_PLAN']);
