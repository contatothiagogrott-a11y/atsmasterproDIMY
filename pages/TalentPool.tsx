import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
// Adicionado o ícone 'Users' na importação
import { 
  Plus, Search, Trash2, GraduationCap, Briefcase, 
  DollarSign, AlertTriangle, FileText, Link as LinkIcon, 
  History, Phone, AlertCircle, Users, ArrowDownAZ, 
  ArrowUpAZ, Calendar 
} from 'lucide-react';
import { TalentProfile, Education, Experience, TransportType, Candidate } from '../types';

const generateId = () => crypto.randomUUID();

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
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  }, [talents, searchTerm, sortOrder]);

  // Open Jobs for linking
  const openJobs = useMemo(() => (jobs || []).filter(j => j.status === 'Aberta'), [jobs]);

  // History Data Generator with Null Safety
  const getTalentHistory = (talent: TalentProfile) => {
    if (!talent || !talent.contact) return [];
    
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

  const addEducation = () => setFormData(prev => ({ ...prev, education: [...(prev.education || []), { institution: '', level: '', status: 'Completo', conclusionYear: '' }] }));
  const updateEducation = (i: number, f: keyof Education, v: string) => { const list = [...(formData.education || [])]; list[i] = { ...list[i], [f]: v }; setFormData(p => ({ ...p, education: list })); };
  const removeEducation = (i: number) => setFormData(p => ({ ...p, education: p.education?.filter((_, idx) => idx !== i) }));

  const addExperience = () => setFormData(prev => ({ ...prev, experience: [...(prev.experience || []), { company: '', role: '', period: '', description: '' }] }));
  const updateExperience = (i: number, f: keyof Experience, v: string) => { const list = [...(formData.experience || [])]; list[i] = { ...list[i], [f]: v }; setFormData(p => ({ ...p, experience: list })); };
  const removeExperience = (i: number) => setFormData(p => ({ ...p, experience: p.experience?.filter((_, idx) => idx !== i) }));

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex flex-col">
           <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Banco de Talentos</h1>
              {/* BADGE DE QUANTIDADE ADICIONADO AQUI */}
              <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full flex items-center gap-2 border border-blue-200 shadow-sm animate-fadeIn">
                 <Users size={16} />
                 <span className="text-sm font-black">{talents.length}</span>
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

      {/* Modais omitidos para brevidade, mas mantidos no seu código original */}
      {/* ... (os modais isDeleteModalOpen, isLinkModalOpen e isModalOpen continuam aqui) */}
      
    </div>
  );
};
