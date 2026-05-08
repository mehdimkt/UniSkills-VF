import React, { useState, useEffect, useRef } from 'react';
import { 
  User, 
  MapPin, 
  GraduationCap, 
  Plus, 
  Trash2, 
  Edit3, 
  FileText,
  Star as StarIcon,
  Lock,
  Camera,
  X,
  Users,
  Eye,
  EyeOff,
  BookOpen,
  Link as LinkIcon,
  Upload,
  Save,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { sendNotification } from '../lib/notifications';

const moroccanCities = [
  'Agadir', 'Al Hoceima', 'Casablanca', 'El Jadida', 'Fès', 'Kénitra', 'Marrakech',
  'Meknès', 'Oujda', 'Rabat', 'Safi', 'Salé', 'Tanger', 'Tétouan', 'Autre'
];

const institutionsByCity: Record<string, string[]> = {
  "Casablanca": ["Université Hassan II", "Université Internationale de Casablanca", "EMSI", "EHTP", "ISCAE"],
  "Rabat": ["Université Mohammed V", "Université Internationale de Rabat (UIR)", "ENSIAS", "EMI", "INSEA", "INPT"],
  "Marrakech": ["Université Cadi Ayyad", "Université Privée de Marrakech", "EMSI", "ENCG Marrakech"],
  "Fès": ["Université Sidi Mohamed Ben Abdellah", "Université Al Quaraouiyine", "Université Euromed de Fès"],
  "Tanger": ["Université Abdelmalek Essaadi", "EMSI", "ENSA Tanger"],
  "Kénitra": ["Université Ibn Tofail", "ENCG Kénitra"],
  "Meknès": ["Université Moulay Ismaïl", "ENAM"],
  "Agadir": ["Université Ibn Zohr", "Universiapolis"],
  "Oujda": ["Université Mohammed Premier"],
  "El Jadida": ["Université Chouaib Doukkali"],
  "Settat": ["Université Hassan 1er"],
  "Ifrane": ["Université Al Akhawayn"],
  "Benguérir": ["Université Mohammed VI Polytechnique (UM6P)"]
};

const availableSkills = [
  'Python', 'JavaScript', 'TypeScript', 'React.js', 'Next.js', 'Vue.js', 'Angular', 'Node.js',
  'Java', 'Spring Boot', 'C++', 'PHP', 'Django', 'Flask', 'SQL', 'PostgreSQL', 'MongoDB',
  'Data Science', 'Machine Learning', 'IA', 'TensorFlow', 'UI/UX Design', 'Figma', 'Photoshop',
  'Marketing Digital', 'SEO', 'Social Media Management', 'Rédaction', 'Traduction',
  'Mathématiques', 'Physique', 'Chimie', 'Biologie', 'Statistiques', 'Comptabilité', 'Finance',
  'Gestion de projet', 'Agile', 'Scrum', 'Excel', 'Anglais', 'Français', 'Arabe', 'Espagnol'
];

const studyLevels = [
  'Baccalauréat', 'Licence 1', 'Licence 2', 'Licence 3', 'Master 1', 'Master 2', 'Doctorat',
  'Cycle Ingénieur 1ère année', 'Cycle Ingénieur 2ème année', 'Cycle Ingénieur 3ème année', 'BTS', 'DUT'
];

interface Skill {
  id: string;
  name: string;
}

interface Project {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  link?: string;
  file?: { url: string; name: string };
  cover_url?: string;
}

interface Review {
  id: string;
  author_name: string;
  author_avatar?: string;
  rating: number;
  comment: string;
  created_at: string;
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    city: user?.city || '',
    university: user?.university || '',
    level: user?.level || '',
    gender: user?.gender || 'male',
    bio: user?.bio || '',
    avatar_url: user?.avatar_url || ''
  });
  
  const [skills, setSkills] = useState<Skill[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectForm, setProjectForm] = useState({
    title: '',
    shortDescription: '',
    description: '',
    link: '',
    file: null as File | null,
    cover: null as File | null
  });
  
  const [initialSkills, setInitialSkills] = useState<string[]>([]);
  const [showProjectDetails, setShowProjectDetails] = useState<Project | null>(null);
  
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUserProfile();
  }, [user?.id]);

  const fetchUserProfile = async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }
      
      if (data) {
        setFormData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          city: data.city || '',
          university: data.university || '',
          level: data.level || '',
          gender: data.gender || 'male',
          bio: data.bio || '',
          avatar_url: data.avatar_url || ''
        });
        
        if (data.skills && Array.isArray(data.skills)) {
          setSkills(data.skills.map((s: string, i: number) => ({ id: String(i), name: s })));
          setInitialSkills(data.skills);
        }
        
        if (data.projects && Array.isArray(data.projects)) {
          setProjects(data.projects);
        }

        // Récupérer les avis
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('*')
          .eq('aideur_id', user.id)
          .order('created_at', { ascending: false });
        
        if (reviewsData) {
          setReviews(reviewsData);
        }
      }
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
    }
  };

  const handleSaveProfile = async (updatedProjects?: Project[], updatedSkills?: Skill[], silent: boolean = false) => {
    if (!user?.id) return;
    
    setUploading(true);
    setSaveError(null);
    
    const updates: any = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      city: formData.city,
      university: formData.university,
      level: formData.level,
      gender: formData.gender,
      avatar_url: formData.avatar_url,
      bio: formData.bio,
      updated_at: new Date().toISOString()
    };
    
    updates.skills = updatedSkills ? updatedSkills.map(s => s.name) : skills.map(s => s.name);
    updates.projects = updatedProjects || projects;
    
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);
      
      if (error) {
        console.error('Supabase error:', error);
        setSaveError(error.message);
        if (!silent) alert(`Erreur: ${error.message}`);
      } else {
        setUser({ ...user, ...updates });
        setIsEditing(false);
        
        if (updatedSkills) {
          setInitialSkills(updatedSkills.map(s => s.name));
        }

        if (!silent) {
          await sendNotification(
            user.id,
            "Profil mis à jour",
            "Vos informations de profil ont été enregistrées avec succès.",
            "success"
          );
          alert('✅ Profil mis à jour avec succès !');
        }
      }
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setSaveError(err.message);
      if (!silent) alert(`Erreur: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);
      
      const newAvatarUrl = urlData.publicUrl;
      
      // Update local state
      setFormData(prev => ({ ...prev, avatar_url: newAvatarUrl }));
      
      // Persist immediately to DB
      const { error: dbError } = await supabase
        .from('users')
        .update({ avatar_url: newAvatarUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
        
      if (dbError) throw dbError;

      // Update auth context
      setUser({ ...user, avatar_url: newAvatarUrl });
      
      alert('✅ Photo de profil mise à jour !');
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      alert(`❌ Erreur lors de l'upload: ${err.message || 'Erreur inconnue'}`);
    } finally {
      setUploading(false);
    }
  };

  const addSkill = (skillName: string) => {
    if (!skills.find(s => s.name === skillName) && skills.length < 10) {
      setSkills([...skills, { id: Date.now().toString(), name: skillName }]);
    }
    setNewSkill('');
    setSkillSearch('');
    setShowSkillDropdown(false);
  };

  const removeSkill = (id: string) => {
    setSkills(skills.filter(s => s.id !== id));
  };

  const handleProjectFileUpload = async (file: File, isCover: boolean = false) => {
    if (!user?.id) return null;
    
    try {
      const fileExt = file.name.split('.').pop();
      const prefix = isCover ? 'cover' : 'project';
      const fileName = `${prefix}_${user.id}_${Date.now()}.${fileExt}`;
      const bucket = isCover ? 'images' : 'documents';
      const filePath = `${isCover ? 'projects/covers' : 'projects/files'}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);
      
      return isCover ? urlData.publicUrl : { url: urlData.publicUrl, name: file.name };
    } catch (err) {
      console.error('Error uploading project file:', err);
      return null;
    }
  };

  const saveProject = async () => {
    if (!projectForm.title.trim()) {
      alert('Veuillez entrer un titre');
      return;
    }
    
    setUploading(true);
    try {
      let fileData = editingProject?.file;
      if (projectForm.file) {
        const uploadedFile = await handleProjectFileUpload(projectForm.file);
        if (uploadedFile && typeof uploadedFile === 'object') {
          fileData = uploadedFile;
        }
      }

      let coverUrl = editingProject?.cover_url;
      if (projectForm.cover) {
        const uploadedCover = await handleProjectFileUpload(projectForm.cover, true);
        if (typeof uploadedCover === 'string') {
          coverUrl = uploadedCover;
        }
      }
      
      const newProject: Project = {
        id: editingProject?.id || Date.now().toString(),
        title: projectForm.title,
        shortDescription: projectForm.shortDescription,
        description: projectForm.description,
        link: projectForm.link || undefined,
        file: fileData,
        cover_url: coverUrl
      };
      
      let updatedProjects;
      if (editingProject) {
        updatedProjects = projects.map(p => p.id === editingProject.id ? newProject : p);
      } else {
        updatedProjects = [...projects, newProject];
      }
      
      // ✅ SAUVEGARDE IMMÉDIATE SILENCIEUSE
      await handleSaveProfile(updatedProjects, undefined, true);
      
      setProjects(updatedProjects);
      setShowProjectModal(false);
      setProjectForm({ title: '', shortDescription: '', description: '', link: '', file: null, cover: null });
      setEditingProject(null);
      alert('✅ Projet enregistré avec succès !');
    } catch (err) {
      console.error('Error saving project:', err);
      alert('❌ Erreur lors de l\'enregistrement du projet');
    } finally {
      setUploading(false);
    }
  };

  const deleteProject = (id: string) => {
    if (confirm('Supprimer ce projet ?')) {
      setProjects(projects.filter(p => p.id !== id));
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }
    
    if (passwordForm.new_password.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new_password
      });
      
      if (error) throw error;
      
      alert('✅ Mot de passe changé avec succès !');
      setIsChangingPassword(false);
      setPasswordForm({ new_password: '', confirm_password: '' });
    } catch (err: any) {
      console.error('Error changing password:', err);
      alert(`❌ Erreur: ${err.message}`);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')) return;
    
    try {
      const { error } = await supabase.auth.admin.deleteUser(user!.id);
      if (error) throw error;
      
      await supabase.auth.signOut();
      alert('Votre compte a été supprimé');
    } catch (err: any) {
      console.error('Error deleting account:', err);
      alert(`❌ Erreur: ${err.message}`);
    }
  };

  const filteredSkills = availableSkills.filter(skill => 
    skill.toLowerCase().includes(skillSearch.toLowerCase()) &&
    !skills.find(s => s.name === skill)
  );

  const filteredInstitutions = institutionsByCity[formData.city] || [];

  const getAvatarIcon = () => {
    if (formData.avatar_url) {
      return <img src={formData.avatar_url} className="w-full h-full object-cover" alt="Avatar" />;
    }
    if (formData.gender === 'female') {
      return <Users className="w-16 h-16 text-pink-400" />;
    }
    return <User className="w-16 h-16 text-primary" />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Colonne de gauche */}
        <div className="lg:w-1/3 space-y-6">
          <div className="bg-white rounded-[40px] border border-slate-100 p-8 shadow-sm">
            <div className="relative group flex flex-col items-center text-center">
              <div 
                className="relative cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className={`w-32 h-32 rounded-full border-[6px] ${formData.gender === 'female' ? 'border-pink-100' : 'border-blue-50'} overflow-hidden shadow-xl bg-slate-100 flex items-center justify-center`}>
                  {getAvatarIcon()}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              
              {uploading && <div className="mt-2 text-xs text-primary">Upload en cours...</div>}
              
              <div className="mt-4">
                <h3 className="text-2xl font-black text-slate-900">{formData.first_name} {formData.last_name}</h3>
              </div>
              
              <div className="flex items-center justify-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-slate-500 text-xs">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>{formData.level || 'Niveau non renseigné'}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>{formData.city || 'Ville non renseignée'}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-center mt-1">
                <div className="flex items-center gap-1 text-slate-500 text-xs">
                  <GraduationCap className="w-3.5 h-3.5 text-primary" />
                  <span className="truncate max-w-[200px]">{formData.university || 'Université non renseignée'}</span>
                </div>
              </div>
              
              {!isEditing ? (
                <button 
                  onClick={() => setIsEditing(true)}
                  className="mt-6 px-6 py-2 bg-slate-50 text-slate-600 hover:text-primary rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 transition-all"
                >
                  Modifier le profil
                </button>
              ) : (
                <div className="w-full space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      className="w-full p-2 border rounded-xl text-sm font-bold" 
                      value={formData.first_name} 
                      onChange={e => setFormData({...formData, first_name: e.target.value})}
                      placeholder="Prénom"
                    />
                    <input 
                      className="w-full p-2 border rounded-xl text-sm font-bold" 
                      value={formData.last_name} 
                      onChange={e => setFormData({...formData, last_name: e.target.value})}
                      placeholder="Nom"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-400">Genre</label>
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, gender: 'male'})}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            formData.gender === 'male' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <User className="w-3 h-3" />
                          Homme
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, gender: 'female'})}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            formData.gender === 'female' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Users className="w-3 h-3" />
                          Femme
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400">Ville</label>
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value, university: ''})}
                        className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none"
                      >
                        <option value="">Sélectionnez</option>
                        {moroccanCities.map(city => (
                          <option key={city}>{city}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-black text-slate-400">Établissement</label>
                      <select
                        value={formData.university}
                        onChange={(e) => setFormData({...formData, university: e.target.value})}
                        className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none"
                        disabled={!formData.city}
                      >
                        <option value="">Sélectionnez</option>
                        {filteredInstitutions.map(inst => (
                          <option key={inst}>{inst}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400">Niveau</label>
                      <select
                        value={formData.level}
                        onChange={(e) => setFormData({...formData, level: e.target.value})}
                        className="w-full px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs outline-none"
                      >
                        <option value="">Sélectionnez</option>
                        {studyLevels.map(level => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <textarea 
                    className="w-full p-2 border rounded-xl text-sm" 
                    rows={2}
                    value={formData.bio} 
                    onChange={e => setFormData({...formData, bio: e.target.value})}
                    placeholder="Bio..."
                  />
                  
                  {saveError && (
                    <div className="p-2 bg-red-50 rounded-xl text-red-600 text-[10px] text-center">
                      Erreur: {saveError}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    <button onClick={handleSaveProfile} disabled={uploading} className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1">
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                      Sauvegarder
                    </button>
                    <button onClick={() => setIsEditing(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Annuler</button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Statistiques</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-xl font-black text-slate-900">4.9</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Note</p>
                </div>
                <div className="text-center border-l border-slate-50">
                  <p className="text-xl font-black text-slate-900">{reviews.length}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Avis</p>
                </div>
              </div>
            </div>
            
            {/* Changer mot de passe */}
            <div className="pt-4 mt-4 border-t border-slate-100">
              {!isChangingPassword ? (
                <button 
                  onClick={() => setIsChangingPassword(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-bold"
                >
                  <Lock className="w-3 h-3" />
                  Changer mot de passe
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Nouveau mot de passe"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirmer"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleChangePassword} className="flex-1 py-2 bg-primary text-white rounded-xl text-xs font-bold">Enregistrer</button>
                    <button onClick={() => setIsChangingPassword(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Annuler</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Zone de danger */}
          <div className="bg-red-50 rounded-[32px] border border-red-100 p-6">
            <h4 className="text-sm font-black text-red-900 mb-2">Zone de Danger</h4>
            <button 
              onClick={handleDeleteAccount}
              className="w-full py-3 bg-white text-red-600 text-xs font-black rounded-xl border border-red-200 hover:bg-red-600 hover:text-white transition-all"
            >
              Supprimer mon compte
            </button>
          </div>
        </div>

        {/* Colonne de droite */}
        <div className="lg:flex-1 space-y-6">
          {/* Compétences */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
            <h4 className="text-lg font-black text-slate-900 mb-6">Compétences</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              {skills.map((skill) => (
                <div key={skill.id} className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                  {skill.name}
                  <button onClick={() => removeSkill(skill.id)} className="ml-1 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            
            <div className="relative">
              <input
                type="text"
                value={skillSearch}
                onChange={(e) => {
                  setSkillSearch(e.target.value);
                  setShowSkillDropdown(true);
                }}
                onFocus={() => setShowSkillDropdown(true)}
                placeholder="Ajouter une compétence..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
              />
              {showSkillDropdown && filteredSkills.length > 0 && skills.length < 10 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredSkills.slice(0, 20).map(skill => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => addSkill(skill)}
                      className="w-full text-left px-4 py-2 hover:bg-primary/5 text-sm transition-colors"
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[9px] text-slate-400 mt-2">Maximum 10 compétences</p>
            
            {/* ✅ BOUTON VALIDER POUR LES COMPÉTENCES (Uniquement si changement) */}
            {JSON.stringify(skills.map(s => s.name).sort()) !== JSON.stringify([...initialSkills].sort()) && (
              <div className="mt-4 flex justify-end animate-in fade-in slide-in-from-right duration-300">
                <button 
                  onClick={() => handleSaveProfile(undefined, skills)}
                  disabled={uploading}
                  className="px-6 py-2 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-primary-dark transition-all shadow-lg shadow-primary/20"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer les compétences
                </button>
              </div>
            )}
          </div>

          {/* Projets */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-black text-slate-900">Mes Réalisations</h4>
              <button 
                onClick={() => {
                  setEditingProject(null);
                  setProjectForm({ title: '', shortDescription: '', description: '', link: '', file: null });
                  setShowProjectModal(true);
                }}
                className="p-2 bg-blue-50 text-primary rounded-xl hover:bg-primary hover:text-white transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <div 
                  key={project.id} 
                  className="group relative bg-white rounded-2xl border border-slate-100 overflow-hidden hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-md"
                  onClick={() => setShowProjectDetails(project)}
                >
                  {/* Photo de couverture - Aspect Video pour éviter le crop agressif */}
                  <div className="aspect-video bg-slate-100 relative overflow-hidden">
                    {project.cover_url ? (
                      <img src={project.cover_url} className="w-full h-full object-cover object-center transition-transform group-hover:scale-105 duration-700" alt={project.title} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                        <Camera className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-white text-[10px] font-bold flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Voir détails
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <h5 className="text-sm font-black text-slate-900 mb-1 line-clamp-1">{project.title}</h5>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{project.shortDescription}</p>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-2">
                        {project.link && <LinkIcon className="w-3.5 h-3.5 text-primary/60" />}
                        {project.file && <FileText className="w-3.5 h-3.5 text-primary/60" />}
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project);
                            setProjectForm({
                              title: project.title,
                              shortDescription: project.shortDescription,
                              description: project.description,
                              link: project.link || '',
                              file: null,
                              cover: null
                            });
                            setShowProjectModal(true);
                          }}
                          className="p-2 bg-blue-50 text-primary rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                          title="Modifier"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(project.id);
                          }}
                          className="p-2 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {projects.length === 0 && (
              <p className="text-center text-slate-400 text-sm py-8">Aucune réalisation. Ajoutez vos projets !</p>
            )}
          </div>

          {/* Avis reçus */}
          <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm">
            <h4 className="text-lg font-black text-slate-900 mb-6">Avis reçus</h4>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                        {review.author_avatar ? (
                          <img src={review.author_avatar} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <span className="text-sm font-black text-slate-900">{review.author_name || 'Étudiant UniSkills'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <StarIcon key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'text-secondary fill-current' : 'text-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>
                  <p className="text-[10px] text-slate-400 mt-2 italic">{new Date(review.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Projet */}
      <AnimatePresence>
        {showProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
                <h3 className="text-lg font-black text-slate-900">{editingProject ? 'Modifier le projet' : 'Ajouter un projet'}</h3>
                <button onClick={() => setShowProjectModal(false)} className="p-1 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Photo de couverture</label>
                  <div 
                    onClick={() => coverFileInputRef.current?.click()}
                    className="mt-1 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all overflow-hidden relative"
                  >
                    {projectForm.cover ? (
                      <img src={URL.createObjectURL(projectForm.cover)} className="w-full h-full object-cover" />
                    ) : editingProject?.cover_url ? (
                      <img src={editingProject.cover_url} className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-slate-300" />
                        <span className="text-[10px] text-slate-400 mt-1">Cliquez pour ajouter une photo</span>
                      </>
                    )}
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={coverFileInputRef} 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setProjectForm({...projectForm, cover: file});
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Titre du projet *</label>
                  <input
                    type="text"
                    placeholder="Ex: Application mobile de gestion"
                    value={projectForm.title}
                    onChange={(e) => setProjectForm({...projectForm, title: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Description courte</label>
                  <input
                    type="text"
                    placeholder="Résumé du projet en une phrase"
                    value={projectForm.shortDescription}
                    onChange={(e) => setProjectForm({...projectForm, shortDescription: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Description détaillée</label>
                  <textarea
                    rows={4}
                    placeholder="Décrivez votre projet en détail..."
                    value={projectForm.description}
                    onChange={(e) => setProjectForm({...projectForm, description: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm mt-1 resize-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Lien du projet (optionnel)</label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={projectForm.link}
                    onChange={(e) => setProjectForm({...projectForm, link: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Fichier du projet (optionnel)</label>
                  <div 
                    onClick={() => projectFileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex items-center justify-center gap-3 cursor-pointer hover:border-primary transition-all mt-1"
                  >
                    <Upload className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-500">
                      {projectForm.file ? projectForm.file.name : 'Ajouter un fichier (PDF, ZIP, Image)'}
                    </span>
                  </div>
                  <input 
                    ref={projectFileInputRef} 
                    type="file" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setProjectForm({...projectForm, file});
                      }
                    }}
                  />
                </div>
                <button
                  onClick={saveProject}
                  disabled={uploading}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    editingProject ? 'Modifier le projet' : 'Ajouter le projet'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DÉTAILS PROJET */}
      <AnimatePresence>
        {showProjectDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="aspect-video bg-slate-100 relative shrink-0">
                {showProjectDetails.cover_url ? (
                  <img src={showProjectDetails.cover_url} className="w-full h-full object-cover object-center" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-50">
                    <Camera className="w-12 h-12 text-slate-200" />
                  </div>
                )}
                <button 
                  onClick={() => setShowProjectDetails(null)} 
                  className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full text-white transition-all shadow-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">{showProjectDetails.title}</h3>
                    <p className="text-primary font-bold mt-1">{showProjectDetails.shortDescription}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">À propos du projet</h4>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{showProjectDetails.description}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {showProjectDetails.link && (
                      <a 
                        href={showProjectDetails.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center gap-3 group hover:bg-primary transition-all"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <LinkIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase group-hover:text-white">Lien externe</p>
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[150px] group-hover:text-white">Voir le projet</p>
                        </div>
                      </a>
                    )}

                    {showProjectDetails.file && (
                      <a 
                        href={showProjectDetails.file.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 group hover:bg-emerald-500 transition-all"
                      >
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <FileText className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-emerald-500 uppercase group-hover:text-white">Fichier</p>
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[150px] group-hover:text-white">{showProjectDetails.file.name}</p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>

                <div className="mt-10 flex gap-4">
                  <button 
                    onClick={() => {
                      setEditingProject(showProjectDetails);
                      setProjectForm({
                        title: showProjectDetails.title,
                        shortDescription: showProjectDetails.shortDescription,
                        description: showProjectDetails.description,
                        link: showProjectDetails.link || '',
                        file: null,
                        cover: null
                      });
                      setShowProjectDetails(null);
                      setShowProjectModal(true);
                    }}
                    className="flex-1 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" /> Modifier
                  </button>
                  <button 
                    onClick={() => setShowProjectDetails(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    Fermer
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