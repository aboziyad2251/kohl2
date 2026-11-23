-- Migration: 20261123140000_matching_hatif_repeat_rental.sql
-- ترحيل تراكمي وآمن لقاعدة بيانات كحل (kohl2)

BEGIN;

-- 1) أوزان المطابقة ونطاق السماح السعري المرن وعتبات التأهيل
CREATE TABLE IF NOT EXISTS public.matching_rule_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'all' CHECK (scope IN ('all', 'sales', 'rental')),
  weight_purpose_type numeric(5,2) NOT NULL DEFAULT 25.00 CHECK (weight_purpose_type >= 0 AND weight_purpose_type <= 100),
  weight_location numeric(5,2) NOT NULL DEFAULT 25.00 CHECK (weight_location >= 0 AND weight_location <= 100),
  weight_price_rent numeric(5,2) NOT NULL DEFAULT 30.00 CHECK (weight_price_rent >= 0 AND weight_price_rent <= 100),
  weight_specs numeric(5,2) NOT NULL DEFAULT 20.00 CHECK (weight_specs >= 0 AND weight_specs <= 100),
  price_tolerance_pct numeric(5,2) NOT NULL DEFAULT 15.00 CHECK (price_tolerance_pct >= 0 AND price_tolerance_pct <= 50),
  high_match_threshold numeric(5,2) NOT NULL DEFAULT 80.00,
  medium_match_threshold numeric(5,2) NOT NULL DEFAULT 50.00,
  is_active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_matching_weights_sum_100 CHECK (
    round((weight_purpose_type + weight_location + weight_price_rent + weight_specs)::numeric, 2) = 100.00
  ),
  CONSTRAINT chk_matching_thresholds_order CHECK (high_match_threshold >= medium_match_threshold)
);

CREATE INDEX IF NOT EXISTS idx_matching_rule_weights_scope_active
  ON public.matching_rule_weights (scope, is_active);

INSERT INTO public.matching_rule_weights (
  scope,
  weight_purpose_type,
  weight_location,
  weight_price_rent,
  weight_specs,
  price_tolerance_pct,
  high_match_threshold,
  medium_match_threshold,
  is_active
)
SELECT 'all', 25.00, 25.00, 30.00, 20.00, 15.00, 80.00, 50.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.matching_rule_weights WHERE scope = 'all' AND is_active = true
);

