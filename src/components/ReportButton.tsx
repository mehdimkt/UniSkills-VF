import React, { useState } from 'react';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportButtonProps {
  targetId: string;
  targetType: 'service' | 'lead' | 'user' | 'message';
  className?: string;
}

const ReportButton: React.FC<ReportButtonProps> = ({ targetId, targetType, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('spam');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();

  const handleReport = async () => {
    if (!user) return alert("Vous devez être connecté pour signaler.");
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert([{
        reporter_id: user.id,
        target_id: targetId,
        target_type: targetType,
        reason: reason,
        description: description,
        status: 'pending'
      }]);
      
      if (error) throw error;
      
      alert("Signalement envoyé avec succès.");
      setIsOpen(false);
      setDescription('');
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'envoi du signalement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(true); }}
        className={`flex items-center gap-2 text-slate-400 hover:text-red-500 transition-colors ${className}`}
        title="Signaler"
      >
        <Flag className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">Signaler un problème</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-900 uppercase mb-2">Motif du signalement</label>
                  <select 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                  >
                    <option value="spam">Spam ou publicité</option>
                    <option value="scam">Arnaque / Fraude</option>
                    <option value="inappropriate">Contenu inapproprié</option>
                    <option value="harassment">Harcèlement</option>
                    <option value="other">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-900 uppercase mb-2">Détails (optionnel)</label>
                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Pouvez-vous nous en dire plus ?"
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-medium text-slate-700 min-h-[100px] resize-none"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-4 text-xs font-black text-slate-500 uppercase hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={handleReport}
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-red-500 text-white text-xs font-black rounded-2xl uppercase hover:bg-red-600 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                  >
                    {isSubmitting ? 'Envoi...' : 'Signaler'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ReportButton;
