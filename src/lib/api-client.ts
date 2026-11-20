// src/lib/api-client.ts
// REST API client bridging frontend to PMS Express/Prisma backend
// Drop-in companion to supabase.ts – replaces .from() data calls with fetch(/api/*)

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('pms_jwt_token') || '';
}

export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('pms_jwt_token', token);
    else localStorage.removeItem('pms_jwt_token');
  }
}

export function getTenantId(): string {
  if (typeof window === 'undefined') return 'a0000000-0000-0000-0000-000000000001';
  return localStorage.getItem('pms_tenant_id') || import.meta.env.VITE_TENANT_ID || 'a0000000-0000-0000-0000-000000000001';
}

export function setTenantId(tenantId: string): void {
  if (typeof window !== 'undefined') {
    if (tenantId) localStorage.setItem('pms_tenant_id', tenantId);
    else localStorage.removeItem('pms_tenant_id');
  }
}

export async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const tenantId = getTenantId();
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Generic paginated list ────────────────────────────────────────────────────
export async function listRecords<T>(
  resource: string,
  params: Record<string, string | number> = {}
) {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  return request<{ data: T[]; pagination: any }>(`/api/${resource}${qs ? `?${qs}` : ''}`);
}

// ── Generic single-record fetch ───────────────────────────────────────────────
export async function getRecord<T>(resource: string, id: string) {
  return request<T>(`/api/${resource}/${id}`);
}

// ── Generic create ────────────────────────────────────────────────────────────
export async function createRecord<T>(resource: string, body: Partial<T>) {
  return request<T>(`/api/${resource}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// ── Generic update ────────────────────────────────────────────────────────────
export async function updateRecord<T>(resource: string, id: string, body: Partial<T>) {
  return request<{ success: boolean }>(`/api/${resource}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// ── Generic delete ────────────────────────────────────────────────────────────
export async function deleteRecord(resource: string, id: string) {
  return request<{ success: boolean }>(`/api/${resource}/${id}`, {
    method: 'DELETE',
  });
}

// ── Universal Database Query API (Direct MariaDB Prisma Proxy) ───────────────
export const dbApi = {
  query: <T = any>(table: string, options: any) =>
    request<{ data: T; error: string | null; count?: number }>(`/api/db/${table}/query`, {
      method: 'POST',
      body: JSON.stringify(options),
    }),
  insert: <T = any>(table: string, data: any) =>
    request<{ data: T; error: string | null }>(`/api/db/${table}/insert`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    }),
  update: <T = any>(table: string, where: any, data: any) =>
    request<{ data: T; error: string | null }>(`/api/db/${table}/update`, {
      method: 'POST',
      body: JSON.stringify({ where, data }),
    }),
  delete: <T = any>(table: string, where: any) =>
    request<{ data: T; error: string | null }>(`/api/db/${table}/delete`, {
      method: 'POST',
      body: JSON.stringify({ where }),
    }),
};

// ── Auth API ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: async (email: string, password: string) => {
    const res = await request<{ token: string; user: any; profile: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res?.token) {
      setToken(res.token);
      if (res.user?.tenant_id) {
        setTenantId(res.user.tenant_id);
      }
    }
    return res;
  },
  getSession: async () => {
    const token = getToken();
    if (!token) return { user: null, profile: null };
    return request<{ user: any; profile: any }>('/api/auth/session').catch(() => ({ user: null, profile: null }));
  },
  logout: async () => {
    try {
      await request('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      setToken('');
      setTenantId('');
    }
  },
  getToken,
  setToken,
};

// ── Domain helpers ───────────────────────────────────────────────────────────

// Properties
export const propertiesApi = {
  list: (p?: any) => listRecords('properties', p),
  get: (id: string) => getRecord('properties', id),
  create: (data: any) => createRecord('properties', data),
  update: (id: string, data: any) => updateRecord('properties', id, data),
  remove: (id: string) => deleteRecord('properties', id),
};

// Units
export const unitsApi = {
  list: (p?: any) => listRecords('units', p),
  get: (id: string) => getRecord('units', id),
  create: (data: any) => createRecord('units', data),
  update: (id: string, data: any) => updateRecord('units', id, data),
  remove: (id: string) => deleteRecord('units', id),
};

