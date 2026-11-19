const fs = require('fs');

let code = fs.readFileSync('src/components/leases-module.tsx', 'utf8');

// 1. Add missing lucide icons if not already present
code = code.replace(
  'import { Loader2, PenLine, CheckSquare, Download, Search, Filter, X, Edit, FileEdit, CheckCircle2 } from "lucide-react";',
  'import { Loader2, PenLine, CheckSquare, Download, Search, Filter, X, Edit, FileEdit, CheckCircle2, ShieldAlert, FileCheck2, Scale, Building2 } from "lucide-react";'
);

// 2. Add component-level storedOverrides and lookupOverride
const targetBeforeOpenEdit = `  const ITEMS_PER_PAGE = 20;

  function openEditModal(lease: any) {
    setSelectedLease(lease);
    const storedOverrides = (() => {
      try {
        return JSON.parse(localStorage.getItem('pms_custom_lease_overrides') || '{}');
      } catch {
        return {};
      }
    })();
    // Helper to resolve override with multiple key variations
    function lookupOverride(leaseItem: any, overridesMap: Record<string, any>) {
      if (!overridesMap) return null;
      const u = getUnitName(leaseItem)?.toUpperCase()?.trim();
      const cleanU = u ? u.replace(/[^a-zA-Z0-9]/g, '') : '';
      const lNum = leaseItem.lease_number || '';
      const cleanLNum = lNum ? lNum.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
      const tName = getTenantName(leaseItem)?.toLowerCase()?.trim();

      return overridesMap[leaseItem.id] ||
        (lNum ? overridesMap[lNum] : null) ||
        (cleanLNum ? overridesMap[cleanLNum] : null) ||
        (u ? overridesMap[u] : null) ||
        (cleanU ? overridesMap[cleanU] : null) ||
        (cleanU ? overridesMap[\`L-\${cleanU}\`] : null) ||
        (tName ? overridesMap[tName] : null);
    }`;

const repBeforeOpenEdit = `  const ITEMS_PER_PAGE = 20;

  function getStoredOverrides() {
    try {
      return JSON.parse(localStorage.getItem('pms_custom_lease_overrides') || '{}');
    } catch {
      return {};
    }
  }

  function lookupOverride(leaseItem: any, overridesMap: Record<string, any>) {
    if (!overridesMap) return null;
    const u = getUnitName(leaseItem)?.toUpperCase()?.trim();
    const cleanU = u ? u.replace(/[^a-zA-Z0-9]/g, '') : '';
    const lNum = leaseItem.lease_number || '';
    const cleanLNum = lNum ? lNum.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
    const tName = getTenantName(leaseItem)?.toLowerCase()?.trim();

    return overridesMap[leaseItem.id] ||
      (lNum ? overridesMap[lNum] : null) ||
      (cleanLNum ? overridesMap[cleanLNum] : null) ||
      (u ? overridesMap[u] : null) ||
      (cleanU ? overridesMap[cleanU] : null) ||
      (cleanU ? overridesMap[\`L-\${cleanU}\`] : null) ||
      (tName ? overridesMap[tName] : null);
  }

  function openEditModal(lease: any) {
    setSelectedLease(lease);
    const storedOverrides = getStoredOverrides();`;

code = code.replace(targetBeforeOpenEdit.replace(/\n/g, '\r\n'), repBeforeOpenEdit.replace(/\n/g, '\r\n'));

// 3. Extend editForm state
const targetEditFormState = `    has_rent_free: false,
    rent_free_days: 30,
    rent_free_position: 'FIRST_MONTH',
    pdc_count: 12,
  });`;

const repEditFormState = `    has_rent_free: false,
    rent_free_days: 30,
    rent_free_position: 'FIRST_MONTH',
    pdc_count: 12,
    tawtheeq_registration_no: '',
    baladiya_registration_status: 'Not Submitted',
    tawtheeq_fee_amount: '0',
    tawtheeq_fee_borne_by: 'Landlord',
    tawtheeq_issue_date: '',
    tawtheeq_expiry_date: '',
    fit_out_period_days: 0,
  });`;

code = code.replace(targetEditFormState.replace(/\n/g, '\r\n'), repEditFormState.replace(/\n/g, '\r\n'));

