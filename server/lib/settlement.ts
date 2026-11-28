// server/lib/settlement.ts
// Pure security-deposit settlement and late-fee calculation helpers (E5).
import { money } from './money';

export function computeDepositSettlement(deposit: number, damageCharges: number, earlyPenalty: number) {
  const dep = money(deposit);
  const damage = money(damageCharges);
  const penalty = money(earlyPenalty);
  const deductions = money(damage + penalty);
  const applied = money(Math.min(dep, deductions));
  const excess = money(deductions - applied);
  const refund = money(dep - applied);
  return {
    deposit: dep,
    damage_charges: damage,
    early_termination_penalty: penalty,
    deductions,
    applied_from_deposit: applied,
    billed_to_tenant: excess,
    refund,
  };
}
