'use client';

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { useData } from '../../context/DataContext';
import { CustomerOrder, CustomerOrderCategory, CustomerOrderStatus } from '../../lib/types';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
} from 'lucide-react';

interface ImportCustomerOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedRowResult {
  order_number?: string;
  client_name: string;
  client_phone: string;
  category: CustomerOrderCategory;
  building_type: string;
  desired_area: string;
  budget_min?: number;
  budget_max?: number;
  status: CustomerOrderStatus;
  notes?: string;
  isDuplicate: boolean;
  duplicateReason?: string;
}

export default function ImportCustomerOrdersModal({ isOpen, onClose }: ImportCustomerOrdersModalProps) {
  const { customerOrders, addCustomerOrder } = useData();

  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRowResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{ added: number; skipped: number } | null>(null);

  if (!isOpen) return null;

  // Helper to normalize category
  const parseCategory = (val: any): CustomerOrderCategory => {
    if (!val) return 'RESIDENTIAL';
    const str = String(val).trim().toUpperCase();
    if (str.includes('COMMERCIAL') || str.includes('تجاري')) return 'COMMERCIAL';
    return 'RESIDENTIAL';
  };

  // Helper to normalize status
  const parseStatus = (val: any): CustomerOrderStatus => {
    if (!val) return 'New';
    const str = String(val).trim();
    if (str.includes('Searching') || str.includes('بحث') || str.includes('قيد البحث')) return 'Searching';
    if (str.includes('Fulfilled') || str.includes('توفير') || str.includes('مكتمل')) return 'Fulfilled';
    if (str.includes('Cancelled') || str.includes('ملغى') || str.includes('إلغاء')) return 'Cancelled';
    return 'New';
  };

  // Helper to extract clean numeric budget
  const parseNumber = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    const num = Number(String(val).replace(/[^0-9.]/g, ''));
    return isNaN(num) || num <= 0 ? undefined : num;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsProcessing(true);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

        const results: ParsedRowResult[] = [];

        rawJson.forEach((row, idx) => {
          // Normalize column keys
          const keys = Object.keys(row);
          const getVal = (possibleKeys: string[]) => {
            const foundKey = keys.find((k) =>
              possibleKeys.some((p) => k.trim().toLowerCase().includes(p.toLowerCase()))
            );
            return foundKey ? row[foundKey] : undefined;
          };

          const order_number = getVal(['رقم الطلب', 'order_number', 'رقم_الطلب']);
          const client_name = getVal(['اسم العميل', 'client_name', 'اسم_العميل', 'العميل', 'name']);
          const client_phone = getVal(['رقم الجوال', 'client_phone', 'رقم_الجوال', 'الجوال', 'الهاتف', 'phone']);
          const category = parseCategory(getVal(['التصنيف', 'category', 'نوع الطلب', 'نوع_الطلب']));
          const building_type = getVal(['نوع العقار', 'building_type', 'نوع_العقار', 'العقار']) || 'عقار';
          const desired_area = getVal(['المنطقة والمساحة', 'desired_area', 'المنطقة', 'الحي', 'المساحة']) || 'غير محدد';
          const budget_min = parseNumber(getVal(['الميزانية الدنيا', 'budget_min', 'الميزانية_الدنيا']));
          const budget_max = parseNumber(getVal(['الميزانية القصوى', 'budget_max', 'الميزانية_القصوى', 'الميزانية']));
          const status = parseStatus(getVal(['حالة الطلب', 'status', 'حالة_الطلب', 'الحالة']));
          const notes = getVal(['الملاحظات', 'notes', 'الشروط', 'الملاحظات والشروط']);

          // Skip completely empty rows
          if (!client_name && !client_phone && !order_number) return;

          const finalClientName = String(client_name || `عميل مستورد #${idx + 1}`).trim();
          const finalClientPhone = String(client_phone || '0500000000').trim();

          // Deduplication Check
          let isDuplicate = false;
          let duplicateReason = '';

          // 1. Match by order number
          if (order_number) {
            const matchByNum = customerOrders.find(
              (o) => o.order_number.trim().toLowerCase() === String(order_number).trim().toLowerCase()
            );
            if (matchByNum) {
              isDuplicate = true;
              duplicateReason = `موجود مسبقاً بنفس رقم الطلب (${order_number})`;
            }
          }

          // 2. Match by Client Phone + Client Name
          if (!isDuplicate) {
            const matchByPhoneAndName = customerOrders.find(
              (o) =>
                o.client_phone.trim() === finalClientPhone &&
                o.client_name.trim().toLowerCase() === finalClientName.toLowerCase()
            );
            if (matchByPhoneAndName) {
              isDuplicate = true;
              duplicateReason = `موجود مسبقاً برقم الجوال (${finalClientPhone}) والاسم (${finalClientName})`;
            }
          }

          results.push({
            order_number: order_number ? String(order_number).trim() : undefined,
            client_name: finalClientName,
            client_phone: finalClientPhone,
            category,
            building_type: String(building_type).trim(),
            desired_area: String(desired_area).trim(),
            budget_min,
            budget_max,
            status,
            notes: notes ? String(notes).trim() : undefined,
            isDuplicate,
            duplicateReason,
          });
        });

        setParsedRows(results);
      } catch (err) {
        console.error('Error parsing Excel file:', err);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleConfirmImport = async () => {
    const newItems = parsedRows.filter((r) => !r.isDuplicate);
    if (newItems.length === 0) return;

    setIsImporting(true);
    let addedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      // Guaranteed-unique fallback (order_number has a UNIQUE constraint in the DB) —
      // a random 3-digit suffix was colliding with existing rows and failing silently.
      const generatedNum =
        item.order_number || `ORD-${Date.now().toString(36).toUpperCase()}-${i}`;

      const newOrder: CustomerOrder = {
        id: `ord-${Date.now()}-${Math.random().toString(36).substr(2, 4)}-${i}`,
        order_number: generatedNum,
        client_name: item.client_name,
        client_phone: item.client_phone,
        category: item.category,
        building_type: item.building_type,
        desired_area: item.desired_area,
        budget_min: item.budget_min,
        budget_max: item.budget_max,
        status: item.status,
        notes: item.notes,
        created_at: new Date().toISOString(),
      };

      const success = await addCustomerOrder(newOrder);
      if (success) {
        addedCount++;
      } else {
        failedCount++;
      }
    }

    setIsImporting(false);
    setImportSummary({
      added: addedCount,
      skipped: parsedRows.length - newItems.length + failedCount,
    });
  };

  const resetModalState = () => {
    setFile(null);
    setParsedRows([]);
    setImportSummary(null);
    onClose();
  };

  const newCount = parsedRows.filter((r) => !r.isDuplicate).length;
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 md:p-8 space-y-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">استيراد طلبات العملاء من ملف Excel</h3>
              <p className="text-xs text-slate-400">إضافة الطلبات الجديدة تلقائياً وتفادي تكرار البيانات المسجلة</p>
            </div>
          </div>
          <button
            onClick={resetModalState}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-6 overflow-y-auto pr-1 flex-1">
          {/* Success Summary View */}
          {importSummary ? (
            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/40 shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-white text-lg">تم اكتشاف واستيراد الطلبات بنجاح!</h4>
                <p className="text-xs text-slate-300 mt-1">
                  تم إضافة <span className="font-extrabold text-emerald-400">{importSummary.added}</span> طلب جديد لقاعدة البيانات، وتم كشف وتجاهل <span className="font-bold text-amber-400">{importSummary.skipped}</span> طلب مكرر.
                </p>
              </div>
              <button
                onClick={resetModalState}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30"
              >
                إنهاء وإغلاق
              </button>
            </div>
          ) : (
            <>
              {/* File Upload Drop Area */}
              {!file ? (
                <div className="border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 rounded-2xl p-8 text-center bg-slate-900/60 transition group cursor-pointer relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-emerald-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-white text-sm">اضغط أو اسحب ملف Excel هنا</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    يدعم الملفات بصيغة (.xlsx, .xls, .csv). سيتم التعرف على الأعمدة وتجاوز البيانات المكررة تلقائياً.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected File Details */}
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
                      <div>
                        <div className="font-bold text-white text-xs">{file.name}</div>
                        <div className="text-[11px] text-slate-400">
                          {(file.size / 1024).toFixed(1)} KB • إجمالي المعالجة: {parsedRows.length} صف
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null);
                        setParsedRows([]);
                      }}
                      className="text-xs text-slate-400 hover:text-rose-400 transition underline"
                    >
                      تغيير الملف
                    </button>
                  </div>

                  {/* Deduplication Summary Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <div className="text-xl font-extrabold text-emerald-400">{newCount}</div>
                        <div className="text-[11px] text-emerald-300 font-medium">طلبات جديدة سريعة للاستيراد</div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-xl font-extrabold text-amber-400">{duplicateCount}</div>
                        <div className="text-[11px] text-amber-300 font-medium">مكررة (سيتم الفلترة والتجاهل)</div>
                      </div>
                    </div>
                  </div>

                  {/* Parsed Rows Preview Table */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-right text-[11px]">
                      <thead className="bg-slate-900 text-slate-400 sticky top-0 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">رقم الطلب</th>
                          <th className="py-2.5 px-3">اسم العميل</th>
                          <th className="py-2.5 px-3">الجوال</th>
                          <th className="py-2.5 px-3">التصنيف</th>
                          <th className="py-2.5 px-3">نوع العقار</th>
                          <th className="py-2.5 px-3">حالة المطابقة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-200">
                        {parsedRows.map((row, i) => (
                          <tr
                            key={i}
                            className={row.isDuplicate ? 'bg-amber-500/5 opacity-70' : 'hover:bg-slate-800/30'}
                          >
                            <td className="py-2 px-3 font-mono text-sky-400">{row.order_number || 'توليد تلقائي'}</td>
                            <td className="py-2 px-3 font-bold">{row.client_name}</td>
                            <td className="py-2 px-3 dir-ltr">{row.client_phone}</td>
                            <td className="py-2 px-3">
                              {row.category === 'RESIDENTIAL' ? (
                                <span className="text-sky-400">سكني</span>
                              ) : (
                                <span className="text-purple-400">تجاري</span>
                              )}
                            </td>
                            <td className="py-2 px-3">{row.building_type}</td>
                            <td className="py-2 px-3">
                              {row.isDuplicate ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                                  <XCircle className="w-3 h-3" />
                                  مكرر (يتجاوز)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  جديد للاستيراد
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!importSummary && (
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 shrink-0">
            <button
              onClick={resetModalState}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              إلغاء
            </button>

            {file && parsedRows.length > 0 && (
              <button
                onClick={handleConfirmImport}
                disabled={isImporting || newCount === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/30"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري ترحيل وحفظ الطلبات...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4" />
                    <span>تأكيد استيراد ({newCount}) طلب جديد</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
