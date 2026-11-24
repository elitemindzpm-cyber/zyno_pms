// server/routes/features.ts
// Endpoints for the finance, asset, procurement, HR and pricing features. Each one is a thin wrapper
// around a service in server/services/, so the same rules run from the UI and from the API.
import { Router, Request, Response } from 'express';
import { sendDbError, forbidden } from '../lib/errors';
import { expireReservations, computeMarketRent } from '../services/property';
import { reconcileControl, depreciateAsset, disposeAsset } from '../services/finance';
import { approvePurchaseOrder, matchPayableInvoice, approvePayableInvoice, allocateLandedCost } from '../services/procurement';
import { runPayrollCycle, approveFnfSettlement, returnAssetAllocation } from '../services/hr';

const router = Router();
const claimsOf = (req: Request) => (req as any).user as { sub: string; role: string; email?: string };

// Reservation-expiry job. The scheduler calls the same function every hour; this endpoint runs it on demand.
router.post('/api/jobs/reservation-expiry', async (req: Request, res: Response) => {
  if (!['ADMIN', 'SUPER_ADMIN'].includes(claimsOf(req).role)) {
    return forbidden(res, ['ADMIN', 'SUPER_ADMIN']);
  }
  try {
    const ids = Array.isArray(req.body?.reservation_ids) ? req.body.reservation_ids.map(String) : undefined;
    res.json(await expireReservations({ ids }));
  } catch (e: any) { sendDbError(res, e, 'jobs.reservation-expiry'); }
});

// Market rent from the pricing rules.
router.post('/api/units/:id/market-rent', async (req: Request, res: Response) => {
  try {
    const base = req.body?.base_rent !== undefined ? Number(req.body.base_rent) : undefined;
    res.json(await computeMarketRent(req.params.id as string, base));
  } catch (e: any) { sendDbError(res, e, 'units.market-rent'); }
});

// Control-account reconciliation (month-end).
router.get('/api/finance/reconciliation', async (req: Request, res: Response) => {
  try {
    const control = String(req.query.control || '12413');
    res.json(await reconcileControl(control));
  } catch (e: any) { sendDbError(res, e, 'finance.reconciliation'); }
});

// Assets.
router.post('/api/assets/:id/depreciate', async (req: Request, res: Response) => {
  try {
    res.json(await depreciateAsset(req.params.id as string, req.body?.period));
  } catch (e: any) { sendDbError(res, e, 'assets.depreciate'); }
});
router.post('/api/assets/:id/dispose', async (req: Request, res: Response) => {
  try {
    res.json(await disposeAsset(req.params.id as string, req.body || {}));
  } catch (e: any) { sendDbError(res, e, 'assets.dispose'); }
});

// Procurement.
router.post('/api/procurement/purchase-orders/:id/approve', async (req: Request, res: Response) => {
  try {
    res.json(await approvePurchaseOrder(req.params.id as string, claimsOf(req).sub));
  } catch (e: any) { sendDbError(res, e, 'procurement.approve-po'); }
});
router.post('/api/procurement/purchase-orders/:id/landed-cost', async (req: Request, res: Response) => {
  try {
    res.json(await allocateLandedCost(req.params.id as string, req.body || {}));
  } catch (e: any) { sendDbError(res, e, 'procurement.landed-cost'); }
});
router.post('/api/procurement/payable-invoices/:id/match', async (req: Request, res: Response) => {
  try {
    res.json(await matchPayableInvoice(req.params.id as string));
  } catch (e: any) { sendDbError(res, e, 'procurement.match'); }
});
router.post('/api/procurement/payable-invoices/:id/approve', async (req: Request, res: Response) => {
  try {
    res.json(await approvePayableInvoice(req.params.id as string, claimsOf(req).sub));
  } catch (e: any) { sendDbError(res, e, 'procurement.approve-invoice'); }
});

// HR.
router.post('/api/hrms/payroll-cycles/:id/run', async (req: Request, res: Response) => {
  try {
    const employeeIds = Array.isArray(req.body?.employee_ids) ? req.body.employee_ids.map(String) : undefined;
    res.json(await runPayrollCycle(req.params.id as string, { employeeIds }));
  } catch (e: any) { sendDbError(res, e, 'hrms.payroll'); }
});
router.post('/api/hrms/fnf/:id/approve', async (req: Request, res: Response) => {
  try {
    res.json(await approveFnfSettlement(req.params.id as string, claimsOf(req).sub));
  } catch (e: any) { sendDbError(res, e, 'hrms.fnf-approve'); }
});
router.post('/api/hrms/asset-allocations/:id/return', async (req: Request, res: Response) => {
  try {
    res.json(await returnAssetAllocation(req.params.id as string, req.body || {}));
  } catch (e: any) { sendDbError(res, e, 'hrms.asset-return'); }
});

export default router;
