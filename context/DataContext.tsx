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
