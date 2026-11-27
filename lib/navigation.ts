export const navGroups = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'customers', label: 'العملاء والتسويق' },
  { id: 'properties', label: 'العقارات والوساطة' },
  { id: 'office', label: 'المالية والإدارة' },
] as const;

export interface NavItem {
  id: string;
  group: typeof navGroups[number]['id'];
  label: string;
  title: string;
  href: string;
  moduleKey: string;
  icon: string;
  keywords?: string;
}

export const navItems: NavItem[] = [
  // 1. الرئيسية
  { id: 'dashboard', group: 'home', label: 'لوحة التحكم', title: 'لوحة التحكم القيادية', href: '/dashboard', moduleKey: 'dashboard', icon: 'dashboard' },
  { id: 'today', group: 'home', label: 'أعمال اليوم', title: 'أعمال اليوم والتنبيهات', href: '/today', moduleKey: 'portal-management', icon: 'today', keywords: 'تنبيهات متابعة اعتمادات متأخرات تقويم مواعيد' },

  // 2. العملاء والتسويق
  { id: 'crm', group: 'customers', label: 'علاقات العملاء', title: 'إدارة علاقات العملاء (CRM)', href: '/crm', moduleKey: 'crm', icon: 'crm', keywords: 'CRM صفقات اتصالات واتساب هاتف' },
  { id: 'sales', group: 'customers', label: 'البيع والمطابقة', title: 'البيع وطلبات المشترين', href: '/sales', moduleKey: 'crm', icon: 'properties', keywords: 'شراء مشترين تسويق ترشيح مطابقة' },
  { id: 'rental-market', group: 'customers', label: 'التأجير والمطابقة', title: 'التأجير وطلبات المستأجرين', href: '/rental-market', moduleKey: 'crm', icon: 'properties', keywords: 'استئجار تسويق ترشيح مطابقة' },
  { id: 'leasing', group: 'customers', label: 'التأجير والمتابعة', title: 'التأجير ومتابعة العملاء', href: '/leasing', moduleKey: 'leasing', icon: 'contracts', keywords: 'يومي شهري سنوي حجوزات عقود متابعة مؤشرات' },

  // 3. العقارات والوساطة
  { id: 'ownership', group: 'properties', label: 'العقارات والملكية', title: 'الملكية والعقارات والوكالات', href: '/ownership-properties', moduleKey: 'ownership-properties', icon: 'properties', keywords: 'صكوك ملاك مؤجرين مستأجرين وكالات ممثلين' },
  { id: 'management', group: 'properties', label: 'إدارة الأملاك', title: 'إدارة الأملاك والتشغيل', href: '/property-management', moduleKey: 'property-management', icon: 'management', keywords: 'صيانة تشغيل كشوف ملاك' },
  { id: 'map', group: 'properties', label: 'الخريطة العقارية', title: 'خريطة كحل العقارية', href: '/property-map', moduleKey: 'ownership-properties', icon: 'map' },
  { id: 'brokerage', group: 'properties', label: 'اتفاقيات الوساطة', title: 'اتفاقيات الوساطة العقارية', href: '/brokerage-agreements', moduleKey: 'brokerage-agreements', icon: 'brokerage' },

  // 4. المالية والإدارة
  { id: 'internal-finance', group: 'office', label: 'المالية الداخلية', title: 'المالية الداخلية', href: '/financials/internal', moduleKey: 'internal-finance', icon: 'earnings', keywords: 'تحصيل مصروفات أمانات محاسب أرباح' },
  { id: 'reports', group: 'office', label: 'تقرير اليوم KR', title: 'تقرير اليوم KR - إقفال يوم العمل', href: '/financials/daily-reports', moduleKey: 'daily-reports', icon: 'reports' },
  { id: 'bills', group: 'office', label: 'الفواتير والنماذج', title: 'الفواتير والسندات والنماذج', href: '/bills-forms', moduleKey: 'bills-forms', icon: 'bills' },
  { id: 'archive', group: 'office', label: 'الأرشيف والوثائق', title: 'الأرشيف الإلكتروني والوثائق', href: '/archive', moduleKey: 'archive', icon: 'archive' },
  { id: 'employees', group: 'office', label: 'الموظفون', title: 'شؤون الموظفين والدوام والرواتب', href: '/employees', moduleKey: 'employees', icon: 'employees', keywords: 'حضور إجازات تفويض رواتب' },
  { id: 'users', group: 'office', label: 'المستخدمون والصلاحيات', title: 'المستخدمون والصلاحيات', href: '/users-access', moduleKey: 'users-access', icon: 'users' },
  { id: 'audit', group: 'office', label: 'سجل التدقيق', title: 'سجل التدقيق الشامل', href: '/audit', moduleKey: 'audit', icon: 'activity', keywords: 'دخول خروج تحديث حذف تصدير نشاط' },
  { id: 'settings', group: 'office', label: 'الإعدادات', title: 'الإعدادات والتكاملات', href: '/settings', moduleKey: 'users-access', icon: 'settings' },
];

// Hidden from sidebar to avoid repetition, but kept for direct-URL permission resolution
const hiddenNavItems: NavItem[] = [
  { id: 'calendar', group: 'home', label: 'التقويم والمواعيد', title: 'التقويم والمواعيد', href: '/calendar', moduleKey: 'dashboard', icon: 'calendar' },
  { id: 'contracts', group: 'customers', label: 'العقود والإيجارات', title: 'مركز العقود والإيجارات', href: '/contracts', moduleKey: 'contracts', icon: 'contracts' },
  { id: 'orders', group: 'customers', label: 'طلبات العملاء', title: 'طلبات العملاء العقارية', href: '/customer-orders', moduleKey: 'customer-orders', icon: 'orders' },
  { id: 'portals', group: 'office', label: 'بوابات العملاء', title: 'إدارة بوابات العملاء', href: '/portal-management', moduleKey: 'portal-management', icon: 'portals' },
  { id: 'services', group: 'properties', label: 'الخدمات والمعاملات', title: 'الخدمات العامة والمعاملات', href: '/general-services', moduleKey: 'general-services', icon: 'services' },
  { id: 'earnings', group: 'office', label: 'الأرباح والمعاملات', title: 'الأرباح والمعاملات المالية', href: '/financials/earnings', moduleKey: 'financials', icon: 'earnings' },
  { id: 'activity', group: 'office', label: 'سجل النشاط', title: 'سجل النشاط', href: '/activity', moduleKey: 'users-access', icon: 'activity' },
];

export const navShortcuts: NavItem[] = [];

export function routeItem(path: string) {
  const pathname = path === '/' ? '/dashboard' : path;
  return [...navItems, ...hiddenNavItems].find(item => pathname === item.href || pathname.startsWith(item.href + '/'));
}
export function routeModule(path: string) {
  return routeItem(path)?.moduleKey || path.split('/')[1] || 'dashboard';
}
export function isNavigationItemActive(item: NavItem, pathname: string, query: string) {
  const [path, expectedQuery] = item.href.split('?');
  if (!expectedQuery) return routeItem(pathname)?.id === item.id;
  if (pathname !== path) return false;
  const current = new URLSearchParams(query);
  return Array.from(new URLSearchParams(expectedQuery).entries()).every(([key, value]) => current.get(key) === value);
}
export function normalizeSearch(value: string) {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase().trim();
}
export function searchNavigation(query: string, canAccess: (module: string) => boolean) {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return [...navItems, ...navShortcuts].filter(item => canAccess(item.moduleKey) && words.every(word => normalizeSearch(`${item.label} ${item.title} ${item.keywords || ''}`).includes(word)));
}
