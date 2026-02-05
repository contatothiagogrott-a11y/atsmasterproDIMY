import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { ArrowLeft, Plus, Edit2, Archive, Phone, Mail, Clock, CheckCircle, DollarSign, Award, Lock, Unlock, AlertTriangle, Trash2, Calendar, Activity, Beaker, Target, Link as LinkIcon, Database, Globe, Instagram, Search, ExternalLink, MessageCircle, Users, Download, MapPin } from 'lucide-react';
import { Candidate, CandidateOrigin, TalentProfile, ContractType, CandidateTimeline } from '../types';
import { differenceInDays, parseISO } from 'date-fns';
import { exportJobCandidates } from '../services/excelService';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobs, candidates, addCandidate, updateCandidate, removeCandidate, addTalent, updateJob, talents, user } = useData();
  
  const job = jobs.find(j => j.id === id);

  // --- Hiring Workflow State ---
  const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [candidateToHire, setCandidateToHire] = useState<Candidate | null>(null);
  const [techTestExists, setTechTestExists] = useState(false);
  const [hiringData, setHiringData] = useState({
    contractType: 'CLT' as ContractType,
    finalSalary: '',
    techTestEvaluator: '',
    techTestDate: ''
  });
  const [timeline, setTimeline] = useState<CandidateTimeline>({});

  // --- Freeze/Unfreeze/Cancel Workflow State ---
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'Cancelada' | 'Congelada' | 'Aberta' | null>(null);
  const [statusFormData, setStatusFormData] = useState({
    requester: '',
    reason: '',
    date: new Date().toISOString().split('T')[0]
  });

  // --- Candidate Action States ---
  const [candidateToArchive, setCandidateToArchive] = useState<Candidate | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [rejectionManualDate, setRejectionManualDate] = useState(new Date().toISOString().split('T')[0]);

  // --- DELETE CANDIDATE STATE ---
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // --- Tech Test State ---
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [techCandidate, setTechCandidate] = useState<Candidate | null>(null);
  const [techForm, setTechForm] = useState({
    didTest: false,
    date: '',
    evaluator: '',
    result: 'Aprovado' as 'Aprovado' | 'Reprovado'
  });

  // General Modal States
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<any>({
    name: '', age: '', phone: '', email: '', city: '', origin: 'LinkedIn', status: 'Aguardando Triagem',
    contractType: 'CLT', salaryExpectation: '', notes: '', rejectionReason: '',
    isReferral: false, referralName: '', isExEmployee: false, lastRole: '', lastSector: '', lastSalary: ''
  });
  const [formTimeline, setFormTimeline] = useState<CandidateTimeline>({});
  
  // Talent Modal
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
  const [talentFormData, setTalentFormData] = useState<Partial<TalentProfile>>({});
  const [existingTalentId, setExistingTalentId] = useState<string | null>(null);

  // Status Change State (for direct status editing)
  const [statusChangeCandidate, setStatusChangeCandidate] = useState<Candidate | null>(null);
  const [statusChangeValue, setStatusChangeValue] = useState<string>('');

  // PERMISSION CHECK
  const hasAccess = useMemo(() => {
    if (!job || !user) return false;
    if (!job.isConfidential) return true;
    return user.role === 'MASTER' || job.createdBy === user.id || job.allowedUserIds?.includes(user.id);
  }, [job, user]);

  if (!job) return <div className="p-8 text-center text-slate-500">Vaga não encontrada</div>;

  // ACCESS DENIED
  if (!hasAccess) {
      return (
          <div className="flex flex-col items-center justify-center py-20 animate-fadeIn">
              <div className="bg-red-50 border border-red-200 p-12 rounded-3xl shadow-xl max-w-lg text-center">
                  <div className="bg-red-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg">
                      <Lock size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-red-900 mb-2 uppercase tracking-tight">Acesso Negado</h2>
                  <p className="text-red-700 font-medium mb-8">Esta vaga é sigilosa e você não está na lista de usuários permitidos.</p>
                  
                  <button 
                    onClick={() => navigate('/jobs')}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
                  >
                    <ArrowLeft size={20} /> Voltar para Vagas
                  </button>
              </div>
          </div>
      );
  }

  // Filtering candidates for current job
  const jobCandidates = candidates.filter(c => c.jobId === id);

  // Find hired candidate for display
  const hiredCandidate = jobCandidates.find(c => c.status === 'Contratado' || job?.hiredCandidateIds?.includes(c.id));

  // Metrics Calculation (Mini SLA)
  const miniSLA = (() => {
    // NEW SLA LOGIC: 2B - Time to Fill
    const lastUnfreeze = job.freezeHistory?.filter(f => f.endDate).sort((a,b) => new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime())[0];
    const startDateForSLA = lastUnfreeze ? new Date(lastUnfreeze.endDate!).getTime() : new Date(job.openedAt).getTime();
    
    const endDateForSLA = hiredCandidate?.timeline?.startDate ? new Date(hiredCandidate.timeline.startDate).getTime() : (job.closedAt ? new Date(job.closedAt).getTime() : new Date().getTime());
    
    const netDuration = Math.max(0, endDateForSLA - startDateForSLA);
    const daysOpen = Math.ceil(netDuration / (1000 * 3600 * 24));

    const enrolled = jobCandidates.length;
    const interviewed = jobCandidates.filter(c => c.timeline?.interview).length;
    const finalists = jobCandidates.filter(c => ['Em Teste', 'Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).length;
    const rejected = jobCandidates.filter(c => c.status === 'Reprovado').length;
    const withdrawn = jobCandidates.filter(c => c.status === 'Desistência').length;

    return { daysOpen, enrolled, interviewed, finalists, rejected, withdrawn };
  })();

  // --- Functions ---
  const handleCandidateSelection = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    const candidate = jobCandidates.find(c => c.id === candidateId) || null;
    setCandidateToHire(candidate);

    if (candidate) {
        setTechTestExists(!!candidate.techTest);
        setHiringData(prev => ({
            ...prev,
            techTestEvaluator: candidate.techTestEvaluator || '',
            techTestDate: candidate.techTestDate || '',
            finalSalary: candidate.finalSalary || candidate.salaryExpectation || ''
        }));
        setTimeline(candidate.timeline || {});
    }
  };

  const initiateStatusChange = (newStatus: string) => {
    if (newStatus === job.status) return;

    if (newStatus === 'Fechada') {
      setIsHiringModalOpen(true);
      if (hiredCandidate) {
          handleCandidateSelection(hiredCandidate.id);
      } else {
          setSelectedCandidateId('');
          setCandidateToHire(null);
          setHiringData({ contractType: 'CLT', finalSalary: '', techTestEvaluator: '', techTestDate: '' });
          setTimeline({});
      }
      return;
    }
    if (newStatus === 'Aberta' && job.status === 'Fechada') {
       if (window.confirm('Deseja realmente reabrir esta vaga? A data de fechamento será removida.')) {
         updateJob({ ...job, status: 'Aberta', closedAt: undefined });
       }
       return;
    }
    if (newStatus === 'Congelada') {
      setTargetStatus('Congelada');
      setStatusFormData({ requester: '', reason: '', date: new Date().toISOString().split('T')[0] });
      setIsStatusModalOpen(true);
      return;
    }
    if (newStatus === 'Aberta' && job.status === 'Congelada') {
      setTargetStatus('Aberta'); 
      setStatusFormData({ requester: '', reason: 'Retorno de Congelamento', date: new Date().toISOString().split('T')[0] });
      setIsStatusModalOpen(true);
      return;
    }
    if (newStatus === 'Cancelada') {
      setTargetStatus('Cancelada');
      setStatusFormData({ requester: '', reason: '', date: new Date().toISOString().split('T')[0] });
      setIsStatusModalOpen(true);
      return;
    }
    if (window.confirm('Deseja realmente alterar o status sem fluxo específico?')) {
       updateJob({ ...job, status: newStatus as any });
    }
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStatus) return;

    const updatedJob = { ...job };
    if (targetStatus === 'Congelada') {
      const newEvent = { startDate: new Date(statusFormData.date).toISOString(), reason: statusFormData.reason, requester: statusFormData.requester };
      updatedJob.status = 'Congelada';
      updatedJob.freezeHistory = [...(job.freezeHistory || []), newEvent];
      updatedJob.frozenAt = newEvent.startDate; 
    } 
    else if (targetStatus === 'Aberta' && job.status === 'Congelada') {
      updatedJob.status = 'Aberta';
      if (updatedJob.freezeHistory && updatedJob.freezeHistory.length > 0) {
        updatedJob.freezeHistory[updatedJob.freezeHistory.length - 1].endDate = new Date(statusFormData.date).toISOString();
      }
      updatedJob.frozenAt = undefined;
    }
    else if (targetStatus === 'Cancelada') {
      updatedJob.status = 'Cancelada';
      updatedJob.closedAt = new Date(statusFormData.date).toISOString();
      updatedJob.cancellationReason = statusFormData.reason;
      updatedJob.requesterName = statusFormData.requester;
    }

    updateJob(updatedJob);
    setIsStatusModalOpen(false);
  };

  const initiateUnlink = (e: React.MouseEvent, c: Candidate) => {
    e.preventDefault();
    e.stopPropagation();
    setCandidateToDelete(c);
    setDeleteConfirmation('');
  };

  const confirmUnlink = (e: React.FormEvent) => {
    e.preventDefault();
    if (candidateToDelete && deleteConfirmation.toUpperCase() === 'DELETE') {
       const idToRemove = candidateToDelete.id;
       try {
         removeCandidate(idToRemove);
         setCandidateToDelete(null);
       } catch (error) {
         console.error(error);
         alert("Erro ao remover candidato.");
       }
    }
  };

  const handleCandidateStatusChange = (c: Candidate, newStatus: string) => {
    if (newStatus === 'Reprovado' || newStatus === 'Desistência') {
      setStatusChangeCandidate(c);
      setStatusChangeValue(newStatus);
      setCandidateToArchive(c); 
      setArchiveReason('');
      setRejectionManualDate(new Date().toISOString().split('T')[0]);
      return; 
    }
    updateCandidate({ ...c, status: newStatus as any });
  };

  const confirmArchive = () => {
    if (candidateToArchive && archiveReason) {
      const statusToSet = statusChangeValue || candidateToArchive.status;
      updateCandidate({
        ...candidateToArchive,
        status: statusToSet as any, 
        isArchived: true,
        rejectionReason: archiveReason,
        archiveReason: archiveReason,
        rejectedBy: user?.name || 'Sistema',
        rejectionDate: `${rejectionManualDate}T12:00:00.000Z`
      });
      setCandidateToArchive(null);
      setStatusChangeCandidate(null);
      setStatusChangeValue('');
    }
  };

  const handleAdmissionSubmit = (e: React.FormEvent) => {
     e.preventDefault();
     if(!candidateToHire) return;
     if (!hiringData.finalSalary || !timeline.startDate) { alert("Salário e Data de Início são obrigatórios."); return; }
     if (!techTestExists && (!hiringData.techTestEvaluator || !hiringData.techTestDate)) { alert("Validação Técnica é obrigatória."); return; }
     
     const updatedCandidate = {
       ...candidateToHire, status: 'Contratado', timeline: { ...candidateToHire.timeline, ...timeline },
       contractType: hiringData.contractType, finalSalary: hiringData.finalSalary,
       techTest: true, techTestEvaluator: hiringData.techTestEvaluator, techTestDate: hiringData.techTestDate
     } as Candidate;

     updateCandidate(updatedCandidate);
     updateJob({ ...job, status: 'Fechada', closedAt: new Date().toISOString(), hiredCandidateIds: Array.from(new Set([...(job.hiredCandidateIds || []), candidateToHire.id])) });
     setIsHiringModalOpen(false);
  };

  const openCandidateModal = (candidate?: Candidate) => {
    if (candidate) {
      setEditingId(candidate.id);
      setFormFields({
        name: candidate.name, age: candidate.age, phone: candidate.phone, email: candidate.email || '',
        city: candidate.city || '', origin: candidate.origin, status: candidate.status, 
        contractType: candidate.contractType || 'CLT', salaryExpectation: candidate.salaryExpectation || '', 
        notes: candidate.notes || '', rejectionReason: candidate.rejectionReason || '',
        isReferral: candidate.isReferral || false, referralName: candidate.referralName || '',
        isExEmployee: candidate.isExEmployee || false, lastRole: candidate.lastRole || '',
        lastSector: candidate.lastSector || '', lastSalary: candidate.lastSalary || ''
      });
      setFormTimeline(candidate.timeline || {});
    } else {
      setEditingId(null);
      setFormFields({
        name: '', age: '', phone: '', email: '', city: '', origin: 'LinkedIn', status: 'Aguardando Triagem',
        contractType: 'CLT', salaryExpectation: '', notes: '', rejectionReason: '',
        isReferral: false, referralName: '', isExEmployee: false, lastRole: '', lastSector: '', lastSalary: ''
      });
      setFormTimeline({});
    }
    setIsCandidateModalOpen(true);
  };

  const handleCandidateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Candidate> = {
      jobId: job.id, name: formFields.name, age: Number(formFields.age), phone: formFields.phone, 
      email: formFields.email, city: formFields.city,
      origin: formFields.origin, status: formFields.status, 
      rejectionReason: (formFields.status.includes('Reprovado') || formFields.status.includes('Recusada')) ? formFields.rejectionReason : undefined,
      timeline: formTimeline, notes: formFields.notes, contractType: formFields.contractType, salaryExpectation: formFields.salaryExpectation,
      isReferral: formFields.origin === 'Indicação', referralName: formFields.origin === 'Indicação' ? formFields.referralName : '',
      isExEmployee: formFields.isExEmployee, lastRole: formFields.lastRole, lastSector: formFields.lastSector, lastSalary: formFields.lastSalary
    };
    if (editingId) {
       const existing = candidates.find(c => c.id === editingId);
       if(existing) updateCandidate({ ...existing, ...payload } as Candidate);
    } else {
      addCandidate({ ...payload, id: generateId(), createdAt: new Date().toISOString() } as Candidate);
    }
    setIsCandidateModalOpen(false);
  };
  
  const handleTalentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTalent({ ...talentFormData, id: existingTalentId || generateId(), createdAt: new Date().toISOString() } as TalentProfile);
    setIsTalentModalOpen(false);
  };

  const openTechModal = (c: Candidate) => {
    setTechCandidate(c);
    setTechForm({ didTest: c.techTest || false, date: c.techTestDate || new Date().toISOString().split('T')[0], evaluator: c.techTestEvaluator || '', result: c.techTestResult || 'Aprovado' });
    setIsTechModalOpen(true);
  };
  
  const saveTechTest = () => {
    if (!techCandidate) return;
    const payload: Partial<Candidate> = {
        techTest: techForm.didTest,
        techTestDate: techForm.didTest ? techForm.date : undefined,
        techTestEvaluator: techForm.didTest ? techForm.evaluator : undefined,
        techTestResult: techForm.didTest ? techForm.result : undefined,
        testApprovalDate: (techForm.didTest && techForm.result === 'Aprovado') ? `${techForm.date}T12:00:00.000Z` : undefined
    };
    if (techForm.didTest && techForm.result === 'Reprovado') {
      const updatedCand = { 
        ...techCandidate, 
        ...payload, 
        status: 'Reprovado',
        rejectedBy: user?.name || 'Sistema',
        rejectionDate: `${techForm.date}T12:00:00.000Z`,
        rejectionReason: 'Reprovado no Teste Técnico'
      } as Candidate;
      updateCandidate(updatedCand);
      setIsTechModalOpen(false);
      initiateArchive(updatedCand); 
      return;
    }
    updateCandidate({ ...techCandidate, ...payload });
    setIsTechModalOpen(false);
  };

  const initiateArchive = (c: Candidate) => {
    setCandidateToArchive(c);
    setArchiveReason(c.rejectionReason || '');
    setRejectionManualDate(c.rejectionDate ? c.rejectionDate.split('T')[0] : new Date().toISOString().split('T')[0]);
  };

  // --- SUB COMPONENT: CANDIDATE CARD (ALWAYS EXPANDED) ---
  const CandidateCard = ({ c }: { c: Candidate }) => {
    const lastContactDateStr = c.lastInteractionAt ? c.lastInteractionAt.split('T')[0] : (c.createdAt ? c.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    const firstContactStr = c.firstContactAt ? c.firstContactAt.split('T')[0] : '';
    const interviewDateStr = c.timeline?.interview ? c.timeline.interview.split('T')[0] : '';

    const daysSinceContact = differenceInDays(new Date(), parseISO(lastContactDateStr));
    const isFinalStatus = ['Contratado', 'Reprovado', 'Desistência', 'Proposta Recusada'].includes(c.status);
    const showContactAlert = !isFinalStatus && daysSinceContact > 5;
    
    // Origin Icon Logic
    const getOriginIcon = (origin: string) => {
        switch(origin) {
            case 'LinkedIn': return <Target size={16} className="text-blue-700"/>;
            case 'Instagram': return <Instagram size={16} className="text-pink-600"/>;
            case 'SINE': return <Globe size={16} className="text-green-600"/>;
            case 'Busca espontânea': return <Search size={16} className="text-purple-600"/>;
            case 'Banco de Talentos': return <Database size={16} className="text-orange-600"/>;
            case 'Indicação': return <LinkIcon size={16} className="text-teal-600"/>;
            default: return <Globe size={16} className="text-slate-400"/>;
        }
    };
    
    const waLink = c.phone ? `https://wa.me/55${c.phone.replace(/\D/g, '')}` : null;
    const isRejected = c.status === 'Reprovado';
    const isWithdrawn = c.status === 'Desistência';
    const cardBorderColor = isRejected ? 'border-red-200' : isWithdrawn ? 'border-amber-200' : 'border-slate-200';
    const cardBgColor = isRejected ? 'bg-red-50/50' : isWithdrawn ? 'bg-amber-50/50' : 'bg-white';

    const handleDateChange = (field: 'firstContact' | 'interview' | 'lastContact', value: string) => {
      if (!value) return; 
      const updated = { ...c };
      // FIX TIMEZONE D+1: Store at midday UTC to avoid day shift during split('T')[0]
      const isoDate = `${value}T12:00:00.000Z`;

      if (field === 'firstContact') updated.firstContactAt = isoDate;
      if (field === 'interview') updated.timeline = { ...updated.timeline, interview: isoDate };
      if (field === 'lastContact') updated.lastInteractionAt = isoDate;

      // Pass manualInteraction=true to prevent overwrite in context
      updateCandidate(updated, true);
    };

    return (
        <div className={`rounded-lg border ${cardBorderColor} ${cardBgColor} p-4 transition-all duration-300 relative group`}>
           {/* Top Row: Basic Info */}
           <div className="flex justify-between items-start mb-4">
              <div className="flex items-start gap-3">
                 <div className="flex flex-col">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        {c.name} 
                        <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-normal">{c.age} anos</span>
                        {c.isReferral && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">IND</span>}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                        {getOriginIcon(c.origin)}
                        <span className="text-xs text-slate-500">{c.origin}</span>
                        {c.origin === 'Indicação' && <span className="text-[10px] text-slate-400">({c.referralName})</span>}
                    </div>
                    {/* Location and Salary in Card */}
                    <div className="flex items-center gap-3 mt-1 text-[11px]">
                         <span className="flex items-center gap-1 text-slate-500 font-medium"><MapPin size={12}/> {c.city || 'Cidade N/I'}</span>
                         <span className="flex items-center gap-1 text-emerald-600 font-bold"><DollarSign size={12}/> Pretensão: {c.salaryExpectation || 'N/I'}</span>
                    </div>
                 </div>
              </div>

              <div className="flex flex-col items-end">
                   <div className="flex items-center gap-2 mb-1">
                      {waLink && (
                          <a href={waLink} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200" title="WhatsApp">
                              <MessageCircle size={14} />
                          </a>
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide border
                        ${isRejected ? 'bg-red-100 text-red-700 border-red-200' : 
                          isWithdrawn ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-blue-100 text-blue-700 border-blue-200'}
                      `}>
                          {c.status}
                      </span>
                   </div>
                   {showContactAlert && (
                         <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                             <Activity size={10} /> {daysSinceContact}d sem contato
                         </span>
                   )}
              </div>
           </div>

           {/* Middle Row: Critical SLA Dates (Always Visible Grid) */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded mb-4 border border-slate-100">
               <div>
                   <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide flex items-center gap-1"><Clock size={10}/> Primeiro Contato</label>
                   <input 
                      type="date" 
                      className="w-full text-xs font-bold text-slate-700 outline-none bg-transparent border-b border-slate-200 focus:border-blue-500" 
                      value={firstContactStr}
                      onChange={(e) => handleDateChange('firstContact', e.target.value)}
                   />
               </div>
               <div>
                   <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide flex items-center gap-1"><Calendar size={10}/> Data Entrevista</label>
                   <input 
                      type="date" 
                      className="w-full text-xs font-bold text-blue-700 outline-none bg-transparent border-b border-slate-200 focus:border-blue-500" 
                      value={interviewDateStr}
                      onChange={(e) => handleDateChange('interview', e.target.value)}
                   />
               </div>
               <div>
                   <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase tracking-wide flex items-center gap-1"><Activity size={10}/> Último Contato</label>
                   <input 
                      type="date" 
                      className="w-full text-xs font-bold text-slate-700 outline-none bg-transparent border-b border-slate-200 focus:border-blue-500" 
                      value={lastContactDateStr}
                      onChange={(e) => handleDateChange('lastContact', e.target.value)}
                   />
               </div>
           </div>

           {/* Bottom Row: Actions & Details */}
           <div className="flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-4 text-xs text-slate-500">
                    {c.email && <span className="flex items-center gap-1 truncate max-w-[150px]" title={c.email}><Mail size={12}/> {c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1"><Phone size={12}/> {c.phone}</span>}
                </div>

                <div className="flex gap-2">
                     <select 
                       value={c.status}
                       onChange={(e) => handleCandidateStatusChange(c, e.target.value)}
                       className="border border-slate-300 rounded text-xs font-bold p-1.5 bg-white outline-none"
                     >
                         <option value="Aguardando Triagem">Aguardando</option>
                         <option value="Em Teste">Em Teste</option>
                         <option value="Entrevista">Entrevista</option>
                         <option value="Aprovado">Aprovado</option>
                         <option disabled>──────</option>
                         <option value="Reprovado">Reprovado</option>
                         <option value="Desistência">Desistência</option>
                     </select>

                     <button 
                       onClick={() => openTechModal(c)}
                       className="flex items-center gap-1 px-3 py-1.5 rounded bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100 border border-indigo-100"
                     >
                       <Beaker size={14} /> {c.techTest ? (c.techTestResult || 'Result') : 'Teste'}
                     </button>

                     <button 
                       onClick={() => openCandidateModal(c)} 
                       className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 border border-blue-100"
                     >
                       <Edit2 size={14} />
                     </button>

                     <button 
                       onClick={() => { 
                          const existing = talents.find(t => t.contact.includes(c.email || '@@') || t.contact.includes(c.phone));
                          setExistingTalentId(existing ? existing.id : null);
                          // SYNC logic: ensure city and salary go to talent pool
                          setTalentFormData(existing || { 
                            name: c.name, 
                            age: c.age, 
                            contact: `${c.email || 'N/A'} | ${c.phone}`, 
                            city: c.city || '', 
                            targetRole: job.title, 
                            tags: [job.sector], 
                            transportation: 'Consegue vir até a empresa', 
                            salaryExpectation: c.salaryExpectation 
                          });
                          setIsTalentModalOpen(true);
                       }} 
                       className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 border border-slate-200"
                       title="Banco de Talentos"
                     >
                       <Archive size={14} />
                     </button>

                     <button 
                       onClick={(e) => initiateUnlink(e, c)} 
                       className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 border border-red-100 cursor-pointer"
                       title="Desvincular (Remover)"
                     >
                       <Trash2 size={14} />
                     </button>
                </div>
           </div>

           {/* Rejection/Withdrawal Reason */}
           {(isRejected || isWithdrawn) && c.rejectionReason && (
               <div className="mt-3 p-2 bg-red-50 text-red-800 text-xs border border-red-100 rounded flex items-center gap-2">
                   <AlertTriangle size={12} />
                   <strong>Motivo:</strong> {c.rejectionReason}
               </div>
           )}
        </div>
    );
  };


  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/jobs')} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
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
                 <option value="Aberta">Aberta {job.status === 'Fechada' ? '(Reabrir)' : job.status === 'Congelada' ? '(Descongelar)' : ''}</option>
                 <option value="Fechada">Fechada (Concluir)</option>
                 <option value="Congelada">Congelada (Pausar)</option>
                 <option value="Cancelada">Cancelada</option>
              </select>
              {job.isConfidential && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200"><Lock size={10}/> MODO SIGILOSO ATIVO</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => exportJobCandidates(job, jobCandidates)} className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-sm">
                <Download size={18} /> Exportar Vaga (Micro-SLA)
            </button>
            <button onClick={() => openCandidateModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm font-bold shadow-md">
                <Plus size={18} /> Adicionar Candidato
            </button>
        </div>
      </div>

      {/* MINI SLA - TOP HEADER */}
      {miniSLA && (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 ${job.status === 'Fechada' ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} divide-x divide-slate-100`}>
          <div className="px-2 text-center py-2 md:py-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Dias em Aberto</div>
             <div className="text-xl font-bold text-blue-600">{miniSLA.daysOpen}</div>
          </div>
          <div className="px-2 text-center py-2 md:py-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Total Cands.</div>
             <div className="text-xl font-bold text-slate-700">{miniSLA.enrolled}</div>
          </div>
          <div className="px-2 text-center py-2 md:py-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Entrevistados</div>
             <div className="text-xl font-bold text-slate-700">{miniSLA.interviewed}</div>
          </div>
          <div className="px-2 text-center py-2 md:py-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Finalistas</div>
             <div className="text-xl font-bold text-slate-700">{miniSLA.finalists}</div>
          </div>
          <div className="px-2 text-center py-2 md:py-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Reprovados</div>
             <div className="text-xl font-bold text-red-600">{miniSLA.rejected}</div>
          </div>
          <div className="px-2 text-center py-2 md:py-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Desistentes</div>
             <div className="text-xl font-bold text-amber-500">{miniSLA.withdrawn}</div>
          </div>
          {job.status === 'Fechada' && (
            <div className="px-2 text-center py-2 md:py-0 bg-emerald-50/50">
               <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Data de Início</div>
               <div className="text-sm font-black text-emerald-700">
                  {hiredCandidate?.timeline?.startDate ? new Date(hiredCandidate.timeline.startDate).toLocaleDateString() : 'N/D'}
               </div>
            </div>
          )}
        </div>
      )}

      {/* Closed Hero */}
      {job.status === 'Fechada' && (
        <div className="mb-8 bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl shadow-xl text-white p-8 relative overflow-hidden animate-fadeIn">
           <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><CheckCircle size={200} /></div>
           <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
             {(() => {
                const hired = hiredCandidate;
                if (! hired) return <div className="text-emerald-100 bg-white/10 p-4 rounded-lg">Aguardando registro do candidato contratado para exibir métricas.</div>;
                
                // Calculate Process Time: 2A - Data Fim (Hired/Rejected) - Data 1º Contato
                let processTimeText = "N/A";
                if (hired.timeline?.startDate && hired.firstContactAt) {
                    const start = parseISO(hired.timeline.startDate);
                    const firstContact = parseISO(hired.firstContactAt);
                    const days = differenceInDays(start, firstContact);
                    processTimeText = `${days} Dias`;
                }

                return (
                  <>
                     <div className="bg-white/20 backdrop-blur-md p-1 rounded-full">
                        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-800 font-bold text-3xl">{hired.name.charAt(0)}</div>
                     </div>
                     <div className="text-center md:text-left flex-1">
                        <div className="flex items-center gap-2 justify-center md:justify-start mb-1 text-emerald-200 text-sm font-bold uppercase tracking-wider"><Award size={16}/> Vaga Concluída</div>
                        <h2 className="text-3xl font-bold mb-2">{hired.name}</h2>
                        <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm">
                           <div className={`px-3 py-1.5 rounded-lg flex items-center gap-2 border transition-colors ${hired.timeline?.startDate ? 'bg-white/10 border-transparent' : 'bg-rose-500/50 border-rose-300 animate-pulse'}`}>
                             <Calendar size={16}/> 
                             <span>Data de Início:</span>
                             {hired.timeline?.startDate ? (
                                <strong>{new Date(hired.timeline.startDate).toLocaleDateString('pt-BR')}</strong>
                             ) : (
                                <button onClick={() => initiateStatusChange('Fechada')} className="font-bold underline hover:text-white">Definir Data de Início</button>
                             )}
                           </div>
                           <div className="bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2"><DollarSign size={16}/> Salário: <strong>{hired.finalSalary || 'N/I'}</strong></div>
                           <div className="bg-white/10 px-3 py-1.5 rounded-lg flex items-center gap-2"><Activity size={16}/> Tempo de Processo: <strong>{processTimeText}</strong></div>
                        </div>
                     </div>
                  </>
                );
             })()}
           </div>
        </div>
      )}

      {/* NEW CANDIDATE LIST (ALWAYS EXPANDED) */}
      <div className="space-y-4">
        {jobCandidates.map(c => (
          <React.Fragment key={c.id}>
            <CandidateCard c={c} />
          </React.Fragment>
        ))}
        {jobCandidates.length === 0 && (
            <div className="bg-white p-12 text-center rounded-xl border border-slate-200 text-slate-400">
                <Users size={48} className="mx-auto mb-4 opacity-50"/>
                <p>Nenhum candidato nesta vaga ainda.</p>
                <button onClick={() => openCandidateModal()} className="text-blue-600 font-bold hover:underline mt-2">Adicionar o primeiro</button>
            </div>
        )}
      </div>

      {/* Candidate Modal reused */}
      {isCandidateModalOpen && (
        <div className="fixed inset-0 bg-blue-900/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
             <div className="flex justify-between mb-6">
               <h3 className="font-bold text-xl">Gerenciar Candidato</h3>
               <button onClick={() => setIsCandidateModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
             </div>
             <form onSubmit={handleCandidateSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome</label>
                    <input required placeholder="Nome Completo" value={formFields.name} onChange={e => setFormFields({...formFields, name: e.target.value})} className="w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Idade</label>
                    <input required type="number" placeholder="Idade" value={formFields.age} onChange={e => setFormFields({...formFields, age: e.target.value})} className="w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Telefone</label>
                    <input required placeholder="Telefone" value={formFields.phone} onChange={e => setFormFields({...formFields, phone: e.target.value})} className="w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Email</label>
                    <input placeholder="Email" value={formFields.email} onChange={e => setFormFields({...formFields, email: e.target.value})} className="w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Cidade / UF</label>
                    <input placeholder="Ex: São Paulo - SP" value={formFields.city} onChange={e => setFormFields({...formFields, city: e.target.value})} className="w-full border p-2 rounded" />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Pretensão Salarial</label>
                    <input placeholder="Ex: R$ 3.500,00" value={formFields.salaryExpectation} onChange={e => setFormFields({...formFields, salaryExpectation: e.target.value})} className="w-full border p-2 rounded" />
                </div>
                
                {/* ORIGIN DROPDOWN - STRICT LIST */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Origem do Currículo</label>
                    <select required value={formFields.origin} onChange={e => setFormFields({...formFields, origin: e.target.value})} className="w-full border p-2 rounded bg-white">
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Instagram">Instagram</option>
                        <option value="SINE">SINE</option>
                        <option value="Busca espontânea">Busca espontânea</option>
                        <option value="Banco de Talentos">Banco de Talentos</option>
                        <option value="Indicação">Indicação</option>
                        <option value="Recrutamento Interno">Recrutamento Interno</option>
                    </select>
                </div>

                {/* CONDITIONAL REFERRAL */}
                {formFields.origin === 'Indicação' && (
                    <div className="animate-fadeIn">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Quem indicou?</label>
                        <input required placeholder="Nome do indicador" value={formFields.referralName} onChange={e => setFormFields({...formFields, referralName: e.target.value})} className="w-full border p-2 rounded border-blue-300 bg-blue-50" />
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Status do Processo</label>
                    <select value={formFields.status} onChange={e => setFormFields({...formFields, status: e.target.value})} className="w-full border p-2 rounded bg-white">
                        <option value="Aguardando Triagem">Aguardando Triagem</option>
                        <option value="Em Teste">Em Teste</option>
                        <option value="Entrevista">Entrevista</option>
                        <option value="Aprovado">Aprovado</option>
                        <option value="Reprovado">Reprovado</option>
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Observações / Notas</label>
                    <textarea value={formFields.notes} onChange={e => setFormFields({...formFields, notes: e.target.value})} className="w-full border p-2 rounded h-24" placeholder="Algum ponto importante do candidato?"></textarea>
                </div>

                <div className="md:col-span-2 border-t pt-4 flex justify-end gap-2">
                    <button type="button" onClick={() => setIsCandidateModalOpen(false)} className="px-6 py-2 text-slate-500 font-bold">Cancelar</button>
                    <button type="submit" className="bg-blue-600 text-white px-8 py-2 rounded-lg font-bold shadow-md">Salvar Candidato</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* Other Modals ... */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
             <h3 className="text-lg font-bold mb-4">
               {targetStatus === 'Congelada' ? 'Congelar Vaga' : targetStatus === 'Aberta' ? 'Descongelar Vaga' : 'Cancelar Vaga'}
             </h3>
             <form onSubmit={handleStatusSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                     {targetStatus === 'Aberta' ? 'Data de Retorno' : 'Data da Ação'}
                  </label>
                  <input required type="date" className="w-full border p-2 rounded text-sm" value={statusFormData.date} onChange={e => setStatusFormData({...statusFormData, date: e.target.value})} />
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-700 mb-1">Solicitante</label>
                   <input required type="text" className="w-full border p-2 rounded text-sm" placeholder="Nome do Gestor" value={statusFormData.requester} onChange={e => setStatusFormData({...statusFormData, requester: e.target.value})} />
                </div>
                {targetStatus !== 'Aberta' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Motivo</label>
                    <select required className="w-full border p-2 rounded text-sm bg-white" value={statusFormData.reason} onChange={e => setStatusFormData({...statusFormData, reason: e.target.value})}>
                       <option value="">Selecione...</option>
                       <option value="Budget">Budget Suspenso/Cancelado</option>
                       <option value="Reestruturação">Reestruturação</option>
                       <option value="Prioridade">Mudança de Prioridade</option>
                       <option value="Outros">Outros</option>
                    </select>
                  </div>
                )}
                <button type="submit" className="w-full bg-slate-800 text-white font-bold py-2 rounded">Confirmar</button>
             </form>
          </div>
        </div>
      )}

      {isTechModalOpen && (
        <div className="fixed inset-0 bg-indigo-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
             <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2"><Beaker size={20}/> Avaliação Técnica</h3>
             <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                   <input type="checkbox" checked={techForm.didTest} onChange={e => setTechForm({...techForm, didTest: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500" />
                   <span className="font-bold text-indigo-900">Candidato realizou o teste?</span>
                </label>
                {techForm.didTest && (
                   <div className="space-y-3 animate-fadeIn">
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1">Data do Teste</label>
                         <input type="date" className="w-full border p-2 rounded" value={techForm.date} onChange={e => setTechForm({...techForm, date: e.target.value})} />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1">Quem avaliou?</label>
                         <input className="w-full border p-2 rounded" placeholder="Nome do Avaliador" value={techForm.evaluator} onChange={e => setTechForm({...techForm, evaluator: e.target.value})} />
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1">Resultado Final</label>
                         <div className="flex gap-2">
                            <button onClick={() => setTechForm({...techForm, result: 'Aprovado'})} className={`flex-1 py-2 rounded font-bold text-sm border ${techForm.result === 'Aprovado' ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-slate-200 text-slate-400'}`}>Aprovado</button>
                            <button onClick={() => setTechForm({...techForm, result: 'Reprovado'})} className={`flex-1 py-2 rounded font-bold text-sm border ${techForm.result === 'Reprovado' ? 'bg-red-100 border-red-300 text-red-700' : 'bg-white border-slate-200 text-slate-400'}`}>Reprovado</button>
                         </div>
                      </div>
                   </div>
                )}
                <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                   <button onClick={() => setIsTechModalOpen(false)} className="px-4 py-2 text-slate-500 text-sm">Cancelar</button>
                   <button onClick={saveTechTest} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold text-sm hover:bg-indigo-700">Salvar Avaliação</button>
                </div>
             </div>
           </div>
        </div>
      )}

      {candidateToArchive && (
        <div className="fixed inset-0 bg-red-900/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl border-t-4 border-red-500">
              <h3 className="font-bold text-lg mb-1 text-slate-800">{statusChangeValue === 'Desistência' ? 'Motivo da Desistência' : 'Motivo da Reprovação'}</h3>
              <p className="text-xs text-slate-400 mb-4 uppercase font-bold">{statusChangeValue === 'Desistência' ? 'Decisão do Candidato' : 'Decisão da Empresa'}</p>
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Data da Ocorrência</label>
                <input 
                  type="date" 
                  className="w-full border p-2 rounded outline-none focus:border-red-500"
                  value={rejectionManualDate}
                  onChange={e => setRejectionManualDate(e.target.value)}
                />
              </div>

              <select className="w-full border p-3 rounded mb-4 bg-white outline-none focus:border-red-500" value={archiveReason} onChange={e => setArchiveReason(e.target.value)}>
                <option value="">Selecione o motivo...</option>
                {statusChangeValue === 'Desistência' ? (
                  <>
                    <option value="Aceitou outra proposta">Aceitou outra proposta</option>
                    <option value="Salário abaixo da pretensão">Salário abaixo da pretensão</option>
                    <option value="Distância / Localização">Distância / Localização</option>
                    <option value="Outros">Outros</option>
                  </>
                ) : (
                  <>
                    <option value="Reprovado no Teste Técnico">Reprovado no Teste Técnico</option>
                    <option value="Perfil Técnico Insuficiente">Perfil Técnico Insuficiente (CV)</option>
                    <option value="Sem Fit Cultural">Sem Fit Cultural</option>
                    <option value="Outros">Outros</option>
                  </>
                )}
              </select>
              <div className="flex justify-end gap-2">
                 <button onClick={() => { setCandidateToArchive(null); setStatusChangeCandidate(null); }} className="px-4 py-2 text-slate-500">Cancelar</button>
                 <button onClick={confirmArchive} disabled={!archiveReason} className="px-4 py-2 bg-red-600 disabled:bg-slate-300 text-white rounded font-bold shadow hover:bg-red-700">Confirmar</button>
              </div>
           </div>
        </div>
      )}

      {isHiringModalOpen && (
        <div className="fixed inset-0 bg-blue-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="bg-slate-800 px-8 py-5 rounded-t-2xl flex justify-between items-center text-white">
                 <h3 className="text-lg font-bold flex items-center gap-2"><CheckCircle size={20}/> Checkout de Contratação</h3>
                 <button onClick={() => setIsHiringModalOpen(false)}><span className="text-2xl text-white">&times;</span></button>
              </div>
              <form onSubmit={handleAdmissionSubmit} className="p-8 space-y-6">
                 <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <label className="block text-xs font-bold text-blue-800 mb-1">Candidato Vencedor</label>
                    <select required className="w-full border p-2 rounded bg-white" value={selectedCandidateId} onChange={(e) => handleCandidateSelection(e.target.value)}>
                      <option value="">-- Selecione --</option>
                      {jobCandidates.filter(c => ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 {candidateToHire && (
                   <>
                     <div className="pt-2">
                        <label className="text-sm font-bold text-indigo-900 flex items-center gap-2 mb-3"><Award size={18} className="text-indigo-600"/> Validação Técnica</label>
                        {techTestExists ? (
                           <div className="bg-slate-100 p-3 rounded text-sm text-slate-700 flex gap-4">
                             <div><strong>Avaliador:</strong> {hiringData.techTestEvaluator}</div>
                             <div><strong>Data:</strong> {hiringData.techTestDate}</div>
                           </div>
                        ) : (
                          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 grid grid-cols-2 gap-3">
                             <div><label className="block text-xs font-bold text-indigo-800 mb-1">Quem validou?</label><input required className="w-full border p-2 rounded text-xs" value={hiringData.techTestEvaluator} onChange={e => setHiringData({...hiringData, techTestEvaluator: e.target.value})} /></div>
                             <div><label className="block text-xs font-bold text-indigo-800 mb-1">Data do Teste</label><input required type="date" className="w-full border p-2 rounded text-xs" value={hiringData.techTestDate} onChange={e => setHiringData({...hiringData, techTestDate: e.target.value})} /></div>
                          </div>
                        )}
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div><label className="block text-xs font-bold text-slate-700 mb-1">Salário Final (R$)</label><input required className="w-full border p-2 rounded" value={hiringData.finalSalary} onChange={e => setHiringData({...hiringData, finalSalary: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Contrato</label><select required className="w-full border p-2 rounded bg-white" value={hiringData.contractType} onChange={e => setHiringData({...hiringData, contractType: e.target.value as any})}><option value="CLT">CLT</option><option value="PJ">PJ</option><option value="Estágio">Estágio</option></select></div>
                        <div className="col-span-2"><label className="block text-xs font-bold text-emerald-700 mb-1">Data de Início (Start)</label><input required type="date" className="w-full border border-emerald-300 bg-emerald-50 p-2 rounded" value={timeline.startDate || ''} onChange={e => setTimeline({...timeline, startDate: e.target.value})} /></div>
                     </div>
                     <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-2 flex justify-center items-center gap-2"><CheckCircle size={18} /> Confirmar Contratação e Fechar Vaga</button>
                   </>
                 )}
              </form>
           </div>
        </div>
      )}

      {candidateToDelete && (
          <div className="fixed inset-0 bg-red-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
               <div className="flex justify-center mb-4 text-red-600 bg-red-50 w-16 h-16 rounded-full items-center mx-auto"><Trash2 size={32} /></div>
               <h3 className="text-lg font-bold text-center mb-2">Desvincular Candidato?</h3>
               <p className="text-center text-slate-500 text-sm mb-6">Para confirmar a remoção de <strong>{candidateToDelete.name}</strong> desta vaga, digite <strong>DELETE</strong> abaixo.</p>
               <form onSubmit={confirmUnlink}>
                  <input autoFocus className="w-full border p-2 rounded mb-4 outline-none focus:border-red-500 text-center uppercase font-bold tracking-widest" placeholder="Digite DELETE" value={deleteConfirmation} onChange={e => setDeleteConfirmation(e.target.value)} />
                  <div className="flex gap-2"><button type="button" onClick={() => setCandidateToDelete(null)} className="flex-1 py-2 text-slate-500 hover:bg-slate-50 rounded">Cancelar</button><button type="submit" disabled={deleteConfirmation.toUpperCase() !== 'DELETE'} className="flex-1 py-2 bg-red-600 disabled:bg-red-300 text-white font-bold rounded hover:bg-red-700">Confirmar</button></div>
               </form>
             </div>
          </div>
      )}

       {isTalentModalOpen && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg"><h3 className="text-lg font-bold mb-4">Banco de Talentos</h3><form onSubmit={handleTalentSubmit} className="space-y-4"><input type="text" placeholder="Nome" value={talentFormData.name} onChange={e=>setTalentFormData({...talentFormData, name: e.target.value})} className="w-full border p-2 rounded"/><div className="flex justify-end gap-2 mt-4"><button type="button" onClick={() => setIsTalentModalOpen(false)} className="px-4 py-2 text-slate-500">Cancelar</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Salvar</button></div></form></div></div>)}
    </div>
  );
};
