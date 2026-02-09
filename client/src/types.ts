export interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  property_type: string;
  purchase_date: string;
  purchase_price: number;
  additional_purchase_costs: number;
  current_estimated_value: number | null;
  square_meters: number | null;
  notes: string | null;
  created_at: string;
}

export interface Mortgage {
  id: number;
  property_id: number;
  bank_name: string;
  original_amount: number;
  start_date: string;
  term_months: number;
  notes: string | null;
  tracks: MortgageTrack[];
}

export interface MortgageTrack {
  id: number;
  mortgage_id: number;
  track_name: string;
  track_type: string;
  original_amount: number;
  interest_rate: number;
  is_cpi_linked: number;
  term_months: number;
}

export interface MortgagePayment {
  id: number;
  mortgage_id: number;
  date: string;
  total_amount: number;
  principal: number;
  interest: number;
  cpi_addition: number;
  remaining_balance: number | null;
  notes: string | null;
}

export interface Tenant {
  id: number;
  property_id: number;
  name: string;
  phone: string | null;
  start_date: string;
  end_date: string | null;
  monthly_rent: number;
  payment_day: number;
  deposit_amount: number;
  notes: string | null;
}

export interface RentalPayment {
  id: number;
  tenant_id: number;
  property_id: number;
  date: string;
  amount: number;
  payment_type: string;
  notes: string | null;
}

export interface Expense {
  id: number;
  property_id: number;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  is_recurring: number;
  recurring_months: number | null;
  notes: string | null;
}

export interface MonthlyCashFlow {
  month: string;
  rentalIncome: number;
  mortgagePayment: number;
  expenses: number;
  netCashFlow: number;
  cumulativeCashFlow: number;
}

export interface InvestmentSummary {
  propertyId: number;
  propertyName: string;
  purchasePrice: number;
  additionalPurchaseCosts: number;
  totalInvestment: number;
  currentEstimatedValue: number;
  equityGain: number;
  totalMortgagePaid: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  totalCpiPaid: number;
  remainingMortgage: number;
  totalRentalIncome: number;
  averageMonthlyRent: number;
  occupancyRate: number;
  vacantMonths: number;
  totalExpenses: number;
  expensesByCategory: Record<string, number>;
  totalMoneyIn: number;
  totalMoneyOut: number;
  netProfit: number;
  cashOnCashReturn: number;
  totalROI: number;
  annualizedROI: number;
  monthlyNetCashFlow: number;
  monthsOwned: number;
  monthlyCashFlow: MonthlyCashFlow[];
}

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

export const EXPENSE_CATEGORIES: Record<string, string> = {
  maintenance: 'תחזוקה',
  tax: 'מיסים (ארנונה/מס)',
  insurance: 'ביטוח',
  management: 'ניהול',
  renovation: 'שיפוץ',
  legal: 'עו"ד / שמאות',
  committee: 'ועד בית',
  other: 'אחר',
};

export const TRACK_TYPES: Record<string, string> = {
  prime: 'פריים',
  fixed: 'קבועה לא צמודה',
  variable: 'משתנה לא צמודה',
  cpi_fixed: 'קבועה צמודה למדד',
  cpi_variable: 'משתנה צמודה למדד',
};

export const PROPERTY_TYPES: Record<string, string> = {
  apartment: 'דירה',
  house: 'בית פרטי',
  penthouse: 'פנטהאוז',
  garden: 'דירת גן',
  studio: 'סטודיו',
  commercial: 'מסחרי',
};
