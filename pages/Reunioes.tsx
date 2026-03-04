import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { MeetingEvent, MeetingType } from '../types';
import { Coffee, Plus, Trash2, Edit2, MapPin, Users, Clock, Calendar, CheckCircle, XCircle, FileText, Download, UserPlus, Presentation, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export const Reunioes: React.FC = () => {
  const { meetings = [], addMeeting, updateMeeting, removeMeeting, employees = [], settings = [] } = useData() as any; 
  
  const [view, setView] = useState<'list' | 'form'>('list');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<MeetingEvent>>({
    title: '', type: 'Reunião', instructor: '', date: '', time: '', location: '', requirements: '', participantCount: 1, participantIds: []
  });

  // Estados auxiliares para o seletor de participantes
  const [selectedSectorToAdd, setSelectedSectorToAdd] = useState('');
  const [selectedEmpToAdd, setSelectedEmpToAdd] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // --- LÓGICA DE LISTAGEM ---
  const upcomingMeetings = useMemo(() => {
    return meetings
      .filter((m: MeetingEvent) => m.date >= todayStr)
      .sort((a: MeetingEvent, b: MeetingEvent) => {
        if (a.date === b.date) return a.time.localeCompare(b.time);
        return a.date.localeCompare(b.date);
      });
  }, [meetings, todayStr]);

  const pastMeetings = useMemo(() => {
    return meetings
      .filter((m: MeetingEvent) => m.date < todayStr)
      .sort((a: MeetingEvent, b: MeetingEvent) => b.date.localeCompare(a.date)); 
  }, [meetings, todayStr]);

  // --- LÓGICA DE PARTICIPANTES ---
  const handleAddSector = () => {
    if (!selectedSectorToAdd) return;
    const empsInSector = employees.filter((e: any) => e.sector === selectedSectorToAdd && e.status === 'Ativo');
    const newIds = empsInSector.map((e: any) => e.id);
    
    setFormData(prev => ({
      ...prev,
      participantIds: Array.from(new Set([...(prev.participantIds || []), ...newIds]))
    }));
    setSelectedSectorToAdd('');
  };

  const handleAddIndividual = () => {
    if (!selectedEmpToAdd) return;
    setFormData(prev => ({
      ...prev,
      participantIds: Array.from(new Set([...(prev.participantIds || []), selectedEmpToAdd]))
    }));
    setSelectedEmpToAdd('');
  };

  const handleRemoveParticipant = (idToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      participantIds: (prev.participantIds || []).filter(id => id !== idToRemove)
    }));
  };

  // --- HANDLERS PRINCIPAIS ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Atualiza a contagem baseada na lista nominal (se existir)
    const finalCount = formData.participantIds && formData.participantIds.length > 0 
      ? formData.participantIds.length 
      : formData.participantCount;

    const newMeeting: MeetingEvent = {
      ...(formData as MeetingEvent),
      participantCount: finalCount || 1,
      id: isEditing && formData.id ? formData.id : crypto.randomUUID(),
      createdAt: isEditing && formData.createdAt ? formData.createdAt : new Date().toISOString()
    };

    if (isEditing && formData.id) {
      if(updateMeeting) await updateMeeting(newMeeting);
    } else {
      if(addMeeting) await addMeeting(newMeeting);
    }
    
    setFormData({ title: '', type: 'Reunião', instructor: '', date: '', time: '', location: '', requirements: '', participantCount: 1, participantIds: [] });
    setIsEditing(false);
    setView('list');
  };

  const handleEdit = (meeting: MeetingEvent) => {
    setFormData({
      ...meeting,
      type: meeting.type || 'Reunião',
      instructor: meeting.instructor || '',
      participantIds: meeting.participantIds || []
    });
    setIsEditing(true);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja cancelar e excluir este evento?')) {
      if(removeMeeting) await removeMeeting(id);
    }
  };

  const handleExportList = (meeting: MeetingEvent) => {
    if (!meeting.participantIds || meeting.participantIds.length === 0) {
      alert("Este evento não possui uma lista nominal de participantes cadastrada.");
      return;
    }

    const dataToExport = meeting.participantIds.map(id => {
      const emp = employees.find((e: any) => e.id === id);
      return {
        'Nome do Colaborador': emp?.name || 'Desconhecido',
        'Setor': emp?.sector || '-',
        'Unidade': emp?.unit || '-',
        'Assinatura': '_______________________________________' // Espaço para assinar impresso
      };
    }).sort((a, b) => a['Nome do Colaborador'].localeCompare(b['Nome do Colaborador']));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Ajustando largura das colunas
    worksheet['!cols'] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 45 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lista de Presença");
    
    const fileName = `Lista_Presenca_${meeting.title.replace(/\s+/g, '_')}_${meeting.date}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // --- HELPERS ---
  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const isTomorrow = (dateStr: string) => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    return dateStr === tmrw.toISOString().split('T')[0];
  };

  const getTypeBadgeColor = (type?: string) => {
    switch(type) {
      case 'Treinamento': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'Integração': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Coffee Break': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-200">
            <Coffee size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cafés e Reuniões</h1>
            <p className="text-slate-500 text-sm">Gestão de eventos, treinamentos e listas de presença</p>
          </div>
        </div>

        {view === 'list' && (
          <button 
            onClick={() => {
              setIsEditing(false);
              setFormData({ title: '', type: 'Reunião', instructor: '', date: todayStr, time: '09:00', location: '', requirements: '', participantCount: 1, participantIds: [] });
              setView('form');
            }}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
          >
            <Plus size={18} />
            Agendar Evento
          </button>
        )}
      </div>

      {view === 'list' && (
        <div className="space-y-8 animate-in fade-in">
          
          {/* PRÓXIMOS EVENTOS */}
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calendar className="text-orange-600" size={20} /> Próximos Eventos
            </h2>
            
            {upcomingMeetings.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 shadow-sm">
                <Coffee size={40} className="mx-auto mb-3 opacity-20" />
                <p>Nenhum evento agendado para os próximos dias.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {upcomingMeetings.map((meeting: MeetingEvent) => (
                  <div key={meeting.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all relative group flex flex-col">
                    
                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(meeting)} className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(meeting.id)} className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>

                    <div className="mb-4 pr-16">
                      <div className="flex items-center gap-2 mb-2">
                        {meeting.date === todayStr && <span className="bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">Hoje!</span>}
                        {isTomorrow(meeting.date) && <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Amanhã</span>}
                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{formatDateToBR(meeting.date)}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border ${getTypeBadgeColor(meeting.type)}`}>
                          {meeting.type || 'Reunião'}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-slate-800 leading-tight">{meeting.title}</h3>
                      {meeting.instructor && <p className="text-xs text-slate-500 font-medium mt-1">Por: {meeting.instructor}</p>}
                    </div>

                    <div className="space-y-2 mb-4 flex-1">
                      <p className="flex items-center gap-2 text-sm text-slate-600 font-medium"><Clock size={16} className="text-orange-500"/> {meeting.time}</p>
                      <p className="flex items-center gap-2 text-sm text-slate-600 font-medium"><MapPin size={16} className="text-blue-500"/> {meeting.location}</p>
                      <p className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <Users size={16} className="text-emerald-500"/> 
                        {meeting.participantIds && meeting.participantIds.length > 0 
                          ? `${meeting.participantIds.length} pessoa(s) na lista`
                          : `${meeting.participantCount} pessoa(s)`}
                      </p>
                    </div>

                    {meeting.requirements && (
                      <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-sm text-orange-800 mb-4">
                        <span className="font-bold text-[10px] uppercase tracking-widest block mb-1">O que preparar:</span>
                        <p className="italic leading-snug">{meeting.requirements}</p>
                      </div>
                    )}

                    {/* BOTÃO EXPORTAR LISTA */}
                    {meeting.participantIds && meeting.participantIds.length > 0 && (
                      <button onClick={() => handleExportList(meeting)} className="w-full flex items-center justify-center gap-2 mt-auto bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-2 rounded-xl text-xs font-bold transition-colors">
                        <Download size={14} /> Exportar Lista de Presença
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* HISTÓRICO (EVENTOS PASSADOS) */}
          {pastMeetings.length > 0 && (
            <section className="pt-6 border-t border-slate-200">
              <h2 className="text-lg font-bold text-slate-400 mb-4 flex items-center gap-2">
                <CheckCircle size={20} /> Eventos Concluídos
              </h2>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr className="text-xs uppercase tracking-wider text-slate-400">
                      <th className="p-4 font-semibold">Data / Hora</th>
                      <th className="p-4 font-semibold">Evento</th>
                      <th className="p-4 font-semibold text-center">Tipo</th>
                      <th className="p-4 font-semibold text-center">Lista Nominal</th>
                      <th className="p-4 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {pastMeetings.map((meeting: MeetingEvent) => (
                      <tr key={meeting.id} className="text-slate-500 hover:bg-slate-50">
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-medium text-sm">{formatDateToBR(meeting.date)}</span>
                          <span className="text-xs ml-2">{meeting.time}</span>
                        </td>
                        <td className="p-4 font-medium text-sm text-slate-600">
                          <p>{meeting.title}</p>
                          {meeting.instructor && <p className="text-xs font-normal text-slate-400">Instrutor: {meeting.instructor}</p>}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border ${getTypeBadgeColor(meeting.type)}`}>
                            {meeting.type || 'Reunião'}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {meeting.participantIds && meeting.participantIds.length > 0 ? (
                            <button onClick={() => handleExportList(meeting)} className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1 rounded flex items-center justify-center gap-1 mx-auto text-xs font-bold transition-colors border border-emerald-200">
                              <Download size={12}/> Baixar Lista
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Não possuía</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                           <button onClick={() => handleDelete(meeting.id)} className="text-slate-300 hover:text-red-500 p-1 rounded transition-colors"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {view === 'form' && (
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Coffee className="text-orange-600" />
              {isEditing ? 'Editar Evento' : 'Agendar Novo Evento'}
            </h2>
            <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600"><XCircle size={24}/></button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            
            {/* LINHA 1: Título e Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700">Título do Evento</label>
                <input required type="text" placeholder="Ex: Café de Integração..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Tipo de Evento</label>
                <select className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 bg-white" value={formData.type || 'Reunião'} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                  <option value="Reunião">Reunião Geral</option>
                  <option value="Treinamento">Treinamento / Curso</option>
                  <option value="Integração">Integração de Novos</option>
                  <option value="Coffee Break">Coffee Break</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            {/* LINHA 2: Data, Hora, Local e Instrutor */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2 md:col-span-1">
                <label className="text-sm font-bold text-slate-700">Data</label>
                <input required type="date" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-sm font-bold text-slate-700">Horário</label>
                <input required type="time" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-sm font-bold text-slate-700">Local</label>
                <input required type="text" placeholder="Ex: Copa..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1"><Presentation size={14}/> Instrutor(a)</label>
                <input type="text" placeholder="Nome..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.instructor || ''} onChange={e => setFormData({...formData, instructor: e.target.value})} />
              </div>
            </div>

            {/* LINHA 3: Necessidades */}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">O que será necessário? (Checklist / Comes e Bebes)</label>
              <textarea rows={2} placeholder="Ex: Comprar 2 bolos, ligar projetor, imprimir crachás..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 resize-none" value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})}></textarea>
            </div>

            {/* SESSÃO: LISTA DE PARTICIPANTES (NOVO) */}
            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Users size={18} className="text-orange-600"/> Gestão de Participantes</h3>
              
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Você pode gerar uma <b>Lista de Presença para Excel</b> adicionando as pessoas nominalmente abaixo. Se não precisar da lista, basta preencher a quantidade manualmente.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  {/* Add por Setor */}
                  <div className="flex gap-2">
                    <select value={selectedSectorToAdd} onChange={e => setSelectedSectorToAdd(e.target.value)} className="flex-1 border border-slate-300 p-2.5 rounded-lg text-sm outline-none bg-white">
                      <option value="">Adicionar Setor Inteiro...</option>
                      {settings.filter((s:any) => s.type === 'SECTOR').map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <button type="button" onClick={handleAddSector} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">Adicionar</button>
                  </div>
                  
                  {/* Add Individual */}
                  <div className="flex gap-2">
                    <select value={selectedEmpToAdd} onChange={e => setSelectedEmpToAdd(e.target.value)} className="flex-1 border border-slate-300 p-2.5 rounded-lg text-sm outline-none bg-white">
                      <option value="">Adicionar Colaborador Específico...</option>
                      {employees.filter((e:any) => e.status === 'Ativo').sort((a:any,b:any) => a.name.localeCompare(b.name)).map((e:any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <button type="button" onClick={handleAddIndividual} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"><UserPlus size={16}/></button>
                  </div>
                </div>

                {/* Exibição da Lista */}
                {formData.participantIds && formData.participantIds.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full uppercase tracking-wider">{formData.participantIds.length} Participantes na Lista</span>
                      <button type="button" onClick={() => setFormData(prev => ({...prev, participantIds: []}))} className="text-[10px] font-bold text-red-500 hover:underline uppercase">Limpar Lista</button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar p-3 bg-white border border-slate-200 rounded-xl">
                      {formData.participantIds.map(id => {
                        const emp = employees.find((e:any) => e.id === id);
                        if(!emp) return null;
                        return (
                          <div key={id} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 pl-3 pr-1 py-1 rounded-lg text-xs font-medium text-slate-700">
                            {emp.name.split(' ')[0]} {emp.name.split(' ')[1] || ''} <span className="opacity-50 mx-1">|</span> {emp.sector}
                            <button type="button" onClick={() => handleRemoveParticipant(id)} className="p-1 hover:bg-red-100 hover:text-red-600 rounded-md transition-colors ml-1"><X size={12}/></button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-white p-4 border border-slate-200 rounded-xl">
                    <label className="text-sm font-bold text-slate-700 flex-1">Não quer lista nominal? Digite a quantidade de pessoas manualmente:</label>
                    <input type="number" min="1" className="w-24 border border-slate-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 text-center font-bold" value={formData.participantCount} onChange={e => setFormData({...formData, participantCount: Number(e.target.value)})} />
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={() => setView('list')} className="px-6 py-2.5 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancelar</button>
              <button type="submit" className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95">
                Salvar Evento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};