import { AuthenticatedRequest } from '../types/auth';

export const DEPARTMENT_NAMES = [
    'CSD & ISE',
    'EC',
    'Marine',
    'CSE',
    'Aeronautical',
    'EEE',
    'CSBS',
    'AIML',
    'Auto Mobile',
    'Mech',
] as const;

export type AdminScope = {
    scope: 'main' | 'department';
    departments: string[];
};

const MAIN_ADMIN_LOCALPARTS = new Set(['admin', 'mainadmin', 'superadmin']);

const DEPARTMENT_ALIAS_TO_NAME: Record<string, string> = {
    csdise: 'CSD & ISE',
    'csd-ise': 'CSD & ISE',
    'csd_ise': 'CSD & ISE',
    csd: 'CSD & ISE',
    ise: 'CSD & ISE',
    ec: 'EC',
    marine: 'Marine',
    cse: 'CSE',
    aeronautical: 'Aeronautical',
    eee: 'EEE',
    csbs: 'CSBS',
    aiml: 'AIML',
    automobile: 'Auto Mobile',
    auto: 'Auto Mobile',
    mech: 'Mech',
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const resolveAdminScope = (email: string): AdminScope => {
    const localPart = String(email || '').split('@')[0].toLowerCase();
    const normalizedLocalPart = normalize(localPart);

    if (MAIN_ADMIN_LOCALPARTS.has(localPart) || MAIN_ADMIN_LOCALPARTS.has(normalizedLocalPart)) {
        return { scope: 'main', departments: [] };
    }

    const mapped = DEPARTMENT_ALIAS_TO_NAME[localPart] || DEPARTMENT_ALIAS_TO_NAME[normalizedLocalPart];
    if (mapped) {
        return { scope: 'department', departments: [mapped] };
    }

    return { scope: 'main', departments: [] };
};

export const getAdminDepartmentFilter = (req: AuthenticatedRequest): string[] | null => {
    if (!req.admin || req.admin.scope === 'main') {
        return null;
    }
    return req.admin.departments;
};

export const isDepartmentAdmin = (req: AuthenticatedRequest) =>
    Boolean(req.admin && req.admin.scope === 'department');

