'use client';

import React, { useState } from 'react';
import {
  X,
  UserCheck,
  CheckCircle2,
  Calendar,
  AlertCircle,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { TaskDelegation } from '@/lib/types';

interface TaskDelegatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TaskDelegatorModal({ isOpen, onClose }: TaskDelegatorModalProps) {
  const { employees, addTaskDelegation } = useData();
  const { currentUser } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedEmployeeId, setAssignedEmployeeId] = useState(employees[0]?.id || '');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [isDelegatedAction, setIsDelegatedAction] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('يرجى كتابة عنوان المهمة أو التفويض');
      return;
    }

    const assignedEmp = employees.find((e) => e.id === assignedEmployeeId);
    if (!assignedEmp) {
      setErrorMsg('يرجى اختيار الموظف المفوض');
      return;
    }

    setIsSubmitting(true);
    try {
      const codeNum = Math.floor(100 + Math.random() * 900);
      const newTask: TaskDelegation = {
        id: `tsk-${Date.now()}`,
        task_code: `TSK-2026-${codeNum}`,
        title,
        description,
        assigned_to_employee_id: assignedEmp.id,
        assigned_to_name: assignedEmp.name,
        delegated_by_id: currentUser.id,
        delegated_by_name: `${currentUser.name} (${currentUser.role})`,
        priority,
        due_date: dueDate,
        status: 'PENDING',
        is_delegated_action: isDelegatedAction,
        notes,
        created_at: new Date().toISOString(),
      };

      await addTaskDelegation(newTask);
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1200);
    } catch (e: any) {
      setErrorMsg(e.message || 'حدث خطأ أثناء حفظ التفويض');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تفويض مهمة أو نيابة إدارية</h3>
              <p className="text-xs text-slate-400">صلاحية خاصة بالإدارة العليا (Admin / CEO)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-semibold mb-1">عنوان المهمة / الإجراء المفوض *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: استكمال إفراغ صك عقار، أو توقيع ملحق عقد بالنيابة..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">الموظف المفوض إليه *</label>
              <select
                value={assignedEmployeeId}
                onChange={(e) => setAssignedEmployeeId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.job_title})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">تاريخ الاستحقاق *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">مستوى الأولوية</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition"
              >
                <option value="HIGH">عالية جداً (عاجل)</option>
                <option value="MEDIUM">متوسطة (اعتيادي)</option>
                <option value="LOW">منخفضة</option>
              </select>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 cursor-pointer text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={isDelegatedAction}
                  onChange={(e) => setIsDelegatedAction(e.target.checked)}
                  className="rounded bg-slate-700 text-amber-500 focus:ring-0"
                />
                <span className="text-[11px] font-medium">تنفيذ وتوقيع بالنيابة الرسمية</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">تفاصيل وصلاحية التفويض</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب حدود الصلاحية المفوضة والتعليمات الموجهة للموظف..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">ملاحظات إدارية داخلية</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات سرية أو أرقام معنية..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold shadow-lg shadow-amber-600/20 transition disabled:opacity-50"
            >
              {isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم إصدار التفويض بنجاح!</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'جارٍ الحفظ...' : 'اعتماد وإرسال التفويض'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
