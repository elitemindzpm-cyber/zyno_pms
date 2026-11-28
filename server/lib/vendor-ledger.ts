import { Prisma } from '@prisma/client';

export const GRN_INVENTORY_GL_CODE = '12800001';
export const VENDOR_AP_PARENT_GL_CODE = '21000';

const money2 = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

/**
 * Computes the next sequential supplier sub-ledger code under GL 21000
 * in the format 21000101, 21000102, 21000103, ...
 */
export function nextVendorLedgerCode(existingCodes: string[]): string {
  let maxSeq = 100;
  for (const raw of existingCodes) {
    const code = String(raw || '').trim();
    const match = /^21000(\d{3,})$/.exec(code);
    if (!match) continue;
    const seq = Number(match[1]);
    if (Number.isInteger(seq) && seq >= 101 && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  return `${VENDOR_AP_PARENT_GL_CODE}${maxSeq + 1}`;
}

export interface VendorAllocationInput {
  invoice_id?: string | null;
  invoice_number: string;
  grn_number?: string | null;
  po_number?: string | null;
  remaining: number;
  amount: number;
}

export interface ComputedVendorAllocation {
  invoice_id: string | null;
  invoice_number: string;
  grn_number: string | null;
  po_number: string | null;
  amount: number;
  new_status: 'PAID' | 'PARTIAL';
}

export function buildVendorAllocationPlan(args: {
  totalAmount: number;
  allocations?: VendorAllocationInput[];
}): { totalAmount: number; allocations: ComputedVendorAllocation[] } {
  const allocations: ComputedVendorAllocation[] = [];
  const rawList = Array.isArray(args.allocations) ? args.allocations : [];

  for (const item of rawList) {
    const payAmt = money2(item.amount);
    if (payAmt <= 0) continue;
    const remaining = money2(item.remaining);
    if (payAmt > remaining + 0.01) {
      throw Object.assign(
        new Error(`Allocated amount (${payAmt}) for ${item.invoice_number} exceeds remaining balance (${remaining})`),
        { status: 400 },
      );
    }
    const clampedPay = Math.min(payAmt, remaining);
    const settledAmt = clampedPay > 0 ? clampedPay : payAmt;
    allocations.push({
      invoice_id: item.invoice_id ? String(item.invoice_id) : null,
      invoice_number: String(item.invoice_number).trim(),
      grn_number: item.grn_number ? String(item.grn_number) : null,
      po_number: item.po_number ? String(item.po_number) : null,
      amount: money2(settledAmt),
      new_status: money2(remaining - settledAmt) <= 0.005 ? 'PAID' : 'PARTIAL',
    });
  }

  const totalFromReq = money2(args.totalAmount);
  if (allocations.length > 0) {
    const sumAlloc = money2(allocations.reduce((s, a) => s + a.amount, 0));
    if (totalFromReq > 0 && Math.abs(sumAlloc - totalFromReq) > 0.05) {
      throw Object.assign(
        new Error(`Selected invoice allocations (${sumAlloc}) must equal Payment Amount (${totalFromReq})`),
        { status: 400 },
      );
    }
    return { totalAmount: sumAlloc, allocations };
  }

  if (totalFromReq <= 0) {
    throw Object.assign(new Error('Payment amount must be greater than zero'), { status: 400 });
  }
  return { totalAmount: totalFromReq, allocations: [] };
}

export async function ensureStockInventoryAccountTx(tx: any): Promise<string> {
  const existingFin = await tx.fin_coa_accounts.findUnique({ where: { account_code: GRN_INVENTORY_GL_CODE } });
  if (existingFin) return existingFin.account_code;

  const gl = await tx.coa_gl.findUnique({ where: { code: '12800' } });
  const parentFin = await tx.fin_coa_accounts.findUnique({ where: { account_code: '12800' } });
  if (gl && !(await tx.coa_sl.findUnique({ where: { code: GRN_INVENTORY_GL_CODE } }))) {
    await tx.coa_sl.create({
      data: { code: GRN_INVENTORY_GL_CODE, name: 'Stock-Inventory', gl_id: gl.id, gl_code: gl.code, is_active: true },
    });
  }
  await tx.fin_coa_accounts.create({
    data: {
      account_code: GRN_INVENTORY_GL_CODE,
      account_name: 'Stock-Inventory',
      account_type: parentFin?.account_type || 'Assets',
      parent_id: parentFin?.id ?? null,
      parent_account_id: parentFin?.id ?? null,
      group_name: parentFin?.group_name || 'Current Assets',
      class_name: parentFin?.class_name || 'Inventory',
      account_level: 'SL',
      is_active: true,
    },
  });
  return GRN_INVENTORY_GL_CODE;
}

export async function ensureVendorLedgerTx(
  tx: any,
  args: { vendorId?: string | number | null; vendorName?: string | null },
): Promise<{ code: string; name: string; vendorId: number | null }> {
  // Two requests for a brand-new supplier (a double click, or two users) must not both create its ledger code.
  // Locking the parent GL row makes the second one wait, then find the ledger the first one created.
  await tx.$queryRaw`SELECT id FROM coa_gl WHERE code = ${VENDOR_AP_PARENT_GL_CODE} FOR UPDATE`;
  let vendor: any = null;
  if (args.vendorId !== undefined && args.vendorId !== null && String(args.vendorId).trim() !== '') {
    const rawId = String(args.vendorId).trim();
    if (/^\d+$/.test(rawId)) {
      vendor = await tx.fin_vendors.findUnique({ where: { id: Number(rawId) } });
    }
    if (!vendor) {
      vendor = await tx.fin_vendors.findFirst({ where: { code: rawId } });
    }
    if (!vendor) {
      vendor = await tx.fin_vendors.findFirst({ where: { name: rawId } });
    }
  }
  const cleanName = String(vendor?.name || args.vendorName || '').trim();
  if (!vendor && cleanName) {
    vendor = await tx.fin_vendors.findFirst({ where: { name: cleanName } });
  }
  const effectiveName = String(vendor?.name || cleanName || 'Sundry Supplier').trim();
  const normalizedName = effectiveName.toLowerCase();

  // Check existing supplier SL under 21000 matching vendor name (ignoring 21000 and placeholder 21000001)
  const candidates = await tx.fin_coa_accounts.findMany({
    where: {
      account_code: { startsWith: `${VENDOR_AP_PARENT_GL_CODE}1` },
      is_active: true,
    },
    orderBy: { account_code: 'asc' },
  });
  const existingFin = candidates.find(
    (c: any) => String(c.account_name || '').trim().toLowerCase() === normalizedName,
  );
  if (existingFin) {
    return {
      code: String(existingFin.account_code),
      name: String(existingFin.account_name),
      vendorId: vendor?.id ?? null,
    };
  }

  const slCandidates = await tx.coa_sl.findMany({
    where: { gl_code: VENDOR_AP_PARENT_GL_CODE },
    orderBy: { code: 'asc' },
  });
  const existingSl = slCandidates.find(
    (s: any) => /^210001\d+$/.test(String(s.code)) && String(s.name || '').trim().toLowerCase() === normalizedName,
  );

  const glRow = await tx.coa_gl.findUnique({ where: { code: VENDOR_AP_PARENT_GL_CODE } });
  const parentFin = await tx.fin_coa_accounts.findUnique({ where: { account_code: VENDOR_AP_PARENT_GL_CODE } });
  if (!glRow || !parentFin) {
    // Fall back safely to 21000 control if parent GL is absent in a partial test environment
    return { code: VENDOR_AP_PARENT_GL_CODE, name: effectiveName, vendorId: vendor?.id ?? null };
  }

  let nextCode = existingSl?.code;
  if (!nextCode) {
    const allCodes = (await tx.$queryRaw(
      Prisma.sql`SELECT account_code AS code FROM fin_coa_accounts WHERE account_code LIKE '21000%'
        UNION SELECT code FROM coa_sl WHERE gl_code = '21000'
        UNION SELECT code FROM erp_chart_of_accounts WHERE code LIKE '21000%'`,
    )) as Array<{ code: string }>;
    nextCode = nextVendorLedgerCode(allCodes.map((r) => r.code));
  }

  // The chart hierarchy this supplier ledger belongs to (class -> group -> type). coa_sl needs all of it.
  const cls = glRow.class_id ? await tx.coa_classes.findUnique({ where: { id: glRow.class_id } }) : null;
  const grp = cls?.group_id ? await tx.coa_groups.findUnique({ where: { id: cls.group_id } }) : null;
  const typ = grp?.type_id ? await tx.coa_types.findUnique({ where: { id: grp.type_id } }) : null;
  // A sibling supplier/payables ledger supplies the posting settings (normal balance, flags).
  const sibling = slCandidates[0] ?? null;

  if (!existingSl) {
    if (!cls || !grp || !typ) {
      throw Object.assign(new Error('The supplier payables chart hierarchy (class, group, type) is incomplete'), { status: 409 });
    }
    await tx.coa_sl.create({
      data: {
        code: nextCode,
        name: effectiveName,
        gl_id: glRow.id,
        gl_code: glRow.code,
        class_id: cls.id,
        class_code: cls.code,
        group_id: grp.id,
        group_code: grp.code,
        type_id: typ.id,
        type_code: typ.code,
        normal_balance: sibling?.normal_balance || 'Credit',
        is_control_account: false,
        is_posting_account: true,
        allows_direct_posting: true,
        requires_vendor: true,
        is_active: true,
      },
    });
  }

  const existingErp = await tx.erp_chart_of_accounts.findUnique({ where: { code: nextCode } });
  if (!existingErp) {
    await tx.erp_chart_of_accounts.create({
      data: {
        code: nextCode,
        name: effectiveName,
        type: typ?.name || 'Liabilities',
        type_code: typ?.code || '2',
        type_name: typ?.name || 'Liabilities',
        group_code: grp?.code || '21',
        group_name: grp?.name || 'Current Liabilities',
        class_code: cls?.code || '210',
        class_name: cls?.name || 'Accounts Payable',
        gl_code: glRow.code,
        gl_name: glRow.name,
        sl_code: nextCode,
        sl_name: effectiveName,
      },
    });
  }

  const finCreated = await tx.fin_coa_accounts.create({
    data: {
      account_code: nextCode,
      account_name: effectiveName,
      account_type: parentFin.account_type || 'Liabilities',
      parent_id: parentFin.id,
      parent_account_id: parentFin.id,
      group_name: parentFin.group_name || 'Current Liabilities',
      class_name: parentFin.class_name || 'Accounts Payable',
      account_level: 'SL',
      is_active: true,
    },
  });

  return {
    code: finCreated.account_code,
    name: finCreated.account_name,
    vendorId: vendor?.id ?? null,
  };
}
