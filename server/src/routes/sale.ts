import { Router } from 'express';
import { calculateInvestmentSummary } from '../services/calculator';
import { calculateMasShevach, calculateMasRechisha, PURCHASE_COST_CATEGORIES, SALE_COST_CATEGORIES } from '../services/tax-engine';
import { generateMortgageReplay, getCumulativeCPI } from '../services/mortgage-replay';
import { parseBankReport } from '../services/mortgage-parser';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../database';

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();

// Calculate what happens if you sell
router.get('/:propertyId', (req, res) => {
  try {
    const salePrice = Number(req.query.price) || 0;
    const propertyId = Number(req.params.propertyId);
    const summary = calculateInvestmentSummary(propertyId);

    // Fetch detailed purchase costs
    const purchaseCosts = db.prepare('SELECT * FROM purchase_costs WHERE property_id = ? ORDER BY amount DESC').all(propertyId) as any[];
    const purchaseCostsTotal = purchaseCosts.reduce((s: number, c: any) => s + c.amount, 0);

    // Use detailed costs if available, otherwise fallback to property.additional_purchase_costs
    const additionalCosts = purchaseCostsTotal > 0 ? purchaseCostsTotal : summary.additionalPurchaseCosts;

    // Sale costs (Israeli typical)
    const agentFee = salePrice * 0.02; // 2% agent
    const lawyerFee = Math.max(salePrice * 0.005, 3000); // 0.5% lawyer, min 3000

    // Real Israeli tax calculation
    const purchaseTotal = summary.purchasePrice + additionalCosts;
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId) as any;

    // Calculate Mas Shevach using real tax engine
    const masShevachInput = {
      purchasePrice: summary.purchasePrice,
      purchaseDate: property.purchase_date,
      salePrice: salePrice,
      improvementExpenses: getCostByCategories(purchaseCosts, ['renovation']),
      purchaseCosts: getCostByCategories(purchaseCosts, ['lawyer_buy', 'agent_buy', 'purchase_tax', 'appraisal', 'mortgage_file', 'ownership_transfer']),
      saleCosts: agentFee + lawyerFee,
      cumulativeCPI: estimateCPI(property.purchase_date), // approximate CPI
      isSingleApartment: false, // investment property
      bettermentLevy: 0,
    };

    const masShevach = calculateMasShevach(masShevachInput);
    const capitalGainsTax = masShevach.taxAmount;

    // Also calculate purchase tax for reference
    const masRechisha = calculateMasRechisha(summary.purchasePrice, true);

    const totalSaleCosts = agentFee + lawyerFee + capitalGainsTax;

    // Net from sale
    const netFromSale = salePrice - totalSaleCosts;

    // Pay off mortgage
    const afterMortgage = netFromSale - summary.remainingMortgage;

    // The money story
    const moneyStory = {
      // Chapter 1: The Purchase
      purchase: {
        propertyPrice: summary.purchasePrice,
        additionalCosts: additionalCosts,
        detailedCosts: purchaseCosts.map((c: any) => ({
          category: c.category,
          categoryLabel: PURCHASE_COST_CATEGORIES[c.category] || c.category,
          amount: c.amount,
          description: c.description,
        })),
        hasDetailedCosts: purchaseCosts.length > 0,
        totalPurchaseCost: purchaseTotal,
        mortgageAmount: summary.remainingMortgage + summary.totalPrincipalPaid,
        downPayment: purchaseTotal - (summary.remainingMortgage + summary.totalPrincipalPaid),
        masRechisha: {
          taxAmount: masRechisha.taxAmount,
          effectiveRate: masRechisha.effectiveRate,
          brackets: masRechisha.brackets,
        },
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
        // Tax breakdown
        masShevach: {
          taxAmount: masShevach.taxAmount,
          effectiveRate: masShevach.effectiveRate,
          isSingleExempt: masShevach.isSingleExempt,
          nominalProfit: masShevach.nominalProfit,
          realProfit: masShevach.realProfit,
          taxableProfit: masShevach.taxableProfit,
          linearExemptPortion: masShevach.linearExemptPortion,
          linearTaxablePortion: masShevach.linearTaxablePortion,
          breakdown: masShevach.breakdown,
        },
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

function getCostByCategories(costs: any[], categories: string[]): number {
  return costs
    .filter((c: any) => categories.includes(c.category))
    .reduce((sum: number, c: any) => sum + c.amount, 0);
}

// Use real CPI data from mortgage-replay engine
function estimateCPI(purchaseDate: string): number {
  return getCumulativeCPI(new Date(purchaseDate), new Date());
}

// Upload bank balance report and parse it
router.post('/bank-report/:propertyId', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'לא הועלה קובץ' });

    const propertyId = Number(req.params.propertyId);
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId) as any;
    if (!property) return res.status(404).json({ error: 'נכס לא נמצא' });

    const report = parseBankReport(req.file.path);

    // Clean up file
    fs.unlinkSync(req.file.path);

    if (report.tracks.length === 0) {
      return res.status(400).json({
        error: 'לא נמצאו מסלולי משכנתא בקובץ',
        warnings: report.warnings,
        rawHeaders: report.rawHeaders,
      });
    }

    res.json({
      message: `זוהו ${report.tracks.length} מסלולי משכנתא`,
      report,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'שגיאה בעיבוד הקובץ' });
  }
});

// Get mortgage replay timeline for chart
router.get('/timeline/:propertyId', (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const forecastInflation = Number(req.query.inflation) || 0.025;
    const forecastAppreciation = Number(req.query.appreciation) || 0.03;
    const forecastYears = Number(req.query.years) || 3;

    const replay = generateMortgageReplay(
      propertyId,
      null, // no bank report in simple GET (use POST for that)
      forecastInflation,
      forecastAppreciation,
      forecastYears,
    );

    res.json(replay);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Get mortgage replay with uploaded bank report
router.post('/timeline/:propertyId', upload.single('file'), (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const forecastInflation = Number(req.body.inflation) || 0.025;
    const forecastAppreciation = Number(req.body.appreciation) || 0.03;
    const forecastYears = Number(req.body.years) || 3;

    let bankReport = null;
    if (req.file) {
      bankReport = parseBankReport(req.file.path);
      fs.unlinkSync(req.file.path);
    }

    const replay = generateMortgageReplay(
      propertyId,
      bankReport,
      forecastInflation,
      forecastAppreciation,
      forecastYears,
    );

    res.json(replay);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
