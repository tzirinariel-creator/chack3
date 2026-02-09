import { InvestmentSummary } from './calculator';

export interface ForecastScenario {
  name: string;
  description: string;
  years: number[];
  projections: YearProjection[];
}

export interface YearProjection {
  year: number;
  propertyValue: number;
  totalRentalIncome: number;
  totalMortgagePaid: number;
  totalExpenses: number;
  remainingMortgage: number;
  netWorthFromProperty: number;
  cumulativeProfit: number;
  annualCashFlow: number;
}

export interface Recommendation {
  type: 'hold' | 'sell' | 'refinance' | 'raise_rent' | 'reduce_expenses';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialImpact: string;
}

export function generateForecasts(summary: InvestmentSummary): ForecastScenario[] {
  const scenarios: ForecastScenario[] = [];
  const years = [1, 2, 3, 5, 10];

  // Conservative scenario (2% appreciation, same rent)
  scenarios.push({
    name: 'שמרני',
    description: 'עליית מחירים של 2% בשנה, שכירות קבועה',
    years,
    projections: projectYears(summary, years, 0.02, 0, 0.02),
  });

  // Moderate scenario (4% appreciation, 2% rent increase)
  scenarios.push({
    name: 'מתון',
    description: 'עליית מחירים של 4% בשנה, עליית שכירות 2% בשנה',
    years,
    projections: projectYears(summary, years, 0.04, 0.02, 0.02),
  });

  // Optimistic scenario (6% appreciation, 3% rent increase)
  scenarios.push({
    name: 'אופטימי',
    description: 'עליית מחירים של 6% בשנה, עליית שכירות 3% בשנה',
    years,
    projections: projectYears(summary, years, 0.06, 0.03, 0.02),
  });

  return scenarios;
}

function projectYears(
  summary: InvestmentSummary,
  years: number[],
  appreciationRate: number,
  rentIncreaseRate: number,
  expenseIncreaseRate: number
): YearProjection[] {
  const projections: YearProjection[] = [];
  const currentValue = summary.currentEstimatedValue;
  const monthlyRent = summary.averageMonthlyRent;
  const monthlyMortgage = summary.monthsOwned > 0 ? summary.totalMortgagePaid / summary.monthsOwned : 0;
  const monthlyExpenses = summary.monthsOwned > 0 ? summary.totalExpenses / summary.monthsOwned : 0;
  let cumulativeProfit = summary.netProfit;

  for (const year of years) {
    const futureValue = currentValue * Math.pow(1 + appreciationRate, year);
    const futureRent = monthlyRent * Math.pow(1 + rentIncreaseRate, year);
    const futureExpenses = monthlyExpenses * Math.pow(1 + expenseIncreaseRate, year);

    // Rough remaining mortgage calculation
    const monthlyPrincipalRate = summary.totalPrincipalPaid / Math.max(summary.totalMortgagePaid, 1);
    const yearlyPrincipalPaid = monthlyMortgage * 12 * monthlyPrincipalRate;
    const futureRemainingMortgage = Math.max(0, summary.remainingMortgage - yearlyPrincipalPaid * year);

    const annualRental = futureRent * 12;
    const annualMortgage = monthlyMortgage * 12;
    const annualExpenses = futureExpenses * 12;
    const annualCashFlow = annualRental - annualMortgage - annualExpenses;
    cumulativeProfit += annualCashFlow;

    const netWorth = futureValue - futureRemainingMortgage;

    projections.push({
      year,
      propertyValue: Math.round(futureValue),
      totalRentalIncome: Math.round(annualRental),
      totalMortgagePaid: Math.round(annualMortgage),
      totalExpenses: Math.round(annualExpenses),
      remainingMortgage: Math.round(futureRemainingMortgage),
      netWorthFromProperty: Math.round(netWorth),
      cumulativeProfit: Math.round(cumulativeProfit),
      annualCashFlow: Math.round(annualCashFlow),
    });
  }

  return projections;
}

