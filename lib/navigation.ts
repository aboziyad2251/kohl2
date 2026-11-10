export const navGroups = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'properties', label: 'العقارات والأملاك' },
  { id: 'contracts', label: 'العقود والخدمات' },
  { id: 'customers', label: 'العملاء والمبيعات' },
  { id: 'finance', label: 'المالية والتقارير' },
  { id: 'office', label: 'الإدارة والوثائق' },
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
  { id: 'leasing', group: 'customers', label: 'التأجير ومتابعة العملاء', title: 'التأجير ومتابعة العملاء', href: '/leasing', moduleKey: 'leasing', icon: 'contracts', keywords: 'يومي شهري سنوي حجوزات متابعة مؤشرات' },
  { id: 'internal-finance', group: 'finance', label: 'المالية الداخلية', title: 'المالية الداخلية', href: '/financials/internal', moduleKey: 'internal-finance', icon: 'earnings', keywords: 'تحصيل مصروفات أمانات محاسب' },
  { id: 'dashboard', group: 'home', label: 'لوحة التحكم', title: 'لوحة التحكم القيادية', href: '/dashboard', moduleKey: 'dashboard', icon: 'dashboard' },
  { id: 'today', group: 'home', label: 'أعمال اليوم', title: 'أعمال اليوم والتنبيهات', href: '/today', moduleKey: 'portal-management', icon: 'today', keywords: 'تنبيهات متابعة اعتمادات متأخرات' },
  { id: 'calendar', group: 'home', label: 'التقويم والمواعيد', title: 'التقويم والمواعيد', href: '/calendar', moduleKey: 'dashboard', icon: 'calendar' },
  { id: 'map', group: 'properties', label: 'الخريطة العقارية', title: 'خريطة كحل العقارية', href: '/property-map', moduleKey: 'ownership-properties', icon: 'map' },
  { id: 'ownership', group: 'properties', label: 'العقارات والملكية', title: 'الملكية والعقارات والوكالات', href: '/ownership-properties', moduleKey: 'ownership-properties', icon: 'properties', keywords: 'صكوك ملاك مؤجرين مستأجرين وكالات ممثلين' },
  { id: 'management', group: 'properties', label: 'إدارة الأملاك', title: 'إدارة الأملاك والتشغيل', href: '/property-management', moduleKey: 'property-management', icon: 'management', keywords: 'صيانة تشغيل كشوف ملاك' },
  { id: 'contracts', group: 'contracts', label: 'العقود والإيجارات', title: 'مركز العقود والإيجارات', href: '/contracts', moduleKey: 'contracts', icon: 'contracts' },
  { id: 'brokerage', group: 'contracts', label: 'اتفاقيات الوساطة', title: 'اتفاقيات الوساطة العقارية', href: '/brokerage-agreements', moduleKey: 'brokerage-agreements', icon: 'brokerage' },
  { id: 'services', group: 'contracts', label: 'الخدمات والمعاملات', title: 'الخدمات العامة والمعاملات', href: '/general-services', moduleKey: 'general-services', icon: 'services' },
  { id: 'crm', group: 'customers', label: 'علاقات العملاء', title: 'إدارة علاقات العملاء (CRM)', href: '/crm', moduleKey: 'crm', icon: 'crm', keywords: 'CRM صفقات اتصالات واتساب مطابقة' },
  { id: 'orders', group: 'customers', label: 'طلبات العملاء', title: 'طلبات العملاء العقارية', href: '/customer-orders', moduleKey: 'customer-orders', icon: 'orders', keywords: 'سكني تجاري' },
  { id: 'portals', group: 'customers', label: 'بوابات العملاء', title: 'إدارة بوابات العملاء', href: '/portal-management', moduleKey: 'portal-management', icon: 'portals' },
  { id: 'earnings', group: 'finance', label: 'الأرباح والمعاملات', title: 'الأرباح والمعاملات المالية', href: '/financials/earnings', moduleKey: 'financials', icon: 'earnings' },
  { id: 'bills', group: 'finance', label: 'الفواتير والسندات والنماذج', title: 'الفواتير والسندات والنماذج', href: '/bills-forms', moduleKey: 'bills-forms', icon: 'bills' },
  { id: 'reports', group: 'finance', label: 'تقرير اليوم KR', title: 'تقرير اليوم KR - إقفال يوم العمل', href: '/financials/daily-reports', moduleKey: 'daily-reports', icon: 'reports' },
  { id: 'employees', group: 'office', label: 'الموظفون والرواتب', title: 'شؤون الموظفين والدوام والرواتب', href: '/employees', moduleKey: 'employees', icon: 'employees', keywords: 'حضور إجازات تفويض' },
  { id: 'users', group: 'office', label: 'المستخدمون والصلاحيات', title: 'المستخدمون والصلاحيات', href: '/users-access', moduleKey: 'users-access', icon: 'users' },
  { id: 'archive', group: 'office', label: 'الأرشيف والوثائق', title: 'الأرشيف الإلكتروني والوثائق', href: '/archive', moduleKey: 'archive', icon: 'archive' },
  { id: 'audit', group: 'office', label: 'سجل التدقيق الشامل', title: 'سجل التدقيق الشامل', href: '/audit', moduleKey: 'audit', icon: 'activity', keywords: 'دخول خروج تحديث حذف تصدير' },
  { id: 'activity', group: 'office', label: 'سجل النشاط', title: 'سجل النشاط', href: '/activity', moduleKey: 'users-access', icon: 'activity' },
  { id: 'settings', group: 'office', label: 'الإعدادات والتكاملات', title: 'الإعدادات والتكاملات', href: '/settings', moduleKey: 'users-access', icon: 'settings' },
];

