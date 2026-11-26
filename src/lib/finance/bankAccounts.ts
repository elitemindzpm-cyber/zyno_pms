import { db } from '../db';
import { request } from '../api-client';

export interface CompanyBankAccount {
  id: string;
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  glCode: string;
  glName: string;
  currency: string;
  branch?: string;
  swiftCode?: string;
  isDefault?: boolean;
  status?: string;
}

export const DEFAULT_COMPANY_BANK_ACCOUNTS: CompanyBankAccount[] = [];

const BANK_ACCOUNTS_STORAGE_KEY = "zyno-company-bank-accounts-v2";
const PMS_FIN_STORAGE_KEY = "pms_fin_bank_accounts_override_v2";

/**
 * Save a bank account to the database. New accounts get the next GL code from the server,
 * then the list is reloaded from the database.
 */
export async function saveCompanyBankAccount(acc: CompanyBankAccount): Promise<CompanyBankAccount[]> {
  const existingInDb = await (db as any).from('fin_bank_accounts').select('id').eq('account_number', acc.accountNumber).maybeSingle();
  if (!existingInDb?.data) {
    const { data: bankRow } = await (db as any).from('fin_banks').select('id, name').eq('name', acc.bankName).maybeSingle();
    if (!bankRow) throw new Error(`Bank "${acc.bankName}" is not in the bank master. Add it first.`);
    await request('/api/accounting/bank-accounts', {
      method: 'POST',
      body: JSON.stringify({
        bank_id: Number(bankRow.id),
        account_number: acc.accountNumber,
        account_title: acc.accountTitle,
        currency: 'QAR',
      }),
    });
  }
  return fetchCompanyBankAccounts();
}

/**
 * Fetch company bank accounts from fin_bank_accounts merged with stored/default accounts.
 * Always returns active accounts for transactions like PDC bank deposit or bank transfer.
 */
export async function fetchCompanyBankAccounts(): Promise<CompanyBankAccount[]> {

  try {
    const { data, error } = await (db as any)
      .from('fin_bank_accounts')
      .select('*, fin_banks(name, code, swift_code)')
      .limit(50);

    if (error || !data || data.length === 0) {
      return [];
    }

    // Filter to strictly ACTIVE bank accounts only (exclude deactivated accounts)
    const activeData = data.filter((item: any) => item.status !== 'Inactive' && item.status !== 'inactive');

    if (activeData.length === 0) {
      return [];
    }

    const dbMapped: CompanyBankAccount[] = activeData.map((item: any, idx: number) => {
      const bName = item.fin_banks?.name || item.bank_name || (idx === 0 ? 'Commercial Bank of Qatar (CBQ)' : 'Dukhan Bank');
      const rawTitle = (item.account_title || item.name || bName).replace(/\bAccont\b/gi, 'Account');
      const accNum = String(item.account_number || '');

      // The GL code is assigned by the server (12000001, 12000002, ...) and stored on the account.
      const glCode = String(item.gl_code || '');
      const glName = `${bName} - ${rawTitle}`;

      return {
        id: String(item.id || `bank-acc-${idx}`),
        bankName: bName,
        accountTitle: rawTitle,
        accountNumber: accNum,
        iban: item.iban || accNum,
        glCode,
        glName,
        currency: item.currency || 'QAR',
        branch: item.branch,
        swiftCode: item.fin_banks?.swift_code,
        isDefault: idx === 0,
        status: item.status || 'Active',
      };
    });

    // When active DB bank accounts are returned, strictly return DB accounts only
    return dbMapped.filter(a => a.status !== 'Inactive' && a.status !== 'inactive');
  } catch {
    return [];
  }
}
