// Domain Data Models for Real Estate Office Management System

export type PropertyType = 'Residential' | 'Commercial' | 'Land';
export type ContractType = 'RESIDENTIAL' | 'COMMERCIAL' | 'SUBLEASE';
export type PaymentSchedule = 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual';
export type ContractStatus = 'Draft' | 'Active' | 'Terminated' | 'Expired';
export type EPoaStatus = 'Active' | 'Expired' | 'Revoked';
export type EjarStatus = 'Pending' | 'Active' | 'Cancelled';
export type RepresentativeStatus = 'ACTIVE' | 'INACTIVE';
export type AuditChangeType = 'LESSOR_TRANSFER' | 'REPRESENTATIVE_CHANGE';

export interface Lessor {
  id: string;
  name: string;
  national_id_or_cr: string; // الهوية الوطنية / السجل التجاري
  phone: string;
  email?: string;
  created_at?: string;
}

export interface Tenant {
  id: string;
  name: string;
  national_id: string; // الهوية الوطنية / السجل التجاري
  phone: string;
  email?: string;
  type?: 'Individual' | 'Company';
  created_at?: string;
}

export interface Representative {
  id: string;
  name: string;
  national_id: string;
  phone: string;
  email?: string;
  e_poa_number?: string; // رقم الوكالة الإلكترونية
  status: RepresentativeStatus;
  created_at?: string;
}

export interface OwnershipDocument {
  id: string;
  document_number: string; // رقم صك الملكية
  issue_date: string;
  file_url?: string;
  lessor_id: string;
  lessor?: Lessor;
  created_at?: string;
}

export interface Property {
  id: string;
  title: string;
  property_type: PropertyType;
  address: string;
  city: string;
  units_count: number;
  ownership_document_id?: string;
  lessor_id: string;
  current_representative_id?: string;
  ownership_document?: OwnershipDocument;
  lessor?: Lessor;
  current_representative?: Representative;
  created_at?: string;
}

export interface EPoa {
  id: string;
  poa_number: string;
  grantor_id: string; // المؤجر
  attorney_id: string; // الوكيل / الممثل
  issue_date: string;
  expiry_date: string;
  scope_details?: string;
  file_url?: string;
  status: EPoaStatus;
  grantor?: Lessor;
  attorney?: Representative;
  created_at?: string;
}

export interface Contract {
  id: string;
  contract_number: string;
  type: ContractType;
  property_id: string;
  lessor_id: string;
  tenant_name: string;
  tenant_national_id: string;
  rent_amount: number;
  total_collected_amount?: number; // المستقطع الإجمالي من المستأجر
  office_profit?: number; // ربح المكتب الفعلي من عقد الإيجار
  security_deposit_amount?: number; // مبلغ التأمين المسترد إن وجد
  lessor_requirements?: string; // طلب وشروط خاصة من المؤجر
  payment_schedule: PaymentSchedule;
  start_date: string;
  end_date: string;
  status: ContractStatus;
  business_activity?: string;
  vat_number?: string;
  primary_lessor_consent?: boolean;
  property?: Property;
  lessor?: Lessor;
  created_at?: string;
}

export interface BrokerageAgreement {
  id: string;
  agreement_number: string;
  property_id: string;
  lessor_id: string;
  commission_rate: number;
  office_profit?: number; // ربح المكتب من اتفاقية الوساطة
  start_date: string;
  expiry_date: string;
  ejar_status: EjarStatus;
  file_url?: string;
  property?: Property;
  lessor?: Lessor;
  created_at?: string;
}

export interface OwnershipAuditLog {
  id: string;
  property_id: string;
  previous_lessor_id?: string;
  new_lessor_id?: string;
  previous_representative_id?: string;
  new_representative_id?: string;
  change_type: AuditChangeType;
  notes?: string;
  changed_at: string;
  property?: Property;
  previous_lessor?: Lessor;
  new_lessor?: Lessor;
  previous_representative?: Representative;
  new_representative?: Representative;
}

export interface DashboardStats {
  totalActiveContracts: number;
  totalProperties: number;
  activeEPoas: number;
  expiringBrokerageAgreements: number;
}

// Financial Tracking & AI Engine Types

export type TransactionType =
  | 'BROKERAGE_COMMISSION'
  | 'RENTAL_PAYMENT'
  | 'DOCUMENT_FEE'
  | 'MANAGEMENT_FEE'
  | 'OPERATING_EXPENSE'
  | 'MAINTENANCE_COST';

export type FlowType = 'INCOME' | 'EXPENSE';

export interface FinancialTransaction {
  id: string;
  transaction_date: string;
  transaction_type: TransactionType;
  flow_type: FlowType;
  gross_amount: number;
  tax_vat_amount: number;
  net_amount: number;
  property_id?: string;
  contract_id?: string;
  brokerage_agreement_id?: string;
  notes?: string;
  property?: Property;
  contract?: Contract;
  brokerage_agreement?: BrokerageAgreement;
  created_at?: string;
}

