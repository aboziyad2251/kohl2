'use client';

import React, { useState } from 'react';
import {
  FileSignature,
  Plus,
  Search,
  Filter,
  Building,
  Building2,
  ShieldCheck,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
  Trash2,
  Pencil,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { Contract, Property } from '@/lib/types';
import ContractWizard from '@/components/contracts/ContractWizard';
import EditContractModal from '@/components/contracts/EditContractModal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';

export default function ContractsPage() {
  const { contracts, properties, lessors, tenants, addContract, updateContract, deleteContract, addTenant } = useData();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals & Drawers
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Filtered Contracts Logic
  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      contract.contract_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.tenant_national_id.includes(searchQuery);

    const matchesType = typeFilter === 'ALL' || contract.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' || contract.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleContractCreated = (newContract: Contract) => {
    addContract(newContract);
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteContract(deleteTarget.id);
      if (selectedContract?.id === deleteTarget.id) {
        setSelectedContract(null);
      }
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
            <FileSignature className="w-4 h-4" />
            <span>إدارة عقود الإيجار المعتمدة</span>
          </div>
          <h1 className="text-2xl font-bold text-white">مركز العقود والإيجارات (منصة إيجار)</h1>
          <p className="text-xs text-slate-400 mt-1">
            عرض وتصنيف عقود الإيجار (السكنية والتجارية ومن الباطن) وإصدار عقود جديدة موثقة.
          </p>
        </div>

        <button
          onClick={() => setIsWizardOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-sky-600/30"
        >
          <Plus className="w-4 h-4" />
          <span>إنشاء عقد إيجار جديد</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl glass-panel flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث برقم العقد، اسم المستأجر، الهوية..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">جميع أنواع العقود</option>
              <option value="RESIDENTIAL">عقود سكنية</option>
              <option value="COMMERCIAL">عقود تجارية</option>
              <option value="SUBLEASE">عقود من الباطن</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="Active">نشط (Active)</option>
            <option value="Draft">مسودة (Draft)</option>
            <option value="Expired">منتهي (Expired)</option>
            <option value="Terminated">ملغى (Terminated)</option>
          </select>
        </div>
      </div>

      {/* Contracts Table */}
      <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
              <tr>
                <th className="p-4">رقم العقد</th>
                <th className="p-4">نوع العقد</th>
                <th className="p-4">العقار</th>
                <th className="p-4">المستأجر</th>
                <th className="p-4">القيمة السنوية</th>
                <th className="p-4">المستقطع الإجمالي (للمالك)</th>
                <th className="p-4 font-bold text-amber-400">ربح المكتب من العقد</th>
                <th className="p-4">جدول الدفعات</th>
                <th className="p-4">تاريخ البداية والنهاية</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => {
                  const property = properties.find((p) => p.id === contract.property_id);
                  const collected = contract.total_collected_amount || contract.rent_amount;
                  const profit = contract.office_profit || 0;

                  return (
                    <tr key={contract.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-sky-400 dir-ltr text-right">
                        {contract.contract_number}
                      </td>

                      <td className="p-4">
                        {contract.type === 'RESIDENTIAL' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/30 text-[11px] font-semibold">
                            <Building className="w-3.5 h-3.5" />
                            سكني
                          </span>
                        )}
                        {contract.type === 'COMMERCIAL' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-semibold">
                            <Building2 className="w-3.5 h-3.5" />
                            تجاري
                          </span>
                        )}
                        {contract.type === 'SUBLEASE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px] font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            من الباطن
                          </span>
                        )}
                      </td>

                      <td className="p-4 font-medium text-slate-200">
                        {property?.title || 'عقار غير مسجل'}
                      </td>

                      <td className="p-4">
                        <div className="font-semibold text-white">{contract.tenant_name}</div>
                        <div className="text-[10px] text-slate-400">هوية: {contract.tenant_national_id}</div>
                      </td>

                      <td className="p-4 font-bold text-emerald-400">
                        {contract.rent_amount.toLocaleString('ar-SA')} ر.س
                      </td>

                      <td className="p-4 font-semibold text-slate-300">
                        {collected.toLocaleString('ar-SA')} ر.س
                      </td>

                      <td className="p-4 font-extrabold text-amber-400">
                        {profit > 0 ? `${profit.toLocaleString('ar-SA')} ر.س` : '0 ر.س'}
                      </td>

                      <td className="p-4 text-slate-300">
                        {contract.payment_schedule === 'Monthly' && 'شهري (12 دفعة)'}
                        {contract.payment_schedule === 'Quarterly' && 'ربع سنوي (4 دفعات)'}
                        {contract.payment_schedule === 'Semi-Annual' && 'نصف سنوي (دفعتان)'}
                        {contract.payment_schedule === 'Annual' && 'سنوي (دفعة واحدة)'}
                      </td>

                      <td className="p-4 text-[11px] text-slate-300">
                        <div>من: {contract.start_date}</div>
                        <div>إلى: {contract.end_date}</div>
                      </td>

                      <td className="p-4">
                        {contract.status === 'Active' && (
                          <span className="px-2.5 py-1 rounded-md badge-active text-[11px] font-bold">
                            نشط
                          </span>
                        )}
                        {contract.status === 'Draft' && (
                          <span className="px-2.5 py-1 rounded-md badge-draft text-[11px] font-bold">
                            مسودة
                          </span>
                        )}
                      </td>

                      <td className="p-4 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => setSelectedContract(contract)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditContract(contract)}
                          className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition"
                          title="تعديل العقد"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              id: contract.id,
                              name: `عقد ${contract.contract_number} (${contract.tenant_name})`,
                            })
                          }
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                          title="حذف العقد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500 text-xs">
                    لا توجد عقود مطابقة لخيارات البحث المحددة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contract Detail Modal Drawer */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  {selectedContract.type}
                </span>
                <h3 className="font-bold text-white text-base mt-1">{selectedContract.contract_number}</h3>
              </div>
              <button
                onClick={() => setSelectedContract(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

              <div className="space-y-3 text-xs text-slate-300">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[11px]">المستأجر:</span>
                    <span className="font-bold text-white">{selectedContract.tenant_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">الهوية / السجل:</span>
                    <span className="font-medium text-slate-200">{selectedContract.tenant_national_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">الإيجار السنوي:</span>
                    <span className="font-bold text-emerald-400">{selectedContract.rent_amount.toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">دورية الدفع:</span>
                    <span className="font-medium text-slate-200">{selectedContract.payment_schedule}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">المستقطع الإجمالي (للمالك):</span>
                    <span className="font-semibold text-slate-200">{(selectedContract.total_collected_amount || selectedContract.rent_amount).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                  <div>
                    <span className="text-amber-400 block text-[11px]">ربح المكتب الفعلي:</span>
                    <span className="font-extrabold text-amber-300">{(selectedContract.office_profit || 0).toLocaleString('ar-SA')} ر.س</span>
                  </div>
                </div>

                {/* Security Deposit & Lessor Requirements */}
                {(selectedContract.security_deposit_amount || selectedContract.lessor_requirements) && (
                  <div className="p-3 rounded-xl bg-sky-950/40 border border-sky-500/30 space-y-2">
                    {selectedContract.security_deposit_amount && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-sky-300 font-medium">🛡️ مبلغ التأمين المسترد:</span>
                        <span className="font-bold text-white">{selectedContract.security_deposit_amount.toLocaleString('ar-SA')} ر.س</span>
                      </div>
                    )}
                    {selectedContract.lessor_requirements && (
                      <div className="text-xs pt-1 border-t border-sky-500/20">
                        <span className="text-sky-400 font-bold block mb-0.5">📝 طلب وشروط خاصة من المؤجر:</span>
                        <span className="text-slate-200 leading-relaxed">{selectedContract.lessor_requirements}</span>
                      </div>
                    )}
                  </div>
                )}

                {selectedContract.business_activity && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    <span className="font-bold block">النشاط التجاري:</span>
                    <span>{selectedContract.business_activity} (الرقم الضريبي: {selectedContract.vat_number || 'غير مدخل'})</span>
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                  <span>تاريخ التوثيق: {selectedContract.start_date}</span>
                  <span>تاريخ الانتهاء: {selectedContract.end_date}</span>
                </div>
              </div>

            <div className="pt-2 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const target = selectedContract;
                    setSelectedContract(null);
                    setEditContract(target);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>تعديل العقد</span>
                </button>
                <button
                  onClick={() =>
                    setDeleteTarget({
                      id: selectedContract.id,
                      name: `عقد ${selectedContract.contract_number} (${selectedContract.tenant_name})`,
                    })
                  }
                  className="px-3.5 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف العقد</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedContract(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Wizard Creation Modal */}
      <ContractWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        properties={properties}
        tenants={tenants}
        onAddTenant={addTenant}
        onSuccess={handleContractCreated}
      />

      <EditContractModal
        isOpen={!!editContract}
        onClose={() => setEditContract(null)}
        contract={editContract}
        properties={properties}
        lessors={lessors}
        onSuccess={updateContract}
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
