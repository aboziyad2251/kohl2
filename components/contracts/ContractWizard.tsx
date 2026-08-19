'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  X,
  FileSignature,
  Building,
  User,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Calculator,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import {
  residentialContractSchema,
  commercialContractSchema,
  subleaseContractSchema,
} from '@/lib/validations';
import { ContractType, Property, Contract, Tenant } from '@/lib/types';
import AddTenantModal from '@/components/ownership/AddTenantModal';
import { UserPlus } from 'lucide-react';

interface ContractWizardProps {
  isOpen: boolean;
  onClose: () => void;
  properties: Property[];
  tenants?: Tenant[];
  onAddTenant?: (tenant: Tenant) => void;
  onSuccess: (newContract: Contract) => void;
}

export default function ContractWizard({
  isOpen,
  onClose,
  properties,
  tenants = [],
  onAddTenant,
  onSuccess,
}: ContractWizardProps) {
  const [contractType, setContractType] = useState<ContractType>('RESIDENTIAL');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAddTenantOpen, setIsAddTenantOpen] = useState<boolean>(false);

  // Active Schema depending on contract type
  const activeSchema =
    contractType === 'COMMERCIAL'
      ? commercialContractSchema
      : contractType === 'SUBLEASE'
      ? subleaseContractSchema
      : residentialContractSchema;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<any>({
    resolver: zodResolver(activeSchema),
    defaultValues: {
      payment_schedule: 'Quarterly',
      primary_lessor_consent: false,
    },
  });

  if (!isOpen) return null;

  const watchPropertyId = watch('property_id');
  const watchRentAmount = watch('rent_amount') || 0;
  const watchSchedule = watch('payment_schedule') || 'Quarterly';
  const watchStartDate = watch('start_date');
  const watchEndDate = watch('end_date');

  const selectedProperty = properties.find((p) => p.id === watchPropertyId);

  // Rent installment calculation helper
  const calculateInstallment = (amount: number, schedule: string) => {
    switch (schedule) {
      case 'Monthly':
        return amount / 12;
      case 'Quarterly':
        return amount / 4;
      case 'Semi-Annual':
        return amount / 2;
      case 'Annual':
      default:
        return amount;
    }
  };

  const installmentAmount = calculateInstallment(Number(watchRentAmount), watchSchedule);

  const onSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      const prop = properties.find((p) => p.id === data.property_id);
      const prefix =
        contractType === 'COMMERCIAL' ? 'CNT-COM' : contractType === 'SUBLEASE' ? 'CNT-SUB' : 'CNT-RES';

      const newContract: Contract = {
        id: `cnt-${Date.now()}`,
        contract_number: `${prefix}-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        type: contractType,
        property_id: data.property_id,
        lessor_id: prop?.lessor_id || '',
        tenant_name: data.tenant_name,
        tenant_national_id: data.tenant_national_id,
        rent_amount: Number(data.rent_amount),
        total_collected_amount: data.total_collected_amount ? Number(data.total_collected_amount) : Number(data.rent_amount),
        office_profit: data.office_profit ? Number(data.office_profit) : 0,
        security_deposit_amount: data.security_deposit_amount ? Number(data.security_deposit_amount) : undefined,
        lessor_requirements: data.lessor_requirements || undefined,
        payment_schedule: data.payment_schedule,
        start_date: data.start_date,
        end_date: data.end_date,
        status: 'Active',
        business_activity: data.business_activity,
        vat_number: data.vat_number,
        primary_lessor_consent: data.primary_lessor_consent,
        property: prop,
        lessor: prop?.lessor,
        created_at: new Date().toISOString(),
      };

      onSuccess(newContract);
      reset();
      setCurrentStep(1);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onInvalid = (formErrors: any) => {
    console.warn('ContractWizard Validation Errors:', formErrors);
    if (formErrors.property_id) {
      setCurrentStep(1);
    } else if (
      formErrors.tenant_name ||
      formErrors.tenant_national_id ||
      formErrors.business_activity ||
      formErrors.sublease_auth_number ||
      formErrors.primary_lessor_consent
    ) {
      setCurrentStep(2);
    } else {
      setCurrentStep(3);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <FileSignature className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">معالج إنشاء عقد إيجار جديد (إيجار)</h3>
              <p className="text-xs text-slate-400">إدخال بيانات العقد، المستأجر، وجدول الدفعات والتوثيق</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contract Type Selection Tabs */}
        <div className="px-6 pt-4 bg-slate-900 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setContractType('RESIDENTIAL');
                reset();
              }}
              className={`flex-1 py-2.5 px-3 rounded-t-xl text-xs font-bold transition flex items-center justify-center gap-2 border-t border-x ${
                contractType === 'RESIDENTIAL'
                  ? 'bg-slate-800 text-sky-400 border-sky-500/40 shadow-sm'
                  : 'bg-slate-900/50 text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Building className="w-4 h-4" />
              <span>عقد سكني (Residential)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContractType('COMMERCIAL');
                reset();
              }}
              className={`flex-1 py-2.5 px-3 rounded-t-xl text-xs font-bold transition flex items-center justify-center gap-2 border-t border-x ${
                contractType === 'COMMERCIAL'
                  ? 'bg-slate-800 text-amber-400 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900/50 text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>عقد تجاري (Commercial)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setContractType('SUBLEASE');
                reset();
              }}
              className={`flex-1 py-2.5 px-3 rounded-t-xl text-xs font-bold transition flex items-center justify-center gap-2 border-t border-x ${
                contractType === 'SUBLEASE'
                  ? 'bg-slate-800 text-purple-400 border-purple-500/40 shadow-sm'
                  : 'bg-slate-900/50 text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>عقد من الباطن (Sublease)</span>
            </button>
          </div>
        </div>

        {/* Wizard Steps Navigation Header */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between text-xs font-medium">
          <div
            className={`flex items-center gap-2 ${
              currentStep === 1 ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">
              1
            </span>
            <span>تحديد العقار</span>
          </div>
          <div className="h-0.5 w-8 bg-slate-800"></div>
          <div
            className={`flex items-center gap-2 ${
              currentStep === 2 ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">
              2
            </span>
            <span>بيانات المستأجر</span>
          </div>
          <div className="h-0.5 w-8 bg-slate-800"></div>
          <div
            className={`flex items-center gap-2 ${
              currentStep === 3 ? 'text-sky-400 font-bold' : 'text-slate-400'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px]">
              3
            </span>
            <span>المالية والملخص</span>
          </div>
        </div>

        {/* Wizard Form Body */}
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="p-6 space-y-6">
          {/* STEP 1: PROPERTY PICKER */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-sky-400" />
                الخطوة 1: اختيار العقار المرتبط والمؤجر (مستلم الإيجار)
              </h4>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">اختر العقار المسجل بالمنظومة *</label>
                <select
                  {...register('property_id')}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                >
                  <option value="">-- اختر العقار --</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.city}) - المالك: {p.lessor?.name || 'غير محدد'}
                    </option>
                  ))}
                </select>
                {errors.property_id && (
                  <p className="text-[11px] text-red-400 mt-1">{errors.property_id.message as string}</p>
                )}
              </div>

              {selectedProperty && (
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2 text-xs">
                  <div className="text-slate-400 font-bold">تفاصيل صك وسلطة العقار المعتمد:</div>
                  <div className="flex justify-between text-slate-300">
                    <span>المالك المسجل:</span>
                    <span className="font-semibold text-white">{selectedProperty.lessor?.name || 'صاحب الصك'}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>العنوان والمدينة:</span>
                    <span className="font-semibold text-white">{selectedProperty.address} - {selectedProperty.city}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: TENANT & TERMS */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-sky-400" />
                الخطوة 2: إدخال أو اختيار بيانات المستأجر
              </h4>

              {/* Pre-fill from Registered Tenants */}
              {tenants.length > 0 && (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs text-purple-300 font-bold">
                    <span className="flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-purple-400" />
                      اختيار مستأجر مسجل سابقاً في المنظومة:
                    </span>
                    {onAddTenant && (
                      <button
                        type="button"
                        onClick={() => setIsAddTenantOpen(true)}
                        className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold transition"
                      >
                        + إضافة مستأجر جديد
                      </button>
                    )}
                  </div>
                  <select
                    onChange={(e) => {
                      const tenantId = e.target.value;
                      const found = tenants.find((t) => t.id === tenantId);
                      if (found) {
                        setValue('tenant_name', found.name);
                        setValue('tenant_national_id', found.national_id);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="">-- اختر مستأجر مسجل للتعبئة التلقائية --</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.type === 'Company' ? 'شركة' : 'فرد'}) - هوية: {t.national_id} - جوال: {t.phone}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">يمكنك التحديد من القائمة أو كتابة بيانات مستأجر جديد مباشرة أدناه.</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">اسم المستأجر (أفراد أو شركة) *</label>
                  <input
                    type="text"
                    placeholder="الاسم الثلاثي أو اسم المنشأة"
                    {...register('tenant_name')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                  {errors.tenant_name && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.tenant_name.message as string}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">الهوية الوطنية / السجل التجاري *</label>
                  <input
                    type="text"
                    placeholder="10 أرقام للهوية أو السجل"
                    {...register('tenant_national_id')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
                  />
                  {errors.tenant_national_id && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.tenant_national_id.message as string}</p>
                  )}
                </div>
              </div>

              {/* Commercial Specific Fields */}
              {contractType === 'COMMERCIAL' && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-4">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>بيانات الشروط التجارية والرخصة</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">نوع النشاط التجاري *</label>
                      <input
                        type="text"
                        placeholder="مثال: مطعم / مكاتب استشارية"
                        {...register('business_activity')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                      {errors.business_activity && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.business_activity.message as string}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">الرقم الضريبي VAT (15 رقم)</label>
                      <input
                        type="text"
                        placeholder="310123456700003"
                        {...register('vat_number')}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      />
                      {errors.vat_number && (
                        <p className="text-[11px] text-red-400 mt-1">{errors.vat_number.message as string}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sublease Specific Fields */}
              {contractType === 'SUBLEASE' && (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-4">
                  <div className="text-xs font-bold text-purple-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>التحقق من موافقة وتفويض الإيجار من الباطن</span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">رقم تفويض المؤجر الرئيسي *</label>
                    <input
                      type="text"
                      placeholder="مثال: AUTH-SUB-8822"
                      {...register('sublease_auth_number')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none"
                    />
                    {errors.sublease_auth_number && (
                      <p className="text-[11px] text-red-400 mt-1">{errors.sublease_auth_number.message as string}</p>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-xs text-purple-200 font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('primary_lessor_consent')}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                    />
                    <span>أؤكد الحصول على موافقة خطية موثقة من المؤجر الرئيسي لإعادة التأجير من الباطن *</span>
                  </label>
                  {errors.primary_lessor_consent && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.primary_lessor_consent.message as string}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: FINANCIALS & SUMMARY */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-sky-400" />
                الخطوة 3: تحديد القيمة المالية وجدول الدفعات وملخص العقد
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">مبلغ الإيجار السنوي (ر.س) *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="أدخل مبلغ الإيجار (مثال: 60000)"
                    {...register('rent_amount', { valueAsNumber: true })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                  {errors.rent_amount && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.rent_amount.message as string}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">جدول ودورية الدفعات *</label>
                  <select
                    {...register('payment_schedule')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  >
                    <option value="Monthly">شهري (12 دفعة)</option>
                    <option value="Quarterly">ربع سنوي (4 دفعات)</option>
                    <option value="Semi-Annual">نصف سنوي (دفعتان)</option>
                    <option value="Annual">سنوي (دفعة واحدة)</option>
                  </select>
                </div>
              </div>

              {/* Office Profit & Total Collected Fields */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-3">
                <div className="text-xs font-bold text-emerald-400 flex items-center justify-between">
                  <span>💰 تخصيص ربح المكتب والمستقطع الإجمالي:</span>
                  <span className="text-[10px] text-emerald-300">يحتسب الربح مباشرة في الأرباح اليومية (أي مبلغ مقبول)</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">المستقطع الإجمالي (ر.س)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="إجمالي المستقطع من المستأجر (أي مبلغ)"
                      {...register('total_collected_amount', { valueAsNumber: true })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">يُحسب كـ تحصيل للمالك ولا يدخل في أرباح المكتب المباشرة.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-amber-300 mb-1">ربح المكتب من عقد الإيجار (ر.س) - يقبل أي مبلغ *</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="عمولة / صافي ربح المكتب (أدخل أي مبلغ)"
                      {...register('office_profit', { valueAsNumber: true })}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-amber-200 font-bold focus:border-amber-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-amber-400/80 mt-1">ينحسب مباشرة في الأرباح اليومية والإيرادات الفعلية للمكتب.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">مبلغ التأمين المسترد (إن وجد) ر.س</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="أي مبلغ تأمين (مثال: 175 أو 2000)"
                      {...register('security_deposit_amount', { valueAsNumber: true })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">طلب أو شروط خاصة من المؤجر</label>
                    <input
                      type="text"
                      placeholder="مثال: يمنع استخدام الباطن، دفع الفواتير أول بأول..."
                      {...register('lessor_requirements')}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ بداية العقد *</label>
                  <input
                    type="date"
                    {...register('start_date')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                  {errors.start_date && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.start_date.message as string}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">تاريخ نهاية العقد *</label>
                  <input
                    type="date"
                    {...register('end_date')}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:border-sky-500 focus:outline-none"
                  />
                  {errors.end_date && (
                    <p className="text-[11px] text-red-400 mt-1">{errors.end_date.message as string}</p>
                  )}
                </div>
              </div>

              {/* Live Contract Summary Card */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-sky-500/30 space-y-3">
                <div className="text-xs font-bold text-sky-400 border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span>ملخص العقد والدفعات التلقائي:</span>
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px]">
                    نوع العقد: {contractType}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">مبلغ القسط الواجب:</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {installmentAmount ? installmentAmount.toLocaleString('ar-SA') : 0} ر.س / قسط
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">العقار المختاري:</span>
                    <span className="text-white font-medium">{selectedProperty?.title || 'لم يُحدد'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">المؤجر المسجل:</span>
                    <span className="text-white font-medium">{selectedProperty?.lessor?.name || 'لم يُحدد'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation & Submit Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1.5"
              >
                <ChevronRight className="w-4 h-4" />
                <span>الخطوة السابقة</span>
              </button>
            ) : (
              <div></div>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
              >
                <span>الخطوة التالية</span>
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري توثيق العقد...' : 'إنشاء وتوثيق العقد'}</span>
              </button>
            )}
          </div>
        </form>
      </div>

      <AddTenantModal
        isOpen={isAddTenantOpen}
        onClose={() => setIsAddTenantOpen(false)}
        onSuccess={(newTenant) => {
          if (onAddTenant) onAddTenant(newTenant);
          setValue('tenant_name', newTenant.name);
          setValue('tenant_national_id', newTenant.national_id);
        }}
      />
    </div>
  );
}
