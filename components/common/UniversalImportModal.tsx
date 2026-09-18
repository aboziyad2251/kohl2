'use client';

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Info,
} from 'lucide-react';

interface UniversalImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  expectedColumns: string[];
  sampleDataRow?: Record<string, any>;
  onImportSuccess: (importedRows: any[]) => void;
}

export default function UniversalImportModal({
  isOpen,
  onClose,
  title,
  expectedColumns,
  sampleDataRow,
  onImportSuccess,
}: UniversalImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    processFile(selected);
  };

  const processFile = (fileObj: File) => {
    setErrorMsg('');
    setFile(fileObj);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (!data || data.length === 0) {
          setErrorMsg('الملف فارغ أو لا يحتوي على بيانات.');
          setIsLoading(false);
          return;
        }

        const rawHeaders = (data[0] || []).map((h: any) => String(h || '').trim());
        const rows = data.slice(1).filter((r) => r.some((c) => c !== undefined && c !== null && c !== ''));

        if (rows.length === 0) {
          setErrorMsg('لم يتم العثور على صفوف بيانات أسفل عناوين الأعمدة.');
          setIsLoading(false);
          return;
        }

        const formattedRows = rows.map((r, rowIdx) => {
          const rowObj: Record<string, any> = { _rowId: rowIdx + 1 };
          rawHeaders.forEach((h, colIdx) => {
            rowObj[h] = r[colIdx] !== undefined ? r[colIdx] : '';
          });
          return rowObj;
        });

        setHeaders(rawHeaders);
        setParsedRows(formattedRows);
        setIsLoading(false);
      } catch (err: any) {
        console.error('Import parse error:', err);
        setErrorMsg('تعذر قراءة الملف. تأكد من أنه بصيغة Excel أو CSV صالحة.');
        setIsLoading(false);
      }
    };

    reader.onerror = () => {
      setErrorMsg('حدث خطأ أثناء تحميل الملف.');
      setIsLoading(false);
    };

    reader.readAsBinaryString(fileObj);
  };

  const downloadSampleTemplate = () => {
    const sample = sampleDataRow || expectedColumns.reduce((acc, col) => ({ ...acc, [col]: '' }), {});
    const ws = XLSX.utils.json_to_sheet([sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_template.xlsx`);
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;
    onImportSuccess(parsedRows);
    setIsDone(true);
    setTimeout(() => {
      setIsDone(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">{title}</h3>
              <p className="text-xs text-slate-400">استيراد جماعي من ملف Excel (.xlsx, .xls) أو CSV</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Instructions & Template Download */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-semibold text-slate-200 block mb-0.5">الأعمدة المتوقعة في الملف:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {expectedColumns.map((col, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-400 text-[11px] font-mono">
                    {col}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={downloadSampleTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>تحميل قالب Excel</span>
            </button>
          </div>

          {/* File Upload Drop Area */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls,.csv"
            className="hidden"
          />

          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-sky-500/60 rounded-2xl p-8 text-center cursor-pointer bg-slate-800/30 hover:bg-slate-800/60 transition group"
            >
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">انقر لاختيار ملف أو قم بسحبه وإفلاته هنا</p>
              <p className="text-xs text-slate-400 mt-1">يدعم ملفات XLSX, XLS, CSV بحد أقصى 10 ميغابايت</p>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
                <div>
                  <div className="text-sm font-bold text-white">{file.name}</div>
                  <div className="text-xs text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB | عدد السجلات المقروءة: {parsedRows.length}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setParsedRows([]);
                  setHeaders([]);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium"
              >
                إلغاء واختيار ملف آخر
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview of Parsed Rows */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>معاينة البيانات (أول 5 صفوف):</span>
                <span className="text-emerald-400 font-bold">جاهز للاستيراد ({parsedRows.length} سجل)</span>
              </div>
              <div className="border border-slate-700 rounded-xl overflow-x-auto max-h-48">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-800 text-slate-300 sticky top-0 border-b border-slate-700">
                    <tr>
                      <th className="p-2">#</th>
                      {headers.slice(0, 5).map((h, i) => (
                        <th key={i} className="p-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="p-2 text-slate-400">{row._rowId}</td>
                        {headers.slice(0, 5).map((h, i) => (
                          <td key={i} className="p-2 whitespace-nowrap max-w-[150px] truncate">
                            {String(row[h] || '-')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={parsedRows.length === 0 || isLoading || isDone}
            onClick={handleConfirmImport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
          >
            {isDone ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>تم الاستيراد بنجاح!</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                <span>تأكيد استيراد ({parsedRows.length}) سجل</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
