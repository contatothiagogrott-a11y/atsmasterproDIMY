import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Link } from 'react-router-dom';
// Adicionei RotateCcw e FileQuestion e AlertTriangle aos imports
import { Plus, Search, MapPin, Briefcase, Filter, X, Download, ChevronDown, ChevronRight, Trash2, Eye, EyeOff, Lock, Unlock, Shield, Users, AlertTriangle, ShieldCheck, Edit2, RotateCcw, FileQuestion, XCircle } from 'lucide-react';
import { Job, JobStatus, OpeningDetails, Candidate } from '../types';
import { exportJobsList, exportToExcel } from '../services/excelService';

const generateId = () => crypto.randomUUID();

const formatDateDisplay = (isoString: string) => {
  if (!isoString) return 'N/A';
  const datePart = isoString.split('T')[0];
  if (!datePart) return 'N/A';
  const [year, month, day] = datePart.split('-');
  return `${day}/${month}/${year}`;
};

interface CollapsibleSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  isOpenDefault?: boolean;
  color: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, count, children, isOpenDefault = false, color }) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);
  
  const colorMap: Record<string, string> = {
      blue: 'bg-blue-50 border-blue-200 text-blue-800',
      emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      amber: 'bg-amber-50 border-amber-200 text-amber-800',
      red: 'bg-red-50 border-red-200 text-red-800'
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between p-4 transition-colors ${isOpen ? 'bg-slate-50' : 'bg-white hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown size={20} className="text-slate-400"/> : <ChevronRight size={20} className="text-slate-400"/>}
          <h3 className="font-bold text-slate-700 text-lg">{title}</h3>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colorMap[color] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
            {count}
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 animate-fadeIn">
          {children}
        </div>
      )}
    </div>
  );
};

interface JobCardProps {
  job: Job;
  candidates: Candidate[];
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

const JobCard: React.FC<JobCardProps> = ({ job, candidates, onEdit, onDelete }) => {
    const jobCandidates = candidates.filter(c => c.jobId === job.id);
    const hired = jobCandidates.find(c => c.status === 'Contratado');
    
    const getStatusColor = (s: string) => {
        switch(s) {
            case 'Aberta': return 'bg-blue-100 text-blue-700';
            case 'Fechada': return 'bg-emerald-100 text-emerald-700';
            case 'Congelada': return 'bg-amber-100 text-amber-700';
            case 'Cancelada': return 'bg-red-100 text-red-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    return (
        <Link to={`/jobs/${job.id}`} className={`block bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-all group relative ${job.isConfidential ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                          {job.isConfidential && <span title="Confidencial"><Lock size={14} className="text-amber-500" /></span>}
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${getStatusColor(job.status)}`}>
                              {job.status}
                          </span>
                          {job.openingDetails?.reason === 'Substituição' && <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-rose-100 text-rose-700">Substituição</span>}
                    </div>
                    <h3 className="font-bold text-slate-800 text-lg leading-tight group-hover:text-blue-600 transition-colors">{job.title}</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">{job.sector} &bull; {job.unit}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-4 py-3 border-t border-b border-slate-100 border-dashed">
                <div>
                   <span className="block text-[10px] font-bold text-slate-400 uppercase">Candidatos</span>
                   <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                      <Users size={16} className="text-blue-500"/> {jobCandidates.length}
                   </div>
                </div>
                <div>
                   <span className="block text-[10px] font-bold text-slate-400 uppercase">Abertura</span>
                   <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                      <Briefcase size={16} className="text-slate-400"/> {formatDateDisplay(job.openedAt)}
                   </div>
                </div>
            </div>

            <div className="flex justify-between items-center mt-2">
                {hired ? (
                    <div className="text-xs flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {hired.name.split(' ')[0]} Contratado
                    </div>
                ) : (
                    <span className="text-xs text-slate-400 font-medium italic">
                        {job.status === 'Fechada' ? 'Processo Finalizado' : 'Em andamento...'}
                    </span>
                )}
                
                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button 
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                       className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                       title="Editar Vaga"
                    >
                       <Edit2 size={16} />
                    </button>
                    <button 
                       onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(e); }}
                       className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-400 hover:text-red-600"
                       title="Mover para Lixeira"
                    >
                       <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </Link>
    );
};

export const Jobs: React.FC = () => {
  // ADICIONEI TRASH, RESTORE E PERMANENT DELETE AQUI
  const { jobs, addJob, updateJob, removeJob, verifyUserPassword, settings, candidates, user, users, trash, restoreItem, permanentlyDeleteItem } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // State para o Modal da Lixeira
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  
  // Filters
  const [selectedSector, setSelectedSector] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  // Security
  const [showConfidential, setShowConfidential] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [securityPassword, setSecurityPassword] = useState('');
  const [securityError, setSecurityError] = useState('');

  // Deletion
  const [jobToDelete, setJobToDelete] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sector, setSector] = useState('');
  const [unit, setUnit] = useState('');
  const [status, setStatus] = useState<JobStatus>('Aberta');
  const [description, setDescription] = useState('');
  const [openedAt, setOpenedAt] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [openingDetails, setOpeningDetails] = useState<OpeningDetails>({ reason: 'Aumento de Quadro' });

