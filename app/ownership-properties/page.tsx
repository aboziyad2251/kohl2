'use client';

import React, { useState } from 'react';
import {
  Building2,
  FileText,
  ShieldCheck,
  Plus,
  UserCheck,
  ArrowRightLeft,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Trash2,
  UserPlus,
  Users,
  Briefcase,
  RotateCcw,
  Pencil,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { Property, OwnershipDocument, EPoa, Lessor, Representative, Tenant, OwnershipAuditLog } from '@/lib/types';
import AddDocumentPropertyModal from '@/components/ownership/AddDocumentPropertyModal';
import ChangeRepresentativeModal from '@/components/ownership/ChangeRepresentativeModal';
import ChangeLessorModal from '@/components/ownership/ChangeLessorModal';
import AddLessorModal from '@/components/ownership/AddLessorModal';
import AddRepresentativeModal from '@/components/ownership/AddRepresentativeModal';
import AddEPoaModal from '@/components/ownership/AddEPoaModal';
import AddTenantModal from '@/components/ownership/AddTenantModal';
import EditPropertyModal from '@/components/ownership/EditPropertyModal';
import EditLessorModal from '@/components/ownership/EditLessorModal';
import EditTenantModal from '@/components/ownership/EditTenantModal';
import EditRepresentativeModal from '@/components/ownership/EditRepresentativeModal';
import EditDocumentModal from '@/components/ownership/EditDocumentModal';
import EditEPoaModal from '@/components/ownership/EditEPoaModal';
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal';

export default function OwnershipPropertiesPage() {
  const {
    properties,
    documents,
    ePoas,
    lessors,
    tenants,
    representatives,
    auditLogs,
    addProperty,
    updateProperty,
    deleteProperty,
    updateDocument,
    deleteDocument,
    addLessor,
    updateLessor,
    deleteLessor,
    addTenant,
    updateTenant,
    deleteTenant,
    addRepresentative,
    updateRepresentative,
    deleteRepresentative,
    addEPoa,
    updateEPoa,
    deleteEPoa,
    resetToDefaults,
  } = useData();

  const [activeTab, setActiveTab] = useState<'properties' | 'documents' | 'epoa' | 'lessors' | 'tenants' | 'representatives' | 'audit'>('properties');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Workflow Modal States
  const [isAddDocPropModalOpen, setIsAddDocPropModalOpen] = useState(false);
  const [isChangeRepModalOpen, setIsChangeRepModalOpen] = useState(false);
  const [isChangeLessorModalOpen, setIsChangeLessorModalOpen] = useState(false);
  const [isAddLessorModalOpen, setIsAddLessorModalOpen] = useState(false);
  const [isAddTenantModalOpen, setIsAddTenantModalOpen] = useState(false);
  const [isAddRepModalOpen, setIsAddRepModalOpen] = useState(false);
  const [isAddEPoaModalOpen, setIsAddEPoaModalOpen] = useState(false);

  // Edit Modal States
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [editLessor, setEditLessor] = useState<Lessor | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [editRepresentative, setEditRepresentative] = useState<Representative | null>(null);
  const [editDocument, setEditDocument] = useState<OwnershipDocument | null>(null);
  const [editEPoa, setEditEPoa] = useState<EPoa | null>(null);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'property' | 'document' | 'lessor' | 'representative' | 'epoa';
    id: string;
    name: string;
  } | null>(null);

  // Attachment preview
  const [viewingDoc, setViewingDoc] = useState<OwnershipDocument | null>(null);

  const handleAddDocPropSuccess = (newProp: Property, newDoc: OwnershipDocument) => {
    addProperty(newProp, newDoc);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;

    switch (deleteTarget.type) {
      case 'property':
        deleteProperty(deleteTarget.id);
        break;
      case 'document':
        deleteDocument(deleteTarget.id);
        break;
      case 'lessor':
        deleteLessor(deleteTarget.id);
        break;
      case 'representative':
        deleteRepresentative(deleteTarget.id);
        break;
      case 'epoa':
        deleteEPoa(deleteTarget.id);
        break;
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Page Header & Workflow Action Toolbar */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
            <Building2 className="w-4 h-4" />
            <span>إدارة صكوك الملكية والسجلات</span>
          </div>
          <h1 className="text-2xl font-bold text-white">إدارة الملكية والعقارات والوكالات</h1>
          <p className="text-xs text-slate-400 mt-1">
            توثيق صكوك الملكية الرسمية، أسطول العقارات والمباني، وإجراءات نقل الملكية وتغيير الممثلين القانونيين.
          </p>
        </div>

        {/* Workflow Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsAddDocPropModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صك ملكية وعقار</span>
          </button>

          <button
            onClick={() => setIsAddLessorModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة مالك / مؤجر</span>
          </button>

          <button
            onClick={() => setIsAddRepModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-600/20"
          >
            <Users className="w-4 h-4" />
            <span>إضافة ممثل / وكيل</span>
          </button>

          <button
            onClick={() => setIsAddEPoaModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>إضافة E-POA</span>
          </button>

          <button
            onClick={resetToDefaults}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition flex items-center gap-1.5 border border-slate-700"
            title="إعادة تعيين البيانات الافتراضية"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الأمثلة</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('properties')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'properties'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>سجل العقارات ({properties.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'documents'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>صكوك الملكية ({documents.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('epoa')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'epoa'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>الوكالات E-POAs ({ePoas.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('lessors')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'lessors'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>سجل المؤجرين ({lessors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tenants')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'tenants'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>سجل المستأجرين ({tenants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('representatives')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'representatives'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>سجل الوكلاء ({representatives.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`pb-3 px-4 text-xs font-bold transition flex items-center gap-2 border-b-2 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>سجل التدقيق ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: PROPERTIES REGISTRY */}
      {activeTab === 'properties' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {properties.map((prop) => (
              <div
                key={prop.id}
                className="p-5 rounded-2xl glass-panel glass-panel-hover space-y-4 border border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="font-bold text-sm text-white">{prop.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/20 text-sky-300">
                      {prop.property_type}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">المدينة والعنوان:</span>
                      <span className="font-medium text-slate-200">{prop.city} - {prop.address}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">عدد الوحدات:</span>
                      <span className="font-semibold text-sky-400">{prop.units_count} وحدة</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">المالك / المؤجر:</span>
                      <span className="font-semibold text-purple-300">{prop.lessor?.name || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">الوكيل / الممثل الحالي:</span>
                      <span className="font-semibold text-amber-300">{prop.current_representative?.name || 'لا يوجد وكيل'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">صك الملكية: {prop.ownership_document?.document_number || 'مسجل'}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditProperty(prop)}
                      className="p-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition"
                      title="تعديل العقار"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setIsChangeRepModalOpen(true)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] transition"
                      title="تغيير الوكيل"
                    >
                      وكيل
                    </button>
                    <button
                      onClick={() => setIsChangeLessorModalOpen(true)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-purple-400 text-[11px] transition"
                      title="نقل الملكية"
                    >
                      نقل
                    </button>
                    <button
                      onClick={() =>
                        setDeleteTarget({
                          type: 'property',
                          id: prop.id,
                          name: prop.title,
                        })
                      }
                      className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                      title="حذف العقار"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: OWNERSHIP DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-4">رقم صك الملكية</th>
                  <th className="p-4">تاريخ الإصدار</th>
                  <th className="p-4">المالك / المؤجر المسجل</th>
                  <th className="p-4">العقارات المرتبطة</th>
                  <th className="p-4 text-center">المستند والإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {documents.map((doc) => {
                  const linkedProps = properties.filter((p) => p.ownership_document_id === doc.id);

                  return (
                    <tr key={doc.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-sky-400">{doc.document_number}</td>
                      <td className="p-4 text-slate-300">{doc.issue_date}</td>
                      <td className="p-4 font-medium text-white">{doc.lessor?.name || 'مؤجر مسجل'}</td>
                      <td className="p-4 text-slate-300">
                        {linkedProps.map((p) => p.title).join('، ') || 'غير مرتبط حالياً'}
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => setViewingDoc(doc)}
                          className="px-3 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs transition inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </button>
                        <button
                          onClick={() => setEditDocument(doc)}
                          className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition"
                          title="تعديل الصك"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: 'document',
                              id: doc.id,
                              name: `صك رقم ${doc.document_number}`,
                            })
                          }
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                          title="حذف الصك"
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
      )}

      {/* TAB 3: E-POAS */}
      {activeTab === 'epoa' && (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-4">رقم الوكالة E-POA</th>
                  <th className="p-4">المؤجر (المُوكّل)</th>
                  <th className="p-4">الوكيل (الممثل)</th>
                  <th className="p-4">تاريخ الانتهاء والإنشاء</th>
                  <th className="p-4">تفاصيل الصلاحية والتفويض</th>
                  <th className="p-4 text-center">الحالة والإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ePoas.map((poa) => {
                  const grantor = lessors.find((l) => l.id === poa.grantor_id);
                  const attorney = representatives.find((r) => r.id === poa.attorney_id);

                  return (
                    <tr key={poa.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-amber-400 dir-ltr text-right">{poa.poa_number}</td>
                      <td className="p-4 font-medium text-white">{grantor?.name || 'مؤجر'}</td>
                      <td className="p-4 font-medium text-slate-200">{attorney?.name || 'وكيل'}</td>
                      <td className="p-4">
                        <div className="text-slate-300 font-semibold">{poa.expiry_date}</div>
                        <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>سارية الصلاحية</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-400 text-[11px] max-w-xs">{poa.scope_details}</td>
                      <td className="p-4 text-center flex items-center justify-center gap-2">
                        <span className="px-2.5 py-1 rounded-md badge-active text-[11px] font-bold">
                          {poa.status}
                        </span>
                        <button
                          onClick={() => setEditEPoa(poa)}
                          className="p-1.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition"
                          title="تعديل الوكالة"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: 'epoa',
                              id: poa.id,
                              name: `الوكالة رقم ${poa.poa_number}`,
                            })
                          }
                          className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                          title="حذف الوكالة"
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
      )}

      {/* TAB 4: LESSORS REGISTRY */}
      {activeTab === 'lessors' && (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-4">اسم المالك / المؤجر</th>
                  <th className="p-4">الهوية الوطنية / السجل التجاري CR</th>
                  <th className="p-4">رقم الجوال</th>
                  <th className="p-4">البريد الإلكتروني</th>
                  <th className="p-4">العقارات المملوكة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {lessors.map((lessor) => {
                  const ownedProps = properties.filter((p) => p.lessor_id === lessor.id);

                  return (
                    <tr key={lessor.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-white">{lessor.name}</td>
                      <td className="p-4 font-mono text-purple-300 dir-ltr text-right">{lessor.national_id_or_cr}</td>
                      <td className="p-4 font-mono text-slate-300 dir-ltr text-right">{lessor.phone}</td>
                      <td className="p-4 text-slate-400">{lessor.email || '-'}</td>
                      <td className="p-4 text-sky-400 font-semibold">
                        {ownedProps.length > 0 ? ownedProps.map((p) => p.title).join('، ') : 'لا توجد عقارات مسجلة'}
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditLessor(lessor)}
                          className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 transition"
                          title="تعديل المالك"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({
                              type: 'lessor',
                              id: lessor.id,
                              name: lessor.name,
                            })
                          }
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                          title="حذف المالك"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: TENANTS REGISTRY */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">سجل المستأجرين المسجلين بالمكتب</h3>
            <button
              onClick={() => setIsAddTenantModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-600/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مستأجر جديد</span>
            </button>
          </div>
          <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                  <tr>
                    <th className="p-4">اسم المستأجر</th>
                    <th className="p-4">الهوية / السجل</th>
                    <th className="p-4">رقم الجوال</th>
                    <th className="p-4">البريد الإلكتروني</th>
                    <th className="p-4">النوع</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-4 font-bold text-white">{tenant.name}</td>
                      <td className="p-4 font-mono text-purple-300 dir-ltr text-right">{tenant.national_id}</td>
                      <td className="p-4 font-mono text-slate-300 dir-ltr text-right">{tenant.phone}</td>
                      <td className="p-4 text-slate-400">{tenant.email || '-'}</td>
                      <td className="p-4 font-semibold text-sky-400">
                        {tenant.type === 'Company' ? 'منشأة / شركة' : 'فرد'}
                      </td>
                      <td className="p-4 text-center flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditTenant(tenant)}
                          className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition"
                          title="تعديل المستأجر"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteTenant(tenant.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                          title="حذف المستأجر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REPRESENTATIVES REGISTRY */}
      {activeTab === 'representatives' && (
        <div className="rounded-2xl glass-panel overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold">
                <tr>
                  <th className="p-4">اسم الممثل / الوكيل</th>
                  <th className="p-4">الهوية الوطنية</th>
                  <th className="p-4">رقم الجوال</th>
                  <th className="p-4">رقم الوكالة E-POA</th>
                  <th className="p-4">الحالة</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {representatives.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-4 font-bold text-white">{rep.name}</td>
                    <td className="p-4 font-mono text-amber-300 dir-ltr text-right">{rep.national_id}</td>
                    <td className="p-4 font-mono text-slate-300 dir-ltr text-right">{rep.phone}</td>
                    <td className="p-4 font-mono text-sky-400">{rep.e_poa_number || '-'}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                        {rep.status}
                      </span>
                    </td>
                    <td className="p-4 text-center flex items-center justify-center gap-2">
                      <button
                        onClick={() => setEditRepresentative(rep)}
                        className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition"
                        title="تعديل الوكيل"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteTarget({
                            type: 'representative',
                            id: rep.id,
                            name: rep.name,
                          })
                        }
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition"
                        title="حذف الوكيل"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="rounded-2xl glass-panel p-6 space-y-4">
          <h3 className="font-bold text-white text-sm">سجل عمليات التوثيق وتغيير الملكيات والوكلاء التلقائي</h3>
          <div className="space-y-4">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sky-400">
                    {log.change_type === 'LESSOR_TRANSFER' ? 'إجراء: نقل ملكية عقار' : 'إجراء: تغيير ممثل العقار'}
                  </span>
                  <span className="text-slate-400 dir-ltr">{new Date(log.changed_at).toLocaleString('ar-SA')}</span>
                </div>
                <p className="text-slate-200">{log.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attachment Viewer Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base">مستند صك الملكية: {viewingDoc.document_number}</h3>
              <button
                onClick={() => setViewingDoc(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
              <FileText className="w-16 h-16 text-sky-400 mx-auto" />
              <div className="text-xs text-slate-300">تاريخ الإصدار: {viewingDoc.issue_date}</div>
              <div className="text-xs font-bold text-white">المالك المسجل: {viewingDoc.lessor?.name}</div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setViewingDoc(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WORKFLOW MODALS */}
      <AddDocumentPropertyModal
        isOpen={isAddDocPropModalOpen}
        onClose={() => setIsAddDocPropModalOpen(false)}
        lessors={lessors}
        representatives={representatives}
        onSuccess={handleAddDocPropSuccess}
      />

      <ChangeRepresentativeModal
        isOpen={isChangeRepModalOpen}
        onClose={() => setIsChangeRepModalOpen(false)}
        properties={properties}
        representatives={representatives}
        auditLogs={auditLogs}
        onSuccess={() => {}}
      />

      <ChangeLessorModal
        isOpen={isChangeLessorModalOpen}
        onClose={() => setIsChangeLessorModalOpen(false)}
        properties={properties}
        lessors={lessors}
        auditLogs={auditLogs}
        onSuccess={() => {}}
      />

      <AddLessorModal
        isOpen={isAddLessorModalOpen}
        onClose={() => setIsAddLessorModalOpen(false)}
        onSubmit={addLessor}
      />

      <AddRepresentativeModal
        isOpen={isAddRepModalOpen}
        onClose={() => setIsAddRepModalOpen(false)}
        onSubmit={addRepresentative}
      />

      <AddEPoaModal
        isOpen={isAddEPoaModalOpen}
        onClose={() => setIsAddEPoaModalOpen(false)}
        lessors={lessors}
        representatives={representatives}
        onSubmit={addEPoa}
      />

      <AddTenantModal
        isOpen={isAddTenantModalOpen}
        onClose={() => setIsAddTenantModalOpen(false)}
        onSuccess={addTenant}
      />

      {/* EDIT ENTITY MODALS */}
      <EditPropertyModal
        isOpen={!!editProperty}
        onClose={() => setEditProperty(null)}
        property={editProperty}
        lessors={lessors}
        representatives={representatives}
        onSuccess={updateProperty}
      />

      <EditLessorModal
        isOpen={!!editLessor}
        onClose={() => setEditLessor(null)}
        lessor={editLessor}
        onSuccess={updateLessor}
      />

      <EditTenantModal
        isOpen={!!editTenant}
        onClose={() => setEditTenant(null)}
        tenant={editTenant}
        onSuccess={updateTenant}
      />

      <EditRepresentativeModal
        isOpen={!!editRepresentative}
        onClose={() => setEditRepresentative(null)}
        representative={editRepresentative}
        onSuccess={updateRepresentative}
      />

      <EditDocumentModal
        isOpen={!!editDocument}
        onClose={() => setEditDocument(null)}
        documentItem={editDocument}
        lessors={lessors}
        onSuccess={updateDocument}
      />

      <EditEPoaModal
        isOpen={!!editEPoa}
        onClose={() => setEditEPoa(null)}
        ePoa={editEPoa}
        lessors={lessors}
        representatives={representatives}
        onSuccess={updateEPoa}
      />

      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        itemName={deleteTarget?.name}
      />
    </div>
  );
}
