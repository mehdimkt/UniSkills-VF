import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
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
import Proposals from './views/Proposals';
import Support from './views/Support';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [inquiryContext, setInquiryContext] = useState<any>(null);

  // ✅ Redirection Admin par défaut
  React.useEffect(() => {
    if (user?.email === 'admin@uniskills.ma' && activeView === 'dashboard') {
      setActiveView('admin_dashboard');
    }
  }, [user, activeView]);

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

  const renderView = (viewId: string) => {
    // Cas spécial pour les vues admin qui sont plus dynamiques
    if (activeView.startsWith('admin_')) {
      if (viewId === 'admin') return <AdminPanel subTabContext={{ subTab: activeView.replace('admin_', '') }} />;
      return null;
    }

    switch (viewId) {
      case 'dashboard': return <Dashboard onNavigate={handleNavigate} />;
      case 'marketplace': return <Marketplace onNavigate={handleNavigate} initialData={inquiryContext} />;
      case 'favorites': return <Favorites onNavigate={handleNavigate} />;
      case 'requests': return <MyRequests onNavigate={handleNavigate} initialData={inquiryContext} />;
      case 'my_services': return <MyServices onNavigate={handleNavigate} />;
      case 'orders': return <Orders onNavigate={handleNavigate} />;
      case 'proposals': return <Proposals onNavigate={handleNavigate} />;
      case 'messages': return <Messages 
        inquiryContext={inquiryContext} 
        onClearContext={() => setInquiryContext(null)} 
        onNavigate={handleNavigate}/>;
      case 'profile': return <Profile />;
      case 'admin': return <AdminPanel subTabContext={inquiryContext} />;
      case 'support': return <Support />;
      case 'unicoin': return <UniWallet />;
      default: return null;
    }
  };

  const mainViews = [
    'dashboard', 'marketplace', 'messages', 'orders', 'proposals', 
    'requests', 'my_services', 'favorites', 'profile', 'unicoin', 'admin', 'support'
  ];

  return (
    <AppLayout activeTab={activeView} onTabChange={handleNavigate}>
      <div className="flex-1 relative min-h-0 w-full h-full flex flex-col overflow-hidden">
        {mainViews.map(viewId => (
          <div 
            key={viewId} 
            className={cn(
              "absolute inset-0 transition-opacity duration-300 flex flex-col min-h-0 overflow-hidden",
              activeView === viewId || (activeView.startsWith('admin_') && viewId === 'admin')
                ? "opacity-100 z-10 pointer-events-auto" 
                : "opacity-0 z-0 pointer-events-none"
            )}
          >
            {viewId === 'messages' ? (
              renderView(viewId)
            ) : (
              <div className={cn(
                "flex-1 overflow-y-auto w-full h-full custom-scrollbar",
                (activeView === 'admin' || activeView.startsWith('admin_')) ? "p-0" : "pt-4 lg:pt-6 px-4 lg:px-8 pb-20"
              )}>
                {renderView(viewId)}
              </div>
            )}
          </div>
        ))}
      </div>
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