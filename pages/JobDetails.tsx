import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, User, Phone, Mail, Calendar, Clock, 
  MessageSquare, Save, X, Search, Linkedin, Instagram, 
  Globe, Users, UserPlus, MapPin, Briefcase, Filter,
  CheckCircle, Award, DollarSign, Activity, Lock, Download,
  Plus, Archive, Database, MessageCircle, ExternalLink, Target, Link as LinkIcon,
  Beaker, AlertTriangle, FileText, PauseCircle 
} from 'lucide-react';
import { Candidate, Job, TalentProfile, ContractType, CandidateTimeline } from '../types';
import { exportJobCandidates } from '../services/excelService';
import { differenceInDays, parseISO } from 'date-fns';

const generateId = () => crypto.randomUUID();

// Helper de Data (UTC para não pular dia)
const toInputDate = (isoString?: string) => {
  if (!isoString) return '';
  return isoString.split('T')[0];
};

const formatDate = (isoString?: string) => {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

// Helper de Ícones de Origem
const getSourceIcon = (origin: string) => {
  const norm = origin?.toLowerCase() || '';
  if (norm.includes('linkedin')) return <Linkedin size={16} className="text-blue-600" />;
  if (norm.includes('instagram')) return <Instagram size={16} className="text-pink-600" />;
  if (norm.includes('indicação') || norm.includes('indicacao')) return <LinkIcon size={16} className="text-teal-600" />;
  if (norm.includes('interno')) return <Briefcase size={16} className="text-slate-600" />;
  if (norm.includes('banco')) return <Database size={16} className="text-orange-600" />;
  if (norm.includes('sine')) return <Globe size={16} className="text-green-600" />;
  return <Search size={16} className="text-purple-600" />;
};

export const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobs, candidates, updateCandidate, addCandidate, addTalent, updateJob, talents, user } = useData();
  
  const [job, setJob] = useState<Job | undefined>(undefined);
  const [jobCandidates, setJobCandidates] = useState<Candidate[]>([]);
  
  // --- ESTADOS DE FLUXO DA VAGA ---
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'Cancelada' | 'Congelada' | 'Aberta' | null>(null);
  
  const [statusFormData, setStatusFormData] = useState({ 
    requester: '', 
    reason: '', 
    date: toInputDate(new Date().toISOString()) 
  });

  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);
  const [candidateToHire, setCandidateToHire] = useState<Candidate | null>(null);
  const [hiringData, setHiringData] = useState({ contractType: 'CLT' as ContractType, finalSalary: '', startDate: '' });

  // --- ESTADOS DE CANDIDATO ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Candidate>>({});
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // --- TESTE TÉCNICO ---
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [techCandidate, setTechCandidate] = useState<Candidate | null>(null);
  const [techForm, setTechForm] = useState({ didTest: false, date: '', evaluator: '', result: 'Aprovado', rejectionDetail: '' });

  // --- BANCO DE TALENTOS ---
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
  const [talentFormData, setTalentFormData] = useState<Partial<TalentProfile>>({});

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  // Atualiza dados
  useEffect(() => {
    const foundJob = jobs.find(j => j.id === id);
    setJob(foundJob);
    if (foundJob) {
      setJobCandidates(candidates.filter(c => c.jobId === foundJob.id));
    }
  }, [jobs, candidates, id]);

  const hiredCandidate = useMemo(() => {
      return jobCandidates.find(c => c.status === 'Contratado' || job?.hiredCandidateIds?.includes(c.id));
  }, [jobCandidates, job]);

  // --- CÁLCULO DE MÉTRICAS E SLA ---
  const metrics = useMemo(() => {
    if (!job) return { daysOpen: 0, daysFrozen: 0, daysNet: 0, enrolled: 0, interviewed: 0, finalists: 0, rejected: 0, withdrawn: 0, origins: {} };

    // SLA Bruto
    const endDate = job.status === 'Fechada' && job.closedAt ? new Date(job.closedAt).getTime() : new Date().getTime();
    const startDate = new Date(job.openedAt).getTime();
    const daysOpenBruto = Math.ceil((endDate - startDate) / (1000 * 3600 * 24));

    // Dias Congelados
    let totalFrozenMilliseconds = 0;
    if (job.freezeHistory) {
        job.freezeHistory.forEach(freeze => {
            const startFreeze = new Date(freeze.startDate).getTime();
            const endFreeze = freeze.endDate ? new Date(freeze.endDate).getTime() : endDate;
            if (endFreeze > startFreeze) {
                totalFrozenMilliseconds += (endFreeze - startFreeze);
            }
        });
    }
    const daysFrozen = Math.floor(totalFrozenMilliseconds / (1000 * 3600 * 24));

    // SLA Líquido
    const daysNet = Math.max(0, daysOpenBruto - daysFrozen);

    // Contagem de Origens
    const origins: Record<string, number> = { 'LinkedIn': 0, 'Instagram': 0, 'Indicação': 0, 'Outros': 0 };
    jobCandidates.forEach(c => {
        const o = c.origin?.toLowerCase() || '';
        if (o.includes('linkedin')) origins['LinkedIn']++;
        else if (o.includes('instagram')) origins['Instagram']++;
        else if (o.includes('indicação')) origins['Indicação']++;
        else origins['Outros']++;
    });

    return {
        daysOpen: daysOpenBruto,
        daysFrozen,
        daysNet,
        enrolled: jobCandidates.length,
        interviewed: jobCandidates.filter(c => c.interviewAt).length, 
        finalists: jobCandidates.filter(c => ['Em Teste', 'Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).length,
        rejected: jobCandidates.filter(c => c.status === 'Reprovado').length,
        withdrawn: jobCandidates.filter(c => c.status === 'Desistência').length,
        origins
    };
  }, [job, jobCandidates]);

  // --- HANDLERS DE STATUS DA VAGA ---
  const initiateStatusChange = (newStatus: string) => {
    if (!job) return;
    if (newStatus === job.status) return;

    if (newStatus === 'Fechada') {
        setIsHiringModalOpen(true);
        const likelyHire = jobCandidates.find(c => c.status === 'Aprovado' || c.status === 'Proposta Aceita');
        setCandidateToHire(likelyHire || null);
        return;
    }
    
    if (newStatus === 'Congelada' || newStatus === 'Cancelada' || (newStatus === 'Aberta' && job.status === 'Congelada')) {
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
        updatedJob.freezeHistory = [
            ...(job.freezeHistory || []), 
            { 
                startDate: actionDateISO, 
                reason: statusFormData.reason, 
                requester: statusFormData.requester 
            }
        ];
    } else if (targetStatus === 'Aberta' && job.status === 'Congelada') {
        if (updatedJob.freezeHistory && updatedJob.freezeHistory.length > 0) {
            const history = [...updatedJob.freezeHistory];
            history[history.length - 1] = {
                ...history[history.length - 1],
                endDate: actionDateISO
            };
            updatedJob.freezeHistory = history;
        }
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
    
    // Data de início escolhida
    const startDateISO = hiringData.startDate ? `${hiringData.startDate}T12:00:00.000Z` : new Date().toISOString();

    const updatedCandidate = {
        ...candidateToHire,
        status: 'Contratado',
        contractType: hiringData.contractType,
        finalSalary: hiringData.finalSalary,
        timeline: { ...candidateToHire.timeline, startDate: startDateISO }
    } as Candidate;
    updateCandidate(updatedCandidate);

    updateJob({ 
        ...job, 
        status: 'Fechada', 
        // CORREÇÃO CRÍTICA: Data de Fechamento = Data de Início do Candidato
        closedAt: startDateISO, 
        hiredCandidateIds: [candidateToHire.id] 
    });
    setIsHiringModalOpen(false);
  };

  // --- HANDLERS DE CANDIDATO ---
  const handleOpenModal = (candidate?: Candidate) => {
    if (candidate) {
        setSelectedCandidate(candidate);
        setFormData({ ...candidate });
    } else {
        setSelectedCandidate(null);
        setFormData({ jobId: job?.id, status: 'Aguardando Triagem', origin: 'LinkedIn', contractType: 'CLT', createdAt: new Date().toISOString() });
    }
    setIsModalOpen(true);
  };

  const handleSaveChanges = async () => {
    const processedData = { ...formData };
    if (processedData.firstContactAt) processedData.firstContactAt = `${toInputDate(processedData.firstContactAt)}T12:00:00.000Z`;
    if (processedData.interviewAt) processedData.interviewAt = `${toInputDate(processedData.interviewAt)}T12:00:00.000Z`;
    if (processedData.lastInteractionAt) processedData.lastInteractionAt = `${toInputDate(processedData.lastInteractionAt)}T12:00:00.000Z`;

    if (processedData.status === 'Reprovado' || processedData.status === 'Desistência') {
        if (!processedData.rejectionReason) {
            alert("Por favor, selecione um motivo para a perda.");
            return;
        }
        processedData.rejectedBy = user?.name || 'Sistema';
        processedData.rejectionDate = new Date().toISOString();
    }

    if (selectedCandidate) {
        await updateCandidate({ ...selectedCandidate, ...processedData } as Candidate);
    } else {
        await addCandidate({ ...processedData, id: generateId() } as Candidate);
    }
    setIsModalOpen(false);
  };

  // --- HANDLER DE TESTE TÉCNICO ---
  const handleOpenTechModal = (c: Candidate) => {
    setTechCandidate(c);
    setTechForm({ 
        didTest: c.techTest || false, 
        date: toInputDate(c.techTestDate || new Date().toISOString()), 
        evaluator: c.techTestEvaluator || '', 
        result: c.techTestResult || 'Aprovado',
        rejectionDetail: '' 
    });
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
        update.rejectionReason = techForm.rejectionDetail || 'Reprovado no Teste Técnico';
        update.rejectionDate = new Date().toISOString();
        update.rejectedBy = user?.name || 'Sistema';
    }

    updateCandidate(update);
    setIsTechModalOpen(false);
  };

  // --- RENDER ---
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
            <button onClick={() => navigate('/jobs')} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <ArrowLeft size={24} />
            </button>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">{job.title}</h1>
                <div className="text-sm text-slate-500 flex gap-2 items-center">
                    <span>{job.sector}</span> &bull; <span>{job.unit}</span> &bull; 
                    <select 
                        value={job.status} 
                        onChange={(e) => initiateStatusChange(e.target.value)}
                        className={`text-xs font-bold px-2 py-1 rounded cursor-pointer outline-none border transition-colors
                        ${job.status === 'Aberta' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                            job.status === 'Fechada' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            job.status === 'Congelada' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                            'bg-red-100 text-red-600 border-red-200'
                        }`}
                    >
                        <option value="Aberta">Aberta {job.status === 'Congelada' ? '(Descongelar)' : ''}</option>
                        <option value="Fechada">Fechada (Concluir)</option>
                        <option value="Congelada">Congelada (Pausar)</option>
                        <option value="Cancelada">Cancelada</option>
                    </select>
                </div>
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => exportJobCandidates(job, jobCandidates)} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm">
                <Download size={18} /> Exportar Excel
            </button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md">
                <Plus size={18} /> Adicionar Candidato
            </button>
        </div>
      </div>

      {/* DASHBOARD DE MÉTRICAS (SLA + ORIGENS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-7 divide-x divide-slate-100 gap-y-4 md:gap-y-0">
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Dias Bruto</div><div className="text-xl font-bold text-slate-600">{metrics.daysOpen}</div></div>
             <div className="px-2 text-center bg-amber-50/50 rounded"><div className="text-[10px] font-bold text-amber-600 uppercase">Dias Congelada</div><div className="text-xl font-bold text-amber-700">{metrics.daysFrozen}</div></div>
             <div className="px-2 text-center bg-blue-50/50 rounded"><div className="text-[10px] font-bold text-blue-600 uppercase">SLA Líquido</div><div className="text-xl font-bold text-blue-700">{metrics.daysNet}</div></div>
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Entrevistas</div><div className="text-xl font-bold text-slate-700">{metrics.interviewed}</div></div>
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Finalistas</div><div className="text-xl font-bold text-slate-700">{metrics.finalists}</div></div>
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Reprovados</div><div className="text-xl font-bold text-red-600">{metrics.rejected}</div></div>
             <div className="px-2 text-center"><div className="text-[10px] font-bold text-slate-400 uppercase">Desistentes</div><div className="text-xl font-bold text-amber-500">{metrics.withdrawn}</div></div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex justify-around items-center">
             <div className="text-center"><Linkedin size={20} className="text-blue-600 mx-auto mb-1"/><span className="text-sm font-bold text-slate-700">{metrics.origins['LinkedIn']}</span></div>
             <div className="text-center"><Instagram size={20} className="text-pink-600 mx-auto mb-1"/><span className="text-sm font-bold text-slate-700">{metrics.origins['Instagram']}</span></div>
             <div className="text-center"><LinkIcon size={20} className="text-teal-600 mx-auto mb-1"/><span className="text-sm font-bold text-slate-700">{metrics.origins['Indicação']}</span></div>
             <div className="text-center"><Search size={20} className="text-purple-600 mx-auto mb-1"/><span className="text-sm font-bold text-slate-700">{metrics.origins['Outros']}</span></div>
          </div>
      </div>

      {/* BANNER DE CONTRATAÇÃO */}
      {job.status === 'Fechada' && hiredCandidate && (
        <div className="mb-8 bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl shadow-xl text-white p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-6">
           <div className="bg-white/20 p-4 rounded-full"><CheckCircle size={40} className="text-white"/></div>
           <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold mb-1">Vaga Preenchida!</h2>
              <p className="text-emerald-100 font-medium text-lg">{hiredCandidate.name}</p>
              
              <div className="flex flex-wrap gap-4 mt-3 justify-center md:justify-start text-sm">
                 <span className="bg-white/20 px-3 py-1 rounded flex items-center gap-2" title="Salário Final"><DollarSign size={14}/> {hiredCandidate.finalSalary || 'N/I'}</span>
                 <span className="bg-white/20 px-3 py-1 rounded flex items-center gap-2" title="Data de Início"><Calendar size={14}/> Início: {formatDate(hiredCandidate.timeline?.startDate)}</span>
                 <span className="bg-white/20 px-3 py-1 rounded flex items-center gap-2" title="Tempo Líquido"><Activity size={14}/> SLA Real: {metrics.daysNet} dias</span>
                 <span className="bg-white/20 px-3 py-1 rounded flex items-center gap-2" title="Tipo de Contrato"><FileText size={14}/> {hiredCandidate.contractType || 'CLT'}</span>
                 {hiredCandidate.techTestEvaluator && (
                    <span className="bg-white/20 px-3 py-1 rounded flex items-center gap-2" title="Aprovador Técnico"><Beaker size={14}/> Aprov.: {hiredCandidate.techTestEvaluator}</span>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* FILTROS E BUSCA */}
      <div className="flex gap-4 mb-6">
         <input className="flex-1 border p-3 rounded-xl shadow-sm" placeholder="Buscar candidato..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
         <select className="border p-3 rounded-xl shadow-sm bg-white font-medium text-slate-600" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="Aguardando Triagem">Aguardando</option>
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
          <div key={c.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all group 
                ${c.status === 'Reprovado' ? 'border-red-200 bg-red-50/20' : 
                  c.status === 'Desistência' ? 'border-amber-200 bg-amber-50/20' : 
                  'border-slate-200'}`}>
             <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold">{c.name.charAt(0)}</div>
                   <div>
                      <h3 className="font-bold text-slate-800 cursor-pointer hover:text-blue-600" onClick={() => handleOpenModal(c)}>{c.name}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                         {getSourceIcon(c.origin)} <span>{c.origin}</span>
                         {c.city && <span>• {c.city}</span>}
                      </div>
                   </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase 
                        ${c.status === 'Reprovado' ? 'bg-red-100 text-red-700' : 
                          c.status === 'Desistência' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-50 text-blue-700'}`}>{c.status}</span>
                   {c.phone && <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded hover:bg-green-100"><MessageCircle size={10}/> WhatsApp</a>}
                </div>
             </div>

             <div className="flex justify-between items-center bg-slate-50 p-2 rounded mb-3 text-xs border border-slate-100">
                <span className="flex items-center gap-1 text-slate-600"><User size={12}/> {c.age} anos</span>
                <span className="flex items-center gap-1 text-emerald-700 font-bold"><DollarSign size={12}/> {c.salaryExpectation || 'N/I'}</span>
             </div>

             <div className="space-y-1 text-xs text-slate-500 border-t border-slate-100 pt-2 mb-3">
                <div className="flex justify-between"><span>1º Contato:</span><span className="font-bold text-slate-700">{formatDate(c.firstContactAt)}</span></div>
                <div className="flex justify-between"><span>Entrevista:</span><span className={`font-bold ${c.interviewAt ? 'text-blue-600' : 'text-slate-300'}`}>{formatDate(c.interviewAt)}</span></div>
             </div>

             <div className="flex gap-2 mt-auto">
                <button onClick={() => handleOpenTechModal(c)} className={`flex-1 flex justify-center items-center gap-1 py-1.5 rounded text-xs font-bold border transition-colors ${c.techTest ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-white text-slate-500 border-slate-200'}`} title="Teste Técnico">
                   <Beaker size={12}/> {c.techTest ? c.techTestResult : 'Teste'}
                </button>
                <button onClick={() => { setTalentFormData({ name: c.name, city: c.city, contact: c.phone, targetRole: job.title }); setIsTalentModalOpen(true); }} className="flex-1 flex justify-center items-center gap-1 bg-white hover:bg-orange-50 text-slate-500 hover:text-orange-600 py-1.5 rounded text-xs font-bold border border-slate-200 transition-colors" title="Banco de Talentos">
                   <Database size={12}/> Banco
                </button>
                <button onClick={() => handleOpenModal(c)} className="flex-1 flex justify-center items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded text-xs font-bold transition-colors">
                   <User size={12}/> Editar
                </button>
             </div>
          </div>
        ))}
      </div>

      {/* --- MODAL DE EDIÇÃO DO CANDIDATO --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
             <div className="flex justify-between mb-6 border-b pb-4">
               <h3 className="font-bold text-xl text-slate-800">Gerenciar Candidato</h3>
               <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400"/></button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nome</label><input className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Telefone</label><input className="w-full border p-2 rounded" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Email</label><input className="w-full border p-2 rounded" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Cidade</label><input className="w-full border p-2 rounded" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Pretensão Salarial</label><input className="w-full border p-2 rounded" value={formData.salaryExpectation || ''} onChange={e => setFormData({...formData, salaryExpectation: e.target.value})} /></div>
                
                {/* STATUS COM LÓGICA DE PERDA */}
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                   <select className="w-full border p-2 rounded" value={formData.status || 'Aguardando Triagem'} onChange={e => setFormData({...formData, status: e.target.value})}>
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
                   <select className="w-full border p-2 rounded" value={formData.origin || 'LinkedIn'} onChange={e => setFormData({...formData, origin: e.target.value})}>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Instagram">Instagram</option>
                      <option value="Indicação">Indicação</option>
                      <option value="Banco de Talentos">Banco de Talentos</option>
                      <option value="Busca espontânea">Busca Espontânea</option>
                      <option value="SINE">SINE</option>
                      <option value="Outros">Outros</option>
                   </select>
                </div>

                {/* CAMPO DE MOTIVO DA PERDA (DINÂMICO) */}
                {(formData.status === 'Reprovado' || formData.status === 'Desistência') && (
                    <div className="md:col-span-2 bg-red-50 p-4 rounded-lg border border-red-200 animate-fadeIn">
                        <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1">
                            <AlertTriangle size={12}/> Motivo da {formData.status} (Obrigatório)
                        </label>
                        <select 
                            className="w-full border border-red-300 p-2 rounded bg-white text-slate-700" 
                            value={formData.rejectionReason || ''} 
                            onChange={e => setFormData({...formData, rejectionReason: e.target.value})}
                        >
                            <option value="">-- Selecione o Motivo --</option>
                            {formData.status === 'Desistência' ? (
                                <>
                                    <option value="Aceitou outra proposta">Aceitou outra proposta</option>
                                    <option value="Salário abaixo da pretensão">Salário abaixo da pretensão</option>
                                    <option value="Distância / Localização">Distância / Localização</option>
                                    <option value="Desinteresse na vaga">Desinteresse na vaga</option>
                                    <option value="Outros">Outros</option>
                                </>
                            ) : (
                                <>
                                    <option value="Perfil Técnico Insuficiente">Perfil Técnico Insuficiente</option>
                                    <option value="Sem Fit Cultural">Sem Fit Cultural</option>
                                    <option value="Reprovado no Teste Técnico">Reprovado no Teste Técnico</option>
                                    <option value="Salário acima do budget">Salário acima do budget</option>
                                    <option value="Outros">Outros</option>
                                </>
                            )}
                        </select>
                    </div>
                )}

                <div className="md:col-span-2 bg-blue-50 p-4 rounded-lg grid grid-cols-3 gap-4 border border-blue-100">
                   <div><label className="block text-xs font-bold text-blue-800 mb-1">1º Contato</label><input type="date" className="w-full border p-1.5 rounded" value={toInputDate(formData.firstContactAt)} onChange={e => setFormData({...formData, firstContactAt: e.target.value})} /></div>
                   <div><label className="block text-xs font-bold text-blue-800 mb-1">Entrevista</label><input type="date" className="w-full border p-1.5 rounded" value={toInputDate(formData.interviewAt)} onChange={e => setFormData({...formData, interviewAt: e.target.value})} /></div>
                   <div><label className="block text-xs font-bold text-blue-800 mb-1">Último Contato</label><input type="date" className="w-full border p-1.5 rounded" value={toInputDate(formData.lastInteractionAt)} onChange={e => setFormData({...formData, lastInteractionAt: e.target.value})} /></div>
                </div>
             </div>
             
             <div className="flex justify-end gap-3 pt-4 border-t">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold">Cancelar</button>
                <button onClick={handleSaveChanges} className="px-6 py-2 bg-blue-600 text-white rounded font-bold">Salvar</button>
             </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE TESTE TÉCNICO --- */}
      {isTechModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
             <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2"><Beaker size={20}/> Avaliação Técnica</h3>
             <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                   <input type="checkbox" checked={techForm.didTest} onChange={e => setTechForm({...techForm, didTest: e.target.checked})} className="w-5 h-5" />
                   <span className="font-bold text-indigo-900">Realizou Teste?</span>
                </label>
                {techForm.didTest && (
                   <div className="space-y-3">
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">Data</label><input type="date" className="w-full border p-2 rounded" value={techForm.date} onChange={e => setTechForm({...techForm, date: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">Avaliador</label><input className="w-full border p-2 rounded" value={techForm.evaluator} onChange={e => setTechForm({...techForm, evaluator: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold text-slate-500 mb-1">Resultado</label>
                         <select className="w-full border p-2 rounded" value={techForm.result} onChange={e => setTechForm({...techForm, result: e.target.value})}>
                            <option value="Aprovado">Aprovado</option>
                            <option value="Reprovado">Reprovado</option>
                         </select>
                      </div>
                      
                      {techForm.result === 'Reprovado' && (
                          <div className="animate-fadeIn">
                              <label className="block text-xs font-bold text-red-600 mb-1 flex items-center gap-1"><AlertTriangle size={10}/> Motivo da Reprovação</label>
                              <input 
                                className="w-full border p-2 rounded border-red-200 bg-red-50 text-red-700 placeholder-red-300"
                                placeholder="Ex: Não atingiu pontuação mínima..."
                                value={techForm.rejectionDetail} 
                                onChange={e => setTechForm({...techForm, rejectionDetail: e.target.value})} 
                              />
                          </div>
                      )}
                   </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                   <button onClick={() => setIsTechModalOpen(false)} className="px-4 py-2 text-slate-500 text-sm">Cancelar</button>
                   <button onClick={saveTechTest} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold text-sm">Salvar</button>
                </div>
             </div>
           </div>
        </div>
      )}

      {/* --- MODAL DE CONTRATAÇÃO --- */}
      {isHiringModalOpen && (
        <div className="fixed inset-0 bg-emerald-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-t-8 border-emerald-500">
              <h3 className="text-xl font-bold text-emerald-800 mb-4 flex items-center gap-2"><CheckCircle size={24}/> Fechar Vaga</h3>
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Candidato Contratado</label>
                    <select className="w-full border p-2 rounded font-bold" value={candidateToHire?.id || ''} onChange={e => setCandidateToHire(jobCandidates.find(c => c.id === e.target.value) || null)}>
                        <option value="">-- Selecione o Vencedor --</option>
                        {jobCandidates.filter(c => ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 {candidateToHire && (
                    <>
                       <div><label className="block text-xs font-bold text-slate-500 mb-1">Salário Final</label><input className="w-full border p-2 rounded" value={hiringData.finalSalary} onChange={e => setHiringData({...hiringData, finalSalary: e.target.value})} placeholder="R$ 0,00" /></div>
                       <div><label className="block text-xs font-bold text-slate-500 mb-1">Tipo de Contrato</label>
                          <select className="w-full border p-2 rounded" value={hiringData.contractType} onChange={e => setHiringData({...hiringData, contractType: e.target.value as ContractType})}>
                             <option value="CLT">CLT</option>
                             <option value="PJ">PJ</option>
                             <option value="Estágio">Estágio</option>
                          </select>
                       </div>
                       <div><label className="block text-xs font-bold text-slate-500 mb-1">Data de Início</label><input type="date" className="w-full border p-2 rounded" value={hiringData.startDate} onChange={e => setHiringData({...hiringData, startDate: e.target.value})} /></div>
                       <button onClick={handleHiringSubmit} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-lg mt-2">Confirmar Contratação</button>
                    </>
                 )}
                 <button onClick={() => setIsHiringModalOpen(false)} className="w-full py-2 text-slate-400 font-bold hover:text-slate-600">Cancelar</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL DE STATUS (CONGELAMENTO/CANCELAMENTO) --- */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
             <div className="flex items-center gap-2 mb-4 text-slate-800">
                {targetStatus === 'Congelada' ? <PauseCircle size={24} className="text-amber-500"/> : <AlertTriangle size={24} className="text-red-500"/>}
                <h3 className="text-lg font-bold">
                    {targetStatus === 'Congelada' ? 'Congelar Vaga' : 
                     targetStatus === 'Aberta' ? 'Descongelar Vaga' : 'Cancelar Vaga'}
                </h3>
             </div>
             
             <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                     {targetStatus === 'Congelada' ? 'Data do Congelamento' : 
                      targetStatus === 'Aberta' ? 'Data do Retorno (Descongelamento)' : 'Data do Cancelamento'}
                  </label>
                  <input required type="date" className="w-full border p-2 rounded text-sm" value={statusFormData.date} onChange={e => setStatusFormData({...statusFormData, date: e.target.value})} />
                </div>
                
                {targetStatus !== 'Aberta' && (
                    <>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Motivo</label>
                            <input className="w-full border p-2 rounded" value={statusFormData.reason} onChange={e => setStatusFormData({...statusFormData, reason: e.target.value})} placeholder="Por que está alterando?" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Solicitante</label><input className="w-full border p-2 rounded" value={statusFormData.requester} onChange={e => setStatusFormData({...statusFormData, requester: e.target.value})} placeholder="Quem pediu?" />
                        </div>
                    </>
                )}

                <div className="flex gap-2 pt-2">
                    <button onClick={() => setIsStatusModalOpen(false)} className="flex-1 py-2 text-slate-500 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                    <button onClick={handleStatusSubmit} className="flex-1 bg-slate-800 text-white font-bold py-2 rounded hover:bg-slate-900">Confirmar</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* --- MODAL TALENTO --- */}
      {isTalentModalOpen && (
        <div className="fixed inset-0 bg-indigo-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
              <h3 className="text-lg font-bold mb-4 text-indigo-900 flex items-center gap-2"><Database size={20}/> Exportar para Banco</h3>
              <div className="space-y-3">
                 <input className="w-full border p-2 rounded bg-slate-50" value={talentFormData.name} disabled />
                 <input className="w-full border p-2 rounded" placeholder="Cidade" value={talentFormData.city || ''} onChange={e => setTalentFormData({...talentFormData, city: e.target.value})} />
                 <input className="w-full border p-2 rounded" placeholder="Cargo Alvo" value={talentFormData.targetRole || ''} onChange={e => setTalentFormData({...talentFormData, targetRole: e.target.value})} />
                 <div className="flex justify-end gap-2 pt-2">
                    <button onClick={() => setIsTalentModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button>
                    <button onClick={() => { addTalent(talentFormData as TalentProfile); setIsTalentModalOpen(false); alert('Salvo!'); }} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Salvar</button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
