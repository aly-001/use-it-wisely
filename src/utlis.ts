
const COMBINED_TAX_BRACKETS = [
    { bracketUpTo: 15000,  rate: 0.15 },
    { bracketUpTo: 50000,  rate: 0.25 },
    { bracketUpTo: 100000, rate: 0.35 },
    { bracketUpTo: Infinity, rate: 0.45 },
  ];
  
  // OAS clawback parameters
  const OAS_CLAWBACK = {
    THRESHOLD: 90997,
    RATE: 0.15,
  };
/**
 * Calculate progressive tax on given income using defined tax bracets.
 * 
 * ALGORITHM:
 * 1. Return 0 if income is non-positive
 * 2. For each tax bracket:
 *    - Calculate portion of income taxable in this bracket
 *    - Apply bracket's tax rate
 *    - Track remaining income
 *    - Stop if no income remains
 * 3. Return total tax calculated
 */
function calculateTax(taxableIncome: number): number {
    if (taxableIncome <= 0) return 0;
  
    let remaining = taxableIncome;
    let totalTax = 0;
    let prevBracketEnd = 0;
  
    for (const bracket of COMBINED_TAX_BRACKETS) {
      const bracketSize = bracket.bracketUpTo - prevBracketEnd;
      const amountAtThisRate = Math.min(remaining, bracketSize);
      totalTax += amountAtThisRate * bracket.rate;
  
      remaining -= amountAtThisRate;
      prevBracketEnd = bracket.bracketUpTo;
      if (remaining <= 0) break;
    }
  
    return totalTax;
  }
  
  /**
   * Calculate OAS (Old Age Security) clawback based on net income.
   * 
   * ALGORITHM:
   * 1. If income below threshold, return full OAS amount
   * 2. Calculate excess income above threshold
   * 3. Calculate clawback at defined rate (15%)
   * 4. Limit clawback to maximum of full OAS amount
   * 5. Return both clawback amount and remaining OAS
   */
  function calculateOASClawback(netIncome: number, oasAmount: number): {
    clawback: number;
    oasAfterClawback: number;
  } {
    if (netIncome <= OAS_CLAWBACK.THRESHOLD) {
      return { clawback: 0, oasAfterClawback: oasAmount };
    }
    const over = netIncome - OAS_CLAWBACK.THRESHOLD;
    const clawback = Math.min(oasAmount, over * OAS_CLAWBACK.RATE);
    return {
      clawback,
      oasAfterClawback: oasAmount - clawback,
    };
  }
  
  /**
   * Calculate required withdrawals from multiple account types to cover expenses.
   * 
   * ALGORITHM:
   * 1. Binary search over total withdrawal needed
   * 2. For each guess amount:
   *    a. Withdraw in priority order: Non-registered -> TFSA -> RRSP -> RRIF
   *    b. Calculate tax implications:
   *       - Capital gains tax on non-registered withdrawals
   *       - Income tax on salary + RRSP/RRIF withdrawals
   *       - No tax on TFSA
   *    c. Compare total income vs (expenses + tax)
   * 3. Return optimal withdrawal amounts from each account
   */
  function findRequiredTotalWithdrawalThreeWay(
    salary: number,
    nonRegBalance: number,
    nonRegCostBasis: number,
    tfsaBalance: number,
    rrspBalance: number,
    rrifBalance: number,
    expenses: number,
    age: number
  ): {
    totalWithdrawal: number;
    fromNonReg: number;
    fromTFSA: number;
    fromRRSP: number;
    fromRRIF: number;
  } {
    const EPSILON = 1;
    let low = 0;
    let high = nonRegBalance + tfsaBalance + rrspBalance + rrifBalance;  
    let bestGuess = 0;
    let bestFromNonReg = 0;
    let bestFromTFSA = 0;
    let bestFromRRSP = 0;
    let bestFromRRIF = 0;
    let bestFromLIF = 0;
  
    // Remove forced withdrawals logic and treat as regular pension income
    const adjustedExpenses = expenses;
  
    while (high - low > 1e-7) {
      const mid = (low + high) / 2;
  
      // Withdraw in order: Non-reg -> TFSA -> RRSP
      let needed = mid;
      const fromNonReg = Math.min(needed, nonRegBalance);
      needed -= fromNonReg;
  
      const fromTFSA = Math.min(needed, tfsaBalance);
      needed -= fromTFSA;
  
      const fromRRSP = needed;  // whatever is left
  
      // Calculate capital gains from the non-registered portion
      let cgTaxable = 0;
      if (fromNonReg > 0) {
        const proportion = fromNonReg / nonRegBalance;
        const costBasisUsed = nonRegCostBasis * proportion;
        const realizedGain = fromNonReg - costBasisUsed;
        cgTaxable = realizedGain > 0 ? realizedGain * 0.5 : 0;
      }
  
      // Ordinary income = salary + fromRRSP
      // TFSA not added to income, no capital gains from TFSA
      const cgTax = calculateTax(cgTaxable);
      const ordinaryTax = calculateTax(salary + fromRRSP);
      const totalTax = cgTax + ordinaryTax;
  
      const credits = salary + mid;
      const debits = adjustedExpenses + totalTax;
      const difference = credits - debits;
  
      if (Math.abs(difference) <= EPSILON) {
        bestGuess = mid;
        bestFromNonReg = fromNonReg;
        bestFromTFSA = fromTFSA;
        bestFromRRSP = fromRRSP;
        bestFromRRIF = 0;
       break;
      }
      if (difference < 0) {
        // we need more
        low = mid;
      } else {
        // we used too much
        high = mid;
      }
      bestGuess = mid;
      bestFromNonReg = fromNonReg;
      bestFromTFSA = fromTFSA;
      bestFromRRSP = fromRRSP;
      bestFromRRIF = 0;
    }
  
    return {
      totalWithdrawal: bestGuess,
      fromNonReg: bestFromNonReg,
      fromTFSA: bestFromTFSA,
      fromRRSP: bestFromRRSP,
      fromRRIF: bestFromRRIF,
    };
  }
  

  export { calculateTax, calculateOASClawback, findRequiredTotalWithdrawalThreeWay };