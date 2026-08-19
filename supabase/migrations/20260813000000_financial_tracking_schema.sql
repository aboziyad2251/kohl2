-- Supabase / PostgreSQL Migration: Financial Tracking & AI Income Engine
-- Database: office_db

-- 1. Financial Transactions Table (Income & Expenses)
CREATE TABLE IF NOT EXISTS financial_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'BROKERAGE_COMMISSION',
        'RENTAL_PAYMENT',
        'DOCUMENT_FEE',
        'MANAGEMENT_FEE',
        'OPERATING_EXPENSE',
        'MAINTENANCE_COST'
    )),
    flow_type VARCHAR(10) NOT NULL CHECK (flow_type IN ('INCOME', 'EXPENSE')),
    gross_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_vat_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    net_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    brokerage_agreement_id UUID REFERENCES brokerage_agreements(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Daily Summary Ledger Table
CREATE TABLE IF NOT EXISTS daily_financial_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    total_gross_income DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_expenses DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_net_income DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    new_contracts_count INT DEFAULT 0,
    active_brokerage_deals_count INT DEFAULT 0,
    occupancy_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. AI Daily Insights & Recommendations Table
CREATE TABLE IF NOT EXISTS ai_daily_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    gross_income DECIMAL(12,2) NOT NULL,
    net_income DECIMAL(12,2) NOT NULL,
    what_went_well TEXT[] NOT NULL,
    what_went_bad TEXT[] NOT NULL,
    ai_recommendations TEXT[] NOT NULL,
    income_increment_strategy TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_fin_tx_date ON financial_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_fin_tx_flow ON financial_transactions(flow_type);
CREATE INDEX IF NOT EXISTS idx_fin_tx_type ON financial_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_fin_tx_property ON financial_transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_financial_summaries(summary_date);
CREATE INDEX IF NOT EXISTS idx_ai_reports_date ON ai_daily_reports(report_date);

-- SEED MOCK DATA FOR FINANCIAL TRANSACTIONS
INSERT INTO financial_transactions (
    id, transaction_date, transaction_type, flow_type, gross_amount, tax_vat_amount, net_amount, property_id, contract_id, brokerage_agreement_id, notes
) VALUES
(
    'ft-00100000-0000-0000-0000-000000000001',
    CURRENT_DATE,
    'BROKERAGE_COMMISSION',
    'INCOME',
    15000.00,
    2250.00,
    12750.00,
    '77777777-7777-7777-7777-777777777777',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'عمولة وساطة تأجير مكتب تجاري برج الملقا'
),
(
    'ft-00200000-0000-0000-0000-000000000002',
    CURRENT_DATE,
    'RENTAL_PAYMENT',
    'INCOME',
    32500.00,
    0.00,
    32500.00,
    '88888888-8888-8888-8888-888888888888',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    NULL,
    'تحصيل الدفعة الإيجارية النصف سنوية - مجمع العليا'
),
(
    'ft-00300000-0000-0000-0000-000000000003',
    CURRENT_DATE,
    'OPERATING_EXPENSE',
    'EXPENSE',
    4500.00,
    675.00,
    5175.00,
    '77777777-7777-7777-7777-777777777777',
    NULL,
    NULL,
    'صيانة وتحديث المصاعد الدورية - برج الملقا التجاري'
),
(
    'ft-00400000-0000-0000-0000-000000000004',
    CURRENT_DATE,
    'DOCUMENT_FEE',
    'INCOME',
    2500.00,
    375.00,
    2125.00,
    '88888888-8888-8888-8888-888888888888',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    NULL,
    'رسوم توثيق وتجديد العقد عبر منصة إيجار'
)
ON CONFLICT DO NOTHING;

-- SEED MOCK DATA FOR DAILY FINANCIAL SUMMARY
INSERT INTO daily_financial_summaries (
    id, summary_date, total_gross_income, total_expenses, total_net_income, new_contracts_count, active_brokerage_deals_count, occupancy_rate
) VALUES (
    'dfs-00100000-0000-0000-0000-000000000001',
    CURRENT_DATE,
    50000.00,
    5175.00,
    44825.00,
    2,
    3,
    87.50
)
ON CONFLICT (summary_date) DO NOTHING;

-- SEED MOCK DATA FOR AI DAILY REPORT
INSERT INTO ai_daily_reports (
    id, report_date, gross_income, net_income, what_went_well, what_went_bad, ai_recommendations, income_increment_strategy
) VALUES (
    'adr-00100000-0000-0000-0000-000000000001',
    CURRENT_DATE,
    50000.00,
    44825.00,
    ARRAY[
        'إغلاق اتفاقيتي وساطة تجارية في برج الملقا وتحصيل عمولة فورية بنسبة 100%.',
        'تحصيل الدفعة الإيجارية النصف سنوية لمجمع العليا بدون أي تأخيرات.',
        'توثيق جميع العقود المنفذة اليوم عبر منصة إيجار بانتظام.'
    ],
    ARRAY[
        'وجود 3 وحدات سكنية شاغرة في مجمع العليا متوقفة لأكثر من 15 يوماً دون تأجير.',
        'تأخر توثيق وكالة إلكترونية (E-POA) واحدة للمالك مما يعطل توقيع العقد التجاري الجديد.',
        'ارتفاع تكاليف الصيانة الطارئة للمصاعد في برج الملقا التجاري.'
    ],
    ARRAY[
        'إطلاق تقديم خصم تشجيعي بنسبة 5% على عمولة التأجير السريع للوحدات السكنية الشاغرة بمجمع العليا لسرعة شغلها خلال 48 ساعة.',
        'متابعة كتابة العدل لإصدار الوكالة الإلكترونية المعلقة لإغلاق عقد البرج التجاري بقيمة 120,000 ريال غداً.',
        'إعادة تفاوض عقود الصيانة السنوية للمصاعد للحصول على خصم كميات وتقليل المصاريف التشغيلية.'
    ],
    'التتركيز الفوري غداً على إنهاء إجراءات الوكالة الإلكترونية المعلقة وإبرام العقد التجاري الجديد لتحقيق زيادة إيرادات فورية بقيمة 120,000 ريال سعودي.'
)
ON CONFLICT (report_date) DO NOTHING;