// Leases
export const leasesApi = {
  list: (p?: any) => listRecords('leases', p),
  get: (id: string) => getRecord('leases', id),
  create: (data: any) => createRecord('leases', data),
  update: (id: string, data: any) => updateRecord('leases', id, data),
  remove: (id: string) => deleteRecord('leases', id),
};

// Customers / Tenants
export const customersApi = {
  list: (p?: any) => listRecords('customers', p),
  get: (id: string) => getRecord('customers', id),
  create: (data: any) => createRecord('customers', data),
  update: (id: string, data: any) => updateRecord('customers', id, data),
  remove: (id: string) => deleteRecord('customers', id),
};

// Reservations
export const reservationsApi = {
  list: (p?: any) => listRecords('reservations', p),
  get: (id: string) => getRecord('reservations', id),
  create: (data: any) => createRecord('reservations', data),
  update: (id: string, data: any) => updateRecord('reservations', id, data),
  remove: (id: string) => deleteRecord('reservations', id),
};

// Finance – PDCs
export const pdcApi = {
  list: (p?: any) => listRecords('finance/pdcs', p),
};

// Finance – Bank Accounts
export const bankAccountsApi = {
  list: () => request<{ data: any[] }>('/api/finance/bank-accounts'),
};

// Finance – Financial Years
export const financialYearsApi = {
  list: () => request<{ data: any[] }>('/api/finance/financial-years'),
};

// Finance – Deposits
export const depositsApi = {
  list: (p?: any) => listRecords('finance/deposits', p),
};

// Finance – Payment Allocations
export const paymentAllocationsApi = {
  list: (p?: any) => listRecords('finance/payment-allocations', p),
};

// Accounting – Events
export const accountingEventsApi = {
  list: (p?: any) => listRecords('accounting/events', p),
  get: (id: string) => getRecord('accounting/events', id),
};

// Accounting – Vouchers
export const vouchersApi = {
  list: (p?: any) => listRecords('accounting/vouchers', p),
};

// Accounting – Chart of Accounts
export const coaApi = {
  list: () => request<{ data: any[] }>('/api/accounting/coa'),
};

// HRMS – Employees
export const employeesApi = {
  list: (p?: any) => listRecords('hrms/employees', p),
  get: (id: string) => getRecord('hrms/employees', id),
};

// HRMS – Departments / Designations
export const departmentsApi = {
  list: () => request<{ data: any[] }>('/api/hrms/departments'),
};
export const designationsApi = {
  list: () => request<{ data: any[] }>('/api/hrms/designations'),
};

// HRMS – Payroll Syncs
export const payrollSyncsApi = {
  list: (p?: any) => listRecords('hrms/payroll-syncs', p),
};

// Procurement
export const purchaseRequestsApi = {
  list: (p?: any) => listRecords('procurement/purchase-requests', p),
};
export const purchaseOrdersApi = {
  list: (p?: any) => listRecords('procurement/purchase-orders', p),
};
export const vendorsApi = {
  list: () => request<{ data: any[] }>('/api/procurement/vendors'),
};
export const rfxApi = {
  list: (p?: any) => listRecords('procurement/rfx', p),
};
export const goodsReceiptsApi = {
  list: (p?: any) => listRecords('procurement/goods-receipts', p),
};

// Masters
export const mastersApi = {
  amenities: () => request<{ data: any[] }>('/api/masters/amenities'),
  leaseStatuses: () => request<{ data: any[] }>('/api/masters/lease-statuses'),
  propertyTypes: () => request<{ data: any[] }>('/api/masters/property-types'),
  securityDepositTypes: () => request<{ data: any[] }>('/api/masters/security-deposit-types'),
  vatTreatments: () => request<{ data: any[] }>('/api/masters/vat-treatments'),
  workLocations: () => request<{ data: any[] }>('/api/masters/work-locations'),
};

// Auth / Profiles
export const profilesApi = {
  get: (userId: string) => getRecord('auth/profile', userId),
  update: (userId: string, data: any) => updateRecord('auth/profile', userId, data),
};
export const notificationsApi = {
  list: (userId?: string) =>
    request<{ data: any[] }>(`/api/auth/notifications${userId ? `?user_id=${userId}` : ''}`),
};
export const permissionsApi = {
  list: () => request<{ data: any[] }>('/api/auth/permissions'),
};

export default request;
