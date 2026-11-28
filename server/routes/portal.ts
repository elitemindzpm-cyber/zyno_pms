// server/routes/portal.ts
// Tenant-scoped portal summary and owner statement aggregations backed by MariaDB.
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { isTenant, tenantLeaseWhere } from '../lib/tenant-policy';
import { sendDbError } from '../lib/errors';

const router = Router();

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10);
}

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const claims = (req as any).user || {};
    const tenant = isTenant(req);
    const leaseWhere = tenant ? tenantLeaseWhere(claims) : {};

    let leases = await prisma.leases.findMany({
      where: leaseWhere,
      include: { properties: true, customers: true },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    if (!tenant && leases.length === 0) {
      leases = await prisma.leases.findMany({
        include: { properties: true, customers: true },
        orderBy: { created_at: 'desc' },
        take: 10,
      });
    }

    const unitIds = Array.from(new Set(leases.map((l) => l.unit_id).filter(Boolean) as string[]));
    const unitRows = unitIds.length
      ? await prisma.units.findMany({ where: { id: { in: unitIds } } })
      : [];
    const unitById = new Map(unitRows.map((u) => [u.id, u]));

    const primary = leases.find((l) => String(l.lease_status || '').toUpperCase() === 'ACTIVE') || leases[0] || null;
    const primaryUnit = primary?.unit_id ? unitById.get(primary.unit_id) : undefined;
    const leaseIds = leases.map((l) => l.id).filter(Boolean);
    const customerIds = Array.from(new Set(leases.map((l) => l.customer_id).filter(Boolean) as string[]));
    const unitRefs = Array.from(
      new Set(
        unitRows
          .map((u) => u.unit_ref || u.unit_code || '')
          .filter(Boolean),
      ),
    );
    const propIds = Array.from(new Set(leases.map((l) => l.property_id).filter(Boolean) as string[]));

    const invoiceWhere: any = leaseIds.length || customerIds.length
      ? {
          OR: [
            ...(leaseIds.length ? [{ lease_id: { in: leaseIds } }] : []),
            ...(customerIds.length ? [{ customer_id: { in: customerIds } }] : []),
          ],
        }
      : { id: '__none__' };

    const pdcWhere: any = leaseIds.length ? { lease_id: { in: leaseIds } } : { id: BigInt(-1) };

    const paymentWhere: any = leaseIds.length || customerIds.length
      ? {
          OR: [
            ...(leaseIds.length ? [{ lease_id: { in: leaseIds } }] : []),
            ...(customerIds.length ? [{ customer_id: { in: customerIds } }] : []),
          ],
        }
      : { id: '__none__' };

    const ticketWhere: any = tenant
      ? {
          OR: [
            ...(claims.sub ? [{ tenant_id: String(claims.sub) }] : []),
            ...(unitRefs.length ? [{ unit_ref: { in: unitRefs } }] : []),
          ],
        }
      : unitRefs.length
        ? { unit_ref: { in: unitRefs } }
        : {};

    const [invoices, pdcs, payments, tickets, amenities, bookings] = await Promise.all([
      prisma.fin_ar_invoices.findMany({ where: invoiceWhere, orderBy: { invoice_date: 'desc' }, take: 100 }),
      prisma.fin_pdc_register.findMany({ where: pdcWhere, orderBy: { cheque_date: 'asc' }, take: 100 }),
      prisma.payments.findMany({ where: paymentWhere, orderBy: { payment_date: 'desc' }, take: 100 }),
      Object.keys(ticketWhere).length
        ? prisma.maintenance_tickets.findMany({ where: ticketWhere, orderBy: { created_at: 'desc' }, take: 100 })
        : Promise.resolve([]),
      prisma.amenities.findMany({ take: 50 }),
      prisma.bookings.findMany({
        where: claims.sub
          ? { guest_id: String(claims.sub) }
          : propIds.length
            ? { property_id: { in: propIds } }
            : { id: '__none__' },
        include: { properties: true },
        orderBy: { check_in: 'desc' },
        take: 50,
      }),
    ]);

    const mappedLease = primary
      ? {
          id: primary.id,
          contractNumber: primary.lease_number,
          property: primary.properties?.title || 'Assigned Property',
          unit: primaryUnit?.unit_ref || primaryUnit?.unit_code || primaryUnit?.unit_name || '—',
          floor: primaryUnit?.floor || '—',
          bedrooms: primaryUnit?.bedrooms ?? primary.properties?.bedrooms ?? 0,
          area: primaryUnit?.area || '—',
          parkingSlot: '—',
          unitCondition: 'Standard',
          landlord: 'Al Ameen Real Estate',
          propertyManager: 'Property Management Team',
          pmContact: '+974 4455 6677',
          startDate: isoDate(primary.commencement_date),
          endDate: isoDate(primary.expiry_date),
          moveInDate: isoDate(primary.commencement_date),
          annualRent: toNum(primary.rental_amount),
          installments: Number(primary.number_of_pdc || primary.lease_period_months || 12),
          installmentAmount:
            primary.lease_period_months > 0
              ? Math.round((toNum(primary.rental_amount) / primary.lease_period_months) * 100) / 100
              : toNum(primary.rental_amount),
          securityDeposit: toNum(primary.security_deposit),
          noticePeriodDays: Number(primary.notice_period_days ?? 60),
          renewalStatus: String(primary.lease_status || '').toLowerCase() === 'renewed' ? 'confirmed' : 'none',
          customerName: primary.customers?.full_name || claims.name || 'Valued Tenant',
          customerId: primary.customers?.customer_code || primary.customer_id || undefined,
        }
      : null;

    const today = new Date().toISOString().slice(0, 10);
    const mappedInvoices = invoices.map((inv) => {
      const dueDate = isoDate(inv.due_date || inv.invoice_date);
      const amt = toNum(inv.amount);
      const paid = toNum(inv.paid_amount);
      const rawStatus = String(inv.status || '').toLowerCase();
      let status: 'paid' | 'overdue' | 'outstanding' = 'outstanding';
      if (rawStatus === 'paid' || (amt > 0 && paid >= amt)) status = 'paid';
      else if (dueDate && dueDate < today) status = 'overdue';
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_no,
        description: inv.stream || inv.notes || 'Lease Invoice',
        dueDate,
        amount: amt,
        paidAmount: paid,
        status,
      };
    });

    const mappedPdcs = pdcs.map((p, idx) => {
      const rawStatus = String(p.status || 'In Hand').toLowerCase();
      const status: 'cleared' | 'upcoming' | 'bounced' | 'deposited' =
        rawStatus === 'cleared'
          ? 'cleared'
          : rawStatus === 'bounced' || rawStatus === 'returned'
            ? 'bounced'
            : rawStatus === 'deposited'
              ? 'deposited'
              : 'upcoming';
      return {
        id: String(p.id),
        chequeNumber: String(p.cheque_number),
        bank: p.bank_id ? `Bank #${p.bank_id}` : 'Qatar National Bank (QNB)',
        installmentLabel: `Cheque ${idx + 1} of ${pdcs.length}`,
        dueDate: isoDate(p.cheque_date),
        amount: toNum(p.amount),
        status,
      };
    });

    const mappedPayments = payments.map((p) => {
      const rawStatus = String(p.payment_status || 'completed').toLowerCase();
      const status: 'completed' | 'pending' | 'failed' =
        rawStatus === 'paid' || rawStatus === 'completed' || rawStatus === 'cleared'
          ? 'completed'
          : rawStatus === 'failed' || rawStatus === 'bounced'
            ? 'failed'
            : 'pending';
      return {
        id: p.id,
        reference: p.reference_no || p.id.slice(0, 10).toUpperCase(),
        description: 'Lease Payment',
        date: isoDate(p.payment_date || p.created_at),
        method: (p.payment_method || 'Bank Transfer') as any,
        amount: toNum(p.amount),
        status,
      };
    });

    const mappedTickets = tickets.map((t) => ({
      id: t.id,
      subject: t.title,
      description: t.description || '',
      unit: t.unit_ref || mappedLease?.unit || '—',
      property: mappedLease?.property || '—',
      complaintArea: 'Unit / Apartment',
      category: t.category || 'General',
      priority: ((String(t.priority || 'medium').charAt(0).toUpperCase() + String(t.priority || 'medium').slice(1).toLowerCase()) as any),
      status: String(t.status || 'new').toLowerCase() as any,
      assignee: t.assignee || undefined,
      createdAt: isoDate(t.created_at),
      timeline: [
        {
          date: isoDate(t.created_at),
          event: `Ticket logged (${String(t.status || 'new').replace('_', ' ')})`,
          by: t.reported_by || 'Tenant',
        },
      ],
    }));

    const documents = leases.flatMap((l) => {
      const docs: Array<{ id: string; name: string; category: string; date: string; size: string; action: 'download' | 'sign'; url: string }> = [];
      if (l.tenant_signed_doc_url || l.landlord_signed_doc_url) {
        docs.push({
          id: `doc-lease-${l.id}`,
          name: `Lease Agreement — ${l.lease_number}`,
          category: 'Legal',
          date: isoDate(l.commencement_date),
          size: 'PDF',
          action: l.tenant_signed_doc_url ? 'download' : 'sign',
          url: `/api/portal/documents/lease-${l.id}.pdf`,
        });
      }
      return docs;
    });

    res.json({
      data: {
        lease: mappedLease,
        invoices: mappedInvoices,
        pdcs: mappedPdcs,
        payments: mappedPayments,
        tickets: mappedTickets,
        documents,
        facilities: amenities.map((a) => ({
          id: String(a.id),
          name: a.label,
          type: 'Community',
          hours: '06:00–22:00',
          capacity: 20,
          availableSlots: 8,
          status: 'Available',
          bookingFee: 0,
        })),
        bookings: bookings.map((b) => ({
          id: b.id,
          facilityId: b.property_id || '',
          facilityName: b.properties?.title || 'Reservation',
          date: isoDate(b.check_in),
          time: `${isoDate(b.check_in)} to ${isoDate(b.check_out)}`,
          status: String(b.status || 'pending').toLowerCase(),
          reference: `BK-${b.id.slice(0, 8).toUpperCase()}`,
        })),
      },
    });
  } catch (e: any) {
    sendDbError(res, e, 'portal.summary');
  }
});

