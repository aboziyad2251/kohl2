const fs = require('fs'), vm = require('vm'), ts = require('typescript'), assert = require('assert/strict'), path = require('path');
function load(file, mocks = {}, extra = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: name => name in mocks ? mocks[name] : name==='@/lib/audit/server'?{withAudit:h=>h,auditAccess:async()=>false}:require(name), Response, Request, URL, URLSearchParams, Date, Intl, Set, Map, Array, JSON, process: { env: {} }, console, ...extra });
  return exports;
}
const nav = load('lib/navigation.ts');
const prefs = load('lib/navigation/preferences.ts', { '../navigation': nav });
const dates = load('lib/navigation/workspace.ts');
const financial = load('lib/financial-report.ts');
const legacy = ['/dashboard','/property-map','/ownership-properties','/contracts','/crm','/customer-orders','/property-management','/financials/earnings','/bills-forms','/portal-management','/users-access','/employees','/archive','/financials/daily-reports','/brokerage-agreements','/general-services'];
for (const href of legacy) assert.equal(nav.navItems.filter(item => item.href === href).length, 1);
assert.equal(new Set(nav.navItems.map(item => item.id)).size, nav.navItems.length);
assert.equal(nav.routeItem('/bills-forms/inv').id, 'bills');
assert.equal(nav.routeItem('/bills-forms-other'), undefined);
assert.equal(nav.routeItem('/').id, 'dashboard');
assert(nav.isNavigationItemActive(nav.navShortcuts.find(item=>item.id==='maintenance'), '/property-management', 'tab=MAINTENANCE'));
assert(!nav.isNavigationItemActive(nav.navShortcuts.find(item=>item.id==='maintenance'), '/property-management', 'tab=STATEMENTS'));
assert(!nav.isNavigationItemActive(nav.navShortcuts.find(item=>item.id==='maintenance'), '/crm', 'tab=MAINTENANCE'));
assert.equal(JSON.stringify(dates.availableCalendarSources('HR')),JSON.stringify(['leave']));
assert(!dates.availableCalendarSources('EMPLOYEE').includes('portal'));
assert(dates.availableCalendarSources('CEO').includes('dues'));
assert.equal(dates.availableCalendarSources('TENANT').length,0);
assert.equal(dates.calendarStatusLabel('COMPLETED'),'مكتمل');
assert.equal(dates.calendarStatusLabel('unknown'),'');
assert.equal(nav.routeModule('/financials/daily-reports'), 'daily-reports');
const hr = key => ['dashboard', 'employees', 'archive'].includes(key);
assert.equal(nav.searchNavigation('إدارة', hr).some(item => item.moduleKey === 'users-access'), false);
assert.equal(nav.searchNavigation('المستأجرون', hr).length, 0);
assert.equal(nav.searchNavigation('اداره الاملاك', () => true)[0].id, 'management');
assert.equal(nav.searchNavigation('crm', () => true)[0].id, 'crm');
assert.notEqual(prefs.preferenceKey('A'), prefs.preferenceKey('B'));
const cleaned = prefs.parsePreferences(JSON.stringify({ favorites: ['crm', 'crm', '/evil', null, 'owners'], collapsed: ['customers','invalid'] }));
assert.equal(JSON.stringify(cleaned), JSON.stringify({ favorites: ['crm', 'owners'], collapsed: ['customers'] }));
assert.equal(prefs.parsePreferences('{broken').favorites.length, 0);
assert.equal(prefs.parsePreferences('null').collapsed.length, 0);
assert.equal(dates.riyadhDay(new Date('2026-10-25T22:30:00Z')), '2026-10-26');
assert.equal(dates.monthRange('2028-02').end, '2028-02-29');
assert.equal(dates.shiftMonth('2026-12', 1), '2027-01');
assert.equal(dates.shiftMonth('2026-01', -1), '2025-12');
assert.equal(financial.currentOperations([], true).vacantUnitsCount, null);
assert.equal(financial.currentOperations([{status:'Active',vacant_units:7},{status:'Expired',vacant_units:99}], true).vacantUnitsCount, 7);
assert.equal(financial.currentOperations([{status:'Active',vacant_units:7}], false).vacantUnitsCount, null);
const summary = financial.calculatedReport(100, 80, [{flow_type:'EXPENSE',net_amount:20}], {vacantUnitsCount:0});
assert.equal(summary.analysis_source, 'calculated');
assert(summary.what_went_bad.some(s => s.includes(': 0.')));
assert(!JSON.stringify(summary).includes('100%'));

