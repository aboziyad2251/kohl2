-- ====================================================================
-- MIGRATION: EMPLOYEES MANAGEMENT, TIMESHEET, CRM, RBAC & TASK DELEGATION
-- ====================================================================

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    national_id_or_iqama VARCHAR(50) NOT NULL,
    job_title VARCHAR(150) NOT NULL,
    department VARCHAR(100) NOT NULL DEFAULT 'المبيعات والوساطة',
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL,
    hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
    basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    housing_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    transport_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    other_allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ON_LEAVE, TERMINATED
    system_role VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE', -- ADMIN, CEO, HR, EMPLOYEE
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Timesheet & Attendance Table
CREATE TABLE IF NOT EXISTS public.timesheet_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in VARCHAR(20) NOT NULL,
    check_out VARCHAR(20),
    total_hours NUMERIC(5, 2) DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT', -- PRESENT, LATE, ABSENT, ON_LEAVE, EXCUSED
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Payroll Payments Table
CREATE TABLE IF NOT EXISTS public.payroll_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    month_year VARCHAR(20) NOT NULL,
    basic_salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    commissions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER', -- BANK_TRANSFER, CASH, CHEQUE
    reference_number VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    is_archived BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Leave Requests Table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    employee_name VARCHAR(255) NOT NULL,
    leave_type VARCHAR(50) NOT NULL DEFAULT 'ANNUAL', -- ANNUAL, SICK, EMERGENCY, UNPAID
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count INT NOT NULL DEFAULT 1,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Task Delegations Table
CREATE TABLE IF NOT EXISTS public.task_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    assigned_to_employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    assigned_to_name VARCHAR(255) NOT NULL,
    delegated_by_id VARCHAR(100) NOT NULL,
    delegated_by_name VARCHAR(255) NOT NULL,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    is_delegated_action BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Real Estate CRM Leads Table
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150),
    lead_type VARCHAR(50) NOT NULL DEFAULT 'BUYER', -- BUYER, SELLER, TENANT, LANDLORD, INVESTOR
    stage VARCHAR(50) NOT NULL DEFAULT 'NEW', -- NEW, CONTACTED, SHOWING, NEGOTIATION, WON, LOST
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    source VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP',
    budget_min NUMERIC(12, 2) DEFAULT 0.00,
    budget_max NUMERIC(12, 2) DEFAULT 0.00,
    preferred_property_type VARCHAR(100),
    preferred_city VARCHAR(100) DEFAULT 'الرياض',
    preferred_district VARCHAR(100),
    assigned_agent_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    assigned_agent_name VARCHAR(255),
    notes TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Real Estate CRM Deals Table
CREATE TABLE IF NOT EXISTS public.crm_deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
    lead_name VARCHAR(255) NOT NULL,
    lead_phone VARCHAR(50) NOT NULL,
    property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
    property_title VARCHAR(255),
    deal_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 2.50,
    commission_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    office_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stage VARCHAR(50) NOT NULL DEFAULT 'NEGOTIATION',
    expected_closing_date DATE NOT NULL,
    assigned_agent_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    assigned_agent_name VARCHAR(255),
    is_archived BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Real Estate CRM Activities Table
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
    lead_or_client_name VARCHAR(255) NOT NULL,
    activity_type VARCHAR(50) NOT NULL DEFAULT 'CALL', -- CALL, WHATSAPP, SHOWING, MEETING, OFFER, NOTE
    title VARCHAR(255) NOT NULL,
    notes TEXT,
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alter contracts and brokerage_agreements for agent association & archive if columns not exist
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_agent_name VARCHAR(255);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

ALTER TABLE public.brokerage_agreements ADD COLUMN IF NOT EXISTS assigned_agent_id UUID;
ALTER TABLE public.brokerage_agreements ADD COLUMN IF NOT EXISTS assigned_agent_name VARCHAR(255);
ALTER TABLE public.brokerage_agreements ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
