import React, { useState, useEffect, useRef } from 'react';
import { 
  LifeBuoy, 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ChevronRight, 
  Send, 
  Paperclip, 
  X, 
  User, 
  ShieldAlert,
  ArrowLeft,
  FileText,
  Download,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { generateTicketNumber, Ticket, TicketMessage } from '../lib/support';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Support() {
  const { user } = useAuth();
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Create Ticket Form State
  const [form, setForm] = useState({
    category: '',
    targetUser: '',
    subject: '',
    description: '',
    priority: 'medium' as Ticket['priority']
  });
  const [verifyingUser, setVerifyingUser] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTickets();
  }, [user]);

  useEffect(() => {
    if (view === 'detail' && selectedTicket) {
      fetchMessages(selectedTicket.id);
      
      // Subscribe to real-time updates for this ticket
      const channel = supabase
        .channel(`ticket_${selectedTicket.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${selectedTicket.id}` },
          (payload) => {
            if (payload.new.is_internal) return;
            fetchMessages(selectedTicket.id);
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, [view, selectedTicket]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchTickets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, target_user:users!target_user_id(full_name, avatar_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*, sender:users!sender_id(full_name, avatar_url)')
        .eq('ticket_id', ticketId)
        .eq('is_internal', false)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const handleVerifyUser = async () => {
    if (!form.targetUser) return;
    setVerifyingUser(true);
    setVerifyError(null);
    setVerifiedUser(null);

    try {
      // Check if trying to verify self
      if (form.targetUser.toLowerCase() === user?.email?.toLowerCase() || 
          form.targetUser === user?.id || 
          form.targetUser.toLowerCase() === (user as any)?.full_name?.toLowerCase()) {
        setVerifyError("Vous ne pouvez pas ouvrir un litige contre vous-même.");
        return;
      }

      // Search for user by Name, Email or ID (if UUID)
      let query = supabase
        .from('users')
        .select('id, full_name, avatar_url');

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(form.targetUser);

      if (isUUID) {
        query = query.eq('id', form.targetUser);
      } else {
        query = query.or(`full_name.ilike.%${form.targetUser}%,email.ilike.%${form.targetUser}%`).limit(1);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      if (!data) {
        setVerifyError("Utilisateur inexistant, vérifiez le nom ou l'ID.");
      } else {
        setVerifiedUser(data);
      }
    } catch (err) {
      setVerifyError("Erreur lors de la recherche.");
    } finally {
      setVerifyingUser(false);
    }
  };

  const handleSubmitTicket = async () => {
    if (!form.category || !form.subject || !form.description) return;
    if (form.category === 'litige' && !verifiedUser) return;

    setIsSubmitting(true);
    const ticketNumber = generateTicketNumber();

    try {
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert([{
          ticket_number: ticketNumber,
          user_id: user?.id,
          category: form.category,
          subject: form.subject,
          description: form.description,
          target_user_id: verifiedUser?.id || null,
          priority: form.priority,
          status: 'open'
        }])
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Add initial message
      await supabase.from('support_messages').insert([{
        ticket_id: ticket.id,
        sender_id: user?.id,
        content: form.description,
        is_internal: false
      }]);

      setForm({ category: '', targetUser: '', subject: '', description: '', priority: 'medium' });
      setVerifiedUser(null);
      fetchTickets();
      setView('list');
    } catch (err) {
      console.error('Error creating ticket:', err);
      alert('Erreur lors de la création du ticket.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;
    
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase.from('support_messages').insert([{
        ticket_id: selectedTicket.id,
        sender_id: user?.id,
        content: content,
        is_internal: false
      }]);

      if (error) throw error;
      
      // If status was 'replied', set it back to 'in_progress'
      if (selectedTicket.status === 'replied') {
        await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', selectedTicket.id);
      }

      fetchMessages(selectedTicket.id);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const getStatusColor = (status: Ticket['status']) => {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-600';
      case 'in_progress': return 'bg-amber-100 text-amber-600';
      case 'replied': return 'bg-green-100 text-green-600';
      case 'resolved': return 'bg-slate-100 text-slate-600';
      case 'closed': return 'bg-red-100 text-red-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusLabel = (status: Ticket['status']) => {
    switch (status) {
      case 'open': return 'Ouvert';
      case 'in_progress': return 'En cours';
      case 'replied': return 'Répondu';
      case 'resolved': return 'Résolu';
      case 'closed': return 'Fermé';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          {view !== 'list' && (
            <button 
              onClick={() => {
                setView('list');
                setSelectedTicket(null);
              }}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <LifeBuoy className={cn("w-7 h-7 text-primary", loading && "animate-spin")} />
              {view === 'list' ? 'Support & Assistance' : view === 'create' ? 'Ouvrir un ticket' : `Ticket ${selectedTicket?.ticket_number}`}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {view === 'list' ? 'Nous sommes là pour vous aider' : 'Décrivez votre problème en détail'}
            </p>
          </div>
        </div>
        
        {view === 'list' && (
          <button 
            onClick={() => setView('create')}
            className="px-5 py-3 bg-slate-900 text-white rounded-2xl flex items-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 text-xs font-black uppercase tracking-widest"
          >
            <Plus className="w-5 h-5" />
            Ouvrir un ticket
          </button>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        <AnimatePresence mode="wait">
          {/* 1. LISTE DES TICKETS */}
          {view === 'list' && (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/50"
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                  <p className="text-xs font-black text-slate-400 uppercase">Chargement de vos dossiers...</p>
                </div>
              ) : tickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center">
                  <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center mb-6">
                    <MessageSquare className="w-10 h-10 text-slate-300" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2">Aucun ticket ouvert</h3>
                  <p className="text-sm text-slate-500 max-w-sm mb-8">
                    Vous n'avez pas encore ouvert de ticket de support. Si vous rencontrez un problème, notre équipe est là pour vous.
                  </p>
                  <button 
                    onClick={() => setView('create')}
                    className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                  >
                    Créer mon premier ticket
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tickets.map((ticket) => (
                    <button 
                      key={ticket.id}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setView('detail');
                      }}
                      className="group p-6 bg-white border-2 border-slate-100 rounded-[32px] hover:border-primary/50 hover:shadow-2xl hover:shadow-primary/5 transition-all text-left flex flex-col h-full relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span className={cn("px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest", getStatusColor(ticket.status))}>
                          {getStatusLabel(ticket.status)}
                        </span>
                        <span className="text-[10px] font-black text-slate-400 uppercase">{new Date(ticket.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      <h4 className="text-lg font-black text-slate-900 mb-2 line-clamp-1 group-hover:text-primary transition-colors">{ticket.subject}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-6 font-medium leading-relaxed">{ticket.description}</p>
                      
                      <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400">
                            {ticket.category[0].toUpperCase()}
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{ticket.ticket_number}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-all" />
                      </div>
                      
                      {ticket.status === 'replied' && (
                        <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 flex items-center justify-center rounded-bl-3xl">
                          <div className="w-3 h-3 bg-primary rounded-full animate-ping" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* 2. FORMULAIRE DE CRÉATION */}
          {view === 'create' && (
            <motion.div 
              key="create"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex-1 overflow-y-auto p-6"
            >
              <div className="max-w-2xl mx-auto bg-white border border-slate-100 rounded-[40px] shadow-2xl shadow-slate-100 overflow-hidden">
                <div className="p-8 space-y-8">
                  {/* Étape 1 : Motif */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Quel est le motif de votre demande ?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: 'litige', label: 'Litige avec un utilisateur', icon: ShieldAlert },
                        { id: 'comportement', label: 'Signalement comportement', icon: AlertCircle },
                        { id: 'technique', label: 'Problème technique', icon: LifeBuoy },
                        { id: 'administratif', label: 'Question administrative', icon: FileText },
                        { id: 'general', label: 'Réclamation générale', icon: MessageSquare }
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setForm({ ...form, category: cat.id as any })}
                          className={cn(
                            "p-4 rounded-2xl border transition-all text-left flex items-center gap-3",
                            form.category === cat.id 
                              ? "bg-primary/5 border-primary text-primary" 
                              : "border-slate-100 hover:border-slate-200 text-slate-600"
                          )}
                        >
                          <cat.icon className="w-5 h-5" />
                          <span className="text-xs font-black uppercase tracking-tighter">{cat.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Étape 2 : Utilisateur cible (si litige) */}
                  <AnimatePresence>
                    {form.category === 'litige' && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 overflow-hidden"
                      >
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Utilisateur concerné</label>
                        <div className="flex gap-3">
                          <div className="relative flex-1">
                            <input 
                              type="text" 
                              placeholder="Nom d'utilisateur ou ID"
                              value={form.targetUser}
                              onChange={(e) => {
                                setForm({ ...form, targetUser: e.target.value });
                                setVerifiedUser(null);
                                setVerifyError(null);
                              }}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                            {verifiedUser && (
                              <CheckCircle2 className="w-5 h-5 text-green-500 absolute right-4 top-1/2 -translate-y-1/2" />
                            )}
                          </div>
                          <button 
                            onClick={handleVerifyUser}
                            disabled={!form.targetUser || verifyingUser}
                            className="px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-black transition-all"
                          >
                            {verifyingUser ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Vérifier'}
                          </button>
                        </div>
                        {verifyError && <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">{verifyError}</p>}
                        {verifiedUser && (
                          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-100">
                            <div className="w-10 h-10 rounded-xl bg-white overflow-hidden p-1">
                              <img src={verifiedUser.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${verifiedUser.id}`} className="w-full h-full object-cover rounded-lg" />
                            </div>
                            <div>
                              <p className="text-xs font-black text-green-700 uppercase">Utilisateur trouvé</p>
                              <p className="text-sm font-black text-slate-900">{verifiedUser.full_name}</p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Étape 3 : Sujet & Description */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Détails du ticket</label>
                    <input 
                      type="text" 
                      placeholder="Sujet de votre demande"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-black text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <textarea 
                      placeholder="Décrivez précisément votre problème ou votre demande..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[150px] resize-none"
                    />
                  </div>

                  {/* Étape 4 : Priorité */}
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Priorité estimée</label>
                    <div className="flex gap-2">
                      {['low', 'medium', 'high', 'urgent'].map((p) => (
                        <button
                          key={p}
                          onClick={() => setForm({ ...form, priority: p as any })}
                          className={cn(
                            "flex-1 py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                            form.priority === p 
                              ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                              : "border-slate-100 text-slate-400 hover:bg-slate-50"
                          )}
                        >
                          {p === 'low' ? 'Basse' : p === 'medium' ? 'Normale' : p === 'high' ? 'Haute' : 'Urgent'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setView('list')}
                      className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-600 transition-colors"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={handleSubmitTicket}
                      disabled={!form.category || !form.subject || !form.description || (form.category === 'litige' && !verifiedUser) || isSubmitting}
                      className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 disabled:opacity-50 hover:scale-105 transition-transform"
                    >
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Ouvrir le ticket'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 3. DÉTAIL DU TICKET (CONVERSATION) */}
          {view === 'detail' && selectedTicket && (
            <motion.div 
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden bg-slate-50"
            >
              {/* Infos Sidebar (Desktop) / Dropdown (Mobile) */}
              <div className="bg-white border-b border-slate-100 p-4 px-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 overflow-hidden">
                  <div className={cn("px-3 py-1.5 rounded-full text-[10px] font-black uppercase shrink-0", getStatusColor(selectedTicket.status))}>
                    {getStatusLabel(selectedTicket.status)}
                  </div>
                  <h3 className="font-black text-slate-900 truncate">{selectedTicket.subject}</h3>
                </div>
                {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' && (
                  <button 
                    onClick={async () => {
                      if (confirm('Voulez-vous vraiment clore ce ticket ?')) {
                        await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', selectedTicket.id);
                        fetchTickets();
                        setView('list');
                      }
                    }}
                    className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-[10px] font-black uppercase transition-all"
                  >
                    Marquer Résolu
                  </button>
                )}
              </div>

              {/* Chat Area */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6"
              >
                {/* Fil de discussion */}
                {messages.map((msg, idx) => (
                  <div key={msg.id} className={cn("flex gap-4", msg.sender_id === user?.id ? "flex-row-reverse" : "flex-row")}>
                    <div className={cn(
                      "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0",
                      msg.sender_id === user?.id ? "bg-slate-900 text-white" : "bg-primary/10 text-primary shadow-inner"
                    )}>
                      {msg.sender_id === user?.id ? <User className="w-5 h-5" /> : <LifeBuoy className="w-5 h-5" />}
                    </div>
                    <div className={cn("max-w-[80%] space-y-1", msg.sender_id === user?.id ? "text-right" : "text-left")}>
                      <div className={cn(
                        "p-4 rounded-3xl shadow-sm border",
                        msg.sender_id === user?.id 
                          ? "bg-slate-900 text-white border-slate-900 rounded-tr-none" 
                          : "bg-white text-slate-700 border-slate-100 rounded-tl-none"
                      )}>
                        {idx === 0 && (
                          <p className="text-[9px] font-black uppercase mb-1 tracking-widest opacity-50">Description initiale</p>
                        )}
                        <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              {selectedTicket.status !== 'closed' && selectedTicket.status !== 'resolved' ? (
                <div className="p-6 bg-white border-t border-slate-100">
                  <div className="relative flex items-end gap-3 max-w-4xl mx-auto">
                    <div className="flex-1 bg-slate-50 border border-slate-100 rounded-[24px] flex flex-col p-2 min-h-[56px] focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                      <textarea
                        placeholder="Tapez votre message ici..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="bg-transparent border-none outline-none p-2 px-3 text-sm font-bold resize-none min-h-[40px] max-h-32"
                      />
                      <div className="flex items-center justify-between p-1 px-2 border-t border-slate-100 mt-1">
                        <button className="p-2 text-slate-400 hover:text-primary transition-colors">
                          <Paperclip className="w-5 h-5" />
                        </button>
                        <span className="text-[10px] font-black text-slate-300 uppercase">Appuyez sur Entrée pour envoyer</span>
                      </div>
                    </div>
                    <button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                    >
                      <Send className="w-6 h-6" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 bg-white border-t border-slate-100 text-center">
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Ce ticket est clôturé. Vous ne pouvez plus envoyer de messages.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
