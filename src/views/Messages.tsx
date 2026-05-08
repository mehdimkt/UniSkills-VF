// src/views/Messages.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  X,
  User,
  MessageSquare,
  FileText,
  Loader2,
  MapPin,
  GraduationCap,
  Download,
  Trash2,
  ExternalLink,
  Pin,
  ShieldBan,
  Flag,
  Check,
  CheckCheck,
  Clock,
  Edit2,
  Reply as ReplyIcon,
  AlertCircle,
  Image as ImageIcon,
  File as FileIcon,
  Info,
  ChevronLeft,
  Star,
  Award,
  BookOpen,
  FolderHeart,
  Briefcase,
  Smile,
  Eye,
  ShoppingBag,
  Zap,
  Heart
} from 'lucide-react';
import { UserProfileModal } from '../components/UserProfileModal';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notifications';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ✅ Ajoutez cette fonction cn
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Helper pour déterminer le type de message
function getMessageType(msg: any): 'text' | 'image' | 'file' {
  if (!msg.file_url) return 'text';
  if (msg.content?.startsWith('📷')) return 'image';
  if (msg.content?.startsWith('📎')) return 'file';
  const isImageExt = /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.file_url);
  return isImageExt ? 'image' : 'file';
}

// Types
interface Attachment {
  url: string;
  name: string;
  type: string;
  size?: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  status: 'sending' | 'sent' | 'delivered' | 'seen' | 'failed';
  edited: boolean;
  deleted: boolean;
  file_url?: string;
  file_name?: string;
  reply_to_message_id?: string;
  created_at: string;
  updated_at: string;
}

interface Conversation {
  id: string;
  participants: string[];
  otherUser: any;
  lastMessage?: string;
  lastMessageAt?: string;
  lastMessageStatus?: string;
  unreadCount: number;
  pinned: boolean;
  blocked: boolean;
  relatedType?: 'service' | 'lead' | 'order' | 'proposal';
  relatedId?: string;
  relatedItem?: any;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  bio?: string;
  city?: string;
  university?: string;
  level?: string;
  rating?: number;
  skills?: string[];
  projects_completed?: number;
  reviews_count?: number;
}

interface ContextItem {
  id: string;
  title: string;
  price: number;
  image_url?: string;
  type: 'service' | 'lead' | 'order' | 'proposal';
  status?: string;
}

