import { z } from 'zod';
const uuid = z.string().uuid(), date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/), text = z.string().trim().min(1).max(2000);
const time = z.string().datetime({ offset: true });
export const workflowSchema = z.discriminatedUnion('operation', [
    z.object({ operation: z.literal('MAINTENANCE_CREATE'), property_id: uuid, contract_id: uuid.optional(), unit_label: z.string().max(100).optional(), category: text.max(100), description: text, preferred_visit_at: time.optional() }),
    z.object({ operation: z.literal('MAINTENANCE_TRANSITION'), task_id: uuid, status: z.enum(['under_review', 'awaiting_customer_approval', 'awaiting_manager_approval', 'scheduled', 'in_progress', 'completed', 'closed', 'rejected', 'cancelled']), note: z.string().max(2000).default(''), scheduled_at: time.optional() }),
    z.object({ operation: z.literal('MAINTENANCE_QUOTE'), task_id: uuid, cost: z.number().nonnegative().max(1e9), cost_bearer: z.enum(['tenant', 'owner', 'company']), cost_customer_id: uuid.optional() }),
    z.object({ operation: z.literal('CONTRACT_UNIT'), contract_id: uuid, unit_label: text.max(100), unit_details: z.string().max(2000), owner_contact_visible: z.boolean() }),
    z.object({ operation: z.literal('DUE_SAVE'), id: uuid.optional(), contract_id: uuid, kind: z.enum(['rent', 'utility', 'service']), description: text, due_date: date, period_start: date, period_end: date, amount: z.number().positive().max(1e9) }),
    z.object({ operation: z.literal('PAYMENT_LINK'), payment_id: uuid, due_id: uuid }),
    z.object({ operation: z.literal('OWNER_CHARGE'), payment_id: uuid, owner_charge: z.boolean() }),
    z.object({ operation: z.literal('COMMISSION_SAVE'), broker_user_id: uuid, contract_id: uuid, type: z.enum(['PERCENTAGE', 'FIXED']), value: z.number().nonnegative().max(1e9), basis: z.enum(['DEAL_VALUE', 'OFFICE_COMMISSION']).nullable(), payout_status: z.enum(['pending', 'approved', 'paid']), closed_at: time.optional() }),
    z.object({ operation: z.literal('KPI_SAVE'), id: uuid.optional(), broker_user_id: uuid, name: text.max(150), metric: z.enum(['contract_count', 'contract_value', 'commission', 'custom']), target: z.number().positive().max(1e9), period: z.enum(['monthly', 'quarterly']), period_start: date, period_end: date, weight: z.number().nonnegative().max(100).optional() }),
    z.object({ operation: z.literal('KPI_EVENT'), kpi_id: uuid, value: z.number().min(-1e9).max(1e9), date, note: text }),
]).superRefine((input, ctx) => {
    if ('period_start' in input && input.period_end < input.period_start) ctx.addIssue({ code: 'custom', message: 'Period end precedes its start' });
    if (input.operation === 'COMMISSION_SAVE' && ((input.type === 'PERCENTAGE' && (input.value > 100 || !input.basis)) || (input.type === 'FIXED' && input.basis))) ctx.addIssue({ code: 'custom', message: 'Invalid commission basis or percentage' });
    if (input.operation === 'COMMISSION_SAVE' && input.payout_status !== 'pending' && !input.closed_at) ctx.addIssue({ code: 'custom', message: 'Confirm contract closing before approving a payout' });
    if (input.operation === 'MAINTENANCE_QUOTE' && input.cost_bearer !== 'company' && !input.cost_customer_id) ctx.addIssue({ code: 'custom', message: 'Select the assigned cost-bearing customer' });
});
export const customerOperations = ['MAINTENANCE_CREATE', 'MAINTENANCE_TRANSITION'];

export interface PortalContract { id: string; number: string; property_id: string; unit_label?: string; unit_details?: string; annual_rent: number; start_date: string; end_date: string; status: string; tenant_name?: string; tenant_phone?: string; owner_contact_visible?: boolean; }
export interface PortalPayment { id: string; property_id: string; contract_id?: string; due_id?: string; date: string; amount: number; net_amount?: number; method?: string; category: string; flow: string; owner_charge: boolean; maintenance_task_id?: string; period_start?: string; period_end?: string; }
export interface PaymentDue { id: string; contract_id: string; kind: string; description: string; due_date: string; period_start: string; period_end: string; amount: number; }
export interface Maintenance { id: string; number: string; property_id: string; contract_id?: string; unit_label?: string; category: string; description: string; cost: number; cost_bearer: string; cost_customer_id?: string; requested_by: string; status: string; created_at: string; completed_at?: string; preferred_visit_at?: string; scheduled_at?: string; history: { from?: string; to: string; actor: string; actor_name?: string; note: string; date: string }[]; attachments: { id: string; filename: string }[]; }
export interface Commission { contract_id: string; broker_user_id: string; number: string; closed_at?: string; status: string; type: string; rate: number; basis?: string; contract_value: number; amount: number; }
export interface KPI { id: string; broker_user_id: string; name: string; metric: string; target: number; period: string; period_start: string; period_end: string; weight?: number; custom_actual: number; }
export interface PortalDashboard { role: string; today: string; properties: { id: string; name: string; address: string; city: string; units_count: number }[]; contracts: PortalContract[]; payments: PortalPayment[]; dues: PaymentDue[]; ownership: { property_id: string; ownership_share: number; effective_from: string; effective_to?: string }[]; maintenance: Maintenance[]; commissions: Commission[]; kpis: KPI[]; customers: { id: string; name: string; role: string }[]; audit: { id: string; actor_user_id: string; resource: string; resource_id: string; action: string; created_at: string; before_value?: unknown; after_value?: unknown }[]; }
