import { db } from "@/lib/db";
import { postVoucher } from "@/lib/finance/posting-engine";

export interface MonthEndAccrualResult {
  closingMonth: string;
  leasesProcessed: number;
  totalRevenueRecognized: number;
  voucherId?: string;
  errors?: string[];
}

/**
 * Executes Month-End closing for revenue recognition across active leases.
 * Automatically computes monthly rent entitlement and posts to General Ledger.
 */
export async function executeMonthEndRevenueRecognition(
  closingMonth: string, // YYYY-MM
  executedBy?: string
): Promise<MonthEndAccrualResult> {
  const result: MonthEndAccrualResult = {
    closingMonth,
    leasesProcessed: 0,
    totalRevenueRecognized: 0,
    errors: [],
  };

  try {
    // Run once per month: a second run would recognise the same rent again.
    const reference = `REV-REC-${closingMonth}`;
    const { data: already } = await db.from("fin_vouchers").select("id").eq("voucher_number", reference).maybeSingle();
    if (already?.id) {
      result.errors = [`Revenue for ${closingMonth} was already recognised (${reference}).`];
      return result;
    }

    // 1. Active leases covering this month (columns that exist on the leases table)
    const { data: leases, error } = await db
      .from("leases")
      .select("id, lease_number, unit_id, commencement_date, expiry_date, rental_amount, lease_period_months, lease_status")
      .in("lease_status", ["ACTIVE", "active", "fully_signed", "renewal_due"]);

    if (error) throw error;
    if (!leases || leases.length === 0) {
      return result;
    }

    const [year, month] = closingMonth.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    // Units already invoiced for this month are skipped so rent is not recognised twice (invoice + month-end).
    const { data: invoiced } = await db.from("fin_ar_invoices").select("unit").eq("billing_period", closingMonth);
    const invoicedUnits = new Set((invoiced || []).map((r: any) => String(r.unit || "").toLowerCase()));
    const { data: unitRows } = await db.from("units").select("id, unit_ref");
    const unitRefById = new Map<string, string>((unitRows || []).map((u: any) => [String(u.id), String(u.unit_ref || "")]));

    let totalEarned = 0;
    const processedLeaseDetails: any[] = [];

    for (const lease of leases) {
      const leaseStart = new Date(lease.commencement_date);
      const leaseEnd = new Date(lease.expiry_date);

      // Check if lease is active during this calendar month
      if (leaseEnd >= monthStart && leaseStart <= monthEnd) {
        const months = Number(lease.lease_period_months) || 0;
        const monthlyRent = months > 0 ? Number(lease.rental_amount || 0) / months : 0;
        const unitRef = unitRefById.get(String(lease.unit_id)) || "";
        if (unitRef && invoicedUnits.has(unitRef.toLowerCase())) continue;
        if (monthlyRent > 0) {
          totalEarned += monthlyRent;
          result.leasesProcessed += 1;
          processedLeaseDetails.push({
            lease_id: lease.id,
            tenant_name: lease.lease_number,
            amount: monthlyRent,
          });
        }
      }
    }

    result.totalRevenueRecognized = totalEarned;

    if (totalEarned > 0) {
      // Post Journal Entry to General Ledger:
      // DR: 1200 (Rent Receivable / Deferred Revenue Liability Reduction)
      // CR: 4000 (Rental Revenue Income)
      const postingResult = await postVoucher({
        voucher_date: monthEnd.toISOString().split("T")[0],
        voucher_type: "Journal",
        reference_no: reference,
        description: `Automated Month-End Rental Revenue Recognition for ${closingMonth} (${result.leasesProcessed} leases)`,
        source_type: "REVENUE_RECOGNITION",
        lines: [
          {
            account_code: "12413",
            account_name: "Tenant Receivables",
            debit: totalEarned,
            credit: 0,
            description: `Accrual realization for ${closingMonth}`,
          },
          {
            account_code: "41100001",
            account_name: "Rental Revenue",
            debit: 0,
            credit: totalEarned,
            description: `Rental Revenue recognized for ${closingMonth}`,
          },
        ],
      });

      result.voucherId = postingResult.voucher_id;

      // Log the month-end closing run to database
      await db.from("revenue_recognition_logs").insert([
        {
          closing_month: closingMonth,
          run_by: executedBy || null,
          total_leases_processed: result.leasesProcessed,
          total_revenue_recognized: totalEarned,
          journal_voucher_id: postingResult.voucher_id || null,
          status: "completed",
          details: processedLeaseDetails,
        },
      ]);
    }

    return result;
  } catch (err: any) {
    console.error("Month-end revenue recognition failed:", err);
    result.errors = [err.message || "Failed to execute revenue recognition"];
    return result;
  }
}
