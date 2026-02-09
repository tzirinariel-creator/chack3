import { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { getProperties, getInvestmentSummary } from '../api';
import { Property, InvestmentSummary } from '../types';
import { formatCurrency, formatPercent } from '../utils/format';

const COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function DashboardPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProperties().then(props => {
      setProperties(props);
      if (props.length > 0) setSelectedProperty(props[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      setLoading(true);
      getInvestmentSummary(selectedProperty).then(s => {
        setSummary(s);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [selectedProperty]);

  if (loading && !summary) return <div className="text-center py-12 text-gray-500">טוען...</div>;
  if (properties.length === 0) return <div className="text-center py-12 text-gray-400">הוסף נכס קודם כדי לראות נתונים</div>;

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

      {summary && (
        <>
          {/* Key Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label='סה"כ השקעה' value={formatCurrency(summary.totalInvestment)} color="text-gray-900" />
            <StatCard label="שווי נוכחי" value={formatCurrency(summary.currentEstimatedValue)} color="text-blue-600" />
            <StatCard label="רווח/הפסד נקי" value={formatCurrency(summary.netProfit)} color={summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'} />
            <StatCard label="ROI שנתי" value={formatPercent(summary.annualizedROI)} color={summary.annualizedROI >= 0 ? 'text-green-600' : 'text-red-600'} />
          </div>

          {/* Money Flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="card">
              <h3 className="font-bold mb-4 text-lg">כסף שנכנס vs כסף שיצא</h3>
              <div className="space-y-3">
                <FlowRow label="הון עצמי ששולם" amount={summary.totalInvestment - (summary.totalMortgagePaid > 0 ? summary.totalMortgagePaid - summary.totalInterestPaid - summary.totalCpiPaid : 0)} isExpense />
                <FlowRow label='סה"כ ריבית ששולמה' amount={summary.totalInterestPaid} isExpense />
                <FlowRow label="הצמדה למדד" amount={summary.totalCpiPaid} isExpense />
                <FlowRow label='סה"כ הוצאות' amount={summary.totalExpenses} isExpense />
                <div className="border-t pt-2 mt-2">
                  <FlowRow label='סה"כ הכנסות משכירות' amount={summary.totalRentalIncome} />
                  <FlowRow label="עליית ערך" amount={summary.equityGain} />
                  <FlowRow label="קרן ששולמה (הון שנצבר)" amount={summary.totalPrincipalPaid} />
                </div>
                <div className="border-t pt-2 font-bold text-lg">
                  <FlowRow label="שורה תחתונה" amount={summary.netProfit} />
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-bold mb-4 text-lg">חלוקת הוצאות</h3>
              {Object.keys(summary.expensesByCategory).length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={Object.entries(summary.expensesByCategory).map(([name, value]) => ({ name: categoryLabel(name), value }))}
                      cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.keys(summary.expensesByCategory).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-400 text-center py-8">אין נתוני הוצאות</p>
              )}
            </div>
          </div>

          {/* Cash Flow Chart */}
          {summary.monthlyCashFlow.length > 0 && (
            <div className="card mb-6">
              <h3 className="font-bold mb-4 text-lg">תזרים מזומנים חודשי</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={summary.monthlyCashFlow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatCurrency(v), chartLabel(name)]}
                    labelFormatter={(l) => l}
                  />
                  <Legend formatter={chartLabel} />
                  <Bar dataKey="rentalIncome" fill="#10b981" name="rentalIncome" />
                  <Bar dataKey="mortgagePayment" fill="#ef4444" name="mortgagePayment" />
                  <Bar dataKey="expenses" fill="#f59e0b" name="expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Cumulative Cash Flow */}
          {summary.monthlyCashFlow.length > 0 && (
            <div className="card mb-6">
              <h3 className="font-bold mb-4 text-lg">תזרים מצטבר</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={summary.monthlyCashFlow}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Line type="monotone" dataKey="cumulativeCashFlow" stroke="#3b82f6" strokeWidth={2} dot={false} name="תזרים מצטבר" />
                  <Line type="monotone" dataKey="netCashFlow" stroke="#10b981" strokeWidth={1} dot={false} name="תזרים חודשי" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label='Cash on Cash שנתי' value={formatPercent(summary.cashOnCashReturn)} color={summary.cashOnCashReturn >= 0 ? 'text-green-600' : 'text-red-600'} />
            <StatCard label="תזרים חודשי ממוצע" value={formatCurrency(summary.monthlyNetCashFlow)} color={summary.monthlyNetCashFlow >= 0 ? 'text-green-600' : 'text-red-600'} />
            <StatCard label="שיעור תפוסה" value={formatPercent(summary.occupancyRate * 100)} color={summary.occupancyRate > 0.9 ? 'text-green-600' : 'text-yellow-600'} />
            <StatCard label="יתרת משכנתא" value={formatCurrency(summary.remainingMortgage)} color="text-gray-700" />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="stat-card">
      <div className={`stat-value ${color}`}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function FlowRow({ label, amount, isExpense }: { label: string; amount: number; isExpense?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`font-medium ${isExpense ? 'text-red-600' : amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {isExpense ? '-' : ''}{formatCurrency(Math.abs(amount))}
      </span>
    </div>
  );
}

function categoryLabel(key: string): string {
  const map: Record<string, string> = { maintenance: 'תחזוקה', tax: 'מיסים', insurance: 'ביטוח', management: 'ניהול', renovation: 'שיפוץ', legal: 'עו"ד', committee: 'ועד בית', other: 'אחר' };
  return map[key] || key;
}

function chartLabel(key: string): string {
  const map: Record<string, string> = { rentalIncome: 'הכנסות שכירות', mortgagePayment: 'תשלומי משכנתא', expenses: 'הוצאות', netCashFlow: 'תזרים נקי', cumulativeCashFlow: 'תזרים מצטבר' };
  return map[key] || key;
}