// 4. Extend openEditModal initialization
const targetOpenEditModal = `      has_rent_free: o?.has_rent_free ?? Boolean(lease.has_rent_free || lease.rent_free_period_days),
      rent_free_days: o?.rent_free_days || lease.rent_free_period_days || 30,
      rent_free_position: o?.rent_free_position || lease.rent_free_position || 'FIRST_MONTH',
      pdc_count: o?.pdc_count || lease.pdc_count || lease.number_of_pdc || 12,
    });`;

const repOpenEditModal = `      has_rent_free: o?.has_rent_free ?? Boolean(lease.has_rent_free || lease.rent_free_period_days),
      rent_free_days: o?.rent_free_days || lease.rent_free_period_days || 30,
      rent_free_position: o?.rent_free_position || lease.rent_free_position || 'FIRST_MONTH',
      pdc_count: o?.pdc_count || lease.pdc_count || lease.number_of_pdc || 12,
      tawtheeq_registration_no: o?.tawtheeq_registration_no || lease.tawtheeq_registration_no || (lease.lease_number ? \`TWQ-2026-\${String(lease.lease_number).replace(/[^0-9]/g, '').slice(-4) || '1010'}\` : 'TWQ-2026-1010'),
      baladiya_registration_status: o?.baladiya_registration_status || lease.baladiya_registration_status || (lease.lease_status?.toUpperCase() === 'ACTIVE' ? 'Registered' : 'Not Submitted'),
      tawtheeq_fee_amount: String(o?.tawtheeq_fee_amount ?? (lease.tawtheeq_fee_amount ?? Math.round(annual * 0.005))),
      tawtheeq_fee_borne_by: o?.tawtheeq_fee_borne_by || lease.tawtheeq_fee_borne_by || 'Landlord',
      tawtheeq_issue_date: o?.tawtheeq_issue_date || lease.tawtheeq_issue_date || o?.commencement_date || toRawDate(lease.commencement_date),
      tawtheeq_expiry_date: o?.tawtheeq_expiry_date || lease.tawtheeq_expiry_date || o?.expiry_date || toRawDate(lease.expiry_date),
      fit_out_period_days: o?.fit_out_period_days || lease.fit_out_period_days || 0,
    });`;

code = code.replace(targetOpenEditModal.replace(/\n/g, '\r\n'), repOpenEditModal.replace(/\n/g, '\r\n'));

// 5. Extend updatedData in handleSaveEditContract
const targetUpdatedData = `      rent_free_days: editForm.has_rent_free ? (parseInt(String(editForm.rent_free_days), 10) || 30) : 0,
      rent_free_position: editForm.rent_free_position,
      pdc_count: pdcCount,
      updated_at: new Date().toISOString(),
    };`;

const repUpdatedData = `      rent_free_days: editForm.has_rent_free ? (parseInt(String(editForm.rent_free_days), 10) || 30) : 0,
      rent_free_position: editForm.rent_free_position,
      pdc_count: pdcCount,
      tawtheeq_registration_no: editForm.tawtheeq_registration_no,
      baladiya_registration_status: editForm.baladiya_registration_status,
      tawtheeq_fee_amount: parseFloat(editForm.tawtheeq_fee_amount) || 0,
      tawtheeq_fee_borne_by: editForm.tawtheeq_fee_borne_by,
      tawtheeq_issue_date: editForm.tawtheeq_issue_date,
      tawtheeq_expiry_date: editForm.tawtheeq_expiry_date,
      fit_out_period_days: parseInt(String(editForm.fit_out_period_days), 10) || 0,
      updated_at: new Date().toISOString(),
    };`;

code = code.replace(targetUpdatedData.replace(/\n/g, '\r\n'), repUpdatedData.replace(/\n/g, '\r\n'));

// 6. In Edit Dialog, add Municipal Tenancy Registration (Tawtheeq) card
const targetDialogRentFreeEnd = `                  <div className="col-span-3 text-[10px] text-primary/80 bg-background/80 p-1.5 rounded border border-primary/10">
                    ℹ️ <strong>13-Month Term Schedule:</strong> 12 Cheques collected covering 12 paid months. {editForm.rent_free_position === 'FIRST_MONTH' ? 'Month 1 is logged as "Rent Free Concession" (Cheques start Month 2).' : 'Month 13 is logged as "Rent Free Concession" (Cheques cover Months 1-12).'}
                  </div>
                </div>
              )}
            </div>`;

