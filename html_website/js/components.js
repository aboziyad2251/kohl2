// Shared Components (Sidebar, Header, Modal helpers)

function renderSidebar(activeHref) {
  const navItems = [
    { name: 'لوحة التحكم القيادية', href: 'index.html', icon: '📊', badge: null },
    { name: 'طلبات العملاء (سكني/تجاري)', href: 'customer-orders.html', icon: '📋', badge: 'جديد' },
    { name: 'إدارة الأملاك والتشغيل', href: 'property-management.html', icon: '🏢', badge: 'جديد' },
    { name: 'الأرباح والمعاملات المالية', href: 'financials-earnings.html', icon: '💰', badge: 'مالي' },
    { name: 'التقرير اليومي ومستشار AI', href: 'financials-daily-reports.html', icon: '✨', badge: 'ذكاء AI' },
    { name: 'مركز العقود والإيجارات', href: 'contracts.html', icon: '✍️', badge: 'جديد' },
    { name: 'الملكية والعقارات والوكالات', href: 'ownership-properties.html', icon: '🏛️', badge: null },
    { name: 'اتفاقيات الوساطة (إيجار)', href: 'brokerage-agreements.html', icon: '🤝', badge: 'معتمد' },
    { name: 'الخدمات العامة والمعاملات', href: 'general-services.html', icon: '💼', badge: 'خدمات' },
  ];

  let navLinksHtml = navItems.map(item => {
    const isActive = activeHref.includes(item.href) || (activeHref === '' && item.href === 'index.html');
    return `
      <a href="${item.href}" class="sidebar-nav-item ${isActive ? 'active' : ''}">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.15rem; display: flex; align-items: center;">${item.icon}</span>
          <span style="font-size: 0.85rem; font-weight: ${isActive ? '800' : '600'};">${item.name}</span>
        </div>
        ${item.badge ? `<span class="nav-badge ${item.badge === 'جديد' ? 'nav-badge-teal' : item.badge === 'مالي' ? 'nav-badge-blue' : item.badge === 'ذكاء AI' ? 'nav-badge-cyan' : 'nav-badge-slate'}">${item.badge}</span>` : `<span style="color: #475569; font-size: 11px;">‹</span>`}
      </a>
    `;
  }).join('');

  return `
    <aside class="sidebar">
      <div>
        <!-- Brand Header -->
        <div class="sidebar-brand">
          <div class="brand-logo-icon">
            🏢
          </div>
          <div>
            <h1 style="font-size: 1.05rem; font-weight: 900; color: #fff; line-height: 1.2;">نظام إدارة المكتب</h1>
            <p style="font-size: 11px; color: #38bdf8; font-weight: 700; margin-top: 2px;">office.mabotargagh.online</p>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav style="padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.35rem;">
          <div style="padding: 0 0.75rem 0.5rem 0.75rem; font-size: 11px; font-weight: 800; color: #64748b; letter-spacing: 0.05em;">
            القائمة الرئيسية
          </div>
          ${navLinksHtml}
        </nav>
      </div>

      <div>
        <!-- Server Connection Status -->
        <div class="sidebar-server-status">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
            <span style="display: flex; align-items: center; gap: 0.4rem; color: #cbd5e1; font-weight: 700; font-size: 11px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 10px #34d399; display: inline-block;"></span>
              <span>خادم Supabase VPS متصل</span>
            </span>
          </div>
          <p style="font-family: monospace; color: #94a3b8; direction: ltr; text-align: right; font-size: 10.5px; margin: 0;">IP: 76.13.40.119 (HTTPS)</p>
        </div>

        <!-- Office Profile Footer -->
        <div class="sidebar-profile-footer">
          <div class="profile-avatar">
            م.ع
          </div>
          <div>
            <div style="font-size: 12px; font-weight: 800; color: #ffffff;">مكتب العقارات المعتمد</div>
            <div style="font-size: 10.5px; color: #94a3b8;">ترخيص إيجار رقم: 893214</div>
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
    <header class="header">
      <!-- Right Title in RTL -->
      <div>
        <h2 style="font-size: 1.2rem; font-weight: 900; color: #fff; margin: 0; line-height: 1.2;">${title || 'نظام إدارة العقود والملكية العقارية'}</h2>
        <p style="font-size: 11px; color: #94a3b8; margin: 0.2rem 0 0 0;">${subtitle || 'لوحة التحكم والعمليات المباشرة'}</p>
      </div>

      <!-- Left Widgets in RTL -->
      <div style="display: flex; align-items: center; gap: 0.85rem;">
        <!-- Live Date Widget -->
        <div class="header-widget">
          <span style="color: #38bdf8; font-size: 1rem;">📅</span>
          <span style="font-weight: 700; font-size: 11px; color: #e2e8f0;">${currentDate}</span>
        </div>

        <!-- Search Bar -->
        <div class="header-search-box">
          <span style="color: #64748b; font-size: 0.9rem;">🔍</span>
          <input type="text" placeholder="بحث عن عقار، عقد أو صك..." class="header-search-input" id="global-header-search">
        </div>

        <!-- Notification Bell Icon -->
        <div class="header-icon-btn" title="الإشعارات والتنبيهات">
          <span style="font-size: 1.05rem;">🔔</span>
          <span class="notification-dot"></span>
        </div>

        <!-- Ejar Active Badge -->
        <div class="header-ejar-badge">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399;"></span>
          <span>ربط إيجار نشط</span>
        </div>
      </div>
    </header>
  `;
}

// Modal Toggle Functions
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.add('active');
    el.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) {
    el.classList.remove('active');
    el.style.display = 'none';
  }
}
