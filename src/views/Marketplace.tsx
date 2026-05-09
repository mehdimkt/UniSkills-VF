import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Filter, Star, Heart, MapPin, Clock, Upload,
  MessageCircle, Send, Zap, X, CheckCircle2, Plus, Handshake,
  Shield, Paperclip, Loader2, ArrowLeft, User, GraduationCap,
  BookOpen, Award, RotateCw, Timer, Calendar, FileText,
  TrendingUp, Eye, Sparkles, FolderHeart, Check, Download,
  SlidersHorizontal, Tag, DollarSign, AlertCircle, ArrowRight, ShieldAlert
} from 'lucide-react';
import { UserProfileModal } from '../components/UserProfileModal';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notifications';
import ReportModal from '../components/ReportModal';

interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  short_description?: string;
  full_description: string;
  price: number;
  category: string;
  owner_name?: string;
  owner_id?: string;
  image_url?: string;
  rating?: number;
  reviewsCount?: number;
  city?: string;
  university?: string;
  level?: string;
  owner_avatar?: string;
  owner_rating?: number;
  deadline?: string;
  delivery_time?: number;
  revision_ceiling?: number;
  cancellation_delay?: string;
  type?: 'service' | 'lead';
  status?: string;
}

interface Collection {
  id: string;
  name: string;
}

interface UploadedFile {
  name: string;
  url: string;
}

async function createOrder(orderData: any) {
  const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  const orderId = orderData.id || generateUUID();
  const { data, error } = await supabase.from('orders').insert([{
    id: orderId,
    service_id: orderData.service_id || null,
    lead_id: orderData.lead_id || null,
    buyer_id: orderData.buyer_id,
    seller_id: orderData.seller_id,
    amount: orderData.amount,
    instructions: orderData.instructions || '',
    status: 'pending',
    progress: 0,
    files: orderData.files || [],
    delivery_deadline: orderData.delivery_deadline || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]).select();

  return { data: data?.[0], error, orderId };
}

async function createProposal(proposalData: any) {
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const proposalId = generateUUID();

  const { data, error } = await supabase.from('proposals').insert([{
    id: proposalId,
    service_id: proposalData.service_id || null,
    lead_id: proposalData.lead_id || null,
    sender_id: proposalData.sender_id,
    receiver_id: proposalData.receiver_id,
    budget: proposalData.budget,
    content: proposalData.content,
    files: proposalData.files || [],
    delivery_days: proposalData.delivery_days || 7,
    revision_limit: proposalData.revision_limit || 2,
    cancellation_delay: proposalData.cancellation_delay || '24',
    status: 'pending',
    created_at: new Date().toISOString()
  }]).select();

  return { data: data?.[0], error };
}

async function getOrCreateConversation(user1Id: string, user2Id: string) {
  const { data: existingConv } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user1Id);
  if (existingConv && existingConv.length > 0) {
    const convIds = existingConv.map(c => c.conversation_id);
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user2Id)
      .in('conversation_id', convIds);
    if (participants && participants.length > 0) {
      return { conversationId: participants[0].conversation_id, error: null };
    }
  }
  const { data: conv, error: convError } = await supabase.from('conversations').insert([{}]).select();
  if (convError) return { error: convError };
  const conversationId = conv[0].id;
  await supabase.from('conversation_participants').insert([
    { conversation_id: conversationId, user_id: user1Id },
    { conversation_id: conversationId, user_id: user2Id }
  ]);
  return { conversationId, error: null };
}

async function sendMessage(conversationId: number, senderId: string, recipientId: string, content: string, fileUrl?: string, fileName?: string) {
  const messageContent = fileUrl ? `📎 ${fileName}` : content;
  const { error } = await supabase.from('messages').insert([{
    conversation_id: conversationId,
    sender_id: senderId,
    content: messageContent,
    file_url: fileUrl,
    file_name: fileName,
    created_at: new Date().toISOString()
  }]);
  if (!error) {
    const { data: senderProfile } = await supabase.from('users').select('first_name, last_name').eq('id', senderId).single();
    const senderName = senderProfile ? `${senderProfile.first_name} ${senderProfile.last_name}`.trim() : 'Quelqu\'un';
    await sendNotification(recipientId, '💬 Nouveau message', `${senderName} vous a envoyé un message`, 'message', 'messages', { conversation_id: conversationId });
  }
  return { error };
}

