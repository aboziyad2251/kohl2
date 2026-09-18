'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Lessor,
  Tenant,
  Representative,
  OwnershipDocument,
  Property,
  EPoa,
  Contract,
  BrokerageAgreement,
  OwnershipAuditLog,
  FinancialTransaction,
  DailyFinancialSummary,
  AiDailyReport,
  GeneralService,
  CustomerOrder,
  ManagedPropertyContract,
  PropertyMaintenanceTask,
  ArchivedDocument,
  ArchivedDocumentCategory,
  Employee,
  TimesheetEntry,
  PayrollPayment,
  LeaveRequest,
  TaskDelegation,
  CrmLead,
  CrmDeal,
  CrmActivity,
} from '../lib/types';
import {
  INITIAL_LESSORS,
  INITIAL_TENANTS,
  INITIAL_REPRESENTATIVES,
  INITIAL_OWNERSHIP_DOCUMENTS,
  INITIAL_PROPERTIES,
  INITIAL_E_POAS,
  INITIAL_CONTRACTS,
  INITIAL_BROKERAGE_AGREEMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_FINANCIAL_TRANSACTIONS,
  INITIAL_DAILY_FINANCIAL_SUMMARIES,
  INITIAL_AI_DAILY_REPORTS,
  INITIAL_GENERAL_SERVICES,
  INITIAL_CUSTOMER_ORDERS,
  INITIAL_MANAGED_PROPERTIES,
  INITIAL_MAINTENANCE_TASKS,
  INITIAL_ARCHIVED_DOCUMENTS,
  INITIAL_EMPLOYEES,
  INITIAL_TIMESHEET_ENTRIES,
  INITIAL_PAYROLL_PAYMENTS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_TASK_DELEGATIONS,
  INITIAL_CRM_LEADS,
  INITIAL_CRM_DEALS,
  INITIAL_CRM_ACTIVITIES,
} from '../lib/supabaseClient';
import {
  dbFetchAllData,
  setLocalData,
  clearAllLocalData,
  STORAGE_KEYS,
  dbInsertLessor,
  dbUpdateLessor,
  dbDeleteLessor,
  dbInsertTenant,
  dbUpdateTenant,
  dbDeleteTenant,
  dbInsertRepresentative,
  dbUpdateRepresentative,
  dbDeleteRepresentative,
  dbInsertOwnershipDocument,
  dbUpdateOwnershipDocument,
  dbDeleteOwnershipDocument,
  dbInsertProperty,
  dbUpdateProperty,
  dbDeleteProperty,
  dbInsertEPoa,
  dbUpdateEPoa,
  dbDeleteEPoa,
  dbInsertContract,
  dbUpdateContract,
  dbDeleteContract,
  dbInsertBrokerageAgreement,
  dbUpdateBrokerageAgreement,
  dbDeleteBrokerageAgreement,
  dbInsertFinancialTransaction,
  dbUpdateFinancialTransaction,
  dbDeleteFinancialTransaction,
  dbInsertAuditLog,
  dbInsertGeneralService,
  dbUpdateGeneralService,
  dbDeleteGeneralService,
  dbInsertCustomerOrder,
  dbUpdateCustomerOrder,
  dbDeleteCustomerOrder,
  dbInsertManagedProperty,
  dbUpdateManagedProperty,
  dbDeleteManagedProperty,
  dbInsertMaintenanceTask,
  dbUpdateMaintenanceTask,
  dbDeleteMaintenanceTask,
  dbInsertArchivedDocument,
  dbUpdateArchivedDocument,
  dbDeleteArchivedDocument,
  dbInsertEmployee,
  dbUpdateEmployee,
  dbDeleteEmployee,
  dbInsertTimesheet,
  dbUpdateTimesheet,
  dbDeleteTimesheet,
  dbInsertPayroll,
  dbUpdatePayroll,
  dbDeletePayroll,
  dbInsertLeaveRequest,
  dbUpdateLeaveRequest,
  dbDeleteLeaveRequest,
  dbInsertTaskDelegation,
  dbUpdateTaskDelegation,
  dbDeleteTaskDelegation,
  dbInsertCrmLead,
  dbUpdateCrmLead,
  dbDeleteCrmLead,
  dbInsertCrmDeal,
  dbUpdateCrmDeal,
  dbDeleteCrmDeal,
  dbInsertCrmActivity,
  dbUpdateCrmActivity,
  dbDeleteCrmActivity,
} from '../lib/services/dbService';
import { computeDailySummaryFromTransactions } from '../lib/services/financials';

interface DataContextType {
  isLoading: boolean;
  lessors: Lessor[];
  tenants: Tenant[];
  representatives: Representative[];
  documents: OwnershipDocument[];
  properties: Property[];
  ePoas: EPoa[];
  contracts: Contract[];
  brokerageAgreements: BrokerageAgreement[];
  auditLogs: OwnershipAuditLog[];
  transactions: FinancialTransaction[];
  dailySummaries: DailyFinancialSummary[];
  aiReports: AiDailyReport[];
  generalServices: GeneralService[];
  customerOrders: CustomerOrder[];
  managedProperties: ManagedPropertyContract[];
  maintenanceTasks: PropertyMaintenanceTask[];
  archivedDocuments: ArchivedDocument[];
  employees: Employee[];
  timesheetEntries: TimesheetEntry[];
  payrollPayments: PayrollPayment[];
  leaveRequests: LeaveRequest[];
  taskDelegations: TaskDelegation[];
  crmLeads: CrmLead[];
  crmDeals: CrmDeal[];
  crmActivities: CrmActivity[];

  // Entity Actions
  addProperty: (property: Property, document?: OwnershipDocument) => Promise<void>;
  updateProperty: (property: Property) => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;
  updatePropertyRep: (propertyId: string, newRepId: string, notes?: string) => Promise<void>;
  transferPropertyLessor: (propertyId: string, newLessorId: string, newDeedNumber: string, notes?: string) => Promise<void>;

  addDocument: (doc: OwnershipDocument) => Promise<void>;
  updateDocument: (doc: OwnershipDocument) => Promise<void>;
  deleteDocument: (docId: string) => Promise<void>;

  addLessor: (lessor: Lessor) => Promise<void>;
  updateLessor: (lessor: Lessor) => Promise<void>;
  deleteLessor: (lessorId: string) => Promise<void>;

