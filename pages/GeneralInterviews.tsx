import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { 
  Plus, Search, MapPin, Calendar, 
  Trash2, MessageCircle, Edit2, Briefcase, 
  ExternalLink, CheckCircle, Clock, AlertCircle, ArrowRight,
  Database, Eye, EyeOff, Archive // Novos ícones
} from 'lucide-react';
import { Candidate, TalentProfile } from '../types';

const generateId = () => crypto.randomUUID();
const GENERAL_POOL_ID = 'general';

// --- LISTAS DE DIAGNÓSTICO ROBUSTAS ---
const WITHDRAWAL_REASONS = [
  "Aceitou outra proposta (Concorrente)",
  "Recebeu contraproposta da empresa atual",
  "Salário oferecido abaixo da pretensão",
  "Benefícios pouco atrativos",
  "Distância / Modelo de Trabalho (Presencial/Híbrido)",
  "Desinteresse no escopo do projeto/vaga",
  "Processo seletivo muito longo",
  "Problemas pessoais/familiares",
  "Sem retorno do candidato (Ghosting)"
];

const GENERAL_REJECTION_REASONS = [
  // Técnico / Exp
  "Perfil Técnico Insuficiente (Hard Skills)",
  "Experiência de Mercado Insuficiente",
  "Senioridade abaixo do esperado",
  // Comportamental / Cultura
  "Fit Cultural Divergente (Valores)",
  "Comunicação/Postura Inadequada",
  "Perfil Comportamental (Soft Skills) Incompatível",
  // Condições
  "Pretensão Salarial acima do Budget",
  "Disponibilidade/Horário Incompatível",
  "Localização/Logística Inviável",
  "Conflito de Interesses"
];

const toInputDate = (isoString?: string) => isoString ? isoString.split('T')[0] : '';
const formatDate = (isoString?: string) => isoString ? new Date(isoString).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '-';

const getWaLink = (phone?: string) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    return `https://wa.me/55${clean}`;
};

const isDatePast = (dateString?: string) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    const today = new Date();
    return date < today;
};

