import { FinancialTransaction, DailyFinancialSummary, TransactionType, FlowType } from '../types';

/**
 * Automatically calculate Net Amount for a financial transaction based on Flow Type, Gross, and VAT.
 * Business Logic:
 * - INCOME: Net Amount = Gross Amount - Tax/VAT Amount (or gross received)
 * - EXPENSE: Net Amount = Gross Amount + Tax/VAT Amount (Total Expense Outflow)
 */
export function calculateTransactionNet(
  flowType: FlowType,
  grossAmount: number,
  vatAmount: number
): number {
  const gross = Number(grossAmount) || 0;
  const vat = Number(vatAmount) || 0;

  if (flowType === 'INCOME') {
    return Math.max(0, gross - vat);
  } else {
    return gross + vat;
  }
}

/**
 * Recalculate daily financial summary totals for a specified date from transactions list.
 */
export function computeDailySummaryFromTransactions(
  transactions: FinancialTransaction[],
  targetDate: string,
  existingSummary?: DailyFinancialSummary
): DailyFinancialSummary {
  const dayTx = transactions.filter((t) => t.transaction_date === targetDate);

  const totalGrossIncome = dayTx
    .filter((t) => t.flow_type === 'INCOME')
    .reduce((sum, t) => sum + (t.gross_amount || 0), 0);

  const totalExpenses = dayTx
    .filter((t) => t.flow_type === 'EXPENSE')
    .reduce((sum, t) => sum + (t.net_amount || t.gross_amount || 0), 0);

  const totalNetIncome = totalGrossIncome - totalExpenses;

  return {
    id: existingSummary?.id || `dfs-${Date.now()}`,
    summary_date: targetDate,
    total_gross_income: totalGrossIncome,
    total_expenses: totalExpenses,
    total_net_income: totalNetIncome,
    new_contracts_count: existingSummary?.new_contracts_count ?? dayTx.filter(t => t.contract_id).length,
    active_brokerage_deals_count: existingSummary?.active_brokerage_deals_count ?? dayTx.filter(t => t.brokerage_agreement_id).length,
    occupancy_rate: existingSummary?.occupancy_rate ?? 87.5,
    created_at: existingSummary?.created_at || new Date().toISOString(),
  };
}

/**
 * Returns Arabic human-readable metadata for transaction types
 */
export function getTransactionTypeMeta(type: TransactionType): {
  label: string;
  badgeBg: string;
  badgeText: string;
} {
  switch (type) {
    case 'BROKERAGE_COMMISSION':
      return { label: 'عمولة وساطة عقارية', badgeBg: 'bg-emerald-500/10 border-emerald-500/30', badgeText: 'text-emerald-400' };
    case 'RENTAL_PAYMENT':
      return { label: 'دفعة إيجارية', badgeBg: 'bg-sky-500/10 border-sky-500/30', badgeText: 'text-sky-400' };
    case 'DOCUMENT_FEE':
      return { label: 'رسوم توثيق عقود', badgeBg: 'bg-purple-500/10 border-purple-500/30', badgeText: 'text-purple-400' };
    case 'MANAGEMENT_FEE':
      return { label: 'رسوم إدارة أملاك', badgeBg: 'bg-amber-500/10 border-amber-500/30', badgeText: 'text-amber-400' };
    case 'OPERATING_EXPENSE':
      return { label: 'مصروفات تشغيلية', badgeBg: 'bg-rose-500/10 border-rose-500/30', badgeText: 'text-rose-400' };
    case 'MAINTENANCE_COST':
      return { label: 'تكاليف صيانة وتطوير', badgeBg: 'bg-orange-500/10 border-orange-500/30', badgeText: 'text-orange-400' };
    default:
      return { label: type, badgeBg: 'bg-slate-800 border-slate-700', badgeText: 'text-slate-300' };
  }
}