export const navShortcuts: NavItem[] = [
  { id: 'followups', group: 'customers', label: 'المتابعات والاتصالات', title: 'المتابعات والاتصالات', href: '/crm?tab=activities', moduleKey: 'crm', icon: 'crm' },
  { id: 'matcher', group: 'customers', label: 'مطابقة الطلبات والعقارات', title: 'مطابقة الطلبات والعقارات', href: '/crm?tab=matcher', moduleKey: 'crm', icon: 'crm' },
  { id: 'maintenance', group: 'properties', label: 'صيانة الأملاك', title: 'صيانة الأملاك', href: '/property-management?tab=MAINTENANCE', moduleKey: 'property-management', icon: 'management' },
  { id: 'statements', group: 'properties', label: 'كشوف الملاك', title: 'كشوف الملاك', href: '/property-management?tab=STATEMENTS', moduleKey: 'property-management', icon: 'earnings' },
  { id: 'owners', group: 'properties', label: 'الملاك والمؤجرون', title: 'الملاك والمؤجرون', href: '/ownership-properties?tab=lessors', moduleKey: 'ownership-properties', icon: 'properties' },
  { id: 'tenants', group: 'properties', label: 'المستأجرون', title: 'المستأجرون', href: '/ownership-properties?tab=tenants', moduleKey: 'ownership-properties', icon: 'properties' },
  { id: 'poas', group: 'properties', label: 'الوكالات الإلكترونية', title: 'الوكالات الإلكترونية', href: '/ownership-properties?tab=epoa', moduleKey: 'ownership-properties', icon: 'contracts' },
  { id: 'collections', group: 'finance', label: 'التحصيل والمستحقات', title: 'التحصيل والمستحقات', href: '/portal-management?tab=payments', moduleKey: 'portal-management', icon: 'earnings' },
  { id: 'renewals', group: 'finance', label: 'التجديدات والتنبيهات', title: 'التجديدات والتنبيهات', href: '/today?filter=overview', moduleKey: 'portal-management', icon: 'today' },
  { id: 'approvals', group: 'properties', label: 'صيانة البوابات والاعتمادات', title: 'صيانة البوابات والاعتمادات', href: '/portal-management?tab=maintenance', moduleKey: 'portal-management', icon: 'management' },
  { id: 'commissions', group: 'finance', label: 'العمولات والأهداف', title: 'العمولات والأهداف', href: '/portal-management?tab=broker', moduleKey: 'portal-management', icon: 'earnings' },
];

export function routeItem(path: string) {
  const pathname = path === '/' ? '/dashboard' : path;
  return navItems.find(item => pathname === item.href || pathname.startsWith(item.href + '/'));
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