export const GeneralInterviews: React.FC = () => {
  const { candidates, addCandidate, updateCandidate, removeCandidate, jobs, verifyUserPassword, addTalent } = useData();
  
  // States
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false); // Toggle para ver antigos/reprovados
  
  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Candidate>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lossReasonType, setLossReasonType] = useState(''); 

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [candidateToLink, setCandidateToLink] = useState<Candidate | null>(null);
  const [selectedJobId, setSelectedJobId] = useState('');

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<Candidate | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  // --- NOVOS STATES PARA EXPORTAR PARA BANCO ---
  const [isTalentModalOpen, setIsTalentModalOpen] = useState(false);
  const [talentFormData, setTalentFormData] = useState<Partial<TalentProfile>>({});
  const [talentEmail, setTalentEmail] = useState('');
  const [talentPhone, setTalentPhone] = useState('');

  // --- LÓGICA DE DADOS ---
  
  const allGeneralCandidates = useMemo(() => {
    return candidates
        .filter(c => c.jobId === GENERAL_POOL_ID)
        .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [candidates]);

  // Filtro principal da lista (com busca e toggle de arquivados)
  const filteredList = useMemo(() => {
    return allGeneralCandidates.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Lógica de Arquivamento:
        // Se showArchived for FALSE, esconde Reprovados e Desistentes
        // Se showArchived for TRUE, mostra TUDO (ou apenas os arquivados, depende da preferência. Vou deixar mostrar tudo para facilitar).
        const isArchivedStatus = ['Reprovado', 'Desistência'].includes(c.status);
        const matchesArchive = showArchived ? true : !isArchivedStatus;

        return matchesSearch && matchesArchive;
    });
  }, [allGeneralCandidates, searchTerm, showArchived]);

  const pendingFeedbackCandidates = useMemo(() => {
      return allGeneralCandidates.filter(c => 
          c.interviewAt && 
          !['Reprovado', 'Desistência', 'Contratado'].includes(c.status)
      ).sort((a,b) => new Date(a.interviewAt!).getTime() - new Date(b.interviewAt!).getTime());
  }, [allGeneralCandidates]);

  const openJobs = useMemo(() => jobs.filter(j => j.status === 'Aberta'), [jobs]);

  // --- HANDLERS ---

  const handleOpenModal = (candidate?: Candidate) => {
    if (candidate) {
        setEditingId(candidate.id);
        setFormData({ ...candidate });
        if (candidate.rejectionReason) {
            const isGeneral = GENERAL_REJECTION_REASONS.includes(candidate.rejectionReason);
            const isWithdrawal = WITHDRAWAL_REASONS.includes(candidate.rejectionReason);
            
            if (isGeneral || isWithdrawal) {
                setLossReasonType(candidate.rejectionReason);
            } else {
                setLossReasonType('Outros');
            }
        } else { 
            setLossReasonType(''); 
        }
    } else {
        setEditingId(null);
        setFormData({ 
            jobId: GENERAL_POOL_ID, 
            status: 'Entrevista', 
            origin: 'Busca espontânea', 
            contractType: 'CLT', 
            createdAt: new Date().toISOString(),
            firstContactAt: new Date().toISOString()
        });
        setLossReasonType('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData };
    if (payload.firstContactAt) payload.firstContactAt = `${toInputDate(payload.firstContactAt)}T12:00:00.000Z`;
    if (payload.interviewAt) payload.interviewAt = `${toInputDate(payload.interviewAt)}T12:00:00.000Z`;
    
    if (!['Reprovado', 'Desistência'].includes(payload.status || '')) {
        payload.rejectionReason = undefined;
        payload.rejectionDate = undefined;
    } else {
        if (!payload.rejectionDate) payload.rejectionDate = new Date().toISOString();
    }

    if (editingId) {
        const original = candidates.find(c => c.id === editingId);
        if (original) await updateCandidate({ ...original, ...payload } as Candidate);
    } else {
        await addCandidate({ ...payload, id: generateId(), jobId: GENERAL_POOL_ID } as Candidate);
    }
    setIsModalOpen(false);
  };

  const handleOpenLink = (c: Candidate) => {
      setCandidateToLink(c);
      setSelectedJobId('');
      setIsLinkModalOpen(true);
  };

  const confirmLink = async () => {
      if (!candidateToLink || !selectedJobId) return;
      const job = jobs.find(j => j.id === selectedJobId);
      const updatedCandidate: Candidate = {
          ...candidateToLink,
          jobId: selectedJobId,
          status: 'Aguardando Triagem',
          notes: `[Transferido da Entrevista Geral] ${candidateToLink.notes || ''}`
      };
      await updateCandidate(updatedCandidate);
      alert(`Candidato transferido com sucesso para a vaga: ${job?.title}`);
      setIsLinkModalOpen(false);
      setCandidateToLink(null);
  };

  const handleDeleteClick = (c: Candidate) => {
      setCandidateToDelete(c);
      setDeletePassword('');
      setIsDeleteModalOpen(true);
  };

  const confirmDelete = async (e: React.FormEvent) => {
      e.preventDefault();
      if(await verifyUserPassword(deletePassword) && candidateToDelete) {
          await removeCandidate(candidateToDelete.id);
          setIsDeleteModalOpen(false);
          setCandidateToDelete(null);
      } else {
          alert('Senha incorreta.');
      }
  };

  return (
    <div className="pb-12 animate-fadeIn space-y-8">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
             <Briefcase className="text-slate-800" size={32}/> Entrevistas Gerais
           </h1>
           <p className="text-slate-500 mt-1">Gestão de pool e candidatos espontâneos.</p>
        </div>
        <div className="flex gap-2">
            {/* BOTÃO TOGGLE ARQUIVADOS */}
            <button 
                onClick={() => setShowArchived(!showArchived)} 
                className={`px-4 py-2.5 rounded-lg flex items-center gap-2 font-bold text-sm transition-all border ${showArchived ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'}`}
            >
                {showArchived ? <EyeOff size={18}/> : <Archive size={18}/>}
                {showArchived ? 'Ocultar Antigos' : 'Ver Antigos'}
            </button>

            <button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md transition-all text-sm">
                <Plus size={20} /> Novo Candidato
            </button>
        </div>
      </div>

      {/* --- SEÇÃO DE ACOMPANHAMENTO (PENDÊNCIAS) --- */}
      {pendingFeedbackCandidates.length > 0 && (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-amber-800">
                  <Clock size={24}/>
                  <h2 className="text-lg font-bold uppercase tracking-tight">Pendências de Feedback / Retorno</h2>
                  <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-xs font-bold">{pendingFeedbackCandidates.length}</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingFeedbackCandidates.map(c => {
                      const isLate = isDatePast(c.interviewAt);
                      const waLink = getWaLink(c.phone);

                      return (
                          <div key={c.id} className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col hover:shadow-md transition-all">
                              <div className="flex justify-between items-start mb-2">
                                  <div>
                                      <h3 className="font-bold text-slate-800 text-lg">{c.name}</h3>
                                      <p className="text-xs text-slate-500">{c.city || 'Cidade N/I'}</p>
                                  </div>
                                  {waLink && (
                                      <a href={waLink} target="_blank" rel="noreferrer" className="bg-green-100 text-green-700 p-2 rounded-full hover:bg-green-200 transition-colors" title="Mandar mensagem no WhatsApp">
                                          <MessageCircle size={20} />
                                      </a>
                                  )}
                              </div>

                              <div className="bg-slate-50 rounded-lg p-3 mb-3 border border-slate-100">
                                  <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-1">
                                      <Calendar size={16} className="text-blue-600"/>
                                      Data Entrevista:
                                  </div>
                                  <div className={`text-base font-black ${isLate ? 'text-red-600 flex items-center gap-1' : 'text-slate-800'}`}>
                                      {formatDate(c.interviewAt)}
                                      {isLate && <span className="text-[10px] bg-red-100 px-1.5 rounded uppercase tracking-widest">Passada</span>}
                                  </div>
                              </div>

                              <div className="mt-auto flex gap-2">
                                  <button onClick={() => handleOpenModal(c)} className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors">
                                      <Edit2 size={14}/> Dar Resultado
                                  </button>
                                  <button onClick={() => handleOpenLink(c)} className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg" title="Vincular a Vaga">
                                      <ExternalLink size={16}/>
                                  </button>
                              </div>
                          </div>
                      );
                  })}
              </div>
          </section>
      )}

      {/* --- SEÇÃO DE LISTA GERAL --- */}
      <section>
          <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
                  <Search size={20}/> Pool Completo
              </h2>
              <div className="relative w-full max-w-md">
                  <input 
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Buscar por nome, cidade..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                      <tr>
                          <th className="p-4">Candidato</th>
                          <th className="p-4">Contato</th>
                          <th className="p-4">Entrevista</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                      {filteredList.map(c => (
                          <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${['Reprovado', 'Desistência'].includes(c.status) ? 'opacity-70 bg-slate-50/50' : ''}`}>
                              <td className="p-4">
                                  <div className="font-bold text-slate-800">{c.name}</div>
                                  <div className="text-xs text-slate-500">{c.city} • {c.age ? `${c.age} anos` : '-'}</div>
                              </td>
                              <td className="p-4">
                                  <div className="flex items-center gap-2">
                                      {c.phone}
                                      {getWaLink(c.phone) && <a href={getWaLink(c.phone)!} target="_blank" className="text-green-600 hover:scale-110 transition-transform"><MessageCircle size={16}/></a>}
                                  </div>
                                  <div className="text-xs text-slate-400">{c.email}</div>
                              </td>
                              <td className="p-4">
                                  {c.interviewAt ? (
                                      <span className="font-medium text-blue-700">{formatDate(c.interviewAt)}</span>
                                  ) : <span className="text-slate-400">-</span>}
                              </td>
                              <td className="p-4">
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold 
                                      ${c.status === 'Reprovado' ? 'bg-red-100 text-red-700' : 
                                        c.status === 'Desistência' ? 'bg-orange-100 text-orange-700' : 
                                        'bg-blue-50 text-blue-700'}`}>
                                      {c.status}
                                  </span>
                              </td>
                              <td className="p-4 text-right flex justify-end gap-2">
                                  {/* BOTÃO BANCO DE TALENTOS (NOVO) */}
                                  <button 
                                    onClick={() => {
                                        setTalentFormData({ name: c.name, city: c.city, targetRole: 'Entrevista Geral' });
                                        setTalentEmail(c.email || '');
                                        setTalentPhone(c.phone || '');
                                        setIsTalentModalOpen(true);
                                    }} 
                                    className="p-2 text-slate-500 hover:bg-orange-50 hover:text-orange-600 rounded transition-colors" 
                                    title="Salvar no Banco de Talentos"
                                  >
                                      <Database size={16}/>
                                  </button>

                                  <button onClick={() => handleOpenLink(c)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded" title="Vincular a Vaga"><ExternalLink size={16}/></button>
                                  <button onClick={() => handleOpenModal(c)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Editar"><Edit2 size={16}/></button>
                                  <button onClick={() => handleDeleteClick(c)} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={16}/></button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              {filteredList.length === 0 && <div className="p-8 text-center text-slate-400">Nenhum candidato encontrado.</div>}
          </div>
      </section>

      {/* --- MODAL DE VINCULAR A VAGA --- */}
      {isLinkModalOpen && candidateToLink && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fadeIn">
              <div className="flex justify-center mb-4"><div className="bg-indigo-100 p-3 rounded-full text-indigo-600"><Briefcase size={32}/></div></div>
              <h3 className="text-xl font-bold text-center text-slate-800 mb-2">Vincular a uma Vaga</h3>
              <p className="text-sm text-center text-slate-500 mb-6">
                  Isso irá mover <strong>{candidateToLink.name}</strong> para a vaga selecionada e removerá ele desta lista geral.
              </p>

              <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-600 mb-2 uppercase">Selecione a Vaga de Destino</label>
                  <select 
                    className="w-full border p-3 rounded-xl font-bold text-slate-700 bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                    value={selectedJobId}
                    onChange={e => setSelectedJobId(e.target.value)}
                  >
                      <option value="">-- Selecione --</option>
                      {openJobs.map(j => (
                          <option key={j.id} value={j.id}>{j.title} ({j.unit})</option>
                      ))}
                  </select>
              </div>

              <div className="flex gap-2">
                  <button onClick={() => setIsLinkModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl">Cancelar</button>
                  <button onClick={confirmLink} disabled={!selectedJobId} className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 shadow-lg disabled:opacity-50">Confirmar Vínculo</button>
              </div>
           </div>
        </div>
      )}

      {/* --- MODAL DE CRIAR/EDITAR (Completo) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                  <h3 className="font-bold text-xl text-slate-800">{editingId ? 'Editar Candidato' : 'Nova Entrevista Geral'}</h3>
                  <button onClick={() => setIsModalOpen(false)} className="hover:bg-slate-100 p-1 rounded-full"><ArrowRight size={24} className="hidden"/><span className="text-slate-400 font-bold">X</span></button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold mb-1">Nome</label><input required className="w-full border p-2 rounded" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold mb-1">Idade</label><input type="number" className="w-full border p-2 rounded" value={formData.age || ''} onChange={e => setFormData({...formData, age: Number(e.target.value)})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold mb-1">Telefone</label><input className="w-full border p-2 rounded" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold mb-1">Cidade</label><input className="w-full border p-2 rounded" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-xs font-bold mb-1">Pretensão Salarial</label><input className="w-full border p-2 rounded" value={formData.salaryExpectation || ''} onChange={e => setFormData({...formData, salaryExpectation: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold mb-1">Status</label>
                          <select 
                            className="w-full border p-2 rounded" 
                            value={formData.status} 
                            onChange={e => {
                                const newStatus = e.target.value;
                                setFormData({...formData, status: newStatus});
                                if (!['Reprovado', 'Desistência'].includes(newStatus)) {
                                    setLossReasonType(''); 
                                    setFormData(p => ({...p, rejectionReason: undefined}));
                                }
                            }}
                          >
                              <option value="Entrevista">Entrevista</option>
                              <option value="Em Análise">Em Análise</option>
                              <option value="Reprovado">Reprovado</option>
                              <option value="Desistência">Desistência</option>
                          </select>
                      </div>
                  </div>

                  {/* CAMPO DE MOTIVO DA PERDA (IGUAL AO JOBDETAILS) */}
                  {(formData.status === 'Reprovado' || formData.status === 'Desistência') && (
                      <div className="bg-red-50 p-4 rounded-lg border border-red-200 animate-fadeIn">
                          <label className="block text-xs font-bold text-red-700 mb-1 flex items-center gap-1"><AlertCircle size={12}/> Motivo da Perda (Obrigatório)</label>
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

                  <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <div><label className="block text-xs font-bold mb-1 uppercase text-blue-800">Data Chegada</label><input type="date" className="w-full border p-2 rounded" value={toInputDate(formData.firstContactAt)} onChange={e => setFormData({...formData, firstContactAt: e.target.value})} /></div>
                      <div><label className="block text-xs font-bold mb-1 uppercase text-blue-800">Data Entrevista</label><input type="date" className="w-full border p-2 rounded font-bold text-blue-700" value={toInputDate(formData.interviewAt)} onChange={e => setFormData({...formData, interviewAt: e.target.value})} /></div>
                  </div>

                  <div><label className="block text-xs font-bold mb-1">Anotações / Parecer</label><textarea className="w-full border p-2 rounded h-24" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Perfil do candidato, interesses..." /></div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button>
                      <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded font-bold shadow hover:bg-blue-700">Salvar Candidato</button>
                  </div>
              </form>
           </div>
        </div>
      )}

      {/* --- MODAL DE DELETAR --- */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-xl p-6 w-full max-w-sm border-t-4 border-red-500 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Excluir Candidato?</h3>
              <p className="text-xs text-slate-500 mb-4">Digite sua senha para confirmar a exclusão permanente de {candidateToDelete?.name}.</p>
              <form onSubmit={confirmDelete}>
                  <input type="password" placeholder="Sua senha" autoFocus className="w-full border p-3 rounded mb-4 text-center tracking-widest" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
                  <div className="flex gap-2">
                      <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2 text-slate-500 font-bold bg-slate-100 rounded">Cancelar</button>
                      <button type="submit" className="flex-1 bg-red-600 text-white font-bold py-2 rounded shadow">Excluir</button>
                  </div>
              </form>
           </div>
        </div>
      )}

      {/* --- MODAL EXPORTAR PARA BANCO DE TALENTOS (NOVO) --- */}
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
                        // JUNTA TUDO ANTES DE SALVAR
                        const finalContact = [talentEmail, talentPhone].filter(Boolean).join(' | ');
                        
                        addTalent({ 
                            ...talentFormData, 
                            contact: finalContact, // SALVA UNIDO
                            id: generateId(), 
                            createdAt: new Date().toISOString(),
                            tags: [],
                            education: [],
                            experience: [],
                            observations: [`Origem: Entrevista Geral`]
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
