-- Supabase / PostgreSQL Complete Schema Migration for Real Estate Office Management System
-- Database: office_db

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. LESSORS TABLE (المؤجرون)
CREATE TABLE IF NOT EXISTS lessors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    national_id_or_cr VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TENANTS TABLE (المستأجرون)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    type VARCHAR(50) DEFAULT 'Individual',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. REPRESENTATIVES TABLE (الممثلون والوكلاء)
CREATE TABLE IF NOT EXISTS representatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    national_id VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    e_poa_number VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OWNERSHIP DOCUMENTS TABLE (صكوك الملكية)
CREATE TABLE IF NOT EXISTS ownership_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_number VARCHAR(100) NOT NULL UNIQUE,
    issue_date DATE NOT NULL,
    file_url TEXT,
    lessor_id UUID NOT NULL REFERENCES lessors(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PROPERTIES TABLE (العقارات والوحدات)
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('Residential', 'Commercial', 'Land')),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    units_count INT DEFAULT 1 CHECK (units_count >= 1),
    ownership_document_id UUID REFERENCES ownership_documents(id) ON DELETE SET NULL,
    lessor_id UUID NOT NULL REFERENCES lessors(id) ON DELETE CASCADE,
    current_representative_id UUID REFERENCES representatives(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. E_POAS TABLE (الوكالات الإلكترونية)
CREATE TABLE IF NOT EXISTS e_poas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poa_number VARCHAR(100) NOT NULL UNIQUE,
    grantor_id UUID NOT NULL REFERENCES lessors(id) ON DELETE CASCADE,
    attorney_id UUID NOT NULL REFERENCES representatives(id) ON DELETE CASCADE,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    scope_details TEXT,
    file_url TEXT,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CONTRACTS TABLE (عقود الإيجار)
CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('RESIDENTIAL', 'COMMERCIAL', 'SUBLEASE')),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    lessor_id UUID NOT NULL REFERENCES lessors(id) ON DELETE CASCADE,
    tenant_name VARCHAR(255) NOT NULL,
    tenant_national_id VARCHAR(50) NOT NULL,
    rent_amount NUMERIC(12, 2) NOT NULL CHECK (rent_amount >= 0),
    total_collected_amount NUMERIC(12, 2) DEFAULT 0,
    office_profit NUMERIC(12, 2) DEFAULT 0,
    security_deposit_amount NUMERIC(12, 2) DEFAULT 0,
    lessor_requirements TEXT,
    payment_schedule VARCHAR(50) NOT NULL CHECK (payment_schedule IN ('Monthly', 'Quarterly', 'Semi-Annual', 'Annual')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'Draft' CHECK (status IN ('Draft', 'Active', 'Terminated', 'Expired')),
    business_activity VARCHAR(255),
    vat_number VARCHAR(50),
    primary_lessor_consent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. BROKERAGE AGREEMENTS TABLE (اتفاقيات الوساطة)
CREATE TABLE IF NOT EXISTS brokerage_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_number VARCHAR(100) NOT NULL UNIQUE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    lessor_id UUID NOT NULL REFERENCES lessors(id) ON DELETE CASCADE,
    commission_rate NUMERIC(5, 2) NOT NULL CHECK (commission_rate >= 0 AND commission_rate <= 100),
    office_profit NUMERIC(12, 2) DEFAULT 0,
    start_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    ejar_status VARCHAR(20) DEFAULT 'Pending' CHECK (ejar_status IN ('Pending', 'Active', 'Cancelled')),
    file_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. OWNERSHIP AUDIT LOGS TABLE (سجل تتبع الملكية)
CREATE TABLE IF NOT EXISTS ownership_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    previous_lessor_id UUID REFERENCES lessors(id) ON DELETE SET NULL,
    new_lessor_id UUID REFERENCES lessors(id) ON DELETE SET NULL,
    previous_representative_id UUID REFERENCES representatives(id) ON DELETE SET NULL,
    new_representative_id UUID REFERENCES representatives(id) ON DELETE SET NULL,
    change_type VARCHAR(50) NOT NULL CHECK (change_type IN ('LESSOR_TRANSFER', 'REPRESENTATIVE_CHANGE')),
    notes TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. GENERAL SERVICES TABLE (الخدمات العامة والمعاملات)
CREATE TABLE IF NOT EXISTS general_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_number VARCHAR(50) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50),
    client_national_id VARCHAR(50),
    category VARCHAR(50) NOT NULL CHECK (category IN ('EJAR', 'BALADY', 'QIWA', 'DEED_SURVEY', 'GOV_TRANSACTION', 'OTHER')),
    title TEXT NOT NULL,
    cost_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    office_profit NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In_Progress', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. FINANCIAL TRANSACTIONS TABLE (المعاملات المالية)
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type VARCHAR(50) NOT NULL,
    flow_type VARCHAR(20) NOT NULL CHECK (flow_type IN ('INCOME', 'EXPENSE')),
    gross_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tax_vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    brokerage_agreement_id UUID REFERENCES brokerage_agreements(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. DAILY FINANCIAL SUMMARIES TABLE (الملخصات المالية اليومية)
CREATE TABLE IF NOT EXISTS daily_financial_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date DATE NOT NULL UNIQUE,
    total_gross_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_net_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
    new_contracts_count INT DEFAULT 0,
    active_brokerage_deals_count INT DEFAULT 0,
    occupancy_rate NUMERIC(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. AI DAILY REPORTS TABLE (تقارير المستشار الذكي اليومية)
CREATE TABLE IF NOT EXISTS ai_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL UNIQUE,
    gross_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
    net_income NUMERIC(14, 2) NOT NULL DEFAULT 0,
    what_went_well TEXT[],
    what_went_bad TEXT[],
    ai_recommendations TEXT[],
    income_increment_strategy TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. CUSTOMER ORDERS TABLE (طلبات العملاء العقارية)
CREATE TABLE IF NOT EXISTS customer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('RESIDENTIAL', 'COMMERCIAL')),
    building_type VARCHAR(100) NOT NULL,
    desired_area TEXT NOT NULL,
    budget_min NUMERIC(14, 2),
    budget_max NUMERIC(14, 2),
    status VARCHAR(50) NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Searching', 'Fulfilled', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_properties_lessor ON properties(lessor_id);
CREATE INDEX IF NOT EXISTS idx_properties_rep ON properties(current_representative_id);
CREATE INDEX IF NOT EXISTS idx_contracts_property ON contracts(property_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_e_poas_status ON e_poas(status);
CREATE INDEX IF NOT EXISTS idx_brokerage_ejar ON brokerage_agreements(ejar_status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_category ON customer_orders(category);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_general_services_category ON general_services(category);

-- SEED INITIAL LESSORS
INSERT INTO lessors (id, name, national_id_or_cr, phone, email) VALUES
('11111111-1111-1111-1111-111111111111', 'الشيخ محمد بن عبد الله العتيبي', '1010293847', '+966501234567', 'alotaibi@realestate.sa'),
('22222222-2222-2222-2222-222222222222', 'مجموعة الرياض القابضة للعقارات', '7001928374', '+966114567890', 'info@riyadhholding.sa')
ON CONFLICT (national_id_or_cr) DO NOTHING;

-- SEED INITIAL REPRESENTATIVES
INSERT INTO representatives (id, name, national_id, phone, email, e_poa_number, status) VALUES
('33333333-3333-3333-3333-333333333333', 'م. طارق الغامدي', '1088776655', '+966559876543', 'tariq@rep-office.sa', 'POA-998822', 'ACTIVE'),
('44444444-4444-4444-4444-444444444444', 'سلطان الحربي', '1077665544', '+966543210987', 'sultan@lawfirm.sa', 'POA-774411', 'ACTIVE')
ON CONFLICT (national_id) DO NOTHING;

-- SEED INITIAL OWNERSHIP DOCUMENTS
INSERT INTO ownership_documents (id, document_number, issue_date, file_url, lessor_id) VALUES
('55555555-5555-5555-5555-555555555555', 'DEED-98231-2024', '2024-01-15', '/docs/deed_98231.pdf', '11111111-1111-1111-1111-111111111111'),
('66666666-6666-6666-6666-666666666666', 'DEED-44109-2023', '2023-06-20', '/docs/deed_44109.pdf', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (document_number) DO NOTHING;

-- SEED INITIAL PROPERTIES
INSERT INTO properties (id, title, property_type, address, city, units_count, ownership_document_id, lessor_id, current_representative_id) VALUES
('77777777-7777-7777-7777-777777777777', 'برج الملقا التجاري', 'Commercial', 'طريق الملك فهد، حي الملقا', 'الرياض', 24, '55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333'),
('88888888-8888-8888-8888-888888888888', 'مجمع العليا السكني', 'Residential', 'شارع العليا العام', 'الرياض', 16, '66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444')
ON CONFLICT DO NOTHING;

-- SEED INITIAL CONTRACTS
INSERT INTO contracts (id, contract_number, type, property_id, lessor_id, tenant_name, tenant_national_id, rent_amount, payment_schedule, start_date, end_date, status, business_activity, vat_number) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CNT-RES-2024-001', 'RESIDENTIAL', '88888888-8888-8888-8888-888888888888', '22222222-2222-2222-2222-222222222222', 'فهد الزهراني', '1099887766', 65000.00, 'Semi-Annual', '2024-03-01', '2025-02-28', 'Active', NULL, NULL),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CNT-COM-2024-089', 'COMMERCIAL', '77777777-7777-7777-7777-777777777777', '11111111-1111-1111-1111-111111111111', 'شركة الحلول التقنية المتقدمة', '7009876543', 240000.00, 'Quarterly', '2024-01-01', '2027-12-31', 'Active', 'استشارات نظم المعلومات', '310192837400003')
ON CONFLICT (contract_number) DO NOTHING;

-- SEED ALL 16 CUSTOMER ORDERS MATCHING USER SCREENSHOT AND REPOSITORY DEMO DATA
INSERT INTO customer_orders (id, order_number, client_name, client_phone, category, building_type, desired_area, budget_min, budget_max, status, notes) VALUES
('10101010-1010-1010-1010-101010107680', 'ORD-2026-768', 'راشد حارس', '0581697484', 'RESIDENTIAL', 'شقة فاخرة', 'السلامة', 20000.00, 30000.00, 'New', 'طلب شقة عائلية بحي السلامة'),
('10101010-1010-1010-1010-101010105700', 'ORD-2026-570', 'حارس باكستاني 2', '0597210697', 'RESIDENTIAL', 'فيلا', 'السلامة', 40000.00, 45000.00, 'New', 'فيلا صغيرة دورين'),
('10101010-1010-1010-1010-101010105160', 'ORD-2026-516', 'صاحبها سعودي', '0595690347', 'RESIDENTIAL', 'فيلا مودرن', 'السلامة', 60000.00, 60000.00, 'New', 'طلب خاص فيلا مودرن بالسلامة'),
('10101010-1010-1010-1010-101010102850', 'ORD-2026-285', 'حارس باكستاني', '0536105122', 'RESIDENTIAL', 'شقة فاخرة', 'النادي', 22200.00, 22200.00, 'New', 'شقة عائلية قريبة من الخدمات'),
('10101010-1010-1010-1010-101010106600', 'ORD-2026-660', 'باكستاني حارس', '0582315634', 'RESIDENTIAL', 'شقة فاخرة', 'النادي', 30000.00, 30000.00, 'New', 'شقة مدخلين'),
('10101010-1010-1010-1010-101010101010', 'ORD-2026-001', 'أحمد بن عبد العزيز السلمان', '0501122334', 'RESIDENTIAL', 'فيلا مودرن مستقلة', 'حي الملقا أو الياسمين - مساحة 350-450 م²', 2500000.00, 3200000.00, 'Searching', 'يفضل وجود مسبح ومصعد وتكييف مخفي، قريبة من طرق رئيسية.'),
('20202020-2020-2020-2020-202020202020', 'ORD-2026-002', 'شركة الاستشارات الرقمية', '0559988776', 'COMMERCIAL', 'مكتب تجاري فاخر', 'طريق الملك فهد / حي العليا - مساحة 200-300 م²', 150000.00, 220000.00, 'New', 'مكتب مفتوح للإيجار السنوي، يفضل أن يكون في برج مجهز بالمواقف والحراسة.'),
('30303030-3030-3030-3030-303030303030', 'ORD-2026-003', 'د. سارة الشهري', '0544332211', 'RESIDENTIAL', 'شقة فاخرة (4 غرف)', 'حي النرجس أو حطين - مساحة 180 م²', 70000.00, 90000.00, 'Fulfilled', 'عقد إيجار سنوي عائلي، تم توفير الشقة في مجمع حطين.'),
('40404040-4040-4040-4040-404040404040', 'ORD-2026-004', 'فهد العتيبي', '0511223344', 'COMMERCIAL', 'معرض تجاري', 'طريق أنس بن مالك - 150 م²', 30000.00, 45000.00, 'Searching', 'موقع مميز لمحل تجاري'),
('50505050-5050-5050-5050-505050505050', 'ORD-2026-005', 'مهندس خالد الدوسري', '0566778899', 'RESIDENTIAL', 'دور أرضي مجهز', 'حي العارض', 80000.00, 100000.00, 'New', 'دور كامل حوش مدخل سيارة'),
('60606060-6060-6060-6060-606060606060', 'ORD-2026-006', 'مؤسسة الأعمال الوطنية', '0522334455', 'COMMERCIAL', 'مستودع تجاري مرخص', 'حي السلي / الصناعية', 180000.00, 250000.00, 'Searching', 'مستودع مع قبو وتراخيص دفاع مدني'),
('70707070-7070-7070-7070-707070707070', 'ORD-2026-007', 'عمر القحطاني', '0577889900', 'RESIDENTIAL', 'شقة روف مع سطح', 'حي الصحافة', 95000.00, 110000.00, 'Fulfilled', 'تم اختيار الروف وتوقيع العقد'),
('80808080-8080-8080-8080-808080808080', 'ORD-2026-008', 'عبد الله بن حمد', '0599001122', 'COMMERCIAL', 'أرض تجارية للاستثمار', 'طريق التخصصي', 500000.00, 800000.00, 'New', 'أرض على 3 شوارع للاستثمار المستقبلي'),
('90909090-9090-9090-9090-909090909090', 'ORD-2026-009', 'م. ريم الحربي', '0533445566', 'RESIDENTIAL', 'شقة تمليك مودرن', 'حي الملقا', 900000.00, 1200000.00, 'Searching', 'تمليك بنكي مجهز بأدوار علوية'),
('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'ORD-2026-010', 'سارة المطيري', '0544556677', 'COMMERCIAL', 'شقة مكتبية', 'حي المحمدية', 120000.00, 160000.00, 'New', 'مكتب إداري 3 غرف وحمامين'),
('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'ORD-2026-011', 'نايف البقمي', '0566889900', 'RESIDENTIAL', 'استراحة عائلية', 'حي الخير / القيروان', 150000.00, 200000.00, 'New', 'قسمين مع مسبح ومسطحات خضراء')
ON CONFLICT (order_number) DO UPDATE SET
  client_name = EXCLUDED.client_name,
  client_phone = EXCLUDED.client_phone,
  category = EXCLUDED.category,
  building_type = EXCLUDED.building_type,
  desired_area = EXCLUDED.desired_area,
  budget_min = EXCLUDED.budget_min,
  budget_max = EXCLUDED.budget_max,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes;

-- 15. MANAGED PROPERTY CONTRACTS TABLE (عقود إدارة الأملاك والمجمعات)
CREATE TABLE IF NOT EXISTS managed_property_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_number VARCHAR(50) UNIQUE NOT NULL,
    property_name VARCHAR(255) NOT NULL,
    lessor_name VARCHAR(255) NOT NULL,
    lessor_phone VARCHAR(50) NOT NULL,
    property_type VARCHAR(50) NOT NULL CHECK (property_type IN ('Residential', 'Commercial', 'Mixed')),
    total_units INT NOT NULL DEFAULT 1,
    occupied_units INT NOT NULL DEFAULT 0,
    vacant_units INT NOT NULL DEFAULT 0,
    fee_type VARCHAR(50) NOT NULL CHECK (fee_type IN ('PERCENTAGE', 'FIXED_ANNUAL')),
    fee_value NUMERIC(10, 2) NOT NULL DEFAULT 5.0,
    annual_expected_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
    collected_revenue NUMERIC(14, 2) NOT NULL DEFAULT 0,
    transferred_to_owner NUMERIC(14, 2) NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Under_Renewal', 'Expired', 'Suspended')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. PROPERTY MAINTENANCE TASKS TABLE (أوامر الصيانة والتشغيل)
CREATE TABLE IF NOT EXISTS property_maintenance_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_number VARCHAR(50) UNIQUE NOT NULL,
    managed_property_id UUID REFERENCES managed_property_contracts(id) ON DELETE CASCADE,
    property_name VARCHAR(255) NOT NULL,
    unit_name VARCHAR(100),
    maintenance_type VARCHAR(100) NOT NULL,
    cost_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    contractor_name VARCHAR(255),
    contractor_phone VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In_Progress', 'Completed', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEED MANAGED PROPERTY CONTRACTS
INSERT INTO managed_property_contracts (id, contract_number, property_name, lessor_name, lessor_phone, property_type, total_units, occupied_units, vacant_units, fee_type, fee_value, annual_expected_revenue, collected_revenue, transferred_to_owner, start_date, end_date, status, notes) VALUES
('11112222-3333-4444-5555-666677778888', 'PMC-2026-001', 'عمارة النخيل السكنية', 'عبد العزيز بن محمد الراجحي', '0501122334', 'Residential', 12, 10, 2, 'PERCENTAGE', 5.00, 480000.00, 360000.00, 342000.00, '2026-01-01', '2026-12-31', 'Active', 'عمارة سكنية 4 أدوار بـ 12 شقة فاخرة، عقد تشغيل وإدارة أملاك كامل شامل التحصيل.'),
('22223333-4444-5555-6666-777788889999', 'PMC-2026-002', 'مجمع الأمل التجاري', 'شركة الأفق العقارية الاستثمارية', '0559988776', 'Commercial', 8, 7, 1, 'PERCENTAGE', 7.50, 720000.00, 540000.00, 499500.00, '2025-06-01', '2027-05-31', 'Active', 'مجمع معارض ومكاتب تجارية على شارع رئيسي.'),
('33334444-5555-6666-7777-888899990000', 'PMC-2026-003', 'برج الفلاح الإداري', 'سليمان بن عبد الله القحطاني', '0544332211', 'Mixed', 20, 18, 2, 'FIXED_ANNUAL', 25000.00, 1200000.00, 900000.00, 875000.00, '2026-01-15', '2027-01-14', 'Active', 'إدارة أملاك برج إداري وسكني شامل الحراسة والنظافة وصيانة المصاعد.')
ON CONFLICT (contract_number) DO NOTHING;

-- SEED PROPERTY MAINTENANCE TASKS
INSERT INTO property_maintenance_tasks (id, task_number, managed_property_id, property_name, unit_name, maintenance_type, cost_amount, contractor_name, contractor_phone, status, notes) VALUES
('aa11bb22-cc33-dd44-ee55-ff6677889900', 'MNT-2026-101', '11112222-3333-4444-5555-666677778888', 'عمارة النخيل السكنية', 'شقة 203', 'سباكة وتغيير محابس', 450.00, 'مؤسسة الشعلة للصيانة', '0509876543', 'Completed', 'تم إصلاح تسريب المياه في الحمام الرئيسي وتشغيل المضخة.'),
('bb22cc33-dd44-ee55-ff66-778899001122', 'MNT-2026-102', '22223333-4444-5555-6666-777788889999', 'مجمع الأمل التجاري', 'معرض 02', 'صيانة وتكييف مركزي', 1800.00, 'شركة التكييف العربي', '0551234567', 'In_Progress', 'تغيير الفلاتر وتعبئة الفريون للوحدات المروحية.'),
('cc33dd44-ee55-ff66-7788-990011223344', 'MNT-2026-103', '33334444-5555-6666-7777-888899990000', 'برج الفلاح الإداري', 'مصعد رقم 1', 'صيانة دورية للمصاعد', 1200.00, 'شركة أوتيس للمصاعد', '0547766554', 'Completed', 'الفحص الفني الدوري واختبار كوابل الأمان.')
ON CONFLICT (task_number) DO NOTHING;

-- SEED INITIAL GENERAL SERVICES
INSERT INTO general_services (id, service_number, client_name, client_phone, client_national_id, category, title, cost_amount, fee_amount, office_profit, status, notes) VALUES
('11111111-0000-0000-0000-000000000001', 'GS-2026-101', 'أحمد بن عبد الله المطيري', '0501234567', '1088776655', 'EJAR', 'توثيق عقد إيجار موحد عبر منصة إيجار', 125.00, 350.00, 225.00, 'Completed', 'تم توثيق العقد بنجاح وتسليم النسخة الإلكترونية للعميل'),
('11111111-0000-0000-0000-000000000002', 'GS-2026-102', 'مؤسسة البناء الحديث للتجارة', '0559876543', '7012345678', 'BALADY', 'إصدار رخصة بلدي ومعاينة محل تجاري', 500.00, 1200.00, 700.00, 'In_Progress', 'في انتظار موافقة البلدية النهائية'),
('11111111-0000-0000-0000-000000000003', 'GS-2026-103', 'سليمان بن خالد الدوسري', '0543210987', '1022334455', 'DEED_SURVEY', 'رفع مساحي وتحديث صك عقاري ألكترونياً', 300.00, 850.00, 550.00, 'Completed', 'تمت إحالة الصك لمنصة إحكام وبورصة العقارات')
ON CONFLICT (service_number) DO NOTHING;

-- RESTRICTED ROLE FOR POSTGREST'S ANONYMOUS ACCESS
-- Previously PGRST_DB_ANON_ROLE was set to "postgres" (full superuser), which let
-- any unauthenticated request read/write/delete anything with no login required.
-- web_anon only gets ordinary table CRUD, no DDL, no superuser rights.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO web_anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO web_anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO web_anon;
