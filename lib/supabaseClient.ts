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
} from './types';

const getSupabaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Browser on the live HTTPS domain must call the same-origin HTTPS proxy path
  // (proxied by Nginx Proxy Manager to the PostgREST gateway on :8020) —
  // calling the bare http://IP:8020 endpoint directly gets silently blocked
  // as mixed content by the browser when the page itself is served over HTTPS.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return 'https://office.mabotargagh.online';
  }
  return 'http://76.13.40.119:8020';
};

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoid2ViX2Fub24iLCJpc3MiOiJwb3N0Z3Jlc3QiLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTk4ODE1MDQwMH0.bagwe56G6djpeZq2a3gBWeM83HSIjkb2ZM633wNs-5Q';

// The app runs local-storage-only for now — the remote database is disconnected
// until a new, properly access-controlled self-hosted Supabase instance replaces
// it (the previous one had no auth on its anon role and lost all non-seed data).
// Flip this back to true once that replacement is ready and configured above.
const DB_ENABLED = false;

// A chainable stand-in for the Supabase query builder that resolves every
// select/insert/update/delete/eq/order/... call to { data: null, error: null }
// without any network I/O, so dbService.ts's existing local-storage fallback
// path (used whenever a remote call fails) becomes the only path taken.
function createNoopSupabaseClient(): any {
  const resolved = { data: null, error: null };
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (value: typeof resolved) => void) => resolve(resolved);
        }
        return () => chain;
      },
    }
  );
  return { from: () => chain };
}

export const supabase = DB_ENABLED ? createClient(supabaseUrl, supabaseAnonKey) : createNoopSupabaseClient();

// In-memory initial fallback data for instant demo and local execution
export const INITIAL_LESSORS: Lessor[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'الشيخ محمد العتيبي',
    national_id_or_cr: '1010293847',
    phone: '0501234567',
    email: 'alotaibi@realestate.sa',
    created_at: '2024-01-01',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'مجموعة الرياض القابضة للعقارات',
    national_id_or_cr: '7001928374',
    phone: '0114567890',
    email: 'info@riyadhholding.sa',
    created_at: '2024-02-15',
  },
  {
    id: '33333333-0000-0000-0000-000000000000',
    name: 'شركة الأفق للاستثمار العقاري',
    national_id_or_cr: '7005544332',
    phone: '0551122334',
    email: 'contact@alofoq.sa',
    created_at: '2024-03-10',
  },
];

export const INITIAL_TENANTS: Tenant[] = [
  {
    id: 'tnt-001',
    name: 'فهد الزهراني',
    national_id: '1099887766',
    phone: '0512345678',
    email: 'fahad@zahrani.sa',
    type: 'Individual',
    created_at: '2024-01-10',
  },
  {
    id: 'tnt-002',
    name: 'شركة الحلول التقنية المتقدمة',
    national_id: '7009876543',
    phone: '0112233445',
    email: 'contact@techsolutions.sa',
    type: 'Company',
    created_at: '2024-01-15',
  },
  {
    id: 'tnt-003',
    name: 'د. خالد الدوسري',
    national_id: '1022334455',
    phone: '0554433221',
    email: 'aldosari@med.sa',
    type: 'Individual',
    created_at: '2024-02-01',
  },
];

export const INITIAL_REPRESENTATIVES: Representative[] = [
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'م. طارق الغامدي',
    national_id: '1088776655',
    phone: '0559876543',
    email: 'tariq@rep-office.sa',
    e_poa_number: 'POA-998822',
    status: 'ACTIVE',
    created_at: '2024-01-01',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'سلطان الحربي',
    national_id: '1077665544',
    phone: '0543210987',
    email: 'sultan@lawfirm.sa',
    e_poa_number: 'POA-774411',
    status: 'ACTIVE',
    created_at: '2024-02-01',
  },
  {
    id: '55555555-0000-0000-0000-000000000000',
    name: 'عبدالمجيد الدوسري',
    national_id: '1066554433',
    phone: '0567788990',
    email: 'aldosari@rep.sa',
    e_poa_number: 'POA-332211',
    status: 'ACTIVE',
    created_at: '2024-04-05',
  },
];

export const INITIAL_OWNERSHIP_DOCUMENTS: OwnershipDocument[] = [
  {
    id: '55555555-5555-5555-5555-555555555555',
    document_number: '98231-2024-DEED',
    issue_date: '2024-01-15',
    file_url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7',
    lessor_id: '11111111-1111-1111-1111-111111111111',
    created_at: '2024-01-15',
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    document_number: '44109-2023-DEED',
    issue_date: '2023-06-20',
    file_url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be',
    lessor_id: '22222222-2222-2222-2222-222222222222',
    created_at: '2023-06-20',
  },
];

