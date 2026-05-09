import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Send,
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  MessageSquare,
  Eye,
  Loader2,
  DollarSign,
  Handshake,
  Download,
  Calendar,
  Upload,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notifications';

interface ProposalFile {
  name: string;
  url: string;
}

interface Proposal {
  id: string;
  title: string;
  description: string;
  price: number;
  status: 'pending' | 'accepted' | 'refused';
  message: string;
  image?: string;
  createdAt: string;
  otherUser: string;
  otherUserId: string;
  otherUserAvatar?: string;
  type: 'sent' | 'received';
  relatedType: 'service' | 'lead';
  relatedId: string;
  files?: ProposalFile[];
  budget?: number;
  deadline?: string;
}

interface TabType {
  id: 'received' | 'sent';
  label: string;
  icon: React.ElementType;
  description: string;
}

export default function Proposals({ onNavigate }: { onNavigate?: (view: string, context?: any) => void }) {
  const { user, role } = useAuth();
  const isAideur = role === 'aideur';

  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showAcceptModal, setShowAcceptModal] = useState<Proposal | null>(null);
  const [counterOfferPrice, setCounterOfferPrice] = useState(0);
  const [counterOfferMessage, setCounterOfferMessage] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({
    totalReceived: 0,
    totalSent: 0,
    pendingReceived: 0,
    pendingSent: 0,
    acceptedReceived: 0,
    acceptedSent: 0,
    totalAmountReceived: 0,
    totalAmountSent: 0
  });

  useEffect(() => {
    if (!user) return;
    fetchProposals();

    // ✅ ABONNEMENT TEMPS RÉEL POUR LES PROPOSITIONS
    const proposalsChannel = supabase
      .channel('proposals_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proposals' },
        () => fetchProposals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(proposalsChannel);
    };
  }, [user, role, activeTab]);

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const addTransaction = async (walletId: string, amount: number, type: string, description: string, referenceId?: string) => {
    await supabase.from('unicoin_transactions').insert({
      wallet_id: walletId,
      amount: amount,
      type: type,
      status: 'completed',
      description: description,
      reference_id: referenceId,
      completed_at: new Date().toISOString()
    });
  };

  const fetchProposals = async () => {
    if (!user) return;
    if (proposals.length === 0) setLoading(true);

    try {
      let receivedProposals: Proposal[] = [];
      let sentProposals: Proposal[] = [];

      // 1. Propositions REÇUES (les autres utilisateurs m'ont envoyé)
      const { data: receivedData, error: receivedError } = await supabase
        .from('proposals')
        .select(`
          *,
          service:services(id, title, cover_image, user_id),
          lead:leads(id, title, image_url, owner_id),
          sender:users!sender_id(id, first_name, last_name, full_name, email, avatar_url)
        `)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (!receivedError && receivedData) {
        receivedProposals = receivedData.map((p: any) => {
          const item = p.service || p.lead;
          const isService = !!p.service;
          const senderName = p.sender?.full_name || `${p.sender?.first_name || ''} ${p.sender?.last_name || ''}`.trim() || 'Utilisateur';
          return {
            id: p.id,
            title: item?.title || 'Proposition',
            description: p.content,
            price: p.budget,
            status: p.status,
            message: p.content,
            image: item?.cover_image || item?.image_url,
            createdAt: p.created_at,
            otherUser: senderName,
            otherUserId: p.sender_id,
            otherUserAvatar: p.sender?.avatar_url,
            type: 'received' as const,
            relatedType: isService ? 'service' : 'lead',
            relatedId: isService ? p.service_id : p.lead_id,
            files: p.files || [],
            budget: p.budget
          };
        });
      }

      // 2. Propositions ENVOYÉES (j'ai envoyé à d'autres)
      const { data: sentData, error: sentError } = await supabase
        .from('proposals')
        .select(`
          *,
          service:services(id, title, cover_image, user_id),
          lead:leads(id, title, image_url, owner_id),
          receiver:users!receiver_id(id, first_name, last_name, full_name, email, avatar_url)
        `)
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false });

      if (!sentError && sentData) {
        sentProposals = sentData.map((p: any) => {
          const item = p.service || p.lead;
          const isService = !!p.service;
          const receiverName = p.receiver?.full_name || `${p.receiver?.first_name || ''} ${p.receiver?.last_name || ''}`.trim() || 'Utilisateur';
          return {
            id: p.id,
            title: item?.title || 'Proposition',
            description: p.content,
            price: p.budget,
            status: p.status,
            message: p.content,
            image: item?.cover_image || item?.image_url,
            createdAt: p.created_at,
            otherUser: receiverName,
            otherUserId: p.receiver_id,
            otherUserAvatar: p.receiver?.avatar_url,
            type: 'sent' as const,
            relatedType: isService ? 'service' : 'lead',
            relatedId: isService ? p.service_id : p.lead_id,
            files: p.files || [],
            budget: p.budget
          };
        });
      }

      // Fusionner les propositions selon l'onglet actif
      const allProposals = activeTab === 'received' ? receivedProposals : sentProposals;
      setProposals(allProposals);

      // Calculer les statistiques
      const totalReceived = receivedProposals.length;
      const totalSent = sentProposals.length;
      const pendingReceived = receivedProposals.filter(p => p.status === 'pending').length;
      const pendingSent = sentProposals.filter(p => p.status === 'pending').length;
      const acceptedReceived = receivedProposals.filter(p => p.status === 'accepted').length;
      const acceptedSent = sentProposals.filter(p => p.status === 'accepted').length;
      const totalAmountReceived = receivedProposals.reduce((sum, p) => sum + (p.status === 'accepted' ? p.price : 0), 0);
      const totalAmountSent = sentProposals.reduce((sum, p) => sum + (p.status === 'accepted' ? p.price : 0), 0);

      setStats({
        totalReceived,
        totalSent,
        pendingReceived,
        pendingSent,
        acceptedReceived,
        acceptedSent,
        totalAmountReceived,
        totalAmountSent
      });

    } catch (err) {
      console.error('Error fetching proposals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptProposal = async (proposal: Proposal) => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const orderId = generateUUID();

      let buyer_id: string;
      let seller_id: string;

      // Pour une proposition REÇUE, je suis le receveur
      if (proposal.type === 'received') {
        if (isAideur) {
          // Je suis aideur, je reçois une proposition pour une demande
          buyer_id = proposal.otherUserId; // L'expéditeur est l'acheteur
          seller_id = user.id; // Je suis le vendeur
        } else {
          // Je suis demandeur, je reçois une proposition pour un service
          buyer_id = user.id; // Je suis l'acheteur
          seller_id = proposal.otherUserId; // L'expéditeur est le vendeur
        }
      } else {
        alert('Vous ne pouvez pas accepter votre propre proposition');
        setIsSubmitting(false);
        return;
      }

      // Appel au backend pour bloquer les fonds en toute sécurité
      const response = await fetch('http://127.0.0.1:5051/api/hold-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: buyer_id,
          amount: proposal.price,
          order_id: orderId
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors du blocage des fonds');
      }

      // Créer la commande
      await supabase.from('orders').insert([{
        id: orderId,
        amount: proposal.price,
        buyer_id: buyer_id,
        seller_id: seller_id,
        status: 'pending',
        is_pinned: false,
        files: proposal.files || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);

      // Mettre à jour le statut de la proposition
      await supabase
        .from('proposals')
        .update({ status: 'accepted' })
        .eq('id', proposal.id);

      // Notifier l'expéditeur
      await sendNotification(
        proposal.otherUserId,
        '✅ Proposition acceptée',
        `Votre proposition pour "${proposal.title}" a été acceptée! Une commande a été créée.`,
        'proposal',
        'orders'
      );

      alert(`✅ Proposition acceptée! Commande créée.`);
      setShowAcceptModal(null);
      setSelectedProposal(null);
      fetchProposals();

      // Rediriger vers les commandes
      if (onNavigate) {
        onNavigate('orders');
      }

    } catch (err) {
      console.error('Error accepting proposal:', err);
      alert('Erreur lors de l\'acceptation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefuseProposal = async (proposalId: string) => {
    if (!confirm('Refuser cette proposition ?')) return;

    try {
      await supabase
        .from('proposals')
        .update({ status: 'refused' })
        .eq('id', proposalId);

      // Notifier l'expéditeur du refus
      const { data: proposal } = await supabase.from('proposals').select('sender_id, title').eq('id', proposalId).single();
      if (proposal) {
        await sendNotification(
          proposal.sender_id,
          '❌ Proposition refusée',
          `Votre proposition pour "${proposal.title}" a été refusée.`,
          'proposal',
          'proposals'
        );
      }

      alert('Proposition refusée');
      fetchProposals();
    } catch (err) {
      console.error('Error refusing proposal:', err);
      alert('Erreur');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCounterOffer = async (proposal: Proposal) => {
    if (!user) return;
    setIsSubmitting(true);
    setUploadingFiles(true);

    try {
      const uploadedFiles: { name: string; url: string }[] = [];
      for (const file of attachedFiles) {
        const ext = file.name.split('.').pop();
        const fileName = `proposals/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
          uploadedFiles.push({ name: file.name, url: urlData.publicUrl });
        }
      }

      const newProposalId = generateUUID();

      await supabase.from('proposals').insert([{
        id: newProposalId,
        service_id: proposal.relatedType === 'service' ? proposal.relatedId : null,
        lead_id: proposal.relatedType === 'lead' ? proposal.relatedId : null,
        sender_id: user.id,
        receiver_id: proposal.otherUserId,
        budget: counterOfferPrice,
        content: counterOfferMessage || `Contre-offre concernant "${proposal.title}"`,
        files: uploadedFiles,
        status: 'pending',
        created_at: new Date().toISOString()
      }]);

      // Marquer l'ancienne proposition comme refusée
      await supabase
        .from('proposals')
        .update({ status: 'refused' })
        .eq('id', proposal.id);

      await sendNotification(
        proposal.otherUserId,
        '🔄 Contre-offre reçue',
        `Nouvelle proposition de ${counterOfferPrice} UC pour "${proposal.title}"`,
        'proposal',
        'proposals'
      );

      alert(`✅ Contre-offre de ${counterOfferPrice} UC envoyée!`);
      setShowAcceptModal(null);
      setCounterOfferPrice(0);
      setCounterOfferMessage('');
      setAttachedFiles([]);
      fetchProposals();

    } catch (err) {
      console.error('Error sending counter-offer:', err);
      alert('Erreur lors de l\'envoi');
    } finally {
      setIsSubmitting(false);
      setUploadingFiles(false);
    }
  };

  const startConversation = (otherUserId: string, proposal: Proposal) => {
    if (onNavigate) {
      onNavigate('messages', { 
        owner_id: otherUserId, 
        title: proposal.title,
        price: proposal.price,
        image_url: proposal.image,
        type: 'proposal',
        id: proposal.id
      });
    }
  };

  const handleDownload = async (url: string, filename: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      // Adding ?download= forces the content-disposition if supported, but fetch blob is 100% reliable
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-black rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> En attente</span>;
      case 'accepted':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Acceptée</span>;
      case 'refused':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" /> Refusée</span>;
      default:
        return null;
    }
  };

  const tabs: TabType[] = [
    { id: 'received', label: 'Reçues', icon: Inbox, description: 'Propositions que vous avez reçues' },
    { id: 'sent', label: 'Envoyées', icon: Send, description: 'Propositions que vous avez envoyées' }
  ];

  if (loading && proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-xl shadow-primary/10" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Chargement des propositions...</p>
      </div>
    );
  }

  const currentStats = activeTab === 'received'
    ? { total: stats.totalReceived, pending: stats.pendingReceived, accepted: stats.acceptedReceived, amount: stats.totalAmountReceived }
    : { total: stats.totalSent, pending: stats.pendingSent, accepted: stats.acceptedSent, amount: stats.totalAmountSent };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-500 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Propositions</h2>
        <p className="text-slate-500 font-medium">
          {isAideur
            ? 'Gérez les propositions pour vos services et demandes'
            : 'Gérez vos échanges de propositions avec les aideurs'}
        </p>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase">Total</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{currentStats.total}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-yellow-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase">En attente</span>
          </div>
          <p className="text-2xl font-black text-yellow-600">{currentStats.pending}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase">Acceptées</span>
          </div>
          <p className="text-2xl font-black text-green-600">{currentStats.accepted}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-primary mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase">Montant total</span>
          </div>
          <p className="text-2xl font-black text-primary">{currentStats.amount} UC</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-100 pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = tab.id === 'received' ? stats.pendingReceived : stats.pendingSent;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-t-2xl font-black text-sm transition-all ${isActive
                ? 'bg-white text-primary border-t border-l border-r border-slate-100'
                : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Liste des propositions */}
      <div className="space-y-4">
        {proposals.length > 0 ? (
          proposals.map((proposal) => (
            <motion.div
              key={proposal.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col md:flex-row gap-5">
                {/* Image */}
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={proposal.image || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=100'}
                    alt={proposal.title}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=100'; }}
                  />
                </div>

                {/* Contenu principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {getStatusBadge(proposal.status)}
                    <span className="text-[10px] text-slate-400">
                      {new Date(proposal.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <h3 className="text-lg font-black text-slate-900 mb-1">{proposal.title}</h3>

                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                        {proposal.otherUserAvatar ? (
                          <img src={proposal.otherUserAvatar} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3 h-3 text-primary" />
                        )}
                      </div>
                      {proposal.otherUser}
                      <span className="text-[10px] text-slate-400">
                        ({activeTab === 'received' ? 'vous a proposé' : 'proposé à'})
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                    "{proposal.message}"
                  </p>

                  {proposal.files && proposal.files.length > 0 && (
                    <div className="mb-3 pt-3 border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> Fichiers joints ({proposal.files.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {proposal.files.map((file, idx) => (
                          <a
                            key={idx}
                            href={file.url}
                            onClick={(e) => handleDownload(file.url, file.name, e)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-primary/5 hover:border-primary/30 transition-all group"
                          >
                            <FileText className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-medium text-slate-700 max-w-[150px] truncate">{file.name}</span>
                            <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-black text-primary">{proposal.price}</span>
                      <span className="text-sm font-bold text-slate-400">UC</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedProposal(proposal)}
                        className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-black rounded-xl hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Détails
                      </button>

                      <button
                        onClick={() => startConversation(proposal.otherUserId, proposal)}
                        className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-black rounded-xl hover:bg-primary/10 hover:text-primary transition-all flex items-center gap-1"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Discuter
                      </button>

                      {/* Actions spécifiques pour les propositions REÇUES en attente */}
                      {activeTab === 'received' && proposal.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAcceptProposal(proposal)}
                            className="px-4 py-2 bg-green-600 text-white text-xs font-black rounded-xl hover:bg-green-700 transition-all flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Accepter
                          </button>
                          <button
                            onClick={() => handleRefuseProposal(proposal.id)}
                            className="px-4 py-2 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition-all flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Refuser
                          </button>
                          <button
                            onClick={() => setShowAcceptModal(proposal)}
                            className="px-4 py-2 bg-blue-600 text-white text-xs font-black rounded-xl hover:bg-blue-700 transition-all flex items-center gap-1"
                          >
                            <Handshake className="w-3.5 h-3.5" />
                            Négocier
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aucune proposition</h3>
            <p className="text-slate-500">
              {activeTab === 'received'
                ? 'Vous n\'avez reçu aucune proposition pour le moment'
                : 'Vous n\'avez envoyé aucune proposition pour le moment'}
            </p>
            {activeTab === 'sent' && (
              <button
                onClick={() => onNavigate?.('marketplace')}
                className="mt-4 px-6 py-2 bg-primary text-white font-black rounded-xl"
              >
                Explorer la marketplace
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal Acceptation / Contre-offre */}
      <AnimatePresence>
        {showAcceptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Envoyer une contre-offre</h3>
                <button onClick={() => setShowAcceptModal(null)} className="p-1 hover:bg-slate-100 rounded-full">
                  <XCircle className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-1">Proposition de</p>
                  <p className="font-black text-slate-900">{showAcceptModal.otherUser}</p>
                  <p className="text-2xl font-black text-primary mt-1">{showAcceptModal.price} UC</p>
                  <p className="text-xs text-slate-500 mt-2">"{showAcceptModal.message}"</p>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2 block">
                    💰 Contre-offre (optionnel)
                  </label>
                  <input
                    type="number"
                    placeholder="Votre prix proposé"
                    value={counterOfferPrice}
                    onChange={(e) => setCounterOfferPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-bold mb-3"
                  />
                  <textarea
                    rows={2}
                    placeholder="Message pour la contre-offre..."
                    value={counterOfferMessage}
                    onChange={(e) => setCounterOfferMessage(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none mb-3"
                  />
                  <div>
                    <label className="text-xs font-black text-slate-600 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                      <Paperclip className="w-3.5 h-3.5" /> Fichiers joints (optionnel)
                    </label>
                    <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                    <div 
                      onClick={() => fileInputRef.current?.click()} 
                      className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-primary transition-all"
                    >
                      <Upload className="w-5 h-5 text-slate-400" />
                      <span className="text-sm text-slate-500">
                        {uploadingFiles ? 'Upload en cours...' : 'Cliquez pour ajouter des fichiers'}
                      </span>
                    </div>
                    {attachedFiles.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {attachedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-xs">
                            <FileText className="w-3 h-3" />
                            <span className="truncate max-w-[100px]">{file.name}</span>
                            <button type="button" onClick={() => removeFile(idx)} className="text-red-500 ml-1">×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleCounterOffer(showAcceptModal)}
                    disabled={isSubmitting || counterOfferPrice <= 0 || uploadingFiles}
                    className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Handshake className="w-4 h-4" />}
                    Envoyer contre-offre
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Détails */}
      <AnimatePresence>
        {selectedProposal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[85vh] overflow-y-auto"
            >
              <div className="relative h-32 overflow-hidden">
                <img
                  src={selectedProposal.image || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400'}
                  className="w-full h-full object-cover"
                  alt=""
                />
                <div className="absolute inset-0 bg-black/40" />
                <button
                  onClick={() => setSelectedProposal(null)}
                  className="absolute top-3 right-3 p-1.5 bg-white/90 rounded-full"
                >
                  <XCircle className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-3">
                  {getStatusBadge(selectedProposal.status)}
                </div>
              </div>

              <div className="p-5 space-y-4">
                <h3 className="text-xl font-black text-slate-900">{selectedProposal.title}</h3>

                <div className="flex items-center justify-between py-3 border-y border-slate-100">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">De</p>
                    <p className="font-black text-slate-900">{selectedProposal.otherUser}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 uppercase">Montant</p>
                    <p className="text-2xl font-black text-primary">{selectedProposal.price} UC</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-slate-400 uppercase mb-1">Message</p>
                  <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl italic">
                    "{selectedProposal.message}"
                  </p>
                </div>

                {/* Fichiers joints */}
                {selectedProposal.files && selectedProposal.files.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Fichiers joints ({selectedProposal.files.length})
                    </p>
                    <div className="space-y-2">
                      {selectedProposal.files.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.url}
                          onClick={(e) => handleDownload(file.url, file.name, e)}
                          className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-primary/5 transition-all group"
                        >
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{file.name}</span>
                          <Download className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      startConversation(selectedProposal.otherUserId, selectedProposal);
                      setSelectedProposal(null);
                    }}
                    className="flex-1 py-3 border-2 border-primary text-primary font-black rounded-xl hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Contacter
                  </button>

                  {selectedProposal.type === 'received' && selectedProposal.status === 'pending' && (
                    <button
                      onClick={() => {
                        setSelectedProposal(null);
                        setShowAcceptModal(selectedProposal);
                      }}
                      className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Handshake className="w-4 h-4" />
                      Négocier
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}