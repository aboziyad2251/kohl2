import { supabase } from '../supabaseClient';
import {
  Lessor,
  Representative,
  OwnershipDocument,
  Property,
  EPoa,
  Contract,
  BrokerageAgreement,
  OwnershipAuditLog,
  FinancialTransaction,
  DailyFinancialSummary,
  AiDailyReport,
  GeneralService,
  Tenant,
  CustomerOrder,
  ArchivedDocument,
  Employee,
  TimesheetEntry,
  PayrollPayment,
  LeaveRequest,
  TaskDelegation,
  CrmLead,
  CrmDeal,
  CrmActivity,
} from '../types';
import {
  INITIAL_LESSORS,
  INITIAL_TENANTS,
  INITIAL_REPRESENTATIVES,
  INITIAL_OWNERSHIP_DOCUMENTS,
  INITIAL_PROPERTIES,
  INITIAL_E_POAS,
  INITIAL_CONTRACTS,
  INITIAL_BROKERAGE_AGREEMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_FINANCIAL_TRANSACTIONS,
  INITIAL_DAILY_FINANCIAL_SUMMARIES,
  INITIAL_AI_DAILY_REPORTS,
  INITIAL_GENERAL_SERVICES,
  INITIAL_CUSTOMER_ORDERS,
  INITIAL_MANAGED_PROPERTIES,
  INITIAL_MAINTENANCE_TASKS,
  INITIAL_ARCHIVED_DOCUMENTS,
  INITIAL_EMPLOYEES,
  INITIAL_TIMESHEET_ENTRIES,
  INITIAL_PAYROLL_PAYMENTS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_TASK_DELEGATIONS,
  INITIAL_CRM_LEADS,
  INITIAL_CRM_DEALS,
  INITIAL_CRM_ACTIVITIES,
} from '../supabaseClient';
import { ManagedPropertyContract, PropertyMaintenanceTask } from '../types';

const STORAGE_KEYS = {
  LESSORS: 'kohl_lessors_v1',
  TENANTS: 'kohl_tenants_v1',
  REPRESENTATIVES: 'kohl_representatives_v1',
  DOCUMENTS: 'kohl_ownership_documents_v1',
  PROPERTIES: 'kohl_properties_v1',
  E_POAS: 'kohl_e_poas_v1',
  CONTRACTS: 'kohl_contracts_v1',
  BROKERAGE: 'kohl_brokerage_agreements_v1',
  AUDIT_LOGS: 'kohl_audit_logs_v1',
  TRANSACTIONS: 'kohl_financial_transactions_v1',
  SUMMARIES: 'kohl_daily_summaries_v1',
  AI_REPORTS: 'kohl_ai_reports_v1',
  GENERAL_SERVICES: 'kohl_general_services_v1',
  CUSTOMER_ORDERS: 'kohl_customer_orders_v1',
  MANAGED_PROPERTIES: 'kohl_managed_properties_v1',
  MAINTENANCE_TASKS: 'kohl_maintenance_tasks_v1',
  ARCHIVED_DOCUMENTS: 'kohl_archived_documents_v1',
  EMPLOYEES: 'kohl_employees_v2',
  TIMESHEET: 'kohl_timesheet_v2',
  PAYROLL: 'kohl_payroll_v2',
  LEAVES: 'kohl_leaves_v2',
  TASK_DELEGATIONS: 'kohl_task_delegations_v2',
  CRM_LEADS: 'kohl_crm_leads_v1',
  CRM_DEALS: 'kohl_crm_deals_v1',
  CRM_ACTIVITIES: 'kohl_crm_activities_v1',
  DELETED_IDS: 'kohl_deleted_ids_v1',
};

// LocalStorage Helpers
export function getLocalData<T>(key: string, defaultData: T): T {
  if (typeof window === 'undefined') return defaultData;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultData;
  } catch (e) {
    console.warn(`LocalStorage read error for ${key}:`, e);
    return defaultData;
  }
}

export function setLocalData<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem('kohl_data_initialized', 'true');
  } catch (e) {
    console.warn(`LocalStorage write error for ${key}:`, e);
  }
}

export function clearAllLocalData(): void {
  if (typeof window === 'undefined') return;
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem('kohl_data_initialized');
}

// ----------------------------------------------------
// DELETED IDS TRACKING
// ----------------------------------------------------
export function markIdAsDeleted(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const deleted = getLocalData<string[]>(STORAGE_KEYS.DELETED_IDS, []);
    if (!deleted.includes(id)) {
      const updated = [...deleted, id];
      setLocalData(STORAGE_KEYS.DELETED_IDS, updated);
    }
  } catch (e) {
    console.warn('Error marking id as deleted:', e);
  }
}

export function getDeletedIdsSet(): Set<string> {
  const arr = getLocalData<string[]>(STORAGE_KEYS.DELETED_IDS, []);
  return new Set(arr);
}

// ----------------------------------------------------
// ENTITY MERGING UTILITY (PRESERVES LOCAL CREATIONS & EDITS)
// ----------------------------------------------------
function mergeEntities<T extends { id: string }>(
  localList: T[],
  remoteList: T[] | null,
  deletedSet: Set<string>
): T[] {
  // If remote fetch from Supabase succeeded (remoteList is an array, even if empty)
  if (remoteList !== null && Array.isArray(remoteList)) {
    // Supabase PostgreSQL database (office_db on Adminer 8088) is the direct single source of truth
    return remoteList.filter((item) => item && item.id);
  }

  // Fallback to localList if Supabase is offline or query failed
  if (localList && Array.isArray(localList)) {
    return localList.filter((item) => item && item.id && !deletedSet.has(item.id));
  }

  return [];
}

// ----------------------------------------------------
// DATABASE CRUD OPERATIONS (SUPABASE + LOCAL STORAGE)
// ----------------------------------------------------

