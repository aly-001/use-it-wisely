// ui-controller.ts

import { ProjectionLogic } from './projection-logic';
import { YearData, Projection, OneOffExpense } from './data-types';
import { Chart, ChartConfiguration } from 'chart.js/auto';

type RegisteredAccountType = 'RRSP' | 'TFSA' | 'RRIF' | 'LIRA' | 'LIF';

interface RegisteredAccount {
  type: RegisteredAccountType;
  amount: number;
}

export const UIController = {
  // === DOM Elements ===
  lastSalaryYearInput: document.querySelector<HTMLInputElement>('#lastSalaryYear')!,
  annualSalaryInput: document.querySelector<HTMLInputElement>('#annualSalary')!,
  annualExpensesInput: document.querySelector<HTMLInputElement>('#annualExpenses')!,
  annualHealthcareExpensesInput: document.querySelector<HTMLInputElement>('#annualHealthcareExpenses')!,
  
  // Add province selector
  provinceSelector: document.querySelector<HTMLSelectElement>('#province')!,
  
  // Staged expenses inputs
  useStagesCheckbox: document.querySelector<HTMLInputElement>('#useStages')!,
  stagesContainer: document.querySelector<HTMLDivElement>('#stagesContainer')!,
  stageOneExpensesInput: document.querySelector<HTMLInputElement>('#stageOneExpenses')!,
  stageOneHealthcareInput: document.querySelector<HTMLInputElement>('#stageOneHealthcare')!,
  stageTwoExpensesInput: document.querySelector<HTMLInputElement>('#stageTwoExpenses')!,
  stageTwoHealthcareInput: document.querySelector<HTMLInputElement>('#stageTwoHealthcare')!,
  stageThreeExpensesInput: document.querySelector<HTMLInputElement>('#stageThreeExpenses')!,
  stageThreeHealthcareInput: document.querySelector<HTMLInputElement>('#stageThreeHealthcare')!,

  initialInvestmentInput: document.querySelector<HTMLInputElement>('#initialInvestment')!,
  rateOfReturnInput: document.querySelector<HTMLInputElement>('#rateOfReturn')!,
  calculateBtn: document.querySelector<HTMLButtonElement>('#calculateBtn')!,
  
  projectionChartCanvas: document.querySelector<HTMLCanvasElement>('#projectionChart')!,
  projectionTableBody: document.querySelector<HTMLTableSectionElement>('#projectionTableBody')!,
  resultDiv: document.querySelector<HTMLDivElement>('#result')!,
  
  chart: null as Chart | null,

  oasStartYearInput: document.querySelector<HTMLInputElement>('#oasStartYear')!,
  oasAnnualAmountInput: document.querySelector<HTMLInputElement>('#oasAnnualAmount')!,

  inflationRateInput: document.querySelector<HTMLInputElement>('#inflationRate')!,

  currentAgeInput: document.querySelector<HTMLInputElement>('#currentAge')!,
  lifeExpectancyInput: document.querySelector<HTMLInputElement>('#lifeExpectancy')!,

  // New registered accounts elements
  addAccountBtn: document.querySelector<HTMLButtonElement>('#add-account-btn')!,
  registeredAccountsList: document.querySelector<HTMLDivElement>('#registered-accounts-list')!,
  
  // Track registered accounts
  registeredAccounts: [] as RegisteredAccount[],

  // Add new properties
  willSellHomeCheckbox: document.querySelector<HTMLInputElement>('#willSellHome')!,
  homeSaleDetailsDiv: document.querySelector<HTMLDivElement>('#homeSaleDetails')!,
  homeSaleYearInput: document.querySelector<HTMLInputElement>('#homeSaleYear')!,
  homeSaleAmountInput: document.querySelector<HTMLInputElement>('#homeSaleAmount')!,

  // Add new property
  startYearInput: document.querySelector<HTMLInputElement>('#startYear')!,

  // One-off expenses elements
  addExpenseBtn: document.querySelector<HTMLButtonElement>('#add-expense-btn')!,
  oneOffExpensesList: document.querySelector<HTMLDivElement>('#one-off-expenses-list')!,
  
  // Track one-off expenses
  oneOffExpenses: [] as OneOffExpense[],

  /**
   * Creates a new registered account UI element
   */
  createRegisteredAccountElement(account?: RegisteredAccount): HTMLDivElement {
    const accountItem = document.createElement('div');
    accountItem.className = 'registered-account-item';

    const select = document.createElement('select');
    const accountTypes: RegisteredAccountType[] = ['RRSP', 'TFSA', 'RRIF', 'LIRA', 'LIF'];
    accountTypes.forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      if (account && account.type === type) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = account ? account.amount.toString() : '0';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-account-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => {
      accountItem.remove();
      this.updateRegisteredAccounts();
    };

    accountItem.appendChild(select);
    accountItem.appendChild(input);
    accountItem.appendChild(removeBtn);

    // Update registered accounts when values change
    select.onchange = () => this.updateRegisteredAccounts();
    input.onchange = () => this.updateRegisteredAccounts();

    return accountItem;
  },

  /**
   * Updates the internal registered accounts array based on UI state
   */
  updateRegisteredAccounts() {
    this.registeredAccounts = [];
    const accountItems = this.registeredAccountsList.querySelectorAll('.registered-account-item');
    accountItems.forEach(item => {
      const select = item.querySelector('select')!;
      const input = item.querySelector('input')!;
      this.registeredAccounts.push({
        type: select.value as RegisteredAccountType,
        amount: Number(input.value)
      });
    });
  },

  /**
   * Gets the total amount for a specific account type
   */
  getAccountTypeTotal(type: RegisteredAccountType): number {
    return this.registeredAccounts
      .filter(account => account.type === type)
      .reduce((sum, account) => sum + account.amount, 0);
  },

  /**
   * Creates or updates the Chart.js chart with new data.
   */
  createOrUpdateChart(projection: Projection) {
    if (this.chart) {
      this.chart.destroy();
    }

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: projection.map(p => `Year ${p.year}`),
        datasets: [
          {
            label: 'Total Assets',
            data: projection.map(p => p.amountInvested + p.amountInRRSP + p.amountInTFSA),
            borderColor: '#646cff',
            backgroundColor: 'rgba(100, 108, 255, 0.1)',
            fill: true,
            tension: 0.4,
            order: 1,
          },
          {
            label: 'Investments',
            data: projection.map(p => p.amountInvested),
            borderColor: '#ff6464',
            backgroundColor: 'rgba(255, 100, 100, 0.1)',
            fill: true,
            tension: 0.4,
            order: 2,
          },
          {
            label: 'RRSP',
            data: projection.map(p => p.amountInRRSP),
            borderColor: '#64ff64',
            backgroundColor: 'rgba(100, 255, 100, 0.1)',
            fill: true,
            tension: 0.4,
            order: 3,
          },
          {
            label: 'TFSA',
            data: projection.map(p => p.amountInTFSA),
            borderColor: '#ffb164',
            backgroundColor: 'rgba(255, 177, 100, 0.1)',
            fill: true,
            tension: 0.4,
            order: 4,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          y: {
            ticks: {
              callback: (value) => ProjectionLogic.formatMoney(value as number),
            },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                return `${context.dataset.label}: ${ProjectionLogic.formatMoney(value)}`;
              },
            },
          },
        },
      },
    };

    this.chart = new Chart(this.projectionChartCanvas, config);
  },

  /**
   * Fills the HTML table with the projection data.
   */
  fillProjectionTable(projection: Projection) {
    this.projectionTableBody.innerHTML = '';
    
    projection.forEach((yearData: YearData) => {
      const totalAssets = yearData.amountInvested + yearData.amountInRRSP + yearData.amountInTFSA;
      const row = document.createElement('tr');
      
      const homeSaleDisplay = yearData.homeSaleProceeds > 0 
        ? `<br/>(+${ProjectionLogic.formatMoney(yearData.homeSaleProceeds)} home sale)`
        : '';

      const oneOffExpensesTotal = yearData.oneOffExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const oneOffExpensesDisplay = oneOffExpensesTotal > 0
        ? `<br/>(+${ProjectionLogic.formatMoney(oneOffExpensesTotal)} one-off)`
        : '';

      row.innerHTML = `
        <td class="year-col">
          ${yearData.calendarYear} 
          <br/>Year ${yearData.year} 
          <br/>(Age ${yearData.age})
          ${homeSaleDisplay}
        </td>
        <td class="investment-col ${yearData.amountInvested >= 0 ? 'positive' : 'negative'}">
          ${ProjectionLogic.formatMoney(yearData.amountInvested)}
        </td>
        <td class="rrsp-col ${yearData.amountInRRSP >= 0 ? 'positive' : 'negative'}">
          ${ProjectionLogic.formatMoney(yearData.amountInRRSP)}
        </td>
        <td class="tfsa-col ${yearData.amountInTFSA >= 0 ? 'positive' : 'negative'}">
          ${ProjectionLogic.formatMoney(yearData.amountInTFSA)}
        </td>
        <td class="total-col ${totalAssets >= 0 ? 'positive' : 'negative'}">
          ${ProjectionLogic.formatMoney(totalAssets)}
        </td>
        <td class="income-col">${ProjectionLogic.formatMoney(yearData.salary)}</td>
        <td class="income-col">${ProjectionLogic.formatMoney(yearData.investmentIncome)}</td>
        <td class="rrsp-withdrawal-col">${ProjectionLogic.formatMoney(yearData.rrspWithdrawal)}</td>
        <td class="credit-col">${ProjectionLogic.formatMoney(yearData.credits)}</td>
        <td class="debit-col">${ProjectionLogic.formatMoney(yearData.debits)}</td>
        <td class="tax-col">${ProjectionLogic.formatMoney(yearData.taxPaid)}</td>
        <td class="expenses-col">
          ${ProjectionLogic.formatMoney(yearData.expenses + yearData.healthcareExpenses + oneOffExpensesTotal)}
          ${oneOffExpensesDisplay}
        </td>
        <td class="income-col">${ProjectionLogic.formatMoney(yearData.oasAfterClawback)}</td>
        <td class="clawback-col">${ProjectionLogic.formatMoney(yearData.oasClawback)}</td>
      `;
      this.projectionTableBody.appendChild(row);
    });
  },

  /**
   * Main calculation routine triggered by the button.
   */
  recalculateProjection() {
    const startYear = Number(this.startYearInput.value);
    const currentAge = Number(this.currentAgeInput.value);
    const lifeExpectancy = Number(this.lifeExpectancyInput.value);
    const lastSalaryYear = Number(this.lastSalaryYearInput.value);
    const annualSalary = Number(this.annualSalaryInput.value);
    const annualExpenses = Number(this.annualExpensesInput.value);
    const annualHealthcareExpenses = Number(this.annualHealthcareExpensesInput.value);
    const initialInvestment = Number(this.initialInvestmentInput.value);
    const rateOfReturn = Number(this.rateOfReturnInput.value) / 100;
    const inflationRate = Number(this.inflationRateInput.value) / 100;
    const oasStartYear = Number(this.oasStartYearInput.value);
    const oasAnnualAmount = Number(this.oasAnnualAmountInput.value);
    const province = this.provinceSelector.value;

    // Get totals from registered accounts
    const initialRRSP = this.getAccountTypeTotal('RRSP');
    const initialTFSA = this.getAccountTypeTotal('TFSA');
    const initialRRIF = this.getAccountTypeTotal('RRIF');
    const initialLIRA = this.getAccountTypeTotal('LIRA');
    const initialLIF = this.getAccountTypeTotal('LIF');

    const realReturn = rateOfReturn - inflationRate;

    // Convert calendar year to relative year for home sale
    const willSellHome = this.willSellHomeCheckbox.checked;
    const homeSaleCalendarYear = willSellHome ? Number(this.homeSaleYearInput.value) : null;
    const homeSaleYear = homeSaleCalendarYear ? homeSaleCalendarYear - startYear + 1 : null;
    const homeSaleAmount = willSellHome ? Number(this.homeSaleAmountInput.value) : 0;

    const projection = ProjectionLogic.createInitialProjection(
      startYear,
      currentAge,
      lifeExpectancy,
      lastSalaryYear,
      annualSalary,
      annualExpenses,
      initialInvestment,
      initialRRSP,
      oasStartYear,
      oasAnnualAmount,
      initialTFSA,
      initialRRIF,
      initialLIRA,
      initialLIF,
      homeSaleYear,
      homeSaleAmount,
      this.useStagesCheckbox.checked,
      Number(this.stageOneExpensesInput.value),
      Number(this.stageOneHealthcareInput.value),
      Number(this.stageTwoExpensesInput.value),
      Number(this.stageTwoHealthcareInput.value),
      Number(this.stageThreeExpensesInput.value),
      Number(this.stageThreeHealthcareInput.value),
      this.oneOffExpenses
    );

    const finalProjection = ProjectionLogic.calculateProjection(projection, realReturn);
    this.createOrUpdateChart(finalProjection);
    this.fillProjectionTable(finalProjection);

    // Display the final result
    const finalYear = finalProjection[finalProjection.length - 1];
    const totalFinalBalance = finalYear.amountInvested + finalYear.amountInRRSP + finalYear.amountInTFSA;

    if (totalFinalBalance < 0) {
      const bankruptYear = finalProjection.find(
        (y) => y.amountInvested + y.amountInRRSP < 0
      );
      this.resultDiv.innerHTML = `
        <p style="color: red;">
          You run out of money at age <strong>${bankruptYear?.age}</strong>.
        </p>
      `;
    } else {
      this.resultDiv.innerHTML = `
        <p>
          At age ${lifeExpectancy}, you have:
          <br />
          Investments: <strong>${ProjectionLogic.formatMoney(finalYear.amountInvested)}</strong>
          <br />
          RRSP: <strong>${ProjectionLogic.formatMoney(finalYear.amountInRRSP)}</strong>
          <br />
          TFSA: <strong>${ProjectionLogic.formatMoney(finalYear.amountInTFSA)}</strong>
          <br />
          Total: <strong>${ProjectionLogic.formatMoney(totalFinalBalance)}</strong>
        </p>
      `;
    }
  },

  /**
   * Initialize any event listeners, do the initial calculation, etc.
   */
  init() {
    this.calculateBtn.addEventListener('click', () => {
      this.recalculateProjection();
    });

    this.addAccountBtn.addEventListener('click', () => {
      const accountElement = this.createRegisteredAccountElement();
      this.registeredAccountsList.appendChild(accountElement);
      this.updateRegisteredAccounts();
    });

    // Add stages checkbox handler
    this.useStagesCheckbox.addEventListener('change', (e) => {
      this.stagesContainer.style.display = 
        (e.target as HTMLInputElement).checked ? 'block' : 'none';
      
      // Copy current expenses to stage one if enabling stages
      if ((e.target as HTMLInputElement).checked) {
        this.stageOneExpensesInput.value = this.annualExpensesInput.value;
        this.stageOneHealthcareInput.value = this.annualHealthcareExpensesInput.value;
      }
    });

    // Add home sale checkbox handler
    this.willSellHomeCheckbox.addEventListener('change', (e) => {
      this.homeSaleDetailsDiv.style.display = 
        (e.target as HTMLInputElement).checked ? 'block' : 'none';
    });

    // Add validation for home sale year
    this.startYearInput.addEventListener('change', () => {
      const minYear = Number(this.startYearInput.value);
      this.homeSaleYearInput.min = minYear.toString();
      if (Number(this.homeSaleYearInput.value) < minYear) {
        this.homeSaleYearInput.value = minYear.toString();
      }
    });

    // Initialize one-off expenses handling
    this.addExpenseBtn.onclick = () => {
      const expenseElement = this.createOneOffExpenseElement();
      this.oneOffExpensesList.appendChild(expenseElement);
      this.updateOneOffExpenses();
    };

    // Perform an initial calculation on page load
    this.recalculateProjection();
  },

  /**
   * Creates a new one-off expense UI element
   */
  createOneOffExpenseElement(expense?: OneOffExpense): HTMLDivElement {
    const expenseItem = document.createElement('div');
    expenseItem.className = 'one-off-expense-item';

    const yearInput = document.createElement('input');
    yearInput.type = 'number';
    yearInput.min = this.startYearInput.value;
    yearInput.max = (Number(this.startYearInput.value) + Number(this.lifeExpectancyInput.value) - Number(this.currentAgeInput.value)).toString();
    yearInput.placeholder = 'Year (e.g. 2050)';
    // If we have an expense, convert relative year to calendar year
    yearInput.value = expense 
      ? (Number(this.startYearInput.value) + expense.year - 1).toString()
      : this.startYearInput.value;

    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.min = '0';
    amountInput.placeholder = 'Amount';
    amountInput.value = expense ? expense.amount.toString() : '0';

    const descriptionInput = document.createElement('input');
    descriptionInput.type = 'text';
    descriptionInput.placeholder = 'Description (optional)';
    descriptionInput.value = expense?.description || '';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-expense-btn';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => {
      expenseItem.remove();
      this.updateOneOffExpenses();
    };

    expenseItem.appendChild(yearInput);
    expenseItem.appendChild(amountInput);
    expenseItem.appendChild(descriptionInput);
    expenseItem.appendChild(removeBtn);

    // Update year input bounds when start year changes
    this.startYearInput.addEventListener('change', () => {
      yearInput.min = this.startYearInput.value;
      yearInput.max = (Number(this.startYearInput.value) + Number(this.lifeExpectancyInput.value) - Number(this.currentAgeInput.value)).toString();
      // Adjust year if it's now out of bounds
      if (Number(yearInput.value) < Number(yearInput.min)) {
        yearInput.value = yearInput.min;
      } else if (Number(yearInput.value) > Number(yearInput.max)) {
        yearInput.value = yearInput.max;
      }
      this.updateOneOffExpenses();
    });

    // Update year input bounds when life expectancy changes
    this.lifeExpectancyInput.addEventListener('change', () => {
      yearInput.max = (Number(this.startYearInput.value) + Number(this.lifeExpectancyInput.value) - Number(this.currentAgeInput.value)).toString();
      if (Number(yearInput.value) > Number(yearInput.max)) {
        yearInput.value = yearInput.max;
      }
      this.updateOneOffExpenses();
    });

    // Update one-off expenses when values change
    yearInput.onchange = () => this.updateOneOffExpenses();
    amountInput.onchange = () => this.updateOneOffExpenses();
    descriptionInput.onchange = () => this.updateOneOffExpenses();

    return expenseItem;
  },

  /**
   * Updates the internal one-off expenses array based on UI state
   */
  updateOneOffExpenses() {
    this.oneOffExpenses = [];
    const expenseItems = this.oneOffExpensesList.querySelectorAll('.one-off-expense-item');
    const startYear = Number(this.startYearInput.value);

    expenseItems.forEach(item => {
      const [yearInput, amountInput, descriptionInput] = item.querySelectorAll('input');
      const calendarYear = Number(yearInput.value);
      // Convert calendar year to relative year
      const relativeYear = calendarYear - startYear + 1;
      
      this.oneOffExpenses.push({
        year: relativeYear,
        amount: Number(amountInput.value),
        description: descriptionInput.value || undefined
      });
    });
  },
};