-- 2) سجل نتائج المطابقة وتأهيل الفرص مع الأسباب والفجوات
CREATE TABLE IF NOT EXISTS public.opportunity_match_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_source text NOT NULL DEFAULT 'crm_lead' CHECK (opportunity_source IN ('crm_lead', 'customer_order')),
  opportunity_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  match_score numeric(5,2) NOT NULL CHECK (match_score >= 0 AND match_score <= 100),
  qualification_tier text NOT NULL CHECK (
    qualification_tier IN (
      'qualified_ready_for_viewing',
      'needs_review_or_negotiation',
      'needs_realignment_or_alternatives'
    )
  ),
  qualification_label_ar text NOT NULL,
  matched_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  gaps_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  needs_confirmation_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (opportunity_source, opportunity_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_opp_match_eval_opp_score
  ON public.opportunity_match_evaluations (opportunity_source, opportunity_id, match_score DESC);

CREATE INDEX IF NOT EXISTS idx_opp_match_eval_prop_score
  ON public.opportunity_match_evaluations (property_id, match_score DESC);

CREATE INDEX IF NOT EXISTS idx_opp_match_eval_tier
  ON public.opportunity_match_evaluations (qualification_tier, match_score DESC);

-- 3) جدول تحليل وقراءة بيانات الهاتف (Hatif) وربطها بالعميل والفرصة
CREATE TABLE IF NOT EXISTS public.hatif_call_analytics (
  call_log_id text PRIMARY KEY,
  activity_id uuid REFERENCES public.crm_activities(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  customer_phone text,
  direction_raw text,
  direction_label_ar text NOT NULL DEFAULT 'غير محدد',
  status_raw text,
  status_label_ar text NOT NULL DEFAULT 'غير محدد',
  duration_seconds integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  duration_label_ar text NOT NULL DEFAULT 'أقل من دقيقة',
  intent_level text NOT NULL DEFAULT 'unknown' CHECK (
    intent_level IN ('high', 'medium', 'low', 'callback_requested', 'unknown')
  ),
  intent_label_ar text NOT NULL DEFAULT 'تحتاج متابعة وتقييم',
  response_urgency text NOT NULL DEFAULT 'normal' CHECK (
    response_urgency IN ('urgent_followup', 'cold_lead', 'active_engaged', 'normal')
  ),
  response_urgency_label_ar text NOT NULL DEFAULT 'متابعة اعتيادية',
  first_response_minutes integer CHECK (first_response_minutes IS NULL OR first_response_minutes >= 0),
  summary_ar text,
  called_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hatif_call_analytics_lead_time
  ON public.hatif_call_analytics (lead_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_hatif_call_analytics_phone_time
  ON public.hatif_call_analytics (customer_phone, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_hatif_call_analytics_urgency
  ON public.hatif_call_analytics (response_urgency, called_at DESC);

-- 4) تتبع تكرار الإيجار ودورة الإيجار ومنع التكرار غير المقصود
CREATE TABLE IF NOT EXISTS public.rental_recurrence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE RESTRICT,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  customer_phone text,
  is_repeat_or_renewal boolean NOT NULL DEFAULT false,
  repeat_reason_ar text,
  renewal_sequence integer NOT NULL DEFAULT 1 CHECK (renewal_sequence >= 1),
  billing_cycle text NOT NULL CHECK (
    billing_cycle IN ('monthly', 'quarterly', 'semi_annual', 'annual')
  ),
  cycle_label_ar text NOT NULL,
  cycle_months integer NOT NULL CHECK (cycle_months IN (1, 3, 6, 12)),
  cycle_amount numeric(14,2) NOT NULL CHECK (cycle_amount >= 0),
  total_contract_amount numeric(14,2) NOT NULL CHECK (total_contract_amount >= 0),
  installments_count integer NOT NULL DEFAULT 1 CHECK (installments_count >= 1),
  start_date date NOT NULL,
  end_date date NOT NULL,
  next_due_date date,
  dedup_fingerprint text NOT NULL,
  dedup_status text NOT NULL DEFAULT 'unique' CHECK (dedup_status IN ('unique', 'duplicate_flagged', 'linked_renewal')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_rental_recurrence_dates CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_rental_recurrence_property_dates
  ON public.rental_recurrence_records (property_id, start_date DESC, end_date DESC);

CREATE INDEX IF NOT EXISTS idx_rental_recurrence_tenant_phone
  ON public.rental_recurrence_records (tenant_id, customer_phone, start_date DESC);

CREATE INDEX IF NOT EXISTS idx_rental_recurrence_next_due
  ON public.rental_recurrence_records (next_due_date);

CREATE INDEX IF NOT EXISTS idx_rental_recurrence_fingerprint
  ON public.rental_recurrence_records (dedup_fingerprint);

-- دالة حساب الإيجار الدوري: عدد الدفعات، القيمة الإجمالية، والدفعة القادمة
CREATE OR REPLACE FUNCTION public.calculate_recurring_rental_plan(
  p_start_date date,
  p_end_date date,
  p_billing_cycle text,
  p_cycle_amount numeric,
  p_reference_date date DEFAULT current_date
)
RETURNS TABLE (
  cycle_months integer,
  cycle_label_ar text,
  installments_count integer,
  total_contract_amount numeric,
  next_due_date date,
  remaining_installments integer
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_months integer;
  v_label text;
  v_count integer;
  v_next_due date;
  v_remaining integer;
  v_due date;
  i integer;
BEGIN
  CASE lower(trim(p_billing_cycle))
    WHEN 'monthly' THEN v_months := 1; v_label := 'شهري';
    WHEN 'quarterly' THEN v_months := 3; v_label := 'ربع سنوي';
    WHEN 'semi_annual' THEN v_months := 6; v_label := 'نصف سنوي';
    WHEN 'annual' THEN v_months := 12; v_label := 'سنوي';
    ELSE RAISE EXCEPTION 'Unsupported billing_cycle: %', p_billing_cycle;
  END CASE;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'end_date (%) must be >= start_date (%)', p_end_date, p_start_date;
  END IF;

  v_count := GREATEST(
    1,
    CEIL((
      (EXTRACT(YEAR FROM age(p_end_date, p_start_date)) * 12) +
      EXTRACT(MONTH FROM age(p_end_date, p_start_date)) +
      CASE WHEN EXTRACT(DAY FROM p_end_date) >= EXTRACT(DAY FROM p_start_date) THEN 1 ELSE 0 END
    )::numeric / v_months)::integer
  );

  v_next_due := NULL;
  v_remaining := 0;

  FOR i IN 0..(v_count - 1) LOOP
    v_due := (p_start_date + make_interval(months => i * v_months))::date;
    IF v_due <= p_end_date AND v_due >= p_reference_date THEN
      IF v_next_due IS NULL THEN
        v_next_due := v_due;
      END IF;
      v_remaining := v_remaining + 1;
    END IF;
  END LOOP;

  cycle_months := v_months;
  cycle_label_ar := v_label;
  installments_count := v_count;
  total_contract_amount := round((v_count * p_cycle_amount)::numeric, 2);
  next_due_date := v_next_due;
  remaining_installments := v_remaining;
  RETURN NEXT;
END;
$$;

COMMIT;
