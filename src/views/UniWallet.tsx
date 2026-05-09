
import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  Coins, 
  Send, 
  History, 
  TrendingUp, 
  TrendingDown,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle2,
  Loader2,
  Gift,
  Award,
  X,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Transaction {
  id: string;
  amount: number;
  type: 'deposit' | 'payment' | 'transfer' | 'refund' | 'reward' | 'hold';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string;
  reference_id?: string;
  recipient_name?: string;
  created_at: string;
  completed_at?: string;
}

interface WalletData {
  balance: number;
  held_balance: number;
  total_spent: number;
  total_received: number;
  total_rewards: number;
}

export default function UniWallet() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<WalletData>({
    balance: 0,
    held_balance: 0,
    total_spent: 0,
    total_received: 0,
    total_rewards: 0
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendEmail, setSendEmail] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [searchUser, setSearchUser] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showDetailsModal, setShowDetailsModal] = useState<Transaction | null>(null);

  const fetchWalletData = async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      let { data: walletData, error: walletError } = await supabase
        .from('unicoin_wallets')
        .select('id, balance, held_balance')
        .eq('user_id', user.id)
        .single();

      if (walletError && walletError.code === 'PGRST116') {
        const { data: newWallet, error: insertError } = await supabase
          .from('unicoin_wallets')
          .insert([{ user_id: user.id, balance: 100, held_balance: 0 }])
          .select('id, balance, held_balance')
          .single();
        
        if (!insertError && newWallet) {
          walletData = newWallet;
          
          await supabase.from('unicoin_transactions').insert([{
            wallet_id: newWallet.id,
            amount: 100,
            type: 'reward',
            status: 'completed',
            description: '🎉 Bienvenue sur Uniskills ! 100 UniCoins offerts',
            completed_at: new Date().toISOString()
          }]);
        }
      }

      if (!walletData) {
        setLoading(false);
        return;
      }

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('unicoin_transactions')
        .select(`
          *,
          recipient:recipient_id (id, first_name, last_name, email)
        `)
        .eq('wallet_id', walletData.id)
        .order('created_at', { ascending: false });

      if (transactionsError) throw transactionsError;

      let totalSpent = 0;
      let totalReceived = 0;
      let totalRewards = 0;

      transactionsData?.forEach((t: any) => {
        if (t.status === 'completed') {
          if (t.amount < 0 && t.type !== 'hold') {
            totalSpent += Math.abs(t.amount);
          } else if (t.amount > 0 && t.type !== 'hold') {
            totalReceived += t.amount;
            if (t.type === 'reward') {
              totalRewards += t.amount;
            }
          }
        }
      });

      setWallet({
        balance: walletData.balance || 0,
        held_balance: walletData.held_balance || 0,
        total_spent: totalSpent,
        total_received: totalReceived,
        total_rewards: totalRewards
      });

      setTransactions(transactionsData?.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        status: t.status,
        description: t.description,
        reference_id: t.reference_id,
        recipient_name: t.recipient ? `${t.recipient.first_name} ${t.recipient.last_name}` : undefined,
        created_at: t.created_at,
        completed_at: t.completed_at
      })) || []);

    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    
    fetchWalletData();

    // ✅ ABONNEMENT TEMPS RÉEL POUR LE WALLET ET LES TRANSACTIONS
    const walletChannel = supabase
      .channel('wallet_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unicoin_wallets', filter: `user_id=eq.${user.id}` },
        () => fetchWalletData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unicoin_transactions' },
        () => fetchWalletData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(walletChannel);
    };
  }, [user?.id]);

  const searchUserByEmail = async () => {
    if (!sendEmail.trim()) return;
    setSearchLoading(true);
    setSearchUser(null);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, avatar_url')
        .eq('email', sendEmail)
        .neq('id', user?.id)
        .single();

      if (error) throw error;
      setSearchUser(data);
    } catch (err) {
      console.error('User not found:', err);
      alert('Utilisateur non trouvé');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendCoins = async () => {
    if (!user?.id || !searchUser || !sendAmount) return;

    const amount = parseInt(sendAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Montant invalide');
      return;
    }
    if (amount > wallet.balance) {
      alert(`Solde insuffisant! Besoin de ${amount - wallet.balance} UC supplémentaires.`);
      return;
    }

    setIsSending(true);

    try {
      const { data: senderWallet, error: senderError } = await supabase
        .from('unicoin_wallets')
        .select('id, balance')
        .eq('user_id', user.id)
        .single();

      if (senderError || !senderWallet) {
        throw new Error('Wallet expéditeur introuvable');
      }

      let { data: receiverWalletData, error: receiverError } = await supabase
        .from('unicoin_wallets')
        .select('id, balance')
        .eq('user_id', searchUser.id)
        .single();

      if (receiverError && receiverError.code === 'PGRST116') {
        const { data: newWallet, error: createError } = await supabase
          .from('unicoin_wallets')
          .insert([{ user_id: searchUser.id, balance: 0, held_balance: 0 }])
          .select('id, balance')
          .single();
        
        if (createError || !newWallet) {
          throw new Error('Erreur lors de la création du wallet destinataire');
        }
        receiverWalletData = newWallet;
      }

      if (!receiverWalletData) {
        throw new Error('Wallet destinataire introuvable');
      }

      const { data: transaction, error: txError } = await supabase
        .from('unicoin_transactions')
        .insert([{
          wallet_id: senderWallet.id,
          amount: -amount,
          type: 'transfer',
          status: 'pending',
          description: sendMessage || `Envoi à ${searchUser.first_name} ${searchUser.last_name}`,
          recipient_id: searchUser.id,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (txError) throw txError;

      await supabase
        .from('unicoin_wallets')
        .update({ 
          balance: senderWallet.balance - amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', senderWallet.id);

      await supabase
        .from('unicoin_wallets')
        .update({ 
          balance: (receiverWalletData.balance || 0) + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', receiverWalletData.id);

      await supabase
        .from('unicoin_transactions')
        .insert([{
          wallet_id: receiverWalletData.id,
          amount: amount,
          type: 'transfer',
          status: 'completed',
          description: `Reçu de ${user.email}`,
          recipient_id: user.id,
          completed_at: new Date().toISOString()
        }]);

      await supabase
        .from('unicoin_transactions')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', transaction.id);

      alert(`${amount} UniCoins envoyés à ${searchUser.first_name} ${searchUser.last_name} !`);
      setShowSendModal(false);
      setSendAmount('');
      setSendEmail('');
      setSendMessage('');
      setSearchUser(null);
      fetchWalletData();

    } catch (err) {
      console.error('Error sending coins:', err);
      alert('Erreur lors de l\'envoi');
    } finally {
      setIsSending(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'payment': return <DollarSign className="w-4 h-4 text-blue-500" />;
      case 'transfer': return <Send className="w-4 h-4 text-purple-500" />;
      case 'refund': return <RefreshCw className="w-4 h-4 text-orange-500" />;
      case 'reward': return <Gift className="w-4 h-4 text-pink-500" />;
      case 'hold': return <Lock className="w-4 h-4 text-yellow-500" />;
      default: return <History className="w-4 h-4 text-slate-400" />;
    }
  };

  const getTransactionLabel = (type: string) => {
    switch (type) {
      case 'deposit': return 'Dépôt';
      case 'payment': return 'Paiement';
      case 'transfer': return 'Transfert';
      case 'refund': return 'Remboursement';
      case 'reward': return 'Récompense';
      case 'hold': return 'Fonds bloqués';
      default: return 'Transaction';
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'incoming') return t.amount > 0;
    if (activeFilter === 'outgoing') return t.amount < 0;
    return t.type === activeFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">UniWallet</h2>
          <p className="text-slate-500 font-medium">Gérez vos UniCoins et vos transactions</p>
        </div>
        <button
          onClick={() => setShowSendModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-200 hover:opacity-90 transition-all flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
          Envoyer des UniCoins
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Wallet className="w-8 h-8 opacity-80" />
            <Coins className="w-6 h-6 opacity-80" />
          </div>
          <p className="text-sm font-medium opacity-80">Solde disponible</p>
          <p className="text-4xl font-black mt-1">{wallet.balance} <span className="text-lg">UC</span></p>
          <p className="text-xs opacity-75 mt-2">1 UC = 1 DH</p>
        </div>

        {wallet.held_balance > 0 && (
          <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-100 rounded-xl">
                <Lock className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <p className="text-sm font-medium text-yellow-700">Fonds bloqués</p>
            <p className="text-2xl font-black text-yellow-700">{wallet.held_balance} UC</p>
            <p className="text-xs text-yellow-500 mt-1">En attente de validation</p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-red-50 rounded-xl">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Total dépensé</p>
          <p className="text-2xl font-black text-slate-900">{wallet.total_spent} UC</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-xl">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Total reçu</p>
          <p className="text-2xl font-black text-slate-900">{wallet.total_received} UC</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-pink-50 rounded-xl">
              <Award className="w-5 h-5 text-pink-500" />
            </div>
          </div>
          <p className="text-sm font-medium text-slate-500">Récompenses</p>
          <p className="text-2xl font-black text-slate-900">{wallet.total_rewards} UC</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4">
        {[
          { id: 'all', label: 'Toutes', icon: History },
          { id: 'incoming', label: 'Reçues', icon: TrendingUp },
          { id: 'outgoing', label: 'Envoyées', icon: TrendingDown },
          { id: 'reward', label: 'Récompenses', icon: Award },
          { id: 'payment', label: 'Paiements', icon: DollarSign },
          { id: 'transfer', label: 'Transferts', icon: Send },
          { id: 'hold', label: 'Bloqués', icon: Lock }
        ].map(filter => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeFilter === filter.id
                ? 'bg-primary/10 text-primary'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            <filter.icon className="w-3.5 h-3.5" />
            {filter.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900">Historique des transactions</h3>
          <button onClick={fetchWalletData} className="p-2 text-slate-400 hover:text-primary rounded-xl transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-50">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((transaction) => (
              <motion.div
                key={transaction.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 hover:bg-slate-50/50 transition-all cursor-pointer"
                onClick={() => setShowDetailsModal(transaction)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      {getTransactionIcon(transaction.type)}
                    </div>
                    <div>
                      <p className="font-black text-slate-900">{getTransactionLabel(transaction.type)}</p>
                      <p className="text-xs text-slate-400">{transaction.description}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {new Date(transaction.created_at).toLocaleDateString('fr-FR', { 
                          day: 'numeric', 
                          month: 'short', 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black ${transaction.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {transaction.amount > 0 ? '+' : ''}{transaction.amount} UC
                    </p>
                    {transaction.recipient_name && (
                      <p className="text-[10px] text-slate-400">Vers {transaction.recipient_name}</p>
                    )}
                    {transaction.status === 'completed' && (
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-[9px] text-green-600 font-black">COMPLÉTÉ</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">Aucune transaction</p>
              <p className="text-sm text-slate-400 mt-1">Vos transactions apparaîtront ici</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal d'envoi (inchangé) */}
      <AnimatePresence>
        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Send className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Envoyer des UniCoins</h3>
                    <p className="text-xs text-slate-500">Transfert sécurisé</p>
                  </div>
                </div>
                <button onClick={() => setShowSendModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1 block">Email du destinataire</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={sendEmail}
                      onChange={(e) => setSendEmail(e.target.value)}
                      placeholder="ex: etudiant@univ.ma"
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                    />
                    <button
                      onClick={searchUserByEmail}
                      disabled={searchLoading}
                      className="px-4 py-3 bg-primary text-white rounded-xl font-black text-sm"
                    >
                      {searchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Vérifier'}
                    </button>
                  </div>
                </div>

                {searchUser && (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-green-100 overflow-hidden">
                        <img src={searchUser.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${searchUser.first_name}`} alt="" />
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{searchUser.first_name} {searchUser.last_name}</p>
                        <p className="text-xs text-green-600">{searchUser.email}</p>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-500 ml-auto" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1 block">Montant (UniCoins)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none text-xl font-black"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">UC</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Solde disponible: {wallet.balance} UC
                    {wallet.held_balance > 0 && ` (dont ${wallet.held_balance} UC bloqués)`}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1 block">Message (optionnel)</label>
                  <textarea
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    rows={2}
                    placeholder="Ajoutez un message..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowSendModal(false)}
                    className="flex-1 py-3 text-slate-500 font-black rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSendCoins}
                    disabled={isSending || !searchUser || !sendAmount}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black rounded-xl shadow-lg shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Envoyer
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal détails transaction */}
      <AnimatePresence>
        {showDetailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Détails</h3>
                <button onClick={() => setShowDetailsModal(null)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    {getTransactionIcon(showDetailsModal.type)}
                  </div>
                  <p className="text-3xl font-black text-slate-900">
                    {showDetailsModal.amount > 0 ? '+' : ''}{showDetailsModal.amount} UC
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{getTransactionLabel(showDetailsModal.type)}</p>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Statut</span>
                    <span className={`text-xs font-black uppercase ${showDetailsModal.status === 'completed' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {showDetailsModal.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Date</span>
                    <span className="text-xs font-medium text-slate-700">
                      {new Date(showDetailsModal.created_at).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  {showDetailsModal.completed_at && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-400">Complétée le</span>
                      <span className="text-xs font-medium text-slate-700">
                        {new Date(showDetailsModal.completed_at).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs text-slate-400">Description</span>
                    <span className="text-xs font-medium text-slate-700 text-right max-w-[200px]">{showDetailsModal.description}</span>
                  </div>
                  {showDetailsModal.reference_id && (
                    <div className="flex justify-between">
                      <span className="text-xs text-slate-400">Référence</span>
                      <span className="text-xs font-mono text-slate-500">{showDetailsModal.reference_id}</span>
                    </div>
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