/**
 * Real Estate ERP - UI Interactions & Modal System
 * إدارة النوافذ المنبثقة، الإشعارات الحية، والتفاعلات البصرية
 */

export const UI = {
    /**
     * إظهار نافذة منبثقة Modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    /**
     * إغلاق نافذة منبثقة Modal
     */
    closeModal(modalId = null) {
        if (modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.classList.remove('active');
        } else {
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        }
        document.body.style.overflow = '';
    },

    /**
     * إظهار إشعار Toast منبثق
     */
    toast(message, type = 'info', duration = 3500) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const borderColors = {
            success: 'rgba(52, 211, 153, 0.5)',
            error: 'rgba(244, 63, 94, 0.5)',
            warning: 'rgba(251, 191, 36, 0.5)',
            info: 'rgba(56, 189, 248, 0.5)'
        };

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderColor = borderColors[type] || borderColors.info;
        toast.innerHTML = `
            <span style="font-size: 1.1rem;">${icons[type] || icons.info}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-20px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    /**
     * نافذة تأكيد الإجراء Confirm Dialog
     */
    confirm(message, onConfirmCallback) {
        if (window.confirm(message)) {
            onConfirmCallback();
        }
    },

    /**
     * تنسيق المبالغ المالية بالريال السعودي
     */
    formatCurrency(amount) {
        const val = Number(amount || 0);
        return val.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س';
    },

    /**
     * تنسيق التواريخ
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('ar-SA');
    }
};

// Global event listener for modal background clicks
document.addEventListener('click', (e) => {
    if (e.target.classList && e.target.classList.contains('modal-overlay')) {
        UI.closeModal();
    }
});

// ESC key to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        UI.closeModal();
    }
});

window.UI = UI;
