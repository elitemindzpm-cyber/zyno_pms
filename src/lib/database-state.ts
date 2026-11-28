import { db } from "@/lib/db";

const ASSET_RECORD_TYPES = new Set([
  "asset_revaluation_records_v2",
  "asset_sale_records_v2",
  "asset_writeoff_records_v2",
  "asset_allocation_records_v2",
  "asset_maintenance_records_v2",
  "asset_warranty_records_v2",
]);

/**
 * E3: Relational state adapter replacing legacy pms_app_state / KV blobs.
 * Routes each domain key directly to its dedicated MariaDB table.
 */
export async function getDbState<T>(key: string, defaultValue: T): Promise<T> {
  try {
    if (ASSET_RECORD_TYPES.has(key)) {
      const { data, error } = await db
        .from("asset_lifecycle_records")
        .select("*")
        .eq("record_type", key)
        .order("created_at", { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((r: any) => {
          try { return JSON.parse(r.payload_json); } catch { return r; }
        }) as unknown as T;
      }
      return defaultValue;
    }

    if (key === "maintenance_tickets") {
      const { data, error } = await db.from("maintenance_tickets").select("*").order("created_at", { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) return data as unknown as T;
    } else if (key === "maintenance_work_orders") {
      const { data, error } = await db.from("maintenance_work_orders").select("*").order("created_at", { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) return data as unknown as T;
    } else if (key === "maintenance_ppm_schedules") {
      const { data, error } = await db.from("maintenance_ppm_schedules").select("*").order("next_due_date", { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) return data as unknown as T;
    } else if (key === "maintenance_technicians") {
      const { data, error } = await db.from("maintenance_technicians").select("*").order("name", { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) return data as unknown as T;
    }
  } catch (err) {
    console.warn(`[DbState] Notice reading ${key} from Db:`, err);
  }
  return defaultValue;
}

export async function setDbState<T>(key: string, value: T): Promise<void> {
  if (!Array.isArray(value) || value.length === 0) return;
  try {
    if (ASSET_RECORD_TYPES.has(key)) {
      const rows = value.map((item: any) => ({
        id: String(item.id || crypto.randomUUID()).slice(0, 36),
        record_type: key,
        asset_id: item.assetId || item.asset_id || null,
        payload_json: JSON.stringify(item),
      }));
      await db.from("asset_lifecycle_records").upsert(rows, { onConflict: "id" });
      return;
    }
    if (key === "maintenance_work_orders") {
      const rows = value.map((w: any) => ({
        id: String(w.id || crypto.randomUUID()).slice(0, 36),
        wo_number: String(w.woNumber || w.wo_number || w.id),
        ticket_id: w.ticketId || w.ticket_id || null,
        property: w.property || null,
        unit_ref: w.unit || w.unit_ref || null,
        title: String(w.title || w.subject || "Work Order"),
        category: w.category || null,
        priority: String(w.priority || "medium"),
        status: String(w.status || "open"),
        assigned_to: w.assignedTo || w.assigned_to || null,
        estimated_cost: Number(w.estimatedCost || w.estimated_cost || 0),
        actual_cost: Number(w.actualCost || w.actual_cost || 0),
      }));
      await db.from("maintenance_work_orders").upsert(rows, { onConflict: "wo_number" });
    } else if (key === "maintenance_technicians") {
      const rows = value.map((t: any) => ({
        id: String(t.id || crypto.randomUUID()).slice(0, 36),
        name: String(t.name || "Technician"),
        phone: t.phone || null,
        email: t.email || null,
        specialty: t.specialty || null,
        status: String(t.status || "available"),
        rating: Number(t.rating || 5),
        active_jobs: Number(t.activeJobs || t.active_jobs || 0),
      }));
      await db.from("maintenance_technicians").upsert(rows, { onConflict: "id" });
    }
  } catch (err) {
    console.warn(`[DbState] Notice persisting ${key} to Db:`, err);
  }
}
