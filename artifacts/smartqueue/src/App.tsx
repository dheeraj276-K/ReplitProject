import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/hooks/use-auth';
import { ToastProvider } from '@/lib/toast-context';
import LandingPage from '@/pages/landing';
import AuthPage from '@/pages/auth';
import DashboardPage from '@/pages/dashboard';
import TokenDetailPage from '@/pages/token-detail';
import HistoryPage from '@/pages/history';
import ProfilePage from '@/pages/profile';
import AdminDashboardPage from '@/pages/admin-dashboard';
import AdminServicesPage from '@/pages/admin-services';
import AdminUsersPage from '@/pages/admin-users';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function AppRouter() {
  return <Switch>
    <Route path="/" component={LandingPage} />
    <Route path="/login"><AuthPage mode="login" /></Route>
    <Route path="/register"><AuthPage mode="register" /></Route>
    <Route path="/forgot-password"><AuthPage mode="forgot" /></Route>
    <Route path="/reset-password"><AuthPage mode="reset" /></Route>
    <Route path="/dashboard" component={DashboardPage} />
    <Route path="/token/:id" component={TokenDetailPage} />
    <Route path="/history" component={HistoryPage} />
    <Route path="/profile" component={ProfilePage} />
    <Route path="/admin" component={AdminDashboardPage} />
    <Route path="/admin/services" component={AdminServicesPage} />
    <Route path="/admin/users" component={AdminUsersPage} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <ToastProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <ErrorBoundary><AppRouter /></ErrorBoundary>
          </WouterRouter>
        </ToastProvider>
        <Toaster />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>;
}

export default App;
