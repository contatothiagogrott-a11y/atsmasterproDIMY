import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Employee, ExperienceInterview } from '../types';
import { addDays, differenceInDays, parseISO } from 'date-fns';
import { CalendarClock, CheckSquare, BarChart, AlertCircle, X, ChevronRight } from 'lucide-react';

export const Experiencia: React.FC = () => {
  const { employees, updateEmployee, user } = useData();
  const [activeTab, setActiveTab] = useState<'prazos' | 'relatorio'>('prazos');
  
  // Modal de Entrevista
  const [interviewingEmp, setInterviewingEmp] = useState<Employee | null>(null);
  const [interviewData, setInterviewData] = useState<Partial<ExperienceInterview>>({
    period: '1º Período',
    qLeader: 0, qColleagues: 0, qTraining: 0, 
    qJobSatisfaction: 0, qCompanySatisfaction: 0, qBenefits: 0,
    trainerName: '', comments: ''
  });

  // --- LÓGICA DE PRAZOS ---
  const probationList = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return employees
      .filter(emp => emp.status === 'Ativo' && emp.contractType === 'CLT' && emp.probationType && emp.probationType !== 'Nenhum')
      .map(emp => {
        const admission = parseISO(emp.admissionDate);
        const days1 = emp.probationType === '45+45' ? 45 : 30;
        const days2 = emp.probationType === '45+45' ? 90 : 90; // O total de experiência é 90 dias

        const endPeriod1 = addDays(admission, days1);
        const endPeriod2 = addDays(admission, days2);

        const diff1 = differenceInDays(endPeriod1, today);
        const diff2 = differenceInDays(endPeriod2, today);

        let currentPeriod = '';
        let daysLeft = 0;
        let urgency = 'ok'; // 'ok', 'warning' (<= 7 dias), 'danger' (< 0)

        // Descobre em qual período o colaborador está
        if (diff1 >= 0) {
          currentPeriod = '1º Período';
          daysLeft = diff1;
        } else if (diff2 >= 0) {
          currentPeriod = '2º Período';
          daysLeft = diff2;
        } else {
          currentPeriod = 'Efetivado';
          daysLeft = diff2; // Ficará negativo mostrando há quantos dias passou
        }

        if (daysLeft <= 7 && daysLeft >= 0) urgency = 'warning';
        if (daysLeft < 0) urgency = 'danger';

        // Verifica se a entrevista deste período já foi feita
        const alreadyInterviewed = emp.experienceInterviews?.some(i => i.period === currentPeriod);

        return { ...emp, currentPeriod, daysLeft, urgency, endPeriod1, endPeriod2, alreadyInterviewed };
      })
      .filter(emp => emp.currentPeriod !== 'Efetivado') // Oculta quem já passou dos 90 dias
      .sort((a, b) => a.daysLeft - b.daysLeft); // Ordena pelos mais urgentes (menor prazo primeiro)
  }, [employees]);

  // --- LÓGICA DO eNPS ---
  const analytics = useMemo(() => {
    let allInterviews: ExperienceInterview[] = [];
    employees.forEach(emp => {
      if (emp.experienceInterviews) allInterviews = [...allInterviews, ...emp.experienceInterviews];
    });

    const calculateNPS = (scoreArray: number[]) => {
      if (scoreArray.length === 0) return { promoters: 0, passives: 0, detractors: 0, score: 0, total: 0 };
      const total = scoreArray.length;
      
      // Lógica exata: 4 = Promotor, 3 = Passivo, 1 ou 2 = Detrator
      const promoters = scoreArray.filter(s => s === 4).length;
      const passives = scoreArray.filter(s => s === 3).length;
      const detractors = scoreArray.filter(s => s <= 2).length;
      
      // Fórmula: % Promotores - % Detratores
      const pctPromotores = (promoters / total) * 100;
      const pctDetratores = (detractors / total) * 100;
      const score = Math.round(pctPromotores - pctDetratores);
      
      return { promoters, passives, detractors, score, total };
    };

    return {
      total: allInterviews.length,
      leader: calculateNPS(allInterviews.map(i => i.qLeader)),
      colleagues: calculateNPS(allInterviews.map(i => i.qColleagues)),
      training: calculateNPS(allInterviews.map(i => i.qTraining)),
      job: calculateNPS(allInterviews.map(i => i.qJobSatisfaction)),
      company: calculateNPS(allInterviews.map(i => i.qCompanySatisfaction)),
      benefits: calculateNPS(allInterviews.map(i => i.qBenefits)),
    };
  }, [employees]);

  // --- HANDLERS ---
  const handleSaveInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewingEmp) return;

    const newInterview: ExperienceInterview = {
      id: crypto.randomUUID(),
      interviewDate: new Date().toISOString().split('T')[0],
      period: interviewData.period as any,
      qLeader: interviewData.qLeader!,
      qColleagues: interviewData.qColleagues!,
      qTraining: interviewData.qTraining!,
      qJobSatisfaction: interviewData.qJobSatisfaction!,
      qCompanySatisfaction: interviewData.qCompanySatisfaction!,
      qBenefits: interviewData.qBenefits!,
      trainerName: interviewData.trainerName || 'Não informado',
      comments: interviewData.comments || '',
      interviewerName: user?.name || 'Sistema'
    };

    const updatedEmp = {
      ...interviewingEmp,
      experienceInterviews: [...(interviewingEmp.experienceInterviews || []), newInterview]
    };

    await updateEmployee(updatedEmp);
    setInterviewingEmp(null);
    alert('Entrevista salva com sucesso! O termômetro eNPS foi atualizado.');
  };

  const getScoreColor = (score: number) => {
    if (score >= 50) return 'text-emerald-600'; // Zona de Excelência / Qualidade
    if (score > 0) return 'text-blue-500'; // Zona de Aperfeiçoamento
    return 'text-red-500'; // Zona Crítica
  };

  // Componente Reutilizável para os botões de nota (1 a 4)
  const ScoreSelector = ({ value, onChange, label }: { value: number, onChange: (v: number) => void, label: string }) => (
    <div className="space-y-2">
      <label className="text-sm font-bold text-slate-700 block">{label}</label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange(1)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border ${value === 1 ? 'bg-red-500 text-white border-red-600 shadow-md transform scale-105' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-red-50'}`}>1 - Péssimo</button>
        <button type="button" onClick={() => onChange(2)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border ${value === 2 ? 'bg-orange-500 text-white border-orange-600 shadow-md transform scale-105' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-orange-50'}`}>2 - Ruim</button>
        <button type="button" onClick={() => onChange(3)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border ${value === 3 ? 'bg-blue-500 text-white border-blue-600 shadow-md transform scale-105' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-blue-50'}`}>3 - Bom</button>
        <button type="button" onClick={() => onChange(4)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all border ${value === 4 ? 'bg-emerald-500 text-white border-emerald-600 shadow-md transform scale-105' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-emerald-50'}`}>4 - Ótimo</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
          <CalendarClock size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Acompanhamento de Experiência</h1>
          <p className="text-slate-500 text-sm">Gestão de prazos e Entrevistas de Check-in</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('prazos')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'prazos' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <CalendarClock size={18} /><span>Prazos Ativos</span>
        </button>
        <button onClick={() => setActiveTab('relatorio')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'relatorio' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <BarChart size={18} /><span>Termômetro eNPS</span>
        </button>
      </div>

      {/* ABA: PRAZOS ATIVOS */}
      {activeTab === 'prazos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="p-4 font-semibold">Colaborador</th>
                  <th className="p-4 font-semibold text-center">Tipo</th>
                  <th className="p-4 font-semibold text-center">Período Atual</th>
                  <th className="p-4 font-semibold text-center">Dias Restantes</th>
                  <th className="p-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {probationList.map(emp => (
                  <tr key={emp.id} className={`hover:bg-slate-50 transition-colors ${emp.urgency === 'danger' ? 'bg-red-50/50' : ''}`}>
                    <td className="p-4">
                      <p className="font-bold text-slate-800">{emp.name}</p>
                      <p className="text-xs text-slate-500">{emp.role} • {emp.unit || emp.sector}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-xs font-bold border border-slate-200">{emp.probationType}</span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-semibold text-slate-700 text-sm">{emp.currentPeriod}</span>
                    </td>
                    <td className="p-4 text-center">
                      {emp.daysLeft < 0 ? (
                        <span className="flex items-center justify-center gap-1 text-red-600 font-bold text-sm"><AlertCircle size={16} /> Vencido há {Math.abs(emp.daysLeft)} dias</span>
                      ) : emp.daysLeft <= 7 ? (
                        <span className="flex items-center justify-center gap-1 text-amber-600 font-bold text-sm animate-pulse"><AlertCircle size={16} /> Faltam {emp.daysLeft} dias</span>
                      ) : (
                        <span className="text-slate-600 font-medium text-sm">Faltam {emp.daysLeft} dias</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {emp.alreadyInterviewed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg"><CheckSquare size={14} /> Avaliado</span>
                      ) : (
                        <button 
                          onClick={() => { setInterviewingEmp(emp as Employee); setInterviewData({ period: emp.currentPeriod as any }); }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                          Avaliar Agora
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {probationList.length === 0 && (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400">Excelente! Nenhum colaborador em período de experiência no momento.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: TERMÔMETRO eNPS */}
      {activeTab === 'relatorio' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-indigo-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-16 opacity-10">
              <BarChart size={150} />
            </div>
            <div className="z-10">
              <h2 className="text-2xl font-black mb-1">Termômetro de Experiência (eNPS)</h2>
              <p className="text-indigo-200">Visão geral do acolhimento, calculada subtraindo Detratores (1 e 2) de Promotores (4).</p>
            </div>
            <div className="bg-indigo-800 p-4 rounded-2xl border border-indigo-700 text-center min-w-[150px] z-10">
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">Entrevistas Feitas</p>
              <p className="text-4xl font-black">{analytics.total}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Acolhimento da Liderança', data: analytics.leader },
              { title: 'Acolhimento da Equipe', data: analytics.colleagues },
              { title: 'Qualidade do Treinamento', data: analytics.training },
              { title: 'Satisfação com a Função', data: analytics.job },
              { title: 'Satisfação com a Empresa', data: analytics.company },
              { title: 'Satisfação com Benefícios', data: analytics.benefits },
            ].map((item, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-slate-700 mb-4 h-10 line-clamp-2 leading-tight">{item.title}</h3>
                
                <div className="flex items-end gap-3 mb-6 border-b border-slate-100 pb-4">
                  <div className={`text-5xl font-black tracking-tighter ${getScoreColor(item.data.score)}`}>{item.data.total > 0 ? item.data.score : '-'}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase pb-1.5 tracking-widest">eNPS Score</div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Promotores (4)</span> <b className="text-slate-800">{item.data.promoters}</b></div>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Passivos (3)</span> <b className="text-slate-800">{item.data.passives}</b></div>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-red-500"></div> Detratores (1 ou 2)</span> <b className="text-slate-800">{item.data.detractors}</b></div>
                </div>
                
                {/* Barra Visual (100%) */}
                {item.data.total > 0 ? (
                  <div className="w-full h-1.5 rounded-full overflow-hidden mt-5 flex">
                    <div style={{ width: `${(item.data.detractors / item.data.total) * 100}%` }} className="bg-red-500 h-full"></div>
                    <div style={{ width: `${(item.data.passives / item.data.total) * 100}%` }} className="bg-blue-500 h-full"></div>
                    <div style={{ width: `${(item.data.promoters / item.data.total) * 100}%` }} className="bg-emerald-500 h-full"></div>
                  </div>
                ) : (
                  <div className="w-full h-1.5 rounded-full bg-slate-100 mt-5"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DO FORMULÁRIO DE ENTREVISTA */}
      {interviewingEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50 rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Entrevista de {interviewData.period}</h2>
                <p className="text-sm text-slate-500 mt-1">{interviewingEmp.name} • Adm: {parseISO(interviewingEmp.admissionDate).toLocaleDateString('pt-BR')}</p>
              </div>
              <button onClick={() => setInterviewingEmp(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>

            {/* Body Modal Scrollable */}
            <form id="interview-form" onSubmit={handleSaveInterview} className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
                <ScoreSelector label="1. Acolhimento da Liderança" value={interviewData.qLeader || 0} onChange={v => setInterviewData({...interviewData, qLeader: v})} />
                <ScoreSelector label="2. Acolhimento dos Colegas" value={interviewData.qColleagues || 0} onChange={v => setInterviewData({...interviewData, qColleagues: v})} />
                <ScoreSelector label="3. Qualidade do Treinamento" value={interviewData.qTraining || 0} onChange={v => setInterviewData({...interviewData, qTraining: v})} />
                <ScoreSelector label="4. Satisfação com o Cargo" value={interviewData.qJobSatisfaction || 0} onChange={v => setInterviewData({...interviewData, qJobSatisfaction: v})} />
                <ScoreSelector label="5. Satisfação com a Empresa" value={interviewData.qCompanySatisfaction || 0} onChange={v => setInterviewData({...interviewData, qCompanySatisfaction: v})} />
                <ScoreSelector label="6. Satisfação com Benefícios" value={interviewData.qBenefits || 0} onChange={v => setInterviewData({...interviewData, qBenefits: v})} />
              </div>

              <div className="border-t border-slate-100 pt-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Quem realizou seu treinamento prático?</label>
                  <input type="text" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nome do treinador..." value={interviewData.trainerName || ''} onChange={e => setInterviewData({...interviewData, trainerName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Sugestões de melhoria ou comentários abertos:</label>
                  <textarea rows={4} className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="O que o colaborador tem a dizer sobre esses primeiros dias?" value={interviewData.comments || ''} onChange={e => setInterviewData({...interviewData, comments: e.target.value})}></textarea>
                </div>
              </div>
            </form>

            {/* Footer Modal */}
            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setInterviewingEmp(null)} className="px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
              <button 
                type="submit" 
                form="interview-form"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={!interviewData.qLeader || !interviewData.qColleagues || !interviewData.qTraining || !interviewData.qJobSatisfaction || !interviewData.qCompanySatisfaction || !interviewData.qBenefits}
              >
                Salvar Avaliação
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};