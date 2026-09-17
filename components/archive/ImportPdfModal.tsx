'use client';

import React, { useState, useRef } from 'react';
import {
  ArchivedDocument,
  ArchivedDocumentCategory,
  ArchivedDocumentStatus,
} from '@/lib/types';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileUp,
  Tag,
  Calendar,
  Building,
  Hash,
  Info,
} from 'lucide-react';

interface ImportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDoc: ArchivedDocument) => void;
}

const CATEGORY_OPTIONS: { value: ArchivedDocumentCategory; label: string }[] = [
  { value: 'CONTRACT', label: 'عقد إيجار موحد' },
  { value: 'DEED', label: 'صك ملكية إلكتروني' },
  { value: 'BROKERAGE', label: 'اتفاقية وساطة عقارية' },
  { value: 'EPOA', label: 'وكالة شرعية (ناجز)' },
  { value: 'GENERAL_SERVICE', label: 'خدمة عامة / معاملة حكومية' },
  { value: 'CUSTOMER_ORDER', label: 'طلب عميل عقاري' },
  { value: 'FINANCIAL', label: 'سند قبض / تقرير مالي' },
  { value: 'MAINTENANCE', label: 'أمر صيانة وتكلفة' },
  { value: 'OTHER', label: 'مستند ووثيقة أخرى' },
];

export default function ImportPdfModal({
  isOpen,
  onClose,
  onSuccess,
}: ImportPdfModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ArchivedDocumentCategory>('CONTRACT');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [clientOrEntity, setClientOrEntity] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<ArchivedDocumentStatus>('ACTIVE');
  const [tagsInput, setTagsInput] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('يرجى اختيار ملف بصيغة PDF فقط (.pdf)');
      return;
    }

    if (selectedFile.size > 15 * 1024 * 1024) {
      setErrorMsg('حجم الملف كبير جداً (الحد الأقصى المسموح 15 ميجابايت)');
      return;
    }

    setErrorMsg('');
    setFile(selectedFile);

    // Auto-populate title if empty
    if (!title) {
      const cleanName = selectedFile.name.replace(/\.pdf$/i, '');
      setTitle(cleanName);
    }

    // Read file as Base64 Data URL for local preview/storage
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(reader.result as string);
    };
    reader.onerror = () => {
      setErrorMsg('تعذر قراءة ملف PDF. يرجى تجربة ملف آخر.');
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('يرجى إدخال عنوان الوثيقة');
      return;
    }
    if (!referenceNumber.trim()) {
      setErrorMsg('يرجى إدخال رقم الوثيقة أو المرجع');
      return;
    }
    if (!clientOrEntity.trim()) {
      setErrorMsg('يرجى إدخال اسم العميل أو المالك أو الجهة');
      return;
    }

    setIsSubmitting(true);

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const archiveCode = `ARC-${new Date().getFullYear()}-${randomSuffix}`;
    const tags = tagsInput
      .split(/[,،]/)
      .map((t) => t.trim())
      .filter(Boolean);

    const newDoc: ArchivedDocument = {
      id: `arc-${Date.now()}-${randomSuffix}`,
      archive_code: archiveCode,
      title: title.trim(),
      category,
      reference_number: referenceNumber.trim(),
      client_or_entity: clientOrEntity.trim(),
      date,
      status,
      file_name: file ? file.name : undefined,
      file_size: file ? file.size : undefined,
      file_data_url: fileDataUrl || undefined,
      notes: notes.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
      source_module: 'MANUAL_IMPORT',
      created_at: new Date().toISOString(),
    };

    onSuccess(newDoc);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">استيراد وأرشفة وثيقة PDF</h3>
              <p className="text-xs text-slate-400">
                رفع ملف PDF وتوثيقه في الأرشيف الإلكتروني المركزي
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* PDF Drag and Drop Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              ملف الوثيقة (PDF)
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-sky-500 bg-sky-500/10'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      الحجم: {(file.size / 1024).toFixed(1)} ك.ب • جاهز للمعاينة والأرشفة
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800 text-sky-400 border border-slate-700 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-200">
                    اضغط لاختيار ملف PDF أو اسحبه وأفلته هنا
                  </p>
                  <p className="text-xs text-slate-400">
                    يدعم ملفات PDF الممسوحة ضوئياً، العقود، والصكوك (حتى 15 ميجابايت)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Document Title & Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                عنوان الوثيقة <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: عقد إيجار موحد - شقة 104"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                تصنيف الوثيقة <span className="text-red-400">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ArchivedDocumentCategory)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <option key={cat.value} value={cat.value} className="bg-slate-900 text-white">
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reference Number & Client/Entity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                رقم الوثيقة / المرجع <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="رقم الصك أو العقد أو المعاملة..."
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                العميل / المالك / الجهة <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={clientOrEntity}
                onChange={(e) => setClientOrEntity(e.target.value)}
                placeholder="اسم الطرف المرتبط بالوثيقة..."
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                required
              />
            </div>
          </div>

          {/* Date & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                تاريخ الوثيقة / الأرشفة
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                حالة الوثيقة
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ArchivedDocumentStatus)}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-sky-500 transition"
              >
                <option value="ACTIVE" className="bg-slate-900 text-white">ساري وموثق</option>
                <option value="ARCHIVED" className="bg-slate-900 text-white">مؤرشف</option>
                <option value="EXPIRED" className="bg-slate-900 text-white">منتهي الصلاحية</option>
              </select>
            </div>
          </div>

          {/* Tags & Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              الوسوم التصنيفية (مفصولة بفواصل)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="مثال: إيجار, تجاري, جدة, معتمد"
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              ملاحظات وتفاصيل إضافية
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي شروط أو ملحوظات خاصة بالأرشفة..."
              className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 rounded-xl shadow-lg shadow-sky-600/20 transition disabled:opacity-50"
            >
              {isSubmitting ? 'جاري الأرشفة...' : 'حفظ في الأرشيف'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
