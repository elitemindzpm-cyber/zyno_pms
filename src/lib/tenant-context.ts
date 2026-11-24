import type { Profile } from "@/lib/db";

// Minimal auth user shape (the app authenticates through its own API, not a third-party auth service).
type User = { id?: string; email?: string | null; user_metadata?: Record<string, any> | null; [key: string]: any };

export type TenantScopedRole = Extract<Profile["role"], "ADMIN" | "HOST" | "PROP_MGR" | "LEASING" | "FINANCE" | "CASHIER" | "MAINTENANCE">;

export type TenantContextSource = {
  id: string;
  role?: string | null;
  tenant_id?: string | null;
  tenant_key?: string | null;
};

function readMetadata(user?: User | null, key?: string) {
  if (!user || !key) return undefined;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const value = meta?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function resolveTenantContextId(profile?: TenantContextSource | null, user?: User | null) {
  const explicit =
    profile?.tenant_id ||
    profile?.tenant_key ||
    readMetadata(user, "tenant_id") ||
    readMetadata(user, "tenant_key");

  if (explicit) {
    return explicit;
  }

  const role = profile?.role;
  if (role === "ADMIN" || role === "HOST") {
    return profile?.id ?? null;
  }

  return null;
}