  const sectors = settings.filter(s => s.type === 'SECTOR');
  const units = settings.filter(s => s.type === 'UNIT');

  // LÓGICA DA LIXEIRA DE VAGAS
  const deletedJobs = useMemo(() => {
    // 1. Filtra só o que é vaga na lixeira global
    const onlyJobs = trash.filter(item => item.originalType === 'job');
    // 2. Aplica regra de visualização (Master vê tudo, User vê o que deletou)
    if (user?.role === 'MASTER') return onlyJobs;
    return onlyJobs.filter(j => j.deletedBy === user?.id);
  }, [trash, user]);

  const hasConfidentialAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'MASTER') return true;
    return jobs.some(j => j.isConfidential && (j.createdBy === user.id || j.allowedUserIds?.includes(user.id)));
  }, [jobs, user]);

  const filteredJobs = useMemo(() => {
    // AQUI MUDOU: Não filtramos mais lixeira aqui. Jobs são sempre ativos.
    let result = jobs; // A API já devolve sem os deletados.
    
    // SECURITY FILTER
    result = result.filter(j => {
      if (!j.isConfidential) return true;
      if (!user) return false;
      return user.role === 'MASTER' || j.createdBy === user.id || j.allowedUserIds?.includes(user.id);
    });

    if (!showConfidential) {
       result = result.filter(j => !j.isConfidential);
    }

    if (searchTerm) {
      result = result.filter(j => j.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (selectedSector) {
      result = result.filter(j => j.sector === selectedSector);
    }
    if (selectedUnit) {
      result = result.filter(j => j.unit === selectedUnit);
    }

    return result;
  }, [jobs, searchTerm, showConfidential, selectedSector, selectedUnit, user]);

  const groupedJobs = useMemo(() => {
    return {
      OPEN: filteredJobs.filter(j => j.status === 'Aberta'),
      CLOSED: filteredJobs.filter(j => j.status === 'Fechada'),
      FROZEN: filteredJobs.filter(j => j.status === 'Congelada'),
      CANCELED: filteredJobs.filter(j => j.status === 'Cancelada'),
    };
  }, [filteredJobs]);

  // --- Handlers ---

  const handleConfidentialToggle = () => {
    if (showConfidential) {
      setShowConfidential(false);
    } else {
      setSecurityPassword('');
      setSecurityError('');
      setIsSecurityModalOpen(true);
    }
  };

  const handleSecurityUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await verifyUserPassword(securityPassword);
    if (isValid) {
      setShowConfidential(true);
      setIsSecurityModalOpen(false);
      setSecurityPassword('');
    } else {
      setSecurityError('Senha incorreta. Tente novamente.');
    }
  };

  const openModal = (job?: Job) => {
    if (job) {
      setEditingId(job.id);
      setTitle(job.title);
      setSector(job.sector);
      setUnit(job.unit);
      setStatus(job.status);
      setDescription(job.description || '');
      setOpenedAt(job.openedAt ? new Date(job.openedAt).toISOString().split('T')[0] : '');
      setRequesterName(job.requesterName || '');
      setIsConfidential(job.isConfidential || false);
      setAllowedUserIds(job.allowedUserIds || []);
      setOpeningDetails(job.openingDetails || { reason: 'Aumento de Quadro' });
    } else {
      setEditingId(null);
      setTitle('');
      setSector(sectors[0]?.name || '');
      setUnit(units[0]?.name || '');
      setStatus('Aberta');
      setDescription('');
      setOpenedAt(new Date().toISOString().split('T')[0]);
      setRequesterName(''); 
      setIsConfidential(false);
      setAllowedUserIds([]);
      setOpeningDetails({ reason: 'Aumento de Quadro' });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const baseData = {
      title,
      sector: sector || sectors[0]?.name || 'N/A',
      unit: unit || units[0]?.name || 'N/A',
      status: editingId ? status : 'Aberta', 
      description,
      openedAt: new Date(openedAt).toISOString(),
      requesterName,
      isConfidential,
      allowedUserIds: isConfidential ? allowedUserIds : [],
      openingDetails
    };

    if (editingId) {
      const existing = jobs.find(j => j.id === editingId);
      if (existing) {
        updateJob({ ...existing, ...baseData });
      }
    } else {
      addJob({ id: generateId(), ...baseData } as Job);
    }
    setIsModalOpen(false);
  };

  const initiateDelete = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setJobToDelete(id);
    setDeleteConfirmation('');
  };

  const confirmDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteConfirmation.toUpperCase() === 'DELETE' && jobToDelete) {
       removeJob(jobToDelete);
       setJobToDelete(null);
       setDeleteConfirmation('');
    } else {
      alert('Texto de confirmação incorreto.');
    }
  };

  const toggleUserAccess = (userId: string) => {
    if (allowedUserIds.includes(userId)) {
      setAllowedUserIds(allowedUserIds.filter(id => id !== userId));
    } else {
      setAllowedUserIds([...allowedUserIds, userId]);
    }
  };

  // Funções da Lixeira no Modal
  const handleRestoreFromTrash = async (id: string) => {
    if(confirm("Restaurar esta vaga?")) {
        await restoreItem(id);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if(confirm("TEM CERTEZA? Isso apagará a vaga e seus dados PARA SEMPRE.")) {
        await permanentlyDeleteItem(id);
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Gestão de Vagas</h1>
          <p className="text-slate-500 mt-1">Visão hierárquica do pipeline de vagas</p>
        </div>
        <div className="flex gap-3">
           {hasConfidentialAccess && (
             <button 
               onClick={handleConfidentialToggle}
               className={`p-2 rounded-lg transition-colors border flex items-center gap-2 text-sm font-bold ${showConfidential ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-300 text-slate-400'}`}
               title={showConfidential ? "Ocultar Confidenciais" : "Exibir Confidenciais"}
             >
               {showConfidential ? <Unlock size={20} /> : <Lock size={20} />}
               <span className="hidden sm:inline">{showConfidential ? "Sigilo Aberto" : "Ativar Sigilo"}</span>
             </button>
           )}

           {/* BOTÃO DA LIXEIRA - AGORA ABRE MODAL */}
           <button 
             onClick={() => setIsTrashModalOpen(true)} 
             className="p-2 rounded-lg transition-colors flex items-center gap-2 border bg-white border-slate-300 text-slate-500 hover:text-red-600 hover:bg-red-50"
             title="Lixeira de Vagas"
           >
             <Trash2 size={20} />
             {deletedJobs.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full -ml-1">
                    {deletedJobs.length}
                </span>
             )}
           </button>

          <button 
            onClick={() => exportToExcel(filteredJobs, candidates, users)}
            className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all"
          >
            <Download size={18} /> Exportar SLA
          </button>
          <button 
            onClick={() => openModal()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-md transition-all font-semibold"
          >
            <Plus size={20} /> Nova Vaga
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar vagas por título..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none shadow-sm text-slate-700"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select 
            value={selectedUnit} 
            onChange={e => setSelectedUnit(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-600 font-medium cursor-pointer"
        >
            <option value="">Todas as Unidades</option>
            {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
        </select>

        <select 
            value={selectedSector} 
            onChange={e => setSelectedSector(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-slate-600 font-medium cursor-pointer"
        >
            <option value="">Todos os Setores</option>
            {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>

        {(selectedSector || selectedUnit) && (
            <button 
                onClick={() => { setSelectedSector(''); setSelectedUnit(''); }}
                className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 font-bold transition-colors flex items-center gap-2"
                title="Limpar Filtros"
            >
                <X size={18} /> Limpar
            </button>
        )}
      </div>

      <div className="space-y-6">
        <CollapsibleSection title="Vagas Abertas / Em Andamento" count={groupedJobs.OPEN.length} isOpenDefault={true} color="blue">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {groupedJobs.OPEN.map(job => <JobCard key={job.id} job={job} candidates={candidates} onEdit={() => openModal(job)} onDelete={(e) => initiateDelete(e, job.id)} />)}
             {groupedJobs.OPEN.length === 0 && <p className="text-slate-400 italic">Nenhuma vaga encontrada.</p>}
           </div>
        </CollapsibleSection>

        <CollapsibleSection title="Vagas Concluídas / Fechadas" count={groupedJobs.CLOSED.length} color="emerald">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedJobs.CLOSED.map(job => <JobCard key={job.id} job={job} candidates={candidates} onEdit={() => openModal(job)} onDelete={(e) => initiateDelete(e, job.id)} />)}
            {groupedJobs.CLOSED.length === 0 && <p className="text-slate-400 italic">Nenhuma vaga fechada encontrada.</p>}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Vagas Congeladas" count={groupedJobs.FROZEN.length} color="amber">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedJobs.FROZEN.map(job => <JobCard key={job.id} job={job} candidates={candidates} onEdit={() => openModal(job)} onDelete={(e) => initiateDelete(e, job.id)} />)}
            {groupedJobs.FROZEN.length === 0 && <p className="text-slate-400 italic">Nenhuma vaga congelada encontrada.</p>}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Vagas Canceladas" count={groupedJobs.CANCELED.length} color="red">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedJobs.CANCELED.map(job => <JobCard key={job.id} job={job} candidates={candidates} onEdit={() => openModal(job)} onDelete={(e) => initiateDelete(e, job.id)} />)}
            {groupedJobs.CANCELED.length === 0 && <p className="text-slate-400 italic">Nenhuma vaga cancelada encontrada.</p>}
          </div>
        </CollapsibleSection>
      </div>

      {/* --- MODAL DA LIXEIRA --- */}
      {isTrashModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-red-50 rounded-t-2xl">
                 <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-lg text-red-600">
                        <Trash2 size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800">Lixeira de Vagas</h3>
                        <p className="text-sm text-slate-500">Recupere vagas excluídas ou apague definitivamente.</p>
                    </div>
                 </div>
                 <button onClick={() => setIsTrashModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-full shadow-sm">
                   <X size={20} />
                 </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50">
                 {deletedJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                       <FileQuestion size={64} className="mb-4 opacity-20" />
                       <p className="text-lg font-medium">A lixeira está vazia.</p>
                    </div>
                 ) : (
                    <div className="space-y-3">
                       {deletedJobs.map(job => (
                          <div key={job.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                             <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                                        Excluída em: {job.deletedAt ? new Date(job.deletedAt).toLocaleDateString() : 'N/A'}
                                    </span>
                                    {user?.role === 'MASTER' && (
                                        <span className="text-xs text-slate-400">
                                            por: {users.find(u => u.id === job.deletedBy)?.name || 'Admin'}
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-bold text-slate-800 text-lg">{job.title}</h4>
                                <p className="text-sm text-slate-500">{job.sector} • {job.unit}</p>
                             </div>

                             <div className="flex items-center gap-3">
                                <button 
                                   onClick={() => handleRestoreFromTrash(job.id)}
                                   className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                   <RotateCcw size={18} /> Restaurar
                                </button>
                                
                                {user?.role === 'MASTER' && (
                                    <button 
                                       onClick={() => handlePermanentDelete(job.id)}
                                       className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 font-bold rounded-lg hover:bg-red-100 transition-colors"
                                       title="Excluir Permanentemente"
                                     >
                                       <XCircle size={18} /> Excluir
                                     </button>
                                )}
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* --- SECURITY RE-AUTH MODAL --- */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
           <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm border-t-4 border-amber-500 animate-fadeIn">
              <div className="flex justify-center mb-6">
                 <div className="bg-amber-100 p-4 rounded-full text-amber-600 shadow-inner">
                    <ShieldCheck size={40} />
                 </div>
              </div>
              <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Modo Confidencial</h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                  Para visualizar as vagas sigilosas, confirme sua senha de acesso.
              </p>
              
              <form onSubmit={handleSecurityUnlock} className="space-y-4">
                 <div>
                    <input 
                      autoFocus
                      type="password" 
                      placeholder="Sua senha de login"
                      className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-center tracking-widest"
                      value={securityPassword}
                      onChange={e => setSecurityPassword(e.target.value)}
                    />
                    {securityError && <p className="text-red-500 text-xs font-bold mt-2 text-center">{securityError}</p>}
                 </div>
                 
                 <div className="flex flex-col gap-2 pt-2">
                    <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl shadow-lg transition-transform active:scale-95">
                       Confirmar Acesso
                    </button>
                    <button type="button" onClick={() => { setIsSecurityModalOpen(false); setSecurityPassword(''); }} className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors">
                       Cancelar
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Safety Lock */}
      {jobToDelete && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border-t-4 border-red-500">
             <div className="flex justify-center mb-4">
               <div className="bg-red-100 p-3 rounded-full text-red-600">
                 <AlertTriangle size={32} />
               </div>
             </div>
             <h3 className="text-xl font-bold text-slate-800 text-center mb-2">Excluir Vaga?</h3>
             <p className="text-sm text-slate-600 text-center mb-6">
               Tem certeza que deseja remover esta vaga? Ela sairá da lista de disponíveis e irá para a Lixeira.
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
                   onClick={() => { setJobToDelete(null); setDeleteConfirmation(''); }} 
                   className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="submit" 
                   disabled={deleteConfirmation.toUpperCase() !== 'DELETE'}
                   className="flex-1 bg-red-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl shadow-lg transition-all transform enabled:hover:bg-red-700 enabled:active:scale-95"
                 >
                   Confirmar Exclusão
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* New/Edit Job Modal (MANTIDO IDÊNTICO) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-blue-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-white px-8 py-6 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-800">{editingId ? 'Editar Dados da Vaga' : 'Nova Vaga'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Título da Vaga</label>
                    <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Analista de Marketing" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Solicitante (Nome)</label>
                    <input required type="text" value={requesterName} onChange={e => setRequesterName(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Quem pediu a vaga?" />
                  </div>
              </div>

              {/* CONFIDENTIAL SECTION (ACL) */}
              <div className={`p-4 rounded-lg border transition-colors ${isConfidential ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-3 mb-2">
                      <div className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isConfidential ? 'bg-amber-500' : 'bg-slate-300'}`} onClick={() => setIsConfidential(!isConfidential)}>
                          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isConfidential ? 'translate-x-4' : ''}`}></div>
                      </div>
                      <span className={`font-bold text-sm flex items-center gap-2 ${isConfidential ? 'text-amber-800' : 'text-slate-500'}`}>
                          <Lock size={16}/> Vaga Sigilosa
                      </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3 ml-1">Vagas sigilosas ficam ocultas por padrão. Selecione quem tem permissão para visualizar:</p>
                  
                  {isConfidential && (
                      <div className="bg-white border border-amber-200 rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar">
                          <div className="text-xs font-bold text-slate-400 uppercase mb-2">Acesso Garantido (Automático)</div>
                          <div className="flex items-center gap-2 text-xs text-slate-600 mb-3">
                             <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><Shield size={10}/> Master Admin</span>
                             <span className="bg-slate-100 px-2 py-1 rounded flex items-center gap-1"><Users size={10}/> Você (Criador)</span>
                          </div>
                          
                          <div className="text-xs font-bold text-slate-400 uppercase mb-2">Selecionar Recrutadores Adicionais</div>
                          <div className="space-y-1">
                              {users.filter(u => u.role !== 'MASTER' && u.id !== user?.id).map(u => (
                                  <label key={u.id} className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={allowedUserIds.includes(u.id)}
                                        onChange={() => toggleUserAccess(u.id)}
                                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                                      />
                                      <span className="text-sm text-slate-700">{u.name}</span>
                                  </label>
                              ))}
                              {users.filter(u => u.role !== 'MASTER' && u.id !== user?.id).length === 0 && (
                                  <p className="text-xs text-slate-400 italic">Nenhum outro recrutador disponível.</p>
                              )}
                          </div>
                      </div>
                  )}
              </div>

              <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                  <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Motivo da Abertura</label>
                      <div className="flex gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="openingReason" checked={openingDetails.reason === 'Aumento de Quadro'} onChange={() => setOpeningDetails({...openingDetails, reason: 'Aumento de Quadro'})} className="text-blue-600" />
                              <span className="text-sm font-medium">Aumento de Quadro</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="openingReason" checked={openingDetails.reason === 'Substituição'} onChange={() => setOpeningDetails({...openingDetails, reason: 'Substituição'})} className="text-blue-600" />
                              <span className="text-sm font-medium">Substituição</span>
                          </label>
                      </div>
                  </div>

                  {openingDetails.reason === 'Substituição' && (
                      <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Colaborador Substituído</label>
                              <input required type="text" className="w-full border p-2 rounded text-sm" placeholder="Nome do ex-colaborador" value={openingDetails.replacedEmployee || ''} onChange={e => setOpeningDetails({...openingDetails, replacedEmployee: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Motivo da Saída</label>
                              <select required className="w-full border p-2 rounded text-sm bg-white" value={openingDetails.replacementReason || ''} onChange={e => setOpeningDetails({...openingDetails, replacementReason: e.target.value as any})}>
                                  <option value="">Selecione...</option>
                                  <option value="Demissão sem justa causa">Demissão sem justa causa</option>
                                  <option value="Pedido de Demissão">Pedido de Demissão</option>
                                  <option value="Movimentação Interna">Movimentação Interna</option>
                                  <option value="Término de Contrato">Término de Contrato</option>
                                  <option value="Licença Maternidade">Licença Maternidade</option>
                                  <option value="Abandono de Emprego">Abandono de Emprego</option>
                              </select>
                          </div>
                      </div>
                  )}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Setor</label>
                  <select required value={sector} onChange={e => setSector(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg bg-white">
                    {sectors.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Unidade</label>
                  <select required value={unit} onChange={e => setUnit(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg bg-white">
                    {units.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Data de Abertura</label>
                <input type="date" required value={openedAt} onChange={e => setOpenedAt(e.target.value)} className="w-full border border-slate-300 p-3 rounded-lg outline-none" />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg font-medium transition-all">Cancelar</button>
                <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md transition-all">Salvar Vaga</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