async function fetchMarketplaceItems(type: 'service' | 'lead', currentUserId: string) {
  if (type === 'lead') {
    const { data, error } = await supabase
      .from('leads')
      .select(`*, owner:users!owner_id (id, first_name, last_name, full_name, email, city, avatar_url, university, level)`)
      .in('status', ['open', 'negotiating'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching leads:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('No leads found');
      return [];
    }

    return data.map((lead: any) => ({
      id: lead.id,
      title: lead.title || 'Sans titre',
      description: lead.description || '',
      short_description: lead.short_description || (lead.description ? lead.description.substring(0, 100) + '...' : ''),
      full_description: lead.description || '',
      price: lead.budget || 0,
      category: lead.category || 'Autre',
      owner_name: lead.owner?.full_name || `${lead.owner?.first_name || ''} ${lead.owner?.last_name || ''}`.trim() || 'Demandeur',
      owner_id: lead.owner_id,
      image_url: lead.image_url || 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=450&fit=crop',
      city: lead.owner?.city || 'Maroc',
      university: lead.owner?.university || '',
      level: lead.owner?.level || '',
      owner_avatar: lead.owner?.avatar_url,
      deadline: lead.deadline || 'Flexible',
      status: lead.status || 'open',
      type: 'lead' as const,
      delivery_time: undefined,
      revision_ceiling: undefined,
      cancellation_delay: undefined,
      rating: undefined,
      reviewsCount: 0
    }));
  } else {
    const { data, error } = await supabase
      .from('services')
      .select(`*, user:users!user_id (id, first_name, last_name, full_name, email, city, avatar_url, university, level, rating)`)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching services:', error);
      return [];
    }

    if (!data || data.length === 0) {
      console.log('No services found');
      return [];
    }

    return data.map((service: any) => ({
      id: service.id.toString(),
      title: service.title || 'Sans titre',
      description: service.short_description || service.description || '',
      short_description: service.short_description || (service.description ? service.description.substring(0, 100) + '...' : ''),
      full_description: service.description || '',
      price: service.price || 0,
      category: service.category || 'Autre',
      owner_name: service.user?.full_name || `${service.user?.first_name || ''} ${service.user?.last_name || ''}`.trim() || 'Aideur',
      owner_id: service.user_id,
      image_url: service.cover_image || service.image_url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=450&fit=crop',
      rating: service.rating || 4.5,
      reviewsCount: service.sales_count || 0,
      city: service.user?.city || 'Maroc',
      university: service.user?.university || '',
      level: service.user?.level || '',
      owner_avatar: service.user?.avatar_url,
      owner_rating: service.user?.rating,
      delivery_time: service.delivery_time || 3,
      revision_ceiling: service.revision_ceiling || 2,
      cancellation_delay: service.cancellation_delay || '24h',
      type: 'service' as const
    }));
  }
}

