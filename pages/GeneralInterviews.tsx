import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Employee, ExperienceInterview } from '../types';
import { addDays, differenceInDays, parseISO } from 'date-fns';
import { CalendarClock, CheckSquare, BarChart, AlertCircle, X, MessageSquare, UserCheck, Filter, MapPin, Calendar, Edit2, Trash2, Download, Plus, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

export const Experiencia: React.FC = () => {
  const { employees, updateEmployee, user, settings = [] } = useData();
  
  const [activeTab, setActiveTab] = useState<'prazos' | 'relatorio' | 'historico'>('prazos');
  
  const isMaster = user?.role === 'MASTER';
  const isRecruiter = user?.role === 'RECRUITER';
  const canEdit = isMaster || isRecruiter; 

  // --- ESTADOS DE FILTRO ---
  const [filterStart, setFilterStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 3, 1).toISOString().split('T')[0]; 
  });
  const [filterEnd, setFilterEnd] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 11, 31).toISOString().split('T')[0];
  });
  const [filterSector, setFilterSector] = useState('Todos');
  const [filterUnit, setFilterUnit] = useState('Todas');

  // --- ESTADOS DO MODAL E FORMULÁRIO ---
  const [manualEntry, setManualEntry] = useState(false);
  const [interviewingEmp, setInterviewingEmp] = useState<Employee | null>(null);
  const [interviewData, setInterviewData] = useState<Partial<ExperienceInterview>>({
    period: '1º Período',
    interviewDate: new Date().toISOString().split('T')[0],
    qLeader: 0, qColleagues: 0, qTraining: 0, 
    qJobSatisfaction: 0, qCompanySatisfaction: 0, qBenefits: 0,
    qRecommend: undefined, 
    trainerName: '', comments: ''
  });

  // --- ESTADO DO DRILL DOWN (MODAL DE LISTAGEM DE QUEM VOTOU) ---
  const [drillDownTarget, setDrillDownTarget] = useState<string | null>(null);

  // --- LÓGICA DE PRAZOS (COM EXPIRAÇÃO E PROGRESSÃO ESTRITA) ---
  const probationList = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);

    return employees
      .filter(emp => emp.status === 'Ativo' && emp.contractType === 'CLT' && emp.probationType && emp.probationType !== 'Nenhum')
      .map(emp => {
        const admission = parseISO(emp.admissionDate);
        const days1 = emp.probationType === '45+45' ? 45 : 30;
        const days2 = emp.probationType === '45+45' ? 90 : 90; 

        const endPeriod1 = addDays(admission, days1);
        const endPeriod2 = addDays(admission, days2);

        const diff1 = differenceInDays(endPeriod1, today);
        const diff2 = differenceInDays(endPeriod2, today);

        let currentPeriod = '';
        let daysLeft = 0;
        let urgency = 'ok';
        
        const hasInterview1 = emp.experienceInterviews?.some(i => i.period === '1º Período');
        const hasInterview2 = emp.experienceInterviews?.some(i => i.period === '2º Período');

        // LÓGICA REVISADA: PROGRESSÃO ESTRITA (Não pula o 1º período se não foi feito)
        if (!hasInterview1) {
            // Se não fez a 1ª, a pendência dele é a 1ª. (Remove da tela se passar de 14 dias de atraso).
            if (diff1 >= -14) {
                currentPeriod = '1º Período';
                daysLeft = diff1;
            } else {
                currentPeriod = 'Expirado'; // Deixou a 1ª passar do limite e nunca fez
            }
        } else if (!hasInterview2) {
            // Se já fez a 1ª, a pendência dele agora é a 2ª.
            if (diff2 >= -14) {
                currentPeriod = '2º Período';
                daysLeft = diff2;
            } else {
                currentPeriod = 'Expirado'; // Deixou a 2ª passar do limite
            }
        } else {
            // Já fez as duas
            currentPeriod = 'Efetivado';
        }

        // Define a cor/urgência apenas para quem vai aparecer na tela
        if (currentPeriod !== 'Expirado' && currentPeriod !== 'Efetivado') {
            if (daysLeft <= 7 && daysLeft >= 0) urgency = 'warning';
            if (daysLeft < 0) urgency = 'danger';
        }

        const alreadyInterviewed = emp.experienceInterviews?.some(i => i.period === currentPeriod);

        return { ...emp, currentPeriod, daysLeft, urgency, endPeriod1, endPeriod2, alreadyInterviewed };
      })
      // Só mostra na tela quem tem pendência válida (nem expirado por mais de 14 dias, nem efetivado com tudo feito)
      .filter(emp => emp.currentPeriod !== 'Efetivado' && emp.currentPeriod !== 'Expirado' && !emp.alreadyInterviewed) 
      .sort((a, b) => a.daysLeft - b.daysLeft); 
  }, [employees]);

  // --- LÓGICA: EXTRAIR E FILTRAR ---
  const allCompletedInterviews = useMemo(() => {
    let list: any[] = [];
    employees.forEach(emp => {
      if (emp.experienceInterviews && emp.experienceInterviews.length > 0) {
        emp.experienceInterviews.forEach(interview => {
          list.push({
            ...interview,
            employeeId: emp.id, 
            employeeName: emp.name,
            employeeRole: interview.employeeRole || emp.role,
            employeeSector: interview.employeeSector || emp.sector || 'Geral',
            employeeUnit: interview.employeeUnit || emp.unit || 'Geral'
          });
        });
      }
    });

    return list.filter(inv => {
      const matchStart = !filterStart || inv.interviewDate >= filterStart;
      const matchEnd = !filterEnd || inv.interviewDate <= filterEnd;
      const matchSector = filterSector === 'Todos' || inv.employeeSector === filterSector;
      const matchUnit = filterUnit === 'Todas' || inv.employeeUnit === filterUnit;
      
      return matchStart && matchEnd && matchSector && matchUnit;
    }).sort((a, b) => new Date(b.interviewDate).getTime() - new Date(a.interviewDate).getTime());

  }, [employees, filterStart, filterEnd, filterSector, filterUnit]);

  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // --- LÓGICA DO EXPORT EXCEL ---
  const handleExportExcel = () => {
    if (allCompletedInterviews.length === 0) {
      alert('Nenhum dado encontrado para exportar com os filtros atuais.');
      return;
    }

    const formatDataForExcel = (data: any[]) => data.map(inv => ({
      'Nome': inv.employeeName,
      'Data Entrevista': formatDateToBR(inv.interviewDate),
      'Período': inv.period,
      'Setor': inv.employeeSector,
      'Unidade': inv.employeeUnit,
      'Cargo': inv.employeeRole,
      'Indicação DIMY (eNPS)': inv.qRecommend !== undefined ? inv.qRecommend : 'Não respondeu',
      'Nota: Liderança': inv.qLeader,
      'Nota: Equipe': inv.qColleagues,
      'Nota: Treinamento': inv.qTraining,
      'Nota: Função': inv.qJobSatisfaction,
      'Nota: Empresa': inv.qCompanySatisfaction,
      'Nota: Benefícios': inv.qBenefits,
      'Treinador Responsável': inv.trainerName,
      'Comentários / Sugestões': inv.comments,
      'Aplicado por': inv.interviewerName
    }));

    const workbook = XLSX.utils.book_new();
    const geralData = formatDataForExcel(allCompletedInterviews);
    const worksheetGeral = XLSX.utils.json_to_sheet(geralData);
    XLSX.utils.book_append_sheet(workbook, worksheetGeral, "Geral");

    const uniqueSectors = Array.from(new Set(allCompletedInterviews.map(inv => inv.employeeSector)));

    uniqueSectors.forEach(sector => {
      const sectorInterviews = allCompletedInterviews.filter(inv => inv.employeeSector === sector);
      if (sectorInterviews.length > 0) {
        const sectorData = formatDataForExcel(sectorInterviews);
        const worksheetSector = XLSX.utils.json_to_sheet(sectorData);
        const safeSheetName = sector.replace(/[\\/?*[\]:]/g, '').substring(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheetSector, safeSheetName);
      }
    });

    const fileName = `Relatorio_Experiencia_${filterStart}_a_${filterEnd}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // --- LÓGICA DO eNPS VERDADEIRO (Baseado na Pergunta de Indicação) ---
  const trueEnpsData = useMemo(() => {
    const answeredInterviews = allCompletedInterviews.filter(inv => inv.qRecommend !== undefined && inv.qRecommend !== null);
    if (answeredInterviews.length === 0) return { promoters: 0, passives: 0, detractors: 0, score: 0, total: 0 };
    
    const total = answeredInterviews.length;
    const promoters = answeredInterviews.filter(inv => inv.qRecommend >= 9).length; 
    const passives = answeredInterviews.filter(inv => inv.qRecommend === 7 || inv.qRecommend === 8).length; 
    const detractors = answeredInterviews.filter(inv => inv.qRecommend <= 6).length; 
    
    const pctPromotores = (promoters / total) * 100;
    const pctDetratores = (detractors / total) * 100;
    const score = Math.round(pctPromotores - pctDetratores);
    
    return { promoters, passives, detractors, score, total };
  }, [allCompletedInterviews]);

  // Lógica das perguntas de satisfação (1 a 4)
  const analytics = useMemo(() => {
    const calculateSatisfaction = (scoreArray: number[]) => {
      if (scoreArray.length === 0) return { promoters: 0, passives: 0, detractors: 0, score: 0, total: 0 };
      const total = scoreArray.length;
      const promoters = scoreArray.filter(s => s === 4).length;
      const passives = scoreArray.filter(s => s === 3).length;
      const detractors = scoreArray.filter(s => s <= 2).length;
      const pctPromotores = (promoters / total) * 100;
      const pctDetratores = (detractors / total) * 100;
      return { promoters, passives, detractors, score: Math.round(pctPromotores - pctDetratores), total };
    };

    return {
      leader: calculateSatisfaction(allCompletedInterviews.map(i => i.qLeader)),
      colleagues: calculateSatisfaction(allCompletedInterviews.map(i => i.qColleagues)),
      training: calculateSatisfaction(allCompletedInterviews.map(i => i.qTraining)),
      job: calculateSatisfaction(allCompletedInterviews.map(i => i.qJobSatisfaction)),
      company: calculateSatisfaction(allCompletedInterviews.map(i => i.qCompanySatisfaction)),
      benefits: calculateSatisfaction(allCompletedInterviews.map(i => i.qBenefits)),
    };
  }, [allCompletedInterviews]);

  // --- HANDLERS (SALVAR, EDITAR, EXCLUIR) ---
  const handleSaveInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewingEmp) return;

    const isEditing = !!interviewData.id;

    const savedInterview: ExperienceInterview = {
      id: interviewData.id || crypto.randomUUID(),
      interviewDate: interviewData.interviewDate || new Date().toISOString().split('T')[0],
      period: interviewData.period as any,
      
      employeeRole: interviewData.employeeRole || interviewingEmp.role,
      employeeSector: interviewData.employeeSector || interviewingEmp.sector,
      employeeUnit: interviewData.employeeUnit || interviewingEmp.unit || '',

      qRecommend: interviewData.qRecommend, 
      qLeader: interviewData.qLeader!,
      qColleagues: interviewData.qColleagues!,
      qTraining: interviewData.qTraining!,
      qJobSatisfaction: interviewData.qJobSatisfaction!,
      qCompanySatisfaction: interviewData.qCompanySatisfaction!,
      qBenefits: interviewData.qBenefits!,
      trainerName: interviewData.trainerName || 'Não informado',
      comments: interviewData.comments || '',
      interviewerName: interviewData.interviewerName || user?.name || 'Sistema'
    };

    let updatedInterviews;
    if (isEditing) {
      updatedInterviews = (interviewingEmp.experienceInterviews || []).map(inv => 
        inv.id === savedInterview.id ? savedInterview : inv
      );
    } else {
      updatedInterviews = [...(interviewingEmp.experienceInterviews || []), savedInterview];
    }

    const updatedEmp = {
      ...interviewingEmp,
      experienceInterviews: updatedInterviews
    };

    await updateEmployee(updatedEmp);
    setInterviewingEmp(null);
    setManualEntry(false);
    alert(`Entrevista ${isEditing ? 'atualizada' : 'salva'} com sucesso!`);
  };

  const handleEditInterview = (interviewWithMeta: any) => {
    const emp = employees.find(e => e.id === interviewWithMeta.employeeId);
    if (!emp) return;
    
    setManualEntry(false);
    setInterviewingEmp(emp);
    setInterviewData(interviewWithMeta); 
  };

  const handleDeleteInterview = async (employeeId: string, interviewId: string) => {
    if (!window.confirm('TEM CERTEZA? Isso excluirá essa entrevista do histórico e recalculará o eNPS.')) return;
    
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const updatedInterviews = (emp.experienceInterviews || []).filter(inv => inv.id !== interviewId);
    
    const updatedEmp = {
      ...emp,
      experienceInterviews: updatedInterviews
    };

    await updateEmployee(updatedEmp);
  };

  // Redireciona o usuário para a aba de Histórico e abre a edição de quem ele clicou no Drill Down
  const handleJumpToInterview = (interview: any) => {
    setDrillDownTarget(null);
    setActiveTab('historico');
    handleEditInterview(interview);
  };

  // --- HELPERS VISUAIS ---
  const getScoreColor = (score: number) => {
    if (score >= 50) return 'text-emerald-600'; 
    if (score > 0) return 'text-blue-500'; 
    return 'text-red-500'; 
  };

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

  const CompactScore = ({ label, score }: { label: string, score: number }) => {
    let colorClass = 'bg-slate-100 text-slate-400';
    if(score === 4) colorClass = 'bg-emerald-100 text-emerald-700';
    if(score === 3) colorClass = 'bg-blue-100 text-blue-700';
    if(score === 2) colorClass = 'bg-orange-100 text-orange-700';
    if(score === 1) colorClass = 'bg-red-100 text-red-700';

    return (
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 last:border-0 py-1">
        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</span>
        <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black ${colorClass}`}>
          {score || '-'}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
            <CalendarClock size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Acompanhamento de Experiência</h1>
            <p className="text-slate-500 text-sm">Gestão de prazos e Entrevistas de Check-in</p>
          </div>
        </div>

        {/* BOTÃO DE REGISTRO RETROATIVO */}
        {canEdit && (
          <button 
            onClick={() => {
              setManualEntry(true);
              setInterviewingEmp(null);
              setInterviewData({
                period: '1º Período',
                interviewDate: new Date().toISOString().split('T')[0],
                qLeader: 0, qColleagues: 0, qTraining: 0, 
                qJobSatisfaction: 0, qCompanySatisfaction: 0, qBenefits: 0,
                qRecommend: undefined,
                trainerName: '', comments: ''
              });
            }}
            className="flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-5 py-2.5 rounded-xl font-bold transition-colors border border-indigo-200"
          >
            <Plus size={18} />
            Registro Retroativo
          </button>
        )}
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('prazos')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'prazos' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <CalendarClock size={18} /><span>Prazos Ativos</span>
        </button>
        <button onClick={() => setActiveTab('relatorio')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'relatorio' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <BarChart size={18} /><span>Termômetro eNPS</span>
        </button>
        <button onClick={() => setActiveTab('historico')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'historico' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <MessageSquare size={18} /><span>Respostas Individuais</span>
        </button>
      </div>

      {/* FILTROS GLOBAIS COM BOTÃO DE EXPORTAR EXCEL */}
      {(activeTab === 'relatorio' || activeTab === 'historico') && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <span className="text-slate-400 text-sm">até</span>
              <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="border border-slate-200 rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
              <Filter size={16} className="text-slate-400" />
              <select value={filterSector} onChange={e => setFilterSector(e.target.value)} className="bg-transparent py-2 text-sm outline-none cursor-pointer min-w-[120px]">
                <option value="Todos">Todos os Setores</option>
                {settings.filter((s:any) => s.type === 'SECTOR').map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
              <MapPin size={16} className="text-slate-400" />
              <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="bg-transparent py-2 text-sm outline-none cursor-pointer min-w-[120px]">
                <option value="Todas">Todas as Unidades</option>
                {settings.filter((s:any) => s.type === 'UNIT').map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <button onClick={handleExportExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition-colors active:scale-95">
            <Download size={16} />
            Baixar Relatório (Excel)
          </button>

        </div>
      )}

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
                        <span className="flex items-center justify-center gap-1 text-red-600 font-bold text-sm">
                           <AlertCircle size={16} /> Vencido há {Math.abs(emp.daysLeft)} dias
                        </span>
                      ) : emp.daysLeft <= 7 ? (
                        <span className="flex items-center justify-center gap-1 text-amber-600 font-bold text-sm animate-pulse">
                           <AlertCircle size={16} /> Faltam {emp.daysLeft} dias
                        </span>
                      ) : (
                        <span className="text-slate-600 font-medium text-sm">Faltam {emp.daysLeft} dias</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {emp.alreadyInterviewed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg"><CheckSquare size={14} /> Avaliado</span>
                      ) : canEdit ? (
                        <button 
                          onClick={() => { 
                            setManualEntry(false);
                            setInterviewingEmp(emp as Employee); 
                            setInterviewData({ 
                              period: emp.currentPeriod as any,
                              interviewDate: new Date().toISOString().split('T')[0],
                              qRecommend: undefined
                            }); 
                          }}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
                        >
                          Avaliar Agora
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Aguardando RH</span>
                      )}
                    </td>
                  </tr>
                ))}
                {probationList.length === 0 && (
                  <tr><td colSpan={5} className="p-12 text-center text-slate-400">Excelente! Nenhum colaborador pendente de experiência no momento.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ABA: TERMÔMETRO eNPS */}
      {activeTab === 'relatorio' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* CARD DE eNPS VERDADEIRO */}
          <div className="bg-indigo-900 rounded-3xl p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 p-16 opacity-10">
              <BarChart size={150} />
            </div>
            <div className="z-10 max-w-2xl">
              <h2 className="text-3xl font-black mb-2">Termômetro de Cultura (eNPS)</h2>
              <p className="text-indigo-200 font-medium">"Qual a chance de você indicar a empresa para um amigo trabalhar?"</p>
              <div className="flex flex-wrap gap-4 mt-6 text-sm font-bold">
                 <div className="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-lg"><span className="text-emerald-400">{trueEnpsData.promoters}</span> Promotores (9-10)</div>
                 <div className="bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 rounded-lg"><span className="text-blue-400">{trueEnpsData.passives}</span> Neutros (7-8)</div>
                 <div className="bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-lg"><span className="text-red-400">{trueEnpsData.detractors}</span> Detratores (0-6)</div>
              </div>
            </div>
            <div className="bg-indigo-800 p-6 rounded-2xl border border-indigo-700 text-center min-w-[200px] z-10 shadow-inner">
              <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1">SCORE GLOBAL</p>
              <p className={`text-6xl font-black ${trueEnpsData.score > 0 ? 'text-emerald-400' : trueEnpsData.score < 0 ? 'text-red-400' : 'text-white'}`}>
                {trueEnpsData.total > 0 ? trueEnpsData.score : '-'}
              </p>
              <p className="text-[10px] text-indigo-400 mt-2">{trueEnpsData.total} respostas filtradas</p>
            </div>
          </div>

          <h3 className="font-black text-slate-700 uppercase tracking-widest text-sm pt-4 border-t border-slate-200">Índices de Acolhimento e Estrutura</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { id: 'qLeader', title: 'Acolhimento da Liderança', data: analytics.leader },
              { id: 'qColleagues', title: 'Acolhimento da Equipe', data: analytics.colleagues },
              { id: 'qTraining', title: 'Qualidade do Treinamento', data: analytics.training },
              { id: 'qJobSatisfaction', title: 'Satisfação com a Função', data: analytics.job },
              { id: 'qCompanySatisfaction', title: 'Satisfação com a Empresa', data: analytics.company },
              { id: 'qBenefits', title: 'Satisfação com Benefícios', data: analytics.benefits },
            ].map((item, i) => (
              <div 
                key={i} 
                onClick={() => setDrillDownTarget(item.id)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-slate-700 mb-4 h-10 line-clamp-2 leading-tight group-hover:text-indigo-600 transition-colors">{item.title}</h3>
                    <ChevronRight className="text-slate-300 group-hover:text-indigo-500 transition-colors mt-1" size={20}/>
                </div>
                
                <div className="flex items-end gap-3 mb-6 border-b border-slate-100 pb-4">
                  <div className={`text-4xl font-black tracking-tighter ${getScoreColor(item.data.score)}`}>{item.data.total > 0 ? item.data.score : '-'}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase pb-1.5 tracking-widest">NPS Interno</div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Promotores (4)</span> <b className="text-slate-800">{item.data.promoters}</b></div>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Passivos (3)</span> <b className="text-slate-800">{item.data.passives}</b></div>
                  <div className="flex justify-between items-center"><span className="flex items-center gap-2 font-medium text-slate-600"><div className="w-2 h-2 rounded-full bg-red-500"></div> Detratores (1 ou 2)</span> <b className="text-slate-800">{item.data.detractors}</b></div>
                </div>
                
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

      {/* ABA: RESPOSTAS INDIVIDUAIS */}
      {activeTab === 'historico' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Legenda de Notas */}
          {allCompletedInterviews.length > 0 && (
            <div className="flex items-center justify-end gap-4 text-[10px] font-bold text-slate-500 uppercase">
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div> 4 - Ótimo</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div> 3 - Bom</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div> 2 - Ruim</span>
              <span className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div> 1 - Péssimo</span>
            </div>
          )}

          {allCompletedInterviews.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
              Nenhuma entrevista encontrada para os filtros selecionados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCompletedInterviews.map((interview, index) => (
                <div key={index} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow relative group flex flex-col">
                  
                  {canEdit && (
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditInterview(interview)} className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"><Edit2 size={12} /></button>
                      <button onClick={() => handleDeleteInterview(interview.employeeId, interview.id)} className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={12} /></button>
                    </div>
                  )}

                  <div className="flex flex-col mb-4 pr-12">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="bg-indigo-50 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                        {interview.period}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">{formatDateToBR(interview.interviewDate)}</span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 truncate">{interview.employeeName}</h3>
                    <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                      {interview.employeeRole} • {interview.employeeSector} {interview.employeeUnit !== 'Geral' ? `• ${interview.employeeUnit}` : ''}
                    </p>
                  </div>

                  {/* Mostra se ele indicaria a empresa (eNPS Oficial) */}
                  <div className="mb-4 bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between">
                     <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest leading-tight">Chance de Indicação<br/>(0 a 10)</span>
                     <span className={`text-xl font-black ${interview.qRecommend >= 9 ? 'text-emerald-600' : interview.qRecommend >= 7 ? 'text-blue-600' : interview.qRecommend !== undefined ? 'text-red-600' : 'text-slate-400 text-xs'}`}>
                        {interview.qRecommend !== undefined ? interview.qRecommend : 'N/R'}
                     </span>
                  </div>

                  {/* Notas Super Compactas */}
                  <div className="grid grid-cols-2 gap-x-4 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <CompactScore label="Liderança" score={interview.qLeader} />
                    <CompactScore label="Equipe" score={interview.qColleagues} />
                    <CompactScore label="Treinamento" score={interview.qTraining} />
                    <CompactScore label="Função" score={interview.qJobSatisfaction} />
                    <CompactScore label="Empresa" score={interview.qCompanySatisfaction} />
                    <CompactScore label="Benefícios" score={interview.qBenefits} />
                  </div>

                  <div className="flex-1 flex flex-col gap-3">
                    <div className="flex items-start gap-2">
                      <UserCheck size={14} className="text-slate-400 mt-0.5 shrink-0"/>
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Treinador</p>
                        <p className="text-xs font-semibold text-slate-700 mt-1">{interview.trainerName}</p>
                      </div>
                    </div>
                    
                    {interview.comments && (
                      <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-100/50 text-xs text-slate-700 italic flex-1">
                        "{interview.comments}"
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 text-right">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                      Por: <span className="text-slate-600">{interview.interviewerName}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL DO FORMULÁRIO DE ENTREVISTA (Automático, Edição e Retroativo) */}
      {(interviewingEmp || manualEntry) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[200] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
            
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50 rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {interviewData.id ? 'Editar Entrevista' : manualEntry ? 'Registro Retroativo' : `Entrevista de ${interviewData.period}`}
                </h2>
                {interviewingEmp ? (
                  <p className="text-sm text-slate-500 mt-1">{interviewingEmp.name} • Adm: {parseISO(interviewingEmp.admissionDate).toLocaleDateString('pt-BR')}</p>
                ) : (
                  <p className="text-sm text-slate-500 mt-1">Preencha os dados abaixo para inserir uma avaliação antiga.</p>
                )}
              </div>
              <button onClick={() => { setInterviewingEmp(null); setInterviewData({}); setManualEntry(false); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"><X size={20} /></button>
            </div>

            <form id="interview-form" onSubmit={handleSaveInterview} className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
              
              {/* BLOCO DE DADOS CADASTRAIS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 border-b border-slate-100">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Data da Entrevista</label>
                  <input type="date" required className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={interviewData.interviewDate || ''} onChange={e => setInterviewData({...interviewData, interviewDate: e.target.value})} />
                </div>
                
                {manualEntry && !interviewData.id && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Colaborador</label>
                      <select 
                        required 
                        className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={interviewingEmp?.id || ''} 
                        onChange={e => {
                          const emp = employees.find((x: Employee) => x.id === e.target.value);
                          setInterviewingEmp(emp || null);
                        }}
                      >
                        <option value="">Selecione...</option>
                        {employees.map((emp: Employee) => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700">Período</label>
                      <select 
                        required 
                        className="w-full border border-slate-300 p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={interviewData.period} 
                        onChange={e => setInterviewData({...interviewData, period: e.target.value as any})}
                      >
                        <option value="1º Período">1º Período</option>
                        <option value="2º Período">2º Período</option>
                        <option value="Desligamento">Desligamento</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* A PERGUNTA DE eNPS (OFICIAL) */}
              <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl shadow-sm text-center">
                 <h3 className="font-black text-indigo-900 text-lg mb-2">A Pergunta Definitiva (eNPS Oficial)</h3>
                 <p className="text-sm text-indigo-700 mb-6">"Numa escala de 0 a 10, qual a probabilidade de você recomendar a empresa como um bom lugar para trabalhar para um amigo ou conhecido?"</p>
                 
                 <div className="flex flex-wrap justify-center gap-2 mb-4">
                    {[0,1,2,3,4,5,6,7,8,9,10].map(num => (
                        <button 
                          key={num} 
                          type="button"
                          onClick={() => setInterviewData({...interviewData, qRecommend: num})}
                          className={`w-10 h-10 rounded-xl font-black text-lg transition-transform ${
                              interviewData.qRecommend === num 
                                ? (num >= 9 ? 'bg-emerald-500 text-white scale-110 shadow-lg' : num >= 7 ? 'bg-blue-500 text-white scale-110 shadow-lg' : 'bg-red-500 text-white scale-110 shadow-lg') 
                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                    ))}
                 </div>
                 <button 
                    type="button" 
                    onClick={() => setInterviewData({...interviewData, qRecommend: undefined})}
                    className={`text-xs font-bold px-4 py-2 rounded-lg transition-colors ${interviewData.qRecommend === undefined ? 'bg-slate-800 text-white' : 'text-slate-500 bg-slate-200 hover:bg-slate-300'}`}
                 >
                    Não Respondeu / Recusou-se
                 </button>
              </div>

              {/* PREENCHIMENTO DOS PILARES ESTRUTURAIS */}
              <div>
                <h3 className="font-bold text-slate-800 mb-4 border-b pb-2">Índices de Estrutura Interna (1 a 4)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                  <ScoreSelector label="1. Acolhimento da Liderança" value={interviewData.qLeader || 0} onChange={v => setInterviewData({...interviewData, qLeader: v})} />
                  <ScoreSelector label="2. Acolhimento dos Colegas" value={interviewData.qColleagues || 0} onChange={v => setInterviewData({...interviewData, qColleagues: v})} />
                  <ScoreSelector label="3. Qualidade do Treinamento" value={interviewData.qTraining || 0} onChange={v => setInterviewData({...interviewData, qTraining: v})} />
                  <ScoreSelector label="4. Satisfação com a Função" value={interviewData.qJobSatisfaction || 0} onChange={v => setInterviewData({...interviewData, qJobSatisfaction: v})} />
                  <ScoreSelector label="5. Satisfação com a Empresa" value={interviewData.qCompanySatisfaction || 0} onChange={v => setInterviewData({...interviewData, qCompanySatisfaction: v})} />
                  <ScoreSelector label="6. Satisfação com Benefícios" value={interviewData.qBenefits || 0} onChange={v => setInterviewData({...interviewData, qBenefits: v})} />
                </div>
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

            <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => { setInterviewingEmp(null); setInterviewData({}); setManualEntry(false); }} className="px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
              <button 
                type="submit" 
                form="interview-form"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={!interviewingEmp || !interviewData.qLeader || !interviewData.qColleagues || !interviewData.qTraining || !interviewData.qJobSatisfaction || !interviewData.qCompanySatisfaction || !interviewData.qBenefits}
              >
                {interviewData.id ? 'Salvar Alterações' : 'Registrar Avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================= MODAL DRILL DOWN DE NOTAS ======================= */}
      {drillDownTarget && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh]">
               <div className="p-6 border-b border-slate-100 bg-slate-50 rounded-t-3xl flex justify-between items-center shrink-0">
                  <div>
                     <h3 className="font-black text-slate-800 uppercase tracking-tighter text-lg flex items-center gap-2">
                        <BarChart className="text-indigo-600"/> Detalhamento de Notas
                     </h3>
                     <p className="text-xs text-slate-500 font-bold mt-1">Avaliando o pilar: <span className="text-indigo-600 uppercase tracking-widest">{
                        drillDownTarget === 'qLeader' ? 'Acolhimento da Liderança' :
                        drillDownTarget === 'qColleagues' ? 'Acolhimento da Equipe' :
                        drillDownTarget === 'qTraining' ? 'Qualidade do Treinamento' :
                        drillDownTarget === 'qJobSatisfaction' ? 'Satisfação com a Função' :
                        drillDownTarget === 'qCompanySatisfaction' ? 'Satisfação com a Empresa' :
                        'Satisfação com Benefícios'
                     }</span></p>
                  </div>
                  <button onClick={() => setDrillDownTarget(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-indigo-600 transition-colors"><X size={24} /></button>
               </div>

               <div className="p-0 overflow-y-auto custom-scrollbar bg-slate-50">
                  
                  {/* AGRUPAMENTO: DETRATORES (RUIM/PÉSSIMO) */}
                  <div className="p-4">
                     <h4 className="font-black text-red-600 uppercase tracking-widest text-[10px] mb-3 border-b border-red-200 pb-1">Detratores (Ruim ou Péssimo)</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {allCompletedInterviews.filter(i => i[drillDownTarget] <= 2).map((inv, idx) => (
                           <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-red-100 flex items-center justify-between hover:border-red-300 transition-colors">
                              <div>
                                 <p className="font-bold text-slate-800 text-sm">{inv.employeeName}</p>
                                 <p className="text-[10px] text-slate-500">{inv.employeeSector}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 font-black flex items-center justify-center">{inv[drillDownTarget]}</div>
                                 <button onClick={() => handleJumpToInterview(inv)} className="text-indigo-600 hover:underline text-[10px] font-bold">Ver Tudo</button>
                              </div>
                           </div>
                        ))}
                        {allCompletedInterviews.filter(i => i[drillDownTarget] <= 2).length === 0 && <p className="text-xs text-slate-400 italic">Nenhum detrator neste período.</p>}
                     </div>
                  </div>

                  {/* AGRUPAMENTO: PASSIVOS (BOM) */}
                  <div className="p-4">
                     <h4 className="font-black text-blue-600 uppercase tracking-widest text-[10px] mb-3 border-b border-blue-200 pb-1">Passivos (Nota: Bom)</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {allCompletedInterviews.filter(i => i[drillDownTarget] === 3).map((inv, idx) => (
                           <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:border-blue-300 transition-colors flex items-center justify-between">
                              <div>
                                 <p className="font-bold text-slate-800 text-sm">{inv.employeeName}</p>
                                 <p className="text-[10px] text-slate-500">{inv.employeeSector}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-black flex items-center justify-center">{inv[drillDownTarget]}</div>
                                 <button onClick={() => handleJumpToInterview(inv)} className="text-indigo-600 hover:underline text-[10px] font-bold">Ver Tudo</button>
                              </div>
                           </div>
                        ))}
                        {allCompletedInterviews.filter(i => i[drillDownTarget] === 3).length === 0 && <p className="text-xs text-slate-400 italic">Nenhum voto "Bom" neste período.</p>}
                     </div>
                  </div>

                  {/* AGRUPAMENTO: PROMOTORES (ÓTIMO) */}
                  <div className="p-4">
                     <h4 className="font-black text-emerald-600 uppercase tracking-widest text-[10px] mb-3 border-b border-emerald-200 pb-1">Promotores (Nota: Ótimo)</h4>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {allCompletedInterviews.filter(i => i[drillDownTarget] === 4).map((inv, idx) => (
                           <div key={idx} className="bg-white p-3 rounded-xl shadow-sm border border-emerald-100 flex items-center justify-between hover:border-emerald-300 transition-colors">
                              <div>
                                 <p className="font-bold text-slate-800 text-sm">{inv.employeeName}</p>
                                 <p className="text-[10px] text-slate-500">{inv.employeeSector}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 font-black flex items-center justify-center">{inv[drillDownTarget]}</div>
                                 <button onClick={() => handleJumpToInterview(inv)} className="text-indigo-600 hover:underline text-[10px] font-bold">Ver Tudo</button>
                              </div>
                           </div>
                        ))}
                        {allCompletedInterviews.filter(i => i[drillDownTarget] === 4).length === 0 && <p className="text-xs text-slate-400 italic">Nenhum voto "Ótimo" neste período.</p>}
                     </div>
                  </div>

               </div>
            </div>
         </div>
      )}
    </div>
  );
};