// Data Store for standalone HTML site with localStorage persistence
const todayStr = new Date().toISOString().split('T')[0];

const DEFAULT_DATA = {
  properties: [
    {
      id: 'prop-1',
      title: 'برج الملقا التجاري',
      property_type: 'Commercial',
      address: 'طريق الملك فهد، حي الملقا',
      city: 'الرياض',
      units_count: 24,
      lessor_name: 'الشيخ محمد العتيبي',
      representative_name: 'م. طارق الغامدي',
      deed_number: '98231-2024-DEED'
    },
    {
      id: 'prop-2',
      title: 'مجمع العليا السكني',
      property_type: 'Residential',
      address: 'شارع العليا العام',
      city: 'الرياض',
      units_count: 16,
      lessor_name: 'مجموعة الرياض القابضة للعقارات',
      representative_name: 'سلطان الحربي',
      deed_number: '44109-2023-DEED'
    },
    {
      id: 'prop-3',
      title: 'مركز الأفق للأعمال',
      property_type: 'Commercial',
      address: 'طريق التخصصي، حي النخيل',
      city: 'الرياض',
      units_count: 12,
      lessor_name: 'شركة الأفق للاستثمار العقاري',
      representative_name: 'عبدالمجيد الدوسري',
      deed_number: '55210-2024-DEED'
    }
  ],

  contracts: [
    {
      id: 'cnt-1',
      contract_number: 'CNT-RES-2024-001',
      type: 'RESIDENTIAL',
      property_title: 'مجمع العليا السكني',
      tenant_name: 'فهد الزهراني',
      tenant_national_id: '1099887766',
      rent_amount: 65000,
      total_collected_amount: 65000,
      office_profit: 3250,
      payment_schedule: 'نصف سنوي (دفعتان)',
      start_date: '2024-03-01',
      end_date: '2025-02-28',
      status: 'Active'
    },
    {
      id: 'cnt-2',
      contract_number: 'CNT-COM-2024-089',
      type: 'COMMERCIAL',
      property_title: 'برج الملقا التجاري',
      tenant_name: 'شركة الحلول التقنية المتقدمة',
      tenant_national_id: '7009876543',
      rent_amount: 240000,
      total_collected_amount: 240000,
      office_profit: 12000,
      payment_schedule: 'ربع سنوي (4 دفعات)',
      start_date: '2024-01-01',
      end_date: '2027-12-31',
      status: 'Active',
      business_activity: 'استشارات وتقنية المعلومات',
      vat_number: '310192837400003'
    },
    {
      id: 'cnt-3',
      contract_number: 'CNT-SUB-2024-015',
      type: 'SUBLEASE',
      property_title: 'مركز الأفق للأعمال',
      tenant_name: 'مؤسسة الابتكار الرقمي',
      tenant_national_id: '7011223344',
      rent_amount: 95000,
      total_collected_amount: 95000,
      office_profit: 4750,
      payment_schedule: 'ربع سنوي (4 دفعات)',
      start_date: '2024-04-01',
      end_date: '2025-03-31',
      status: 'Active'
    }
  ],

  customerOrders: [
    {
      id: 'ord-1',
      order_number: 'ORD-2026-001',
      client_name: 'أحمد بن عبد العزيز السلمان',
      client_phone: '0501122334',
      category: 'RESIDENTIAL',
      building_type: 'فيلا مودرن مستقلة',
      desired_area: 'حي الملقا أو الياسمين - مساحة 350-450 م²',
      budget_min: 2500000,
      budget_max: 3200000,
      status: 'Searching',
      notes: 'يفضل وجود مسبح ومصعد وتكييف مخفي، قريبة من طرق رئيسية.',
      created_at: todayStr
    },
    {
      id: 'ord-2',
      order_number: 'ORD-2026-002',
      client_name: 'شركة الاستشارات الرقمية',
      client_phone: '0559988776',
      category: 'COMMERCIAL',
      building_type: 'مكتب تجاري فاخر',
      desired_area: 'طريق الملك فهد / حي العليا - مساحة 200-300 م²',
      budget_min: 150000,
      budget_max: 220000,
      status: 'New',
      notes: 'مكتب مفتوح للإيجار السنوي، يفضل أن يكون في برج مجهز بالمواقف والحراسة.',
      created_at: todayStr
    },
    {
      id: 'ord-3',
      order_number: 'ORD-2026-003',
      client_name: 'د. سارة الشهري',
      client_phone: '0544332211',
      category: 'RESIDENTIAL',
      building_type: 'شقة فاخرة (4 غرف)',
      desired_area: 'حي النرجس أو حطين - مساحة 180 م²',
      budget_min: 70000,
      budget_max: 90000,
      status: 'Fulfilled',
      notes: 'عقد إيجار سنوي عائلي، تم توفير الشقة في مجمع حطين.',
      created_at: '2026-08-14'
    }
  ],

  managedProperties: [
    {
      id: 'pmc-1',
      contract_number: 'PMC-2026-001',
      property_name: 'عمارة النخيل السكنية',
      lessor_name: 'عبد العزيز بن محمد الراجحي',
      lessor_phone: '0501122334',
      property_type: 'Residential',
      total_units: 12,
      occupied_units: 10,
      vacant_units: 2,
      fee_type: 'PERCENTAGE',
      fee_value: 5.0,
      annual_expected_revenue: 480000,
      collected_revenue: 360000,
      transferred_to_owner: 342000,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'Active',
      notes: 'عمارة سكنية 4 أدوار بـ 12 شقة فاخرة، عقد تشغيل وإدارة أملاك كامل شامل التحصيل.'
    },
    {
      id: 'pmc-2',
      contract_number: 'PMC-2026-002',
      property_name: 'مجمع الأمل التجاري',
      lessor_name: 'شركة الأفق العقارية الاستثمارية',
      lessor_phone: '0559988776',
      property_type: 'Commercial',
      total_units: 8,
      occupied_units: 7,
      vacant_units: 1,
      fee_type: 'PERCENTAGE',
      fee_value: 7.5,
      annual_expected_revenue: 720000,
      collected_revenue: 540000,
      transferred_to_owner: 499500,
      start_date: '2025-06-01',
      end_date: '2027-05-31',
      status: 'Active',
      notes: 'مجمع معارض ومكاتب تجارية على شارع رئيسي.'
    },
    {
      id: 'pmc-3',
      contract_number: 'PMC-2026-003',
      property_name: 'برج الفلاح الإداري',
      lessor_name: 'سليمان بن عبد الله القحطاني',
      lessor_phone: '0544332211',
      property_type: 'Mixed',
      total_units: 20,
      occupied_units: 18,
      vacant_units: 2,
      fee_type: 'FIXED_ANNUAL',
      fee_value: 25000,
      annual_expected_revenue: 1200000,
      collected_revenue: 900000,
      transferred_to_owner: 875000,
      start_date: '2026-01-15',
      end_date: '2027-01-14',
      status: 'Active',
      notes: 'إدارة أملاك برج إداري وسكني شامل الحراسة والنظافة وصيانة المصاعد.'
    }
  ],

  maintenanceTasks: [
    {
      id: 'mnt-1',
      task_number: 'MNT-2026-101',
      property_name: 'عمارة النخيل السكنية',
      unit_name: 'شقة 203',
      maintenance_type: 'سباكة وتغيير محابس',
      cost_amount: 450,
      contractor_name: 'مؤسسة الشعلة للصيانة',
      contractor_phone: '0509876543',
      status: 'Completed',
      notes: 'تم إصلاح تسريب المياه في الحمام الرئيسي وتشغيل المضخة.'
    },
    {
      id: 'mnt-2',
      task_number: 'MNT-2026-102',
      property_name: 'مجمع الأمل التجاري',
      unit_name: 'معرض 02',
      maintenance_type: 'صيانة وتكييف مركزي',
      cost_amount: 1800,
      contractor_name: 'شركة التكييف العربي',
      contractor_phone: '0551234567',
      status: 'In_Progress',
      notes: 'تغيير الفلاتر وتعبئة الفريون للوحدات المروحية.'
    },
    {
      id: 'mnt-3',
      task_number: 'MNT-2026-103',
      property_name: 'برج الفلاح الإداري',
      unit_name: 'مصعد رقم 1',
      maintenance_type: 'صيانة دورية للمصاعد',
      cost_amount: 1200,
      contractor_name: 'شركة أوتيس للمصاعد',
      contractor_phone: '0547766554',
      status: 'Completed',
      notes: 'الفحص الفني الدوري واختبار كوابل الأمان.'
    }
  ],

  brokerageAgreements: [
    {
      id: 'brk-1',
      agreement_number: 'EJAR-BRK-2024-012',
      property_title: 'برج الملقا التجاري',
      lessor_name: 'الشيخ محمد العتيبي',
      commission_rate: 2.5,
      office_profit: 6000,
      start_date: '2024-01-01',
      expiry_date: '2026-12-31',
      ejar_status: 'Active'
    },
    {
      id: 'brk-2',
      agreement_number: 'EJAR-BRK-2024-044',
      property_title: 'مركز الأفق للأعمال',
      lessor_name: 'شركة الأفق للاستثمار العقاري',
      commission_rate: 2.5,
      office_profit: 2375,
      start_date: '2024-04-01',
      expiry_date: '2026-03-31',
      ejar_status: 'Active'
    }
  ],

  transactions: [
    {
      id: 'tx-1',
      transaction_date: todayStr,
      flow_type: 'INCOME',
      transaction_type: 'BROKERAGE_COMMISSION',
      label: 'عمولة وساطة تأجير مكتب تجاري برج الملقا',
      source: 'وساطة #EJAR-BRK-2024-012',
      gross_amount: 15000,
      tax_vat_amount: 2250,
      net_amount: 12750
    },
    {
      id: 'tx-2',
      transaction_date: todayStr,
      flow_type: 'INCOME',
      transaction_type: 'RENTAL_PAYMENT',
      label: 'تحصيل الدفعة الإيجارية النصف سنوية - مجمع العليا السكني',
      source: 'عقد #CNT-RES-2024-001 (فهد الزهراني)',
      gross_amount: 32500,
      tax_vat_amount: 0,
      net_amount: 32500
    },
    {
      id: 'tx-3',
      transaction_date: todayStr,
      flow_type: 'EXPENSE',
      transaction_type: 'OPERATING_EXPENSE',
      label: 'صيانة وتحديث المصاعد الدورية - برج الملقا التجاري',
      source: 'أمر صيانة #MNT-2026-103',
      gross_amount: 4500,
      tax_vat_amount: 675,
      net_amount: 5175
    },
    {
      id: 'tx-4',
      transaction_date: todayStr,
      flow_type: 'INCOME',
      transaction_type: 'DOCUMENT_FEE',
      label: 'رسوم توثيق وتجديد العقد عبر منصة إيجار',
      source: 'عقد #CNT-RES-2024-001',
      gross_amount: 2500,
      tax_vat_amount: 375,
      net_amount: 2125
    }
  ],

  generalServices: [
    {
      id: 'srv-1',
      service_number: 'GS-2026-101',
      client_name: 'أحمد بن عبد الله المطيري',
      client_phone: '0501234567',
      category: 'منصة إيجار',
      title: 'توثيق عقد إيجار موحد عبر منصة إيجار',
      fee_amount: 350,
      cost_amount: 125,
      office_profit: 225,
      status: 'Completed'
    },
    {
      id: 'srv-2',
      service_number: 'GS-2026-102',
      client_name: 'مؤسسة البناء الحديث للتجارة',
      client_phone: '0559876543',
      category: 'منصة بلدي',
      title: 'إصدار رخصة بلدي ومعاينة محل تجاري',
      fee_amount: 1200,
      cost_amount: 500,
      office_profit: 700,
      status: 'In_Progress'
    },
    {
      id: 'srv-3',
      service_number: 'GS-2026-103',
      client_name: 'سليمان بن خالد الدوسري',
      client_phone: '0543210987',
      category: 'صكوك ورفع مساحي',
      title: 'رفع مساحي وتحديث صك عقاري ألكترونياً',
      fee_amount: 850,
      cost_amount: 300,
      office_profit: 550,
      status: 'Completed'
    }
  ],

  lessors: [
    { id: 'les-1', name: 'الشيخ محمد العتيبي', national_id_or_cr: '1010293847', phone: '0501234567', email: 'alotaibi@realestate.sa', properties_count: 1 },
    { id: 'les-2', name: 'مجموعة الرياض القابضة للعقارات', national_id_or_cr: '7001928374', phone: '0114567890', email: 'info@riyadhholding.sa', properties_count: 1 },
    { id: 'les-3', name: 'شركة الأفق للاستثمار العقاري', national_id_or_cr: '7005544332', phone: '0551122334', email: 'contact@alofoq.sa', properties_count: 1 }
  ],

  tenants: [
    { id: 'tnt-1', name: 'فهد الزهراني', national_id: '1099887766', phone: '0512345678', email: 'fahad@zahrani.sa', type: 'فرد' },
    { id: 'tnt-2', name: 'شركة الحلول التقنية المتقدمة', national_id: '7009876543', phone: '0112233445', email: 'contact@techsolutions.sa', type: 'منشأة / شركة' },
    { id: 'tnt-3', name: 'د. خالد الدوسري', national_id: '1022334455', phone: '0554433221', email: 'aldosari@med.sa', type: 'فرد' }
  ],

  representatives: [
    { id: 'rep-1', name: 'م. طارق الغامدي', national_id: '1088776655', phone: '0559876543', e_poa_number: 'POA-998822', status: 'نشط' },
    { id: 'rep-2', name: 'سلطان الحربي', national_id: '1077665544', phone: '0543210987', e_poa_number: 'POA-774411', status: 'نشط' },
    { id: 'rep-3', name: 'عبدالمجيد الدوسري', national_id: '1066554433', phone: '0567788990', e_poa_number: 'POA-332211', status: 'نشط' }
  ],

  ePoas: [
    {
      id: 'poa-1',
      poa_number: 'EPOA-2024-8891',
      grantor_name: 'الشيخ محمد العتيبي',
      attorney_name: 'م. طارق الغامدي',
      expiry_date: '2026-12-31',
      scope: 'تفويض كامل بإبرام وتوثيق عقود الإيجار التجارية عبر منصة إيجار وتمثيل المؤجر لدى الجهات.',
      status: 'Active'
    },
    {
      id: 'poa-2',
      poa_number: 'EPOA-2023-4412',
      grantor_name: 'مجموعة الرياض القابضة للعقارات',
      attorney_name: 'سلطان الحربي',
      expiry_date: '2025-05-31',
      scope: 'إدارة وتأجير مجمع العليا السكني وتوقيع عقود الصيانة والإيجار السكني.',
      status: 'Active'
    }
  ],

  auditLogs: [
    {
      id: 'aud-1',
      title: 'تسجيل الملكية الأولية لبرج الملقا التجاري',
      change_type: 'نقل ملكية عقار',
      notes: 'تسجيل الملكية الأولية لبرج الملقا التجاري باسم الشيخ محمد العتيبي وتعيين م. طارق مُمثلاً.',
      date: '2024-01-16'
    },
    {
      id: 'aud-2',
      title: 'تغيير وكيل مجمع العليا السكني',
      change_type: 'تغيير وكيل العقار',
      notes: 'تم اعتماد الوكالة الإلكترونية وتعيين الأستاذ سلطان الحربي ممثلاً رسمياً للمجمع.',
      date: '2024-02-01'
    }
  ]
};

// Initialize / Load from LocalStorage
function getAppStore() {
  const local = localStorage.getItem('kohl_real_estate_data');
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error(e);
    }
  }
  return DEFAULT_DATA;
}

function saveAppStore(data) {
  localStorage.setItem('kohl_real_estate_data', JSON.stringify(data));
}
