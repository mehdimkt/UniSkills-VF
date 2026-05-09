import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShoppingBag, 
  AlertTriangle, 
  BadgeCheck, 
  Settings, 
  BarChart3,
  Search,
  ShieldAlert,
  Ban,
  CheckCircle,
  XCircle,
  DollarSign,
  TrendingUp,
  Inbox,
  FileText,
  Clock,
  Shield,
  LayoutDashboard,
  Eye,
  MoreVertical,
  ArrowRight,
  Filter,
  Download,
  AlertCircle,
  Activity,
  Cpu,
  Globe,
  RefreshCw,
  User,
  ShieldCheck,
  MessageSquare,
  History,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Mail,
  Smartphone,
  MapPin,
  Calendar,
  Wallet,
  LifeBuoy,
  Archive,
  Flag,
  Edit2,
  LayoutGrid,
  LogOut,
  X
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { sendNotification } from '../lib/notifications';
import { cn } from '../lib/utils';

// --- Types ---
type AdminModule = 'users' | 'disputes' | 'unicoins' | 'messages' | 'dashboard' | 'settings' | 'moderations';

// --- Sub-components ---

const StatCard = ({ label, value, sub, icon: Icon, color, trend }: any) => (
  <div className="bg-white/[0.02] border border-white/[0.05] p-8 rounded-[48px] backdrop-blur-md relative overflow-hidden group hover:bg-white/[0.04] transition-all">
    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-2xl transition-transform group-hover:rotate-6", color)}>
      <Icon className="w-7 h-7 text-white" />
    </div>
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-3xl font-black text-white">{value}</p>
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-white/[0.03] pt-4">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{sub}</p>
      {trend && (
        <span className={cn("text-[10px] font-black flex items-center gap-1", trend.positive ? "text-green-400" : "text-red-400")}>
           {trend.positive ? '+' : '-'}{trend.value}%
        </span>
      )}
    </div>
  </div>
);

// --- MODULE 1: DASHBOARD ---