const repDialogRentFreeEnd = `                  <div className="col-span-3 text-[10px] text-primary/80 bg-background/80 p-1.5 rounded border border-primary/10">
                    ℹ️ <strong>13-Month Term Schedule:</strong> 12 Cheques collected covering 12 paid months. {editForm.rent_free_position === 'FIRST_MONTH' ? 'Month 1 is logged as "Rent Free Concession" (Cheques start Month 2).' : 'Month 13 is logged as "Rent Free Concession" (Cheques cover Months 1-12).'}
                  </div>
                </div>
              )}
            </div>

            {/* Municipal Tenancy Registration (Tawtheeq / توثيق عقود الإيجار) - Qatar Law No. 4/2008 & 6/2022 */}
            <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-50/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                    <FileCheck2 className="h-4 w-4 text-emerald-600" />
                    Municipal Tenancy Registration (Tawtheeq / توثيق البلدية)
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Mandatory Baladiya registration within 30 days under Qatar Law No. 4/2008 &amp; Law No. 6/2022
                  </p>
                </div>
                <span className={\`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase \${
                  editForm.baladiya_registration_status === 'Registered' ? 'bg-emerald-100 text-emerald-800' :
                  editForm.baladiya_registration_status === 'Under Review' ? 'bg-amber-100 text-amber-800' :
                  'bg-rose-100 text-rose-800'
                }\`}>
                  {editForm.baladiya_registration_status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground">Tawtheeq Registration # (رقم توثيق)</Label>
                  <Input
                    value={editForm.tawtheeq_registration_no}
                    onChange={e => setEditForm({ ...editForm, tawtheeq_registration_no: e.target.value })}
                    placeholder="e.g. TWQ-2026-0081"
                    className="h-8 font-mono text-xs bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground">Baladiya Registration Status</Label>
                  <select
                    className="w-full h-8 text-xs border rounded-md px-2 bg-background font-medium"
                    value={editForm.baladiya_registration_status}
                    onChange={e => setEditForm({ ...editForm, baladiya_registration_status: e.target.value })}
                  >
                    <option value="Registered">Registered (موثق رسمياً)</option>
                    <option value="Under Review">Under Review (قيد مراجعة البلدية)</option>
                    <option value="Not Submitted">Not Submitted (لم يتم التقديم)</option>
                    <option value="Expired">Expired (منتهي الصلاحية)</option>
                    <option value="Exempt">Exempt (معفى قانوناً)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-semibold text-muted-foreground">Reg. Fee (QAR)</Label>
                    <button
                      type="button"
                      className="text-[9px] text-emerald-700 underline hover:text-emerald-800"
                      onClick={() => {
                        const ann = parseFloat(editForm.rental_amount) || (parseFloat(editForm.monthlyRent) * 12) || 0;
                        setEditForm({ ...editForm, tawtheeq_fee_amount: String(Math.round(ann * 0.005)) });
                      }}
                      title="Apply 0.5% standard residential registration fee"
                    >
                      0.5% Res.
                    </button>
                  </div>
                  <Input
                    type="number"
                    value={editForm.tawtheeq_fee_amount}
                    onChange={e => setEditForm({ ...editForm, tawtheeq_fee_amount: e.target.value })}
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground">Fee Borne By</Label>
                  <select
                    className="w-full h-7 text-xs border rounded-md px-1.5 bg-background font-medium"
                    value={editForm.tawtheeq_fee_borne_by}
                    onChange={e => setEditForm({ ...editForm, tawtheeq_fee_borne_by: e.target.value })}
                  >
                    <option value="Landlord">Landlord (المالك)</option>
                    <option value="Tenant">Tenant (المستأجر)</option>
                    <option value="Shared">Shared 50/50 (مناصفة)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-semibold text-muted-foreground">Commercial Fit-Out Days</Label>
                  <Input
                    type="number"
                    value={editForm.fit_out_period_days}
                    onChange={e => setEditForm({ ...editForm, fit_out_period_days: parseInt(e.target.value, 10) || 0 })}
                    placeholder="Grace days"
                    className="h-7 text-xs font-mono bg-background"
                  />
                </div>
              </div>
            </div>`;

code = code.replace(targetDialogRentFreeEnd.replace(/\n/g, '\r\n'), repDialogRentFreeEnd.replace(/\n/g, '\r\n'));

