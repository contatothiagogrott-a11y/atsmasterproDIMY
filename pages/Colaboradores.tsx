import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Employee, EmployeeStatus, EmployeeHistoryRecord, ContractType, EmployeeHistoryType, ProbationType } from '../types';
import { 
  Contact, Plus, Search, Filter, Edit2, Trash2, 
  History, Calendar, Phone, Briefcase, MapPin, 
  ChevronRight, ArrowLeft, Save, AlertCircle, XCircle, Clock, FileText, RefreshCw
} from 'lucide-react';

const SCHEDULE_OPTIONS = [
  'Estudante (07h às 12h e 13h às 16h48)',
  '1º Turno (05h às 09h e 09h30 às 14h18)',
  'Comercial Produção (07h às 11h43 e 13h às 17h05)',
  'Comercial Adm (08h às 18h / Sex até 17h)',
  'Outro'
];

const WEEK_DAYS = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' }
];

export const Colaboradores: React.FC = () => {
  const { employees = [], addEmployee, updateEmployee, removeEmployee, settings = [], absences = [], user } = useData() as any;
  
  const [view, setView] = useState<'list' | 'form' | 'details'>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'Todos' | 'Pendentes'>('Ativo');
  const [sectorFilter, setSectorFilter] = useState('Todos');
  const [unitFilter, setUnitFilter] = useState('Todas');
  const [contractFilter, setContractFilter] = useState<ContractType | 'Todos'>('Todos');
  const [scheduleFilter, setScheduleFilter] = useState('Todos'); 

  const [terminationObservation, setTerminationObservation] = useState('');

  const [formData, setFormData] = useState<Partial<Employee> & any>({
    status: 'Ativo',
    contractType: 'CLT',
    dailyWorkload: 8.8,
    probationType: '45+45',
    workSchedule: '', 
    workDays: [1, 2, 3, 4, 5], 
    history: []
  });

  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<EmployeeHistoryRecord> & { endDate?: string, leaveReason?: string }>({
    id: undefined, 
    date: new Date().toISOString().split('T')[0],
    type: 'Outros',
    description: '',
    endDate: '',
    leaveReason: ''
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp: any) => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             emp.role.toLowerCase().includes(searchTerm.toLowerCase());
                             
      let matchesStatus = false;
      if (statusFilter === 'Todos') matchesStatus = true;
      else if (statusFilter === 'Pendentes') matchesStatus = !!emp.hasPendingInfo;
      else matchesStatus = emp.status === statusFilter;

      const matchesSector = sectorFilter === 'Todos' || emp.sector === sectorFilter;
      const matchesUnit = unitFilter === 'Todas' || emp.unit === unitFilter;
      const matchesContract = contractFilter === 'Todos' || emp.contractType === contractFilter; 
      const matchesSchedule = scheduleFilter === 'Todos' || (emp as any).workSchedule === scheduleFilter;

      return matchesSearch && matchesStatus && matchesSector && matchesUnit && matchesContract && matchesSchedule;
    });
  }, [employees, searchTerm, statusFilter, sectorFilter, unitFilter, contractFilter, scheduleFilter]);

  const unifiedHistory = useMemo(() => {
    if (!selectedEmployee) return [];
    
    const employeeAbsences = absences
      .filter((a: any) => a.employeeName.toLowerCase() === selectedEmployee.name.toLowerCase())
      .map((a: any) => ({
        id: a.id,
        date: a.absenceDate,
        type: 'Falta/Afastamento',
        description: `Registro de ${a.documentType}: ${a.reason} (${a.durationAmount || 1} ${a.durationUnit || 'Dias'})`,
        isAbsence: true
      }));

    const manualHistory = (selectedEmployee.history || []).map((h: any) => ({ ...h, isAbsence: false }));
    
    return [...employeeAbsences, ...manualHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [selectedEmployee, absences]);

  const formatDateToBRLocal = (dateStr?: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  };

  const originalEmpForForm = useMemo(() => employees.find((e: Employee) => e.id === formData.id), [employees, formData.id]);
  const isReturningFromLeave = originalEmpForForm?.status === 'Afastado' && formData.status === 'Ativo';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalTerminationReason = formData.terminationReason;
    if (formData.status === 'Inativo') {
        if (!finalTerminationReason) {
            alert("Por favor, selecione o motivo principal do desligamento.");
            return;
        }
        if (finalTerminationReason === 'Outros' && !terminationObservation) {
            alert("Por favor, detalhe o motivo do desligamento no campo de observação.");
            return;
        }
        if (terminationObservation) {
            if (finalTerminationReason === 'Outros') {
                finalTerminationReason = `Outros: ${terminationObservation}`;
            } else {
                finalTerminationReason = `${finalTerminationReason} | Obs: ${terminationObservation}`;
            }
        }
    }

    if (!formData.workDays || formData.workDays.length === 0) {
       alert("Selecione pelo menos um dia de trabalho para o colaborador.");
       return;
    }

    const { actualReturnDate, leaveStartDate, leaveExpectedReturn, leaveReason, ...safeFormData } = formData;
    
    const originalEmp = employees.find((emp: Employee) => emp.id === safeFormData.id);
    let updatedHistory = [...(safeFormData.history || [])];
    
    let finalLeaveData = { 
      leaveStartDate: leaveStartDate || '', 
      leaveExpectedReturn: leaveExpectedReturn || '', 
      leaveReason: leaveReason || '' 
    };

    const isNewEmployee = !originalEmp;

    // --- NOVA LÓGICA: REGISTRO AUTOMÁTICO DE MUDANÇAS GERAIS ---
    if (!isNewEmployee) {
       const todayIso = new Date().toISOString().split('T')[0];
       let changes = [];

       if (originalEmp.sector !== safeFormData.sector) changes.push(`Setor (${originalEmp.sector || '-'} ➔ ${safeFormData.sector})`);
       if (originalEmp.role !== safeFormData.role) changes.push(`Cargo (${originalEmp.role || '-'} ➔ ${safeFormData.role})`);
       if (originalEmp.unit !== safeFormData.unit) changes.push(`Unidade (${originalEmp.unit || '-'} ➔ ${safeFormData.unit})`);
       if (originalEmp.contractType !== safeFormData.contractType) changes.push(`Regime (${originalEmp.contractType || '-'} ➔ ${safeFormData.contractType})`);
       
       const oldSchedule = (originalEmp as any).workSchedule;
       const newSchedule = safeFormData.workSchedule;
       if (oldSchedule !== newSchedule && (oldSchedule || newSchedule)) {
           changes.push(`Horário (${oldSchedule || '-'} ➔ ${newSchedule || '-'})`);
       }

       if (changes.length > 0) {
           updatedHistory.push({
               id: crypto.randomUUID(),
               date: todayIso,
               type: 'Mudança de Setor', // Pode usar isso como tipo genérico para mudanças estruturais
               description: `[ALTERAÇÃO CADASTRAL] ${changes.join(' | ')} | Setor: ${safeFormData.sector} | Cargo: ${safeFormData.role}`,
               createdBy: user?.name || 'Sistema'
           });
       }
    }

    // --- LÓGICA DE AFASTAMENTO NO HISTÓRICO ---
    if (safeFormData.status === 'Afastado' && originalEmp?.status !== 'Afastado') {
       updatedHistory.push({
          id: crypto.randomUUID(),
          date: leaveStartDate || new Date().toISOString().split('T')[0],
          type: 'Outros',
          description: `[INÍCIO DE AFASTAMENTO] Motivo: ${leaveReason || 'Não informado'} | Retorno Previsto: ${leaveExpectedReturn ? formatDateToBRLocal(leaveExpectedReturn) : 'Indeterminado'}`,
          createdBy: user?.name || 'Sistema'
       });
    }

    if (safeFormData.status === 'Ativo' && originalEmp?.status === 'Afastado') {
       if (!actualReturnDate) {
          alert("Por favor, informe a Data Efetiva do Retorno do afastamento na caixinha verde.");
          return;
       }

       updatedHistory.push({
          id: crypto.randomUUID(),
          date: actualReturnDate, 
          type: 'Outros',
          description: `[FIM DE AFASTAMENTO] Colaborador retornou às atividades. (Afastamento de ${formatDateToBRLocal(leaveStartDate)} até ${formatDateToBRLocal(actualReturnDate)} - Motivo: ${leaveReason})`,
          createdBy: user?.name || 'Sistema'
       });
       
       finalLeaveData = { leaveStartDate: '', leaveExpectedReturn: '', leaveReason: '' };
    }

    const employeeData = {
      ...safeFormData,
      ...finalLeaveData,
      terminationReason: finalTerminationReason,
      id: safeFormData.id || crypto.randomUUID(),
      hasPendingInfo: false,
      createdAt: safeFormData.createdAt || new Date().toISOString(),
      history: updatedHistory
    } as Employee;

    if (safeFormData.id) {
      await updateEmployee(employeeData);
    } else {
      await addEmployee(employeeData);
    }
    
    setView('list');
    setFormData({ status: 'Ativo', contractType: 'CLT', dailyWorkload: 8.8, probationType: '45+45', workSchedule: '', workDays: [1,2,3,4,5], history: [], leaveStartDate: '', leaveExpectedReturn: '', leaveReason: '' });
    setTerminationObservation('');
  };

  const handleSyncWorkDays = async () => {
    if (!window.confirm("Isso irá aplicar o padrão de trabalho de 'Segunda a Sexta' para todos os colaboradores que ainda não têm essa informação configurada. Deseja continuar?")) return;
    
    let updatedCount = 0;
    for (const emp of employees) {
       if (!emp.workDays || emp.workDays.length === 0) {
          await updateEmployee({ ...emp, workDays: [1, 2, 3, 4, 5] });
          updatedCount++;
       }
    }
    alert(`${updatedCount} colaboradores foram atualizados para o padrão Segunda a Sexta com sucesso!`);
  };

  const formatToYMD = (dateVal: any) => {
    if (!dateVal) return '';
    let str = String(dateVal).trim();

    if (/^\d{4,5}$/.test(str)) {
      const jsDate = new Date(Math.round((Number(str) - 25569) * 86400 * 1000));
      return jsDate.toISOString().split('T')[0];
    }

    str = str.split('T')[0].split(' ')[0];

    const corruptMatch = str.match(/^(\d{4})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (corruptMatch) {
        const wrongYear = corruptMatch[1]; 
        const month = corruptMatch[2]; 
        const actualYear = corruptMatch[3]; 
        const actualDay = wrongYear.substring(2); 
        return `${actualYear}-${month}-${actualDay}`;
    }

    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        let p0 = parts[0], p1 = parts[1], p2 = parts[2];
        if (p0.length === 4) return `${p0}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
        else if (p2.length === 4) { 
            let m = Number(p1);
            if (m > 12) return `${p2}-${p0.padStart(2, '0')}-${p1.padStart(2, '0')}`;
            else return `${p2}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`;
        } else if (p2.length === 2) { 
            let y = Number(p2) > 50 ? 1900 + Number(p2) : 2000 + Number(p2);
            return `${y}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`;
        }
    }

    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch(e) {}
    return '';
  };

  const formatDate = (dateVal: any) => {
    const ymd = formatToYMD(dateVal); 
    if (!ymd) return '-';
    const parts = ymd.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; 
    }
    return String(dateVal);
  };

  const handleEdit = (emp: Employee) => {
    let mainReason = emp.terminationReason || '';
    let obsText = '';
    
    if (mainReason.includes(' | Obs: ')) {
       const parts = mainReason.split(' | Obs: ');
       mainReason = parts[0];
       obsText = parts[1] || '';
    } else if (mainReason.startsWith('Outros: ')) {
       mainReason = 'Outros';
       obsText = emp.terminationReason?.replace('Outros: ', '') || '';
    }

    setFormData({ 
      ...emp, 
      dailyWorkload: emp.dailyWorkload || 8.8, 
      probationType: emp.probationType || '45+45',
      workSchedule: (emp as any).workSchedule || '',
      workDays: emp.workDays || [1, 2, 3, 4, 5], 
      birthDate: formatToYMD(emp.birthDate),
      admissionDate: formatToYMD(emp.admissionDate),
      leaveStartDate: formatToYMD((emp as any).leaveStartDate),
      leaveExpectedReturn: formatToYMD(emp.leaveExpectedReturn),
      leaveReason: emp.leaveReason || '',
      terminationDate: formatToYMD(emp.terminationDate),
      terminationReason: mainReason,
      actualReturnDate: new Date().toISOString().split('T')[0]
    });
    setTerminationObservation(obsText);
    setView('form');
  };

  const toggleWorkDay = (dayValue: number) => {
    const currentDays = formData.workDays || [];
    if (currentDays.includes(dayValue)) {
        setFormData({ ...formData, workDays: currentDays.filter((d: number) => d !== dayValue) });
    } else {
        setFormData({ ...formData, workDays: [...currentDays, dayValue].sort() });
    }
  };

  const openDetails = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowEventForm(false);
    setView('details');
  };

  const handleAddHistoryEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    let updatedHistory = [...(selectedEmployee.history || [])];

    if (newEvent.type === 'Afastamento Retroativo') {
       if (!newEvent.date || !newEvent.endDate || !newEvent.leaveReason) {
          alert("Preencha todas as datas e o motivo para o afastamento retroativo.");
          return;
       }
       updatedHistory.push({
          id: crypto.randomUUID(),
          date: newEvent.date,
          type: 'Outros',
          description: `[INÍCIO DE AFASTAMENTO] Motivo: ${newEvent.leaveReason} | Lançado retroativamente`,
          createdBy: user?.name || 'Sistema'
       });
       updatedHistory.push({
          id: crypto.randomUUID(),
          date: newEvent.endDate,
          type: 'Outros',
          description: `[FIM DE AFASTAMENTO] Colaborador retornou às atividades. (Afastamento concluído)`,
          createdBy: user?.name || 'Sistema'
       });
    } else {
       if (!newEvent.description) return;

       if (newEvent.id) {
         updatedHistory = updatedHistory.map(h => 
           h.id === newEvent.id 
             ? { ...h, date: newEvent.date!, type: newEvent.type as EmployeeHistoryType, description: newEvent.description! }
             : h
         );
       } else {
         updatedHistory.push({
           id: crypto.randomUUID(),
           date: newEvent.date || new Date().toISOString().split('T')[0],
           type: newEvent.type as EmployeeHistoryType || 'Outros',
           description: newEvent.description,
           createdBy: user?.name || 'Sistema'
         });
       }
    }

    const updatedEmployee = { ...selectedEmployee, history: updatedHistory };
    await updateEmployee(updatedEmployee); 
    setSelectedEmployee(updatedEmployee);  
    
    setShowEventForm(false); 
    setNewEvent({ id: undefined, date: new Date().toISOString().split('T')[0], type: 'Outros', description: '', endDate: '', leaveReason: '' }); 
  };

  const handleEditHistoryEvent = (record: EmployeeHistoryRecord) => {
    setNewEvent({
      id: record.id,
      date: record.date,
      type: record.type,
      description: record.description
    });
    setShowEventForm(true);
  };

  const handleDeleteHistoryEvent = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir este registro do histórico?")) return;
    if (!selectedEmployee) return;

    const updatedHistory = (selectedEmployee.history || []).filter(h => h.id !== id);
    const updatedEmployee = { ...selectedEmployee, history: updatedHistory };
    
    await updateEmployee(updatedEmployee);
    setSelectedEmployee(updatedEmployee);
  };

  const getContractBadgeColor = (type: string | undefined) => {
    switch (type) {
      case 'CLT': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'PJ': return 'bg-purple-50 text-purple-700 border-purple-100';
      case 'Estagiário': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'JA': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  const standardTerminations = ['Pedido de Demissão (Voluntário)', 'Demissão sem justa causa (Involuntário)', 'Demissão por justa causa', 'Término de Contrato', 'Acordo Mútuo'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg">
            <Contact size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Colaboradores</h1>
            <p className="text-slate-500 text-sm font-medium">Gestão de quadro e histórico funcional</p>
          </div>
        </div>
        
        {view === 'list' && (
          <div className="flex flex-wrap gap-2">
            <button 
                onClick={handleSyncWorkDays}
                className="flex items-center justify-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm"
                title="Aplica Seg-Sex para todos os colaboradores que estiverem sem dias configurados"
            >
                <RefreshCw size={18} />
                <span className="hidden sm:inline">Sincronizar Dias Trabalhados</span>
            </button>
            <button 
                onClick={() => { 
                    setFormData({ status: 'Ativo', contractType: 'CLT', dailyWorkload: 8.8, probationType: '45+45', workSchedule: '', workDays: [1,2,3,4,5], history: [], leaveStartDate: '', leaveExpectedReturn: '', leaveReason: '' }); 
                    setTerminationObservation('');
                    setView('form'); 
                }}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg"
            >
                <Plus size={20} />
                <span>Admitir Colaborador</span>
            </button>
          </div>
        )}
      </div>

      {view === 'list' && (
        <>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome ou cargo..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200 hidden xl:flex">
                <Clock size={16} className="text-slate-400" />
                <select 
                  className="bg-transparent py-2 text-sm outline-none cursor-pointer max-w-[150px] truncate"
                  value={scheduleFilter}
                  onChange={e => setScheduleFilter(e.target.value)}
                >
                  <option value="Todos">Todos os Turnos</option>
                  {SCHEDULE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
                <Briefcase size={16} className="text-slate-400" />
                <select 
                  className="bg-transparent py-2 text-sm outline-none cursor-pointer"
                  value={contractFilter}
                  onChange={e => setContractFilter(e.target.value as any)}
                >
                  <option value="Todos">Todos Contratos</option>
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="Estagiário">Estagiário</option>
                  <option value="JA">Jovem Aprendiz</option>
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
                <Filter size={16} className="text-slate-400" />
                <select 
                  className="bg-transparent py-2 text-sm outline-none cursor-pointer min-w-[120px]"
                  value={sectorFilter}
                  onChange={e => setSectorFilter(e.target.value)}
                >
                  <option value="Todos">Todos Setores</option>
                  {settings.filter((s:any) => s.type === 'SECTOR').map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              
              <select 
                className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${statusFilter === 'Pendentes' ? 'bg-orange-50 border-orange-300 text-orange-800 font-bold' : 'border-slate-200 bg-white'}`} 
                value={statusFilter} 
                onChange={e => setStatusFilter(e.target.value as any)}
              >
                <option value="Todos">Todos os Status</option>
                <option value="Ativo">Ativos</option>
                <option value="Afastado">Afastados</option>
                <option value="Inativo">Inativos</option>
                <option value="Pendentes" className="text-orange-600 font-bold">⚠️ Pendências</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map((emp: any) => (
              <div 
                key={emp.id} 
                className={`bg-white border-2 rounded-2xl overflow-hidden hover:shadow-md transition-all group relative ${
                  emp.hasPendingInfo ? 'border-orange-400 shadow-lg shadow-orange-50/50 bg-orange-50/20' : 'border-slate-200'
                }`}
              >
                {emp.hasPendingInfo && <div className="absolute top-0 left-0 w-full h-1.5 bg-orange-400"></div>}

                <div className="p-5 mt-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-wrap gap-2">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        emp.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 
                        emp.status === 'Afastado' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {emp.status}
                      </div>
                      <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getContractBadgeColor(emp.contractType)}`}>
                        {emp.contractType || 'CLT'}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(emp)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                      <button onClick={() => removeEmployee(emp.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-slate-800 text-lg mb-1 truncate">{emp.name}</h3>
                  <p className="text-slate-500 text-sm flex items-center flex-wrap gap-1.5 mb-2 truncate">
                    <Briefcase size={14} className="text-slate-400" /> 
                    <span>{emp.role}</span>
                    <span className="text-slate-300">•</span>
                    <span>{emp.sector}</span>
                  </p>

                  <p className="text-slate-500 text-xs flex items-center flex-wrap gap-1.5 mb-4 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                    <Clock size={14} className="text-blue-400" /> 
                    <span className="font-medium truncate">{(emp as any).workSchedule || 'Horário não definido'}</span>
                  </p>

                  {emp.hasPendingInfo && (
                    <div className="flex items-center gap-2 text-orange-600 mb-4 bg-orange-100 p-2 rounded-lg border border-orange-200">
                       <AlertCircle size={14} className="animate-pulse shrink-0" />
                       <span className="text-[10px] font-black uppercase tracking-wider">Verifique o Setor Importado</span>
                    </div>
                  )}

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center text-xs text-slate-600 gap-2">
                      <Calendar size={14} className="text-slate-400" /> Adm: {formatDate(emp.admissionDate)}
                    </div>
                    <div className="flex items-center text-xs text-slate-600 gap-2">
                      <Phone size={14} className="text-slate-400" /> {emp.phone}
                    </div>
                  </div>

                  <button onClick={() => openDetails(emp)} className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                    Ver Perfil e Histórico <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}

            {filteredEmployees.length === 0 && (
              <div className="md:col-span-2 lg:col-span-3 py-12 text-center text-slate-400">
                Nenhum colaborador encontrado com estes filtros.
              </div>
            )}
          </div>
        </>
      )}

      {view === 'form' && (
        <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">{formData.id ? 'Editar Colaborador' : 'Novo Cadastro de Colaborador'}</h2>
              <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600 transition-colors"><XCircle size={24}/></button>
            </div>
            
            {formData.hasPendingInfo && (
               <div className="bg-orange-50 border-b border-orange-200 p-4 flex items-start gap-3 text-orange-800">
                 <AlertCircle className="mt-0.5 flex-shrink-0" />
                 <div>
                   <h4 className="font-bold text-sm">Atenção na Importação</h4>
                   <p className="text-xs">O setor "{formData.sector}" vindo da planilha não está cadastrado nas configurações. Selecione um setor válido abaixo e salve para resolver a pendência.</p>
                 </div>
               </div>
            )}
            
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-sm font-bold text-slate-700">Nome Completo</label>
                  <input required className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Regime de Contratação</label>
                  <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                    {(['CLT', 'PJ', 'Estagiário', 'JA'] as ContractType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({...formData, contractType: type})}
                        className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all ${
                          formData.contractType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Status Atual</label>
                  <select className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={formData.status || 'Ativo'} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="Ativo">Ativo</option>
                    <option value="Afastado">Afastado</option>
                    <option value="Inativo">Inativo (Desligado)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Setor</label>
                    <select 
                      required 
                      className={`w-full border p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white ${formData.hasPendingInfo ? 'border-orange-400 ring-2 ring-orange-100' : 'border-slate-200'}`} 
                      value={formData.sector || ''} 
                      onChange={e => setFormData({...formData, sector: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {settings.filter((s:any) => s.type === 'SECTOR').map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      {formData.sector && !settings.some((s:any) => s.type === 'SECTOR' && s.name === formData.sector) && (
                        <option value={formData.sector} disabled>{formData.sector} (Inativo)</option>
                      )}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Unidade</label>
                    <select 
                      required 
                      className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                      value={formData.unit || ''} 
                      onChange={e => setFormData({...formData, unit: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {settings.filter((s:any) => s.type === 'UNIT').map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                      {formData.unit && !settings.some((s:any) => s.type === 'UNIT' && s.name === formData.unit) && (
                        <option value={formData.unit} disabled>{formData.unit} (Inativo)</option>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Cargo</label>
                  <input required className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Telefone</label>
                  <input required className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:col-span-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nascimento</label>
                    <input type="date" required className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Admissão</label>
                    <input type="date" required className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.admissionDate || ''} onChange={e => setFormData({...formData, admissionDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex justify-between">
                      <span>Jornada (H/Dia)</span>
                    </label>
                    <input 
                      type="number" 
                      step="0.1" 
                      required 
                      className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                      value={formData.dailyWorkload || 8.8} 
                      onChange={e => setFormData({...formData, dailyWorkload: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Contrato Exp.</label>
                    <select 
                      required 
                      className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                      value={formData.probationType || '45+45'} 
                      onChange={e => setFormData({...formData, probationType: e.target.value as ProbationType})}
                    >
                      <option value="45+45">45 + 45 dias</option>
                      <option value="30+60">30 + 60 dias</option>
                      <option value="Nenhum">Sem Experiência</option>
                    </select>
                  </div>
                  
                  {/* CAMPO DE TURNO / HORÁRIO */}
                  <div className="space-y-2 md:col-span-2 mt-2">
                    <label className="text-sm font-bold text-slate-700">Turno / Horário de Trabalho</label>
                    <select 
                      required 
                      className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white" 
                      value={formData.workSchedule || ''} 
                      onChange={e => setFormData({...formData, workSchedule: e.target.value})}
                    >
                      <option value="">Selecione o Horário...</option>
                      {SCHEDULE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  {/* CAMPO: DIAS DE TRABALHO */}
                  <div className="space-y-2 md:col-span-2 mt-2">
                    <label className="text-sm font-bold text-slate-700">Dias de Trabalho (Ignora nos Atestados)</label>
                    <div className="flex gap-1">
                       {WEEK_DAYS.map(day => (
                          <button
                             key={day.value}
                             type="button"
                             onClick={() => toggleWorkDay(day.value)}
                             className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                                (formData.workDays || []).includes(day.value)
                                   ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                                   : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                             }`}
                          >
                             {day.label}
                          </button>
                       ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* BLOCO: AFASTAMENTO (Aparece se está afastando agora OU se está retornando para permitir edição do passado) */}
              {(formData.status === 'Afastado' || isReturningFromLeave) && (
                <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-amber-800">Data de Início (Afastamento)</label>
                      <input type="date" required className="w-full border border-amber-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white" value={formData.leaveStartDate || ''} onChange={e => setFormData({...formData, leaveStartDate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-amber-800">Previsão de Retorno (Opcional)</label>
                      <input type="date" className="w-full border border-amber-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white" value={formData.leaveExpectedReturn || ''} onChange={e => setFormData({...formData, leaveExpectedReturn: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-amber-200 pt-3">
                    <label className="text-sm font-bold text-amber-800">Motivo do Afastamento</label>
                    <input required className="w-full border border-amber-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white" placeholder="Ex: Licença Maternidade, INSS..." value={formData.leaveReason || ''} onChange={e => setFormData({...formData, leaveReason: e.target.value})} />
                  </div>
                </div>
              )}

              {/* BLOCO DE RETORNO RETROATIVO DE AFASTAMENTO */}
              {isReturningFromLeave && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-4 animate-in fade-in">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-emerald-800">Data Efetiva do Retorno (Retroativa ou Hoje)</label>
                    <input 
                       type="date" 
                       required 
                       className="w-full border border-emerald-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                       value={formData.actualReturnDate || ''} 
                       onChange={e => setFormData({...formData, actualReturnDate: e.target.value})} 
                    />
                    <p className="text-xs text-emerald-700 mt-1 font-medium">Esta data será registrada no histórico funcional como o fim do afastamento. Você pode ajustar a data de início na caixa amarela acima, caso ela estivesse errada.</p>
                  </div>
                </div>
              )}

              {formData.status === 'Inativo' && (
                <div className="p-5 bg-red-50 border border-red-200 rounded-xl space-y-4 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-red-800">Data de Desligamento</label>
                      <input required type="date" className="w-full border border-red-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white" value={formData.terminationDate || ''} onChange={e => setFormData({...formData, terminationDate: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-red-800">Motivo Principal</label>
                      <select 
                        required 
                        className="w-full border border-red-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white" 
                        value={formData.terminationReason === 'Outros' || !standardTerminations.includes(formData.terminationReason || '') ? (formData.terminationReason ? 'Outros' : '') : formData.terminationReason} 
                        onChange={e => setFormData({...formData, terminationReason: e.target.value})}
                      >
                        <option value="">Selecione...</option>
                        {standardTerminations.map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="Outros">Outros (Descrever abaixo)</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-red-200 pt-3">
                     <label className="text-sm font-bold text-red-800 flex items-center gap-1"><FileText size={14}/> Observações Adicionais (RH)</label>
                     <textarea 
                        className="w-full border border-red-300 p-3 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white resize-none shadow-inner" 
                        rows={3}
                        placeholder="Adicione notas, histórico de performance, motivos do pedido de demissão, etc..." 
                        value={terminationObservation} 
                        onChange={e => setTerminationObservation(e.target.value)} 
                     />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setView('list')} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg transition-all active:scale-95">
                  <Save size={20} /> Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view === 'details' && selectedEmployee && (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <button onClick={() => setView('list')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold mb-6 transition-colors group">
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" /> Voltar para a lista
          </button>
          
          {selectedEmployee.hasPendingInfo && (
            <div className="bg-orange-100 border border-orange-200 text-orange-800 p-4 rounded-xl mb-6 flex items-center gap-3">
              <AlertCircle />
              <div>
                <p className="font-bold">Colaborador com Pendência</p>
                <p className="text-sm">Edite este perfil para corrigir as informações (provavelmente o Setor).</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-blue-50">
                <Contact size={48} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{selectedEmployee.name}</h2>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                <span className={`px-4 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${getContractBadgeColor(selectedEmployee.contractType)}`}>
                  {selectedEmployee.contractType}
                </span>
                <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                    selectedEmployee.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 
                    selectedEmployee.status === 'Afastado' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>
                  {selectedEmployee.status}
                </span>
              </div>
              <div className="mt-8 space-y-4 text-left border-t pt-6 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Setor:</span> <span className="font-bold text-slate-700">{selectedEmployee.sector}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Unidade:</span> <span className="font-bold text-slate-700">{selectedEmployee.unit || 'Não informada'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cargo:</span> <span className="font-bold text-slate-700">{selectedEmployee.role}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Telefone:</span> <span className="font-bold text-slate-700">{selectedEmployee.phone}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Nascimento:</span> <span className="font-bold text-slate-700">{formatDate(selectedEmployee.birthDate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Admissão:</span> <span className="font-bold text-slate-700">{formatDate(selectedEmployee.admissionDate)}</span></div>
                
                {/* BLOCO: AFASTADO */}
                {selectedEmployee.status === 'Afastado' && (
                  <>
                    <div className="flex justify-between border-t border-amber-100 pt-3"><span className="text-amber-500">Início Afastamento:</span> <span className="font-bold text-amber-600">{formatDate((selectedEmployee as any).leaveStartDate)}</span></div>
                    <div className="flex justify-between"><span className="text-amber-500">Previsão Retorno:</span> <span className="font-bold text-amber-600">{selectedEmployee.leaveExpectedReturn ? formatDate(selectedEmployee.leaveExpectedReturn) : 'Sem previsão'}</span></div>
                    <div className="flex flex-col gap-1 border-t border-amber-50 pt-2">
                       <span className="text-amber-500 text-xs">Motivo / CID:</span> 
                       <span className="font-bold text-amber-700 leading-tight bg-amber-50 p-2 rounded-lg">{selectedEmployee.leaveReason || 'Não informado'}</span>
                    </div>
                  </>
                )}

                {/* BLOCO: INATIVO */}
                {selectedEmployee.status === 'Inativo' && (
                  <>
                    <div className="flex justify-between border-t border-red-100 pt-3"><span className="text-red-400">Desligamento:</span> <span className="font-bold text-red-600">{formatDate((selectedEmployee as any).terminationDate)}</span></div>
                    <div className="flex flex-col gap-1 border-t border-red-50 pt-2">
                       <span className="text-red-400 text-xs">Motivo / Observações:</span> 
                       <span className="font-bold text-red-700 leading-tight bg-red-50 p-2 rounded-lg">{selectedEmployee.terminationReason}</span>
                    </div>
                  </>
                )}

                <div className="flex justify-between border-t border-slate-100 pt-3"><span className="text-slate-400">Jornada (h/dia):</span> <span className="font-bold text-slate-700">{selectedEmployee.dailyWorkload || 8.8}</span></div>
                
                <div className="flex flex-col gap-1 border-t border-slate-100 pt-3">
                  <span className="text-slate-400 text-xs">Turno de Trabalho:</span> 
                  <span className="font-bold text-slate-700 text-right">{(selectedEmployee as any).workSchedule || 'Não definido'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 text-xs">Dias da Semana:</span> 
                  <span className="font-bold text-slate-700 text-right">
                     {selectedEmployee.workDays ? selectedEmployee.workDays.map(d => WEEK_DAYS.find(wd => wd.value === d)?.label).join(', ') : 'Seg, Ter, Qua, Qui, Sex'}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm min-h-[400px]">
              <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <History className="text-blue-600" /> Histórico Funcional
                </h3>
                <button 
                  onClick={() => setShowEventForm(!showEventForm)} 
                  className="text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                  <Plus size={16} /> Novo Evento
                </button>
              </div>

              {showEventForm && (
                <form onSubmit={handleAddHistoryEvent} className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-8 animate-in fade-in slide-in-from-top-2">
                  <h4 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">
                    {newEvent.id ? 'Editar Acontecimento' : 'Registrar Acontecimento'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Data (Início)</label>
                      <input type="date" required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500">Tipo de Evento</label>
                      <select required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as EmployeeHistoryType})}>
                        <option value="Promoção">Promoção / Mudança de Cargo</option>
                        <option value="Mudança de Setor">Mudança de Setor / Unidade</option>
                        <option value="Afastamento Retroativo">Afastamento Retroativo (Já Concluído)</option>
                        <option value="Outros">Outros (Conversão PJ, Feedback, etc)</option>
                      </select>
                    </div>

                    {/* CAMPOS EXTRAS PARA AFASTAMENTO RETROATIVO */}
                    {newEvent.type === 'Afastamento Retroativo' ? (
                      <>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Data Final (Retorno)</label>
                          <input type="date" required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newEvent.endDate || ''} onChange={e => setNewEvent({...newEvent, endDate: e.target.value})} />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-bold text-slate-500">Motivo do Afastamento (CID, etc)</label>
                          <input type="text" required placeholder="Ex: Licença Médica..." className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newEvent.leaveReason || ''} onChange={e => setNewEvent({...newEvent, leaveReason: e.target.value})} />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1 md:col-span-3">
                        <label className="text-xs font-bold text-slate-500">Descrição Detalhada</label>
                        <input type="text" required placeholder="Ex: Colaborador foi efetivado para PJ com salário de X..." className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} />
                      </div>
                    )}

                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowEventForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm">
                      {newEvent.id ? 'Salvar Alterações' : 'Salvar Registro'}
                    </button>
                  </div>
                </form>
              )}

              <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
                {unifiedHistory.map((item: any, index) => (
                  <div key={index} className="relative pl-8">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${item.isAbsence ? 'bg-red-500' : 'bg-blue-600'}`}></div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 uppercase">{formatDate(item.date)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${item.isAbsence ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{item.type || 'Falta'}</span>
                      </div>
                      
                      {/* BOTOES DE EDICAO PARA EVENTOS MANUAIS */}
                      {!item.isAbsence && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEditHistoryEvent(item)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Editar Evento"><Edit2 size={14}/></button>
                          <button onClick={() => handleDeleteHistoryEvent(item.id)} className="text-slate-400 hover:text-red-600 transition-colors" title="Excluir Evento"><Trash2 size={14}/></button>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-slate-700 font-medium">{item.description}</p>
                  </div>
                ))}

                {unifiedHistory.length === 0 && (
                  <div className="text-slate-400 text-sm py-4 italic">Nenhum evento no histórico.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};