/**
 * Mortgage Replay & Simulation Engine
 *
 * Creates a full timeline from purchase → today → projected future sale.
 * Two modes:
 *   A) File Uploaded: Uses exact balances from parsed bank report as "Anchor of Truth"
 *   B) No File: Falls back to historical simulation using real Israeli CPI data
 *
 * Outputs a timeline suitable for charting: equity vs debt, CPI damage, projected future.
 */

import db from '../database';
import { ParsedBankReport } from './mortgage-parser';

// === Real Israeli CPI Monthly Data (CBS - הלשכה המרכזית לסטטיסטיקה) ===
// Annual CPI % change, sourced from Bank of Israel reports
const ANNUAL_CPI: Record<number, number> = {
  2018: 0.008,   // 0.8%
  2019: 0.003,   // 0.3%
  2020: -0.007,  // -0.7%
  2021: 0.028,   // 2.8%
  2022: 0.053,   // 5.3%
  2023: 0.033,   // 3.3%
  2024: 0.031,   // 3.1%
  2025: 0.025,   // 2.5% (estimate)
  2026: 0.020,   // 2.0% (forecast)
};

// Convert to monthly rates for simulation
function getMonthlyInflation(year: number, month: number): number {
  const annualRate = ANNUAL_CPI[year] ?? 0.025; // default 2.5%
  return annualRate / 12;
}

// Cumulative CPI from a start date to an end date
export function getCumulativeCPI(startDate: Date, endDate: Date): number {
  let cumulative = 1.0;
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current < end) {
    cumulative *= (1 + getMonthlyInflation(current.getFullYear(), current.getMonth()));
    current.setMonth(current.getMonth() + 1);
  }

  return cumulative - 1; // return as percentage (e.g. 0.15 = 15%)
}

export interface TimelinePoint {
  date: string;       // YYYY-MM
  month: number;      // months since purchase
  // Debt side
  mortgageBalance: number;
  cpiAccumulated: number;        // total CPI damage accumulated
  interestPaidToDate: number;
  principalPaidToDate: number;
  // Equity side
  propertyValue: number;
  equity: number;                // propertyValue - mortgageBalance
  // Cash flow
  rentalIncomeToDate: number;
  expensesToDate: number;
  mortgagePaidToDate: number;
  netCashFlowToDate: number;
  // Metadata
  isProjection: boolean;         // true = future estimate, false = historical
  isAnchorPoint: boolean;        // true = from uploaded bank report
}

export interface MortgageReplayResult {
  timeline: TimelinePoint[];
  // Current state (today)
  currentBalance: number;
  currentEquity: number;
  totalCpiDamage: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  // Source
  dataSource: 'uploaded_report' | 'payment_history' | 'simulation';
  anchorDate: string | null;
  // KPIs
  inflationCostTotal: number;    // exactly how much the debt grew due to CPI
  monthlyMortgageAvg: number;
  effectiveInterestCost: number; // interest + CPI total
}

