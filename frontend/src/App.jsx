import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DAMWorkflow from './pages/DAMWorkflow';
import DAMUpload from './pages/DAMUpload';
import DAMApprovals from './pages/DAMApprovals';
import WCMComposer from './pages/WCMComposer';
import WCMContentList from './pages/WCMContentList';
import WCMApprovals from './pages/WCMApprovals';
import Microsite from './pages/Microsite';
import MicrositeDetail from './pages/MicrositeDetail';
import AICreativeStudio from './pages/AICreativeStudio';
import Settings from './pages/Settings';
import LoadingSpinner from './components/LoadingSpinner';

function ProtectedRoute({ children, requiredRoles = [] }) {
  const { isAuthenticated, loading, hasAnyRole } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-150">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles.length > 0 && !hasAnyRole(requiredRoles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-150">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        
        {/* DAM Workflow Routes */}
        <Route path="dam">
          <Route index element={<DAMWorkflow />} />
          <Route 
            path="upload" 
            element={
              <ProtectedRoute requiredRoles={['dxcontentauthors', 'wpsadmin']}>
                <DAMUpload />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="approvals" 
            element={
              <ProtectedRoute requiredRoles={['dxcontentapprovers', 'wpsadmin']}>
                <DAMApprovals />
              </ProtectedRoute>
            } 
          />
        </Route>
        
        {/* WCM Composer Routes */}
        <Route path="wcm">
          <Route index element={<WCMContentList />} />
          <Route 
            path="compose" 
            element={
              <ProtectedRoute requiredRoles={['dxcontentauthors', 'wpsadmin']}>
                <WCMComposer />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="edit/:id" 
            element={
              <ProtectedRoute requiredRoles={['dxcontentauthors', 'wpsadmin']}>
                <WCMComposer />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="approvals" 
            element={
              <ProtectedRoute requiredRoles={['dxcontentapprovers', 'wpsadmin']}>
                <WCMApprovals />
              </ProtectedRoute>
            } 
          />
        </Route>
        
        {/* AI Creative Studio Route */}
        <Route 
          path="ai-studio" 
          element={
            <ProtectedRoute requiredRoles={['dxcontentauthors', 'wpsadmin']}>
              <AICreativeStudio />
            </ProtectedRoute>
          } 
        />
        
        {/* Microsite Routes with locale support */}
        <Route path="microsite">
          <Route index element={<Microsite />} />
          <Route path=":lang" element={<Microsite />} />
          <Route path=":lang/:type/:id" element={<MicrositeDetail />} />
          <Route path=":type/:id" element={<MicrositeDetail />} />
        </Route>
        
        {/* Settings Route - Admin Only */}
        <Route 
          path="settings" 
          element={
            <ProtectedRoute requiredRoles={['wpsadmin']}>
              <Settings />
            </ProtectedRoute>
          } 
        />
      </Route>
      
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
