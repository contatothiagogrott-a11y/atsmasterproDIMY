import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Employee, AbsenceRecord } from '../types';
import { 
  Building2, Users, UserMinus, CalendarX, ArrowLeft, 
  Search, Clock, ChevronDown, ChevronUp, AlertTriangle, Activity, FileText
} from 'lucide-react';

export const Setores: React.FC = () => {
  const { employees = [], absences = [], settings = [] } = useData() as any;

  // Controle de Navegação: null = Lista de Setores | string = Nome do Setor Aberto
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  // Filtros da Visão Detalhada (Absenteísmo)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  // Controle de Card Expansível de Colaborador na Visão Detalhada
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
    
    // Adiciona setores que possam estar nos funcionários mas não nas configurações
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

  // --- LÓGICA DA VISÃO DETALHADA (ABSENTEÍSMO DO SETOR) ---
  const sectorDetails = useMemo(() => {
    if (!selectedSector) return null;

    const sectorEmps = employees.filter((e: Employee) => e.sector === selectedSector);
    
    // Filtra as ausências APENAS deste setor e NESTE período
    const periodAbsences = absences.filter((a: AbsenceRecord) => {
      const emp = sectorEmps.find((e: Employee) => e.name.toLowerCase() === a.employeeName?.toLowerCase());
      if (!emp) return false;
      
      const safeDate = formatToYMD(a.absenceDate);
      if (!safeDate) return false;
      return safeDate >= startDate && safeDate <= endDate;
    });

    let totalSectorLostHours = 0;
    const absByEmployee: Record<string, { emp: Employee, totalHours: number, records: any[] }> = {};

    periodAbsences.forEach((record: AbsenceRecord) => {
      const emp = sectorEmps.find((e: Employee) => e.name.toLowerCase() === record.employeeName?.toLowerCase())!;
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
      totalSectorLostHours += hours;

      if (!absByEmployee[emp.name]) {
        absByEmployee[emp.name] = { emp, totalHours: 0, records: [] };
      }
      absByEmployee[emp.name].totalHours += hours;
      absByEmployee[emp.name].records.push({
        ...record,
        calculatedHours: hours,
        displayDuration: unit === 'Dias' ? `${amount} Dia(s)` : `${formatHours(amount)}`
      });
    });

    return {
      employees: sectorEmps,
      totalLostHours: totalSectorLostHours,
      absentEmployees: Object.values(absByEmployee).sort((a, b) => b.totalHours - a.totalHours)
    };
  }, [selectedSector, employees, absences, startDate, endDate]);


  // ============================================================================
  // RENDERIZAÇÃO DA VISÃO DETALHADA DO SETOR
  // ============================================================================
  if (selectedSector && sectorDetails) {
    return (
      <div className="space-y-6 pb-12 animate-in slide-in-from-right-4 duration-300">
        
        {/* HEADER DETALHES */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedSector(null)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <Building2 className="text-indigo-600" /> {selectedSector}
              </h1>
              <p className="text-slate-500 text-sm font-medium mt-1">Análise de Absenteísmo do Setor</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer" />
            <span className="text-slate-300">até</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-sm font-bold text-slate-700 outline-none cursor-pointer" />
          </div>
        </div>

        {/* RESUMO DO PERÍODO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200 flex flex-col justify-center">
            <p className="text-indigo-200 font-bold uppercase tracking-widest text-xs mb-1">Horas Perdidas no Período</p>
            <p className="text-5xl font-black">{formatHours(sectorDetails.totalLostHours)}</p>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl"><CalendarX size={28}/></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Colaboradores com Faltas</p>
              <p className="text-3xl font-black text-slate-800">{sectorDetails.absentEmployees.length}</p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={28}/></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Alocados no Setor</p>
              <p className="text-3xl font-black text-slate-800">{sectorDetails.employees.length}</p>
            </div>
          </div>
        </div>

        {/* LISTA DE COLABORADORES FALTANTES */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800">Detalhamento por Colaborador</h3>
          </div>
          
          <div className="p-6">
            {sectorDetails.absentEmployees.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Activity size={48} className="mx-auto mb-3 opacity-20" />
                <p>Nenhuma ausência registrada neste setor para o período selecionado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sectorDetails.absentEmployees.map((data, idx) => (
                  <div key={idx} className={`border rounded-2xl overflow-hidden transition-all ${expandedEmp === data.emp.id ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-md' : 'border-slate-200 hover:border-indigo-200'}`}>
                    
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
                        <div className={`p-1.5 rounded-full transition-colors ${expandedEmp === data.emp.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-50 text-slate-400'}`}>
                          {expandedEmp === data.emp.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                    </div>

                    {/* CONTEÚDO EXPANDIDO (HISTÓRICO DA PESSOA) */}
                    {expandedEmp === data.emp.id && (
                      <div className="bg-slate-50 border-t border-indigo-100 p-4 animate-in slide-in-from-top-2">
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
            <h1 className="text-2xl font-bold text-slate-800">Setores</h1>
            <p className="text-slate-500 text-sm">Visão macro de quadro de funcionários e absenteísmo por área</p>
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