// server/routes/documents.ts
// Lease documents for the tenant portal. Access is checked on every request:
// staff may open any lease document; a tenant may open only documents of their own leases.
// Unknown and not-permitted documents both answer 403, so the response does not reveal which leases exist.
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { verifySession } from '../lib/require-session';
import { isTenant, tenantLeaseWhere } from '../lib/tenant-policy';
import { sendDbError } from '../lib/errors';

const router = Router();

router.get('/portal/documents/:file', async (req: Request, res: Response) => {
  const claims = verifySession(req);
  if (!claims) return res.status(401).json({ error: 'Not signed in' });

  const match = /^lease-([A-Za-z0-9-]+)\.pdf$/.exec(String(req.params.file || ''));
  if (!match) return res.status(403).json({ error: 'Access to this document is not permitted' });

  try {
    const lease = await prisma.leases.findFirst({
      where: { OR: [{ id: match[1] }, { lease_number: match[1] }] },
    });
    let allowed = !!lease;
    if (lease && isTenant(req)) {
      const own = await prisma.leases.findFirst({ where: { id: lease.id, ...tenantLeaseWhere(claims) }, select: { id: true } });
      allowed = !!own;
    }
    if (!allowed || !lease) return res.status(403).json({ error: 'Access to this document is not permitted' });

    const url = lease.tenant_signed_doc_url || lease.landlord_signed_doc_url;
    if (!url || !/^https?:\/\//i.test(url)) return res.status(404).json({ error: 'No document has been uploaded for this lease' });
    return res.redirect(302, url);
  } catch (e: any) {
    sendDbError(res, e, 'documents.get');
  }
});

export default router;
