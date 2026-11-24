import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signInBlockedFor, recordSignInFailure, clearSignInFailures } from '../../server/lib/login-limiter';

test('five failures lock the account for 30 minutes', () => {
  const email = 'limit-a@example.test';
  const ip = '10.0.0.1';
  for (let i = 0; i < 4; i++) recordSignInFailure(email, ip);
  assert.equal(signInBlockedFor(email, ip), 0, 'locked after 4 failures');
  recordSignInFailure(email, ip);
  const secs = signInBlockedFor(email, ip);
  assert.ok(secs > 29 * 60 && secs <= 30 * 60, `lock should be about 30 minutes, got ${secs}s`);
});

test('a successful sign-in clears the account failures', () => {
  const email = 'limit-b@example.test';
  for (let i = 0; i < 4; i++) recordSignInFailure(email, '10.0.0.2');
  clearSignInFailures(email);
  recordSignInFailure(email, '10.0.0.2');
  assert.equal(signInBlockedFor(email, '10.0.0.2'), 0);
});

test('one address failing across many accounts is locked after 30 failures', () => {
  const ip = '10.0.0.3';
  for (let i = 0; i < 29; i++) recordSignInFailure(`many-${i}@example.test`, ip);
  assert.equal(signInBlockedFor('fresh@example.test', ip), 0, 'locked after 29 failures');
  recordSignInFailure('many-29@example.test', ip);
  assert.ok(signInBlockedFor('fresh@example.test', ip) > 0, 'address not locked after 30 failures');
});

test('email matching ignores case', () => {
  for (let i = 0; i < 5; i++) recordSignInFailure('Case@Example.test', '10.0.0.4');
  assert.ok(signInBlockedFor('case@example.test', '10.0.0.4') > 0);
});
