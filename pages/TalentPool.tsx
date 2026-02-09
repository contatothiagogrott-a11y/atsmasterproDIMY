import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  Plus, Search, Trash2, GraduationCap, Briefcase, 
  DollarSign, AlertTriangle, FileText, Link as LinkIcon, 
  Phone, Users, Edit2, ChevronLeft, ChevronRight, X, Check, Save
} from 'lucide-react';
import { TalentProfile, Education, Experience, Candidate } from '../types';

const generateId = () => crypto.randomUUID();

export const TalentPool: React.FC = () => {
  // Adicionei updateTalent aqui
  const { talents, addTalent, updateTalent, removeTalent, jobs, addCandidate, candidates } = useData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'NAME_ASC' | 'NAME_DESC' | 'DATE_DESC' | 'DATE_ASC'>('DATE_DESC');
  
  // States dos Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // State de Edição
  const [editingId, setEditingId] = useState<string | null>(null);

  // PAGINAÇÃO STATE
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

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

  // Filter Logic
  const filteredTalents = useMemo(() => {
    const safeTalents = talents || [];
    let result = safeTalents;
    
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

    return result.sort((a, b) => {
      if (sortOrder === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '');
      if (sortOrder === 'NAME_DESC') return (b.name || '').localeCompare(a.name || '');
      if (sortOrder === 'DATE_ASC') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [talents, searchTerm, sortOrder]);

  // LÓGICA DE PAGINAÇÃO
  const totalPages = Math.ceil(filteredTalents.length / ITEMS_PER_PAGE);
  const paginatedTalents = filteredTalents.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openJobs = useMemo(() => (jobs || []).filter(j => j.status === 'Aberta'), [jobs]);

  const openModal = (talent?: TalentProfile) => {
    setActiveModalTab('PROFILE');
    if (talent) {
      setEditingId(talent.id);
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

  const handleEditClick = (e: React.MouseEvent, talent: TalentProfile) => {
    e.stopPropagation(); // Impede abrir o modal de visualização se houver
    openModal(talent);
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
      setIsDeleteModalOpen(false);
      setTalentToDelete(null);
    }
  };

  const confirmLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (talentToLink && selectedJobId) {
      const selectedJob = jobs.find(j => j.id === selectedJobId);
      if (!selectedJob) return;

      // Extrair email e telefone do campo contact
      const contactParts = talentToLink.contact.split('|');
      const email = contactParts[0]?.includes('@') ? contactParts[0].trim() : undefined;
      const phone = contactParts.find(p => p.match(/\d{8,}/))?.trim() || talentToLink.contact;

      const newCandidate: Candidate = {
        id: generateId(),
        jobId: selectedJob.id,
        name: talentToLink.name,
        age: talentToLink.age,
        phone: phone,
        email: email, // Transfere Email
        city: talentToLink.city, // Transfere Cidade/Endereço
        origin: 'Banco de Talentos',
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
    const payload = {
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
    };

    if (editingId) {
        updateTalent(payload); // Atualiza
    } else {
        addTalent(payload); // Cria
    }
    setIsModalOpen(false);
  };

  const addEducation = () => setFormData(prev => ({ ...prev, education: [...(prev.education || []), { institution: '', level: '', status: 'Completo', conclusionYear: '' }] }));
  const updateEducation = (i: number, f: keyof Education, v: string) => { const list = [...(formData.education || [])]; list[i] = { ...list[i], [f]: v }; setFormData(p => ({ ...p, education: list })); };
  const removeEducation = (i: number) => setFormData(p => ({ ...p, education: p.education?.filter((_, idx) => idx !== i) }));

  const addExperience = () => setFormData(prev => ({ ...prev, experience: [...(prev.experience || []), { company: '', role: '', period: '', description: '' }] }));
  const updateExperience = (i: number, f: keyof Experience, v: string) => { const list = [...(formData.experience || [])]; list[i] = { ...list[i], [f]: v }; setFormData(p => ({ ...p, experience: list })); };
  const removeExperience = (i: number) => setFormData(p => ({ ...p, experience: p.experience?.filter((_, idx) => idx !== i) }));

  return (
    <div className="pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex flex-col">
           <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Banco de Talentos</h1>
              <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full flex items-center gap-2 border border-blue-200 shadow-sm animate-fadeIn">
                 <Users size={16} />
                 <span className="text-sm font-black">{filteredTalents.length}</span>
              </div>
           </div>
           <p className="text-slate-500 mt-1">Repositório de perfis qualificados para futuras oportunidades</p>
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
               onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} // Reset page on search
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

      {/* GRID DE TALENTOS PAGINADO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {paginatedTalents.map(t => {
          const phoneRaw = t.contact.split('|').find(s => s.match(/\d{4,}/));
          const waLink = phoneRaw ? `https://wa.me/55${phoneRaw.replace(/\D/g, '')}` : null;
          
          return (
            <div 
              key={t.id} 
              className={`bg-white rounded-xl border p-6 shadow-sm hover:shadow-lg transition-all group relative
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
                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors cursor-pointer" onClick={() => openModal(t)}>{t.name}</h3>
                    <p className="text-blue-600 font-bold text-sm uppercase tracking-wide">{t.targetRole}</p>
                 </div>
                 <span className="text-xs bg-slate-100 px-2 py-1 rounded font-bold text-slate-600">{t.age} anos</span>
               </div>
               
               <div className="text-sm text-slate-500 space-y-1.5 mb-4">
                 <p>{t.city}</p>
                 <div className="flex items-center gap-2">
                    <p className="truncate max-w-[180px]" title={t.contact}>{t.contact}</p>
                    {waLink && (
                        <a href={waLink} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer" className="bg-green-500 text-white p-1 rounded-full hover:bg-green-600 transition-colors" title="WhatsApp">
                            <Phone size={12} fill="white"/>
                        </a>
                    )}
                 </div>
                 {t.salaryExpectation && <p className="text-emerald-600 font-bold flex items-center gap-1"><DollarSign size={14}/> {t.salaryExpectation}</p>}
               </div>
 
               <div className="flex flex-wrap gap-2 mb-4">
                 {(t.tags || []).slice(0, 4).map((tag, i) => (
                   <span key={i} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100 font-medium">{tag}</span>
                 ))}
                 {(t.tags || []).length > 4 && <span className="text-xs text-slate-400">+{t.tags!.length - 4}</span>}
               </div>
               
               <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-500">
                 <div className="flex items-center gap-1.5">
                   <GraduationCap size={16} className="text-slate-400" /> {(t.education || []).length} Formações
                 </div>
                 <div className="flex items-center gap-1.5">
                   <Briefcase size={16} className="text-slate-400" /> {(t.experience || []).length} Experiências
                 </div>
               </div>
 
               {/* AÇÕES FLUTUANTES (Agora visíveis no Hover) */}
               <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white/90 p-1 rounded-lg shadow-sm border border-slate-100">
                  <button 
                    onClick={(e) => handleLinkClick(e, t)}
                    className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                    title="Vincular a uma vaga"
                  >
                    <LinkIcon size={16} />
                  </button>
                  <button 
                    onClick={(e) => handleEditClick(e, t)}
                    className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                    title="Editar Talento"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={(e) => handleDeleteClick(e, t)}
                    className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                    title="Enviar para Lixeira"
                  >
                    <Trash2 size={16} />
                  </button>
               </div>
            </div>
          );
        })}
      </div>

      {/* COMPONENTE DE PAGINAÇÃO */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8 pb-8">
            <button 
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronLeft size={20} />
            </button>
            
            <div className="flex gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    // Lógica para mostrar apenas algumas páginas se houver muitas (Opcional, aqui mostra todas se for poucas)
                    <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`w-10 h-10 rounded-lg font-bold text-sm transition-colors ${
                            currentPage === page 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {page}
                    </button>
                ))}
            </div>

            <button 
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronRight size={20} />
            </button>
        </div>
      )}

      {/* --- MODAL VINCULAR VAGA --- */}
      {isLinkModalOpen && talentToLink && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><LinkIcon size={20} className="text-blue-600"/> Vincular Candidato</h3>
              <p className="text-sm text-slate-500 mb-4">Selecione a vaga para vincular <strong>{talentToLink.name}</strong>. Os dados serão copiados.</p>
              
              <select 
                className="w-full border p-3 rounded-lg mb-4 bg-white font-medium text-slate-700"
                value={selectedJobId}
                onChange={e => setSelectedJobId(e.target.value)}
              >
                 <option value="">Selecione a Vaga...</option>
                 {openJobs.map(j => (
                    <option key={j.id} value={j.id}>{j.title} ({j.unit})</option>
                 ))}
              </select>

              <div className="flex justify-end gap-2">
                 <button onClick={() => setIsLinkModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded">Cancelar</button>
                 <button onClick={confirmLink} disabled={!selectedJobId} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:bg-slate-300">Confirmar Vínculo</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL DELETAR --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-t-4 border-red-500">
              <h3 className="text-xl font-bold mb-2 text-slate-800">Excluir Talento?</h3>
              <p className="text-sm text-slate-500 mb-4">Esta ação moverá <strong>{talentToDelete?.name}</strong> para a lixeira. Digite <strong>DELETE</strong> para confirmar.</p>
              <form onSubmit={confirmDelete}>
                 <input autoFocus className="w-full border p-2 rounded mb-4 text-center uppercase tracking-widest font-bold" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} placeholder="DELETE" />
                 <div className="flex gap-2">
                    <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50 rounded">Cancelar</button>
                    <button type="submit" disabled={deleteConfirmation !== 'DELETE'} className="flex-1 py-2 bg-red-600 disabled:bg-slate-300 text-white font-bold rounded hover:bg-red-700">Excluir</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* --- MODAL DE CRIAR/EDITAR (Completo) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                 <div>
                    <h2 className="text-2xl font-bold text-slate-800">{editingId ? 'Editar Talento' : 'Novo Talento'}</h2>
                    <p className="text-sm text-slate-500">Preencha os dados do perfil profissional</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600"><X size={24}/></button>
              </div>

              <div className="p-8 space-y-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Nome Completo</label><input required className="w-full border p-2.5 rounded-lg" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Idade</label><input type="number" className="w-full border p-2.5 rounded-lg" value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})} /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Contato (Email | Tel)</label><input required className="w-full border p-2.5 rounded-lg" value={formData.contact || ''} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="email@exemplo.com | (11) 99999-9999" /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Cidade</label><input className="w-full border p-2.5 rounded-lg" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Cargo Alvo</label><input className="w-full border p-2.5 rounded-lg" value={formData.targetRole || ''} onChange={e => setFormData({...formData, targetRole: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Pretensão Salarial</label><input className="w-full border p-2.5 rounded-lg" value={formData.salaryExpectation || ''} onChange={e => setFormData({...formData, salaryExpectation: e.target.value})} /></div>
                 </div>

                 {/* Tags */}
                 <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Tags / Habilidades</label>
                    <div className="flex gap-2 mb-2">
                       <input className="flex-1 border p-2.5 rounded-lg" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTag()} placeholder="Ex: Excel Avançado, Inglês..." />
                       <button type="button" onClick={handleAddTag} className="bg-slate-100 px-4 rounded-lg font-bold text-slate-600 hover:bg-slate-200">Add</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {(formData.tags || []).map((t, i) => (
                          <span key={i} className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-sm flex items-center gap-1 border border-indigo-100">
                             {t} <button type="button" onClick={() => setFormData(p => ({...p, tags: p.tags?.filter((_, idx) => idx !== i)}))} className="hover:text-red-500"><X size={12}/></button>
                          </span>
                       ))}
                    </div>
                 </div>

                 {/* Experiência */}
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                       <h3 className="font-bold text-slate-700 flex items-center gap-2"><Briefcase size={18}/> Experiência Profissional</h3>
                       <button type="button" onClick={addExperience} className="text-blue-600 text-sm font-bold hover:underline">+ Adicionar</button>
                    </div>
                    {(formData.experience || []).map((exp, i) => (
                       <div key={i} className="mb-4 pb-4 border-b border-slate-200 last:border-0 last:pb-0">
                          <div className="grid grid-cols-2 gap-3 mb-2">
                             <input placeholder="Empresa" className="border p-2 rounded" value={exp.company} onChange={e => updateExperience(i, 'company', e.target.value)} />
                             <input placeholder="Cargo" className="border p-2 rounded" value={exp.role} onChange={e => updateExperience(i, 'role', e.target.value)} />
                             <input placeholder="Período" className="border p-2 rounded" value={exp.period} onChange={e => updateExperience(i, 'period', e.target.value)} />
                             <button type="button" onClick={() => removeExperience(i)} className="text-red-500 text-xs font-bold text-right">Remover</button>
                          </div>
                          <textarea placeholder="Descrição das atividades..." className="w-full border p-2 rounded h-20 text-sm" value={exp.description} onChange={e => updateExperience(i, 'description', e.target.value)} />
                       </div>
                    ))}
                 </div>

                 {/* Formação */}
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                       <h3 className="font-bold text-slate-700 flex items-center gap-2"><GraduationCap size={18}/> Formação Acadêmica</h3>
                       <button type="button" onClick={addEducation} className="text-blue-600 text-sm font-bold hover:underline">+ Adicionar</button>
                    </div>
                    {(formData.education || []).map((edu, i) => (
                       <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2 items-center">
                          <input placeholder="Instituição" className="border p-2 rounded" value={edu.institution} onChange={e => updateEducation(i, 'institution', e.target.value)} />
                          <input placeholder="Curso/Nível" className="border p-2 rounded" value={edu.level} onChange={e => updateEducation(i, 'level', e.target.value)} />
                          <input placeholder="Ano Conclusão" className="border p-2 rounded" value={edu.conclusionYear} onChange={e => updateEducation(i, 'conclusionYear', e.target.value)} />
                          <button type="button" onClick={() => removeEducation(i)} className="text-red-500 text-xs font-bold">Remover</button>
                       </div>
                    ))}
                 </div>

                 {/* Observações */}
                 <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Observações Internas</label>
                    <div className="flex gap-2 mb-2">
                       <input className="flex-1 border p-2.5 rounded-lg" value={obsInput} onChange={e => setObsInput(e.target.value)} placeholder="Nova observação..." />
                       <button type="button" onClick={handleAddObservation} className="bg-slate-800 text-white px-4 rounded-lg font-bold">Add</button>
                    </div>
                    <ul className="space-y-1">
                       {(formData.observations || []).map((obs, i) => (
                          <li key={i} className="text-sm text-slate-600 bg-yellow-50 p-2 rounded border border-yellow-100">{obs}</li>
                       ))}
                    </ul>
                 </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancelar</button>
                 <button onClick={handleSubmit} className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow hover:bg-blue-700 flex items-center gap-2">
                    <Save size={18}/> Salvar Talento
                 </button>
              </div>
           </div>
        </div>
      )}
      
    </div>
  );
};