const RecentActivityList = () => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = async () => {
    setLoading(true);
    // Fetch last 3 services, 3 leads, 2 users
    const [services, leads, users] = await Promise.all([
      supabase.from('services').select('id, title, created_at, user:users!user_id(full_name)').order('created_at', { ascending: false }).limit(3),
      supabase.from('leads').select('id, title, created_at, owner:users!owner_id(full_name)').order('created_at', { ascending: false }).limit(3),
      supabase.from('users').select('id, full_name, created_at').order('created_at', { ascending: false }).limit(2)
    ]);

    const combined = [
      ...(services.data || []).map(s => ({ ...s, type: 'service', label: 'Service publié', user: s.user?.full_name })),
      ...(leads.data || []).map(l => ({ ...l, type: 'lead', label: 'Demande publiée', user: l.owner?.full_name })),
      ...(users.data || []).map(u => ({ ...u, type: 'user', label: 'Nouvel utilisateur', user: u.full_name, title: u.full_name }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setActivities(combined);
    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  if (loading) return <div className="animate-pulse space-y-4">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-50 rounded-2xl" />)}</div>;

  return (
    <div className="space-y-4">
      {activities.map((act, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-primary/20 transition-all">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
            act.type === 'service' ? "bg-blue-100 text-blue-600" : act.type === 'lead' ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"
          )}>
            {act.type === 'service' ? <ShoppingBag className="w-5 h-5" /> : act.type === 'lead' ? <Inbox className="w-5 h-5" /> : <User className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{act.label}</p>
             <p className="text-sm font-black text-slate-900 truncate">{act.title}</p>
             <p className="text-[10px] font-bold text-slate-500 uppercase">{act.user} • {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- UC8: GESTION DES CATÉGORIES ---
const AdminCategories = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [newCat, setNewCat] = useState({ name: '', icon: '', color: '#1e3a8a', is_active: true });
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  const fetchCategories = async () => {
    try {
      const { data } = await supabase.from('categories').select('*');
      if (data) {
        // Sort by order_index if it exists, otherwise by name
        const sorted = data.sort((a, b) => {
          if (a.order_index !== undefined && b.order_index !== undefined) return a.order_index - b.order_index;
          return a.name.localeCompare(b.name);
        });
        setCategories(sorted);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const handleSave = async (isEdit: boolean) => {
    const payload = isEdit ? editingCat : newCat;
    if (!payload.name) return;
    
    try {
      if (isEdit) {
        await fetch(`/api/admin/categories/${payload.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: payload.name, icon: payload.icon, color: payload.color, is_active: payload.is_active })
        });
      } else {
        await fetch(`/api/admin/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, order_index: categories.length })
        });
      }
      fetchCategories();
      setShowAdd(false);
      setEditingCat(null);
      setNewCat({ name: '', icon: '', color: '#1e3a8a', is_active: true });
    } catch (e) {
      alert("Erreur réseau");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    try {
      await fetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      fetchCategories();
    } catch (e) {
      alert("Erreur réseau");
    }
  };

  const toggleStatus = async (cat: any) => {
    try {
      await fetch(`/api/admin/categories/${cat.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !cat.is_active })
      });
      fetchCategories();
    } catch (e) {
      alert("Erreur réseau");
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag image
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const newCategories = [...categories];
    const draggedCat = newCategories[draggedItem];
    newCategories.splice(draggedItem, 1);
    newCategories.splice(index, 0, draggedCat);
    
    setDraggedItem(index);
    setCategories(newCategories);
  };

  const handleDragEnd = async () => {
    setDraggedItem(null);
    // Sauvegarder le nouvel ordre
    try {
      // Pour éviter de saturer l'API, on pourrait faire un bulk update.
      // On met à jour chaque catégorie avec son nouvel index.
      for (let i = 0; i < categories.length; i++) {
        await fetch(`/api/admin/categories/${categories[i].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_index: i })
        });
      }
    } catch (e) {
      console.error("Erreur lors de la sauvegarde de l'ordre", e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-900">Catégories Marketplace</h3>
        <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-primary text-white text-[10px] font-black rounded-xl uppercase tracking-widest flex items-center gap-2">
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat, index) => (
          <div 
            key={cat.id} 
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={cn(
              "p-6 bg-white rounded-[32px] border border-slate-100 flex items-center justify-between group transition-all cursor-move", 
              !cat.is_active && "opacity-50 grayscale",
              draggedItem === index && "opacity-30 border-dashed border-primary"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 pointer-events-none" style={{ backgroundColor: cat.color }}>
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div className="pointer-events-none">
                <p className="font-black text-slate-900">{cat.name}</p>
                <button onClick={(e) => { e.stopPropagation(); toggleStatus(cat); }} className={cn("text-[10px] font-bold uppercase tracking-widest hover:underline pointer-events-auto", cat.is_active ? "text-green-500" : "text-slate-400")}>
                  {cat.is_active ? 'Actif' : 'Inactif'}
                </button>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={(e) => { e.stopPropagation(); setEditingCat(cat); }} className="p-2 text-slate-400 hover:text-blue-500"><Edit2 className="w-4 h-4" /></button>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(cat.id); }} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {(showAdd || editingCat) && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-8 rounded-[40px] w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-black text-slate-900 mb-6">{editingCat ? 'Modifier Catégorie' : 'Nouvelle Catégorie'}</h3>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Nom de la catégorie" 
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  value={editingCat ? editingCat.name : newCat.name}
                  onChange={e => editingCat ? setEditingCat({...editingCat, name: e.target.value}) : setNewCat({...newCat, name: e.target.value})}
                />
                <div className="flex gap-4">
                   <input 
                    type="color" 
                    className="w-12 h-12 rounded-xl border-none p-0 cursor-pointer shrink-0"
                    value={editingCat ? editingCat.color : newCat.color}
                    onChange={e => editingCat ? setEditingCat({...editingCat, color: e.target.value}) : setNewCat({...newCat, color: e.target.value})}
                  />
                  <input 
                    type="text" 
                    placeholder="Icône (Lucide name)" 
                    className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    value={editingCat ? editingCat.icon : newCat.icon}
                    onChange={e => editingCat ? setEditingCat({...editingCat, icon: e.target.value}) : setNewCat({...newCat, icon: e.target.value})}
                  />
                </div>
                <div className="flex gap-3 pt-4 border-t border-slate-100 mt-4">
                  <button onClick={() => { setShowAdd(false); setEditingCat(null); }} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase">Annuler</button>
                  <button onClick={() => handleSave(!!editingCat)} className="flex-1 py-4 bg-primary text-white text-[10px] font-black rounded-2xl uppercase shadow-xl shadow-primary/20">Sauvegarder</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};



const AdminDashboard = ({ stats, growthData }: any) => {
  return (
    <div className="p-10 space-y-10 bg-slate-900/30 h-full overflow-y-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <StatCard label="Étudiants" value={stats.usersCount} sub={`${stats.newUsersToday} aujourd'hui`} icon={Users} color="bg-blue-600" trend={{ value: 12, positive: true }} />
        <StatCard label="Annonces" value={stats.itemsCount} sub={`${stats.pendingModeration} en attente`} icon={ShoppingBag} color="bg-purple-600" />
        <StatCard label="Volume UniCoins" value={`${stats.totalBalance.toLocaleString()} UC`} sub="Total en circulation" icon={DollarSign} color="bg-amber-500" />
        <StatCard label="Litiges" value={stats.activeDisputes} sub="Action immédiate requise" icon={AlertTriangle} color="bg-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 bg-white/[0.02] p-10 rounded-[56px] border border-white/[0.05] backdrop-blur-xl shadow-2xl">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#475569'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#475569'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', padding: '20px' }}
                  itemStyle={{ fontWeight: 'black', fontSize: '14px', color: '#fff' }}
                  labelStyle={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'black' }}
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={5} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/[0.02] p-10 rounded-[56px] border border-white/[0.05] backdrop-blur-xl shadow-2xl flex flex-col">
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
               <RecentActivityList />
            </div>
        </div>
      </div>
    </div>
  );
};

const AdminUsers = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ first_name: '', last_name: '', email: '', password: '' });
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setUsers(data);
    setLoading(false);
  };

  const handleVerify = async (userId: string) => {
    if (!confirm('Confirmez-vous que ce compte respecte les conditions ?')) return;
    const { error } = await supabase.from('users').update({ status: 'verifie' }).eq('id', userId);
    if (!error) {
       setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'verifie' } : u));
    }
  };

  const handleUnverify = async (userId: string) => {
    if (!confirm('Voulez-vous retirer le badge de vérification de ce compte ?')) return;
    const { error } = await supabase.from('users').update({ status: 'pending' }).eq('id', userId);
    if (!error) {
       setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'pending' } : u));
    }
  };

  const handleBulkVerify = async () => {
    if (selectedUsers.length === 0) return;
    if (!confirm(`Voulez-vous vérifier ${selectedUsers.length} utilisateurs d'un coup ?`)) return;
    
    const { error } = await supabase
      .from('users')
      .update({ status: 'verifie' })
      .in('id', selectedUsers);
      
    if (!error) {
      setUsers(prev => prev.map(u => selectedUsers.includes(u.id) ? { ...u, status: 'verifie' } : u));
      setSelectedUsers([]);
    }
  };

  const handleVerifyAllVisible = async () => {
    const visibleNonVerifiedIds = filteredUsers
      .filter(u => u.status !== 'verifie' && !u.banned)
      .map(u => u.id);
      
    if (visibleNonVerifiedIds.length === 0) {
      alert("Tous les utilisateurs visibles sont déjà vérifiés.");
      return;
    }
    
    if (!confirm(`Voulez-vous vérifier TOUS les ${visibleNonVerifiedIds.length} utilisateurs visibles ?`)) return;
    
    const { error } = await supabase
      .from('users')
      .update({ status: 'verifie' })
      .in('id', visibleNonVerifiedIds);
      
    if (!error) {
      setUsers(prev => prev.map(u => visibleNonVerifiedIds.includes(u.id) ? { ...u, status: 'verifie' } : u));
      
      // --- LOG AUDIT ---
      await supabase.from('audit_logs').insert([{
        admin_id: user?.id,
        action: 'bulk_verify_users',
        details: { count: visibleNonVerifiedIds.length, user_ids: visibleNonVerifiedIds }
      }]);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdmin(true);
    try {
      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminForm, admin_id: user?.id })
      });
      if (res.ok) {
        alert("Administrateur créé avec succès !");
        setShowCreateAdmin(false);
        setAdminForm({ first_name: '', last_name: '', email: '', password: '' });
        fetchUsers();
      } else {
        const errorData = await res.json();
        console.error("Erreur création admin:", errorData);
        alert(`Erreur: ${errorData.detail || "Impossible de créer l'admin"}`);
      }
    } catch (e) {
      alert("Erreur réseau: impossible de contacter le serveur Python.");
    } finally {
      setCreatingAdmin(false);
    }
  };

  const handleSuspend = async (userId: string, suspended: boolean) => {
    let reason = '';
    if (suspended) {
      reason = prompt('Motif de la suspension :') || '';
      if (!reason) return; // reason is mandatory
    } else {
      if (!confirm('Lever la suspension de ce compte ?')) return;
    }

    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended, reason, admin_id: user?.id })
      });
      if (res.ok) {
         setUsers(prev => prev.map(u => u.id === userId ? { ...u, suspended } : u));
         if (suspended) {
           // Masquer annonces - Note: This might also fail due to RLS if done via client.
           await supabase.from('services').update({ status: 'hidden' }).eq('user_id', userId);
           await supabase.from('leads').update({ status: 'hidden' }).eq('owner_id', userId);
         }
      } else {
         alert("Erreur lors de la suspension. Le serveur est-il bien lancé ?");
      }
    } catch (e) {
      alert("Erreur réseau: impossible de contacter le serveur Python.");
    }
  };

  const handleBan = async (userId: string, banned: boolean) => {
    if (banned) {
      if (!confirm('BANNISSEMENT : Confirmez-vous le bannissement définitif de ce compte ? Le profil sera anonymisé, ses annonces supprimées et son portefeuille confisqué.')) return;
      try {
        const res = await fetch(`/api/admin/users/${userId}/ban`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: user?.id })
        });
        if (res.ok) fetchUsers();
        else alert("Erreur lors du bannissement. Le serveur a retourné une erreur.");
      } catch (e) {
        alert("Erreur réseau: impossible de contacter le serveur Python.");
      }
    } else {
      if (!confirm('Débannir cet utilisateur ?')) return;
      try {
        const res = await fetch(`/api/admin/users/${userId}/unban`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: user?.id })
        });
        if (res.ok) fetchUsers();
        else alert("Erreur lors du débannissement. Le serveur a retourné une erreur.");
      } catch (e) {
        alert("Erreur réseau: impossible de contacter le serveur Python.");
      }
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = `${u.first_name} ${u.last_name} ${u.email} ${u.university}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    let matchesStatus = true;
    if (statusFilter === 'verifie') matchesStatus = u.status === 'verifie';
    if (statusFilter === 'non_verifie') matchesStatus = u.status !== 'verifie';
    if (statusFilter === 'suspendu') matchesStatus = u.suspended === true;
    if (statusFilter === 'banni') matchesStatus = u.banned === true;
    
    // Si on filtre par banni, on inclut ceux bannis, sinon on les inclut quand même ou on peut les cacher ?
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-end gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-bold text-slate-600"
            >
              <option value="all">Tous les statuts</option>
              <option value="verifie">Vérifié</option>
              <option value="non_verifie">Non Vérifié</option>
              <option value="suspendu">Suspendu</option>
              <option value="banni">Banni</option>
            </select>

            <div className="relative">
              <input 
                type="text" 
                placeholder="Nom, Email, Université..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-6 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 w-full md:w-64 text-sm font-bold" 
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            
            <button 
              onClick={() => {
                // Export simple
                const csv = filteredUsers.map(u => `${u.first_name} ${u.last_name},${u.email},${u.role},${u.status}`).join('\n');
                const blob = new Blob(["Nom,Email,Role,Statut\n" + csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'utilisateurs.csv';
                a.click();
              }}
              className="p-3 bg-slate-50 text-slate-600 rounded-2xl hover:bg-primary hover:text-white transition-all"
            >
              <Download className="w-5 h-5" />
            </button>
            
            {selectedUsers.length > 0 && (
              <button 
                onClick={handleBulkVerify}
                className="px-4 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all text-xs font-black uppercase flex items-center gap-2"
              >
                <BadgeCheck className="w-4 h-4" /> Vérifier Sélection ({selectedUsers.length})
              </button>
            )}
            
            <button 
              onClick={handleVerifyAllVisible}
              className="px-4 py-3 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all text-xs font-black uppercase flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" /> Vérifier Tout
            </button>
            
            <button 
              onClick={() => setShowCreateAdmin(true)}
              className="px-4 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all text-xs font-black uppercase flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" /> Créer Admin
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">
                  <input 
                    type="checkbox" 
                    className="rounded text-primary focus:ring-primary w-4 h-4"
                    onChange={(e) => {
                      if (e.target.checked) {
                        const ids = filteredUsers.filter(u => !u.banned).map(u => u.id);
                        setSelectedUsers(ids);
                      } else {
                        setSelectedUsers([]);
                      }
                    }}
                    checked={selectedUsers.length > 0 && selectedUsers.length === filteredUsers.filter(u => !u.banned).length}
                  />
                </th>
                <th className="px-8 py-5">Profil</th>
                <th className="px-8 py-5">Type</th>
                <th className="px-8 py-5">Académie</th>
                <th className="px-8 py-5">Statistiques</th>
                <th className="px-8 py-5">État & Accès</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-500">Chargement...</td></tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.id} className={`border-b border-slate-50 transition-colors group ${u.banned ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-8 py-5">
                    {!u.banned && (
                      <input 
                        type="checkbox" 
                        className="rounded text-primary focus:ring-primary w-4 h-4"
                        checked={selectedUsers.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers(prev => [...prev, u.id]);
                          } else {
                            setSelectedUsers(prev => prev.filter(id => id !== u.id));
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 overflow-hidden shrink-0">
                        <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{u.banned ? 'Utilisateur Banni' : `${u.first_name} ${u.last_name}`}</p>
                        <p className="text-[10px] text-slate-500 font-bold truncate max-w-[150px]">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'}`}>
                      {u.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-slate-800">{u.university}</span>
                      <span className="text-[10px] text-slate-400 font-bold">{u.level || 'Niveau inconnu'} • {u.city}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-500">Inscrit: {new Date(u.created_at).toLocaleDateString()}</span>
                      {u.last_login && <span className="text-[10px] font-bold text-slate-400">Visite: {new Date(u.last_login).toLocaleDateString()}</span>}
                      <span className="text-[10px] font-black text-yellow-500">⭐ {u.rating || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${u.status === 'verifie' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {u.status === 'verifie' ? 'Vérifié' : 'Non Vérifié'}
                      </span>
                      {u.banned ? (
                        <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-black uppercase">Banni</span>
                      ) : u.suspended ? (
                        <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-600 text-[9px] font-black uppercase flex items-center gap-1"><Lock className="w-2.5 h-2.5"/> Suspendu</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-black uppercase flex items-center gap-1"><Unlock className="w-2.5 h-2.5"/> Actif</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-wrap gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => setSelectedUser(u)} className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-1" title="Voir le profil">
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {!u.banned && u.status !== 'verifie' && (
                        <button onClick={() => handleVerify(u.id)} className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-600 hover:text-white transition-all shadow-sm flex items-center gap-1" title="Vérifier">
                          <BadgeCheck className="w-4 h-4" />
                        </button>
                      )}

                      {!u.banned && u.status === 'verifie' && (
                        <button onClick={() => handleUnverify(u.id)} className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-1" title="Annuler vérification">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      
                      {!u.banned && (
                        <button onClick={() => handleSuspend(u.id, !u.suspended)} className={`p-2 rounded-xl transition-all shadow-sm flex items-center gap-1 ${u.suspended ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white' : 'bg-slate-50 text-slate-600 hover:bg-orange-500 hover:text-white'}`} title={u.suspended ? "Enlever suspension" : "Suspendre"}>
                          {u.suspended ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                      )}

                      <button onClick={() => handleBan(u.id, !u.banned)} className={`p-2 rounded-xl transition-all shadow-sm flex items-center gap-1 ${u.banned ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-slate-50 text-slate-600 hover:bg-red-600 hover:text-white'}`} title={u.banned ? "Débannir" : "Bannir"}>
                        {u.banned ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Modal Avancée (UC2) */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[90vh]">
              {selectedUser.banned && (
                <div className="w-full bg-red-600 text-white text-center py-2 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> CE COMPTE EST DÉFINITIVEMENT BANNI
                </div>
              )}
              
              <div className="p-8 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className={`w-20 h-20 rounded-[24px] bg-white border-2 overflow-hidden p-1 shadow-sm ${selectedUser.banned ? 'border-red-500' : selectedUser.suspended ? 'border-orange-500' : 'border-slate-200'}`}>
                      <img src={selectedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.id}`} className={`w-full h-full object-cover rounded-[18px] ${selectedUser.banned ? 'grayscale' : ''}`} />
                    </div>
                    {selectedUser.status === 'verifie' && (
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center border-4 border-slate-50">
                        <BadgeCheck className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{selectedUser.banned ? 'Utilisateur Banni' : `${selectedUser.first_name} ${selectedUser.last_name}`}</h3>
                    <p className="text-sm font-bold text-slate-500 mb-2">{selectedUser.email}</p>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase rounded-lg">{selectedUser.role}</span>
                      <span className="px-3 py-1 bg-slate-200 text-slate-700 text-[10px] font-black uppercase rounded-lg flex items-center gap-1"><MapPin className="w-3 h-3"/> {selectedUser.city}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!selectedUser.banned && (
                    <>
                      <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all text-xs font-black uppercase flex items-center gap-2 shadow-sm">
                        <MessageSquare className="w-4 h-4" /> Contacter
                      </button>
                      <button onClick={() => handleSuspend(selectedUser.id, !selectedUser.suspended)} className={`px-4 py-2 rounded-xl transition-all text-xs font-black uppercase flex items-center gap-2 shadow-sm ${selectedUser.suspended ? 'bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-orange-500 hover:text-white'}`}>
                        {selectedUser.suspended ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        {selectedUser.suspended ? 'Enlever Suspension' : 'Suspendre'}
                      </button>
                    </>
                  )}
                  <button onClick={() => handleBan(selectedUser.id, !selectedUser.banned)} className={`px-4 py-2 rounded-xl transition-all text-xs font-black uppercase flex items-center gap-2 shadow-sm ${selectedUser.banned ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-red-600 hover:text-white'}`}>
                    {selectedUser.banned ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    {selectedUser.banned ? 'Débannir' : 'Bannir'}
                  </button>
                  <button onClick={() => setSelectedUser(null)} className="p-3 bg-white border border-slate-100 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm"><XCircle className="w-6 h-6" /></button>
                </div>
              </div>

              {/* Contenu Tabs - Pour simplifier, on affiche tout dans une grille mais on pourrait faire des vrais onglets */}
              <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Colonne gauche : Infos générales */}
                <div className="space-y-6">
                  <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Informations Scolaires</h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Université</p>
                        <p className="text-xs font-black text-slate-900">{selectedUser.university}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Niveau</p>
                        <p className="text-xs font-black text-slate-900">{selectedUser.level || 'Non spécifié'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 uppercase font-bold">Genre</p>
                        <p className="text-xs font-black text-slate-900">{selectedUser.gender === 'male' ? 'Homme' : selectedUser.gender === 'female' ? 'Femme' : 'Non spécifié'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Compétences</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedUser.skills?.map((s: string) => (
                        <span key={s} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-xl uppercase">{s}</span>
                      )) || <p className="text-xs text-slate-400 italic">Aucune compétence</p>}
                    </div>
                  </div>
                </div>

                {/* Colonne centrale & droite */}
                <div className="lg:col-span-2 space-y-6">
                   {/* Statistiques Rapides */}
                   <div className="grid grid-cols-3 gap-4">
                     <div className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500"><Wallet className="w-6 h-6" /></div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portefeuille</p>
                          <p className="text-xl font-black text-slate-900">{selectedUser.wallet_balance || 0} <span className="text-[10px] text-primary">UC</span></p>
                        </div>
                     </div>
                     <div className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500"><ShoppingBag className="w-6 h-6" /></div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annonces</p>
                          <p className="text-xl font-black text-slate-900">-</p>
                        </div>
                     </div>
                     <div className="p-6 bg-white rounded-[32px] border border-slate-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500"><AlertTriangle className="w-6 h-6" /></div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Signalements</p>
                          <p className="text-xl font-black text-slate-900">-</p>
                        </div>
                     </div>
                   </div>

                   {/* Journal d'audit (Simulation) */}
                   <div className="bg-slate-50 rounded-[32px] p-6 border border-slate-100">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><Shield className="w-4 h-4"/> Journal Admin (Logs)</h4>
                     <div className="space-y-4">
                        <div className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500"><User className="w-4 h-4" /></div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">Création du compte</p>
                              <p className="text-[10px] text-slate-400">Système</p>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-bold">{new Date(selectedUser.created_at).toLocaleString()}</span>
                        </div>
                        {selectedUser.status === 'verifie' && (
                          <div className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-500"><BadgeCheck className="w-4 h-4" /></div>
                              <div>
                                <p className="text-xs font-bold text-slate-900">Vérification d'identité</p>
                                <p className="text-[10px] text-slate-400">Action Admin</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold">Effectué</span>
                          </div>
                        )}
                        {selectedUser.banned && (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center text-red-600"><Ban className="w-4 h-4" /></div>
                              <div>
                                <p className="text-xs font-bold text-red-900">Bannissement définitif</p>
                                <p className="text-[10px] text-red-500">Action Admin</p>
                              </div>
                            </div>
                            <span className="text-[10px] text-red-400 font-bold">Récemment</span>
                          </div>
                        )}
                     </div>
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateAdmin && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-8 rounded-[40px] w-full max-w-md shadow-2xl">
              <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-primary" /> Créer un Administrateur</h3>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div className="flex gap-4">
                  <input type="text" placeholder="Prénom" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={adminForm.first_name} onChange={e => setAdminForm({...adminForm, first_name: e.target.value})} />
                  <input type="text" placeholder="Nom" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={adminForm.last_name} onChange={e => setAdminForm({...adminForm, last_name: e.target.value})} />
                </div>
                <input type="email" placeholder="Email (ex: admin@uniskills.ma)" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={adminForm.email} onChange={e => setAdminForm({...adminForm, email: e.target.value})} />
                <input type="password" placeholder="Mot de passe" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold" value={adminForm.password} onChange={e => setAdminForm({...adminForm, password: e.target.value})} />
                <p className="text-[10px] text-slate-400 font-bold px-2 italic">
                  * Le compte sera créé avec le rôle administrateur et sera automatiquement confirmé.
                </p>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowCreateAdmin(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase hover:bg-slate-50 rounded-2xl">Annuler</button>
                  <button type="submit" disabled={creatingAdmin} className="flex-1 py-4 bg-primary text-white text-[10px] font-black rounded-2xl uppercase shadow-xl shadow-primary/20 flex items-center justify-center gap-2">
                    {creatingAdmin ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- MODULE 3: MODÉRATION MARKETPLACE ---

const AdminModeration = () => {
  const [activeType, setActiveType] = useState<'services' | 'leads'>('services');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  useEffect(() => { 
    fetchItems(); 
    setStatusFilter('all'); // Reset filter when switching types
  }, [activeType]);

  const fetchItems = async () => {
    setLoading(true);
    const { data } = await supabase
      .from(activeType)
      .select(`*, owner:${activeType === 'services' ? 'users!user_id' : 'users!owner_id'} (id, full_name, avatar_url, email)`)
      .order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    const { error } = await supabase.from(activeType).update({ status: newStatus }).eq('id', id);
    if (!error) {
      setItems(prev => prev.map(item => item.id === id ? { ...item, status: newStatus } : item));
      
      // --- LOG AUDIT ---
      await supabase.from('audit_logs').insert([{
        admin_id: user?.id,
        action: `moderate_${activeType}_${newStatus}`,
        target_id: id,
        details: { type: activeType, newStatus }
      }]);
      
      const item = items.find(i => i.id === id);
      const userId = activeType === 'services' ? item.user_id : item.owner_id;
      
      let title = "";
      let message = "";
      
      if (newStatus === 'active' || newStatus === 'open') {
        title = "Annonce réactivée";
        message = `Votre ${activeType === 'services' ? 'service' : 'demande'} "${item.title}" est maintenant en ligne.`;
      } else if (newStatus === 'paused' || newStatus === 'closed') {
        title = activeType === 'services' ? "Service désactivé" : "Demande clôturée";
        message = `Votre ${activeType === 'services' ? 'service' : 'demande'} "${item.title}" a été ${activeType === 'services' ? 'mis en pause' : 'clôturé'} par l'administration.`;
      } else if (newStatus === 'removed') {
        title = "Annonce supprimée";
        message = `Votre ${activeType === 'services' ? 'service' : 'demande'} "${item.title}" a été supprimé par l'administration.`;
      }
      
      if (title) {
        await sendNotification(userId, title, message, 'system');
      }
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = (item.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.owner?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusLabel = (status: string) => {
    if (activeType === 'services') {
      switch(status) {
        case 'active': return 'Actif';
        case 'paused': return 'Inactif';
        case 'draft': return 'Brouillon';
        case 'removed': return 'Supprimé';
        default: return status;
      }
    } else {
      switch(status) {
        case 'open': return 'Ouverte';
        case 'negotiating': return 'En négociation';
        case 'closed': return 'Fermée';
        case 'expired': return 'Expirée';
        case 'removed': return 'Supprimée';
        default: return status;
      }
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active':
      case 'open': return "bg-green-500 text-white";
      case 'negotiating': return "bg-blue-500 text-white";
      case 'paused':
      case 'closed': return "bg-amber-500 text-white";
      case 'draft': return "bg-slate-400 text-white";
      case 'expired': return "bg-slate-500 text-white";
      case 'removed': return "bg-red-500 text-white";
      default: return "bg-slate-500 text-white";
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0c] overflow-hidden h-full">
       <div className="p-10 border-b border-white/5 space-y-8 shrink-0">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
             <div className="flex gap-2 bg-white/5 p-1.5 rounded-[24px] border border-white/10 backdrop-blur-md">
                <button 
                  onClick={() => setActiveType('services')} 
                  className={cn(
                    "px-8 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all",
                    activeType === 'services' ? "bg-white text-slate-900 shadow-2xl" : "text-slate-500 hover:text-white"
                  )}
                >
                  Services
                </button>
                <button 
                  onClick={() => setActiveType('leads')} 
                  className={cn(
                    "px-8 py-3 rounded-[18px] text-[10px] font-black uppercase tracking-widest transition-all",
                    activeType === 'leads' ? "bg-white text-slate-900 shadow-2xl" : "text-slate-500 hover:text-white"
                  )}
                >
                  Demandes
                </button>
             </div>
             
             <div className="flex flex-wrap items-center gap-4">
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest outline-none focus:border-primary/50"
                >
                  <option value="all" className="bg-slate-900">Tous les états</option>
                  {activeType === 'services' ? (
                    <>
                      <option value="active" className="bg-slate-900 text-green-400">Actifs</option>
                      <option value="paused" className="bg-slate-900 text-amber-400">Inactifs</option>
                      <option value="draft" className="bg-slate-900 text-slate-400">Brouillons</option>
                    </>
                  ) : (
                    <>
                      <option value="open" className="bg-slate-900 text-green-400">Ouvertes</option>
                      <option value="negotiating" className="bg-slate-900 text-blue-400">En négociation</option>
                      <option value="closed" className="bg-slate-900 text-amber-400">Fermées</option>
                      <option value="expired" className="bg-slate-900 text-slate-400">Expirées</option>
                    </>
                  )}
                  <option value="removed" className="bg-slate-900 text-red-400">Supprimés</option>
                </select>

                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Rechercher par titre ou auteur..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-16 pr-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-primary/50 transition-all w-full md:w-80"
                  />
                </div>
                
                <button onClick={fetchItems} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/10">
                  <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
                </button>
             </div>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
             {loading ? [1,2,3,4,5,6,7,8].map(i => (
               <div key={i} className="aspect-[3/4] bg-white/5 rounded-[48px] animate-pulse border border-white/5" />
             )) : filteredItems.map(item => (
               <div key={item.id} className={cn(
                 "group relative bg-white/[0.02] border border-white/[0.05] rounded-[48px] overflow-hidden hover:bg-white/[0.04] transition-all hover:scale-[1.02] hover:shadow-2xl shadow-black/40 flex flex-col",
                 item.status === 'removed' && "opacity-60 grayscale"
               )}>
                  <div className="aspect-video overflow-hidden relative shrink-0">
                     <img 
                       src={item.cover_image || item.image_url || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400'} 
                       className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60" />
                     <div className="absolute top-6 left-6">
                        <span className={cn(
                          "px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl backdrop-blur-xl border border-white/10",
                          getStatusColor(item.status)
                        )}>
                          {getStatusLabel(item.status)}
                        </span>
                     </div>
                  </div>
                  
                  <div className="p-8 flex-1 flex flex-col justify-between space-y-6">
                     <div className="space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                              <img src={item.owner?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.owner?.id}`} />
                           </div>
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">{item.owner?.full_name || 'Étudiant UniSkills'}</p>
                        </div>
                        
                        <div>
                           <h4 className="text-lg font-black text-white leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">{item.title}</h4>
                           <p className="text-[11px] text-slate-500 font-bold line-clamp-2 leading-relaxed">{item.description}</p>
                        </div>
                     </div>

                     <div className="pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between mb-6">
                          <p className="text-2xl font-black text-white">
                             {item.price || item.budget} <span className="text-[10px] text-slate-500 uppercase tracking-widest">UC</span>
                          </p>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.category}</span>
                        </div>
                        
                        <div className="flex gap-2">
                           <button 
                             onClick={() => setSelectedItem(item)} 
                             className="flex-1 py-3 bg-white text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-xl flex items-center justify-center gap-2"
                           >
                             <Eye className="w-4 h-4" /> Voir
                           </button>
                           
                           {activeType === 'services' && item.status !== 'removed' && (
                             <button 
                               onClick={() => handleStatusChange(item.id, item.status === 'active' ? 'paused' : 'active')} 
                               className={cn(
                                 "p-3 rounded-2xl border transition-all flex items-center justify-center",
                                 item.status === 'active' 
                                   ? "bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500 hover:text-white" 
                                   : "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white"
                               )}
                               title={item.status === 'active' ? "Désactiver" : "Réactiver"}
                             >
                               {item.status === 'active' ? <Clock className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                             </button>
                           )}

                           {activeType === 'leads' && (item.status === 'open' || item.status === 'negotiating') && (
                             <button 
                               onClick={() => {
                                 if (window.confirm("Voulez-vous forcer la fermeture de cette demande ?")) {
                                   handleStatusChange(item.id, 'closed');
                                 }
                               }} 
                               className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-2xl hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center"
                               title="Fermer la demande"
                             >
                               <Lock className="w-5 h-5" />
                             </button>
                           )}

                           {activeType === 'leads' && (item.status === 'closed' || item.status === 'expired' || item.status === 'removed') && (
                             <button 
                               onClick={() => {
                                 if (window.confirm("Voulez-vous réouvrir cette demande ? Elle sera mise en ligne avec l'état 'Ouverte'.")) {
                                   handleStatusChange(item.id, 'open');
                                 }
                               }} 
                               className="p-3 bg-green-500/10 text-green-500 border border-green-500/20 rounded-2xl hover:bg-green-500 hover:text-white transition-all flex items-center justify-center"
                               title="Réouvrir la demande"
                             >
                               <RefreshCw className="w-5 h-5" />
                             </button>
                           )}

                           {item.status !== 'removed' && (
                             <button 
                               onClick={() => {
                                 if (window.confirm("Voulez-vous vraiment supprimer définitivement cette annonce ?")) {
                                   handleStatusChange(item.id, 'removed');
                                 }
                               }} 
                               className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl hover:bg-red-500 hover:text-white transition-all"
                               title="Supprimer définitivement"
                             >
                               <Trash2 className="w-5 h-5" />
                             </button>
                           )}
                           
                           {activeType === 'services' && item.status === 'removed' && (
                             <button 
                               onClick={() => handleStatusChange(item.id, 'paused')} 
                               className="p-3 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-2xl hover:bg-blue-500 hover:text-white transition-all"
                               title="Restaurer"
                             >
                               <RefreshCw className="w-5 h-5" />
                             </button>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
             ))}
          </div>
       </div>

       {/* Item Details Modal */}
       <AnimatePresence>
         {selectedItem && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setSelectedItem(null)}>
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }} 
               exit={{ scale: 0.9, opacity: 0, y: 20 }} 
               onClick={e => e.stopPropagation()}
               className="bg-[#111114] border border-white/10 rounded-[48px] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
             >
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tighter">Aperçu Marketplace</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID: {selectedItem.id}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="p-3 bg-white/5 hover:bg-red-500 text-slate-400 hover:text-white rounded-2xl transition-all border border-white/10">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Visuals */}
                    <div className="space-y-6">
                      <div className="aspect-[4/3] bg-white/5 rounded-[40px] overflow-hidden border border-white/10 shadow-2xl">
                        {(selectedItem.cover_image || selectedItem.image_url) ? (
                          <img src={selectedItem.cover_image || selectedItem.image_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-700">
                            <ImageIcon className="w-20 h-20 mb-4" />
                            <p className="font-black text-xs uppercase tracking-widest">Aucun visuel fourni</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="p-8 bg-white/[0.02] border border-white/5 rounded-[32px] space-y-4">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Propriétaire</p>
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-white/5 rounded-2xl overflow-hidden border border-white/10">
                            <img src={selectedItem.owner?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedItem.owner?.id}`} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-lg font-black text-white leading-tight">{selectedItem.owner?.full_name}</p>
                            <p className="text-xs text-slate-500 font-bold">{selectedItem.owner?.email}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <span className="px-4 py-2 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest">{selectedItem.category}</span>
                          <span className={cn(
                            "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest border border-white/10",
                            selectedItem.status === 'active' ? "text-green-400 bg-green-400/10" : "text-amber-400 bg-amber-400/10"
                          )}>
                            {selectedItem.status}
                          </span>
                        </div>
                        <h4 className="text-4xl font-black text-white tracking-tight leading-none">{selectedItem.title}</h4>
                        <div className="flex items-baseline gap-2">
                           <span className="text-5xl font-black text-white">{selectedItem.price || selectedItem.budget}</span>
                           <span className="text-lg font-black text-primary uppercase tracking-widest">UniCoins</span>
                        </div>
                      </div>

                      <div className="space-y-4">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Description complète</p>
                         <p className="text-slate-400 font-medium leading-relaxed whitespace-pre-wrap text-sm">{selectedItem.description}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Localisation</p>
                          <p className="text-sm font-black text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> {selectedItem.city || 'Maroc'}</p>
                        </div>
                        <div className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Date de publication</p>
                          <p className="text-sm font-black text-white flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> {new Date(selectedItem.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                      </div>
                      
                      <div className="pt-6">
                         <button 
                           onClick={() => setSelectedItem(null)}
                           className="w-full py-5 bg-white text-slate-900 rounded-[24px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-2xl"
                         >
                           Fermer l'aperçu
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>
    </div>
  );
};

// --- MODULE 4: GESTION DES LITIGES ---

const AdminDisputes = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const { user } = useAuth();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => { fetchTickets(); }, []);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
      const channel = supabase
        .channel(`admin_ticket_${selectedTicket.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${selectedTicket.id}` }, 
          () => fetchMessages(selectedTicket.id))
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [selectedTicket]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*, user:users!user_id(full_name, avatar_url), target_user:users!target_user_id(full_name)')
      .order('created_at', { ascending: false });
    if (data) setTickets(data);
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('support_messages')
      .select('*, sender:users!sender_id(full_name, avatar_url)')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const ADMIN_UUID = '5636739d-0d77-4da6-9a35-0fb1a2c217a4';

  const handleUpdateStatus = async (ticketId: string, status: string) => {
    if (!user) return;
    try {
      const adminId = user.id === 'admin_id' ? ADMIN_UUID : user.id;
      
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          status, 
          assigned_agent_id: adminId,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);
      
      if (error) throw error;

      fetchTickets();
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status, assigned_agent_id: adminId });
      }
      alert("Succès: Le ticket a été marqué comme " + (status === 'resolved' ? 'résolu' : status) + ".");
    } catch (err: any) {
      console.error("Erreur mise à jour ticket:", err);
      alert("Erreur lors de la mise à jour du ticket: " + (err.message || "Erreur inconnue"));
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer définitivement ce ticket ? Cette action est irréversible.")) return;
    
    try {
      // Supprimer d'abord les messages associés (si nécessaire selon les contraintes FK)
      await supabase.from('support_messages').delete().eq('ticket_id', ticketId);
      
      const { error } = await supabase.from('support_tickets').delete().eq('id', ticketId);
      if (error) throw error;
      
      alert("Ticket supprimé avec succès.");
      if (selectedTicket?.id === ticketId) setSelectedTicket(null);
      fetchTickets();
    } catch (err: any) {
      console.error("Erreur suppression ticket:", err);
      alert("Erreur lors de la suppression: " + err.message);
    }
  };

  const [sending, setSending] = useState(false);

  const handleReply = async () => {
    if (!reply.trim() || !selectedTicket || !user) return;
    setSending(true);
    try {
      const adminId = user.id === 'admin_id' ? ADMIN_UUID : user.id;

      const { error } = await supabase.from('support_messages').insert([{
        ticket_id: selectedTicket.id,
        sender_id: adminId,
        content: reply.trim(),
        is_internal: false
      }]);
      
      if (error) throw error;

      setReply('');
      await handleUpdateStatus(selectedTicket.id, 'replied');
      await fetchMessages(selectedTicket.id);
    } catch (err: any) {
      console.error("Erreur lors de l'envoi du message:", err);
      alert("Erreur: " + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-slate-900">
       {/* Left Column: List of tickets */}
       <div className="w-[350px] lg:w-[450px] border-r border-white/5 flex flex-col bg-slate-900/50 backdrop-blur-xl shrink-0">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
             {tickets.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => setSelectedTicket(t)}
                  className={cn(
                    "p-8 rounded-[40px] border transition-all cursor-pointer relative group overflow-hidden",
                    selectedTicket?.id === t.id 
                      ? "bg-primary text-slate-900 border-primary shadow-2xl scale-[1.02]" 
                      : "bg-white/5 border-white/5 hover:border-white/20"
                  )}
                >
                   <div className="flex items-center justify-between mb-4">
                      <span className={cn(
                        "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                        selectedTicket?.id === t.id ? "bg-slate-900/20" : "bg-white/10 text-slate-400"
                      )}>
                        {t.category}
                      </span>
                      <div className="flex items-center gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteTicket(t.id); }}
                            className={cn(
                              "p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100",
                              selectedTicket?.id === t.id ? "hover:bg-slate-900/10 text-slate-900/40" : "hover:bg-red-500/10 text-red-500/40 hover:text-red-500"
                            )}
                            title="Supprimer le ticket"
                          >
                             <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            t.status === 'open' ? "bg-red-500 animate-pulse" : 
                            t.status === 'replied' ? "bg-amber-500" : "bg-green-500"
                          )} />
                       </div>
                   </div>
                   <h4 className={cn("font-black truncate text-base mb-1", selectedTicket?.id === t.id ? "text-slate-900" : "text-white")}>{t.subject}</h4>
                   <p className={cn("text-[10px] font-bold uppercase tracking-tight", selectedTicket?.id === t.id ? "text-slate-900/60" : "text-slate-400")}>
                      Par {t.user?.full_name || 'Anonyme'}
                   </p>
                </div>
             ))}
          </div>
       </div>

       {/* Right Column: Conversation */}
       <div className="flex-1 flex flex-col bg-slate-950/40 relative">
          {selectedTicket ? (
             <>
                {/* Fixed Header */}
                <div className="p-10 bg-slate-900/60 backdrop-blur-xl border-b border-white/5 flex items-center justify-between shrink-0 z-10">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-[24px] bg-white/5 border border-white/10 text-primary flex items-center justify-center shadow-inner">
                         <ShieldAlert className="w-8 h-8" />
                      </div>
                      <div>
                          <div className="flex items-center gap-3 mb-2">
                             <h3 className="text-2xl font-black text-white tracking-tight uppercase leading-none">{selectedTicket?.subject || 'Sans sujet'}</h3>
                             <span className={cn(
                               "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                               selectedTicket?.status === 'resolved' || selectedTicket?.status === 'closed' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                             )}>
                               {selectedTicket?.status === 'resolved' ? 'Résolu' : selectedTicket?.status === 'closed' ? 'Fermé' : 'Ouvert'}
                             </span>
                          </div>
                          <div className="flex items-center gap-2">
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {selectedTicket?.user?.full_name || 'Demandeur inconnu'}
                             </p>
                             <span className="w-1 h-1 bg-white/10 rounded-full" />
                             <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                                vs {selectedTicket?.target_user?.full_name || 'Support UniSkills'}
                             </p>
                          </div>
                       </div>
                   </div>
                   <div className="flex gap-4">
                       {(selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed') && (
                          <button 
                            onClick={() => handleUpdateStatus(selectedTicket.id, 'resolved')} 
                            className="px-8 py-4 bg-green-500 text-slate-900 text-[10px] font-black rounded-[24px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-green-500/10"
                          >
                             Marquer comme résolu
                          </button>
                       )}
                      <button onClick={() => setSelectedTicket(null)} className="p-4 bg-white/5 text-white rounded-[24px] hover:bg-white/10 transition-all border border-white/5"><X className="w-6 h-6" /></button>
                   </div>
                </div>

                {/* Messages Area (Scrollable) */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
                   {/* Message initial */}
                   <div className="flex justify-center mb-16">
                      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 p-10 rounded-[48px] max-w-2xl text-center shadow-[0_20px_80px_rgba(0,0,0,0.4)]">
                         <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-6">Exposition du litige</p>
                         <p className="text-white text-lg font-medium leading-relaxed italic">"{selectedTicket?.description || 'Aucune description fournie'}"</p>
                         <div className="mt-8 pt-8 border-t border-white/5 flex justify-center gap-10">
                            <div>
                               <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Date d'ouverture</p>
                               <p className="text-xs font-bold text-white">{selectedTicket?.created_at ? new Date(selectedTicket.created_at).toLocaleDateString() : 'Date inconnue'}</p>
                            </div>
                            <div>
                               <p className="text-[9px] font-black text-slate-500 uppercase mb-1">ID Dossier</p>
                               <p className="text-xs font-bold text-white">#{selectedTicket?.id?.slice(0, 8) || 'N/A'}</p>
                            </div>
                         </div>
                      </div>
                   </div>

                   {messages.map(m => (
                      <div key={m.id} className={cn(
                        "flex gap-6 max-w-[85%]",
                        m.sender_id === user?.id ? "ml-auto flex-row-reverse" : "flex-row"
                      )}>
                         <div className={cn(
                           "w-12 h-12 rounded-2xl shrink-0 border flex items-center justify-center shadow-lg transition-transform hover:scale-110",
                           m.sender_id === user?.id ? "bg-primary border-primary text-slate-900" : "bg-white/5 border-white/10 text-white"
                         )}>
                            {m.sender_id === user?.id ? <Shield className="w-6 h-6" /> : <User className="w-6 h-6" />}
                         </div>
                         <div className={cn(
                           "p-8 rounded-[40px] text-base font-medium leading-relaxed shadow-2xl relative",
                           m.sender_id === user?.id 
                             ? "bg-slate-900 text-white border border-white/5 rounded-tr-none" 
                             : "bg-white/5 backdrop-blur-md border border-white/10 text-white rounded-tl-none"
                         )}>
                            {m.content}
                            <div className="flex items-center gap-2 mt-4 opacity-30">
                               <Clock className="w-3 h-3" />
                               <p className="text-[9px] font-black uppercase tracking-tighter">
                                  {new Date(m.created_at).toLocaleTimeString()}
                               </p>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>

                {/* Fixed Reply Bar */}
                <div className="p-10 bg-slate-900/60 backdrop-blur-2xl border-t border-white/5 shrink-0">
                   <div className="relative group max-w-5xl mx-auto">
                      <textarea 
                        value={reply}
                        onChange={e => setReply(e.target.value)}
                        placeholder="Saisissez votre verdict ou un message de médiation..."
                        className="w-full p-8 bg-white/5 border border-white/10 rounded-[48px] text-white font-bold text-base min-h-[160px] outline-none focus:border-primary/50 transition-all resize-none shadow-2xl pr-40"
                      />
                      <button 
                        onClick={handleReply}
                        disabled={sending || !reply.trim()}
                        className={cn(
                          "absolute bottom-8 right-8 px-12 py-5 bg-primary text-slate-900 text-[10px] font-black rounded-[32px] uppercase tracking-widest shadow-[0_10px_40px_rgba(var(--primary-rgb),0.3)] hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                          sending && "animate-pulse"
                        )}
                      >
                         {sending ? 'Envoi...' : 'Envoyer'}
                      </button>
                   </div>
                </div>
             </>
          ) : (
             <div className="flex-1 flex flex-col items-center justify-center p-20 text-center animate-in fade-in duration-1000">
                <div className="w-40 h-40 bg-white/5 rounded-[64px] border border-white/5 flex items-center justify-center mb-10 rotate-6 shadow-[0_20px_100px_rgba(0,0,0,0.5)]">
                   <AlertTriangle className="w-16 h-16 text-slate-800" />
                </div>
                <h3 className="text-4xl font-black text-white mb-4 tracking-tighter uppercase">Arbitrage Requis</h3>
                <p className="text-slate-500 max-w-md font-bold leading-relaxed uppercase text-[12px] tracking-[0.2em] opacity-60">
                   Sélectionnez un litige dans la colonne de gauche pour accéder au dossier complet et agir.
                </p>
             </div>
          )}
       </div>
    </div>
  );
};

// --- MODULE 5: UNICOIN & FINANCE ---

const AdminFinance = () => {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [modalMode, setModalMode] = useState<'add' | 'remove' | 'history' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [minBalance, setMinBalance] = useState(0);
  const [maxBalance, setMaxBalance] = useState(50000);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const { data: walletData, error: wError } = await supabase
        .from('unicoin_wallets')
        .select('*, user:users(full_name, email, avatar_url)')
        .order('balance', { ascending: false });

      if (wError) throw wError;

      const { data: transData, error: tError } = await supabase
        .from('unicoin_transactions')
        .select('wallet_id, amount, type, status');

      if (tError) throw tError;

      const processed = walletData.map(w => {
        const walletTrans = transData?.filter(t => t.wallet_id === w.id) || [];
        const total_earned = walletTrans
          .filter(t => t.amount > 0 && t.status === 'completed')
          .reduce((sum, t) => sum + t.amount, 0);
        const total_spent = Math.abs(walletTrans
          .filter(t => t.amount < 0 && t.status === 'completed')
          .reduce((sum, t) => sum + t.amount, 0));
        
        return {
          ...w,
          total_earned,
          total_spent,
          frozen_balance: w.held_balance || 0
        };
      });

      setWallets(processed);
    } catch (err) {
      console.error("Error fetching financial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWallets(); }, []);

  const fetchHistory = async (walletId: string) => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('unicoin_transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false });
    if (data) setTransactions(data);
    setLoadingHistory(false);
  };

  const filteredWallets = wallets.filter(w => {
    const matchesSearch = (w.user?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (w.user?.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBalance = w.balance >= minBalance && w.balance <= maxBalance;
    return matchesSearch && matchesBalance;
  });

  const handleTransaction = async () => {
    if (!selectedWallet || !amount || !reason) return;
    const value = parseInt(amount) * (modalMode === 'remove' ? -1 : 1);
    
    const { error: updateError } = await supabase.from('unicoin_wallets')
      .update({ balance: selectedWallet.balance + value })
      .eq('id', selectedWallet.id);
      
    if (!updateError) {
      await supabase.from('unicoin_transactions').insert([{
        wallet_id: selectedWallet.id,
        amount: value,
        type: modalMode === 'remove' ? 'withdrawal' : 'deposit',
        description: reason,
        status: 'completed'
      }]);

      // --- LOG AUDIT ---
      await supabase.from('audit_logs').insert([{
        admin_id: user?.id,
        action: modalMode === 'add' ? 'admin_deposit' : 'admin_withdrawal',
        target_id: selectedWallet.user_id,
        details: { amount: value, reason }
      }]);
      alert('Portefeuille mis à jour');
      fetchWallets();
      setModalMode(null);
      setAmount('');
      setReason('');
    } else {
      alert("Erreur lors de la mise à jour");
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900/50 backdrop-blur-xl overflow-hidden">
       <div className="p-10 border-b border-white/5 space-y-8 shrink-0">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
             <div className="flex-1 flex flex-wrap items-center gap-6">
                <div className="relative group min-w-[300px]">
                   <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                   <input 
                     type="text" 
                     placeholder="Chercher par nom ou email..." 
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     className="pl-16 pr-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-white font-bold outline-none focus:border-primary/50 transition-all w-full"
                   />
                </div>
                
                <div className="flex items-center gap-6 bg-white/5 p-4 rounded-2xl border border-white/10">
                   <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Solde (UC)</span>
                      <div className="flex items-center gap-2">
                         <input 
                           type="number" 
                           value={minBalance} 
                           onChange={e => setMinBalance(parseInt(e.target.value) || 0)}
                           className="w-20 py-2 bg-white/5 border border-white/10 rounded-xl text-center text-xs font-black text-white"
                         />
                         <span className="text-slate-500">→</span>
                         <input 
                           type="number" 
                           value={maxBalance} 
                           onChange={e => setMaxBalance(parseInt(e.target.value) || 0)}
                           className="w-20 py-2 bg-white/5 border border-white/10 rounded-xl text-center text-xs font-black text-white"
                         />
                      </div>
                   </div>
                   <input 
                     type="range" 
                     min="0" 
                     max="100000" 
                     step="1000"
                     value={maxBalance}
                     onChange={e => setMaxBalance(parseInt(e.target.value))}
                     className="w-40 accent-primary"
                   />
                </div>
             </div>
             
             <button onClick={fetchWallets} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/10 shadow-2xl">
                <RefreshCw className={cn("w-6 h-6", loading && "animate-spin")} />
             </button>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          <div className="bg-white/5 rounded-[48px] border border-white/5 shadow-2xl overflow-hidden backdrop-blur-sm">
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead>
                      <tr className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/5">
                         <th className="px-10 py-8">Utilisateur</th>
                         <th className="px-6 py-8 text-center">Solde Total</th>
                         <th className="px-6 py-8 text-center">Gains Totaux</th>
                         <th className="px-6 py-8 text-center">Dépenses</th>
                         <th className="px-6 py-8 text-center">Bloqués</th>
                         <th className="px-10 py-8 text-right">Actions</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                      {filteredWallets.map(w => (
                         <tr 
                           key={w.id} 
                           onClick={() => { setSelectedWallet(w); setModalMode('history'); fetchHistory(w.id); }}
                           className="hover:bg-white/5 transition-all group cursor-pointer"
                         >
                            <td className="px-10 py-8">
                               <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shadow-inner">
                                     {w.user?.avatar_url ? <img src={w.user.avatar_url} className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-slate-600" />}
                                  </div>
                                  <div>
                                     <p className="font-black text-white text-base">{w.user?.full_name}</p>
                                     <p className="text-[10px] font-bold text-slate-500 tracking-tight">{w.user?.email}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="px-6 py-8 text-center">
                               <span className="text-2xl font-black text-white">{w.balance} <span className="text-[10px] text-slate-600 uppercase">UC</span></span>
                            </td>
                            <td className="px-6 py-8 text-center">
                               <span className="font-black text-green-400 text-sm">+{w.total_earned || 0} UC</span>
                            </td>
                            <td className="px-6 py-8 text-center">
                               <span className="font-black text-red-400 text-sm">-{w.total_spent || 0} UC</span>
                            </td>
                            <td className="px-6 py-8 text-center">
                               <span className="font-black text-amber-400 text-sm">{w.frozen_balance || 0} UC</span>
                            </td>
                            <td className="px-10 py-8 text-right">
                               <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                  <button onClick={(e) => { e.stopPropagation(); setSelectedWallet(w); setModalMode('add'); }} className="p-4 bg-green-500/10 text-green-400 border border-green-500/20 rounded-2xl hover:bg-green-500 hover:text-slate-900 transition-all shadow-xl"><Plus className="w-5 h-5" /></button>
                                  <button onClick={(e) => { e.stopPropagation(); setSelectedWallet(w); setModalMode('remove'); }} className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-xl"><Trash2 className="w-5 h-5" /></button>
                               </div>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
       </div>

       {modalMode && selectedWallet && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl" onClick={() => setModalMode(null)}>
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }} 
               animate={{ scale: 1, opacity: 1 }} 
               className={cn(
                 "bg-slate-900 border border-white/10 rounded-[56px] w-full p-12 shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col",
                 modalMode === 'history' ? "max-w-4xl max-h-[80vh]" : "max-w-lg"
               )}
               onClick={e => e.stopPropagation()}
             >
                {modalMode === 'history' ? (
                  <>
                    <div className="flex items-center justify-between mb-8">
                       <div>
                          <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Historique des Transactions</h3>
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">Dossier financier de {selectedWallet.user?.full_name}</p>
                       </div>
                       <button onClick={() => setModalMode(null)} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-red-500 transition-all border border-white/10"><X className="w-6 h-6" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-4">
                       {loadingHistory ? (
                         <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Chargement des données...</p>
                         </div>
                       ) : transactions.length > 0 ? (
                         transactions.map(t => {
                           const isCredit = ['deposit', 'reward', 'refund'].includes(t.type);
                           const isBlocked = t.status === 'pending' || t.status === 'frozen';
                           return (
                             <div key={t.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between group hover:bg-white/5 transition-all">
                                <div className="flex items-center gap-6">
                                   <div className={cn(
                                     "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110",
                                     isBlocked ? "bg-amber-500/20 text-amber-500" : (isCredit ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")
                                   )}>
                                      {isBlocked ? <Clock className="w-6 h-6" /> : (isCredit ? <TrendingUp className="w-6 h-6" /> : <TrendingUp className="w-6 h-6 rotate-180" />)}
                                   </div>
                                   <div>
                                      <p className="text-sm font-black text-white capitalize">{t.type} <span className="text-[10px] text-slate-500 opacity-50 ml-2">#{t.id.slice(0,8)}</span></p>
                                      <p className="text-[11px] text-slate-500 font-bold mt-1 line-clamp-1">{t.description || 'Aucun motif renseigné'}</p>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <p className={cn(
                                     "text-xl font-black",
                                     isBlocked ? "text-amber-500" : (isCredit ? "text-green-500" : "text-red-500")
                                   )}>
                                      {isCredit ? '+' : ''}{t.amount} UC
                                   </p>
                                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                      {new Date(t.created_at).toLocaleDateString()} à {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                                </div>
                             </div>
                           );
                         })
                       ) : (
                         <div className="text-center py-20">
                            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                               <Inbox className="w-10 h-10 text-slate-700" />
                            </div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Aucune transaction enregistrée</p>
                         </div>
                       )}
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">
                       {modalMode === 'add' ? 'Ajouter des UniCoins' : 'Retirer des UniCoins'}
                    </h3>
                    <p className="text-[10px] font-black text-slate-500 mb-10 uppercase tracking-widest border-b border-white/5 pb-4">Ajustement pour {selectedWallet.user?.full_name}</p>
                    
                    <div className="space-y-8">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Montant en UniCoins</label>
                          <input 
                            type="number" 
                            value={amount} 
                            onChange={e => setAmount(e.target.value)}
                            className="w-full p-8 bg-white/5 border border-white/10 rounded-[40px] text-4xl font-black text-white outline-none focus:border-primary/50 transition-all placeholder:text-white/5 shadow-inner"
                            placeholder="0"
                          />
                       </div>
                       <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Motif de l'opération</label>
                          <textarea 
                            value={reason} 
                            onChange={e => setReason(e.target.value)}
                            className="w-full p-8 bg-white/5 border border-white/10 rounded-[40px] text-white font-bold outline-none h-40 focus:border-primary/50 transition-all resize-none shadow-inner"
                            placeholder="Ex: Correction de solde, Récompense..."
                          />
                       </div>
                       <div className="flex gap-6 pt-6">
                          <button onClick={() => setModalMode(null)} className="flex-1 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-white/5 rounded-[32px] transition-all">Annuler</button>
                          <button 
                            onClick={handleTransaction}
                            className={cn(
                              "flex-1 py-6 text-slate-900 text-[10px] font-black rounded-[32px] uppercase tracking-widest shadow-2xl transition-all hover:scale-105 active:scale-95",
                              modalMode === 'add' ? "bg-green-400 shadow-green-400/20" : "bg-red-500 shadow-red-500/20 text-white"
                            )}
                          >
                             {modalMode === 'add' ? 'Confirmer le crédit' : 'Confirmer le retrait'}
                          </button>
                       </div>
                    </div>
                  </>
                )}
             </motion.div>
          </div>
       )}
    </div>
  );
};



// --- MODULE 7: SYSTÈME & LOGS ---

const AdminSystem = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => { 
    fetchHealth(); 
    fetchLogs();
  }, []);

  const fetchHealth = async () => {
    try {
      const res = await fetch('http://localhost:5051/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (e) { console.error('Failed to fetch health'); }
    setLoading(false);
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*, admin:users!admin_id(full_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (data) setLogs(data);
    setLoadingLogs(false);
  };

  const getActionColor = (action: string) => {
    if (action.includes('ban') || action.includes('delete')) return 'text-red-400 bg-red-400/10';
    if (action.includes('suspend') || action.includes('warn')) return 'text-amber-400 bg-amber-400/10';
    if (action.includes('create') || action.includes('approve')) return 'text-green-400 bg-green-400/10';
    return 'text-blue-400 bg-blue-400/10';
  };

  return (
    <>
    <div className="p-10 space-y-10 bg-slate-900/30 h-full overflow-y-auto custom-scrollbar">
       <div className="flex items-center justify-between">
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Configuration Système</h2>
          <div className="flex gap-4">
             <button onClick={() => { fetchHealth(); fetchLogs(); }} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/5 shadow-2xl">
                <RefreshCw className={cn("w-6 h-6", (loading || loadingLogs) && "animate-spin")} />
             </button>
          </div>
       </div>

       <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
          <div className="bg-white/[0.02] p-10 rounded-[56px] border border-white/[0.05] backdrop-blur-xl shadow-2xl flex flex-col">
             <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-4">
                <Activity className="w-6 h-6 text-primary" />
                Intégrité du Réseau
             </h4>
             <div className="space-y-6 flex-1">
                {[
                  { label: "Core Server", status: health?.python_alive ? "Operational" : "Offline", color: health?.python_alive ? "bg-green-400" : "bg-red-400" },
                  { label: "Supabase DB", status: "Connected", color: "bg-green-400" },
                  { label: "Storage Engine", status: "Syncing", color: "bg-blue-400" },
                  { label: "Python API", status: health?.python_status === 'healthy' ? "Ready" : "Error", color: health?.python_status === 'healthy' ? "bg-green-400" : "bg-red-400" }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-8 bg-white/[0.02] rounded-[32px] border border-white/[0.03] hover:bg-white/[0.04] transition-all">
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                     <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black text-white uppercase">{item.status}</span>
                        <div className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)]", item.color)} />
                     </div>
                  </div>
                ))}
             </div>
             <div className="mt-10 p-6 bg-primary/10 border border-primary/20 rounded-[32px]">
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2">Version Plateforme</p>
                <p className="text-xl font-black text-white">v2.4.0 <span className="text-xs text-slate-500 ml-2">Stable Build</span></p>
             </div>
          </div>

          <div className="bg-white/[0.02] p-10 rounded-[56px] border border-white/[0.05] backdrop-blur-xl shadow-2xl flex flex-col max-h-[700px]">
             <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                  Sécurité & Audit
                </div>
                <button onClick={fetchLogs} className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">Rafraîchir</button>
             </h4>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                {loadingLogs ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-[10px] font-black text-slate-500 uppercase">Synchronisation...</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-20 bg-slate-950/20 rounded-[40px] border border-dashed border-white/5">
                    <Inbox className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                    <p className="text-[10px] font-black text-slate-500 uppercase">Aucun log récent</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="p-5 bg-white/[0.02] border border-white/[0.03] rounded-[28px] group hover:bg-white/[0.05] transition-all flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg", getActionColor(log.action))}>
                             <Shield className="w-5 h-5" />
                          </div>
                          <div>
                             <p className="text-xs font-black text-white uppercase tracking-tight truncate max-w-[150px]">{log.action.replace(/_/g, ' ')}</p>
                             <div className="flex items-center gap-2 mt-1">
                                <img src={log.admin?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${log.admin_id}`} className="w-3.5 h-3.5 rounded-full" />
                                <p className="text-[9px] font-bold text-slate-500 uppercase">{log.admin?.full_name || 'Système'}</p>
                             </div>
                          </div>
                       </div>
                       <div className="text-right shrink-0">
                          <p className="text-[9px] font-black text-slate-400 uppercase">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter mt-1">{new Date(log.created_at).toLocaleDateString()}</p>
                       </div>
                    </div>
                  ))
                )}
             </div>
             
             <button 
               onClick={() => setShowLogs(true)}
               className="mt-6 w-full py-5 bg-white/5 border border-white/10 text-white text-[10px] font-black rounded-3xl uppercase tracking-widest hover:bg-white/10 transition-all"
             >
               Voir tous les journaux
             </button>
          </div>
       </div>
       </div>

       <AnimatePresence>
          {showLogs && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl">
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-slate-900 border border-white/10 rounded-[56px] w-full max-w-4xl max-h-[80vh] flex flex-col shadow-[0_0_150px_rgba(0,0,0,0.8)] overflow-hidden"
                >
                   <div className="p-10 border-b border-white/5 flex items-center justify-between">
                      <div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Journaux d'Audit</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Traçabilité des actions administratives</p>
                      </div>
                      <button onClick={() => setShowLogs(false)} className="p-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all border border-white/5"><X className="w-6 h-6" /></button>
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                      {loadingLogs ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                           <RefreshCw className="w-10 h-10 text-primary animate-spin" />
                           <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Récupération des données...</p>
                        </div>
                      ) : logs.length === 0 ? (
                        <div className="text-center py-20">
                           <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Aucun log trouvé</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                           {logs.map((log) => (
                              <div key={log.id} className="p-6 bg-white/[0.02] border border-white/[0.03] rounded-[32px] flex items-center justify-between hover:bg-white/[0.04] transition-all">
                                 <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                                       <Shield className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                       <p className="text-sm font-black text-white uppercase tracking-tight">{log.action}</p>
                                       <p className="text-[10px] font-bold text-slate-500">Par {log.admin?.full_name || 'Système'}</p>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(log.created_at).toLocaleString()}</p>
                                    {log.details && <p className="text-[9px] font-bold text-primary/60 truncate max-w-[200px] mt-1">{JSON.stringify(log.details)}</p>}
                                 </div>
                              </div>
                           ))}
                        </div>
                      )}
                   </div>
                </motion.div>
             </div>
          )}
        </AnimatePresence>
      </>
    );
};



// --- MAIN PANEL WRAPPER ---

export default function AdminPanel({ subTabContext }: { subTabContext?: any }) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminModule>('dashboard');
  const [stats, setStats] = useState({
    usersCount: 0,
    itemsCount: 0,
    totalBalance: 0,
    activeDisputes: 0,
    newUsersToday: 0,
    pendingModeration: 0
  });

  const fetchAdminStats = async () => {
    setIsLoading(true);
    try {
      const results = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('services').select('id', { count: 'exact' }),
        supabase.from('leads').select('id', { count: 'exact' }),
        supabase.from('unicoin_wallets').select('balance'),
        supabase.from('orders').select('id', { count: 'exact' }).not('dispute_status', 'is', null).eq('status', 'open'),
        supabase.from('users').select('id', { count: 'exact' }).gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
        supabase.from('services').select('id', { count: 'exact' }).eq('status', 'pending'),
        supabase.from('leads').select('id', { count: 'exact' }).eq('status', 'pending')
      ]);

      const [users, services, leads, wallets, disputes, newToday, pendingS, pendingL] = results;

      const totalBalance = (wallets.data || []).reduce((acc: any, w: any) => acc + (w.balance || 0), 0);
      
      setStats({
        usersCount: users.count || 0,
        itemsCount: (services.count || 0) + (leads.count || 0),
        totalBalance,
        activeDisputes: disputes.count || 0,
        newUsersToday: newToday.count || 0,
        pendingModeration: (pendingS.count || 0) + (pendingL.count || 0)
      });

      // Growth Chart Fix: Fetch last 7 days of user signups
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: recentUsers } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
      const growthMap: Record<string, number> = {};
      
      // Initialize last 7 days
      for(let i=6; i>=0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        growthMap[dayNames[d.getDay()]] = 0;
      }

      recentUsers?.forEach(u => {
        const day = dayNames[new Date(u.created_at).getDay()];
        if(growthMap[day] !== undefined) growthMap[day]++;
      });

      setGrowthData(Object.keys(growthMap).map(name => ({ name, value: growthMap[name] })));

    } catch (e) { 
      console.error(e); 
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminStats();
    // Refresh every 30 seconds for live feel
    const interval = setInterval(fetchAdminStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const [growthData, setGrowthData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Synchronisation avec le menu principal
  useEffect(() => {
    if (subTabContext?.subTab) {
      setActiveTab(subTabContext.subTab as AdminModule);
    }
  }, [subTabContext]);

  const renderModule = () => {
    switch (activeTab) {
      case 'dashboard': return <AdminDashboard stats={stats} growthData={growthData} />;
      case 'users': return <AdminUsers />;
      case 'moderations': return <AdminModeration />;
      case 'disputes': return <AdminDisputes />;
      case 'unicoins': return <AdminFinance />;
      case 'settings': return <AdminSystem />;
      default: return <AdminDashboard stats={stats} growthData={growthData} />;
    }
  };

  if (user?.email !== 'admin@uniskills.ma') {
    return (
      <div className="flex flex-col items-center justify-center py-40">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Accès Restreint</h2>
        <p className="text-slate-500 font-bold">Zone réservée au personnel administratif autorisé.</p>
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'moderations', label: 'Modérations', icon: ShieldCheck },
    { id: 'disputes', label: 'Litiges', icon: AlertTriangle },
    { id: 'unicoins', label: 'UniCoins', icon: DollarSign },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c] overflow-hidden font-['Inter',sans-serif]">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="w-full mx-auto px-6 py-6 space-y-6">
          
          {/* Global Premium Navbar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10 mb-8">
            {/* Branding on the Left */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 flex items-center justify-center transform hover:scale-105 transition-transform cursor-pointer">
                <img 
                  src="https://gwdhvmfrzmtpsuozooqn.supabase.co/storage/v1/object/public/logo.svg/logo.png" 
                  alt="UniSkills" 
                  className="w-full h-full object-contain" 
                />
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-black text-white tracking-tighter leading-none">UniAdmin</h1>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">UniSkills Plateforme</p>
              </div>
            </div>

            {/* Navigation Menu in the Middle */}
            <nav className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] p-1.5 rounded-[28px] backdrop-blur-md">
               {menuItems.map((item) => (
                 <button
                   key={item.id}
                   onClick={() => setActiveTab(item.id as AdminModule)}
                   className={cn(
                     "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                     activeTab === item.id 
                       ? "bg-white text-slate-900 shadow-2xl shadow-white/10" 
                       : "text-slate-500 hover:text-white hover:bg-white/5"
                   )}
                 >
                   <item.icon className={cn("w-4 h-4", activeTab === item.id ? "text-slate-900" : "text-slate-500")} />
                   {item.label}
                 </button>
               ))}
            </nav>

            <div className="flex items-center gap-6">
              <div className="flex flex-col items-end">
                <p className="text-sm font-black text-white tracking-tight uppercase">{user?.full_name}</p>
                <p className="text-[9px] font-bold text-primary uppercase tracking-widest">Administrateur</p>
              </div>

              <button 
                onClick={() => logout()}
                className="p-3 bg-white/5 text-slate-400 rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-white/10"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -40, filter: 'blur(10px)' }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative min-h-[850px] flex flex-col"
            >
               {/* Background Glows Removed */}
               
               <div className="flex-1 bg-white/[0.01] border border-white/[0.05] rounded-[64px] backdrop-blur-2xl shadow-[0_40px_100px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col relative z-10">
                  {renderModule()}
               </div>
            </motion.div>
          </AnimatePresence>
          

        </div>
      </div>
    </div>
  );
}
