import { z } from 'zod';

// Helper preprocessor for optional numeric inputs to prevent NaN validation crashes
const optionalNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined || Number.isNaN(val) ? undefined : Number(val)),
  z.number().optional()
);

const requiredPositiveNumber = z.preprocess(
  (val) => (val === '' || val === null || val === undefined || Number.isNaN(val) ? 0 : Number(val)),
  z.number({ invalid_type_error: 'يرجى إدخال مبلغ صحيح' }).positive('المبلغ يجب أن يكون أكبر من 0')
);

// 1. عقد سكني (Residential Contract Schema)
export const residentialContractSchema = z.object({
  property_id: z.string().min(1, 'يرجى اختيار العقار'),
  tenant_name: z.string().min(3, 'اسم المستأجر يجب أن لا يقل عن 3 حروف'),
  tenant_national_id: z.string().regex(/^\d{10}$/, 'رقم الهوية / الإقامة يجب أن يتكون من 10 أرقام'),
  rent_amount: requiredPositiveNumber,
  total_collected_amount: optionalNumber,
  office_profit: optionalNumber,
  security_deposit_amount: optionalNumber,
  lessor_requirements: z.string().optional(),
  payment_schedule: z.enum(['Monthly', 'Quarterly', 'Semi-Annual', 'Annual'], {
    errorMap: () => ({ message: 'يرجى اختيار جدول الدفعات' }),
  }),
  start_date: z.string().min(1, 'يرجى تحديد تاريخ بداية العقد'),
  end_date: z.string().min(1, 'يرجى تحديد تاريخ نهاية العقد'),
});

// 2. عقد تجاري (Commercial Contract Schema)
export const commercialContractSchema = residentialContractSchema.extend({
  business_activity: z.string().min(2, 'يرجى تحديد نوع النشاط التجاري'),
  vat_number: z.string().optional().or(z.literal('')),
});

// 3. عقد إيجار من الباطن (Sublease Contract Schema)
export const subleaseContractSchema = residentialContractSchema.extend({
  primary_lessor_consent: z.boolean().refine((val) => val === true, {
    message: 'يجب تأكيد موافقة المؤجر الرئيسي قبل إنشاء عقد من الباطن',
  }),
  sublease_auth_number: z.string().min(3, 'يرجى إدخال رقم تفويض الإيجار من الباطن'),
});

// 4. تسجيل صك ملكية وعقار جديد (Ownership Document & Property Combined Schema)
export const ownershipDocumentPropertySchema = z.object({
  // بيانات صك الملكية
  document_number: z.string().min(3, 'رقم صك الملكية مطلوب'),
  issue_date: z.string().min(1, 'تاريخ إصدار الصك مطلوب'),
  lessor_id: z.string().min(1, 'يرجى اختيار المؤجر / مالك الصك'),
  file_url: z.string().optional(),

  // بيانات العقار
  property_title: z.string().min(3, 'اسم/عنوان العقار مطلوب'),
  property_type: z.enum(['Residential', 'Commercial', 'Land'], {
    errorMap: () => ({ message: 'نوع العقار مطلوب' }),
  }),
  address: z.string().min(5, 'تفاصيل العنوان مطلوبة'),
  city: z.string().min(2, 'المدينة مطلوبة'),
  units_count: z.number().int().min(1, 'عدد الوحدات يجب أن يكون 1 على الأقل'),
  current_representative_id: z.string().optional(),
});

// 5. تغيير وكيل/ممثل العقار (Change Representative Schema)
export const changeRepresentativeSchema = z.object({
  property_id: z.string().min(1, 'يرجى اختيار العقار'),
  new_representative_id: z.string().min(1, 'يرجى اختيار الممثل/الوكيل الجديد'),
  notes: z.string().optional(),
});

// 6. تغيير المؤجر/نقل الملكية (Change Lessor Schema)
export const changeLessorSchema = z.object({
  property_id: z.string().min(1, 'يرجى اختيار العقار'),
  new_lessor_id: z.string().min(1, 'يرجى اختيار المالك/المؤجر الجديد'),
  new_ownership_document_number: z.string().min(3, 'رقم صك الملكية الجديد مطلوب'),
  notes: z.string().optional(),
});

