import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubSecrets } from '../../server/lib/redact';

test('password hash is removed from users.raw_user_meta_data, other metadata is kept', () => {
  const row = { id: 'u1', email: 'a@b.c', raw_user_meta_data: JSON.stringify({ password_hash: '$2a$10$abc', full_name: 'A', tenant_id: 't1' }) };
  const out = scrubSecrets(row);
  const meta = JSON.parse(out.raw_user_meta_data);
  assert.equal(meta.password_hash, undefined);
  assert.equal(meta.full_name, 'A');
  assert.equal(meta.tenant_id, 't1');
});

test('secrets are removed through nested relations and arrays', () => {
  const out: any = scrubSecrets({ data: [{ id: 'p1', users: { raw_user_meta_data: '{"password_hash":"x","a":1}', encrypted_password: 'y' } }] });
  assert.equal(out.data[0].users.encrypted_password, undefined);
  assert.equal(JSON.parse(out.data[0].users.raw_user_meta_data).password_hash, undefined);
  assert.equal(JSON.parse(out.data[0].users.raw_user_meta_data).a, 1);
});

test('unparseable metadata is not passed through', () => {
  const out: any = scrubSecrets({ raw_user_meta_data: 'not json password_hash=zzz' });
  assert.equal(out.raw_user_meta_data, '{}');
});

test('dates and plain values are untouched', () => {
  const d = new Date('2026-01-01');
  const out: any = scrubSecrets({ d, n: 5, s: 'x', nul: null });
  assert.equal(out.d, d);
  assert.equal(out.n, 5);
  assert.equal(out.nul, null);
});
