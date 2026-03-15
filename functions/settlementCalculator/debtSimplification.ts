/**
 * Pure debt simplification algorithm — no AWS dependencies.
 * Fully unit-testable in isolation.
 *
 * Problem: Given a set of signed net balances that sum to zero, find the
 * minimum number of payments that settle all debts.
 *
 * Algorithm: Two-pointer greedy on sorted arrays.
 *   - Sort creditors (positive balance) descending.
 *   - Sort debtors (negative balance) ascending (most negative first).
 *   - Repeatedly match the largest creditor with the largest debtor.
 *   - Settle as much as possible in each step.
 *
 * Time:  O(n log n) — dominated by the sort.
 * Space: O(n)
 *
 * All amounts are integers (cents). Never use floating-point arithmetic here.
 */

export interface MemberBalance {
  userId: string;
  netBalance: number; // positive = creditor (owed money), negative = debtor (owes money)
}

export interface SettlementInstruction {
  fromUserId: string; // the debtor paying
  toUserId: string; // the creditor receiving
  amount: number; // always positive (cents)
}

export function simplifyDebts(balances: MemberBalance[]): SettlementInstruction[] {
  const results: SettlementInstruction[] = [];

  // Mutable copies — filter out zero-balance members
  const creditors = balances
    .filter((b) => b.netBalance > 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.netBalance - a.netBalance); // descending

  const debtors = balances
    .filter((b) => b.netBalance < 0)
    .map((b) => ({ ...b }))
    .sort((a, b) => a.netBalance - b.netBalance); // ascending (most negative first)

  let ci = 0; // creditor pointer
  let di = 0; // debtor pointer

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci];
    const debtor = debtors[di];

    const amount = Math.min(creditor.netBalance, Math.abs(debtor.netBalance));

    results.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amount,
    });

    creditor.netBalance -= amount;
    debtor.netBalance += amount; // moves toward zero

    if (creditor.netBalance === 0) ci++;
    if (debtor.netBalance === 0) di++;
  }

  return results;
}

/**
 * Compute net balance per member from a flat list of splits.
 *
 * Net balance = total paid by user - total owed by user across all transactions.
 *
 * @param splits      All unsettled splits in the group
 * @param paidByMap   Map of txnId → { paidBy: userId, amount: number }
 */
export function computeNetBalances(
  splits: Array<{ txnId: string; userId: string; owedAmount: number }>,
  paidByMap: Map<string, { paidBy: string; amount: number }>
): MemberBalance[] {
  const balances = new Map<string, number>();

  for (const split of splits) {
    const txn = paidByMap.get(split.txnId);
    if (!txn) continue;

    // The payer effectively "credits" themselves the full amount
    // Each member "debits" themselves their share
    const payerBalance = balances.get(txn.paidBy) ?? 0;
    balances.set(txn.paidBy, payerBalance + split.owedAmount);

    const memberBalance = balances.get(split.userId) ?? 0;
    balances.set(split.userId, memberBalance - split.owedAmount);
  }

  return Array.from(balances.entries()).map(([userId, netBalance]) => ({
    userId,
    netBalance,
  }));
}