// 7. اتفاقية وساطة إيجار جديدة (Brokerage Agreement Schema)
export const brokerageAgreementSchema = z.object({
  property_id: z.string().min(1, 'يرجى اختيار العقار'),
  commission_rate: z.number().min(0, 'نسبة السعي لا تقل عن 0%').max(100, 'نسبة السعي لا تزيد عن 100%'),
  office_profit: z.number({ invalid_type_error: 'يرجى إدخال ربح المكتب' }).optional(),
  start_date: z.string().min(1, 'تاريخ بداية الاتفاقية مطلوب'),
  expiry_date: z.string().min(1, 'تاريخ انتهاء الاتفاقية مطلوب'),
  file_url: z.string().optional(),
});

// 8. إضافة مؤجر جديد (Lessor Form Schema)
export const lessorFormSchema = z.object({
  name: z.string().min(3, 'الاسم الكامل مطلوب'),
  national_id_or_cr: z.string().min(10, 'الهوية الوطنية (10 أرقام) أو السجل التجاري (10 أرقام)'),
  phone: z.string().regex(/^(05|\+9665)\d{8}$/, 'يرجى كتابة رقم جوال سعودي صحيح (مثال: 0501234567)'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
});

// 9. إضافة ممثل/وكيل جديد (Representative Form Schema)
export const representativeFormSchema = z.object({
  name: z.string().min(3, 'اسم الوكيل مطلوب'),
  national_id: z.string().regex(/^\d{10}$/, 'رقم الهوية الوطنية يجب أن يتكون من 10 أرقام'),
  phone: z.string().regex(/^(05|\+9665)\d{8}$/, 'رقم الجوال غير صحيح'),
  email: z.string().email('البريد الإلكتروني غير صحيح').optional().or(z.literal('')),
  e_poa_number: z.string().optional(),
});

// 10. طلب عميل / طلب عقار جديد (Customer Order Schema)
export const customerOrderSchema = z.object({
  client_name: z.string().min(3, 'اسم العميل مطلوب ولا يقل عن 3 حروف'),
  client_phone: z.string().regex(/^(05|\+9665)\d{8}$/, 'يرجى كتابة رقم جوال سعودي صحيح (مثال: 0501234567)'),
  category: z.enum(['RESIDENTIAL', 'COMMERCIAL'], {
    errorMap: () => ({ message: 'يرجى اختيار تصنيف الطلب (سكني أو تجاري)' }),
  }),
  building_type: z.string().min(2, 'نوع العقار المطلوب مطلوب (مثال: فيلا، شقة، مكتب، معرض...)'),
  desired_area: z.string().min(3, 'الحي والمنطقة والمساحة مطلوبة (مثال: حي الملقا - 350 م²)'),
  budget_min: optionalNumber,
  budget_max: optionalNumber,
  status: z.enum(['New', 'Searching', 'Fulfilled', 'Cancelled'], {
    errorMap: () => ({ message: 'يرجى تحديد حالة الطلب' }),
  }),
  notes: z.string().optional(),
});

export type ResidentialContractInput = z.infer<typeof residentialContractSchema>;
export type CommercialContractInput = z.infer<typeof commercialContractSchema>;
export type SubleaseContractInput = z.infer<typeof subleaseContractSchema>;
export type OwnershipDocumentPropertyInput = z.infer<typeof ownershipDocumentPropertySchema>;
export type ChangeRepresentativeInput = z.infer<typeof changeRepresentativeSchema>;
export type ChangeLessorInput = z.infer<typeof changeLessorSchema>;
export type BrokerageAgreementInput = z.infer<typeof brokerageAgreementSchema>;
export type LessorFormInput = z.infer<typeof lessorFormSchema>;
export type RepresentativeFormInput = z.infer<typeof representativeFormSchema>;
export type CustomerOrderInput = z.infer<typeof customerOrderSchema>;