  addTenant: (tenant: Tenant) => Promise<void>;
  updateTenant: (tenant: Tenant) => Promise<void>;
  deleteTenant: (tenantId: string) => Promise<void>;

  addRepresentative: (rep: Representative) => Promise<void>;
  updateRepresentative: (rep: Representative) => Promise<void>;
  deleteRepresentative: (repId: string) => Promise<void>;

  addEPoa: (poa: EPoa) => Promise<void>;
  updateEPoa: (poa: EPoa) => Promise<void>;
  deleteEPoa: (poaId: string) => Promise<void>;

  addContract: (contract: Contract) => Promise<void>;
  updateContract: (contract: Contract) => Promise<void>;
  deleteContract: (contractId: string) => Promise<void>;

  addBrokerageAgreement: (agreement: BrokerageAgreement) => Promise<void>;
  updateBrokerageAgreement: (agreement: BrokerageAgreement) => Promise<void>;
  deleteBrokerageAgreement: (agreementId: string) => Promise<void>;

  addTransaction: (tx: FinancialTransaction) => Promise<void>;
  updateTransaction: (tx: FinancialTransaction) => Promise<void>;
  deleteTransaction: (txId: string) => Promise<void>;

  addGeneralService: (service: GeneralService) => Promise<void>;
  updateGeneralService: (service: GeneralService) => Promise<void>;
  deleteGeneralService: (serviceId: string) => Promise<void>;

  addCustomerOrder: (order: CustomerOrder) => Promise<boolean>;
  updateCustomerOrder: (order: CustomerOrder) => Promise<void>;
  deleteCustomerOrder: (orderId: string) => Promise<void>;

  addManagedProperty: (prop: ManagedPropertyContract) => Promise<void>;
  updateManagedProperty: (prop: ManagedPropertyContract) => Promise<void>;
  deleteManagedProperty: (propId: string) => Promise<void>;

  addMaintenanceTask: (task: PropertyMaintenanceTask) => Promise<void>;
  updateMaintenanceTask: (task: PropertyMaintenanceTask) => Promise<void>;
  deleteMaintenanceTask: (taskId: string) => Promise<void>;

  addArchivedDocument: (doc: ArchivedDocument) => Promise<void>;
  updateArchivedDocument: (doc: ArchivedDocument) => Promise<void>;
  deleteArchivedDocument: (docId: string) => Promise<void>;

  // Employees & HR Actions
  addEmployee: (emp: Employee) => Promise<void>;
  updateEmployee: (emp: Employee) => Promise<void>;
  deleteEmployee: (empId: string) => Promise<void>;

  addTimesheet: (ts: TimesheetEntry) => Promise<void>;
  updateTimesheet: (ts: TimesheetEntry) => Promise<void>;
  deleteTimesheet: (tsId: string) => Promise<void>;
  clockInToday: (employeeId: string, employeeName: string) => Promise<void>;
  clockOutToday: (employeeId: string) => Promise<void>;

  addPayroll: (pay: PayrollPayment) => Promise<void>;
  updatePayroll: (pay: PayrollPayment) => Promise<void>;
  deletePayroll: (payId: string) => Promise<void>;

  addLeaveRequest: (lv: LeaveRequest) => Promise<void>;
  updateLeaveRequest: (lv: LeaveRequest) => Promise<void>;
  deleteLeaveRequest: (lvId: string) => Promise<void>;
  approveLeave: (lvId: string, approverName: string) => Promise<void>;
  rejectLeave: (lvId: string) => Promise<void>;

  addTaskDelegation: (tsk: TaskDelegation) => Promise<void>;
  updateTaskDelegation: (tsk: TaskDelegation) => Promise<void>;
  deleteTaskDelegation: (tskId: string) => Promise<void>;

  // CRM Actions
  addCrmLead: (lead: CrmLead) => Promise<void>;
  updateCrmLead: (lead: CrmLead) => Promise<void>;
  deleteCrmLead: (leadId: string) => Promise<void>;
  updateLeadStage: (leadId: string, stage: CrmLead['stage']) => Promise<void>;

  addCrmDeal: (deal: CrmDeal) => Promise<void>;
  updateCrmDeal: (deal: CrmDeal) => Promise<void>;
  deleteCrmDeal: (dealId: string) => Promise<void>;
  updateDealStage: (dealId: string, stage: CrmDeal['stage']) => Promise<void>;

  addCrmActivity: (act: CrmActivity) => Promise<void>;
  updateCrmActivity: (act: CrmActivity) => Promise<void>;
  deleteCrmActivity: (actId: string) => Promise<void>;

  // Universal Archive Process
  archiveProcessRecord: (params: {
    title: string;
    category: ArchivedDocumentCategory;
    referenceNumber: string;
    clientOrEntity: string;
    notes?: string;
    tags?: string[];
    sourceModule: string;
    fileDataUrl?: string;
    fileName?: string;
  }) => Promise<ArchivedDocument>;

