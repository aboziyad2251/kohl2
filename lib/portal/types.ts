import type { UserRole } from '@/lib/types';
export const externalRoles = ['BROKER', 'OWNER', 'TENANT'] as const;
export type ExternalRole = typeof externalRoles[number];
export type ManagedRole = ExternalRole | 'EMPLOYEE';
export const roleLabels: Record<UserRole, string> = {
    ADMIN: 'المسؤول العام', CEO: 'الرئيس التنفيذي', HR: 'الموارد البشرية', EMPLOYEE: 'موظف',
    BROKER: 'وسيط', OWNER: 'مالك', TENANT: 'مستأجر',
};
export interface PortalProfile {
    account: {
        id: string;
        name: string;
        phone: string;
        role: UserRole;
        employee_id?: string;
        history_only: boolean;
    };
    owners: {
        property_id: string;
        ownership_share: number;
        effective_from: string;
        effective_to?: string;
    }[];
    leases: {
        contract_id: string;
    }[];
    broker_contracts: {
        contract_id: string;
        agreement_id: string;
    }[];
}
export interface AccessUser {
    employee_id?: string;
    id: string;
    full_name: string;
    mobile: string;
    email: string;
    national_id_or_iqama?: string;
    role: UserRole;
    is_active: boolean;
    invitation_status: string;
    last_login?: string;
    owners: {
        property_id: string;
        ownership_share: number;
        effective_to?: string;
    }[];
    leases: {
        contract_id: string;
    }[];
    agreements: {
        id: string;
        agreement_number: string;
        commission_type: string;
        commission_value: number;
        percentage_basis?: string;
    }[];
    broker_contracts: {
        contract_id: string;
        agreement_id: string;
    }[];
}
export interface AccessData {
    employees: { id: string; name: string; employee_number: string; email: string; phone: string; status: string }[];
    users: AccessUser[];
    properties: {
        id: string;
        name: string;
    }[];
    contracts: {
        id: string;
        number: string;
        tenant_name: string;
        status: string;
        start_date: string;
        end_date: string;
    }[];
    settings: {
        tenant_lease_end_action: 'HISTORY' | 'DEACTIVATE';
    };
    audit: {
        id: string;
        actor_user_id: string;
        target_user_id: string;
        action: string;
        created_at: string;
        changes: Record<string, unknown>;
    }[];
}
