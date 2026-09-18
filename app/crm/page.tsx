'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  UserCheck,
  Building2,
  Phone,
  Mail,
  Plus,
  Search,
  Filter,
  Printer,
  Upload,
  Calendar,
  CheckCircle2,
  FolderArchive,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Clock,
  Sparkles,
  MapPin,
  DollarSign,
  AlertCircle,
  Eye,
  Handshake,
  FileSignature,
  FileSpreadsheet,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import {
  CrmLead,
  CrmDeal,
  CrmActivity,
  CrmPipelineStage,
  CrmLeadType,
  Property,
} from '@/lib/types';
import CrmDealPrintModal from '@/components/crm/CrmDealPrintModal';
import UniversalImportModal from '@/components/common/UniversalImportModal';

const STAGES: { key: CrmPipelineStage; label: string; color: string; bg: string; border: string }[] = [
  { key: 'NEW', label: 'عميل جديد', color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
  { key: 'CONTACTED', label: 'تم التواصل', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  { key: 'SHOWING', label: 'معاينة عقار', color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
  { key: 'NEGOTIATION', label: 'تفاوض وعرض مالي', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
  { key: 'WON', label: 'صفقة ناجحة (فوز)', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  { key: 'LOST', label: 'ملغي / غير مناسب', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
];

const LEAD_TYPE_LABELS: Record<CrmLeadType, string> = {
  BUYER: 'مشتري عقار',
  SELLER: 'بائع / مالك',
  TENANT: 'مستأجر',
  LANDLORD: 'مؤجر',
  INVESTOR: 'مستثمر عقاري',
};

export default function CrmPage() {
  const {
    crmLeads,
    crmDeals,
    crmActivities,
    properties,
    employees,
    addCrmLead,
    updateCrmLead,
    deleteCrmLead,
    updateLeadStage,
    addCrmDeal,
    updateCrmDeal,
    updateDealStage,
    addCrmActivity,
    updateCrmActivity,
    archiveProcessRecord,
  } = useData();

  const { currentUser, role, isExecutive, isEmployee } = useAuth();

  const [activeTab, setActiveTab] = useState<'pipeline' | 'deals' | 'activities' | 'matcher'>('pipeline');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [selectedDealForPrint, setSelectedDealForPrint] = useState<CrmDeal | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Modals for creating entities
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isAddDealOpen, setIsAddDealOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);

  // New Lead Form State
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadType, setLeadType] = useState<CrmLeadType>('BUYER');
  const [leadStage, setLeadStage] = useState<CrmPipelineStage>('NEW');
  const [leadBudgetMin, setLeadBudgetMin] = useState(1000000);
  const [leadBudgetMax, setLeadBudgetMax] = useState(2500000);
  const [leadPropertyType, setLeadPropertyType] = useState('فيلا مودرن');
  const [leadDistrict, setLeadDistrict] = useState('حي النرجس');
  const [leadNotes, setLeadNotes] = useState('');

  // New Deal Form State
  const [dealTitle, setDealTitle] = useState('');
  const [dealLeadId, setDealLeadId] = useState(crmLeads[0]?.id || '');
  const [dealPropertyId, setDealPropertyId] = useState(properties[0]?.id || '');
  const [dealValue, setDealValue] = useState(1500000);
  const [dealCommissionRate, setDealCommissionRate] = useState(2.5);
  const [dealExpectedDate, setDealExpectedDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  );
  const [dealNotes, setDealNotes] = useState('');

  // New Activity Form State
  const [actTitle, setActTitle] = useState('');
  const [actType, setActType] = useState<CrmActivity['activity_type']>('CALL');
  const [actClientName, setActClientName] = useState(crmLeads[0]?.name || '');
  const [actDate, setActDate] = useState(new Date().toISOString().split('T')[0]);
  const [actNotes, setActNotes] = useState('');

  // Role Filtering:
  // If Employee: can only see their own assigned leads/deals
  const currentEmpId = currentUser.employee_id || 'emp-001';

  const myLeads = isEmployee
    ? crmLeads.filter((l) => l.assigned_agent_id === currentEmpId)
    : crmLeads;

  const filteredLeads = myLeads.filter((l) => {
    const matchesSearch =
      l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.phone.includes(searchTerm) ||
      (l.preferred_property_type || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedTypeFilter === 'ALL' || l.lead_type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  const myDeals = isEmployee
    ? crmDeals.filter((d) => d.assigned_agent_id === currentEmpId)
    : crmDeals;

  const myActivities = isEmployee
    ? crmActivities.filter((a) => a.created_by_name.includes(currentUser.name))
    : crmActivities;

  // KPI Metrics
  const totalPipelineValue = myDeals.reduce((acc, d) => acc + d.deal_value, 0);
  const totalExpectedCommissions = myDeals.reduce((acc, d) => acc + d.commission_amount, 0);
  const wonDealsCount = myDeals.filter((d) => d.stage === 'WON').length;

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeNum = Math.floor(100 + Math.random() * 900);
    const newLead: CrmLead = {
      id: `lead-${Date.now()}`,
      lead_code: `LED-2026-${codeNum}`,
      name: leadName,
      phone: leadPhone,
      email: leadEmail,
      lead_type: leadType,
      stage: leadStage,
      priority: 'HIGH',
      source: 'WHATSAPP',
      budget_min: Number(leadBudgetMin),
      budget_max: Number(leadBudgetMax),
      preferred_property_type: leadPropertyType,
      preferred_city: 'الرياض',
      preferred_district: leadDistrict,
      assigned_agent_id: isEmployee ? currentEmpId : employees[0]?.id,
      assigned_agent_name: isEmployee ? currentUser.name : employees[0]?.name,
      notes: leadNotes,
      created_at: new Date().toISOString(),
    };

    await addCrmLead(newLead);
    setIsAddLeadOpen(false);
    setLeadName('');
    setLeadPhone('');
    setLeadNotes('');
  };

  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const lead = crmLeads.find((l) => l.id === dealLeadId);
    const prop = properties.find((p) => p.id === dealPropertyId);
    const val = Number(dealValue);
    const comm = (val * Number(dealCommissionRate)) / 100;
    const profit = Math.round(comm * 0.75); // 75% office profit after agent split
    const codeNum = Math.floor(100 + Math.random() * 900);

    const newDeal: CrmDeal = {
      id: `deal-${Date.now()}`,
      deal_code: `DLR-2026-${codeNum}`,
      title: dealTitle || `صفقة ${lead?.name || 'عميل'} - ${prop?.title || 'عقار'}`,
      lead_id: lead?.id || '',
      lead_name: lead?.name || 'عميل عقاري',
      lead_phone: lead?.phone || '',
      property_id: prop?.id,
      property_title: prop?.title,
      deal_value: val,
      commission_rate: Number(dealCommissionRate),
      commission_amount: comm,
      office_profit: profit,
      stage: 'NEGOTIATION',
      expected_closing_date: dealExpectedDate,
      assigned_agent_id: isEmployee ? currentEmpId : lead?.assigned_agent_id || employees[0]?.id,
      assigned_agent_name: isEmployee ? currentUser.name : lead?.assigned_agent_name || employees[0]?.name,
      notes: dealNotes,
      created_at: new Date().toISOString(),
    };

    await addCrmDeal(newDeal);
    setIsAddDealOpen(false);
    setDealTitle('');
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    const newAct: CrmActivity = {
      id: `act-${Date.now()}`,
      lead_or_client_name: actClientName,
      activity_type: actType,
      title: actTitle,
      due_date: actDate,
      status: 'PENDING',
      notes: actNotes,
      created_by_name: currentUser.name,
      created_at: new Date().toISOString(),
    };

    await addCrmActivity(newAct);
    setIsAddActivityOpen(false);
    setActTitle('');
    setActNotes('');
  };

  const handleBulkImportLeads = async (rows: any[]) => {
    for (const row of rows) {
      const codeNum = Math.floor(100 + Math.random() * 900);
      const newLead: CrmLead = {
        id: `lead-${Date.now()}-${Math.random()}`,
        lead_code: row['كود العميل'] || `LED-2026-${codeNum}`,
        name: row['اسم العميل'] || row['الاسم'] || 'عميل مهتم',
        phone: String(row['رقم الجوال'] || row['الجوال'] || '0500000000'),
        email: row['البريد الإلكتروني'],
        lead_type: (row['نوع الطلب'] as CrmLeadType) || 'BUYER',
        stage: 'NEW',
        priority: 'MEDIUM',
        source: 'WHATSAPP',
        budget_min: Number(row['الميزانية الدنيا'] || 500000),
        budget_max: Number(row['الميزانية القصوى'] || 2000000),
        preferred_property_type: row['نوع العقار'] || 'فيلا',
        preferred_city: row['المدينة'] || 'الرياض',
        preferred_district: row['الحي'] || 'شمال الرياض',
        assigned_agent_id: isEmployee ? currentEmpId : employees[0]?.id,
        assigned_agent_name: isEmployee ? currentUser.name : employees[0]?.name,
        notes: row['ملاحظات'] || 'تم الاستيراد من ملف Excel',
      };
      await addCrmLead(newLead);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>منظومة إدارة علاقات العملاء والصفقات العقارية (Real Estate CRM)</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
              {currentUser.role_display}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">إدارة العملاء، الصفقات، والمتابعات العقارية</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            تتبع مسار المشترين والمستأجرين والمستثمرين، مطابقة العقارات المتاحة، إغلاق الصفقات وإصدار سندات العمولة المعتمدة مع الترحيل التلقائي للأرشيف.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>استيراد عملاء (Excel)</span>
          </button>
          <button
            onClick={() => setIsAddLeadOpen(true)}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-600/30 transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة عميل مهتم جديد</span>
          </button>
          <button
            onClick={() => setIsAddDealOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition"
          >
            <Handshake className="w-4 h-4" />
            <span>إنشاء صفقة جديدة</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">العملاء النشطين بالمسار</span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{myLeads.length}</span>
            <span className="text-[11px] text-sky-400 font-semibold">مشتري ومستأجر</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">إجمالي قيمة صفقات المسار</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {(totalPipelineValue / 1000000).toFixed(2)} مليون ر.س
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">{myDeals.length} صفقات</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">السعي والأرباح المستهدفة</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              {totalExpectedCommissions.toLocaleString('ar-SA')} ر.س
            </span>
            <span className="text-[11px] text-slate-400">سعي 2.5% معتمد</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">الصفقات المكتملة (WON)</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{wonDealsCount}</span>
            <span className="text-[11px] text-amber-300 font-semibold">مغلقة بنجاح</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
            activeTab === 'pipeline'
              ? 'border-sky-500 text-sky-400 bg-slate-800/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>مسار العملاء (Pipeline) ({filteredLeads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('deals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
            activeTab === 'deals'
              ? 'border-emerald-500 text-emerald-400 bg-slate-800/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Handshake className="w-4 h-4" />
          <span>الصفقات والعمولات ({myDeals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('activities')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
            activeTab === 'activities'
              ? 'border-purple-500 text-purple-400 bg-slate-800/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>الأنشطة والمتابعات ({myActivities.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matcher')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
            activeTab === 'matcher'
              ? 'border-indigo-500 text-indigo-400 bg-slate-800/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>محرك مطابقة العقارات الذكي</span>
        </button>
      </div>

      {/* TAB 1: CRM LEADS PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالاسم، الجوال، أو نوع العقار..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs text-slate-400">تصنيف العميل:</span>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1 text-xs text-white"
              >
                <option value="ALL">كافة العملاء</option>
                <option value="BUYER">مشتري</option>
                <option value="SELLER">بائع / مالك</option>
                <option value="TENANT">مستأجر</option>
                <option value="LANDLORD">مؤجر</option>
                <option value="INVESTOR">مستثمر</option>
              </select>
            </div>
          </div>

          {/* Kanban / Pipeline Columns Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.stage === stage.key);
              return (
                <div
                  key={stage.key}
                  className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3 flex flex-col justify-between min-h-[500px]"
                >
                  <div>
                    {/* Stage Column Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${stage.bg} border ${stage.border}`}></span>
                        <span className="font-bold text-xs text-white">{stage.label}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stage.bg} ${stage.color} border ${stage.border}`}>
                        {stageLeads.length}
                      </span>
                    </div>

                    {/* Cards in this stage */}
                    <div className="space-y-2.5">
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 hover:border-sky-500/40 transition space-y-2.5 shadow group"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h5 className="font-bold text-white text-xs leading-tight group-hover:text-sky-400 transition">
                                {lead.name}
                              </h5>
                              <span className="text-[10px] text-slate-400 font-mono dir-ltr block mt-0.5">
                                {lead.phone}
                              </span>
                            </div>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-sky-400 border border-slate-700">
                              {LEAD_TYPE_LABELS[lead.lead_type]}
                            </span>
                          </div>

                          <div className="space-y-1 text-[11px] text-slate-300">
                            {lead.preferred_property_type && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <Building2 className="w-3 h-3 text-sky-400" />
                                <span>{lead.preferred_property_type}</span>
                              </div>
                            )}
                            {lead.preferred_district && (
                              <div className="flex items-center gap-1 text-slate-400">
                                <MapPin className="w-3 h-3 text-amber-400" />
                                <span>{lead.preferred_district}</span>
                              </div>
                            )}
                            {lead.budget_max ? (
                              <div className="text-[11px] font-mono text-emerald-400 font-semibold">
                                حتى {lead.budget_max.toLocaleString('ar-SA')} ر.س
                              </div>
                            ) : null}
                          </div>

                          {/* Move Stage Selector */}
                          <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">نقل المرحلة:</span>
                            <select
                              value={lead.stage}
                              onChange={(e) => updateLeadStage(lead.id, e.target.value as any)}
                              className="bg-slate-900 border border-slate-700 text-[10px] rounded px-1.5 py-0.5 text-sky-300"
                            >
                              {STAGES.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))}

                      {stageLeads.length === 0 && (
                        <div className="text-center py-8 text-slate-600 text-[11px]">لا يوجد عملاء هنا</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CRM DEALS & COMMISSIONS */}
      {activeTab === 'deals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Handshake className="w-4 h-4 text-emerald-400" />
                <span>سجل الصفقات العقارية والعمولات المتوقعة</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                يمكن طباعة ملخص كل صفقة كملف PDF رسمي، وتحويلها إلى عقد إيجار أو وساطة، وترحيلها للأرشيف
              </p>
            </div>

            <button
              onClick={() => setIsAddDealOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>إدراج صفقة جديدة</span>
            </button>
          </div>

          <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">كود الصفقة</th>
                    <th className="p-3.5">عنوان الصفقة</th>
                    <th className="p-3.5">العميل المرتبط</th>
                    <th className="p-3.5">قيمة الصفقة</th>
                    <th className="p-3.5">قيمة السعي (2.5%)</th>
                    <th className="p-3.5">ربح المكتب</th>
                    <th className="p-3.5">المرحلة</th>
                    <th className="p-3.5">تاريخ الإغلاق</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {myDeals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-mono text-sky-400 font-bold">{deal.deal_code}</td>
                      <td className="p-3.5 font-bold text-white max-w-xs">{deal.title}</td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-200">{deal.lead_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono dir-ltr">{deal.lead_phone}</div>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-white">
                        {deal.deal_value.toLocaleString('ar-SA')} ر.س
                      </td>
                      <td className="p-3.5 font-mono font-bold text-sky-400">
                        {deal.commission_amount.toLocaleString('ar-SA')} ر.س
                      </td>
                      <td className="p-3.5 font-mono font-black text-emerald-400 text-sm">
                        {deal.office_profit.toLocaleString('ar-SA')} ر.س
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            deal.stage === 'WON'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {deal.stage === 'WON' ? 'صفقة رابحة' : 'قيد التفاوض'}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{deal.expected_closing_date}</td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedDealForPrint(deal)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition"
                            title="طباعة وأرشفة ملخص الصفقة"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>PDF & أرشيف</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVITIES & FOLLOW-UPS */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>سجل المتابعات والاتصالات والمواعيد الميدانية</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                جدولة مكالمات العملاء، رسائل الواتساب، ومعاينات العقارات الميدانية
              </p>
            </div>

            <button
              onClick={() => setIsAddActivityOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة موعد أو نشاط جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myActivities.map((act) => {
              const isCompleted = act.status === 'COMPLETED';
              return (
                <div
                  key={act.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {act.activity_type === 'CALL'
                          ? 'اتصال هاتفي'
                          : act.activity_type === 'SHOWING'
                          ? 'معاينة ميدانية'
                          : act.activity_type === 'WHATSAPP'
                          ? 'محادثة واتساب'
                          : 'اجتماع عمل'}
                      </span>
                      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-sky-400" />
                        {act.due_date}
                      </span>
                    </div>

                    <h4 className="font-bold text-white text-sm">{act.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{act.notes}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <div className="text-slate-400">
                      العميل: <span className="font-bold text-white">{act.lead_or_client_name}</span>
                    </div>
                    <button
                      onClick={() =>
                        updateCrmActivity({
                          ...act,
                          status: isCompleted ? 'PENDING' : 'COMPLETED',
                        })
                      }
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                        isCompleted
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isCompleted ? 'تم الإنجاز' : 'تحديد كمكتمل'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SMART PROPERTY MATCHER */}
      {activeTab === 'matcher' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border border-indigo-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">محرك المطابقة الذكي بين طلبات العملاء والعقارات</h3>
                <p className="text-xs text-slate-400">
                  يقوم النظام بمطابقة متطلبات العملاء (نوع العقار، الميزانية، والحي) مع محفظة العقارات الشاغرة
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {myLeads.map((lead) => {
              const matchedProperties = properties.filter((p) => {
                const typeMatches =
                  !lead.preferred_property_type ||
                  p.property_type.toLowerCase().includes(lead.preferred_property_type.toLowerCase()) ||
                  p.title.toLowerCase().includes(lead.preferred_property_type.toLowerCase());
                return typeMatches;
              });

              return (
                <div
                  key={lead.id}
                  className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-sky-600/20 text-sky-400 font-bold flex items-center justify-center border border-sky-500/30">
                        {lead.name.slice(0, 1)}
                      </div>
                      <div>
                        <span className="font-bold text-white text-sm">{lead.name}</span>
                        <div className="text-xs text-slate-400 flex items-center gap-3 mt-0.5">
                          <span>النوع: {LEAD_TYPE_LABELS[lead.lead_type]}</span>
                          <span>المطلوب: {lead.preferred_property_type || 'عقار عام'}</span>
                          <span className="text-emerald-400 font-mono">
                            الميزانية: {lead.budget_max?.toLocaleString('ar-SA')} ر.س
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setDealLeadId(lead.id);
                        setIsAddDealOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      <span>فتح صفقة لهذا العميل</span>
                    </button>
                  </div>

                  {/* Matched Properties */}
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-2">
                      العقارات المقترحة من المخزون ({matchedProperties.length}):
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {matchedProperties.slice(0, 3).map((prop) => (
                        <div
                          key={prop.id}
                          className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-white">{prop.title}</div>
                            <div className="text-slate-400 text-[11px]">{prop.city} - {prop.address}</div>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 font-semibold">
                            مطابق
                          </span>
                        </div>
                      ))}
                      {matchedProperties.length === 0 && (
                        <div className="text-xs text-slate-500 italic">لا توجد عقارات مطابقة حالياً بمخزون المكتب.</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Deal Print Modal */}
      {selectedDealForPrint && (
        <CrmDealPrintModal
          isOpen={!!selectedDealForPrint}
          onClose={() => setSelectedDealForPrint(null)}
          deal={selectedDealForPrint}
          lead={crmLeads.find((l) => l.id === selectedDealForPrint.lead_id)}
          property={properties.find((p) => p.id === selectedDealForPrint.property_id)}
        />
      )}

      {/* Universal Import Modal */}
      {isImportOpen && (
        <UniversalImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="استيراد العملاء والطلبات من Excel"
          expectedColumns={['اسم العميل', 'رقم الجوال', 'نوع الطلب', 'نوع العقار', 'الحي', 'الميزانية القصوى']}
          sampleDataRow={{
            'اسم العميل': 'محمد ناصر العتيبي',
            'رقم الجوال': '0501239876',
            'نوع الطلب': 'BUYER',
            'نوع العقار': 'فيلا سكنية',
            'الحي': 'حي النرجس',
            'الميزانية القصوى': 3200000,
          }}
          onImportSuccess={handleBulkImportLeads}
        />
      )}

      {/* Modal: Add Lead */}
      {isAddLeadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-sky-400" />
                <span>إضافة عميل مهتم جديد (Lead)</span>
              </h3>
              <button onClick={() => setIsAddLeadOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">اسم العميل *</label>
                <input
                  type="text"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="الاسم الكامل أو اسم الشركة..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">رقم الجوال *</label>
                  <input
                    type="text"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="05xxxxxxxx"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نوع العميل</label>
                  <select
                    value={leadType}
                    onChange={(e) => setLeadType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="BUYER">مشتري عقار</option>
                    <option value="SELLER">بائع / مالك</option>
                    <option value="TENANT">مستأجر</option>
                    <option value="LANDLORD">مؤجر</option>
                    <option value="INVESTOR">مستثمر</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نوع العقار المطلوب</label>
                  <input
                    type="text"
                    value={leadPropertyType}
                    onChange={(e) => setLeadPropertyType(e.target.value)}
                    placeholder="فيلا، شقة، معرض، أرض..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الحي / المنطقة المفضلة</label>
                  <input
                    type="text"
                    value={leadDistrict}
                    onChange={(e) => setLeadDistrict(e.target.value)}
                    placeholder="النرجس، الياسمين، الملقا..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الميزانية الدنيا (ر.س)</label>
                  <input
                    type="number"
                    value={leadBudgetMin}
                    onChange={(e) => setLeadBudgetMin(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الميزانية القصوى (ر.س)</label>
                  <input
                    type="number"
                    value={leadBudgetMax}
                    onChange={(e) => setLeadBudgetMax(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">ملاحظات واشتراطات خاصة</label>
                <textarea
                  rows={2}
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder="تفاصيل إضافية عن رغبة العميل..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLeadOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  حفظ العميل في الـ CRM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Deal */}
      {isAddDealOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Handshake className="w-5 h-5 text-emerald-400" />
                <span>إنشاء وتوثيق صفقة عقارية جديدة</span>
              </h3>
              <button onClick={() => setIsAddDealOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">عنوان وموضوع الصفقة *</label>
                <input
                  type="text"
                  value={dealTitle}
                  onChange={(e) => setDealTitle(e.target.value)}
                  placeholder="مثال: بيع فيلا درج صالة - حي النرجس"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">العميل المرتبط *</label>
                  <select
                    value={dealLeadId}
                    onChange={(e) => setDealLeadId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {crmLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">العقار المعني</label>
                  <select
                    value={dealPropertyId}
                    onChange={(e) => setDealPropertyId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">قيمة الصفقة الإجمالية (ر.س) *</label>
                  <input
                    type="number"
                    value={dealValue}
                    onChange={(e) => setDealValue(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">نسبة السعي (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={dealCommissionRate}
                    onChange={(e) => setDealCommissionRate(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">قيمة السعي المستحقة:</span>
                <span className="text-emerald-400 font-mono font-bold text-sm">
                  {((Number(dealValue) * Number(dealCommissionRate)) / 100).toLocaleString('ar-SA')} ر.س
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">تاريخ الإغلاق المتوقع</label>
                <input
                  type="date"
                  value={dealExpectedDate}
                  onChange={(e) => setDealExpectedDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddDealOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  حفظ الصفقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Activity */}
      {isAddActivityOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <span>جدولة متابعة ونشاط</span>
              </h3>
              <button onClick={() => setIsAddActivityOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateActivity} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">موضوع النشاط *</label>
                <input
                  type="text"
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  placeholder="مثال: معاينة شقة برج الياسمين"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">النوع</label>
                  <select
                    value={actType}
                    onChange={(e) => setActType(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="CALL">اتصال هاتفي</option>
                    <option value="SHOWING">معاينة ميدانية</option>
                    <option value="WHATSAPP">محادثة واتساب</option>
                    <option value="MEETING">اجتماع عمل</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تاريخ الموعد</label>
                  <input
                    type="date"
                    value={actDate}
                    onChange={(e) => setActDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">اسم العميل *</label>
                <input
                  type="text"
                  value={actClientName}
                  onChange={(e) => setActClientName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">ملاحظات النشاط</label>
                <textarea
                  rows={2}
                  value={actNotes}
                  onChange={(e) => setActNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddActivityOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  حفظ المتابعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
