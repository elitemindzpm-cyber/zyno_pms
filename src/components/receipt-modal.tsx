import React, { useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, Building, User, CreditCard, FileText, ShieldCheck } from 'lucide-react';
import type { ReceiptData, ReceiptLineItem } from './receipt-template';
import { getDocumentBranding } from '@/lib/document-branding';
import { formatDateDDMMYYYY } from '@/lib/date-utils';

export interface SecurityDepositDetailItem {
  category: 'Type 1' | 'Type 2';
  label: string;
  mode: string;
  amount: number;
  bankAccount?: string;
  referenceNo?: string;
  date?: string;
}

export interface TenantReceiptDetails {
  receiptNo: string;
  acknowledgementNo?: string;
  date: string;
  tenantName: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantQid?: string;
  propertyName: string;
  unitRef: string;
  leaseNo?: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: number;
  totalContractRent: number;
  depositAmount: number;
  depositMode: string;
  securityDepositDetails?: SecurityDepositDetailItem[];
  pdcCount: number;
  pdcs: Array<{
    chequeNo: string;
    bank: string;
    date: string;
    amount: number;
    period?: string;
    tenureStart?: string;
    tenureEnd?: string;
  }>;
  vouchers?: Array<{
    receiptNo?: string;
    name: string;
    amount: number;
    method?: string;
    debit?: string;
    credit?: string;
  }>;
  agencyCommission?: number;
  adminCharges?: number;
  utilityDeposit?: number;
  qatarCoolDeposit?: number;
  reservationDeposit?: number;
  serviceFeeDeposit?: number;
  guaranteeChequeDeposit?: number;
  totalCollected: number;
  cashierName?: string;
  notes?: string;
  unusedRentRefund?: number;
}

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: TenantReceiptDetails | null;
  secondaryData?: TenantReceiptDetails | null;
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (num === 0) return 'Zero';
  function helper(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + helper(n % 100) : '');
    if (n < 1000000) return helper(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + helper(n % 1000) : '');
    return helper(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + helper(n % 1000000) : '');
  }
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  let words = helper(integerPart) + ' Qatari Riyals';
  if (decimalPart > 0) {
    words += ' and ' + helper(decimalPart) + ' Dirhams';
  }
  return words + ' Only';
}

