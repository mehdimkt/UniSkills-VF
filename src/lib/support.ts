import { supabase } from './supabase';

export interface Ticket {
  id: string;
  ticket_number: string;
  user_id: string;
  category: 'litige' | 'comportement' | 'technique' | 'administratif' | 'general';
  subject: string;
  description: string;
  target_user_id?: string;
  status: 'open' | 'in_progress' | 'replied' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_agent_id?: string;
  created_at: string;
  updated_at: string;
  user?: any;
  target_user?: any;
  agent?: any;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  sender?: any;
}

export const generateTicketNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TICK-${date}-${random}`;
};

export const fetchUserTickets = async (userId: string) => {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*, target_user:users!target_user_id(full_name, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
};

export const fetchTicketMessages = async (ticketId: string) => {
  const { data, error } = await supabase
    .from('support_messages')
    .select('*, sender:users!sender_id(full_name, avatar_url)')
    .eq('ticket_id', ticketId)
    .eq('is_internal', false)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data;
};

export const verifyUser = async (identifier: string) => {
  // identifier can be name or ID
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, avatar_url')
    .or(`full_name.ilike.%${identifier}%,id.eq.${identifier}`)
    .maybeSingle();
  
  if (error) return { error: 'Erreur lors de la recherche' };
  if (!data) return { error: 'Utilisateur inexistant, vérifiez le nom ou l\'ID' };
  
  return { user: data };
};
