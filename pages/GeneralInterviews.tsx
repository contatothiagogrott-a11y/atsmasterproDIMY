import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, User, Phone, Mail, Calendar, Clock, 
  MessageSquare, Save, X, Search, Linkedin, Instagram, 
  Globe, Users, UserPlus, MapPin, Briefcase, Filter,
  CheckCircle, Award, DollarSign, Activity, Lock, Download,
  Plus, Archive, Database, MessageCircle, ExternalLink, Target, Link as LinkIcon,
  Beaker, AlertTriangle, FileText, PauseCircle, Trash2, ShieldAlert
} from 'lucide-react';
import { Candidate, Job, TalentProfile, ContractType } from '../types';
import { exportJobCandidates } from '../services/excelService';
import { differenceInDays, parseISO } from 'date-fns';

const generateId = () => crypto.randomUUID();

// --- LISTAS DE DIAGNÓSTICO DE DHO ---

const WITHDRAWAL_REASONS = [
  "Aceitou outra proposta", 
  "Salário abaixo da pretensão", 
  "Distância / Localização", 
  "Desinteresse na vaga",
  "Problemas pessoais"
];

const GENERAL_REJECTION_REASONS = [
  "Perfil Técnico Insuficiente",
  "Sem Fit Cultural",
  "Reprovado no Teste Técnico",
  "Salário acima do budget"
];

const TECH_REJECTION_REASONS = [
  "Perfil Técnico Insuficiente",
  "Sem Fit Cultural",
  "Reprovado no Teste Técnico",
  "Salário acima do budget"
];

const toInputDate = (isoString?: string) => {
  if (!isoString) return '';
  return isoString.split('T')[0];
};

