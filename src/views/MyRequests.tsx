import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, MapPin, Clock, DollarSign, Edit3, Trash2, Eye, X,
  Upload, Calendar, FileText, Loader2, Search, ChevronDown,
  CheckCircle2, AlertCircle, MessageSquare, Star, Link as LinkIcon,
  Sparkles, Timer, RotateCw, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';

type RequestStatus = 'Ouverte' | 'En négociation' | 'Fermée' | 'Expirée';

interface FileAttachment {
  name: string;
  url: string;
  date: string;
  size?: number;
}

interface UserRequest {
  id: string;
  title: string;
  short_description: string;
  description: string;
  full_description: string;
  category: string;
  budget: number;
  deadline: string;
  date: string;
  image?: string;
  status: RequestStatus;
  files?: FileAttachment[];
  proposalsCount?: number;
  delivery_hours?: number;
  revision_limit?: number;
  cancellation_delay?: string;
}

const statusColors = {
  'Ouverte': 'bg-green-100 text-green-700 border-green-200',
  'En négociation': 'bg-blue-100 text-blue-700 border-blue-200',
  'Fermée': 'bg-slate-100 text-slate-700 border-slate-200',
  'Expirée': 'bg-red-100 text-red-700 border-red-200'
};

const categories = ['Soutien Scolaire', 'Informatique & Code', 'Design & Arts', 'Rédaction', 'Traduction', 'Marketing', 'Autre'];