export async function dbFetchAllData() {
  const localLessors = getLocalData<Lessor[]>(STORAGE_KEYS.LESSORS, INITIAL_LESSORS);
  const localTenants = getLocalData<Tenant[]>(STORAGE_KEYS.TENANTS, INITIAL_TENANTS);
  const localReps = getLocalData<Representative[]>(STORAGE_KEYS.REPRESENTATIVES, INITIAL_REPRESENTATIVES);
  const localDocs = getLocalData<OwnershipDocument[]>(STORAGE_KEYS.DOCUMENTS, INITIAL_OWNERSHIP_DOCUMENTS);
  const localProps = getLocalData<Property[]>(STORAGE_KEYS.PROPERTIES, INITIAL_PROPERTIES);
  const localEPoas = getLocalData<EPoa[]>(STORAGE_KEYS.E_POAS, INITIAL_E_POAS);
  const localContracts = getLocalData<Contract[]>(STORAGE_KEYS.CONTRACTS, INITIAL_CONTRACTS);
  const localBrokerage = getLocalData<BrokerageAgreement[]>(STORAGE_KEYS.BROKERAGE, INITIAL_BROKERAGE_AGREEMENTS);
  const localLogs = getLocalData<OwnershipAuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
  const localTx = getLocalData<FinancialTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_FINANCIAL_TRANSACTIONS);
  const localSummaries = getLocalData<DailyFinancialSummary[]>(STORAGE_KEYS.SUMMARIES, INITIAL_DAILY_FINANCIAL_SUMMARIES);
  const localReports = getLocalData<AiDailyReport[]>(STORAGE_KEYS.AI_REPORTS, INITIAL_AI_DAILY_REPORTS);
  const localServices = getLocalData<GeneralService[]>(STORAGE_KEYS.GENERAL_SERVICES, INITIAL_GENERAL_SERVICES);
  const localCustomerOrders = getLocalData<CustomerOrder[]>(STORAGE_KEYS.CUSTOMER_ORDERS, INITIAL_CUSTOMER_ORDERS);
  const localManagedProps = getLocalData<ManagedPropertyContract[]>(STORAGE_KEYS.MANAGED_PROPERTIES, INITIAL_MANAGED_PROPERTIES);
  const localMaintenanceTasks = getLocalData<PropertyMaintenanceTask[]>(STORAGE_KEYS.MAINTENANCE_TASKS, INITIAL_MAINTENANCE_TASKS);
  const localArchivedDocs = getLocalData<ArchivedDocument[]>(STORAGE_KEYS.ARCHIVED_DOCUMENTS, INITIAL_ARCHIVED_DOCUMENTS);
  const localEmployees = getLocalData<Employee[]>(STORAGE_KEYS.EMPLOYEES, INITIAL_EMPLOYEES);
  const localTimesheet = getLocalData<TimesheetEntry[]>(STORAGE_KEYS.TIMESHEET, INITIAL_TIMESHEET_ENTRIES);
  const localPayroll = getLocalData<PayrollPayment[]>(STORAGE_KEYS.PAYROLL, INITIAL_PAYROLL_PAYMENTS);
  const localLeaves = getLocalData<LeaveRequest[]>(STORAGE_KEYS.LEAVES, INITIAL_LEAVE_REQUESTS);
  const localTaskDelegations = getLocalData<TaskDelegation[]>(STORAGE_KEYS.TASK_DELEGATIONS, INITIAL_TASK_DELEGATIONS);
  const localCrmLeads = getLocalData<CrmLead[]>(STORAGE_KEYS.CRM_LEADS, INITIAL_CRM_LEADS);
  const localCrmDeals = getLocalData<CrmDeal[]>(STORAGE_KEYS.CRM_DEALS, INITIAL_CRM_DEALS);
  const localCrmActivities = getLocalData<CrmActivity[]>(STORAGE_KEYS.CRM_ACTIVITIES, INITIAL_CRM_ACTIVITIES);

  const deletedSet = getDeletedIdsSet();

  let sbLessors: Lessor[] | null = null;
  let sbTenants: Tenant[] | null = null;
  let sbReps: Representative[] | null = null;
  let sbDocs: OwnershipDocument[] | null = null;
  let sbProps: Property[] | null = null;
  let sbEPoas: EPoa[] | null = null;
  let sbContracts: Contract[] | null = null;
  let sbBrokerage: BrokerageAgreement[] | null = null;
  let sbLogs: OwnershipAuditLog[] | null = null;
  let sbTx: FinancialTransaction[] | null = null;
  let sbSummaries: DailyFinancialSummary[] | null = null;
  let sbReports: AiDailyReport[] | null = null;
  let sbServices: GeneralService[] | null = null;
  let sbCustomerOrders: CustomerOrder[] | null = null;
  let sbManagedProps: ManagedPropertyContract[] | null = null;
  let sbMaintenanceTasks: PropertyMaintenanceTask[] | null = null;
  let sbArchivedDocs: ArchivedDocument[] | null = null;
  let sbEmployees: Employee[] | null = null;
  let sbTimesheet: TimesheetEntry[] | null = null;
  let sbPayroll: PayrollPayment[] | null = null;
  let sbLeaves: LeaveRequest[] | null = null;
  let sbTaskDelegations: TaskDelegation[] | null = null;
  let sbCrmLeads: CrmLead[] | null = null;
  let sbCrmDeals: CrmDeal[] | null = null;
  let sbCrmActivities: CrmActivity[] | null = null;

  try {
    const [
      resLessors,
      resTenants,
      resReps,
      resDocs,
      resProps,
      resEPoas,
      resContracts,
      resBrokerage,
      resLogs,
      resTx,
      resSummaries,
      resReports,
      resServices,
      resCustomerOrders,
      resManagedProps,
      resMaintenanceTasks,
      resArchivedDocs,
      resEmployees,
      resTimesheet,
      resPayroll,
      resLeaves,
      resTasks,
      resLeads,
      resDeals,
      resActivities,
    ] = await Promise.allSettled([
      supabase.from('lessors').select('*'),
      supabase.from('tenants').select('*'),
      supabase.from('representatives').select('*'),
      supabase.from('ownership_documents').select('*'),
      supabase.from('properties').select('*'),
      supabase.from('e_poas').select('*'),
      supabase.from('contracts').select('*'),
      supabase.from('brokerage_agreements').select('*'),
      supabase.from('ownership_audit_logs').select('*'),
      supabase.from('financial_transactions').select('*'),
      supabase.from('daily_financial_summaries').select('*'),
      supabase.from('ai_daily_reports').select('*'),
      supabase.from('general_services').select('*'),
      supabase.from('customer_orders').select('*'),
      supabase.from('managed_property_contracts').select('*'),
      supabase.from('property_maintenance_tasks').select('*'),
      supabase.from('archived_documents').select('*'),
      supabase.from('employees').select('*'),
      supabase.from('timesheet_entries').select('*'),
      supabase.from('payroll_payments').select('*'),
      supabase.from('leave_requests').select('*'),
      supabase.from('task_delegations').select('*'),
      supabase.from('crm_leads').select('*'),
      supabase.from('crm_deals').select('*'),
      supabase.from('crm_activities').select('*'),
    ]);

    if (resLessors.status === 'fulfilled' && resLessors.value.data) sbLessors = resLessors.value.data as Lessor[];
    if (resTenants.status === 'fulfilled' && resTenants.value.data) sbTenants = resTenants.value.data as Tenant[];
    if (resReps.status === 'fulfilled' && resReps.value.data) sbReps = resReps.value.data as Representative[];
    if (resDocs.status === 'fulfilled' && resDocs.value.data) sbDocs = resDocs.value.data as OwnershipDocument[];
    if (resProps.status === 'fulfilled' && resProps.value.data) sbProps = resProps.value.data as Property[];
    if (resEPoas.status === 'fulfilled' && resEPoas.value.data) sbEPoas = resEPoas.value.data as EPoa[];
    if (resContracts.status === 'fulfilled' && resContracts.value.data) sbContracts = resContracts.value.data as Contract[];
    if (resBrokerage.status === 'fulfilled' && resBrokerage.value.data) sbBrokerage = resBrokerage.value.data as BrokerageAgreement[];
    if (resLogs.status === 'fulfilled' && resLogs.value.data) sbLogs = resLogs.value.data as OwnershipAuditLog[];
    if (resTx.status === 'fulfilled' && resTx.value.data) sbTx = resTx.value.data as FinancialTransaction[];
    if (resSummaries.status === 'fulfilled' && resSummaries.value.data) sbSummaries = resSummaries.value.data as DailyFinancialSummary[];
    if (resReports.status === 'fulfilled' && resReports.value.data) sbReports = resReports.value.data as AiDailyReport[];
    if (resServices.status === 'fulfilled' && resServices.value.data) sbServices = resServices.value.data as GeneralService[];
    if (resCustomerOrders.status === 'fulfilled' && resCustomerOrders.value.data) sbCustomerOrders = resCustomerOrders.value.data as CustomerOrder[];
    if (resManagedProps.status === 'fulfilled' && resManagedProps.value.data) sbManagedProps = resManagedProps.value.data as ManagedPropertyContract[];
    if (resMaintenanceTasks.status === 'fulfilled' && resMaintenanceTasks.value.data) sbMaintenanceTasks = resMaintenanceTasks.value.data as PropertyMaintenanceTask[];
    if (resArchivedDocs.status === 'fulfilled' && resArchivedDocs.value.data) sbArchivedDocs = resArchivedDocs.value.data as ArchivedDocument[];
    if (resEmployees.status === 'fulfilled' && resEmployees.value.data) sbEmployees = resEmployees.value.data as Employee[];
    if (resTimesheet.status === 'fulfilled' && resTimesheet.value.data) sbTimesheet = resTimesheet.value.data as TimesheetEntry[];
    if (resPayroll.status === 'fulfilled' && resPayroll.value.data) sbPayroll = resPayroll.value.data as PayrollPayment[];
    if (resLeaves.status === 'fulfilled' && resLeaves.value.data) sbLeaves = resLeaves.value.data as LeaveRequest[];
    if (resTasks.status === 'fulfilled' && resTasks.value.data) sbTaskDelegations = resTasks.value.data as TaskDelegation[];
    if (resLeads.status === 'fulfilled' && resLeads.value.data) sbCrmLeads = resLeads.value.data as CrmLead[];
    if (resDeals.status === 'fulfilled' && resDeals.value.data) sbCrmDeals = resDeals.value.data as CrmDeal[];
    if (resActivities.status === 'fulfilled' && resActivities.value.data) sbCrmActivities = resActivities.value.data as CrmActivity[];
  } catch (err) {
    console.warn('Supabase fetch failed, relying on localStorage persistence:', err);
  }

  // Merge local & remote data cleanly
  const lessors = mergeEntities(localLessors, sbLessors, deletedSet);
  const tenants = mergeEntities(localTenants, sbTenants, deletedSet);
  const representatives = mergeEntities(localReps, sbReps, deletedSet);
  const documents = mergeEntities(localDocs, sbDocs, deletedSet);
  const rawProps = mergeEntities(localProps, sbProps, deletedSet);
  const ePoas = mergeEntities(localEPoas, sbEPoas, deletedSet);
  const rawContracts = mergeEntities(localContracts, sbContracts, deletedSet);
  const rawBrokerage = mergeEntities(localBrokerage, sbBrokerage, deletedSet);
  const rawLogs = mergeEntities(localLogs, sbLogs, deletedSet);
  const rawTx = mergeEntities(localTx, sbTx, deletedSet);
  const dailySummaries = mergeEntities(localSummaries, sbSummaries, deletedSet);
  const aiReports = mergeEntities(localReports, sbReports, deletedSet);
  const generalServices = mergeEntities(localServices, sbServices, deletedSet);
  const customerOrders = mergeEntities(localCustomerOrders, sbCustomerOrders, deletedSet);
  const managedProperties = mergeEntities(localManagedProps, sbManagedProps, deletedSet);
  const maintenanceTasks = mergeEntities(localMaintenanceTasks, sbMaintenanceTasks, deletedSet);
  const archivedDocuments = mergeEntities(localArchivedDocs, sbArchivedDocs, deletedSet);
  const employees = mergeEntities(localEmployees, sbEmployees, deletedSet);
  const timesheetEntries = mergeEntities(localTimesheet, sbTimesheet, deletedSet);
  const payrollPayments = mergeEntities(localPayroll, sbPayroll, deletedSet);
  const leaveRequests = mergeEntities(localLeaves, sbLeaves, deletedSet);
  const taskDelegations = mergeEntities(localTaskDelegations, sbTaskDelegations, deletedSet);
  const crmLeads = mergeEntities(localCrmLeads, sbCrmLeads, deletedSet);
  const crmDeals = mergeEntities(localCrmDeals, sbCrmDeals, deletedSet);
  const crmActivities = mergeEntities(localCrmActivities, sbCrmActivities, deletedSet);

  // Sync back merged data into localStorage
  setLocalData(STORAGE_KEYS.LESSORS, lessors);
  setLocalData(STORAGE_KEYS.TENANTS, tenants);
  setLocalData(STORAGE_KEYS.REPRESENTATIVES, representatives);
  setLocalData(STORAGE_KEYS.DOCUMENTS, documents);
  setLocalData(STORAGE_KEYS.PROPERTIES, rawProps);
  setLocalData(STORAGE_KEYS.E_POAS, ePoas);
  setLocalData(STORAGE_KEYS.CONTRACTS, rawContracts);
  setLocalData(STORAGE_KEYS.BROKERAGE, rawBrokerage);
  setLocalData(STORAGE_KEYS.AUDIT_LOGS, rawLogs);
  setLocalData(STORAGE_KEYS.TRANSACTIONS, rawTx);
  setLocalData(STORAGE_KEYS.SUMMARIES, dailySummaries);
  setLocalData(STORAGE_KEYS.AI_REPORTS, aiReports);
  setLocalData(STORAGE_KEYS.GENERAL_SERVICES, generalServices);
  setLocalData(STORAGE_KEYS.CUSTOMER_ORDERS, customerOrders);
  setLocalData(STORAGE_KEYS.MANAGED_PROPERTIES, managedProperties);
  setLocalData(STORAGE_KEYS.MAINTENANCE_TASKS, maintenanceTasks);
  setLocalData(STORAGE_KEYS.ARCHIVED_DOCUMENTS, archivedDocuments);
  setLocalData(STORAGE_KEYS.EMPLOYEES, employees);
  setLocalData(STORAGE_KEYS.TIMESHEET, timesheetEntries);
  setLocalData(STORAGE_KEYS.PAYROLL, payrollPayments);
  setLocalData(STORAGE_KEYS.LEAVES, leaveRequests);
  setLocalData(STORAGE_KEYS.TASK_DELEGATIONS, taskDelegations);
  setLocalData(STORAGE_KEYS.CRM_LEADS, crmLeads);
  setLocalData(STORAGE_KEYS.CRM_DEALS, crmDeals);
  setLocalData(STORAGE_KEYS.CRM_ACTIVITIES, crmActivities);

  // Attach relations
  const properties: Property[] = rawProps.map((p) => ({
    ...p,
    lessor: lessors.find((l) => l.id === p.lessor_id) || p.lessor,
    current_representative: representatives.find((r) => r.id === p.current_representative_id) || p.current_representative,
    ownership_document: documents.find((d) => d.id === p.ownership_document_id) || p.ownership_document,
  }));

  const contracts: Contract[] = rawContracts.map((c) => ({
    ...c,
    property: properties.find((p) => p.id === c.property_id) || c.property,
    lessor: lessors.find((l) => l.id === c.lessor_id) || c.lessor,
  }));

  const brokerageAgreements: BrokerageAgreement[] = rawBrokerage.map((b) => ({
    ...b,
    property: properties.find((p) => p.id === b.property_id) || b.property,
    lessor: lessors.find((l) => l.id === b.lessor_id) || b.lessor,
  }));

  const auditLogs: OwnershipAuditLog[] = rawLogs.map((l) => ({
    ...l,
    property: properties.find((p) => p.id === l.property_id) || l.property,
    previous_lessor: lessors.find((les) => les.id === l.previous_lessor_id) || l.previous_lessor,
    new_lessor: lessors.find((les) => les.id === l.new_lessor_id) || l.new_lessor,
    previous_representative: representatives.find((r) => r.id === l.previous_representative_id) || l.previous_representative,
    new_representative: representatives.find((r) => r.id === l.new_representative_id) || l.new_representative,
  }));

  const transactions: FinancialTransaction[] = rawTx.map((t) => ({
    ...t,
    property: properties.find((p) => p.id === t.property_id) || t.property,
    contract: contracts.find((c) => c.id === t.contract_id) || t.contract,
    brokerage_agreement: brokerageAgreements.find((b) => b.id === t.brokerage_agreement_id) || t.brokerage_agreement,
  }));

  return {
    lessors,
    tenants,
    representatives,
    documents,
    properties,
    ePoas,
    contracts,
    brokerageAgreements,
    auditLogs,
    transactions,
    dailySummaries,
    aiReports,
    generalServices,
    customerOrders,
    managedProperties,
    maintenanceTasks,
    archivedDocuments,
    employees,
    timesheetEntries,
    payrollPayments,
    leaveRequests,
    taskDelegations,
    crmLeads,
    crmDeals,
    crmActivities,
  };
}

