import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  MessageSquare,
  MoreVertical,
  X,
  Eye,
  CheckCircle2,
  User,
  Loader2,
  Clock,
  Send,
  FileText,
  RefreshCw,
  Pin,
  PinOff,
  Upload,
  Download,
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RotateCw,
  Search,
  Filter
} from 'lucide-react';
import { Star as StarIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notifications';

type OrderStatus =
  | 'pending'
  | 'in_progress'
  | 'delivered'
  | 'revision'
  | 'completed'
  | 'cancelled'
  | 'disputed'
  | 'expired';

interface OrderFile {
  name: string;
  url: string;
}

interface OrderItem {
  id: string;
  title: string;
  otherUser: string;
  otherUserId: string;
  price: number;
  status: OrderStatus;
  progress: number;
  lastUpdate: string;
  image?: string;
  description?: string;
  instructions?: string;
  createdAt?: string;
  deliveryDeadline?: string;
  revisionsUsed: number;
  revisionLimit: number;
  isPinned: boolean;
  timeRemaining?: string;
  initialFiles?: OrderFile[];
  deliveryFiles?: OrderFile[];
  revisionMessage?: string;
  deliveredAt?: string;
  completedAt?: string;
}

const orderStatusConfig: Record<OrderStatus, { label: string; color: string; bg: string; text: string }> = {
  pending: { label: 'En attente', color: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  in_progress: { label: 'En cours', color: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  delivered: { label: 'Résultat envoyé', color: 'bg-purple-500', bg: 'bg-purple-50', text: 'text-purple-700' },
  revision: { label: 'En révision', color: 'bg-orange-500', bg: 'bg-orange-50', text: 'text-orange-700' },
  completed: { label: 'Terminé', color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  cancelled: { label: 'Annulé', color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
  disputed: { label: 'Litige', color: 'bg-slate-500', bg: 'bg-slate-50', text: 'text-slate-700' },
  expired: { label: 'Expiré', color: 'bg-gray-500', bg: 'bg-gray-50', text: 'text-gray-700' },
};

const getProgressHexColor = (progress: number) => {
  if (progress <= 25) return '#ef4444'; // red-500
  if (progress <= 50) return '#f97316'; // orange-500
  if (progress <= 75) return '#eab308'; // yellow-500
  return '#22c55e'; // green-500
};

const getProgressColorClass = (progress: number) => {
  if (progress <= 25) return 'bg-red-500';
  if (progress <= 50) return 'bg-orange-500';
  if (progress <= 75) return 'bg-yellow-500';
  return 'bg-green-500';
};

// ✅ Téléchargement forcé
const forceDownload = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download error:', error);
    window.open(url, '_blank');
  }
};

const safeParseFiles = (filesData: any): OrderFile[] => {
  if (!filesData) return [];
  if (Array.isArray(filesData)) return filesData;
  if (typeof filesData === 'string') {
    try {
      const parsed = JSON.parse(filesData);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export default function Orders({ onNavigate }: { onNavigate?: (view: string, context?: any) => void }) {
  const { role, user } = useAuth();
  const isAideur = role === 'aideur';

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // États pour les modals
  const [showRevisionModal, setShowRevisionModal] = useState<OrderItem | null>(null);
  const [revisionMessage, setRevisionMessage] = useState('');
  const [showDisputeModal, setShowDisputeModal] = useState<OrderItem | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [showDeliveryModal, setShowDeliveryModal] = useState<OrderItem | null>(null);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [deliveryFiles, setDeliveryFiles] = useState<File[]>([]);
  const [uploadingDelivery, setUploadingDelivery] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState<OrderItem | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const deliveryFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    fetchData();

    // ✅ ABONNEMENT TEMPS RÉEL POUR LES COMMANDES
    const ordersChannel = supabase
      .channel('orders_changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'orders',
          // Note: On ne peut pas facilement filtrer par buyer_id OR seller_id ici
          // donc on reçoit tout et on filtre/recharge localement si pertinent
        },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [user, role]);

  const uploadDeliveryFiles = async (files: File[], orderId: string): Promise<OrderFile[]> => {
    const uploadedFiles: OrderFile[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const fileName = `deliveries/${orderId}/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
        uploadedFiles.push({ name: file.name, url: urlData.publicUrl });
      }
    }
    return uploadedFiles;
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

  const addReward = async (userId: string, amount: number, description: string) => {
    const { data: wallet, error } = await supabase
      .from('unicoin_wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .maybeSingle();
    if (wallet) {
      await supabase
        .from('unicoin_wallets')
        .update({ balance: wallet.balance + amount, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);
      await addTransaction(wallet.id, amount, 'reward', description);
    }
  };

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const buyerOrSeller = isAideur ? 'seller_id' : 'buyer_id';
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          *,
          service:services(id, title, cover_image, delivery_time, revision_ceiling),
          lead:leads(id, title, image_url),
          seller:users!seller_id(id, first_name, last_name, full_name, email, avatar_url),
          buyer:users!buyer_id(id, first_name, last_name, full_name, email, avatar_url)
        `)
        .eq(buyerOrSeller, user.id)
        .order('created_at', { ascending: false });

      if (!ordersError && ordersData) {
        const mappedOrders: OrderItem[] = ordersData.map((o: any) => {
          const isBuyer = o.buyer_id === user.id;
          const item = o.service || o.lead;
          const revisionLimit = o.service?.revision_ceiling || 2;
          let timeRemaining = '';
          if (o.delivery_deadline && o.status !== 'completed' && o.status !== 'cancelled') {
            const diff = new Date(o.delivery_deadline).getTime() - new Date().getTime();
            if (diff > 0) {
              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
              const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              timeRemaining = days > 0 ? `${days}j ${hours}h` : `${hours}h`;
            } else if (diff <= 0 && o.status === 'in_progress') {
              timeRemaining = 'Délai dépassé';
            }
          }
          const otherUser = isBuyer ? o.seller : o.buyer;
          const otherUserName = otherUser?.full_name || `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || 'Utilisateur';
          const initialFiles = safeParseFiles(o.files);
          const deliveryFilesData = safeParseFiles(o.result_files || o.delivery_files);
          return {
            id: o.id,
            title: item?.title || 'Commande',
            otherUser: otherUserName,
            otherUserId: isBuyer ? o.seller_id : o.buyer_id,
            price: o.amount,
            status: o.status,
            progress: o.status === 'completed' ? 100 : (o.progress || 0),
            lastUpdate: o.updated_at ? new Date(o.updated_at).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
            image: item?.cover_image || item?.image_url,
            description: item?.description,
            instructions: o.instructions,
            createdAt: o.created_at,
            deliveryDeadline: o.delivery_deadline,
            revisionsUsed: o.revisions_used || 0,
            revisionLimit: revisionLimit,
            isPinned: o.is_pinned || false,
            timeRemaining,
            initialFiles,
            deliveryFiles: deliveryFilesData,
            revisionMessage: o.revision_message,
            deliveredAt: o.delivered_at,
            completedAt: o.completed_at
          };
        });
        const sortedOrders = [...mappedOrders].sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
        setOrders(sortedOrders);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePinOrder = async (orderId: string, currentPinned: boolean) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('orders')
        .update({ is_pinned: !currentPinned, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, isPinned: !currentPinned } : o));
      alert(currentPinned ? '📌 Commande désépinglée' : '📌 Commande épinglée');
    } catch (err) {
      console.error('Error toggling pin:', err);
      alert('Erreur');
    }
  };

  // ✅ FONCTION POUR MODIFIER LA PROGRESSION (AIDEUR uniquement)
  const updateProgress = async (orderId: string, newProgress: number) => {
    if (!user || !isAideur) return;
    const progress = Math.min(100, Math.max(0, newProgress));
    try {
      const { error } = await supabase
        .from('orders')
        .update({ progress: progress, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, progress: progress } : o));
    } catch (err) {
      console.error('Error updating progress:', err);
      alert('Erreur lors de la mise à jour de la progression');
    }
  };

  const handleDeliverWithVersion = async (orderId: string) => {
    if (!user) return;
    setUploadingDelivery(true);
    try {
      const uploadedFiles = await uploadDeliveryFiles(deliveryFiles, orderId);
      await supabase
        .from('orders')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          result_files: uploadedFiles,
          delivery_message: deliveryMessage,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      const { data: order } = await supabase
        .from('orders')
        .select('buyer_id, title')
        .eq('id', orderId)
        .single();
      if (order) {
        await sendNotification(
          order.buyer_id,
          '📦 Livraison disponible',
          `Le travail pour "${order.title}" a été livré avec ${deliveryFiles.length} fichier(s).`,
          'order',
          'orders',
          { orderId: orderId }
        );
      }
      alert('✅ Travail livré avec succès!');
      setShowDeliveryModal(null);
      setDeliveryMessage('');
      setDeliveryFiles([]);
      fetchData();
    } catch (err) {
      console.error('Error delivering order:', err);
      alert('Erreur lors de la livraison');
    } finally {
      setUploadingDelivery(false);
    }
  };

  // ✅ ACCEPTER LA COMMANDE (sans délai)
  const handleAcceptOrder = async (order: OrderItem) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'in_progress',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);
      if (updateError) throw updateError;
      await sendNotification(
        order.otherUserId,
        '✅ Commande acceptée',
        `${user.first_name} ${user.last_name} a accepté votre commande "${order.title}".`,
        'order',
        'orders',
        { orderId: order.id }
      );
      alert(`✅ Commande acceptée!`);
      fetchData();
    } catch (err) {
      console.error('Error accepting order:', err);
      alert('Erreur lors de l\'acceptation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ REFUSER LA COMMANDE
  const handleRefuseOrder = async (order: OrderItem) => {
    if (!confirm('Refuser cette commande ? Les fonds seront remboursés.')) return;
    try {
      const response = await fetch('http://127.0.0.1:5051/api/refund-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_id: order.otherUserId,
          amount: order.price,
          order_id: order.id
        })
      });
      if (!response.ok) throw new Error('Erreur de remboursement');
      await supabase
        .from('orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', order.id);
      await sendNotification(order.otherUserId, '❌ Commande refusée', `Votre commande "${order.title}" a été refusée. Remboursement effectué.`, 'order', 'orders');
      alert('Commande refusée et remboursée');
      fetchData();
    } catch (err) {
      console.error('Error refusing order:', err);
      alert('Erreur lors du refus');
    }
  };

  // ✅ DEMANDER RÉVISION
  // Dans src/views/Orders.tsx, remplacez la fonction handleRequestRevision par :

  const handleRequestRevision = async (orderId: string, message: string) => {
    if (!user) return;
    try {
      // Récupérer la commande avec les bonnes relations
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
        *,
        service:services (
          revision_ceiling,
          title
        ),
        lead:leads (
          revision_limit,
          title
        )
      `)
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('Commande non trouvée');

      // Déterminer la limite de révisions selon le type
      let revisionLimit = 2; // valeur par défaut
      let itemTitle = order.title || 'commande';

      if (order.service) {
        revisionLimit = (order.service as any).revision_ceiling || 2;
        itemTitle = (order.service as any).title || itemTitle;
      } else if (order.lead) {
        revisionLimit = (order.lead as any).revision_limit || 2;
        itemTitle = (order.lead as any).title || itemTitle;
      }

      const revisionsUsed = order.revisions_used ?? 0;

      if (revisionsUsed >= revisionLimit) {
        alert(`Plus de révisions gratuites disponibles. Limite: ${revisionLimit} révisions.`);
        return;
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'revision',
          revision_message: message,
          revisions_used: revisionsUsed + 1,
          progress: 50,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      if (order.seller_id) {
        await sendNotification(
          order.seller_id,
          '🔄 Demande de révision',
          `${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`,
          'order',
          'orders',
          { orderId: orderId }
        );
      }

      alert(`✅ Demande de révision envoyée. Révisions restantes: ${revisionLimit - (revisionsUsed + 1)}`);
      setShowRevisionModal(null);
      setRevisionMessage('');
      fetchData();
    } catch (err) {
      console.error('Error requesting revision:', err);
      alert('Erreur lors de la demande de révision');
    }
  };

  // ✅ ACCEPTER LIVRAISON
  // Mettez à jour also handleAcceptDelivery :

  const handleAcceptDelivery = async (orderId: string) => {
    if (!user) return;
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('buyer_id, seller_id, amount, service:services(title), lead:leads(title)')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error('Commande non trouvée');

      const orderTitle = (orderData.service as any)?.title || (orderData.lead as any)?.title || 'Commande';

      const response = await fetch('http://127.0.0.1:5051/api/release-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_id: orderData.seller_id,
          buyer_id: orderData.buyer_id,
          amount: orderData.amount,
          order_id: orderId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur de libération des fonds');
      }

      await supabase
        .from('orders')
        .update({
          status: 'completed',
          progress: 100,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      await addReward(orderData.buyer_id, 10, `🎉 Bonus commande terminée ${orderTitle}`);
      await addReward(orderData.seller_id, 10, `🎉 Récompense travail terminé ${orderTitle}`);

      await sendNotification(
        orderData.seller_id,
        '✅ Livraison acceptée',
        `Votre travail pour "${orderTitle}" a été accepté. +10 UC bonus!`,
        'order',
        'orders'
      );

      alert('✅ Livraison acceptée! +10 UC de bonus!');
      
      // Ouvrir le modal d'avis automatiquement
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setShowReviewModal(order);
      }
      
      fetchData();
    } catch (err) {
      console.error('Error accepting delivery:', err);
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'acceptation');
    }
  };

  // ✅ ENREGISTRER UN AVIS
  const handleSaveReview = async () => {
    if (!showReviewModal || !user) return;
    setIsSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('reviews')
        .insert([{
          order_id: showReviewModal.id,
          reviewer_id: user.id,
          reviewed_id: showReviewModal.otherUserId,
          rating: reviewRating,
          comment: reviewComment,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      // Notifier l'utilisateur concerné
      await sendNotification(
        showReviewModal.otherUserId,
        '⭐ Nouvel avis reçu',
        `${user.first_name} vous a laissé une note de ${reviewRating}/5`,
        'profile',
        'profile',
        { reviewer_id: user.id }
      );

      alert('✅ Merci pour votre avis !');
      setShowReviewModal(null);
      setReviewRating(5);
      setReviewComment('');
      fetchData();
    } catch (err) {
      console.error('Error saving review:', err);
      alert('Erreur lors de l\'enregistrement de l\'avis');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // ✅ ANNULER COMMANDE (demandeur seulement avant acceptation)
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Annuler cette commande ? Les fonds seront remboursés.')) return;
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('buyer_id, amount, status')
        .eq('id', orderId)
        .single();
      if (order.status !== 'pending') {
        alert('Seules les commandes en attente peuvent être annulées');
        return;
      }
      const response = await fetch('http://127.0.0.1:5051/api/refund-funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_id: order.buyer_id,
          amount: order.amount,
          order_id: orderId
        })
      });
      if (!response.ok) throw new Error('Erreur de remboursement');
      await supabase
        .from('orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', orderId);
      alert('Commande annulée et remboursée');
      fetchData();
    } catch (err) {
      console.error('Error cancelling order:', err);
      alert('Erreur lors de l\'annulation');
    }
  };

  const handleOpenDispute = async (orderId: string, reason: string) => {
    if (!user) return;
    try {
      await supabase
        .from('orders')
        .update({
          status: 'disputed',
          dispute_status: 'pending',
          dispute_created_at: new Date().toISOString(),
          dispute_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
        
      // Notifier l'autre partie du litige
      const { data: order } = await supabase.from('orders').select('buyer_id, seller_id, title').eq('id', orderId).single();
      if (order) {
        const recipientId = user.id === order.buyer_id ? order.seller_id : order.buyer_id;
        await sendNotification(
          recipientId,
          '⚖️ Litige ouvert',
          `Un litige a été ouvert concernant la commande "${order.title}".`,
          'order',
          'orders',
          { orderId: orderId }
        );
      }
      
      alert('✅ Litige ouvert. Un administrateur va traiter votre demande sous 72h.');
      setShowDisputeModal(null);
      setDisputeReason('');
      fetchData();
    } catch (err) {
      console.error('Error opening dispute:', err);
      alert('Erreur lors de l\'ouverture du litige');
    }
  };

  const startConversation = (otherUserId: string, order: OrderItem) => {
    onNavigate?.('messages', { 
      owner_id: otherUserId, 
      title: order.title,
      price: order.price,
      image_url: order.image,
      type: 'order',
      id: order.id
    });
  };

  const getTimeRemaining = (deliveryDeadline?: string, status?: string) => {
    if (!deliveryDeadline || status === 'completed' || status === 'cancelled') return null;
    const diff = new Date(deliveryDeadline).getTime() - new Date().getTime();
    if (diff <= 0) return { text: 'Délai dépassé', isExpired: true };
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return { text: `${hours}h`, isExpired: false };
    const days = Math.floor(hours / 24);
    return { text: `${days}j`, isExpired: false };
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.otherUser.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">
            {isAideur ? 'Mes Ventes' : 'Mes Achats'}
          </h2>
          <p className="text-sm text-slate-500 font-medium">
            {isAideur ? 'Commandes que vous avez reçues' : 'Commandes que vous avez passées'}
          </p>
        </div>
        <button onClick={() => fetchData()} className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-primary/10 hover:text-primary transition-all" title="Actualiser">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une commande, un utilisateur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <div className="relative min-w-[200px] sm:w-auto">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer"
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(orderStatusConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredOrders.length > 0 ? (
          filteredOrders.map((order) => {
            const canAccept = isAideur && order.status === 'pending';
            const canDeliver = isAideur && ['in_progress', 'revision'].includes(order.status);
            const canAcceptDelivery = !isAideur && order.status === 'delivered';
            const canRequestRevision = !isAideur && order.status === 'delivered' && order.revisionsUsed < order.revisionLimit;
            const canOpenDispute = ['in_progress', 'delivered', 'revision'].includes(order.status);
            const canCancel = !isAideur && order.status === 'pending';
            const canUpdateProgress = isAideur && ['in_progress', 'revision'].includes(order.status);
            const timeRemainingInfo = getTimeRemaining(order.deliveryDeadline, order.status);

            return (
              <div key={order.id} className={`bg-white rounded-[32px] border p-6 shadow-sm hover:shadow-md transition-all ${order.isPinned ? 'border-primary/30 bg-primary/5' : 'border-slate-100'}`}>
                {order.isPinned && (
                  <div className="mb-3">
                    <span className="px-2 py-0.5 bg-primary/20 text-primary text-[9px] font-black rounded-full flex items-center gap-1 w-fit">
                      <Pin className="w-3 h-3" /> Épinglé
                    </span>
                  </div>
                )}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                  <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden shrink-0">
                    <img src={order.image || 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=100'} alt={order.title} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${orderStatusConfig[order.status].bg} ${orderStatusConfig[order.status].text}`}>
                        {orderStatusConfig[order.status].label}
                      </span>
                      {order.status === 'in_progress' && timeRemainingInfo && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${timeRemainingInfo.isExpired ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                          <Clock className="w-3 h-3" /> {timeRemainingInfo.text}
                        </span>
                      )}
                      <span className="text-[10px] font-black text-slate-400">{new Date(order.createdAt || '').toLocaleDateString('fr-FR')}</span>
                    </div>

                    <h3 className="text-lg font-black text-slate-900 truncate">{order.title}</h3>

                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <User className="w-3.5 h-3.5" /> {order.otherUser}
                      </div>
                      <div className="w-1 h-1 bg-slate-300 rounded-full" />
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary">{order.price} UC</div>
                      {order.status === 'revision' && (
                        <div className="flex items-center gap-1.5 text-xs text-orange-600">
                          <RotateCw className="w-3 h-3" />
                          <span>Révision {order.revisionsUsed || 0}/{order.revisionLimit || 2}</span>
                          {order.revisionMessage && (
                            <span className="text-[9px] text-orange-500 ml-1">(message envoyé)</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* ✅ PROGRESSION - AIDEUR peut modifier, DEMANDEUR voit seulement */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[9px] font-black text-slate-400 mb-1">
                        <span>Progression du travail</span>
                        {canUpdateProgress ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateProgress(order.id, order.progress - 10)} className="px-2 py-0.5 bg-slate-100 rounded text-xs hover:bg-primary/10 transition-all">-10%</button>
                            <span className="text-xs font-black text-primary">{order.progress}%</span>
                            <button onClick={() => updateProgress(order.id, order.progress + 10)} className="px-2 py-0.5 bg-slate-100 rounded text-xs hover:bg-primary/10 transition-all">+10%</button>
                          </div>
                        ) : (
                          <span className="text-xs font-black text-primary">{order.progress}%</span>
                        )}
                      </div>
                      {canUpdateProgress ? (
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={order.progress}
                          onChange={(e) => updateProgress(order.id, parseInt(e.target.value))}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer border border-slate-200"
                          style={{ 
                            accentColor: getProgressHexColor(order.progress),
                            background: `linear-gradient(to right, ${getProgressHexColor(order.progress)} ${order.progress}%, white ${order.progress}%)`
                          }}
                        />
                      ) : (
                        <div className="h-2 bg-white rounded-full overflow-hidden border border-slate-200">
                          <div className={`h-full rounded-full transition-all duration-500 ${getProgressColorClass(order.progress)}`} style={{ width: `${order.progress}%` }} />
                        </div>
                      )}
                    </div>

                    {/* Fichiers initiaux */}
                    {order.initialFiles && order.initialFiles.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> 📎 Fichiers de la commande ({order.initialFiles.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {order.initialFiles.map((file, idx) => (
                            <button key={idx} onClick={() => forceDownload(file.url, file.name)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-primary/5 transition-all group cursor-pointer">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium text-slate-700 max-w-[150px] truncate">{file.name}</span>
                              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fichiers de livraison */}
                    {order.deliveryFiles && order.deliveryFiles.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> 📦 Résultat livré ({order.deliveryFiles.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {order.deliveryFiles.map((file, idx) => (
                            <button key={idx} onClick={() => forceDownload(file.url, file.name)} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg hover:bg-primary/5 transition-all group cursor-pointer">
                              <FileText className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium text-slate-700 max-w-[150px] truncate">{file.name}</span>
                              <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-primary transition-colors" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 shrink-0 mt-4">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setSelectedOrder(order)} className="p-3 bg-slate-50 text-slate-500 hover:text-primary rounded-xl transition-all" title="Voir détails">
                          <Eye className="w-5 h-5" />
                        </button>
                        <button onClick={() => startConversation(order.otherUserId, order)} className="p-3 bg-slate-50 text-slate-500 hover:text-primary rounded-xl transition-all" title="Contacter">
                          <MessageSquare className="w-5 h-5" />
                        </button>
                        <div className="relative">
                          <button onClick={() => setShowOptionsId(showOptionsId === order.id ? null : order.id)} className="p-3 bg-slate-50 text-slate-500 rounded-xl transition-all">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          <AnimatePresence>
                            {showOptionsId === order.id && (
                              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 min-w-[200px]">
                                <button onClick={() => togglePinOrder(order.id, order.isPinned)} className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-xl flex items-center gap-2">
                                  {order.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                                  {order.isPinned ? 'Désépingler' : 'Épingler'}
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      {/* ✅ Actions principales en tant que boutons visibles (hors menu) */}
                      {!isAideur && order.status === 'delivered' && (
                        <div className="flex gap-2 w-full mt-2">
                          <button onClick={() => handleAcceptDelivery(order.id)} className="flex-1 py-2 bg-green-600 text-white text-xs font-black rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-1.5 shadow-sm">
                            ✅ Accepter résultat
                          </button>
                          {canRequestRevision && (
                            <button onClick={() => setShowRevisionModal(order)} className="flex-1 py-2 bg-orange-500 text-white text-xs font-black rounded-xl hover:bg-orange-600 transition-all flex items-center justify-center gap-1.5 shadow-sm">
                              🔄 Demander révision ({order.revisionsUsed}/{order.revisionLimit})
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* ✅ Actions communes : Signaler un problème */}
                      {canOpenDispute && (
                        <div className="flex gap-2 w-full mt-2">
                          <button onClick={() => setShowDisputeModal(order)} className="flex-1 py-2 bg-red-50 text-red-600 border border-red-100 text-xs font-black rounded-xl hover:bg-red-100 transition-all flex items-center justify-center gap-1.5">
                            ⚖️ Signaler un problème
                          </button>
                        </div>
                      )}

                      {/* ✅ Action Laisser un avis pour les commandes terminées */}
                      {!isAideur && order.status === 'completed' && (
                        <div className="flex gap-2 w-full mt-2">
                          <button onClick={() => setShowReviewModal(order)} className="flex-1 py-2 bg-amber-50 text-amber-600 border border-amber-100 text-xs font-black rounded-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-1.5 shadow-sm">
                            ⭐ Laisser un avis
                          </button>
                        </div>
                      )}

                      {/* ✅ Actions demandeur : Annuler */}
                      {!isAideur && canCancel && (
                        <div className="flex gap-2 w-full mt-2">
                          <button onClick={() => setShowCancelConfirm(order.id)} className="flex-1 py-2 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-black rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5">
                            ❌ Annuler la commande
                          </button>
                        </div>
                      )}

                      {isAideur && canDeliver && (
                        <div className="flex gap-2 w-full mt-2">
                          <button onClick={() => setShowDeliveryModal(order)} className="flex-1 py-2 bg-purple-600 text-white text-xs font-black rounded-xl hover:bg-purple-700 transition-all flex items-center justify-center gap-1.5 shadow-sm">
                            📤 Livrer le résultat
                          </button>
                        </div>
                      )}
                      {isAideur && canAccept && (
                        <div className="flex gap-2 w-full mt-2">
                          <button onClick={() => handleAcceptOrder(order)} disabled={isSubmitting} className="flex-1 py-2 bg-green-600 text-white text-xs font-black rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-1.5">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Accepter
                          </button>
                          <button onClick={() => handleRefuseOrder(order)} className="flex-1 py-2 bg-red-600 text-white text-xs font-black rounded-xl hover:bg-red-700 transition-all flex items-center justify-center gap-1.5">
                            <X className="w-4 h-4" /> Refuser
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-16 bg-white rounded-3xl border border-slate-100">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">
              {searchQuery || statusFilter !== 'all' 
                ? 'Aucune commande ne correspond à vos critères' 
                : (isAideur ? 'Aucune vente pour le moment' : 'Aucun achat pour le moment')}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {searchQuery || statusFilter !== 'all' 
                ? 'Essayez de modifier vos filtres ou votre recherche.' 
                : (isAideur ? 'Publiez des services pour recevoir des commandes' : 'Explorez le marketplace pour passer des commandes')}
            </p>
            {(!searchQuery && statusFilter === 'all') && (
              <button onClick={() => onNavigate?.('marketplace')} className="mt-4 px-6 py-2 bg-primary text-white font-black rounded-xl">Explorer le marketplace</button>
            )}
          </div>
        )}
      </div>

      {/* MODAL LIVRAISON */}
      <AnimatePresence>
        {showDeliveryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">Livrer le travail</h3>
                <p className="text-xs text-slate-500 mt-1">Ajoutez vos fichiers</p>
              </div>
              <div className="p-5 space-y-4">
                <textarea rows={2} value={deliveryMessage} onChange={(e) => setDeliveryMessage(e.target.value)} placeholder="Message de livraison..." className="w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm resize-none" />
                <div onClick={() => deliveryFileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-primary transition-all">
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-500">{deliveryFiles.length > 0 ? `${deliveryFiles.length} fichier(s) sélectionné(s)` : 'Ajouter des fichiers'}</span>
                </div>
                <input ref={deliveryFileInputRef} type="file" multiple className="hidden" onChange={(e) => setDeliveryFiles(Array.from(e.target.files || []))} />
                {deliveryFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {deliveryFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg text-xs">
                        <FileText className="w-3 h-3" /> {f.name}
                        <button onClick={() => setDeliveryFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-500 ml-1">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <button onClick={() => setShowDeliveryModal(null)} className="flex-1 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-50">Annuler</button>
                  <button onClick={() => handleDeliverWithVersion(showDeliveryModal.id)} disabled={deliveryFiles.length === 0 || uploadingDelivery} className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700">
                    {uploadingDelivery ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Livrer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DEMANDE RÉVISION */}
      <AnimatePresence>
        {showRevisionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-black text-slate-900">Demander une révision</h3>
                <p className="text-xs text-slate-500">Révisions restantes: {showRevisionModal.revisionLimit - showRevisionModal.revisionsUsed}/{showRevisionModal.revisionLimit}</p>
              </div>
              <div className="p-5 space-y-4">
                <textarea rows={4} value={revisionMessage} onChange={(e) => setRevisionMessage(e.target.value)} placeholder="Décrivez les modifications à apporter..." className="w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm resize-none" />
                <div className="flex gap-3">
                  <button onClick={() => setShowRevisionModal(null)} className="flex-1 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-50">Annuler</button>
                  <button onClick={() => handleRequestRevision(showRevisionModal.id, revisionMessage)} disabled={!revisionMessage.trim()} className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700">Envoyer</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL LITIGE */}
      <AnimatePresence>
        {showDisputeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-black text-red-600">Signaler un problème</h3>
                <p className="text-xs text-slate-500">Un administrateur traitera sous 72h</p>
              </div>
              <div className="p-5 space-y-4">
                <textarea rows={4} value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Décrivez le problème en détail..." className="w-full px-4 py-3 bg-slate-50 border rounded-xl text-sm resize-none" />
                <div className="flex gap-3">
                  <button onClick={() => setShowDisputeModal(null)} className="flex-1 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-50">Annuler</button>
                  <button onClick={() => handleOpenDispute(showDisputeModal.id, disputeReason)} disabled={!disputeReason.trim()} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Ouvrir un litige</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL ANNULATION */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-lg font-black text-red-600">Annuler la commande</h3>
              </div>
              <div className="p-5">
                <p className="text-slate-600 mb-4">Les fonds seront remboursés intégralement.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowCancelConfirm(null)} className="flex-1 py-3 text-slate-500 font-bold rounded-xl hover:bg-slate-50">Non</button>
                  <button onClick={() => { handleCancelOrder(showCancelConfirm); setShowCancelConfirm(null); }} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700">Oui</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DÉTAILS */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <h3 className="text-xl font-black text-slate-900">Détails de la commande</h3>
                <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="h-40 rounded-xl overflow-hidden bg-slate-100"><img src={selectedOrder.image} className="w-full h-full object-cover" alt={selectedOrder.title} /></div>
                <h4 className="text-lg font-black text-slate-900">{selectedOrder.title}</h4>
                <p className="text-slate-600 text-sm">{selectedOrder.description || selectedOrder.instructions || 'Aucune description'}</p>
                {selectedOrder.deliveryDeadline && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-400">Livraison prévue</span>
                    <span className="text-xs font-bold">{new Date(selectedOrder.deliveryDeadline).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {selectedOrder.deliveredAt && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-400">Livré le</span>
                    <span className="text-xs font-bold">{new Date(selectedOrder.deliveredAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {selectedOrder.completedAt && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-xs text-slate-400">Terminé le</span>
                    <span className="text-xs font-bold">{new Date(selectedOrder.completedAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                )}
                {selectedOrder.revisionMessage && selectedOrder.status === 'revision' && (
                  <div className="p-3 bg-orange-50 rounded-xl">
                    <p className="text-[10px] font-black text-orange-600 uppercase mb-1">Demande de révision</p>
                    <p className="text-sm text-slate-600">{selectedOrder.revisionMessage}</p>
                  </div>
                )}
                {selectedOrder.initialFiles && selectedOrder.initialFiles.length > 0 && (
                  <div className="pt-2 pb-2 border-b border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> 📎 Fichiers de la commande ({selectedOrder.initialFiles.length})
                    </p>
                    <div className="space-y-2">
                      {selectedOrder.initialFiles.map((file, idx) => (
                        <button key={idx} onClick={() => forceDownload(file.url, file.name)} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-primary/5 transition-all group w-full text-left cursor-pointer">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{file.name}</span>
                          <Download className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedOrder.deliveryFiles && selectedOrder.deliveryFiles.length > 0 && (
                  <div className="pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> 📦 Résultat livré ({selectedOrder.deliveryFiles.length})
                    </p>
                    <div className="space-y-2">
                      {selectedOrder.deliveryFiles.map((file, idx) => (
                        <button key={idx} onClick={() => forceDownload(file.url, file.name)} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-primary/5 transition-all group w-full text-left cursor-pointer">
                          <FileText className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{file.name}</span>
                          <Download className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <span className="text-2xl font-black text-primary">{selectedOrder.price} UC</span>
                  <button onClick={() => { startConversation(selectedOrder.otherUserId, selectedOrder.title); setSelectedOrder(null); }} className="px-5 py-2.5 bg-primary text-white font-black text-sm rounded-xl flex items-center justify-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Contacter
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL AVIS ET COMMENTAIRE */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900">Laisser un avis</h3>
                <button onClick={() => setShowReviewModal(null)} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-6 text-center">
                <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto">
                  <StarIcon className="w-10 h-10 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900">Comment s'est passée votre commande ?</h4>
                  <p className="text-sm text-slate-500 mt-1">Votre avis aide la communauté UniSkills.</p>
                </div>

                {/* Sélecteur d'étoiles */}
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className="p-1 transition-transform hover:scale-110"
                    >
                      <StarIcon
                        className={`w-10 h-10 ${star <= reviewRating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`}
                      />
                    </button>
                  ))}
                </div>

                <textarea
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Partagez votre expérience avec cet aideur..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
                />

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowReviewModal(null)}
                    className="flex-1 py-3 text-slate-500 font-bold rounded-2xl hover:bg-slate-50 transition-all"
                  >
                    Plus tard
                  </button>
                  <button
                    onClick={handleSaveReview}
                    disabled={isSubmittingReview || !reviewComment.trim()}
                    className="flex-1 py-3 bg-primary text-white font-black rounded-2xl hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    {isSubmittingReview ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publier l\'avis'}
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