// Helper functions
const formatTime = (dateStr: string) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = diff / (1000 * 60 * 60);

  if (hours < 1) return 'À l\'instant';
  if (hours < 24) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (hours < 48) return 'Hier';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const Avatar = ({ name, url, size = 'md', online = false, onClick }: {
  name: string;
  url?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  online?: boolean;
  onClick?: () => void
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-[10px]',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-24 h-24 text-2xl'
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={onClick}
        className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center font-bold text-white transition-transform hover:scale-105 ${!url ? 'bg-gradient-to-br from-primary to-pink-500' : ''
          }`}
      >
        {url ? (
          <img src={url} className="w-full h-full object-cover" alt={name} />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </button>
      {size !== 'sm' && (
        <div className={`absolute bottom-0.5 right-0.5 w-3 h-3 border-2 border-white rounded-full shadow-sm ${online ? 'bg-green-500' : 'bg-red-500'
          }`} />
      )}
    </div>
  );
};

const MessageStatusIcon = ({ status }: { status: Message['status'] }) => {
  switch (status) {
    case 'sending': return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    case 'sent': return <Check className="w-3.5 h-3.5 text-slate-400" />;
    case 'delivered': return <CheckCheck className="w-3.5 h-3.5 text-slate-400" />;
    case 'seen': return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
    case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
    default: return null;
  }
};

// Composant Principal
export default function Messages({ inquiryContext, onNavigate, onClearContext }: {
  inquiryContext?: any;
  onNavigate?: (view: string, ctx?: any) => void;
  onClearContext?: () => void;
}) {
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesState, setMessagesState] = useState<Record<string, Message[]>>({}); // ✅ Séparé pour plus de robustesse
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [showProfileId, setShowProfileId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [presence, setPresence] = useState<Record<string, any>>({});
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [uploadType, setUploadType] = useState<'photo' | 'file'>('file');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [contextItem, setContextItem] = useState<ContextItem | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const selectedConv = conversations.find(c => c.id === selectedConvId);
  const isBlocked = selectedConv?.blocked || false;

  const emojis = ['😊', '😂', '🥰', '😎', '🤔', '👍', '🔥', '❤️', '✨', '🙌', '🎉', '👋', '😭', '😮', '💪', '💯', '🚀', '⭐', '🎨', '📚'];
  const stickers = ['🎯', '🚀', '⭐', '💎', '🎨', '📚', '💡', '🤝', '🔥', '💯', '✨', '🌟', '💪', '🎉', '🎈', '🏆', '🥇', '💎', '🔮', '🎪'];

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConv?.messages]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (partError) throw partError;

      if (!participations || participations.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const convIds = participations.map(p => p.conversation_id);

      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', convIds)
        .order('created_at', { ascending: false });

      if (convError) throw convError;

      if (!convs || convs.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const convList: Conversation[] = [];

      for (const conv of convs) {
        try {
          const { data: parts } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.id)
            .neq('user_id', user.id);

          const otherUserId = parts?.[0]?.user_id;
          if (!otherUserId) continue;

          const { data: otherUser } = await supabase
            .from('users')
            .select('id, first_name, last_name, full_name, email, avatar_url, city, university, level, bio')
            .eq('id', otherUserId)
            .maybeSingle();

          const { data: lastMsg } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .neq('status', 'seen');

          convList.push({
            id: conv.id,
            participants: conv.participants || [user.id, otherUserId],
            otherUser: otherUser || { id: otherUserId, full_name: 'Utilisateur' },
            lastMessage: lastMsg?.[0]?.content || 'Nouvelle conversation',
            lastMessageAt: lastMsg?.[0]?.created_at || conv.created_at,
            lastMessageStatus: lastMsg?.[0]?.sender_id === user.id ? lastMsg?.[0]?.status : undefined,
            unreadCount: unreadCount || 0,
            pinned: conv.pinned_by?.includes(user.id) || false,
            blocked: conv.blocked_by?.includes(user.id) || false,
            relatedType: conv.related_type,
            relatedId: conv.related_id,
            created_at: conv.created_at,
            updated_at: conv.updated_at || conv.created_at
          });
        } catch (err) {
          console.error(`Error processing conversation ${conv.id}:`, err);
        }
      }

      setConversations(convList);

      if (inquiryContext?.owner_id && !selectedConvId) {
        const existingConv = convList.find(c => c.otherUser?.id === inquiryContext.owner_id);
        if (existingConv) {
          setSelectedConvId(existingConv.id);
        } else {
          const { data: newConv, error: createError } = await supabase
            .from('conversations')
            .insert([{
              participants: [user.id, inquiryContext.owner_id],
              created_at: new Date().toISOString()
            }])
            .select()
            .single();

          if (createError) {
            console.error('Error creating conversation:', createError);
          } else if (newConv) {
            await supabase.from('conversation_participants').insert([
              { conversation_id: newConv.id, user_id: user.id },
              { conversation_id: newConv.id, user_id: inquiryContext.owner_id }
            ]);

            if (inquiryContext.id && inquiryContext.type) {
              await supabase
                .from('conversations')
                .update({
                  related_type: inquiryContext.type,
                  related_id: inquiryContext.id
                })
                .eq('id', newConv.id);
            }

            setSelectedConvId(newConv.id);
            await loadConversations();
          }
        }
      }

    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [user, inquiryContext, selectedConvId]);

  const loadMessages = useCallback(async (convId: string) => {
    if (!convId) return [];

    try {
      const { data: messages } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (messages) {
        const unreadIds = messages.filter(m => m.sender_id !== user?.id && (!m.status || m.status !== 'seen')).map(m => m.id);
        if (unreadIds.length > 0) {
          await supabase
            .from('messages')
            .update({ status: 'seen' })
            .in('id', unreadIds);
        }

        const formatted = messages.map((m: any) => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          content: m.deleted ? 'Ce message a été supprimé' : m.content,
          status: m.status || 'sent',
          edited: m.edited || false,
          deleted: m.deleted || false,
          file_url: m.file_url,
          file_name: m.file_name,
          reply_to_message_id: m.reply_to_message_id,
          created_at: m.created_at,
          updated_at: m.updated_at || m.created_at
        }));

        setMessagesState(prev => ({ ...prev, [convId]: formatted }));
        return formatted;
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
    return [];
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedConvId) {
      const fetchAndSetMessages = async () => {
        await loadMessages(selectedConvId);
        
        // Mettre à jour l'unread count localement
        setConversations(prev => prev.map(c => 
          c.id === selectedConvId ? { ...c, unreadCount: 0 } : c
        ));

        const conv = conversations.find(c => c.id === selectedConvId);
        if (conv?.relatedItem) {
          setContextItem(conv.relatedItem);
        } else {
          setContextItem(null);
        }

        if (window.innerWidth < 1024) setMobileView('chat');
      };
      fetchAndSetMessages();
    }
  }, [selectedConvId, loadMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`conv-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
        const newMsg = payload.new as any;

        setConversations(prev => {
          const convIndex = prev.findIndex(c => c.id === newMsg.conversation_id);

          if (convIndex !== -1) {
            const updated = [...prev];
            const conv = updated[convIndex];
            
            const isUnread = newMsg.sender_id !== user.id && selectedConvId !== conv.id;

            updated[convIndex] = {
              ...conv,
              lastMessage: newMsg.content,
              lastMessageAt: newMsg.created_at,
              unreadCount: isUnread ? (conv.unreadCount || 0) + 1 : conv.unreadCount
            };
            return updated;
          }
          return prev;
        });

          // Mettre à jour les messages séparément
          setMessagesState(prev => {
            const currentMessages = prev[newMsg.conversation_id] || [];
            if (!currentMessages.some(m => m.id === newMsg.id)) {
              return {
                ...prev,
                [newMsg.conversation_id]: [...currentMessages, {
                  id: newMsg.id,
                  conversationId: newMsg.conversation_id,
                  senderId: newMsg.sender_id,
                  content: newMsg.deleted ? 'Ce message a été supprimé' : newMsg.content,
                  status: newMsg.status || 'sent',
                  edited: newMsg.edited || false,
                  deleted: newMsg.deleted || false,
                  file_url: newMsg.file_url,
                  file_name: newMsg.file_name,
                  reply_to_message_id: newMsg.reply_to_message_id,
                  created_at: newMsg.created_at,
                  updated_at: newMsg.updated_at || newMsg.created_at
                }]
              };
            }
            return prev;
          });

        if (newMsg.sender_id !== user.id && selectedConvId !== newMsg.conversation_id) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
          audio.play().catch(() => { });
        }

        if (newMsg.conversation_id === selectedConvId && newMsg.sender_id !== user.id) {
          await supabase
            .from('messages')
            .update({ status: 'seen' })
            .eq('id', newMsg.id);

          setConversations(prev => prev.map(c =>
            c.id === selectedConvId ? { ...c, unreadCount: 0 } : c
          ));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updatedMsg = payload.new as any;
        setMessagesState(prev => {
          const current = prev[updatedMsg.conversation_id] || [];
          return {
            ...prev,
            [updatedMsg.conversation_id]: current.map(m => m.id === updatedMsg.id ? {
              ...m,
              status: updatedMsg.status,
              edited: updatedMsg.edited,
              deleted: updatedMsg.deleted,
              content: updatedMsg.deleted ? 'Ce message a été supprimé' : updatedMsg.content
            } : m)
          };
        });
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, isTyping } = payload.payload;
        if (userId !== user.id) {
          setTyping(prev => ({ ...prev, [userId]: isTyping }));
        }
      })
      .subscribe();

    const presenceChannel = supabase.channel(`presence-${user.id}`);
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = new Set<string>();
        Object.values(state).forEach((pres: any) => {
          pres.forEach((p: any) => {
            if (p.user_id) online.add(p.user_id);
          });
        });
        setOnlineUsers(online);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.id, online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
      presenceChannel.unsubscribe();
    };
  }, [user, selectedConvId]);

  const sendMessage = async () => {
    if ((!newMessage.trim() && !uploadingFile) || !selectedConvId || !user || isBlocked) return;

    const tempId = crypto.randomUUID();
    const messageContent = newMessage.trim();

    const optimisticMsg: Message = {
      id: tempId,
      conversationId: selectedConvId,
      senderId: user.id,
      content: messageContent,
      status: 'sending',
      edited: false,
      deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setMessagesState(prev => {
      const current = prev[selectedConvId] || [];
      return { ...prev, [selectedConvId]: [...current, optimisticMsg] };
    });
    
    setConversations(prev => prev.map(c =>
      c.id === selectedConvId ? {
        ...c,
        lastMessage: messageContent,
        lastMessageAt: optimisticMsg.created_at
      } : c
    ));
    setNewMessage('');
    setReplyingTo(null);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: selectedConvId,
          sender_id: user.id,
          content: messageContent,
          status: 'sent',
          reply_to_message_id: replyingTo?.id,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      setMessagesState(prev => {
        const current = prev[selectedConvId] || [];
        return {
          ...prev,
          [selectedConvId]: current.map(m => m.id === tempId ? { ...m, id: data.id, status: 'sent' } : m)
        };
      });

      await supabase
        .from('conversations')
        .update({
          last_message: messageContent,
          last_message_at: new Date().toISOString()
        })
        .eq('id', selectedConvId);

      const recipientId = selectedConv?.otherUser?.id;
      if (recipientId) {
        await sendNotification(
          recipientId,
          '💬 Nouveau message',
          `${user.first_name} vous a envoyé un message`,
          'message',
          'messages',
          { conversation_id: selectedConvId }
        );
      }

    } catch (err) {
      console.error('Error sending message:', err);
      setConversations(prev => prev.map(c =>
        c.id === selectedConvId ? {
          ...c,
          messages: c.messages?.map(m => m.id === tempId ? { ...m, status: 'failed' } : m)
        } : c
      ));
    }
  };

  // ✅ VERSION CORRIGÉE - Suppression de la vérification du bucket
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConvId || !user || isBlocked) return;

    setUploadingFile(true);
    const isImage = file.type.startsWith('image/');
    setUploadType(isImage ? 'photo' : 'file');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      const bucket = isImage ? 'images' : 'documents';
      const filePath = `messaging/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const messageContent = isImage ? '📷 Photo' : `📎 ${file.name}`;

      const { data: newMsg, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConvId,
          sender_id: user.id,
          content: messageContent,
          file_url: urlData.publicUrl,
          file_name: file.name,
          status: 'sent',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Mettre à jour la conversation
      await supabase
        .from('conversations')
        .update({
          last_message: messageContent,
          last_message_at: new Date().toISOString()
        })
        .eq('id', selectedConvId);

      // Notification
      const recipientId = selectedConv?.otherUser?.id;
      if (recipientId) {
        await sendNotification(
          recipientId,
          isImage ? '📷 Nouvelle photo' : '📎 Nouveau fichier',
          `${user.first_name} vous a envoyé ${isImage ? 'une photo' : 'un fichier'}`,
          'message',
          'messages',
          { conversation_id: selectedConvId }
        );
      }

      // Mise à jour locale optimiste (ou via real-time)
      // On laisse le real-time s'en charger si possible, mais on peut forcer ici pour la fluidité
      const formattedMsg: Message = {
        id: newMsg.id,
        conversationId: newMsg.conversation_id,
        senderId: newMsg.sender_id,
        content: newMsg.content,
        status: 'sent',
        edited: false,
        deleted: false,
        file_url: newMsg.file_url,
        file_name: newMsg.file_name,
        created_at: newMsg.created_at,
        updated_at: newMsg.created_at
      };

      setConversations(prev => prev.map(c =>
        c.id === selectedConvId ? {
          ...c,
          messages: [...(c.messages || []), formattedMsg],
          lastMessage: messageContent,
          lastMessageAt: newMsg.created_at
        } : c
      ));

    } catch (err) {
      console.error('Error uploading file:', err);
      alert('Erreur lors de l\'upload: ' + (err instanceof Error ? err.message : 'Erreur inconnue'));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const editMessage = async (msg: Message, newContent: string) => {
    const msgDate = new Date(msg.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - msgDate.getTime()) / (1000 * 60);

    if (diffMinutes > 15) {
      alert('Vous ne pouvez modifier un message que dans les 15 minutes suivant son envoi.');
      return;
    }

    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: newContent,
          edited: true
        })
        .eq('id', msg.id);

      if (error) throw error;

      setMessagesState(prev => {
        const current = prev[selectedConvId] || [];
        return {
          ...prev,
          [selectedConvId]: current.map(m => m.id === msg.id ? { ...m, content: newContent, edited: true } : m)
        };
      });

      setEditingMessage(null);
      setNewMessage('');

    } catch (err) {
      console.error('Error editing message:', err);
      alert('Erreur lors de la modification');
    }
  };

  const deleteMessage = async (msg: Message) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          deleted: true,
          content: 'Ce message a été supprimé'
        })
        .eq('id', msg.id);

      if (error) throw error;

      setMessagesState(prev => {
        const current = prev[selectedConvId] || [];
        return {
          ...prev,
          [selectedConvId]: current.map(m => m.id === msg.id ? { ...m, deleted: true, content: 'Ce message a été supprimé' } : m)
        };
      });

    } catch (err) {
      console.error('Error deleting message:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const togglePin = async (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    const newPinned = !conv.pinned;

    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, pinned: newPinned } : c
    ));

    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('pinned_by')
        .eq('id', convId)
        .single();

      let pinnedBy = convData?.pinned_by || [];
      if (newPinned) {
        if (!pinnedBy.includes(user?.id)) pinnedBy.push(user?.id);
      } else {
        pinnedBy = pinnedBy.filter((id: string) => id !== user?.id);
      }

      await supabase
        .from('conversations')
        .update({ pinned_by: pinnedBy })
        .eq('id', convId);

    } catch (err) {
      console.error('Error toggling pin:', err);
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, pinned: !newPinned } : c
      ));
    }
  };

  const toggleBlock = async (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    const newBlocked = !conv.blocked;

    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, blocked: newBlocked } : c
    ));

    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('blocked_by')
        .eq('id', convId)
        .single();

      let blockedBy = convData?.blocked_by || [];
      if (newBlocked) {
        if (!blockedBy.includes(user?.id)) blockedBy.push(user?.id);
      } else {
        blockedBy = blockedBy.filter((id: string) => id !== user?.id);
      }

      await supabase
        .from('conversations')
        .update({ blocked_by: blockedBy })
        .eq('id', convId);

    } catch (err) {
      console.error('Error toggling block:', err);
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, blocked: !newBlocked } : c
      ));
    }
  };

  const deleteConversation = async (convId: string) => {
    if (!confirm('Voulez-vous vraiment supprimer cette conversation ?')) return;

    try {
      await supabase.from('messages').delete().eq('conversation_id', convId);
      await supabase.from('conversation_participants').delete().eq('conversation_id', convId);
      await supabase.from('conversations').delete().eq('id', convId);

      setConversations(prev => prev.filter(c => c.id !== convId));
      if (selectedConvId === convId) setSelectedConvId(null);

    } catch (err) {
      console.error('Error deleting conversation:', err);
      alert('Erreur lors de la suppression');
    }
  };

  const handleTyping = () => {
    if (!selectedConvId || !user) return;
    
    if (typingTimeoutRef.current[selectedConvId]) {
      clearTimeout(typingTimeoutRef.current[selectedConvId]);
    }

    const channel = supabase.channel(`conv-${user.id}`);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, isTyping: true }
    });

    typingTimeoutRef.current[selectedConvId] = setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: user.id, isTyping: false }
      });
    }, 2000);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.otherUser?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherUser?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.otherUser?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const dateB = new Date(b.lastMessageAt || b.updated_at || b.created_at).getTime();
    const dateA = new Date(a.lastMessageAt || a.updated_at || a.created_at).getTime();
    return dateB - dateA;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-slate-50 overflow-hidden absolute inset-0">
      {/* SIDEBAR - Liste des conversations */}
      <div className={`w-full lg:w-[380px] bg-white border-r border-slate-100 flex flex-col shrink-0 transition-all duration-300 ${mobileView === 'chat' ? 'hidden lg:flex' : 'flex'
        }`}>
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-2xl font-black text-slate-900 mb-4">Messages</h2>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une conversation..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sortedConversations.length > 0 ? (
            sortedConversations.map((conv) => {
              const isOnline = onlineUsers.has(conv.otherUser?.id);
              const lastMsg = conv.lastMessage;
              const isUnread = conv.unreadCount > 0;

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`flex items-center gap-3 px-5 py-4 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 group ${selectedConvId === conv.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                    }`}
                >
                  <Avatar
                    name={conv.otherUser?.full_name || 'Utilisateur'}
                    url={conv.otherUser?.avatar_url}
                    size="md"
                    online={isOnline}
                    onClick={() => setShowProfileId(conv.otherUser?.id)}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold truncate ${isUnread ? 'text-slate-900' : 'text-slate-600'}`}>
                        {conv.otherUser?.full_name || 'Utilisateur'}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                        {formatTime(conv.lastMessageAt || conv.updated_at || conv.created_at)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {conv.lastMessageStatus === 'seen' && (
                          <CheckCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        )}
                        {conv.lastMessageStatus === 'delivered' && (
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <p className={`text-xs truncate ${isUnread ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {lastMsg || 'Nouvelle conversation'}
                        </p>
                      </div>

                      {conv.unreadCount > 0 && (
                        <span className="ml-2 min-w-[20px] h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center px-1.5">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white shadow-md rounded-xl p-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(conv.id); }}
                      className={`p-1.5 rounded-lg transition-all ${conv.pinned ? 'text-primary' : 'text-slate-400 hover:text-primary'}`}
                      title={conv.pinned ? 'Désépingler' : 'Épingler'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleBlock(conv.id); }}
                      className={`p-1.5 rounded-lg transition-all ${conv.blocked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                      title={conv.blocked ? 'Débloquer' : 'Bloquer'}
                    >
                      <ShieldBan className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Aucune conversation</p>
              <p className="text-slate-400 text-sm mt-1">Explorez le marketplace pour contacter des utilisateurs</p>
              <button
                onClick={() => onNavigate?.('marketplace')}
                className="mt-4 px-5 py-2 bg-primary text-white font-black rounded-xl text-sm"
              >
                Explorer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ZONE DE CHAT */}
      <div className={`flex-1 flex flex-col bg-white min-w-0 transition-all duration-300 ${mobileView === 'list' ? 'hidden lg:flex' : 'flex'
        }`}>
        {selectedConv ? (
          <>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 bg-white shrink-0">
              <button
                onClick={() => setMobileView('list')}
                className="lg:hidden p-2 -ml-2 rounded-full hover:bg-slate-100"
              >
                <ChevronLeft className="w-6 h-6 text-slate-600" />
              </button>

              <Avatar
                name={selectedConv.otherUser?.full_name || 'Utilisateur'}
                url={selectedConv.otherUser?.avatar_url}
                size="md"
                online={onlineUsers.has(selectedConv.otherUser?.id)}
                onClick={() => setShowProfileId(selectedConv.otherUser?.id)}
              />

              <div className="flex-1 min-w-0">
                <button
                  onClick={() => setShowProfileId(selectedConv.otherUser?.id)}
                  className="font-black text-slate-900 hover:text-primary transition-colors text-left"
                >
                  {selectedConv.otherUser?.full_name || 'Utilisateur'}
                </button>
                <div className="flex items-center gap-2 mt-0.5">
                  {typing[selectedConv.otherUser?.id] ? (
                    <span className="text-[10px] font-black text-emerald-500 animate-pulse">En train d'écrire...</span>
                  ) : onlineUsers.has(selectedConv.otherUser?.id) ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-slate-400">En ligne</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-[10px] font-black text-slate-400">Hors ligne</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="relative group">
                <button className="p-2 rounded-full hover:bg-slate-100 transition-all">
                  <MoreVertical className="w-5 h-5 text-slate-500" />
                </button>
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => togglePin(selectedConv.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 rounded-t-2xl"
                  >
                    <Pin className="w-4 h-4" />
                    {selectedConv.pinned ? 'Désépingler' : 'Épingler'}
                  </button>
                  <button
                    onClick={() => setShowProfileId(selectedConv.otherUser?.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4" />
                    Voir le profil
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  <button
                    onClick={() => toggleBlock(selectedConv.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-600 hover:bg-amber-50"
                  >
                    <ShieldBan className="w-4 h-4" />
                    {selectedConv.blocked ? 'Débloquer' : 'Bloquer'}
                  </button>
                  <button
                    onClick={() => deleteConversation(selectedConv.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-b-2xl"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer la conversation
                  </button>
                </div>
              </div>
            </div>

            {contextItem && selectedConv.relatedItem && (
              <div className="mx-4 mt-3 p-3 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl border border-primary/20 flex items-center gap-3 shadow-sm">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={contextItem.image_url || 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=100'}
                    className="w-full h-full object-cover"
                    alt={contextItem.title}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {contextItem.type === 'service' && <ShoppingBag className="w-3 h-3 text-primary" />}
                    {contextItem.type === 'lead' && <Zap className="w-3 h-3 text-primary" />}
                    {contextItem.type === 'order' && <Briefcase className="w-3 h-3 text-primary" />}
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                      {contextItem.type === 'service' ? 'SERVICE PROPOSÉ' :
                        contextItem.type === 'lead' ? 'DEMANDE D\'AIDE' :
                          contextItem.type === 'order' ? 'COMMANDE' : 'PROPOSITION'}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">{contextItem.title}</p>
                  <p className="text-xs font-black text-primary">{contextItem.price} UC</p>
                </div>
                <button
                  onClick={() => onNavigate?.(contextItem.type === 'service' ? 'marketplace' :
                    contextItem.type === 'lead' ? 'marketplace' :
                      contextItem.type === 'order' ? 'orders' : 'proposals',
                    { openItemId: contextItem.id })}
                  className="px-3 py-1.5 bg-primary/20 text-primary text-[10px] font-black rounded-lg hover:bg-primary hover:text-white transition-all"
                >
                  Voir
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 space-y-2" ref={scrollRef}>
              {!messagesState[selectedConvId] ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : messagesState[selectedConvId].length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-primary/60" />
                  </div>
                  <p className="text-slate-500 font-medium">Aucun message</p>
                  <p className="text-slate-400 text-sm">Soyez le premier à envoyer un message</p>
                </div>
              ) : (
                messagesState[selectedConvId].map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  const currentMessages = messagesState[selectedConvId];
                  const prevMsg = idx > 0 ? currentMessages[idx - 1] : null;
                  const showAvatar = !isMe && (!prevMsg || prevMsg.senderId !== msg.senderId);

                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} items-end gap-2 group`}>
                      {!isMe && showAvatar && (
                        <Avatar
                          name={selectedConv.otherUser?.full_name || 'Utilisateur'}
                          url={selectedConv.otherUser?.avatar_url}
                          size="sm"
                          onClick={() => setShowProfileId(selectedConv.otherUser?.id)}
                        />
                      )}
                      {!isMe && !showAvatar && <div className="w-8 shrink-0" />}

                      <div className={`max-w-[75%] group relative`}>
                        {msg.reply_to_message_id && (
                          <div className={`mb-2 p-2 rounded-xl text-[10px] border-l-4 ${isMe ? 'bg-white/20 border-white/40 text-white/80' : 'bg-slate-100 border-primary/40 text-slate-500'
                            }`}>
                            <div className="flex items-center gap-1 mb-1">
                              <ReplyIcon className="w-3 h-3" />
                              <span className="font-bold">Réponse</span>
                            </div>
                            <p className="italic truncate">
                              {currentMessages.find(m => m.id === msg.reply_to_message_id)?.content || 'Message introuvable'}
                            </p>
                          </div>
                        )}

                        <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${isMe
                          ? 'bg-primary text-white rounded-br-md'
                          : 'bg-white text-slate-900 border border-slate-100 rounded-bl-md'
                          }`}>
                          {msg.file_url ? (
                            <div className="space-y-2">
                              {getMessageType(msg) === 'image' ? (
                                <div className="relative group/img">
                                  <img
                                    src={msg.file_url}
                                    className="max-w-full max-h-80 rounded-2xl cursor-pointer hover:opacity-95 transition-all shadow-sm border border-slate-100"
                                    alt="Image envoyée"
                                    onClick={() => window.open(msg.file_url, '_blank')}
                                  />
                                  <button
                                    onClick={() => window.open(msg.file_url, '_blank')}
                                    className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur rounded-xl text-slate-900 opacity-0 group-hover/img:opacity-100 transition-all hover:bg-white shadow-lg"
                                    title="Télécharger"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </div>
                              ) : (
                                <div className={cn(
                                  "flex items-center gap-3 p-3 rounded-xl border",
                                  isMe ? "bg-white/10 border-white/20" : "bg-slate-50 border-slate-100"
                                )}>
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                    isMe ? "bg-white/20" : "bg-primary/10"
                                  )}>
                                    <FileText className={cn("w-5 h-5", isMe ? "text-white" : "text-primary")} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{msg.file_name || 'Document'}</p>
                                    <p className="text-[10px] opacity-60 uppercase tracking-widest font-black">Fichier</p>
                                  </div>
                                  <a
                                    href={msg.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={msg.file_name}
                                    className={cn(
                                      "p-2 rounded-lg transition-all",
                                      isMe ? "hover:bg-white/20 text-white" : "hover:bg-slate-200 text-slate-600"
                                    )}
                                  >
                                    <Download className="w-4 h-4" />
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className={`text-sm whitespace-pre-wrap break-words ${msg.deleted ? 'italic opacity-60' : ''}`}>
                              {msg.content}
                            </p>
                          )}

                          {msg.edited && !msg.deleted && (
                            <span className={`text-[9px] block mt-1 ${isMe ? 'text-white/50' : 'text-slate-400'}`}>
                              Modifié
                            </span>
                          )}

                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className={`text-[9px] ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
                              {formatTime(msg.created_at)}
                            </span>
                            {isMe && <MessageStatusIcon status={msg.status} />}
                          </div>
                        </div>

                        {!msg.deleted && (
                          <div className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all flex gap-1 ${isMe ? 'right-full mr-2' : 'left-full ml-2'
                            }`}>
                            <button
                              onClick={() => {
                                setReplyingTo(msg);
                                setNewMessage('');
                              }}
                              className="p-1.5 bg-white rounded-full shadow-md text-slate-400 hover:text-primary transition-all"
                              title="Répondre"
                            >
                              <ReplyIcon className="w-3.5 h-3.5" />
                            </button>
                            {isMe && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingMessage(msg);
                                    setNewMessage(msg.content);
                                    setReplyingTo(null);
                                  }}
                                  className="p-1.5 bg-white rounded-full shadow-md text-slate-400 hover:text-primary transition-all"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteMessage(msg)}
                                  className="p-1.5 bg-white rounded-full shadow-md text-slate-400 hover:text-red-500 transition-all"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {uploadingFile && (
                <div className="flex justify-end">
                  <div className="bg-primary/10 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs text-slate-500">Envoi du fichier...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-100 bg-white shrink-0">
              {(replyingTo || editingMessage) && (
                <div className="mb-3 p-3 bg-slate-50 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ReplyIcon className="w-4 h-4 text-primary" />
                    <span className="text-xs text-slate-500">
                      {editingMessage ? 'Modification du message' : `Réponse à ${replyingTo?.senderId === user?.id ? 'vous-même' : selectedConv.otherUser?.first_name}`}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setEditingMessage(null);
                      setNewMessage('');
                    }}
                    className="p-1 hover:bg-slate-200 rounded-full"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              )}

              {isBlocked ? (
                <div className="flex items-center justify-center py-4 text-sm text-slate-400 gap-2">
                  <ShieldBan className="w-4 h-4" />
                  <span>Utilisateur bloqué</span>
                  <button onClick={() => toggleBlock(selectedConv.id)} className="text-primary font-bold hover:underline">
                    Débloquer
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 items-end">
                  <button
                    type="button"
                    onClick={() => { setUploadType('photo'); fileInputRef.current?.click(); }}
                    className="hidden sm:flex p-3.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-full transition-all"
                    title="Envoyer une photo"
                  >
                    <ImageIcon className="w-6 h-6" />
                  </button>

                  <button
                    onClick={() => { setUploadType('file'); fileInputRef.current?.click(); }}
                    className="p-2.5 bg-slate-100 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                    title="Ajouter un fichier"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2.5 bg-slate-100 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-all"
                    >
                      <Smile className="w-5 h-5" />
                    </button>
                    <AnimatePresence>
                      {showEmojiPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full left-0 mb-2 p-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 grid grid-cols-8 gap-1 w-72"
                        >
                          {emojis.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => {
                                setNewMessage(prev => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                              className="p-2 hover:bg-slate-50 rounded-xl text-xl transition-all hover:scale-110"
                            >
                              {emoji}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => setShowStickerPicker(!showStickerPicker)}
                      className="p-2.5 bg-slate-100 rounded-xl text-slate-400 hover:text-primary hover:bg-primary/10 transition-all"
                    >
                      <Award className="w-5 h-5" />
                    </button>
                    <AnimatePresence>
                      {showStickerPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full left-0 mb-2 p-3 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 grid grid-cols-5 gap-2 w-64"
                        >
                          {stickers.map(sticker => (
                            <button
                              key={sticker}
                              onClick={() => {
                                setNewMessage(prev => prev + sticker);
                                setShowStickerPicker(false);
                              }}
                              className="p-3 hover:bg-slate-50 rounded-xl text-2xl transition-all hover:scale-110"
                            >
                              {sticker}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <textarea
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (editingMessage) {
                          editMessage(editingMessage, newMessage);
                        } else {
                          sendMessage();
                        }
                      }
                    }}
                    placeholder="Écrire un message..."
                    rows={1}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                    style={{ minHeight: '44px', maxHeight: '100px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = Math.min(target.scrollHeight, 100) + 'px';
                    }}
                  />

                  <button
                    onClick={() => {
                      if (editingMessage) {
                        editMessage(editingMessage, newMessage);
                      } else {
                        sendMessage();
                      }
                    }}
                    disabled={(!newMessage.trim() && !uploadingFile) || uploadingFile}
                    className="p-2.5 bg-primary text-white rounded-xl disabled:opacity-40 shadow-md hover:bg-primary/90 transition-all shrink-0"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-12 h-12 text-primary/50" />
              </div>
              <h3 className="text-xl font-black text-slate-900">Messagerie</h3>
              <p className="text-sm text-slate-500 mt-2">Sélectionnez une conversation ou contactez quelqu'un depuis le marketplace</p>
              <button
                onClick={() => onNavigate?.('marketplace')}
                className="mt-6 px-6 py-3 bg-primary text-white font-black rounded-xl flex items-center gap-2 mx-auto"
              >
                Explorer le marketplace
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showProfileId && (
          <UserProfileModal
            userId={showProfileId}
            onClose={() => setShowProfileId(null)}
            onStartChat={(userId) => {
              const conv = conversations.find(c => c.otherUser?.id === userId);
              if (conv) {
                setSelectedConvId(conv.id);
              } else {
                const createAndSelect = async () => {
                  const { data: newConv } = await supabase
                    .from('conversations')
                    .insert([{ participants: [user?.id, userId], created_at: new Date().toISOString() }])
                    .select()
                    .single();
                  if (newConv) {
                    await supabase.from('conversation_participants').insert([
                      { conversation_id: newConv.id, user_id: user?.id },
                      { conversation_id: newConv.id, user_id: userId }
                    ]);
                    setSelectedConvId(newConv.id);
                    loadConversations();
                  }
                };
                createAndSelect();
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}