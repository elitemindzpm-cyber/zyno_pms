# Chart of Accounts Review: ZYNO PMS (Qatar)

Date: 24 November 2026
Scope: GL accounts used by the code for depreciation, asset disposal, payroll and loan recovery, PDCs, security deposits, bounce charges, accounts payable, and tenant receivables.
Basis: IFRS as adopted in Qatar (IAS 16, IAS 19, IAS 37, IFRS 9, IFRS 15) and Qatar Labour Law (Law No. 14 of 2004) for end-of-service benefits.

> **Status: NOT SIGNED OFF.** This review was prepared by the development team, which is not a licensed accountant. Only a Qatar-registered accountant can approve the chart and the posting rules. The sign-off block at the end is for that person.

## 1. Findings

| # | Area | Current mapping (code) | Finding | Severity | Recommendation |
|---|---|---|---|---|---|
| 1 | Depreciation | Dr 51106 Depreciation & Amortisation / Cr 11000 "PPE Land Cost" | Accumulated depreciation is credited to a land cost account. Land is not depreciated under IAS 16, so this misstates both land and depreciation. | High | Create a contra-asset "Accumulated depreciation – PPE" and per-class accounts. Keep 11000 for land only. |
| 2 | Asset cost | Asset cost is also 11000 | Cost of depreciable assets is held in the land account. | High | Create cost accounts by asset class (buildings, equipment, vehicles, furniture). |
| 3 | Disposal gain/loss | 41301 "Gain/Loss of Sale of Fixed Assets" is typed REVENUE | A loss is an expense, and a single account typed as revenue misstates a loss. | Medium | Split into 41301 (gain, revenue) and an expense account for losses. |
| 4 | Payroll loan recovery | Cr 12412 "Staff Current Account" | Loan instalments are credited to a general staff current account, with no separate loan receivable, so loan balances cannot be reported. | Medium | Create "Staff loans receivable" (current asset) and post loan recovery to it. |
| 5 | Salary payable | Cr 21900 "Salary Payable" | Acceptable. Net pay is credited on the payroll run and cleared on WPS payment. | Low | Confirm the WPS payment clears 21900 through the bank. |
| 6 | End-of-service gratuity (EOSB) | Not in the chart. The only provision is 22001 "Provision for Leave Salary". | Qatar Labour Law requires the employer to provide for end-of-service benefits. The system does not accrue them. | High | Create "Provision for end-of-service benefits" (non-current liability) and an accrual on each payroll run. Confirm the actuarial basis. |
| 7 | PDCs: posting sequence | Deposited: Dr 12900 "PDC In Hand" / Cr 12413 Tenant receivables. Cleared: Dr 12000 Bank / Cr 12900. | This moves the receivable when the cheque is deposited, not when it is received. The live rule table (PDC_COLLECTION: Dr 12900 / Cr 21400; PDC_DEPOSIT_BANK: Dr 12000 / Cr 12900) follows a different sequence. Posting both would double-count. | High | Decide one sequence and make the code match it. The recommended sequence is: receipt Dr 12900 / Cr 12413; clearance Dr 12000 / Cr 12900; bounce reverses the receipt (Dr 12413 / Cr 12900) plus the penalty. |
| 8 | PDC: 21400 liability | Live rule PDC_COLLECTION credits 21400 "Customer PDC Liability" | A separate liability account is used in the live rules but not in the code. | Medium | Confirm whether 21400 is a deferred-income account for rent not yet due. |
| 9 | Security deposit | Received: Dr 12000 / Cr 21500. Refund: Dr 21500 / Cr 12000. Forfeiture: Dr 21500 / Cr 41201. | Consistent with the live rules. | Low | Accept. Confirm the policy for forfeited deposits. |
| 10 | Bounce charge | Dr 12413 (amount + charge) / Cr 12900 / Cr 41201 | Acceptable if the bank charge is recoverable from the tenant. | Low | Confirm the penalty income account. |
| 11 | Accounts payable | Dr 51004 Repairs & Maintenance / Cr 21000 AP | Acceptable as a default. The expense account comes from each invoice line. | Low | Confirm the default expense account. |
| 12 | Tenant receivables control | 12413 with unit sub-ledgers | Acceptable. The reconciliation report flags any posting made directly to the control account. | Low | Accept. |
| 13 | Indirect tax | No VAT is posted anywhere in the code. | Confirm the current position on indirect tax for rent and services in Qatar. | Medium | Obtain written confirmation from the tax adviser. |
| 14 | Financial periods | Closed periods are enforced. | Accept. Confirm the year-end close procedure. | Low | Accept. |

## 2. Decisions required before go-live

1. Approve the new accounts in items 1, 2, 4 and 6: accumulated depreciation, asset cost classes, staff loans receivable, EOSB provision.
2. Choose the PDC posting sequence (item 7). The code must change to match the decision.
3. Approve the split of 41301 into gain and loss accounts (item 3).
4. Confirm the indirect-tax position (item 13).

Until items 1, 2 and 7 are decided, depreciation, disposal, PDC postings and end-of-service accruals should not be used for financial reporting.

## 3. Sign-off

I have reviewed the chart-of-accounts mappings above and the posting rules they support.

- Name: ______________________________
- Qatar registration / membership number: ______________________________
- Signature: ______________________________
- Date: ______________________________
- Decisions in section 2 approved: [ ] Yes  [ ] No, changes listed below

Changes required:

_______________________________________________________________________

_______________________________________________________________________
