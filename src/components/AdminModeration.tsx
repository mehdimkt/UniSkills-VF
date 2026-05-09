import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  FileText, 
  Eye, 
  Trash2, 
  Archive, 
  RefreshCw, 
  User, 
  Clock, 
  Image as ImageIcon,
  X,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  ChevronDown,
  DollarSign,
  Tag,
  Edit2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { sendNotification } from '../lib/notifications';

const AdminModeration = () => {
  const [activeTab, setActiveTab] = useState<'services' | 'leads' | 'archives'>('services');

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3 uppercase">
            <ShoppingBag className="w-8 h-8 text-primary" /> Modération Marketplace
          </h2>
          <p className="text-slate-500 font-bold mt-1">Gérez la visibilité des annonces et consultez l'historique.</p>
        </div>

        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-fit">
          {[
            { id: 'services', label: 'Services', icon: ShoppingBag },
            { id: 'leads', label: 'Demandes', icon: FileText },
            { id: 'archives', label: 'Archives', icon: Archive },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all",
                activeTab === tab.id 
                  ? "bg-white text-primary shadow-lg shadow-primary/5" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[600px]">
        {activeTab === 'services' && <ModerationTable type="service" />}
        {activeTab === 'leads' && <ModerationTable type="lead" />}
        {activeTab === 'archives' && <ArchivesList />}
      </div>
    </div>
  );
};

// --- TABLE COMPONENT FOR SERVICES & LEADS ---

const ModerationTable = ({ type }: { type: 'service' | 'lead' }) => {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes catégories');
  const [maxPrice, setMaxPrice] = useState<number>(2000);

  const fetchData = async () => {
    setLoading(true);
    try {
      const tableName = type === 'service' ? 'services' : 'leads';
      const userRef = type === 'service' ? 'user_id' : 'owner_id';
      const countRef = type === 'service' ? 'orders' : 'proposals';
      const userLabel = type === 'service' ? 'user' : 'owner';

      const { data, error } = await supabase
        .from(tableName)
        .select(`
          *,
          ${userLabel}:users!${userRef}(id, full_name, email, avatar_url),
          ${countRef}(count)
        `)
        .neq('status', 'removed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems(data || []);

      // Extract unique categories from items
      const uniqueCats = Array.from(new Set((data || []).map((item: any) => item.category).filter(Boolean))) as string[];
      setCategories(['Toutes catégories', ...uniqueCats.sort()]);
    } catch (err) {
      console.error('Fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [type]);

  const handleHide = async (item: any) => {
    if (!window.confirm("Voulez-vous vraiment masquer cette annonce ? L'utilisateur sera notifié.")) return;
    
    setIsDeleting(item.id);
    try {
      const tableName = type === 'service' ? 'services' : 'leads';
      const userId = type === 'service' ? item.user_id : item.owner_id;

      const { error } = await supabase
        .from(tableName)
        .update({ status: 'removed', updated_at: new Date().toISOString() })
        .eq('id', item.id);

      if (error) throw error;

      await sendNotification(
        userId,
        "⚠️ Votre annonce a été masquée",
        `Votre ${type === 'service' ? 'service' : 'demande'} "${item.title}" a été retiré par la modération car il ne respecte pas nos règles.`,
        'error'
      );

      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (err) {
      alert("Erreur lors de la suppression");
    }
    setIsDeleting(null);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (item.user || item.owner)?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Toutes catégories' || item.category === selectedCategory;
    const itemPrice = item.price || item.budget || 0;
    const matchesPrice = itemPrice <= maxPrice;
    
    return matchesSearch && matchesCategory && matchesPrice;
  });

  if (loading) return <div className="p-20 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <>
      {/* Search & Filter Bar */}
      <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher par titre ou auteur..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
             <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
             <select 
               className="pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
               value={selectedCategory}
               onChange={(e) => setSelectedCategory(e.target.value)}
             >
               {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
             </select>
             <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-1.5 min-w-[240px]">
            <DollarSign className="w-4 h-4 text-slate-400" />
            <div className="flex-1">
               <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prix max</p>
                  <input 
                    type="number" 
                    value={maxPrice} 
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    className="w-16 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-primary px-1 text-right outline-none"
                  />
               </div>
               <input 
                 type="range" min="0" max="2000" step="50" 
                 value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value))}
                 className="w-full accent-primary h-1 bg-slate-100 rounded-full cursor-pointer"
               />
            </div>
          </div>
        </div>

        <div className="ml-auto text-xs font-black text-slate-400 uppercase tracking-widest">
           {filteredItems.length} Résultat{filteredItems.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-8 py-5">Visuel</th>
              <th className="px-6 py-5">Titre & Auteur</th>
              <th className="px-6 py-5">Catégorie</th>
              <th className="px-6 py-5">Prix / Budget</th>
              <th className="px-6 py-5 text-center">Activité</th>
              <th className="px-6 py-5">Date Création</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredItems.length === 0 ? (
              <tr><td colSpan={6} className="py-20 text-center font-bold text-slate-400">Aucune annonce ne correspond aux filtres.</td></tr>
            ) : (
              filteredItems.map(item => {
                const owner = type === 'service' ? item.user : item.owner;
                const count = (type === 'service' ? item.orders : item.proposals)?.[0]?.count || 0;
                const imageUrl = type === 'service' ? (item.cover_image || item.image_url) : item.image_url;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-5">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden border border-slate-100 flex items-center justify-center">
                        {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="font-black text-slate-900 line-clamp-1">{item.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">{owner?.full_name}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black uppercase text-slate-500">
                        {item.category || 'Autre'}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-black text-primary">{item.price || item.budget} UC</td>
                    <td className="px-6 py-5 text-center text-xs font-bold text-slate-600">{count} {type === 'service' ? 'cmd' : 'prop'}</td>
                    <td className="px-6 py-5 text-xs font-bold text-slate-400">{new Date(item.created_at).toLocaleDateString()}</td>
                    <td className="px-8 py-5">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setSelectedItem(item)} className="px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">Détails</button>
                        <button onClick={() => handleHide(item)} disabled={isDeleting === item.id} className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all">
                          {isDeleting === item.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedItem && <DetailsModal item={selectedItem} type={type} onClose={() => setSelectedItem(null)} />}
      </AnimatePresence>
    </>
  );
};

// --- ARCHIVES LIST ---

const ArchivesList = () => {
  const [archives, setArchives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'service' | 'lead'>('all');

  useEffect(() => {
    const fetchArchives = async () => {
      const [servicesRes, leadsRes] = await Promise.all([
        supabase.from('services').select('*, user:users!user_id(full_name), orders(count)').eq('status', 'removed'),
        supabase.from('leads').select('*, owner:users!owner_id(full_name), proposals(count)').eq('status', 'removed')
      ]);
      const combined = [
        ...(servicesRes.data || []).map(s => ({ ...s, item_type: 'service' })),
        ...(leadsRes.data || []).map(l => ({ ...l, item_type: 'lead' }))
      ].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
      setArchives(combined);
      setLoading(false);
    };
    fetchArchives();
  }, []);

  const filteredArchives = archives.filter(item => {
    const owner = item.item_type === 'service' ? item.user : item.owner;
    const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || item.item_type === typeFilter;
    return matchesSearch && matchesType;
  });

  if (loading) return <div className="p-20 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <>
      {/* Search & Filter Bar */}
      <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Rechercher dans les archives..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex bg-white border border-slate-200 rounded-2xl p-1">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'service', label: 'Services' },
            { id: 'lead', label: 'Demandes' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setTypeFilter(opt.id as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                typeFilter === opt.id ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-600"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-8 py-5">Type</th>
              <th className="px-6 py-5">Titre</th>
              <th className="px-6 py-5">Catégorie</th>
              <th className="px-6 py-5">Propriétaire</th>
              <th className="px-6 py-5">Valeur</th>
              <th className="px-6 py-5">Date Action</th>
              <th className="px-8 py-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredArchives.length === 0 ? (
              <tr><td colSpan={6} className="py-20 text-center font-bold text-slate-400">Aucune archive ne correspond.</td></tr>
            ) : (
              filteredArchives.map(item => {
               const owner = item.item_type === 'service' ? item.user : item.owner;
               const imageUrl = item.item_type === 'service' ? (item.cover_image || item.image_url) : item.image_url;
               
               return (
                <tr key={item.id} className="hover:bg-slate-50/50 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all">
                  <td className="px-8 py-5"><span className="px-2 py-1 bg-slate-100 rounded text-[9px] font-black uppercase tracking-widest">{item.item_type}</span></td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-slate-200 rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                          {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" /> : <ImageIcon className="w-4 h-4 text-slate-400" />}
                       </div>
                       <div>
                          <p className="font-black text-slate-900 line-clamp-1">{item.title}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{owner?.full_name}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-[10px] font-black uppercase text-slate-400">
                    {item.category || 'N/A'}
                  </td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-500">{(item.user || item.owner)?.full_name}</td>
                  <td className="px-6 py-5 font-black text-slate-600">{item.price || item.budget} UC</td>
                  <td className="px-6 py-5 text-xs font-bold text-slate-400 italic">{new Date(item.updated_at || item.created_at).toLocaleDateString()}</td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => setSelectedItem(item)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
               )
              }))}
          </tbody>
        </table>
      </div>
      <AnimatePresence>
        {selectedItem && <DetailsModal item={selectedItem} type={selectedItem.item_type} onClose={() => setSelectedItem(null)} />}
      </AnimatePresence>
    </>
  );
};

// --- DETAILS MODAL ---

const DetailsModal = ({ item, type, onClose }: any) => {
  const owner = type === 'service' ? item.user : item.owner;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={e => e.stopPropagation()} className="bg-white rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Détails de l'annonce</h3>
          <button onClick={onClose} className="p-2 hover:bg-red-500 hover:text-white rounded-xl transition-all"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="aspect-video bg-slate-100 rounded-3xl overflow-hidden border-4 border-white shadow-lg">
            {(item.cover_image || item.image_url) ? <img src={item.cover_image || item.image_url} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-slate-300 font-black uppercase">Aucun Visuel</div>}
          </div>
          <div className="space-y-4">
            <h4 className="text-2xl font-black text-slate-900">{item.title}</h4>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-lg font-black text-[10px] uppercase">{item.category}</span>
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg font-black text-[10px] uppercase">{item.price || item.budget} UC</span>
            </div>
            <p className="text-slate-600 font-medium leading-relaxed whitespace-pre-wrap bg-slate-50 p-6 rounded-3xl border border-slate-100">{item.description}</p>
          </div>
          <div className="bg-slate-900 p-6 rounded-3xl text-white flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-black text-lg">{owner?.full_name?.[0] || 'U'}</div>
            <div>
              <p className="font-black">{owner?.full_name}</p>
              <p className="text-xs text-white/50">{owner?.email}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const CategoryManager = () => {
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
        const sorted = data.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0) || a.name.localeCompare(b.name));
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
        await supabase.from('categories').update({ name: payload.name, icon: payload.icon, color: payload.color }).eq('id', payload.id);
      } else {
        await supabase.from('categories').insert([{ ...payload, order_index: categories.length }]);
      }
      fetchCategories();
      setShowAdd(false);
      setEditingCat(null);
      setNewCat({ name: '', icon: '', color: '#1e3a8a', is_active: true });
    } catch (e) { alert("Erreur"); }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;
    const newCats = [...categories];
    const draggedCat = newCats[draggedItem];
    newCats.splice(draggedItem, 1);
    newCats.splice(index, 0, draggedCat);
    setDraggedItem(index);
    setCategories(newCats);
  };

  const handleDragEnd = async () => {
    setDraggedItem(null);
    for (let i = 0; i < categories.length; i++) {
      await supabase.from('categories').update({ order_index: i }).eq('id', categories[i].id);
    }
  };

  const handleCategoryDelete = async (id: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cette catégorie ?")) return;
    try {
      await supabase.from('categories').delete().eq('id', id);
      fetchCategories();
    } catch (e) { alert("Erreur lors de la suppression"); }
  };

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in duration-700">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Gestion des Catégories</h3>
        <button onClick={() => setShowAdd(true)} className="px-6 py-3 bg-primary text-white text-[10px] font-black rounded-xl uppercase tracking-widest flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/20">
          Ajouter une catégorie
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
              "p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between group transition-all cursor-move",
              draggedItem === index && "opacity-30 border-dashed border-primary"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: cat.color }}>
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-slate-900 uppercase tracking-tight">{cat.name}</p>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => setEditingCat(cat)} className="p-2 text-slate-400 hover:text-blue-500"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => handleCategoryDelete(cat.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAdd || editingCat) && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white p-10 rounded-[48px] w-full max-w-md shadow-2xl">
              <h3 className="text-2xl font-black text-slate-900 mb-8 uppercase tracking-tighter">
                {editingCat ? 'Modifier' : 'Nouvelle'} Catégorie
              </h3>
              <div className="space-y-6">
                <input 
                  type="text" placeholder="Nom de la catégorie" 
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  value={editingCat ? editingCat.name : newCat.name}
                  onChange={e => editingCat ? setEditingCat({...editingCat, name: e.target.value}) : setNewCat({...newCat, name: e.target.value})}
                />
                <div className="flex gap-4">
                   <input 
                    type="color" className="w-16 h-16 rounded-2xl border-none p-0 cursor-pointer"
                    value={editingCat ? editingCat.color : newCat.color}
                    onChange={e => editingCat ? setEditingCat({...editingCat, color: e.target.value}) : setNewCat({...newCat, color: e.target.value})}
                  />
                  <input 
                    type="text" placeholder="Icône (ex: ShoppingBag)" 
                    className="flex-1 p-5 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary/20"
                    value={editingCat ? editingCat.icon : newCat.icon}
                    onChange={e => editingCat ? setEditingCat({...editingCat, icon: e.target.value}) : setNewCat({...newCat, icon: e.target.value})}
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => { setShowAdd(false); setEditingCat(null); }} className="flex-1 py-5 text-xs font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Annuler</button>
                  <button onClick={() => handleSave(!!editingCat)} className="flex-1 py-5 bg-primary text-white text-xs font-black rounded-2xl uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">Sauvegarder</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminModeration;
