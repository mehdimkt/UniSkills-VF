// src/views/Favorites.tsx
import React, { useState, useEffect } from 'react';
import { 
  Heart, Plus, FolderHeart, Trash2, ChevronRight, X, Trash2 as TrashIcon, Edit2, Pin, PinOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Collection {
  id: string;
  name: string;
  count: number;
  items?: any[];
}

interface FavoriteItem {
  id: string;
  item_id: string;
  title: string;
  price: number;
  image_url?: string;
  type: string;
}

export default function Favorites({ onNavigate }: { onNavigate?: (view: string, context?: any) => void }) {
  const { user, role } = useAuth();
  const isAideur = role === 'aideur';
  const currentMode = isAideur ? 'aideur' : 'demandeur';
  
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Nouveaux états pour renommage et épinglage
  const [showEditModal, setShowEditModal] = useState<{ id: string, name: string } | null>(null);
  const [pinnedCollections, setPinnedCollections] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('pinnedCollections');
    if (saved) setPinnedCollections(JSON.parse(saved));
  }, []);

  const togglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setPinnedCollections(prev => {
      const next = prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id];
      localStorage.setItem('pinnedCollections', JSON.stringify(next));
      return next;
    });
  };

  const renameCollection = async () => {
    if (!showEditModal || !showEditModal.name.trim()) return;
    
    try {
      const { error } = await supabase
        .from('collections')
        .update({ name: showEditModal.name.trim() })
        .eq('id', showEditModal.id);
        
      if (error) throw error;
      
      setCollections(prev => prev.map(c => c.id === showEditModal.id ? { ...c, name: showEditModal.name.trim() } : c));
      setShowEditModal(null);
    } catch (err) {
      console.error('Error renaming collection:', err);
      alert('Erreur lors du renommage');
    }
  };

  useEffect(() => {
    fetchCollectionsAndFavorites();
  }, [user, isAideur]);

  const fetchCollectionsAndFavorites = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Récupérer les collections du mode actuel
      const { data: collectionsData } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('mode', currentMode)
        .order('created_at', { ascending: true });
      
      if (collectionsData) {
        const collectionsWithCount = await Promise.all(
          collectionsData.map(async (collection) => {
            // Récupérer les favoris de cette collection
            const { data: favorites } = await supabase
              .from('favorites')
              .select('item_id, item_type')
              .eq('collection_id', collection.id)
              .eq('mode', currentMode);
            
            // Récupérer les détails des items (services ou leads)
            let items: any[] = [];
            if (favorites && favorites.length > 0) {
              for (const fav of favorites) {
                const table = fav.item_type === 'service' ? 'services' : 'leads';
                const { data: itemData } = await supabase
                  .from(table)
                  .select('id, title, price, image_url, cover_image')
                  .eq('id', fav.item_id)
                  .single();
                
                if (itemData) {
  items.push({
    id: itemData.id,
    item_id: fav.item_id,
    title: itemData.title,
    price: itemData.price || <span style={{ color: 'red', textDecoration: 'underline' }}>itemData.budget</span>,
    image_url: itemData.image_url || itemData.cover_image,
    type: fav.item_type
  });
                }
              }
            }
            
            return {
              id: collection.id,
              name: collection.name,
              count: favorites?.length || 0,
              items
            };
          })
        );
        
        setCollections(collectionsWithCount);
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
    } finally {
      setLoading(false);
    }
  };

  const createCollection = async () => {
    if (!newCollectionName.trim() || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('collections')
        .insert({
          user_id: user.id,
          name: newCollectionName.trim(),
          mode: currentMode
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCollections(prev => [...prev, { id: data.id, name: data.name, count: 0, items: [] }]);
      setNewCollectionName('');
      setShowAddModal(false);
    } catch (err) {
      console.error('Error creating collection:', err);
      alert('Erreur lors de la création');
    }
  };

  const deleteCollection = async (collectionId: string) => {
    if (!confirm('Supprimer cette collection ? Les favoris associés seront également supprimés.')) return;
    
    try {
      await supabase.from('favorites').delete().eq('collection_id', collectionId);
      await supabase.from('collections').delete().eq('id', collectionId);
      
      setCollections(prev => prev.filter(c => c.id !== collectionId));
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(null);
      }
    } catch (err) {
      console.error('Error deleting collection:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const removeFromCollection = async (collectionId: string, itemId: string) => {
    try {
      await supabase
        .from('favorites')
        .delete()
        .eq('collection_id', collectionId)
        .eq('item_id', itemId);
      
      // Mettre à jour l'affichage
      setCollections(prev => prev.map(c => {
        if (c.id === collectionId) {
          const newItems = (c.items || []).filter(i => i.item_id !== itemId);
          return { ...c, count: newItems.length, items: newItems };
        }
        return c;
      }));
      
      if (selectedCollection && selectedCollection.id === collectionId) {
        setSelectedCollection(prev => prev ? { ...prev, count: (prev.items?.length || 1) - 1, items: (prev.items || []).filter(i => i.item_id !== itemId) } : null);
      }
    } catch (err) {
      console.error('Error removing favorite:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {selectedCollection 
              ? selectedCollection.name 
              : (isAideur ? "Demandes Likées" : "Services Likés")}
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            {selectedCollection 
              ? `${selectedCollection.count} élément${selectedCollection.count > 1 ? 's' : ''} dans cette collection`
              : 'Gérez vos sélections par collection.'}
          </p>
        </div>
        
        <div className="flex gap-3">
          {selectedCollection && (
            <button 
              onClick={() => setSelectedCollection(null)}
              className="px-5 py-2.5 bg-slate-100 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all"
            >
              Toutes les collections
            </button>
          )}
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Créer une collection
          </button>
        </div>
      </div>

      {!selectedCollection ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {collections
            .sort((a, b) => (pinnedCollections.includes(b.id) ? 1 : 0) - (pinnedCollections.includes(a.id) ? 1 : 0))
            .map((collection) => (
            <motion.div 
              key={collection.id}
              whileHover={{ y: -8 }}
              onClick={() => setSelectedCollection(collection)}
              className={`bg-white p-8 rounded-[40px] border shadow-sm hover:shadow-2xl transition-all cursor-pointer group relative ${pinnedCollections.includes(collection.id) ? 'border-primary shadow-primary/10' : 'border-slate-100'}`}
            >
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => togglePin(e, collection.id)}
                  className={`p-1.5 transition-all rounded-full ${pinnedCollections.includes(collection.id) ? 'text-primary bg-primary/10' : 'text-slate-300 hover:text-primary hover:bg-primary/10'}`}
                  title={pinnedCollections.includes(collection.id) ? "Désépingler" : "Épingler"}
                >
                  {pinnedCollections.includes(collection.id) ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEditModal({ id: collection.id, name: collection.name }); }}
                  className="p-1.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 transition-all rounded-full"
                  title="Renommer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCollection(collection.id); }}
                  className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all rounded-full"
                  title="Supprimer"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-white transition-colors">
                <FolderHeart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 flex items-center gap-2">
                {collection.name}
                {pinnedCollections.includes(collection.id) && <Pin className="w-4 h-4 text-primary fill-primary" />}
              </h3>
              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                <span className="text-[10px] text-slate-400 font-black">
                  {collection.count} élément{collection.count > 1 ? 's' : ''}
                </span>
                <ChevronRight className="w-4 h-4 text-primary transform translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
              </div>
            </motion.div>
          ))}
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="p-8 rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-primary hover:text-primary transition-all group"
          >
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center group-hover:border-primary transition-colors">
              <Plus className="w-8 h-8" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest">Nouvelle Collection</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {selectedCollection.items && selectedCollection.items.length > 0 ? (
            selectedCollection.items.map((item) => (
              <div key={item.id} 
                   onClick={() => onNavigate?.('marketplace', { openItemId: item.item_id })}
                   className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <img src={item.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=100'} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-slate-900 group-hover:text-primary transition-colors">{item.title}</h4>
                  <p className="text-xs text-slate-500">{item.type === 'service' ? 'Service' : 'Demande d\'aide'}</p>
                  <p className="text-sm font-black text-primary">{item.price} UC</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromCollection(selectedCollection.id, item.item_id); }}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Retirer de la collection"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-100">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FolderHeart className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Collection vide</h3>
              <p className="text-slate-500 max-w-xs mx-auto">
                Explorez la marketplace et ajoutez vos coups de cœur à cette collection.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal création collection */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black text-slate-900 mb-6">Nouvelle collection</h3>
              <div className="space-y-4">
                <input 
                  autoFocus
                  type="text" 
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Ex: Projets intéressants..."
                />
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 text-slate-500 font-bold text-sm rounded-xl hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={createCollection}
                    disabled={!newCollectionName.trim()}
                    className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-xl disabled:opacity-50"
                  >
                    Créer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal renommage collection */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl"
            >
              <h3 className="text-xl font-black text-slate-900 mb-6">Renommer la collection</h3>
              <div className="space-y-4">
                <input 
                  autoFocus
                  type="text" 
                  value={showEditModal.name}
                  onChange={(e) => setShowEditModal({ ...showEditModal, name: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Nouveau nom..."
                />
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowEditModal(null)}
                    className="flex-1 py-3 text-slate-500 font-bold text-sm rounded-xl hover:bg-slate-50"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={renameCollection}
                    disabled={!showEditModal.name.trim()}
                    className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-xl disabled:opacity-50"
                  >
                    Enregistrer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}