// -------------------
// LESSORS CRUD
// -------------------
export async function dbInsertLessor(lessor: Lessor) {
  try {
    await supabase.from('lessors').insert([
      {
        id: lessor.id,
        name: lessor.name,
        national_id_or_cr: lessor.national_id_or_cr,
        phone: lessor.phone,
        email: lessor.email,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertLessor error:', e);
  }
}

export async function dbDeleteLessor(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('lessors').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteLessor error:', e);
  }
}

// -------------------
// REPRESENTATIVES CRUD
// -------------------
export async function dbInsertRepresentative(rep: Representative) {
  try {
    await supabase.from('representatives').insert([
      {
        id: rep.id,
        name: rep.name,
        national_id: rep.national_id,
        phone: rep.phone,
        email: rep.email,
        e_poa_number: rep.e_poa_number,
        status: rep.status,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertRepresentative error:', e);
  }
}

export async function dbDeleteRepresentative(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('representatives').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteRepresentative error:', e);
  }
}

// -------------------
// OWNERSHIP DOCS CRUD
// -------------------
export async function dbInsertOwnershipDocument(doc: OwnershipDocument) {
  try {
    await supabase.from('ownership_documents').insert([
      {
        id: doc.id,
        document_number: doc.document_number,
        issue_date: doc.issue_date,
        file_url: doc.file_url,
        lessor_id: doc.lessor_id,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertOwnershipDocument error:', e);
  }
}

export async function dbDeleteOwnershipDocument(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('ownership_documents').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteOwnershipDocument error:', e);
  }
}

// -------------------
// PROPERTIES CRUD
// -------------------
export async function dbInsertProperty(prop: Property) {
  try {
    await supabase.from('properties').insert([
      {
        id: prop.id,
        title: prop.title,
        property_type: prop.property_type,
        address: prop.address,
        city: prop.city,
        units_count: prop.units_count,
        ownership_document_id: prop.ownership_document_id,
        lessor_id: prop.lessor_id,
        current_representative_id: prop.current_representative_id,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertProperty error:', e);
  }
}

export async function dbUpdateProperty(prop: Property) {
  try {
    await supabase
      .from('properties')
      .update({
        title: prop.title,
        property_type: prop.property_type,
        address: prop.address,
        city: prop.city,
        units_count: prop.units_count,
        ownership_document_id: prop.ownership_document_id,
        lessor_id: prop.lessor_id,
        current_representative_id: prop.current_representative_id,
      })
      .eq('id', prop.id);
  } catch (e) {
    console.warn('Supabase dbUpdateProperty error:', e);
  }
}

export async function dbDeleteProperty(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('properties').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteProperty error:', e);
  }
}

// -------------------
// E-POAs CRUD
// -------------------
export async function dbInsertEPoa(poa: EPoa) {
  try {
    await supabase.from('e_poas').insert([
      {
        id: poa.id,
        poa_number: poa.poa_number,
        grantor_id: poa.grantor_id,
        attorney_id: poa.attorney_id,
        issue_date: poa.issue_date,
        expiry_date: poa.expiry_date,
        scope_details: poa.scope_details,
        file_url: poa.file_url,
        status: poa.status,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertEPoa error:', e);
  }
}

export async function dbDeleteEPoa(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('e_poas').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteEPoa error:', e);
  }
}

// -------------------
// CONTRACTS CRUD
// -------------------
export async function dbInsertContract(contract: Contract) {
  try {
    await supabase.from('contracts').insert([
      {
        id: contract.id,
        contract_number: contract.contract_number,
        type: contract.type,
        property_id: contract.property_id,
        lessor_id: contract.lessor_id,
        tenant_name: contract.tenant_name,
        tenant_national_id: contract.tenant_national_id,
        rent_amount: contract.rent_amount,
        total_collected_amount: contract.total_collected_amount,
        office_profit: contract.office_profit,
        security_deposit_amount: contract.security_deposit_amount,
        lessor_requirements: contract.lessor_requirements,
        payment_schedule: contract.payment_schedule,
        start_date: contract.start_date,
        end_date: contract.end_date,
        status: contract.status,
        business_activity: contract.business_activity,
        vat_number: contract.vat_number,
        primary_lessor_consent: contract.primary_lessor_consent,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertContract error:', e);
  }
}

export async function dbDeleteContract(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('contracts').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteContract error:', e);
  }
}

// -------------------
// BROKERAGE AGREEMENTS CRUD
// -------------------
export async function dbInsertBrokerageAgreement(agreement: BrokerageAgreement) {
  try {
    await supabase.from('brokerage_agreements').insert([
      {
        id: agreement.id,
        agreement_number: agreement.agreement_number,
        property_id: agreement.property_id,
        lessor_id: agreement.lessor_id,
        commission_rate: agreement.commission_rate,
        office_profit: agreement.office_profit,
        start_date: agreement.start_date,
        expiry_date: agreement.expiry_date,
        ejar_status: agreement.ejar_status,
        file_url: agreement.file_url,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertBrokerageAgreement error:', e);
  }
}

export async function dbDeleteBrokerageAgreement(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('brokerage_agreements').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteBrokerageAgreement error:', e);
  }
}

// -------------------
// FINANCIAL TRANSACTIONS CRUD
// -------------------
export async function dbInsertFinancialTransaction(tx: FinancialTransaction) {
  try {
    await supabase.from('financial_transactions').insert([
      {
        id: tx.id,
        transaction_date: tx.transaction_date,
        transaction_type: tx.transaction_type,
        flow_type: tx.flow_type,
        gross_amount: tx.gross_amount,
        tax_vat_amount: tx.tax_vat_amount,
        net_amount: tx.net_amount,
        property_id: tx.property_id,
        contract_id: tx.contract_id,
        brokerage_agreement_id: tx.brokerage_agreement_id,
        notes: tx.notes,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertFinancialTransaction error:', e);
  }
}

export async function dbDeleteFinancialTransaction(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('financial_transactions').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteFinancialTransaction error:', e);
  }
}

// -------------------
// AUDIT LOGS CRUD
// -------------------
export async function dbInsertAuditLog(log: OwnershipAuditLog) {
  try {
    await supabase.from('ownership_audit_logs').insert([
      {
        id: log.id,
        property_id: log.property_id,
        previous_lessor_id: log.previous_lessor_id,
        new_lessor_id: log.new_lessor_id,
        previous_representative_id: log.previous_representative_id,
        new_representative_id: log.new_representative_id,
        change_type: log.change_type,
        notes: log.notes,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertAuditLog error:', e);
  }
}

// -------------------
// TENANTS CRUD
// -------------------
export async function dbInsertTenant(tenant: Tenant) {
  try {
    await supabase.from('tenants').insert([
      {
        id: tenant.id,
        name: tenant.name,
        national_id: tenant.national_id,
        phone: tenant.phone,
        email: tenant.email,
        type: tenant.type,
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertTenant error:', e);
  }
}

export async function dbDeleteTenant(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('tenants').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteTenant error:', e);
  }
}

// -------------------
// UPDATE OPERATIONS FOR ALL ENTITIES
// -------------------
export async function dbUpdateLessor(lessor: Lessor) {
  try {
    await supabase.from('lessors').update({
      name: lessor.name,
      national_id_or_cr: lessor.national_id_or_cr,
      phone: lessor.phone,
      email: lessor.email,
    }).eq('id', lessor.id);
  } catch (e) {
    console.warn('Supabase dbUpdateLessor error:', e);
  }
}

export async function dbUpdateTenant(tenant: Tenant) {
  try {
    await supabase.from('tenants').update({
      name: tenant.name,
      national_id: tenant.national_id,
      phone: tenant.phone,
      email: tenant.email,
      type: tenant.type,
    }).eq('id', tenant.id);
  } catch (e) {
    console.warn('Supabase dbUpdateTenant error:', e);
  }
}

export async function dbUpdateRepresentative(rep: Representative) {
  try {
    await supabase.from('representatives').update({
      name: rep.name,
      national_id: rep.national_id,
      phone: rep.phone,
      email: rep.email,
      e_poa_number: rep.e_poa_number,
      status: rep.status,
    }).eq('id', rep.id);
  } catch (e) {
    console.warn('Supabase dbUpdateRepresentative error:', e);
  }
}

export async function dbUpdateOwnershipDocument(doc: OwnershipDocument) {
  try {
    await supabase.from('ownership_documents').update({
      document_number: doc.document_number,
      issue_date: doc.issue_date,
      file_url: doc.file_url,
      lessor_id: doc.lessor_id,
    }).eq('id', doc.id);
  } catch (e) {
    console.warn('Supabase dbUpdateOwnershipDocument error:', e);
  }
}

export async function dbUpdateEPoa(poa: EPoa) {
  try {
    await supabase.from('e_poas').update({
      poa_number: poa.poa_number,
      grantor_id: poa.grantor_id,
      attorney_id: poa.attorney_id,
      issue_date: poa.issue_date,
      expiry_date: poa.expiry_date,
      scope_details: poa.scope_details,
      status: poa.status,
    }).eq('id', poa.id);
  } catch (e) {
    console.warn('Supabase dbUpdateEPoa error:', e);
  }
}

export async function dbUpdateContract(contract: Contract) {
  try {
    await supabase.from('contracts').update({
      type: contract.type,
      property_id: contract.property_id,
      lessor_id: contract.lessor_id,
      tenant_name: contract.tenant_name,
      tenant_national_id: contract.tenant_national_id,
      rent_amount: contract.rent_amount,
      total_collected_amount: contract.total_collected_amount,
      office_profit: contract.office_profit,
      security_deposit_amount: contract.security_deposit_amount,
      lessor_requirements: contract.lessor_requirements,
      payment_schedule: contract.payment_schedule,
      start_date: contract.start_date,
      end_date: contract.end_date,
      status: contract.status,
      business_activity: contract.business_activity,
      vat_number: contract.vat_number,
    }).eq('id', contract.id);
  } catch (e) {
    console.warn('Supabase dbUpdateContract error:', e);
  }
}

export async function dbUpdateBrokerageAgreement(agreement: BrokerageAgreement) {
  try {
    await supabase.from('brokerage_agreements').update({
      property_id: agreement.property_id,
      lessor_id: agreement.lessor_id,
      commission_rate: agreement.commission_rate,
      office_profit: agreement.office_profit,
      start_date: agreement.start_date,
      expiry_date: agreement.expiry_date,
      ejar_status: agreement.ejar_status,
    }).eq('id', agreement.id);
  } catch (e) {
    console.warn('Supabase dbUpdateBrokerageAgreement error:', e);
  }
}

export async function dbUpdateFinancialTransaction(tx: FinancialTransaction) {
  try {
    await supabase.from('financial_transactions').update({
      transaction_date: tx.transaction_date,
      transaction_type: tx.transaction_type,
      flow_type: tx.flow_type,
      gross_amount: tx.gross_amount,
      tax_vat_amount: tx.tax_vat_amount,
      net_amount: tx.net_amount,
      property_id: tx.property_id,
      contract_id: tx.contract_id,
      brokerage_agreement_id: tx.brokerage_agreement_id,
      notes: tx.notes,
    }).eq('id', tx.id);
  } catch (e) {
    console.warn('Supabase dbUpdateFinancialTransaction error:', e);
  }
}

export async function dbFetchGeneralServices(): Promise<GeneralService[]> {
  try {
    const { data, error } = await supabase.from('general_services').select('*').order('created_at', { ascending: false });
    if (error || !data) return INITIAL_GENERAL_SERVICES;
    return data as GeneralService[];
  } catch (e) {
    return INITIAL_GENERAL_SERVICES;
  }
}

export async function dbInsertGeneralService(service: GeneralService) {
  try {
    await supabase.from('general_services').insert([{
      id: service.id,
      service_number: service.service_number,
      client_name: service.client_name,
      client_phone: service.client_phone,
      client_national_id: service.client_national_id,
      category: service.category,
      title: service.title,
      cost_amount: service.cost_amount,
      fee_amount: service.fee_amount,
      office_profit: service.office_profit,
      status: service.status,
      notes: service.notes,
    }]);
  } catch (e) {
    console.warn('Supabase dbInsertGeneralService error:', e);
  }
}

export async function dbUpdateGeneralService(service: GeneralService) {
  try {
    await supabase.from('general_services').update({
      service_number: service.service_number,
      client_name: service.client_name,
      client_phone: service.client_phone,
      client_national_id: service.client_national_id,
      category: service.category,
      title: service.title,
      cost_amount: service.cost_amount,
      fee_amount: service.fee_amount,
      office_profit: service.office_profit,
      status: service.status,
      notes: service.notes,
    }).eq('id', service.id);
  } catch (e) {
    console.warn('Supabase dbUpdateGeneralService error:', e);
  }
}

export async function dbDeleteGeneralService(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('general_services').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteGeneralService error:', e);
  }
}

// ----------------------------------------------------
// CUSTOMER ORDERS CRUD
// ----------------------------------------------------
export async function dbInsertCustomerOrder(order: CustomerOrder): Promise<boolean> {
  try {
    const { error } = await supabase.from('customer_orders').insert([{
      id: order.id,
      order_number: order.order_number,
      client_name: order.client_name,
      client_phone: order.client_phone,
      category: order.category,
      building_type: order.building_type,
      desired_area: order.desired_area,
      budget_min: order.budget_min,
      budget_max: order.budget_max,
      status: order.status,
      notes: order.notes,
    }]);
    if (error) {
      console.warn('Supabase dbInsertCustomerOrder error:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Supabase dbInsertCustomerOrder error:', e);
    return false;
  }
}

export async function dbUpdateCustomerOrder(order: CustomerOrder) {
  try {
    await supabase.from('customer_orders').update({
      order_number: order.order_number,
      client_name: order.client_name,
      client_phone: order.client_phone,
      category: order.category,
      building_type: order.building_type,
      desired_area: order.desired_area,
      budget_min: order.budget_min,
      budget_max: order.budget_max,
      status: order.status,
      notes: order.notes,
    }).eq('id', order.id);
  } catch (e) {
    console.warn('Supabase dbUpdateCustomerOrder error:', e);
  }
}

export async function dbDeleteCustomerOrder(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('customer_orders').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteCustomerOrder error:', e);
  }
}

// ----------------------------------------------------
// MANAGED PROPERTIES & MAINTENANCE CRUD
// ----------------------------------------------------
export async function dbInsertManagedProperty(prop: ManagedPropertyContract) {
  try {
    await supabase.from('managed_property_contracts').insert([{
      id: prop.id,
      contract_number: prop.contract_number,
      property_name: prop.property_name,
      lessor_name: prop.lessor_name,
      lessor_phone: prop.lessor_phone,
      property_type: prop.property_type,
      total_units: prop.total_units,
      occupied_units: prop.occupied_units,
      vacant_units: prop.vacant_units,
      fee_type: prop.fee_type,
      fee_value: prop.fee_value,
      annual_expected_revenue: prop.annual_expected_revenue,
      collected_revenue: prop.collected_revenue,
      transferred_to_owner: prop.transferred_to_owner,
      start_date: prop.start_date,
      end_date: prop.end_date,
      status: prop.status,
      notes: prop.notes,
    }]);
  } catch (e) {
    console.warn('Supabase dbInsertManagedProperty error:', e);
  }
}

export async function dbUpdateManagedProperty(prop: ManagedPropertyContract) {
  try {
    await supabase.from('managed_property_contracts').update({
      contract_number: prop.contract_number,
      property_name: prop.property_name,
      lessor_name: prop.lessor_name,
      lessor_phone: prop.lessor_phone,
      property_type: prop.property_type,
      total_units: prop.total_units,
      occupied_units: prop.occupied_units,
      vacant_units: prop.vacant_units,
      fee_type: prop.fee_type,
      fee_value: prop.fee_value,
      annual_expected_revenue: prop.annual_expected_revenue,
      collected_revenue: prop.collected_revenue,
      transferred_to_owner: prop.transferred_to_owner,
      start_date: prop.start_date,
      end_date: prop.end_date,
      status: prop.status,
      notes: prop.notes,
    }).eq('id', prop.id);
  } catch (e) {
    console.warn('Supabase dbUpdateManagedProperty error:', e);
  }
}

export async function dbDeleteManagedProperty(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('managed_property_contracts').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteManagedProperty error:', e);
  }
}

export async function dbInsertMaintenanceTask(task: PropertyMaintenanceTask) {
  try {
    await supabase.from('property_maintenance_tasks').insert([{
      id: task.id,
      task_number: task.task_number,
      managed_property_id: task.managed_property_id,
      property_name: task.property_name,
      unit_name: task.unit_name,
      maintenance_type: task.maintenance_type,
      cost_amount: task.cost_amount,
      contractor_name: task.contractor_name,
      contractor_phone: task.contractor_phone,
      status: task.status,
      notes: task.notes,
    }]);
  } catch (e) {
    console.warn('Supabase dbInsertMaintenanceTask error:', e);
  }
}

export async function dbUpdateMaintenanceTask(task: PropertyMaintenanceTask) {
  try {
    await supabase.from('property_maintenance_tasks').update({
      task_number: task.task_number,
      managed_property_id: task.managed_property_id,
      property_name: task.property_name,
      unit_name: task.unit_name,
      maintenance_type: task.maintenance_type,
      cost_amount: task.cost_amount,
      contractor_name: task.contractor_name,
      contractor_phone: task.contractor_phone,
      status: task.status,
      notes: task.notes,
    }).eq('id', task.id);
  } catch (e) {
    console.warn('Supabase dbUpdateMaintenanceTask error:', e);
  }
}

export async function dbDeleteMaintenanceTask(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('property_maintenance_tasks').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteMaintenanceTask error:', e);
  }
}

// -------------------
// ARCHIVED DOCUMENTS CRUD
// -------------------
export async function dbFetchArchivedDocuments(): Promise<ArchivedDocument[]> {
  try {
    const { data, error } = await supabase.from('archived_documents').select('*');
    if (error || !data) throw error;
    return data as ArchivedDocument[];
  } catch (e) {
    console.warn('Supabase dbFetchArchivedDocuments error, falling back to local storage:', e);
    return getLocalData<ArchivedDocument[]>(STORAGE_KEYS.ARCHIVED_DOCUMENTS, INITIAL_ARCHIVED_DOCUMENTS);
  }
}

export async function dbInsertArchivedDocument(doc: ArchivedDocument) {
  try {
    await supabase.from('archived_documents').insert([
      {
        id: doc.id,
        archive_code: doc.archive_code,
        title: doc.title,
        category: doc.category,
        reference_number: doc.reference_number,
        client_or_entity: doc.client_or_entity,
        date: doc.date,
        status: doc.status,
        file_name: doc.file_name,
        file_size: doc.file_size,
        file_data_url: doc.file_data_url,
        notes: doc.notes,
        tags: doc.tags,
        source_module: doc.source_module,
        created_at: doc.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertArchivedDocument error:', e);
  }
}

export async function dbUpdateArchivedDocument(doc: ArchivedDocument) {
  try {
    await supabase.from('archived_documents').update({
      archive_code: doc.archive_code,
      title: doc.title,
      category: doc.category,
      reference_number: doc.reference_number,
      client_or_entity: doc.client_or_entity,
      date: doc.date,
      status: doc.status,
      file_name: doc.file_name,
      file_size: doc.file_size,
      file_data_url: doc.file_data_url,
      notes: doc.notes,
      tags: doc.tags,
      source_module: doc.source_module,
    }).eq('id', doc.id);
  } catch (e) {
    console.warn('Supabase dbUpdateArchivedDocument error:', e);
  }
}

export async function dbDeleteArchivedDocument(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('archived_documents').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteArchivedDocument error:', e);
  }
}

// -------------------
// EMPLOYEES CRUD
// -------------------
export async function dbInsertEmployee(emp: Employee) {
  try {
    await supabase.from('employees').insert([
      {
        id: emp.id,
        employee_number: emp.employee_number,
        name: emp.name,
        national_id_or_iqama: emp.national_id_or_iqama,
        job_title: emp.job_title,
        department: emp.department,
        phone: emp.phone,
        email: emp.email,
        hire_date: emp.hire_date,
        basic_salary: emp.basic_salary,
        housing_allowance: emp.housing_allowance,
        transport_allowance: emp.transport_allowance,
        other_allowances: emp.other_allowances || 0,
        status: emp.status,
        system_role: emp.system_role,
        notes: emp.notes,
        created_at: emp.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertEmployee error:', e);
  }
}

export async function dbUpdateEmployee(emp: Employee) {
  try {
    await supabase.from('employees').update({
      employee_number: emp.employee_number,
      name: emp.name,
      national_id_or_iqama: emp.national_id_or_iqama,
      job_title: emp.job_title,
      department: emp.department,
      phone: emp.phone,
      email: emp.email,
      hire_date: emp.hire_date,
      basic_salary: emp.basic_salary,
      housing_allowance: emp.housing_allowance,
      transport_allowance: emp.transport_allowance,
      other_allowances: emp.other_allowances || 0,
      status: emp.status,
      system_role: emp.system_role,
      notes: emp.notes,
    }).eq('id', emp.id);
  } catch (e) {
    console.warn('Supabase dbUpdateEmployee error:', e);
  }
}

export async function dbDeleteEmployee(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('employees').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteEmployee error:', e);
  }
}

// -------------------
// TIMESHEET CRUD
// -------------------
export async function dbInsertTimesheet(ts: TimesheetEntry) {
  try {
    await supabase.from('timesheet_entries').insert([
      {
        id: ts.id,
        employee_id: ts.employee_id,
        employee_name: ts.employee_name,
        date: ts.date,
        check_in: ts.check_in,
        check_out: ts.check_out,
        total_hours: ts.total_hours,
        status: ts.status,
        notes: ts.notes,
        created_at: ts.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertTimesheet error:', e);
  }
}

export async function dbUpdateTimesheet(ts: TimesheetEntry) {
  try {
    await supabase.from('timesheet_entries').update({
      check_in: ts.check_in,
      check_out: ts.check_out,
      total_hours: ts.total_hours,
      status: ts.status,
      notes: ts.notes,
    }).eq('id', ts.id);
  } catch (e) {
    console.warn('Supabase dbUpdateTimesheet error:', e);
  }
}

export async function dbDeleteTimesheet(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('timesheet_entries').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteTimesheet error:', e);
  }
}

// -------------------
// PAYROLL CRUD
// -------------------
export async function dbInsertPayroll(pay: PayrollPayment) {
  try {
    await supabase.from('payroll_payments').insert([
      {
        id: pay.id,
        payment_number: pay.payment_number,
        employee_id: pay.employee_id,
        employee_name: pay.employee_name,
        month_year: pay.month_year,
        basic_salary: pay.basic_salary,
        allowances: pay.allowances,
        commissions: pay.commissions,
        deductions: pay.deductions,
        net_amount: pay.net_amount,
        payment_date: pay.payment_date,
        payment_method: pay.payment_method,
        reference_number: pay.reference_number,
        status: pay.status,
        is_archived: pay.is_archived || false,
        notes: pay.notes,
        created_at: pay.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertPayroll error:', e);
  }
}

export async function dbUpdatePayroll(pay: PayrollPayment) {
  try {
    await supabase.from('payroll_payments').update({
      payment_number: pay.payment_number,
      basic_salary: pay.basic_salary,
      allowances: pay.allowances,
      commissions: pay.commissions,
      deductions: pay.deductions,
      net_amount: pay.net_amount,
      payment_date: pay.payment_date,
      payment_method: pay.payment_method,
      reference_number: pay.reference_number,
      status: pay.status,
      is_archived: pay.is_archived,
      notes: pay.notes,
    }).eq('id', pay.id);
  } catch (e) {
    console.warn('Supabase dbUpdatePayroll error:', e);
  }
}

export async function dbDeletePayroll(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('payroll_payments').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeletePayroll error:', e);
  }
}

// -------------------
// LEAVE REQUESTS CRUD
// -------------------
export async function dbInsertLeaveRequest(lv: LeaveRequest) {
  try {
    await supabase.from('leave_requests').insert([
      {
        id: lv.id,
        employee_id: lv.employee_id,
        employee_name: lv.employee_name,
        leave_type: lv.leave_type,
        start_date: lv.start_date,
        end_date: lv.end_date,
        days_count: lv.days_count,
        reason: lv.reason,
        status: lv.status,
        approved_by: lv.approved_by,
        approved_at: lv.approved_at,
        created_at: lv.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertLeaveRequest error:', e);
  }
}

export async function dbUpdateLeaveRequest(lv: LeaveRequest) {
  try {
    await supabase.from('leave_requests').update({
      leave_type: lv.leave_type,
      start_date: lv.start_date,
      end_date: lv.end_date,
      days_count: lv.days_count,
      reason: lv.reason,
      status: lv.status,
      approved_by: lv.approved_by,
      approved_at: lv.approved_at,
    }).eq('id', lv.id);
  } catch (e) {
    console.warn('Supabase dbUpdateLeaveRequest error:', e);
  }
}

export async function dbDeleteLeaveRequest(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('leave_requests').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteLeaveRequest error:', e);
  }
}

// -------------------
// TASK DELEGATIONS CRUD
// -------------------
export async function dbInsertTaskDelegation(tsk: TaskDelegation) {
  try {
    await supabase.from('task_delegations').insert([
      {
        id: tsk.id,
        task_code: tsk.task_code,
        title: tsk.title,
        description: tsk.description,
        assigned_to_employee_id: tsk.assigned_to_employee_id,
        assigned_to_name: tsk.assigned_to_name,
        delegated_by_id: tsk.delegated_by_id,
        delegated_by_name: tsk.delegated_by_name,
        priority: tsk.priority,
        due_date: tsk.due_date,
        status: tsk.status,
        is_delegated_action: tsk.is_delegated_action || false,
        completed_at: tsk.completed_at,
        notes: tsk.notes,
        created_at: tsk.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertTaskDelegation error:', e);
  }
}

export async function dbUpdateTaskDelegation(tsk: TaskDelegation) {
  try {
    await supabase.from('task_delegations').update({
      title: tsk.title,
      description: tsk.description,
      priority: tsk.priority,
      due_date: tsk.due_date,
      status: tsk.status,
      is_delegated_action: tsk.is_delegated_action,
      completed_at: tsk.completed_at,
      notes: tsk.notes,
    }).eq('id', tsk.id);
  } catch (e) {
    console.warn('Supabase dbUpdateTaskDelegation error:', e);
  }
}

export async function dbDeleteTaskDelegation(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('task_delegations').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteTaskDelegation error:', e);
  }
}

// -------------------
// CRM LEADS CRUD
// -------------------
export async function dbInsertCrmLead(lead: CrmLead) {
  try {
    await supabase.from('crm_leads').insert([
      {
        id: lead.id,
        lead_code: lead.lead_code,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        lead_type: lead.lead_type,
        stage: lead.stage,
        priority: lead.priority,
        source: lead.source,
        budget_min: lead.budget_min,
        budget_max: lead.budget_max,
        preferred_property_type: lead.preferred_property_type,
        preferred_city: lead.preferred_city,
        preferred_district: lead.preferred_district,
        assigned_agent_id: lead.assigned_agent_id,
        assigned_agent_name: lead.assigned_agent_name,
        notes: lead.notes,
        is_archived: lead.is_archived || false,
        created_at: lead.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertCrmLead error:', e);
  }
}

export async function dbUpdateCrmLead(lead: CrmLead) {
  try {
    await supabase.from('crm_leads').update({
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      lead_type: lead.lead_type,
      stage: lead.stage,
      priority: lead.priority,
      source: lead.source,
      budget_min: lead.budget_min,
      budget_max: lead.budget_max,
      preferred_property_type: lead.preferred_property_type,
      preferred_city: lead.preferred_city,
      preferred_district: lead.preferred_district,
      assigned_agent_id: lead.assigned_agent_id,
      assigned_agent_name: lead.assigned_agent_name,
      notes: lead.notes,
      is_archived: lead.is_archived,
    }).eq('id', lead.id);
  } catch (e) {
    console.warn('Supabase dbUpdateCrmLead error:', e);
  }
}

export async function dbDeleteCrmLead(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('crm_leads').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteCrmLead error:', e);
  }
}

// -------------------
// CRM DEALS CRUD
// -------------------
export async function dbInsertCrmDeal(deal: CrmDeal) {
  try {
    await supabase.from('crm_deals').insert([
      {
        id: deal.id,
        deal_code: deal.deal_code,
        title: deal.title,
        lead_id: deal.lead_id,
        lead_name: deal.lead_name,
        lead_phone: deal.lead_phone,
        property_id: deal.property_id,
        property_title: deal.property_title,
        deal_value: deal.deal_value,
        commission_rate: deal.commission_rate,
        commission_amount: deal.commission_amount,
        office_profit: deal.office_profit,
        stage: deal.stage,
        expected_closing_date: deal.expected_closing_date,
        assigned_agent_id: deal.assigned_agent_id,
        assigned_agent_name: deal.assigned_agent_name,
        is_archived: deal.is_archived || false,
        notes: deal.notes,
        created_at: deal.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertCrmDeal error:', e);
  }
}

export async function dbUpdateCrmDeal(deal: CrmDeal) {
  try {
    await supabase.from('crm_deals').update({
      title: deal.title,
      property_id: deal.property_id,
      property_title: deal.property_title,
      deal_value: deal.deal_value,
      commission_rate: deal.commission_rate,
      commission_amount: deal.commission_amount,
      office_profit: deal.office_profit,
      stage: deal.stage,
      expected_closing_date: deal.expected_closing_date,
      assigned_agent_id: deal.assigned_agent_id,
      assigned_agent_name: deal.assigned_agent_name,
      is_archived: deal.is_archived,
      notes: deal.notes,
    }).eq('id', deal.id);
  } catch (e) {
    console.warn('Supabase dbUpdateCrmDeal error:', e);
  }
}

export async function dbDeleteCrmDeal(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('crm_deals').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteCrmDeal error:', e);
  }
}

// -------------------
// CRM ACTIVITIES CRUD
// -------------------
export async function dbInsertCrmActivity(act: CrmActivity) {
  try {
    await supabase.from('crm_activities').insert([
      {
        id: act.id,
        lead_id: act.lead_id,
        deal_id: act.deal_id,
        lead_or_client_name: act.lead_or_client_name,
        activity_type: act.activity_type,
        title: act.title,
        notes: act.notes,
        due_date: act.due_date,
        status: act.status,
        created_by_name: act.created_by_name,
        created_at: act.created_at || new Date().toISOString(),
      },
    ]);
  } catch (e) {
    console.warn('Supabase dbInsertCrmActivity error:', e);
  }
}

export async function dbUpdateCrmActivity(act: CrmActivity) {
  try {
    await supabase.from('crm_activities').update({
      title: act.title,
      notes: act.notes,
      due_date: act.due_date,
      status: act.status,
    }).eq('id', act.id);
  } catch (e) {
    console.warn('Supabase dbUpdateCrmActivity error:', e);
  }
}

export async function dbDeleteCrmActivity(id: string) {
  markIdAsDeleted(id);
  try {
    await supabase.from('crm_activities').delete().eq('id', id);
  } catch (e) {
    console.warn('Supabase dbDeleteCrmActivity error:', e);
  }
}

export { STORAGE_KEYS };
