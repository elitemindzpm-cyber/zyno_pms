// Adds the VAT accounts the chart was missing (the code referred to five different, wrong codes):
//   13100 / 13100001  Input VAT (Recoverable)  - current asset, class 131 "VAT Receivable"
//   21700 / 21700001  Output VAT Payable       - current liability, class 217 "VAT Payable"
// Each new class / GL / SL is cloned from an existing row of the same kind so it carries the same posting settings.
// Idempotent: existing codes are skipped. Run with: node prisma/manual-migrations/2026-11-28-vat-accounts.cjs
// Rollback: DELETE FROM fin_coa_accounts / coa_sl / coa_gl / coa_classes WHERE code IN ('13100001','13100','21700001','21700') (and classes '131','217').
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const p = new PrismaClient();

async function clone(tx, table, source, over) {
  const row = { ...source, ...over, created_at: new Date(), updated_at: new Date() };
  const cols = Object.keys(row);
  await tx.$executeRawUnsafe(
    `INSERT INTO ${table} (${cols.map((c) => '`' + c + '`').join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    ...cols.map((c) => row[c]),
  );
}
const one = async (tx, sql, ...a) => (await tx.$queryRawUnsafe(sql, ...a))[0];

async function addSl(tx, { glCode, slCode, slName, srcSlCode }) {
  if (await one(tx, 'SELECT code FROM coa_sl WHERE code = ?', slCode)) return;
  const gl = await one(tx, 'SELECT * FROM coa_gl WHERE code = ?', glCode);
  const src = await one(tx, 'SELECT * FROM coa_sl WHERE code = ?', srcSlCode);
  await clone(tx, 'coa_sl', src, { id: randomUUID(), gl_id: gl.id, class_id: gl.class_id, gl_code: gl.code, class_code: gl.class_code, code: slCode, name: slName });
  if (!(await one(tx, 'SELECT id FROM fin_coa_accounts WHERE account_code = ?', slCode))) {
    const fgl = await one(tx, 'SELECT * FROM fin_coa_accounts WHERE account_code = ?', glCode);
    const fsrc = await one(tx, 'SELECT * FROM fin_coa_accounts WHERE account_code = ?', srcSlCode);
    await clone(tx, 'fin_coa_accounts', fsrc, { id: randomUUID(), account_code: slCode, account_name: slName, parent_id: fgl.id, parent_account_id: fgl.id, class_name: fgl.class_name, account_level: 'SL' });
  }
}

async function addGl(tx, { classCode, className, srcClassCode, glCode, glName, srcGlCode, slCode, slName, srcSlCode }) {
  let cls = await one(tx, 'SELECT * FROM coa_classes WHERE code = ?', classCode);
  if (!cls) {
    const src = await one(tx, 'SELECT * FROM coa_classes WHERE code = ?', srcClassCode);
    const id = randomUUID();
    await clone(tx, 'coa_classes', src, { id, code: classCode, name: className });
    cls = { id, code: classCode };
  }
  if (!(await one(tx, 'SELECT code FROM coa_gl WHERE code = ?', glCode))) {
    const src = await one(tx, 'SELECT * FROM coa_gl WHERE code = ?', srcGlCode);
    await clone(tx, 'coa_gl', src, { id: randomUUID(), class_id: cls.id, class_code: classCode, code: glCode, name: glName });
    const fsrc = await one(tx, 'SELECT * FROM fin_coa_accounts WHERE account_code = ?', srcGlCode);
    if (!(await one(tx, 'SELECT id FROM fin_coa_accounts WHERE account_code = ?', glCode))) {
      await clone(tx, 'fin_coa_accounts', fsrc, { id: randomUUID(), account_code: glCode, account_name: glName, parent_id: null, parent_account_id: null, class_name: className, account_level: 'GL' });
    }
  }
  await addSl(tx, { glCode, slCode, slName, srcSlCode });
}

(async () => {
  await p.$transaction(async (tx) => {
    await addGl(tx, { classCode: '131', className: 'VAT Receivable', srcClassCode: '125', glCode: '13100', glName: 'Input VAT (Recoverable)', srcGlCode: '12500', slCode: '13100001', slName: 'Input VAT (Recoverable)', srcSlCode: '12500001' });
    await addGl(tx, { classCode: '217', className: 'VAT Payable', srcClassCode: '216', glCode: '21700', glName: 'Output VAT Payable', srcGlCode: '21600', slCode: '21700001', slName: 'Output VAT Payable', srcSlCode: '21600001' });
  });
  const rows = await p.$queryRawUnsafe("SELECT account_code, account_name, account_level, account_type, group_name FROM fin_coa_accounts WHERE account_code IN ('13100','13100001','21700','21700001') ORDER BY account_code");
  console.log(JSON.stringify(rows));
  await p.$disconnect();
})().catch((e) => { console.error(e.message.slice(0, 500)); process.exit(1); });
