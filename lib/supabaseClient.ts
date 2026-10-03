import { createClient } from '@supabase/supabase-js';
import {
  Lessor,
  Tenant,
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
  CustomerOrder,
  ManagedPropertyContract,
  PropertyMaintenanceTask,
  ArchivedDocument,
  Employee,
  TimesheetEntry,
  PayrollPayment,
  LeaveRequest,
  TaskDelegation,
  CrmLead,
  CrmDeal,
  CrmActivity,
} from './types';

const getSupabaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'https://kohl.kohlestate-ksa.online';
  }
  return 'http://51.195.222.51:8000';
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'not-configured';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Empty initial collections; authenticated database records populate the application.
export const INITIAL_LESSORS: Lessor[] = [];

export const INITIAL_TENANTS: Tenant[] = [];

export const INITIAL_REPRESENTATIVES: Representative[] = [];

export const INITIAL_OWNERSHIP_DOCUMENTS: OwnershipDocument[] = [];

export const INITIAL_PROPERTIES: Property[] = [];

export const INITIAL_E_POAS: EPoa[] = [];

export const INITIAL_CONTRACTS: Contract[] = [];

export const INITIAL_BROKERAGE_AGREEMENTS: BrokerageAgreement[] = [];

export const INITIAL_AUDIT_LOGS: OwnershipAuditLog[] = [];


export const INITIAL_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [];

export const INITIAL_DAILY_FINANCIAL_SUMMARIES: DailyFinancialSummary[] = [];

export const INITIAL_AI_DAILY_REPORTS: AiDailyReport[] = [];

export const INITIAL_GENERAL_SERVICES: GeneralService[] = [];

export const INITIAL_CUSTOMER_ORDERS: CustomerOrder[] = [];

export const INITIAL_MANAGED_PROPERTIES: ManagedPropertyContract[] = [];

export const INITIAL_MAINTENANCE_TASKS: PropertyMaintenanceTask[] = [];

export const INITIAL_ARCHIVED_DOCUMENTS: ArchivedDocument[] = [];

// Initial Employees
export const INITIAL_EMPLOYEES: Employee[] = [];

// Initial Timesheet & Attendance
export const INITIAL_TIMESHEET_ENTRIES: TimesheetEntry[] = [];

// Initial Payroll Payments
export const INITIAL_PAYROLL_PAYMENTS: PayrollPayment[] = [];

// Initial Leave Requests
export const INITIAL_LEAVE_REQUESTS: LeaveRequest[] = [];

// Initial Task Delegations (CEO/Admin delegating or acting on behalf)
export const INITIAL_TASK_DELEGATIONS: TaskDelegation[] = [];

// Initial CRM Leads
export const INITIAL_CRM_LEADS: CrmLead[] = [];

// Initial CRM Deals
export const INITIAL_CRM_DEALS: CrmDeal[] = [];

// Initial CRM Activities
export const INITIAL_CRM_ACTIVITIES: CrmActivity[] = [];
