import React from 'react';
import { 
  Users, 
  ShoppingBag, 
  AlertTriangle, 
  BadgeCheck, 
  Settings, 
  BarChart3,
  Search,
  ShieldAlert,
  Ban,
  CheckCircle,
  XCircle,
  DollarSign
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

const data = [
  { name: 'Lun', value: 4000 },
  { name: 'Mar', value: 3000 },
  { name: 'Mer', value: 6500 },
  { name: 'Jeu', value: 5000 },
  { name: 'Ven', value: 8000 },
  { name: 'Sam', value: 9500 },
  { name: 'Dim', value: 7000 },
];

export default function AdminPanel() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Utilisateurs', val: '1 240', sub: '+12% ce mois', icon: Users, color: 'bg-blue-500' },
          { label: 'Services Actifs', val: '450', sub: '32 en attente', icon: ShoppingBag, color: 'bg-purple-500' },
          { label: 'CA Plateforme', val: '12 850 DH', sub: 'Frais de service', icon: DollarSign, color: 'bg-green-500' },
          { label: 'Litiges', val: '3', sub: 'Action requise', icon: AlertTriangle, color: 'bg-red-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
            <div className={`w-12 h-12 ${stat.color} rounded-2xl flex items-center justify-center text-white mb-4`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            <p className="text-3xl font-black text-slate-900">{stat.val}</p>
            <p className="text-[10px] text-slate-500 font-bold mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Graphique de revenus */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-6">Évolution du CA Plateforme</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="adminColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#1e3a8a" strokeWidth={3} fill="url(#adminColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Vérifications en attente */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center justify-between">
            Profils à Vérifier
            <span className="text-xs bg-blue-50 text-primary px-2 py-1 rounded-lg">8 nouveaux</span>
          </h3>
          <div className="space-y-4">
            {[
              { name: 'Mehdi A.', univ: 'EMI Rabat', doc: 'Certificat scolarité' },
              { name: 'Inès L.', univ: 'ENCG Casa', doc: 'Carte étudiant' },
              { name: 'Yassine M.', univ: 'FSR Rabat', doc: 'Attestation réussite' },
            ].map((user, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-200" />
                  <div>
                    <p className="text-sm font-bold text-slate-900">{user.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{user.univ}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-primary text-white text-[10px] font-black rounded-lg hover:bg-blue-800">VOIR DOC</button>
                  <button className="p-2 bg-white border border-slate-200 text-green-600 rounded-lg hover:bg-green-50"><CheckCircle className="w-4 h-4" /></button>
                  <button className="p-2 bg-white border border-slate-200 text-red-500 rounded-lg hover:bg-red-50"><XCircle className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table des Utilisateurs */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden text-sm">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Gestion des Étudiants</h3>
          <div className="relative">
            <input type="text" placeholder="Rechercher (Email, Nom, ID)..." className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-primary w-64" />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-8 py-4">Nom / Prénom</th>
              <th className="px-8 py-4">Email</th>
              <th className="px-8 py-4">Rôle</th>
              <th className="px-8 py-4">État</th>
              <th className="px-8 py-4">Vérification</th>
              <th className="px-8 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: 'Mehdi Mouktaoui', email: 'mehdi@um5.ma', role: 'Aideur', status: 'Actif', verify: 'Vérifié' },
              { name: 'Salma Benjelloun', email: 'salma@casa.ac.ma', role: 'Demandeur', status: 'Actif', verify: 'En attente' },
              { name: 'Hiba Jaidi', email: 'hiba@uir.ma', role: 'Aideur', status: 'Banni', verify: 'Non vérifié' },
            ].map((row, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <td className="px-8 py-5 font-bold text-slate-900">{row.name}</td>
                <td className="px-8 py-5 text-slate-500">{row.email}</td>
                <td className="px-8 py-5">
                   <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${row.role === 'Aideur' ? 'bg-blue-50 text-primary' : 'bg-orange-50 text-orange-600'}`}>
                    {row.role}
                   </span>
                </td>
                <td className="px-8 py-5">
                  <span className={`flex items-center gap-1 font-bold ${row.status === 'Actif' ? 'text-green-600' : 'text-red-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${row.status === 'Actif' ? 'bg-green-600' : 'bg-red-500'}`} />
                    {row.status}
                  </span>
                </td>
                <td className="px-8 py-5">
                  <span className="text-slate-400 font-bold">{row.verify}</span>
                </td>
                <td className="px-8 py-5">
                   <div className="flex gap-2">
                     <button className="p-2 bg-slate-100 rounded-lg hover:bg-primary hover:text-white transition-all"><Settings className="w-4 h-4" /></button>
                     <button className="p-2 bg-slate-100 rounded-lg hover:text-red-500 transition-all"><Ban className="w-4 h-4" /></button>
                   </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
