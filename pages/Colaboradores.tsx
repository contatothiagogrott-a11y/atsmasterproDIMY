import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Employee, EmployeeStatus, EmployeeHistoryRecord, AbsenceRecord } from '../types';
import { 
  Contact, Plus, Search, Filter, Edit2, Trash2, 
  History, Calendar, Phone, Briefcase, MapPin, 
  ChevronRight, ArrowLeft, Save, AlertCircle, XCircle, CheckCircle
} from 'lucide-react';

export const Colaboradores: React.FC = () => {
  const { employees, addEmployee, updateEmployee, removeEmployee, settings, absences, user } = useData();
  
  const [view, setView] = useState<'list' | 'form' | 'details'>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | 'Todos'>('Ativo');

  const [formData, setFormData] = useState<Partial<Employee>>({
    status: 'Ativo',
    history: []
  });

  // --- FILTROS ---
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           emp.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'Todos' || emp.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [employees, searchTerm, statusFilter]);

  // --- HISTÓRICO UNIFICADO (Manuais + Absenteísmo) ---
  const unifiedHistory = useMemo(() => {
    if (!selectedEmployee) return [];

    // Faltas do Absenteísmo relacionadas a este nome
    const employeeAbsences = absences
      .filter(a => a.employeeName.toLowerCase() === selectedEmployee.name.toLowerCase())
      .map(a => ({
        id: a.id,
        date: a.absenceDate,
        type: 'Falta/Afastamento' as any,
        description: `Registro de ${a.documentType}: ${a.reason} (${a.documentDuration})`,
        isAbsence: true
      }));

    // Histórico manual do cadastro
    const manualHistory = (selectedEmployee.history || []).map(h => ({ ...h, isAbsence: false }));

    return [...employeeAbsences, ...manualHistory].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [selectedEmployee, absences]);

  // --- HANDLERS ---
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const employeeData = {
      ...formData,
      id: formData.id || crypto.randomUUID(),
      createdAt: formData.createdAt || new Date().toISOString(),
      history: formData.history || []
    } as Employee;

    if (formData.id) {
      await updateEmployee(employeeData);
    } else {
      await addEmployee(employeeData);
    }
    setView('list');
    setFormData({ status: 'Ativo', history: [] });
  };

  const handleEdit = (emp: Employee) => {
    setFormData(emp);
    setView('form');
  };

  const openDetails = (emp: Employee) => {
    setSelectedEmployee(emp);
    setView('details');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-blue-200 shadow-lg">
            <Contact size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Colaboradores</h1>
            <p className="text-slate-500 text-sm font-medium">Gestão de quadro e histórico funcional</p>
          </div>
        </div>
        
        {view === 'list' && (
          <button 
            onClick={() => { setFormData({ status: 'Ativo', history: [] }); setView('form'); }}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
          >
            <Plus size={20} />
            <span>Admitir Colaborador</span>
          </button>
        )}
      </div>

      {/* VIEW: LISTAGEM */}
      {view === 'list' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por nome ou cargo..." 
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select 
              className="border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
            >
              <option value="Todos">Todos os Status</option>
              <option value="Ativo">Ativos</option>
              <option value="Afastado">Afastados</option>
              <option value="Inativo">Inativos (Arquivados)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEmployees.map(emp => (
              <div key={emp.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all group">
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      emp.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 
                      emp.status === 'Afastado' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {emp.status}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(emp)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16}/></button>
                      <button onClick={() => removeEmployee(emp.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  
                  <h3 className="font-bold text-slate-800 text-lg mb-1">{emp.name}</h3>
                  <p className="text-slate-500 text-sm flex items-center gap-1.5 mb-4">
                    <Briefcase size={14} /> {emp.role} • {emp.sector}
                  </p>

                  <div className="space-y-2 mb-6">
                    <div className="flex items-center text-xs text-slate-600 gap-2">
                      <Calendar size={14} className="text-slate-400" /> Adm: {formatDate(emp.admissionDate)}
                    </div>
                    <div className="flex items-center text-xs text-slate-600 gap-2">
                      <Phone size={14} className="text-slate-400" /> {emp.phone}
                    </div>
                  </div>

                  <button 
                    onClick={() => openDetails(emp)}
                    className="w-full py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    Ver Perfil e Histórico <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* VIEW: FORMULÁRIO (Cadastro/Edição) */}
      {view === 'form' && (
        <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">{formData.id ? 'Editar Colaborador' : 'Novo Cadastro de Colaborador'}</h2>
              <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600"><XCircle size={24}/></button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nome Completo</label>
                  <input required className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Status Atual</label>
                  <select className="w-full border border-slate-200 p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                    <option value="Ativo">Ativo</option>
                    <option value="Afastado">Afastado</option>
                    <option value="Inativo">Inativo (Desligado)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Setor</label>
                  <select required className="w-full border border-slate-200 p-3 rounded-xl" value={formData.sector || ''} onChange={e => setFormData({...formData, sector: e.target.value})}>
                    <option value="">Selecione...</option>
                    {settings.filter(s => s.type === 'SECTOR').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Cargo</label>
                  <input required className="w-full border border-slate-200 p-3 rounded-xl" value={formData.role || ''} onChange={e => setFormData({...formData, role: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Telefone</label>
                  <input required className="w-full border border-slate-200 p-3 rounded-xl" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Data Nascimento</label>
                    <input type="date" required className="w-full border border-slate-200 p-3 rounded-xl" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Admissão</label>
                    <input type="date" required className="w-full border border-slate-200 p-3 rounded-xl" value={formData.admissionDate || ''} onChange={e => setFormData({...formData, admissionDate: e.target.value})} />
                  </div>
                </div>
              </div>

              {/* Lógica Condicional: Afastado */}
              {formData.status === 'Afastado' && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-amber-800">Motivo do Afastamento</label>
                    <input className="w-full border border-amber-300 p-2.5 rounded-lg" placeholder="Ex: Licença Maternidade, INSS..." value={formData.leaveReason || ''} onChange={e => setFormData({...formData, leaveReason: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-amber-800">Previsão de Retorno</label>
                    <input type="date" className="w-full border border-amber-300 p-2.5 rounded-lg" value={formData.leaveExpectedReturn || ''} onChange={e => setFormData({...formData, leaveExpectedReturn: e.target.value})} />
                  </div>
                </div>
              )}

              {/* Lógica Condicional: Inativo */}
              {formData.status === 'Inativo' && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2">
                  <label className="text-sm font-bold text-red-800">Motivo do Desligamento</label>
                  <input className="w-full border border-red-300 p-2.5 rounded-lg" placeholder="Ex: Pedido de demissão, Corte de custos..." value={formData.terminationReason || ''} onChange={e => setFormData({...formData, terminationReason: e.target.value})} />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button type="button" onClick={() => setView('list')} className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700">Cancelar</button>
                <button type="submit" className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg transition-all">
                  <Save size={20} /> Salvar Colaborador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW: DETALHES (Perfil e Histórico) */}
      {view === 'details' && selectedEmployee && (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <button onClick={() => setView('list')} className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold mb-6 transition-colors">
            <ArrowLeft size={20} /> Voltar para a lista
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Card Lateral: Info Básica */}
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
                <div className="w-24 h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Contact size={48} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">{selectedEmployee.name}</h2>
                <p className="text-blue-600 font-semibold mb-4">{selectedEmployee.role}</p>
                <div className={`inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                  selectedEmployee.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {selectedEmployee.status}
                </div>
                
                <div className="mt-8 space-y-4 text-left border-t pt-6">
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Setor:</span> <span className="font-bold text-slate-700">{selectedEmployee.sector}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Telefone:</span> <span className="font-bold text-slate-700">{selectedEmployee.phone}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Admissão:</span> <span className="font-bold text-slate-700">{formatDate(selectedEmployee.admissionDate)}</span></div>
                </div>
              </div>
            </div>

            {/* Conteúdo Principal: Linha do Tempo (Histórico) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-xl font-bold text-slate-800 mb-8 flex items-center gap-3">
                  <History className="text-blue-600" /> Histórico Funcional e de Ausências
                </h3>

                <div className="relative border-l-2 border-slate-100 ml-4 space-y-8">
                  {unifiedHistory.map((item: any, index) => (
                    <div key={index} className="relative pl-8">
                      {/* Pontinho na linha do tempo */}
                      <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                        item.isAbsence ? 'bg-red-500' : 'bg-blue-600'
                      }`}></div>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">{formatDate(item.date)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          item.isAbsence ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {item.type || 'Falta'}
                        </span>
                      </div>
                      <p className="text-slate-700 font-medium">{item.description}</p>
                    </div>
                  ))}

                  {unifiedHistory.length === 0 && (
                    <div className="text-center py-10 text-slate-400 italic">Nenhum evento registrado no histórico.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};