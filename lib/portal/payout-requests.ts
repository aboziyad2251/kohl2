import { z } from 'zod';
export const payoutQuery = z.object({page:z.coerce.number().int().min(0).max(100000).default(0), status:z.enum(['all','pending','approved','rejected']).default('all')}).strict();
export const payoutAction = z.discriminatedUnion('operation', [
  z.object({operation:z.literal('SUBMIT'),request_id:z.string().uuid(),contract_id:z.string().uuid(),note:z.string().trim().max(1000).default('')}).strict(),
  z.object({operation:z.literal('DECIDE'),request_id:z.string().uuid(),status:z.enum(['approved','rejected']),note:z.string().trim().max(1000).default('')}).strict(),
]).superRefine((v,ctx)=>{if(v.operation==='DECIDE'&&v.status==='rejected'&&!v.note)ctx.addIssue({code:'custom',message:'Rejection reason required'});});
export interface PayoutRequest {
  id:string;broker_user_id:string;broker_name:string;contract_id:string;contract_number:string;amount:number;
  status:'pending'|'approved'|'rejected';note:string;created_at:string;decided_at:string|null;decision_note:string;
  history:{status:string;actor_name:string;note:string;at:string}[];
}
export interface PayoutPage {requests:PayoutRequest[];total:number;page:number;eligible_contract_ids:string[];}
