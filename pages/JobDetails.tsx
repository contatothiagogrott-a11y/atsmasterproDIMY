import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, User, Phone, Mail, Calendar, Clock, 
  MessageSquare, Save, X, Search, Linkedin, Instagram, 
  Globe, Users, UserPlus, MapPin, Briefcase, Filter
} from 'lucide-react';
import { Candidate, Job } from '../types';

// Helper para formatar data (Visualização)
const formatDate = (isoString?: string) => {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleDateString('pt-BR');
};

// Helper para input de data (Formato YYYY-MM-DD para o HTML funcionar)
const toInputDate = (isoString?: string) => {
  if (!isoString) return '';
  return isoString.split('T')[0];
};

// Helper de Ícones de Origem
const getSourceIcon = (origin: string) => {
  const norm = origin?.toLowerCase() || '';
  if (norm.includes('linkedin')) return <Linkedin size={16} className="text-blue-600" />;
  if (norm.includes('instagram')) return <Instagram size={16} className="text-pink-600" />;
  if (norm.includes('indicação') || norm.includes('indicacao')) return <UserPlus size={16} className="text-purple-600" />;
  if (norm.includes('interno')) return <Briefcase size={16} className="text-slate-600" />;
  if (norm.includes('espontânea') || norm.includes('site')) return <Globe size={16} className="text-emerald-600" />;
  return <User size={16} className="text-slate-400" />;
};

