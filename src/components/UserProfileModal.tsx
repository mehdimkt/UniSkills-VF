import React, { useState, useEffect } from 'react';
import { 
  X, Star, Briefcase, MessageSquare, 
  MapPin, GraduationCap, BookOpen, 
  User, Eye, Link as LinkIcon, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  avatar_url?: string;
  city?: string;
  university?: string;
  level?: string;
  bio?: string;
  skills?: string[];
  projects?: any[];
  rating?: number;
  reviews_count: number;
  projects_completed: number;
}

export const UserProfileModal = ({ userId, onClose, onStartChat }: {
  userId: string;
  onClose: () => void;
  onStartChat?: (userId: string) => void;
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFullProfile = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();

        if (userData) {
          // Stats
          const { count: projectsCount } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', userId)
            .eq('status', 'completed');

          const { data: reviewsData } = await supabase
            .from('reviews')
            .select('*')
            .eq('reviewed_id', userId)
            .order('created_at', { ascending: false });

          const avgRating = reviewsData?.length
            ? (reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length).toFixed(1)
            : null;

          setProfile({
            ...userData,
            full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
            projects_completed: projectsCount || 0,
            reviews_count: reviewsData?.length || 0,
            rating: avgRating ? parseFloat(avgRating) : undefined,
            projects: userData.projects || []
          });
          setReviews(reviewsData || []);
        }
      } catch (err) {
        console.error('Error fetching full profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFullProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header/Banner */}
        <div className="relative h-40 bg-gradient-to-r from-primary to-secondary">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur rounded-full text-white hover:bg-white/40 transition-all z-20">
            <X className="w-5 h-5" />
          </button>
          <div className="absolute -bottom-16 left-8 flex items-end gap-6">
            <div className="w-32 h-32 rounded-3xl border-4 border-white shadow-xl bg-white overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                  <User className="w-12 h-12 text-primary" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-20 px-8 pb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-black text-slate-900">{profile.full_name}</h2>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500 font-medium">
                {profile.university && <span className="flex items-center gap-1"><GraduationCap className="w-4 h-4" /> {profile.university}</span>}
                {profile.city && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {profile.city}</span>}
                {profile.level && <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {profile.level}</span>}
              </div>
            </div>
            {onStartChat && (
              <button 
                onClick={() => onStartChat(userId)}
                className="px-6 py-3 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 hover:opacity-90 transition-all"
              >
                Contacter
              </button>
            )}
          </div>

          <div className="flex gap-4 mt-8">
            <div className="flex-1 bg-amber-50 p-4 rounded-2xl text-center">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500 mx-auto mb-1" />
              <p className="text-xl font-black text-amber-600">{profile.rating?.toFixed(1) || 'Nouveau'}</p>
              <p className="text-[10px] font-bold text-amber-500 uppercase">Note</p>
            </div>
            <div className="flex-1 bg-primary/5 p-4 rounded-2xl text-center">
              <Briefcase className="w-6 h-6 text-primary mx-auto mb-1" />
              <p className="text-xl font-black text-primary">{profile.projects_completed}</p>
              <p className="text-[10px] font-bold text-primary uppercase">Projets</p>
            </div>
            <div className="flex-1 bg-slate-50 p-4 rounded-2xl text-center">
              <MessageSquare className="w-6 h-6 text-slate-400 mx-auto mb-1" />
              <p className="text-xl font-black text-slate-600">{profile.reviews_count}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Avis</p>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <div className="mt-8">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Bio</h3>
              <div className="p-4 bg-slate-50 rounded-2xl">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              </div>
            </div>
          )}

          {/* Réalisations */}
          {profile.projects && profile.projects.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Réalisations</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.projects.map((p: any, idx: number) => (
                  <div key={idx} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm group">
                    <div className="aspect-video bg-slate-100 relative overflow-hidden">
                      {p.cover_url ? (
                        <img src={p.cover_url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Briefcase className="w-8 h-8 text-slate-200" /></div>
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-bold text-slate-900 truncate">{p.title}</h4>
                      <p className="text-[10px] text-slate-500 line-clamp-1">{p.shortDescription}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Avis */}
          <div className="mt-8">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Avis de la communauté</h3>
            <div className="space-y-4">
              {reviews.length > 0 ? reviews.map((r: any) => (
                <div key={r.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-black text-slate-900">{r.author_name || 'Étudiant UniSkills'}</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600">{r.comment}</p>
                  <p className="text-[10px] text-slate-400 mt-2 italic">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              )) : (
                <p className="text-sm text-slate-400 text-center py-4 italic">Aucun avis pour le moment</p>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