let role = 'ADMIN', authenticated = true, queries = [], failTable = '', huge = false;
const rows = {
  leave_requests: [{id:'same',employee_name:'Fixture Staff',start_date:'2028-02-10',status:'APPROVED'}],
  crm_activities: [{id:'same',title:'Fixture visit',due_date:'2028-02-15',status:'PENDING',created_at:'2028-02-15T12:00:00Z'}],
  crm_deals: [], contracts: [], managed_property_contracts: [], e_poas: [],
  ownership_audit_logs: [{id:'same',change_type:'LESSOR_TRANSFER',created_at:'2028-02-15T12:00:00Z',before_value:'private',notes:'private'}], properties: [{id:'fixture'}],
};
const client = { from(table) {
  const call = { table, filters: [], columns: '' }; queries.push(call);
  const query = new Proxy({}, { get(_, key) {
    if (key === 'then') return (yes, no) => Promise.resolve({ data: failTable === table ? null : huge && table === 'crm_activities' ? Array.from({length:501},(_,i)=>({...rows.crm_activities[0],id:String(i)})) : rows[table] || [], error: failTable === table ? {} : null }).then(yes, no);
    return (...args) => { if (key === 'select') call.columns = args[0]; else call.filters.push([key,...args]); return query; };
  }});
  return query;
}};
class PortalError extends Error { constructor(status, message) { super(message); this.status = status; } }
const server = {
  PortalError,
  requireIdentity: async (_, executive) => {
    if (!authenticated) throw new PortalError(401,'Sign in required');
    if (executive && !['ADMIN','CEO'].includes(role)) throw new PortalError(403,'Admin or CEO required');
    return {client,user:{id:'fixture'},profile:{account:{id:'fixture',role}}};
  },
  administrative: async () => ({ users:[{id:'fixture',full_name:'Fixture Admin',email:'private'}],audit:[{id:'same',actor_user_id:'fixture',created_at:'2028-02-16T12:00:00Z',action:'SAVE',password:'private'}] }),
  json: data => Response.json(data,{headers:{'Cache-Control':'no-store'}}),
  apiError: error => Response.json({error:error.message},{status:error.status || 500}),
};
const internal = load('lib/navigation/require-internal.ts', {'@/lib/portal/server':server});
const portal = {maintenance:[{id:'same',scheduled_at:'2028-02-15T22:30:00Z',number:'Fixture task',category:'Maintenance',status:'scheduled'}],dues:[{id:'same',due_date:'2028-02-16',description:'Fixture due'}],audit:[{id:'same',created_at:'2028-02-15T12:00:00Z',action:'SAVE',resource:'maintenance',actor_name:'Fixture',before_value:'private'}]};
const mocks = {'@/lib/portal/server':server,'@/lib/navigation/require-internal':internal,'@/lib/portal/workflow-server':{workflow:async()=>portal}};
const calendar = load('app/api/workspace/calendar/route.ts', mocks);
const activity = load('app/api/workspace/activity/route.ts', mocks);
const env = {HATIF_ENABLED:'true',HATIF_WEBHOOK_SECRET:'fixture-private-secret-value',ANTHROPIC_API_KEY:'fixture-private-api-key'};
const status = load('app/api/workspace/status/route.ts', mocks, {process:{env}});
const req = month => ({nextUrl: new URL('http://fixture.invalid?month='+month)});
(async () => {
  authenticated = false;
  for (const endpoint of [calendar, activity, status]) assert.equal((await endpoint.GET(req('2028-02'))).status, 401);
  assert.equal(queries.length,0); authenticated = true;
  for (const external of ['OWNER','TENANT','BROKER']) {
    role=external; for (const endpoint of [calendar, activity, status]) assert.equal((await endpoint.GET(req('2028-02'))).status,403);
  }
  assert.equal(queries.length,0);
  role='HR'; const hrData=await (await calendar.GET(req('2028-02'))).json();
  assert.equal(hrData.events.length,1); assert.deepEqual(queries.map(q=>q.table),['leave_requests']);
  assert.equal((await activity.GET(req('2028-02'))).status,403); assert.equal((await status.GET(req('2028-02'))).status,403);
  queries=[]; role='EMPLOYEE'; const staff=await (await calendar.GET(req('2028-02'))).json();
  assert(!staff.events.some(event=>['portal','dues'].includes(event.source)));
  assert.equal((await status.GET(req('2028-02'))).status,403);
  queries=[]; role='ADMIN';
  for(const month of ['2028-13','1999-01','2028-02-31','injection']) assert.equal((await calendar.GET(req(month))).status,400);
  assert.equal(queries.length,0);
  const result=await calendar.GET(req('2028-02')), data=await result.json();
  assert.equal(result.headers.get('Cache-Control'),'no-store');
  assert.equal(data.events.find(event=>event.source==='portal').date,'2028-02-16');
  assert.equal(new Set(data.events.map(event=>event.id)).size,data.events.length);
  assert(queries.every(query=>query.filters.some(filter=>filter[0]==='lte'&&filter[2]==='2028-02-29')));
  failTable='crm_activities'; const partial=await (await calendar.GET(req('2028-02'))).json(); assert(partial.warnings.length); assert(partial.events.some(event=>event.source==='leave'));
  failTable=''; huge=true;const large=await (await calendar.GET(req('2028-02'))).json();assert.equal(large.events.filter(event=>event.source==='crm').length,500);assert(large.warnings.length);huge=false;
  const audit=await(await activity.GET(req('2028-02'))).json();assert.equal(audit.events.length,3);assert.equal(new Set(audit.events.map(event=>event.id)).size,3);assert(!JSON.stringify(audit).includes('private'));
  const health=await(await status.GET(req('2028-02'))).json();assert(health.hatif.configured);assert(health.database);assert(health.aiConfigured);assert(!JSON.stringify(health).includes('fixture-private'));
  failTable='properties';const failed=await(await status.GET(req('2028-02'))).json();assert.equal(failed.database,false);
  failTable='';
  const insight = load('app/api/financials/ai-insights/route.ts', { ...mocks, '@/lib/financial-report': financial });
  const insightRequest = payload => new Request('http://fixture.invalid', {method:'POST',body:JSON.stringify(payload)});
  role='EMPLOYEE'; assert.equal((await insight.POST(insightRequest({}))).status,403);
  role='ADMIN'; assert.equal((await insight.POST(insightRequest({grossIncome:'invalid'}))).status,400);
  const calculated = await(await insight.POST(insightRequest({report_date:'2028-02-16',grossIncome:100,netIncome:80,transactions:[{flow_type:'EXPENSE',net_amount:20}],operationalStatus:{vacantUnitsCount:0}}))).json();
  assert.equal(calculated.report.analysis_source,'calculated');
  assert.equal(calculated.report.gross_income,100); assert.equal(calculated.report.net_income,80);
  assert(!JSON.stringify(calculated.report).includes('100%'));
  console.log('PASS navigation/workspace: legacy routes, role-filtered Arabic search, account preferences, Riyadh/leap dates, honest report summaries, API role gates, RLS client reads, partial failures, source identity, truncation, and secret-safe status. All database calls mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
