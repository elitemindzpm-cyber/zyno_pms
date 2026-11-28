// server/lib/qatar-wps.ts
// Server-authoritative WPS (Qatar Central Bank / MADLSA) validation and SIF/CSV generation.
// Unlike the old browser version, this NEVER invents a QID or IBAN: a missing or malformed value is a
// validation error and the file is not produced, so a bank is never sent made-up identifiers.

export interface WpsEmployerConfig { employerCr: string; payerBankSwift: string; payerIban: string; companyName: string }
export interface WpsEmployeeRecord {
  employeeIdCode: string; employeeQid: string; visaId?: string; employeeName: string;
  employeeBankSwift: string; employeeIban: string; workingDays: number; netSalary: number; basicSalary: number;
  extraHours?: number; extraHoursPay?: number; deductions?: number;
  paymentType?: 'SALARY' | 'LEAVE_SETTLEMENT' | 'BONUS' | 'EOSB'; notes?: string;
}
export interface WpsValidationIssue { employeeCode: string; employeeName: string; field: string; severity: 'error' | 'warning'; message: string }
export interface WpsValidationResult {
  isValid: boolean; totalEmployees: number; totalNetSalary: number; errorsCount: number; warningsCount: number; issues: WpsValidationIssue[];
}

const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const alnumUpper = (v: unknown) => String(v ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const r2 = (v: number) => Math.round(v * 100) / 100;

export function validateWpsPayroll(config: WpsEmployerConfig, records: WpsEmployeeRecord[]): WpsValidationResult {
  const issues: WpsValidationIssue[] = [];
  const cr = digits(config.employerCr);
  if (cr.length < 5) {
    issues.push({ employeeCode: 'EMPLOYER', employeeName: config.companyName, field: 'employerCr', severity: 'error', message: 'Employer CR number is invalid or missing (must contain at least 5 digits)' });
  }
  const payerIban = alnumUpper(config.payerIban);
  if (!payerIban.startsWith('QA') || payerIban.length !== 29) {
    issues.push({ employeeCode: 'EMPLOYER', employeeName: config.companyName, field: 'payerIban', severity: 'error', message: `Payer Corporate IBAN must be 29 characters starting with 'QA' (currently ${payerIban.length})` });
  }
  let total = 0;
  for (const rec of records) {
    total += n(rec.netSalary);
    const qid = digits(rec.employeeQid);
    if (qid.length !== 11) {
      issues.push(rec.visaId
        ? { employeeCode: rec.employeeIdCode, employeeName: rec.employeeName, field: 'employeeQid', severity: 'warning', message: `Using Visa ID (${rec.visaId}) in lieu of QID. Valid for newly entered personnel only.` }
        : { employeeCode: rec.employeeIdCode, employeeName: rec.employeeName, field: 'employeeQid', severity: 'error', message: `Qatar ID (QID) must be exactly 11 digits (found ${qid.length}). MoL will reject this file.` });
    }
    const iban = alnumUpper(rec.employeeIban);
    if (!iban.startsWith('QA') || iban.length !== 29) {
      issues.push({ employeeCode: rec.employeeIdCode, employeeName: rec.employeeName, field: 'employeeIban', severity: 'error', message: `Employee IBAN is invalid: must start with 'QA' and be 29 chars (found ${iban.length}). Bank will fail transfer.` });
    }
    if (n(rec.netSalary) <= 0) {
      issues.push({ employeeCode: rec.employeeIdCode, employeeName: rec.employeeName, field: 'netSalary', severity: 'error', message: `Net salary is zero or negative (QAR ${rec.netSalary}). WPS does not permit zero salary lines.` });
    }
    if (n(rec.basicSalary) <= 0) {
      issues.push({ employeeCode: rec.employeeIdCode, employeeName: rec.employeeName, field: 'basicSalary', severity: 'warning', message: 'Basic salary is 0. Under Qatar Law No. 14/2004, basic salary must be explicitly stated.' });
    }
  }
  const errorsCount = issues.filter((i) => i.severity === 'error').length;
  return { isValid: errorsCount === 0, totalEmployees: records.length, totalNetSalary: r2(total), errorsCount, warningsCount: issues.length - errorsCount, issues };
}

export function generateQatarWpsSif(config: WpsEmployerConfig, month: string, records: WpsEmployeeRecord[]) {
  const now = new Date();
  const creationDate = now.toISOString().slice(0, 10);
  const creationTime = now.toISOString().slice(11, 16);
  const cr = digits(config.employerCr);
  const totalNet = records.reduce((s, r) => s + n(r.netSalary), 0);
  const header = ['HDR', cr, (config.payerBankSwift || '').trim().toUpperCase(), alnumUpper(config.payerIban), creationDate, creationTime, month, totalNet.toFixed(2), records.length, 'QAR'].join(',');
  const lines = records.map((rec) => [
    'EDR', digits(rec.employeeQid), rec.visaId || '', String(rec.employeeName || `Employee ${rec.employeeIdCode}`).replace(/[,;]/g, ' ').trim(),
    String(rec.employeeBankSwift || '').trim().toUpperCase(), alnumUpper(rec.employeeIban), 'M', rec.workingDays || 30,
    n(rec.netSalary).toFixed(2), n(rec.basicSalary).toFixed(2), n(rec.extraHours).toFixed(1), n(rec.extraHoursPay).toFixed(2),
    n(rec.deductions).toFixed(2), rec.paymentType || 'SALARY', String(rec.notes || `SALARY ${month}`).replace(/[,;]/g, ' '),
  ].join(','));
  return {
    sifContent: [header, ...lines].join('\r\n'),
    fileName: `WPS_${cr}_${month.replace(/[^0-9]/g, '')}_${creationDate.replace(/-/g, '')}.sif`,
    totalNet: r2(totalNet), totalCount: records.length,
  };
}

export function generateQatarWpsCsv(config: WpsEmployerConfig, month: string, records: WpsEmployeeRecord[]) {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const headers = ['Record Type', 'Employee QID', 'Visa ID', 'Employee Full Name', 'Bank SWIFT Code', 'Employee IBAN', 'Salary Frequency', 'Working Days', 'Net Salary (QAR)', 'Basic Salary (QAR)', 'Overtime Hours', 'Overtime Amount (QAR)', 'Total Deductions (QAR)', 'Payment Purpose', 'Employer CR', 'Salary Month'];
  const rows = records.map((rec) => ['EDR', q(digits(rec.employeeQid)), q(rec.visaId), q(rec.employeeName), rec.employeeBankSwift || '', q(alnumUpper(rec.employeeIban)), 'M', rec.workingDays || 30,
    n(rec.netSalary).toFixed(2), n(rec.basicSalary).toFixed(2), n(rec.extraHours).toFixed(1), n(rec.extraHoursPay).toFixed(2), n(rec.deductions).toFixed(2), rec.paymentType || 'SALARY', q(config.employerCr), month].join(','));
  return { csvContent: [headers.join(','), ...rows].join('\r\n'), fileName: `WPS_Bank_Payroll_${digits(config.employerCr)}_${month}.csv` };
}
