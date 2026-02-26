import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Layout>{children}</Layout>;
};

import Groups from './pages/Groups';
import GroupDetails from './pages/GroupDetails';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import Payments from './pages/Payments';
import Signup from './pages/Signup';
import FutureExpenses from './pages/FutureExpenses';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />

          <Route path="/groups" element={
            <ProtectedRoute><Groups /></ProtectedRoute>
          } />

          <Route path="/groups/:groupId" element={
            <ProtectedRoute><GroupDetails /></ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute><Analytics /></ProtectedRoute>
          } />

          <Route path="/payments" element={
            <ProtectedRoute><Payments /></ProtectedRoute>
          } />

          <Route path="/future" element={
            <ProtectedRoute><FutureExpenses /></ProtectedRoute>
          } />

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
