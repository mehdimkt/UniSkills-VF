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
  Eye
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

  // Fermer la sidebar au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setSidebarOpen(false);
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
      case 'message': return 'bg-green-500';
      case 'proposal': return 'bg-purple-500';
      case 'success': return 'bg-green-500';
      case 'warning': return 'bg-orange-500';
      case 'error': return 'bg-red-500';
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
      default: return '🔔';
    }
  };

  const isMessagesView = activeTab === 'messages';

  // ✅ Navigation items avec badges de notification
  const navigation = isAideur ? [
    { id: 'dashboard', name: 'Tableau de bord', icon: LayoutDashboard, badge: sectionCounts.dashboard },
    { id: 'marketplace', name: 'Marketplace', icon: ShoppingBag, badge: sectionCounts.marketplace },
    { id: 'my_services', name: 'Mes services', icon: Package, badge: sectionCounts.my_services },
    { id: 'orders', name: 'Ventes', icon: Handshake, badge: sectionCounts.orders },
    { id: 'favorites', name: 'Favoris', icon: Heart, badge: sectionCounts.favorites },
    { id: 'proposals', name: 'Propositions', icon: Handshake, badge: sectionCounts.proposals },
    { id: 'messages', name: 'Messages', icon: MessageSquare, badge: sectionCounts.messages },
  ] : [
    { id: 'dashboard', name: 'Tableau de bord', icon: LayoutDashboard, badge: sectionCounts.dashboard },
    { id: 'marketplace', name: 'Marketplace', icon: ShoppingBag, badge: sectionCounts.marketplace },
    { id: 'requests', name: 'Mes demandes', icon: FileText, badge: sectionCounts.requests },
    { id: 'orders', name: 'Achats', icon: Handshake, badge: sectionCounts.orders },
    { id: 'favorites', name: 'Favoris', icon: Heart, badge: sectionCounts.favorites },
    { id: 'proposals', name: 'Propositions', icon: Handshake, badge: sectionCounts.proposals },
    { id: 'messages', name: 'Messages', icon: MessageSquare, badge: sectionCounts.messages },
  ];

  if (user?.email === 'admin@uniskills.ma') {
    navigation.push({ id: 'admin', name: 'Admin', icon: Shield, badge: sectionCounts.admin });
  }

  // ✅ Fonction pour gérer le changement de tab avec marquage des notifications
  const handleTabChange = (tabId: string, context?: any) => {
    // Marquer les notifications de cette section comme lues
    markSectionAsRead(tabId);
    onTabChange(tabId, context);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">

      {/* Bouton menu desktop (Hamburger qui disparaît au survol) */}
      {!isSidebarHovered && !sidebarOpen && (
        <button
          onMouseEnter={() => setIsSidebarHovered(true)}
          className="hidden lg:flex fixed top-5 left-5 z-50 p-3 bg-white rounded-2xl shadow-xl hover:bg-slate-50 transition-all border border-slate-100 group animate-in fade-in zoom-in duration-300"
        >
          <Menu className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-ping opacity-20" />
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
        <div className="w-72 h-full bg-white border-r border-slate-100 shadow-[20px_0_60px_-15px_rgba(0,0,0,0.1)] flex flex-col relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 blur-3xl pointer-events-none" />
          
          <div className="px-8 py-10 border-b border-slate-50 flex flex-col items-center text-center relative z-10">
            <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-[24px] flex items-center justify-center mb-4 shadow-xl shadow-primary/20 transform hover:rotate-6 transition-transform cursor-pointer">
              <span className="text-white text-4xl font-black italic">U</span>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none mb-1">UniSkills</h1>
              <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] opacity-60">
                Marketplace Étudiante
              </p>
            </div>
            
            <button 
              onClick={() => {setSidebarOpen(false); setIsSidebarHovered(false);}} 
              className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-xl transition-all text-slate-400 hover:text-slate-900"
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
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isActive ? 'bg-primary/10 text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
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

          <div className="border-t border-slate-100 p-4 space-y-3">
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
          </div>
        </div>
      </div>

      {/* Overlay sidebar mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Header desktop */}
      <div className="hidden lg:block bg-white border-b border-slate-100 px-4 lg:px-8 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="w-10" />

          <div className="flex items-center gap-4 ml-auto">
            {/* NOTIFICATIONS AVEC TOOLTIP AU SURVOL */}
            <div className="relative">
              <button
                ref={bellButtonRef}
                onClick={() => setShowNotifications(!showNotifications)}
                onMouseEnter={handleBellMouseEnter}
                onMouseLeave={handleBellMouseLeave}
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
                    onMouseEnter={handleNotificationMouseEnter}
                    onMouseLeave={handleNotificationMouseLeave}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                  >
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
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 group ${!notif.read ? 'bg-primary/5' : ''
                              }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-full ${getNotificationColor(notif.type)} flex items-center justify-center text-white text-sm shrink-0 shadow-sm`}>
                                {getNotificationIcon(notif.type)}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-xs font-black ${!notif.read ? 'text-primary' : 'text-slate-900'}`}>
                                    {notif.title}
                                  </p>
                                  <span className="text-[9px] text-slate-400 shrink-0">
                                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                  {notif.message}
                                </p>
                                <p className="text-[9px] text-slate-400 mt-1">
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

                    {/* Footer avec lien pour voir toutes */}
                    {notifications.length > 0 && (
                      <div className="p-3 border-t border-slate-100 bg-slate-50">
                        <button
                          onClick={() => {
                            setShowNotifications(false);
                            handleTabChange('notifications');
                          }}
                          className="w-full text-center text-[10px] font-black text-primary hover:underline flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Voir toutes les notifications
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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

      {/* Header mobile */}
      <div className="lg:hidden bg-white border-b border-slate-100 z-20 px-4 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2">
          <Menu className="w-6 h-6 text-slate-600" />
        </button>
        <h1 className="text-xl font-black text-primary">Uniskills</h1>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* Contenu principal */}
      {isMessagesView ? (
        <main className="flex-1 min-h-0 overflow-hidden relative">
          {children}
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-y-auto">
          <div className="pt-4 lg:pt-6 px-4 lg:px-8 pb-8">
            {children}
          </div>
        </main>
      )}
    </div>
  );
}