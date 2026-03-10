import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { 
  AlertTriangle, CalendarDays, UserCheck, Search, X, Lock, Unlock, 
  ExternalLink, Target, AlertCircle, CalendarX, Users, UserMinus, Coffee, Clock, MapPin, Gift, Activity, Award
} from 'lucide-react';
import { parseISO, addDays, differenceInDays, isSameMonth, isSameWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type DrillDownType = 'PENDING_CANDIDATES' | 'OLD_JOBS' | 'UPCOMING_ONBOARDINGS' | 'BIRTHDAYS' | 'COMPANY_ANNIVERSARIES' | null;

export const Dashboard: React.FC = () => {
  const { jobs, candidates, settings, user, absences, employees, meetings = [] } = useData() as any;
  const navigate = useNavigate();
  
  const [sectorFilter, setSectorFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showConfidential, setShowConfidential] = useState(false);
  const [drillDownType, setDrillDownType] = useState<DrillDownType>(null);

  const isRecepcao = user?.role === 'RECEPCAO';
  const isAuxiliar = user?.role === 'AUXILIAR_RH';
  const isMasterOrRecruiter = user?.role === 'MASTER' || user?.role === 'RECRUITER';

  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const urgentMeetings = useMemo(() => {
    return meetings
      .filter((m: any) => m.date === todayStr || m.date === tomorrowStr)
      .sort((a: any, b: any) => {
        if (a.date === b.date) return a.time.localeCompare(b.time);
        return a.date.localeCompare(b.date);
      });
  }, [meetings, todayStr, tomorrowStr]);

  const integrationAlerts = useMemo(() => {
    const alerts: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextWorkDay = new Date(today);
    if (today.getDay() === 5) { 
      nextWorkDay.setDate(today.getDate() + 3);
    } else { 
      nextWorkDay.setDate(today.getDate() + 1);
    }

    const formatYMD = (d: Date) => d.toISOString().split('T')[0];
    const todayStrObj = formatYMD(today);
    const nextStr = formatYMD(nextWorkDay);

    candidates.forEach((c: any) => {
      if (c.status !== 'Contratado' || c.onboarding?.completed) return;
      const ob = c.onboarding || {};

      if (c.timeline?.startDate) {
        const startStr = formatYMD(new Date(c.timeline.startDate));
        if (startStr === todayStrObj) alerts.push({ type: 'START', urgent: true, msg: `HOJE: Integração de ${c.name}`, phone: c.phone });
        else if (startStr === nextStr) alerts.push({ type: 'START', urgent: false, msg: `${today.getDay()===5 ? 'SEGUNDA' : 'AMANHÃ'}: Integração de ${c.name}`, phone: c.phone });
      }

      if (ob.examDate) {
        const examStr = formatYMD(new Date(ob.examDate));
        if (examStr === todayStrObj) alerts.push({ type: 'EXAM', urgent: true, msg: `HOJE: Exame Clínico de ${c.name}`, phone: c.phone });
        else if (examStr === nextStr) alerts.push({ type: 'EXAM', urgent: false, msg: `${today.getDay()===5 ? 'SEGUNDA' : 'AMANHÃ'}: Confirmar Exame de ${c.name}`, phone: c.phone });
      }

      if (ob.needsLabExam && ob.labExamDate) {
        const labStr = formatYMD(new Date(ob.labExamDate));
        if (labStr === todayStrObj) alerts.push({ type: 'LAB', urgent: true, msg: `HOJE: Exame Lab. de ${c.name}`, phone: c.phone });
        else if (labStr === nextStr) alerts.push({ type: 'LAB', urgent: false, msg: `${today.getDay()===5 ? 'SEGUNDA' : 'AMANHÃ'}: Confirmar Exame Lab. de ${c.name}`, phone: c.phone });
      }
    });

    return alerts.sort((a, b) => (a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1));
  }, [candidates]);

  const extractMonthDay = (dateStr: any) => {
    if (!dateStr) return null;
    let str = String(dateStr).trim().split('T')[0].split(' ')[0];
    
    const corruptMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (corruptMatch) {
        const wrongYear = corruptMatch[1]; 
        const month = Number(corruptMatch[2]); 
        const actualDay = Number(wrongYear.substring(2)); 
        return { m: month, d: actualDay, y: Number(corruptMatch[3]) };
    }

    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        let p0 = parts[0], p1 = parts[1], p2 = parts[2];
        if (p0.length === 4) return { y: Number(p0), m: Number(p1), d: Number(p2) }; 
        if (p2.length === 4) { 
            let m = Number(p1);
            if (m > 12) return { y: Number(p2), m: Number(p0), d: Number(p1) }; 
            return { y: Number(p2), m: Number(p1), d: Number(p0) }; 
        }
        if (p2.length === 2) {
            let m = Number(p1);
            if (m > 12) return { y: Number(p2)>50?1900+Number(p2):2000+Number(p2), m: Number(p0), d: Number(p1) }; 
            return { y: Number(p2)>50?1900+Number(p2):2000+Number(p2), m: Number(p1), d: Number(p0) }; 
        }
    }
    return null;
  };

  // --- LÓGICA UNIFICADA: ANIVERSÁRIOS DE VIDA E DE EMPRESA ---
  const { todaysBirthdays, weeksBirthdays, weeksCompanyAnniversaries } = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    const activeEmps = (employees || []).filter((e: any) => e.status === 'Ativo');

    // ANIVERSÁRIOS DE VIDA
    const todaysBdays = activeEmps.filter((emp: any) => {
      const bd = extractMonthDay(emp.birthDate);
      return bd && bd.m === currentMonth && bd.d === currentDay;
    });

    const weeksBdays = activeEmps.filter((emp: any) => {
      const bd = extractMonthDay(emp.birthDate);
      if (!bd) return false;
      const thisYearBday = new Date(currentYear, bd.m - 1, bd.d);
      return isSameWeek(thisYearBday, today, { weekStartsOn: 0 }); 
    }).sort((a: any, b: any) => {
      const bdA = extractMonthDay(a.birthDate)!;
      const bdB = extractMonthDay(b.birthDate)!;
      if (bdA.m === bdB.m) return bdA.d - bdB.d;
      return bdA.m - bdB.m;
    });

    // ANIVERSÁRIOS DE EMPRESA
    const weeksWorkAnniversaries = activeEmps.filter((emp: any) => {
      const ad = extractMonthDay(emp.admissionDate);
      if (!ad || !ad.y || ad.y === currentYear) return false; // Ignora se for o mesmo ano que entrou
      const thisYearAday = new Date(currentYear, ad.m - 1, ad.d);
      return isSameWeek(thisYearAday, today, { weekStartsOn: 0 }); 
    }).map((emp: any) => {
      const ad = extractMonthDay(emp.admissionDate)!;
      const yearsOfService = currentYear - ad.y;
      return { ...emp, yearsOfService };
    }).sort((a: any, b: any) => {
      const adA = extractMonthDay(a.admissionDate)!;
      const adB = extractMonthDay(b.admissionDate)!;
      if (adA.m === adB.m) return adA.d - adB.d;
      return adA.m - adB.m;
    });

    return { 
      todaysBirthdays: todaysBdays, 
      weeksBirthdays: weeksBdays,
      weeksCompanyAnniversaries: weeksWorkAnniversaries
    };
  }, [employees]);

  const todaysNames = todaysBirthdays.map((e:any) => e.name.split(' ')[0]).join(', ').replace(/, ([^,]*)$/, ' e $1');

  const peopleStats = useMemo(() => {
    const today = new Date();
    
    const monthlyAbsences = (absences || []).filter((a: any) => {
      if (!a.absenceDate) return false;
      return isSameMonth(parseISO(a.absenceDate), today);
    }).length;

    const activeList = (employees || []).filter((e: any) => e.status === 'Ativo');
    const ativosCLT = activeList.filter((e: any) => e.contractType === 'CLT').length;
    const ativosPJ = activeList.filter((e: any) => e.contractType === 'PJ').length;
    const ativosEstagio = activeList.filter((e: any) => e.contractType === 'Estagiário').length;
    const ativosJA = activeList.filter((e: any) => e.contractType === 'JA').length;
    const afastados = (employees || []).filter((e: any) => e.status === 'Afastado').length;

    return { 
      monthlyAbsences, 
      totalAtivos: activeList.length, 
      ativosCLT, ativosPJ, ativosEstagio, ativosJA, 
      afastados 
    };
  }, [absences, employees]);

  const hasConfidentialAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'MASTER') return true;
    return jobs.some((j: any) => j.isConfidential && (j.createdBy === user.id || j.allowedUserIds?.includes(user.id)));
  }, [jobs, user]);

  const { fJobs, fCandidates } = useMemo(() => {
    let filteredJobs = jobs.filter((j: any) => !j.isHidden);
    
    filteredJobs = filteredJobs.filter((j: any) => {
        if (!j.isConfidential) return true;
        if (!user) return false;
        return user.role === 'MASTER' || j.createdBy === user.id || j.allowedUserIds?.includes(user.id);
    });
    if (!showConfidential) filteredJobs = filteredJobs.filter((j: any) => !j.isConfidential);

    if (sectorFilter) filteredJobs = filteredJobs.filter((j: any) => j.sector === sectorFilter);
    if (unitFilter) filteredJobs = filteredJobs.filter((j: any) => j.unit === unitFilter);

    const jobIds = new Set(filteredJobs.map((j: any) => j.id));
    const filteredCandidates = candidates.filter((c: any) => {
        const isGeneral = c.jobId === 'general' && !sectorFilter && !unitFilter;
        return jobIds.has(c.jobId) || isGeneral;
    });
    
    return { fJobs: filteredJobs, fCandidates: filteredCandidates };
  }, [jobs, candidates, sectorFilter, unitFilter, showConfidential, user]);

  const pendingCandidates = useMemo(() => {
      return fCandidates.filter((c: any) => 
          !['Aprovado', 'Reprovado', 'Desistência', 'Contratado'].includes(c.status)
      );
  }, [fCandidates]);

  const oldOpenJobs = useMemo(() => {
      const today = new Date();
      const thirtyDaysAgo = addDays(today, -30);
      return fJobs.filter((j: any) => j.status === 'Aberta' && new Date(j.openedAt) < thirtyDaysAgo);
  }, [fJobs]);

  const upcomingOnboardings = useMemo(() => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return candidates.filter((c: any) => {
          if (c.status !== 'Contratado' || c.onboarding?.completed || !c.timeline?.startDate) return false;
          const startDate = parseISO(c.timeline.startDate);
          return startDate >= todayStart; 
      }).sort((a: any, b: any) => new Date(a.timeline!.startDate!).getTime() - new Date(b.timeline!.startDate!).getTime());
  }, [candidates]);

  const getDrillDownContent = () => {
      if (drillDownType === 'BIRTHDAYS') {
          return (
            <div className="overflow-x-auto custom-scrollbar relative">
                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-pink-50 text-pink-600 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Data</th>
                            <th className="p-4">Colaborador</th>
                            <th className="p-4 text-center">Setor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {weeksBirthdays.map((emp: any) => {
                            const bd = extractMonthDay(emp.birthDate);
                            const isToday = bd && bd.m === (new Date().getMonth() + 1) && bd.d === new Date().getDate();
                            return (
                                <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4 pl-6 font-black text-slate-700">
                                      {bd ? `${String(bd.d).padStart(2, '0')}/${String(bd.m).padStart(2, '0')}` : '-'}
                                      {isToday && <span className="ml-2 bg-pink-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase animate-pulse">Hoje!</span>}
                                    </td>
                                    <td className="p-4 font-bold text-slate-700">{emp.name}</td>
                                    <td className="p-4 text-center text-slate-500">{emp.sector}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {weeksBirthdays.length === 0 && <p className="text-center py-6 text-slate-400">Nenhum aniversariante nesta semana.</p>}
            </div>
          );
      }
      if (drillDownType === 'COMPANY_ANNIVERSARIES') {
          return (
            <div className="overflow-x-auto custom-scrollbar relative">
                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-amber-50 text-amber-700 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Data</th>
                            <th className="p-4">Colaborador</th>
                            <th className="p-4 text-center">Setor</th>
                            <th className="p-4 text-right pr-6 rounded-r-xl">Tempo de Casa</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {weeksCompanyAnniversaries.map((emp: any) => {
                            const ad = extractMonthDay(emp.admissionDate);
                            const isToday = ad && ad.m === (new Date().getMonth() + 1) && ad.d === new Date().getDate();
                            return (
                                <tr key={emp.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="p-4 pl-6 font-black text-slate-700">
                                      {ad ? `${String(ad.d).padStart(2, '0')}/${String(ad.m).padStart(2, '0')}` : '-'}
                                      {isToday && <span className="ml-2 bg-amber-500 text-white text-[10px] px-2 py-0.5 rounded-full uppercase animate-pulse">Hoje!</span>}
                                    </td>
                                    <td className="p-4 font-bold text-slate-700">{emp.name}</td>
                                    <td className="p-4 text-center text-slate-500">{emp.sector}</td>
                                    <td className="p-4 pr-6 text-right">
                                        <span className="font-black text-amber-600 bg-amber-50 px-3 py-1 rounded-lg">
                                            {emp.yearsOfService} {emp.yearsOfService === 1 ? 'Ano' : 'Anos'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {weeksCompanyAnniversaries.length === 0 && <p className="text-center py-6 text-slate-400">Ninguém completa tempo de casa nesta semana.</p>}
            </div>
          );
      }
      if (drillDownType === 'PENDING_CANDIDATES' && isMasterOrRecruiter) {
          return (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Candidato</th>
                            <th className="p-4">Vaga</th>
                            <th className="p-4 text-center">Status Pendente</th>
                            <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pendingCandidates.map((c: any) => {
                            const job = jobs.find((j: any) => j.id === c.jobId);
                            return (
                                <tr key={c.id} className="hover:bg-amber-50 transition-colors">
                                    <td className="p-4 pl-6 font-black text-slate-700">{c.name}</td>
                                    <td className="p-4 text-slate-600 font-medium">{job?.title || 'Entrevista Geral (Pool)'}</td>
                                    <td className="p-4 text-center">
                                        <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">{c.status}</span>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <button onClick={() => navigate(c.jobId === 'general' ? '/general-interviews' : `/jobs/${c.jobId}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto">
                                            <Target size={14}/> Resolver
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          );
      }
      if (drillDownType === 'OLD_JOBS' && isMasterOrRecruiter) {
          return (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Vaga</th>
                            <th className="p-4 text-center">Área</th>
                            <th className="p-4 text-center text-red-500">Dias em Aberto</th>
                            <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {oldOpenJobs.map((j: any) => {
                            const daysOpen = differenceInDays(new Date(), parseISO(j.openedAt));
                            return (
                                <tr key={j.id} className="hover:bg-red-50 transition-colors">
                                    <td className="p-4 pl-6 font-black text-slate-700">{j.title}</td>
                                    <td className="p-4 text-center text-slate-500">{j.sector}</td>
                                    <td className="p-4 text-center font-black text-red-600">{daysOpen} dias</td>
                                    <td className="p-4 pr-6 text-right">
                                        <button onClick={() => navigate(`/jobs/${j.id}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto">
                                            <ExternalLink size={14}/> Acessar Vaga
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          );
      }
      if (drillDownType === 'UPCOMING_ONBOARDINGS' && isMasterOrRecruiter) {
          return (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Novo Colaborador</th>
                            <th className="p-4 text-center text-emerald-600">Data de Início</th>
                            <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {upcomingOnboardings.map((c: any) => {
                            const startDateObj = parseISO(c.timeline!.startDate!);
                            const isTodayStart = startDateObj.toDateString() === new Date().toDateString();
                            return (
                                <tr key={c.id} className="hover:bg-emerald-50 transition-colors">
                                    <td className="p-4 pl-6 font-black text-slate-700">{c.name}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase ${isTodayStart ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                                            {isTodayStart ? 'HOJE' : startDateObj.toLocaleDateString()}
                                        </span>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <button onClick={() => navigate('/integracao')} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto">
                                            <Target size={14}/> Ficha
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                {upcomingOnboardings.length === 0 && <p className="text-center py-6 text-slate-400">Nenhuma integração pendente.</p>}
            </div>
          );
      }
      return null;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
            <h2 className="text-lg font-bold text-indigo-600 mb-1">
                Bem-vindo(a){user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
            </h2>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel de Ações</h1>
        </div>
        
        {/* Filtros ocultos para a Recepção */}
        {!isRecepcao && (
          <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              {hasConfidentialAccess && (
                <button onClick={() => setShowConfidential(!showConfidential)} className={`p-2 rounded-xl transition-all border flex items-center gap-2 text-sm font-bold ${showConfidential ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                  {showConfidential ? <Unlock size={18} /> : <Lock size={18} />} <span className="hidden sm:inline">{showConfidential ? "Sigilo Aberto" : "Ativar Sigilo"}</span>
                </button>
              )}
              <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
              <select className="bg-slate-50 border-none rounded-xl text-sm p-2 font-bold outline-none cursor-pointer" value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
                  <option value="">Todos os Setores</option>
                  {settings.filter((s: any) => s.type === 'SECTOR').map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
          </div>
        )}
      </div>

      {todaysNames && (
        <div onClick={() => navigate('/aniversariantes')} className="cursor-pointer bg-pink-50 border-l-[6px] border-pink-500 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all animate-in slide-in-from-top-2 flex items-center gap-4">
          <div className="p-3 bg-pink-200 text-pink-600 rounded-full shrink-0">
            <Gift size={24} className="animate-bounce" />
          </div>
          <div>
            <h4 className="font-black text-lg text-pink-900">🎉 Hoje tem bolo!</h4>
            <p className="text-sm font-bold text-pink-700 mt-1">
              Deseje feliz aniversário para: <span className="text-pink-900">{todaysNames}</span>
            </p>
          </div>
        </div>
      )}

      {/* ALERTAS DE INTEGRAÇÃO */}
      {!isRecepcao && integrationAlerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {integrationAlerts.map((alert, idx) => (
            <div key={idx} className={`flex items-center justify-between p-4 rounded-2xl border-l-[6px] shadow-sm ${alert.urgent ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-400'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${alert.urgent ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  {alert.type === 'START' ? <UserCheck size={20}/> : <Activity size={20}/>}
                </div>
                <h4 className={`font-bold ${alert.urgent ? 'text-emerald-900' : 'text-slate-700'}`}>{alert.msg}</h4>
              </div>
              <a 
                href={`https://wa.me/55${(alert.phone || '').replace(/\D/g, '')}`} 
                target="_blank" rel="noreferrer"
                className="text-xs font-bold bg-white border px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1 text-slate-600"
              >
                Cobrar WhatsApp
              </a>
            </div>
          ))}
        </div>
      )}

      {/* SÓ MOSTRA REUNIÕES SE NÃO FOR RECEPÇÃO */}
      {!isRecepcao && urgentMeetings.length > 0 && (
        <div className="space-y-3">
          {urgentMeetings.map((m: any) => {
            const isToday = m.date === todayStr;
            return (
              <div key={m.id} onClick={() => navigate('/reunioes')} className={`cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between p-5 rounded-2xl border-l-[6px] shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-top-2 ${isToday ? 'bg-orange-50 border-orange-500 hover:bg-orange-100' : 'bg-blue-50 border-blue-500 hover:bg-blue-100'}`}>
                <div className="flex items-start sm:items-center gap-4">
                  <div className={`p-3 rounded-full shrink-0 ${isToday ? 'bg-orange-200 text-orange-600' : 'bg-blue-200 text-blue-600'}`}>
                    <Coffee size={24} className={isToday ? 'animate-bounce' : ''} />
                  </div>
                  <div>
                    <h4 className={`font-black text-lg flex items-center gap-2 ${isToday ? 'text-orange-900' : 'text-blue-900'}`}>
                      {isToday ? 'HOJE:' : 'AMANHÃ:'} {m.title}
                    </h4>
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm font-bold ${isToday ? 'text-orange-700' : 'text-blue-700'}`}>
                      <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-md"><Clock size={14}/> {m.time} {m.endTime ? `às ${m.endTime}` : ''}</span>
                      <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-md"><MapPin size={14}/> {m.location}</span>
                      <span className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-md"><Users size={14}/> {m.participantCount} pessoas</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SÓ MOSTRA GESTÃO DE PESSOAS SE NÃO FOR RECEPÇÃO */}
      {!isRecepcao && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 hover:shadow-md transition-shadow">
                  <div className="p-4 bg-red-50 text-red-600 rounded-2xl"><CalendarX size={32} /></div>
                  <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Faltas no Mês</p>
                      <p className="text-3xl font-black text-slate-800">{peopleStats.monthlyAbsences}</p>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 hover:shadow-md transition-shadow">
                  <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={32} /></div>
                  <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Colaboradores Ativos</p>
                      <div className="flex flex-col">
                        <p className="text-3xl font-black text-slate-800">{peopleStats.totalAtivos}</p>
                        <p className="text-[10px] font-bold text-slate-500 leading-tight mt-1">
                            {peopleStats.ativosCLT} CLT | {peopleStats.ativosPJ} PJ | {peopleStats.ativosEstagio} Est. | {peopleStats.ativosJA} JA
                        </p>
                      </div>
                  </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6 hover:shadow-md transition-shadow">
                  <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><UserMinus size={32} /></div>
                  <div>
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Afastados</p>
                      <p className="text-3xl font-black text-slate-800">{peopleStats.afastados}</p>
                  </div>
              </div>
          </div>
          <div className="w-full h-px bg-slate-200 my-4"></div>
        </>
      )}

      {/* CARDS INFERIORES */}
      <div className={`grid gap-6 pt-2 ${isRecepcao ? 'grid-cols-1 sm:grid-cols-2 max-w-lg' : isAuxiliar ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-4xl' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
          
          <div onClick={() => setDrillDownType(drillDownType === 'BIRTHDAYS' ? null : 'BIRTHDAYS')} className={`relative bg-white border p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden ${drillDownType === 'BIRTHDAYS' ? 'border-pink-500 shadow-md ring-4 ring-pink-50' : 'border-pink-200'}`}>
              <div className="absolute -top-4 -right-4 bg-pink-50 p-8 rounded-full z-0 group-hover:bg-pink-100 transition-colors"></div>
              <div className="bg-pink-500 p-4 rounded-2xl text-white shadow-lg shadow-pink-200 mb-4 z-10 group-hover:-translate-y-2 transition-transform duration-300"><Gift size={32}/></div>
              <div className="text-center z-10">
                  <h4 className="font-black text-pink-900 uppercase tracking-widest text-[10px] mb-1">Aniversários de Vida</h4>
                  <div className="text-4xl font-black text-pink-600 mb-1">{weeksBirthdays.length}</div>
              </div>
          </div>

          <div onClick={() => setDrillDownType(drillDownType === 'COMPANY_ANNIVERSARIES' ? null : 'COMPANY_ANNIVERSARIES')} className={`relative bg-white border p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden ${drillDownType === 'COMPANY_ANNIVERSARIES' ? 'border-amber-500 shadow-md ring-4 ring-amber-50' : 'border-amber-200'}`}>
              <div className="absolute -top-4 -right-4 bg-amber-50 p-8 rounded-full z-0 group-hover:bg-amber-100 transition-colors"></div>
              <div className="bg-amber-500 p-4 rounded-2xl text-white shadow-lg shadow-amber-200 mb-4 z-10 group-hover:-translate-y-2 transition-transform duration-300"><Award size={32}/></div>
              <div className="text-center z-10">
                  <h4 className="font-black text-amber-900 uppercase tracking-widest text-[10px] mb-1">Tempo de Empresa</h4>
                  <div className="text-4xl font-black text-amber-600 mb-1">{weeksCompanyAnniversaries.length}</div>
              </div>
          </div>

          {/* SÓ MOSTRA CARDS DE RECRUTAMENTO SE FOR MASTER OU RECRUTADOR */}
          {isMasterOrRecruiter && (
            <>
              <div onClick={() => setDrillDownType(drillDownType === 'PENDING_CANDIDATES' ? null : 'PENDING_CANDIDATES')} className={`relative bg-white border p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden ${drillDownType === 'PENDING_CANDIDATES' ? 'border-amber-500 shadow-md ring-4 ring-amber-50' : 'border-amber-200'}`}>
                  <div className="absolute -top-4 -right-4 bg-amber-50 p-8 rounded-full z-0 group-hover:bg-amber-100 transition-colors"></div>
                  <div className="bg-amber-500 p-4 rounded-2xl text-white shadow-lg shadow-amber-200 mb-4 z-10 group-hover:-translate-y-2 transition-transform duration-300"><UserCheck size={32}/></div>
                  <div className="text-center z-10">
                      <h4 className="font-black text-amber-900 uppercase tracking-widest text-[10px] mb-1">Candidatos Pendentes</h4>
                      <div className="text-4xl font-black text-amber-600 mb-1">{pendingCandidates.length}</div>
                  </div>
              </div>

              <div onClick={() => setDrillDownType(drillDownType === 'OLD_JOBS' ? null : 'OLD_JOBS')} className={`relative bg-white border p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden ${drillDownType === 'OLD_JOBS' ? 'border-red-500 shadow-md ring-4 ring-red-50' : 'border-red-200'}`}>
                  <div className="absolute -top-4 -right-4 bg-red-50 p-8 rounded-full z-0 group-hover:bg-red-100 transition-colors"></div>
                  <div className="bg-red-500 p-4 rounded-2xl text-white shadow-lg shadow-red-200 mb-4 z-10 group-hover:-translate-y-2 transition-transform duration-300"><AlertCircle size={32}/></div>
                  <div className="text-center z-10">
                      <h4 className="font-black text-red-900 uppercase tracking-widest text-[10px] mb-1">Vagas em Atraso</h4>
                      <div className="text-4xl font-black text-red-600 mb-1">{oldOpenJobs.length}</div>
                  </div>
              </div>

              <div onClick={() => setDrillDownType(drillDownType === 'UPCOMING_ONBOARDINGS' ? null : 'UPCOMING_ONBOARDINGS')} className={`relative bg-white border p-6 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden ${drillDownType === 'UPCOMING_ONBOARDINGS' ? 'border-emerald-500 shadow-md ring-4 ring-emerald-50' : 'border-emerald-200'}`}>
                  <div className="absolute -top-4 -right-4 bg-emerald-50 p-8 rounded-full z-0 group-hover:bg-emerald-100 transition-colors"></div>
                  <div className="bg-emerald-500 p-4 rounded-2xl text-white shadow-lg shadow-emerald-200 mb-4 z-10 group-hover:-translate-y-2 transition-transform duration-300"><CalendarDays size={32}/></div>
                  <div className="text-center z-10">
                      <h4 className="font-black text-emerald-900 uppercase tracking-widest text-[10px] mb-1">Próximas Integrações</h4>
                      <div className="text-4xl font-black text-emerald-600 mb-1">{upcomingOnboardings.length}</div>
                  </div>
              </div>
            </>
          )}
      </div>

      {drillDownType && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn mt-8">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl text-white shadow-md ${
                          drillDownType === 'BIRTHDAYS' ? 'bg-pink-500' :
                          drillDownType === 'COMPANY_ANNIVERSARIES' ? 'bg-amber-500' :
                          drillDownType === 'PENDING_CANDIDATES' ? 'bg-amber-500' :
                          drillDownType === 'OLD_JOBS' ? 'bg-red-500' : 'bg-emerald-500'
                      }`}>
                          {drillDownType === 'BIRTHDAYS' && <Gift size={24} />}
                          {drillDownType === 'COMPANY_ANNIVERSARIES' && <Award size={24} />}
                          {drillDownType === 'PENDING_CANDIDATES' && <UserCheck size={24} />}
                          {drillDownType === 'OLD_JOBS' && <AlertTriangle size={24} />}
                          {drillDownType === 'UPCOMING_ONBOARDINGS' && <CalendarDays size={24} />}
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                            {drillDownType === 'BIRTHDAYS' ? 'Aniversariantes da Semana' :
                             drillDownType === 'COMPANY_ANNIVERSARIES' ? 'Tempo de Empresa na Semana' :
                             drillDownType === 'PENDING_CANDIDATES' ? 'Candidatos Pendentes' :
                             drillDownType === 'OLD_JOBS' ? 'Vagas Críticas' :
                             'Integrações Confirmadas'}
                        </h2>
                      </div>
                  </div>
                  <button onClick={() => setDrillDownType(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all">
                      <X size={24} />
                  </button>
              </div>
              <div className="p-0 bg-white">
                  {getDrillDownContent()}
              </div>
          </div>
      )}
    </div>
  );
};