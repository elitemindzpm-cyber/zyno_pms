// server/index.ts
// PMS MySQL Backend API Server - Express + Prisma ORM
// Provides REST endpoints for all 151 tables with tenant isolation

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

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

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', db: 'pms_db@145.223.18.48:3307', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`PMS API server running on http://localhost:${PORT}`);
});

export default app;
