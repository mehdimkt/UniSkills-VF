import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Lock, Mail, GraduationCap, MapPin, ChevronRight, Upload, Sparkles, BookOpen, Loader2, X, Eye, EyeOff, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// Liste des domaines email académiques autorisés
const allowedEmailDomains = [
  '@um5.ac.ma', '@univh2c.ma', '@uh2c.ac.ma', '@uca.ma', '@uca.ac.ma',
  '@usmba.ac.ma', '@uae.ac.ma', '@uit.ac.ma', '@umi.ac.ma', '@usms.ac.ma',
  '@uh1.ac.ma', '@uiz.ac.ma', '@ump.ac.ma', '@ucd.ac.ma', '@aui.ma',
  '@um6p.ma', '@uir.ac.ma', '@ueuromed.org', '@upm.ac.ma', '@upm.ma',
  '@uic.ac.ma', '@mundiapolis.ma', '@upf.ac.ma', '@universiapolis.ma',
  '@um6ss.ma', '@uiass.ma', '@inpt.ac.ma', '@insea.ac.ma', '@iav.ac.ma',
  '@ehtp.ac.ma', '@groupeiscae.ma', '@enameknes.ac.ma', '@archi.ac.ma'
];

const availableSkills = [
  'Python', 'JavaScript', 'React.js', 'Angular', 'Vue.js', 'Node.js',
  'Java', 'C++', 'PHP', 'Django', 'Flask', 'Spring Boot',
  'Data Science', 'Machine Learning', 'IA', 'SQL', 'MongoDB',
  'UI/UX Design', 'Figma', 'Photoshop', 'Illustrator', 'After Effects',
  'Marketing Digital', 'SEO', 'Social Media', 'Content Writing',
  'Traduction', 'Rédaction', 'Relecture', 'Correction',
  'Mathématiques', 'Physique', 'Chimie', 'Biologie', 'Statistiques',
  'Comptabilité', 'Finance', 'Gestion de projet', 'Excel'
];

