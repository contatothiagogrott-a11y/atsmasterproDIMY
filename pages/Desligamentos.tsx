import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Employee, ExitInterview } from '../types';
import { 
  UserMinus, Calendar, Search, CheckSquare, X, 
  AlertTriangle, MessageSquare, Briefcase, ChevronRight, 
  FileText, UserCheck, BarChart, TrendingDown
} from 'lucide-react';

const EXIT_REASONS = [
  "Salário insatisfatório", "Benefícios insuficientes", "Falta de crescimento", 
  "Falta de plano de carreira", "Falta de treinamento", "Insatisfação com função", 
  "Busca de novos desafios", "Transição de carreira", "Empreendedorismo", 
  "Carga de trabalho excessiva", "Falta de reconhecimento", "Ambiente de trabalho ruim", 
  "Conflito com liderança", "Conflito com colegas", "Insatisfação com gestão", 
  "Falta de flexibilidade", "Desalinhamento de valores", "Distância/deslocamento", 
  "Mudança de cidade", "Desmotivação", "Retorno aos estudos", "Aposentadoria", 
  "Questões familiares", "Questões de saúde", "Estresse/burnout"
];

export const Desligamentos: React.FC = () => {
  const { employees, updateEmployee, user } = useData() as any;

  const [activeTab, setActiveTab] = useState<'PENDING' | 'COMPLETED' | 'ANALYTICS'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtros do Relatório
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]; // Começo do ano
  });
  const [filterEnd, setFilterEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 11, 31).toISOString().split('T')[0]; // Final do ano
  });

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [interviewingEmp, setInterviewingEmp] = useState<Employee | null>(null);
  
  const [formData, setFormData] = useState<Partial<ExitInterview>>({
    interviewDate: new Date().toISOString().split('T')[0],
    reason: '', reasonObservation: '',
    colleaguesRating: 0, leaderRating: 0, leaderName: '',
    trainingRating: 0, trainerName: '', growthRating: 0,
    salaryRating: 0, benefitsRating: 0, jobSatisfactionRating: 0,
    additionalComments: ''
  });

  const [isOtherReason, setIsOtherReason] = useState(false);

  // Formatação Segura
  const formatToYMD = (dateVal: any) => {
    if (!dateVal) return '';
    let str = String(dateVal).trim().split('T')[0].split(' ')[0];
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return str; 
  };
  const formatDateBR = (dateStr: any) => {
      const ymd = formatToYMD(dateStr);
      if(!ymd) return '-';
      const [y,m,d] = ymd.split('-');
      return `${d}/${m}/${y}`;
  };

  // Listas Básicas
  const inactiveEmployees = useMemo(() => {
    return employees.filter((e: Employee) => e.status === 'Inativo');
  }, [employees]);

  const pendingInterviews = useMemo(() => {
    return inactiveEmployees
      .filter((e: Employee) => !e.exitInterview)
      .filter((e: Employee) => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a: any, b: any) => new Date(formatToYMD(b.terminationDate)).getTime() - new Date(formatToYMD(a.terminationDate)).getTime());
  }, [inactiveEmployees, searchTerm]);

  const completedInterviews = useMemo(() => {
    return inactiveEmployees
      .filter((e: Employee) => e.exitInterview)
      .filter((e: Employee) => e.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a: any, b: any) => new Date(formatToYMD(b.terminationDate)).getTime() - new Date(formatToYMD(a.terminationDate)).getTime());
  }, [inactiveEmployees, searchTerm]);

  const activeNames = useMemo(() => {
      return employees.filter((e: Employee) => e.status === 'Ativo').map((e: Employee) => e.name);
  }, [employees]);


  // --- LÓGICA DO RELATÓRIO DE DESLIGAMENTOS ---
  const analytics = useMemo(() => {
    // 1. Filtra as concluídas pelo período de desligamento
    const validCompleted = inactiveEmployees.filter((emp: Employee) => {
      if (!emp.exitInterview) return false;
      const tDate = formatToYMD(emp.terminationDate);
      if (!tDate) return false;
      return tDate >= filterStart && tDate <= filterEnd;
    });

    // Separamos: Quem respondeu normal / Quem recusou / Quem a empresa dispensou da entrevista
    const answered = validCompleted.filter((e: Employee) => !e.exitInterview?.didNotRespond && e.exitInterview?.reason !== 'Não Aplicável (Dispensado/Demitido)');
    const skipped = validCompleted.filter((e: Employee) => e.exitInterview?.didNotRespond);
    const notApplicable = validCompleted.filter((e: Employee) => e.exitInterview?.reason === 'Não Aplicável (Dispensado/Demitido)');

    // 2. Extrai e conta os motivos principais (só de quem respondeu)
    const reasonsCount: Record<string, number> = {};
    answered.forEach((e: Employee) => {
      const r = e.exitInterview!.reason;
      reasonsCount[r] = (reasonsCount[r] || 0) + 1;
    });
    const sortedReasons = Object.entries(reasonsCount).sort((a, b) => b[1] - a[1]);

    // 3. Função de NPS Interno
    const calculateSatisfaction = (scoreArray: number[]) => {
      const validScores = scoreArray.filter(s => s > 0); // Remove 0 se houver
      if (validScores.length === 0) return { promoters: 0, passives: 0, detractors: 0, score: 0, total: 0 };
      const total = validScores.length;
      
      const promoters = validScores.filter(s => s === 4).length;
      const passives = validScores.filter(s => s === 3).length;
      const detractors = validScores.filter(s => s <= 2).length;
      
      const pctPromotores = (promoters / total) * 100;
      const pctDetratores = (detractors / total) * 100;
      const score = Math.round(pctPromotores - pctDetratores);
      
      return { promoters, passives, detractors, score, total };
    };

    return {
      totalAnswered: answered.length,
      totalSkipped: skipped.length,
      totalNotApplicable: notApplicable.length,
      totalPendingInPeriod: inactiveEmployees.filter((e: Employee) => {
         if (e.exitInterview) return false;
         const tDate = formatToYMD(e.terminationDate);
         return tDate >= filterStart && tDate <= filterEnd;
      }).length,
      reasons: sortedReasons,
      colleagues: calculateSatisfaction(answered.map((e: Employee) => e.exitInterview!.colleaguesRating)),
      leader: calculateSatisfaction(answered.map((e: Employee) => e.exitInterview!.leaderRating)),
      training: calculateSatisfaction(answered.map((e: Employee) => e.exitInterview!.trainingRating)),
      job: calculateSatisfaction(answered.map((e: Employee) => e.exitInterview!.jobSatisfactionRating)),
      growth: calculateSatisfaction(answered.map((e: Employee) => e.exitInterview!.growthRating)),
      salary: calculateSatisfaction(answered.map((e: Employee) => e.exitInterview!.salaryRating)),
      benefits: calculateSatisfaction(answered.map((e: Employee) => e.exitInterview!.benefitsRating)),
    };
  }, [inactiveEmployees, filterStart, filterEnd]);


  const openInterviewModal = (emp: Employee) => {
    setInterviewingEmp(emp);
    
    if (emp.exitInterview) {
      const isCustomReason = !EXIT_REASONS.includes(emp.exitInterview.reason);
      const isSystemReason = ['Não respondeu', 'Não Aplicável (Dispensado/Demitido)'].includes(emp.exitInterview.reason);
      
      setIsOtherReason(isCustomReason && !isSystemReason && emp.exitInterview.reason !== '');
      setFormData({ ...emp.exitInterview });
    } else {
      setIsOtherReason(false);
      setFormData({
        interviewDate: new Date().toISOString().split('T')[0],
        reason: '', reasonObservation: '',
        colleaguesRating: 0, leaderRating: 0, leaderName: '',
        trainingRating: 0, trainerName: '', growthRating: 0,
        salaryRating: 0, benefitsRating: 0, jobSatisfactionRating: 0,
        additionalComments: '',
        didNotRespond: false
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent, exceptionType: 'DID_NOT_RESPOND' | 'NOT_APPLICABLE' | 'NORMAL' = 'NORMAL') => {
    e.preventDefault();
    if (!interviewingEmp) return;

    let finalData: ExitInterview;

    if (exceptionType === 'DID_NOT_RESPOND') {
      if(!window.confirm("Confirmar que o colaborador optou por NÃO RESPONDER a entrevista?")) return;
      finalData = {
        id: formData.id || crypto.randomUUID(),
        interviewDate: new Date().toISOString().split('T')[0],
        reason: 'Não respondeu',
        colleaguesRating: 0, leaderRating: 0, leaderName: '',
        trainingRating: 0, trainerName: '', growthRating: 0,
        salaryRating: 0, benefitsRating: 0, jobSatisfactionRating: 0,
        interviewerName: user?.name || 'Sistema',
        didNotRespond: true
      };
    } else if (exceptionType === 'NOT_APPLICABLE') {
      if(!window.confirm("Confirmar que este colaborador não precisa passar por entrevista (Ex: Demissão/Justa Causa)?")) return;
      finalData = {
        id: formData.id || crypto.randomUUID(),
        interviewDate: new Date().toISOString().split('T')[0],
        reason: 'Não Aplicável (Dispensado/Demitido)',
        colleaguesRating: 0, leaderRating: 0, leaderName: '',
        trainingRating: 0, trainerName: '', growthRating: 0,
        salaryRating: 0, benefitsRating: 0, jobSatisfactionRating: 0,
        interviewerName: user?.name || 'Sistema',
        didNotRespond: false // Deixamos false para não confundir com a recusa do funcionário
      };
    } else {
      finalData = {
        id: formData.id || crypto.randomUUID(),
        interviewDate: formData.interviewDate || new Date().toISOString().split('T')[0],
        reason: isOtherReason ? formData.reason! : formData.reason!,
        reasonObservation: formData.reasonObservation || '',
        colleaguesRating: formData.colleaguesRating || 0,
        leaderRating: formData.leaderRating || 0,
        leaderName: formData.leaderName || '',
        trainingRating: formData.trainingRating || 0,
        trainerName: formData.trainerName || '',
        growthRating: formData.growthRating || 0,
        salaryRating: formData.salaryRating || 0,
        benefitsRating: formData.benefitsRating || 0,
        jobSatisfactionRating: formData.jobSatisfactionRating || 0,
        additionalComments: formData.additionalComments || '',
        interviewerName: user?.name || 'Sistema',
        didNotRespond: false
      };
    }

    const updatedEmp = {
      ...interviewingEmp,
      exitInterview: finalData
    };

    await updateEmployee(updatedEmp);
    setIsModalOpen(false);
    setInterviewingEmp(null);
  };

  const RatingSelector = ({ value, onChange, label }: { value: number, onChange: (v: number) => void, label: string }) => (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-700 block">{label}</label>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange(1)} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${value === 1 ? 'bg-red-500 text-white border-red-600 shadow-md transform scale-105' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-red-50'}`}>Péssimo</button>
        <button type="button" onClick={() => onChange(2)} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${value === 2 ? 'bg-orange-500 text-white border-orange-600 shadow-md transform scale-105' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-orange-50'}`}>Regular</button>
        <button type="button" onClick={() => onChange(3)} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${value === 3 ? 'bg-blue-500 text-white border-blue-600 shadow-md transform scale-105' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-blue-50'}`}>Bom</button>
        <button type="button" onClick={() => onChange(4)} className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border ${value === 4 ? 'bg-emerald-500 text-white border-emerald-600 shadow-md transform scale-105' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-emerald-50'}`}>Ótimo</button>
      </div>
    </div>
  );

  const getScoreColor = (score: number) => {
    if (score >= 50) return 'text-emerald-600'; 
    if (score > 0) return 'text-blue-500'; 
    return 'text-red-500'; 
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      <datalist id="employee-names">
         {activeNames.map(n => <option key={n} value={n} />)}
      </datalist>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-lg shadow-rose-200">
            <UserMinus size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Entrevistas de Desligamento</h1>
            <p className="text-slate-500 text-sm">Pesquisa de clima com ex-colaboradores e motivos de saída</p>
          </div>
        </div>

        {activeTab !== 'ANALYTICS' && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" placeholder="Buscar ex-colaborador..." 
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 transition-all shadow-sm"
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('PENDING')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'PENDING' ? 'border-rose-600 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <AlertTriangle size={18} /><span>Pendentes</span>
          <span className="ml-1 bg-rose-100 text-rose-600 py-0.5 px-2 rounded-full text-[10px]">{pendingInterviews.length}</span>
        </button>
        <button onClick={() => setActiveTab('COMPLETED')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'COMPLETED' ? 'border-rose-600 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <CheckSquare size={18} /><span>Concluídas</span>
          <span className="ml-1 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-[10px]">{completedInterviews.length}</span>
        </button>
        <button onClick={() => setActiveTab('ANALYTICS')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'ANALYTICS' ? 'border-rose-600 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <BarChart size={18} /><span>Relatório Gerencial</span>
        </button>
      </div>

      {/* ================= ABA DE RELATÓRIOS (ANALYTICS) ================= */}
      {activeTab === 'ANALYTICS' && (
        <div className="space-y-6 animate-in fade-in">
          
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
             <div className="flex items-center gap-2">
                <Calendar size={18} className="text-slate-400" />
                <span className="text-sm font-bold text-slate-600">Período de Desligamento:</span>
             </div>
             <div className="flex items-center gap-2">
                <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500" />
                <span className="text-slate-400 text-sm">até</span>
                <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-rose-500" />
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-rose-600 rounded-3xl p-6 text-white shadow-lg shadow-rose-200 flex flex-col justify-center relative overflow-hidden">
               <TrendingDown className="absolute -right-4 -bottom-4 text-rose-500 size-32 opacity-50" />
               <p className="text-rose-200 font-bold uppercase tracking-widest text-[10px] mb-1 relative z-10">Respostas Coletadas</p>
               <p className="text-5xl font-black relative z-10">{analytics.totalAnswered}</p>
            </div>
            
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl"><UserMinus size={24}/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Recusaram<br/>Responder</p>
                <p className="text-3xl font-black text-slate-800 mt-1">{analytics.totalSkipped}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl"><CheckSquare size={24}/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Não Precisou<br/>(Demitidos)</p>
                <p className="text-3xl font-black text-slate-800 mt-1">{analytics.totalNotApplicable}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl"><AlertTriangle size={24}/></div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Ainda<br/>Pendentes</p>
                <p className="text-3xl font-black text-slate-800 mt-1">{analytics.totalPendingInPeriod}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* RANKING DE MOTIVOS */}
            <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
               <div className="p-5 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-black text-slate-700 uppercase tracking-tighter flex items-center gap-2"><TrendingDown size={18} className="text-rose-500"/> Principais Motivos</h3>
               </div>
               <div className="p-0 flex-1 overflow-y-auto custom-scrollbar max-h-[400px]">
                  {analytics.reasons.length === 0 ? (
                     <div className="p-8 text-center text-slate-400 text-sm">Dados insuficientes neste período.</div>
                  ) : (
                     <ul className="divide-y divide-slate-50">
                        {analytics.reasons.map(([reason, count], idx) => (
                           <li key={idx} className="p-4 flex items-center justify-between hover:bg-rose-50/30 transition-colors">
                              <span className="text-xs font-bold text-slate-700 max-w-[180px] truncate" title={reason}>{reason}</span>
                              <span className="bg-rose-100 text-rose-700 px-2 py-1 rounded-lg text-xs font-black">{count}</span>
                           </li>
                        ))}
                     </ul>
                  )}
               </div>
            </div>

            {/* TERMOMETROS DOS PILARES */}
            <div className="lg:col-span-3">
               <h3 className="font-black text-slate-700 uppercase tracking-tighter mb-4 text-sm border-b border-slate-200 pb-2">Diagnóstico Interno (Termômetro)</h3>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { title: 'Relação c/ Colegas', data: analytics.colleagues },
                    { title: 'Relação c/ Liderança', data: analytics.leader },
                    { title: 'Qualidade do Treinamento', data: analytics.training },
                    { title: 'Satisfação c/ Função', data: analytics.job },
                    { title: 'Possib. de Crescimento', data: analytics.growth },
                    { title: 'Satisfação c/ Salário', data: analytics.salary },
                    { title: 'Satisfação c/ Benefícios', data: analytics.benefits },
                  ].map((item, i) => (
                    <div key={i} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-rose-200 transition-colors">
                      <h3 className="font-bold text-slate-700 mb-3 h-10 line-clamp-2 leading-tight text-sm">{item.title}</h3>
                      
                      <div className="flex items-end gap-3 mb-4 border-b border-slate-100 pb-3">
                        <div className={`text-3xl font-black tracking-tighter ${getScoreColor(item.data.score)}`}>{item.data.total > 0 ? item.data.score : '-'}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase pb-1 tracking-widest">Score (NPS)</div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center"><span className="flex items-center gap-1.5 font-medium text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Ótimo</span> <b className="text-slate-800">{item.data.promoters}</b></div>
                        <div className="flex justify-between items-center"><span className="flex items-center gap-1.5 font-medium text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div> Bom</span> <b className="text-slate-800">{item.data.passives}</b></div>
                        <div className="flex justify-between items-center"><span className="flex items-center gap-1.5 font-medium text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-red-500"></div> Reg/Pés.</span> <b className="text-slate-800">{item.data.detractors}</b></div>
                      </div>
                      
                      {item.data.total > 0 ? (
                        <div className="w-full h-1 rounded-full overflow-hidden mt-4 flex">
                          <div style={{ width: `${(item.data.detractors / item.data.total) * 100}%` }} className="bg-red-500 h-full"></div>
                          <div style={{ width: `${(item.data.passives / item.data.total) * 100}%` }} className="bg-blue-500 h-full"></div>
                          <div style={{ width: `${(item.data.promoters / item.data.total) * 100}%` }} className="bg-emerald-500 h-full"></div>
                        </div>
                      ) : (
                        <div className="w-full h-1 rounded-full bg-slate-100 mt-4"></div>
                      )}
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= ABA PENDENTES OU CONCLUÍDAS ================= */}
      {activeTab !== 'ANALYTICS' && (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-4 pl-6">Ex-Colaborador</th>
                <th className="p-4 text-center">Setor / Unidade</th>
                <th className="p-4 text-center">Data Desligamento</th>
                <th className="p-4 text-center">Motivo (RH)</th>
                <th className="p-4 pr-6 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(activeTab === 'PENDING' ? pendingInterviews : completedInterviews).map((emp: Employee) => (
                <tr key={emp.id} className="hover:bg-rose-50/30 transition-colors">
                  <td className="p-4 pl-6">
                    <p className="font-bold text-slate-800">{emp.name}</p>
                    <p className="text-xs text-slate-500">{emp.role}</p>
                  </td>
                  <td className="p-4 text-center">
                    <p className="font-bold text-slate-600">{emp.sector}</p>
                    <p className="text-xs text-slate-400">{emp.unit || '-'}</p>
                  </td>
                  <td className="p-4 text-center font-bold text-slate-600">
                    {formatDateBR((emp as any).terminationDate)}
                  </td>
                  <td className="p-4 text-center">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider truncate max-w-[150px] inline-block">
                      {emp.terminationReason || 'Não inf.'}
                    </span>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <button 
                      onClick={() => openInterviewModal(emp)} 
                      className={`px-4 py-2 rounded-xl font-bold text-xs transition-colors shadow-sm flex items-center justify-end gap-1 ml-auto ${
                        activeTab === 'PENDING' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {activeTab === 'PENDING' ? 'Realizar Entrevista' : 'Ver Respostas'} <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {(activeTab === 'PENDING' ? pendingInterviews : completedInterviews).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                    <UserCheck size={48} className="mx-auto mb-3 opacity-20" />
                    Nenhuma entrevista {activeTab === 'PENDING' ? 'pendente' : 'concluída'} encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE ENTREVISTA DE DESLIGAMENTO */}
      {/* ======================================================== */}
      {isModalOpen && interviewingEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 rounded-t-3xl shrink-0 flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Entrevista de Desligamento</h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-slate-600 font-medium">
                  <span className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md"><UserMinus size={14}/> {interviewingEmp.name}</span>
                  <span className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md"><Briefcase size={14}/> {interviewingEmp.role} ({interviewingEmp.sector})</span>
                  <span className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md text-amber-700"><Calendar size={14}/> Adm: {formatDateBR(interviewingEmp.admissionDate)}</span>
                  <span className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-1 rounded-md text-red-700"><Calendar size={14}/> Demissão: {formatDateBR((interviewingEmp as any).terminationDate)}</span>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"><X size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar bg-white">
              {formData.reason === 'Não Aplicável (Dispensado/Demitido)' ? (
                <div className="text-center py-12">
                   <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4"><CheckSquare size={32} /></div>
                   <h3 className="text-xl font-bold text-slate-800">Entrevista Não Aplicável</h3>
                   <p className="text-slate-500 mt-2">O colaborador foi demitido ou dispensado da entrevista. Ela não conta nas métricas.</p>
                </div>
              ) : formData.didNotRespond ? (
                <div className="text-center py-12">
                   <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><X size={32} /></div>
                   <h3 className="text-xl font-bold text-slate-800">Colaborador optou por não responder</h3>
                   <p className="text-slate-500 mt-2">Esta entrevista foi arquivada sem dados coletados, mas conta como recusa no relatório.</p>
                </div>
              ) : (
                <form id="exit-form" onSubmit={(e) => handleSave(e, 'NORMAL')} className="space-y-8">
                  
                  {/* DADOS DA ENTREVISTA E MOTIVO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-rose-50/50 p-6 rounded-2xl border border-rose-100">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-rose-800 uppercase tracking-widest block">Data da Entrevista</label>
                      <input type="date" required className="w-full border border-rose-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-white font-bold" value={formData.interviewDate} onChange={e => setFormData({...formData, interviewDate: e.target.value})} />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs font-black text-rose-800 uppercase tracking-widest block">Motivo Real da Saída (Relatado por ele)</label>
                      <select 
                        required 
                        className="w-full border border-rose-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-white font-bold" 
                        value={isOtherReason ? 'Outros' : formData.reason} 
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Outros') { setIsOtherReason(true); setFormData({...formData, reason: ''}); }
                          else { setIsOtherReason(false); setFormData({...formData, reason: val}); }
                        }}
                      >
                        <option value="">-- Qual foi o principal motivo? --</option>
                        {EXIT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                        <option value="Outros">Outros (Escrever)</option>
                      </select>
                    </div>

                    {isOtherReason && (
                      <div className="space-y-2 md:col-span-2 animate-in fade-in">
                        <label className="text-xs font-black text-rose-800 uppercase tracking-widest block">Qual o motivo? (Especifique)</label>
                        <input type="text" required className="w-full border border-rose-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-white" placeholder="Escreva o motivo..." value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} />
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black text-rose-800 uppercase tracking-widest flex items-center gap-1"><FileText size={14}/> Observações sobre o Motivo</label>
                      <textarea rows={2} className="w-full border border-rose-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-rose-500 bg-white resize-none" placeholder="Detalhes adicionais sobre o desligamento..." value={formData.reasonObservation} onChange={e => setFormData({...formData, reasonObservation: e.target.value})}></textarea>
                    </div>
                  </div>

                  {/* PESQUISA DE CLIMA (RATINGS) */}
                  <div>
                    <h3 className="text-lg font-black text-slate-800 border-b border-slate-200 pb-2 mb-6 uppercase tracking-tighter">Avaliação da Experiência na Dimy</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                      <RatingSelector label="1. Relação com os Colegas de Trabalho" value={formData.colleaguesRating!} onChange={v => setFormData({...formData, colleaguesRating: v})} />
                      <RatingSelector label="2. Satisfação com o Salário" value={formData.salaryRating!} onChange={v => setFormData({...formData, salaryRating: v})} />
                      <RatingSelector label="3. Satisfação com os Benefícios" value={formData.benefitsRating!} onChange={v => setFormData({...formData, benefitsRating: v})} />
                      <RatingSelector label="4. Satisfação com a Função Exercida" value={formData.jobSatisfactionRating!} onChange={v => setFormData({...formData, jobSatisfactionRating: v})} />
                      <RatingSelector label="5. Possibilidade de Crescimento/Carreira" value={formData.growthRating!} onChange={v => setFormData({...formData, growthRating: v})} />
                    </div>
                  </div>

                  {/* AVALIAÇÃO DE LIDERANÇA E TREINAMENTO */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-100 pt-6">
                    <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-slate-700 flex items-center gap-2"><UserCheck size={18} className="text-indigo-500"/> Gestão e Liderança</h4>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Nome do Líder Direto</label>
                        <input type="text" list="employee-names" className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm" placeholder="Quem era o gestor?" value={formData.leaderName} onChange={e => setFormData({...formData, leaderName: e.target.value})} />
                      </div>
                      <RatingSelector label="Relação com o Líder" value={formData.leaderRating!} onChange={v => setFormData({...formData, leaderRating: v})} />
                    </div>

                    <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-slate-700 flex items-center gap-2"><Briefcase size={18} className="text-emerald-500"/> Treinamento Recebido</h4>
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Quem realizou o treinamento?</label>
                        <input type="text" list="employee-names" className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-sm" placeholder="Nome do instrutor/colega" value={formData.trainerName} onChange={e => setFormData({...formData, trainerName: e.target.value})} />
                      </div>
                      <RatingSelector label="Qualidade do Treinamento" value={formData.trainingRating!} onChange={v => setFormData({...formData, trainingRating: v})} />
                    </div>
                  </div>

                  {/* COMENTÁRIOS FINAIS */}
                  <div className="space-y-2 border-t border-slate-100 pt-6">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><MessageSquare size={18} className="text-slate-400"/> Observações a mais que gostaria de registrar</label>
                    <textarea rows={4} className="w-full border border-slate-300 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-slate-500 bg-white resize-none shadow-inner" placeholder="O espaço é livre para queixas, elogios, sugestões de melhoria para a empresa..." value={formData.additionalComments} onChange={e => setFormData({...formData, additionalComments: e.target.value})}></textarea>
                  </div>

                </form>
              )}
            </div>

            <div className="p-5 border-t border-slate-100 bg-slate-50 rounded-b-3xl flex flex-col sm:flex-row items-center justify-between shrink-0 gap-4">
               
               <div className="flex gap-2 w-full sm:w-auto">
                  {(!formData.didNotRespond && formData.reason !== 'Não Aplicável (Dispensado/Demitido)') && (
                     <>
                       <button type="button" onClick={(e) => handleSave(e, 'DID_NOT_RESPOND')} className="flex-1 sm:flex-none text-[10px] font-bold text-rose-600 bg-rose-100 hover:bg-rose-200 px-3 py-2 rounded-lg transition-colors">
                          Recusou Responder
                       </button>
                       <button type="button" onClick={(e) => handleSave(e, 'NOT_APPLICABLE')} className="flex-1 sm:flex-none text-[10px] font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-lg transition-colors">
                          Não Aplicável (Demitido)
                       </button>
                     </>
                  )}
               </div>

               <div className="flex gap-3 w-full sm:w-auto">
                 <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 sm:flex-none px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                 {(!formData.didNotRespond && formData.reason !== 'Não Aplicável (Dispensado/Demitido)') && (
                   <button 
                     type="submit" form="exit-form"
                     className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-50"
                     disabled={!formData.reason || !formData.colleaguesRating || !formData.leaderRating || !formData.trainingRating || !formData.growthRating || !formData.salaryRating || !formData.benefitsRating || !formData.jobSatisfactionRating}
                   >
                     {interviewingEmp.exitInterview ? 'Salvar Edição' : 'Concluir Entrevista'}
                   </button>
                 )}
               </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};