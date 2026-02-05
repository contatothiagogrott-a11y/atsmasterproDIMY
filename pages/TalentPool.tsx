import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Plus, Search, Trash2, GraduationCap, Briefcase, DollarSign, AlertTriangle, FileText, Link as LinkIcon, History, Phone, AlertCircle, ArrowDownAZ, ArrowUpAZ, Calendar } from 'lucide-react';
import { TalentProfile, Education, Experience, TransportType, Candidate } from '../types';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const TalentPool: React.FC = () => {
  const { talents, addTalent, removeTalent, jobs, addCandidate, candidates } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'NAME_ASC' | 'NAME_DESC' | 'DATE_DESC' | 'DATE_ASC'>('DATE_DESC');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Link to Job State
  const [talentToLink, setTalentToLink] = useState<TalentProfile | null>(null);
  const [selectedJobId, setSelectedJobId] = useState('');

  // Delete State
  const [talentToDelete, setTalentToDelete] = useState<TalentProfile | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Form State
  const [formData, setFormData] = useState<Partial<TalentProfile>>({
    education: [],
    experience: [],
    tags: [],
    observations: []
  });
  const [tagInput, setTagInput] = useState('');
  const [obsInput, setObsInput] = useState('');
  const [activeModalTab, setActiveModalTab] = useState<'PROFILE' | 'HISTORY'>('PROFILE');

  // Filter Logic with Null Safety and Sorting
  const filteredTalents = useMemo(() => {
    const safeTalents = talents || [];
    let result = safeTalents;
    
    // Filtering
    if (searchTerm) {
      const terms = searchTerm.toLowerCase().split(';').map(t => t.trim()).filter(Boolean);
      result = safeTalents.filter(t => {
        return terms.some(term => {
          const inTags = (t.tags || []).some(tag => tag.toLowerCase().includes(term));
          const inExp = (t.experience || []).some(e => e.description.toLowerCase().includes(term) || e.role.toLowerCase().includes(term));
          const inName = (t.name || '').toLowerCase().includes(term);
          const inRole = (t.targetRole || '').toLowerCase().includes(term);
          return inTags || inExp || inName || inRole;
        });
      });
    }

    // Sorting
    return result.sort((a, b) => {
      if (sortOrder === 'NAME_ASC') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (sortOrder === 'NAME_DESC') {
        return (b.name || '').localeCompare(a.name || '');
      } else if (sortOrder === 'DATE_ASC') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        // DATE_DESC (Default)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  }, [talents, searchTerm, sortOrder]);

  // Open Jobs for linking
  const openJobs = useMemo(() => (jobs || []).filter(j => j.status === 'Aberta'), [jobs]);

  // History Data Generator with Null Safety
  const getTalentHistory = (talent: TalentProfile) => {
    if (!talent || !talent.contact) return [];
    
    // Find all applications where email matches OR phone matches
    return (candidates || []).filter(c => 
      (c.email && talent.contact.includes(c.email)) || 
      (c.phone && talent.contact.includes(c.phone))
    ).map(c => {
       const job = jobs.find(j => j.id === c.jobId);
       return {
         date: c.createdAt,
         jobTitle: job ? job.title : 'Vaga Desconhecida',
         status: c.status,
         notes: c.rejectionReason || (c.status === 'Contratado' ? 'Aprovado e Contratado' : 'Processo em andamento'),
         jobStatus: job ? job.status : ''
       };
    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const openModal = (talent?: TalentProfile) => {
    setActiveModalTab('PROFILE');
    if (talent) {
      setEditingId(talent.id);
      // Deep copy to prevent mutating state directly
      setFormData(JSON.parse(JSON.stringify(talent)));
    } else {
      setEditingId(null);
      setFormData({
        education: [],
        experience: [],
        tags: [],
        transportation: 'Consegue vir até a empresa',
        observations: []
      });
    }
    setTagInput('');
    setObsInput('');
    setIsModalOpen(true);
  };

  const handleLinkClick = (e: React.MouseEvent, talent: TalentProfile) => {
    e.stopPropagation();
    setTalentToLink(talent);
    setSelectedJobId('');
    setIsLinkModalOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, talent: TalentProfile) => {
    e.stopPropagation();
    setTalentToDelete(talent);
    setDeleteConfirmation('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (talentToDelete && deleteConfirmation === 'DELETE') {
      removeTalent(talentToDelete.id);
      alert('Candidato movido para a lixeira com sucesso.');
      setIsDeleteModalOpen(false);
      setTalentToDelete(null);
    }
  };

  const confirmLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (talentToLink && selectedJobId) {
      const selectedJob = jobs.find(j => j.id === selectedJobId);
      if (!selectedJob) return;

      const newCandidate: Candidate = {
        id: generateId(),
        jobId: selectedJob.id,
        name: talentToLink.name,
        age: talentToLink.age,
        phone: talentToLink.contact.split('|')[1]?.trim() || talentToLink.contact,
        email: talentToLink.contact.includes('@') ? talentToLink.contact.split('|')[0]?.trim() : undefined,
        origin: 'Banco de Talentos', // Auto-set
        status: 'Aguardando Triagem',
        createdAt: new Date().toISOString(),
        salaryExpectation: talentToLink.salaryExpectation,
        notes: `Importado do Banco de Talentos. Tags: ${talentToLink.tags?.join(', ') || ''}`
      };

      addCandidate(newCandidate);
      alert(`Candidato ${talentToLink.name} vinculado à vaga ${selectedJob.title} com sucesso!`);
      setIsLinkModalOpen(false);
      setTalentToLink(null);
    }
  };

  const handleAddTag = () => {
    if(tagInput.trim()) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tagInput.trim()] }));
      setTagInput('');
    }
  };

  const handleAddObservation = () => {
    if(obsInput.trim()) {
      const timestamp = new Date().toLocaleDateString('pt-BR');
      const newObs = `${timestamp}: ${obsInput.trim()}`;
      setFormData(prev => ({ ...prev, observations: [...(prev.observations || []), newObs] }));
      setObsInput('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTalent({
      id: editingId || generateId(),
      name: formData.name!,
      age: Number(formData.age),
      contact: formData.contact!,
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
    });
    setIsModalOpen(false);
  };

  // Helper for repeater fields (Education/Experience) - Safe Array Access
  const addEducation = () => setFormData(prev => ({ ...prev, education: [...(prev.education || []), { institution: '', level: '', status: 'Completo', conclusionYear: '' }] }));
  const updateEducation = (i: number, f: keyof Education, v: string) => { const list = [...(formData.education || [])]; list[i] = { ...list[i], [f]: v }; setFormData(p => ({ ...p, education: list })); };
  const removeEducation = (i: number) => setFormData(p => ({ ...p, education: p.education?.filter((_, idx) => idx !== i) }));

  const addExperience = () => setFormData(prev => ({ ...prev, experience: [...(prev.experience || []), { company: '', role: '', period: '', description: '' }] }));
  const updateExperience = (i: number, f: keyof Experience, v: string) => { const list = [...(formData.experience || [])]; list[i] = { ...list[i], [f]: v }; setFormData(p => ({ ...p, experience: list })); };
  const removeExperience = (i: number) => setFormData(p => ({ ...p, experience: p.experience?.filter((_, idx) => idx !== i) }));


  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Banco de Talentos</h1>
           <p className="text-slate-500 mt-1">Repositório de perfis qualificados</p>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-md font-bold transition-all">
          <Plus size={20} /> Novo Talento
        </button>
      </div>

      <div className="relative mb-8 flex gap-2">
         <div className="relative flex-1">
             <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
             <input 
               type="text" 
               placeholder='Buscar por tags, nome ou experiência (separe por ";")'
               className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
         </div>
         <select 
           value={sortOrder}
           onChange={(e) => setSortOrder(e.target.value as any)}
           className="px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-600 cursor-pointer min-w-[200px]"
         >
           <option value="DATE_DESC">Mais Recentes (Data)</option>
           <option value="DATE_ASC">Mais Antigos (Data)</option>
           <option value="NAME_ASC">Nome (A-Z)</option>
           <option value="NAME_DESC">Nome (Z-A)</option>
         </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTalents.map(t => {
          const phoneRaw = t.contact.split('|').find(s => s.match(/\d{4,}/));
          const waLink = phoneRaw ? `https://wa.me/55${phoneRaw.replace(/\D/g, '')}` : null;
          
          return (
            <div 
              key={t.id} 
              onClick={() => openModal(t)}
              className={`bg-white rounded-xl border p-6 shadow-sm hover:shadow-lg transition-all cursor-pointer group relative
                ${t.needsReview ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}
              `}
            >
               {t.needsReview && (
                 <div className="absolute -top-3 -right-3 bg-amber-500 text-white p-2 rounded-full shadow-md z-10" title="Registro importado com dados faltantes. Revisar!">
                   <AlertTriangle size={16} fill="white" />
                 </div>
               )}
  
               <div className="flex justify-between items-start mb-3">
                 <div>
                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{t.name}</h3>
                    <p className="text-blue-600 font-bold text-sm uppercase tracking-wide">{t.targetRole}</p>
                 </div>
                 <span className="text-xs bg-slate-100 px-2 py-1 rounded font-bold text-slate-600">{t.age} anos</span>
               </div>
               
               <div className="text-sm text-slate-500 space-y-1.5 mb-4">
                 <p>{t.city}</p>
                 <div className="flex items-center gap-2">
                    <p className="truncate">{t.contact}</p>
                    {waLink && (
                        <a href={waLink} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white p-1 rounded-full hover:bg-green-600 transition-colors" title="WhatsApp">
                            <Phone size={12} fill="white"/>
                        </a>
                    )}
                 </div>
                 {t.salaryExpectation && <p className="text-emerald-600 font-bold flex items-center gap-1"><DollarSign size={14}/> {t.salaryExpectation}</p>}
               </div>
  
               <div className="flex flex-wrap gap-2 mb-4">
                 {(t.tags || []).map((tag, i) => (
                   <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100 font-medium">{tag}</span>
                 ))}
               </div>
               
               <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
                 <div className="flex items-center gap-1.5">
                   <GraduationCap size={16} className="text-slate-400" /> {(t.education || []).length} Formações
                 </div>
                 <div className="flex items-center gap-1.5">
                   <Briefcase size={16} className="text-slate-400" /> {(t.experience || []).length} Experiências
                 </div>
               </div>
  
               {/* Action Bar */}
               <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                  <button 
                    onClick={(e) => handleLinkClick(e, t)}
                    className="bg-blue-600 text-white p-2 rounded-lg shadow-lg hover:bg-blue-700 flex items-center gap-1 text-xs font-bold"
                    title="Vincular a uma vaga"
                  >
                    <LinkIcon size={14} /> Vincular
                  </button>
                  <button 
                    onClick={(e) => handleDeleteClick(e, t)}
                    className="bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100 transition-colors"
                    title="Enviar para Lixeira"
                  >
                    <Trash2 size={14} />
                  </button>
               </div>
            </div>
          );
        })}
      </div>

      {/* --- Delete Confirmation Modal --- */}
      {isDeleteModalOpen && talentToDelete && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border-t-4 border-red-500">
             <div className="flex justify-center mb-4">
               <div className="bg-red-100 p-3 rounded-full text-red-600">
                 <AlertCircle size={32} />
               </div>
             </div>
             <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Confirmar Exclusão</h3>
             <p className="text-sm text-slate-600 text-center mb-6">
               Você tem certeza que deseja enviar <strong>{talentToDelete.name}</strong> para a Lixeira? 
               Ele não aparecerá mais em novas buscas.
             </p>
             
             <form onSubmit={confirmDelete} className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">
                   Digite <span className="text-red-600">DELETE</span> para confirmar:
                 </label>
                 <input 
                   autoFocus
                   type="text" 
                   className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-red-500 text-center font-bold tracking-widest uppercase"
                   value={deleteConfirmation}
                   onChange={e => setDeleteConfirmation(e.target.value)}
                   placeholder="Confirmação"
                 />
               </div>
               
               <div className="flex gap-2 pt-2">
                 <button 
                   type="button" 
                   onClick={() => setIsDeleteModalOpen(false)} 
                   className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="submit" 
                   disabled={deleteConfirmation !== 'DELETE'}
                   className="flex-1 bg-red-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl shadow-lg transition-all transform enabled:hover:bg-red-700 enabled:active:scale-95"
                 >
                   Confirmar Exclusão
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* --- Link to Job Modal --- */}
      {isLinkModalOpen && talentToLink && (
        <div className="fixed inset-0 bg-blue-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
             <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <LinkIcon size={20} className="text-blue-600"/> Vincular Talento
               </h3>
               <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
             </div>
             <p className="text-sm text-slate-600 mb-4">
               Selecione uma vaga aberta para vincular <strong>{talentToLink.name}</strong>. 
               Isso criará um novo registro de candidatura.
             </p>
             <form onSubmit={confirmLink}>
               <label className="block text-sm font-bold text-slate-700 mb-2">Vaga Destino</label>
               <select 
                 required 
                 className="w-full border border-slate-300 p-3 rounded-lg bg-white mb-6 outline-none focus:ring-2 focus:ring-blue-500"
                 value={selectedJobId}
                 onChange={e => setSelectedJobId(e.target.value)}
               >
                 <option value="">Selecione a vaga...</option>
                 {openJobs.map(j => (
                   <option key={j.id} value={j.id}>{j.title} ({j.unit})</option>
                 ))}
               </select>
               <div className="flex justify-end gap-2">
                 <button type="button" onClick={() => setIsLinkModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                 <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700">Confirmar Vinculação</button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* --- Edit/Create/History Modal --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-blue-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
             <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
               <div className="flex gap-4 items-center">
                 <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Perfil do Talento' : 'Novo Talento'}</h3>
                 {editingId && (
                   <div className="flex bg-slate-100 rounded-lg p-1">
                      <button onClick={() => setActiveModalTab('PROFILE')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeModalTab === 'PROFILE' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Dados</button>
                      <button onClick={() => setActiveModalTab('HISTORY')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeModalTab === 'HISTORY' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Linha do Tempo</button>
                   </div>
                 )}
               </div>
               <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
             </div>
             
             {activeModalTab === 'PROFILE' ? (
               <form onSubmit={handleSubmit} className="p-8 space-y-8 animate-fadeIn">
                {/* Form Content */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label>
                    <input required type="text" className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Idade</label>
                    <input required type="number" className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Cargo Pretendido</label>
                    <input required type="text" className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.targetRole || ''} onChange={e => setFormData({...formData, targetRole: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Cidade</label>
                    <input required type="text" className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Contato</label>
                    <input required type="text" className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.contact || ''} onChange={e => setFormData({...formData, contact: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Pretensão Salarial</label>
                    <input type="text" className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: R$ 5.000,00" value={formData.salaryExpectation || ''} onChange={e => setFormData({...formData, salaryExpectation: e.target.value})} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Locomoção</label>
                    <select 
                      className="w-full border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                      value={formData.transportation || 'Consegue vir até a empresa'} 
                      onChange={e => setFormData({...formData, transportation: e.target.value as TransportType})}
                    >
                      <option value="Consegue vir até a empresa">Consegue vir até a empresa</option>
                      <option value="Precisa de transporte (van)">Precisa de transporte (van)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Tags / Palavras-chave</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      className="flex-1 border border-slate-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                      value={tagInput} 
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      placeholder="Ex: Java, Inglês Avançado..."
                    />
                    <button type="button" onClick={handleAddTag} className="bg-slate-200 px-6 rounded-lg hover:bg-slate-300 font-bold text-slate-700">Adicionar</button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(formData.tags || []).map((tag, i) => (
                      <span key={i} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                        {tag} <button type="button" onClick={() => setFormData({...formData, tags: formData.tags?.filter((_, idx) => idx !== i)})} className="hover:text-red-500 font-bold">&times;</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-yellow-50 p-5 rounded-xl border border-yellow-200">
                   <label className="block text-sm font-bold text-yellow-800 mb-2 flex items-center gap-2">
                      <FileText size={18}/> Observações Gerais
                   </label>
                   <div className="flex gap-2 mb-3">
                      <input 
                        type="text" 
                        className="flex-1 border border-yellow-300 p-2 rounded outline-none" 
                        placeholder="Adicione uma observação..." 
                        value={obsInput}
                        onChange={e => setObsInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddObservation())}
                      />
                      <button type="button" onClick={handleAddObservation} className="bg-yellow-200 text-yellow-800 px-3 py-2 rounded hover:bg-yellow-300"><Plus size={20}/></button>
                   </div>
                   <div className="space-y-1 max-h-32 overflow-y-auto">
                      {(formData.observations || []).map((obs, i) => (
                        <div key={i} className="text-xs bg-white p-2 rounded border border-yellow-100 text-slate-600">
                           {obs}
                        </div>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold flex items-center gap-2 text-slate-700"><GraduationCap size={20}/> Formação</h4>
                      <button type="button" onClick={addEducation} className="text-blue-600 text-sm font-bold hover:underline">+ Adicionar</button>
                    </div>
                    <div className="space-y-4">
                       {(formData.education || []).map((edu, i) => (
                         <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 text-sm relative shadow-sm">
                           <button type="button" onClick={() => removeEducation(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                           <input placeholder="Instituição" className="w-full mb-2 border-b p-1 outline-none font-medium" value={edu.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} />
                           <div className="grid grid-cols-2 gap-2"><input placeholder="Nível" className="border-b p-1 outline-none" value={edu.level} onChange={e => updateEducation(i, 'level', e.target.value)} /><input placeholder="Conclusão" className="border-b p-1 outline-none" value={edu.conclusionYear} onChange={e => updateEducation(i, 'conclusionYear', e.target.value)} /></div>
                         </div>
                       ))}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold flex items-center gap-2 text-slate-700"><Briefcase size={20}/> Experiência</h4>
                      <button type="button" onClick={addExperience} className="text-blue-600 text-sm font-bold hover:underline">+ Adicionar</button>
                    </div>
                     <div className="space-y-4">
                       {(formData.experience || []).map((exp, i) => (
                         <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 text-sm relative shadow-sm">
                           <button type="button" onClick={() => removeExperience(i)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 size={14}/></button>
                           <input placeholder="Empresa" className="w-full mb-2 border-b p-1 outline-none font-medium" value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} />
                           <div className="grid grid-cols-2 gap-2 mb-2"><input placeholder="Cargo" className="border-b p-1 outline-none" value={exp.role} onChange={e => updateExperience(i, 'role', e.target.value)} /><input placeholder="Período" className="border-b p-1 outline-none" value={exp.period} onChange={e => updateExperience(i, 'period', e.target.value)} /></div>
                           <textarea placeholder="Descrição" rows={2} className="w-full border p-1 rounded text-xs" value={exp.description} onChange={e => updateExperience(i, 'description', e.target.value)} />
                         </div>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={(e) => editingId && handleDeleteClick(e, formData as TalentProfile)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${editingId ? 'text-red-600 hover:bg-red-50' : 'opacity-0 pointer-events-none'}`}
                  >
                    <Trash2 size={18}/> Excluir Candidato
                  </button>
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-transform hover:-translate-y-0.5">Salvar Perfil</button>
                </div>
             </form>
             ) : (
               // HISTORY TAB
               <div className="p-8 animate-fadeIn">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-slate-800">
                    <History size={20}/> Histórico de Processos
                  </h3>
                  
                  <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                     {getTalentHistory(formData as TalentProfile).map((item, idx) => (
                        <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                           <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                              <Briefcase size={16} className="text-slate-500"/>
                           </div>
                           <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-start mb-1">
                                <time className="font-caveat font-bold text-indigo-500 text-sm">{new Date(item.date).toLocaleDateString()}</time>
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">{item.jobStatus}</span>
                              </div>
                              <h4 className="font-bold text-slate-700 mb-2">{item.jobTitle}</h4>
                              <div className="text-sm text-slate-600">
                                <span className={`font-bold px-2 py-0.5 rounded text-xs mr-2
                                   ${item.status === 'Contratado' ? 'bg-green-100 text-green-700' : 
                                     item.status.includes('Reprovado') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}
                                `}>
                                   {item.status}
                                </span>
                                <span className="block mt-2 italic text-xs text-slate-500">
                                   Obs: {item.notes}
                                </span>
                              </div>
                           </div>
                        </div>
                     ))}
                     {getTalentHistory(formData as TalentProfile).length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                           Nenhum histórico de processos encontrado para este candidato.
                        </div>
                     )}
                  </div>
               </div>
             )}
           </div>
        </div>
      )}
    </div>
  );
};