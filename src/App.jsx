import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Layout from '@/components/Layout';
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import Insights from '@/pages/Insights';
import ImportPage from '@/pages/Import';
import Kpis from '@/pages/Kpis';
import Anomalies from '@/pages/Anomalies';
import Risques from '@/pages/Risques';
import Recommandations from '@/pages/Recommandations';
import Radar from '@/pages/Radar';
import Taches from '@/pages/Taches';
import Alertes from '@/pages/Alertes';
import Rapports from '@/pages/Rapports';
import Assistant from '@/pages/Assistant';
import Parametres from '@/pages/Parametres';
import Manuel from '@/pages/Manuel';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Add your page Route elements here */}
      <Route path="/onboarding" element={<Onboarding />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/importer" element={<ImportPage />} />
        <Route path="/kpis" element={<Kpis />} />
        <Route path="/anomalies" element={<Anomalies />} />
        <Route path="/risques" element={<Risques />} />
        <Route path="/recommandations" element={<Recommandations />} />
        <Route path="/radar" element={<Radar />} />
        <Route path="/taches" element={<Taches />} />
        <Route path="/alertes" element={<Alertes />} />
        <Route path="/rapports" element={<Rapports />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/parametres" element={<Parametres />} />
        <Route path="/manuel" element={<Manuel />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App