const formatDate = (isoString?: string) => {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const getSourceIcon = (origin: string) => {
  const norm = origin?.toLowerCase() || '';
  if (norm.includes('linkedin')) return <Linkedin size={16} className="text-blue-600" />;
  if (norm.includes('instagram')) return <Instagram size={16} className="text-pink-600" />;
  if (norm.includes('indicação') || norm.includes('indicacao')) return <LinkIcon size={16} className="text-teal-600" />;
  if (norm.includes('interno')) return <Briefcase size={16} className="text-slate-600" />;
  if (norm.includes('banco')) return <Database size={16} className="text-orange-600" />;
  if (norm.includes('sine')) return <Globe size={16} className="text-green-600" />;
  if (norm.includes('espontânea') || norm.includes('espontanea')) return <Search size={16} className="text-purple-600" />;
  return <Target size={16} className="text-gray-400" />;
};

export const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobs, candidates, updateCandidate, addCandidate, addTalent, updateJob, removeCandidate, user, verifyUserPassword } = useData();
  
  const [job, setJob] = useState<Job | undefined>(undefined);
  const [jobCandidates, setJobCandidates] = useState<Candidate[]>([]);
  
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'Cancelada' | 'Congelada' | 'Aberta' | null>(null);
  const [statusFormData, setStatusFormData] = useState({ requester: '', reason: '', date: toInputDate(new Date().toISOString()) });

  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);
  const [candidateToHire, setCandidateToHire] = useState<Candidate | null>(null);
  const [hiringData, setHiringData] = useState({ contractType: 'CLT' as ContractType, finalSalary: '', startDate: '' });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Candidate>>({});
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [lossReasonType, setLossReasonType] = useState(''); 

  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [techCandidate, setTechCandidate] = useState<Candidate | null>(null);
  const [techForm, setTechForm] = useState({ didTest: false, date: '', evaluator: '', result: 'Aprovado', rejectionDetail: '' });
  const [techReasonType, setTechReasonType] = useState('');

  // --- NOVOS STATES PARA CORRIGIR O TELEFONE NO MODAL DE BANCO ---
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
  const [talentFormData, setTalentFormData] = useState<Partial<TalentProfile>>({});
  const [talentEmail, setTalentEmail] = useState(''); // Separado
  const [talentPhone, setTalentPhone] = useState(''); // Separado

  // DELETE STATES
  const [isDeleteCandidateModalOpen, setIsDeleteCandidateModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  useEffect(() => {
    const foundJob = jobs.find(j => j.id === id);
    setJob(foundJob);
    if (foundJob) setJobCandidates(candidates.filter(c => c.jobId === foundJob.id));
  }, [jobs, candidates, id]);

  const hiredCandidate = useMemo(() => {
      return jobCandidates.find(c => c.status === 'Contratado' || job?.hiredCandidateIds?.includes(c.id));
  }, [jobCandidates, job]);

  const metrics = useMemo(() => {
    if (!job) return { daysOpen: 0, daysFrozen: 0, daysNet: 0, enrolled: 0, interviewed: 0, finalists: 0, rejected: 0, withdrawn: 0, origins: {} as any };
    const endDate = job.status === 'Fechada' && job.closedAt ? new Date(job.closedAt).getTime() : new Date().getTime();
    const startDate = new Date(job.openedAt).getTime();
    const daysOpenBruto = Math.ceil((endDate - startDate) / (1000 * 3600 * 24));

    let totalFrozenMilliseconds = 0;
    if (job.freezeHistory) {
        job.freezeHistory.forEach(freeze => {
            const startFreeze = new Date(freeze.startDate).getTime();
            const endFreeze = freeze.endDate ? new Date(freeze.endDate).getTime() : endDate;
            if (endFreeze > startFreeze) totalFrozenMilliseconds += (endFreeze - startFreeze);
        });
    }
    const daysFrozen = Math.floor(totalFrozenMilliseconds / (1000 * 3600 * 24));
    const daysNet = Math.max(0, daysOpenBruto - daysFrozen);

    const origins: Record<string, number> = { 'LinkedIn': 0, 'Instagram': 0, 'Indicação': 0, 'SINE': 0, 'Banco de Talentos': 0, 'Recrutamento Interno': 0, 'Busca espontânea': 0, 'Outros': 0 };
    jobCandidates.forEach(c => {
        const o = c.origin || 'Outros';
        if (origins[o] !== undefined) origins[o]++; else origins['Outros']++;
    });

    return {
        daysOpen: daysOpenBruto, daysFrozen, daysNet,
        enrolled: jobCandidates.length,
        interviewed: jobCandidates.filter(c => c.interviewAt).length, 
        finalists: jobCandidates.filter(c => ['Em Teste', 'Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).length,
        rejected: jobCandidates.filter(c => c.status === 'Reprovado').length,
        withdrawn: jobCandidates.filter(c => c.status === 'Desistência').length,
        origins
    };
  }, [job, jobCandidates]);

  // --- DELETE CANDIDATE LOGIC ---
  const handleOpenDeleteCandidate = (c: Candidate) => {
    setCandidateToDelete(c);
    setDeletePassword('');
    setDeleteError('');
    setIsDeleteCandidateModalOpen(true);
  };

  const handleConfirmCandidateDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateToDelete) return;

    const isValid = await verifyUserPassword(deletePassword);
    if (isValid) {
        await removeCandidate(candidateToDelete.id);
        setIsDeleteCandidateModalOpen(false);
        setCandidateToDelete(null);
    } else {
        setDeleteError('Senha incorreta.');
    }
  };

  const initiateStatusChange = (newStatus: string) => {
    if (!job || newStatus === job.status) return;
    if (newStatus === 'Fechada') {
        setIsHiringModalOpen(true);
        setCandidateToHire(jobCandidates.find(c => c.status === 'Aprovado' || c.status === 'Proposta Aceita') || null);
        return;
    }
    if (['Congelada', 'Cancelada'].includes(newStatus) || (newStatus === 'Aberta' && job.status === 'Congelada')) {
        setTargetStatus(newStatus as any);
        setStatusFormData({ requester: '', reason: '', date: toInputDate(new Date().toISOString()) });
        setIsStatusModalOpen(true);
        return;
    }
    updateJob({ ...job, status: newStatus as any });
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !targetStatus) return;
    const actionDateISO = `${statusFormData.date}T12:00:00.000Z`;
    const updatedJob = { ...job, status: targetStatus };
    if (targetStatus === 'Congelada') {
        updatedJob.freezeHistory = [...(job.freezeHistory || []), { startDate: actionDateISO, reason: statusFormData.reason, requester: statusFormData.requester }];
    } else if (targetStatus === 'Aberta' && job.status === 'Congelada') {
        const history = [...(updatedJob.freezeHistory || [])];
        if (history.length > 0) history[history.length - 1].endDate = actionDateISO;
        updatedJob.freezeHistory = history;
    } else if (targetStatus === 'Cancelada') {
        updatedJob.closedAt = actionDateISO;
        updatedJob.cancellationReason = statusFormData.reason;
    }
    updateJob(updatedJob);
    setIsStatusModalOpen(false);
  };

  const handleHiringSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateToHire || !job) return;
    const startDateISO = hiringData.startDate ? `${hiringData.startDate}T12:00:00.000Z` : new Date().toISOString();
    updateCandidate({ ...candidateToHire, status: 'Contratado', contractType: hiringData.contractType, finalSalary: hiringData.finalSalary, timeline: { ...candidateToHire.timeline, startDate: startDateISO } } as Candidate);
    updateJob({ ...job, status: 'Fechada', closedAt: startDateISO, hiredCandidateIds: [candidateToHire.id] });
    setIsHiringModalOpen(false);
  };

  const handleOpenModal = (candidate?: Candidate) => {
    if (candidate) {
        setSelectedCandidate(candidate);
        setFormData({ ...candidate });
        if (candidate.rejectionReason) {
            const isGeneral = GENERAL_REJECTION_REASONS.includes(candidate.rejectionReason);
            const isWithdrawal = WITHDRAWAL_REASONS.includes(candidate.rejectionReason);
            
            if (isGeneral || isWithdrawal) {
                setLossReasonType(candidate.rejectionReason);
            } else {
                setLossReasonType('Outros');
            }
        } else { setLossReasonType(''); }
    } else {
        setSelectedCandidate(null);
        setFormData({ jobId: job?.id, status: 'Aguardando Triagem', origin: 'LinkedIn', contractType: 'CLT', createdAt: new Date().toISOString() });
        setLossReasonType('');
    }
    setIsModalOpen(true);
  };

  const handleSaveChanges = async () => {
    const processedData = { ...formData };
    if (processedData.firstContactAt) processedData.firstContactAt = `${toInputDate(processedData.firstContactAt)}T12:00:00.000Z`;
    if (processedData.interviewAt) processedData.interviewAt = `${toInputDate(processedData.interviewAt)}T12:00:00.000Z`;
    if (processedData.lastInteractionAt) processedData.lastInteractionAt = `${toInputDate(processedData.lastInteractionAt)}T12:00:00.000Z`;

    if (processedData.status === 'Reprovado' || processedData.status === 'Desistência') {
        if (!processedData.rejectionReason) { alert("Por favor, informe o motivo da perda."); return; }
        processedData.rejectedBy = user?.name || 'Sistema';
        processedData.rejectionDate = new Date().toISOString();
    }

    if (selectedCandidate) await updateCandidate({ ...selectedCandidate, ...processedData } as Candidate);
    else await addCandidate({ ...processedData, id: generateId() } as Candidate);
    setIsModalOpen(false);
  };

  const handleOpenTechModal = (c: Candidate) => {
    setTechCandidate(c);
    setTechForm({ 
        didTest: c.techTest || false, 
        date: toInputDate(c.techTestDate || new Date().toISOString()), 
        evaluator: c.techTestEvaluator || '', 
        result: c.techTestResult || 'Aprovado', 
        rejectionDetail: c.rejectionReason || '' 
    });
    
    if (c.rejectionReason && TECH_REJECTION_REASONS.includes(c.rejectionReason)) {
        setTechReasonType(c.rejectionReason);
    } else if (c.rejectionReason) {
        setTechReasonType('Outros');
    } else {
        setTechReasonType('');
    }
    
    setIsTechModalOpen(true);
  };

  const saveTechTest = () => {
    if (!techCandidate) return;
    const update = { 
        ...techCandidate, 
        techTest: techForm.didTest, 
        techTestDate: techForm.didTest ? `${techForm.date}T12:00:00.000Z` : undefined, 
        techTestEvaluator: techForm.didTest ? techForm.evaluator : undefined, 
        techTestResult: techForm.didTest ? techForm.result : undefined 
    };
    
    if (techForm.didTest && techForm.result === 'Reprovado') {
        update.status = 'Reprovado';
        update.rejectionReason = techReasonType === 'Outros' ? techForm.rejectionDetail : techReasonType;
        update.rejectionDate = new Date().toISOString();
        update.rejectedBy = user?.name || 'Sistema';
    }
    updateCandidate(update);
    setIsTechModalOpen(false);
  };

  if (!job) return <div className="p-8 text-center">Vaga não encontrada</div>;

  const filteredList = jobCandidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'TODOS' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="pb-12">
      {/* HEADER DA VAGA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/jobs')} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><ArrowLeft size={24} /></button>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">{job.title}</h1>
                <div className="text-sm text-slate-500 flex gap-2 items-center">
                    <span>{job.sector}</span> &bull; <span>{job.unit}</span> &bull; 
                    <select value={job.status} onChange={(e) => initiateStatusChange(e.target.value)} className={`text-xs font-bold px-2 py-1 rounded cursor-pointer border ${job.status === 'Aberta' ? 'bg-blue-100 text-blue-700' : job.status === 'Fechada' ? 'bg-emerald-100 text-emerald-700' : job.status === 'Congelada' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        <option value="Aberta">Aberta</option>
                        <option value="Fechada">Fechada</option>
                        <option value="Congelada">Congelada</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => exportJobCandidates(job, jobCandidates)} className="bg-white border p-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm hover:bg-slate-50"><Download size={18} /> Excel</button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white p-2 px-4 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md hover:bg-blue-700"><Plus size={18} /> Adicionar</button>
        </div>
      </div>

      {/* DASHBOARD DE MÉTRICAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-7 divide-x gap-y-4 md:gap-y-0">
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Dias Bruto</div><div className="text-xl font-bold text-slate-600">{metrics.daysOpen}</div></div>
             <div className="px-2 text-center bg-amber-50/50 rounded"><div className="text-[10px] font-bold text-amber-600 uppercase">Dias Cong.</div><div className="text-xl font-bold text-amber-700">{metrics.daysFrozen}</div></div>
             <div className="px-2 text-center bg-blue-50/50 rounded"><div className="text-[10px] font-bold text-blue-600 uppercase">SLA Líquido</div><div className="text-xl font-bold text-blue-700">{metrics.daysNet}</div></div>
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Entrevistas</div><div className="text-xl font-bold text-slate-700">{metrics.interviewed}</div></div>
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Finalistas</div><div className="text-xl font-bold text-slate-700">{metrics.finalists}</div></div>
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Reprovados</div><div className="text-xl font-bold text-red-600">{metrics.rejected}</div></div>
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Desistentes</div><div className="text-xl font-bold text-amber-500">{metrics.withdrawn}</div></div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 grid grid-cols-4 gap-2">
             {Object.entries(metrics.origins).map(([name, count]) => (<div key={name} className="text-center flex flex-col items-center">{getSourceIcon(name)}<span className="text-[10px] font-bold mt-1">{count}</span></div>))}
          </div>
      </div>

      {/* BANNER DE CONTRATAÇÃO */}
      {job.status === 'Fechada' && hiredCandidate && (
        <div className="mb-8 bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl shadow-xl text-white p-6 flex flex-col md:flex-row items-center gap-6">
           <div className="bg-white/20 p-4 rounded-full"><CheckCircle size={40}/></div>
           <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold mb-1">Vaga Preenchida!</h2>
              <p className="text-emerald-100 font-medium text-lg">{hiredCandidate.name}</p>
              <div className="flex flex-wrap gap-4 mt-3 justify-center md:justify-start text-xs opacity-90">
                 <span className="flex items-center gap-1"><DollarSign size={14}/> {hiredCandidate.finalSalary || 'N/I'}</span>
                 <span className="flex items-center gap-1"><Calendar size={14}/> Início: {formatDate(hiredCandidate.timeline?.startDate)}</span>
                 <span className="flex items-center gap-1"><Activity size={14}/> SLA Real: {metrics.daysNet} dias</span>
                 <span className="flex items-center gap-1"><FileText size={14}/> {hiredCandidate.contractType || 'CLT'}</span>
              </div>
           </div>
        </div>
      )}

      {/* BUSCA E FILTROS */}
      <div className="flex gap-4 mb-6">
         <input className="flex-1 border p-3 rounded-xl shadow-sm" placeholder="Buscar candidato..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         <select className="border p-3 rounded-xl shadow-sm bg-white font-medium" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="TODOS">Todos os Status</option>
            <option value="Aguardando Triagem">Aguardando Triagem</option>
            <option value="Em Análise">Em Análise</option>
            <option value="Entrevista">Entrevista</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Reprovado">Reprovado</option>
            <option value="Desistência">Desistência</option>
         </select>
      </div>

      {/* LISTA DE CANDIDATOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map(c => (
          <div key={c.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all group flex flex-col ${c.status === 'Reprovado' ? 'border-red-200 bg-red-50/10' : c.status === 'Desistência' ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200'}`}>
             <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500">{c.name.charAt(0)}</div>
                   <div>
                      <h3 className="font-bold text-slate-800 cursor-pointer hover:text-blue-600" onClick={() => handleOpenModal(c)}>{c.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        {getSourceIcon(c.origin || '')} <span>{c.origin}</span>
                        {c.city && <span className="text-slate-300">• {c.city}</span>}
                      </div>
                   </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${c.status === 'Reprovado' ? 'bg-red-100 text-red-700' : c.status === 'Desistência' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{c.status}</span>
                  {c.phone && <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded hover:bg-green-100 transition-colors"><MessageCircle size={10}/> WhatsApp</a>}
                </div>
             </div>

             <div className="flex justify-between items-center bg-slate-50/80 p-2 rounded mb-3 text-[11px] border border-slate-100">
                <span className="flex items-center gap-1 text-slate-600"><User size={12}/> {c.age} anos</span>
                <span className="flex items-center gap-1 text-emerald-700 font-bold"><DollarSign size={12}/> {c.salaryExpectation || 'N/I'}</span>
             </div>

             <div className="space-y-1 text-[10px] text-slate-500 border-t border-slate-50 pt-2 mb-3 flex-1">
                <div className="flex justify-between"><span>1º Contato:</span><span className="font-bold text-slate-700">{formatDate(c.firstContactAt)}</span></div>
                <div className="flex justify-between"><span>Entrevista:</span><span className={`font-bold ${c.interviewAt ? 'text-blue-600' : 'text-slate-300'}`}>{formatDate(c.interviewAt)}</span></div>
                <div className="flex justify-between"><span>Último Contato:</span><span className="font-bold text-slate-700">{formatDate(c.lastInteractionAt)}</span></div>
             </div>

             <div className="flex gap-2 pt-2 mt-auto border-t border-slate-50">
                <button onClick={() => handleOpenTechModal(c)} className={`flex-1 flex justify-center items-center gap-1 py-1.5 rounded text-[10px] font-bold border transition-colors ${c.techTest ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-slate-500 border-slate-200'}`}><Beaker size={12}/> Teste</button>
                
                {/* --- BOTÃO CORRIGIDO: PREENCHE EMAIL E TELEFONE SEPARADOS --- */}
                <button onClick={() => { 
                    setTalentFormData({ name: c.name, city: c.city, targetRole: job.title });
                    setTalentEmail(c.email || ''); // Pega o email
                    setTalentPhone(c.phone || ''); // Pega o telefone
                    setIsTalentModalOpen(true); 
                }} className="flex-1 flex justify-center items-center gap-1 bg-white hover:bg-orange-50 text-slate-500 hover:text-orange-600 py-1.5 rounded text-[10px] font-bold border border-slate-200 transition-colors"><Database size={12}/> Banco</button>
                
                <button onClick={() => handleOpenModal(c)} className="flex-1 flex justify-center items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded text-[10px] font-bold transition-colors"><User size={12}/> Editar</button>
                <button onClick={() => handleOpenDeleteCandidate(c)} className="flex justify-center items-center px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 rounded transition-colors" title="Excluir Candidato"><Trash2 size={12}/></button>
             </div>
          </div>
        ))}
      </div>

      {/* --- MODAL DE DELETAR CANDIDATO COM SENHA --- */}
      {isDeleteCandidateModalOpen && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm flex items-center justify-center z-[250] p-4">
           <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-red-500 animate-fadeIn">
              <div className="flex justify-center mb-4"><div className="bg-red-100 p-3 rounded-full text-red-600"><ShieldAlert size={32}/></div></div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">Excluir {candidateToDelete?.name}?</h3>
              <p className="text-xs text-slate-500 text-center mb-6">Esta ação removerá o candidato desta vaga e apagará o histórico dele no Banco de Talentos. É irreversível.</p>
              
              <form onSubmit={handleConfirmCandidateDelete}>
                 <div className="mb-4">
                    <input autoFocus type="password" placeholder="Sua senha para confirmar" className="w-full border p-3 rounded-lg text-center tracking-widest outline-none focus:ring-2 focus:ring-red-500" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
                    {deleteError && <p className="text-red-600 text-xs font-bold mt-2 text-center">{deleteError}</p>}
                 </div>
                 <div className="flex gap-2">
                    <button type="button" onClick={() => setIsDeleteCandidateModalOpen(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-50 rounded-lg">Cancelar</button>
                    <button type="submit" className="flex-1 bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700 shadow-md">Confirmar Exclusão</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* --- MODAL DE EDIÇÃO DO CANDIDATO --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 animate-fadeIn">
             <div className="flex justify-between mb-6 border-b pb-4"><h3 className="font-bold text-xl text-slate-800">Gerenciar Candidato</h3><button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400"/></button></div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nome</label><input className="w-full border p-2 rounded text-sm" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                
                <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Telefone</label><input className="w-full border p-2 rounded text-sm" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-600 mb-1">Idade</label><input type="number" className="w-full border p-2 rounded text-sm" value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})} /></div>
                </div>

                <div><label className="block text-xs font-bold text-slate-600 mb-1">Email</label><input className="w-full border p-2 rounded text-sm" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Cidade</label><input className="w-full border p-2 rounded text-sm" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Pretensão Salarial</label><input className="w-full border p-2 rounded text-sm" value={formData.salaryExpectation || ''} onChange={e => setFormData({...formData, salaryExpectation: e.target.value})} /></div>
                
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                   <select className="w-full border p-2 rounded font-bold text-sm" value={formData.status || 'Aguardando Triagem'} onChange={e => {
                       const newStatus = e.target.value;
                       setFormData({...formData, status: newStatus});
                       if (!['Reprovado', 'Desistência'].includes(newStatus)) { setLossReasonType(''); setFormData(p => ({...p, rejectionReason: undefined})); }
                   }}>
                      <option value="Aguardando Triagem">Aguardando Triagem</option>
                      <option value="Em Análise">Em Análise</option>
                      <option value="Em Teste">Em Teste</option>
                      <option value="Entrevista">Entrevista</option>
                      <option value="Aprovado">Aprovado</option>
                      <option value="Reprovado">Reprovado</option>
                      <option value="Desistência">Desistência</option>
                   </select>
                </div>

                <div><label className="block text-xs font-bold text-slate-600 mb-1">Origem</label>
                   <select className="w-full border p-2 rounded text-sm" value={formData.origin || 'LinkedIn'} onChange={e => setFormData({...formData, origin: e.target.value})}>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Indicação">Indicação</option>
                      <option value="Banco de Talentos">Banco de Talentos</option>
                      <option value="Busca espontânea">Busca Espontânea</option>
                      <option value="SINE">SINE</option>
                      <option value="Recrutamento Interno">Recrutamento Interno</option>
                      <option value="Outros">Outros</option>
                   </select>
                </div>

                {formData.origin === 'Indicação' && (
                    <div className="animate-fadeIn md:col-span-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                        <label className="block text-xs font-bold text-indigo-700 mb-1">Quem Indicou? (Obrigatório)</label>
                        <input className="w-full border border-indigo-200 bg-white p-2 rounded text-sm placeholder-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nome do Padrinho/Madrinha" value={formData.referralName || ''} onChange={e => setFormData({...formData, referralName: e.target.value})} />
                    </div>
                )}

                {(formData.status === 'Reprovado' || formData.status === 'Desistência') && (
                    <div className="md:col-span-2 bg-red-50 p-4 rounded-lg border border-red-200 animate-fadeIn">
                        <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Motivo da Perda (Obrigatório)</label>
                        <select className="w-full border border-red-300 p-2 rounded bg-white mb-3 text-sm" value={lossReasonType} 
                            onChange={e => {
                                const val = e.target.value;
                                setLossReasonType(val);
                                if (val !== 'Outros') setFormData({...formData, rejectionReason: val});
                                else setFormData({...formData, rejectionReason: ''});
                            }}>
                            <option value="">-- Selecione o Motivo --</option>
                            {formData.status === 'Desistência' ? (
                                WITHDRAWAL_REASONS.map(r => <option key={r} value={r}>{r}</option>)
                            ) : (
                                GENERAL_REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)
                            )}
                            <option value="Outros">Outros (Escrever...)</option>
                        </select>
                        {lossReasonType === 'Outros' && (
                            <textarea className="w-full border border-red-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white min-h-[80px] text-sm shadow-inner" placeholder="Descreva o motivo detalhadamente..." value={formData.rejectionReason || ''} onChange={e => setFormData({...formData, rejectionReason: e.target.value})} />
                        )}
                    </div>
                )}

                <div className="md:col-span-2 grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                   <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">1º Contato</label><input type="date" className="w-full border p-2 rounded text-xs" value={toInputDate(formData.firstContactAt)} onChange={e => setFormData({...formData, firstContactAt: e.target.value})} /></div>
                   <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Entrevista</label><input type="date" className="w-full border p-2 rounded text-xs" value={toInputDate(formData.interviewAt)} onChange={e => setFormData({...formData, interviewAt: e.target.value})} /></div>
                   <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Último Contato</label><input type="date" className="w-full border p-2 rounded text-xs" value={toInputDate(formData.lastInteractionAt)} onChange={e => setFormData({...formData, lastInteractionAt: e.target.value})} /></div>
                </div>
             </div>
             <div className="flex justify-end gap-3 pt-4 border-t"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold">Cancelar</button><button onClick={handleSaveChanges} className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95">Salvar Candidato</button></div>
          </div>
        </div>
      )}

      {/* --- MODAL DE STATUS (CONGELAMENTO/CANCELAMENTO) --- */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fadeIn">
             <div className="flex items-center gap-2 mb-4 font-black text-slate-800 uppercase tracking-tighter">
                {targetStatus === 'Congelada' ? <PauseCircle size={24} className="text-amber-500"/> : <AlertTriangle size={24} className="text-red-500"/>} 
                Alterar Fluxo da Vaga
             </div>
             <div className="space-y-4">
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Data</label><input type="date" className="w-full border p-3 rounded-xl font-bold text-slate-700" value={statusFormData.date} onChange={e => setStatusFormData({...statusFormData, date: e.target.value})} /></div>
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Motivo</label><input className="w-full border p-3 rounded-xl" placeholder="Ex: Prioridade mudou..." value={statusFormData.reason} onChange={e => setStatusFormData({...statusFormData, reason: e.target.value})} /></div>
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Solicitante</label><input className="w-full border p-3 rounded-xl" placeholder="Nome do Gestor" value={statusFormData.requester} onChange={e => setStatusFormData({...statusFormData, requester: e.target.value})} /></div>
                <div className="flex gap-2 pt-4"><button onClick={() => setIsStatusModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Voltar</button><button onClick={handleStatusSubmit} className="flex-1 bg-slate-800 text-white font-black py-3 rounded-xl hover:bg-slate-900 shadow-lg uppercase text-[10px] tracking-widest">Confirmar</button></div>
             </div>
          </div>
        </div>
      )}

      {/* --- MODAL TESTE TÉCNICO (ATUALIZADO) --- */}
      {isTechModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl animate-fadeIn">
             <h3 className="font-black text-indigo-900 mb-6 flex items-center gap-2 uppercase tracking-tighter text-lg"><Beaker size={24}/> Avaliação Técnica</h3>
             <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-indigo-50 rounded-2xl border border-indigo-100 transition-all hover:bg-indigo-100/50">
                    <input type="checkbox" className="w-5 h-5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500" checked={techForm.didTest} onChange={e => setTechForm({...techForm, didTest: e.target.checked})} /> 
                    <span className="font-black text-indigo-900 text-sm uppercase tracking-widest">Registrar Teste Técnico</span>
                </label>
                
                {techForm.didTest && ( 
                    <div className="space-y-4 animate-fadeIn">
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Data Realização</label><input type="date" className="w-full border p-2 rounded-lg font-bold" value={techForm.date} onChange={e => setTechForm({...techForm, date: e.target.value})} /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Avaliador (Gestor)</label><input className="w-full border p-2 rounded-lg font-bold" value={techForm.evaluator} onChange={e => setTechForm({...techForm, evaluator: e.target.value})} /></div>
                      <div><label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Veredito</label><select className="w-full border p-2 rounded-lg font-bold" value={techForm.result} onChange={e => setTechForm({...techForm, result: e.target.value})}><option value="Aprovado">Aprovado</option><option value="Reprovado">Reprovado</option></select></div>
                      
                      {/* SE REPROVADO, MOSTRA SELETOR DE MOTIVO TÉCNICO */}
                      {techForm.result === 'Reprovado' && (
                          <div className="bg-red-50 p-3 rounded-lg border border-red-100 animate-fadeIn">
                              <label className="block text-[10px] font-black text-red-500 uppercase mb-1">Motivo da Reprovação</label>
                              <select 
                                  className="w-full border border-red-200 p-2 rounded-lg bg-white mb-2 text-sm text-red-800 font-medium outline-none focus:ring-2 focus:ring-red-300"
                                  value={techReasonType}
                                  onChange={(e) => {
                                      const val = e.target.value;
                                      setTechReasonType(val);
                                      if (val !== 'Outros') {
                                          setTechForm({...techForm, rejectionDetail: val});
                                      } else {
                                          setTechForm({...techForm, rejectionDetail: ''});
                                      }
                                  }}
                              >
                                  <option value="">Selecione...</option>
                                  {TECH_REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                  <option value="Outros">Outros (Escrever)</option>
                              </select>
                              
                              {techReasonType === 'Outros' && (
                                  <input 
                                    className="w-full border border-red-200 p-2 rounded-lg bg-white text-red-700 font-bold placeholder-red-300" 
                                    placeholder="Descreva o motivo..." 
                                    value={techForm.rejectionDetail} 
                                    onChange={e => setTechForm({...techForm, rejectionDetail: e.target.value})} 
                                  />
                              )}
                          </div>
                      )}
                    </div>
                )}
                
                <div className="flex justify-end gap-2 pt-4"><button onClick={() => setIsTechModalOpen(false)} className="px-5 py-2 text-slate-500 font-bold">Voltar</button><button onClick={saveTechTest} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-indigo-100">Salvar Avaliação</button></div>
             </div>
           </div>
        </div>
      )}

      {/* --- MODAL FECHAR VAGA / CONTRATAÇÃO --- */}
      {isHiringModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border-t-8 border-emerald-500 text-center animate-fadeIn">
              <div className="flex justify-center mb-4 text-emerald-600 bg-emerald-50 w-16 h-16 rounded-full items-center mx-auto shadow-inner"><CheckCircle size={36}/></div>
              <h3 className="text-xl font-black text-emerald-800 mb-2 uppercase tracking-tighter">Concluir Contratação</h3>
              <p className="text-slate-500 text-xs mb-6 font-bold uppercase tracking-widest">Confirme os dados finais para encerrar a vaga</p>
              
              <div className="text-left space-y-4">
                <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Colaborador Escolhido</label>
                    <select className="w-full border border-slate-200 p-3 rounded-xl font-black text-slate-700 bg-slate-50" value={candidateToHire?.id || ''} onChange={e => setCandidateToHire(jobCandidates.find(c => c.id === e.target.value) || null)}>
                        <option value="">-- Selecione o Vencedor --</option>
                        {jobCandidates.filter(c => ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                {candidateToHire && ( <div className="space-y-4 animate-fadeIn">
                    <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Salário Combinado</label><input className="w-full border p-3 rounded-xl font-bold" value={hiringData.finalSalary} onChange={e => setHiringData({...hiringData, finalSalary: e.target.value})} placeholder="R$ 0.000,00" /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Contrato</label><select className="w-full border p-3 rounded-xl font-bold" value={hiringData.contractType} onChange={e => setHiringData({...hiringData, contractType: e.target.value as ContractType})}><option value="CLT">CLT</option><option value="PJ">PJ</option><option value="Estágio">Estágio</option></select></div>
                        <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Data Início</label><input type="date" className="w-full border p-3 rounded-xl font-bold" value={hiringData.startDate} onChange={e => setHiringData({...hiringData, startDate: e.target.value})} /></div>
                    </div>
                    <button onClick={handleHiringSubmit} className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-100 uppercase tracking-widest mt-4 hover:bg-emerald-700 transition-all active:scale-95">Confirmar e Finalizar Vaga</button>
                </div>)}
              </div>
              <button onClick={() => setIsHiringModalOpen(false)} className="w-full py-3 text-slate-400 mt-2 font-bold uppercase text-[10px] tracking-widest hover:text-slate-600">Voltar</button>
           </div>
        </div>
      )}

      {/* --- MODAL EXPORTAR PARA BANCO DE TALENTOS (ATUALIZADO COM TELEFONE) --- */}
      {isTalentModalOpen && (
        <div className="fixed inset-0 bg-indigo-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg animate-fadeIn border-t-8 border-indigo-600">
              <div className="flex items-center gap-3 mb-6"><Database size={28} className="text-indigo-600"/><h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Exportar para Banco</h3></div>
              <div className="space-y-4">
                 <div className="bg-slate-50 p-4 rounded-xl border border-slate-100"><label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Nome do Candidato</label><div className="font-bold text-slate-700">{talentFormData.name}</div></div>
                 <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Cidade</label><input className="w-full border p-3 rounded-xl font-bold" placeholder="Cidade de origem" value={talentFormData.city || ''} onChange={e => setTalentFormData({...talentFormData, city: e.target.value})} /></div>
                 
                 {/* CAMPOS SEPARADOS NO MODAL DE EXPORTAÇÃO */}
                 <div className="grid grid-cols-2 gap-4">
                     <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Email</label><input className="w-full border p-3 rounded-xl font-bold" placeholder="email@..." value={talentEmail} onChange={e => setTalentEmail(e.target.value)} /></div>
                     <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Telefone</label><input className="w-full border p-3 rounded-xl font-bold" placeholder="(XX)..." value={talentPhone} onChange={e => setTalentPhone(e.target.value)} /></div>
                 </div>

                 <div><label className="block text-xs font-black text-slate-400 uppercase mb-1">Cargo para Busca Futura</label><input className="w-full border p-3 rounded-xl font-bold" placeholder="Ex: Desenvolvedor, Vendedor..." value={talentFormData.targetRole || ''} onChange={e => setTalentFormData({...talentFormData, targetRole: e.target.value})} /></div>
                 <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <button onClick={() => setIsTalentModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold uppercase text-[10px] tracking-widest">Voltar</button>
                    <button onClick={() => { 
                        // JUNTA TUDO ANTES DE SALVAR (AGORA COM O TELEFONE CERTO)
                        const finalContact = [talentEmail, talentPhone].filter(Boolean).join(' | ');
                        
                        addTalent({ 
                            ...talentFormData, 
                            contact: finalContact, // SALVA UNIDO
                            id: generateId(), 
                            createdAt: new Date().toISOString(),
                            tags: [],
                            education: [],
                            experience: [],
                            observations: [`Importado da vaga: ${job.title}`]
                        } as TalentProfile); 
                        setIsTalentModalOpen(false); 
                        alert('Talento salvo com sucesso no Banco!'); 
                    }} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black shadow-lg shadow-indigo-100 uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all active:scale-95">Salvar Perfil</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
