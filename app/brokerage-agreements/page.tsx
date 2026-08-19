'use client';

import React, { useState } from 'react';
import {
  FileCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Percent,
  Calendar,
  Eye,
  Building,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { BrokerageAgreement, Property } from '@/lib/types';
import NewBrokerageAgreementModal from '@/components/brokerage/NewBrokerageAgreementModal';
import EditBrokerageModal from '@/components/contracts/EditBrokerageModal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';

export default function BrokerageAgreementsPage() {
  const { brokerageAgreements, properties, lessors, addBrokerageAgreement, updateBrokerageAgreement, deleteBrokerageAgreement } = useData();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editAgreement, setEditAgreement] = useState<BrokerageAgreement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const filteredAgreements = brokerageAgreements.filter((agreement) => {
    const matchesSearch =
      agreement.agreement_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (agreement.property?.title && agreement.property.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || agreement.ejar_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleAgreementCreated = (newAgreement: BrokerageAgreement) => {
    addBrokerageAgreement(newAgreement);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteBrokerageAgreement(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-teal-400 text-xs font-bold mb-1">
            <FileCheck className="w-4 h-4" />
            <span>منصة إيجار - شبكة الوساطة العقارية</span>
          </div>
          <h1 className="text-2xl font-bold text-white">سجل اتفاقيات الوساطة العقارية</h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة اتفاقيات الوساطة المعتمدة لدى إيجار، تتبع نسب السعي وصلاحية التثبيت.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-teal-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء اتفاقية وساطة جديدة</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-4 rounded-2xl glass-panel flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم الاتفاقية أو اسم العقار..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-teal-500"
          >
            <option value="ALL">جميع حالات إيجار</option>
            <option value="Active">مفعل في إيجار (Active)</option>
            <option value="Pending">قيد الاعتماد (Pending)</option>
            <option value="Cancelled">ملغى (Cancelled)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="p-4">رقم الاتفاقية (إيجار)</th>
                <th className="p-4">العقار</th>
                <th className="p-4">المالك / المؤجر</th>
                <th className="p-4">نسبة السعي %</th>
                <th className="p-4 font-bold text-amber-400">ربح المكتب من الوساطة</th>
                <th className="p-4">صلاحية الاتفاقية</th>
                <th className="p-4 text-center">حالة إيجار والإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredAgreements.map((agreement) => {
                const property = properties.find((p) => p.id === agreement.property_id);
                const profit = agreement.office_profit || 0;

                return (
                  <tr key={agreement.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-bold text-teal-400 dir-ltr text-right">
                      {agreement.agreement_number}
                    </td>

                    <td className="p-4 font-semibold text-white">
                      {property?.title || 'عقار مسجل'}
                    </td>

                    <td className="p-4 font-medium text-slate-200">
                      {property?.lessor?.name || 'مؤجر مسجل'}
                    </td>

                    <td className="p-4 font-bold text-emerald-400">
                      {agreement.commission_rate}%
                    </td>

                    <td className="p-4 font-extrabold text-amber-400">
                      {profit > 0 ? `${profit.toLocaleString('ar-SA')} ر.س` : '0 ر.س'}
                    </td>

                    <td className="p-4 text-slate-300">
                      من {agreement.start_date} إلى {agreement.expiry_date}
                    </td>

                    <td className="p-4 text-center flex items-center justify-center gap-2">
                      <span className="px-2.5 py-1 rounded-md badge-active text-[11px] font-bold">
                        {agreement.ejar_status}
                      </span>
                      <button
                        onClick={() => setEditAgreement(agreement)}
                        className="p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition"
                        title="تعديل الاتفاقية"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            id: agreement.id,
                            name: `اتفاقية وساطة ${agreement.agreement_number}`,
                          })
                        }
                        className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                        title="حذف الاتفاقية"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <NewBrokerageAgreementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        properties={properties}
        onSuccess={handleAgreementCreated}
      />

      <EditBrokerageModal
        isOpen={!!editAgreement}
        onClose={() => setEditAgreement(null)}
        agreement={editAgreement}
        properties={properties}
        lessors={lessors}
        onSuccess={updateBrokerageAgreement}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        itemName={deleteTarget?.name}
      />
    </div>
  );
}
