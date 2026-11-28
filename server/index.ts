// server/index.ts
// PMS MySQL Backend API Server - Express + Prisma ORM
// Provides REST endpoints for all 151 tables with tenant isolation

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

import { assertRequiredConfig } from './lib/config';
import { requestLog } from './lib/request-log';
import prisma from './lib/prisma';

// Refuse to start without required secrets (see server/lib/config.ts).
assertRequiredConfig();

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    t: new Date().toISOString(), level: 'error', event: 'unhandledRejection',
    message: String((reason as any)?.message ?? reason).slice(0, 300),
  }));
});

const app = express();
const PORT = process.env.API_PORT || 3002;

// Database BigInt ids (for example fin_pdc_register.id) are sent as strings, since JSON has no BigInt.
app.set('json replacer', (_key: string, value: unknown) => (typeof value === 'bigint' ? value.toString() : value));

// Credentials (session cookie) require an explicit origin allowlist, not "*".
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:8080,http://127.0.0.1:8080,http://localhost:8081,http://127.0.0.1:8081,http://localhost:3000,http://localhost:5173')
  .split(',').map((o) => o.trim());
// Local production preview (vite preview) is served from port 4173.
for (const o of ['http://localhost:4173', 'http://127.0.0.1:4173']) {
  if (!CORS_ORIGINS.includes(o)) CORS_ORIGINS.push(o);
}
const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => cb(null, !origin || CORS_ORIGINS.includes(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
};
app.use(cors(corsOptions));
app.options('/{*splat}', cors(corsOptions));
app.use(express.json({ limit: '25mb' }));
app.use(requestLog);

// Health check for uptime monitors. Public, and it reveals nothing about the database beyond up or down.
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'up', uptime_s: Math.round(process.uptime()) });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

// Every /api route (except login/session/logout) needs a valid session.
import { requireSession } from './lib/require-session';
import { tenantPolicy } from './lib/tenant-policy';
import paymentsRouter from './routes/payments';
import documentsRouter from './routes/documents';
import featuresRouter from './routes/features';
import { startScheduler } from './services/scheduler';
app.use(requireSession);
// Tenants may call only the endpoints in tenant-policy.ts; everything else answers 403.
app.use(tenantPolicy);
app.use(documentsRouter);
app.use('/api/payments', paymentsRouter);
app.use(featuresRouter);

// ─── Route modules ───────────────────────────────────────────────────────────
import propertiesRouter   from './routes/properties';
import unitsRouter        from './routes/units';
import leasesRouter       from './routes/leases';
import customersRouter    from './routes/customers';
import reservationsRouter from './routes/reservations';
import accountingRouter   from './routes/accounting';
import financeRouter      from './routes/finance';
import hrmsRouter         from './routes/hrms';
import procurementRouter  from './routes/procurement';
import mastersRouter      from './routes/masters';
import authRouter         from './routes/auth';
import dbRouter           from './routes/db';
import kvRouter           from './routes/kv';
import portalRouter       from './routes/portal';

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api/properties',   propertiesRouter);
app.use('/api/units',        unitsRouter);
app.use('/api/leases',       leasesRouter);
app.use('/api/customers',    customersRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/accounting',   accountingRouter);
app.use('/api/finance',      financeRouter);
app.use('/api/hrms',         hrmsRouter);
app.use('/api/procurement',  procurementRouter);
app.use('/api/masters',      mastersRouter);
app.use('/api/auth',         authRouter);
app.use('/api/db',           dbRouter);
app.use('/api/kv',           kvRouter);
app.use('/api/portal',       portalRouter);

app.listen(PORT, () => {
  console.log(`PMS API server running on port ${PORT}`);
  startScheduler();
});

export default app;
