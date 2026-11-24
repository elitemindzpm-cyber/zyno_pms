import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jwtSecret } from '../../server/lib/config';

const original = process.env.JWT_SECRET;
test.after(() => { if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original; });

test('missing JWT_SECRET is refused (no fallback)', () => {
  delete process.env.JWT_SECRET;
  assert.throws(() => jwtSecret(), /JWT_SECRET is missing or too weak/);
});

test('short or well-known JWT_SECRET is refused', () => {
  process.env.JWT_SECRET = 'short';
  assert.throws(() => jwtSecret());
  process.env.JWT_SECRET = 'pms_jwt_secret_key_change_in_production';
  assert.throws(() => jwtSecret());
});

test('a random secret of 32+ characters is accepted', () => {
  process.env.JWT_SECRET = 'x'.repeat(40);
  assert.equal(jwtSecret(), 'x'.repeat(40));
});