export const INITIAL_PROPERTIES: Property[] = [
  {
    id: '77777777-7777-7777-7777-777777777777',
    title: 'برج الملقا التجاري',
    property_type: 'Commercial',
    address: 'طريق الملك فهد، حي الملقا',
    city: 'الرياض',
    units_count: 24,
    ownership_document_id: '55555555-5555-5555-5555-555555555555',
    lessor_id: '11111111-1111-1111-1111-111111111111',
    current_representative_id: '33333333-3333-3333-3333-333333333333',
    created_at: '2024-01-16',
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    title: 'مجمع العليا السكني',
    property_type: 'Residential',
    address: 'شارع العليا العام',
    city: 'الرياض',
    units_count: 16,
    ownership_document_id: '66666666-6666-6666-6666-666666666666',
    lessor_id: '22222222-2222-2222-2222-222222222222',
    current_representative_id: '44444444-4444-4444-4444-444444444444',
    created_at: '2023-06-22',
  },
];

export const INITIAL_E_POAS: EPoa[] = [
  {
    id: '99999999-9999-9999-9999-999999999999',
    poa_number: 'EPOA-2024-8891',
    grantor_id: '11111111-1111-1111-1111-111111111111',
    attorney_id: '33333333-3333-3333-3333-333333333333',
    issue_date: '2024-01-01',
    expiry_date: '2026-12-31',
    scope_details: 'تفويض كامل بإبرام وتوثيق عقود الإيجار التجارية عبر منصة إيجار وتمثيل المؤجر لدى الجهات.',
    status: 'Active',
    created_at: '2024-01-01',
  },
  {
    id: '99999999-1111-1111-1111-111111111111',
    poa_number: 'EPOA-2023-4412',
    grantor_id: '22222222-2222-2222-2222-222222222222',
    attorney_id: '44444444-4444-4444-4444-444444444444',
    issue_date: '2023-06-01',
    expiry_date: '2025-05-31',
    scope_details: 'إدارة وتأجير مجمع العليا السكني وتوقيع عقود الصيانة والإيجار السكني.',
    status: 'Active',
    created_at: '2023-06-01',
  },
];

export const INITIAL_CONTRACTS: Contract[] = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    contract_number: 'CNT-RES-2024-001',
    type: 'RESIDENTIAL',
    property_id: '88888888-8888-8888-8888-888888888888',
    lessor_id: '22222222-2222-2222-2222-222222222222',
    tenant_name: 'فهد الزهراني',
    tenant_national_id: '1099887766',
    rent_amount: 65000,
    total_collected_amount: 65000,
    office_profit: 3250,
    payment_schedule: 'Semi-Annual',
    start_date: '2024-03-01',
    end_date: '2025-02-28',
    status: 'Active',
    created_at: '2024-03-01',
  },
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    contract_number: 'CNT-COM-2024-089',
    type: 'COMMERCIAL',
    property_id: '77777777-7777-7777-7777-777777777777',
    lessor_id: '11111111-1111-1111-1111-111111111111',
    tenant_name: 'شركة الحلول التقنية المتقدمة',
    tenant_national_id: '7009876543',
    rent_amount: 240000,
    total_collected_amount: 240000,
    office_profit: 12000,
    payment_schedule: 'Quarterly',
    start_date: '2024-01-01',
    end_date: '2027-12-31',
    status: 'Active',
    business_activity: 'استشارات وتقنية المعلومات',
    vat_number: '310192837400003',
    created_at: '2024-01-01',
  },
];

export const INITIAL_BROKERAGE_AGREEMENTS: BrokerageAgreement[] = [
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    agreement_number: 'EJAR-BRK-2024-012',
    property_id: '77777777-7777-7777-7777-777777777777',
    lessor_id: '11111111-1111-1111-1111-111111111111',
    commission_rate: 2.5,
    office_profit: 6000,
    start_date: '2024-01-01',
    expiry_date: '2026-12-31',
    ejar_status: 'Active',
    file_url: '/docs/ejar_brk_012.pdf',
    created_at: '2024-01-01',
  },
];

export const INITIAL_AUDIT_LOGS: OwnershipAuditLog[] = [
  {
    id: 'aud-001',
    property_id: '77777777-7777-7777-7777-777777777777',
    new_lessor_id: '11111111-1111-1111-1111-111111111111',
    new_representative_id: '33333333-3333-3333-3333-333333333333',
    change_type: 'LESSOR_TRANSFER',
    notes: 'تسجيل الملكية الأولية لبرج الملقا التجاري باسم الشيخ محمد العتيبي وتعيين م. طارق مُمثلاً.',
    changed_at: '2024-01-16T10:30:00Z',
  },
];

