/**
 * Israeli Real Estate Tax Engine
 * Implements Mas Shevach (Capital Gains Tax) and Mas Rechisha (Purchase Tax)
 * with Linear Calculation Method and CPI indexing
 */

// 2025/2026 tax brackets for Mas Rechisha (updated annually by Israeli tax authority)
const MAS_RECHISHA_SINGLE = [
  { upTo: 1_945_000, rate: 0 },
  { upTo: 2_307_000, rate: 0.035 },
  { upTo: 5_977_000, rate: 0.05 },
  { upTo: 19_932_000, rate: 0.08 },
  { upTo: Infinity, rate: 0.10 },
];

const MAS_RECHISHA_INVESTMENT = [
  { upTo: 5_977_000, rate: 0.08 },
  { upTo: 19_932_000, rate: 0.10 },
  { upTo: Infinity, rate: 0.10 },
];

export interface MasRechishaResult {
  purchasePrice: number;
  taxAmount: number;
  effectiveRate: number;
  brackets: { bracket: string; taxableAmount: number; rate: number; tax: number }[];
  isInvestment: boolean;
}

export function calculateMasRechisha(purchasePrice: number, isInvestment: boolean): MasRechishaResult {
  const brackets = isInvestment ? MAS_RECHISHA_INVESTMENT : MAS_RECHISHA_SINGLE;
  const result: MasRechishaResult = {
    purchasePrice,
    taxAmount: 0,
    effectiveRate: 0,
    brackets: [],
    isInvestment,
  };

  let remaining = purchasePrice;
  let prevLimit = 0;

  for (const bracket of brackets) {
    if (remaining <= 0) break;
    const taxableInBracket = Math.min(remaining, bracket.upTo - prevLimit);
    const tax = Math.round(taxableInBracket * bracket.rate);

    result.brackets.push({
      bracket: `${formatILS(prevLimit)} - ${bracket.upTo === Infinity ? '...' : formatILS(bracket.upTo)}`,
      taxableAmount: taxableInBracket,
      rate: bracket.rate,
      tax,
    });

    result.taxAmount += tax;
    remaining -= taxableInBracket;
    prevLimit = bracket.upTo;
  }

  result.effectiveRate = purchasePrice > 0 ? result.taxAmount / purchasePrice : 0;
  return result;
}

export interface MasShevachInput {
  purchasePrice: number;
  purchaseDate: string; // YYYY-MM-DD
  salePrice: number;
  saleDate?: string; // YYYY-MM-DD, defaults to now
  improvementExpenses: number; // שיפוצים ושיפורים
  purchaseCosts: number; // עלויות רכישה (עו"ד, תיווך, מס רכישה)
  saleCosts: number; // עלויות מכירה (עו"ד, תיווך)
  cumulativeCPI: number; // שיעור מדד מצטבר (e.g. 0.15 for 15%)
  isSingleApartment: boolean; // דירה יחידה
  bettermentLevy: number; // היטל השבחה
}

export interface MasShevachResult {
  // Inputs
  purchasePrice: number;
  salePrice: number;
  // Calculations
  nominalProfit: number; // רווח נומינלי
  indexedPurchasePrice: number; // מחיר רכישה מתואם למדד
  indexedExpenses: number; // הוצאות מתואמות
  realProfit: number; // רווח ריאלי (אחרי מדד)
  deductions: number; // ניכויים
  taxableProfit: number; // רווח חייב במס
  // Linear method
  linearExemptPortion: number; // חלק פטור (לפני 2014)
  linearTaxablePortion: number; // חלק חייב (אחרי 2014)
  // Result
  taxAmount: number;
  effectiveRate: number;
  isSingleExempt: boolean;
  breakdown: {
    label: string;
    amount: number;
    note?: string;
  }[];
}

