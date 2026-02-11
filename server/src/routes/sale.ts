import { Router } from 'express';
import { calculateInvestmentSummary } from '../services/calculator';

const router = Router();

// Calculate what happens if you sell
router.get('/:propertyId', (req, res) => {
  try {
    const salePrice = Number(req.query.price) || 0;
    const summary = calculateInvestmentSummary(Number(req.params.propertyId));

    // Sale costs (Israeli typical)
    const agentFee = salePrice * 0.02; // 2% agent
    const lawyerFee = Math.max(salePrice * 0.005, 3000); // 0.5% lawyer, min 3000
    // Tax: for single apartment - usually exempt, for investment - 25% on profit
    const purchaseTotal = summary.purchasePrice + summary.additionalPurchaseCosts;
    const rawProfit = salePrice - purchaseTotal;
    const capitalGainsTax = rawProfit > 0 ? rawProfit * 0.25 : 0;
    const totalSaleCosts = agentFee + lawyerFee + capitalGainsTax;

    // Net from sale
    const netFromSale = salePrice - totalSaleCosts;

    // Pay off mortgage
    const afterMortgage = netFromSale - summary.remainingMortgage;

    // Total investment calculation
    const totalCashInvested = (summary.purchasePrice - summary.totalMortgagePaid + summary.totalPrincipalPaid)
      + summary.additionalPurchaseCosts
      + summary.totalInterestPaid
      + summary.totalCpiPaid
      + summary.totalExpenses;

    // Total cash received
    const totalCashReceived = summary.totalRentalIncome;

    // Net position after sale
    const netPosition = afterMortgage + totalCashReceived - totalCashInvested + summary.totalMortgagePaid - summary.totalPrincipalPaid;

    // Simpler calculation: what you actually walk away with vs what you actually put in
    const selfEquity = summary.purchasePrice + summary.additionalPurchaseCosts -
      (summary.totalMortgagePaid > 0 ? summary.remainingMortgage + summary.totalPrincipalPaid : 0);

    // Total out of pocket over the years
    const totalOutOfPocket = selfEquity + summary.totalInterestPaid + summary.totalCpiPaid + summary.totalExpenses;
    // Total money you got back
    const totalGotBack = summary.totalRentalIncome;
    // Net cash flow during ownership
    const netDuringOwnership = totalGotBack - (summary.totalMortgagePaid - summary.totalPrincipalPaid) - summary.totalExpenses;

    // The money story
    const moneyStory = {
      // Chapter 1: The Purchase
      purchase: {
        propertyPrice: summary.purchasePrice,
        additionalCosts: summary.additionalPurchaseCosts,
        totalPurchaseCost: purchaseTotal,
        mortgageAmount: summary.remainingMortgage + summary.totalPrincipalPaid,
        downPayment: purchaseTotal - (summary.remainingMortgage + summary.totalPrincipalPaid),
      },
      // Chapter 2: The Mortgage
      mortgage: {
        totalPaid: summary.totalMortgagePaid,
        principalPaid: summary.totalPrincipalPaid,
        interestPaid: summary.totalInterestPaid,
        cpiPaid: summary.totalCpiPaid,
        remainingBalance: summary.remainingMortgage,
        interestPercentage: summary.totalMortgagePaid > 0
          ? Math.round((summary.totalInterestPaid / summary.totalMortgagePaid) * 100)
          : 0,
        monthlyAverage: summary.monthsOwned > 0
          ? Math.round(summary.totalMortgagePaid / summary.monthsOwned)
          : 0,
      },
      // Chapter 3: Rental Income
      rental: {
        totalIncome: summary.totalRentalIncome,
        monthsOwned: summary.monthsOwned,
        occupancyRate: summary.occupancyRate,
        vacantMonths: summary.vacantMonths,
        averageMonthlyRent: summary.averageMonthlyRent,
        lostRentFromVacancy: Math.round(summary.vacantMonths * summary.averageMonthlyRent),
      },
      // Chapter 4: Expenses
      expenses: {
        total: summary.totalExpenses,
        byCategory: summary.expensesByCategory,
        monthlyAverage: summary.monthsOwned > 0
          ? Math.round(summary.totalExpenses / summary.monthsOwned)
          : 0,
      },
      // Chapter 5: The Sale
      sale: {
        salePrice,
        agentFee: Math.round(agentFee),
        lawyerFee: Math.round(lawyerFee),
        capitalGainsTax: Math.round(capitalGainsTax),
        totalSaleCosts: Math.round(totalSaleCosts),
        netFromSale: Math.round(netFromSale),
        mortgagePayoff: summary.remainingMortgage,
        cashInHand: Math.round(afterMortgage),
      },
      // Chapter 6: The Bottom Line
      bottomLine: {
        totalMoneyInvested: Math.round(
          (purchaseTotal - (summary.remainingMortgage + summary.totalPrincipalPaid)) // down payment
          + summary.totalInterestPaid
          + summary.totalCpiPaid
          + summary.totalExpenses
          + (summary.totalMortgagePaid - summary.totalPrincipalPaid - summary.totalInterestPaid - summary.totalCpiPaid) // any other mortgage costs
        ),
        downPayment: Math.round(purchaseTotal - (summary.remainingMortgage + summary.totalPrincipalPaid)),
        totalInterestAndCpi: Math.round(summary.totalInterestPaid + summary.totalCpiPaid),
        totalExpenses: Math.round(summary.totalExpenses),
        totalMortgagePayments: Math.round(summary.totalMortgagePaid),
        totalRentalReceived: Math.round(summary.totalRentalIncome),
        netMonthlyCostAvg: Math.round((summary.totalMortgagePaid + summary.totalExpenses - summary.totalRentalIncome) / Math.max(summary.monthsOwned, 1)),
        cashInHandAfterSale: Math.round(afterMortgage),
        totalProfitOrLoss: Math.round(afterMortgage + summary.totalRentalIncome - (purchaseTotal - (summary.remainingMortgage + summary.totalPrincipalPaid)) - summary.totalInterestPaid - summary.totalCpiPaid - summary.totalExpenses),
        monthsOwned: summary.monthsOwned,
        yearsOwned: Number((summary.monthsOwned / 12).toFixed(1)),
      },
    };

    res.json(moneyStory);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
