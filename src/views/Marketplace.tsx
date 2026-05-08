import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Filter, Star as StarIcon, Heart, MapPin, Clock, Upload,
  MessageCircle, Send, Zap, X, CheckCircle2, Plus, Handshake,
  Shield, Paperclip, Loader2, ArrowLeft, User, GraduationCap,
  BookOpen, Award, RotateCw, Timer, Calendar, FileText,
  TrendingUp, Eye, Sparkles, FolderHeart, Check, Download,
  SlidersHorizontal, Tag, DollarSign, AlertCircle, ArrowRight
} from 'lucide-react';
import { UserProfileModal } from '../components/UserProfileModal';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notifications';

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

async function fetchMarketplaceItems(role: string, currentUserId: string) {
  if (role === 'aideur') {
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
      type: 'lead',
      delivery_time: null,
      revision_ceiling: null,
      cancellation_delay: null,
      rating: null,
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
      type: 'service'
    }));
  }
}

export default function Marketplace({ onNavigate, initialData }: { onNavigate?: (view: string, context?: any) => void, initialData?: any }) {
  const { role, user } = useAuth();
  const isAideur = role === 'aideur';
  const currentMode = isAideur ? 'aideur' : 'demandeur';

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toutes catégories');
  const [maxPrice, setMaxPrice] = useState(2000);
  const [minRating, setMinRating] = useState(0);
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [selectedItemReviews, setSelectedItemReviews] = useState<any[]>([]);
  const [showProposalModal, setShowProposalModal] = useState<MarketplaceItem | null>(null);
  const [proposalForm, setProposalForm] = useState({
    budget: 0,
    message: '',
    deliveryDays: 7,
    revisionLimit: 2,
    cancellationDelay: '24',
    files: [] as File[]
  });
  const [isSendingProposal, setIsSendingProposal] = useState(false);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proposalFileInputRef = useRef<HTMLInputElement>(null);
  const [orderForm, setOrderForm] = useState({
    message: '',
    description: '',
    urgency: 'normal',
    proposedPrice: 0,
    deadlineDays: 7,
    revisionLimit: 2,
    cancellationDelay: '24'
  });

  const categories = isAideur
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
      setLoading(true);
      const data = await fetchMarketplaceItems(role, user.id);
      setItems(data);
      setLoading(false);
    };
    loadItems();
  }, [role, user]);

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

      if (isAideur) {
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
    if (!user || item.owner_id === user.id) {
      if (item.owner_id === user.id) alert("Vous ne pouvez pas contacter votre propre annonce");
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
      message: '',
      description: '',
      urgency: 'normal',
      proposedPrice: item.price,
      deadlineDays: item.delivery_time || 7,
      revisionLimit: item.revision_ceiling || 2,
      cancellationDelay: item.cancellation_delay ? parseInt(item.cancellation_delay).toString() : '24'
    });
    setOrderMode(isAideur ? 'proposal' : 'order');
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
        await supabase.from('unicoin_transactions').insert({ wallet_id: walletData.id, amount: -finalPrice, type: 'hold', status: 'pending', description: `Fonds bloqués pour commande ${showOrderModal.title}`, created_at: new Date().toISOString() });
        const expiresAt = new Date(); expiresAt.setHours(expiresAt.getHours() + 48);
        const deliveryDeadline = new Date(); deliveryDeadline.setDate(deliveryDeadline.getDate() + orderForm.deadlineDays);
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
          files: uploadedFiles, delivery_days: orderForm.deadlineDays,
          revision_limit: orderForm.revisionLimit, cancellation_delay: orderForm.cancellationDelay
        });
        if (error) throw error;
        await sendNotification(showOrderModal.owner_id!, '📝 Nouvelle proposition', `${user.first_name} ${user.last_name} vous a proposé ${finalPrice} UC pour "${showOrderModal.title}"`, 'proposal', 'proposals', { service_id: showOrderModal.type === 'service' ? showOrderModal.id : null, lead_id: showOrderModal.type === 'lead' ? showOrderModal.id : null, budget: finalPrice });
        const { conversationId } = await getOrCreateConversation(user.id, showOrderModal.owner_id!);
        if (conversationId) await sendMessage(conversationId, user.id, showOrderModal.owner_id!, `Proposition envoyée: ${finalPrice} UC - Délai: ${orderForm.deadlineDays}j`);
        setShowOrderModal(null);
        onNavigate?.('proposals');
      }
    } catch (err) { console.error(err); alert('Une erreur est survenue'); }
    finally { setIsSubmitting(false); setUploadingFiles(false); }
  };

  const handleMakeProposal = async (item: MarketplaceItem) => {
    if (!user || item.owner_id === user.id) {
      alert("Vous ne pouvez pas vous proposer à vous-même");
      return;
    }

    setIsSendingProposal(true);

    try {
      const uploadedFiles: { name: string; url: string }[] = [];
      for (const file of proposalForm.files) {
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

      const proposalData = {
        lead_id: item.type === 'lead' ? item.id : null,
        service_id: item.type === 'service' ? item.id : null,
        sender_id: user.id,
        receiver_id: item.owner_id!,
        budget: proposalForm.budget,
        content: proposalForm.message,
        files: uploadedFiles,
        delivery_days: proposalForm.deliveryDays,
        revision_limit: proposalForm.revisionLimit,
        cancellation_delay: proposalForm.cancellationDelay,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const response = await fetch('/api/marketplace/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposalData)
      });

      if (response.ok) {
        await sendNotification(
          item.owner_id!,
          '📝 Nouvelle proposition',
          `${user.first_name} ${user.last_name} a fait une proposition pour "${item.title}" (${proposalForm.budget} UC)`,
          'proposal',
          'proposals'
        );

        alert(`✅ Proposition envoyée à ${item.owner_name}!`);
        setShowProposalModal(null);
        setProposalForm({ budget: 0, message: '', deliveryDays: 7, revisionLimit: 2, cancellationDelay: '24', files: [] });
        onNavigate?.('proposals');
      } else {
        throw new Error('Erreur lors de l\'envoi');
      }
    } catch (err) {
      console.error('Error making proposal:', err);
      alert('Erreur lors de l\'envoi de la proposition');
    } finally {
      setIsSendingProposal(false);
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-20">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border-b border-primary/10">
        <div className="max-w-7xl mx-auto px-4 py-8 lg:py-12">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-3">
              {isAideur ? 'Trouvez des missions' : 'Découvrez des talents'}
            </h1>
            <p className="text-slate-500 mb-6">
              {isAideur ? 'Des étudiants ont besoin de votre aide. Proposez vos compétences et gagnez des UniCoins.' : 'Parcourez les services proposés par la communauté étudiante.'}
            </p>
            <div className="relative max-w-2xl mx-auto">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={isAideur ? "Rechercher une mission..." : "Rechercher un service..."} className="w-full pl-14 pr-24 py-3.5 bg-white border border-slate-200 rounded-2xl shadow-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none" />
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
                {!isAideur && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><StarIcon className="w-3 h-3 fill-current" /> Note minimum</label>
                    <div className="flex gap-1 p-1 bg-slate-50 rounded-xl border border-slate-200">
                      {[1, 2, 3, 4, 5].map(star => (<button key={star} onClick={() => setMinRating(minRating === star ? 0 : star)} className={`flex-1 py-2 flex items-center justify-center rounded-lg transition-all ${minRating >= star ? 'text-secondary' : 'text-slate-300'}`}><StarIcon className={`w-4 h-4 ${minRating >= star ? 'fill-current' : ''}`} /></button>))}
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

              {isAideur && (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-6 mt-6 pt-6 border-t border-slate-100">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3 h-3" /> Délai de candidature maximum</label>
                    <select value={maxDeadlineDays || ''} onChange={(e) => setMaxDeadlineDays(e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-primary">
                      {deadlineOptions.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  </div>
                </div>
              )}

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
              const itemType = item.type || (isAideur ? 'lead' : 'service');
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
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
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
                  </div>

                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-black rounded-full uppercase tracking-wider border border-primary/10">
                        {item.category}
                      </span>
                      {isAideur && item.status && (
                        <span className={`px-2.5 py-1 text-[9px] font-black rounded-full uppercase tracking-tighter shadow-sm ${item.status === 'open' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
                          {item.status === 'open' ? 'Ouvert' : 'Négociation'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-100 flex items-center justify-center overflow-hidden">
                        {item.owner_avatar ? <img src={item.owner_avatar} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-slate-400" />}
                      </div>
                      <span className="text-[10px] font-black text-slate-500 truncate uppercase tracking-tight opacity-70">{item.owner_name}</span>
                      {!isAideur && item.rating && (
                        <div className="flex items-center gap-1 ml-auto bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                          <StarIcon className="w-2.5 h-2.5 fill-current text-amber-500" />
                          <span className="text-[10px] font-black text-amber-700">{item.rating}</span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-base font-black text-slate-900 line-clamp-1 mb-2 group-hover:text-primary transition-colors duration-300">{item.title}</h3>

                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed opacity-80 italic">
                      {item.short_description || (item.description ? item.description.substring(0, 80) + '...' : 'Aucune description')}
                    </p>

                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 mb-6 flex-wrap">
                      {item.city && (<div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><MapPin className="w-3 h-3 text-slate-400" /><span>{item.city}</span></div>)}
                      <div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><Clock className="w-3 h-3 text-slate-400" />{isAideur ? (item.deadline || 'Flexible') : `${item.delivery_time || 3}j`}</div>
                      {item.revision_ceiling && (<div className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg"><RotateCw className="w-3 h-3 text-slate-400" /><span>{item.revision_ceiling} révisions</span></div>)}
                    </div>

                    <div className="flex items-end justify-between pt-4 border-t border-slate-50">
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5 opacity-60">À partir de</p>
                        <p className="text-2xl font-black text-primary tracking-tighter">{item.price} <span className="text-xs font-bold text-slate-400">UC</span></p>
                      </div>
                      <div className="flex gap-2">
                        {!isMyItem ? (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => { e.stopPropagation(); startConversation(item); }}
                              className="p-3 bg-slate-50 text-slate-500 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all shadow-sm border border-slate-100"
                            >
                              <MessageCircle className="w-5 h-5" />
                            </motion.button>
                            <motion.button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (itemType === 'lead') {
                                  setShowProposalModal(item);
                                  setProposalForm({
                                    budget: item.price,
                                    message: '',
                                    deliveryDays: 7,
                                    revisionLimit: 2,
                                    cancellationDelay: '24',
                                    files: []
                                  });
                                } else {
                                  handleOpenOrderModal(item);
                                }
                              }}
                              className="px-6 py-3 text-white text-xs font-black rounded-2xl transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                              style={{ backgroundColor: '#FF385C' }}
                            >
                              {itemType === 'lead' ? <Send className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                              {itemType === 'lead' ? 'PROPOSER' : 'COMMANDER'}
                            </motion.button>
                          </>
                        ) : (
                          <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-100">Votre annonce</div>
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

      {/* MODALES - à conserver telles quelles, juste une fois */}
      {/* ... (conservez toutes vos modales ici, mais UNE SEULE FOIS) ... */}
    </div>
  );
}