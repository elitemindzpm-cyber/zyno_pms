import { db } from "@/lib/db";

// Unit names such as "Flat03" are reused across properties (17 properties have a Flat03), so a lookup by name
// alone returns whichever unit comes first and files the lease or payment under the wrong property.
// This picks the unit that belongs to the given property; with several matches and no property it returns
// nothing rather than guessing.
export async function findUnitByName(
  unitName: string | null | undefined,
  scope: { propertyId?: string | null; propertyName?: string | null } = {},
): Promise<{ id: string; property_id: string | null } | null> {
  const name = String(unitName || "").trim();
  if (!name || name === "—" || name === "Unit") return null;
  const { data } = await db
    .from("units")
    .select("id, property_id, unit_ref")
    .or(`unit_ref.eq.${name},unit_code.eq.${name},unit_name.eq.${name}`)
    .limit(100);
  const rows: any[] = data || [];
  if (rows.length <= 1) return rows[0] ? { id: String(rows[0].id), property_id: rows[0].property_id ?? null } : null;

  let pool = rows;
  if (scope.propertyId) pool = rows.filter((r) => String(r.property_id) === String(scope.propertyId));
  else if (scope.propertyName && scope.propertyName !== "—") {
    const ids = Array.from(new Set(rows.map((r) => String(r.property_id)).filter(Boolean)));
    const { data: props } = await db.from("properties").select("id, title, property_code").in("id", ids);
    const want = scope.propertyName.trim().toLowerCase();
    const okIds = new Set((props || [])
      .filter((p: any) => String(p.title || "").trim().toLowerCase() === want || String(p.property_code || "").trim().toLowerCase() === want)
      .map((p: any) => String(p.id)));
    pool = rows.filter((r) => okIds.has(String(r.property_id)));
  }
  return pool.length === 1 ? { id: String(pool[0].id), property_id: pool[0].property_id ?? null } : null;
}
