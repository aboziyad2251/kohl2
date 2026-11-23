'use client';

import React from 'react';
import type { MatchEvaluationResult } from '../../lib/upgrades/kohlEnhancements';

interface EnhancementsSummaryCardProps {
  match?: MatchEvaluationResult | null;
  hatifSummary?: {
    directionLabelAr: string;
    statusLabelAr: string;
    durationLabelAr: string;
    intentLabelAr: string;
    alertLabelAr: string;
  } | null;
  rentalSummary?: {
    cycleLabelAr: string;
    installmentsCount: number;
    totalContractAmount: number;
    nextDueDateIso: string | null;
    renewalBadgeAr: string;
  } | null;
}

export default function EnhancementsSummaryCard({
  match,
  hatifSummary,
  rentalSummary,
}: EnhancementsSummaryCardProps) {
  return (
    <div dir="rtl" className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right my-4">
      {match && (
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">نسبة التطابق وتأهيل الفرصة</span>
            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              {match.matchScore}%
            </span>
          </div>
          <div className="text-sm font-bold text-stone-800">{match.qualificationLabelAr}</div>
          {match.matchedReasonsAr.length > 0 && (
            <div className="text-xs text-emerald-700">
              نقاط التوافق: {match.matchedReasonsAr.join(' • ')}
            </div>
          )}
          {match.gapsAr.length > 0 && (
            <div className="text-xs text-amber-700">
              الفجوات: {match.gapsAr.join(' • ')}
            </div>
          )}
          {match.needsConfirmationAr.length > 0 && (
            <div className="text-xs text-sky-700">
              تحتاج تأكيداً: {match.needsConfirmationAr.join(' • ')}
            </div>
          )}
        </div>
      )}

      {hatifSummary && (
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">تحليل نشاط الهاتف</span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
              {hatifSummary.alertLabelAr}
            </span>
          </div>
          <div className="text-sm font-bold text-stone-800">
            {hatifSummary.directionLabelAr} — {hatifSummary.statusLabelAr}
          </div>
          <div className="text-xs text-stone-600">المدة: {hatifSummary.durationLabelAr}</div>
          <div className="text-xs text-sky-700">المؤشر: {hatifSummary.intentLabelAr}</div>
        </div>
      )}

      {rentalSummary && (
        <div className="p-4 rounded-2xl bg-white border border-stone-200/80 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-stone-500">دورة وتكرار الإيجار</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              {rentalSummary.renewalBadgeAr}
            </span>
          </div>
          <div className="text-sm font-bold text-stone-800">
            نظام الدفع: {rentalSummary.cycleLabelAr} ({rentalSummary.installmentsCount} دفعات)
          </div>
          <div className="text-xs font-semibold text-emerald-700">
            الإجمالي: {rentalSummary.totalContractAmount.toLocaleString('ar-SA')} ر.س
          </div>
          <div className="text-xs text-stone-600">
            الدفعة القادمة: {rentalSummary.nextDueDateIso ?? 'لا توجد دفعات قادمة'}
          </div>
        </div>
      )}
    </div>
  );
}
