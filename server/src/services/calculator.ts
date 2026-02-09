import db from '../database';

export interface MonthlyCashFlow {
  month: string; // YYYY-MM
  rentalIncome: number;
  mortgagePayment: number;
  expenses: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

export interface InvestmentSummary {
  propertyId: number;
  propertyName: string;
  // Purchase
  purchasePrice: number;
  additionalPurchaseCosts: number;
  totalInvestment: number;
  // Current
  currentEstimatedValue: number;
  equityGain: number;
  // Mortgage
  totalMortgagePaid: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalCpiPaid: number;
  remainingMortgage: number;
  // Rental
  totalRentalIncome: number;
  averageMonthlyRent: number;
  occupancyRate: number;
  vacantMonths: number;
  // Expenses
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  // Bottom line
  totalMoneyIn: number; // everything you put in
  totalMoneyOut: number; // everything you got back
  netProfit: number;
  cashOnCashReturn: number; // annual net / total cash invested
  totalROI: number;
  annualizedROI: number;
  monthlyNetCashFlow: number; // average
  // Timeline
  monthsOwned: number;
  monthlyCashFlow: MonthlyCashFlow[];
}

export function calculateInvestmentSummary(propertyId: number): InvestmentSummary {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId) as any;
  if (!property) throw new Error('Property not found');

  // Mortgage data
  const mortgages = db.prepare('SELECT * FROM mortgages WHERE property_id = ?').all(propertyId) as any[];
  const mortgageIds = mortgages.map((m: any) => m.id);

  let allMortgagePayments: any[] = [];
  if (mortgageIds.length > 0) {
    const placeholders = mortgageIds.map(() => '?').join(',');
    allMortgagePayments = db.prepare(
      `SELECT * FROM mortgage_payments WHERE mortgage_id IN (${placeholders}) ORDER BY date ASC`
    ).all(...mortgageIds) as any[];
  }

  const totalMortgagePaid = allMortgagePayments.reduce((sum, p) => sum + p.total_amount, 0);
  const totalPrincipalPaid = allMortgagePayments.reduce((sum, p) => sum + p.principal, 0);
  const totalInterestPaid = allMortgagePayments.reduce((sum, p) => sum + p.interest, 0);
  const totalCpiPaid = allMortgagePayments.reduce((sum, p) => sum + (p.cpi_addition || 0), 0);

  // Remaining mortgage balance (from last payment or original amount)
  let remainingMortgage = mortgages.reduce((sum: number, m: any) => sum + m.original_amount, 0) - totalPrincipalPaid;
  if (remainingMortgage < 0) remainingMortgage = 0;

  // Tenant / rental data
  const tenants = db.prepare('SELECT * FROM tenants WHERE property_id = ? ORDER BY start_date ASC').all(propertyId) as any[];
  const rentalPayments = db.prepare('SELECT * FROM rental_payments WHERE property_id = ? AND payment_type = \'rent\' ORDER BY date ASC').all(propertyId) as any[];
  const totalRentalIncome = rentalPayments.reduce((sum, p) => sum + p.amount, 0);

  // Calculate occupancy
  const purchaseDate = new Date(property.purchase_date);
  const now = new Date();
  const monthsOwned = Math.max(1, monthsDiff(purchaseDate, now));

  let occupiedMonths = 0;
  for (const tenant of tenants) {
    const start = new Date(tenant.start_date);
    const end = tenant.end_date ? new Date(tenant.end_date) : now;
    occupiedMonths += monthsDiff(
      start < purchaseDate ? purchaseDate : start,
      end > now ? now : end
    );
  }
  const vacantMonths = Math.max(0, monthsOwned - occupiedMonths);
  const occupancyRate = monthsOwned > 0 ? occupiedMonths / monthsOwned : 0;

  const averageMonthlyRent = rentalPayments.length > 0
    ? totalRentalIncome / rentalPayments.length
    : (tenants.length > 0 ? tenants[tenants.length - 1].monthly_rent : 0);

