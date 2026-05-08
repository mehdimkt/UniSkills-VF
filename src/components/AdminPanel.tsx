import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShoppingBag, 
  AlertTriangle, 
  Search, 
  CheckCircle, 
  XCircle,
  Clock,
  MessageSquare,
  Eye,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface DisputeOrder {
  id: string;
  title: string;
  buyer_name: string;
  seller_name: string;
  amount: number;
  dispute_reason: string;
  dispute_created_at: string;
  dispute_status: string;
  status: string;
}

export default function AdminPanel() {
  const [disputes, setDisputes] = useState<DisputeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState<DisputeOrder | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          amount,
          dispute_reason,
          dispute_created_at,
          dispute_status,
          status,
          buyer:buyer_id (full_name),
          seller:seller_id (full_name),
          service:services (title),
          lead:leads (title)
        `)
        .eq('dispute_status', 'pending')
        .order('dispute_created_at', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((order: any) => ({
        id: order.id,
        title: order.service?.title || order.lead?.title || 'Commande',
        buyer_name: order.buyer?.full_name || 'Inconnu',
        seller_name: order.seller?.full_name || 'Inconnu',
        amount: order.amount,
        dispute_reason: order.dispute_reason || 'Aucune raison fournie',
        dispute_created_at: order.dispute_created_at,
        dispute_status: order.dispute_status,
        status: order.status
      }));
      setDisputes(mapped);
    } catch (err) {
      console.error('Error fetching disputes:', err);
    } finally {
      setLoading(false);
    }
  };

  const resolveDispute = async (orderId: string, decision: 'buyer' | 'seller') => {
    setProcessing(true);
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('buyer_id, seller_id, amount')
        .eq('id', orderId)
        .single();

      if (!order) throw new Error('Order not found');

      if (decision === 'buyer') {
        // Remboursement au demandeur
        const { data: buyerWallet } = await supabase
          .from('unicoin_wallets')
          .select('id, balance')
          .eq('user_id', order.buyer_id)
          .single();

        if (buyerWallet) {
          await supabase
            .from('unicoin_wallets')
            .update({ balance: buyerWallet.balance + order.amount })
            .eq('id', buyerWallet.id);

          await supabase.from('unicoin_transactions').insert({
            wallet_id: buyerWallet.id,
            amount: order.amount,
            type: 'refund',
            status: 'completed',
            description: `Remboursement suite litige - ${orderId}`,
            completed_at: new Date().toISOString()
          });
        }

        await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            dispute_status: 'resolved_buyer',
            dispute_resolved_at: new Date().toISOString()
          })
          .eq('id', orderId);

      } else {
        // Paiement à l'aideur
        const { data: sellerWallet } = await supabase
          .from('unicoin_wallets')
          .select('id, balance')
          .eq('user_id', order.seller_id)
          .single();

        if (sellerWallet) {
          await supabase
            .from('unicoin_wallets')
            .update({ balance: sellerWallet.balance + order.amount })
            .eq('id', sellerWallet.id);

          await supabase.from('unicoin_transactions').insert({
            wallet_id: sellerWallet.id,
            amount: order.amount,
            type: 'payment',
            status: 'completed',
            description: `Paiement suite litige - ${orderId}`,
            completed_at: new Date().toISOString()
          });
        }

        await supabase
          .from('orders')
          .update({
            status: 'completed',
            dispute_status: 'resolved_seller',
            dispute_resolved_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          })
          .eq('id', orderId);
      }

      await fetchDisputes();
      setSelectedDispute(null);
      alert(`Litige résolu en faveur du ${decision === 'buyer' ? 'demandeur' : 'aideur'}`);
    } catch (err) {
      console.error('Error resolving dispute:', err);
      alert('Erreur lors de la résolution');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Administration</h2>
        <p className="text-slate-500 font-medium">Gestion des litiges</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-6 h-6 text-red-500" />
            <p className="text-2xl font-black text-slate-900">{disputes.length}</p>
          </div>
          <p className="text-sm text-slate-500">Litiges en attente</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-orange-500" />
            <p className="text-2xl font-black text-slate-900">
              {disputes.filter(d => new Date(d.dispute_created_at) < new Date(Date.now() - 48 * 60 * 60 * 1000)).length}
            </p>
          </div>
          <p className="text-sm text-slate-500">Litiges urgents (&gt;48h)</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            <p className="text-2xl font-black text-slate-900">
              {disputes.reduce((sum, d) => sum + d.amount, 0)} UC
            </p>
          </div>
          <p className="text-sm text-slate-500">Montant total en litige</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-900">Litiges à traiter</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {disputes.length > 0 ? (
            disputes.map((dispute) => (
              <div key={dispute.id} className="p-6 hover:bg-slate-50 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full">
                        Litige
                      </span>
                      <span className="text-[10px] font-black text-slate-400">
                        {new Date(dispute.dispute_created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h4 className="text-lg font-black text-slate-900">{dispute.title}</h4>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Acheteur: {dispute.buyer_name}</span>
                      <span>Vendeur: {dispute.seller_name}</span>
                      <span className="font-bold text-primary">{dispute.amount} UC</span>
                    </div>
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                      <p className="text-xs text-slate-500 font-medium mb-1">Motif du litige:</p>
                      <p className="text-sm text-slate-700">{dispute.dispute_reason}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedDispute(dispute)}
                    className="p-2 bg-slate-100 rounded-xl text-slate-600 hover:bg-primary hover:text-white transition-all"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-slate-500 font-medium">Aucun litige en attente</p>
              <p className="text-sm text-slate-400 mt-1">Tous les litiges ont été traités</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal résolution litige */}
      <AnimatePresence>
        {selectedDispute && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900">Résoudre le litige</h3>
                <button onClick={() => setSelectedDispute(null)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-600">{selectedDispute.dispute_reason}</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 p-4 bg-blue-50 rounded-xl">
                    <p className="text-xs text-slate-500">Demandeur</p>
                    <p className="font-black text-slate-900">{selectedDispute.buyer_name}</p>
                    <p className="text-sm text-green-600">Réclame {selectedDispute.amount} UC</p>
                  </div>
                  <div className="flex-1 p-4 bg-purple-50 rounded-xl">
                    <p className="text-xs text-slate-500">Aideur</p>
                    <p className="font-black text-slate-900">{selectedDispute.seller_name}</p>
                    <p className="text-sm text-green-600">Réclame {selectedDispute.amount} UC</p>
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => resolveDispute(selectedDispute.id, 'buyer')}
                    disabled={processing}
                    className="flex-1 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Rembourser le demandeur'}
                  </button>
                  <button
                    onClick={() => resolveDispute(selectedDispute.id, 'seller')}
                    disabled={processing}
                    className="flex-1 py-3 bg-purple-600 text-white font-black rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Payer l\'aideur'}
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