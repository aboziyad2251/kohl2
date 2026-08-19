// Shared Components (Sidebar, Header, Modal helpers)

function renderSidebar(activeHref) {
  const navItems = [
    { name: 'لوحة التحكم القيادية', href: 'index.html', icon: '📊', badge: null },
    { name: 'طلبات العملاء (سكني/تجاري)', href: 'customer-orders.html', icon: '📋', badge: 'جديد 📋' },
    { name: 'إدارة الأملاك والتشغيل', href: 'property-management.html', icon: '🏢', badge: 'جديد 🏢' },
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
      <a href="${item.href}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-radius: 0.75rem; font-size: 0.8rem; font-weight: ${isActive ? '700' : '500'}; transition: all 0.15s ease; ${isActive ? 'background: rgba(2, 132, 199, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);' : 'color: #cbd5e1;'}" onmouseover="if(!${isActive}) this.style.background='rgba(30, 41, 59, 0.6)'" onmouseout="if(!${isActive}) this.style.background='transparent'">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.1rem;">${item.icon}</span>
          <span>${item.name}</span>
        </div>
        ${item.badge ? `<span style="font-size: 10px; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 9999px; background: rgba(56, 189, 248, 0.2); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.3);">${item.badge}</span>` : `<span style="color: #475569; font-size: 10px;">◀</span>`}
      </a>
    `;
  }).join('');

  return `
    <aside class="sidebar">
      <div>
        <!-- Brand Header -->
        <div style="padding: 1.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #0284c7, #38bdf8); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.3rem; box-shadow: 0 8px 20px rgba(2, 132, 199, 0.3);">
            🏢
          </div>
          <div>
            <h1 style="font-size: 1rem; font-weight: 800; color: #fff; line-height: 1.2;">نظام إدارة المكتب</h1>
            <p style="font-size: 11px; color: #38bdf8; font-weight: 600;">office.mabotargagh.online</p>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav style="padding: 1rem; display: flex; flex-direction: column; gap: 0.35rem;">
          <div style="padding: 0 0.75rem 0.5rem 0.75rem; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.05em;">
            القائمة الرئيسية
          </div>
          ${navLinksHtml}
        </nav>

        <!-- System Connection Status -->
        <div style="margin: 0.5rem 1rem; padding: 0.85rem; border-radius: 0.75rem; background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); font-size: 11px; color: #cbd5e1;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">
            <span style="display: flex; align-items: center; gap: 0.35rem; color: #94a3b8;">
              <span style="color: #34d399;">🛡️</span> خادم متصل ومفعل
            </span>
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #34d399; box-shadow: 0 0 8px #34d399;"></span>
          </div>
          <p style="font-family: monospace; color: #64748b; direction: ltr; text-align: right; font-size: 10px;">IP: 76.13.40.119 (HTTPS)</p>
        </div>
      </div>

      <!-- Office Profile Footer -->
      <div style="padding: 1rem 1.25rem; border-top: 1px solid rgba(255, 255, 255, 0.08); background: rgba(15, 23, 42, 0.8); display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #1e293b; border: 1px solid #334155; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-weight: 800; font-size: 0.8rem;">
          م.ع
        </div>
        <div>
          <div style="font-size: 12px; font-weight: 700; color: #ffffff;">مكتب العقارات المعتمد</div>
          <div style="font-size: 10px; color: #94a3b8;">ترخيص إيجار رقم #88921</div>
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
      <div>
        <h2 style="font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 0.15rem;">${title || 'نظام إدارة العقود والملكية العقارية'}</h2>
        <p style="font-size: 11px; color: #94a3b8;">${subtitle || 'لوحة التحكم والعمليات المباشرة'}</p>
      </div>

      <div style="display: flex; align-items: center; gap: 1rem;">
        <!-- Live Date -->
        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.85rem; border-radius: 0.5rem; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.08); font-size: 11px; color: #e2e8f0;">
          <span style="color: #38bdf8;">📅</span>
          <span>${currentDate}</span>
        </div>

        <!-- Ejar Badge -->
        <div style="display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.85rem; border-radius: 0.5rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; font-size: 11px; font-weight: 700;">
          <span>🛡️</span>
          <span>ربط إيجار نشط 100%</span>
        </div>
      </div>
    </header>
  `;
}

// Modal Toggle Functions
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.add('open');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('open');
}

// Export Table to CSV
function exportTableToCSV(filename, tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  let csv = [];
  const rows = table.querySelectorAll('tr');
  for (let i = 0; i < rows.length; i++) {
    let row = [], cols = rows[i].querySelectorAll('td, th');
    for (let j = 0; j < cols.length - 1; j++) { // omit actions column
      let text = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, '').trim();
      text = text.replace(/"/g, '""');
      row.push('"' + text + '"');
    }
    csv.push(row.join(','));
  }
  const csvFile = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const downloadLink = document.createElement('a');
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
