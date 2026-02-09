import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, Save, Briefcase, GraduationCap, Plus, X, 
  User, Phone, MapPin, Target, DollarSign, FileText, Trash2, Mail
} from 'lucide-react';
import { TalentProfile, Education, Experience, Candidate } from '../types';

const generateId = () => crypto.randomUUID();

export const TalentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { talents, addTalent, updateTalent, candidates, jobs } = useData();

  const isEditing = id && id !== 'new';

  const [formData, setFormData] = useState<Partial<TalentProfile>>({
    education: [],
    experience: [],
    tags: [],
    observations: [],
    transportation: 'Consegue vir até a empresa'
  });

  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const [tagInput, setTagInput] = useState('');
  const [obsInput, setObsInput] = useState('');

  // Carrega dados se for Edição
  useEffect(() => {
    if (isEditing) {
      const found = talents.find(t => t.id === id);
      if (found) {
        setFormData(JSON.parse(JSON.stringify(found)));
        // Separa email e telefone se existirem
        if (found.contact) {
            const parts = found.contact.split('|');
            setEmailInput(parts.find(p => p.includes('@'))?.trim() || '');
            setPhoneInput(parts.find(p => p.match(/\d{4,}/))?.trim() || '');
        }
      }
    }
  }, [id, talents, isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Une email e telefone antes de salvar
    const finalContact = [emailInput, phoneInput].filter(Boolean).join(' | ');

    const payload = {
      ...formData,
      id: isEditing ? id! : generateId(),
      name: formData.name!,
      age: Number(formData.age),
      contact: finalContact,
      city: formData.city!,
      targetRole: formData.targetRole!,
      tags: formData.tags || [],
      education: formData.education || [],
      experience: formData.experience || [],
      salaryExpectation: formData.salaryExpectation,
      transportation: formData.transportation,
      createdAt: formData.createdAt || new Date().toISOString(),
      needsReview: false,
      observations: formData.observations || []
    } as TalentProfile;

    if (isEditing) {
      updateTalent(payload);
    } else {
      addTalent(payload);
    }
    
    navigate('/talent-pool');
  };

  // --- Handlers ---
  const handleAddTag = () => { if(tagInput.trim()) { setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] })); setTagInput(''); } };
  const handleAddObservation = () => { if(obsInput.trim()) { const timestamp = new Date().toLocaleDateString('pt-BR'); const newObs = `${timestamp}: ${obsInput.trim()}`; setFormData(prev => ({ ...prev, observations: [...(prev.observations || []), newObs] })); setObsInput(''); } };
  const addEducation = () => setFormData(prev => ({ ...prev, education: [...(prev.education || []), { institution: '', level: '', status: 'Completo', conclusionYear: '' }] }));
  const updateEducation = (i: number, f: keyof Education, v: string) => { const list = [...(formData.education || [])]; list[i] = { ...list[i], [f]: v }; setFormData(p => ({ ...p, education: list })); };
  const removeEducation = (i: number) => setFormData(p => ({ ...p, education: p.education?.filter((_, idx) => idx !== i) }));
  const addExperience = () => setFormData(prev => ({ ...prev, experience: [...(prev.experience || []), { company: '', role: '', period: '', description: '' }] }));
  const updateExperience = (i: number, f: keyof Experience, v: string) => { const list = [...(formData.experience || [])]; list[i] = { ...list[i], [f]: v }; setFormData(p => ({ ...p, experience: list })); };
  const removeExperience = (i: number) => setFormData(p => ({ ...p, experience: p.experience?.filter((_, idx) => idx !== i) }));

  // Histórico
  const history = candidates.filter(c => {
      if (!emailInput && !phoneInput) return false;
      const cleanPhone = phoneInput.replace(/\D/g, ''); 
      const cleanCandidatePhone = c.phone?.replace(/\D/g, '') || '';
      const matchEmail = c.email && emailInput && c.email.includes(emailInput);
      const matchPhone = cleanCandidatePhone && cleanPhone && cleanCandidatePhone.includes(cleanPhone);
      return matchEmail || matchPhone;
  }).map(c => {
      const job = jobs.find(j => j.id === c.jobId);
      return { date: c.createdAt, jobTitle: job ? job.title : 'Vaga Desconhecida', status: c.status, notes: c.rejectionReason || '-' };
  });

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/talent-pool')} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><ArrowLeft size={24} /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{isEditing ? 'Editar Perfil' : 'Novo Talento'}</h1>
            <p className="text-slate-500 text-sm">Preencha os dados completos do candidato.</p>
          </div>
        </div>
        <button onClick={handleSubmit} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all"><Save size={20}/> Salvar Perfil</button>
      </div>

      <div className="space-y-6">
         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2"><User size={20} className="text-blue-600"/> Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nome Completo</label><input required className="w-full border p-2.5 rounded-lg" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Idade</label><input type="number" className="w-full border p-2.5 rounded-lg" value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})} /></div>
            </div>
            
            {/* CAMPOS SEPARADOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Email</label><input type="email" className="w-full border p-2.5 rounded-lg" value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="email@exemplo.com" /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Telefone / WhatsApp</label><input className="w-full border p-2.5 rounded-lg" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder="(XX) 9XXXX-XXXX" /></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Cidade</label><input className="w-full border p-2.5 rounded-lg" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Transporte</label>
                   <select className="w-full border p-2.5 rounded-lg bg-white" value={formData.transportation || 'Consegue vir até a empresa'} onChange={e => setFormData({...formData, transportation: e.target.value})}>
                      <option value="Consegue vir até a empresa">Consegue vir até a empresa</option>
                      <option value="Precisa de Fretado/VT">Precisa de Fretado/VT</option>
                      <option value="Mudança de Cidade">Aceita Mudança de Cidade</option>
                   </select>
                </div>
            </div>
         </div>

         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2"><Briefcase size={20} className="text-blue-600"/> Objetivo Profissional</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Cargo Alvo</label><input className="w-full border p-2.5 rounded-lg font-bold text-blue-800" value={formData.targetRole || ''} onChange={e => setFormData({...formData, targetRole: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Pretensão Salarial</label><input className="w-full border p-2.5 rounded-lg text-emerald-600 font-bold" value={formData.salaryExpectation || ''} onChange={e => setFormData({...formData, salaryExpectation: e.target.value})} /></div>
            </div>
            
            <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Tags / Habilidades</label>
                <div className="flex gap-2 mb-3">
                    <input className="flex-1 border p-2.5 rounded-lg" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} placeholder="Ex: Excel Avançado, Inglês..." />
                    <button type="button" onClick={handleAddTag} className="bg-slate-100 px-4 rounded-lg font-bold text-slate-600 hover:bg-slate-200">Adicionar</button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {(formData.tags || []).map((t, i) => (
                        <span key={i} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm flex items-center gap-2 border border-indigo-100 font-medium">
                            {t} <button type="button" onClick={() => setFormData(p => ({...p, tags: p.tags?.filter((_, idx) => idx !== i)}))} className="hover:text-red-500"><X size={14}/></button>
                        </span>
                    ))}
                </div>
            </div>
         </div>

         {history.length > 0 && (
             <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Target size={20} className="text-orange-500"/> Histórico de Processos (Automático)</h3>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full text-sm text-left bg-white">
                        <thead className="bg-slate-100 text-slate-500 font-bold">
                            <tr>
                                <th className="p-3">Data</th>
                                <th className="p-3">Vaga</th>
                                <th className="p-3">Status Final</th>
                                <th className="p-3">Obs</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {history.map((h, i) => (
                                <tr key={i}>
                                    <td className="p-3">{new Date(h.date).toLocaleDateString()}</td>
                                    <td className="p-3 font-bold text-slate-700">{h.jobTitle}</td>
                                    <td className="p-3"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{h.status}</span></td>
                                    <td className="p-3 text-slate-500">{h.notes}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
         )}

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Briefcase size={20} className="text-slate-400"/> Experiência</h3>
                   <button type="button" onClick={addExperience} className="text-blue-600 text-sm font-bold hover:bg-blue-50 px-3 py-1 rounded transition-colors">+ Adicionar</button>
                </div>
                <div className="space-y-4">
                    {(formData.experience || []).map((exp, i) => (
                       <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="grid grid-cols-2 gap-3 mb-2">
                             <input placeholder="Empresa" className="border p-2 rounded text-sm font-bold" value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} />
                             <input placeholder="Cargo" className="border p-2 rounded text-sm" value={exp.role} onChange={e => updateExperience(i, 'role', e.target.value)} />
                             <input placeholder="Período" className="border p-2 rounded text-sm col-span-2" value={exp.period} onChange={e => updateExperience(i, 'period', e.target.value)} />
                          </div>
                          <textarea placeholder="Descrição das atividades..." className="w-full border p-2 rounded h-20 text-sm bg-white mb-2" value={exp.description} onChange={e => updateExperience(i, 'description', e.target.value)} />
                          <button type="button" onClick={() => removeExperience(i)} className="text-red-500 text-xs font-bold w-full text-right hover:underline">Remover Item</button>
                       </div>
                    ))}
                    {(formData.experience || []).length === 0 && <p className="text-slate-400 text-sm italic text-center py-4">Nenhuma experiência registrada.</p>}
                </div>
             </div>

             <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><GraduationCap size={20} className="text-slate-400"/> Formação</h3>
                   <button type="button" onClick={addEducation} className="text-blue-600 text-sm font-bold hover:bg-blue-50 px-3 py-1 rounded transition-colors">+ Adicionar</button>
                </div>
                <div className="space-y-4">
                    {(formData.education || []).map((edu, i) => (
                       <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="grid grid-cols-2 gap-3 mb-2">
                             <input placeholder="Instituição" className="border p-2 rounded text-sm font-bold col-span-2" value={edu.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} />
                             <input placeholder="Curso/Nível" className="border p-2 rounded text-sm" value={edu.level} onChange={e => updateEducation(i, 'level', e.target.value)} />
                             <input placeholder="Ano" className="border p-2 rounded text-sm" value={edu.conclusionYear} onChange={e => updateEducation(i, 'conclusionYear', e.target.value)} />
                          </div>
                          <button type="button" onClick={() => removeEducation(i)} className="text-red-500 text-xs font-bold w-full text-right hover:underline">Remover Item</button>
                       </div>
                    ))}
                    {(formData.education || []).length === 0 && <p className="text-slate-400 text-sm italic text-center py-4">Nenhuma formação registrada.</p>}
                </div>
             </div>
         </div>

         <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText size={20} className="text-slate-400"/> Observações Internas</h3>
            <div className="flex gap-2 mb-4">
                <input className="flex-1 border p-2.5 rounded-lg" value={obsInput} onChange={e => setObsInput(e.target.value)} placeholder="Nova observação..." onKeyDown={e => e.key === 'Enter' && handleAddObservation()} />
                <button type="button" onClick={handleAddObservation} className="bg-slate-800 text-white px-6 rounded-lg font-bold hover:bg-slate-900">Adicionar</button>
            </div>
            <ul className="space-y-2">
                {(formData.observations || []).map((obs, i) => (
                    <li key={i} className="text-sm text-slate-700 bg-yellow-50 p-3 rounded-lg border border-yellow-100 flex justify-between items-center group">
                        <span>{obs}</span>
                        <button type="button" onClick={() => setFormData(p => ({...p, observations: p.observations?.filter((_, idx) => idx !== i)}))} className="text-yellow-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14}/></button>
                    </li>
                ))}
            </ul>
         </div>
      </div>
    </div>
  );
};
