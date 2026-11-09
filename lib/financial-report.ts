import type { ManagedPropertyContract } from './types';
export interface ReportTransaction { flow_type: 'INCOME' | 'EXPENSE'; net_amount?: number; }
export interface ReportOperations { vacantUnitsCount?: number | null; managedPropertiesCount?: number; }
export function currentOperations(properties: ManagedPropertyContract[], loaded: boolean): ReportOperations {
  const active = properties.filter(property => ['Active', 'Under_Renewal'].includes(property.status));
  return { vacantUnitsCount: loaded && active.length ? active.reduce((sum, property) => sum + Math.max(0, Number(property.vacant_units) || 0), 0) : null, managedPropertiesCount: active.length };
}
export function calculatedReport(gross: number, net: number, transactions: ReportTransaction[], operations: ReportOperations = {}) {
  const money = (value: number) => value.toLocaleString('ar-SA', { maximumFractionDigits: 2 });
  const expense = transactions.filter(row => row.flow_type === 'EXPENSE').reduce((sum, row) => sum + (Number(row.net_amount) || 0), 0);
  return {
    analysis_source: 'calculated' as const,
    what_went_well: [
      `إجمالي الدخل في بيانات اليوم: ${money(gross)} ر.س.`,
      `صافي الدخل في بيانات اليوم: ${money(net)} ر.س.`,
      `عدد المعاملات المتاحة لهذا اليوم: ${transactions.length}.`,
    ],
    what_went_bad: [
      `المصروفات المسجلة في المعاملات المتاحة: ${money(expense)} ر.س.`,
      operations.vacantUnitsCount == null ? 'لا تتوفر بيانات كافية لتحديد الوحدات الشاغرة في عقود الإدارة النشطة.' : `الوحدات الشاغرة حالياً في عقود الإدارة النشطة: ${operations.vacantUnitsCount}. هذا العدد لا يمثل حالة الإشغال التاريخية لليوم المختار.`,
      'هذه البيانات لا تثبت اكتمال التوثيق أو غياب المتأخرات؛ راجع السجلات المرتبطة.',
    ],
    ai_recommendations: ['راجع المستحقات والتجديدات في أعمال اليوم.', 'راجع تفاصيل المعاملات قبل اتخاذ قرار مالي.'],
    income_increment_strategy: 'ملخص حسابي من البيانات المتاحة، دون توقعات أو ضمان لزيادة الإيرادات.',
  };
}
