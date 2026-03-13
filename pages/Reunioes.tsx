import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { MeetingEvent, Employee } from '../types';
import { Coffee, Plus, Trash2, Edit2, MapPin, Users, Clock, Calendar, CheckCircle, XCircle, Download, UserPlus, Presentation, X, FileSpreadsheet, Copy, BarChart3, Info, Building2 } from 'lucide-react';
import ExcelJS from 'exceljs'; 

export const Reunioes: React.FC = () => {
  const { meetings = [], addMeeting, updateMeeting, removeMeeting, employees = [], settings = [] } = useData() as any; 
  
  const [view, setView] = useState<'list' | 'form' | 'analytics'>('list');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<MeetingEvent>>({
    title: '', type: 'Reunião', instructor: '', date: '', time: '', endTime: '', location: '', requirements: '', participantCount: 1, participantIds: []
  });

  const [selectedSectorToAdd, setSelectedSectorToAdd] = useState('');
  const [selectedEmpToAdd, setSelectedEmpToAdd] = useState('');
  
  // Filtros do Painel HHT
  const [hhtStartDate, setHhtStartDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0]; 
  });
  const [hhtEndDate, setHhtEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), 11, 31).toISOString().split('T')[0]; 
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasTemplate, setHasTemplate] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('ats_excel_template_presenca')) {
      setHasTemplate(true);
    }
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

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

  // --- FUNÇÕES DE APOIO PARA DATAS ---
  const formatToYMD = (dateVal: any) => {
    if (!dateVal) return '';
    let str = String(dateVal).trim().split('T')[0].split(' ')[0];
    const parts = str.split(/[\/\-]/);
    if (parts.length === 3) {
        if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return str; 
  };

  const formatDateToBR = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const calculateDurationInHours = (startTime: string, endTime: string) => {
     if (!startTime || !endTime) return 0;
     const start = new Date(`1970-01-01T${startTime}:00Z`);
     const end = new Date(`1970-01-01T${endTime}:00Z`);
     let diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
     if (diff < 0) diff += 24; 
     return diff;
  };

  const formatHHT = (decimalHours: number) => {
      const h = Math.floor(decimalHours);
      const m = Math.round((decimalHours - h) * 60);
      if (h === 0 && m === 0) return `0h`;
      if (h === 0) return `${m}m`;
      if (m === 0) return `${h}h`;
      return `${h}h ${m}m`;
  };

  // --- LÓGICA DO PAINEL HHT (Homem-Hora de Treinamento) ---
  const hhtAnalytics = useMemo(() => {
      // 1. Filtra apenas Treinamentos ou Integrações dentro do período selecionado
      const trainingEvents = meetings.filter((m: MeetingEvent) => {
         if (m.type !== 'Treinamento' && m.type !== 'Integração') return false;
         if (m.date < hhtStartDate || m.date > hhtEndDate) return false;
         return true;
      });

      let totalHHT = 0;
      let totalParticipants = 0;
      const allUniqueParticipants = new Set<string>();

      const detailedTrainings = trainingEvents.map((t: MeetingEvent) => {
          const duration = calculateDurationInHours(t.time, t.endTime || t.time); 
          const participants = t.participantIds && t.participantIds.length > 0 ? t.participantIds.length : t.participantCount;
          
          if (t.participantIds) t.participantIds.forEach(id => allUniqueParticipants.add(id));

          const hht = duration * participants;
          totalHHT += hht;
          totalParticipants += participants;

          return { ...t, duration, participants, hht };
      }).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // 2. Quadro Total de Colaboradores (CÁLCULO INTELIGENTE NO TEMPO)
      // O colaborador estava na empresa em algum momento entre hhtStartDate e hhtEndDate?
      const totalAtivosNoPeriodo = employees.filter((e: Employee) => {
          const adDate = formatToYMD(e.admissionDate);
          const termDate = formatToYMD(e.terminationDate);

          // Se a data de admissão for DEPOIS do final do filtro, ele ainda não existia na empresa.
          if (adDate && adDate > hhtEndDate) return false;

          // Se ele foi demitido ANTES do início do filtro, ele já não estava mais na empresa.
          if (termDate && termDate < hhtStartDate) return false;

          // Se passou pelas regras, ele fez parte do quadro durante o período analisado.
          return true;
      }).length;
      
      // 3. Cálculo das duas médias
      const averageGlobal = totalAtivosNoPeriodo > 0 ? totalHHT / totalAtivosNoPeriodo : 0;
      const averagePerParticipant = allUniqueParticipants.size > 0 ? totalHHT / allUniqueParticipants.size : 0;

      return {
         totalHHT,
         totalTrainings: trainingEvents.length,
         totalUniquePeopleTrained: allUniqueParticipants.size,
         totalAtivos: totalAtivosNoPeriodo,
         averageGlobal,
         averagePerParticipant,
         detailedList: detailedTrainings
      };
  }, [meetings, hhtStartDate, hhtEndDate, employees]);


  const handleTemplateClick = () => {
    if (hasTemplate) {
      if (window.confirm("Você já possui um modelo Excel salvo. Deseja substituí-lo por um novo?\n\n(Clique em Cancelar caso queira excluir o modelo atual)")) {
        fileInputRef.current?.click();
      } else {
        if (window.confirm("Deseja EXCLUIR o modelo atual?")) {
          localStorage.removeItem('ats_excel_template_presenca');
          setHasTemplate(false);
        }
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result?.toString().split(',')[1];
      if (base64) {
        localStorage.setItem('ats_excel_template_presenca', base64);
        setHasTemplate(true);
        alert('Seu Modelo Customizado foi salvo com sucesso! Ele será usado nas exportações.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; 
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    
    setFormData({ title: '', type: 'Reunião', instructor: '', date: '', time: '', endTime: '', location: '', requirements: '', participantCount: 1, participantIds: [] });
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

  const handleCopy = (meeting: MeetingEvent) => {
    setFormData({
      title: `${meeting.title} (Cópia)`,
      type: meeting.type || 'Reunião',
      instructor: meeting.instructor || '',
      date: todayStr, 
      time: meeting.time,
      endTime: meeting.endTime || '',
      location: meeting.location,
      requirements: meeting.requirements,
      participantCount: meeting.participantCount,
      participantIds: meeting.participantIds ? [...meeting.participantIds] : []
    });
    setIsEditing(false); 
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja cancelar e excluir este evento?')) {
      if(removeMeeting) await removeMeeting(id);
    }
  };

  const handleExportList = async (meeting: MeetingEvent) => {
    if (!meeting.participantIds || meeting.participantIds.length === 0) {
      alert("Este evento não possui uma lista nominal de participantes cadastrada.");
      return;
    }

    const templateBase64 = localStorage.getItem('ats_excel_template_presenca');

    if (!templateBase64) {
      alert("Por favor, suba o seu arquivo 'Lista de presença.xlsx' clicando no botão 'Subir Modelo Excel' antes de exportar!");
      return;
    }

    const participants = meeting.participantIds.map(id => {
      const emp = employees.find((e: any) => e.id === id);
      return {
        nome: emp?.name || '-',
        cargo: emp?.role || '-',
        setor: emp?.sector || '-'
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));

    try {
      const byteString = atob(templateBase64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(ab);
      const sheet = workbook.worksheets[0];

      let typeStr = '(   ) Reunião  (   ) Treinamento  (   ) Outro:';
      if (meeting.type === 'Reunião') typeStr = '( X ) Reunião  (   ) Treinamento  (   ) Outro:';
      else if (meeting.type === 'Treinamento') typeStr = '(   ) Reunião  ( X ) Treinamento  (   ) Outro:';
      else typeStr = `(   ) Reunião  (   ) Treinamento  ( X ) Outro: ${meeting.type}`;

      const horarioStr = meeting.endTime ? `${meeting.time} às ${meeting.endTime}` : meeting.time;

      const c5 = sheet.getCell('C5'); if(c5) c5.value = typeStr;
      const f5 = sheet.getCell('F5'); if(f5) f5.value = `Data: ${formatDateToBR(meeting.date)}`;
      const c6 = sheet.getCell('C6'); if(c6) c6.value = meeting.title;
      const c7 = sheet.getCell('C7'); if(c7) c7.value = meeting.location;
      const f7 = sheet.getCell('F7'); if(f7) f7.value = horarioStr;
      const c8 = sheet.getCell('C8'); if(c8) c8.value = meeting.instructor || '-';

      let startRow = 12;
      participants.forEach((p, index) => {
        const row = sheet.getRow(startRow + index);
        row.getCell(1).value = p.nome;     
        row.getCell(4).value = p.cargo;    
        row.getCell(5).value = p.setor;    
        row.commit();
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Presenca_${meeting.title.replace(/\s+/g, '_')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("Ocorreu um erro ao gerar a planilha. Verifique se o modelo não está corrompido.");
    }
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
    <div className="space-y-6 pb-12 animate-in fade-in">
      <input type="file" accept=".xlsx" className="hidden" ref={fileInputRef} onChange={handleTemplateUpload} />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-200">
            <Coffee size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Treinamentos e Reuniões</h1>
            <p className="text-slate-500 text-sm">Gestão de eventos, treinamentos e listas de presença</p>
          </div>
        </div>

        {view !== 'form' && (
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={handleTemplateClick}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all border ${hasTemplate ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
            >
              <FileSpreadsheet size={18} />
              {hasTemplate ? 'Modelo Configurado' : 'Subir Modelo Excel'}
            </button>

            <button 
              onClick={() => {
                setIsEditing(false);
                setFormData({ title: '', type: 'Reunião', instructor: '', date: todayStr, time: '09:00', endTime: '10:00', location: '', requirements: '', participantCount: 1, participantIds: [] });
                setView('form');
              }}
              className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
            >
              <Plus size={18} />
              Agendar Evento
            </button>
          </div>
        )}
      </div>

      {view !== 'form' && (
         <div className="flex space-x-2 border-b border-slate-200 mb-6">
           <button onClick={() => setView('list')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${view === 'list' ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
             <Calendar size={18} /><span>Agenda de Eventos</span>
           </button>
           <button onClick={() => setView('analytics')} className={`flex items-center space-x-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 ${view === 'analytics' ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
             <BarChart3 size={18} /><span>Painel de Treinamentos (HHT)</span>
           </button>
         </div>
      )}

      {/* ======================= ABA DE AGENDA / LISTA GERAL ======================= */}
      {view === 'list' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-2">
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
                      <button onClick={() => handleCopy(meeting)} title="Duplicar Evento" className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-600 rounded-lg transition-colors"><Copy size={14} /></button>
                      <button onClick={() => handleEdit(meeting)} title="Editar Evento" className="p-1.5 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-lg transition-colors"><Edit2 size={14} /></button>
                      <button onClick={() => handleDelete(meeting.id)} title="Excluir Evento" className="p-1.5 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>

                    <div className="mb-4 pr-24">
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
                      <p className="flex items-center gap-2 text-sm text-slate-600 font-medium"><Clock size={16} className="text-orange-500"/> {meeting.time} {meeting.endTime ? `às ${meeting.endTime}` : ''}</p>
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

                    {meeting.participantIds && meeting.participantIds.length > 0 && (
                      <button onClick={() => handleExportList(meeting)} className="w-full flex items-center justify-center gap-2 mt-auto bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-2 rounded-xl text-xs font-bold transition-colors">
                        <Download size={14} /> Baixar Form. de Presença
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

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
                      <tr key={meeting.id} className="text-slate-500 hover:bg-slate-50 group">
                        <td className="p-4 whitespace-nowrap">
                          <span className="font-medium text-sm">{formatDateToBR(meeting.date)}</span>
                          <span className="text-xs ml-2 block sm:inline">{meeting.time} {meeting.endTime ? `às ${meeting.endTime}` : ''}</span>
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
                              <Download size={12}/> Baixar Form.
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Não possuía</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleCopy(meeting)} title="Duplicar Evento" className="text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 p-1.5 rounded transition-colors"><Copy size={16} /></button>
                            <button onClick={() => handleEdit(meeting)} title="Editar Evento" className="text-slate-400 hover:text-blue-500 hover:bg-blue-50 p-1.5 rounded transition-colors"><Edit2 size={16} /></button>
                            <button onClick={() => handleDelete(meeting.id)} title="Excluir Evento" className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={16} /></button>
                          </div>
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

      {/* ======================= ABA DE INDICADORES (HHT) ======================= */}
      {view === 'analytics' && (
         <div className="space-y-6 animate-in slide-in-from-right-4">
            
            <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl flex gap-4 shadow-sm items-start">
               <Info className="text-indigo-600 shrink-0 mt-0.5" />
               <div>
                  <h3 className="font-bold text-indigo-900 text-sm uppercase tracking-widest mb-1">Como o HHT é calculado?</h3>
                  <p className="text-sm text-indigo-800 leading-relaxed">
                     O <b>Homem-Hora de Treinamento (HHT)</b> é o principal indicador de capacitação na Gestão de Pessoas. Ele não mede apenas a duração do evento no relógio, mas sim o esforço investido no grupo. Se 15 pessoas assistem a um curso de 4 horas, a empresa investiu <b>60 horas de treinamento</b> (15 x 4).<br/><br/>
                     Aqui você encontra dois prismas: A <b>Média Global</b> (usada para auditorias e ISO, dividindo pelo quadro total de funcionários da empresa) e a <b>Média Específica</b> (que mede o volume de conhecimento injetado apenas nas pessoas que efetivamente participaram das turmas).
                  </p>
               </div>
            </div>

            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
               <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" />
                  <span className="text-sm font-bold text-slate-700">Filtro de Treinamentos:</span>
               </div>
               <div className="flex items-center gap-2">
                  <input type="date" value={hhtStartDate} onChange={e => setHhtStartDate(e.target.value)} className="border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
                  <span className="text-slate-400 text-sm">até</span>
                  <input type="date" value={hhtEndDate} onChange={e => setHhtEndDate(e.target.value)} className="border border-slate-200 rounded-lg p-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500" />
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
               
               {/* HHT CARD - HERO */}
               <div className="lg:col-span-2 bg-gradient-to-br from-indigo-800 to-indigo-900 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden flex flex-col justify-center">
                  <BarChart3 className="absolute -right-4 -bottom-4 opacity-10 size-48"/>
                  <h3 className="font-bold text-indigo-200 uppercase tracking-widest text-xs mb-2">Homem-Hora de Treinamento (HHT Total)</h3>
                  <div className="flex items-end gap-3 mb-3">
                     <p className="text-6xl font-black">{formatHHT(hhtAnalytics.totalHHT)}</p>
                  </div>
                  <div className="bg-indigo-950/40 p-3 rounded-xl border border-indigo-700/50 mt-auto relative z-10 w-fit">
                    <p className="text-[11px] text-indigo-300 font-mono">Fórmula: Σ (Nº de Participantes × Horas de Duração)</p>
                  </div>
               </div>

               {/* MÉDIA GLOBAL */}
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center relative group hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-3 text-slate-500 mb-2">
                     <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Building2 size={20}/></div>
                     <span className="text-[10px] font-bold uppercase tracking-widest">Média Global (Empresa)</span>
                  </div>
                  <p className="text-4xl font-black text-slate-800">{formatHHT(hhtAnalytics.averageGlobal)}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Por Colaborador</p>
                  
                  <div className="absolute top-6 right-6 cursor-help">
                     <Info size={16} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                     <div className="hidden group-hover:block absolute top-6 right-0 w-64 bg-slate-800 text-white text-[11px] p-4 rounded-xl shadow-2xl z-50 font-medium leading-relaxed">
                        Exigido em relatórios de diretoria e auditorias (ex: ISO 30414). <br/><br/>
                        <b>Fórmula:</b> Total de HHT ÷ Total de Colaboradores Ativos no Período (<b>{hhtAnalytics.totalAtivos}</b>).<br/>
                        <i>Mostra o esforço de capacitação diluído por toda a empresa.</i>
                     </div>
                  </div>
               </div>

               {/* MÉDIA POR PARTICIPANTE */}
               <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center relative group hover:border-emerald-300 transition-colors">
                  <div className="flex items-center gap-3 text-slate-500 mb-2">
                     <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Users size={20}/></div>
                     <span className="text-[10px] font-bold uppercase tracking-widest">Média Específica (Turma)</span>
                  </div>
                  <p className="text-4xl font-black text-slate-800">{formatHHT(hhtAnalytics.averagePerParticipant)}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase tracking-wide">Por Participante Treinado</p>
                  
                  <div className="absolute top-6 right-6 cursor-help">
                     <Info size={16} className="text-slate-300 group-hover:text-emerald-400 transition-colors" />
                     <div className="hidden group-hover:block absolute top-6 right-0 w-64 bg-slate-800 text-white text-[11px] p-4 rounded-xl shadow-2xl z-50 font-medium leading-relaxed">
                        Usado para medir a intensidade real dos cursos fornecidos.<br/><br/>
                        <b>Fórmula:</b> Total de HHT ÷ Participantes Únicos (<b>{hhtAnalytics.totalUniquePeopleTrained}</b>).<br/>
                        <i>Mostra quantas horas, em média, quem foi selecionado para os cursos acabou recebendo.</i>
                     </div>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800">Detalhamento dos Treinamentos</h3>
                  <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 shadow-sm">
                     {hhtAnalytics.totalTrainings} Eventos no período
                  </div>
               </div>
               
               <div className="p-0">
                  {hhtAnalytics.detailedList.length === 0 ? (
                     <div className="text-center py-16 text-slate-400">
                        <Presentation size={48} className="mx-auto mb-3 opacity-20" />
                        <p>Nenhum treinamento ou integração registrado neste período.</p>
                     </div>
                  ) : (
                     <table className="w-full text-left">
                        <thead className="bg-white border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                           <tr>
                              <th className="p-4 pl-6">Evento / Instrutor</th>
                              <th className="p-4 text-center">Data e Duração</th>
                              <th className="p-4 text-center">Participantes</th>
                              <th className="p-4 text-right pr-6">HHT (Subtotal)</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                           {hhtAnalytics.detailedList.map((t: any) => (
                              <tr key={t.id} className="hover:bg-indigo-50/30 transition-colors">
                                 <td className="p-4 pl-6">
                                    <p className="font-bold text-slate-800 text-sm">{t.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Instrutor: {t.instructor || 'N/I'}</p>
                                 </td>
                                 <td className="p-4 text-center">
                                    <p className="font-bold text-slate-700 text-sm">{formatDateToBR(t.date)}</p>
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-0.5">{formatHHT(t.duration)} ({t.time} as {t.endTime || 'N/I'})</p>
                                 </td>
                                 <td className="p-4 text-center">
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 shadow-sm">
                                       {t.participants} <span className="opacity-50">pessoas</span>
                                    </span>
                                 </td>
                                 <td className="p-4 text-right pr-6">
                                    <span className="text-lg font-black text-indigo-700">{formatHHT(t.hht)}</span>
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

      {/* ======================= ABA DO FORMULÁRIO (CADASTRO) ======================= */}
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
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700">Título do Evento</label>
                <input required type="text" placeholder="Ex: Treinamento de Vendas, Integração..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Tipo de Evento</label>
                <select className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 bg-white font-bold" value={formData.type || 'Reunião'} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                  <option value="Reunião">Reunião Geral</option>
                  <option value="Treinamento" className="text-indigo-600">Treinamento / Curso (Gera HHT)</option>
                  <option value="Integração" className="text-emerald-600">Integração de Novos (Gera HHT)</option>
                  <option value="Coffee Break">Coffee Break</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="space-y-2 md:col-span-1">
                <label className="text-sm font-bold text-slate-700">Data</label>
                <input required type="date" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-sm font-bold text-slate-700">Início</label>
                <input required type="time" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
              <div className="space-y-2 md:col-span-1">
                <label className="text-sm font-bold text-slate-700">Término</label>
                <input type="time" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.endTime || ''} onChange={e => setFormData({...formData, endTime: e.target.value})} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700">Local</label>
                <input required type="text" placeholder="Ex: Auditório..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1"><Presentation size={14}/> Instrutor(a) / Coordenador</label>
                <input type="text" placeholder="Nome do Instrutor..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.instructor || ''} onChange={e => setFormData({...formData, instructor: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">O que será necessário? (Opcional)</label>
                <input type="text" placeholder="Ex: Projetor, água e apostilas..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})} />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Users size={18} className="text-orange-600"/> Gestão de Participantes</h3>
              
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                  Você pode gerar uma <b>Lista de Presença para Excel</b> adicionando as pessoas nominalmente abaixo. Se não precisar da lista, basta preencher a quantidade manualmente.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                  <div className="flex gap-2">
                    <select value={selectedSectorToAdd} onChange={e => setSelectedSectorToAdd(e.target.value)} className="flex-1 border border-slate-300 p-2.5 rounded-lg text-sm outline-none bg-white">
                      <option value="">Adicionar Setor Inteiro...</option>
                      {settings.filter((s:any) => s.type === 'SECTOR').map((s:any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <button type="button" onClick={handleAddSector} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">Adicionar</button>
                  </div>
                  
                  <div className="flex gap-2">
                    <select value={selectedEmpToAdd} onChange={e => setSelectedEmpToAdd(e.target.value)} className="flex-1 border border-slate-300 p-2.5 rounded-lg text-sm outline-none bg-white">
                      <option value="">Adicionar Colaborador Específico...</option>
                      {employees.filter((e:any) => e.status === 'Ativo').sort((a:any,b:any) => a.name.localeCompare(b.name)).map((e:any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <button type="button" onClick={handleAddIndividual} className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors"><UserPlus size={16}/></button>
                  </div>
                </div>

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