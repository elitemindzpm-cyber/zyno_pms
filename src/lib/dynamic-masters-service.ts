import { kvStore } from "@/lib/kv-store";
// Dynamic Master Store & Management Service
// Supports full CRUD, is_mandatory toggles, and real-time syncing for Excel templates & manual forms.
import { getDbState, setDbState } from "./database-state";

export interface MasterEntry {
  id: string;
  name: string;
  code?: string;
  is_mandatory?: boolean;
  extra?: Record<string, any>;
}

export interface MasterGroupDefinition {
  key: string;
  label: string;
  category: 'Asset' | 'Employee' | 'Property' | 'Unit' | 'Lease' | 'System';
  description?: string;
  isMandatoryField?: boolean; // Can mark the field itself as mandatory
  /** When true the UI renders a Roles multi-select in the add/edit dialog */
  supportsRoles?: boolean;
}

export const MASTER_DEFINITIONS: MasterGroupDefinition[] = [
  // ── Asset & Employee Masters ──
  {
    key: 'gender',
    label: 'Gender',
    category: 'Employee',
    isMandatoryField: false,
  },
  {
    key: 'role',
    label: 'Role',
    category: 'Employee',
    isMandatoryField: false,
    description: 'Functional roles assigned to Departments and Designations to define system access and workflow responsibilities.',
  },

  {
    key: 'department',
    label: 'Department',
    category: 'Employee',
    isMandatoryField: false,
    supportsRoles: true,
  },
  {
    key: 'designation',
    label: 'Designation',
    category: 'Employee',
    isMandatoryField: false,
    supportsRoles: true,
  },
  {
    key: 'employment_type',
    label: 'Employment Type',
    category: 'Employee',
    isMandatoryField: false,
  },
  {
    key: 'work_location',
    label: 'Work Location',
    category: 'Employee',
    isMandatoryField: false,
  },
  {
    key: 'employee_status',
    label: 'Employee Status',
    category: 'Employee',
    isMandatoryField: false,
  },
  {
    key: 'asset_category',
    label: 'Asset Category',
    category: 'Asset',
    isMandatoryField: false,
  },
  {
    key: 'asset_subcategory',
    label: 'Asset Subcategory',
    category: 'Asset',
    isMandatoryField: false,
  },
  {
    key: 'ownership_type',
    label: 'Ownership Type',
    category: 'Asset',
    isMandatoryField: false,
  },
  {
    key: 'asset_condition',
    label: 'Asset Condition',
    category: 'Asset',
    isMandatoryField: false,
  },
  {
    key: 'asset_status',
    label: 'Asset Status',
    category: 'Asset',
    isMandatoryField: false,
  },
  {
    key: 'asset_brand',
    label: 'Brand / Manufacturer',
    category: 'Asset',
    isMandatoryField: false,
    description: 'Master list of equipment & asset brands and manufacturers.',
  },

  // ── Property & Unit Masters ──
  {
    key: 'property_type',
    label: 'Property Type',
    category: 'Property',
    isMandatoryField: true,
  },
  {
    key: 'property_category',
    label: 'Property Category',
    category: 'Property',
    isMandatoryField: false,
  },
  {
    key: 'property_status',
    label: 'Property Status',
    category: 'Property',
    isMandatoryField: false,
  },
  {
    key: 'country',
    label: 'Country',
    category: 'Property',
    isMandatoryField: true,
  },
  {
    key: 'vat_tax_treatment',
    label: 'VAT / Tax Treatment',
    category: 'Property',
    isMandatoryField: false,
  },
  {
    key: 'amenities_facilities',
    label: 'Amenities / Facilities',
    category: 'Property',
    isMandatoryField: false,
  },
  {
    key: 'unit_type',
    label: 'Unit Type',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'unit_usage',
    label: 'Unit Usage',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'bedroom_count',
    label: 'Bedroom Count',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'bathroom_count',
    label: 'Bathroom Count',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'bathroom_layout',
    label: 'Bathroom Type / Layout',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'view_type',
    label: 'View Type',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'furnishing',
    label: 'Furnishing',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'unit_status',
    label: 'Unit Status',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'lease_status',
    label: 'Lease Status',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'rent_frequency',
    label: 'Rent Frequency',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'maintenance_responsibility',
    label: 'Maintenance Responsibility',
    category: 'Unit',
    isMandatoryField: false,
  },
  {
    key: 'security_deposit_type',
    label: 'Security Deposit',
    category: 'Unit',
    isMandatoryField: false,
  },

  // ── Customer, Lease & KYC Masters ──
  {
    key: 'nationality',
    label: 'Nationality',
    category: 'Lease',
    isMandatoryField: false,
    description: 'Master list of nationalities for KYC identification.',
  },
  {
    key: 'profession',
    label: 'Profession',
    category: 'Lease',
    isMandatoryField: false,
    description: 'Master list of professions and occupations.',
  },
  {
    key: 'agreement_type',
    label: 'Agreement / Lease Type',
    category: 'Lease',
    isMandatoryField: false,
    description: 'Master list of contract & lease agreement types.',
  },
  {
    key: 'customer_type',
    label: 'Customer / Tenant Type',
    category: 'Lease',
    isMandatoryField: false,
    description: 'Master list of tenant and customer classifications.',
  },
];

