import { z } from 'zod';
const uuid = z.string().uuid();
export const saveUserSchema = z.object({
    user_id: uuid.optional(), email: z.string().email().max(254),
    full_name: z.string().trim().min(2).max(150), mobile: z.string().regex(/^05\d{8}$/),
    national_id_or_iqama: z.string().regex(/^\d{10}$/).optional().or(z.literal('')),
    role: z.enum(['BROKER', 'OWNER', 'TENANT']),
    owners: z.array(z.object({ property_id: uuid, ownership_share: z.coerce.number().gt(0).lte(100) })).max(100).default([]),
    leases: z.array(uuid).max(20).default([]), broker_contracts: z.array(uuid).max(200).default([]),
    agreement_id: uuid.optional(),
    agreement: z.object({ agreement_number: z.string().trim().min(1).max(100),
        commission_type: z.enum(['PERCENTAGE', 'FIXED']), commission_value: z.coerce.number().min(0),
        percentage_basis: z.enum(['DEAL_VALUE', 'OFFICE_COMMISSION']).nullable(),
    }).optional(),
}).superRefine((input, ctx) => {
    const fail = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (input.role === 'OWNER' && !input.owners.length)
        fail('owners', 'Property required');
    if (new Set(input.owners.map(x => x.property_id)).size !== input.owners.length)
        fail('owners', 'Duplicate property');
    if (input.role === 'TENANT' && !input.leases.length)
        fail('leases', 'Active lease required');
    if (input.role === 'BROKER' && !input.agreement_id && !input.agreement)
        fail('agreement', 'Commission agreement required');
    if (input.agreement?.commission_type === 'PERCENTAGE' && (input.agreement.commission_value > 100 || !input.agreement.percentage_basis))
        fail('agreement', 'Percentage and basis required');
    if (input.agreement?.commission_type === 'FIXED' && input.agreement.percentage_basis)
        fail('agreement', 'Fixed agreement cannot have percentage basis');
});