const todayStr = new Date().toISOString().split('T')[0];

export const INITIAL_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'ft-001',
    transaction_date: todayStr,
    transaction_type: 'BROKERAGE_COMMISSION',
    flow_type: 'INCOME',
    gross_amount: 15000,
    tax_vat_amount: 2250,
    net_amount: 12750,
    property_id: '77777777-7777-7777-7777-777777777777',
    contract_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    brokerage_agreement_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    notes: 'عمولة وساطة تأجير مكتب تجاري برج الملقا',
    created_at: `${todayStr}T09:30:00Z`,
  },
  {
    id: 'ft-002',
    transaction_date: todayStr,
    transaction_type: 'RENTAL_PAYMENT',
    flow_type: 'INCOME',
    gross_amount: 32500,
    tax_vat_amount: 0,
    net_amount: 32500,
    property_id: '88888888-8888-8888-8888-888888888888',
    contract_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    notes: 'تحصيل الدفعة الإيجارية النصف سنوية - مجمع العليا السكني',
    created_at: `${todayStr}T11:15:00Z`,
  },
  {
    id: 'ft-003',
    transaction_date: todayStr,
    transaction_type: 'OPERATING_EXPENSE',
    flow_type: 'EXPENSE',
    gross_amount: 4500,
    tax_vat_amount: 675,
    net_amount: 5175,
    property_id: '77777777-7777-7777-7777-777777777777',
    notes: 'صيانة وتحديث المصاعد الدورية - برج الملقا التجاري',
    created_at: `${todayStr}T14:00:00Z`,
  },
  {
    id: 'ft-004',
    transaction_date: todayStr,
    transaction_type: 'DOCUMENT_FEE',
    flow_type: 'INCOME',
    gross_amount: 2500,
    tax_vat_amount: 375,
    net_amount: 2125,
    property_id: '88888888-8888-8888-8888-888888888888',
    contract_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    notes: 'رسوم توثيق وتجديد العقد عبر منصة إيجار',
    created_at: `${todayStr}T15:45:00Z`,
  },
  {
    id: 'ft-005',
    transaction_date: '2026-08-12',
    transaction_type: 'MANAGEMENT_FEE',
    flow_type: 'INCOME',
    gross_amount: 18000,
    tax_vat_amount: 2700,
    net_amount: 15300,
    property_id: '77777777-7777-7777-7777-777777777777',
    notes: 'رسوم إدارة وأمانة الأملاك العقارية لشهر أغسطس',
    created_at: '2026-08-12T10:00:00Z',
  },
];

export const INITIAL_DAILY_FINANCIAL_SUMMARIES: DailyFinancialSummary[] = [
  {
    id: 'dfs-001',
    summary_date: todayStr,
    total_gross_income: 50000,
    total_expenses: 5175,
    total_net_income: 44825,
    new_contracts_count: 2,
    active_brokerage_deals_count: 3,
    occupancy_rate: 87.5,
    created_at: `${todayStr}T18:00:00Z`,
  },
  {
    id: 'dfs-002',
    summary_date: '2026-08-12',
    total_gross_income: 42000,
    total_expenses: 3200,
    total_net_income: 38800,
    new_contracts_count: 1,
    active_brokerage_deals_count: 2,
    occupancy_rate: 85.0,
    created_at: '2026-08-12T18:00:00Z',
  },
  {
    id: 'dfs-003',
    summary_date: '2026-08-11',
    total_gross_income: 38500,
    total_expenses: 1500,
    total_net_income: 37000,
    new_contracts_count: 3,
    active_brokerage_deals_count: 4,
    occupancy_rate: 82.5,
    created_at: '2026-08-11T18:00:00Z',
  },
];

