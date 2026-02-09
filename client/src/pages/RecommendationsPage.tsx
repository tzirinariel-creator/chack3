import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, ArrowDownRight, Home, DollarSign, Wrench } from 'lucide-react';
import { getProperties, getRecommendations } from '../api';
import { Property, Recommendation } from '../types';

const ICONS: Record<string, any> = {
  hold: Home,
  sell: DollarSign,
  refinance: TrendingUp,
  raise_rent: TrendingUp,
  reduce_expenses: Wrench,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'border-red-200 bg-red-50',
  medium: 'border-yellow-200 bg-yellow-50',
  low: 'border-green-200 bg-green-50',
};

const PRIORITY_LABELS: Record<string, string> = {
  high: 'דחיפות גבוהה',
  medium: 'דחיפות בינונית',
  low: 'מידע',
};

export default function RecommendationsPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
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
      getRecommendations(selectedProperty).then(r => {
        setRecommendations(r);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [selectedProperty]);

  if (loading && recommendations.length === 0) return <div className="text-center py-12 text-gray-500">טוען...</div>;
  if (properties.length === 0) return <div className="text-center py-12 text-gray-400">הוסף נכס וזנה נתונים כדי לקבל המלצות</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">המלצות</h2>
        {properties.length > 1 && (
          <select className="input-field w-auto" value={selectedProperty || ''} onChange={e => setSelectedProperty(Number(e.target.value))}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {recommendations.length === 0 ? (
        <div className="card text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">אין מספיק נתונים להפקת המלצות.</p>
          <p className="text-gray-400 text-sm mt-1">הוסף נתוני משכנתא, שוכרים והוצאות כדי לקבל ניתוח מלא.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec, i) => {
            const Icon = ICONS[rec.type] || AlertTriangle;
            return (
              <div key={i} className={`card border-2 ${PRIORITY_COLORS[rec.priority]}`}>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Icon className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg">{rec.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                        rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {PRIORITY_LABELS[rec.priority]}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-2">{rec.description}</p>
                    <div className="bg-white/60 rounded-lg p-3 border border-gray-200">
                      <p className="text-sm font-medium text-gray-700">
                        <ArrowDownRight className="w-4 h-4 inline ml-1" />
                        {rec.potentialImpact}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
