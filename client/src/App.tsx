import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Building2, LayoutDashboard, TrendingUp, Lightbulb } from 'lucide-react';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import DashboardPage from './pages/DashboardPage';
import ForecastPage from './pages/ForecastPage';
import RecommendationsPage from './pages/RecommendationsPage';

function App() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'נכסים', icon: Building2 },
    { path: '/dashboard', label: 'דשבורד', icon: LayoutDashboard },
    { path: '/forecast', label: 'תחזיות', icon: TrendingUp },
    { path: '/recommendations', label: 'המלצות', icon: Lightbulb },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Building2 className="w-8 h-8 text-primary-600" />
              <h1 className="text-xl font-bold text-gray-900">Chack3</h1>
              <span className="text-sm text-gray-400 mr-2">עוקב השקעות נדל"ן</span>
            </div>
            <nav className="flex gap-1">
              {navItems.map(({ path, label, icon: Icon }) => {
                const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Routes>
          <Route path="/" element={<PropertiesPage />} />
          <Route path="/property/:id" element={<PropertyDetailPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
