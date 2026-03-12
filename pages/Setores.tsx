import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Employee, AbsenceRecord, Job } from '../types';
import { 
  Building2, Users, UserMinus, CalendarX, ArrowLeft, 
  Search, Clock, ChevronDown, ChevronUp, Activity, 
  Briefcase, AlertTriangle, Target, CheckCircle2, PauseCircle, Contact
} from 'lucide-react';

export const Setores: React.FC = () => {
  const { employees = [], absences = [], settings = [], jobs = [] } = useData() as any;

  // Controle de Navegação: null = Lista de Setores | string = Nome do Setor Aberto
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  // Aba Ativa dentro do Setor (Agora com TEAM)
  const [activeDetail, setActiveDetail] = useState<'ABSENCES' | 'TURNOVER' | 'JOBS' | 'TEAM'>('ABSENCES');

  // Filtros de Data
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  const [expandedEmp, setExpandedEmp] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // --- EXTRATOR DE DATAS SEGURO ---
  const formatToYMD = (dateVal: any) => {
    if (!dateVal) return '';
    let str = String(dateVal).trim();
    if (/^\d{4,5}$/.test(str)) {
      const jsDate = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
      return jsDate.toISOString().split('T')[0];
    }
    str = str.split('T')[0].split(' ')[0];
    const corruptMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (corruptMatch) return `${corruptMatch[3]}-${corruptMatch[2]}-${corruptMatch[1].substring(2)}`;
    
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        else if (parts[2].length === 4) { 
            let m = Number(parts[1]);
            if (m > 12) return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            else return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        } else if (parts[2].length === 2) { 
            let y = Number(parts[2]) > 50 ? 1900 + Number(parts[2]) : 2000 + Number(parts[2]);
            return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return str; 
  };

  const formatDateToBR = (dateStr: string) => {
    const ymd = formatToYMD(dateStr);
    if (!ymd || ymd.length < 10) return dateStr;
    const [year, month, day] = ymd.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatHours = (decimalHours: number) => {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (h === 0 && m === 0) return `0h`;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // --- LÓGICA DA VISÃO PRINCIPAL (LISTA DE SETORES) ---
  const sectorsSummary = useMemo(() => {
    const sectors = settings.filter((s: any) => s.type === 'SECTOR').map((s: any) => s.name);
    
    employees.forEach((emp: Employee) => {
      if (emp.sector && !sectors.includes(emp.sector)) {
        sectors.push(emp.sector);
      }
    });

    const uniqueSectors = Array.from(new Set(sectors)).sort();

    return uniqueSectors.map(sectorName => {
      const empsInSector = employees.filter((e: Employee) => e.sector === sectorName);
      return {
        name: sectorName as string,
        total: empsInSector.length,
        ativos: empsInSector.filter((e: Employee) => e.status === 'Ativo').length,
        afastados: empsInSector.filter((e: Employee) => e.status === 'Afastado').length,
        inativos: empsInSector.filter((e: Employee) => e.status === 'Inativo').length,
      };
    });
  }, [employees, settings]);

  const filteredSectorsSummary = sectorsSummary.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- LÓGICA DA VISÃO DETALHADA (ABSENTEÍSMO, TURNOVER, VAGAS E QUADRO) ---
  const { absDetails, turnoverDetails, jobsDetails, sectorEmps } = useMemo(() => {
    if (!selectedSector) return { absDetails: null, turnoverDetails: [], jobsDetails: null, sectorEmps: [] };

    const emps = employees.filter((e: Employee) => e.sector === selectedSector);
    
    // 1. ABSENTEÍSMO
    const periodAbsences = absences.filter((a: AbsenceRecord) => {
      const emp = emps.find((e: Employee) => e.name.toLowerCase() === a.employeeName?.toLowerCase());
      if (!emp) return false;
      const safeDate = formatToYMD(a.absenceDate);
      if (!safeDate) return false;
      return safeDate >= startDate && safeDate <= endDate;
    });

    let totalLostHours = 0;
    const absByEmployee: Record<string, { emp: Employee, totalHours: number, records: any[] }> = {};

    periodAbsences.forEach((record: AbsenceRecord) => {
      const emp = emps.find((e: Employee) => e.name.toLowerCase() === record.employeeName?.toLowerCase())!;
      const workload = emp.dailyWorkload || 8.8;

      let amount = record.durationAmount || 0;
      let unit = record.durationUnit;
      if (!unit && record.documentDuration) {
        const match = record.documentDuration.match(/(\d+(?:\.\d+)?)\s*(dia|hora)/i);
        if (match) {
          amount = parseFloat(match[1]);
          unit = match[2].toLowerCase().startsWith('dia') ? 'Dias' : 'Horas';
        } else { unit = 'Dias'; amount = 1; }
      }

      let hours = unit === 'Dias' ? amount * workload : amount;
      totalLostHours += hours;

      if (!absByEmployee[emp.name]) absByEmployee[emp.name] = { emp, totalHours: 0, records: [] };
      absByEmployee[emp.name].totalHours += hours;
      absByEmployee[emp.name].records.push({
        ...record,
        calculatedHours: hours,
        displayDuration: unit === 'Dias' ? `${amount} Dia(s)` : `${formatHours(amount)}`
      });
    });

    // 2. TURNOVER (Desligamentos no Período)
    const turnover = emps.filter((e: any) => {
      if (e.status !== 'Inativo' || !e.terminationDate) return false;
      const tDate = formatToYMD(e.terminationDate);
      return tDate >= startDate && tDate <= endDate;
    }).sort((a: any, b: any) => new Date(b.terminationDate).getTime() - new Date(a.terminationDate).getTime());

    // 3. VAGAS (Recrutamento)
    const sJobs = jobs.filter((j: Job) => j.sector === selectedSector);
    
    const abertas = sJobs.filter((j: Job) => j.status === 'Aberta'); // Abertas atualmente
    
    const fechadas = sJobs.filter((j: Job) => {
      if (j.status !== 'Fechada' || !j.closedAt) return false;
      const cDate = formatToYMD(j.closedAt);
      return cDate >= startDate && cDate <= endDate;
    });

    const canceladas = sJobs.filter((j: Job) => {
      if (!['Congelada', 'Cancelada'].includes(j.status)) return false;
      let eventDate = j.closedAt ? formatToYMD(j.closedAt) : null;
      if (!eventDate && j.freezeHistory && j.freezeHistory.length > 0) {
         eventDate = formatToYMD(j.freezeHistory[j.freezeHistory.length - 1].startDate);
      }
      if (!eventDate) eventDate = formatToYMD(j.openedAt);
      return eventDate >= startDate && eventDate <= endDate;
    });

    return {
      sectorEmps: emps,
      absDetails: {
        totalLostHours,
        absentEmployees: Object.values(absByEmployee).sort((a, b) => b.totalHours - a.totalHours)
      },
      turnoverDetails: turnover,
      jobsDetails: { abertas, fechadas, canceladas }
    };
  }, [selectedSector, employees, absences, jobs, startDate, endDate]);


  // ============================================================================
  // RENDERIZAÇÃO DA VISÃO DETALHADA DO SETOR
  // ============================================================================
  if (selectedSector && absDetails && jobsDetails) {
    
    const turnoverVoluntario = turnoverDetails.filter((e: any) => e.terminationReason?.toLowerCase().includes('pedido')).length;
    const turnoverInvoluntario = turnoverDetails.length - turnoverVoluntario;

    // Organizar Quadro de Pessoal por Status
    const teamAtivos = sectorEmps.filter((e: Employee) => e.status === 'Ativo').sort((a: Employee, b: Employee) => a.name.localeCompare(b.name));
    const teamAfastados = sectorEmps.filter((e: Employee) => e.status === 'Afastado').sort((a: Employee, b: Employee) => a.name.localeCompare(b.name));

    return (
      <div className="space-y-6 pb-12 animate-in slide-in-from-right-4 duration-300">
        
        {/* HEADER DETALHES */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setSelectedSector(null); setActiveDetail('ABSENCES'); }} 
              className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <Building2 className="text-indigo-600" /> {selectedSector}
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1">Análise de Dados do Setor • {sectorEmps.length} Alocados</p>
            </div>
          </div>

          {activeDetail !== 'TEAM' && (
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer" />
              <span className="text-slate-300">até</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer" />
            </div>
          )}
        </div>

        {/* CARDS DE NAVEGAÇÃO INTERNA (MACRO) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div 
            onClick={() => setActiveDetail('TEAM')}
            className={`p-6 rounded-3xl cursor-pointer transition-all border ${activeDetail === 'TEAM' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl ${activeDetail === 'TEAM' ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}><Contact size={24}/></div>
              <p className={`font-bold uppercase tracking-widest text-xs ${activeDetail === 'TEAM' ? 'text-indigo-200' : 'text-slate-400'}`}>Quadro de Pessoal</p>
            </div>
            <p className="text-4xl font-black">{teamAtivos.length + teamAfastados.length}</p>
            <p className={`text-xs mt-2 ${activeDetail === 'TEAM' ? 'text-indigo-100' : 'text-slate-500'}`}>{teamAtivos.length} Ativos • {teamAfastados.length} Afastados</p>
          </div>

          <div 
            onClick={() => setActiveDetail('ABSENCES')}
            className={`p-6 rounded-3xl cursor-pointer transition-all border ${activeDetail === 'ABSENCES' ? 'bg-red-600 text-white shadow-lg shadow-red-200 border-red-600' : 'bg-white text-slate-700 border-slate-200 hover:border-red-300'}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl ${activeDetail === 'ABSENCES' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600'}`}><CalendarX size={24}/></div>
              <p className={`font-bold uppercase tracking-widest text-xs ${activeDetail === 'ABSENCES' ? 'text-red-200' : 'text-slate-400'}`}>Absenteísmo</p>
            </div>
            <p className="text-4xl font-black">{formatHours(absDetails.totalLostHours)}</p>
            <p className={`text-xs mt-2 ${activeDetail === 'ABSENCES' ? 'text-red-100' : 'text-slate-500'}`}>{absDetails.absentEmployees.length} colaboradores faltaram</p>
          </div>
          
          <div 
            onClick={() => setActiveDetail('TURNOVER')}
            className={`p-6 rounded-3xl cursor-pointer transition-all border ${activeDetail === 'TURNOVER' ? 'bg-amber-600 text-white shadow-lg shadow-amber-200 border-amber-600' : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl ${activeDetail === 'TURNOVER' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-600'}`}><UserMinus size={24}/></div>
              <p className={`font-bold uppercase tracking-widest text-xs ${activeDetail === 'TURNOVER' ? 'text-amber-200' : 'text-slate-400'}`}>Desligamentos</p>
            </div>
            <p className="text-4xl font-black">{turnoverDetails.length}</p>
            <p className={`text-xs mt-2 flex gap-2 ${activeDetail === 'TURNOVER' ? 'text-amber-100' : 'text-slate-500'}`}>
              <span>{turnoverVoluntario} Pedidos</span> • <span>{turnoverInvoluntario} Empresa</span>
            </p>
          </div>

          <div 
            onClick={() => setActiveDetail('JOBS')}
            className={`p-6 rounded-3xl cursor-pointer transition-all border ${activeDetail === 'JOBS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-2xl ${activeDetail === 'JOBS' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}><Briefcase size={24}/></div>
              <p className={`font-bold uppercase tracking-widest text-xs ${activeDetail === 'JOBS' ? 'text-blue-200' : 'text-slate-400'}`}>Vagas Abertas</p>
            </div>
            <p className="text-4xl font-black">{jobsDetails.abertas.length}</p>
            <p className={`text-xs mt-2 flex gap-2 ${activeDetail === 'JOBS' ? 'text-blue-100' : 'text-slate-500'}`}>
              <span className="font-bold">No período:</span> {jobsDetails.fechadas.length} Concluídas • {jobsDetails.canceladas.length} Canc.
            </p>
          </div>
        </div>

        {/* ================= ABA 0: QUADRO DE PESSOAL (NOVA) ================= */}
        {activeDetail === 'TEAM' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 bg-indigo-50/30 flex items-center gap-3">
               <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl"><Users size={20}/></div>
               <div>
                  <h3 className="text-lg font-bold text-indigo-900">Quadro de Colaboradores</h3>
                  <p className="text-xs text-slate-500">Lista completa de quem está alocado neste setor atualmente.</p>
               </div>
            </div>
            <div className="p-0">
               
               {/* ATIVOS */}
               {teamAtivos.length > 0 && (
                  <div className="mb-2">
                     <div className="bg-slate-50 px-6 py-2 border-b border-slate-100 font-bold text-xs text-slate-400 uppercase tracking-widest">Colaboradores Ativos ({teamAtivos.length})</div>
                     <table className="w-full text-left text-sm">
                       <tbody className="divide-y divide-slate-100">
                         {teamAtivos.map((emp: Employee) => (
                           <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                             <td className="p-4 pl-6">
                               <p className="font-bold text-slate-800">{emp.name}</p>
                               <p className="text-xs text-slate-500">{emp.role}</p>
                             </td>
                             <td className="p-4 text-center text-slate-500 text-xs">
                                Adm: {formatDateToBR(emp.admissionDate)}
                             </td>
                             <td className="p-4 text-right pr-6">
                               <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                 Ativo
                               </span>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
               )}

               {/* AFASTADOS */}
               {teamAfastados.length > 0 && (
                  <div className="mb-2 border-t border-slate-200">
                     <div className="bg-amber-50/30 px-6 py-2 border-b border-slate-100 font-bold text-xs text-amber-600 uppercase tracking-widest">Afastados ({teamAfastados.length})</div>
                     <table className="w-full text-left text-sm">
                       <tbody className="divide-y divide-slate-100">
                         {teamAfastados.map((emp: Employee) => (
                           <tr key={emp.id} className="hover:bg-amber-50/30 transition-colors">
                             <td className="p-4 pl-6">
                               <p className="font-bold text-slate-800">{emp.name}</p>
                               <p className="text-xs text-slate-500">{emp.role}</p>
                             </td>
                             <td className="p-4 text-center text-slate-500 text-xs">
                               <p>Motivo: <span className="font-medium text-slate-700">{emp.leaveReason || 'Não inf.'}</span></p>
                               <p>Retorno: <span className="font-medium text-slate-700">{formatDateToBR(emp.leaveExpectedReturn!)}</span></p>
                             </td>
                             <td className="p-4 text-right pr-6">
                               <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                 Afastado
                               </span>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                  </div>
               )}

               {teamAtivos.length === 0 && teamAfastados.length === 0 && (
                 <div className="text-center py-16 text-slate-400">
                    <UserMinus size={48} className="mx-auto mb-3 opacity-20" />
                    <p>Não há nenhum colaborador alocado neste setor no momento.</p>
                 </div>
               )}

            </div>
          </div>
        )}

        {/* ================= ABA 1: ABSENTEÍSMO ================= */}
        {activeDetail === 'ABSENCES' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 bg-red-50/30 flex items-center gap-3">
              <div className="bg-red-100 text-red-600 p-2 rounded-xl"><CalendarX size={20}/></div>
              <div>
                 <h3 className="text-lg font-bold text-red-900">Detalhamento de Faltas no Período</h3>
                 <p className="text-xs text-slate-500">Expanda os cards para ver os motivos das ausências.</p>
              </div>
            </div>
            <div className="p-6">
              {absDetails.absentEmployees.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Activity size={48} className="mx-auto mb-3 opacity-20" />
                  <p>Nenhuma ausência registrada neste setor para o período selecionado.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {absDetails.absentEmployees.map((data, idx) => (
                    <div key={idx} className={`border rounded-2xl overflow-hidden transition-all ${expandedEmp === data.emp.id ? 'border-red-400 ring-4 ring-red-50 shadow-md' : 'border-slate-200 hover:border-red-200'}`}>
                      
                      {/* CABEÇALHO DO CARD CLICÁVEL */}
                      <div 
                        className="p-5 flex items-center justify-between cursor-pointer bg-white"
                        onClick={() => setExpandedEmp(expandedEmp === data.emp.id ? null : data.emp.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-black text-lg">
                            {data.emp.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{data.emp.name}</h4>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">{data.emp.role}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Perdidas</p>
                            <p className="text-lg font-black text-red-600">{formatHours(data.totalHours)}</p>
                          </div>
                          <div className={`p-1.5 rounded-full transition-colors ${expandedEmp === data.emp.id ? 'bg-red-100 text-red-700' : 'bg-slate-50 text-slate-400'}`}>
                            {expandedEmp === data.emp.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>

                      {/* CONTEÚDO EXPANDIDO (HISTÓRICO DA PESSOA) */}
                      {expandedEmp === data.emp.id && (
                        <div className="bg-slate-50 border-t border-red-100 p-4 animate-in slide-in-from-top-2">
                          <ul className="space-y-3">
                            {data.records.sort((a, b) => new Date(b.absenceDate).getTime() - new Date(a.absenceDate).getTime()).map((rec, rIdx) => (
                              <li key={rIdx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-black text-slate-700">{formatDateToBR(rec.absenceDate)}</span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                                      rec.documentType === 'Atestado' ? 'bg-blue-100 text-blue-700' :
                                      rec.documentType === 'Falta Injustificada' ? 'bg-red-100 text-red-700' :
                                      rec.documentType === 'Acompanhante de Dependente' ? 'bg-emerald-100 text-emerald-700' :
                                      'bg-amber-100 text-amber-700'
                                    }`}>
                                      {rec.documentType}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 truncate max-w-[250px]" title={rec.reason}>{rec.reason}</p>
                                </div>
                                <div className="text-right sm:text-left shrink-0">
                                  <span className="inline-flex items-center gap-1 text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                                    <Clock size={12} /> {rec.displayDuration}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= ABA 2: TURNOVER ================= */}
        {activeDetail === 'TURNOVER' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-slate-100 bg-amber-50/30 flex items-center gap-3">
              <div className="bg-amber-100 text-amber-600 p-2 rounded-xl"><UserMinus size={20}/></div>
              <div>
                 <h3 className="text-lg font-bold text-amber-900">Desligamentos Registrados no Período</h3>
                 <p className="text-xs text-slate-500">Histórico de saída (turnover) deste setor.</p>
              </div>
            </div>
            <div className="p-0">
              {turnoverDetails.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <UserMinus size={48} className="mx-auto mb-3 opacity-20" />
                  <p>Nenhum desligamento no setor neste período.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-white border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="p-4 pl-6">Data de Saída</th>
                      <th className="p-4">Colaborador</th>
                      <th className="p-4">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {turnoverDetails.map((emp: any) => {
                      const isVoluntary = emp.terminationReason?.toLowerCase().includes('pedido');
                      return (
                        <tr key={emp.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="p-4 pl-6 font-bold text-slate-700">
                            {formatDateToBR(emp.terminationDate)}
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-800">{emp.name}</p>
                            <p className="text-xs text-slate-500">{emp.role}</p>
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                              isVoluntary ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {emp.terminationReason || 'Não informado'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= ABA 3: VAGAS ================= */}
        {activeDetail === 'JOBS' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Abertas Atualmente */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-blue-50/50 flex items-center gap-3">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><Target size={20} /></div>
                <div>
                   <h3 className="text-lg font-bold text-blue-900">Trabalhando Agora (Abertas)</h3>
                   <p className="text-xs text-slate-500">Vagas que o RH está procurando ativamente (independente da data de abertura).</p>
                </div>
              </div>
              <div className="p-0">
                {jobsDetails.abertas.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-sm">Nenhuma vaga em aberto para este setor.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {jobsDetails.abertas.map((j: Job) => (
                        <tr key={j.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-4 pl-6">
                            <p className="font-bold text-slate-800">{j.title}</p>
                            <p className="text-xs text-slate-500">Aberta em: {formatDateToBR(j.openedAt)}</p>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              Em Andamento
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Fechadas no Período */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-emerald-50/50 flex items-center gap-3">
                <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl"><CheckCircle2 size={20} /></div>
                <div>
                   <h3 className="text-lg font-bold text-emerald-900">Vagas Concluídas no Período</h3>
                   <p className="text-xs text-slate-500">Vagas finalizadas dentro das datas filtradas acima.</p>
                </div>
              </div>
              <div className="p-0">
                {jobsDetails.fechadas.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-sm">Nenhuma contratação finalizada neste período.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {jobsDetails.fechadas.map((j: Job) => (
                        <tr key={j.id} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="p-4 pl-6">
                            <p className="font-bold text-slate-800">{j.title}</p>
                            <p className="text-xs text-slate-500">Fechada em: {formatDateToBR(j.closedAt!)}</p>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              Contratada
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Canceladas / Congeladas no Período */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <div className="bg-slate-200 text-slate-600 p-2 rounded-xl"><PauseCircle size={20} /></div>
                <div>
                   <h3 className="text-lg font-bold text-slate-700">Canceladas ou Congeladas no Período</h3>
                   <p className="text-xs text-slate-500">Vagas que foram pausadas ou canceladas dentro das datas filtradas.</p>
                </div>
              </div>
              <div className="p-0">
                {jobsDetails.canceladas.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-sm">Nenhuma vaga suspensa neste período.</p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <tbody className="divide-y divide-slate-100">
                      {jobsDetails.canceladas.map((j: Job) => (
                        <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 pl-6">
                            <p className="font-bold text-slate-800">{j.title}</p>
                            <p className="text-xs text-slate-500">
                              {j.status === 'Cancelada' ? `Cancelada em: ${formatDateToBR(j.closedAt!)}` : 'Congelada'}
                            </p>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${j.status === 'Cancelada' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {j.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // RENDERIZAÇÃO DA VISÃO PRINCIPAL (LISTA GERAL)
  // ============================================================================
  return (
    <div className="space-y-6 pb-12 animate-in fade-in">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
            <Building2 size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Setores e Áreas</h1>
            <p className="text-slate-500 text-sm">Visão macro de quadro, absenteísmo e rotatividade</p>
          </div>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar setor..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredSectorsSummary.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-600">Nenhum setor encontrado</h3>
          <p className="text-slate-400">Verifique a busca ou cadastre setores nas Configurações.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSectorsSummary.map((sector, idx) => (
            <div 
              key={idx} 
              onClick={() => setSelectedSector(sector.name)}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer group flex flex-col h-full active:scale-95"
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-black text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2 pr-2">
                  {sector.name}
                </h2>
                <div className="p-2 bg-slate-50 text-slate-400 rounded-full group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors shrink-0">
                  <ArrowLeft size={18} className="rotate-135" style={{ transform: 'rotate(135deg)' }} />
                </div>
              </div>

              <div className="mt-auto grid grid-cols-3 gap-2 text-center divide-x divide-slate-100 border-t border-slate-100 pt-4">
                <div className="px-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</p>
                  <p className="text-xl font-black text-slate-700">{sector.total}</p>
                </div>
                <div className="px-1">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Ativos</p>
                  <p className="text-xl font-black text-emerald-600">{sector.ativos}</p>
                </div>
                <div className="px-1">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Afast.</p>
                  <p className="text-xl font-black text-amber-600">{sector.afastados}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};