export function generateMortgageReplay(
  propertyId: number,
  bankReport: ParsedBankReport | null,
  forecastInflation: number = 0.025,  // user slider: annual inflation %
  forecastAppreciation: number = 0.03, // user slider: property appreciation %
  forecastYears: number = 3,
): MortgageReplayResult {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId) as any;
  if (!property) throw new Error('נכס לא נמצא');

  const mortgages = db.prepare('SELECT * FROM mortgages WHERE property_id = ?').all(propertyId) as any[];
  const mortgageIds = mortgages.map((m: any) => m.id);

  let allPayments: any[] = [];
  if (mortgageIds.length > 0) {
    const ph = mortgageIds.map(() => '?').join(',');
    allPayments = db.prepare(
      `SELECT * FROM mortgage_payments WHERE mortgage_id IN (${ph}) ORDER BY date ASC`
    ).all(...mortgageIds) as any[];
  }

  // Rental income
  const rentalPayments = db.prepare(
    "SELECT * FROM rental_payments WHERE property_id = ? AND payment_type = 'rent' ORDER BY date ASC"
  ).all(propertyId) as any[];

  // Expenses
  const expenses = db.prepare('SELECT * FROM expenses WHERE property_id = ? ORDER BY date ASC').all(propertyId) as any[];

  const purchaseDate = new Date(property.purchase_date);
  const now = new Date();
  const timeline: TimelinePoint[] = [];

  const totalOriginalMortgage = mortgages.reduce((s: number, m: any) => s + m.original_amount, 0);
  const purchasePrice = property.purchase_price;
  const currentEstimatedValue = property.current_estimated_value || purchasePrice;

  // Determine data source & anchor
  let dataSource: MortgageReplayResult['dataSource'] = 'simulation';
  let anchorDate: string | null = null;

  if (bankReport && bankReport.tracks.length > 0) {
    dataSource = 'uploaded_report';
    anchorDate = bankReport.reportDate || now.toISOString().split('T')[0];
  } else if (allPayments.length > 0) {
    dataSource = 'payment_history';
  }

  // === Build Historical Timeline (purchase → today) ===
  let runningBalance = totalOriginalMortgage;
  let runningCpi = 0;
  let runningInterest = 0;
  let runningPrincipal = 0;
  let runningRental = 0;
  let runningExpenses = 0;
  let runningMortgagePaid = 0;

  const current = new Date(purchaseDate.getFullYear(), purchaseDate.getMonth(), 1);
  const endHistorical = new Date(now.getFullYear(), now.getMonth(), 1);
  let monthIndex = 0;

  // Determine CPI-linked portion of mortgage
  let cpiLinkedRatio = 0;
  if (bankReport && bankReport.tracks.length > 0) {
    const cpiBalance = bankReport.tracks
      .filter(t => t.isCpiLinked)
      .reduce((s, t) => s + t.remainingBalance, 0);
    cpiLinkedRatio = bankReport.totalBalance > 0 ? cpiBalance / bankReport.totalBalance : 0;
  } else {
    // Estimate from mortgage tracks in DB
    for (const mortgage of mortgages) {
      const tracks = db.prepare('SELECT * FROM mortgage_tracks WHERE mortgage_id = ?').all(mortgage.id) as any[];
      const total = tracks.reduce((s: number, t: any) => s + t.original_amount, 0);
      const cpiAmt = tracks.filter((t: any) => t.is_cpi_linked).reduce((s: number, t: any) => s + t.original_amount, 0);
      if (total > 0) cpiLinkedRatio = cpiAmt / total;
    }
  }

  while (current <= endHistorical) {
    const monthStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;

    // Get actual payment data for this month
    const monthPayments = allPayments.filter(p => p.date.startsWith(monthStr));
    const monthRental = rentalPayments.filter(p => p.date.startsWith(monthStr)).reduce((s, p) => s + p.amount, 0);
    const monthExpenses = expenses.filter(e => e.date.startsWith(monthStr)).reduce((s, e) => s + e.amount, 0);

    if (monthPayments.length > 0) {
      // Real data
      const monthPrincipal = monthPayments.reduce((s, p) => s + p.principal, 0);
      const monthInterest = monthPayments.reduce((s, p) => s + p.interest, 0);
      const monthCpi = monthPayments.reduce((s, p) => s + (p.cpi_addition || 0), 0);
      const monthTotal = monthPayments.reduce((s, p) => s + p.total_amount, 0);

      runningPrincipal += monthPrincipal;
      runningInterest += monthInterest;
      runningCpi += monthCpi;
      runningMortgagePaid += monthTotal;

      // Use last payment's remaining balance if available
      const lastPayment = monthPayments[monthPayments.length - 1];
      if (lastPayment.remaining_balance != null) {
        runningBalance = lastPayment.remaining_balance;
      } else {
        runningBalance = Math.max(0, runningBalance - monthPrincipal + monthCpi);
      }
    } else if (dataSource === 'simulation' && totalOriginalMortgage > 0) {
      // Simulate: estimate monthly payment
      const monthlyInflation = getMonthlyInflation(current.getFullYear(), current.getMonth());
      const cpiAddition = runningBalance * cpiLinkedRatio * monthlyInflation;
      const estimatedMonthlyPayment = totalOriginalMortgage / (mortgages[0]?.term_months || 300);
      const estimatedInterest = runningBalance * 0.03 / 12; // rough 3% average

      runningCpi += Math.max(0, cpiAddition);
      runningBalance = Math.max(0, runningBalance + cpiAddition - estimatedMonthlyPayment);
      runningInterest += estimatedInterest;
      runningPrincipal += Math.max(0, estimatedMonthlyPayment - estimatedInterest);
      runningMortgagePaid += estimatedMonthlyPayment;
    }

    runningRental += monthRental;
    runningExpenses += monthExpenses;

    // Estimate property value (linear appreciation from purchase to current estimated)
    const monthsTotal = monthsDiff(purchaseDate, now) || 1;
    const appreciationSoFar = (currentEstimatedValue - purchasePrice) * (monthIndex / monthsTotal);
    const propertyValue = purchasePrice + Math.max(0, appreciationSoFar);

    timeline.push({
      date: monthStr,
      month: monthIndex,
      mortgageBalance: Math.round(runningBalance),
      cpiAccumulated: Math.round(runningCpi),
      interestPaidToDate: Math.round(runningInterest),
      principalPaidToDate: Math.round(runningPrincipal),
      propertyValue: Math.round(propertyValue),
      equity: Math.round(propertyValue - runningBalance),
      rentalIncomeToDate: Math.round(runningRental),
      expensesToDate: Math.round(runningExpenses),
      mortgagePaidToDate: Math.round(runningMortgagePaid),
      netCashFlowToDate: Math.round(runningRental - runningMortgagePaid - runningExpenses),
      isProjection: false,
      isAnchorPoint: false,
    });

    monthIndex++;
    current.setMonth(current.getMonth() + 1);
  }

  // === Apply Anchor Point (if bank report uploaded) ===
  if (bankReport && bankReport.tracks.length > 0) {
    runningBalance = bankReport.totalBalance;
    // Mark the last historical point as anchor
    if (timeline.length > 0) {
      timeline[timeline.length - 1].mortgageBalance = bankReport.totalBalance;
      timeline[timeline.length - 1].isAnchorPoint = true;
      timeline[timeline.length - 1].equity = Math.round(currentEstimatedValue - bankReport.totalBalance);
    }
  }

  // === Build Future Projection ===
  const futureMonths = forecastYears * 12;
  let projBalance = runningBalance;
  let projPropertyValue = currentEstimatedValue;
  const monthlyAppreciation = forecastAppreciation / 12;
  const monthlyInflationForecast = forecastInflation / 12;

  // Estimate average monthly mortgage payment from history
  const avgMonthlyPayment = runningMortgagePaid > 0 && monthIndex > 0
    ? runningMortgagePaid / monthIndex
    : totalOriginalMortgage / (mortgages[0]?.term_months || 300);

  const avgMonthlyRental = runningRental > 0 && monthIndex > 0
    ? runningRental / monthIndex
    : 0;

  const avgMonthlyExpenses = runningExpenses > 0 && monthIndex > 0
    ? runningExpenses / monthIndex
    : 0;

  for (let i = 1; i <= futureMonths; i++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`;

    // CPI inflation on linked portion
    const cpiAddition = projBalance * cpiLinkedRatio * monthlyInflationForecast;
    const estimatedInterest = projBalance * 0.03 / 12;
    const principal = Math.max(0, avgMonthlyPayment - estimatedInterest - cpiAddition);

    projBalance = Math.max(0, projBalance + cpiAddition - principal);
    projPropertyValue *= (1 + monthlyAppreciation);

    runningCpi += Math.max(0, cpiAddition);
    runningInterest += estimatedInterest;
    runningPrincipal += principal;
    runningMortgagePaid += avgMonthlyPayment;
    runningRental += avgMonthlyRental;
    runningExpenses += avgMonthlyExpenses;

    timeline.push({
      date: dateStr,
      month: monthIndex + i,
      mortgageBalance: Math.round(projBalance),
      cpiAccumulated: Math.round(runningCpi),
      interestPaidToDate: Math.round(runningInterest),
      principalPaidToDate: Math.round(runningPrincipal),
      propertyValue: Math.round(projPropertyValue),
      equity: Math.round(projPropertyValue - projBalance),
      rentalIncomeToDate: Math.round(runningRental),
      expensesToDate: Math.round(runningExpenses),
      mortgagePaidToDate: Math.round(runningMortgagePaid),
      netCashFlowToDate: Math.round(runningRental - runningMortgagePaid - runningExpenses),
      isProjection: true,
      isAnchorPoint: false,
    });
  }

  // Current state
  const currentPoint = timeline.find(t => !t.isProjection && t === timeline.filter(p => !p.isProjection).pop());

  return {
    timeline,
    currentBalance: currentPoint?.mortgageBalance || runningBalance,
    currentEquity: currentPoint?.equity || 0,
    totalCpiDamage: Math.round(runningCpi),
    totalInterestPaid: Math.round(runningInterest),
    totalPrincipalPaid: Math.round(runningPrincipal),
    dataSource,
    anchorDate,
    inflationCostTotal: Math.round(runningCpi),
    monthlyMortgageAvg: monthIndex > 0 ? Math.round(runningMortgagePaid / monthIndex) : 0,
    effectiveInterestCost: Math.round(runningInterest + runningCpi),
  };
}

function monthsDiff(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}
