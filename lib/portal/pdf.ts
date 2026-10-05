import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const execute = promisify(execFile);
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
const amount = (value: unknown) => Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export interface PortalDocument { kind: 'payment' | 'statement'; verification_code: string; created_at: string; snapshot: Record<string, any>; }
export async function renderPortalPDF(document: PortalDocument) {
    const logo = (await readFile(join(process.cwd(), 'public', 'kohl-logo.png'))).toString('base64');
    const snapshot = document.snapshot;
    const title = document.kind === 'payment' ? 'إثبات دفع' : 'كشف حساب المالك';
    const row = (label: string, value: unknown) => `<tr><th>${escape(label)}</th><td><bdi>${escape(value)}</bdi></td></tr>`;
    const content = document.kind === 'payment' ? `<table class="details">${row('المستأجر', snapshot.tenant_name)}${row('العقار / الوحدة', `${snapshot.property_name} / ${snapshot.unit_label || 'الوحدة غير مسجلة'}`)}${row('مرجع الدفع', snapshot.reference)}${row('المبلغ (ر.س)', amount(snapshot.amount))}${row('تاريخ الدفع', snapshot.date)}${row('طريقة الدفع', snapshot.method || 'غير مسجلة')}${row('الفترة المغطاة', `${snapshot.period_start || 'غير مسجلة'} - ${snapshot.period_end || 'غير مسجلة'}`)}</table>` : `<p><strong>المالك:</strong> ${escape(snapshot.owner_name)}</p><p><strong>الفترة:</strong> <span dir="ltr">${escape(snapshot.start)} - ${escape(snapshot.end)}</span></p><p class="muted">القيم تمثل إجمالي العقار بالكامل وليست حصة الملكية.</p><table><thead><tr><th>العقار</th><th>المتوقع</th><th>المحصل</th><th>الاستقطاعات</th><th>الصافي</th></tr></thead><tbody>${(snapshot.rows || []).map((item: any) => `<tr><td>${escape(item.name)}</td><td class="number">${amount(item.expected)}</td><td class="number">${amount(item.gross)}</td><td class="number">${amount(item.deductions)}</td><td class="number">${amount(item.net)}</td></tr>`).join('')}</tbody></table><div class="totals"><table>${row('إجمالي الدخل المحصل (ر.س)', amount(snapshot.gross))}${row('إجمالي الاستقطاعات (ر.س)', amount(snapshot.deductions))}${row('صافي الأرباح (ر.س)', amount(snapshot.net))}</table></div>`;
    const origin = process.env.APP_ORIGIN || 'https://app.kohlestate-ksa.online';
    const verificationURL = `${origin}/verify/${document.verification_code}`;
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:'Noto Sans Arabic','Noto Sans',sans-serif;color:#1F4D28;font-size:12px;line-height:1.8}header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #2F6D3A;padding-bottom:16px;margin-bottom:24px}header img{width:150px;max-height:75px;object-fit:contain}h1{font-size:25px;margin:0}h2{font-size:15px;margin:0;color:#5d7d64}.muted{color:#5d7d64}table{width:100%;border-collapse:collapse;margin:18px 0;table-layout:fixed}thead{display:table-header-group}th,td{border:1px solid #BFD9C6;padding:9px;text-align:right;overflow-wrap:anywhere}th{background:#EAF3EC}.details th{width:32%}.number{direction:ltr;text-align:left;font-family:'Noto Sans',sans-serif}tr{break-inside:avoid}.totals{background:#EAF3EC;padding:10px 16px;margin-top:20px}.totals th,.totals td{border:0}footer{margin-top:26px;border-top:1px solid #BFD9C6;padding-top:15px;font-size:10px;break-inside:avoid}.code{direction:ltr;text-align:left;font-family:'Noto Sans',sans-serif;font-size:10px;overflow-wrap:anywhere}a{color:#2F6D3A}.stamp{border:1px solid #BFD9C6;padding:10px;margin-top:12px}</style></head><body><header><div><h1>${title}</h1><h2>كحل العقارية | Kohl Real Estate</h2></div><img src="data:image/png;base64,${logo}" alt="كحل العقارية"></header>${content}<footer><div>تاريخ الإصدار: <span dir="ltr">${escape(new Date(document.created_at).toISOString())}</span></div><div class="stamp">رمز التحقق الفريد<div class="code">${escape(document.verification_code)}</div><a href="${escape(verificationURL)}">التحقق من صحة الوثيقة</a><div class="code">${escape(verificationURL)}</div></div><p class="muted">وثيقة مستخرجة من القيود المسجلة لدى كحل العقارية. لا تعد فاتورة ضريبية.</p></footer></body></html>`;
    const directory = await mkdtemp(join(tmpdir(), 'kohl-pdf-'));
    try {
        const input = join(directory, 'document.html'), output = join(directory, 'document.pdf');
        await writeFile(input, html, { mode: 0o600 });
        await execute(process.env.PORTAL_CHROMIUM_PATH || '/usr/bin/chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${join(directory, 'profile')}`, `--print-to-pdf=${output}`, `file://${input}`], { timeout: 30000, maxBuffer: 1024 * 1024 });
        return await readFile(output);
    } finally { await rm(directory, { recursive: true, force: true }); }
}
