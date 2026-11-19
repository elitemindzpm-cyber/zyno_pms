// server/routes/hrms.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';

const router = Router();

// Employees
router.get('/employees', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const search = req.query.search as string;
    const where: any = {};
    if (search) where.OR = [{ first_name: { contains: search } }, { last_name: { contains: search } }];
    const [data, total] = await Promise.all([
      prisma.employees.findMany({ where, skip, take }),
      prisma.employees.count({ where }),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/employees/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const item = await prisma.employees.findFirst({ where: { id } });
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Departments (system/global master)
router.get('/departments', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.departments.findMany();
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Designations (system/global master)
router.get('/designations', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.designations.findMany();
    res.json({ data });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Payroll Syncs
router.get('/payroll-syncs', async (req: Request, res: Response) => {
  try {
    const { skip, take, page, limit } = parsePagination(req);
    const [data, total] = await Promise.all([
      prisma.fin_payroll_syncs.findMany({ skip, take, orderBy: { created_at: 'desc' } }),
      prisma.fin_payroll_syncs.count(),
    ]);
    res.json(paginatedResponse(data, total, page, limit));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