export const INITIAL_AI_DAILY_REPORTS: AiDailyReport[] = [
  {
    id: 'adr-001',
    report_date: todayStr,
    gross_income: 50000,
    net_income: 44825,
    what_went_well: [
      'إغلاق اتفاقيتي وساطة تجارية في برج الملقا وتحصيل عمولة فورية بنسبة 100%.',
      'تحصيل الدفعة الإيجارية النصف سنوية لمجمع العليا السكني بدون أي تأخيرات.',
      'توثيق جميع العقود المنفذة اليوم عبر منصة إيجار بانتظام.'
    ],
    what_went_bad: [
      'وجود 3 وحدات سكنية شاغرة في مجمع العليا متوقفة لأكثر من 15 يوماً دون تأجير.',
      'تأخر توثيق وكالة إلكترونية (E-POA) واحدة للمالك مما يعطل توقيع العقد التجاري الجديد.',
      'ارتفاع تكاليف الصيانة الطارئة للمصاعد في برج الملقا التجاري.'
    ],
    ai_recommendations: [
      'إطلاق تقديم خصم تشجيعي بنسبة 5% على عمولة التأجير السريع للوحدات السكنية الشاغرة بمجمع العليا لسرعة شغلها خلال 48 ساعة.',
      'متابعة كتابة العدل لإصدار الوكالة الإلكترونية المعلقة لإغلاق عقد البرج التجاري بقيمة 120,000 ريال غداً.',
      'إعادة تفاوض عقود الصيانة السنوية للمصاعد للحصول على خصم كميات وتقليل المصاريف التشغيلية.'
    ],
    income_increment_strategy: 'التركيز الفوري غداً على إنهاء إجراءات الوكالة الإلكترونية المعلقة وإبرام العقد التجاري الجديد لتحقيق زيادة إيرادات فورية بقيمة 120,000 ريال سعودي.',
    created_at: `${todayStr}T18:05:00Z`,
  },
];

export const INITIAL_GENERAL_SERVICES: GeneralService[] = [
  {
    id: 'srv-001',
    service_number: 'GS-2026-101',
    client_name: 'أحمد بن عبد الله المطيري',
    client_phone: '0501234567',
    client_national_id: '1088776655',
    category: 'EJAR',
    title: 'توثيق عقد إيجار موحد عبر منصة إيجار',
    cost_amount: 125,
    fee_amount: 350,
    office_profit: 225,
    status: 'Completed',
    notes: 'تم توثيق العقد بنجاح وتسليم النسخة الإلكترونية للعميل',
    created_at: `${todayStr}T10:15:00Z`,
  },
  {
    id: 'srv-002',
    service_number: 'GS-2026-102',
    client_name: 'مؤسسة البناء الحديث للتجارة',
    client_phone: '0559876543',
    client_national_id: '7012345678',
    category: 'BALADY',
    title: 'إصدار رخصة بلدي ومعاينة محل تجاري',
    cost_amount: 500,
    fee_amount: 1200,
    office_profit: 700,
    status: 'In_Progress',
    notes: 'في انتظار موافقة البلدية النهائية',
    created_at: `${todayStr}T11:40:00Z`,
  },
  {
    id: 'srv-003',
    service_number: 'GS-2026-103',
    client_name: 'سليمان بن خالد الدوسري',
    client_phone: '0543210987',
    client_national_id: '1022334455',
    category: 'DEED_SURVEY',
    title: 'رفع مساحي وتحديث صك عقاري ألكترونياً',
    cost_amount: 300,
    fee_amount: 850,
    office_profit: 550,
    status: 'Completed',
    notes: 'تمت إحالة الصك لمنصة إحكام وبورصة العقارات',
    created_at: `${todayStr}T14:20:00Z`,
  },
];

export const INITIAL_CUSTOMER_ORDERS: CustomerOrder[] = [
  {
    id: 'ord-001',
    order_number: 'ORD-2026-001',
    client_name: 'أحمد بن عبد العزيز السلمان',
    client_phone: '0501122334',
    category: 'RESIDENTIAL',
    building_type: 'فيلا مودرن مستقلة',
    desired_area: 'حي الملقا أو الياسمين - مساحة 350-450 م²',
    budget_min: 2500000,
    budget_max: 3200000,
    status: 'Searching',
    notes: 'يفضل وجود مسبح ومصعد وتكييف مخفي، قريبة من طرق رئيسية.',
    created_at: `${todayStr}T09:00:00Z`,
  },
  {
    id: 'ord-002',
    order_number: 'ORD-2026-002',
    client_name: 'شركة الاستشارات الرقمية',
    client_phone: '0559988776',
    category: 'COMMERCIAL',
    building_type: 'مكتب تجاري فاخر',
    desired_area: 'طريق الملك فهد / حي العليا - مساحة 200-300 م²',
    budget_min: 150000,
    budget_max: 220000,
    status: 'New',
    notes: 'مكتب مفتوح للإيجار السنوي، يفضل أن يكون في برج مجهز بالمواقف والحراسة.',
    created_at: `${todayStr}T11:30:00Z`,
  },
  {
    id: 'ord-003',
    order_number: 'ORD-2026-003',
    client_name: 'د. سارة الشهري',
    client_phone: '0544332211',
    category: 'RESIDENTIAL',
    building_type: 'شقة فاخرة (4 غرف)',
    desired_area: 'حي النرجس أو حطين - مساحة 180 م²',
    budget_min: 70000,
    budget_max: 90000,
    status: 'Fulfilled',
    notes: 'عقد إيجار سنوي عائلي، تم توفير الشقة في مجمع حطين.',
    created_at: '2026-08-14T15:00:00Z',
  },
];

