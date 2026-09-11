import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Onboarding from '@/pages/Onboarding';
import Dashboard from '@/pages/Dashboard';
import Insights from '@/pages/Insights';
import Previsions from '@/pages/Previsions';
import Simulateur from '@/pages/Simulateur';
import Decisions from '@/pages/Decisions';
import Historique from '@/pages/Historique';
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
import PolitiqueConfidentialite from '@/pages/PolitiqueConfidentialite';
import Clients from '@/pages/Clients';
import Produits from '@/pages/Produits';
import Marketing from '@/pages/Marketing';
import Tresorerie from '@/pages/Tresorerie';
import Audit from '@/pages/Audit';

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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/previsions" element={<Previsions />} />
          <Route path="/simulateur" element={<Simulateur />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/historique" element={<Historique />} />
          <Route path="/importer" element={<ImportPage />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/produits" element={<Produits />} />
          <Route path="/marketing" element={<Marketing />} />
          <Route path="/tresorerie" element={<Tresorerie />} />
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
          <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
        </Route>
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