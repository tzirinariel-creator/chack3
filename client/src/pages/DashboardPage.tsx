import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getProperties, getInvestmentSummary } from '../api';
import { Property, InvestmentSummary } from '../types';
import { formatCurrency, formatPercent } from '../utils/format';
import { Building2, TrendingUp, TrendingDown, ArrowLeft, AlertCircle } from 'lucide-react';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getProperties().then(props => {
      setProperties(props);
      if (props.length > 0) setSelectedProperty(props[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      setLoading(true);
      setError('');
      getInvestmentSummary(selectedProperty).then(s => {
        setSummary(s);
        setLoading(false);
      }).catch((err) => {
        setError(err.message);
        setSummary(null);
        setLoading(false);
      });
    }
  }, [selectedProperty]);

  if (!loading && properties.length === 0) {
    return (
      <div className="text-center py-16">
        <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">אין נכסים עדיין</h3>
        <p className="text-gray-400 mb-6">הוסף את הנכס הראשון שלך ואת נתוני המשכנתא כדי לראות את הדשבורד</p>
        <Link to="/" className="btn-primary inline-flex items-center gap-1">
          עבור לנכסים
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">דשבורד - לאן הלך הכסף?</h2>
        {properties.length > 1 && (
          <select className="input-field w-auto" value={selectedProperty || ''} onChange={e => setSelectedProperty(Number(e.target.value))}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {loading && <div className="text-center py-12 text-gray-500">טוען ניתוח...</div>}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">לא הצלחתי לטעון את הניתוח</p>
            <p className="text-sm text-yellow-700">ודא שהוספת נתוני משכנתא, שוכרים והוצאות בדף הנכס</p>
          </div>
          <Link to={`/property/${selectedProperty}`} className="btn-secondary text-sm mr-auto">עבור לנכס</Link>
        </div>
      )}

      {summary && (
        <>
          {/* Top Summary Banner */}
          <div className={`card mb-6 ${summary.netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold mb-1">
                  {summary.netProfit >= 0 ? 'ההשקעה ברווח' : 'ההשקעה בהפסד'}
                </h3>
                <p className="text-sm text-gray-600">
                  מאז הרכישה ({summary.monthsOwned} חודשים / {(summary.monthsOwned / 12).toFixed(1)} שנים)
                </p>
              </div>
              <div className="text-left">
                <div className={`text-3xl font-bold ${summary.netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {summary.netProfit >= 0 ? '+' : ''}{formatCurrency(summary.netProfit)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  ROI שנתי: {formatPercent(summary.annualizedROI)}
                </div>
              </div>
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label='סה"כ השקעה' value={formatCurrency(summary.totalInvestment)} subtitle={`רכישה + ${formatCurrency(summary.additionalPurchaseCosts)} עלויות`} />
            <StatCard label="שווי נוכחי" value={formatCurrency(summary.currentEstimatedValue)} subtitle={`${summary.equityGain >= 0 ? '+' : ''}${formatCurrency(summary.equityGain)} עליית ערך`} valueColor={summary.equityGain >= 0 ? 'text-blue-600' : 'text-blue-600'} />
            <StatCard label="תזרים חודשי ממוצע" value={formatCurrency(summary.monthlyNetCashFlow)} subtitle={summary.monthlyNetCashFlow >= 0 ? 'חיובי - נכנס יותר ממה שיוצא' : 'שלילי - יוצא יותר ממה שנכנס'} valueColor={summary.monthlyNetCashFlow >= 0 ? 'text-green-600' : 'text-red-600'} />
            <StatCard label="שיעור תפוסה" value={formatPercent(summary.occupancyRate * 100)} subtitle={summary.vacantMonths > 0 ? `${summary.vacantMonths} חודשים ריקים` : 'תפוסה מלאה'} valueColor={summary.occupancyRate > 0.9 ? 'text-green-600' : 'text-yellow-600'} />
          </div>

          {/* Detailed P&L - The Money Flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Money Out */}
            <div className="card">
              <h3 className="font-bold mb-4 text-lg flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                כסף שיצא (הוצאות)
              </h3>
              <div className="space-y-3">
                <FlowRow label="הון עצמי (מכיס)" amount={summary.totalInvestment - summary.totalMortgagePaid + summary.totalPrincipalPaid} color="text-red-600" />
                <FlowRow label="ריבית ששולמה לבנק" amount={summary.totalInterestPaid} color="text-red-600" />
                {summary.totalCpiPaid > 0 && (
                  <FlowRow label="הפרשי הצמדה למדד" amount={summary.totalCpiPaid} color="text-orange-600" />
                )}
                <FlowRow label="הוצאות תפעול (ועד, ביטוח, מיסים...)" amount={summary.totalExpenses} color="text-red-600" />
                <div className="border-t pt-2 mt-2 font-bold">
                  <FlowRow label='סה"כ כסף שיצא' amount={summary.totalMoneyIn} color="text-red-700" />
                </div>
              </div>
            </div>

            {/* Money In */}
            <div className="card">
              <h3 className="font-bold mb-4 text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                כסף/ערך שנכנס (הכנסות)
              </h3>
              <div className="space-y-3">
                <FlowRow label='סה"כ שכירות שהתקבלה' amount={summary.totalRentalIncome} color="text-green-600" />
                <FlowRow label="עליית ערך הנכס" amount={summary.equityGain} color={summary.equityGain >= 0 ? 'text-green-600' : 'text-red-600'} />
                <FlowRow label="קרן ששולמה (הון שנצבר בנכס)" amount={summary.totalPrincipalPaid} color="text-blue-600" />
                <div className="border-t pt-2 mt-2 font-bold">
                  <FlowRow label='סה"כ ערך שנצבר' amount={summary.totalRentalIncome + summary.equityGain + summary.totalPrincipalPaid} color="text-green-700" />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Line Box */}
          <div className="card mb-6 bg-gray-900 text-white">
            <h3 className="font-bold text-lg mb-3">שורה תחתונה - כמה באמת הרווחת?</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-gray-400 text-sm">רווח/הפסד נקי</p>
                <p className={`text-xl font-bold ${summary.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {summary.netProfit >= 0 ? '+' : ''}{formatCurrency(summary.netProfit)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">ROI כולל</p>
                <p className={`text-xl font-bold ${summary.totalROI >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(summary.totalROI)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Cash on Cash שנתי</p>
                <p className={`text-xl font-bold ${summary.cashOnCashReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(summary.cashOnCashReturn)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">יתרת משכנתא</p>
                <p className="text-xl font-bold text-yellow-400">
                  {formatCurrency(summary.remainingMortgage)}
                </p>
              </div>
            </div>
          </div>

          {/* Expense Breakdown Pie */}
          {Object.keys(summary.expensesByCategory).length > 0 && (
            <div className="card mb-6">
              <h3 className="font-bold mb-4 text-lg">חלוקת הוצאות</h3>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={Object.entries(summary.expensesByCategory).map(([name, value]) => ({ name: categoryLabel(name), value }))}
                      cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.keys(summary.expensesByCategory).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Cash Flow Charts */}
          {summary.monthlyCashFlow.length > 0 && (
            <>
              <div className="card mb-6">
                <h3 className="font-bold mb-4 text-lg">תזרים מזומנים חודשי</h3>
                <p className="text-sm text-gray-500 mb-4">כמה נכנס וכמה יצא כל חודש</p>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={summary.monthlyCashFlow}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatCurrency(v), chartLabel(name)]}
                      labelFormatter={(l) => `חודש: ${l}`}
                    />
                    <Legend formatter={chartLabel} />
                    <Bar dataKey="rentalIncome" fill="#10b981" name="rentalIncome" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="mortgagePayment" fill="#ef4444" name="mortgagePayment" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="expenses" fill="#f59e0b" name="expenses" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card mb-6">
                <h3 className="font-bold mb-4 text-lg">תזרים מצטבר לאורך זמן</h3>
                <p className="text-sm text-gray-500 mb-4">
                  {summary.monthlyCashFlow[summary.monthlyCashFlow.length - 1]?.cumulativeCashFlow >= 0
                    ? 'המגמה חיובית - נכנס יותר ממה שיצא'
                    : 'המגמה שלילית - יצא יותר ממה שנכנס (מתזרים בלבד, לא כולל עליית ערך)'}
                </p>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={summary.monthlyCashFlow}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatCurrency(v), chartLabel(name)]}
                      labelFormatter={(l) => `חודש: ${l}`}
                    />
                    <Legend formatter={chartLabel} />
                    <Line type="monotone" dataKey="cumulativeCashFlow" stroke="#3b82f6" strokeWidth={3} dot={false} name="cumulativeCashFlow" />
                    <Line type="monotone" dataKey="netCashFlow" stroke="#10b981" strokeWidth={1} dot={false} name="netCashFlow" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* No Data Hint */}
          {summary.monthlyCashFlow.length === 0 && (
            <div className="card mb-6 text-center py-8 bg-gray-50">
              <p className="text-gray-500 mb-2">אין עדיין נתוני תזרים חודשיים</p>
              <p className="text-sm text-gray-400 mb-4">הוסף תשלומי משכנתא ושכירות בדף הנכס כדי לראות גרפים</p>
              <Link to={`/property/${selectedProperty}`} className="btn-primary text-sm">עבור לנכס להוספת נתונים</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, subtitle, valueColor }: { label: string; value: string; subtitle?: string; valueColor?: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-value ${valueColor || 'text-gray-900'}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

function FlowRow({ label, amount, color }: { label: string; amount: number; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`font-medium ${color}`}>
        {formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}

function categoryLabel(key: string): string {
  const map: Record<string, string> = { maintenance: 'תחזוקה', tax: 'מיסים', insurance: 'ביטוח', management: 'ניהול', renovation: 'שיפוץ', legal: 'עו"ד', committee: 'ועד בית', other: 'אחר' };
  return map[key] || key;
}

function chartLabel(key: string): string {
  const map: Record<string, string> = { rentalIncome: 'הכנסות שכירות', mortgagePayment: 'תשלומי משכנתא', expenses: 'הוצאות', netCashFlow: 'תזרים חודשי', cumulativeCashFlow: 'תזרים מצטבר' };
  return map[key] || key;
}
