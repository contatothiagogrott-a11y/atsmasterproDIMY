import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Employee, EmployeeStatus, EmployeeHistoryRecord, ContractType, EmployeeHistoryType, ProbationType } from '../types';
import { 
  Contact, Plus, Search, Filter, Edit2, Trash2, 
  History, Calendar, Phone, Briefcase, MapPin, 
  ChevronRight, ArrowLeft, Save, AlertCircle, XCircle
} from 'lucide-react';

export const Colaboradores: React.FC = () => {
  const { employees = [], addEmployee, updateEmployee, removeEmployee, settings = [], absences = [], user } = useData();
  
  const [view, setView] = useState<'list' | 'form' | 'details'>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'Todos' | 'Pendentes'>('Ativo');
  const [sectorFilter, setSectorFilter] = useState('Todos');
  const [unitFilter, setUnitFilter] = useState('Todas');

  const [formData, setFormData] = useState<Partial<Employee>>({
    status: 'Ativo',
    contractType: 'CLT',
    dailyWorkload: 8.8,
    probationType: '45+45', // <--- VALOR PADRÃO
    history: []
  });

  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<EmployeeHistoryRecord>>({
    date: new Date().toISOString().split('T')[0],
    type: 'Outros',
    description: ''
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           emp.role.toLowerCase().includes(searchTerm.toLowerCase());
                           
      let matchesStatus = false;
      if (statusFilter === 'Todos') matchesStatus = true;
      else if (statusFilter === 'Pendentes') matchesStatus = !!emp.hasPendingInfo;
      else matchesStatus = emp.status === statusFilter;

      const matchesSector = sectorFilter === 'Todos' || emp.sector === sectorFilter;
      const matchesUnit = unitFilter === 'Todas' || emp.unit === unitFilter;

      return matchesSearch && matchesStatus && matchesSector && matchesUnit;
    });
  }, [employees, searchTerm, statusFilter, sectorFilter, unitFilter]);

  const unifiedHistory = useMemo(() => {
    if (!selectedEmployee) return [];
    
    const employeeAbsences = absences
      .filter(a => a.employeeName.toLowerCase() === selectedEmployee.name.toLowerCase())
      .map(a => ({
        id: a.id,
        date: a.absenceDate,
        type: 'Falta/Afastamento',
        description: `Registro de ${a.documentType}: ${a.reason} (${a.durationAmount || 1} ${a.durationUnit || 'Dias'})`,
        isAbsence: true
      }));

    const manualHistory = (selectedEmployee.history || []).map(h => ({ ...h, isAbsence: false }));
    
    return [...employeeAbsences, ...manualHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [selectedEmployee, absences]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const employeeData = {
      ...formData,
      id: formData.id || crypto.randomUUID(),
      hasPendingInfo: false,
      createdAt: formData.createdAt || new Date().toISOString(),
      history: formData.history || []
    } as Employee;

    if (formData.id) {
      await updateEmployee(employeeData);
    } else {
      await addEmployee(employeeData);
    }
    setView('list');
    setFormData({ status: 'Ativo', contractType: 'CLT', dailyWorkload: 8.8, probationType: '45+45', history: [] });
  };

  const handleEdit = (emp: Employee) => {
    setFormData({ ...emp, dailyWorkload: emp.dailyWorkload || 8.8, probationType: emp.probationType || '45+45' });
    setView('form');
  };

  const openDetails = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowEventForm(false);
    setView('details');
  };

  const handleAddHistoryEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !newEvent.description) return;

    const eventRecord: EmployeeHistoryRecord = {
      id: crypto.randomUUID(),
      date: newEvent.date || new Date().toISOString().split('T')[0],
      type: newEvent.type as EmployeeHistoryType || 'Outros',
      description: newEvent.description,
      createdBy: user?.name || 'Sistema'
    };

    const updatedHistory = [...(selectedEmployee.history || []), eventRecord];
    const updatedEmployee = { ...selectedEmployee, history: updatedHistory };

    await updateEmployee(updatedEmployee); 
    setSelectedEmployee(updatedEmployee);  
    
    setShowEventForm(false); 
    setNewEvent({ date: new Date().toISOString().split('T')[0], type: 'Outros', description: '' }); 
  };

  const formatDate = (dateVal: string | undefined | null) => {
    if (!dateVal) return '-';
    const dateStr = String(dateVal);
    if (dateStr.includes('-')) {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
      }
    }
    return dateStr; 
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
          <button 
            onClick={() => { setFormData({ status: 'Ativo', contractType: 'CLT', dailyWorkload: 8.8, probationType: '45+45', history: [] }); setView('form'); }}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg"
          >
            <Plus size={20} />
            <span>Admitir Colaborador</span>
          </button>
        )}
      </div>

      {view === 'list' && (
        <>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome ou cargo..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
              />
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-3">
              <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
                <Filter size={16} className="text-slate-400" />
                <select 
                  className="bg-transparent py-2 text-sm outline-none cursor-pointer min-w-[120px]"
                  value={sectorFilter}
                  onChange={e => setSectorFilter(e.target.value)}
                >
                  <option value="Todos">Todos os Setores</option>
                  {settings.filter(s => s.type === 'SECTOR').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-200">
                <MapPin size={16} className="text-slate-400" />
                <select 
                  className="bg-transparent py-2 text-sm outline-none cursor-pointer min-w-[120px]"
                  value={unitFilter}
                  onChange={e => setUnitFilter(e.target.value)}
                >
                  <option value="Todas">Todas as Unidades</option>
                  {settings.filter(s => s.type === 'UNIT').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
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
                <option value="Pendentes" className="text-orange-600 font-bold">⚠️ Com Pendências</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map(emp => (
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
                  
                  <h3 className="font-bold text-slate-800 text-lg mb-1">{emp.name}</h3>
                  <p className="text-slate-500 text-sm flex items-center flex-wrap gap-1.5 mb-4">
                    <Briefcase size={14} className="text-slate-400" /> 
                    <span>{emp.role}</span>
                    <span className="text-slate-300">•</span>
                    <span>{emp.sector}</span>
                    {emp.unit && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>{emp.unit}</span>
                      </>
                    )}
                  </p>

                  {emp.hasPendingInfo && (
                    <div className="flex items-center gap-2 text-orange-600 mb-4 bg-orange-100 p-2 rounded-lg border border-orange-200">
                       <AlertCircle size={14} className="animate-pulse" />
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
                      {settings.filter(s => s.type === 'SECTOR').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      {formData.sector && !settings.some(s => s.type === 'SECTOR' && s.name === formData.sector) && (
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
                      {settings.filter(s => s.type === 'UNIT').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      {formData.unit && !settings.some(s => s.type === 'UNIT' && s.name === formData.unit) && (
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
                      <span>Jornada (Horas)</span>
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
                  {/* NOVO CAMPO: EXPERIÊNCIA */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Contrato de Exp.</label>
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
                </div>
              </div>

              {formData.status === 'Afastado' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-amber-800">Motivo do Afastamento</label>
                    <input className="w-full border border-amber-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white" placeholder="Ex: Licença Maternidade, INSS..." value={formData.leaveReason || ''} onChange={e => setFormData({...formData, leaveReason: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-amber-800">Previsão de Retorno</label>
                    <input type="date" className="w-full border border-amber-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-amber-500 bg-white" value={formData.leaveExpectedReturn || ''} onChange={e => setFormData({...formData, leaveExpectedReturn: e.target.value})} />
                  </div>
                </div>
              )}

              {formData.status === 'Inativo' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <label className="text-sm font-bold text-red-800">Motivo do Desligamento</label>
                  <input className="w-full border border-red-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-red-500 bg-white" placeholder="Ex: Pedido de demissão..." value={formData.terminationReason || ''} onChange={e => setFormData({...formData, terminationReason: e.target.value})} />
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
                <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${selectedEmployee.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {selectedEmployee.status}
                </span>
              </div>
              <div className="mt-8 space-y-4 text-left border-t pt-6 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Setor:</span> <span className="font-bold text-slate-700">{selectedEmployee.sector}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Unidade:</span> <span className="font-bold text-slate-700">{selectedEmployee.unit || 'Não informada'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cargo:</span> <span className="font-bold text-slate-700">{selectedEmployee.role}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Telefone:</span> <span className="font-bold text-slate-700">{selectedEmployee.phone}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Admissão:</span> <span className="font-bold text-slate-700">{formatDate(selectedEmployee.admissionDate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Jornada (h/dia):</span> <span className="font-bold text-slate-700">{selectedEmployee.dailyWorkload || 8.8}</span></div>
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
                  <h4 className="font-bold text-slate-700 mb-4 text-sm uppercase tracking-wider">Registrar Acontecimento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500">Data</label>
                      <input type="date" required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500">Tipo de Evento</label>
                      <select required className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value as EmployeeHistoryType})}>
                        <option value="Promoção">Promoção / Mudança de Cargo</option>
                        <option value="Mudança de Setor">Mudança de Setor / Unidade</option>
                        <option value="Outros">Outros (Conversão PJ, Feedback, etc)</option>
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className="text-xs font-bold text-slate-500">Descrição Detalhada</label>
                      <input type="text" required placeholder="Ex: Colaborador foi efetivado para PJ com salário de X..." className="w-full border border-slate-300 p-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowEventForm(false)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm">Salvar Registro</button>
                  </div>
                </form>
              )}

              <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
                {unifiedHistory.map((item: any, index) => (
                  <div key={index} className="relative pl-8">
                    <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${item.isAbsence ? 'bg-red-500' : 'bg-blue-600'}`}></div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-400 uppercase">{formatDate(item.date)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${item.isAbsence ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>{item.type || 'Falta'}</span>
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