export type QualificationTier =
  | 'qualified_ready_for_viewing'
  | 'needs_review_or_negotiation'
  | 'needs_realignment_or_alternatives';

export interface MatchingWeights {
  purposeAndType: number;
  location: number;
  priceOrRent: number;
  specs: number;
  priceTolerancePct: number;
  highThreshold: number;
  mediumThreshold: number;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  purposeAndType: 25,
  location: 25,
  priceOrRent: 30,
  specs: 20,
  priceTolerancePct: 15,
  highThreshold: 80,
  mediumThreshold: 50,
};

export interface PropertyCandidate {
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

export interface OpportunityRequirement {
  id: string;
  purpose: 'sale' | 'rent';
  propertyType?: string | null;
  city?: string | null;
  district?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  minRooms?: number | null;
  minAreaSqm?: number | null;
}

export interface MatchEvaluationResult {
  matchScore: number;
  qualificationTier: QualificationTier;
  qualificationLabelAr: string;
  matchedReasonsAr: string[];
  gapsAr: string[];
  needsConfirmationAr: string[];
}

export function evaluateOpportunityMatch(
  opp: OpportunityRequirement,
  prop: PropertyCandidate,
  weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS
): MatchEvaluationResult {
  const matchedReasonsAr: string[] = [];
  const gapsAr: string[] = [];
  const needsConfirmationAr: string[] = [];

  let score = 0;

  // 1) الغرض والنوع
  const purposeMatches = prop.purpose === 'both' || prop.purpose === opp.purpose;
  const typeMatches =
    opp.propertyType && prop.propertyType
      ? opp.propertyType.trim().toLowerCase() === prop.propertyType.trim().toLowerCase()
      : false;

  if (!opp.propertyType) {
    needsConfirmationAr.push('نوع العقار المطلوب يحتاج تأكيداً');
  }

  if (purposeMatches && typeMatches) {
    score += weights.purposeAndType;
    matchedReasonsAr.push('تطابق الغرض والنوع العقاري');
  } else if (purposeMatches) {
    score += weights.purposeAndType * 0.6;
    matchedReasonsAr.push('تطابق الغرض (بيع/إيجار)');
    if (opp.propertyType) gapsAr.push('اختلاف نوع العقار عن المطلوب');
  } else {
    gapsAr.push('عدم تطابق الغرض الأساسي (بيع/إيجار)');
  }

  // 2) الموقع (المدينة والحي)
  const cityMatch =
    opp.city && prop.city ? opp.city.trim().toLowerCase() === prop.city.trim().toLowerCase() : false;
  const districtMatch =
    opp.district && prop.district
      ? opp.district.trim().toLowerCase() === prop.district.trim().toLowerCase()
      : false;

  if (!opp.district) {
    needsConfirmationAr.push('الحي المفضل يحتاج تأكيداً');
  }

  if (cityMatch && districtMatch) {
    score += weights.location;
    matchedReasonsAr.push('تطابق المدينة والحي المطلوب');
  } else if (cityMatch) {
    score += weights.location * 0.5;
    matchedReasonsAr.push('تطابق المدينة');
    if (opp.district) gapsAr.push('خارج الحي المفضل');
  } else {
    gapsAr.push('عدم تطابق الموقع/المدينة');
  }

  // 3) السعر أو الإيجار مع هامش سماح مرن
  const asking = prop.askingPrice ?? null;
  const low = opp.minPrice ?? (opp.maxPrice ? opp.maxPrice * (1 - weights.priceTolerancePct / 100) : null);
  const high = opp.maxPrice ?? (opp.minPrice ? opp.minPrice * (1 + weights.priceTolerancePct / 100) : null);

  if (!asking || asking <= 0 || (low === null && high === null)) {
    needsConfirmationAr.push('السعر أو الميزانية تحتاج تأكيداً');
  } else {
    const effectiveLow = low ?? asking;
    const effectiveHigh = high ?? asking;
    const tol = weights.priceTolerancePct / 100;
    const flexLow = effectiveLow * (1 - tol);
    const flexHigh = effectiveHigh * (1 + tol);

    if (asking >= effectiveLow && asking <= effectiveHigh) {
      score += weights.priceOrRent;
      matchedReasonsAr.push('ضمن النطاق السعري/الإيجاري المطلوب');
    } else if (asking >= flexLow && asking <= flexHigh) {
      score += weights.priceOrRent * 0.7;
      matchedReasonsAr.push(`ضمن هامش السماح المرن (${weights.priceTolerancePct}%)`);
      gapsAr.push(asking > effectiveHigh ? 'أعلى من السقف السعري بقليل' : 'أقل من الحد الأدنى السعري بقليل');
    } else {
      gapsAr.push('خارج النطاق السعري وهامش السماح المرن');
    }
  }

  // 4) المواصفات الفنية والعملية
  let specChecks = 0;
  let specPassed = 0;
  if (opp.minRooms && opp.minRooms > 0) {
    specChecks += 1;
    if ((prop.rooms ?? 0) >= opp.minRooms) {
      specPassed += 1;
      matchedReasonsAr.push('تحقق عدد الغرف المطلوب');
    } else {
      gapsAr.push('عدد الغرف أقل من المطلوب');
    }
  } else {
    needsConfirmationAr.push('عدد الغرف المطلوب يحتاج تأكيداً');
  }

  if (opp.minAreaSqm && opp.minAreaSqm > 0) {
    specChecks += 1;
    if ((prop.areaSqm ?? 0) >= opp.minAreaSqm) {
      specPassed += 1;
      matchedReasonsAr.push('تحقق المساحة المطلوبة');
    } else {
      gapsAr.push('المساحة أقل من المطلوب');
    }
  } else {
    needsConfirmationAr.push('المساحة المطلوبة تحتاج تأكيداً');
  }

  if (specChecks > 0) {
    score += weights.specs * (specPassed / specChecks);
  }

  if (!prop.isAvailable) {
    gapsAr.push('العقار غير متاح حالياً');
  }

  const matchScore = Math.max(0, Math.min(100, Math.round(score * 100) / 100));

  let qualificationTier: QualificationTier;
  let qualificationLabelAr: string;
  if (matchScore >= weights.highThreshold) {
    qualificationTier = 'qualified_ready_for_viewing';
    qualificationLabelAr = 'مؤهلة بقوة / جاهزة للمعاينة';
  } else if (matchScore >= weights.mediumThreshold) {
    qualificationTier = 'needs_review_or_negotiation';
    qualificationLabelAr = 'تحتاج مراجعة / تفاوض';
  } else {
    qualificationTier = 'needs_realignment_or_alternatives';
    qualificationLabelAr = 'تحتاج إعادة ضبط المتطلبات أو بدائل';
  }

  return {
    matchScore,
    qualificationTier,
    qualificationLabelAr,
    matchedReasonsAr,
    gapsAr,
    needsConfirmationAr,
  };
}

// 2) قراءة وتحليل بيانات الهاتف (Hatif)
export interface HatifCallInput {
  id: string;
  direction?: string | null;
  status?: string | null;
  durationSeconds?: number | null;
  notesOrTranscript?: string | null;
  surveyScore?: number | null;
  calledAt: string;
  responseMinutes?: number | null;
}

export function formatHatifCallReadable(call: HatifCallInput) {
  const dir = (call.direction || '').toLowerCase();
  const directionLabelAr =
    dir === 'inbound' || dir === 'incoming'
      ? 'مكالمة واردة'
      : dir === 'outbound' || dir === 'outgoing'
      ? 'مكالمة صادرة'
      : 'غير محدد';

  const st = (call.status || '').toLowerCase();
  const statusLabelAr =
    st === 'answered' || st === 'completed'
      ? 'مجابة ومكتملة'
      : st === 'missed' || st === 'no_answer' || st === 'no-answer'
      ? 'فائتة / لم يُرد عليها'
      : st === 'busy'
      ? 'مشغول'
      : st === 'voicemail'
      ? 'بريد صوتي'
      : st === 'cancelled' || st === 'canceled' || st === 'failed'
      ? 'لم تكتمل / ملغاة'
      : 'غير محدد';

  const secs = Math.max(0, Math.floor(call.durationSeconds ?? 0));
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  const durationLabelAr =
    secs === 0
      ? 'أقل من دقيقة'
      : mins > 0 && rem > 0
      ? `${mins} د و ${rem} ث`
      : mins > 0
      ? `${mins} د`
      : `${rem} ث`;

  const text = `${call.notesOrTranscript ?? ''} ${call.surveyScore ?? ''}`.toLowerCase();
  let intentLabelAr = 'تحتاج متابعة وتقييم';
  if (
    (typeof call.surveyScore === 'number' && call.surveyScore >= 4) ||
    /معاينة|جاهز|جاد|عاجل|شراء|استئجار|ممتاز/.test(text)
  ) {
    intentLabelAr = 'نية عالية / جاهز للمتابعة';
  } else if (statusLabelAr.startsWith('فائتة')) {
    intentLabelAr = 'بانتظار معاودة الاتصال';
  } else if (/ملاحظة|استفسار|لاحقاً|تفاوض/.test(text)) {
    intentLabelAr = 'نية متوسطة / قيد النقاش';
  }

  const alertLabelAr =
    statusLabelAr.startsWith('فائتة') && (call.responseMinutes ?? 999) > 30
      ? 'متابعة عاجلة'
      : intentLabelAr.startsWith('نية عالية')
      ? 'نشط ومتفاعل'
      : 'متابعة اعتيادية';

  return {
    id: call.id,
    directionLabelAr,
    statusLabelAr,
    durationLabelAr,
    intentLabelAr,
    alertLabelAr,
    calledAt: call.calledAt,
  };
}

// 3) معالجة تكرار الإيجار ودورة الإيجار الدوري
export type BillingCycle = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export function computeRecurringRentalSummary(params: {
  startDateIso: string;
  endDateIso: string;
  billingCycle: BillingCycle;
  cycleAmount: number;
  referenceDateIso?: string;
  hasPriorTenantOrPropertyContract?: boolean;
}) {
  const cycleMap: Record<BillingCycle, { months: number; labelAr: string }> = {
    monthly: { months: 1, labelAr: 'شهري' },
    quarterly: { months: 3, labelAr: 'ربع سنوي' },
    semi_annual: { months: 6, labelAr: 'نصف سنوي' },
    annual: { months: 12, labelAr: 'سنوي' },
  };

  const info = cycleMap[params.billingCycle];
  const start = new Date(`${params.startDateIso}T00:00:00Z`);
  const end = new Date(`${params.endDateIso}T00:00:00Z`);
  const ref = new Date(`${(params.referenceDateIso ?? params.startDateIso)}T00:00:00Z`);

  const totalMonths = Math.max(
    1,
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth()) + 1
  );
  const installmentsCount = Math.max(1, Math.ceil(totalMonths / info.months));
  const totalContractAmount = Math.round(installmentsCount * params.cycleAmount * 100) / 100;

  let nextDueDateIso: string | null = null;
  for (let i = 0; i < installmentsCount; i++) {
    const due = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i * info.months, start.getUTCDate()));
    if (due <= end && due >= ref) {
      nextDueDateIso = due.toISOString().slice(0, 10);
      break;
    }
  }

  return {
    cycleLabelAr: info.labelAr,
    cycleMonths: info.months,
    installmentsCount,
    totalContractAmount,
    nextDueDateIso,
    isRepeatOrRenewal: Boolean(params.hasPriorTenantOrPropertyContract),
    renewalBadgeAr: params.hasPriorTenantOrPropertyContract ? 'عميل متكرر / تجديد إيجار' : 'عقد إيجار جديد',
  };
}
