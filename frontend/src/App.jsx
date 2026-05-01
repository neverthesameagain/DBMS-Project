import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';

// Protected Route Wrapper
const ProtectedRoute = ({ children, userOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (userOnly && user.role === 'ADMIN') {
    return <Navigate to="/admin" />;
  }

  return <Layout>{children}</Layout>;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/" />;
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
import Ledger from './pages/Ledger';
import Budgets from './pages/Budgets';
import Profile from './pages/Profile';
import AdminDashboard from './admin/AdminDashboard';
import AdminUsers from './admin/AdminUsers';
import AdminTransactions from './admin/AdminTransactions';
import AdminTables from './admin/AdminTables';
import AdminQueryEngine from './admin/AdminQueryEngine';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/" element={
            <ProtectedRoute userOnly><Dashboard /></ProtectedRoute>
          } />

          <Route path="/groups" element={
            <ProtectedRoute userOnly><Groups /></ProtectedRoute>
          } />

          <Route path="/groups/:groupId" element={
            <ProtectedRoute userOnly><GroupDetails /></ProtectedRoute>
          } />

          <Route path="/analytics" element={
            <ProtectedRoute userOnly><Analytics /></ProtectedRoute>
          } />

          <Route path="/payments" element={
            <ProtectedRoute userOnly><Payments /></ProtectedRoute>
          } />

          <Route path="/future" element={
            <ProtectedRoute userOnly><FutureExpenses /></ProtectedRoute>
          } />

          <Route path="/ledger" element={
            <ProtectedRoute userOnly><Ledger /></ProtectedRoute>
          } />

          <Route path="/budgets" element={
            <ProtectedRoute userOnly><Budgets /></ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute userOnly><Profile /></ProtectedRoute>
          } />

          <Route path="/admin" element={
            <AdminRoute><AdminDashboard /></AdminRoute>
          } />

          <Route path="/admin/users" element={
            <AdminRoute><AdminUsers /></AdminRoute>
          } />

          <Route path="/admin/transactions" element={
            <AdminRoute><AdminTransactions /></AdminRoute>
          } />

          <Route path="/admin/tables" element={
            <AdminRoute><AdminTables /></AdminRoute>
          } />

          <Route path="/admin/query" element={
            <AdminRoute><AdminQueryEngine /></AdminRoute>
          } />

          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
