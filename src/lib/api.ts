// src/lib/api.ts
import { supabase } from './supabase';

// ==================== ORDERS ====================
export async function createOrder(orderData: {
  service_id?: number;
  lead_id?: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  instructions?: string;
}) {
  const { data, error } = await supabase
    .from('orders')
    .insert([{
      service_id: orderData.service_id || null,
      buyer_id: orderData.buyer_id,
      seller_id: orderData.seller_id,
      price: orderData.amount,
      instructions: orderData.instructions || '',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    }])
    .select();

  if (error) {
    console.error('Create order error:', error);
    return { error };
  }
  return { data: data?.[0], error: null };
}

export async function getUserOrders(userId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      service:services (id, title, cover_image, price),
      seller:users!seller_id (id, full_name, email),
      buyer:users!buyer_id (id, full_name, email)
    `)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function updateOrderStatus(orderId: number | string, status: string) {
  const { data, error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date() })
    .eq('id', orderId)
    .select();

  return { data: data?.[0], error };
}

// ==================== PROPOSALS ====================
export async function createProposal(proposalData: {
  service_id?: number;
  lead_id?: string;
  sender_id: string;
  receiver_id: string;
  proposed_price: number;
  message: string;
}) {
  const { data, error } = await supabase
    .from('proposals')
    .insert([{
      service_id: proposalData.service_id || null,
      sender_id: proposalData.sender_id,
      receiver_id: proposalData.receiver_id,
      proposed_price: proposalData.proposed_price,
      message: proposalData.message,
      status: 'pending',
      created_at: new Date()
    }])
    .select();

  if (error) console.error('Create proposal error:', error);
  return { data: data?.[0], error };
}

export async function getUserProposals(userId: string) {
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      *,
      service:services (id, title, cover_image, price),
      sender:users!sender_id (id, full_name, email),
      receiver:users!receiver_id (id, full_name, email)
    `)
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  return { data, error };
}

export async function updateProposalStatus(proposalId: number | string, status: string) {
  const { data, error } = await supabase
    .from('proposals')
    .update({ status })
    .eq('id', proposalId)
    .select();

  return { data: data?.[0], error };
}

// ==================== MESSAGES ====================
export async function getOrCreateConversation(user1Id: string, user2Id: string, context?: { type: 'service' | 'lead'; id: number | string }) {
  // Vérifier si une conversation existe déjà entre ces deux utilisateurs
  const { data: existing } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user1Id);

  if (existing && existing.length > 0) {
    const convIds = existing.map(c => c.conversation_id);
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user2Id)
      .in('conversation_id', convIds);

    if (participants && participants.length > 0) {
      return { conversationId: participants[0].conversation_id, error: null };
    }
  }

  // Créer nouvelle conversation
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .insert([{}])
    .select();

  if (convError) return { error: convError };

  const conversationId = conv[0].id;

  // Ajouter les participants
  const { error: partError } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conversationId, user_id: user1Id },
      { conversation_id: conversationId, user_id: user2Id }
    ]);

  if (partError) return { error: partError };

  return { conversationId, error: null };
}

export async function sendMessage(conversationId: number | string, senderId: string, content: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert([{
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      created_at: new Date()
    }])
    .select();

  return { data: data?.[0], error };
}

export async function getMessages(conversationId: number | string) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      sender:users (id, full_name, avatar_url)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  return { data, error };
}