export default function Marketplace({ onNavigate, initialData }: { onNavigate?: (view: string, context?: any) => void, initialData?: any }) {
  const { role, user } = useAuth();
  const isAideur = role === 'aideur';
  const [viewType, setViewType] = useState<'service' | 'lead'>(isAideur ? 'lead' : 'service');
  
  useEffect(() => {
    setViewType(isAideur ? 'lead' : 'service');
  }, [isAideur]);

  const currentMode = isAideur ? 'aideur' : 'demandeur';

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes catégories');
  const [maxPrice, setMaxPrice] = useState(2000);
  const [minRating, setMinRating] = useState(0);
  const [reportTarget, setReportTarget] = useState<{ id: string, type: 'user' | 'service' | 'lead' | 'message', name: string } | null>(null);

  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [selectedItemReviews, setSelectedItemReviews] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (selectedItem?.owner_id) {
      const fetchReviews = async () => {
        const { data } = await supabase
          .from('reviews')
          .select('*')
          .eq('reviewed_id', selectedItem.owner_id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (data) {
          setSelectedItemReviews(data);
        }
      };
      fetchReviews();
    }
  }, [selectedItem]);
  const [showUserProfileId, setShowUserProfileId] = useState<string | null>(null);

  const [maxDeliveryDays, setMaxDeliveryDays] = useState<number | null>(null);
  const [minRevisions, setMinRevisions] = useState<number>(0);
  const [maxCancellationHours, setMaxCancellationHours] = useState<number | null>(null);
  const [maxDeadlineDays, setMaxDeadlineDays] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'rating_desc'>('newest');

  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollectionModal, setShowCollectionModal] = useState<{ itemId: string; itemTitle: string; itemType: string } | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  const [showOrderModal, setShowOrderModal] = useState<MarketplaceItem | null>(null);
  const [orderMode, setOrderMode] = useState<'order' | 'proposal'>('order');
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [orderForm, setOrderForm] = useState({
    title: '',
    description: '',
    deadline: '7',
    customDeadline: '',
    urgency: 'normal',
    proposedPrice: 0,
    message: '',
    revisions: '1'
  });

  const categories = viewType === 'lead'
    ? ['Toutes catégories', 'Soutien Scolaire', 'Informatique', 'Rédaction', 'Design', 'Marketing', 'Traduction', 'Autre']
    : ['Toutes catégories', 'Soutien Scolaire', 'Tech & Programmation', 'Design & Multimédia', 'Rédaction & Traduction', 'Marketing Digital', 'Aide Administrative', 'Autre'];

  const sortOptions = [
    { value: 'newest', label: 'Plus récent' },
    { value: 'price_asc', label: ' Prix croissant' },
    { value: 'price_desc', label: ' Prix décroissant' },
    { value: 'rating_desc', label: ' Meilleure note' }
  ];

  const deliveryOptions = [
    { value: '', label: 'Peu importe' },
    { value: '1', label: 'Moins de 24h' },
    { value: '3', label: 'Moins de 3 jours' },
    { value: '7', label: 'Moins de 7 jours' },
    { value: '14', label: 'Moins de 14 jours' }
  ];

  const revisionOptions = [
    { value: '0', label: 'Peu importe' },
    { value: '1', label: '1 révision minimum' },
    { value: '2', label: '2 révisions minimum' },
    { value: '3', label: '3 révisions minimum' },
    { value: '5', label: '5 révisions minimum' }
  ];

  const cancellationOptions = [
    { value: '', label: 'Peu importe' },
    { value: '12', label: 'Moins de 12h' },
    { value: '24', label: 'Moins de 24h' },
    { value: '48', label: 'Moins de 48h' }
  ];

  const deadlineOptions = [
    { value: '', label: 'Peu importe' },
    { value: '1', label: 'Urgent (moins de 24h)' },
    { value: '3', label: 'Cette semaine' },
    { value: '7', label: 'Cette semaine +' },
    { value: '14', label: 'Moins de 2 semaines' },
    { value: '30', label: 'Moins d\'1 mois' }
  ];

  useEffect(() => {
    const loadItems = async () => {
      if (!user) return;
      if (items.length === 0) setLoading(true);
      const data = await fetchMarketplaceItems(viewType, user.id);
      setItems(data);
      setLoading(false);
    };
    loadItems();
  }, [viewType, user]);

  useEffect(() => {
    const fetchCollections = async () => {
      if (!user) return;
      const { data } = await supabase.from('collections').select('id, name').eq('user_id', user.id).eq('mode', currentMode);
      if (data) setCollections(data);
    };
    fetchCollections();
  }, [user, currentMode]);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;
      const { data } = await supabase.from('favorites').select('item_id').eq('user_id', user.id).eq('mode', currentMode);
      if (data) setLikedItems(new Set(data.map(f => f.item_id)));
    };
    fetchFavorites();
  }, [user, currentMode]);

  useEffect(() => {
    if (initialData?.openItemId && !loading && items.length > 0) {
      const targetItem = items.find(i => i.id === initialData.openItemId);
      if (targetItem) {
        setSelectedItem(targetItem);
      } else {
        alert("L'annonce n'est plus disponible.");
      }
    }
  }, [initialData, items, loading]);

  const filteredItems = items
    .filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Toutes catégories' || item.category === selectedCategory;
      const matchesPrice = item.price <= maxPrice;

      if (viewType === 'lead') {
        let matchesDeadline = true;
        if (maxDeadlineDays && item.deadline) {
          const deadlineDate = new Date(item.deadline);
          const today = new Date();
          const daysUntilDeadline = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          matchesDeadline = daysUntilDeadline <= maxDeadlineDays;
        }

        const matchesDelivery = maxDeliveryDays ? (item.delivery_time && item.delivery_time <= maxDeliveryDays) : true;
        const matchesRevisions = minRevisions > 0 ? (item.revision_ceiling && item.revision_ceiling >= minRevisions) : true;
        const matchesCancellation = maxCancellationHours ? (item.cancellation_delay && parseInt(item.cancellation_delay) <= maxCancellationHours) : true;

        return matchesSearch && matchesCategory && matchesPrice && matchesDelivery && matchesRevisions && matchesCancellation && matchesDeadline;
      } else {
        const matchesRating = (item.rating || 0) >= minRating;
        const matchesDelivery = maxDeliveryDays ? (item.delivery_time && item.delivery_time <= maxDeliveryDays) : true;
        const matchesRevisions = minRevisions > 0 ? (item.revision_ceiling && item.revision_ceiling >= minRevisions) : true;
        const matchesCancellation = maxCancellationHours ? (item.cancellation_delay && parseInt(item.cancellation_delay) <= maxCancellationHours) : true;

        return matchesSearch && matchesCategory && matchesPrice && matchesRating && matchesDelivery && matchesRevisions && matchesCancellation;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'rating_desc': return (b.rating || 0) - (a.rating || 0);
        default: return 0;
      }
    });

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Toutes catégories');
    setMaxPrice(2000);
    setMinRating(0);
    setMaxDeliveryDays(null);
    setMinRevisions(0);
    setMaxCancellationHours(null);
    setMaxDeadlineDays(null);
    setSortBy('newest');
    setShowFilters(false);
  };

  const handleToggleLike = async (itemId: string, itemTitle: string, itemType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (likedItems.has(itemId)) {
      await supabase.from('favorites').delete().eq('user_id', user!.id).eq('item_id', itemId).eq('mode', currentMode);
      setLikedItems(prev => { const next = new Set(prev); next.delete(itemId); return next; });
    } else {
      setShowCollectionModal({ itemId, itemTitle, itemType });
    }
  };

  const addToCollection = async () => {
    if (!showCollectionModal || !user) return;
    const { itemId, itemTitle, itemType } = showCollectionModal;
    const collectionId = selectedCollectionId;
    if (!collectionId && !newCollectionName.trim()) { alert('Veuillez sélectionner une collection ou en créer une nouvelle'); return; }
    let finalCollectionId = collectionId;
    if (!finalCollectionId && newCollectionName.trim()) {
      const { data: newCollection, error: createError } = await supabase.from('collections').insert({ user_id: user.id, name: newCollectionName.trim(), mode: currentMode }).select().single();
      if (createError) { alert('Erreur lors de la création de la collection'); return; }
      finalCollectionId = newCollection.id;
      setCollections(prev => [...prev, { id: newCollection.id, name: newCollectionName.trim() }]);
    }
    const { error } = await supabase.from('favorites').insert({ user_id: user.id, item_id: itemId, item_type: itemType, collection_id: finalCollectionId, mode: currentMode, created_at: new Date().toISOString() });
    if (error) { alert('Erreur lors de l\'ajout aux favoris'); } else {
      setLikedItems(prev => new Set(prev).add(itemId));
      setShowCollectionModal(null);
      setSelectedCollectionId(null);
      setNewCollectionName('');
    }
  };

  const uploadFiles = async (files: File[]): Promise<UploadedFile[]> => {
    const uploadedFiles: UploadedFile[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, file);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
        uploadedFiles.push({ name: file.name, url: urlData.publicUrl });
      } else {
        console.error('Upload error:', uploadError);
      }
    }
    return uploadedFiles;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
  };

  const removeFile = (index: number) => setAttachedFiles(prev => prev.filter((_, i) => i !== index));

  const startConversation = async (item: MarketplaceItem) => {
    if (!user) return;
    if (item.owner_id === user.id) {
      alert("Vous ne pouvez pas contacter votre propre annonce");
      return;
    }
    try {
      let conversationId = null;
      const { data: myParticipants } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', user.id);
      if (myParticipants && myParticipants.length > 0) {
        const convIds = myParticipants.map(p => p.conversation_id);
        const { data: otherParticipants } = await supabase.from('conversation_participants').select('conversation_id').eq('user_id', item.owner_id!).in('conversation_id', convIds);
        if (otherParticipants && otherParticipants.length > 0) conversationId = otherParticipants[0].conversation_id;
      }
      if (!conversationId) {
        const { data: newConv } = await supabase.from('conversations').insert([{ created_at: new Date().toISOString() }]).select().single();
        conversationId = newConv.id;
        await supabase.from('conversation_participants').insert([{ conversation_id: conversationId, user_id: user.id }, { conversation_id: conversationId, user_id: item.owner_id! }]);
      }
      await sendNotification(item.owner_id!, '💬 Nouvelle conversation', `${user.first_name} ${user.last_name} souhaite vous contacter à propos de "${item.title}"`, 'message', 'messages', { conversation_id: conversationId, title: item.title });
      onNavigate?.('messages', { conversation_id: conversationId, title: item.title, owner_id: item.owner_id, image_url: item.image_url, price: item.price, type: item.type, id: item.id });
    } catch (err) { console.error(err); alert('Erreur lors de l\'ouverture de la conversation'); }
  };

  const handleOpenOrderModal = (item: MarketplaceItem) => {
    if (item.owner_id === user?.id) { alert("Vous ne pouvez pas commander votre propre service"); return; }
    setShowOrderModal(item);
    setAttachedFiles([]);
    setOrderForm({
      title: item.title,
      description: '',
      deadline: (item.delivery_time || 7).toString(),
      customDeadline: '',
      urgency: 'normal',
      proposedPrice: item.price,
      message: '',
      revisions: (item.revision_ceiling || 3).toString()
    });
    setOrderMode(viewType === 'lead' ? 'proposal' : 'order');
  };

  const submitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showOrderModal || !user || showOrderModal.owner_id === user.id) return;
    setIsSubmitting(true);
    setUploadingFiles(true);
    try {
      const finalPrice = orderMode === 'order' ? (showOrderModal.price + (orderForm.urgency === 'urgent' ? 50 : 0)) : orderForm.proposedPrice;
      const uploadedFiles = await uploadFiles(attachedFiles);
      if (orderMode === 'order') {
        const { data: wallet } = await supabase.from('unicoin_wallets').select('balance').eq('user_id', user.id).single();
        if (!wallet || wallet.balance < finalPrice) { alert(`Solde insuffisant!`); setIsSubmitting(false); setUploadingFiles(false); return; }
        await supabase.from('unicoin_wallets').update({ balance: wallet.balance - finalPrice }).eq('user_id', user.id);
        const { data: walletData } = await supabase.from('unicoin_wallets').select('id').eq('user_id', user.id).single();
        if (!walletData) throw new Error("Wallet not found");
        await supabase.from('unicoin_transactions').insert({ wallet_id: walletData.id, amount: -finalPrice, type: 'hold', status: 'pending', description: `Fonds bloqués pour commande ${showOrderModal.title}`, created_at: new Date().toISOString() });
        const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 48);
        const deliveryDeadline = new Date(); 
        deliveryDeadline.setDate(deliveryDeadline.getDate() + parseInt(orderForm.deadline));
        const { error, orderId } = await createOrder({
          service_id: showOrderModal.type === 'service' ? parseInt(showOrderModal.id) : undefined,
          lead_id: showOrderModal.type === 'lead' ? showOrderModal.id : undefined,
          buyer_id: user.id, seller_id: showOrderModal.owner_id!,
          amount: finalPrice, instructions: orderForm.description,
          expires_at: expiresAt.toISOString(), delivery_deadline: deliveryDeadline.toISOString(),
          files: uploadedFiles
        });
        if (error) throw error;
        const { conversationId } = await getOrCreateConversation(user.id, showOrderModal.owner_id!);
        if (conversationId) await sendMessage(conversationId, user.id, showOrderModal.owner_id!, `Commande créée: ${showOrderModal.title} - ${finalPrice} UC`);
        await sendNotification(showOrderModal.owner_id!, '🛒 Nouvelle commande', `${user.first_name} ${user.last_name} a commandé "${showOrderModal.title}" pour ${finalPrice} UC`, 'order', 'orders', { orderId });
        setShowOrderModal(null);
        onNavigate?.('orders', { tab: 'orders' });
      } else {
        const { error } = await createProposal({
          service_id: showOrderModal.type === 'service' ? parseInt(showOrderModal.id) : undefined,
          lead_id: showOrderModal.type === 'lead' ? showOrderModal.id : undefined,
          sender_id: user.id, receiver_id: showOrderModal.owner_id!,
          budget: finalPrice, content: orderForm.message || `Proposition pour ${showOrderModal.title}`,
          files: uploadedFiles, delivery_days: parseInt(orderForm.deadline),
          revision_limit: parseInt(orderForm.revisions), cancellation_delay: '24'
        });
        if (error) throw error;
        await sendNotification(showOrderModal.owner_id!, '📝 Nouvelle proposition', `${user.first_name} ${user.last_name} vous a proposé ${finalPrice} UC pour "${showOrderModal.title}"`, 'proposal', 'proposals', { service_id: showOrderModal.type === 'service' ? showOrderModal.id : null, lead_id: showOrderModal.type === 'lead' ? showOrderModal.id : null, budget: finalPrice });
        const { conversationId } = await getOrCreateConversation(user.id, showOrderModal.owner_id!);
        if (conversationId) await sendMessage(conversationId, user.id, showOrderModal.owner_id!, `Proposition envoyée: ${finalPrice} UC - Délai: ${orderForm.deadline}j`);
        setShowOrderModal(null);
        onNavigate?.('proposals');
      }
    } catch (err) { console.error(err); alert('Une erreur est survenue'); }
    finally { setIsSubmitting(false); setUploadingFiles(false); }
  };


  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-xl shadow-primary/10" />
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Initialisation du Marketplace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-3">
              {viewType === 'service' ? 'Trouver des talents' : 'Trouver des missions'}
            </h1>
            <div className="relative max-w-2xl mx-auto">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={viewType === 'lead' ? "Rechercher une mission..." : "Rechercher un service..."} className="w-full pl-14 pr-24 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none" />
              <Search className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2" />
              <button onClick={() => setShowFilters(!showFilters)} className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-primary hover:text-white transition-all flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" /> Filtres
                {(selectedCategory !== 'Toutes catégories' || maxPrice < 2000 || maxDeliveryDays || minRevisions > 0 || maxCancellationHours || maxDeadlineDays || (!isAideur && minRating > 0)) && <span className="w-2 h-2 bg-primary rounded-full" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Panneau de filtres */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-slate-100 bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 py-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2"><Filter className="w-5 h-5 text-primary" /><h3 className="font-black text-slate-900">Filtres avancés</h3></div>
                <button onClick={resetFilters} className="text-xs text-slate-400 hover:text-red-500 transition-all font-medium">Réinitialiser tout</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Tag className="w-3 h-3" /> Catégorie</label>
                  <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary">
                    {categories.map(cat => (<option key={cat}>{cat}</option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><DollarSign className="w-3 h-3" /> Prix max (UC)</label>
                  <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                    <input type="range" min="0" max="2000" step="50" value={maxPrice} onChange={(e) => setMaxPrice(parseInt(e.target.value))} className="flex-1 accent-primary h-1.5 bg-slate-200 rounded-lg cursor-pointer" />
                    <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 min-w-[90px] text-right"><span className="text-sm font-black text-primary">{maxPrice >= 2000 ? '2000+' : maxPrice} UC</span></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-100">
                {viewType === 'service' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Star className="w-3 h-3 fill-current" /> Note minimum</label>
                    <div className="flex gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200">
                      {[1, 2, 3, 4, 5].map(star => (<button key={star} onClick={() => setMinRating(minRating === star ? 0 : star)} className={`flex-1 py-2 flex items-center justify-center rounded-lg transition-all ${minRating >= star ? 'text-secondary' : 'text-slate-300'}`}><Star className={`w-4 h-4 ${minRating >= star ? 'fill-current' : ''}`} /></button>))}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Trier par</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary">
                    {sortOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Clock className="w-3 h-3" /> Délai de livraison max</label>
                  <select value={maxDeliveryDays || ''} onChange={(e) => setMaxDeliveryDays(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary">
                    {deliveryOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><RotateCw className="w-3 h-3" /> Révisions minimum</label>
                  <select value={minRevisions} onChange={(e) => setMinRevisions(parseInt(e.target.value))} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary">
                    {revisionOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Délai d'annulation max</label>
                  <select value={maxCancellationHours || ''} onChange={(e) => setMaxCancellationHours(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary">
                    {cancellationOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                  </select>
                </div>
              </div>


              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                <button onClick={resetFilters} className="px-6 py-2 bg-slate-100 text-slate-600 text-xs font-black rounded-xl hover:bg-slate-200 transition-all">Réinitialiser</button>
                <button onClick={() => setShowFilters(false)} className="px-6 py-2 bg-primary text-white text-xs font-black rounded-xl hover:opacity-90 transition-all">Appliquer ({filteredItems.length} résultats)</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 pt-6 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-slate-500"><span className="font-black text-primary">{filteredItems.length}</span> annonce{filteredItems.length > 1 ? 's' : ''} trouvée{filteredItems.length > 1 ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">Trier par:</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary">
              {sortOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* Grille des annonces */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, idx) => {
              const isMyItem = item.owner_id === user?.id;
              const itemType = item.type;
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.05, duration: 0.4, ease: "circOut" }}
                  whileHover={{ y: -10 }}
                  onClick={() => setSelectedItem(item)}
                  className="group bg-white rounded-[32px] overflow-hidden shadow-sm hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-500 cursor-pointer border border-slate-100/60 relative"
                >
                  <div className="relative h-40 overflow-hidden bg-slate-50">
                    <img
                      src={item.image_url || (item.type === 'service' ? "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=450&fit=crop" : "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=450&fit=crop")}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                      onError={(e) => { (e.target as HTMLImageElement).src = item.type === 'service' ? "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=450&fit=crop" : "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&h=450&fit=crop"; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => handleToggleLike(item.id, item.title, itemType, e)}
                      className={`absolute top-4 right-4 p-2.5 rounded-2xl transition-all shadow-xl z-10 backdrop-blur-md ${likedItems.has(item.id) ? 'bg-red-500 text-white' : 'bg-white/80 text-slate-400 hover:text-red-500'}`}
                    >
                      <Heart className={`w-4 h-4 ${likedItems.has(item.id) ? 'fill-current' : ''}`} />
                    </motion.button>

                    {!isMyItem && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setReportTarget({ id: item.id, type: itemType as any, name: item.title });
                        }}
                        className="absolute top-4 left-4 p-2.5 bg-white/80 text-slate-400 hover:text-red-600 rounded-2xl transition-all shadow-xl z-10 backdrop-blur-md opacity-0 group-hover:opacity-100"
                      >
                        <ShieldAlert className="w-4 h-4" />
                      </motion.button>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-black rounded-full uppercase tracking-wider border border-primary/10">
                          {item.category}
                        </span>
                        {isAideur && item.status && (
                          <span className={`px-2.5 py-1 text-[9px] font-black rounded-full uppercase tracking-tighter shadow-sm ${item.status === 'open' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
                            {item.status === 'open' ? 'Ouvert' : 'Négociation'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-100 flex items-center justify-center overflow-hidden">
                          {item.owner_avatar ? <img src={item.owner_avatar} className="w-full h-full object-cover" /> : <User className="w-2.5 h-2.5 text-slate-400" />}
                        </div>
                        <span className="text-[9px] font-black text-slate-500 truncate uppercase tracking-tight opacity-70">{item.owner_name}</span>
                        {!isAideur && item.rating && (
                          <div className="flex items-center gap-1 ml-auto bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                            <Star className="w-2 h-2 fill-current text-amber-500" />
                            <span className="text-[9px] font-black text-amber-700">{item.rating}</span>
                          </div>
                        )}
                      </div>

                      <h3 className="text-sm font-black text-slate-900 line-clamp-1 mb-1 group-hover:text-primary transition-colors duration-300">{item.title}</h3>

                      <p className="text-[11px] text-slate-500 line-clamp-2 mb-3 leading-relaxed opacity-80 italic min-h-[28px]">
                        {item.short_description || (item.description ? item.description.substring(0, 80) + '...' : 'Aucune description')}
                      </p>

                      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 mb-4 flex-wrap">
                        {item.city && (<div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100/50"><MapPin className="w-2.5 h-2.5 text-slate-400" /><span>{item.city}</span></div>)}
                        <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100/50"><Clock className="w-2.5 h-2.5 text-slate-400" />{isAideur ? (item.deadline || 'Flexible') : `${item.delivery_time || 3}j`}</div>
                        {item.revision_ceiling && (<div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100/50"><RotateCw className="w-2.5 h-2.5 text-slate-400" /><span>{item.revision_ceiling}</span></div>)}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-50 mt-auto space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest opacity-60">À partir de</p>
                        <p className="text-xl font-black text-primary tracking-tighter">{item.price} <span className="text-[10px] font-bold text-slate-400">UC</span></p>
                      </div>

                      <div className="flex gap-2">
                        {!isMyItem ? (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => { e.stopPropagation(); startConversation(item); }}
                              className="p-3 bg-slate-50 text-slate-400 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all shadow-sm border border-slate-100"
                            >
                              <MessageCircle className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenOrderModal(item);
                              }}
                              className="flex-1 py-3 bg-[#FF385C] text-white text-[11px] font-black rounded-2xl transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95"
                            >
                              {itemType === 'lead' ? <Send className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                              {itemType === 'lead' ? 'Proposer' : 'Commander'}
                            </motion.button>
                          </>
                        ) : (
                          <div className="w-full py-2 bg-slate-50 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100 text-center">Votre annonce</div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
        {filteredItems.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4"><Search className="w-10 h-10 text-slate-300" /></div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Aucune annonce trouvée</h3>
            <p className="text-slate-500">Essayez de modifier votre recherche ou vos filtres</p>
            <button onClick={resetFilters} className="mt-4 px-6 py-2 bg-primary text-white font-black rounded-xl">Réinitialiser les filtres</button>
          </div>
        )}
      </div>

      {/* MODALE DE COMMANDE / PROPOSITION */}
      <AnimatePresence>
        {showOrderModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOrderModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 pb-0 shrink-0">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                    {viewType === 'lead' ? 'Faire une proposition' : (orderMode === 'order' ? 'Lancer une commande' : 'Faire une proposition')}
                  </h3>
                  <button onClick={() => setShowOrderModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                {viewType === 'service' && (
                  <div className="flex p-1.5 bg-slate-100 rounded-[20px] shadow-inner mb-6">
                    <button 
                      onClick={() => setOrderMode('order')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[14px] font-black text-[10px] uppercase tracking-widest transition-all ${orderMode === 'order' ? 'bg-white text-primary shadow-lg scale-100' : 'text-slate-400 hover:text-slate-600 scale-95'}`}
                    >
                      <Zap className="w-4 h-4" />
                      Commander directement
                    </button>
                    <button 
                      onClick={() => setOrderMode('proposal')}
                      className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[14px] font-black text-[10px] uppercase tracking-widest transition-all ${orderMode === 'proposal' ? 'bg-white text-primary shadow-lg scale-100' : 'text-slate-400 hover:text-slate-600 scale-95'}`}
                    >
                      <Handshake className="w-4 h-4" />
                      Proposer un prix
                    </button>
                  </div>
                )}
                
                {viewType === 'lead' && (
                  <div className="mb-6">
                    <p className="text-sm text-slate-500">Proposez votre prix et vos conditions pour cette demande</p>
                  </div>
                )}
              </div>

              <form onSubmit={submitOrder} className="flex-1 overflow-y-auto p-6 pt-2 custom-scrollbar space-y-5">
                
                {viewType === 'lead' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titre de votre proposition</label>
                      <input 
                        type="text"
                        value={orderForm.title}
                        onChange={(e) => setOrderForm({...orderForm, title: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900"
                        placeholder="Ex: Proposition pour votre projet..."
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Message au demandeur</label>
                      <textarea 
                        rows={3}
                        value={orderForm.message}
                        onChange={(e) => setOrderForm({...orderForm, message: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-medium text-slate-900 resize-none text-sm"
                        placeholder={`Bonjour, je suis intéressé par votre demande "${showOrderModal.title}". Je vous propose un budget de ${showOrderModal.price} UC.`}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget (UC)</label>
                        <input 
                          required
                          type="number"
                          value={orderForm.proposedPrice}
                          onChange={(e) => setOrderForm({...orderForm, proposedPrice: parseInt(e.target.value) || 0})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black text-primary text-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Délai (jours)</label>
                        <input 
                          type="number"
                          value={orderForm.deadline}
                          onChange={(e) => setOrderForm({...orderForm, deadline: e.target.value})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Révisions</label>
                        <input 
                          type="number"
                          value={orderForm.revisions}
                          onChange={(e) => setOrderForm({...orderForm, revisions: e.target.value})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Précisions sur votre proposition</label>
                      <textarea 
                        rows={2}
                        value={orderForm.description}
                        onChange={(e) => setOrderForm({...orderForm, description: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-medium text-slate-900 resize-none text-sm"
                        placeholder="Détaillez comment vous allez réaliser cette mission..."
                      />
                    </div>
                  </>
                ) : (
                  orderMode === 'order' ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Titre de la mission</label>
                        <input 
                          type="text"
                          value={orderForm.title}
                          onChange={(e) => setOrderForm({...orderForm, title: e.target.value})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900"
                          placeholder="Ex: Refonte du logo BDE..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cahier des charges / Instructions *</label>
                        <textarea 
                          required
                          rows={4}
                          value={orderForm.description}
                          onChange={(e) => setOrderForm({...orderForm, description: e.target.value})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-medium text-slate-900 resize-none text-sm"
                          placeholder="Décrivez précisément ce que vous attendez..."
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urgence</label>
                        <div className="flex gap-2 p-1 bg-slate-50 border border-slate-100 rounded-2xl">
                          <button 
                            type="button"
                            onClick={() => setOrderForm({...orderForm, urgency: 'normal'})}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${orderForm.urgency === 'normal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}
                          >
                            Normal
                          </button>
                          <button 
                            type="button"
                            onClick={() => setOrderForm({...orderForm, urgency: 'urgent'})}
                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${orderForm.urgency === 'urgent' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-400'}`}
                          >
                            Urgent (+50 UC)
                          </button>
                        </div>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Budget total</p>
                          <p className="text-3xl font-black text-primary">{showOrderModal.price + (orderForm.urgency === 'urgent' ? 50 : 0)} <span className="text-sm">UC</span></p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5" /> Paiement sécurisé
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Votre message</label>
                        <textarea 
                          rows={3}
                          value={orderForm.message}
                          onChange={(e) => setOrderForm({...orderForm, message: e.target.value})}
                          className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-medium text-slate-900 resize-none text-sm"
                          placeholder={`Bonjour, je suis intéressé par votre service "${showOrderModal.title}"...`}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Offre (UC)</label>
                          <input 
                            required
                            type="number"
                            value={orderForm.proposedPrice}
                            onChange={(e) => setOrderForm({...orderForm, proposedPrice: parseInt(e.target.value) || 0})}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-black text-primary text-xl"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Délai (j)</label>
                          <input 
                            type="number"
                            value={orderForm.deadline}
                            onChange={(e) => setOrderForm({...orderForm, deadline: e.target.value})}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Révisions</label>
                          <input 
                            type="number"
                            value={orderForm.revisions}
                            onChange={(e) => setOrderForm({...orderForm, revisions: e.target.value})}
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold"
                          />
                        </div>
                      </div>
                    </>
                  )
                )}

                <div className="space-y-2">
                  <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                  />
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-4 p-4 border-2 border-dashed border-slate-200 rounded-2xl group cursor-pointer hover:border-primary transition-all"
                  >
                    <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-900">Joindre des fichiers</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">PDF, Images, Word, ZIP (max 10 Mo)</p>
                    </div>
                    <Plus className="w-5 h-5 text-slate-300 group-hover:text-primary" />
                  </div>

                  {attachedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachedFiles.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-medium">
                          <span className="truncate max-w-[120px]">{file.name}</span>
                          <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 pb-2">
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''} ${(orderMode === 'order' && viewType === 'service') ? 'bg-primary text-white shadow-primary/20' : 'bg-white border-2 border-primary text-primary'}`}
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : viewType === 'lead' ? (
                      <>
                        <Send className="w-5 h-5" />
                        Envoyer proposition
                      </>
                    ) : orderMode === 'order' ? (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Valider la commande
                      </>
                    ) : (
                      <>
                        <Handshake className="w-5 h-5" />
                        Envoyer proposition
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DÉTAIL DE L'ANNONCE */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-white h-screen flex flex-col shadow-2xl"
            >
              <div className="p-8 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-4">
                  <button onClick={() => setSelectedItem(null)} className="p-2 text-slate-400 hover:text-slate-900 rounded-full hover:bg-slate-50">
                    <X className="w-6 h-6" />
                  </button>
                  <h3 className="text-lg font-black text-slate-900 uppercase">Détail de l'annonce</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      toggleLike(selectedItem.id);
                      setShowCollectionModal(selectedItem.id);
                    }} 
                    className={`p-2 rounded-full border transition-all ${likedItems.has(selectedItem.id) ? 'text-red-500 border-red-100 bg-red-50' : 'text-slate-400 border-slate-100 hover:text-red-500'}`}
                  >
                    <Heart className={`w-5 h-5 ${likedItems.has(selectedItem.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-12 space-y-8 custom-scrollbar">
                <div className="h-64 rounded-3xl overflow-hidden shadow-lg border border-slate-100">
                  <img 
                    src={selectedItem.image_url || (selectedItem.type === 'service' 
                      ? "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?q=80&w=800" 
                      : "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=800"
                    )}
                    className="w-full h-full object-cover" 
                    alt={selectedItem.title}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-[9px] font-black uppercase rounded-lg">
                      {selectedItem.category}
                    </span>
                    {selectedItem.type === 'lead' && selectedItem.status && (
                      <span className={`px-3 py-1 text-[9px] font-black uppercase rounded-lg ${
                        selectedItem.status === 'open' 
                          ? 'bg-green-500/20 text-green-700 border border-green-200' 
                          : 'bg-blue-500/20 text-blue-700 border border-blue-200'
                      }`}>
                        {selectedItem.status === 'open' ? 'OUVERTE' : 'NÉGOCIATION'}
                      </span>
                    )}
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
                    {selectedItem.title}
                  </h2>
                </div>

                <div className="space-y-4 p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-widest px-1 flex items-center gap-2">
                    <Star className="w-3 h-3 fill-current" /> Description
                  </h4>
                  <p className="text-slate-600 leading-relaxed font-medium">
                    {selectedItem.full_description || selectedItem.description}
                  </p>
                </div>

                <div className="flex items-center justify-between p-8 border-2 border-slate-100 rounded-[32px] bg-white shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-primary/10 border-4 border-white shadow-lg overflow-hidden shrink-0">
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${selectedItem.owner_name}`} alt="user" />
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Proposé par</p>
                      <h4 className="text-xl font-black text-slate-900">{selectedItem.owner_name}</h4>
                      <p className="text-[10px] text-slate-500 font-bold">{selectedItem.city || 'Maroc'}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                      <Star className="w-4 h-4 fill-current text-amber-500" />
                      <span className="text-lg font-black text-amber-700">{selectedItem.rating || '4.8'}</span>
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase mt-1">{selectedItem.reviewsCount || 12} avis</span>
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-slate-100 bg-white/80 backdrop-blur-md sticky bottom-0 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Estimation</p>
                  <p className="text-4xl font-black text-primary leading-none mt-1">{selectedItem.price} <span className="text-lg">UC</span></p>
                </div>
                
                {selectedItem.owner_id !== user?.id ? (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => startConversation(selectedItem)}
                      className="px-8 py-5 bg-primary/5 text-primary font-black rounded-2xl hover:bg-primary/10 transition-all flex items-center gap-3 active:scale-95"
                    >
                      <MessageCircle className="w-5 h-5" />
                      Contacter
                    </button>
                    <button 
                      onClick={() => handleOpenOrderModal(selectedItem)}
                      className="px-8 py-5 bg-primary text-white font-black rounded-2xl hover:opacity-90 transition-all flex items-center gap-3 shadow-2xl shadow-primary/20 active:scale-95"
                    >
                      {selectedItem.type === 'lead' ? (
                        <>
                          <Send className="w-5 h-5" />
                          Proposer
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          Commander / Négocier
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-xs font-black text-slate-400 uppercase tracking-widest italic">
                    C'est votre annonce
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* MODALE DE COLLECTION / FAVORIS */}
      <AnimatePresence>
        {showCollectionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCollectionModal(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[40px] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-red-500 fill-current" />
                </div>
                <button onClick={() => setShowCollectionModal(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Ajouter aux favoris</h3>
                  <p className="text-sm text-slate-500 mt-1">Organisez vos coups de cœur dans des collections</p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Choisir une collection</label>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {collections.map(col => (
                      <button
                        key={col.id}
                        onClick={() => {
                          setSelectedCollectionId(col.id);
                          setNewCollectionName('');
                        }}
                        className={`group w-full px-5 py-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${selectedCollectionId === col.id ? 'bg-primary/5 border-primary text-primary' : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200'}`}
                      >
                        <span className="font-bold">{col.name}</span>
                        {selectedCollectionId === col.id && <CheckCircle2 className="w-5 h-5" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative py-2 flex items-center gap-4">
                  <div className="flex-1 h-px bg-slate-100"></div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">OU</span>
                  <div className="flex-1 h-px bg-slate-100"></div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nouvelle collection</label>
                  <div className="relative">
                    <Plus className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Nom de la collection..."
                      value={newCollectionName}
                      onChange={(e) => { 
                        setNewCollectionName(e.target.value); 
                        setSelectedCollectionId(null); 
                      }}
                      className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900 placeholder:text-slate-300 transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={addToCollection}
                    disabled={!selectedCollectionId && !newCollectionName.trim()}
                    className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 active:scale-95"
                  >
                    <Heart className="w-5 h-5 fill-current" />
                    Enregistrer l'annonce
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODALES EXISTANTES */}
      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        targetId={reportTarget?.id || ''}
        targetType={reportTarget?.type || 'service'}
        targetName={reportTarget?.name || ''}
      />
    </div>
  );
}