router.get('/owner-statements', async (req: Request, res: Response) => {
  try {
    const [propCount, vouchers] = await Promise.all([
      prisma.properties.count({ where: { is_active: true } }),
      prisma.$queryRaw<Array<{ ym: string; gross_revenue: any; expenses: any }>>`
        SELECT
          DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym,
          COALESCE(SUM(CASE WHEN l.account_code LIKE '4%' THEN l.credit - l.debit ELSE 0 END), 0) AS gross_revenue,
          COALESCE(SUM(CASE WHEN l.account_code LIKE '5%' THEN l.debit - l.credit ELSE 0 END), 0) AS expenses
        FROM fin_voucher_lines l
        INNER JOIN fin_vouchers v ON v.id = l.voucher_id
        WHERE LOWER(COALESCE(v.status, '')) = 'posted'
        GROUP BY DATE_FORMAT(v.voucher_date, '%Y-%m')
        ORDER BY ym DESC
        LIMIT 24
      `,
    ]);

    const statements = vouchers.map((row) => {
      const gross = toNum(row.gross_revenue);
      const expenses = toNum(row.expenses);
      return {
        id: `stmt-${row.ym}`,
        period: row.ym,
        gross_revenue: Math.round(gross * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        net_payable: Math.round((gross - expenses) * 100) / 100,
      };
    });

    const totals = statements.reduce(
      (acc, s) => ({
        gross_revenue: acc.gross_revenue + s.gross_revenue,
        expenses: acc.expenses + s.expenses,
        net_payable: acc.net_payable + s.net_payable,
      }),
      { gross_revenue: 0, expenses: 0, net_payable: 0 },
    );

    res.json({
      data: {
        property_count: propCount,
        totals,
        statements,
      },
    });
  } catch (e: any) {
    sendDbError(res, e, 'portal.ownerStatements');
  }
});

export default router;
