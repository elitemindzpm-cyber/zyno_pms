// e2e/lib/env.mjs
// Shared configuration and Prisma client for the E2E suite.
// Every row the suite creates is tagged with an "E2E-" name prefix or an "e2e-" email/key prefix,
// so cleanup can remove exactly those rows and nothing else.
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { PrismaClient } = require('@prisma/client');

export const bcrypt = require('bcryptjs');
export const dotenv = require('dotenv');
export const db = new PrismaClient();

export const API = process.env.E2E_API || 'http://localhost:3002';
export const RUN = 'r' + Date.now().toString(36);
export const TAG = `E2E-${RUN}`;          // name prefix used on test rows
export const EMAIL_TAG = `e2e-${RUN}`;     // email / tenant_key prefix used on test rows

export const STATE_DIR = process.env.E2E_STATE_DIR || path.join(os.tmpdir(), 'pms-e2e');
export const STATE_FILE = path.join(STATE_DIR, `state-${RUN}.json`);
const state = { run: RUN, created: [] };

/** Record a created id so a failed run can still be audited. */
export function track(kind, id) {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    state.created.push({ kind, id: String(id) });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    /* state file is best-effort; cleanup is tag-based */
  }
}

/** Records an id for a table without a tag column (for example pricing rules); cleanup reads these records. */
export const trackIds = (kind, id) => track(kind, id);