export const INITIAL_MANAGED_PROPERTIES: ManagedPropertyContract[] = [
  {
    id: 'pmc-001',
    contract_number: 'PMC-2026-001',
    property_name: 'عمارة النخيل السكنية',
    lessor_name: 'عبد العزيز بن محمد الراجحي',
    lessor_phone: '0501122334',
    property_type: 'Residential',
    total_units: 12,
    occupied_units: 10,
    vacant_units: 2,
    fee_type: 'PERCENTAGE',
    fee_value: 5.0,
    annual_expected_revenue: 480000,
    collected_revenue: 360000,
    transferred_to_owner: 342000,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    status: 'Active',
    notes: 'عمارة سكنية 4 أدوار بـ 12 شقة فاخرة، عقد تشغيل وإدارة أملاك كامل شامل التحصيل.',
    created_at: '2026-01-01T09:00:00Z',
  },
  {
    id: 'pmc-002',
    contract_number: 'PMC-2026-002',
    property_name: 'مجمع الأمل التجاري',
    lessor_name: 'شركة الأفق العقارية الاستثمارية',
    lessor_phone: '0559988776',
    property_type: 'Commercial',
    total_units: 8,
    occupied_units: 7,
    vacant_units: 1,
    fee_type: 'PERCENTAGE',
    fee_value: 7.5,
    annual_expected_revenue: 720000,
    collected_revenue: 540000,
    transferred_to_owner: 499500,
    start_date: '2025-06-01',
    end_date: '2027-05-31',
    status: 'Active',
    notes: 'مجمع معارض ومكاتب تجارية على شارع رئيسي.',
    created_at: '2025-06-01T10:00:00Z',
  },
  {
    id: 'pmc-003',
    contract_number: 'PMC-2026-003',
    property_name: 'برج الفلاح الإداري',
    lessor_name: 'سليمان بن عبد الله القحطاني',
    lessor_phone: '0544332211',
    property_type: 'Mixed',
    total_units: 20,
    occupied_units: 18,
    vacant_units: 2,
    fee_type: 'FIXED_ANNUAL',
    fee_value: 25000,
    annual_expected_revenue: 1200000,
    collected_revenue: 900000,
    transferred_to_owner: 875000,
    start_date: '2026-01-15',
    end_date: '2027-01-14',
    status: 'Active',
    notes: 'إدارة أملاك برج إداري وسكني شامل الحراسة والنظافة وصيانة المصاعد.',
    created_at: '2026-01-15T08:30:00Z',
  },
];

export const INITIAL_MAINTENANCE_TASKS: PropertyMaintenanceTask[] = [
  {
    id: 'mnt-001',
    task_number: 'MNT-2026-101',
    managed_property_id: 'pmc-001',
    property_name: 'عمارة النخيل السكنية',
    unit_name: 'شقة 203',
    maintenance_type: 'سباكة وتغيير محابس',
    cost_amount: 450,
    contractor_name: 'مؤسسة الشعلة للصيانة',
    contractor_phone: '0509876543',
    status: 'Completed',
    notes: 'تم إصلاح تسريب المياه في الحمام الرئيسي وتشغيل المضخة.',
    created_at: `${todayStr}T10:00:00Z`,
  },
  {
    id: 'mnt-002',
    task_number: 'MNT-2026-102',
    managed_property_id: 'pmc-002',
    property_name: 'مجمع الأمل التجاري',
    unit_name: 'معرض 02',
    maintenance_type: 'صيانة وتكييف مركزي',
    cost_amount: 1800,
    contractor_name: 'شركة التكييف العربي',
    contractor_phone: '0551234567',
    status: 'In_Progress',
    notes: 'تغيير الفلاتر وتعبئة الفريون للوحدات المروحية.',
    created_at: `${todayStr}T11:15:00Z`,
  },
  {
    id: 'mnt-003',
    task_number: 'MNT-2026-103',
    managed_property_id: 'pmc-003',
    property_name: 'برج الفلاح الإداري',
    unit_name: 'مصعد رقم 1',
    maintenance_type: 'صيانة دورية للمصاعد',
    cost_amount: 1200,
    contractor_name: 'شركة أوتيس للمصاعد',
    contractor_phone: '0547766554',
    status: 'Completed',
    notes: 'الفحص الفني الدوري واختبار كوابل الأمان.',
    created_at: `${todayStr}T14:30:00Z`,
  },
];
