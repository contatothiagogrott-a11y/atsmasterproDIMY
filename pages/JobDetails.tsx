import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, User, Phone, Mail, Calendar, Clock, 
  MessageSquare, Save, X, Search, Linkedin, Instagram, 
  Globe, Users, UserPlus, MapPin, Briefcase, Filter,
  CheckCircle, Award, DollarSign, Activity, Lock, Download,
  Plus, Archive, Database, MessageCircle, ExternalLink, Target, Link as LinkIcon
} from 'lucide-react';
import { Candidate, Job, TalentProfile, ContractType } from '../types';
import { exportJobCandidates } from '../services/excelService';

// Helper para formatar data (Visualização BR)
const formatDate = (isoString?: string) => {
  if (!isoString) return '-';
  // Ajuste para garantir que não volte 1 dia devido ao fuso horário na visualização
  return new Date(isoString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

// Helper para input de data (YYYY-MM-DD)
const toInputDate = (isoString?: string) => {
  if (!isoString) return '';
  return isoString.split('T')[0];
};

export const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { jobs, candidates, updateCandidate, addCandidate, addTalent, talents, user } = useData();
  
  const [job, setJob] = useState<Job | undefined>(undefined);
  const [jobCandidates, setJobCandidates] = useState<Candidate[]>([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false); // Edição
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false); // Banco de Talentos

  // Estado Local do Formulário de Candidato
  const [formData, setFormData] = useState<Partial<Candidate>>({});
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);

  // Estado Local do Formulário de Talento
  const [talentFormData, setTalentFormData] = useState<Partial<TalentProfile>>({});

  // Atualiza dados quando o contexto muda
  useEffect(() => {
    const foundJob = jobs.find(j => j.id === id);
    setJob(foundJob);
    if (foundJob) {
      setJobCandidates(candidates.filter(c => c.jobId === foundJob.id));
    }
  }, [jobs, candidates, id]);

  // --- PERMISSION CHECK ---
  const hasAccess = useMemo(() => {
    if (!job || !user) return false;
    if (!job.isConfidential) return true;
    return user.role === 'MASTER' || job.createdBy === user.id || job.allowedUserIds?.includes(user.id);
  }, [job, user]);

  if (!job) return <div className="p-8 text-center text-slate-500">Vaga não encontrada...</div>;

  if (!hasAccess) {
      return (
          <div className="flex flex-col items-center justify-center py-20">
              <div className="bg-red-50 border border-red-200 p-12 rounded-3xl shadow-xl max-w-lg text-center">
                  <Lock size={40} className="text-red-500 mx-auto mb-4"/>
                  <h2 className="text-2xl font-black text-red-900 mb-2">Acesso Negado</h2>
                  <p className="text-red-700 font-medium mb-8">Vaga confidencial.</p>
                  <button onClick={() => navigate('/jobs')} className="bg-red-600 text-white font-bold py-3 px-6 rounded-xl">Voltar</button>
              </div>
          </div>
      );
  }

  // --- LÓGICA DO MINI SLA (Recuperada) ---
  const miniSLA = (() => {
    const daysOpen = job.status === 'Fechada' && job.closedAt 
        ? Math.ceil((new Date(job.closedAt).getTime() - new Date(job.openedAt).getTime()) / (1000 * 3600 * 24))
        : Math.ceil((new Date().getTime() - new Date(job.openedAt).getTime()) / (1000 * 3600 * 24));

    return {
        daysOpen,
        enrolled: jobCandidates.length,
        interviewed: jobCandidates.filter(c => c.timeline?.interview).length,
        finalists: jobCandidates.filter(c => ['Em Teste', 'Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).length,
        rejected: jobCandidates.filter(c => c.status === 'Reprovado').length,
        withdrawn: jobCandidates.filter(c => c.status === 'Desistência').length
    };
  })();

  // --- HANDLERS ---

  const handleOpenModal = (candidate?: Candidate) => {
    if (candidate) {
        setSelectedCandidate(candidate);
        setFormData({ ...candidate });
    } else {
        setSelectedCandidate(null);
        setFormData({
            jobId: job.id,
            status: 'Aguardando Triagem',
            origin: 'LinkedIn',
            contractType: 'CLT',
            createdAt: new Date().toISOString()
        });
    }
    setIsModalOpen(true);
  };

  const handleSaveChanges = async () => {
    // Tratamento de datas para UTC (evita bugs de fuso)
    const processedData = { ...formData };
    if (processedData.firstContactAt && !processedData.firstContactAt.includes('T')) processedData.firstContactAt += 'T12:00:00.000Z';
    if (processedData.interviewAt && !processedData.interviewAt.includes('T')) processedData.interviewAt += 'T12:00:00.000Z';
    if (processedData.lastInteractionAt && !processedData.lastInteractionAt.includes('T')) processedData.lastInteractionAt += 'T12:00:00.000Z';

    if (selectedCandidate) {
        await updateCandidate({ ...selectedCandidate, ...processedData } as Candidate);
    } else {
        await addCandidate({ ...processedData, id: crypto.randomUUID() } as Candidate);
    }
    setIsModalOpen(false);
  };

  const handleOpenTalentModal = (c: Candidate) => {
    // Procura se já existe no banco de talentos
    const existing = talents.find(t => t.contact.includes(c.email || '@@') || t.contact.includes(c.phone));
    
    setTalentFormData(existing || {
        id: crypto.randomUUID(),
        name: c.name,
        age: c.age,
        contact: `${c.email || ''} | ${c.phone || ''}`,
        city: c.city,
        targetRole: job.title,
        tags: [job.sector],
        salaryExpectation: c.salaryExpectation,
        transportation: 'Sim' // Default "Consegue vir"
    });
    setIsTalentModalOpen(true);
  };

  const saveTalent = () => {
    addTalent(talentFormData as TalentProfile);
    setIsTalentModalOpen(false);
    alert("Candidato exportado para o Banco de Talentos!");
  };

  // --- RENDER HELPERS ---
  const waLink = (phone?: string) => phone ? `https://wa.me/55${phone.replace(/\D/g, '')}` : null;

  const filteredList = jobCandidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'TODOS' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/jobs')} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <ArrowLeft size={24} />
            </button>
            <div>
                <h1 className="text-2xl font-bold text-slate-800">{job.title}</h1>
                <div className="text-sm text-slate-500 flex gap-2 items-center">
                    <span>{job.sector}</span> &bull; <span>{job.unit}</span> &bull; 
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${job.status === 'Aberta' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {job.status}
                    </span>
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

      {/* MINI SLA (Recuperado) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-8 grid grid-cols-2 md:grid-cols-6 divide-x divide-slate-100 gap-y-4 md:gap-y-0">
          <div className="px-2 text-center">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Dias Aberta</div>
             <div className="text-xl font-bold text-blue-600">{miniSLA.daysOpen}</div>
          </div>
          <div className="px-2 text-center">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Inscritos</div>
             <div className="text-xl font-bold text-slate-700">{miniSLA.enrolled}</div>
          </div>
          <div className="px-2 text-center">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Entrevistados</div>
             <div className="text-xl font-bold text-slate-700">{miniSLA.interviewed}</div>
          </div>
          <div className="px-2 text-center">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Finalistas</div>
             <div className="text-xl font-bold text-slate-700">{miniSLA.finalists}</div>
          </div>
          <div className="px-2 text-center">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Reprovados</div>
             <div className="text-xl font-bold text-red-600">{miniSLA.rejected}</div>
          </div>
          <div className="px-2 text-center">
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Desistentes</div>
             <div className="text-xl font-bold text-amber-500">{miniSLA.withdrawn}</div>
          </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar candidato por nome..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-medium text-slate-600"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="TODOS">Todos os Status</option>
          <option value="Aguardando Triagem">Aguardando Triagem</option>
          <option value="Em Análise">Em Análise</option>
          <option value="Entrevista">Entrevista</option>
          <option value="Aprovado">Aprovado</option>
          <option value="Reprovado">Reprovado</option>
          <option value="Contratado">Contratado</option>
        </select>
      </div>

      {/* Lista de Candidatos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map(c => (
          <div key={c.id} className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all group relative ${c.status === 'Reprovado' ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}`}>
            
            {/* Topo do Card */}
            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg">
                        {c.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors cursor-pointer" onClick={() => handleOpenModal(c)}>
                            {c.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{c.origin}</span>
                            {c.city && <span className="text-[10px] text-slate-400 flex items-center gap-0.5"><MapPin size={10}/> {c.city}</span>}
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide border
                        ${c.status === 'Contratado' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 
                          c.status === 'Reprovado' ? 'bg-red-100 text-red-700 border-red-200' : 
                          'bg-blue-50 text-blue-700 border-blue-100'}`
                    }>
                        {c.status}
                    </span>
                    {/* Botão WhatsApp no Card */}
                    {c.phone && (
                        <a href={waLink(c.phone)!} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 flex items-center gap-1 text-[10px] font-bold bg-green-50 px-2 py-0.5 rounded border border-green-100" title="Chamar no WhatsApp">
                            <MessageCircle size={10} /> WhatsApp
                        </a>
                    )}
                </div>
            </div>

            {/* Pretensão e Idade */}
            <div className="flex justify-between items-center bg-slate-50 p-2 rounded mb-3 text-xs border border-slate-100">
                <div className="flex items-center gap-1 text-slate-600 font-medium">
                    <User size={12}/> {c.age} anos
                </div>
                <div className="flex items-center gap-1 text-emerald-700 font-bold">
                    <DollarSign size={12}/> {c.salaryExpectation || 'N/I'}
                </div>
            </div>

            {/* Datas Importantes */}
            <div className="space-y-1 text-xs text-slate-500 border-t border-slate-100 pt-2 mb-3">
               <div className="flex justify-between">
                 <span>1º Contato:</span>
                 <span className="font-bold text-slate-700">{formatDate(c.firstContactAt)}</span>
               </div>
               <div className="flex justify-between">
                 <span>Entrevista:</span>
                 <span className={`font-bold ${c.interviewAt ? 'text-blue-600' : 'text-slate-300'}`}>
                    {formatDate(c.interviewAt)}
                 </span>
               </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex gap-2 mt-auto">
                <button 
                    onClick={() => handleOpenModal(c)}
                    className="flex-1 flex justify-center items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1.5 rounded text-xs font-bold transition-colors"
                >
                    <User size={12}/> Gerenciar
                </button>
                <button 
                    onClick={() => handleOpenTalentModal(c)}
                    className="flex-1 flex justify-center items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-1.5 rounded text-xs font-bold transition-colors border border-indigo-100"
                    title="Exportar para Banco de Talentos"
                >
                    <Database size={12}/> Banco Talentos
                </button>
            </div>

          </div>
        ))}
      </div>

      {/* --- MODAL DE EDIÇÃO COMPLETO (Recuperado e Melhorado) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{formData.name || 'Novo Candidato'}</h2>
                <p className="text-sm text-slate-500">Editando informações completas</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600 shadow-sm">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6 bg-white">
              
              {/* DADOS PESSOAIS */}
              <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2"><User size={14}/> Dados Pessoais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Nome Completo</label>
                        <input className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nome" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Idade</label>
                        <input type="number" className="w-full border p-2 rounded" value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})} placeholder="Anos" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Telefone / WhatsApp</label>
                        <input className="w-full border p-2 rounded" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(XX) 9XXXX-XXXX" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Email</label>
                        <input className="w-full border p-2 rounded" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Cidade</label>
                        <input className="w-full border p-2 rounded" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Cidade - UF" />
                    </div>
                  </div>
              </div>

              {/* DADOS DA VAGA */}
              <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2 border-t pt-4"><Briefcase size={14}/> Informações Profissionais</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Pretensão Salarial</label>
                        <input className="w-full border p-2 rounded text-emerald-700 font-bold" value={formData.salaryExpectation || ''} onChange={e => setFormData({...formData, salaryExpectation: e.target.value})} placeholder="R$ 0,00" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Tipo de Contrato</label>
                        <select className="w-full border p-2 rounded bg-white" value={formData.contractType || 'CLT'} onChange={e => setFormData({...formData, contractType: e.target.value as ContractType})}>
                            <option value="CLT">CLT</option>
                            <option value="PJ">PJ</option>
                            <option value="Estágio">Estágio</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Origem do Candidato</label>
                        <select className="w-full border p-2 rounded bg-white" value={formData.origin || 'LinkedIn'} onChange={e => setFormData({...formData, origin: e.target.value})}>
                            <option value="LinkedIn">LinkedIn</option>
                            <option value="Instagram">Instagram</option>
                            <option value="Indicação">Indicação</option>
                            <option value="Banco de Talentos">Banco de Talentos</option>
                            <option value="Busca espontânea">Busca Espontânea</option>
                            <option value="SINE">SINE</option>
                            <option value="Recrutamento Interno">Recrutamento Interno</option>
                        </select>
                    </div>
                    {formData.origin === 'Indicação' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-600 mb-1">Quem Indicou?</label>
                            <input className="w-full border p-2 rounded bg-purple-50 border-purple-200" value={formData.referralName || ''} onChange={e => setFormData({...formData, referralName: e.target.value})} placeholder="Nome do indicador" />
                        </div>
                    )}
                  </div>
              </div>

              {/* GESTÃO DE DATAS (APENAS DATA - SEM HORA) */}
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3">
                  <Calendar size={18}/> Gestão de Datas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1">1º Contato</label>
                    <input 
                      type="date" 
                      className="w-full border border-blue-200 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={toInputDate(formData.firstContactAt)}
                      onChange={e => setFormData({...formData, firstContactAt: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1">Data Entrevista</label>
                    <input 
                      type="date" 
                      className="w-full border border-blue-200 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={toInputDate(formData.interviewAt)}
                      onChange={e => setFormData({...formData, interviewAt: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1">Último Contato</label>
                    <input 
                      type="date" 
                      className="w-full border border-blue-200 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={toInputDate(formData.lastInteractionAt)}
                      onChange={e => setFormData({...formData, lastInteractionAt: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* STATUS E NOTAS */}
              <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Status do Processo</label>
                  <select className="w-full border p-2 rounded bg-white mb-4 font-bold" value={formData.status || 'Aguardando Triagem'} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="Aguardando Triagem">Aguardando Triagem</option>
                        <option value="Em Análise">Em Análise</option>
                        <option value="Em Teste">Em Teste</option>
                        <option value="Entrevista">Entrevista</option>
                        <option value="Aprovado">Aprovado</option>
                        <option value="Reprovado">Reprovado</option>
                        <option value="Contratado">Contratado</option>
                  </select>

                  <label className="block text-xs font-bold text-slate-600 mb-1">Observações / Feedback</label>
                  <textarea 
                    rows={3}
                    className="w-full border border-slate-300 p-3 rounded-lg resize-none"
                    placeholder="Escreva observações sobre o candidato..."
                    value={formData.notes || ''}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                  />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-lg">Cancelar</button>
              <button onClick={handleSaveChanges} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow flex items-center gap-2">
                <Save size={20} /> Salvar Alterações
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL DE BANCO DE TALENTOS (Recuperado) --- */}
      {isTalentModalOpen && (
        <div className="fixed inset-0 bg-indigo-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
              <h3 className="text-lg font-bold mb-4 text-indigo-900 flex items-center gap-2"><Database size={20}/> Exportar para Banco de Talentos</h3>
              <div className="space-y-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Nome</label>
                    <input className="w-full border p-2 rounded bg-slate-50" value={talentFormData.name} disabled />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Cidade</label>
                        <input className="w-full border p-2 rounded" value={talentFormData.city || ''} onChange={e => setTalentFormData({...talentFormData, city: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Transporte</label>
                        <select className="w-full border p-2 rounded" value={talentFormData.transportation || 'Sim'} onChange={e => setTalentFormData({...talentFormData, transportation: e.target.value})}>
                            <option value="Sim">Consegue vir</option>
                            <option value="Não">Não consegue</option>
                            <option value="Mudança">Aceita Mudança</option>
                        </select>
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Tags / Cargo Alvo</label>
                    <input className="w-full border p-2 rounded" value={talentFormData.targetRole || ''} onChange={e => setTalentFormData({...talentFormData, targetRole: e.target.value})} />
                 </div>
                 <div className="flex justify-end gap-2 pt-4">
                    <button onClick={() => setIsTalentModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button>
                    <button onClick={saveTalent} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold hover:bg-indigo-700">Confirmar Exportação</button>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