export const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { jobs, candidates, updateCandidate, updateJob } = useData();
  
  const [job, setJob] = useState<Job | undefined>(undefined);
  const [jobCandidates, setJobCandidates] = useState<Candidate[]>([]);
  
  // Filtros e Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');

  // Modal de Gerenciar Candidato
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estado Local do Formulário (Para evitar o bug do refresh)
  const [formData, setFormData] = useState<Partial<Candidate>>({});

  // Atualiza dados quando o contexto muda
  useEffect(() => {
    const foundJob = jobs.find(j => j.id === id);
    setJob(foundJob);
    if (foundJob) {
      setJobCandidates(candidates.filter(c => c.jobId === foundJob.id));
    }
  }, [jobs, candidates, id]);

  // Abre o Modal e PREPARA o estado local (Cópia para edição)
  const handleOpenModal = (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setFormData({
      ...candidate,
      // Garante que as datas venham no formato certo para o input
      firstContactAt: candidate.firstContactAt || '',
      interviewAt: candidate.interviewAt || '',
      lastInteractionAt: candidate.lastInteractionAt || ''
    });
    setIsModalOpen(true);
  };

  // Salva apenas quando clica no botão (Resolve o bug do refresh)
  const handleSaveChanges = async () => {
    if (selectedCandidate && formData) {
      await updateCandidate({
        ...selectedCandidate,
        ...formData
      } as Candidate);
      setIsModalOpen(false);
    }
  };

  // Métricas de Origem
  const metrics = useMemo(() => {
    const counts: Record<string, number> = {
      'LinkedIn': 0, 'Instagram': 0, 'Indicação': 0, 'Interno': 0, 'Outros': 0
    };
    jobCandidates.forEach(c => {
      const o = c.origin?.toLowerCase() || '';
      if (o.includes('linkedin')) counts['LinkedIn']++;
      else if (o.includes('instagram')) counts['Instagram']++;
      else if (o.includes('indicação')) counts['Indicação']++;
      else if (o.includes('interno')) counts['Interno']++;
      else counts['Outros']++;
    });
    return counts;
  }, [jobCandidates]);

  // Lista Filtrada
  const filteredList = jobCandidates.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'TODOS' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (!job) return <div className="p-8 text-center text-slate-500">Vaga não encontrada...</div>;

  return (
    <div className="pb-12">
      {/* --- Header da Vaga --- */}
      <div className="mb-6">
        <Link to="/jobs" className="inline-flex items-center gap-2 text-slate-500 hover:text-blue-600 mb-4 transition-colors">
          <ArrowLeft size={20} /> Voltar para Vagas
        </Link>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">{job.title}</h1>
              <span className={`text-xs px-2 py-1 rounded font-bold uppercase ${job.status === 'Aberta' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                {job.status}
              </span>
            </div>
            <p className="text-slate-500 flex items-center gap-2 text-sm">
              <MapPin size={14}/> {job.unit} • {job.sector}
            </p>
          </div>

          {/* Métricas Visuais */}
          <div className="flex gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
             <div title="LinkedIn" className="flex flex-col items-center w-10">
               <Linkedin size={18} className="text-blue-600 mb-1"/>
               <span className="text-xs font-bold text-slate-700">{metrics['LinkedIn']}</span>
             </div>
             <div title="Instagram" className="flex flex-col items-center w-10">
               <Instagram size={18} className="text-pink-600 mb-1"/>
               <span className="text-xs font-bold text-slate-700">{metrics['Instagram']}</span>
             </div>
             <div title="Indicação" className="flex flex-col items-center w-10">
               <UserPlus size={18} className="text-purple-600 mb-1"/>
               <span className="text-xs font-bold text-slate-700">{metrics['Indicação']}</span>
             </div>
             <div title="Espontânea/Outros" className="flex flex-col items-center w-10">
               <Globe size={18} className="text-emerald-600 mb-1"/>
               <span className="text-xs font-bold text-slate-700">{metrics['Outros']}</span>
             </div>
          </div>
        </div>
      </div>

      {/* --- Filtros e Busca --- */}
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

      {/* --- Lista de Candidatos (Card Simples) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map(candidate => (
          <div 
            key={candidate.id} 
            onClick={() => handleOpenModal(candidate)}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg">
                  {candidate.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">{candidate.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    {getSourceIcon(candidate.origin)} 
                    <span>{candidate.origin || 'Desconhecido'}</span>
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide
                ${candidate.status === 'Contratado' ? 'bg-emerald-100 text-emerald-700' : 
                  candidate.status === 'Reprovado' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`
              }>
                {candidate.status}
              </span>
            </div>

            <div className="space-y-2 text-sm text-slate-600 border-t border-slate-50 pt-3">
               <div className="flex justify-between">
                 <span className="text-slate-400 text-xs">Último Contato:</span>
                 <span className="font-medium">{formatDate(candidate.lastInteractionAt)}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-slate-400 text-xs">Entrevista:</span>
                 <span className={`font-medium ${candidate.interviewAt ? 'text-blue-600' : 'text-slate-300'}`}>
                    {candidate.interviewAt ? new Date(candidate.interviewAt).toLocaleString('pt-BR').slice(0, 16) : '-'}
                 </span>
               </div>
            </div>
          </div>
        ))}
        {filteredList.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Nenhum candidato encontrado com este filtro.
          </div>
        )}
      </div>

      {/* --- MODAL DE EDIÇÃO (ONDE AS DATAS SÃO EDITADAS) --- */}
      {isModalOpen && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedCandidate.name}</h2>
                <div className="flex gap-4 text-sm text-slate-500 mt-1">
                   <span className="flex items-center gap-1"><Phone size={14}/> {selectedCandidate.phone}</span>
                   <span className="flex items-center gap-1"><Mail size={14}/> {selectedCandidate.email || 'Sem email'}</span>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-600 shadow-sm">
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-6 bg-white">
              
              {/* Status & Origem */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Status do Processo</label>
                  <select 
                    className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value})}
                  >
                    <option value="Aguardando Triagem">Aguardando Triagem</option>
                    <option value="Em Análise">Em Análise</option>
                    <option value="Entrevista">Entrevista</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Reprovado">Reprovado</option>
                    <option value="Contratado">Contratado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Origem</label>
                  <input 
                    type="text" 
                    className="w-full border border-slate-300 p-3 rounded-lg bg-slate-50 text-slate-500 cursor-not-allowed"
                    value={selectedCandidate.origin}
                    disabled
                  />
                </div>
              </div>

              {/* DATAS (O Problema foi resolvido aqui com inputs locais) */}
              <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 space-y-4">
                <h3 className="font-bold text-blue-800 flex items-center gap-2">
                  <Calendar size={18}/> Gestão de Datas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1">1º Contato</label>
                    <input 
                      type="date" 
                      className="w-full border border-blue-200 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={toInputDate(formData.firstContactAt)}
                      onChange={e => setFormData({...formData, firstContactAt: new Date(e.target.value).toISOString()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1">Data Entrevista</label>
                    <input 
                      type="datetime-local" 
                      className="w-full border border-blue-200 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.interviewAt ? new Date(formData.interviewAt).toISOString().slice(0, 16) : ''}
                      onChange={e => setFormData({...formData, interviewAt: new Date(e.target.value).toISOString()})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-blue-600 mb-1">Último Contato</label>
                    <input 
                      type="datetime-local" 
                      className="w-full border border-blue-200 p-2 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      value={formData.lastInteractionAt ? new Date(formData.lastInteractionAt).toISOString().slice(0, 16) : ''}
                      onChange={e => setFormData({...formData, lastInteractionAt: new Date(e.target.value).toISOString()})}
                    />
                  </div>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Anotações / Feedback</label>
                <textarea 
                  rows={4}
                  className="w-full border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  placeholder="Escreva observações sobre o candidato..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveChanges}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
              >
                <Save size={20} /> Salvar Alterações
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
