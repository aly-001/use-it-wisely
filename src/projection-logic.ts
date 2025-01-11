import { Projection, OneOffExpense } from "./data-types";
import { calculateTax, calculateOASClawback, findRequiredTotalWithdrawalThreeWay } from "./utlis";

export const ProjectionLogic = {
  createInitialProjection(
    startYear: number,
    currentAge: number,
    lifeExpectancy: number,
    yearlyIncomes: number[],
    baseAnnualExpenses: number,
    initialInvestment: number,
    initialBookValue: number,
    initialRRSP: number,
    oasStartYear: number,
    oasAnnualAmount: number,
    initialTFSA: number,
    initialRRIF: number,
    initialLIRA: number,
    initialLIF: number,
    homeSaleYear: number | null,
    homeSaleAmount: number,
    useStages: boolean,
    stageOneExpenses: number,
    stageOneHealthcare: number,
    stageTwoExpenses: number,
    stageTwoHealthcare: number,
    stageThreeExpenses: number,
    stageThreeHealthcare: number,
    oneOffExpenses: OneOffExpense[] = []
  ): Projection {
    const totalYears = lifeExpectancy - currentAge;
    const projection: Projection = [];

    for (let i = 1; i <= totalYears; i++) {
      const isHomeSaleYear = homeSaleYear === i;
      const personAge = currentAge + i - 1;
      
      // Calculate expenses based on age and stages
      let yearlyExpenses = baseAnnualExpenses;
      let yearlyHealthcare = 0;

      if (useStages) {
        if (personAge <= 75) {
          yearlyExpenses = stageOneExpenses;
          yearlyHealthcare = stageOneHealthcare;
        } else if (personAge <= 85) {
          yearlyExpenses = stageTwoExpenses;
          yearlyHealthcare = stageTwoHealthcare;
        } else {
          yearlyExpenses = stageThreeExpenses;
          yearlyHealthcare = stageThreeHealthcare;
        }
      }

      // Filter one-off expenses for this year
      const yearOneOffExpenses = oneOffExpenses.filter(expense => expense.year === i);
      
      projection.push({
        year: i,
        calendarYear: startYear + i - 1,
        age: personAge,
        
        salary: yearlyIncomes[i] || 0,

        // Non-registered
        amountInvested: i === 1 ? initialInvestment : 0,
        investmentCostBasis: i === 1 ? initialBookValue : 0,
        investmentIncome: 0,

        // RRSP
        amountInRRSP: i === 1 ? initialRRSP : 0,
        rrspCostBasis: i === 1 ? initialRRSP : 0,
        rrspWithdrawal: 0,

        // TFSA
        amountInTFSA: i === 1 ? initialTFSA : 0,
        tfsaWithdrawal: 0,

        // Basic expenses
        expenses: yearlyExpenses,
        healthcareExpenses: yearlyHealthcare,
        stageOneExpenses,
        stageOneHealthcare,
        stageTwoExpenses,
        stageTwoHealthcare,
        stageThreeExpenses,
        stageThreeHealthcare,
        useStages,
        oneOffExpenses: yearOneOffExpenses,

        // OAS
        oasIncome: i >= oasStartYear ? oasAnnualAmount : 0,
        oasClawback: 0,
        oasAfterClawback: 0,

        // Ledger
        credits: 0,
        debits: 0,
        taxPaid: 0,

        // RRIF
        amountInRRIF: i === 1 ? initialRRIF : 0,
        rrifWithdrawal: 0,

        // LIRA
        amountInLIRA: i === 1 ? initialLIRA : 0,

        // LIF
        amountInLIF: i === 1 ? initialLIF : 0,

        // Home Sale
        homeSaleProceeds: isHomeSaleYear ? homeSaleAmount : 0,

        // New fields for income tracking
        employmentIncome: yearlyIncomes[i] || 0,
        otherIncomes: [],  // This will be populated with the specific other incomes for this year
      });
    }
    return projection;
  },

  calculateNextYear(
    projection: Projection,
    yearIndex: number,
    incomeRate: number,
    growthRate: number
  ) {
    const RRSP_MAX = 30000;
    const TFSA_MAX = 30000;

    const thisYear = projection[yearIndex];
    const nextYear = (yearIndex + 1 < projection.length)
      ? projection[yearIndex + 1]
      : null;

    // Calculate total expenses for the year (regular + healthcare + one-off)
    const oneOffExpensesTotal = thisYear.oneOffExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalExpenses = thisYear.expenses + thisYear.healthcareExpenses + oneOffExpensesTotal;

    // Handle home sale proceeds at the start of calculations
    if (thisYear.homeSaleProceeds > 0) {
      let remainingProceeds = thisYear.homeSaleProceeds;

      // Top up RRSP first (if age <= 71)
      if (thisYear.age <= 71) {
        const roomInRRSP = RRSP_MAX - thisYear.amountInRRSP;
        const rrspContribution = Math.min(roomInRRSP, remainingProceeds);
        thisYear.amountInRRSP += rrspContribution;
        thisYear.rrspCostBasis += rrspContribution;
        remainingProceeds -= rrspContribution;
      }

      // Top up TFSA
      const roomInTFSA = TFSA_MAX - thisYear.amountInTFSA;
      const tfsaContribution = Math.min(roomInTFSA, remainingProceeds);
      thisYear.amountInTFSA += tfsaContribution;
      remainingProceeds -= tfsaContribution;

      // Put the rest in non-registered
      if (remainingProceeds > 0) {
        thisYear.amountInvested += remainingProceeds;
        thisYear.investmentCostBasis += remainingProceeds;
      }
    }

    // 1) Growth on each account
    // Apply growth rate to all accounts
    const nonRegGrowth = thisYear.amountInvested * growthRate;
    const rrspGrowth = thisYear.amountInRRSP * (incomeRate + growthRate); 
    const tfsaGrowth = thisYear.amountInTFSA * (incomeRate + growthRate);
    const rrifGrowth = thisYear.amountInRRIF * (incomeRate + growthRate);
    const liraGrowth = thisYear.amountInLIRA * (incomeRate + growthRate);
    const lifGrowth = thisYear.amountInLIF * (incomeRate + growthRate);

    // Increase principal by the growth (no immediate tax for TFSA or RRSP)
    thisYear.amountInvested += nonRegGrowth;
    thisYear.amountInRRSP += rrspGrowth;
    thisYear.amountInTFSA += tfsaGrowth;
    thisYear.amountInRRIF += rrifGrowth;
    thisYear.amountInLIRA += liraGrowth;
    thisYear.amountInLIF += lifGrowth;

    // 2) Income from non-registered investments
    const investmentIncome = thisYear.amountInvested * incomeRate;
    thisYear.investmentIncome = investmentIncome;

    // 2.1) LIRA and LIF payouts if age > 65
    if (thisYear.age > 65) {
      const liraPayout = thisYear.amountInLIRA * 0.08;
      const lifPayout = thisYear.amountInLIF * 0.06;
      thisYear.amountInLIRA -= liraPayout;
      thisYear.amountInLIF -= lifPayout;
      thisYear.salary += liraPayout + lifPayout; // Add LIRA and LIF payouts to taxable income
    }

    // 3) Calculate initial tax on (salary + investment income)
    const initialTaxableIncome = thisYear.salary + investmentIncome;
    const initialTax = calculateTax(initialTaxableIncome);
    const totalDebit = totalExpenses + initialTax;

    // 4) OAS Clawback
    // We'll do a simple approach: OAS is added after we see if we have a shortfall. 
    // But a more precise approach would unify it. 
    const { clawback, oasAfterClawback } = calculateOASClawback(
      initialTaxableIncome,  // netIncome before OAS
      thisYear.oasIncome
    );
    thisYear.oasClawback = clawback;
    thisYear.oasAfterClawback = oasAfterClawback;

    const availableCash = initialTaxableIncome + oasAfterClawback;
    const surplusOrDeficit = availableCash - totalDebit;

    if (surplusOrDeficit >= 0) {
      // Surplus scenario
      // Add the OAS to final credits 
      const finalCredits = initialTaxableIncome + oasAfterClawback;
      thisYear.credits = finalCredits; 
      thisYear.debits  = totalExpenses + initialTax; 
      thisYear.taxPaid = initialTax;

      const surplus = surplusOrDeficit + oasAfterClawback;

      if (nextYear) {
        // First calculate the post-growth amounts
        const rrspAfterGrowth = thisYear.amountInRRSP; // already includes growth
        const tfsaAfterGrowth = thisYear.amountInTFSA; // already includes growth

        // Only allow new RRSP contributions if under the limit AND age <= 71
        const toRRSP = (rrspAfterGrowth <= RRSP_MAX && thisYear.age <= 71) 
          ? Math.min(RRSP_MAX - rrspAfterGrowth, surplus) 
          : 0;
        
        let leftover = surplus - toRRSP;

        // Only allow new contributions if under the limit
        const toTFSA = tfsaAfterGrowth <= TFSA_MAX ? Math.min(TFSA_MAX - tfsaAfterGrowth, leftover) : 0;
        leftover -= toTFSA;

        const toNonReg = leftover;

        // Next year: carry forward the full amounts including growth
        nextYear.amountInRRSP = rrspAfterGrowth + toRRSP;
        nextYear.amountInTFSA = tfsaAfterGrowth + toTFSA;
        nextYear.amountInvested = thisYear.amountInvested + toNonReg;

        // Non-registered
        nextYear.amountInvested = thisYear.amountInvested + toNonReg;
        // Increase cost basis by new contributions to non-registered
        nextYear.investmentCostBasis = 
          thisYear.investmentCostBasis + toNonReg;
        
        // The rrspCostBasis typically only changes by contributions if you want to track it
        nextYear.rrspCostBasis = thisYear.rrspCostBasis + toRRSP;

        nextYear.amountInLIRA = thisYear.amountInLIRA;
        nextYear.amountInLIF = thisYear.amountInLIF;
      }
      thisYear.rrspWithdrawal = 0;
      thisYear.tfsaWithdrawal = 0;
    } else {
      // Deficit scenario
      // We need extra from the accounts: non-reg -> TFSA -> RRSP
      const needed = -surplusOrDeficit; // how much more we require
      // We'll do a single binary search to find how much total we must withdraw 
      // factoring in OAS. For simplicity, let's unify the approach:

      const { 
        totalWithdrawal,
        fromNonReg,
        fromTFSA,
        fromRRSP,
        fromRRIF,  // Add RRIF to withdrawal calculation
      } = findRequiredTotalWithdrawalThreeWay(
        thisYear.salary,
        thisYear.amountInvested,
        thisYear.investmentCostBasis,
        thisYear.amountInTFSA,
        thisYear.amountInRRSP,
        thisYear.amountInRRIF,  // Add RRIF balance
        totalExpenses,
        thisYear.age
      );

      // Now compute final tax with that actual withdrawal 
      // (capital gains on fromNonReg, ordinary on (salary + fromRRSP), none on TFSA).
      let cgTaxable = 0;
      if (fromNonReg > 0) {
        const proportion = fromNonReg / thisYear.amountInvested;
        const costBasisUsed = thisYear.investmentCostBasis * proportion;
        const realizedGain = fromNonReg - costBasisUsed;
        cgTaxable = realizedGain > 0 ? realizedGain * 0.5 : 0;
      }

      const ordinaryIncome = thisYear.salary + fromRRSP + fromRRIF; 
      const totalTax = calculateTax(cgTaxable) + calculateTax(ordinaryIncome);
      const finalDebits = totalExpenses + totalTax;
      // Credits = salary + totalWithdrawal + (optionally OAS)
      // Let's add OAS in as well:
      const finalCredits = (thisYear.salary + totalWithdrawal) + oasAfterClawback;

      thisYear.credits = finalCredits;
      thisYear.debits  = finalDebits;
      thisYear.taxPaid = totalTax;
      thisYear.rrspWithdrawal = fromRRSP;
      thisYear.tfsaWithdrawal = fromTFSA;
      thisYear.rrifWithdrawal = fromRRIF;  // Track RRIF withdrawal

      // Update next year if it exists
      if (nextYear) {
        // Non-registered leftover
        nextYear.amountInvested = thisYear.amountInvested - fromNonReg;

        // reduce cost basis proportionally
        if (fromNonReg > 0) {
          const proportion = fromNonReg / thisYear.amountInvested;
          const costBasisUsed = thisYear.investmentCostBasis * proportion;
          nextYear.investmentCostBasis = thisYear.investmentCostBasis - costBasisUsed;
        } else {
          nextYear.investmentCostBasis = thisYear.investmentCostBasis;
        }

        // TFSA leftover
        nextYear.amountInTFSA = thisYear.amountInTFSA - fromTFSA;

        // RRSP leftover
        nextYear.amountInRRSP = thisYear.amountInRRSP - fromRRSP;
        nextYear.rrspCostBasis = thisYear.rrspCostBasis; // unchanged or track if you prefer

        // RRIF leftover
        nextYear.amountInRRIF = thisYear.amountInRRIF - fromRRIF;

        nextYear.amountInLIRA = thisYear.amountInLIRA;
        nextYear.amountInLIF = thisYear.amountInLIF;
      }
    }
  },

  calculateProjection(
    projection: Projection,
    incomeRate: number,
    growthRate: number,
    lumpSumWithdrawal: number = 0
  ): Projection {
    // Handle lump sum withdrawal in first year if applicable
    if (projection.length > 0 && lumpSumWithdrawal > 0) {
        const yearOne = projection[0];
        
        // Determine how much can be withdrawn from non-registered
        const withdrawalAmount = Math.min(yearOne.amountInvested, lumpSumWithdrawal);
        
        // Calculate capital gains tax on withdrawal
        const proportion = withdrawalAmount / yearOne.amountInvested;
        const costBasisUsed = yearOne.investmentCostBasis * proportion;
        const realizedGain = withdrawalAmount - costBasisUsed;
        const cgTaxable = realizedGain > 0 ? realizedGain * 0.5 : 0;
        const taxOnWithdrawal = calculateTax(cgTaxable);
        
        // Update year one values
        yearOne.debits += withdrawalAmount + taxOnWithdrawal;
        yearOne.amountInvested -= withdrawalAmount;
        yearOne.investmentCostBasis -= costBasisUsed;
        yearOne.taxPaid += taxOnWithdrawal;
    }

    // Process each year
    for (let i = 0; i < projection.length - 1; i++) {
        this.calculateNextYear(projection, i, incomeRate, growthRate);
    }
    
    return projection;
  },

  formatMoney(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  },

  findOptimalWithdrawal(
    baseProjection: Projection,
    incomeRate: number,
    growthRate: number,
    targetEstate: number = 0
  ): { maxWithdrawal: number; finalBalance: number } {
    const initialYear = baseProjection[0];
    const totalAssets = initialYear.amountInvested + 
                       initialYear.amountInRRSP + 
                       initialYear.amountInTFSA;

    let low = 0;
    let high = totalAssets;
    let bestWithdrawal = 0;
    let bestFinalBalance = Infinity;
    const TOLERANCE = 1000;
    const MAX_ITERATIONS = 30;
    let iterations = 0;

    while (high - low > TOLERANCE && iterations < MAX_ITERATIONS) {
      iterations++;
      const mid = (low + high) / 2;

      const testProjection = JSON.parse(JSON.stringify(baseProjection));
      const finalProjection = this.calculateProjection(
        testProjection,
        incomeRate,
        growthRate,
        mid
      );

      // Check if we maintain positive balance until the last year
      let isValidProjection = true;
      for (let i = 0; i < finalProjection.length - 1; i++) {
        const year = finalProjection[i];
        const yearBalance = year.amountInvested + 
                           year.amountInRRSP + 
                           year.amountInTFSA;
        if (yearBalance <= TOLERANCE) {
          isValidProjection = false;
          break;
        }
      }

      const finalYear = finalProjection[finalProjection.length - 1];
      const finalBalance = finalYear.amountInvested + 
                          finalYear.amountInRRSP + 
                          finalYear.amountInTFSA;

      if (isValidProjection) {
        // Update best result if this is valid and closer to target estate
        if (bestWithdrawal === 0 || 
            Math.abs(finalBalance - targetEstate) < Math.abs(bestFinalBalance - targetEstate)) {
          bestWithdrawal = mid;
          bestFinalBalance = finalBalance;
        }
      }

      if (!isValidProjection || finalBalance < targetEstate) {
        // We need to withdraw less
        high = mid;
      } else {
        // We can try withdrawing more
        low = mid;
      }
    }

    return {
      maxWithdrawal: bestWithdrawal,
      finalBalance: bestFinalBalance
    };
  },
};