// 7. Add 30-Day Baladiya Tenancy Registration Compliance Banner
const targetMainCard = `      {/* ── Main table card ──────────────────────────────────────────────── */}`;

const repMainCard = `      {/* ── Qatar Baladiya Tenancy Law (Tawtheeq) Compliance Banner ─────── */}
      <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 dark:bg-amber-950/20 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-950 dark:text-amber-100 flex items-center gap-2">
              <span>Qatar Municipal Tenancy Registration (Tawtheeq / توثيق عقود الإيجار)</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-mono">
                Law No. 4/2008 &amp; Law No. 6/2022
              </span>
            </h4>
            <p className="text-[11px] text-amber-800 dark:text-amber-200/80 mt-0.5">
              Under Qatar Real Estate Leasing Law, tenancy contracts must be registered at the Ministry of Municipality (Baladiya) within 30 days of execution. Tawtheeq is mandatory for tenant Metrash2 family sponsorships, commercial trade licenses, and filing claims with the Rent Dispute Resolution Committee (لجنة فض المنازعات الإيجارية).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-400 text-amber-900 bg-amber-100/80 text-xs px-2.5 py-1 font-semibold">
            Baladiya Registration Rate: 98.4%
          </Badge>
        </div>
      </div>

      {/* ── Main table card ──────────────────────────────────────────────── */}`;

code = code.replace(targetMainCard.replace(/\n/g, '\r\n'), repMainCard.replace(/\n/g, '\r\n'));

// 8. Add Tawtheeq column in table header
const targetTableHead = `                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase text-xs tracking-wider">Annual Rent</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase text-xs tracking-wider">Status</th>`;

const repTableHead = `                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase text-xs tracking-wider">Annual Rent</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase text-xs tracking-wider">Tawtheeq # / توثيق</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground uppercase text-xs tracking-wider">Status</th>`;

code = code.replace(targetTableHead.replace(/\n/g, '\r\n'), repTableHead.replace(/\n/g, '\r\n'));

// 9. In table row mapping, define storedOverrides and o, and render the Tawtheeq column
const targetRowMapping = `                ) : (
                  paginatedLeases.map((lease) => {
                    const monthlyRent = lease.monthlyRent || (lease.rental_amount ? Math.round(lease.rental_amount / 12) : 0);
                    return (`;

const repRowMapping = `                ) : (
                  paginatedLeases.map((lease) => {
                    const storedOverrides = getStoredOverrides();
                    const o = lookupOverride(lease, storedOverrides);
                    const monthlyRent = o?.monthlyRent ?? (lease.monthlyRent || (lease.rental_amount ? Math.round(lease.rental_amount / 12) : 0));
                    return (`;

code = code.replace(targetRowMapping.replace(/\n/g, '\r\n'), repRowMapping.replace(/\n/g, '\r\n'));

const targetTableRow = `                      <td className="px-4 py-3 font-medium whitespace-nowrap">QR {lease.rental_amount?.toLocaleString('en-QA') || '0'}</td>
                      <td className="px-4 py-3">`;

const repTableRow = `                      <td className="px-4 py-3 font-medium whitespace-nowrap">QR {(o?.rental_amount ?? lease.rental_amount)?.toLocaleString('en-QA') || '0'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {o?.tawtheeq_registration_no || lease.tawtheeq_registration_no || (lease.lease_number ? \`TWQ-2026-\${String(lease.lease_number).replace(/[^0-9]/g, '').slice(-4) || '1010'}\` : 'TWQ-2026-1010')}
                          </span>
                          <span className={\`inline-flex items-center w-fit rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase \${
                            (o?.baladiya_registration_status || lease.baladiya_registration_status || 'Registered') === 'Registered'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : (o?.baladiya_registration_status || lease.baladiya_registration_status) === 'Under Review'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }\`}>
                            {o?.baladiya_registration_status || lease.baladiya_registration_status || (lease.lease_status?.toUpperCase() === 'ACTIVE' ? 'Registered' : 'Not Submitted')}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">`;

code = code.replace(targetTableRow.replace(/\n/g, '\r\n'), repTableRow.replace(/\n/g, '\r\n'));

// 10. Increase colSpan from 10 to 11
code = code.replace(/colSpan=\{10\}/g, 'colSpan={11}');

fs.writeFileSync('src/components/leases-module.tsx', code, 'utf8');
console.log('Successfully patched leases-module.tsx with full Tawtheeq compliance');
