import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  Briefcase,
  Star,
  Users,
  Clock,
  ShoppingBag,
  CheckCircle2,
  DollarSign,
  FileText,
  MessageSquare,
  Award,
  ArrowRight,
  Wallet,
  Zap,
  Calendar,
  Target,
  Sparkles
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface StatCardProps {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  trend?: number;
  color?: string;
  linkTo?: string;
  onNavigate?: (view: string) => void;
}

const StatCard = ({ title, value, sub, icon: Icon, trend, color = 'bg-primary/10', linkTo, onNavigate }: StatCardProps) => (
  <div
    onClick={() => linkTo && onNavigate && onNavigate(linkTo)}
    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group cursor-pointer"
  >
    <div className="flex justify-between items-start mb-2">
      <div className={`p-2 ${color} rounded-xl text-primary group-hover:scale-110 transition-transform`}>
        <Icon className="w-4 h-4" />
      </div>
      {trend !== undefined && (
        <span className={`flex items-center text-[9px] font-black ${trend >= 0 ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'} px-1.5 py-0.5 rounded-full`}>
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <h3 className="text-slate-500 text-[9px] font-black uppercase tracking-wider mb-0.5">{title}</h3>
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-black text-slate-900">{value}</span>
      <span className="text-[9px] text-slate-400 font-bold uppercase">{sub}</span>
    </div>
  </div>
);

const COLORS = ['#FF385C', '#10315A', '#F59E0B', '#10B981', '#8B5CF6', '#06B6D4', '#EC4899'];

export default function Dashboard({ onNavigate }: { onNavigate?: (view: string, context?: any) => void }) {
  const { user, role } = useAuth();
  const isAideur = role === 'aideur';
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<any>({});
  const [revenueHistory, setRevenueHistory] = useState<{ month: string; value: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchRewards();
      fetchWalletBalance();

      // ✅ ABONNEMENT TEMPS RÉEL POUR LE SOLDE
      const walletChannel = supabase
        .channel('dashboard_wallet')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'unicoin_wallets', filter: `user_id=eq.${user.id}` },
          () => fetchWalletBalance()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(walletChannel);
      };
    }
  }, [user, role]);

  const fetchWalletBalance = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('unicoin_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setWalletBalance(data.balance);
      }
    } catch (err) {
      console.error('Error fetching wallet:', err);
    }
  };

  const fetchRewards = async () => {
    if (!user?.id) return;
    try {
      // Récupérer les transactions de type 'reward'
      const { data: walletData } = await supabase
        .from('unicoin_wallets')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (walletData) {
        const { data: transactions } = await supabase
          .from('unicoin_transactions')
          .select('*')
          .eq('wallet_id', walletData.id)
          .eq('type', 'reward')
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(10);

        if (transactions) {
          setRewards(transactions);
        }
      }
    } catch (err) {
      console.error('Error fetching rewards:', err);
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
      const currentMonth = new Date().getMonth();
      const last6Months = months.slice(Math.max(0, currentMonth - 5), currentMonth + 1);

      if (isAideur) {
        // ========== STATISTIQUES AIDEUR ==========

        // 1. Revenu total (commandes complétées)
        const { data: revenueData } = await supabase
          .from('orders')
          .select('amount')
          .eq('seller_id', user.id)
          .eq('status', 'completed');
        const totalRevenue = revenueData?.reduce((sum, o) => sum + (o.amount || 0), 0) || 0;

        // 2. Services actifs
        const { count: activeServices } = await supabase
          .from('services')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'active');

        // 3. Note moyenne
        const { data: reviews } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewed_id', user.id);
        const avgRating = reviews?.length
          ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
          : 'Nouveau';

        // 4. Commandes en cours (pending + in_progress)
        const { count: pendingOrders } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id)
          .in('status', ['pending', 'in_progress']);

        // 5. Taux de complétion
        const { data: allOrders } = await supabase
          .from('orders')
          .select('status')
          .eq('seller_id', user.id);
        const completedOrders = allOrders?.filter(o => o.status === 'completed').length || 0;
        const completionRate = allOrders?.length ? Math.round((completedOrders / allOrders.length) * 100) : 0;

        // 6. Commandes totales
        const totalOrders = allOrders?.length || 0;

        // 7. Clients uniques
        const { data: uniqueBuyers } = await supabase
          .from('orders')
          .select('buyer_id')
          .eq('seller_id', user.id)
          .eq('status', 'completed');
        const uniqueClients = new Set(uniqueBuyers?.map(o => o.buyer_id)).size;

        // 8. Historique des revenus (6 derniers mois)
        const { data: ordersHistory } = await supabase
          .from('orders')
          .select('amount, created_at')
          .eq('seller_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: true });

        const revenueByMonth: { [key: string]: number } = {};
        last6Months.forEach(m => revenueByMonth[m] = 0);

        ordersHistory?.forEach(order => {
          if (order.created_at) {
            const date = new Date(order.created_at);
            const monthName = months[date.getMonth()];
            if (last6Months.includes(monthName)) {
              revenueByMonth[monthName] = (revenueByMonth[monthName] || 0) + (order.amount || 0);
            }
          }
        });
        setRevenueHistory(last6Months.map(m => ({ month: m, value: revenueByMonth[m] || 0 })));

        // 9. Répartition par catégorie
        const { data: soldServices } = await supabase
          .from('orders')
          .select('service:services(category)')
          .eq('seller_id', user.id)
          .eq('status', 'completed');

        const categoryCount: { [key: string]: number } = {};
        soldServices?.forEach((order: any) => {
          const cat = order.service?.category || 'Autre';
          categoryCount[cat] = (categoryCount[cat] || 0) + 1;
        });
        const totalCat = Object.values(categoryCount).reduce((a, b) => a + b, 0);
        setCategoryData(Object.entries(categoryCount).slice(0, 4).map(([name, value], idx) => ({
          name: name.length > 12 ? name.slice(0, 10) + '...' : name,
          value: totalCat > 0 ? Math.round((value as number / totalCat) * 100) : 0,
          color: COLORS[idx % COLORS.length]
        })));

        // 10. Activités récentes
        const { data: recentOrders } = await supabase
          .from('orders')
          .select(`
            *,
            service:services(title, cover_image),
            lead:leads(title, image_url),
            buyer:users!buyer_id(first_name, last_name, avatar_url)
          `)
          .eq('seller_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentActivity(recentOrders?.map(o => {
          const item = o.service || o.lead;
          const buyer = o.buyer;
          return {
            type: 'commande',
            title: `Nouvelle commande: ${item?.title || 'Service'}`,
            amount: o.amount,
            date: new Date(o.created_at).toLocaleDateString('fr-FR'),
            buyerName: buyer ? `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim() : 'Client',
            status: o.status
          };
        }) || []);

        setStats({
          revenue: totalRevenue,
          activeServices: activeServices || 0,
          rating: avgRating,
          pendingOrders: pendingOrders || 0,
          completionRate,
          totalOrders,
          uniqueClients
        });

      } else {
        // ========== STATISTIQUES DEMANDEUR ==========

        // 1. Dépenses totales (commandes complétées)
        const { data: spendingData } = await supabase
          .from('orders')
          .select('amount')
          .eq('buyer_id', user.id)
          .eq('status', 'completed');
        const totalSpent = spendingData?.reduce((sum, o) => sum + (o.amount || 0), 0) || 0;

        // 2. Demandes publiées (leads actifs)
        const { count: publishedRequests } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('owner_id', user.id)
          .eq('status', 'open');

        // 3. Commandes en cours
        const { count: inProgressOrders } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('buyer_id', user.id)
          .in('status', ['pending', 'in_progress', 'delivered']);

        // 4. Propositions reçues
        const { count: receivedProposals } = await supabase
          .from('proposals')
          .select('*', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .eq('status', 'pending');

        // 5. Commandes totales
        const { data: allOrdersDemandeur } = await supabase
          .from('orders')
          .select('status')
          .eq('buyer_id', user.id);
        const totalOrdersDemandeur = allOrdersDemandeur?.length || 0;

        // 6. Taux de satisfaction (à implémenter avec les reviews)
        const { data: reviewsGiven } = await supabase
          .from('reviews')
          .select('rating')
          .eq('reviewer_id', user.id);
        const avgSatisfaction = reviewsGiven?.length
          ? (reviewsGiven.reduce((sum, r) => sum + r.rating, 0) / reviewsGiven.length).toFixed(1)
          : 'Nouveau';

        // 7. Économies estimées (15% de frais évités)
        const savings = Math.round(totalSpent * 0.15);

        // 8. Historique des dépenses (6 derniers mois)
        const { data: spendingHistory } = await supabase
          .from('orders')
          .select('amount, created_at')
          .eq('buyer_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: true });

        const spendingByMonth: { [key: string]: number } = {};
        last6Months.forEach(m => spendingByMonth[m] = 0);

        spendingHistory?.forEach(order => {
          if (order.created_at) {
            const date = new Date(order.created_at);
            const monthName = months[date.getMonth()];
            if (last6Months.includes(monthName)) {
              spendingByMonth[monthName] = (spendingByMonth[monthName] || 0) + (order.amount || 0);
            }
          }
        });
        setRevenueHistory(last6Months.map(m => ({ month: m, value: spendingByMonth[m] || 0 })));

        // 9. Répartition par catégorie (achats)
        const { data: boughtServices } = await supabase
          .from('orders')
          .select('service:services(category)')
          .eq('buyer_id', user.id)
          .eq('status', 'completed');

        const categoryCountDemandeur: { [key: string]: number } = {};
        boughtServices?.forEach((order: any) => {
          const cat = order.service?.category || 'Autre';
          categoryCountDemandeur[cat] = (categoryCountDemandeur[cat] || 0) + 1;
        });
        const totalCatDemandeur = Object.values(categoryCountDemandeur).reduce((a, b) => a + b, 0);
        setCategoryData(Object.entries(categoryCountDemandeur).slice(0, 4).map(([name, value], idx) => ({
          name: name.length > 12 ? name.slice(0, 10) + '...' : name,
          value: totalCatDemandeur > 0 ? Math.round((value as number / totalCatDemandeur) * 100) : 0,
          color: COLORS[idx % COLORS.length]
        })));

        // 10. Activités récentes
        const { data: recentOrdersDemandeur } = await supabase
          .from('orders')
          .select(`
            *,
            service:services(title, cover_image),
            lead:leads(title, image_url),
            seller:users!seller_id(first_name, last_name, avatar_url)
          `)
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        setRecentActivity(recentOrdersDemandeur?.map(o => {
          const item = o.service || o.lead;
          const seller = o.seller;
          return {
            type: 'achat',
            title: `Achat: ${item?.title || 'Service'}`,
            amount: o.amount,
            date: new Date(o.created_at).toLocaleDateString('fr-FR'),
            sellerName: seller ? `${seller.first_name || ''} ${seller.last_name || ''}`.trim() : 'Vendeur',
            status: o.status
          };
        }) || []);

        setStats({
          totalSpent,
          publishedRequests: publishedRequests || 0,
          inProgressOrders: inProgressOrders || 0,
          receivedProposals: receivedProposals || 0,
          savings,
          totalOrders: totalOrdersDemandeur,
          satisfaction: avgSatisfaction
        });
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (view: string) => {
    if (onNavigate) {
      onNavigate(view);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = isAideur ? [
    { title: "CA Total", value: stats.revenue?.toLocaleString() || '0', sub: "UC", icon: TrendingUp, trend: 12, color: 'bg-green-50', linkTo: 'orders' },
    { title: "Services", value: stats.activeServices || 0, sub: "actifs", icon: Briefcase, color: 'bg-blue-50', linkTo: 'my_services' },
    { title: "Note", value: stats.rating, sub: "/5", icon: Star, color: 'bg-amber-50', linkTo: 'profile' },
    { title: "En cours", value: stats.pendingOrders || 0, sub: "commandes", icon: Clock, color: 'bg-orange-50', linkTo: 'orders' },
    { title: "Commandes", value: stats.totalOrders || 0, sub: "totales", icon: ShoppingBag, color: 'bg-purple-50', linkTo: 'orders' }
  ] : [
    { title: "Dépenses", value: stats.totalSpent?.toLocaleString() || '0', sub: "UC", icon: DollarSign, color: 'bg-red-50', linkTo: 'orders' },
    { title: "Demandes", value: stats.publishedRequests || 0, sub: "publiées", icon: FileText, color: 'bg-blue-50', linkTo: 'requests' },
    { title: "En cours", value: stats.inProgressOrders || 0, sub: "projets", icon: Clock, color: 'bg-amber-50', linkTo: 'orders' },
    { title: "Propositions", value: stats.receivedProposals || 0, sub: "reçues", icon: MessageSquare, color: 'bg-indigo-50', linkTo: 'proposals' },
    { title: "Commandes", value: stats.totalOrders || 0, sub: "totales", icon: ShoppingBag, color: 'bg-purple-50', linkTo: 'orders' }
  ];

  // Récompenses dynamiques basées sur les données réelles
  const dynamicRewards = [
    {
      icon: '🎖️',
      title: 'Première commande',
      condition: (stats.totalOrders || 0) >= 1,
      reward: '+50 UC',
      color: 'text-amber-600'
    },
    {
      icon: '⭐',
      title: '5 étoiles reçues',
      condition: parseFloat(stats.rating) >= 4.5 && stats.rating !== 'Nouveau',
      reward: '+100 UC',
      color: 'text-green-600'
    },
    {
      icon: '🚀',
      title: '10 commandes',
      condition: (stats.totalOrders || 0) >= 10,
      reward: '+250 UC',
      color: 'text-primary'
    },
    {
      icon: '🤝',
      title: 'Première proposition acceptée',
      condition: stats.completionRate >= 100 || (stats.receivedProposals || 0) >= 1,
      reward: '+75 UC',
      color: 'text-purple-600'
    },
    {
      icon: '💰',
      title: '1000 UC gagnés',
      condition: (stats.revenue || stats.totalSpent || 0) >= 1000,
      reward: '+200 UC',
      color: 'text-amber-600'
    }
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Header with quick actions */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
      >
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Tableau de bord <Sparkles className="w-6 h-6 text-primary animate-pulse" />
          </h2>
          <p className="text-slate-500 font-medium mt-1">Bienvenue, voici un aperçu de votre activité sur UniSkills.</p>
        </div>
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3"
          >
            <div className="p-2 bg-amber-50 rounded-xl">
              <Wallet className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Solde</p>
              <p className="text-sm font-black text-slate-900">{walletBalance} UC</p>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.slice(0, 5).map((stat, idx) => (
          <motion.div
            key={`${stat.title}-${idx}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            whileHover={{ y: -8, transition: { duration: 0.2 } }}
          >
            <StatCard
              title={stat.title}
              value={stat.value}
              sub={stat.sub}
              icon={stat.icon}
              trend={stat.trend}
              color={stat.color}
              linkTo={stat.linkTo}
              onNavigate={handleNavigate}
            />
          </motion.div>
        ))}
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Graphique d'évolution */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm group hover:shadow-xl transition-all duration-500"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {isAideur ? 'Évolution du CA' : 'Évolution des dépenses'}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">
                {isAideur ? 'Revenus mensuels en UC' : 'Dépenses mensuelles en UC'}
              </p>
            </div>
            <motion.button
              whileHover={{ x: 5 }}
              onClick={() => handleNavigate('orders')}
              className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-2 hover:underline"
            >
              Détails <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory}>
                <defs>
                  <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF385C" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#FF385C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 800 }}
                  dy={10}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontWeight: 900, fontSize: '14px', color: '#FF385C' }}
                  labelStyle={{ fontWeight: 800, fontSize: '10px', color: '#94A3B8', marginBottom: '4px' }}
                  formatter={(value: any) => [`${value} UC`, isAideur ? 'Revenu' : 'Dépense']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#FF385C"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorGradient)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Répartition par catégorie */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm group hover:shadow-xl transition-all duration-500"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {isAideur ? 'Services vendus' : 'Achats par catégorie'}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">Répartition analytique</p>
            </div>
            <motion.button
              whileHover={{ x: 5 }}
              onClick={() => handleNavigate(isAideur ? 'my_services' : 'marketplace')}
              className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-2 hover:underline"
            >
              Détails <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
          {categoryData.length > 0 && categoryData[0].value > 0 ? (
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="h-[200px] w-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={8}
                      dataKey="value"
                      animationDuration={1500}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                      formatter={(value: any) => [`${value}%`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Focus</p>
                  <p className="text-xl font-black text-slate-900">TOP</p>
                </div>
              </div>
              <div className="flex-1 space-y-4 w-full">
                {categoryData.map((cat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + idx * 0.1 }}
                    className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: cat.color }} />
                      <span className="text-xs font-black text-slate-700">{cat.name}</span>
                    </div>
                    <span className="text-xs font-black text-primary">{cat.value}%</span>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center bg-slate-50 rounded-[24px] border border-dashed border-slate-200">
              <p className="text-sm text-slate-400 font-medium italic">Aucune donnée disponible</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Activités récentes et Récompenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Activités récentes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/5 rounded-2xl">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Activités récentes</h3>
            </div>
            <motion.button
              whileHover={{ x: 5 }}
              onClick={() => handleNavigate('orders')}
              className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-2 hover:underline"
            >
              Tout voir <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
          {recentActivity.length > 0 ? (
            <div className="space-y-4">
              {recentActivity.map((activity, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + idx * 0.05 }}
                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-[24px] hover:bg-white hover:shadow-lg hover:border-slate-100 border border-transparent transition-all cursor-pointer group"
                  onClick={() => handleNavigate('orders')}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${activity.type === 'commande' ? 'bg-green-50' : 'bg-blue-50'}`}>
                    {activity.type === 'commande' ? <ShoppingBag className="w-5 h-5 text-green-600" /> : <DollarSign className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{activity.title}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1 opacity-60">
                      <span>{activity.date}</span>
                      {activity.buyerName && <span> • Acheteur: {activity.buyerName}</span>}
                      {activity.sellerName && <span> • Vendeur: {activity.sellerName}</span>}
                    </p>
                  </div>
                  <p className="text-base font-black text-primary">+{activity.amount} UC</p>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-slate-50 rounded-[32px] flex items-center justify-center mx-auto mb-4 border border-slate-50">
                <Zap className="w-10 h-10 text-slate-200" />
              </div>
              <p className="text-slate-500 font-black text-sm">AUCUNE ACTIVITÉ</p>
              <p className="text-slate-400 text-xs mt-2 font-medium">Commencez par explorer le marketplace</p>
            </div>
          )}
        </motion.div>

        {/* Récompenses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gradient-to-br from-slate-50 to-white rounded-[32px] border border-slate-100 p-8 shadow-sm relative overflow-hidden"
        >
          <div className="flex items-center gap-3 mb-8 relative z-10">
            <div className="p-3 bg-amber-50 rounded-2xl">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight">Succès & Badges</h3>
            <div className="ml-auto flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full border border-amber-100">
              <Wallet className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-black text-amber-600">{walletBalance} UC</span>
            </div>
          </div>

          <div className="space-y-4 relative z-10">
            {dynamicRewards.map((reward, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + idx * 0.1 }}
                className={`flex items-center justify-between p-5 rounded-[24px] border transition-all duration-500 ${reward.condition
                  ? 'bg-white shadow-md border-green-100'
                  : 'bg-white/40 border-slate-100 opacity-60'
                  }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`text-3xl transition-all duration-700 ${reward.condition ? 'scale-110 rotate-12 drop-shadow-lg' : 'grayscale opacity-30'}`}>
                    {reward.icon}
                  </span>
                  <div>
                    <p className={`text-sm font-black ${reward.condition ? 'text-slate-900' : 'text-slate-400'}`}>{reward.title}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest mt-1">
                      {reward.condition ? (
                        <span className="text-green-600">✅ DÉBLOQUÉ</span>
                      ) : (
                        <span className="text-slate-400">🔒 À DÉBLOQUER</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className={`text-xs font-black px-3 py-1 rounded-full ${reward.condition ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-100 text-slate-400'}`}>
                  {reward.reward}
                </span>
              </motion.div>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleNavigate('unicoin')}
            className="w-full mt-8 py-4 bg-white text-primary font-black rounded-2xl text-xs hover:shadow-xl transition-all flex items-center justify-center gap-3 border border-slate-100 group shadow-lg"
          >
            <Wallet className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            VOIR MON PORTEFEUILLE
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}