const LOCAL_STORAGE_KEY = 'zyno_custom_dynamic_masters_v1';
const MANDATORY_FLAGS_KEY = 'zyno_master_mandatory_flags_v1';
export const DYNAMIC_MASTERS_UPDATED_EVENT = 'zyno:dynamic-masters-updated';

export class DynamicMastersService {
  private static notifyUpdated(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DYNAMIC_MASTERS_UPDATED_EVENT));
    }
  }

  private static getStoredData(): Record<string, MasterEntry[]> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = kvStore.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private static setStoredData(data: Record<string, MasterEntry[]>): void {
    if (typeof window === 'undefined') return;
    try {
      kvStore.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      void setDbState(LOCAL_STORAGE_KEY, data);
      this.notifyUpdated();
    } catch (e) {
      console.error('Error saving dynamic masters:', e);
    }
  }

  private static getMandatoryFlags(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = kvStore.getItem(MANDATORY_FLAGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public static setMandatoryFlag(masterKey: string, isMandatory: boolean): void {
    if (typeof window === 'undefined') return;
    const flags = this.getMandatoryFlags();
    flags[masterKey] = isMandatory;
    try {
      kvStore.setItem(MANDATORY_FLAGS_KEY, JSON.stringify(flags));
      void setDbState(MANDATORY_FLAGS_KEY, flags);
      this.notifyUpdated();
    } catch {}
  }

  public static async initFromDb(): Promise<void> {
    try {
      const [dbData, dbFlags] = await Promise.all([
        getDbState<Record<string, MasterEntry[]>>(LOCAL_STORAGE_KEY, {}),
        getDbState<Record<string, boolean>>(MANDATORY_FLAGS_KEY, {}),
      ]);
      if (dbData && Object.keys(dbData).length > 0) {
        kvStore.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dbData));
      }
      if (dbFlags && Object.keys(dbFlags).length > 0) {
        kvStore.setItem(MANDATORY_FLAGS_KEY, JSON.stringify(dbFlags));
      }
      this.notifyUpdated();
    } catch {}
  }

  public static isMasterMandatory(masterKey: string): boolean {
    const flags = this.getMandatoryFlags();
    if (flags[masterKey] !== undefined) return flags[masterKey];
    const def = MASTER_DEFINITIONS.find(d => d.key === masterKey);
    return def?.isMandatoryField ?? false;
  }

  public static getMasterValues(masterKey: string): MasterEntry[] {
    const stored = this.getStoredData();
    const customList = stored[masterKey];
    if (customList && Array.isArray(customList) && customList.length > 0) {
      return customList;
    }

    // Only values saved by users (stored in the database) are returned. There are no built-in values.
    return [];
  }

  public static getMasterStringOptions(masterKey: string): string[] {
    return this.getMasterValues(masterKey).map(m => m.name);
  }

  public static addMasterValue(masterKey: string, name: string): MasterEntry {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Name cannot be empty');

    const stored = this.getStoredData();
    const current = this.getMasterValues(masterKey);

    if (current.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Item "${trimmed}" already exists in ${masterKey}.`);
    }

    const newEntry: MasterEntry = {
      id: `${masterKey}-${Date.now()}`,
      name: trimmed,
    };

    stored[masterKey] = [...current, newEntry];
    this.setStoredData(stored);
    return newEntry;
  }

  public static addMasterValueWithRoles(masterKey: string, name: string, roles: string[]): MasterEntry {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Name cannot be empty');

    const stored = this.getStoredData();
    const current = this.getMasterValues(masterKey);

    if (current.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new Error(`Item "${trimmed}" already exists in ${masterKey}.`);
    }

    const newEntry: MasterEntry = {
      id: `${masterKey}-${Date.now()}`,
      name: trimmed,
      extra: { roles },
    };

    stored[masterKey] = [...current, newEntry];
    this.setStoredData(stored);
    return newEntry;
  }

  public static updateMasterValueRoles(masterKey: string, id: string, newName: string, roles: string[]): void {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Name cannot be empty');

    const stored = this.getStoredData();
    const current = this.getMasterValues(masterKey);

    const updated = current.map(item =>
      item.id === id
        ? { ...item, name: trimmed, extra: { ...(item.extra ?? {}), roles } }
        : item
    );
    stored[masterKey] = updated;
    this.setStoredData(stored);
  }


  public static updateMasterValue(masterKey: string, id: string, newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Name cannot be empty');

    const stored = this.getStoredData();
    const current = this.getMasterValues(masterKey);

    const updated = current.map(item => (item.id === id ? { ...item, name: trimmed } : item));
    stored[masterKey] = updated;
    this.setStoredData(stored);
  }

  public static deleteMasterValue(masterKey: string, id: string): void {
    const stored = this.getStoredData();
    const current = this.getMasterValues(masterKey);
    const updated = current.filter(item => item.id !== id);
    stored[masterKey] = updated;
    this.setStoredData(stored);
  }
}
