// server/routes/payments.ts
// Payment-gateway webhook. The gateway signs the JSON body with HMAC-SHA256 using PAYMENT_WEBHOOK_SECRET
// and sends the hex digest in the x-webhook-signature header.
// Idempotent: the gateway reference is the accounting event's unique idempotency key, so a retried
// delivery never credits the tenant twice.
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { txn } from '../lib/prisma';
import { postAccountingEvent } from '../lib/finance-rpc';
import { HttpError, sendDbError } from '../lib/errors';
import { money } from '../lib/money';

const router = Router();

// Bank is debited and tenant receivables credited, the same as the live RENT_RECEIPT / BANK rule.
const BANK_CODE = '12000';
const RECEIVABLE_CODE = '12413';

function signatureValid(body: unknown, header: unknown, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(body ?? {})).digest('hex');
  const given = Buffer.from(String(header ?? ''), 'utf8');
  const want = Buffer.from(expected, 'utf8');
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}

router.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ error: 'Payment webhook is not configured' });
  if (!signatureValid(req.body, req.headers['x-webhook-signature'], secret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const { reference, amount, tenant_id, lease_id, customer_id, payment_method } = req.body ?? {};
  const amt = money(amount);
  if (typeof reference !== 'string' || !reference.trim() || !(amt > 0)) {
    return res.status(400).json({ error: 'reference and a positive amount are required' });
  }

  const key = `gateway:${reference}`;
  const eventId = crypto.randomUUID();
  const now = new Date();
  try {
    const [bank, receivable] = await Promise.all([
      prisma.fin_coa_accounts.findFirst({ where: { account_code: BANK_CODE, is_active: true } }),
      prisma.fin_coa_accounts.findFirst({ where: { account_code: RECEIVABLE_CODE, is_active: true } }),
    ]);
    if (!bank || !receivable) throw new HttpError(503, 'Payment GL accounts are not configured');

    try {
      await txn(async (tx) => {
        await tx.fin_accounting_events.create({
          data: {
            id: eventId,
            event_type: 'RENT_COLLECTION' as any,
            status: 'DRAFT',
            event_date: now,
            posting_date: now,
            source_type: 'PAYMENT_GATEWAY',
            source_id: reference,
            idempotency_key: key,
            description: `Gateway payment ${reference}`,
            total_debit: amt,
            total_credit: amt,
            metadata: '{}',
            tenant_id: tenant_id ?? null,
            lease_id: lease_id ?? null,
            customer_id: customer_id ?? null,
          },
        });
        await tx.fin_accounting_event_lines.create({
          data: {
            event_id: eventId, line_number: 1, account_id: bank.id, account_code: bank.account_code,
            account_name: bank.account_name, debit: amt, credit: 0, description: `Payment ${reference}`,
          },
        });
        await tx.fin_accounting_event_lines.create({
          data: {
            event_id: eventId, line_number: 2, account_id: receivable.id, account_code: receivable.account_code,
            account_name: receivable.account_name, debit: 0, credit: amt, description: `Payment ${reference}`,
            tenant_id: tenant_id ?? null, lease_id: lease_id ?? null, customer_id: customer_id ?? null,
          },
        });
        await tx.payments.create({
          data: {
            tenant_id: tenant_id ?? null,
            lease_id: lease_id ?? null,
            customer_id: customer_id ?? null,
            amount: amt,
            payment_method: payment_method ?? 'GATEWAY',
            payment_status: 'Completed',
            payment_date: now,
            reference_no: reference,
          },
        });
      });
    } catch (err: any) {
      if (err?.code !== 'P2002') throw err;
      // Already received. Finish posting it if an earlier attempt stopped part-way.
      const existing = await prisma.fin_accounting_events.findUnique({ where: { idempotency_key: key } });
      if (existing && String(existing.status) !== 'POSTED') {
        await postAccountingEvent(existing.id);
      }
      return res.status(200).json({ status: 'duplicate', event_id: existing?.id ?? null });
    }

    const [posted] = await postAccountingEvent(eventId);
    return res.status(200).json({ status: 'processed', event_id: posted.event_id, voucher_number: posted.voucher_number });
  } catch (e: any) {
    sendDbError(res, e, 'payments.webhook');
  }
});

export default router;
