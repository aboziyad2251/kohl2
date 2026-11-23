import {
  DEFAULT_MATCHING_WEIGHTS,
  evaluateOpportunityMatch,
  formatHatifCallReadable,
  computeRecurringRentalSummary,
  type BillingCycle,
  type MatchingWeights,
} from './kohlEnhancements';

export interface DbLeadOrOrderRow {
  id: string;
  source: 'crm_lead' | 'customer_order';
  purpose: 'sale' | 'rent';
  propertyType?: string | null;
  city?: string | null;
  district?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRooms?: number | null;
  minAreaSqm?: number | null;
  customerPhone?: string | null;
  createdAt?: string | null;
}

export interface DbPropertyRow {
  id: string;
  purpose: 'sale' | 'rent' | 'both';
  propertyType: string;
  city?: string | null;
  district?: string | null;
  askingPrice?: number | null;
  rooms?: number | null;
  areaSqm?: number | null;
  isAvailable: boolean;
}

export interface DbActivityCallRow {
  id: string;
  leadId?: string | null;
  activityType?: string | null;
  notes?: string | null;
  title?: string | null;
  createdAt: string;
  dueDate?: string | null;
}

export interface DbContractRow {
  id: string;
  propertyId: string;
  tenantId?: string | null;
  tenantPhone?: string | null;
  rentAmount?: number | null;
  paymentSchedule?: string | null;
  startDate: string;
  endDate: string;
}

export function normalizePhoneDigits(phone?: string | null): string {
  return (phone || '').replace(/\D+/g, '');
}

export function buildRentalDedupFingerprint(params: {
  customerPhone?: string | null;
  tenantId?: string | null;
  propertyId?: string | null;
  district?: string | null;
  maxPrice?: number | null;
}): string {
  const phoneKey = normalizePhoneDigits(params.customerPhone) || 'no-phone';
  const tenantKey = (params.tenantId || 'no-tenant').trim();
  const propKey = (params.propertyId || 'any-prop').trim();
  const distKey = (params.district || 'any-dist').trim().toLowerCase();
  const priceKey = params.maxPrice ? Math.round(Number(params.maxPrice)) : 0;
  return `${phoneKey}|${tenantKey}|${propKey}|${distKey}|${priceKey}`;
}

export function scoreCandidatesForOpportunity(
  opp: DbLeadOrOrderRow,
  properties: DbPropertyRow[],
  weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS
) {
  return properties
    .map((prop) => {
      const evaluation = evaluateOpportunityMatch(
        {
          id: opp.id,
          purpose: opp.purpose,
          propertyType: opp.propertyType,
          city: opp.city,
          district: opp.district,
          minPrice: opp.minPrice,
          maxPrice: opp.maxPrice,
          minRooms: opp.minRooms,
          minAreaSqm: opp.minAreaSqm,
        },
        prop,
        weights
      );
      return {
        propertyId: prop.id,
        opportunityId: opp.id,
        opportunitySource: opp.source,
        ...evaluation,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function summarizeHatifActivitiesForLead(
  activities: DbActivityCallRow[],
  nowIso: string = new Date().toISOString()
) {
  const calls = activities.filter((a) => (a.activityType || '').toUpperCase() === 'CALL');
  const sorted = [...calls].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const formattedCalls = sorted.map((c) => {
    const rawText = `${c.title || ''} ${c.notes || ''}`;
    const direction = /وارد|inbound|incoming/i.test(rawText) ? 'inbound' : 'outbound';
    const status = /فائت|لم يرد|missed|no_answer|no-answer/i.test(rawText) ? 'missed' : 'answered';
    const secMatch = rawText.match(/(\d+)\s*(?:ث|sec|seconds?)/i);
    const minMatch = rawText.match(/(\d+)\s*(?:د|min|minutes?)/i);
    const durationSeconds =
      (minMatch ? parseInt(minMatch[1], 10) * 60 : 0) + (secMatch ? parseInt(secMatch[1], 10) : 0);

    const ageMinutes = Math.max(
      0,
      Math.round((new Date(nowIso).getTime() - new Date(c.createdAt).getTime()) / 60000)
    );

    return {
      ...formatHatifCallReadable({
        id: c.id,
        direction,
        status,
        durationSeconds,
        notesOrTranscript: rawText,
        calledAt: c.createdAt,
        responseMinutes: ageMinutes,
      }),
      ageMinutes,
    };
  });

  const missedCount = formattedCalls.filter((x) => x.statusLabelAr.startsWith('فائتة')).length;
  const answeredCount = formattedCalls.filter((x) => x.statusLabelAr.startsWith('مجابة')).length;
  const lastCall = formattedCalls[0] ?? null;

  const isColdLead =
    formattedCalls.length === 0 || (lastCall && lastCall.ageMinutes > 7 * 24 * 60 && missedCount > answeredCount);

  return {
    totalCalls: formattedCalls.length,
    answeredCount,
    missedCount,
    lastCall,
    overallAlertAr: lastCall
      ? lastCall.alertLabelAr
      : 'لا توجد مكالمات مسجلة بعد',
    isColdLead,
    calls: formattedCalls,
  };
}

export function detectRepeatRentalAndSchedule(params: {
  contract: DbContractRow;
  existingContracts: DbContractRow[];
  referenceDateIso?: string;
}) {
  const normPhone = normalizePhoneDigits(params.contract.tenantPhone);
  const priorMatches = params.existingContracts.filter((c) => {
    if (c.id === params.contract.id) return false;
    const sameProperty = c.propertyId === params.contract.propertyId;
    const sameTenantId = params.contract.tenantId && c.tenantId === params.contract.tenantId;
    const samePhone = normPhone && normalizePhoneDigits(c.tenantPhone) === normPhone;
    return sameProperty || sameTenantId || samePhone;
  });

  const schedRaw = (params.contract.paymentSchedule || '').toLowerCase();
  const billingCycle: BillingCycle =
    schedRaw.includes('month') || schedRaw.includes('شهر')
      ? 'monthly'
      : schedRaw.includes('quarter') || schedRaw.includes('ربع')
      ? 'quarterly'
      : schedRaw.includes('semi') || schedRaw.includes('نصف')
      ? 'semi_annual'
      : 'annual';

  const summary = computeRecurringRentalSummary({
    startDateIso: params.contract.startDate,
    endDateIso: params.contract.endDate,
    billingCycle,
    cycleAmount: Number(params.contract.rentAmount || 0),
    referenceDateIso: params.referenceDateIso,
    hasPriorTenantOrPropertyContract: priorMatches.length > 0,
  });

  const fingerprint = buildRentalDedupFingerprint({
    customerPhone: params.contract.tenantPhone,
    tenantId: params.contract.tenantId,
    propertyId: params.contract.propertyId,
    maxPrice: params.contract.rentAmount,
  });

  const duplicateExists = params.existingContracts.some(
    (c) =>
      c.id !== params.contract.id &&
      buildRentalDedupFingerprint({
        customerPhone: c.tenantPhone,
        tenantId: c.tenantId,
        propertyId: c.propertyId,
        maxPrice: c.rentAmount,
      }) === fingerprint
  );

  return {
    ...summary,
    priorContractsCount: priorMatches.length,
    dedupFingerprint: fingerprint,
    dedupStatusAr: duplicateExists
      ? 'تنبيه تكرار محتمل لنفس العميل والوحدة والقيمة'
      : priorMatches.length > 0
      ? 'تجديد أو تعاقد متكرر مرتبط بسجل سابق'
      : 'سجل إيجار فريد',
  };
}
