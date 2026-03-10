import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Candidate, Job } from '../types';
import { 
  UserPlus, FileCheck, Stethoscope, Copy, ExternalLink, 
  CheckCircle2, MonitorSmartphone, MessageSquare
} from 'lucide-react';

export const Integracao: React.FC = () => {
  const { candidates = [], jobs = [], updateCandidate } = useData() as any;
  const [activeTicketModal, setActiveTicketModal] = useState<string | null>(null);

  // FILTRO ATUALIZADO: Traz os contratados, mas esconde os que já tiveram a integração concluída
  const hiredCandidates = candidates.filter((c: Candidate) => c.status === 'Contratado' && !c.onboarding?.completed);

  const handleUpdateOnboarding = async (candidate: Candidate, field: string, value: any) => {
    const updatedCandidate = {
      ...candidate,
      onboarding: {
        ...(candidate.onboarding || {}),
        [field]: value
      }
    };
    await updateCandidate(updatedCandidate);
  };

  const handleCompleteIntegration = async (candidate: Candidate) => {
    if (window.confirm(`Tem certeza que deseja concluir e arquivar a integração de ${candidate.name}?`)) {
      await handleUpdateOnboarding(candidate, 'completed', true);
    }
  };

  const getJobDetails = (jobId?: string): Job | undefined => {
    return jobs.find((j: Job) => j.id === jobId);
  };

  const generateWhatsAppDocsMsg = (candidateName: string) => {
    const firstName = candidateName.split(' ')[0];
    return `Olá ${firstName}! Tudo bem? Parabéns pela aprovação!\n\nPara darmos andamento à sua contratação, precisamos que nos envie (ou traga a cópia) dos seguintes documentos:\n\n📄 *Documentos Pessoais:*\n- Identificação (RG ou CNH) Frente e Verso\n- CPF\n- Título de Eleitor\n- Comprovante de Residência\n- Carteira de Trabalho (pode ser o PDF da digital)\n- Número do PIS (App Caixa TEM ou Trabalhador)\n- Carteirinha do SUS\n- Comprovante de Escolaridade\n\n👨‍👩‍👧 *Caso possua filhos:*\n- Certidão de Nascimento com CPF dos filhos\n- Cópia da Carteira de Vacinação dos filhos\n- Comprovante de frequência escolar (para filhos menores de 16 anos)\n\nQualquer dúvida, estou à disposição!`;
  };

  const generateGLPITicketMsg = (candidate: Candidate, job?: Job) => {
    const resources = job?.resources || [];
    const resourceList = resources.length > 0 
      ? resources.map(r => `- ${r};`).join('\n') 
      : '- Equipamento padrão do setor;\n- E-mail corporativo;';
    
    const accessInfo = job?.accessReference 
      ? `\n*Telas de Acesso / Permissões:*\nFavor espelhar os acessos de: ${job.accessReference}` 
      : '\n*Telas de Acesso:*\nAvaliar permissões padrão do cargo.';

    const startDate = candidate.timeline?.startDate 
      ? new Date(candidate.timeline.startDate).toLocaleDateString('pt-BR') 
      : 'A definir';

    return `Olá!\n\nVenho por meio deste fazer a solicitação de abertura de conta e recursos para novo colaborador.\n\n*Colaborador:* ${candidate.name}\n*Cargo:* ${job?.title || 'Não definido'}\n*Setor:* ${job?.sector || 'Não definido'}\n*Data de Início:* ${startDate}\n\n*Recursos Solicitados:*\n${resourceList}\n${accessInfo}\n\nObrigado!`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Mensagem copiada para a área de transferência!');
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
          <UserPlus size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Integração e Admissão</h1>
          <p className="text-slate-500 text-sm">Checklist de documentos, exames e TI para novos colaboradores</p>
        </div>
      </div>

      {hiredCandidates.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
          <CheckCircle2 size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-600">Nenhuma integração pendente</h3>
          <p className="text-slate-400">Todos os candidatos contratados já foram processados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {hiredCandidates.map((candidate: Candidate) => {
            const job = getJobDetails(candidate.jobId);
            const ob = candidate.onboarding || {};

            return (
              <div key={candidate.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                {/* Header do Candidato */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                  <div>
                    <h3 className="font-black text-lg text-slate-800">{candidate.name}</h3>
                    <p className="text-sm font-bold text-emerald-600">{job?.title || 'Vaga Geral'} • {job?.sector || 'Setor não definido'}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Início previsto: <span className="font-bold text-slate-700">{candidate.timeline?.startDate ? new Date(candidate.timeline.startDate).toLocaleDateString('pt-BR') : 'Não agendado'}</span>
                    </p>
                  </div>
                  <a 
                    href={`https://wa.me/55${(candidate.phone || '').replace(/\D/g, '')}`} 
                    target="_blank" rel="noreferrer"
                    className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
                    title="Falar no WhatsApp"
                  >
                    <MessageSquare size={20} />
                  </a>
                </div>

                <div className="p-5 space-y-6 flex-1">
                  {/* Etapa 1: Documentos */}
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mt-1"><FileCheck size={20} /></div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-700 mb-2">1. Coleta de Documentos</h4>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={() => copyToClipboard(generateWhatsAppDocsMsg(candidate.name))}
                          className="flex items-center gap-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg transition-colors"
                        >
                          <Copy size={14} /> Copiar Mensagem (WhatsApp)
                        </button>
                        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500" 
                            checked={ob.docsDelivered || false}
                            onChange={(e) => handleUpdateOnboarding(candidate, 'docsDelivered', e.target.checked)}
                          />
                          <span className={ob.docsDelivered ? 'text-emerald-700 font-bold line-through' : 'text-slate-600'}>
                            Documentos entregues ao DP
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Etapa 2: Exames */}
                  <div className="flex items-start gap-4 border-t border-slate-100 pt-6">
                    <div className="p-2 bg-rose-50 text-rose-600 rounded-lg mt-1"><Stethoscope size={20} /></div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-700 mb-3">2. Exames Admissionais</h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Exame Clínico (Data)</label>
                          <input 
                            type="date" 
                            className="w-full border border-slate-200 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500"
                            value={ob.examDate || ''}
                            onChange={(e) => handleUpdateOnboarding(candidate, 'examDate', e.target.value)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-600 mt-2">
                            <input 
                              type="checkbox" 
                              className="rounded text-rose-600"
                              checked={ob.needsLabExam || false}
                              onChange={(e) => handleUpdateOnboarding(candidate, 'needsLabExam', e.target.checked)}
                            />
                            Exige Laboratoriais Ext. (Visão, Sangue...)
                          </label>
                          {ob.needsLabExam && (
                            <input 
                              type="date" 
                              className="w-full border border-rose-200 bg-rose-50 p-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-rose-500"
                              value={ob.labExamDate || ''}
                              onChange={(e) => handleUpdateOnboarding(candidate, 'labExamDate', e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Etapa 3: TI e Acessos */}
                  <div className="flex items-start gap-4 border-t border-slate-100 pt-6">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg mt-1"><MonitorSmartphone size={20} /></div>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-700 mb-2">3. Solicitação TI (GLPI)</h4>
                      <p className="text-xs text-slate-500 mb-3">Gere o ticket para liberação de PC, E-mail e Telas de Acesso baseados na vaga.</p>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <button 
                          onClick={() => setActiveTicketModal(candidate.id)}
                          className="flex items-center gap-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                          <Copy size={16} /> Gerar Ticket TI
                        </button>
                        <a 
                          href="https://glpi.dimyoficial.com/front/helpdesk.public.php" 
                          target="_blank" rel="noreferrer"
                          className="flex items-center justify-center gap-2 text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors"
                        >
                          Abrir GLPI <ExternalLink size={16} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* NOVO: RODAPÉ PARA CONCLUIR E ARQUIVAR */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                   <button 
                      onClick={() => handleCompleteIntegration(candidate)}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95"
                   >
                      <CheckCircle2 size={18} />
                      Concluir Integração
                   </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DO TICKET TI */}
      {activeTicketModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="p-6 bg-indigo-600 flex justify-between items-center text-white">
              <h2 className="text-xl font-bold flex items-center gap-2"><MonitorSmartphone /> Resumo para Ticket (GLPI)</h2>
            </div>
            <div className="p-6 bg-slate-50">
              <p className="text-sm text-slate-600 mb-4">Copie o texto abaixo e cole no chamado do GLPI. As informações foram extraídas do cadastro da Vaga.</p>
              
              <div className="relative">
                <textarea 
                  readOnly 
                  className="w-full h-64 p-4 border border-slate-200 rounded-xl text-sm bg-white outline-none resize-none"
                  value={generateGLPITicketMsg(
                    candidates.find((c:Candidate) => c.id === activeTicketModal)!, 
                    getJobDetails(candidates.find((c:Candidate) => c.id === activeTicketModal)?.jobId)
                  )}
                />
              </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex gap-3 justify-end">
              <button onClick={() => setActiveTicketModal(null)} className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors">
                Fechar
              </button>
              <button 
                onClick={() => {
                  copyToClipboard(generateGLPITicketMsg(
                    candidates.find((c:Candidate) => c.id === activeTicketModal)!, 
                    getJobDetails(candidates.find((c:Candidate) => c.id === activeTicketModal)?.jobId)
                  ));
                  handleUpdateOnboarding(candidates.find((c:Candidate) => c.id === activeTicketModal)!, 'itTicketCreated', true);
                  setActiveTicketModal(null);
                }} 
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-md"
              >
                Copiar e Marcar como Feito
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};