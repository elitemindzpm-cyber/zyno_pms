import { db } from "@/lib/db";

/**
 * Insert a row into fin_vouchers unless a voucher with the same voucher_number already exists.
 *
 * voucher_number is UNIQUE, and several flows (PDC receipt, lease collection, finance store) can post the
 * same voucher. A blind insert returns 409 Conflict; callers that then add ledger lines on success must not
 * add them a second time. On a duplicate this returns { data: null, error: { code: 'DUPLICATE_VOUCHER' } }
 * without calling the API insert, so `.then(({ error }) => if (!error) add lines)` stays correct.
 */
export async function insertVoucherOnce(row: Record<string, any>): Promise<{ data: any; error: any }> {
  const voucherNumber = row?.voucher_number;
  if (voucherNumber) {
    try {
      const { data: existing } = await db
        .from("fin_vouchers")
        .select("id")
        .eq("voucher_number", String(voucherNumber))
        .maybeSingle();
      if (existing?.id) {
        return { data: null, error: { code: "DUPLICATE_VOUCHER", message: `Voucher ${voucherNumber} already exists` } };
      }
    } catch {
      // fall through to the insert; the unique constraint still protects against duplicates
    }
  }
  const { data, error } = await db.from("fin_vouchers").insert(row).select("id").single();
  return { data, error };
}
