// Shared Components (Sidebar, Header, Modal helpers) matching Modern Real Estate Design

function renderSidebar(activeHref) {
  const generalItems = [
    { name: 'Dashboard / لوحة التحكم', href: 'index.html', icon: '📊' },
    { name: 'Property Info / معلومات العقارات', href: 'ownership-properties.html', icon: '🏢' },
    { name: 'Staff Schedule / جدول المواعيد', href: 'property-management.html', icon: '📅' },
    { name: 'Booking & Contracts / العقود', href: 'contracts.html', icon: '✍️' },
    { name: 'Maintenance / الصيانة', href: 'property-management.html', icon: '🔧' },
    { name: 'Reports / التقارير المالية', href: 'financials-daily-reports.html', icon: '📑' },
    { name: 'Customer Orders / طلبات العملاء', href: 'customer-orders.html', icon: '📋' },
    { name: 'Brokerage / اتفاقيات السعي', href: 'brokerage-agreements.html', icon: '🤝' },
    { name: 'General Services / الخدمات العامة', href: 'general-services.html', icon: '💼' }
  ];

  let generalNavHtml = generalItems.map(item => {
    const isActive = activeHref.includes(item.href) || (activeHref === '' && item.href === 'index.html');
    return `
      <a href="${item.href}" class="sidebar-nav-item ${isActive ? 'active' : ''}">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.1rem; display: flex; align-items: center;">${item.icon}</span>
          <span style="font-size: 0.85rem; font-weight: ${isActive ? '800' : '600'};">${item.name}</span>
        </div>
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
            <h1 style="font-size: 1rem; font-weight: 900; color: #fff; line-height: 1.2;">Realys Management</h1>
            <p style="font-size: 10.5px; color: #38bdf8; font-weight: 700; margin-top: 2px;">office.mabotargagh.online</p>
          </div>
        </div>

        <!-- General Section -->
        <nav style="padding: 1rem 0.75rem 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem;">
          <div style="padding: 0 0.75rem 0.4rem 0.75rem; font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase;">
            GENERAL / عام
          </div>
          ${generalNavHtml}
        </nav>
      </div>

      <div>
        <!-- Account Section -->
        <div style="padding: 0.5rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; border-top: 1px solid rgba(255, 255, 255, 0.06);">
          <div style="padding: 0 0.75rem 0.35rem 0.75rem; font-size: 10px; font-weight: 800; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase;">
            ACCOUNT / الحساب
          </div>
          <a href="financials-earnings.html" class="sidebar-nav-item">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span>⚙️</span>
              <span style="font-size: 0.85rem; font-weight: 600;">Settings / الإعدادات المالية</span>
            </div>
          </a>
          <a href="index.html" class="sidebar-nav-item" style="color: #f87171;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span>🚪</span>
              <span style="font-size: 0.85rem; font-weight: 600;">Logout / خروج</span>
            </div>
          </a>
        </div>

        <!-- Office Profile Footer -->
        <div class="sidebar-profile-footer">
          <div class="profile-avatar">
            HL
          </div>
          <div style="flex: 1;">
            <div style="font-size: 11.5px; font-weight: 800; color: #ffffff;">Harry Lancaster</div>
            <div style="font-size: 10px; color: #38bdf8;">Owner / المالك العقاري</div>
          </div>
        </div>
      </div>
    </aside>
  `;
}

function renderHeader(title, subtitle) {
  return `
    <header class="header">
      <!-- Right: User Greeting -->
      <div>
        <h2 style="font-size: 1.25rem; font-weight: 900; color: #fff; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
          <span>Hi, Harry Lancaster</span>
          <span style="font-size: 1.1rem;">👋</span>
        </h2>
        <p style="font-size: 11px; color: #94a3b8; margin: 0.2rem 0 0 0;">Take control your every activity that exists / تحكم بجميع الأنشطة والعمليات العقارية.</p>
      </div>

      <!-- Left: Search Bar & Profile -->
      <div style="display: flex; align-items: center; gap: 1rem;">
        <!-- Search Input -->
        <div class="header-search-box" style="width: 320px;">
          <span style="color: #64748b; font-size: 0.9rem;">🔍</span>
          <input type="text" placeholder="Search properties, tasks, etc..." class="header-search-input" id="global-header-search">
          <span style="font-size: 10px; color: #64748b; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px;">⌘K</span>
        </div>

        <!-- Notification Bell -->
        <div class="header-icon-btn" title="Notifications">
          <span style="font-size: 1.05rem;">🔔</span>
          <span class="notification-dot"></span>
        </div>

        <!-- Header Profile -->
        <div style="display: flex; align-items: center; gap: 0.65rem; padding: 0.35rem 0.75rem; border-radius: 0.75rem; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.08);">
          <div class="profile-avatar" style="width: 32px; height: 32px; font-size: 0.75rem;">
            HL
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 800; color: #fff;">Harry Lancaster</div>
            <div style="font-size: 9.5px; color: #94a3b8;">Owner</div>
          </div>
          <span style="color: #64748b; font-size: 10px; margin-right: 4px;">⌄</span>
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