export interface DailyFinancialSummary {
  id: string;
  summary_date: string;
  total_gross_income: number;
  total_expenses: number;
  total_net_income: number;
  new_contracts_count: number;
  active_brokerage_deals_count: number;
  occupancy_rate: number;
  created_at?: string;
}

export interface AiDailyReport {
  id: string;
  report_date: string;
  gross_income: number;
  net_income: number;
  what_went_well: string[];
  what_went_bad: string[];
  ai_recommendations: string[];
  income_increment_strategy: string;
  created_at?: string;
}

export type ServiceCategory = 'EJAR' | 'BALADY' | 'QIWA' | 'DEED_SURVEY' | 'GOV_TRANSACTION' | 'OTHER';
export type ServiceStatus = 'Pending' | 'In_Progress' | 'Completed' | 'Cancelled';

export interface GeneralService {
  id: string;
  service_number: string;
  client_name: string;
  client_phone?: string;
  client_national_id?: string;
  category: ServiceCategory;
  title: string;
  cost_amount: number; // التكلفة / الرسوم المستقطعة
  fee_amount: number; // المبلغ الإجمالي المحصل من العميل
  office_profit: number; // ربح المكتب الفعلي من المعاملة (fee_amount - cost_amount)
  status: ServiceStatus;
  notes?: string;
  created_at?: string;
}

// ----------------------------------------------------
// PROPERTY MANAGEMENT & MAINTENANCE TYPES (إدارة الأملاك والتشغيل)
// ----------------------------------------------------
export type ManagementFeeType = 'PERCENTAGE' | 'FIXED_ANNUAL';
export type ManagementStatus = 'Active' | 'Under_Renewal' | 'Expired' | 'Suspended';
export type MaintenanceStatus = 'Pending' | 'In_Progress' | 'Completed' | 'Cancelled';

export interface ManagedPropertyContract {
  id: string;
  contract_number: string; // رقم عقد إدارة الأملاك (PMC-2026-001)
  property_name: string; // اسم العقار أو المجمع (عمارة النخيل السكنية)
  lessor_name: string; // اسم المالك
  lessor_phone: string; // رقم جوال المالك
  property_type: 'Residential' | 'Commercial' | 'Mixed'; // نوع العقار
  total_units: number; // إجمالي عدد الوحدات
  occupied_units: number; // عدد الوحدات المؤجرة
  vacant_units: number; // عدد الوحدات الشاغرة
  fee_type: ManagementFeeType; // طريقة الأتعاب (نسبة مئوية أو مبلغ مقطوع)
  fee_value: number; // قيمة النسبة (%) أو المبلغ السنوي المقطوع
  annual_expected_revenue: number; // الإيراد السنوي المستهدف (ر.س)
  collected_revenue: number; // المبالغ المحصلة فعلياً (ر.س)
  transferred_to_owner: number; // صافي المحول للمالك بعد خصم الأتعاب والصيانة (ر.س)
  start_date: string; // تاريخ بداية الإدارة
  end_date: string; // تاريخ نهاية الإدارة
  status: ManagementStatus; // حالة عقد الإدارة
  notes?: string; // ملاحظات واشتراطات خاصة
  created_at?: string;
}

export interface PropertyMaintenanceTask {
  id: string;
  task_number: string; // رقم أمر الصيانة (MNT-2026-001)
  managed_property_id: string; // معرف عقد/عقار إدارة الأملاك
  property_name: string; // اسم العقار
  unit_name?: string; // اسم أو رقم الوحدة المتأثرة (شقة 104)
  maintenance_type: string; // نوع الصيانة (سباكة، كهرباء، مصاعد، نظافة، تكييف)
  cost_amount: number; // تكلفة الصيانة الفعلية (ر.س)
  contractor_name?: string; // اسم المورد أو الفني المنفذ
  contractor_phone?: string; // رقم جوال الفني
  status: MaintenanceStatus; // حالة أمر الصيانة
  notes?: string; // تفاصيل العمل المطلوب
  created_at?: string;
}

// ----------------------------------------------------
// CUSTOMER ORDERS & PROPERTY REQUESTS TYPES (طلبات العملاء)
// ----------------------------------------------------
export type CustomerOrderCategory = 'RESIDENTIAL' | 'COMMERCIAL';
export type CustomerOrderStatus = 'New' | 'Searching' | 'Fulfilled' | 'Cancelled';

export interface CustomerOrder {
  id: string;
  order_number: string; // رقم الطلب
  client_name: string; // اسم العميل
  client_phone: string; // رقم الجوال
  category: CustomerOrderCategory; // سكني أو تجاري
  building_type: string; // نوع العقار المطلوب (فيلا، شقة، دور، معرض، مكتب...)
  desired_area: string; // الحي / المنطقة والمساحة المطلوبة
  budget_min?: number; // الميزانية الدنيا
  budget_max?: number; // الميزانية القصوى (ر.س)
  status: CustomerOrderStatus; // حالة الطلب
  notes?: string; // تفاصيل وشروط إضافية
  created_at?: string;
}
