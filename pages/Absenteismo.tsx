import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { DocumentType, AbsenceRecord } from '../types';
import { CalendarX, Plus, Trash2, Edit2 } from 'lucide-react';

export const Absenteismo: React.FC = () => {
  const { user, absences, addAbsence, updateAbsence, removeAbsence } = useData();
  
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<AbsenceRecord>>({
    documentType: 'Atestado',
  });

  // Bloqueio de Segurança: Apenas MASTER e AUXILIAR_RH acessam a página
  if (user?.role !== 'MASTER' && user?.role !== 'AUXILIAR_RH') {
    return <Navigate to="/" replace />;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && formData.id) {
      await updateAbsence(formData as AbsenceRecord);
    } else {
      const newAbsence: AbsenceRecord = {
        ...(formData as AbsenceRecord),
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString()
      };
      await addAbsence(newAbsence);
    }
    
    // Reseta o formulário
    setFormData({ documentType: 'Atestado' });
    setIsEditing(false);
  };

  const handleEdit = (record: AbsenceRecord) => {
    setFormData(record);
    setIsEditing(true);
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
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
          <CalendarX size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Controle de Absenteísmo</h1>
          <p className="text-slate-500 text-sm">Gerencie atestados e faltas dos colaboradores</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus size={20} className="text-blue-600" />
            {isEditing ? 'Editar Registro' : 'Novo Registro'}
          </h2>
          
          <form onSubmit={handleSubmit} className="space-y-4 flex flex-col">
            <label className="flex flex-col text-sm font-medium text-slate-700">
              Nome do Colaborador
              <input 
                type="text" 
                name="employeeName" 
                value={formData.employeeName || ''}
                onChange={handleInputChange} 
                required 
                className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Ex: João da Silva"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Data da Falta / Início
              <input 
                type="date" 
                name="absenceDate" 
                value={formData.absenceDate || ''}
                onChange={handleInputChange} 
                required 
                className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Tempo do Afastamento
              <input 
                type="text" 
                name="documentDuration" 
                value={formData.documentDuration || ''}
                onChange={handleInputChange} 
                required 
                className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Ex: 2 dias, 4 horas"
              />
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-700">
              Tipo de Documento
              <select 
                name="documentType" 
                value={formData.documentType || 'Atestado'} 
                onChange={handleInputChange} 
                className="mt-1 border border-slate-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="Atestado">Atestado</option>
                <option value="Declaração">Declaração</option>
                <option value="Acompanhante de Dependente">Acompanhante de Dependente</option>
              </select>
            </label>

            {/* Lógica Condicional */}
            {formData.documentType === 'Acompanhante de Dependente' && (
              <div className="flex flex-col gap-3 bg-blue-50/50 p-4 border border-blue-100 rounded-lg mt-2">
                <label className="flex flex-col text-sm font-medium text-slate-700">
                  Nome do Dependente
                  <input 
                    type="text" 
                    name="companionName" 
                    value={formData.companionName || ''}
                    onChange={handleInputChange} 
                    required 
                    className="mt-1 border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </label>

                <label className="flex flex-col text-sm font-medium text-slate-700">
                  Vínculo (Ex: Filho, Cônjuge)
                  <input 
                    type="text" 
                    name="companionBond" 
                    value={formData.companionBond || ''}
                    onChange={handleInputChange} 
                    required 
                    className="mt-1 border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </label>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button 
                type="submit" 
                className="flex-1 bg-blue-600 text-white font-semibold p-2.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                {isEditing ? 'Salvar Alterações' : 'Registrar'}
              </button>
              {isEditing && (
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({ documentType: 'Atestado' });
                  }}
                  className="bg-slate-200 text-slate-700 font-semibold p-2.5 rounded-lg hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Tabela de Registros */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800">Registros Recentes</h2>
          </div>
          <div className="overflow-x-auto flex-1 p-4">
            {absences.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-slate-400 py-10">
                <CalendarX size={48} className="mb-3 opacity-20" />
                <p>Nenhum registro de absenteísmo encontrado.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <th className="pb-3 font-semibold">Colaborador</th>
                    <th className="pb-3 font-semibold">Data</th>
                    <th className="pb-3 font-semibold">Documento</th>
                    <th className="pb-3 font-semibold">Afastamento</th>
                    <th className="pb-3 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {absences.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                      <td className="py-3 font-medium">{record.employeeName}</td>
                      <td className="py-3">{formatDateToBR(record.absenceDate)}</td>
                      <td className="py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          record.documentType === 'Atestado' ? 'bg-red-100 text-red-700' : 
                          record.documentType === 'Declaração' ? 'bg-amber-100 text-amber-700' : 
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {record.documentType}
                        </span>
                        {record.documentType === 'Acompanhante de Dependente' && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            {record.companionName} ({record.companionBond})
                          </div>
                        )}
                      </td>
                      <td className="py-3">{record.documentDuration}</td>
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
    </div>
  );
};

export default Absenteismo;
