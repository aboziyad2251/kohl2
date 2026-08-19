-- ==============================================================================
-- Real Estate ERP & Office Management Platform - Database Schema
-- Unified PostgreSQL Schema for Supabase (Self-Hosted / Cloud)
-- ==============================================================================

-- Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. LESSORS (المؤجرون والملاك)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS lessors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    national_id_or_cr VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. TENANTS (المستأجرون)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    type VARCHAR(50) DEFAULT 'Individual' CHECK (type IN ('Individual', 'Corporate', 'Government')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. REPRESENTATIVES & ATTORNEYS (الممثلون والوكلاء)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS representatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    e_poa_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. OWNERSHIP DOCUMENTS & DEEDS (صكوك الملكية)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ownership_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(100) NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    deed_type VARCHAR(100) DEFAULT 'صك إلكتروني',
    file_url TEXT,
    lessor_id UUID REFERENCES lessors(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. PROPERTIES (العقارات والوحدات)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_name VARCHAR(255) NOT NULL,
    deed_number VARCHAR(100),
    property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('Residential', 'Commercial', 'Land', 'Industrial', 'سكني', 'تجاري', 'أرض', 'صناعي')),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL DEFAULT 'الرياض',
    district VARCHAR(100),
    units_count INT DEFAULT 1 CHECK (units_count >= 1),
    ownership_document_id UUID REFERENCES ownership_documents(id) ON DELETE SET NULL,
    lessor_id UUID REFERENCES lessors(id) ON DELETE SET NULL,
    current_representative_id UUID REFERENCES representatives(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Rented', 'Under_Maintenance', 'Inactive', 'نشط', 'مؤجر', 'تحت الصيانة')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. ELECTRONIC POWERS OF ATTORNEY (الوكالات الإلكترونية E-POAs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS e_poas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poa_number VARCHAR(100) NOT NULL UNIQUE,
    grantor_id UUID REFERENCES lessors(id) ON DELETE CASCADE,
    grantor_name VARCHAR(255),
    attorney_id UUID REFERENCES representatives(id) ON DELETE CASCADE,
    attorney_name VARCHAR(255),
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    scope_details TEXT,
    file_url TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Revoked', 'سارية', 'منتهية', 'ملغاة')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. CONTRACTS & LEASES (العقود والإيجارات)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('RESIDENTIAL', 'COMMERCIAL', 'SUBLEASE', 'سكني', 'تجاري', 'استثمار')),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    property_name VARCHAR(255),
    lessor_id UUID REFERENCES lessors(id) ON DELETE SET NULL,
    lessor_name VARCHAR(255),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    tenant_name VARCHAR(255) NOT NULL,
    tenant_national_id VARCHAR(50),
    tenant_phone VARCHAR(50),
    rent_amount NUMERIC(14, 2) NOT NULL CHECK (rent_amount >= 0),
    office_commission NUMERIC(14, 2) DEFAULT 0 CHECK (office_commission >= 0),
    security_deposit NUMERIC(14, 2) DEFAULT 0,
    payment_schedule VARCHAR(50) NOT NULL CHECK (payment_schedule IN ('Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'شهري', 'ربع سنوي', 'نصف سنوي', 'سنوي')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'terminated', 'expired', 'مسودة', 'ساري', 'منتهي', 'ملغي')),
    business_activity VARCHAR(255),
    vat_number VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. BROKERAGE AGREEMENTS (اتفاقيات الوساطة العقارية)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS brokerage_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_number VARCHAR(100) NOT NULL UNIQUE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    property_name VARCHAR(255),
    lessor_id UUID REFERENCES lessors(id) ON DELETE SET NULL,
    lessor_name VARCHAR(255),
    client_name VARCHAR(255),
    client_phone VARCHAR(50),
    deal_type VARCHAR(50) DEFAULT 'إيجار' CHECK (deal_type IN ('إيجار', 'بيع', 'إدارة أملاك', 'Rental', 'Sale')),
    deal_amount NUMERIC(14, 2) DEFAULT 0,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 2.50 CHECK (commission_rate >= 0 AND commission_rate <= 100),
    office_profit NUMERIC(14, 2) DEFAULT 0,
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    ejar_status VARCHAR(30) DEFAULT 'Pending' CHECK (ejar_status IN ('Pending', 'Active', 'Cancelled', 'معتمد في إيجار', 'بانتظار الاعتماد', 'ملغي')),
    file_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. MANAGED PROPERTIES & OPERATIONS (إدارة الأملاك والتشغيل)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS managed_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    property_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    owner_phone VARCHAR(50),
    units_total INT NOT NULL DEFAULT 1,
    units_occupied INT NOT NULL DEFAULT 0,
    annual_management_fee NUMERIC(14, 2) NOT NULL DEFAULT 0,
    management_fee_percentage NUMERIC(5, 2) DEFAULT 5.0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring_Soon', 'Expired', 'Terminated', 'ساري', 'ينتهي قريباً', 'منتهي')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. PROPERTY MAINTENANCE TASKS (أوامر الصيانة والتشغيل)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS property_maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_number VARCHAR(100) UNIQUE NOT NULL,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    property_name VARCHAR(255) NOT NULL,
    unit_number VARCHAR(50),
    contractor_name VARCHAR(255),
    task_type VARCHAR(100) NOT NULL CHECK (task_type IN ('Plumbing', 'Electricity', 'HVAC', 'Paints', 'General', 'سباكة', 'كهرباء', 'تكييف', 'دهانات', 'نظافة', 'أخرى')),
    cost_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Pending' CHECK (status IN ('Pending', 'In_Progress', 'Completed', 'Cancelled', 'قيد الانتظار', 'جاري التنفيذ', 'مكتملة', 'ملغاة')),
    due_date DATE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 11. FINANCIAL TRANSACTIONS (الحركات والمعاملات المالية)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type VARCHAR(30) NOT NULL CHECK (transaction_type IN ('income', 'expense', 'INCOME', 'EXPENSE')),
    category VARCHAR(100) NOT NULL,
    reference_module VARCHAR(50),
    reference_id UUID,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
    net_profit NUMERIC(14, 2) DEFAULT 0,
    tax_vat NUMERIC(14, 2) DEFAULT 0,
    payment_method VARCHAR(50) DEFAULT 'Bank Transfer' CHECK (payment_method IN ('Cash', 'Bank Transfer', 'Mada', 'Cheque', 'تحويل بنكي', 'نقدي', 'مدى', 'شيك')),
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 12. GENERAL SERVICES (الخدمات العامة والمعاملات الحكومية)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS general_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_number VARCHAR(50) UNIQUE NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50),
    client_national_id VARCHAR(50),
    category VARCHAR(50) NOT NULL CHECK (category IN ('EJAR', 'BALADY', 'QIWA', 'DEED_SURVEY', 'GOV_TRANSACTION', 'OTHER', 'توثيق إيجار', 'بلدي', 'قوى', 'فرز صكوك', 'أخرى')),
    cost_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    selling_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
    profit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In_Progress', 'Completed', 'Cancelled', 'قيد التنفيذ', 'مكتمل', 'بانتظار العميل', 'ملغي')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 13. CUSTOMER ORDERS (طلبات العملاء العقارية - عروض وطلبات)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50) NOT NULL,
    order_type VARCHAR(50) NOT NULL DEFAULT 'شراء' CHECK (order_type IN ('شراء', 'إيجار', 'استثمار', 'Buy', 'Rent', 'Invest')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('RESIDENTIAL', 'COMMERCIAL', 'سكني', 'تجاري', 'أرض')),
    building_type VARCHAR(100) NOT NULL,
    desired_area TEXT NOT NULL,
    budget_min NUMERIC(14, 2) DEFAULT 0,
    budget_max NUMERIC(14, 2) DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'completed', 'cancelled', 'جديد', 'قيد البحث', 'منجز', 'ملغي')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 14. OWNERSHIP AUDIT LOGS (سجل تتبع التغييرات والملكية)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS ownership_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 15. DAILY FINANCIAL SUMMARIES & AI REPORTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS daily_financial_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    total_gross_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_net_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
    new_contracts_count INT DEFAULT 0,
    active_brokerage_deals_count INT DEFAULT 0,
    occupancy_rate NUMERIC(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    gross_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
    net_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
    what_went_well TEXT[] DEFAULT '{}',
    what_went_bad TEXT[] DEFAULT '{}',
    ai_recommendations TEXT[] DEFAULT '{}',
    income_increment_strategy TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PERFORMANCE INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_properties_lessor ON properties(lessor_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_contracts_property ON contracts(property_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_financials_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_financials_type ON financial_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_category ON customer_orders(category);
CREATE INDEX IF NOT EXISTS idx_general_services_status ON general_services(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON property_maintenance_tasks(status);

-- ==============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS) & OPEN PERMISSIONS FOR APP ACCESS
-- ==============================================================================
ALTER TABLE lessors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE representatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE e_poas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE managed_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_maintenance_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE ownership_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_financial_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_daily_reports ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated roles full access
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public access for all operations" ON %I', tbl);
        EXECUTE format('CREATE POLICY "Public access for all operations" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
    END LOOP;
END $$;

-- ==============================================================================
-- ENABLE SUPABASE REALTIME REPLICATION
-- ==============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
        properties,
        contracts,
        customer_orders,
        financial_transactions,
        general_services,
        brokerage_agreements,
        managed_properties,
        property_maintenance_tasks,
        e_poas,
        ownership_documents,
        lessors,
        tenants,
        representatives;
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- ==============================================================================
-- SEED INITIAL MOCK DATA
-- ==============================================================================

-- Lessors
INSERT INTO lessors (id, name, national_id_or_cr, phone, email) VALUES
('11111111-1111-1111-1111-111111111111', 'الشيخ محمد بن عبد الله العتيبي', '1010293847', '+966501234567', 'alotaibi@realestate.sa'),
('22222222-2222-2222-2222-222222222222', 'مجموعة الرياض القابضة للعقارات', '7001928374', '+966114567890', 'info@riyadhholding.sa')
ON CONFLICT (national_id_or_cr) DO NOTHING;

-- Representatives
INSERT INTO representatives (id, name, national_id, phone, email, e_poa_number, status) VALUES
('33333333-3333-3333-3333-333333333333', 'م. طارق الغامدي', '1088776655', '+966559876543', 'tariq@rep-office.sa', 'POA-998822', 'ACTIVE'),
('44444444-4444-4444-4444-444444444444', 'سلطان الحربي', '1077665544', '+966543210987', 'sultan@lawfirm.sa', 'POA-774411', 'ACTIVE')
ON CONFLICT (national_id) DO NOTHING;

-- Ownership Documents
INSERT INTO ownership_documents (id, document_number, issue_date, file_url, lessor_id) VALUES
('55555555-5555-5555-5555-555555555555', 'DEED-98231-2024', '2024-01-15', '/docs/deed_98231.pdf', '11111111-1111-1111-1111-111111111111'),
('66666666-6666-6666-6666-666666666666', 'DEED-44109-2023', '2023-06-20', '/docs/deed_44109.pdf', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (document_number) DO NOTHING;

-- Properties
INSERT INTO properties (id, property_name, deed_number, property_type, address, city, units_count, ownership_document_id, lessor_id, current_representative_id) VALUES
('77777777-7777-7777-7777-777777777777', 'برج الملقا التجاري', 'DEED-98231-2024', 'Commercial', 'طريق الملك فهد، حي الملقا', 'الرياض', 24, '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
('88888888-8888-8888-8888-888888888888', 'مجمع العليا السكني', 'DEED-44109-2023', 'Residential', 'شارع العليا العام', 'الرياض', 16, '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444')
ON CONFLICT DO NOTHING;

-- Contracts
INSERT INTO contracts (id, contract_number, type, property_id, property_name, lessor_name, tenant_name, tenant_national_id, rent_amount, office_commission, payment_schedule, start_date, end_date, status, business_activity, vat_number) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CNT-RES-2024-001', 'RESIDENTIAL', '88888888-8888-8888-8888-888888888888', 'مجمع العليا السكني', 'مجموعة الرياض القابضة للعقارات', 'فهد الزهراني', '1099887766', 65000.00, 1625.00, 'Semi-Annual', '2024-03-01', '2025-02-28', 'active', NULL, NULL),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CNT-COM-2024-089', 'COMMERCIAL', '77777777-7777-7777-7777-777777777777', 'برج الملقا التجاري', 'الشيخ محمد بن عبد الله العتيبي', 'شركة الحلول التقنية المتقدمة', '7009876543', 240000.00, 6000.00, 'Quarterly', '2024-01-01', '2027-12-31', 'active', 'استشارات نظم المعلومات', '310192837400003')
ON CONFLICT (contract_number) DO NOTHING;

-- Customer Orders (16 seed orders)
INSERT INTO customer_orders (id, order_number, customer_name, customer_phone, order_type, category, building_type, desired_area, budget_min, budget_max, status, notes) VALUES
('10101010-1010-1010-1010-101010107680', 'ORD-2026-768', 'راشد حارس', '0581697484', 'شراء', 'RESIDENTIAL', 'شقة فاخرة', 'السلامة', 20000.00, 30000.00, 'new', 'طلب شقة عائلية بحي السلامة'),
('10101010-1010-1010-1010-101010105700', 'ORD-2026-570', 'حارس باكستاني 2', '0597210697', 'شراء', 'RESIDENTIAL', 'فيلا', 'السلامة', 40000.00, 45000.00, 'new', 'فيلا صغيرة دورين'),
('10101010-1010-1010-1010-101010105160', 'ORD-2026-516', 'صاحبها سعودي', '0595690347', 'شراء', 'RESIDENTIAL', 'فيلا مودرن', 'السلامة', 60000.00, 60000.00, 'new', 'طلب خاص فيلا مودرن بالسلامة'),
('10101010-1010-1010-1010-101010102850', 'ORD-2026-285', 'حارس باكستاني', '0536105122', 'إيجار', 'RESIDENTIAL', 'شقة فاخرة', 'النادي', 22200.00, 22200.00, 'new', 'شقة عائلية قريبة من الخدمات'),
('10101010-1010-1010-1010-101010100790', 'ORD-2026-079', 'سعودي', '0505676735', 'إيجار', 'COMMERCIAL', 'مكتب تجاري', 'النادي', 35000.00, 35000.00, 'new', 'مكتب مساحة 120م'),
('10101010-1010-1010-1010-101010103760', 'ORD-2026-376', 'حارس مصري', '0507204930', 'إيجار', 'RESIDENTIAL', 'دور أرضي', 'النادي', 30000.00, 30000.00, 'new', 'دور أرضي مدخل خاص')
ON CONFLICT (order_number) DO NOTHING;

-- Financial Transactions
INSERT INTO financial_transactions (id, transaction_date, transaction_type, category, amount, net_profit, payment_method, description) VALUES
('ft-00100000-0000-0000-0000-000000000001', CURRENT_DATE, 'income', 'عمولة وساطة عقارية', 15000.00, 15000.00, 'تحويل بنكي', 'عمولة وساطة تأجير مكتب تجاري برج الملقا'),
('ft-00200000-0000-0000-0000-000000000002', CURRENT_DATE, 'income', 'أتعاب إدارة أملاك', 8500.00, 8500.00, 'تحويل بنكي', 'تحصيل أتعاب إدارة مجمع العليا السكني'),
('ft-00300000-0000-0000-0000-000000000003', CURRENT_DATE, 'expense', 'مصروفات تشغيلية وتسويق', 3200.00, -3200.00, 'مدى', 'حملة تسويق وإعلانات للمنصات العقارية')
ON CONFLICT DO NOTHING;

-- General Services
INSERT INTO general_services (id, service_number, service_name, client_name, client_phone, category, cost_price, selling_price, profit_amount, status, notes) VALUES
('gs-00100000-0000-0000-0000-000000000001', 'SRV-2026-001', 'توثيق عقد إيجار سكني موحد', 'سلطان القحطاني', '0501122334', 'EJAR', 125.00, 250.00, 125.00, 'Completed', 'تم توثيق العقد بنجاح عبر منصة إيجار'),
('gs-00200000-0000-0000-0000-000000000002', 'SRV-2026-002', 'إصدار رخصة تجارية فورية', 'مؤسسة الأفق للتجارة', '0559988776', 'BALADY', 500.00, 950.00, 450.00, 'In_Progress', 'بانتظار موافقة الدفاع المدني')
ON CONFLICT (service_number) DO NOTHING;
