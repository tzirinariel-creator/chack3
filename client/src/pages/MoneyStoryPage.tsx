import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProperties, getSaleCalculation } from '../api';
import { Property } from '../types';
import { formatCurrency, formatPercent } from '../utils/format';
import { Home, Landmark, Users, Receipt, HandCoins, Calculator, ChevronDown, ChevronUp, AlertCircle, ArrowLeft } from 'lucide-react';

export default function MoneyStoryPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [salePrice, setSalePrice] = useState('1050000');
  const [story, setStory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getProperties().then(props => {
      setProperties(props);
      if (props.length > 0) {
        setSelectedProperty(props[0].id);
        if (props[0].current_estimated_value) {
          setSalePrice(String(props[0].current_estimated_value));
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedProperty && salePrice) {
      setLoading(true);
      setError('');
      getSaleCalculation(selectedProperty, Number(salePrice))
        .then(s => { setStory(s); setLoading(false); })
        .catch(err => { setError(err.message); setLoading(false); });
    }
  }, [selectedProperty, salePrice]);

  if (!loading && properties.length === 0) {
    return (
      <div className="text-center py-16">
        <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">אין נכסים עדיין</h3>
        <p className="text-gray-400 mb-6">הוסף נכס והכנס נתונים כדי לראות את הסיפור של הכסף</p>
        <Link to="/" className="btn-primary">עבור לנכסים</Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold mb-2">הסיפור של הכסף שלי</h2>
      <p className="text-gray-500 mb-6">מה בדיוק קרה לכל שקל מאז שקנית את הדירה</p>

      {properties.length > 1 && (
        <select className="input-field w-auto mb-4" value={selectedProperty || ''} onChange={e => setSelectedProperty(Number(e.target.value))}>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}

      {/* Sale price input */}
      <div className="card mb-6 bg-blue-50 border border-blue-200">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6 text-blue-600" />
          <div className="flex-1">
            <label className="text-sm font-medium text-blue-800">מחיר מכירה (לצורך החישוב)</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                className="input-field w-48"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                placeholder="1,050,000"
              />
              <span className="text-sm text-blue-600">ש"ח</span>
            </div>
          </div>
        </div>
      </div>

      {loading && <div className="text-center py-8 text-gray-500">מחשב...</div>}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm text-yellow-800">הוסף נתונים בדף הנכס כדי לראות את הסיפור המלא</p>
            <Link to={`/property/${selectedProperty}`} className="text-sm text-blue-600 font-medium">עבור לנכס</Link>
          </div>
        </div>
      )}

      {story && (
        <div className="space-y-4">
          {/* Chapter 1: The Purchase */}
          <StoryChapter
            number={1}
            title="הרכישה"
            icon={<Home className="w-5 h-5" />}
            color="blue"
            summary={`קנית את הדירה ב-${formatCurrency(story.purchase.propertyPrice)}`}
          >
            <StoryRow label="מחיר הדירה" value={formatCurrency(story.purchase.propertyPrice)} />
            <StoryRow label='עלויות נוספות (עו"ד, מס, תיווך, שיפוץ)' value={formatCurrency(story.purchase.additionalCosts)} />
            <StoryRow label='סה"כ עלות רכישה' value={formatCurrency(story.purchase.totalPurchaseCost)} bold />
            <div className="mt-3 pt-3 border-t border-gray-100">
              <StoryRow label="משכנתא שלקחת" value={formatCurrency(story.purchase.mortgageAmount)} />
              <StoryRow label="הון עצמי (מכיס)" value={formatCurrency(story.purchase.downPayment)} bold color="red" />
            </div>
          </StoryChapter>

          {/* Chapter 2: The Mortgage */}
          <StoryChapter
            number={2}
            title="המשכנתא"
            icon={<Landmark className="w-5 h-5" />}
            color="red"
            summary={`שילמת ${formatCurrency(story.mortgage.totalPaid)} ב-${story.bottomLine.monthsOwned} חודשים`}
          >
            <StoryRow label='סה"כ תשלומי משכנתא' value={formatCurrency(story.mortgage.totalPaid)} bold />
            <div className="mt-2 mr-4 space-y-1">
              <StoryRow label="מתוכם קרן (הכסף שבאמת הצטמצם מהחוב)" value={formatCurrency(story.mortgage.principalPaid)} color="green" />
              <StoryRow label="מתוכם ריבית (כסף שהלך לבנק)" value={formatCurrency(story.mortgage.interestPaid)} color="red" />
              {story.mortgage.cpiPaid > 0 && (
                <StoryRow label="מתוכם הצמדה למדד" value={formatCurrency(story.mortgage.cpiPaid)} color="orange" />
              )}
            </div>
            <div className="mt-3 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>{story.mortgage.interestPercentage}%</strong> מכל שקל ששילמת על המשכנתא הלך <strong>לריבית</strong> - לא הצטמצם מהחוב.
              </p>
            </div>
            <div className="mt-2">
              <StoryRow label="תשלום חודשי ממוצע" value={formatCurrency(story.mortgage.monthlyAverage)} />
              <StoryRow label="יתרת משכנתא (מה שנשאר לשלם)" value={formatCurrency(story.mortgage.remainingBalance)} bold color="orange" />
            </div>
          </StoryChapter>

          {/* Chapter 3: Rental Income */}
          <StoryChapter
            number={3}
            title="הכנסות משכירות"
            icon={<Users className="w-5 h-5" />}
            color="green"
            summary={`קיבלת ${formatCurrency(story.rental.totalIncome)} שכירות`}
          >
            <StoryRow label='סה"כ שכירות שהתקבלה' value={formatCurrency(story.rental.totalIncome)} bold color="green" />
            <StoryRow label="שכירות חודשית ממוצעת" value={formatCurrency(story.rental.averageMonthlyRent)} />
            <StoryRow label="שיעור תפוסה" value={formatPercent(story.rental.occupancyRate * 100)} />
            {story.rental.vacantMonths > 0 && (
              <div className="mt-2 p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  הדירה עמדה ריקה <strong>{story.rental.vacantMonths} חודשים</strong> -
                  הפסדת כ-<strong>{formatCurrency(story.rental.lostRentFromVacancy)}</strong> בשכירות
                </p>
              </div>
            )}
          </StoryChapter>

          {/* Chapter 4: Expenses */}
          <StoryChapter
            number={4}
            title="הוצאות תפעול"
            icon={<Receipt className="w-5 h-5" />}
            color="orange"
            summary={story.expenses.total > 0 ? `${formatCurrency(story.expenses.total)} הוצאות` : 'לא הוזנו הוצאות'}
          >
            {story.expenses.total > 0 ? (
              <>
                <StoryRow label='סה"כ הוצאות' value={formatCurrency(story.expenses.total)} bold color="red" />
                <StoryRow label="ממוצע חודשי" value={formatCurrency(story.expenses.monthlyAverage)} />
                {Object.keys(story.expenses.byCategory).length > 0 && (
                  <div className="mt-2 mr-4 space-y-1">
                    {Object.entries(story.expenses.byCategory as Record<string, number>)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cat, amount]) => (
                        <StoryRow key={cat} label={categoryLabel(cat)} value={formatCurrency(amount)} />
                      ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">לא הוזנו הוצאות. הוסף הוצאות בדף הנכס (ועד בית, ביטוח, ארנונה, תיקונים...)</p>
            )}
          </StoryChapter>

          {/* Chapter 5: The Sale */}
          <StoryChapter
            number={5}
            title="אם תמכור"
            icon={<HandCoins className="w-5 h-5" />}
            color="purple"
            summary={`תקבל ליד ${formatCurrency(story.sale.cashInHand)} אחרי הכל`}
            defaultOpen
          >
            <StoryRow label="מחיר מכירה" value={formatCurrency(story.sale.salePrice)} bold />
            <p className="text-xs text-gray-500 font-medium mt-3 mb-1">עלויות מכירה:</p>
            <div className="mr-4 space-y-1">
              <StoryRow label="עמלת מתווך (2%)" value={`-${formatCurrency(story.sale.agentFee)}`} color="red" />
              <StoryRow label='עו"ד' value={`-${formatCurrency(story.sale.lawyerFee)}`} color="red" />
              {story.sale.capitalGainsTax > 0 && (
                <StoryRow label="מס שבח (25% על הרווח)" value={`-${formatCurrency(story.sale.capitalGainsTax)}`} color="red" />
              )}
            </div>
            <StoryRow label="נטו ממכירה" value={formatCurrency(story.sale.netFromSale)} />
            <StoryRow label="פירעון יתרת משכנתא" value={`-${formatCurrency(story.sale.mortgagePayoff)}`} color="red" />
            <div className="mt-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-700 mb-1">מה נשאר ביד אחרי מכירה ופירעון משכנתא:</p>
              <p className="text-2xl font-bold text-purple-900">{formatCurrency(story.sale.cashInHand)}</p>
            </div>
          </StoryChapter>

          {/* Chapter 6: THE BOTTOM LINE */}
          <div className="card bg-gray-900 text-white">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center text-sm font-bold">6</span>
              השורה התחתונה
            </h3>

            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-gray-800">
                <p className="text-gray-400 text-sm mb-1">כמה הוצאת מכיס לאורך כל התקופה:</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">הון עצמי (מקדמה)</span>
                    <span>{formatCurrency(story.bottomLine.downPayment)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">ריבית + הצמדה ששילמת</span>
                    <span>{formatCurrency(story.bottomLine.totalInterestAndCpi)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">הוצאות (ועד, ביטוח, תיקונים...)</span>
                    <span>{formatCurrency(story.bottomLine.totalExpenses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">שכירות שקיבלת</span>
                    <span className="text-green-400">+{formatCurrency(story.bottomLine.totalRentalReceived)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>עלות חודשית ממוצעת נטו (משכנתא+הוצאות-שכירות)</span>
                    <span className={story.bottomLine.netMonthlyCostAvg > 0 ? 'text-red-400' : 'text-green-400'}>
                      {formatCurrency(story.bottomLine.netMonthlyCostAvg)}/חודש
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-gray-800">
                <p className="text-gray-400 text-sm mb-1">אם תמכור ב-{formatCurrency(Number(salePrice))} - מה נשאר ביד:</p>
                <p className="text-2xl font-bold text-yellow-400">{formatCurrency(story.sale.cashInHand)}</p>
              </div>

              <div className={`p-6 rounded-lg ${story.bottomLine.totalProfitOrLoss >= 0 ? 'bg-green-900' : 'bg-red-900'}`}>
                <p className="text-sm mb-2 opacity-80">
                  רווח/הפסד כולל ({story.bottomLine.yearsOwned} שנים):
                </p>
                <p className="text-4xl font-bold">
                  {story.bottomLine.totalProfitOrLoss >= 0 ? '+' : ''}{formatCurrency(story.bottomLine.totalProfitOrLoss)}
                </p>
                <p className="text-sm mt-2 opacity-70">
                  = כסף ביד ממכירה + שכירות שקיבלת - כל מה שהוצאת (מקדמה, ריבית, הוצאות)
                </p>
              </div>
            </div>
          </div>

          {/* Missing data hint */}
          <div className="card bg-gray-50 text-center">
            <p className="text-sm text-gray-500 mb-2">החישוב מדויק ככל שהנתונים שלך מלאים יותר</p>
            <Link to={`/property/${selectedProperty}`} className="text-primary-600 text-sm font-medium">
              עבור לדף הנכס להוספת/עדכון נתונים
              <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function StoryChapter({ number, title, icon, color, summary, children, defaultOpen }: {
  number: number; title: string; icon: React.ReactNode; color: string; summary: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || false);
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 text-right">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
          {number}
        </span>
        <div className={`p-2 rounded-lg ${colorMap[color]} bg-opacity-30`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-sm text-gray-500">{summary}</p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

function StoryRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  const colorClass = color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'orange' ? 'text-orange-600' : '';
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`${bold ? 'font-bold text-lg' : 'font-medium'} ${colorClass}`}>{value}</span>
    </div>
  );
}

function categoryLabel(key: string): string {
  const map: Record<string, string> = { maintenance: 'תחזוקה', tax: 'מיסים', insurance: 'ביטוח', management: 'ניהול', renovation: 'שיפוץ', legal: 'עו"ד', committee: 'ועד בית', other: 'אחר' };
  return map[key] || key;
}
