'use client';

import React, { useState } from 'react';
import {
  Users,
  Clock,
  CreditCard,
  CalendarCheck,
  UserCheck,
  Plus,
  Search,
  Filter,
  Printer,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Shield,
  FileCheck,
  FolderArchive,
  ArrowUpRight,
  TrendingUp,
  UserPlus,
  Briefcase,
  Phone,
  Mail,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import {
  Employee,
  TimesheetEntry,
  PayrollPayment,
  LeaveRequest,
  TaskDelegation,
  UserRole,
} from '@/lib/types';
import SalarySlipPrintModal from '@/components/employees/SalarySlipPrintModal';
import TaskDelegatorModal from '@/components/employees/TaskDelegatorModal';
import UniversalImportModal from '@/components/common/UniversalImportModal';

type ActiveTab = 'timesheet' | 'directory' | 'payroll' | 'leaves' | 'delegation';

export default function EmployeesPage() {
  const {
    employees,
    timesheetEntries,
    payrollPayments,
    leaveRequests,
    taskDelegations,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addTimesheet,
    clockInToday,
    clockOutToday,
    addPayroll,
    addLeaveRequest,
    approveLeave,
    rejectLeave,
    archiveProcessRecord,
  } = useData();

  const { currentUser, role, isExecutive, isHR, isEmployee } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('timesheet');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPaymentForPrint, setSelectedPaymentForPrint] = useState<PayrollPayment | null>(null);
  const [isDelegatorOpen, setIsDelegatorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Modals for adding entities
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [isAddLeaveOpen, setIsAddLeaveOpen] = useState(false);

  // Forms state
  const [empName, setEmpName] = useState('');
  const [empNationalId, setEmpNationalId] = useState('');
  const [empJobTitle, setEmpJobTitle] = useState('');
  const [empDepartment, setEmpDepartment] = useState('المبيعات والوساطة');
  const [empPhone, setEmpPhone] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empSalary, setEmpSalary] = useState(8000);
  const [empHousing, setEmpHousing] = useState(2000);
  const [empTransport, setEmpTransport] = useState(1000);
  const [empRole, setEmpRole] = useState<UserRole>('EMPLOYEE');

  // New Payroll form state
  const [payEmpId, setPayEmpId] = useState(employees[0]?.id || '');
  const [payMonth, setPayMonth] = useState('2026-09');
  const [payBasic, setPayBasic] = useState(8000);
  const [payAllowances, setPayAllowances] = useState(2500);
  const [payCommissions, setPayCommissions] = useState(0);
  const [payDeductions, setPayDeductions] = useState(0);
  const [payMethod, setPayMethod] = useState<'BANK_TRANSFER' | 'CASH' | 'CHEQUE'>('BANK_TRANSFER');
  const [payNotes, setPayNotes] = useState('');

  // New Leave form state
  const [leaveEmpId, setLeaveEmpId] = useState(
    isEmployee ? currentUser.employee_id || employees[0]?.id || '' : employees[0]?.id || ''
  );
  const [leaveType, setLeaveType] = useState<LeaveRequest['leave_type']>('ANNUAL');
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().split('T')[0]);
  const [leaveEnd, setLeaveEnd] = useState(new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]);
  const [leaveDays, setLeaveDays] = useState(3);
  const [leaveReason, setLeaveReason] = useState('');

  // Filter items if current user is an EMPLOYEE (Role C: only sees his own contracts, leaves, payments)
  const currentEmpId = currentUser.employee_id || 'emp-001';

  const myEmployees = isEmployee ? employees.filter((e) => e.id === currentEmpId) : employees;
  const filteredEmployees = myEmployees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.national_id_or_iqama.includes(searchTerm)
  );

  const myTimesheets = isEmployee
    ? timesheetEntries.filter((t) => t.employee_id === currentEmpId)
    : timesheetEntries;

  const myPayrolls = isEmployee
    ? payrollPayments.filter((p) => p.employee_id === currentEmpId)
    : payrollPayments;

  const myLeaves = isEmployee
    ? leaveRequests.filter((l) => l.employee_id === currentEmpId)
    : leaveRequests;

  const myTasks = isEmployee
    ? taskDelegations.filter((t) => t.assigned_to_employee_id === currentEmpId)
    : taskDelegations;

  // KPI computations
  const totalEmployeesCount = employees.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const presentTodayCount = timesheetEntries.filter((t) => t.date === todayStr && t.status === 'PRESENT').length;
  const pendingLeavesCount = leaveRequests.filter((l) => l.status === 'PENDING').length;
  const activeDelegationsCount = taskDelegations.filter((t) => t.status !== 'COMPLETED').length;

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeNum = Math.floor(100 + Math.random() * 900);
    const newEmp: Employee = {
      id: `emp-${Date.now()}`,
      employee_number: `EMP-${codeNum}`,
      name: empName,
      national_id_or_iqama: empNationalId,
      job_title: empJobTitle,
      department: empDepartment,
      phone: empPhone,
      email: empEmail,
      hire_date: new Date().toISOString().split('T')[0],
      basic_salary: Number(empSalary),
      housing_allowance: Number(empHousing),
      transport_allowance: Number(empTransport),
      status: 'ACTIVE',
      system_role: empRole,
      created_at: new Date().toISOString(),
    };
    await addEmployee(newEmp);
    setIsAddEmployeeOpen(false);
    setEmpName('');
    setEmpNationalId('');
    setEmpJobTitle('');
  };

  const handleCreatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmp = employees.find((emp) => emp.id === payEmpId);
    if (!targetEmp) return;

    const net = Number(payBasic) + Number(payAllowances) + Number(payCommissions) - Number(payDeductions);
    const payNum = `PAY-${payMonth}-${Math.floor(100 + Math.random() * 900)}`;

    const newPay: PayrollPayment = {
      id: `pay-${Date.now()}`,
      payment_number: payNum,
      employee_id: targetEmp.id,
      employee_name: targetEmp.name,
      month_year: payMonth,
      basic_salary: Number(payBasic),
      allowances: Number(payAllowances),
      commissions: Number(payCommissions),
      deductions: Number(payDeductions),
      net_amount: net,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: payMethod,
      reference_number: `TRX-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'PAID',
      notes: payNotes,
      created_at: new Date().toISOString(),
    };

    await addPayroll(newPay);
    setIsAddPaymentOpen(false);
  };

  const handleCreateLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmp = employees.find((emp) => emp.id === (isEmployee ? currentEmpId : leaveEmpId));
    if (!targetEmp) return;

    const newLv: LeaveRequest = {
      id: `lv-${Date.now()}`,
      employee_id: targetEmp.id,
      employee_name: targetEmp.name,
      leave_type: leaveType,
      start_date: leaveStart,
      end_date: leaveEnd,
      days_count: Number(leaveDays),
      reason: leaveReason,
      status: isHR || isExecutive ? 'APPROVED' : 'PENDING',
      approved_by: isHR || isExecutive ? `${currentUser.name} (${currentUser.role})` : undefined,
      created_at: new Date().toISOString(),
    };

    await addLeaveRequest(newLv);
    setIsAddLeaveOpen(false);
    setLeaveReason('');
  };

  const handleBulkImportEmployees = async (rows: any[]) => {
    for (const row of rows) {
      const codeNum = Math.floor(100 + Math.random() * 900);
      const newEmp: Employee = {
        id: `emp-${Date.now()}-${Math.random()}`,
        employee_number: row['الرقم الوظيفي'] || `EMP-${codeNum}`,
        name: row['الاسم'] || row['اسم الموظف'] || 'موظف جديد',
        national_id_or_iqama: String(row['الهوية الوطنية'] || row['الهوية'] || '1000000000'),
        job_title: row['المسمى الوظيفي'] || 'وسيط عقاري',
        department: row['القسم'] || 'المبيعات والوساطة',
        phone: String(row['رقم الجوال'] || row['الجوال'] || '0500000000'),
        email: row['البريد الإلكتروني'] || 'user@kohlestate-ksa.online',
        hire_date: new Date().toISOString().split('T')[0],
        basic_salary: Number(row['الراتب الأساسي'] || 8000),
        housing_allowance: Number(row['بدل السكن'] || 2000),
        transport_allowance: Number(row['بدل المواصلات'] || 1000),
        status: 'ACTIVE',
        system_role: 'EMPLOYEE',
      };
      await addEmployee(newEmp);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950/50 to-slate-900 border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-sky-400 text-xs font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              {isEmployee
                ? 'بوابة الموظف الذاتية - السجلات والدوام والرواتب'
                : 'نظام شؤون الموظفين والدوام والرواتب المعتمد'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
              {currentUser.role_display}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isEmployee ? `مرحباً ${currentUser.name} (بوابة الموظف)` : 'إدارة الموارد البشرية والدوام والمستحقات'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            {isEmployee
              ? 'يمكنك تسجيل حضورك وانصرافك اليومي، ومتابعة رصيد إجازاتك، واستعراض مسيرات رواتبك وعمولات الصفقات المحققة وطباعتها.'
              : 'منظومة مركزية لمتابعة سجلات الحضور والانصراف، مسيرات الرواتب وسندات الصرف، واعتماد الإجازات وتفويض المهام بالنيابة.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Clock In/Out for Current User */}
          <button
            onClick={() => clockInToday(currentEmpId, currentUser.name)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Clock className="w-4 h-4" />
            <span>تسجيل حضور اليوم</span>
          </button>
          <button
            onClick={() => clockOutToday(currentEmpId)}
            className="px-3.5 py-2 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Clock className="w-4 h-4" />
            <span>تسجيل انصراف</span>
          </button>

          {/* HR & Executive Controls */}
          {(isExecutive || isHR) && (
            <>
              <button
                onClick={() => setIsImportOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>استيراد Excel</span>
              </button>
              <button
                onClick={() => setIsAddEmployeeOpen(true)}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-600/30 transition"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة موظف جديد</span>
              </button>
            </>
          )}

          {/* CEO / Admin Task Delegation Button */}
          {isExecutive && (
            <button
              onClick={() => setIsDelegatorOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-600/20 transition"
            >
              <UserCheck className="w-4 h-4" />
              <span>تفويض مهمة بالنيابة</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards (Personalized for Role) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              {isEmployee ? 'إجمالي ساعات عملك المسجلة' : 'إجمالي كادر الموظفين'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {isEmployee
                ? myTimesheets.reduce((acc, c) => acc + (c.total_hours || 8), 0).toFixed(1) + ' س'
                : totalEmployeesCount}
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">
              {isEmployee ? 'شامل الشهر الحالي' : 'موظفين معتمدين'}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">سجل الحضور اليوم</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">
              {isEmployee
                ? myTimesheets.some((t) => t.date === todayStr)
                  ? 'تم تسجيلك اليوم'
                  : 'لم تسجل بعد'
                : `${presentTodayCount} / ${totalEmployeesCount}`}
            </span>
            <span className="text-[11px] text-slate-400">تاريخ: {todayStr}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">طلبات الإجازات</span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <CalendarCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">
              {myLeaves.filter((l) => l.status === 'PENDING').length}
            </span>
            <span className="text-[11px] text-slate-400">
              {myLeaves.filter((l) => l.status === 'APPROVED').length} معتمدة
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl glass-panel flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">
              {isEmployee ? 'صافي مستحقاتك الأخيرة' : 'التفويضات والمهام النشطة'}
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">
              {isEmployee
                ? `${(myPayrolls[0]?.net_amount || 0).toLocaleString('ar-SA')} ر.س`
                : activeDelegationsCount}
            </span>
            <span className="text-[11px] text-indigo-400 font-semibold">
              {isEmployee ? myPayrolls[0]?.month_year || 'سبتمبر 2026' : 'قيد المتابعة والتنفيذ'}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('timesheet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
            activeTab === 'timesheet'
              ? 'border-sky-500 text-sky-400 bg-slate-800/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>سجل الدوام والتحضير اليومي ({myTimesheets.length})</span>
        </button>

        {(!isEmployee || isHR || isExecutive) && (
          <button
            onClick={() => setActiveTab('directory')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
              activeTab === 'directory'
                ? 'border-sky-500 text-sky-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>دليل وملفات الموظفين ({filteredEmployees.length})</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
            activeTab === 'payroll'
              ? 'border-sky-500 text-sky-400 bg-slate-800/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>مسيرات الرواتب وسندات الصرف ({myPayrolls.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
            activeTab === 'leaves'
              ? 'border-sky-500 text-sky-400 bg-slate-800/60'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>إدارة الإجازات والطلبات ({myLeaves.length})</span>
        </button>

        {isExecutive && (
          <button
            onClick={() => setActiveTab('delegation')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-semibold border-b-2 transition ${
              activeTab === 'delegation'
                ? 'border-amber-500 text-amber-400 bg-slate-800/60'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>تفويض المهام والنيابة ({myTasks.length})</span>
          </button>
        )}
      </div>

      {/* TAB 1: TIMESHEET & ATTENDANCE */}
      {activeTab === 'timesheet' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>سجل التحضير والدوام اليومي والشهري</span>
            </h3>
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                دوام رسمي: 08:30 ص - 05:00 م
              </span>
            </div>
          </div>

          <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">الموظف</th>
                    <th className="p-3.5">التاريخ</th>
                    <th className="p-3.5">وقت الحضور</th>
                    <th className="p-3.5">وقت الانصراف</th>
                    <th className="p-3.5">إجمالي الساعات</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5">ملاحظات العمل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {myTimesheets.map((ts) => {
                    const isPresent = ts.status === 'PRESENT';
                    const isLate = ts.status === 'LATE';
                    return (
                      <tr key={ts.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-bold text-white flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-sky-400 font-bold text-xs border border-slate-700">
                            {ts.employee_name.slice(0, 1)}
                          </div>
                          <span>{ts.employee_name}</span>
                        </td>
                        <td className="p-3.5 font-mono text-slate-300">{ts.date}</td>
                        <td className="p-3.5 font-mono text-emerald-400 font-semibold">{ts.check_in}</td>
                        <td className="p-3.5 font-mono text-slate-300">{ts.check_out || 'قيد الدوام'}</td>
                        <td className="p-3.5 font-bold font-mono text-white">{ts.total_hours || 8.0} س</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isPresent
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : isLate
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-slate-700 text-slate-300 border-slate-600'
                            }`}
                          >
                            {isPresent ? 'حاضر (في الوقت)' : isLate ? 'متأخر بعذر' : ts.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-400 max-w-xs truncate">{ts.notes || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYEE DIRECTORY (HR & EXECUTIVES ONLY) */}
      {activeTab === 'directory' && (!isEmployee || isHR || isExecutive) && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث عن موظف، هوية، مسمى..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
              />
            </div>

            <button
              onClick={() => setIsAddEmployeeOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition shadow"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة ملف موظف</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-4 flex flex-col justify-between shadow-lg"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 border border-sky-400/30 flex items-center justify-center text-white font-bold text-sm shadow">
                        {emp.name.slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm leading-tight">{emp.name}</h4>
                        <span className="text-[11px] text-sky-400 font-medium">{emp.job_title}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {emp.system_role}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-400">
                      <span>الرقم الوظيفي:</span>
                      <span className="font-mono text-white">{emp.employee_number}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>الهوية / الإقامة:</span>
                      <span className="font-mono text-slate-200">{emp.national_id_or_iqama}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>القسم:</span>
                      <span className="text-slate-200">{emp.department}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400">
                      <span>الجوال:</span>
                      <span className="font-mono text-slate-200 dir-ltr">{emp.phone}</span>
                    </div>

                    {/* Salary details protected: shown to Executive & HR */}
                    {(isExecutive || isHR) && (
                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-slate-400">الراتب الأساسي + البدلات:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          {(emp.basic_salary + emp.housing_allowance + emp.transport_allowance).toLocaleString('ar-SA')} ر.س
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    على رأس العمل
                  </span>

                  {(isExecutive || isHR) && (
                    <button
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف ملف الموظف (${emp.name})؟`)) {
                          deleteEmployee(emp.id);
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                      title="حذف الموظف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PAYROLL & PAYMENTS */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>
                  {isEmployee ? 'سندات صرف الراتب ومستحقاتك المالية' : 'مسيرات الرواتب وسندات الصرف المعتمدة'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                يمكن طباعة كل مسير كملف PDF رسمي وترحيله مباشرة إلى الأرشيف الإلكتروني
              </p>
            </div>

            {(isExecutive || isHR) && (
              <button
                onClick={() => setIsAddPaymentOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>إصدار مسير / صرف مستحقات</span>
              </button>
            )}
          </div>

          <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">رقم السند</th>
                    <th className="p-3.5">اسم الموظف</th>
                    <th className="p-3.5">الشهر</th>
                    <th className="p-3.5">الأساسي + البدلات</th>
                    <th className="p-3.5">عمولات صفقات</th>
                    <th className="p-3.5">خصومات</th>
                    <th className="p-3.5">صافي المستلم</th>
                    <th className="p-3.5">تاريخ الصرف</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {myPayrolls.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5 font-mono text-sky-400 font-bold">{pay.payment_number}</td>
                      <td className="p-3.5 font-bold text-white">{pay.employee_name}</td>
                      <td className="p-3.5 font-mono text-slate-300">{pay.month_year}</td>
                      <td className="p-3.5 font-mono text-slate-200">
                        {(pay.basic_salary + pay.allowances).toLocaleString('ar-SA')} ر.س
                      </td>
                      <td className="p-3.5 font-mono text-emerald-400 font-semibold">
                        {pay.commissions > 0 ? `+${pay.commissions.toLocaleString('ar-SA')} ر.س` : '-'}
                      </td>
                      <td className="p-3.5 font-mono text-rose-400">
                        {pay.deductions > 0 ? `-${pay.deductions.toLocaleString('ar-SA')} ر.س` : '0 ر.س'}
                      </td>
                      <td className="p-3.5 font-mono font-black text-emerald-400 text-sm">
                        {pay.net_amount.toLocaleString('ar-SA')} ر.س
                      </td>
                      <td className="p-3.5 font-mono text-slate-400">{pay.payment_date}</td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setSelectedPaymentForPrint(pay)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 text-xs font-semibold transition"
                            title="طباعة سند الصرف PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة PDF</span>
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

      {/* TAB 4: LEAVES & REQUESTS */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-amber-400" />
                <span>إدارة الإجازات والمغادرات الرسمية</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تقديم طلبات الإجازة ومراجعتها واعتمادها وفق لائحة العمل والعمال السعودية
              </p>
            </div>

            <button
              onClick={() => setIsAddLeaveOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>تقديم طلب إجازة جديد</span>
            </button>
          </div>

          <div className="border border-slate-800 rounded-2xl bg-slate-900/60 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">الموظف</th>
                    <th className="p-3.5">نوع الإجازة</th>
                    <th className="p-3.5">من تاريخ</th>
                    <th className="p-3.5">إلى تاريخ</th>
                    <th className="p-3.5">عدد الأيام</th>
                    <th className="p-3.5">السبب</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-center">الاعتماد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {myLeaves.map((lv) => {
                    const isApproved = lv.status === 'APPROVED';
                    const isPending = lv.status === 'PENDING';
                    return (
                      <tr key={lv.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-bold text-white">{lv.employee_name}</td>
                        <td className="p-3.5 font-semibold text-sky-400">
                          {lv.leave_type === 'ANNUAL'
                            ? 'إجازة سنوية'
                            : lv.leave_type === 'SICK'
                            ? 'إجازة مرضية'
                            : lv.leave_type === 'EMERGENCY'
                            ? 'إجازة طارئة'
                            : 'بدون راتب'}
                        </td>
                        <td className="p-3.5 font-mono text-slate-300">{lv.start_date}</td>
                        <td className="p-3.5 font-mono text-slate-300">{lv.end_date}</td>
                        <td className="p-3.5 font-bold font-mono text-white">{lv.days_count} أيام</td>
                        <td className="p-3.5 text-slate-400 max-w-xs truncate">{lv.reason || 'إجازة اعتيادية'}</td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              isApproved
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : isPending
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {isApproved ? 'معتمدة' : isPending ? 'قيد المراجعة' : 'مرفوضة'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {isPending && (isHR || isExecutive) ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => approveLeave(lv.id, `${currentUser.name} (${currentUser.role})`)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition"
                              >
                                موافقة
                              </button>
                              <button
                                onClick={() => rejectLeave(lv.id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold transition"
                              >
                                رفض
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">{lv.approved_by || '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TASK DELEGATIONS (EXECUTIVE ONLY) */}
      {activeTab === 'delegation' && isExecutive && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span>سجل تفويض الصلاحيات والنيابة الإدارية</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                صلاحية قيادية للرئيس التنفيذي والمسؤول لتفويض الصفقات والمهام والتنفيذ بالنيابة الرسمية
              </p>
            </div>

            <button
              onClick={() => setIsDelegatorOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>إصدار تفويض نيابة جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myTasks.map((tsk) => (
              <div
                key={tsk.id}
                className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-400 font-bold text-xs">{tsk.task_code}</span>
                      {tsk.is_delegated_action && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                          نيابة معتمدة
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-white text-sm mt-1">{tsk.title}</h4>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      tsk.status === 'COMPLETED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {tsk.status === 'COMPLETED' ? 'مكتمل' : 'قيد التنفيذ'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{tsk.description}</p>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <div>
                    المفوض إليه: <span className="font-bold text-white">{tsk.assigned_to_name}</span>
                  </div>
                  <div>
                    تاريخ الاستحقاق: <span className="font-mono text-slate-200">{tsk.due_date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salary Slip Print Modal */}
      {selectedPaymentForPrint && (
        <SalarySlipPrintModal
          isOpen={!!selectedPaymentForPrint}
          onClose={() => setSelectedPaymentForPrint(null)}
          payment={selectedPaymentForPrint}
          employee={employees.find((e) => e.id === selectedPaymentForPrint.employee_id)}
        />
      )}

      {/* Task Delegator Modal */}
      {isDelegatorOpen && (
        <TaskDelegatorModal isOpen={isDelegatorOpen} onClose={() => setIsDelegatorOpen(false)} />
      )}

      {/* Universal Import Modal for Employees */}
      {isImportOpen && (
        <UniversalImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          title="استيراد كادر الموظفين من ملف Excel"
          expectedColumns={['الاسم', 'المسمى الوظيفي', 'الهوية الوطنية', 'القسم', 'رقم الجوال', 'الراتب الأساسي']}
          sampleDataRow={{
            'الاسم': 'أحمد إبراهيم الشمري',
            'المسمى الوظيفي': 'وسيط عقاري أول',
            'الهوية الوطنية': '1098234710',
            'القسم': 'المبيعات والوساطة',
            'رقم الجوال': '0551122334',
            'الراتب الأساسي': 9000,
          }}
          onImportSuccess={handleBulkImportEmployees}
        />
      )}

      {/* Modal: Add Employee */}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-sky-400" />
                <span>إضافة ملف موظف جديد</span>
              </h3>
              <button
                onClick={() => setIsAddEmployeeOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">اسم الموظف الثلاثي *</label>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">رقم الهوية / الإقامة *</label>
                  <input
                    type="text"
                    value={empNationalId}
                    onChange={(e) => setEmpNationalId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">المسمى الوظيفي *</label>
                  <input
                    type="text"
                    value={empJobTitle}
                    onChange={(e) => setEmpJobTitle(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">القسم</label>
                  <select
                    value={empDepartment}
                    onChange={(e) => setEmpDepartment(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="المبيعات والوساطة">المبيعات والوساطة</option>
                    <option value="خدمة العملاء والـ CRM">خدمة العملاء والـ CRM</option>
                    <option value="إدارة الأملاك">إدارة الأملاك</option>
                    <option value="الموارد البشرية">الموارد البشرية</option>
                    <option value="الإدارة العليا">الإدارة العليا</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">مستوى الصلاحية في النظام</label>
                  <select
                    value={empRole}
                    onChange={(e) => setEmpRole(e.target.value as UserRole)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    <option value="EMPLOYEE">وسيط / موظف (صلاحيات مخصصة)</option>
                    <option value="HR">مدير موارد بشرية (HR)</option>
                    <option value="ADMIN">مدير نظام (Admin)</option>
                    <option value="CEO">رئيس تنفيذي (CEO)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">رقم الجوال *</label>
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الراتب الأساسي</label>
                  <input
                    type="number"
                    value={empSalary}
                    onChange={(e) => setEmpSalary(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">بدل السكن</label>
                  <input
                    type="number"
                    value={empHousing}
                    onChange={(e) => setEmpHousing(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">بدل مواصلات</label>
                  <input
                    type="number"
                    value={empTransport}
                    onChange={(e) => setEmpTransport(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEmployeeOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold"
                >
                  حفظ واعتماد الموظف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Payroll Disbursement */}
      {isAddPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <span>إصدار مسير راتب وسند صرف جديد</span>
              </h3>
              <button
                onClick={() => setIsAddPaymentOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePayroll} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الموظف *</label>
                  <select
                    value={payEmpId}
                    onChange={(e) => {
                      const empId = e.target.value;
                      setPayEmpId(empId);
                      const emp = employees.find((x) => x.id === empId);
                      if (emp) {
                        setPayBasic(emp.basic_salary);
                        setPayAllowances(emp.housing_allowance + emp.transport_allowance);
                      }
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.job_title})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">عن شهر *</label>
                  <input
                    type="month"
                    value={payMonth}
                    onChange={(e) => setPayMonth(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الراتب الأساسي (ر.س)</label>
                  <input
                    type="number"
                    value={payBasic}
                    onChange={(e) => setPayBasic(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">البدلات (ر.س)</label>
                  <input
                    type="number"
                    value={payAllowances}
                    onChange={(e) => setPayAllowances(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">عمولات صفقات إضافية (ر.س)</label>
                  <input
                    type="number"
                    value={payCommissions}
                    onChange={(e) => setPayCommissions(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">خصومات أو سلفيات (ر.س)</label>
                  <input
                    type="number"
                    value={payDeductions}
                    onChange={(e) => setPayDeductions(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400 font-semibold">صافي المبلغ المستحق:</span>
                <span className="text-emerald-400 font-mono font-bold text-sm">
                  {(Number(payBasic) + Number(payAllowances) + Number(payCommissions) - Number(payDeductions)).toLocaleString('ar-SA')} ر.س
                </span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddPaymentOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  اعتماد والصرف الفوري
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Leave Request */}
      {isAddLeaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-amber-400" />
                <span>طلب إجازة ومغادرة</span>
              </h3>
              <button onClick={() => setIsAddLeaveOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="p-6 space-y-4 text-xs">
              {!isEmployee && (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">الموظف *</label>
                  <select
                    value={leaveEmpId}
                    onChange={(e) => setLeaveEmpId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">نوع الإجازة *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="ANNUAL">إجازة سنوية اعتيادية</option>
                  <option value="SICK">إجازة مرضية</option>
                  <option value="EMERGENCY">إجازة اضطرارية / عائلية</option>
                  <option value="UNPAID">إجازة بدون راتب</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تاريخ البدء *</label>
                  <input
                    type="date"
                    value={leaveStart}
                    onChange={(e) => setLeaveStart(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">تاريخ العودة *</label>
                  <input
                    type="date"
                    value={leaveEnd}
                    onChange={(e) => setLeaveEnd(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">سبب الإجازة</label>
                <textarea
                  rows={2}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="اكتب مبررات الإجازة أو الظرف..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddLeaveOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
                >
                  إرسال الطلب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
