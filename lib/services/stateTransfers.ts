import {
  Property,
  OwnershipAuditLog,
  OwnershipDocument,
  Lessor,
  Representative,
} from '../types';

/**
 * تنفيذ نقل ملكية عقار إلى مؤجر جديد مع توثيق العملية في سجل التدقيق
 * Business Logic for Change Lessor Ownership State Transfer
 */
export async function executeChangeLessor(params: {
  properties: Property[];
  auditLogs: OwnershipAuditLog[];
  lessors: Lessor[];
  propertyId: string;
  newLessorId: string;
  newDeedNumber: string;
  notes?: string;
}): Promise<{
  updatedProperties: Property[];
  updatedAuditLogs: OwnershipAuditLog[];
  updatedOwnershipDocs: OwnershipDocument[];
  log: OwnershipAuditLog;
}> {
  const propertyIndex = params.properties.findIndex((p) => p.id === params.propertyId);
  if (propertyIndex === -1) {
    throw new Error('العقار المحدد غير موجود في النظام');
  }

  const targetProperty = params.properties[propertyIndex];
  const previousLessorId = targetProperty.lessor_id;
  const newLessor = params.lessors.find((l) => l.id === params.newLessorId);

  if (!newLessor) {
    throw new Error('المؤجر/المالك الجديد غير موجود');
  }

  // 1. إنشاء صك الملكية الجديد للمالك الجديد
  const newDeed: OwnershipDocument = {
    id: `deed-${Date.now()}`,
    document_number: params.newDeedNumber,
    issue_date: new Date().toISOString().split('T')[0],
    lessor_id: params.newLessorId,
    lessor: newLessor,
    created_at: new Date().toISOString(),
  };

  // 2. تحديث بيانات العقار
  const updatedProperty: Property = {
    ...targetProperty,
    lessor_id: params.newLessorId,
    lessor: newLessor,
    ownership_document_id: newDeed.id,
    ownership_document: newDeed,
  };

  const updatedProperties = [...params.properties];
  updatedProperties[propertyIndex] = updatedProperty;

  // 3. إنشاء سجل تدقيق لنقل الملكية (Ownership Audit Log)
  const auditLog: OwnershipAuditLog = {
    id: `aud-${Date.now()}`,
    property_id: params.propertyId,
    previous_lessor_id: previousLessorId,
    new_lessor_id: params.newLessorId,
    previous_representative_id: targetProperty.current_representative_id,
    new_representative_id: targetProperty.current_representative_id,
    change_type: 'LESSOR_TRANSFER',
    notes: params.notes || `تم نقل ملكية العقار إلى ${newLessor.name} بموجب صك ${params.newDeedNumber}`,
    changed_at: new Date().toISOString(),
    property: updatedProperty,
    previous_lessor: params.lessors.find((l) => l.id === previousLessorId),
    new_lessor: newLessor,
    previous_representative: targetProperty.current_representative,
    new_representative: targetProperty.current_representative,
  };

  const updatedAuditLogs = [auditLog, ...params.auditLogs];

  return {
    updatedProperties,
    updatedAuditLogs,
    updatedOwnershipDocs: [newDeed],
    log: auditLog,
  };
}

/**
 * تنفيذ تغيير الممثل / الوكيل المالي للعقار وتحديث سجلات التدقيق
 * Business Logic for Change Representative State Transfer
 */
export async function executeChangeRepresentative(params: {
  properties: Property[];
  auditLogs: OwnershipAuditLog[];
  representatives: Representative[];
  lessors: Lessor[];
  propertyId: string;
  newRepresentativeId: string;
  notes?: string;
}): Promise<{
  updatedProperties: Property[];
  updatedAuditLogs: OwnershipAuditLog[];
  log: OwnershipAuditLog;
}> {
  const propertyIndex = params.properties.findIndex((p) => p.id === params.propertyId);
  if (propertyIndex === -1) {
    throw new Error('العقار المحدد غير موجود في النظام');
  }

  const targetProperty = params.properties[propertyIndex];
  const previousRepId = targetProperty.current_representative_id;
  const newRep = params.representatives.find((r) => r.id === params.newRepresentativeId);

  if (!newRep) {
    throw new Error('الوكيل/الممثل المحدد غير موجود');
  }

  // 1. تحديث ممثل العقار
  const updatedProperty: Property = {
    ...targetProperty,
    current_representative_id: params.newRepresentativeId,
    current_representative: newRep,
  };

  const updatedProperties = [...params.properties];
  updatedProperties[propertyIndex] = updatedProperty;

  // 2. توثيق العملية في سجل التدقيق (Ownership Audit Log)
  const auditLog: OwnershipAuditLog = {
    id: `aud-${Date.now()}`,
    property_id: params.propertyId,
    previous_lessor_id: targetProperty.lessor_id,
    new_lessor_id: targetProperty.lessor_id,
    previous_representative_id: previousRepId,
    new_representative_id: params.newRepresentativeId,
    change_type: 'REPRESENTATIVE_CHANGE',
    notes: params.notes || `تم تعيين ${newRep.name} كـ ممثل جديد للعقار`,
    changed_at: new Date().toISOString(),
    property: updatedProperty,
    previous_lessor: targetProperty.lessor,
    new_lessor: targetProperty.lessor,
    previous_representative: params.representatives.find((r) => r.id === previousRepId),
    new_representative: newRep,
  };

  const updatedAuditLogs = [auditLog, ...params.auditLogs];

  return {
    updatedProperties,
    updatedAuditLogs,
    log: auditLog,
  };
}
