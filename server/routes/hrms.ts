// server/routes/hrms.ts
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parsePagination, paginatedResponse } from '../lib/middleware';
import { money, num } from '../lib/money';

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

// E5: Server-side Qatar Labour Law EOSB gratuity calculation (21 days basic salary per year of service)
router.get('/employees/:id/gratuity-preview', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const emp = await prisma.employees.findUnique({ where: { id } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const asOf = req.query.as_of ? new Date(String(req.query.as_of)) : new Date();
    const join = emp.date_of_joining ? new Date(emp.date_of_joining) : null;
    if (!join || Number.isNaN(join.getTime()) || Number.isNaN(asOf.getTime())) {
      return res.json({ data: { employee_id: id, years_of_service: 0, basic_salary: money(emp.basic_salary), gratuity_amount: 0 } });
    }
    const serviceDays = Math.max(0, Math.floor((asOf.getTime() - join.getTime()) / 86400000));
    const years = serviceDays / 365.25;
    const basic = money(emp.basic_salary);
    const gratuity = years >= 1 ? money((basic / 30) * 21 * years) : 0;
    res.json({
      data: {
        employee_id: id,
        basic_salary: basic,
        service_days: serviceDays,
        years_of_service: Math.round(years * 100) / 100,
        gratuity_amount: gratuity,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
