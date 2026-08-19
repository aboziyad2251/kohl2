// Shared Components with exact Lucide vector icons matching the live platform

function renderSidebar(activeHref) {
  const navItems = [
    {
      name: 'لوحة التحكم القيادية',
      href: 'index.html',
      badge: null,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><rect width="7" height="9" x="3" y="3" rx="1"></rect><rect width="7" height="5" x="14" y="3" rx="1"></rect><rect width="7" height="9" x="14" y="12" rx="1"></rect><rect width="7" height="5" x="3" y="16" rx="1"></rect></svg>`
    },
    {
      name: 'طلبات العملاء (سكني/تجاري)',
      href: 'customer-orders.html',
      badge: 'جديد 📋',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg>`
    },
    {
      name: 'إدارة الأملاك والتشغيل',
      href: 'property-management.html',
      badge: 'جديد 🏢',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>`
    },
    {
      name: 'الأرباح والمعاملات المالية',
      href: 'financials-earnings.html',
      badge: 'مالي',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path></svg>`
    },
    {
      name: 'التقرير اليومي ومستشار AI',
      href: 'financials-daily-reports.html',
      badge: 'ذكاء AI',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path></svg>`
    },
    {
      name: 'مركز العقود والإيجارات',
      href: 'contracts.html',
      badge: 'جديد',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2"></path><path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"></path><path d="M8 18h1"></path></svg>`
    },
    {
      name: 'الملكية والعقارات والوكالات',
      href: 'ownership-properties.html',
      badge: null,
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>`
    },
    {
      name: 'اتفاقيات الوساطة (إيجار)',
      href: 'brokerage-agreements.html',
      badge: 'معتمد',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path><path d="m9 15 2 2 4-4"></path></svg>`
    },
    {
      name: 'الخدمات العامة والمعاملات',
      href: 'general-services.html',
      badge: 'خدمات',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path><rect width="20" height="14" x="2" y="6" rx="2"></rect></svg>`
    }
  ];

  let navLinksHtml = navItems.map(item => {
    const isActive = activeHref.includes(item.href) || (activeHref === '' && item.href === 'index.html');
    return `
      <a href="${item.href}" class="nav-link-item ${isActive ? 'active' : ''}">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="display: flex; align-items: center; color: ${isActive ? '#38bdf8' : '#94a3b8'};">${item.icon}</span>
          <span>${item.name}</span>
        </div>
        ${item.badge ? `<span class="nav-badge-pill">${item.badge}</span>` : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #475569; transform: rotate(180deg);"><path d="m9 18 6-6-6-6"></path></svg>`}
      </a>
    `;
  }).join('');

  return `
    <aside class="sidebar-nav">
      <div>
        <!-- Brand Header -->
        <div class="sidebar-brand-header">
          <div class="sidebar-logo-box">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>
          </div>
          <div>
            <h1 style="font-size: 1.125rem; font-weight: 700; color: #ffffff; line-height: 1.25;">نظام إدارة المكتب</h1>
            <p style="font-size: 0.75rem; color: #38bdf8; font-weight: 500;">office.mabotargagh.online</p>
          </div>
        </div>

        <!-- Navigation Section -->
        <nav style="padding: 1rem; display: flex; flex-direction: column; gap: 0.375rem;">
          <div style="padding: 0 0.75rem 0.5rem 0.75rem; font-size: 11px; font-weight: 600; color: #94a3b8; letter-spacing: 0.05em;">
            القائمة الرئيسية
          </div>
          ${navLinksHtml}
        </nav>

        <!-- VPS Server Status Card -->
        <div style="margin: 1.5rem 1rem 0 1rem; padding: 0.875rem; border-radius: 0.75rem; background-color: rgba(30, 41, 59, 0.5); border: 1px solid #1e293b; font-size: 0.75rem; color: #cbd5e1;">
          <div style="display: flex; align-items: center; justify-content: space-between; color: #94a3b8;">
            <span style="display: flex; align-items: center; gap: 0.375rem;">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #34d399;"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>
              <span>خادم Supabase VPS</span>
            </span>
            <span style="width: 0.5rem; height: 0.5rem; border-radius: 9999px; background-color: #34d399; box-shadow: 0 0 8px #34d399;"></span>
          </div>
          <p style="font-size: 11px; color: #94a3b8; direction: ltr; text-align: right; margin-top: 0.5rem;">IP: 76.13.40.119</p>
        </div>
      </div>

      <!-- Footer Office Profile -->
      <div style="padding: 1rem; border-top: 1px solid #1e293b; background-color: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 2.25rem; height: 2.25rem; border-radius: 9999px; background-color: #1e293b; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-weight: 700; font-size: 0.875rem;">
            م.ع
          </div>
          <div>
            <div style="font-size: 0.75rem; font-weight: 600; color: #ffffff;">مكتب العقارات المعتمد</div>
            <div style="font-size: 10px; color: #94a3b8;">ترخيص إيجار رقم #88921</div>
          </div>
        </div>
      </div>
    </aside>
  `;
}

function renderHeader(title, subtitle) {
  const currentDate = new Date().toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <header class="top-header">
      <!-- Right: Title -->
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 700; color: #ffffff; line-height: 1.25;">${title || 'نظام إدارة العقود والملكية العقارية'}</h2>
        <p style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.125rem;">${subtitle || 'لوحة التحكم والعمليات المباشرة'}</p>
      </div>

      <!-- Left: Widgets -->
      <div style="display: flex; align-items: center; gap: 1rem;">
        <!-- Date -->
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; border-radius: 0.5rem; background-color: rgba(30, 41, 59, 0.8); border: 1px solid #334155; font-size: 0.75rem; color: #cbd5e1;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #38bdf8;"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>
          <span>${currentDate}</span>
        </div>

        <!-- Search Box -->
        <div style="position: relative; width: 16rem;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; right: 0.75rem; top: 0.625rem; color: #94a3b8;"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>
          <input type="text" placeholder="بحث عن عقار، عقد، أو صك..." style="width: 100%; background-color: rgba(30, 41, 59, 0.9); border: 1px solid #334155; border-radius: 0.5rem; padding-right: 2.25rem; padding-left: 0.75rem; padding-top: 0.375rem; padding-bottom: 0.375rem; font-size: 0.75rem; color: #ffffff; outline: none; font-family: inherit;">
        </div>

        <!-- Notification Bell -->
        <button style="position: relative; padding: 0.5rem; border-radius: 0.5rem; background-color: #1e293b; border: 1px solid #334155; color: #cbd5e1; cursor: pointer; display: flex; align-items: center; justify-content: center;" title="الإشعارات والتنبيهات">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
          <span style="position: absolute; top: 0.25rem; right: 0.25rem; width: 0.5rem; height: 0.5rem; border-radius: 9999px; background-color: #fbbf24; box-shadow: 0 0 6px #fbbf24;"></span>
        </button>

        <!-- Ejar Active Badge -->
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; border-radius: 0.5rem; background-color: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 0.75rem; font-weight: 500;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path></svg>
          <span>ربط إيجار نشط</span>
        </div>
      </div>
    </header>
  `;
}

// Modal Functions
function openModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.add('open');
    m.style.display = 'flex';
  }
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) {
    m.classList.remove('open');
    m.style.display = 'none';
  }
}