export function ReceiptModal({ open, onOpenChange, data, secondaryData }: ReceiptModalProps) {
  const [activeTab, setActiveTab] = React.useState<'primary' | 'secondary'>('primary');
  const branding = getDocumentBranding();

  React.useEffect(() => {
    if (open) {
      setActiveTab('primary');
    }
  }, [open]);

  if (!data) return null;

  const currentData = (activeTab === 'secondary' && secondaryData) ? secondaryData : data;
  const totalWords = numberToWords(currentData.totalCollected);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const lineItems: ReceiptLineItem[] = [];
    let sNo = 1;

    // Add Security Deposit (Type 1 & Type 2) itemized payment breakdown
    const hasDetailedDeposits = (currentData.securityDepositDetails || []).length > 0;
    const mapPdfType = (mode: string): ReceiptLineItem['type'] => {
      const m = (mode || '').toLowerCase();
      if (m.includes('bank')) return 'Bank Transfer';
      if (m.includes('pdc')) return 'PDC';
      if (m.includes('cheque') || m.includes('guarantee')) return 'Cheque';
      return 'Cash';
    };

    if (hasDetailedDeposits) {
      (currentData.securityDepositDetails || []).forEach((item) => {
        if (item.amount <= 0) return;
        lineItems.push({
          sNo: sNo++,
          description: `${item.category}: ${item.label}`,
          chequeRef: item.referenceNo || currentData.receiptNo,
          maturityDate: item.date || currentData.date,
          type: mapPdfType(item.mode),
          amount: item.amount,
          bankName: item.bankAccount || (item.mode === 'Cash' ? 'Cash' : '—'),
        });
      });
    } else if (currentData.depositAmount > 0 && currentData.depositMode !== 'N/A') {
      lineItems.push({
        sNo: sNo++,
        description: currentData.depositMode || 'Security Deposit',
        chequeRef: currentData.receiptNo,
        maturityDate: currentData.leaseStartDate,
        type: mapPdfType(currentData.depositMode),
        amount: currentData.depositAmount,
        bankName: 'Operating Bank',
      });
    }

    // Add PDCs (Rent Schedule)
    (currentData.pdcs || []).forEach((pdc) => {
      lineItems.push({
        sNo: sNo++,
        description: `Rent PDC - ${pdc.period || `Cheque ${sNo - 1}`}`,
        chequeRef: pdc.chequeNo,
        maturityDate: pdc.date,
        type: 'PDC',
        checkStartDate: pdc.tenureStart,
        checkEndDate: pdc.tenureEnd,
        bankName: pdc.bank,
        amount: pdc.amount,
      });
    });

    // Add ancillary fees (Non-ledger tenant facing)
    if (currentData.agencyCommission && currentData.agencyCommission > 0) {
      lineItems.push({
        sNo: sNo++,
        description: 'Agency Commission',
        chequeRef: 'RV-AGENCY',
        maturityDate: currentData.date,
        type: 'Cash',
        amount: currentData.agencyCommission,
      });
    }
    if (currentData.adminCharges && currentData.adminCharges > 0) {
      lineItems.push({
        sNo: sNo++,
        description: 'Administrative Charges',
        chequeRef: 'RV-ADMIN',
        maturityDate: currentData.date,
        type: 'Cash',
        amount: currentData.adminCharges,
      });
    }
    if (!hasDetailedDeposits) {
      if (currentData.utilityDeposit && currentData.utilityDeposit > 0) {
        lineItems.push({
          sNo: sNo++,
          description: 'Type 2: Kahramaa Utility Deposit',
          chequeRef: 'RV-KAHRAMAA',
          maturityDate: currentData.date,
          type: 'Cash',
          amount: currentData.utilityDeposit,
        });
      }
      if (currentData.qatarCoolDeposit && currentData.qatarCoolDeposit > 0) {
        lineItems.push({
          sNo: sNo++,
          description: 'Type 2: Qatar Cool Deposit',
          chequeRef: 'RV-QCOOL',
          maturityDate: currentData.date,
          type: 'Cash',
          amount: currentData.qatarCoolDeposit,
        });
      }
      if (currentData.reservationDeposit && currentData.reservationDeposit > 0) {
        lineItems.push({
          sNo: sNo++,
          description: 'Type 2: Reservation Advance Deposit',
          chequeRef: 'RV-RESERVE',
          maturityDate: currentData.date,
          type: 'Cash',
          amount: currentData.reservationDeposit,
        });
      }
      if (currentData.serviceFeeDeposit && currentData.serviceFeeDeposit > 0) {
        lineItems.push({
          sNo: sNo++,
          description: 'Type 2: Service Fee / Key Deposit',
          chequeRef: 'RV-SVCFEE',
          maturityDate: currentData.date,
          type: 'Cash',
          amount: currentData.serviceFeeDeposit,
        });
      }
      if (currentData.guaranteeChequeDeposit && currentData.guaranteeChequeDeposit > 0) {
        lineItems.push({
          sNo: sNo++,
          description: 'Type 2: Guarantee Cheque Security',
          chequeRef: 'RV-GNTCHQ',
          maturityDate: currentData.date,
          type: 'Cheque',
          amount: currentData.guaranteeChequeDeposit,
        });
      }
    }

    const receiptPayload: ReceiptData = {
      receipt_no: currentData.receiptNo,
      acknowledgement_no: currentData.acknowledgementNo || currentData.receiptNo,
      tenant_name: currentData.tenantName,
      property_name: currentData.propertyName,
      lease_no: currentData.leaseNo || `LES-${currentData.unitRef}`,
      location_code: currentData.unitRef,
      collection_date: currentData.date,
      lease_start_date: currentData.leaseStartDate,
      lease_end_date: currentData.leaseEndDate,
      line_items: lineItems,
      total_amount: currentData.totalCollected,
      amount_in_words: totalWords,
      prepared_by: currentData.cashierName || 'Finance Cashier',
      remarks: currentData.notes || 'Official payment acknowledgment.',
    };

    try {
      // Loaded on demand so the PDF renderer is only fetched when a receipt is produced.
      const { generateReceiptBlob } = await import('./receipt-template');
      const blob = await generateReceiptBlob(receiptPayload);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Official_Receipt_${currentData.receiptNo}_${currentData.tenantName.replace(/\W/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Error generating PDF receipt.');
    }
  };

  const ackSub = branding.submodules?.acknowledgementReceipt;
  const bannerUrl = ackSub?.bannerImageUrl || branding.headerImageUrl;
  const showBanner = ackSub?.showBanner !== false && Boolean(bannerUrl);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border-border/80 shadow-2xl rounded-2xl bg-card">
        <div className="p-6 md:p-8 space-y-5 bg-card">
          {/* Dual Receipt Selector (if settlement generated 2 receipts) */}
          {secondaryData && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-purple-600 shrink-0" />
                Settlement Receipts (2 Generated):
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab('primary')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'primary'
                      ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-500'
                      : 'bg-background hover:bg-muted text-foreground border'
                  }`}
                >
                  🧾 Receipt 1: Collection (QR {data.totalCollected.toLocaleString()})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('secondary')}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'secondary'
                      ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-500'
                      : 'bg-background hover:bg-muted text-foreground border'
                  }`}
                >
                  💳 Receipt 2: Refund (QR {secondaryData.totalCollected.toLocaleString()})
                </button>
              </div>
            </div>
          )}

          {/* ── Organization Branding Banner (if configured) ── */}
          {showBanner && bannerUrl && (
            <div className="w-full rounded-lg overflow-hidden border border-border/60 shadow-sm max-h-28">
              <img
                src={bannerUrl}
                alt="Organization Branding Banner"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* ── Header as per Organization Branding ── */}
          <div className="border-b pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-bold tracking-tight text-primary">
                  {branding.companyName || "Al Ameen Real Estate"}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {branding.legalEntityName || "Al Ameen Real Estate W.L.L"} • CR: {branding.crNumber || "CR-90821-QA"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {branding.address || "Grand Hamad Avenue, Building 42, Floor 7, Doha, State of Qatar"}
              </p>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="text-xs font-mono px-3 py-1 bg-primary/10 border-primary text-primary font-bold">
                {activeTab === 'secondary' && secondaryData
                  ? 'PAYMENT / REFUND VOUCHER'
                  : (ackSub?.documentTitle || 'OFFICIAL PAYMENT RECEIPT')}
              </Badge>
              <p className="text-xs font-mono mt-1 text-muted-foreground">No: <strong className="text-foreground">{currentData.receiptNo}</strong></p>
              <p className="text-xs text-muted-foreground">Date: {formatDateDDMMYYYY(currentData.date)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-primary font-semibold">
                <User className="h-3.5 w-3.5" />
                <span>Tenant Particulars</span>
              </div>
              <p className="text-sm font-bold text-foreground">{currentData.tenantName}</p>
              {currentData.tenantQid && <p className="text-muted-foreground">QID / CR No: <span className="font-mono text-foreground">{currentData.tenantQid}</span></p>}
              {currentData.tenantPhone && <p className="text-muted-foreground">Phone: <span className="text-foreground">{currentData.tenantPhone}</span></p>}
              {currentData.tenantEmail && <p className="text-muted-foreground">Email: <span className="text-foreground">{currentData.tenantEmail}</span></p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-primary font-semibold">
                <Building className="h-3.5 w-3.5" />
                <span>Lease &amp; Premise Details</span>
              </div>
              <p className="font-semibold text-foreground">{currentData.propertyName}</p>
              <p className="text-muted-foreground">Unit / Flat: <strong className="text-primary font-mono">{currentData.unitRef}</strong></p>
              <p className="text-muted-foreground">Lease Period: <span className="font-medium text-foreground">{formatDateDDMMYYYY(currentData.leaseStartDate)}</span> to <span className="font-medium text-foreground">{formatDateDDMMYYYY(currentData.leaseEndDate)}</span></p>
              <p className="text-muted-foreground">Monthly Rent: <strong className="text-foreground">QR {currentData.monthlyRent?.toLocaleString()}</strong></p>
            </div>
          </div>

          {/* Security Deposit (Type 1 & Type 2) Payment Breakdown */}
          {(() => {
            const explicitDetails = (currentData.securityDepositDetails || []).filter((d) => d.amount > 0);
            const type1Items = explicitDetails.filter((d) => d.category === 'Type 1');
            const type2Items: SecurityDepositDetailItem[] = explicitDetails.filter((d) => d.category === 'Type 2');

            // Backwards-compatible fallback for Type 2 if caller only set numeric fields
            if (explicitDetails.length === 0) {
              if (currentData.utilityDeposit && currentData.utilityDeposit > 0) {
                type2Items.push({ category: 'Type 2', label: 'Kahramaa Utility Deposit', mode: 'Cash', amount: currentData.utilityDeposit });
              }
              if (currentData.qatarCoolDeposit && currentData.qatarCoolDeposit > 0) {
                type2Items.push({ category: 'Type 2', label: 'Qatar Cool Deposit', mode: 'Cash', amount: currentData.qatarCoolDeposit });
              }
              if (currentData.reservationDeposit && currentData.reservationDeposit > 0) {
                type2Items.push({ category: 'Type 2', label: 'Reservation Advance Deposit', mode: 'Cash', amount: currentData.reservationDeposit });
              }
              if (currentData.serviceFeeDeposit && currentData.serviceFeeDeposit > 0) {
                type2Items.push({ category: 'Type 2', label: 'Service Fee / Key Deposit', mode: 'Cash', amount: currentData.serviceFeeDeposit });
              }
              if (currentData.guaranteeChequeDeposit && currentData.guaranteeChequeDeposit > 0) {
                type2Items.push({ category: 'Type 2', label: 'Guarantee Cheque Security', mode: 'Guarantee Cheque', amount: currentData.guaranteeChequeDeposit });
              }
            }

            const formatPaymentDetail = (item: SecurityDepositDetailItem) => {
              const parts: string[] = [];
              if (item.bankAccount) parts.push(`Bank: ${item.bankAccount}`);
              if (item.referenceNo) parts.push(`Ref / Cheque: ${item.referenceNo}`);
              if (item.date) parts.push(`Date: ${item.date}`);
              return parts.length > 0 ? parts.join(' • ') : '—';
            };

            const type1Total = type1Items.length > 0
              ? type1Items.reduce((s, d) => s + d.amount, 0)
              : currentData.depositAmount || 0;
            const type2Total = type2Items.reduce((s, d) => s + d.amount, 0);

            if (type1Total <= 0 && type2Total <= 0) return null;

            return (
              <div className="space-y-3">
                {/* Type 1: Unit Security Deposit */}
                {type1Total > 0 && (
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <div className="p-3 bg-muted/20 border-b flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold">
                            {activeTab === 'secondary'
                              ? 'Security Deposit Refund Amount'
                              : 'Security Deposit — Type 1 (Unit Security Deposit)'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Channel: <strong>{currentData.depositMode}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-600 font-mono">
                          QR {type1Total.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {type1Items.length > 0 && (
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                          <tr>
                            <th className="py-1.5 px-3 text-left">Payment Method</th>
                            <th className="py-1.5 px-3 text-left">Payment Details (Bank / Ref / Cheque / Date)</th>
                            <th className="py-1.5 px-3 text-right">Amount (QAR)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {type1Items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="py-1.5 px-3 font-medium">
                                <Badge variant="outline" className="text-[11px] font-medium">
                                  {item.mode}
                                </Badge>
                              </td>
                              <td className="py-1.5 px-3 text-muted-foreground">
                                {formatPaymentDetail(item)}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-semibold text-foreground">
                                QR {item.amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* Type 2: Ancillary Refundable Deposits & Guarantees */}
                {type2Items.length > 0 && (
                  <div className="border border-emerald-500/30 rounded-lg overflow-hidden bg-card">
                    <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border-b border-emerald-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold">
                            Security Deposit — Type 2 (Ancillary Refundable Deposits &amp; Guarantees)
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {type2Items.length} item{type2Items.length > 1 ? 's' : ''} collected
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-emerald-600 font-mono">
                          QR {type2Total.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 text-muted-foreground font-semibold border-b">
                        <tr>
                          <th className="py-1.5 px-3 text-left">Deposit Type</th>
                          <th className="py-1.5 px-3 text-left">Payment Method</th>
                          <th className="py-1.5 px-3 text-left">Payment Details (Bank / Ref / Cheque / Date)</th>
                          <th className="py-1.5 px-3 text-right">Amount (QAR)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {type2Items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="py-1.5 px-3 font-medium text-foreground">{item.label}</td>
                            <td className="py-1.5 px-3">
                              <Badge variant="outline" className="text-[11px] font-medium">
                                {item.mode}
                              </Badge>
                            </td>
                            <td className="py-1.5 px-3 text-muted-foreground">
                              {formatPaymentDetail(item)}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono font-semibold text-foreground">
                              QR {item.amount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {/* PDC Breakdown Schedule Table (Tenant facing details only) */}
          {currentData.pdcs && currentData.pdcs.length > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Post-Dated Cheques (PDC) Schedule ({currentData.pdcs.length} Cheques)</h4>
                </div>
                <span className="text-xs text-muted-foreground">Total PDCs: <strong>QR {currentData.pdcs.reduce((s, p) => s + p.amount, 0).toLocaleString()}</strong></span>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
                    <tr>
                      <th className="py-2 px-3 text-left">#</th>
                      <th className="py-2 px-3 text-left">Cheque No.</th>
                      <th className="py-2 px-3 text-left">Bank</th>
                      <th className="py-2 px-3 text-left">Maturity Date</th>
                      <th className="py-2 px-3 text-left">Period</th>
                      <th className="py-2 px-3 text-right">Amount (QAR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {currentData.pdcs.map((pdc, idx) => {
                      let displayPeriod = pdc.period || `Cheque ${idx + 1}`;
                      if (pdc.tenureStart && pdc.tenureEnd) {
                        displayPeriod = `${formatDateDDMMYYYY(pdc.tenureStart)} to ${formatDateDDMMYYYY(pdc.tenureEnd)}`;
                      } else if (pdc.tenureStart) {
                        displayPeriod = `From ${formatDateDDMMYYYY(pdc.tenureStart)}`;
                      }
                      return (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="py-1.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-1.5 px-3 font-mono font-bold text-primary">{pdc.chequeNo}</td>
                          <td className="py-1.5 px-3">{pdc.bank}</td>
                          <td className="py-1.5 px-3 font-mono">{formatDateDDMMYYYY(pdc.date)}</td>
                          <td className="py-1.5 px-3 font-mono text-muted-foreground">{displayPeriod}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold">QR {pdc.amount.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Total & Words */}
          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between items-center bg-primary/5 p-3 rounded-lg border border-primary/20">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {activeTab === 'secondary' ? 'Total Security Deposit Refund Paid' : 'Total Acknowledged Collection'}
                </p>
                <p className="text-xs italic text-primary font-medium mt-0.5">{totalWords}</p>
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold text-primary font-mono">
                  QR {currentData.totalCollected.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures as per branding */}
          <div className="grid grid-cols-3 gap-8 pt-8 text-center text-xs text-muted-foreground border-t">
            <div>
              <div className="border-b pb-8 border-dashed"></div>
              <p className="mt-2 font-semibold text-foreground">Tenant's Signature</p>
              <p className="text-[10px]">Received original duplicate copy</p>
            </div>
            <div>
              <div className="border-b pb-8 border-dashed"></div>
              <p className="mt-2 font-semibold text-foreground">Cashier / Prepared By</p>
              <p className="text-[10px]">{currentData.cashierName || 'Finance Cashier'}</p>
            </div>
            <div>
              <div className="border-b pb-8 border-dashed"></div>
              <p className="mt-2 font-semibold text-foreground">Authorized Signatory</p>
              <p className="text-[10px]">{branding.companyName || 'Al Ameen Real Estate'}</p>
            </div>
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="bg-card p-4 rounded-b-xl border-t flex items-center justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>
            <Button onClick={handleDownloadPdf} className="gap-2">
              <Download className="h-4 w-4" /> Download PDF Receipt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
