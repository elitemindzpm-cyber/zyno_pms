// Adds the chart accounts that the posting code already refers to but the imported chart lacks:
//   21100006 Refundable Security Deposit - Tenant (SL under GL 21100)
//   13400 / 13410  Capital Work in Progress / Goods in Transit (class 134)
//   21610 / 21620  GR/IR Clearing / Landed Cost Clearing (class 216)
// Each new class / GL / SL is cloned from an existing row of the same kind so it carries the same posting settings.
// Idempotent: existing codes are skipped. Run with: node prisma/manual-migrations/2026-11-27-posting-accounts.cjs
// Rollback: DELETE FROM fin_coa_accounts / coa_sl / coa_gl / coa_classes WHERE the codes below.
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
    // Refundable security deposit liability (same GL as the other 21100 deposits)
    await addSl(tx, { glCode: '21100', slCode: '21100006', slName: 'Refundable Security Deposit - Tenant', srcSlCode: '21100005' });

    const fixedGl = await one(tx, "SELECT code FROM coa_gl WHERE class_code = '110' ORDER BY code LIMIT 1");
    const fixedSl = await one(tx, "SELECT code FROM coa_sl WHERE class_code = '110' ORDER BY code LIMIT 1");
    await addGl(tx, { classCode: '134', className: 'Capital Work in Progress', srcClassCode: '110', glCode: '13400', glName: 'Capital Work in Progress', srcGlCode: fixedGl.code, slCode: '13400001', slName: 'Capital Work in Progress', srcSlCode: fixedSl.code });
    await addGl(tx, { classCode: '134', className: 'Capital Work in Progress', srcClassCode: '110', glCode: '13410', glName: 'Goods in Transit', srcGlCode: fixedGl.code, slCode: '13410001', slName: 'Goods in Transit', srcSlCode: fixedSl.code });

    await addGl(tx, { classCode: '216', className: 'GR/IR Clearing', srcClassCode: '211', glCode: '21610', glName: 'GR/IR Clearing', srcGlCode: '21100', slCode: '21610001', slName: 'GR/IR Clearing', srcSlCode: '21100005' });
    await addGl(tx, { classCode: '216', className: 'GR/IR Clearing', srcClassCode: '211', glCode: '21620', glName: 'Landed Cost Clearing', srcGlCode: '21100', slCode: '21620001', slName: 'Landed Cost Clearing', srcSlCode: '21100005' });
  });
  const rows = await p.$queryRawUnsafe("SELECT account_code, account_name, account_level, account_type FROM fin_coa_accounts WHERE account_code IN ('21100006','13400','13400001','13410','13410001','21610','21610001','21620','21620001') ORDER BY account_code");
  console.log(JSON.stringify(rows));
  await p.$disconnect();
})().catch((e) => { console.error(e.message.slice(0, 500)); process.exit(1); });
