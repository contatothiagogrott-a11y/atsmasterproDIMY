import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, User, Phone, Mail, Calendar, Clock, 
  MessageSquare, Save, X, Search, Linkedin, Instagram, 
  Globe, Users, UserPlus, MapPin, Briefcase, Filter,
  CheckCircle, Award, DollarSign, Activity, Lock, Download,
  Plus, Archive, Database, MessageCircle, ExternalLink, Target, Link as LinkIcon,
  Beaker, AlertTriangle, FileText, PauseCircle 
} from 'lucide-react';
import { Candidate, Job, TalentProfile, ContractType } from '../types';
import { exportJobCandidates } from '../services/excelService';
import { differenceInDays, parseISO } from 'date-fns';

const generateId = () => crypto.randomUUID();

// Lista de motivos padrão para a lógica do "Outros"
const STANDARD_REASONS = [
  "Aceitou outra proposta", 
  "Salário abaixo da pretensão", 
  "Distância / Localização", 
  "Desinteresse na vaga",
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
  const { jobs, candidates, updateCandidate, addCandidate, addTalent, updateJob, user } = useData();
  
  const [job, setJob] = useState<Job | undefined>(undefined);
  const [jobCandidates, setJobCandidates] = useState<Candidate[]>([]);
  
  // --- ESTADOS DE FLUXO DA VAGA ---
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'Cancelada' | 'Congelada' | 'Aberta' | null>(null);
  const [statusFormData, setStatusFormData] = useState({ requester: '', reason: '', date: toInputDate(new Date().toISOString()) });

  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);
  const [candidateToHire, setCandidateToHire] = useState<Candidate | null>(null);
  const [hiringData, setHiringData] = useState({ contractType: 'CLT' as ContractType, finalSalary: '', startDate: '' });

  // --- ESTADOS DE CANDIDATO ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Candidate>>({});
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [lossReasonType, setLossReasonType] = useState(''); // Controla se o select exibe "Outros"

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

  // --- HANDLERS ---
  const initiateStatusChange = (newStatus: string) => {
    if (!job || newStatus === job.status) return;
    if (newStatus === 'Fechada') {
        setIsHiringModalOpen(true);
        setCandidateToHire(jobCandidates.find(c => c.status === 'Aprovado' || c.status === 'Proposta Aceita') || null);
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
        updatedJob.freezeHistory = [...(job.freezeHistory || []), { startDate: actionDateISO, reason: statusFormData.reason, requester: statusFormData.requester }];
    } else if (targetStatus === 'Aberta' && job.status === 'Congelada') {
        if (updatedJob.freezeHistory && updatedJob.freezeHistory.length > 0) {
            const history = [...updatedJob.freezeHistory];
            history[history.length - 1] = { ...history[history.length - 1], endDate: actionDateISO };
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
            const isStandard = STANDARD_REASONS.includes(candidate.rejectionReason);
            setLossReasonType(isStandard ? candidate.rejectionReason : 'Outros');
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
    setTechForm({ didTest: c.techTest || false, date: toInputDate(c.techTestDate || new Date().toISOString()), evaluator: c.techTestEvaluator || '', result: c.techTestResult || 'Aprovado', rejectionDetail: '' });
    setIsTechModalOpen(true);
  };

  const saveTechTest = () => {
    if (!techCandidate) return;
    const update = { ...techCandidate, techTest: techForm.didTest, techTestDate: techForm.didTest ? `${techForm.date}T12:00:00.000Z` : undefined, techTestEvaluator: techForm.didTest ? techForm.evaluator : undefined, techTestResult: techForm.didTest ? techForm.result : undefined };
    if (techForm.didTest && techForm.result === 'Reprovado') {
        update.status = 'Reprovado';
        update.rejectionReason = techForm.rejectionDetail || 'Reprovado no Teste Técnico';
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

      {job.status === 'Fechada' && hiredCandidate && (
        <div className="mb-8 bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl shadow-xl text-white p-6 flex flex-col md:flex-row items-center gap-6">
           <div className="bg-white/20 p-4 rounded-full"><CheckCircle size={40}/></div>
           <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold mb-1">Vaga Preenchida!</h2>
              <p className="text-emerald-100 font-medium text-lg">{hiredCandidate.name}</p>
              <div className="flex flex-wrap gap-4 mt-3 justify-center md:justify-start text-xs opacity-90">
                 <span>Salário: {hiredCandidate.finalSalary || 'N/I'}</span>
                 <span>Início: {formatDate(hiredCandidate.timeline?.startDate)}</span>
                 <span>SLA Real: {metrics.daysNet} dias</span>
                 <span>Contrato: {hiredCandidate.contractType || 'CLT'}</span>
              </div>
           </div>
        </div>
      )}

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map(c => (
          <div key={c.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all group ${c.status === 'Reprovado' ? 'border-red-200' : c.status === 'Desistência' ? 'border-amber-200' : 'border-slate-200'}`}>
             <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold">{c.name.charAt(0)}</div>
                   <div><h3 className="font-bold cursor-pointer hover:text-blue-600" onClick={() => handleOpenModal(c)}>{c.name}</h3><div className="flex items-center gap-2 mt-1 text-xs text-slate-50">{getSourceIcon(c.origin || '')} <span>{c.origin}</span></div></div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${c.status === 'Reprovado' ? 'bg-red-100 text-red-700' : c.status === 'Desistência' ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{c.status}</span>
             </div>
             <div className="flex gap-2 mt-auto">
                <button onClick={() => handleOpenTechModal(c)} className={`flex-1 flex justify-center items-center gap-1 py-1.5 rounded text-xs font-bold border transition-colors ${c.techTest ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-500'}`}><Beaker size={12}/> Teste</button>
                <button onClick={() => handleOpenModal(c)} className="flex-1 flex justify-center items-center gap-1 bg-slate-100 py-1.5 rounded text-xs font-bold hover:bg-slate-200 transition-colors"><User size={12}/> Editar</button>
             </div>
          </div>
        ))}
      </div>

      {/* --- MODAL DE EDIÇÃO DO CANDIDATO (COM LÓGICA DE ESCREVER MOTIVO) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 animate-fadeIn">
             <div className="flex justify-between mb-6 border-b pb-4"><h3 className="font-bold text-xl">Gerenciar Candidato</h3><button onClick={() => setIsModalOpen(false)}><X size={24}/></button></div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Nome</label><input className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                   <select className="w-full border p-2 rounded font-bold" value={formData.status || 'Aguardando Triagem'} onChange={e => {
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

                {(formData.status === 'Reprovado' || formData.status === 'Desistência') && (
                    <div className="md:col-span-2 bg-red-50 p-4 rounded-lg border border-red-200 animate-fadeIn">
                        <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><AlertTriangle size={12}/> Motivo da Perda (Obrigatório)</label>
                        <select className="w-full border border-red-300 p-2 rounded bg-white mb-3" value={lossReasonType} 
                            onChange={e => {
                                const val = e.target.value;
                                setLossReasonType(val);
                                if (val !== 'Outros') setFormData({...formData, rejectionReason: val});
                                else setFormData({...formData, rejectionReason: ''});
                            }}>
                            <option value="">-- Selecione o Motivo --</option>
                            {formData.status === 'Desistência' ? (
                                <>
                                    <option value="Aceitou outra proposta">Aceitou outra proposta</option>
                                    <option value="Salário abaixo da pretensão">Salário abaixo da pretensão</option>
                                    <option value="Distância / Localização">Distância / Localização</option>
                                    <option value="Desinteresse na vaga">Desinteresse na vaga</option>
                                    <option value="Outros">Outros (Escrever...)</option>
                                </>
                            ) : (
                                <>
                                    <option value="Perfil Técnico Insuficiente">Perfil Técnico Insuficiente</option>
                                    <option value="Sem Fit Cultural">Sem Fit Cultural</option>
                                    <option value="Reprovado no Teste Técnico">Reprovado no Teste Técnico</option>
                                    <option value="Outros">Outros (Escrever...)</option>
                                </>
                            )}
                        </select>
                        {lossReasonType === 'Outros' && (
                            <textarea className="w-full border border-red-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white min-h-[80px] text-sm" placeholder="Descreva o motivo detalhadamente..." value={formData.rejectionReason || ''} onChange={e => setFormData({...formData, rejectionReason: e.target.value})} />
                        )}
                    </div>
                )}

                <div className="md:col-span-2 grid grid-cols-3 gap-4">
                   <div><label className="block text-xs font-bold text-slate-500 mb-1">1º Contato</label><input type="date" className="w-full border p-1 rounded" value={toInputDate(formData.firstContactAt)} onChange={e => setFormData({...formData, firstContactAt: e.target.value})} /></div>
                   <div><label className="block text-xs font-bold text-slate-500 mb-1">Entrevista</label><input type="date" className="w-full border p-1 rounded" value={toInputDate(formData.interviewAt)} onChange={e => setFormData({...formData, interviewAt: e.target.value})} /></div>
                </div>
             </div>
             <div className="flex justify-end gap-3 pt-4 border-t"><button onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold">Cancelar</button><button onClick={handleSaveChanges} className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow-lg">Salvar</button></div>
          </div>
        </div>
      )}

      {/* --- MODAIS RESTAURADOS --- */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
             <div className="flex items-center gap-2 mb-4 font-bold"><PauseCircle size={24} className="text-amber-500"/> Alterar Status</div>
             <div className="space-y-4">
                <input type="date" className="w-full border p-2 rounded" value={statusFormData.date} onChange={e => setStatusFormData({...statusFormData, date: e.target.value})} />
                <input className="w-full border p-2 rounded" placeholder="Motivo" value={statusFormData.reason} onChange={e => setStatusFormData({...statusFormData, reason: e.target.value})} />
                <input className="w-full border p-2 rounded" placeholder="Solicitante" value={statusFormData.requester} onChange={e => setStatusFormData({...statusFormData, requester: e.target.value})} />
                <div className="flex gap-2 pt-2"><button onClick={() => setIsStatusModalOpen(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancelar</button><button onClick={handleStatusSubmit} className="flex-1 bg-slate-800 text-white font-bold py-2 rounded">Confirmar</button></div>
             </div>
          </div>
        </div>
      )}

      {isTechModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
             <h3 className="font-bold text-indigo-900 mb-4 flex items-center gap-2"><Beaker size={20}/> Avaliação Técnica</h3>
             <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer p-3 bg-indigo-50 rounded-lg"><input type="checkbox" checked={techForm.didTest} onChange={e => setTechForm({...techForm, didTest: e.target.checked})} /> <span className="font-bold">Realizou Teste?</span></label>
                {techForm.didTest && ( <div className="space-y-3">
                      <input type="date" className="w-full border p-2 rounded" value={techForm.date} onChange={e => setTechForm({...techForm, date: e.target.value})} />
                      <input className="w-full border p-2 rounded" placeholder="Avaliador" value={techForm.evaluator} onChange={e => setTechForm({...techForm, evaluator: e.target.value})} />
                      <select className="w-full border p-2 rounded" value={techForm.result} onChange={e => setTechForm({...techForm, result: e.target.value})}><option value="Aprovado">Aprovado</option><option value="Reprovado">Reprovado</option></select>
                      {techForm.result === 'Reprovado' && <input className="w-full border p-2 rounded border-red-200" placeholder="Motivo da Reprovação" value={techForm.rejectionDetail} onChange={e => setTechForm({...techForm, rejectionDetail: e.target.value})} />}
                </div>)}
                <div className="flex justify-end gap-2"><button onClick={() => setIsTechModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button><button onClick={saveTechTest} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Salvar</button></div>
             </div>
           </div>
        </div>
      )}

      {isHiringModalOpen && (
        <div className="fixed inset-0 bg-emerald-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border-t-8 border-emerald-500 text-center">
              <h3 className="text-xl font-bold text-emerald-800 mb-4 flex justify-center items-center gap-2"><CheckCircle size={24}/> Fechar Vaga</h3>
              <select className="w-full border p-2 rounded font-bold mb-4" value={candidateToHire?.id || ''} onChange={e => setCandidateToHire(jobCandidates.find(c => c.id === e.target.value) || null)}>
                  <option value="">-- Selecione o Vencedor --</option>
                  {jobCandidates.filter(c => ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {candidateToHire && ( <div className="space-y-4">
                  <input className="w-full border p-2 rounded" value={hiringData.finalSalary} onChange={e => setHiringData({...hiringData, finalSalary: e.target.value})} placeholder="Salário Final" />
                  <select className="w-full border p-2 rounded" value={hiringData.contractType} onChange={e => setHiringData({...hiringData, contractType: e.target.value as ContractType})}><option value="CLT">CLT</option><option value="PJ">PJ</option><option value="Estágio">Estágio</option></select>
                  <input type="date" className="w-full border p-2 rounded" value={hiringData.startDate} onChange={e => setHiringData({...hiringData, startDate: e.target.value})} />
                  <button onClick={handleHiringSubmit} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg">Confirmar Contratação</button>
              </div>)}
              <button onClick={() => setIsHiringModalOpen(false)} className="w-full py-2 text-slate-400 mt-2 hover:underline">Voltar</button>
           </div>
        </div>
      )}

      {isTalentModalOpen && (
        <div className="fixed inset-0 bg-indigo-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
              <h3 className="text-lg font-bold mb-4 text-indigo-900 flex items-center gap-2"><Database size={20}/> Banco de Talentos</h3>
              <div className="space-y-3">
                 <input className="w-full border p-2 rounded bg-slate-50 font-bold" value={talentFormData.name} disabled />
                 <input className="w-full border p-2 rounded" placeholder="Cidade" value={talentFormData.city || ''} onChange={e => setTalentFormData({...talentFormData, city: e.target.value})} />
                 <input className="w-full border p-2 rounded" placeholder="Cargo Alvo" value={talentFormData.targetRole || ''} onChange={e => setTalentFormData({...talentFormData, targetRole: e.target.value})} />
                 <div className="flex justify-end gap-2 pt-2"><button onClick={() => setIsTalentModalOpen(false)} className="px-4 py-2 text-slate-500">Voltar</button><button onClick={() => { addTalent(talentFormData as TalentProfile); setIsTalentModalOpen(false); alert('Talento salvo no Banco!'); }} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold shadow-md">Exportar</button></div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