export function generateRecommendations(summary: InvestmentSummary): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Cash flow analysis
  if (summary.monthlyNetCashFlow < 0) {
    recommendations.push({
      type: 'hold',
      priority: 'high',
      title: 'תזרים מזומנים שלילי',
      description: `הנכס מייצר הפסד חודשי ממוצע של ${Math.abs(Math.round(summary.monthlyNetCashFlow))} ש"ח. כלומר כל חודש אתה מוציא יותר ממה שנכנס.`,
      potentialImpact: 'שקול להעלות שכירות, להפחית הוצאות, או למחזר משכנתא',
    });
  } else if (summary.monthlyNetCashFlow > 0) {
    recommendations.push({
      type: 'hold',
      priority: 'low',
      title: 'תזרים מזומנים חיובי',
      description: `הנכס מייצר רווח חודשי ממוצע של ${Math.round(summary.monthlyNetCashFlow)} ש"ח. מצב טוב!`,
      potentialImpact: 'המשך להחזיק ולצבור הון',
    });
  }

  // Occupancy analysis
  if (summary.occupancyRate < 0.85) {
    recommendations.push({
      type: 'raise_rent',
      priority: 'high',
      title: 'שיעור תפוסה נמוך',
      description: `שיעור התפוסה עומד על ${Math.round(summary.occupancyRate * 100)}% בלבד. ${summary.vacantMonths} חודשים ריקים.`,
      potentialImpact: `כל חודש ריק עולה לך כ-${Math.round(summary.averageMonthlyRent)} ש"ח בשכירות אבודה`,
    });
  }

  // Interest analysis
  const interestRatio = summary.totalInterestPaid / Math.max(summary.totalMortgagePaid, 1);
  if (interestRatio > 0.5) {
    recommendations.push({
      type: 'refinance',
      priority: 'medium',
      title: 'ריבית גבוהה על המשכנתא',
      description: `${Math.round(interestRatio * 100)}% מתשלומי המשכנתא הולכים לריבית. כלומר רוב הכסף לא בונה לך הון.`,
      potentialImpact: 'מחזור משכנתא עשוי לחסוך אלפי שקלים בשנה',
    });
  }

  // ROI analysis
  if (summary.cashOnCashReturn < 3) {
    recommendations.push({
      type: 'sell',
      priority: 'medium',
      title: 'תשואה שוטפת נמוכה',
      description: `תשואת ה-Cash on Cash עומדת על ${summary.cashOnCashReturn.toFixed(1)}% בלבד - נמוך מפיקדון בנקאי.`,
      potentialImpact: 'שקול אם ההשקעה משתלמת ביחס לאלטרנטיבות',
    });
  }

  // Equity gain analysis
  if (summary.equityGain > 0) {
    const equityGainPercent = (summary.equityGain / summary.purchasePrice) * 100;
    recommendations.push({
      type: 'hold',
      priority: 'low',
      title: 'עליית ערך הנכס',
      description: `הנכס עלה ב-${Math.round(summary.equityGain).toLocaleString()} ש"ח (${equityGainPercent.toFixed(1)}%) מאז הרכישה.`,
      potentialImpact: equityGainPercent > 20 ? 'שקול למנף את העלייה למשכנתא על נכס נוסף' : 'המשך לעקוב',
    });
  }

  // High expenses
  if (summary.totalExpenses > summary.totalRentalIncome * 0.3) {
    recommendations.push({
      type: 'reduce_expenses',
      priority: 'medium',
      title: 'הוצאות גבוהות ביחס להכנסה',
      description: `ההוצאות מהוות ${Math.round((summary.totalExpenses / Math.max(summary.totalRentalIncome, 1)) * 100)}% מהכנסות השכירות.`,
      potentialImpact: 'בדוק אילו הוצאות ניתן לצמצם',
    });
  }

  return recommendations;
}
