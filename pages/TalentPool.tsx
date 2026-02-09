import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Trash2, GraduationCap, Briefcase, 
  DollarSign, AlertTriangle, Link as LinkIcon, 
  Phone, Users, Edit2, ChevronLeft, ChevronRight
} from 'lucide-react';
import { TalentProfile, Candidate } from '../types';

const generateId = () => crypto.randomUUID();

export const TalentPool: React.FC = () => {
  const navigate = useNavigate();
  const { talents, removeTalent, jobs, addCandidate } = useData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'NAME_ASC' | 'NAME_DESC' | 'DATE_DESC' | 'DATE_ASC'>('DATE_DESC');
  
  // Modais
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // PAGINAÇÃO STATE
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;

  // Link State
  const [talentToLink, setTalentToLink] = useState<TalentProfile | null>(null);
  const [selectedJobId, setSelectedJobId] = useState('');

  // Delete State
  const [talentToDelete, setTalentToDelete] = useState<TalentProfile | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

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
      // Proteção contra datas nulas
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

      if (sortOrder === 'NAME_ASC') return (a.name || '').localeCompare(b.name || '');
      if (sortOrder === 'NAME_DESC') return (b.name || '').localeCompare(a.name || '');
      if (sortOrder === 'DATE_ASC') return dateA - dateB;
      return dateB - dateA;
    });
  }, [talents, searchTerm, sortOrder]);

  // Paginação
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

  // --- NAVEGAÇÃO ---
  const handleEditClick = (e: React.MouseEvent, talent: TalentProfile) => {
    e.stopPropagation();
    navigate(`/talents/${talent.id}`);
  };

  const handleNewTalentClick = () => {
    navigate('/talents/new');
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
    if (talentToDelete && deleteConfirmation.toUpperCase() === 'DELETE') {
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

      // Proteção contra contato nulo
      const safeContact = talentToLink.contact || '';
      const contactParts = safeContact.split('|');
      const email = contactParts[0]?.includes('@') ? contactParts[0].trim() : undefined;
      const phone = contactParts.find(p => p.match(/\d{8,}/))?.trim() || safeContact;

      const newCandidate: Candidate = {
        id: generateId(),
        jobId: selectedJob.id,
        name: talentToLink.name || 'Sem Nome',
        age: talentToLink.age,
        phone: phone,
        email: email,
        city: talentToLink.city,
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
        <button onClick={handleNewTalentClick} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-md font-bold transition-all">
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
               onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {paginatedTalents.map(t => {
          // --- CORREÇÃO DO CRASH ---
          // Garante que contact existe antes de dar split
          const safeContact = t.contact || '';
          const phoneRaw = safeContact.split('|').find(s => s.match(/\d{4,}/));
          const waLink = phoneRaw ? `https://wa.me/55${phoneRaw.replace(/\D/g, '')}` : null;
          
          return (
            <div key={t.id} className={`bg-white rounded-xl border p-6 shadow-sm hover:shadow-lg transition-all group relative ${t.needsReview ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
               {t.needsReview && (
                 <div className="absolute -top-3 -right-3 bg-amber-500 text-white p-2 rounded-full shadow-md z-10" title="Registro importado com dados faltantes. Revisar!">
                   <AlertTriangle size={16} fill="white" />
                 </div>
               )}

               <div className="flex justify-between items-start mb-3">
                 <div>
                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors cursor-pointer" onClick={(e) => handleEditClick(e, t)}>{t.name || 'Sem Nome'}</h3>
                    <p className="text-blue-600 font-bold text-sm uppercase tracking-wide">{t.targetRole}</p>
                 </div>
                 <span className="text-xs bg-slate-100 px-2 py-1 rounded font-bold text-slate-600">{t.age ? `${t.age} anos` : '-'}</span>
               </div>
               
               <div className="text-sm text-slate-500 space-y-1.5 mb-4">
                 <p>{t.city || 'Cidade N/I'}</p>
                 <div className="flex items-center gap-2">
                    <p className="truncate max-w-[180px]" title={safeContact}>{safeContact}</p>
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
                 <div className="flex items-center gap-1.5"><GraduationCap size={16} className="text-slate-400" /> {(t.education || []).length} Formações</div>
                 <div className="flex items-center gap-1.5"><Briefcase size={16} className="text-slate-400" /> {(t.experience || []).length} Experiências</div>
               </div>

               <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 bg-white/90 p-1 rounded-lg shadow-sm border border-slate-100">
                  <button onClick={(e) => handleLinkClick(e, t)} className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors" title="Vincular a uma vaga"><LinkIcon size={16} /></button>
                  <button onClick={(e) => handleEditClick(e, t)} className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors" title="Editar Talento"><Edit2 size={16} /></button>
                  <button onClick={(e) => handleDeleteClick(e, t)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors" title="Enviar para Lixeira"><Trash2 size={16} /></button>
               </div>
            </div>
          );
        })}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8 pb-8">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ChevronLeft size={20} /></button>
            <div className="flex gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button key={page} onClick={() => handlePageChange(page)} className={`w-10 h-10 rounded-lg font-bold text-sm transition-colors ${currentPage === page ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'}`}>{page}</button>
                ))}
            </div>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ChevronRight size={20} /></button>
        </div>
      )}

      {/* Modais de Link e Delete */}
      {isLinkModalOpen && talentToLink && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
             <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><LinkIcon size={20} className="text-blue-600"/> Vincular Candidato</h3>
             <p className="text-sm text-slate-500 mb-4">Selecione a vaga para vincular <strong>{talentToLink.name}</strong>.</p>
             <select className="w-full border p-3 rounded-lg mb-4 bg-white font-medium text-slate-700" value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}>
                 <option value="">Selecione a Vaga...</option>
                 {openJobs.map(j => (<option key={j.id} value={j.id}>{j.title} ({j.unit})</option>))}
             </select>
             <div className="flex justify-end gap-2">
                 <button onClick={() => setIsLinkModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded">Cancelar</button>
                 <button onClick={confirmLink} disabled={!selectedJobId} className="px-4 py-2 bg-blue-600 text-white font-bold rounded hover:bg-blue-700 disabled:bg-slate-300">Confirmar Vínculo</button>
             </div>
           </div>
        </div>
      )}

      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md border-t-4 border-red-500">
             <h3 className="text-xl font-bold mb-2 text-slate-800">Excluir Talento?</h3>
             <p className="text-sm text-slate-500 mb-4">Esta ação moverá <strong>{talentToDelete?.name}</strong> para a lixeira. Digite <strong>DELETE</strong> para confirmar.</p>
             <form onSubmit={confirmDelete}>
                 <input autoFocus className="w-full border p-2 rounded mb-4 text-center uppercase tracking-widest font-bold" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} placeholder="DELETE" />
                 <div className="flex gap-2">
                    <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50 rounded">Cancelar</button>
                    <button type="submit" disabled={deleteConfirmation.toUpperCase() !== 'DELETE'} className="flex-1 py-2 bg-red-600 disabled:bg-slate-300 text-white font-bold rounded hover:bg-red-700">Excluir</button>
                 </div>
             </form>
           </div>
        </div>
      )}
    </div>
  );
};
