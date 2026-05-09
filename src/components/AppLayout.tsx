// src/components/AppLayout.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Heart,
  MessageSquare,
  User,
  LogOut,
  Menu,
  X,
  Shield,
  FileText,
  Package,
  Coins,
  Wallet,
  Bell,
  ChevronDown,
  RefreshCw,
  CheckCheck,
  Eye,
  AlertTriangle,
  Zap,
  LifeBuoy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Handshake } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AppLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string, context?: any) => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'order' | 'message' | 'proposal';
  read: boolean;
  created_at: string;
  link?: string;
  linkData?: any;
}

// ✅ Compteurs de notifications par section
interface SectionCounts {
  orders: number;
  proposals: number;
  messages: number;
  dashboard: number;
  marketplace: number;
  favorites: number;
  my_services: number;
  requests: number;
  profile: number;
  unicoin: number;
  admin: number;
}

export default function AppLayout({ children, activeTab, onTabChange }: AppLayoutProps) {
  const { user, role, logout, switchRole } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);

  // ✅ États pour les compteurs de notifications par section
  const [sectionCounts, setSectionCounts] = useState<SectionCounts>({
    orders: 0,
    proposals: 0,
    messages: 0,
    dashboard: 0,
    marketplace: 0,
    favorites: 0,
    my_services: 0,
    requests: 0,
    profile: 0,
    unicoin: 0,
    admin: 0
  });

  const sidebarRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  const isAideur = role === 'aideur';

  // Helper pour obtenir le nom complet
  const getUserDisplayName = () => {
    if (!user) return '';
    return (
      user.full_name ||
      `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
      user.email ||
      'Utilisateur'
    );
  };

  // Fermer les menus au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setSidebarOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node) && 
          bellButtonRef.current && !bellButtonRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fermer les menus avec Echap
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Charger le solde du wallet
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchWalletBalance = async () => {
      try {
        const { data, error } = await supabase
          .from('unicoin_wallets')
          .select('balance')
          .eq('user_id', user.id)
          .single();
        setWalletBalance(data && !error ? data.balance : 0);
      } catch (err) {
        console.error('Error fetching wallet balance:', err);
        setWalletBalance(0);
      }
    };

    fetchWalletBalance();

    // ✅ ABONNEMENT TEMPS RÉEL POUR LE SOLDE GLOBAL
    const walletChannel = supabase
      .channel('global_wallet')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unicoin_wallets', filter: `user_id=eq.${user.id}` },
        () => fetchWalletBalance()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
    };
  }, [user?.id]);

  // ✅ Charger les notifications et calculer les compteurs par section
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (data) {
        const mappedData = data.map((n: any) => ({
          ...n,
          linkData: n.link_data // Map DB column to frontend property
        }));
        setNotifications(mappedData);
        const unread = mappedData.filter((n: any) => !n.read).length;
        setUnreadCount(unread);

        // ✅ Calculer les compteurs par section (uniquement les non lues)
        const counts: SectionCounts = {
          orders: 0,
          proposals: 0,
          messages: 0,
          dashboard: 0,
          marketplace: 0,
          favorites: 0,
          my_services: 0,
          requests: 0,
          profile: 0,
          unicoin: 0,
          admin: 0
        };

        data.forEach((notif: any) => {
          if (notif.read) return;

          const link = notif.link;
          if (link === 'orders') counts.orders++;
          else if (link === 'proposals') counts.proposals++;
          else if (link === 'messages') counts.messages++;
          else if (link === 'dashboard') counts.dashboard++;
          else if (link === 'marketplace') counts.marketplace++;
          else if (link === 'favorites') counts.favorites++;
          else if (link === 'my_services') counts.my_services++;
          else if (link === 'requests') counts.requests++;
          else if (link === 'profile') counts.profile++;
          else if (link === 'unicoin') counts.unicoin++;
          else if (link === 'admin') counts.admin++;
          else {
            // Par défaut selon le type
            switch (notif.type) {
              case 'order': counts.orders++; break;
              case 'proposal': counts.proposals++; break;
              case 'message': counts.messages++; break;
              default: counts.dashboard++;
            }
          }
        });

        setSectionCounts(counts);
      }
    };

    fetchNotifications();

    // Subscription en temps réel
    const subscription = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` },
        (payload) => {
          const newNotif = {
            ...(payload.new as any),
            linkData: (payload.new as any).link_data
          } as Notification;
          setNotifications(prev => [newNotif, ...prev]);
          setUnreadCount(prev => prev + 1);

          // Mettre à jour le compteur de section
          const link = newNotif.link;
          if (link === 'orders' && activeTab !== 'orders') {
            setSectionCounts(prev => ({ ...prev, orders: prev.orders + 1 }));
          } else if (link === 'proposals' && activeTab !== 'proposals') {
            setSectionCounts(prev => ({ ...prev, proposals: prev.proposals + 1 }));
          } else if (link === 'messages' && activeTab !== 'messages') {
            setSectionCounts(prev => ({ ...prev, messages: prev.messages + 1 }));
          } else if (!link) {
            const type = newNotif.type;
            if (type === 'order' && activeTab !== 'orders') {
              setSectionCounts(prev => ({ ...prev, orders: prev.orders + 1 }));
            } else if (type === 'proposal' && activeTab !== 'proposals') {
              setSectionCounts(prev => ({ ...prev, proposals: prev.proposals + 1 }));
            } else if (type === 'message' && activeTab !== 'messages') {
              setSectionCounts(prev => ({ ...prev, messages: prev.messages + 1 }));
            } else if (activeTab !== 'dashboard') {
              setSectionCounts(prev => ({ ...prev, dashboard: prev.dashboard + 1 }));
            }
          }
        }
      )
      .subscribe();

    return () => { subscription.unsubscribe(); };
  }, [user?.id]);

  // ✅ Marquer les notifications d'une section comme lues quand l'utilisateur visite cette section
  const markSectionAsRead = async (section: string) => {
    const oldCount = sectionCounts[section as keyof SectionCounts] || 0;
    if (oldCount === 0) return;

    const notificationsToUpdate = notifications.filter(n => {
      if (!n.read) {
        const link = n.link;
        if (link === section) return true;
        if (!link && n.type === section.slice(0, -1)) return true;
        if (section === 'orders' && n.type === 'order') return true;
        if (section === 'proposals' && n.type === 'proposal') return true;
        if (section === 'messages' && n.type === 'message') return true;
      }
      return false;
    });

    if (notificationsToUpdate.length > 0) {
      const ids = notificationsToUpdate.map(n => n.id);
      await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .in('id', ids);

      setNotifications(prev => prev.map(n =>
        ids.includes(n.id) ? { ...n, read: true } : n
      ));

      setSectionCounts(prev => ({ ...prev, [section]: 0 }));
      setUnreadCount(prev => Math.max(0, prev - ids.length));
    }
  };

  // Gestion du survol de l'icône cloche
  const handleBellMouseEnter = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
    setShowNotifications(true);
  };

  const handleBellMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowNotifications(false);
    }, 300);
    setHoverTimeout(timeout);
  };

  const handleNotificationMouseEnter = () => {
    if (hoverTimeout) clearTimeout(hoverTimeout);
  };

  const handleNotificationMouseLeave = () => {
    const timeout = setTimeout(() => {
      setShowNotifications(false);
    }, 300);
    setHoverTimeout(timeout);
  };

  // Gestion du clic sur une notification
  const handleNotificationClick = async (notification: Notification) => {
    // Marquer comme lue individuellement
    setNotifications(prev => prev.map(n =>
      n.id === notification.id ? { ...n, read: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev - 1));

    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notification.id);

    setShowNotifications(false);

    // Rediriger selon le type de notification
    let targetSection = notification.link || '';
    if (!targetSection) {
      switch (notification.type) {
        case 'order': targetSection = 'orders'; break;
        case 'message': targetSection = 'messages'; break;
        case 'proposal': targetSection = 'proposals'; break;
        default: targetSection = 'dashboard';
      }
    }

    // Marquer la section comme visitée pour faire disparaître le badge
    setSectionCounts(prev => ({ ...prev, [targetSection as keyof SectionCounts]: 0 }));
    
    onTabChange(targetSection, notification.linkData);
  };

  // Marquer toutes comme lues
  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
    setSectionCounts({
      orders: 0, proposals: 0, messages: 0, dashboard: 0,
      marketplace: 0, favorites: 0, my_services: 0, requests: 0,
      profile: 0, unicoin: 0, admin: 0
    });

    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', user?.id)
      .eq('read', false);
  };

  const handleLogout = async () => { await logout(); };

  const getAvatarIcon = () => {
    if (user?.avatar_url) {
      return <img src={user.avatar_url} className="w-full h-full object-cover" alt="avatar" />;
    }
    return <User className="w-4 h-4 text-primary" />;
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'order': return 'bg-blue-500';
      case 'message': return 'bg-emerald-500';
      case 'proposal': return 'bg-purple-500';
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-amber-500';
      case 'error': return 'bg-red-500';
      case 'info': return 'bg-sky-500';
      default: return 'bg-primary';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order': return '🛒';
      case 'message': return '💬';
      case 'proposal': return '📝';
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '🚫';
      case 'info': return 'ℹ️';
      default: return '🔔';
    }
  };

  const isAdminAccount = user?.email === 'admin@uniskills.ma';
  const isAdminTab = isAdminAccount || activeTab === 'admin' || [
    'admin_dashboard', 'admin_users', 'admin_marketplace', 
    'admin_disputes', 'admin_finance', 'admin_moderation', 'admin_system'
  ].includes(activeTab);
  const isMessagesView = activeTab === 'messages';

  // ✅ Navigation items avec isolation Admin Totale
  let navigation = [];

  if (isAdminAccount) {
    // Menu unique pour l'admin
    navigation = [
      { id: 'admin_dashboard', name: 'Dashboard', icon: Shield, badge: 0 },
      { id: 'admin_users', name: 'Utilisateurs', icon: User, badge: 0 },
      { id: 'admin_marketplace', name: 'Marketplace', icon: ShoppingBag, badge: 0 },
      { id: 'admin_disputes', name: 'Litiges', icon: AlertTriangle, badge: sectionCounts.admin },
      { id: 'admin_finance', name: 'Finance', icon: Coins, badge: 0 },
      { id: 'admin_moderation', name: 'Modération', icon: MessageSquare, badge: 0 },
      { id: 'admin_system', name: 'Système', icon: RefreshCw, badge: 0 },
    ];
  } else {
    // Menu pour les étudiants (Aideur/Demandeur)
    navigation = isAideur ? [
      { id: 'dashboard', name: 'Tableau de bord', icon: LayoutDashboard, badge: sectionCounts.dashboard },
      { id: 'marketplace', name: 'Marketplace', icon: ShoppingBag, badge: sectionCounts.marketplace },
      { id: 'my_services', name: 'Mes services', icon: Package, badge: sectionCounts.my_services },
      { id: 'orders', name: 'Ventes', icon: Handshake, badge: sectionCounts.orders },
      { id: 'favorites', name: 'Favoris', icon: Heart, badge: sectionCounts.favorites },
      { id: 'proposals', name: 'Propositions', icon: Handshake, badge: sectionCounts.proposals },
      { id: 'messages', name: 'Messages', icon: MessageSquare, badge: sectionCounts.messages },
      { id: 'support', name: 'Support', icon: LifeBuoy, badge: 0 },
    ] : [
      { id: 'dashboard', name: 'Tableau de bord', icon: LayoutDashboard, badge: sectionCounts.dashboard },
      { id: 'marketplace', name: 'Marketplace', icon: ShoppingBag, badge: sectionCounts.marketplace },
      { id: 'requests', name: 'Mes demandes', icon: FileText, badge: sectionCounts.requests },
      { id: 'orders', name: 'Achats', icon: Handshake, badge: sectionCounts.orders },
      { id: 'favorites', name: 'Favoris', icon: Heart, badge: sectionCounts.favorites },
      { id: 'proposals', name: 'Propositions', icon: Handshake, badge: sectionCounts.proposals },
      { id: 'messages', name: 'Messages', icon: MessageSquare, badge: sectionCounts.messages },
      { id: 'support', name: 'Support', icon: LifeBuoy, badge: 0 },
    ];
  }

  // ✅ Fonction pour gérer le changement de tab avec marquage des notifications
  const handleTabChange = (tabId: string, context?: any) => {
    if (user?.suspended && tabId !== 'profile' && tabId !== 'support') {
      onTabChange('profile', context);
      return;
    }
    // Marquer les notifications de cette section comme lues
    markSectionAsRead(tabId);
    onTabChange(tabId, context);
  };

  return (
    <div className={cn("fixed inset-0 h-[100dvh] w-screen flex flex-col overflow-hidden transition-colors duration-500", isAdminTab ? "bg-[#020617]" : "bg-white")}>

      {/* Bouton menu desktop (Hamburger) */}
      {!isAdminTab && !isSidebarHovered && !sidebarOpen && (
        <button
          onMouseEnter={() => setIsSidebarHovered(true)}
          className={cn(
            "hidden lg:flex fixed top-5 left-5 z-50 p-3 rounded-2xl shadow-xl transition-all border group animate-in fade-in zoom-in duration-300",
            isAdminTab ? "bg-slate-900 border-slate-800 text-primary hover:bg-slate-800" : "bg-white border-slate-100 text-primary hover:bg-slate-50"
          )}
        >
          <Menu className="w-6 h-6 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {/* Sidebar (Expansible au survol) */}
      <div
        ref={sidebarRef}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed left-0 top-0 bottom-0 z-40 transition-all duration-500 ease-in-out ${
          (isSidebarHovered || sidebarOpen) ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className={cn(
          "w-72 h-full border-r shadow-2xl flex flex-col relative overflow-hidden",
          isAdminTab ? "bg-[#020617] border-white/5" : "bg-white border-slate-100"
        )}>
          {/* Background decoration */}
          <div className={cn(
            "absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16 blur-3xl pointer-events-none",
            isAdminTab ? "bg-primary/20" : "bg-primary/5"
          )} />
          
          <div className={cn(
            "px-8 py-10 border-b flex flex-col items-center text-center relative z-10",
            isAdminTab ? "border-white/5" : "border-slate-50"
          )}>
            <div className="w-20 h-20 flex items-center justify-center mb-6 transform hover:scale-105 transition-transform cursor-pointer">
              <img 
                src="https://gwdhvmfrzmtpsuozooqn.supabase.co/storage/v1/object/public/logo.svg/logo.png" 
                alt="UniSkills" 
                className="w-full h-full object-contain" 
              />
            </div>
            <div>
              <h1 className={cn("text-xl font-black tracking-tighter leading-none mb-1", isAdminTab ? "text-white" : "text-slate-900")}>
                {isAdminTab ? "UniAdmin" : "UniSkills"}
              </h1>
              <p className="text-[8px] font-black text-primary uppercase tracking-[0.3em] opacity-80">
                {isAdminTab ? "UniSkills Plateforme" : "Marketplace Étudiante"}
              </p>
            </div>
            
            <button 
              onClick={() => {setSidebarOpen(false); setIsSidebarHovered(false);}} 
              className="absolute top-6 right-6 p-2 hover:bg-slate-50/10 rounded-xl transition-all text-slate-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const hasBadge = item.badge > 0;

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                    isActive 
                      ? (isAdminTab ? "bg-primary text-slate-900" : "bg-primary/10 text-primary") 
                      : (isAdminTab ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700")
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                  {/* ✅ Badge de notification pour la section */}
                  {hasBadge && (
                    <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-full min-w-[18px] text-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className={cn("border-t p-4 space-y-3", isAdminTab ? "border-slate-800" : "border-slate-100")}>
            {!isAdminTab && (
              <>
                <button
                  onClick={switchRole}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all transform hover:scale-105 ${isAideur
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-white shadow-lg shadow-primary/30'
                    : 'bg-gradient-to-r from-secondary to-secondary/80 text-white shadow-lg shadow-secondary/30'
                    }`}
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Mode {isAideur ? 'Demandeur' : 'Aideur'}</span>
                </button>

                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-800">UniCoins</span>
                  </div>
                  <span className="text-sm font-black text-amber-700">{walletBalance} UC</span>
                </div>
              </>
            )}
            
            {isAdminTab && (
               <p className="text-[10px] text-center font-black text-slate-500 uppercase tracking-widest py-2">
                 Session Root Active
               </p>
            )}
          </div>
        </div>
      </div>

      {/* Overlay sidebar mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Header desktop */}
      {!isAdminTab && (
        <div className="hidden lg:block bg-white border-b border-slate-100 px-4 lg:px-8 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="w-10" />

          <div className="flex items-center gap-4 ml-auto">
            {!isAdminTab && (
              <div 
                className="relative"
                onMouseEnter={handleBellMouseEnter}
                onMouseLeave={handleBellMouseLeave}
              >
                <button
                  ref={bellButtonRef}
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={cn(
                    "relative p-2.5 rounded-2xl transition-all duration-300",
                    unreadCount > 0 ? "bg-primary/5 text-primary" : "text-slate-400 hover:text-primary hover:bg-slate-50"
                  )}
                  aria-label="Notifications"
                >
                  <Bell className={cn("w-6 h-6", unreadCount > 0 && "animate-wiggle")} />
                  {unreadCount > 0 && (
                    <>
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-lg shadow-red-500/40 ring-2 ring-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                      <span className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping opacity-20" />
                    </>
                  )}
                </button>

                {/* Panneau des notifications - Tooltip style */}
                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      ref={notificationRef}
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] overflow-hidden"
                    >
                      {/* Pont invisible pour maintenir le hover entre le bouton et le panel */}
                      <div className="absolute -top-4 left-0 right-0 h-4 bg-transparent" />

                      {/* Header */}
                      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-primary/5 to-transparent">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-black text-slate-900">Notifications</h3>
                          {unreadCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-black rounded-full">
                              {unreadCount} non lues
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-[10px] font-black text-primary hover:underline flex items-center gap-1"
                          >
                            <CheckCheck className="w-3 h-3" />
                            Tout lire
                          </button>
                        )}
                      </div>

                      {/* Liste des notifications */}
                      <div className="max-h-96 overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 group ${!notif.read ? 'bg-primary/5' : ''}`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-8 h-8 rounded-full ${getNotificationColor(notif.type)} flex items-center justify-center text-white text-sm shrink-0 shadow-sm`}>
                                  {getNotificationIcon(notif.type)}
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`text-[11px] font-black leading-tight ${!notif.read ? 'text-primary' : 'text-slate-900'}`}>
                                      {notif.title}
                                    </p>
                                    <span className="text-[9px] text-slate-400 shrink-0">
                                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-1 leading-normal line-clamp-3">
                                    {notif.message}
                                  </p>
                                  <p className="text-[9px] text-slate-400 mt-1 font-medium">
                                    {new Date(notif.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                                  </p>
                                </div>

                                {!notif.read && (
                                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Bell className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-xs text-slate-500 font-medium">Aucune notification</p>
                            <p className="text-[10px] text-slate-400 mt-1">Les notifications apparaîtront ici</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Menu utilisateur */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 hover:bg-slate-50 rounded-xl px-3 py-2 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                  {getAvatarIcon()}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-sm font-black text-slate-900">{getUserDisplayName()}</p>
                  <p className="text-[10px] font-bold text-primary uppercase">{isAideur ? 'MODE AIDEUR' : 'MODE DEMANDEUR'}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                  >
                    <button
                      onClick={() => { handleTabChange('profile'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-all"
                    >
                      <User className="w-4 h-4" />
                      Mon profil
                    </button>
                    <button
                      onClick={() => { handleTabChange('unicoin'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-all"
                    >
                      <Wallet className="w-4 h-4" />
                      Mon portefeuille
                    </button>
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Header mobile */}
      <div className={cn(
        "lg:hidden border-b z-20 px-4 py-3 flex items-center justify-between shrink-0",
        isAdminTab ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
      )}>
        {!isAdminTab && (
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-400">
            <Menu className="w-6 h-6" />
          </button>
        )}
        <h1 className={cn("text-xl font-black", isAdminTab ? "text-white" : "text-primary")}>
          {isAdminTab ? "Uni-Admin" : "Uniskills"}
        </h1>
        <div className="flex items-center gap-2">
          {!isAdminTab && (
            <>
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-1.5"
                >
                  <Bell className="w-5 h-5 text-slate-500" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-3.5 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-full">
                <Coins className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-black text-amber-600">{walletBalance}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Contenu principal */}
      <main className="flex-1 min-h-0 relative w-full h-full flex flex-col overflow-hidden">
        {user?.suspended && activeTab !== 'profile' && activeTab !== 'support' ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 z-50">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-slate-900 mb-4">Compte Suspendu</h2>
            <p className="text-slate-600 mb-8 max-w-md">
              Votre compte a été temporairement suspendu. L'accès aux fonctionnalités de la plateforme est restreint. Veuillez contacter l'administration via le support pour plus d'informations.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button 
                onClick={() => handleTabChange('profile')} 
                className="px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20"
              >
                <User className="w-5 h-5" />
                Mon profil
              </button>
              <button 
                onClick={() => handleTabChange('support')} 
                className="px-8 py-4 bg-white text-slate-900 border-2 border-slate-200 font-bold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-2"
              >
                <LifeBuoy className="w-5 h-5" />
                Contacter le Support
              </button>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}