const isAcademicEmail = (email: string): boolean => {
  return allowedEmailDomains.some(domain => email.toLowerCase().endsWith(domain));
};

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const { login, resetPassword } = useAuth();
  const [selectedCity, setSelectedCity] = useState('Casablanca');
  const [selectedSchool, setSelectedSchool] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('male');
  const [selectedSemester, setSelectedSemester] = useState('');
  
  // État pour afficher/masquer les mots de passe
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const schoolsByCity: Record<string, string[]> = {
    "Casablanca": ["Université Hassan II", "Université Internationale de Casablanca", "Université Mundiapolis", "École Centrale Casablanca", "EMSI (Casablanca)", "HEM Business School", "EHTP", "ISCAE"],
    "Rabat": ["Université Mohammed V", "Université Internationale de Rabat (UIR)", "ENSIAS", "EMI (École Mohammadia d’Ingénieurs)", "INSEA", "INPT", "IAV Hassan II", "ENA"],
    "Marrakech": ["Université Cadi Ayyad", "Université Privée de Marrakech", "Sup de Co Marrakech", "EMSI (Marrakech)", "ENCG Marrakech"],
    "Fès": ["Université Sidi Mohamed Ben Abdellah", "Université Al Quaraouiyine", "Université Euromed de Fès", "Université Privée de Fès"],
    "Tanger": ["Université Abdelmalek Essaadi", "EMSI (Tanger)", "ENSA (Tanger)"],
    "Kénitra": ["Université Ibn Tofail", "ENCG Kénitra"],
    "Meknès": ["Université Moulay Ismaïl", "ENAM"],
    "Agadir": ["Université Ibn Zohr", "Universiapolis"],
    "El Jadida": ["Université Chouaib Doukkali"],
    "Oujda": ["Université Mohammed Premier"],
    "Béni Mellal": ["Université Sultan Moulay Slimane"],
    "Settat": ["Université Hassan 1er"],
    "Ifrane": ["Université Al Akhawayn"],
    "Benguérir": ["Université Mohammed VI Polytechnique (UM6P)"]
  };

  const cities = Object.keys(schoolsByCity);
  const filteredSchools = schoolsByCity[selectedCity] || [];
  const filteredSkills = availableSkills.filter(skill => 
    skill.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const city = e.target.value;
    setSelectedCity(city);
    setSelectedSchool(schoolsByCity[city][0] || '');
  };

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      setSelectedSkills(selectedSkills.filter(s => s !== skill));
    } else if (selectedSkills.length < 5) {
      setSelectedSkills([...selectedSkills, skill]);
    }
    setSkillSearch('');
    setShowSkillDropdown(false);
  };

  const handleEmailChange = (email: string) => {
    setEmailError('');
    if (!isLogin && email && !isAcademicEmail(email)) {
      setEmailError('Veuillez utiliser votre email académique (.ac.ma, .ma, .org)');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    
    setIsLoading(true);
    const { error } = await resetPassword(resetEmail);
    if (error) {
      alert('Erreur: ' + error.message);
    } else {
      setResetSent(true);
    }
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const email = (e.target as any).email?.value;
    const password = (e.target as any).password?.value;
    
    if (!isAcademicEmail(email)) {
      alert('Veuillez utiliser votre email académique pour vous connecter.');
      setIsLoading(false);
      return;
    }
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.error('Login error:', error);
      alert('Erreur: ' + error.message);
      setIsLoading(false);
      return;
    }
    
    if (data.user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (profile) {
        login({
          id: profile.id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email,
          role: 'demandeur',
          city: profile.city || '',
          university: profile.university || '',
          semester: profile.semester || '',
          gender: profile.gender || 'male',
          avatar_url: profile.avatar_url,
          skills: profile.skills || []
        }, data.session?.access_token || '');
      }
    }
    
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const form = e.target as any;
    const firstName = form.firstName?.value;
    const lastName = form.lastName?.value;
    const email = form.email?.value;
    const password = form.password?.value;
    const confirmPassword = form.confirmPassword?.value;
    const city = selectedCity;
    const university = selectedSchool;
    const level = form.level?.value;
    
    if (password !== confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      setIsLoading(false);
      return;
    }
    
    if (!isAcademicEmail(email)) {
      alert('Veuillez utiliser votre email académique (.ac.ma, .ma, .org)');
      setIsLoading(false);
      return;
    }
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
          city,
          university,
          level,
          semester: selectedSemester,
          gender: selectedGender,
          skills: selectedSkills
        }
      }
    });
    
    if (error) {
      console.error('Signup error:', error);
      alert('Erreur: ' + error.message);
      setIsLoading(false);
      return;
    }
    
    if (data.user) {
      await supabase.from('users').insert([{
        id: data.user.id,
        email: email,
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`,
        city: city,
        university: university,
        level: level,
        semester: selectedSemester,
        gender: selectedGender,
        skills: selectedSkills,
        avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}&gender=${selectedGender}`
      }]);
      
      alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');
      setIsLogin(true);
      setSelectedSkills([]);
      setSelectedGender('male');
      setSelectedSemester('');
    }
    
    setIsLoading(false);
  };

  // Afficher le formulaire de réinitialisation
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-black text-slate-900">Mot de passe oublié</h2>
            <p className="text-sm text-slate-500 mt-2">Entrez votre email pour réinitialiser votre mot de passe</p>
          </div>
          
          {resetSent ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-slate-600 mb-6">Un email de réinitialisation a été envoyé à <strong>{resetEmail}</strong></p>
              <button
                onClick={() => {
                  setShowResetPassword(false);
                  setResetSent(false);
                  setResetEmail('');
                }}
                className="w-full py-3 bg-primary text-white font-black rounded-xl"
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Email académique</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none mt-1"
                  placeholder="ex: etudiant@um5.ac.ma"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary text-white font-black rounded-xl flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Envoyer'}
              </button>
              <button
                type="button"
                onClick={() => setShowResetPassword(false)}
                className="w-full py-3 text-slate-500 font-bold text-sm"
              >
                Retour
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex font-sans">
      {/* Partie gauche - Branding */}
      <div className="hidden lg:flex lg:w-1/2 auth-gradient text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg">
            <img src="/logo.svg" alt="Uniskills" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tighter">UNISKILLS</h1>
        </div>
        <div className="space-y-6">
          <h2 className="text-5xl font-bold leading-tight">
            La Marketplace des <br />
            <span className="text-primary tracking-tight">Étudiants Marocains</span>
          </h2>
          <p className="text-xl text-blue-100 max-w-md">
            Le talent devient une monnaie d'échange. Proposez vos compétences, trouvez le talent et progressez ensemble.
          </p>
        </div>
      </div>

      {/* Partie droite - Formulaire */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-xl space-y-8 py-10">
          <div className="text-center">
            <h3 className="text-3xl font-bold text-slate-900">
              {isLogin ? 'Bon retour !' : 'Créer votre compte'}
            </h3>
            <p className="text-slate-500 mt-2">
              {isLogin ? 'Veuillez saisir vos identifiants pour continuer.' : 'Rejoignez la communauté Uniskills'}
            </p>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-lg max-w-md mx-auto">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${isLogin ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Connexion
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!isLogin ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Inscription
            </button>
          </div>

          <AnimatePresence mode="wait">
            <motion.form 
              key={isLogin ? 'login' : 'register'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={isLogin ? handleLogin : handleSignup}
              className="space-y-6"
            >
              {!isLogin && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Prénom</label>
                      <div className="relative">
                        <input type="text" name="firstName" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="Ex: Mehdi" required />
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Nom</label>
                      <div className="relative">
                        <input type="text" name="lastName" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" placeholder="Ex: Alami" required />
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Genre</label>
                      <div className="flex gap-4 p-2 bg-slate-50 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setSelectedGender('male')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                            selectedGender === 'male' ? 'bg-primary text-white' : 'text-slate-500'
                          }`}
                        >
                          <User className="w-4 h-4" />
                          Homme
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedGender('female')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
                            selectedGender === 'female' ? 'bg-primary text-white' : 'text-slate-500'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                          Femme
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Semestre</label>
                      <select
                        value={selectedSemester}
                        onChange={(e) => setSelectedSemester(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                        required
                      >
                        <option value="">Sélectionnez</option>
                        <option>S1</option><option>S2</option><option>S3</option><option>S4</option>
                        <option>S5</option><option>S6</option><option>Master 1</option>
                        <option>Master 2</option><option>Doctorat</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Ville</label>
                      <select 
                        value={selectedCity}
                        onChange={handleCityChange}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        required
                      >
                        {cities.map(city => <option key={city}>{city}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Établissement</label>
                      <select 
                        value={selectedSchool}
                        onChange={(e) => setSelectedSchool(e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        required
                      >
                        {filteredSchools.map(school => <option key={school}>{school}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Niveau</label>
                      <select name="level" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none" required>
                        <option value="">Sélectionnez</option>
                        <option>Licence 1</option><option>Licence 2</option><option>Licence 3</option>
                        <option>Master 1</option><option>Master 2</option><option>Doctorat</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Email Universitaire *</label>
                <div className="relative">
                  <input 
                    type="email" 
                    name="email" 
                    onChange={(e) => handleEmailChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                    placeholder="Ex: nom.prenom@um5.ac.ma" 
                    required 
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
                {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Compétences (max 5)</label>
                  <div className="relative">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedSkills.map(skill => (
                        <div key={skill} className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full">
                          {skill}
                          <button type="button" onClick={() => toggleSkill(skill)} className="hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={skillSearch}
                      onChange={(e) => {
                        setSkillSearch(e.target.value);
                        setShowSkillDropdown(true);
                      }}
                      onFocus={() => setShowSkillDropdown(true)}
                      placeholder="Rechercher une compétence..."
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm"
                      disabled={selectedSkills.length >= 5}
                    />
                    {showSkillDropdown && filteredSkills.length > 0 && selectedSkills.length < 5 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {filteredSkills.map(skill => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className="w-full text-left px-4 py-2 hover:bg-primary/5 text-sm transition-colors"
                          >
                            {skill}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Mot de passe</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password" 
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                    required 
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-widest">Confirmation</label>
                  <div className="relative">
                    <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      name="confirmPassword" 
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary outline-none" 
                      required 
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(true)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:opacity-95 transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 group active:scale-[0.98] disabled:opacity-70"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Se connecter' : 'Créer mon compte'}
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.form>
          </AnimatePresence>

          <p className="text-center text-xs text-slate-400">
            En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
          </p>
        </div>
      </div>
    </div>
  );
}