  resetToDefaults: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);

  const [lessors, setLessors] = useState<Lessor[]>(INITIAL_LESSORS);
  const [tenants, setTenants] = useState<Tenant[]>(INITIAL_TENANTS);
  const [representatives, setRepresentatives] = useState<Representative[]>(INITIAL_REPRESENTATIVES);
  const [documents, setDocuments] = useState<OwnershipDocument[]>(INITIAL_OWNERSHIP_DOCUMENTS);
  const [properties, setProperties] = useState<Property[]>(INITIAL_PROPERTIES);
  const [ePoas, setEPoas] = useState<EPoa[]>(INITIAL_E_POAS);
  const [contracts, setContracts] = useState<Contract[]>(INITIAL_CONTRACTS);
  const [brokerageAgreements, setBrokerageAgreements] = useState<BrokerageAgreement[]>(INITIAL_BROKERAGE_AGREEMENTS);
  const [auditLogs, setAuditLogs] = useState<OwnershipAuditLog[]>(INITIAL_AUDIT_LOGS);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(INITIAL_FINANCIAL_TRANSACTIONS);
  const [dailySummaries, setDailySummaries] = useState<DailyFinancialSummary[]>(INITIAL_DAILY_FINANCIAL_SUMMARIES);
  const [aiReports, setAiReports] = useState<AiDailyReport[]>(INITIAL_AI_DAILY_REPORTS);
  const [generalServices, setGeneralServices] = useState<GeneralService[]>(INITIAL_GENERAL_SERVICES);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>(INITIAL_CUSTOMER_ORDERS);
  const [managedProperties, setManagedProperties] = useState<ManagedPropertyContract[]>(INITIAL_MANAGED_PROPERTIES);
  const [maintenanceTasks, setMaintenanceTasks] = useState<PropertyMaintenanceTask[]>(INITIAL_MAINTENANCE_TASKS);
  const [archivedDocuments, setArchivedDocuments] = useState<ArchivedDocument[]>(INITIAL_ARCHIVED_DOCUMENTS);

  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [timesheetEntries, setTimesheetEntries] = useState<TimesheetEntry[]>(INITIAL_TIMESHEET_ENTRIES);
  const [payrollPayments, setPayrollPayments] = useState<PayrollPayment[]>(INITIAL_PAYROLL_PAYMENTS);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(INITIAL_LEAVE_REQUESTS);
  const [taskDelegations, setTaskDelegations] = useState<TaskDelegation[]>(INITIAL_TASK_DELEGATIONS);
  const [crmLeads, setCrmLeads] = useState<CrmLead[]>(INITIAL_CRM_LEADS);
  const [crmDeals, setCrmDeals] = useState<CrmDeal[]>(INITIAL_CRM_DEALS);
  const [crmActivities, setCrmActivities] = useState<CrmActivity[]>(INITIAL_CRM_ACTIVITIES);

  useEffect(() => {
    async function initData() {
      setIsLoading(true);
      const data = await dbFetchAllData();
      setLessors(data.lessors);
      if (data.tenants) setTenants(data.tenants);
      setRepresentatives(data.representatives);
      setDocuments(data.documents);
      setProperties(data.properties);
      setEPoas(data.ePoas);
      setContracts(data.contracts);
      setBrokerageAgreements(data.brokerageAgreements);
      setAuditLogs(data.auditLogs);
      setTransactions(data.transactions);
      setDailySummaries(data.dailySummaries);
      setAiReports(data.aiReports);
      if (data.generalServices) setGeneralServices(data.generalServices);
      if (data.customerOrders) setCustomerOrders(data.customerOrders);
      if (data.managedProperties) setManagedProperties(data.managedProperties);
      if (data.maintenanceTasks) setMaintenanceTasks(data.maintenanceTasks);
      if (data.archivedDocuments) setArchivedDocuments(data.archivedDocuments);
      if (data.employees) setEmployees(data.employees);
      if (data.timesheetEntries) setTimesheetEntries(data.timesheetEntries);
      if (data.payrollPayments) setPayrollPayments(data.payrollPayments);
      if (data.leaveRequests) setLeaveRequests(data.leaveRequests);
      if (data.taskDelegations) setTaskDelegations(data.taskDelegations);
      if (data.crmLeads) setCrmLeads(data.crmLeads);
      if (data.crmDeals) setCrmDeals(data.crmDeals);
      if (data.crmActivities) setCrmActivities(data.crmActivities);
      setIsLoading(false);
    }
    initData();
  }, []);

  // Save changes helper
  const syncLocal = (key: string, data: any) => setLocalData(key, data);

  // ------------------------------------
  // PROPERTIES & DEEDS ACTIONS
  // ------------------------------------
  const addProperty = async (newProp: Property, newDoc?: OwnershipDocument) => {
    let updatedDocs = documents;
    if (newDoc) {
      updatedDocs = [newDoc, ...documents];
      setDocuments(updatedDocs);
      syncLocal(STORAGE_KEYS.DOCUMENTS, updatedDocs);
      await dbInsertOwnershipDocument(newDoc);
    }

    const updatedProps = [newProp, ...properties];
    setProperties(updatedProps);
    syncLocal(STORAGE_KEYS.PROPERTIES, updatedProps);
    await dbInsertProperty(newProp);
  };

  const updateProperty = async (updatedProp: Property) => {
    const updatedProps = properties.map((p) => (p.id === updatedProp.id ? updatedProp : p));
    setProperties(updatedProps);
    syncLocal(STORAGE_KEYS.PROPERTIES, updatedProps);
    await dbUpdateProperty(updatedProp);
  };

  const deleteProperty = async (propertyId: string) => {
    const updatedProps = properties.filter((p) => p.id !== propertyId);
    setProperties(updatedProps);
    syncLocal(STORAGE_KEYS.PROPERTIES, updatedProps);
    await dbDeleteProperty(propertyId);
  };

  const updatePropertyRep = async (propertyId: string, newRepId: string, notes?: string) => {
    const propIndex = properties.findIndex((p) => p.id === propertyId);
    if (propIndex === -1) return;

    const targetProp = properties[propIndex];
    const prevRepId = targetProp.current_representative_id;
    const newRep = representatives.find((r) => r.id === newRepId);

    const updatedProp: Property = {
      ...targetProp,
      current_representative_id: newRepId,
      current_representative: newRep,
    };

    const updatedProps = [...properties];
    updatedProps[propIndex] = updatedProp;
    setProperties(updatedProps);
    syncLocal(STORAGE_KEYS.PROPERTIES, updatedProps);
    await dbUpdateProperty(updatedProp);

    // Audit Log
    const newLog: OwnershipAuditLog = {
      id: `aud-${Date.now()}`,
      property_id: propertyId,
      previous_lessor_id: targetProp.lessor_id,
      new_lessor_id: targetProp.lessor_id,
      previous_representative_id: prevRepId,
      new_representative_id: newRepId,
      change_type: 'REPRESENTATIVE_CHANGE',
      notes: notes || `تم تغيير وكيل العقار إلى ${newRep?.name || ''}`,
      changed_at: new Date().toISOString(),
      property: updatedProp,
      new_representative: newRep,
    };

    const updatedLogs = [newLog, ...auditLogs];
    setAuditLogs(updatedLogs);
    syncLocal(STORAGE_KEYS.AUDIT_LOGS, updatedLogs);
    await dbInsertAuditLog(newLog);
  };

  const transferPropertyLessor = async (
    propertyId: string,
    newLessorId: string,
    newDeedNumber: string,
    notes?: string
  ) => {
    const propIndex = properties.findIndex((p) => p.id === propertyId);
    if (propIndex === -1) return;

    const targetProp = properties[propIndex];
    const prevLessorId = targetProp.lessor_id;
    const newLessor = lessors.find((l) => l.id === newLessorId);

    // 1. Create Deed
    const newDeed: OwnershipDocument = {
      id: `deed-${Date.now()}`,
      document_number: newDeedNumber,
      issue_date: new Date().toISOString().split('T')[0],
      lessor_id: newLessorId,
      lessor: newLessor,
      created_at: new Date().toISOString(),
    };

    const updatedDocs = [newDeed, ...documents];
    setDocuments(updatedDocs);
    syncLocal(STORAGE_KEYS.DOCUMENTS, updatedDocs);
    await dbInsertOwnershipDocument(newDeed);

    // 2. Update Property
    const updatedProp: Property = {
      ...targetProp,
      lessor_id: newLessorId,
      lessor: newLessor,
      ownership_document_id: newDeed.id,
      ownership_document: newDeed,
    };

    const updatedProps = [...properties];
    updatedProps[propIndex] = updatedProp;
    setProperties(updatedProps);
    syncLocal(STORAGE_KEYS.PROPERTIES, updatedProps);
    await dbUpdateProperty(updatedProp);

    // 3. Log
    const newLog: OwnershipAuditLog = {
      id: `aud-${Date.now()}`,
      property_id: propertyId,
      previous_lessor_id: prevLessorId,
      new_lessor_id: newLessorId,
      previous_representative_id: targetProp.current_representative_id,
      new_representative_id: targetProp.current_representative_id,
      change_type: 'LESSOR_TRANSFER',
      notes: notes || `تم نقل ملكية العقار إلى ${newLessor?.name || ''} بموجب صك ${newDeedNumber}`,
      changed_at: new Date().toISOString(),
      property: updatedProp,
      new_lessor: newLessor,
    };

    const updatedLogs = [newLog, ...auditLogs];
    setAuditLogs(updatedLogs);
    syncLocal(STORAGE_KEYS.AUDIT_LOGS, updatedLogs);
    await dbInsertAuditLog(newLog);
  };

  // ------------------------------------
  // DOCUMENTS ACTIONS
  // ------------------------------------
  const addDocument = async (doc: OwnershipDocument) => {
    const updated = [doc, ...documents];
    setDocuments(updated);
    syncLocal(STORAGE_KEYS.DOCUMENTS, updated);
    await dbInsertOwnershipDocument(doc);
  };

  const updateDocument = async (doc: OwnershipDocument) => {
    const updated = documents.map((d) => (d.id === doc.id ? doc : d));
    setDocuments(updated);
    syncLocal(STORAGE_KEYS.DOCUMENTS, updated);
    await dbUpdateOwnershipDocument(doc);
  };

  const deleteDocument = async (docId: string) => {
    const updated = documents.filter((d) => d.id !== docId);
    setDocuments(updated);
    syncLocal(STORAGE_KEYS.DOCUMENTS, updated);
    await dbDeleteOwnershipDocument(docId);
  };

  // ------------------------------------
  // LESSORS ACTIONS
  // ------------------------------------
  const addLessor = async (lessor: Lessor) => {
    const updated = [lessor, ...lessors];
    setLessors(updated);
    syncLocal(STORAGE_KEYS.LESSORS, updated);
    await dbInsertLessor(lessor);
  };

  const updateLessor = async (lessor: Lessor) => {
    const updated = lessors.map((l) => (l.id === lessor.id ? lessor : l));
    setLessors(updated);
    syncLocal(STORAGE_KEYS.LESSORS, updated);
    await dbUpdateLessor(lessor);
  };

  const deleteLessor = async (lessorId: string) => {
    const updated = lessors.filter((l) => l.id !== lessorId);
    setLessors(updated);
    syncLocal(STORAGE_KEYS.LESSORS, updated);
    await dbDeleteLessor(lessorId);
  };

  // ------------------------------------
  // TENANTS ACTIONS
  // ------------------------------------
  const addTenant = async (tenant: Tenant) => {
    const updated = [tenant, ...tenants];
    setTenants(updated);
    syncLocal(STORAGE_KEYS.TENANTS, updated);
    await dbInsertTenant(tenant);
  };

  const updateTenant = async (tenant: Tenant) => {
    const updated = tenants.map((t) => (t.id === tenant.id ? tenant : t));
    setTenants(updated);
    syncLocal(STORAGE_KEYS.TENANTS, updated);
    await dbUpdateTenant(tenant);
  };

  const deleteTenant = async (tenantId: string) => {
    const updated = tenants.filter((t) => t.id !== tenantId);
    setTenants(updated);
    syncLocal(STORAGE_KEYS.TENANTS, updated);
    await dbDeleteTenant(tenantId);
  };

  // ------------------------------------
  // REPRESENTATIVES ACTIONS
  // ------------------------------------
  const addRepresentative = async (rep: Representative) => {
    const updated = [rep, ...representatives];
    setRepresentatives(updated);
    syncLocal(STORAGE_KEYS.REPRESENTATIVES, updated);
    await dbInsertRepresentative(rep);
  };

  const updateRepresentative = async (rep: Representative) => {
    const updated = representatives.map((r) => (r.id === rep.id ? rep : r));
    setRepresentatives(updated);
    syncLocal(STORAGE_KEYS.REPRESENTATIVES, updated);
    await dbUpdateRepresentative(rep);
  };

  const deleteRepresentative = async (repId: string) => {
    const updated = representatives.filter((r) => r.id !== repId);
    setRepresentatives(updated);
    syncLocal(STORAGE_KEYS.REPRESENTATIVES, updated);
    await dbDeleteRepresentative(repId);
  };

  // ------------------------------------
  // E-POAs ACTIONS
  // ------------------------------------
  const addEPoa = async (poa: EPoa) => {
    const updated = [poa, ...ePoas];
    setEPoas(updated);
    syncLocal(STORAGE_KEYS.E_POAS, updated);
    await dbInsertEPoa(poa);
  };

  const updateEPoa = async (poa: EPoa) => {
    const updated = ePoas.map((p) => (p.id === poa.id ? poa : p));
    setEPoas(updated);
    syncLocal(STORAGE_KEYS.E_POAS, updated);
    await dbUpdateEPoa(poa);
  };

  const deleteEPoa = async (poaId: string) => {
    const updated = ePoas.filter((p) => p.id !== poaId);
    setEPoas(updated);
    syncLocal(STORAGE_KEYS.E_POAS, updated);
    await dbDeleteEPoa(poaId);
  };

  // ------------------------------------
  // CONTRACTS ACTIONS
  // ------------------------------------
  const addContract = async (contract: Contract) => {
    const updated = [contract, ...contracts];
    setContracts(updated);
    syncLocal(STORAGE_KEYS.CONTRACTS, updated);
    await dbInsertContract(contract);
  };

  const updateContract = async (contract: Contract) => {
    const updated = contracts.map((c) => (c.id === contract.id ? contract : c));
    setContracts(updated);
    syncLocal(STORAGE_KEYS.CONTRACTS, updated);
    await dbUpdateContract(contract);
  };

  const deleteContract = async (contractId: string) => {
    const updated = contracts.filter((c) => c.id !== contractId);
    setContracts(updated);
    syncLocal(STORAGE_KEYS.CONTRACTS, updated);
    await dbDeleteContract(contractId);
  };

  // ------------------------------------
  // BROKERAGE AGREEMENTS ACTIONS
  // ------------------------------------
  const addBrokerageAgreement = async (agreement: BrokerageAgreement) => {
    const updated = [agreement, ...brokerageAgreements];
    setBrokerageAgreements(updated);
    syncLocal(STORAGE_KEYS.BROKERAGE, updated);
    await dbInsertBrokerageAgreement(agreement);
  };

  const updateBrokerageAgreement = async (agreement: BrokerageAgreement) => {
    const updated = brokerageAgreements.map((b) => (b.id === agreement.id ? agreement : b));
    setBrokerageAgreements(updated);
    syncLocal(STORAGE_KEYS.BROKERAGE, updated);
    await dbUpdateBrokerageAgreement(agreement);
  };

  const deleteBrokerageAgreement = async (agreementId: string) => {
    const updated = brokerageAgreements.filter((b) => b.id !== agreementId);
    setBrokerageAgreements(updated);
    syncLocal(STORAGE_KEYS.BROKERAGE, updated);
    await dbDeleteBrokerageAgreement(agreementId);
  };

  // ------------------------------------
  // FINANCIAL TRANSACTIONS ACTIONS
  // ------------------------------------
  const addTransaction = async (tx: FinancialTransaction) => {
    const updatedTx = [tx, ...transactions];
    setTransactions(updatedTx);
    syncLocal(STORAGE_KEYS.TRANSACTIONS, updatedTx);

    // Update Daily Summary
    const updatedSummary = computeDailySummaryFromTransactions(updatedTx, tx.transaction_date);
    const existingIndex = dailySummaries.findIndex((s) => s.summary_date === tx.transaction_date);
    let updatedSummaries: DailyFinancialSummary[];

    if (existingIndex >= 0) {
      updatedSummaries = [...dailySummaries];
      updatedSummaries[existingIndex] = updatedSummary;
    } else {
      updatedSummaries = [updatedSummary, ...dailySummaries];
    }
    setDailySummaries(updatedSummaries);
    syncLocal(STORAGE_KEYS.SUMMARIES, updatedSummaries);

    await dbInsertFinancialTransaction(tx);
  };

  const updateTransaction = async (tx: FinancialTransaction) => {
    const updatedTx = transactions.map((t) => (t.id === tx.id ? tx : t));
    setTransactions(updatedTx);
    syncLocal(STORAGE_KEYS.TRANSACTIONS, updatedTx);

    const updatedSummary = computeDailySummaryFromTransactions(updatedTx, tx.transaction_date);
    const existingIndex = dailySummaries.findIndex((s) => s.summary_date === tx.transaction_date);
    if (existingIndex >= 0) {
      const updatedSummaries = [...dailySummaries];
      updatedSummaries[existingIndex] = updatedSummary;
      setDailySummaries(updatedSummaries);
      syncLocal(STORAGE_KEYS.SUMMARIES, updatedSummaries);
    }

    await dbUpdateFinancialTransaction(tx);
  };

  const deleteTransaction = async (txId: string) => {
    const targetTx = transactions.find((t) => t.id === txId);
    const updatedTx = transactions.filter((t) => t.id !== txId);
    setTransactions(updatedTx);
    syncLocal(STORAGE_KEYS.TRANSACTIONS, updatedTx);

    if (targetTx) {
      const updatedSummary = computeDailySummaryFromTransactions(updatedTx, targetTx.transaction_date);
      const existingIndex = dailySummaries.findIndex((s) => s.summary_date === targetTx.transaction_date);
      if (existingIndex >= 0) {
        const updatedSummaries = [...dailySummaries];
        updatedSummaries[existingIndex] = updatedSummary;
        setDailySummaries(updatedSummaries);
        syncLocal(STORAGE_KEYS.SUMMARIES, updatedSummaries);
      }
    }

    await dbDeleteFinancialTransaction(txId);
  };

  // ------------------------------------
  // RESET ALL TO DEFAULTS
  // ------------------------------------
  const addGeneralService = async (service: GeneralService) => {
    const updated = [service, ...generalServices];
    setGeneralServices(updated);
    syncLocal(STORAGE_KEYS.GENERAL_SERVICES, updated);
    await dbInsertGeneralService(service);
  };

  const updateGeneralService = async (service: GeneralService) => {
    const updated = generalServices.map((s) => (s.id === service.id ? service : s));
    setGeneralServices(updated);
    syncLocal(STORAGE_KEYS.GENERAL_SERVICES, updated);
    await dbUpdateGeneralService(service);
  };

  const deleteGeneralService = async (serviceId: string) => {
    const updated = generalServices.filter((s) => s.id !== serviceId);
    setGeneralServices(updated);
    syncLocal(STORAGE_KEYS.GENERAL_SERVICES, updated);
    await dbDeleteGeneralService(serviceId);
  };

  const addCustomerOrder = async (order: CustomerOrder): Promise<boolean> => {
    const success = await dbInsertCustomerOrder(order);
    if (success) {
      setCustomerOrders((prev) => {
        const updated = [order, ...prev];
        syncLocal(STORAGE_KEYS.CUSTOMER_ORDERS, updated);
        return updated;
      });
    }
    return success;
  };

  const updateCustomerOrder = async (order: CustomerOrder) => {
    const updated = customerOrders.map((o) => (o.id === order.id ? order : o));
    setCustomerOrders(updated);
    syncLocal(STORAGE_KEYS.CUSTOMER_ORDERS, updated);
    await dbUpdateCustomerOrder(order);
  };

  const deleteCustomerOrder = async (orderId: string) => {
    const updated = customerOrders.filter((o) => o.id !== orderId);
    setCustomerOrders(updated);
    syncLocal(STORAGE_KEYS.CUSTOMER_ORDERS, updated);
    await dbDeleteCustomerOrder(orderId);
  };

  // ------------------------------------
  // MANAGED PROPERTIES ACTIONS
  // ------------------------------------
  const addManagedProperty = async (prop: ManagedPropertyContract) => {
    const updated = [prop, ...managedProperties];
    setManagedProperties(updated);
    syncLocal(STORAGE_KEYS.MANAGED_PROPERTIES, updated);
    await dbInsertManagedProperty(prop);
  };

  const updateManagedProperty = async (prop: ManagedPropertyContract) => {
    const updated = managedProperties.map((p) => (p.id === prop.id ? prop : p));
    setManagedProperties(updated);
    syncLocal(STORAGE_KEYS.MANAGED_PROPERTIES, updated);
    await dbUpdateManagedProperty(prop);
  };

  const deleteManagedProperty = async (propId: string) => {
    const updated = managedProperties.filter((p) => p.id !== propId);
    setManagedProperties(updated);
    syncLocal(STORAGE_KEYS.MANAGED_PROPERTIES, updated);
    await dbDeleteManagedProperty(propId);
  };

  // ------------------------------------
  // MAINTENANCE TASKS ACTIONS
  // ------------------------------------
  const addMaintenanceTask = async (task: PropertyMaintenanceTask) => {
    const updated = [task, ...maintenanceTasks];
    setMaintenanceTasks(updated);
    syncLocal(STORAGE_KEYS.MAINTENANCE_TASKS, updated);
    await dbInsertMaintenanceTask(task);
  };

  const updateMaintenanceTask = async (task: PropertyMaintenanceTask) => {
    const updated = maintenanceTasks.map((t) => (t.id === task.id ? task : t));
    setMaintenanceTasks(updated);
    syncLocal(STORAGE_KEYS.MAINTENANCE_TASKS, updated);
    await dbUpdateMaintenanceTask(task);
  };

  const deleteMaintenanceTask = async (taskId: string) => {
    const updated = maintenanceTasks.filter((t) => t.id !== taskId);
    setMaintenanceTasks(updated);
    syncLocal(STORAGE_KEYS.MAINTENANCE_TASKS, updated);
    await dbDeleteMaintenanceTask(taskId);
  };

  // ------------------------------------
  // ARCHIVED DOCUMENTS ACTIONS
  // ------------------------------------
  const addArchivedDocument = async (doc: ArchivedDocument) => {
    const updated = [doc, ...archivedDocuments];
    setArchivedDocuments(updated);
    syncLocal(STORAGE_KEYS.ARCHIVED_DOCUMENTS, updated);
    await dbInsertArchivedDocument(doc);
  };

  const updateArchivedDocument = async (doc: ArchivedDocument) => {
    const updated = archivedDocuments.map((d) => (d.id === doc.id ? doc : d));
    setArchivedDocuments(updated);
    syncLocal(STORAGE_KEYS.ARCHIVED_DOCUMENTS, updated);
    await dbUpdateArchivedDocument(doc);
  };

  const deleteArchivedDocument = async (docId: string) => {
    const updated = archivedDocuments.filter((d) => d.id !== docId);
    setArchivedDocuments(updated);
    syncLocal(STORAGE_KEYS.ARCHIVED_DOCUMENTS, updated);
    await dbDeleteArchivedDocument(docId);
  };

  // ------------------------------------
  // EMPLOYEES & HR ACTIONS
  // ------------------------------------
  const addEmployee = async (emp: Employee) => {
    const updated = [emp, ...employees];
    setEmployees(updated);
    syncLocal(STORAGE_KEYS.EMPLOYEES, updated);
    await dbInsertEmployee(emp);
  };

  const updateEmployee = async (emp: Employee) => {
    const updated = employees.map((e) => (e.id === emp.id ? emp : e));
    setEmployees(updated);
    syncLocal(STORAGE_KEYS.EMPLOYEES, updated);
    await dbUpdateEmployee(emp);
  };

  const deleteEmployee = async (empId: string) => {
    const updated = employees.filter((e) => e.id !== empId);
    setEmployees(updated);
    syncLocal(STORAGE_KEYS.EMPLOYEES, updated);
    await dbDeleteEmployee(empId);
  };

  // ------------------------------------
  // TIMESHEET & ATTENDANCE ACTIONS
  // ------------------------------------
  const addTimesheet = async (ts: TimesheetEntry) => {
    const updated = [ts, ...timesheetEntries];
    setTimesheetEntries(updated);
    syncLocal(STORAGE_KEYS.TIMESHEET, updated);
    await dbInsertTimesheet(ts);
  };

  const updateTimesheet = async (ts: TimesheetEntry) => {
    const updated = timesheetEntries.map((t) => (t.id === ts.id ? ts : t));
    setTimesheetEntries(updated);
    syncLocal(STORAGE_KEYS.TIMESHEET, updated);
    await dbUpdateTimesheet(ts);
  };

  const deleteTimesheet = async (tsId: string) => {
    const updated = timesheetEntries.filter((t) => t.id !== tsId);
    setTimesheetEntries(updated);
    syncLocal(STORAGE_KEYS.TIMESHEET, updated);
    await dbDeleteTimesheet(tsId);
  };

  const clockInToday = async (employeeId: string, employeeName: string) => {
    const today = new Date().toISOString().split('T')[0];
    const nowHours = new Date().toTimeString().slice(0, 5);
    const existing = timesheetEntries.find((t) => t.employee_id === employeeId && t.date === today);
    if (existing) return; // already clocked in

    const newEntry: TimesheetEntry = {
      id: `ts-${Date.now()}`,
      employee_id: employeeId,
      employee_name: employeeName,
      date: today,
      check_in: nowHours,
      status: 'PRESENT',
      created_at: new Date().toISOString(),
    };
    await addTimesheet(newEntry);
  };

  const clockOutToday = async (employeeId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const nowHours = new Date().toTimeString().slice(0, 5);
    const match = timesheetEntries.find((t) => t.employee_id === employeeId && t.date === today);
    if (!match) return;

    let totalHrs = 8.0;
    try {
      const [inH, inM] = match.check_in.split(':').map(Number);
      const [outH, outM] = nowHours.split(':').map(Number);
      const diff = (outH * 60 + outM - (inH * 60 + inM)) / 60;
      totalHrs = Math.max(0.5, Math.round(diff * 10) / 10);
    } catch {
      totalHrs = 8.0;
    }

    const updated: TimesheetEntry = {
      ...match,
      check_out: nowHours,
      total_hours: totalHrs,
    };
    await updateTimesheet(updated);
  };

  // ------------------------------------
  // PAYROLL ACTIONS
  // ------------------------------------
  const addPayroll = async (pay: PayrollPayment) => {
    const updated = [pay, ...payrollPayments];
    setPayrollPayments(updated);
    syncLocal(STORAGE_KEYS.PAYROLL, updated);
    await dbInsertPayroll(pay);
  };

  const updatePayroll = async (pay: PayrollPayment) => {
    const updated = payrollPayments.map((p) => (p.id === pay.id ? pay : p));
    setPayrollPayments(updated);
    syncLocal(STORAGE_KEYS.PAYROLL, updated);
    await dbUpdatePayroll(pay);
  };

  const deletePayroll = async (payId: string) => {
    const updated = payrollPayments.filter((p) => p.id !== payId);
    setPayrollPayments(updated);
    syncLocal(STORAGE_KEYS.PAYROLL, updated);
    await dbDeletePayroll(payId);
  };

  // ------------------------------------
  // LEAVE REQUESTS ACTIONS
  // ------------------------------------
  const addLeaveRequest = async (lv: LeaveRequest) => {
    const updated = [lv, ...leaveRequests];
    setLeaveRequests(updated);
    syncLocal(STORAGE_KEYS.LEAVES, updated);
    await dbInsertLeaveRequest(lv);
  };

  const updateLeaveRequest = async (lv: LeaveRequest) => {
    const updated = leaveRequests.map((l) => (l.id === lv.id ? lv : l));
    setLeaveRequests(updated);
    syncLocal(STORAGE_KEYS.LEAVES, updated);
    await dbUpdateLeaveRequest(lv);
  };

  const deleteLeaveRequest = async (lvId: string) => {
    const updated = leaveRequests.filter((l) => l.id !== lvId);
    setLeaveRequests(updated);
    syncLocal(STORAGE_KEYS.LEAVES, updated);
    await dbDeleteLeaveRequest(lvId);
  };

  const approveLeave = async (lvId: string, approverName: string) => {
    const match = leaveRequests.find((l) => l.id === lvId);
    if (match) {
      await updateLeaveRequest({
        ...match,
        status: 'APPROVED',
        approved_by: approverName,
        approved_at: new Date().toISOString(),
      });
    }
  };

  const rejectLeave = async (lvId: string) => {
    const match = leaveRequests.find((l) => l.id === lvId);
    if (match) {
      await updateLeaveRequest({
        ...match,
        status: 'REJECTED',
      });
    }
  };

  // ------------------------------------
  // TASK DELEGATIONS ACTIONS
  // ------------------------------------
  const addTaskDelegation = async (tsk: TaskDelegation) => {
    const updated = [tsk, ...taskDelegations];
    setTaskDelegations(updated);
    syncLocal(STORAGE_KEYS.TASK_DELEGATIONS, updated);
    await dbInsertTaskDelegation(tsk);
  };

  const updateTaskDelegation = async (tsk: TaskDelegation) => {
    const updated = taskDelegations.map((t) => (t.id === tsk.id ? tsk : t));
    setTaskDelegations(updated);
    syncLocal(STORAGE_KEYS.TASK_DELEGATIONS, updated);
    await dbUpdateTaskDelegation(tsk);
  };

  const deleteTaskDelegation = async (tskId: string) => {
    const updated = taskDelegations.filter((t) => t.id !== tskId);
    setTaskDelegations(updated);
    syncLocal(STORAGE_KEYS.TASK_DELEGATIONS, updated);
    await dbDeleteTaskDelegation(tskId);
  };

  // ------------------------------------
  // CRM LEADS ACTIONS
  // ------------------------------------
  const addCrmLead = async (lead: CrmLead) => {
    const updated = [lead, ...crmLeads];
    setCrmLeads(updated);
    syncLocal(STORAGE_KEYS.CRM_LEADS, updated);
    await dbInsertCrmLead(lead);
  };

  const updateCrmLead = async (lead: CrmLead) => {
    const updated = crmLeads.map((l) => (l.id === lead.id ? lead : l));
    setCrmLeads(updated);
    syncLocal(STORAGE_KEYS.CRM_LEADS, updated);
    await dbUpdateCrmLead(lead);
  };

  const deleteCrmLead = async (leadId: string) => {
    const updated = crmLeads.filter((l) => l.id !== leadId);
    setCrmLeads(updated);
    syncLocal(STORAGE_KEYS.CRM_LEADS, updated);
    await dbDeleteCrmLead(leadId);
  };

  const updateLeadStage = async (leadId: string, stage: CrmLead['stage']) => {
    const match = crmLeads.find((l) => l.id === leadId);
    if (match) {
      await updateCrmLead({ ...match, stage });
    }
  };

  // ------------------------------------
  // CRM DEALS ACTIONS
  // ------------------------------------
  const addCrmDeal = async (deal: CrmDeal) => {
    const updated = [deal, ...crmDeals];
    setCrmDeals(updated);
    syncLocal(STORAGE_KEYS.CRM_DEALS, updated);
    await dbInsertCrmDeal(deal);
  };

  const updateCrmDeal = async (deal: CrmDeal) => {
    const updated = crmDeals.map((d) => (d.id === deal.id ? deal : d));
    setCrmDeals(updated);
    syncLocal(STORAGE_KEYS.CRM_DEALS, updated);
    await dbUpdateCrmDeal(deal);
  };

  const deleteCrmDeal = async (dealId: string) => {
    const updated = crmDeals.filter((d) => d.id !== dealId);
    setCrmDeals(updated);
    syncLocal(STORAGE_KEYS.CRM_DEALS, updated);
    await dbDeleteCrmDeal(dealId);
  };

  const updateDealStage = async (dealId: string, stage: CrmDeal['stage']) => {
    const match = crmDeals.find((d) => d.id === dealId);
    if (match) {
      await updateCrmDeal({ ...match, stage });
    }
  };

  // ------------------------------------
  // CRM ACTIVITIES ACTIONS
  // ------------------------------------
  const addCrmActivity = async (act: CrmActivity) => {
    const updated = [act, ...crmActivities];
    setCrmActivities(updated);
    syncLocal(STORAGE_KEYS.CRM_ACTIVITIES, updated);
    await dbInsertCrmActivity(act);
  };

  const updateCrmActivity = async (act: CrmActivity) => {
    const updated = crmActivities.map((a) => (a.id === act.id ? act : a));
    setCrmActivities(updated);
    syncLocal(STORAGE_KEYS.CRM_ACTIVITIES, updated);
    await dbUpdateCrmActivity(act);
  };

  const deleteCrmActivity = async (actId: string) => {
    const updated = crmActivities.filter((a) => a.id !== actId);
    setCrmActivities(updated);
    syncLocal(STORAGE_KEYS.CRM_ACTIVITIES, updated);
    await dbDeleteCrmActivity(actId);
  };

  // ------------------------------------
  // UNIVERSAL ARCHIVE PROCESS ACTION
  // ------------------------------------
  const archiveProcessRecord = async (params: {
    title: string;
    category: ArchivedDocumentCategory;
    referenceNumber: string;
    clientOrEntity: string;
    notes?: string;
    tags?: string[];
    sourceModule: string;
    fileDataUrl?: string;
    fileName?: string;
  }): Promise<ArchivedDocument> => {
    const codeNumber = Math.floor(1000 + Math.random() * 9000);
    const newDoc: ArchivedDocument = {
      id: `arc-${Date.now()}`,
      archive_code: `ARC-2026-${codeNumber}`,
      title: params.title,
      category: params.category,
      reference_number: params.referenceNumber,
      client_or_entity: params.clientOrEntity,
      date: new Date().toISOString().split('T')[0],
      status: 'ARCHIVED',
      file_name: params.fileName || `${params.referenceNumber || 'مستند_مؤرشف'}.pdf`,
      file_data_url: params.fileDataUrl,
      notes: params.notes,
      tags: params.tags || [params.sourceModule, 'أرشيف إلكتروني'],
      source_module: params.sourceModule,
      created_at: new Date().toISOString(),
    };
    await addArchivedDocument(newDoc);
    return newDoc;
  };

  const resetToDefaults = () => {
    clearAllLocalData();
    setLessors(INITIAL_LESSORS);
    setTenants(INITIAL_TENANTS);
    setRepresentatives(INITIAL_REPRESENTATIVES);
    setDocuments(INITIAL_OWNERSHIP_DOCUMENTS);
    setProperties(INITIAL_PROPERTIES);
    setEPoas(INITIAL_E_POAS);
    setContracts(INITIAL_CONTRACTS);
    setBrokerageAgreements(INITIAL_BROKERAGE_AGREEMENTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setTransactions(INITIAL_FINANCIAL_TRANSACTIONS);
    setDailySummaries(INITIAL_DAILY_FINANCIAL_SUMMARIES);
    setAiReports(INITIAL_AI_DAILY_REPORTS);
    setGeneralServices(INITIAL_GENERAL_SERVICES);
    setCustomerOrders(INITIAL_CUSTOMER_ORDERS);
    setManagedProperties(INITIAL_MANAGED_PROPERTIES);
    setMaintenanceTasks(INITIAL_MAINTENANCE_TASKS);
    setArchivedDocuments(INITIAL_ARCHIVED_DOCUMENTS);
    setEmployees(INITIAL_EMPLOYEES);
    setTimesheetEntries(INITIAL_TIMESHEET_ENTRIES);
    setPayrollPayments(INITIAL_PAYROLL_PAYMENTS);
    setLeaveRequests(INITIAL_LEAVE_REQUESTS);
    setTaskDelegations(INITIAL_TASK_DELEGATIONS);
    setCrmLeads(INITIAL_CRM_LEADS);
    setCrmDeals(INITIAL_CRM_DEALS);
    setCrmActivities(INITIAL_CRM_ACTIVITIES);
  };

  return (
    <DataContext.Provider
      value={{
        isLoading,
        lessors,
        tenants,
        representatives,
        documents,
        properties,
        ePoas,
        contracts,
        brokerageAgreements,
        auditLogs,
        transactions,
        dailySummaries,
        aiReports,
        generalServices,
        customerOrders,
        managedProperties,
        maintenanceTasks,
        archivedDocuments,
        employees,
        timesheetEntries,
        payrollPayments,
        leaveRequests,
        taskDelegations,
        crmLeads,
        crmDeals,
        crmActivities,

        addProperty,
        updateProperty,
        deleteProperty,
        updatePropertyRep,
        transferPropertyLessor,

        addDocument,
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

        addContract,
        updateContract,
        deleteContract,

        addBrokerageAgreement,
        updateBrokerageAgreement,
        deleteBrokerageAgreement,

        addTransaction,
        updateTransaction,
        deleteTransaction,

        addGeneralService,
        updateGeneralService,
        deleteGeneralService,

        addCustomerOrder,
        updateCustomerOrder,
        deleteCustomerOrder,

        addManagedProperty,
        updateManagedProperty,
        deleteManagedProperty,

        addMaintenanceTask,
        updateMaintenanceTask,
        deleteMaintenanceTask,

        addArchivedDocument,
        updateArchivedDocument,
        deleteArchivedDocument,

        // Employees & HR Actions
        addEmployee,
        updateEmployee,
        deleteEmployee,
        addTimesheet,
        updateTimesheet,
        deleteTimesheet,
        clockInToday,
        clockOutToday,
        addPayroll,
        updatePayroll,
        deletePayroll,
        addLeaveRequest,
        updateLeaveRequest,
        deleteLeaveRequest,
        approveLeave,
        rejectLeave,
        addTaskDelegation,
        updateTaskDelegation,
        deleteTaskDelegation,

        // CRM Actions
        addCrmLead,
        updateCrmLead,
        deleteCrmLead,
        updateLeadStage,
        addCrmDeal,
        updateCrmDeal,
        deleteCrmDeal,
        updateDealStage,
        addCrmActivity,
        updateCrmActivity,
        deleteCrmActivity,

        // Universal Archive
        archiveProcessRecord,

        resetToDefaults,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
