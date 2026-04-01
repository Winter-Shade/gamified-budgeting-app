import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WalletProvider } from './context/WalletContext';
import Layout from './components/Layout';

import Login        from './pages/Login';
import Dashboard    from './pages/Dashboard';
import Expenses     from './pages/Expenses';
import Accounts     from './pages/Accounts';
import Budgets      from './pages/Budgets';
import Leaderboard  from './pages/Leaderboard';
import Analyse      from './pages/Analyse';
import CalendarPage from './pages/Calendar';
import Challenges   from './pages/Challenges';
import Friends      from './pages/Friends';
import Trading      from './pages/Trading';
import Subscriptions from './pages/Subscriptions';
import Categories    from './pages/Categories';
import Goals         from './pages/Goals';
import Carbon        from './pages/Carbon';
import Challenge250  from './pages/Challenge250';
import DailySavings  from './pages/DailySavings';
import BlockchainSavings from './pages/BlockchainSavings';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'#07070e' }}>
      <div className="spinner" style={{ width:32, height:32 }} />
    </div>
  );
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const RootRoute = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <WalletProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<RootRoute />} />
              <Route path="dashboard"     element={<Dashboard />} />
              <Route path="expenses"      element={<Expenses />} />
              <Route path="accounts"      element={<Accounts />} />
              <Route path="budgets"       element={<Budgets />} />
              <Route path="leaderboard"   element={<Leaderboard />} />
              <Route path="analyse"       element={<Analyse />} />
              <Route path="calendar"      element={<CalendarPage />} />
              <Route path="challenges"    element={<Challenges />} />
              <Route path="friends"       element={<Friends />} />
              <Route path="trading"       element={<Trading />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="categories"    element={<Categories />} />
              <Route path="goals"          element={<Goals />} />
              <Route path="carbon"         element={<Carbon />} />
              <Route path="challenge-250"  element={<Challenge250 />} />
              <Route path="daily-savings"  element={<DailySavings />} />
              <Route path="blockchain-savings" element={<BlockchainSavings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </WalletProvider>
    </AuthProvider>
  );
}

export default App;
