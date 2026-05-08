import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Clock, DollarSign, Edit3, Trash2, Eye, X,
  Upload, Timer, RotateCw, Star, Shield, Package, Search, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type ServiceStatus = 'Actif' | 'En pause' | 'Brouillon';

interface UserService {
  id: string;
  title: string;
  short_description: string;
  description: string;
  price: number;
  category: string;
  image: string;
  status: ServiceStatus;
  revision_ceiling: number;
  cancellation_delay: string;
  delivery_delay: string;
  rating: number;
  sales_count: number;
  date: string;
}

const categories = [
  'Informatique', 'Design', 'Soutien Scolaire', 'Rédaction',
  'Traduction', 'Marketing', 'Photographie', 'Musique', 'Sport', 'Autre'
];

const statusColors = {
  'Actif': 'bg-green-100 text-green-700 border-green-200',
  'En pause': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Brouillon': 'bg-slate-100 text-slate-700 border-slate-200'
};

export default function MyServices({ onNavigate }: { onNavigate?: (view: string, context?: any) => void }) {
  const { user } = useAuth();
  const [services, setServices] = useState<UserService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('tous');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<UserService | null>(null);
  const [editingService, setEditingService] = useState<UserService | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formStatus, setFormStatus] = useState<ServiceStatus>('Actif');
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Informatique');
  const [formPrice, setFormPrice] = useState('');
  const [formShortDesc, setFormShortDesc] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRevisions, setFormRevisions] = useState('3');
  const [formCancellation, setFormCancellation] = useState('24h');
  const [formDelivery, setFormDelivery] = useState('3');
  const [formImage, setFormImage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchServices = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = data.map((s: any) => ({
        id: s.id.toString(),
        title: s.title,
        description: s.description || '',
        short_description: s.short_description || (s.description ? s.description.substring(0, 80) + '...' : ''),
        price: s.price,
        category: s.category,
        image: s.cover_image || s.image_url || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400',
        status: s.status === 'active' ? 'Actif' : s.status === 'paused' ? 'En pause' : 'Brouillon',
        revision_ceiling: s.revision_ceiling || 3,
        cancellation_delay: s.cancellation_delay || '24h',
        delivery_delay: s.delivery_time ? `${s.delivery_time} jours` : '3 jours',
        rating: s.rating || 0,
        sales_count: s.sales_count || 0,
        date: s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR')
      }));
      setServices(mapped);
    } catch (err) {
      console.error('Error fetching services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [user]);

  const filteredServices = services.filter(service => {
    const matchesSearch = service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.short_description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'tous' || service.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const previewUrl = URL.createObjectURL(file);
    setFormImage(previewUrl);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `services/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setFormImage(urlData.publicUrl);
      setUploadProgress(100);
      setTimeout(() => setUploadProgress(0), 1000);
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Erreur lors de l\'upload de l\'image');
      setFormImage(null);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (!formTitle.trim()) {
      alert('Veuillez entrer un titre');
      return;
    }
    if (!formPrice || parseInt(formPrice) <= 0) {
      alert('Veuillez entrer un prix valide');
      return;
    }
    if (!formDesc.trim()) {
      alert('Veuillez entrer une description');
      return;
    }

    setIsSubmitting(true);

    const serviceData = {
      user_id: user.id,
      title: formTitle,
      description: formDesc,
      short_description: formShortDesc,
      price: parseInt(formPrice),
      category: formCategory,
      cover_image: formImage || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400',
      status: formStatus === 'Actif' ? 'active' : formStatus === 'En pause' ? 'paused' : 'draft',
      delivery_time: parseInt(formDelivery),
      revision_ceiling: parseInt(formRevisions),
      cancellation_delay: formCancellation,
      rating: editingService?.rating || 0,
      sales_count: editingService?.sales_count || 0,
      created_at: editingService?.date ? new Date(editingService.date) : new Date(),
      updated_at: new Date()
    };

    try {
      if (editingService) {
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', parseInt(editingService.id));

        if (error) throw error;
        alert('✅ Service modifié avec succès !');
      } else {
        const { error } = await supabase
          .from('services')
          .insert([serviceData]);

        if (error) throw error;
        alert('✅ Service publié avec succès !');
      }

      closeModal();
      fetchServices();
    } catch (err) {
      console.error('Error saving service:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer ce service ? Cette action est irréversible.')) return;

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', parseInt(id));

      if (error) throw error;
      setServices(prev => prev.filter(s => s.id !== id));
      alert('Service supprimé avec succès');
    } catch (err) {
      console.error('Error deleting service:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const toggleStatus = async (id: string) => {
    const service = services.find(s => s.id === id);
    if (!service) return;

    const nextStatus: ServiceStatus = service.status === 'Actif' ? 'En pause' : 'Actif';
    const dbStatus = nextStatus === 'Actif' ? 'active' : 'paused';

    try {
      const { error } = await supabase
        .from('services')
        .update({ status: dbStatus, updated_at: new Date() })
        .eq('id', parseInt(id));

      if (error) throw error;
      setServices(prev => prev.map(s => s.id === id ? { ...s, status: nextStatus } : s));
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleOpenCreate = () => {
    setEditingService(null);
    setFormStatus('Actif');
    setFormTitle('');
    setFormCategory('Informatique');
    setFormPrice('');
    setFormShortDesc('');
    setFormDesc('');
    setFormRevisions('3');
    setFormCancellation('24h');
    setFormDelivery('3');
    setFormImage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (service: UserService) => {
    setEditingService(service);
    setFormStatus(service.status);
    setFormTitle(service.title);
    setFormCategory(service.category);
    setFormPrice(service.price.toString());
    setFormShortDesc(service.short_description);
    setFormDesc(service.description);
    setFormRevisions(service.revision_ceiling.toString());
    setFormCancellation(service.cancellation_delay);
    setFormDelivery(service.delivery_delay.replace(' jours', ''));
    setFormImage(service.image);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingService(null);
    setFormImage(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Mes Services</h2>
          <p className="text-slate-500 font-medium">Gérez vos offres, prix et conditions</p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-6 py-3 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouveau service
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher un service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-primary outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl appearance-none focus:ring-2 focus:ring-primary outline-none font-medium"
          >
            <option value="tous">Tous les statuts</option>
            <option value="Actif">Actifs</option>
            <option value="En pause">En pause</option>
            <option value="Brouillon">Brouillons</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {filteredServices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <motion.div
              key={service.id}
              layoutId={service.id}
              className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="h-48 relative overflow-hidden bg-slate-100">
                <img
                  src={service.image}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt={service.title}
                />
                <div className="absolute top-4 left-4">
                  <button
                    onClick={() => toggleStatus(service.id)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-xl border backdrop-blur-md shadow-sm transition-all ${statusColors[service.status]}`}
                  >
                    {service.status}
                  </button>
                </div>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => handleOpenEdit(service)}
                    className="p-2 bg-white/90 backdrop-blur-md rounded-xl text-slate-600 hover:text-primary transition-all shadow-sm"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(service.id)}
                    className="p-2 bg-white/90 backdrop-blur-md rounded-xl text-slate-600 hover:text-red-500 transition-all shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-primary/5 text-primary text-[9px] font-black uppercase rounded-lg">
                    {service.category}
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900 mb-1 line-clamp-1">{service.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2 mb-4">{service.short_description}</p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Prix</p>
                    <p className="text-xl font-black text-primary">{service.price} UC</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Ventes</p>
                    <p className="text-xl font-black text-slate-700">{service.sales_count}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-secondary fill-current" />
                    <span className="text-sm font-bold text-slate-900">{service.rating || 'Nouveau'}</span>
                  </div>
                  <button
                    onClick={() => setSelectedService(service)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-black transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Aperçu
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Aucun service</h3>
          <p className="text-slate-500 mb-6">Vous n'avez pas encore créé de service</p>
          <button
            onClick={handleOpenCreate}
            className="px-6 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20"
          >
            Créer mon premier service
          </button>
        </div>
      )}

      {/* Modal Création/Modification */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {editingService ? 'Modifier le service' : 'Nouveau service'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    {editingService ? 'Modifiez les informations de votre service' : 'Créez une nouvelle offre'}
                  </p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Titre du service *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                    placeholder="Ex: Coaching en développement web"
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Catégorie</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                    >
                      {categories.map(cat => <option key={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Prix (UC) *</label>
                    <input
                      type="number"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                      placeholder="250"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Statut</label>
                  <div className="flex gap-3">
                    {(['Actif', 'En pause', 'Brouillon'] as ServiceStatus[]).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormStatus(s)}
                        className={`flex-1 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${formStatus === s ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Accroche (description courte)</label>
                  <input
                    type="text"
                    value={formShortDesc}
                    onChange={(e) => setFormShortDesc(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                    placeholder="Une phrase qui résume votre service..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Description détaillée *</label>
                  <textarea
                    rows={5}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium resize-none"
                    placeholder="Décrivez précisément ce que vous proposez, vos conditions, etc..."
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">Image de couverture</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary transition-all relative overflow-hidden min-h-[160px]"
                  >
                    {formImage ? (
                      <>
                        <img src={formImage} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Preview" />
                        <div className="relative z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full">
                          <Upload className="w-5 h-5 inline mr-2" />
                          <span className="text-sm font-medium">Changer l'image</span>
                        </div>
                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="absolute bottom-0 left-0 h-1 bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                        )}
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-slate-300" />
                        <span className="text-sm font-medium text-slate-500">Cliquez pour uploader une image</span>
                        <span className="text-xs text-slate-400">PNG, JPG jusqu'à 5 Mo</span>
                      </>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </div>

                <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                  <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Paramètres avancés
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block flex items-center gap-1">
                        <RotateCw className="w-3 h-3" /> Révisions
                      </label>
                      <input
                        type="number"
                        value={formRevisions}
                        onChange={(e) => setFormRevisions(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Annulation
                      </label>
                      <select
                        value={formCancellation}
                        onChange={(e) => setFormCancellation(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-center font-bold"
                      >
                        <option>12h</option><option>24h</option><option>48h</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block flex items-center gap-1">
                        <Timer className="w-3 h-3" /> Livraison (heures)
                      </label>
                      <input
                        type="number"
                        value={formDelivery}
                        onChange={(e) => setFormDelivery(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 text-slate-500 font-black text-sm rounded-xl hover:bg-slate-50 transition-all">
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSubmitting || !formTitle || !formPrice || !formDesc}
                  className="flex-1 py-3.5 bg-primary text-white font-black text-sm rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    editingService ? 'Enregistrer' : 'Publier le service'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Aperçu */}
      <AnimatePresence>
        {selectedService && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="relative h-48 overflow-hidden">
                <img src={selectedService.image} className="w-full h-full object-cover" alt={selectedService.title} />
                <button
                  onClick={() => setSelectedService(null)}
                  className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg hover:bg-white transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-black uppercase rounded-full">
                    {selectedService.category}
                  </span>
                  <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${statusColors[selectedService.status]}`}>
                    {selectedService.status}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">{selectedService.title}</h2>
                <p className="text-slate-500 text-sm mb-4">{selectedService.short_description}</p>
                <div className="p-5 bg-slate-50 rounded-2xl italic mb-5">
                  <p className="text-slate-600 text-sm">{selectedService.description}</p>
                </div>
                <div className="grid grid-cols-3 gap-4 py-4 border-y border-slate-100">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Prix</p>
                    <p className="text-2xl font-black text-primary">{selectedService.price} UC</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Livraison</p>
                    <p className="text-sm font-bold">{selectedService.delivery_delay}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Révisions</p>
                    <p className="text-sm font-bold">{selectedService.revision_ceiling}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => { handleOpenEdit(selectedService); setSelectedService(null); }}
                    className="flex-1 py-3 bg-slate-900 text-white font-black rounded-xl flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" /> Modifier
                  </button>
                  <button onClick={() => setSelectedService(null)} className="flex-1 py-3 border-2 border-primary text-primary font-black rounded-xl">
                    Fermer
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