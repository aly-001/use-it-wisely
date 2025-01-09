// Define province type
export type Province = 'QC' | 'ON' | 'BC' | 'AB'; // Add more as needed

export interface OneOffExpense {
  year: number;        // Relative year (1, 2, 3...)
  amount: number;
  description?: string;
}

export interface YearData {
  year: number;        // Relative year (1, 2, 3...)
  calendarYear: number; // Actual year (2024, 2025...)
  age: number;

  // Income
  salary: number;

  // Non-registered
  amountInvested: number;
  investmentCostBasis: number;
  investmentIncome: number;  // e.g. dividends or interest taxed each year

  // RRSP
  amountInRRSP: number;
  rrspCostBasis: number;
  rrspWithdrawal: number;

  // RRIF
  amountInRRIF: number;
  rrifWithdrawal: number;

  // TFSA
  amountInTFSA: number;      // new field
  tfsaWithdrawal: number;    // new field (for clarity), though not strictly required

  // Basic expenses
  expenses: number;
  healthcareExpenses: number;
  stageOneExpenses: number;  // Ages current to 75
  stageOneHealthcare: number;
  stageTwoExpenses: number;  // Ages 76 to 85
  stageTwoHealthcare: number;
  stageThreeExpenses: number; // Ages 86+
  stageThreeHealthcare: number;
  useStages: boolean;        // Whether to use staged expenses
  oneOffExpenses: OneOffExpense[];  // One-off expenses for this year

  // OAS
  oasIncome: number;
  oasClawback: number;
  oasAfterClawback: number;

  // Accounting
  credits: number;
  debits: number;
  taxPaid: number;

  // LIRA
  amountInLIRA: number;
  // LIF
  amountInLIF: number;

  // Home Sale
  homeSaleProceeds: number;  // Amount received from home sale in this year
}

export type Projection = YearData[];
