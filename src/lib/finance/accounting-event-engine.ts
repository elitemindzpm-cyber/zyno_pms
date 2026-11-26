import { db } from '../db';

export type AccountingEventLine = {
    account_code: string;
    account_name?: string;
    sl_code?: string;

    debit: number;
    credit: number;

    tenant_id?: string;
    lease_id?: string;
    property_id?: string;
    unit_id?: string;
    customer_id?: string;
    cost_center_id?: string;

    description?: string;
    source_type?: string;
    source_id?: string;

    metadata?: Record<string, unknown>;
};

export type AccountingEventPayload = {
    event_type: string;

    event_date?: string;
    posting_date?: string;

    source_type: string;
    source_id?: string;

    reference_number?: string;
    description?: string;

    idempotency_key: string;

    reversal_of_event_id?: string;

    tenant_id?: string;
    lease_id?: string;
    property_id?: string;
    unit_id?: string;
    customer_id?: string;

    metadata?: Record<string, unknown>;
    cost_center_id?: string;
    lines: AccountingEventLine[];
};

function validateLines(lines: AccountingEventLine[]) {
    if (!lines.length) {
        throw new Error('Accounting event must contain at least one line.');
    }

    let debit = 0;
    let credit = 0;

    for (const line of lines) {
        const dr = Number(line.debit) || 0;
        const cr = Number(line.credit) || 0;

        if (dr < 0 || cr < 0) {
            throw new Error('Debit and credit cannot be negative.');
        }

        if (dr > 0 && cr > 0) {
            throw new Error(
                `Account ${line.account_code} cannot have both debit and credit.`,
            );
        }

        if (dr === 0 && cr === 0) {
            throw new Error(
                `Accounting line ${line.account_code} has no debit or credit value.`,
            );
        }

        debit += dr;
        credit += cr;
    }

    if (Math.abs(debit - credit) > 0.001) {
        throw new Error(
            `Unbalanced accounting event. Debit=${debit}, Credit=${credit}`,
        );
    }

    return {
        debit: Number(debit.toFixed(2)),
        credit: Number(credit.toFixed(2)),
    };
}

/**
 * Creates the accounting event and event lines.
 *
 * IMPORTANT:
 * The accounting event is the source accounting document.
 * ERP voucher/journal creation happens only after the event exists.
 */
export async function createAccountingEvent(
    payload: AccountingEventPayload,
) {
    const totals = validateLines(payload.lines);

    /*
     * 1. Check idempotency first.
     */
    const { data: existing, error: existingError } = await db
        .from('fin_accounting_events')
        .select('*')
        .eq('idempotency_key', payload.idempotency_key)
        .maybeSingle();

    if (existingError) {
        throw existingError;
    }

    if (existing) {
        return existing;
    }

    /*
     * 2. Create accounting event.
     */
    const { data: event, error: eventError } = await db
        .from('fin_accounting_events')
        .insert({
            event_type: payload.event_type,
            status: 'DRAFT',

            event_date:
                payload.event_date ||
                new Date().toISOString().split('T')[0],

            posting_date:
                payload.posting_date ||
                new Date().toISOString().split('T')[0],

            source_type: payload.source_type,
            source_id: payload.source_id || null,

            reference_number: payload.reference_number || null,
            description: payload.description || null,

            idempotency_key: payload.idempotency_key,

            reversal_of_event_id:
                payload.reversal_of_event_id || null,

            tenant_id: payload.tenant_id || null,
            lease_id: payload.lease_id || null,
            property_id: payload.property_id || null,
            unit_id: payload.unit_id || null,
            customer_id: payload.customer_id || null,

            total_debit: totals.debit,
            total_credit: totals.credit,

            metadata: payload.metadata || {},
        })
        .select()
        .single();

    if (eventError || !event) {
        /*
         * Another concurrent request may have inserted
         * the same idempotency key.
         */
        const { data: concurrent } = await db
            .from('fin_accounting_events')
            .select('*')
            .eq('idempotency_key', payload.idempotency_key)
            .maybeSingle();

        if (concurrent) {
            return concurrent;
        }

        // Never fabricate a local event id: it does not exist in the database, so the later
        // post_accounting_event_atomic call fails with a misleading "event not found" 404 and
        // hides the real cause. Surface the actual insert error instead.
        throw new Error(
            `Could not save accounting event (${payload.event_type}, ref ${payload.reference_number ?? payload.idempotency_key}): ${eventError?.message || 'unknown database error'}`,
        );
    }

    /*
     * 3. Create accounting event lines.
     */
    const lines = payload.lines.map((line, index) => ({
        event_id: event.id,
        line_number: index + 1,

        account_code: line.account_code,
        account_name: line.account_name || null,

        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,

        description: line.description || null,

        tenant_id: line.tenant_id || payload.tenant_id || null,
        lease_id: line.lease_id || payload.lease_id || null,
        property_id: line.property_id || payload.property_id || null,
        unit_id: line.unit_id || payload.unit_id || null,
        customer_id: line.customer_id || payload.customer_id || null,
        cost_center_id: line.cost_center_id || payload.cost_center_id || null,

        source_type:
            line.source_type ||
            payload.source_type ||
            null,

        source_id:
            line.source_id ||
            payload.source_id ||
            null,

        metadata: line.metadata || {},
    }));

    try {
        const { error: linesError } = await db
            .from('fin_accounting_event_lines')
            .insert(lines);

        if (linesError) throw linesError;
    } catch (e: any) {
        // A saved event without lines can never post and only shows up later as "Internal server error".
        throw new Error(`Could not save the accounting lines for event ${payload.reference_number ?? payload.idempotency_key}: ${e?.message || 'unknown error'}`);
    }

    /*
     * 4. Refresh totals from actual lines.
     */
    const { error: refreshError } = await db.rpc(
        'fin_refresh_event_totals',
        {
            p_event_id: event.id,
        },
    );

    if (refreshError) {
        throw refreshError;
    }

    /*
     * 5. Validate final balance.
     */
    const { error: balanceError } = await db.rpc(
        'fin_validate_event_balance',
        {
            p_event_id: event.id,
        },
    );

    if (balanceError) {
        throw balanceError;
    }

    /*
     * 6. Fetch final event.
     */
    const { data: finalEvent, error: finalError } =
        await db
            .from('fin_accounting_events')
            .select('*')
            .eq('id', event.id)
            .single();

    if (finalError || !finalEvent) {
        throw finalError || new Error(
            'Accounting event created but could not be reloaded.',
        );
    }

    return finalEvent;
}