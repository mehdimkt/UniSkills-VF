import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './views/LoginPage';
import AppLayout from './components/AppLayout';
import Dashboard from './views/Dashboard';
import Marketplace from './views/Marketplace';
import Orders from './views/Orders';
import Messages from './views/Messages';
import Profile from './views/Profile';
import AdminPanel from './views/AdminPanel';
import Favorites from './views/Favorites';
import MyRequests from './views/MyRequests';
import MyServices from './views/MyServices';
import UniWallet from './views/UniWallet';
import Proposals from './views/Proposals';  // ← AJOUTEZ CET IMPORT

function AppContent() {
  const { user, isLoading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [inquiryContext, setInquiryContext] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleNavigate = (view: string, context?: any) => {
    setActiveView(view);
    if (context) {
      setInquiryContext(context);
    }
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
      case 'marketplace': return <Marketplace onNavigate={handleNavigate} initialData={inquiryContext} />;
      case 'favorites': return <Favorites onNavigate={handleNavigate} />;
      case 'requests': return <MyRequests onNavigate={handleNavigate} initialData={inquiryContext} />;
      case 'my_services': return <MyServices onNavigate={handleNavigate} />;
      case 'orders': return <Orders onNavigate={handleNavigate} />;
      case 'proposals': return <Proposals onNavigate={handleNavigate} />;  // ← CORRIGÉ
      case 'messages': return <Messages 
  inquiryContext={inquiryContext} 
  onClearContext={() => setInquiryContext(null)} 
  onNavigate={handleNavigate}/>;
      case 'profile': return <Profile />;
      case 'admin': return <AdminPanel />;
      case 'unicoin': return <UniWallet />;
      default: return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout activeTab={activeView} onTabChange={handleNavigate}>
      {renderView()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}