export default function MyRequests({ onNavigate, initialData }: { onNavigate?: (view: string, context?: any) => void, initialData?: any }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('tous');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<UserRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<UserRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formStatus, setFormStatus] = useState<RequestStatus>('Ouverte');
  const [formTitle, setFormTitle] = useState('');
  const [formShortDescription, setFormShortDescription] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formBudget, setFormBudget] = useState('');
  const [formCategory, setFormCategory] = useState('Soutien Scolaire');
  const [formDeadline, setFormDeadline] = useState('');
  const [formImage, setFormImage] = useState<string | null>(null);
  const [formFiles, setFormFiles] = useState<FileAttachment[]>([]);
  
  const [formDeliveryHours, setFormDeliveryHours] = useState(168);
  const [formRevisionLimit, setFormRevisionLimit] = useState(2);
  const [formCancellationDelay, setFormCancellationDelay] = useState('24');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*, proposals:proposals(count)')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = data.map((item: any) => ({
        id: item.id,
        title: item.title,
        short_description: item.short_description || (item.description ? item.description.substring(0, 100) + '...' : ''),
        description: item.description,
        full_description: item.description,
        category: item.category,
        budget: item.budget || 0,
        deadline: item.deadline || 'À définir',
        date: item.created_at ? new Date(item.created_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
        image: item.image_url || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400',
        status: item.status === 'open' ? 'Ouverte' : 
                item.status === 'negotiating' ? 'En négociation' : 
                item.status === 'closed' ? 'Fermée' : 'Expirée',
        files: item.files ? JSON.parse(item.files) : [],
        proposalsCount: item.proposals?.[0]?.count || 0,
        delivery_hours: item.delivery_hours || 168,
        revision_limit: item.revision_limit || 2,
        cancellation_delay: item.cancellation_delay || '24'
      }));
      setRequests(mapped);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const filteredRequests = requests.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         req.short_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         req.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'tous' || req.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    const previewUrl = URL.createObjectURL(file);
    setFormImage(previewUrl);

    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `leads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
      setFormImage(urlData.publicUrl);
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Erreur lors de l\'upload de l\'image');
      setFormImage(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        const fileExt = file.name.split('.').pop() || 'pdf';
        const fileName = `${user.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${fileExt}`;
        const filePath = `documents/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
        
        setFormFiles(prev => [...prev, {
          name: file.name,
          url: urlData.publicUrl,
          date: new Date().toLocaleDateString('fr-FR'),
          size: file.size
        }]);
      } catch (err) {
        console.error('Error uploading file:', err);
        alert(`Erreur lors de l'upload de ${file.name}`);
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFormFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user) return;
    
    if (!formTitle.trim()) {
      alert('Veuillez entrer un titre');
      return;
    }
    if (!formDescription.trim()) {
      alert('Veuillez entrer une description détaillée');
      return;
    }
    if (!formBudget || parseInt(formBudget) <= 0) {
      alert('Veuillez entrer un budget valide');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const statusMap: Record<RequestStatus, string> = {
        'Ouverte': 'open',
        'En négociation': 'negotiating',
        'Fermée': 'closed',
        'Expirée': 'expired'
      };

      const leadData = {
        owner_id: user.id,
        title: formTitle,
        short_description: formShortDescription || formDescription.substring(0, 100),
        description: formDescription,
        budget: parseInt(formBudget),
        category: formCategory,
        deadline: formDeadline || null,
        image_url: formImage || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400',
        status: statusMap[formStatus],
        files: JSON.stringify(formFiles),
        delivery_hours: formDeliveryHours,
        revision_limit: formRevisionLimit,
        cancellation_delay: formCancellationDelay,
        updated_at: new Date().toISOString()
      };

      if (editingRequest) {
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editingRequest.id);
        
        if (error) throw new Error(error.message);
        alert('✅ Demande modifiée avec succès !');
      } else {
        const leadId = `lead_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const { error } = await supabase
          .from('leads')
          .insert([{ ...leadData, id: leadId, created_at: new Date().toISOString() }]);
        
        if (error) throw new Error(error.message);
        alert('✅ Demande publiée avec succès !');
      }
      
      closeModal();
      fetchRequests();
    } catch (err) {
      console.error('Error saving request:', err);
      alert(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = async (id: string, newStatus: RequestStatus) => {
    const request = requests.find(r => r.id === id);
    if (!request || !user) return;

    const statusMap: Record<RequestStatus, string> = {
      'Ouverte': 'open',
      'En négociation': 'negotiating',
      'Fermée': 'closed',
      'Expirée': 'expired'
    };

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: statusMap[newStatus], updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      
      setRequests(prev => prev.map(r => 
        r.id === id ? { ...r, status: newStatus } : r
      ));
      
      alert(`Statut changé : ${newStatus}`);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Erreur lors du changement de statut');
    }
  };

  const deleteRequest = async (id: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette demande ? Cette action est irréversible.')) return;
    
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      setRequests(prev => prev.filter(r => r.id !== id));
      alert('Demande supprimée avec succès');
    } catch (err) {
      console.error('Error deleting request:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const handleOpenCreate = () => {
    setEditingRequest(null);
    setFormStatus('Ouverte');
    setFormTitle('');
    setFormShortDescription('');
    setFormDescription('');
    setFormBudget('');
    setFormCategory('Soutien Scolaire');
    setFormDeadline('');
    setFormImage(null);
    setFormFiles([]);
    setFormDeliveryHours(168);
    setFormRevisionLimit(2);
    setFormCancellationDelay('24');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (request: UserRequest) => {
    setEditingRequest(request);
    setFormStatus(request.status);
    setFormTitle(request.title);
    setFormShortDescription(request.short_description);
    setFormDescription(request.description);
    setFormBudget(request.budget.toString());
    setFormCategory(request.category);
    setFormDeadline(request.deadline);
    setFormImage(request.image || null);
    setFormFiles(request.files || []);
    setFormDeliveryHours(request.delivery_hours || 168);
    setFormRevisionLimit(request.revision_limit || 2);
    setFormCancellationDelay(request.cancellation_delay || '24');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRequest(null);
    setFormImage(null);
    setFormFiles([]);
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
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Mes Demandes d'Aide</h2>
          <p className="text-slate-500 font-medium">Gérez vos appels d'offres</p>
        </div>
        <button 
          onClick={handleOpenCreate}
          className="px-6 py-3 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nouvelle demande
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher une demande..."
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
            <option value="Ouverte">Ouvertes</option>
            <option value="En négociation">En négociation</option>
            <option value="Fermée">Fermées</option>
            <option value="Expirée">Expirées</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {filteredRequests.length > 0 ? (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <motion.div 
              key={req.id}
              layoutId={req.id}
              className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedRequest(req)}
            >
              <div className="flex flex-col md:flex-row">
                <div className="w-full md:w-48 h-48 md:h-auto bg-slate-100 relative shrink-0 overflow-hidden">
                  <img src={req.image} className="w-full h-full object-cover" alt={req.title} />
                </div>

                <div className="flex-1 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-black uppercase rounded-full">
                        {req.category}
                      </span>
                      <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${statusColors[req.status]}`}>
                        {req.status}
                      </span>
                      {req.proposalsCount && req.proposalsCount > 0 && (
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-full flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {req.proposalsCount} proposition{req.proposalsCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">{req.date}</span>
                    </div>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 mb-1">{req.title}</h3>
                  
                  <p className="text-slate-500 text-sm line-clamp-2 mb-4">
                    {req.short_description || (req.description ? req.description.substring(0, 100) + '...' : 'Aucune description')}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-400 mb-3">
                    {req.delivery_hours && (
                      <div className="flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        <span>Livraison: {req.delivery_hours}h ({Math.floor(req.delivery_hours / 24)}j)</span>
                      </div>
                    )}
                    {req.revision_limit && (
                      <div className="flex items-center gap-1">
                        <RotateCw className="w-3 h-3" />
                        <span>Révisions: {req.revision_limit}</span>
                      </div>
                    )}
                    {req.cancellation_delay && (
                      <div className="flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        <span>Annulation: {req.cancellation_delay}h</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-5">
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Budget</p>
                        <p className="text-lg font-black text-primary">{req.budget} UC</p>
                      </div>
                      <div className="w-px h-8 bg-slate-200" />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase">Délai</p>
                        <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-primary" /> {req.deadline}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(req); }}
                        className="p-2.5 bg-slate-100 text-slate-600 hover:text-primary rounded-xl transition-all"
                        title="Modifier"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteRequest(req.id); }}
                        className="p-2.5 bg-slate-100 text-slate-600 hover:text-red-500 rounded-xl transition-all"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedRequest(req); }}
                        className="px-4 py-2.5 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-black transition-all flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Aperçu
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Aucune demande</h3>
          <p className="text-slate-500 mb-6">Vous n'avez pas encore créé de demande d'aide</p>
          <button onClick={handleOpenCreate} className="px-6 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20">
            Créer ma première demande
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
                    {editingRequest ? 'Modifier la demande' : 'Nouvelle demande'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    {editingRequest ? 'Modifiez les informations de votre demande' : 'Publiez un appel d\'aide'}
                  </p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-slate-100 rounded-full transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                    Titre *
                  </label>
                  <input 
                    type="text" 
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                    placeholder="Ex: Besoin d'aide en programmation Java"
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                      Catégorie
                    </label>
                    <select 
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                    >
                      {categories.map(cat => <option key={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                      Budget (UC) *
                    </label>
                    <input 
                      type="number" 
                      value={formBudget}
                      onChange={(e) => setFormBudget(e.target.value)}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                      placeholder="200"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                    Statut
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['Ouverte', 'En négociation', 'Fermée', 'Expirée'] as RequestStatus[]).map(s => (
                      <button 
                        key={s}
                        type="button"
                        onClick={() => setFormStatus(s)}
                        className={`py-2.5 rounded-xl border text-xs font-black uppercase transition-all ${formStatus === s ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 mt-2">
                    Les statuts "Ouverte" et "En négociation" sont visibles dans la marketplace
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Description courte (visible dans la marketplace)
                  </label>
                  <textarea 
                    rows={2}
                    value={formShortDescription}
                    onChange={(e) => setFormShortDescription(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium resize-none"
                    placeholder="Un résumé accrocheur de votre demande (max 150 caractères)"
                    maxLength={150}
                  />
                  <p className="text-[9px] text-slate-400 mt-1 text-right">
                    {formShortDescription.length}/150 caractères
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    Description détaillée *
                  </label>
                  <textarea 
                    rows={5}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium resize-none"
                    placeholder="Décrivez précisément votre besoin, les attentes, les livrables..."
                  />
                </div>

                {/* Conditions de la mission avec saisie manuelle */}
                <div className="bg-slate-50 rounded-2xl p-5 space-y-4">
                  <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    Conditions de la mission
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Délai de livraison en heures - INPUT MANUEL */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block flex items-center gap-1">
                        <Timer className="w-3 h-3" /> Délai de livraison (heures)
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        max="720" 
                        step="1"
                        value={formDeliveryHours}
                        onChange={(e) => setFormDeliveryHours(parseInt(e.target.value) || 24)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-center font-bold"
                      />
                      <p className="text-[9px] text-slate-400 mt-1 text-center">
                        {Math.floor(formDeliveryHours / 24)} jour{Math.floor(formDeliveryHours / 24) > 1 ? 's' : ''} et {formDeliveryHours % 24} heure{formDeliveryHours % 24 > 1 ? 's' : ''}
                      </p>
                    </div>
                    
                    {/* Révisions - INPUT MANUEL */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block flex items-center gap-1">
                        <RotateCw className="w-3 h-3" /> Révisions incluses
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        max="10" 
                        step="1"
                        value={formRevisionLimit}
                        onChange={(e) => setFormRevisionLimit(parseInt(e.target.value) || 2)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-center font-bold"
                      />
                    </div>
                    
                    {/* Délai d'annulation - INPUT MANUEL */}
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-1 block flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Délai d'annulation (heures)
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        max="168" 
                        step="1"
                        value={formCancellationDelay}
                        onChange={(e) => setFormCancellationDelay(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-center font-bold"
                      />
                      <p className="text-[9px] text-slate-400 mt-1 text-center">
                        {Math.floor(parseInt(formCancellationDelay) / 24)}j {parseInt(formCancellationDelay) % 24}h
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                    Date limite de candidature
                  </label>
                  <input 
                    type="date" 
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                    Image de couverture
                  </label>
                  <div 
                    onClick={() => imageInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary transition-all relative overflow-hidden min-h-[140px]"
                  >
                    {formImage ? (
                      <>
                        <img src={formImage} className="absolute inset-0 w-full h-full object-cover opacity-30" alt="Preview" />
                        <div className="relative z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full">
                          <Upload className="w-5 h-5 inline mr-2" />
                          <span className="text-sm font-medium">Changer l'image</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="w-10 h-10 text-slate-300" />
                        <span className="text-sm font-medium text-slate-500">Cliquez pour uploader une image</span>
                      </>
                    )}
                  </div>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider mb-1 block">
                    Fichiers joints
                  </label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer hover:border-primary transition-all"
                  >
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-500">Ajouter des fichiers (PDF, images, Word)</span>
                  </div>
                  <input 
                    ref={fileInputRef} 
                    type="file" 
                    multiple 
                    className="hidden" 
                    onChange={handleFileUpload}
                  />
                  
                  {formFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">{file.name}</span>
                            {file.size && (
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {(file.size / 1024).toFixed(0)} KB
                              </span>
                            )}
                          </div>
                          <button 
                            onClick={() => removeFile(idx)} 
                            className="text-slate-400 hover:text-red-500 transition-colors shrink-0 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-white flex gap-3">
                <button onClick={closeModal} className="flex-1 py-3.5 text-slate-500 font-black text-sm rounded-xl hover:bg-slate-50 transition-all">
                  Annuler
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSubmitting || !formTitle || !formBudget || !formDescription}
                  className="flex-1 py-3.5 bg-primary text-white font-black text-sm rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publication...
                    </>
                  ) : (
                    editingRequest ? 'Enregistrer' : 'Publier la demande'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Aperçu */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto"
            >
              <div className="relative h-48 overflow-hidden">
                <img src={selectedRequest.image} className="w-full h-full object-cover" alt={selectedRequest.title} />
                <button 
                  onClick={() => setSelectedRequest(null)}
                  className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-black uppercase rounded-full">
                    {selectedRequest.category}
                  </span>
                  <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${statusColors[selectedRequest.status]}`}>
                    {selectedRequest.status}
                  </span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">{selectedRequest.title}</h2>
                
                {selectedRequest.short_description && (
                  <div className="p-3 bg-primary/5 rounded-xl mb-4 border-l-4 border-primary">
                    <p className="text-sm text-slate-600 italic">
                      "{selectedRequest.short_description}"
                    </p>
                  </div>
                )}
                
                <div className="p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl flex justify-between items-center mb-4">
                  <span className="text-sm text-slate-500">Budget</span>
                  <span className="text-2xl font-black text-primary">{selectedRequest.budget} UC</span>
                </div>

                {/* Conditions de la mission */}
                <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl mb-4">
                  <div className="text-center">
                    <Timer className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-[9px] font-black text-slate-400">Livraison</p>
                    <p className="text-sm font-black text-slate-900">
                      {selectedRequest.delivery_hours}h ({Math.floor(selectedRequest.delivery_hours / 24)}j)
                    </p>
                  </div>
                  <div className="text-center">
                    <RotateCw className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-[9px] font-black text-slate-400">Révisions</p>
                    <p className="text-sm font-black text-slate-900">{selectedRequest.revision_limit} incluses</p>
                  </div>
                  <div className="text-center">
                    <Shield className="w-5 h-5 text-primary mx-auto mb-1" />
                    <p className="text-[9px] font-black text-slate-400">Annulation</p>
                    <p className="text-sm font-black text-slate-900">{selectedRequest.cancellation_delay}h</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Description détaillée</p>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedRequest.description}
                  </p>
                </div>
                
                <div className="flex items-center justify-between py-4 border-y border-slate-100">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase">Date limite</p>
                    <p className="text-sm font-bold flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-primary" /> {selectedRequest.deadline}</p>
                  </div>
                </div>

                {selectedRequest.files && selectedRequest.files.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Fichiers joints</p>
                    <div className="space-y-2">
                      {selectedRequest.files.map((file, idx) => (
                        <a key={idx} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-primary/5 transition-all">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-slate-700 flex-1">{file.name}</span>
                          <span className="text-[10px] text-slate-400">{file.date}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button 
                    onClick={() => { handleOpenEdit(selectedRequest); setSelectedRequest(null); }}
                    className="flex-1 py-3 bg-slate-900 text-white font-black rounded-xl flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" /> Modifier
                  </button>
                  <button onClick={() => setSelectedRequest(null)} className="flex-1 py-3 border-2 border-primary text-primary font-black rounded-xl">
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