export function calculateMasShevach(input: MasShevachInput): MasShevachResult {
  const saleDate = input.saleDate ? new Date(input.saleDate) : new Date();
  const purchaseDate = new Date(input.purchaseDate);
  const linearCutoff = new Date('2014-01-01');

  // Single apartment exemption (up to ~4.85M NIS)
  const singleExemptionLimit = 4_846_000;
  const isSingleExempt = input.isSingleApartment && input.salePrice <= singleExemptionLimit;

  // Nominal profit
  const nominalProfit = input.salePrice - input.purchasePrice;

  // CPI-indexed purchase price
  const indexedPurchasePrice = Math.round(input.purchasePrice * (1 + input.cumulativeCPI));
  const indexedExpenses = Math.round((input.purchaseCosts + input.improvementExpenses) * (1 + input.cumulativeCPI * 0.5)); // expenses indexed at half rate approximation

  // Real profit (after CPI adjustment)
  const realProfit = input.salePrice - indexedPurchasePrice - indexedExpenses;

  // Deductions
  const deductions = Math.round(input.saleCosts + input.bettermentLevy * 0.5); // 50% of betterment levy is deductible

  // Taxable profit
  const taxableProfit = Math.max(0, realProfit - deductions);

  // Linear Calculation Method
  // Days before 2014 / total days = exempt portion
  const totalDays = daysBetween(purchaseDate, saleDate);
  const daysBeforeCutoff = purchaseDate < linearCutoff
    ? daysBetween(purchaseDate, linearCutoff < saleDate ? linearCutoff : saleDate)
    : 0;

  const linearExemptPortion = totalDays > 0 ? daysBeforeCutoff / totalDays : 0;
  const linearTaxablePortion = 1 - linearExemptPortion;

  // Tax calculation
  let taxAmount = 0;
  if (isSingleExempt) {
    taxAmount = 0;
  } else if (taxableProfit > 0) {
    taxAmount = Math.round(taxableProfit * linearTaxablePortion * 0.25);
  }

  const effectiveRate = input.salePrice > 0 && taxAmount > 0 ? taxAmount / (input.salePrice - input.purchasePrice) : 0;

  const breakdown: { label: string; amount: number; note?: string }[] = [
    { label: 'מחיר מכירה', amount: input.salePrice },
    { label: 'מחיר רכישה מקורי', amount: -input.purchasePrice },
    { label: 'רווח נומינלי', amount: nominalProfit },
    { label: 'תיאום מדד על מחיר הרכישה', amount: -(indexedPurchasePrice - input.purchasePrice), note: `${(input.cumulativeCPI * 100).toFixed(1)}% מדד` },
    { label: 'הוצאות מותרות בניכוי (מתואמות)', amount: -indexedExpenses },
    { label: 'רווח ריאלי', amount: realProfit },
    { label: 'ניכויים (עלויות מכירה, היטל השבחה)', amount: -deductions },
    { label: 'רווח חייב במס', amount: taxableProfit },
  ];

  if (daysBeforeCutoff > 0 && !isSingleExempt) {
    breakdown.push({
      label: `חלק פטור (חישוב ליניארי - לפני 1.1.2014)`,
      amount: -Math.round(taxableProfit * linearExemptPortion),
      note: `${Math.round(linearExemptPortion * 100)}% מהתקופה`,
    });
    breakdown.push({
      label: `חלק חייב (אחרי 1.1.2014)`,
      amount: Math.round(taxableProfit * linearTaxablePortion),
      note: `${Math.round(linearTaxablePortion * 100)}% מהתקופה`,
    });
  }

  breakdown.push({
    label: isSingleExempt ? 'מס שבח (פטור דירה יחידה)' : 'מס שבח (25%)',
    amount: -taxAmount,
  });

  return {
    purchasePrice: input.purchasePrice,
    salePrice: input.salePrice,
    nominalProfit,
    indexedPurchasePrice,
    indexedExpenses,
    realProfit,
    deductions,
    taxableProfit,
    linearExemptPortion,
    linearTaxablePortion,
    taxAmount,
    effectiveRate,
    isSingleExempt,
    breakdown,
  };
}

function daysBetween(d1: Date, d2: Date): number {
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatILS(n: number): string {
  return n.toLocaleString('he-IL');
}

export const PURCHASE_COST_CATEGORIES: Record<string, string> = {
  agent_buy: 'תיווך קנייה',
  lawyer_buy: 'עו"ד רכישה',
  purchase_tax: 'מס רכישה',
  renovation: 'שיפוץ / סטיילינג',
  appraisal: 'שמאות',
  mortgage_file: 'פתיחת תיק משכנתא / יועץ',
  ownership_transfer: 'העברת בעלות / רישום בטאבו',
  moving: 'העברה / הובלה',
  utilities_transfer: 'העברת חשבונות',
  other_purchase: 'אחר',
};

export const SALE_COST_CATEGORIES: Record<string, string> = {
  agent_sell: 'תיווך מכירה',
  lawyer_sell: 'עו"ד מכירה',
  mortgage_advisor: 'יועץ משכנתאות',
  capital_gains_tax: 'מס שבח',
  betterment_levy: 'היטל השבחה',
  early_repayment_fee: 'עמלת פירעון מוקדם',
  other_sale: 'אחר',
};
