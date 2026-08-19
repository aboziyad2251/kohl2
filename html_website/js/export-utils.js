/**
 * Real Estate ERP - Export Utilities (Excel & CSV)
 * تصدير البيانات والجداول باللغة العربية مع دعم ترميز UTF-8 BOM
 */

export const ExportUtils = {
    /**
     * تصدير مصفوفة كائنات إلى ملف CSV متوافق 100% مع Microsoft Excel باللغة العربية
     * @param {string} filename اسم الملف
     * @param {Array<Object>} data مصفوفة البيانات
     * @param {Object} columnMapping مصفوفة تسميات الأعمدة بالعربية { key: 'الاسم بالعربي' }
     */
    exportToCSV(filename, data, columnMapping = null) {
        if (!data || !data.length) {
            if (window.UI) window.UI.toast('لا توجد بيانات متاحة للتصدير', 'warning');
            return;
        }

        const keys = columnMapping ? Object.keys(columnMapping) : Object.keys(data[0]);
        const headers = columnMapping ? Object.values(columnMapping) : keys;

        const separator = ',';
        const rows = data.map(item => {
            return keys.map(k => {
                let cell = item[k] === null || item[k] === undefined ? '' : item[k];
                if (cell instanceof Date) {
                    cell = cell.toLocaleDateString('ar-SA');
                } else if (typeof cell === 'object') {
                    cell = JSON.stringify(cell);
                } else {
                    cell = cell.toString().replace(/"/g, '""');
                }
                if (cell.search(/("|,|\n)/g) >= 0) {
                    cell = `"${cell}"`;
                }
                return cell;
            }).join(separator);
        });

        // Add UTF-8 Byte Order Mark (BOM) so Excel opens Arabic correctly
        const csvContent = '\uFEFF' + headers.join(separator) + '\n' + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const dateStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `${filename}_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.UI) window.UI.toast(`تم تصدير ${data.length} سجل بنجاح إلى ملف CSV`, 'success');
    },

    /**
     * طباعة جدول محدد بتنسيق نظيف
     * @param {string} elementId معرف العنصر المراد طباعته
     * @param {string} title عنوان التقرير
     */
    printElement(elementId, title = 'تقرير المكتب العقاري') {
        const el = document.getElementById(elementId);
        if (!el) return;

        const printWindow = window.open('', '', 'width=900,height=700');
        printWindow.document.write(`
            <html dir="rtl" lang="ar">
            <head>
                <title>${title}</title>
                <style>
                    body { font-family: 'Tajawal', sans-serif; padding: 20px; color: #111; direction: rtl; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                    th { background-color: #f1f5f9; }
                    h2 { color: #0284c7; border-bottom: 2px solid #0284c7; padding-bottom: 8px; }
                    .header-meta { margin-bottom: 15px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <h2>${title}</h2>
                <div class="header-meta">تاريخ الطباعة: ${new Date().toLocaleString('ar-SA')}</div>
                ${el.outerHTML}
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    }
};

window.ExportUtils = ExportUtils;