  // Expenses
  const expenses = db.prepare('SELECT * FROM expenses WHERE property_id = ?').all(propertyId) as any[];
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const expensesByCategory: Record<string, number> = {};
  for (const e of expenses) {
    expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + e.amount;
  }

  // Self equity = purchase price - mortgage amount + additional costs
  const totalMortgageOriginal = mortgages.reduce((sum: number, m: any) => sum + m.original_amount, 0);
  const selfEquity = property.purchase_price - totalMortgageOriginal + (property.additional_purchase_costs || 0);

  // Total money in (cash out of pocket)
  const totalMoneyIn = selfEquity + totalInterestPaid + totalCpiPaid + totalExpenses;

  // Total money out (what you got/will get)
  const currentValue = property.current_estimated_value || property.purchase_price;
  const equityGain = currentValue - property.purchase_price;
  const totalMoneyOut = totalRentalIncome + equityGain;

  const netProfit = totalMoneyOut - totalMoneyIn;
  const totalROI = selfEquity > 0 ? (netProfit / selfEquity) * 100 : 0;
  const years = monthsOwned / 12;
  const annualizedROI = years > 0 ? (Math.pow(1 + netProfit / Math.max(selfEquity, 1), 1 / years) - 1) * 100 : 0;

  // Cash on cash return (annual)
  const annualNetCashFlow = (totalRentalIncome - totalMortgagePaid - totalExpenses) / Math.max(years, 1 / 12);
  const cashOnCashReturn = selfEquity > 0 ? (annualNetCashFlow / selfEquity) * 100 : 0;

  const monthlyNetCashFlow = (totalRentalIncome - totalMortgagePaid - totalExpenses) / monthsOwned;

  // Monthly cash flow breakdown
  const monthlyCashFlow = buildMonthlyCashFlow(propertyId, purchaseDate, now, allMortgagePayments, rentalPayments, expenses);

  return {
    propertyId,
    propertyName: property.name,
    purchasePrice: property.purchase_price,
    additionalPurchaseCosts: property.additional_purchase_costs || 0,
    totalInvestment: property.purchase_price + (property.additional_purchase_costs || 0),
    currentEstimatedValue: currentValue,
    equityGain,
    totalMortgagePaid,
    totalPrincipalPaid,
    totalInterestPaid,
    totalCpiPaid,
    remainingMortgage,
    totalRentalIncome,
    averageMonthlyRent,
    occupancyRate,
    vacantMonths,
    totalExpenses,
    expensesByCategory,
    totalMoneyIn,
    totalMoneyOut,
    netProfit,
    cashOnCashReturn,
    totalROI,
    annualizedROI,
    monthlyNetCashFlow,
    monthsOwned,
    monthlyCashFlow,
  };
}

function buildMonthlyCashFlow(
  _propertyId: number,
  startDate: Date,
  endDate: Date,
  mortgagePayments: any[],
  rentalPayments: any[],
  expenses: any[]
): MonthlyCashFlow[] {
  const result: MonthlyCashFlow[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  let cumulative = 0;

  while (current <= end) {
    const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

    const rental = rentalPayments
      .filter(p => p.date.startsWith(monthStr))
      .reduce((sum, p) => sum + p.amount, 0);

    const mortgage = mortgagePayments
      .filter(p => p.date.startsWith(monthStr))
      .reduce((sum, p) => sum + p.total_amount, 0);

    const exp = expenses
      .filter(e => e.date.startsWith(monthStr))
      .reduce((sum, e) => sum + e.amount, 0);

    const net = rental - mortgage - exp;
    cumulative += net;

    result.push({
      month: monthStr,
      rentalIncome: rental,
      mortgagePayment: mortgage,
      expenses: exp,
      netCashFlow: net,
      cumulativeCashFlow: cumulative,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return result;
}

function monthsDiff(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}
