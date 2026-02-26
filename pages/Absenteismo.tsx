import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { DocumentType, AbsenceRecord } from '../types';
import { CalendarX, Plus, Trash2, Edit2, LayoutDashboard, FileText, AlertTriangle, Activity, Users, Clock } from 'lucide-react';

export const Absenteismo: React.FC = () => {
  const { user, absences = [], addAbsence, updateAbsence, removeAbsence, employees = [] } = useData();
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cadastro'>('dashboard');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<AbsenceRecord>>({
    documentType: 'Atestado',
    reason: '',
    durationUnit: 'Dias',
    durationAmount: 1
  });

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  if (user?.role !== 'MASTER' && user?.role !== 'AUXILIAR_RH') {
    return <Navigate to="/" replace />;
  }

  // --- MEMÓRIA AUTOCOMPLETE ---
  const uniqueNames = useMemo(() => {
    const namesFromEmployees = employees.map(emp => emp.name);
    const namesFromAbsences = absences.map(a => a.employeeName);
    return Array.from(new Set([...namesFromEmployees, ...namesFromAbsences])).filter(Boolean).sort();
  }, [employees, absences]);

  const uniqueReasons = useMemo(() => {
    return Array.from(new Set(absences.map(a => a.reason))).filter(Boolean).sort();
  }, [absences]);

  const filteredAbsences = useMemo(() => {
    return absences.filter(record => {
      if (!record.absenceDate) return false;
      return record.absenceDate >= startDate && record.absenceDate <= endDate;
    });
  }, [absences, startDate, endDate]);

  // --- HELPER: FORMATAÇÃO DE HORAS (Ex: 8.8 -> 8h 48m) ---
  const formatHours = (decimalHours: number) => {
    const h = Math.floor(decimalHours);
    const m = Math.round((decimalHours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // --- LÓGICA DO DASHBOARD (CONVERSÃO PARA HORAS) ---
  const stats = useMemo(() => {
    let atestados = 0; let atestadosHours = 0;
    let declaracoes = 0; let declaracoesHours = 0;
    let injustificadas = 0; let injustificadasHours = 0;
    let acompanhamentos = 0; let acompanhamentosHours = 0;
    let totalLostHours = 0;

    const reasonCounts: Record<string, number> = {};
    const nameCounts: Record<string, number> = {};

    filteredAbsences.forEach(record => {
      // 1. Acha o colaborador para pegar a carga horária dele (Padrão: 8.8 horas)
      const emp = employees.find(e => e.name.toLowerCase() === record.employeeName?.toLowerCase());
      const workload = emp?.dailyWorkload || 8.8;

      // 2. Extrai ou converte a duração do registro
      let amount = record.durationAmount || 0;
      let unit = record.durationUnit;

      // Suporte para registros antigos (Legacy) que só tinham o texto "2 dias"
      if (!unit && record.documentDuration) {
        const match = record.documentDuration.match(/(\d+(?:\.\d+)?)\s*(dia|hora)/i);
        if (match) {
          amount = parseFloat(match[1]);
          unit = match[2].toLowerCase().startsWith('dia') ? 'Dias' : 'Horas';
        } else {
          unit = 'Dias'; amount = 1;
        }
      }

      // 3. Calcula as horas reais daquela falta
      let hours = 0;
      if (unit === 'Dias') hours = amount * workload;
      else if (unit === 'Horas') hours = amount;

      totalLostHours += hours;

      // 4. Acumula nos indicadores
      if (record.documentType === 'Atestado') { atestados++; atestadosHours += hours; }
      if (record.documentType === 'Declaração') { declaracoes++; declaracoesHours += hours; }
      if (record.documentType === 'Falta Injustificada') { injustificadas++; injustificadasHours += hours; }
      if (record.documentType === 'Acompanhante de Dependente') { acompanhamentos++; acompanhamentosHours += hours; }

      // Rank de Motivos (Por Horas)
      if (record.reason) reasonCounts[record.reason] = (reasonCounts[record.reason] || 0) + hours;
      // Rank de Pessoas (Por Horas)
      if (record.employeeName) nameCounts[record.employeeName] = (nameCounts[record.employeeName] || 0) + hours;
    });

    return {
      atestados, atestadosHours,
      declaracoes, declaracoesHours,
      injustificadas, injustificadasHours,
      acompanhamentos, acompanhamentosHours,
      totalLostHours,
      topReasons: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5),
      topNames: Object.entries(nameCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
    };
  }, [filteredAbsences, employees]);

  // --- HANDLERS DO FORMULÁRIO ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: name === 'durationAmount' ? Number(value) : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const unit = formData.durationUnit || 'Dias';
    const amount = formData.durationAmount || 1;
    
    const newAbsence: AbsenceRecord = {
      ...(formData as AbsenceRecord),
      durationUnit: unit,
      durationAmount: amount,
      documentDuration: `${amount} ${unit}`, // Salva no formato antigo também para compatibilidade
      id: isEditing && formData.id ? formData.id : crypto.randomUUID(),
      createdAt: isEditing && formData.createdAt ? formData.createdAt : new Date().toISOString()
    };

    if (isEditing && formData.id) {
      await updateAbsence(newAbsence);
    } else {
      await addAbsence(newAbsence);
    }
    
    setFormData({ documentType: 'Atestado', reason: '', durationUnit: 'Dias', durationAmount: 1 });
    setIsEditing(false);
  };

  const handleEdit = (record: AbsenceRecord) => {
    // Compatibilidade reversa ao editar registros antigos
    let amount = record.durationAmount;
    let unit = record.durationUnit;
    
    if (!unit && record.documentDuration) {
        const match = record.documentDuration.match(/(\d+(?:\.\d+)?)\s*(dia|hora)/i);
        if (match) {
            amount = parseFloat(match[1]);
            unit = match[2].toLowerCase().startsWith('dia') ? 'Dias' : 'Horas';
        } else {
            unit = 'Dias'; amount = 1;
        }
    }

    setFormData({
      ...record,
      durationAmount: amount,
      durationUnit: unit || 'Dias'
    });
    setIsEditing(true);
    setActiveTab('cadastro');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      await removeAbsence(id);
    }
  };

  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-2">
        <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
          <CalendarX size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Absenteísmo</h1>
          <p className="text-slate-500 text-sm">Monitoramento de Faltas e Horas Perdidas</p>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'dashboard' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <LayoutDashboard size={18} /><span>Dashboard Analítico</span>
        </button>
        <button onClick={() => setActiveTab('cadastro')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${activeTab === 'cadastro' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <FileText size={18} /><span>Cadastros & Registros</span>
        </button>
      </div>

      {activeTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
            <span className="font-semibold text-slate-700 text-sm">Período de Análise:</span>
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              <span className="text-slate-400">até</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border border-slate-300 p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="ml-auto flex items-center gap-4">
              <div className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                <b>{filteredAbsences.length}</b> Ocorrências
              </div>
              <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                <Clock size={14}/> Total: {formatHours(stats.totalLostHours)} Perdidas
              </div>
            </div>
          </div>

          {/* Cards agora focados nas HORAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-red-600">Faltas Injustificadas</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatHours(stats.injustificadasHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.injustificadas} registros</p>
              </div>
              <div className="p-3 bg-red-50 text-red-600 rounded-full"><AlertTriangle size={24} /></div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-600">Atestados (Médico)</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatHours(stats.atestadosHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.atestados} registros</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-full"><Activity size={24} /></div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-600">Declarações (Horas)</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatHours(stats.declaracoesHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.declaracoes} registros</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-full"><FileText size={24} /></div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-600">Acompanhamentos</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{formatHours(stats.acompanhamentosHours)}</p>
                <p className="text-xs font-medium text-slate-400 mt-1">em {stats.acompanhamentos} registros</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full"><Users size={24} /></div>
            </div>
          </div>

          {/* Ranks agora mostram Horas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Principais Motivos (Por Horas)</h3>
              {stats.topReasons.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Nenhum dado registrado neste período.</p>
              ) : (
                <ul className="space-y-3">
                  {stats.topReasons.map(([reason, hours], index) => (
                    <li key={index} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-700">{reason}</span>
                      <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-bold">{formatHours(hours)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Colaboradores com mais Ausências (Horas)</h3>
              {stats.topNames.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">Nenhum dado registrado neste período.</p>
              ) : (
                <ul className="space-y-3">
                  {stats.topNames.map(([name, hours], index) => (
                    <li key={index} className="flex justify-between items-center text-sm">
                      <span className="font-medium text-slate-700">{name}</span>
                      <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full font-bold">{formatHours(hours)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cadastro' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
          
          <datalist id="employee-names">
            {uniqueNames.map((name, i) => <option key={i} value={name} />)}
          </datalist>
          <datalist id="absence-reasons">
            {uniqueReasons.map((reason, i) => <option key={i} value={reason} />)}
          </datalist>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Plus size={20} className="text-blue-600" />
              {isEditing ? 'Editar Registro' : 'Novo Registro'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4 flex flex-col">
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Nome do Colaborador
                <input type="text" name="employeeName" list="employee-names" value={formData.employeeName || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Selecione ou digite o nome..." />
              </label>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Data de Início
                <input type="date" name="absenceDate" value={formData.absenceDate || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </label>

              {/* NOVOS CAMPOS DE DURAÇÃO */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col text-sm font-medium text-slate-700">
                  Quantidade
                  <input type="number" step="0.5" name="durationAmount" value={formData.durationAmount || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: 2" />
                </label>
                <label className="flex flex-col text-sm font-medium text-slate-700">
                  Unidade
                  <select name="durationUnit" value={formData.durationUnit || 'Dias'} onChange={handleInputChange} className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="Dias">Dias (8.8 hrs)</option>
                    <option value="Horas">Horas Fixas</option>
                  </select>
                </label>
              </div>

              <label className="flex flex-col text-sm font-medium text-slate-700">
                Tipo de Registro
                <select name="documentType" value={formData.documentType || 'Atestado'} onChange={handleInputChange} className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="Atestado">Atestado Médico</option>
                  <option value="Declaração">Declaração de Horas</option>
                  <option value="Acompanhante de Dependente">Acompanhante de Dependente</option>
                  <option value="Falta Injustificada">Falta Injustificada</option>
                </select>
              </label>
              
              <label className="flex flex-col text-sm font-medium text-slate-700">
                Motivo da Ausência / CID
                <input type="text" name="reason" list="absence-reasons" value={formData.reason || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ex: Dor de cabeça, Conjuntivite..." />
              </label>

              {formData.documentType === 'Acompanhante de Dependente' && (
                <div className="flex flex-col gap-3 bg-blue-50/50 p-4 border border-blue-100 rounded-lg mt-2">
                  <label className="flex flex-col text-sm font-medium text-slate-700">
                    Nome do Dependente
                    <input type="text" name="companionName" value={formData.companionName || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                  </label>
                  <label className="flex flex-col text-sm font-medium text-slate-700">
                    Vínculo (Ex: Filho)
                    <input type="text" name="companionBond" value={formData.companionBond || ''} onChange={handleInputChange} required className="mt-1 border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none" />
                  </label>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-blue-600 text-white font-semibold p-2.5 rounded-lg hover:bg-blue-700 transition-colors">
                  {isEditing ? 'Salvar Alterações' : 'Registrar Ausência'}
                </button>
                {isEditing && (
                  <button type="button" onClick={() => { setIsEditing(false); setFormData({ documentType: 'Atestado', reason: '', durationUnit: 'Dias', durationAmount: 1 }); }} className="bg-slate-200 text-slate-700 font-semibold p-2.5 rounded-lg hover:bg-slate-300 transition-colors">
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Histórico Completo</h2>
            </div>
            <div className="overflow-x-auto flex-1 p-4">
              {absences.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 py-10">
                  <CalendarX size={48} className="mb-3 opacity-20" />
                  <p>Nenhum registro encontrado.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <th className="pb-3 font-semibold">Colaborador / Motivo</th>
                      <th className="pb-3 font-semibold">Data e Duração</th>
                      <th className="pb-3 font-semibold">Tipo</th>
                      <th className="pb-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {absences.slice().reverse().map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                        <td className="py-3">
                          <p className="font-bold text-slate-800">{record.employeeName}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]" title={record.reason}>{record.reason}</p>
                        </td>
                        <td className="py-3">
                          <p className="font-medium">{formatDateToBR(record.absenceDate)}</p>
                          {/* Exibe o novo formato visual de quantidade + unidade */}
                          <p className="text-xs font-bold text-slate-400">
                            {record.durationAmount || ''} {record.durationUnit || record.documentDuration}
                          </p>
                        </td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            record.documentType === 'Atestado' ? 'bg-blue-100 text-blue-700' : 
                            record.documentType === 'Declaração' ? 'bg-amber-100 text-amber-700' : 
                            record.documentType === 'Falta Injustificada' ? 'bg-red-100 text-red-700' :
                            'bg-indigo-100 text-indigo-700'
                          }`}>
                            {record.documentType}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button onClick={() => handleEdit(record)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded mr-1" title="Editar">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(record.id)} className="text-red-600 hover:bg-red-50 p-1.5 rounded" title="Excluir">
                            <Trash2 size={16} />
                          </button>
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
};

export default Absenteismo;