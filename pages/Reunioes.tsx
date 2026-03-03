import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { MeetingEvent } from '../types';
import { Coffee, Plus, Trash2, Edit2, MapPin, Users, Clock, Calendar, CheckCircle, XCircle, FileText } from 'lucide-react';

export const Reunioes: React.FC = () => {
  // ATENÇÃO: Adicionaremos meetings no DataContext no próximo passo!
  const { meetings = [], addMeeting, updateMeeting, removeMeeting } = useData() as any; 
  
  const [view, setView] = useState<'list' | 'form'>('list');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<MeetingEvent>>({
    title: '', date: '', time: '', location: '', requirements: '', participantCount: 1
  });

  const todayStr = new Date().toISOString().split('T')[0];

  // Separa reuniões entre "Próximas" e "Passadas"
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
      .sort((a: MeetingEvent, b: MeetingEvent) => b.date.localeCompare(a.date)); // Mais recentes primeiro
  }, [meetings, todayStr]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newMeeting: MeetingEvent = {
      ...(formData as MeetingEvent),
      id: isEditing && formData.id ? formData.id : crypto.randomUUID(),
      createdAt: isEditing && formData.createdAt ? formData.createdAt : new Date().toISOString()
    };

    if (isEditing && formData.id) {
      if(updateMeeting) await updateMeeting(newMeeting);
    } else {
      if(addMeeting) await addMeeting(newMeeting);
    }
    
    setFormData({ title: '', date: '', time: '', location: '', requirements: '', participantCount: 1 });
    setIsEditing(false);
    setView('list');
  };

  const handleEdit = (meeting: MeetingEvent) => {
    setFormData(meeting);
    setIsEditing(true);
    setView('form');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja cancelar e excluir este evento?')) {
      if(removeMeeting) await removeMeeting(id);
    }
  };

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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-200">
            <Coffee size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Cafés e Reuniões</h1>
            <p className="text-slate-500 text-sm">Gestão de eventos, integrações e coffee breaks</p>
          </div>
        </div>

        {view === 'list' && (
          <button 
            onClick={() => {
              setIsEditing(false);
              setFormData({ title: '', date: todayStr, time: '09:00', location: '', requirements: '', participantCount: 1 });
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      </div>
                      <h3 className="font-bold text-lg text-slate-800 leading-tight">{meeting.title}</h3>
                    </div>

                    <div className="space-y-2 mb-4 flex-1">
                      <p className="flex items-center gap-2 text-sm text-slate-600 font-medium"><Clock size={16} className="text-orange-500"/> {meeting.time}</p>
                      <p className="flex items-center gap-2 text-sm text-slate-600 font-medium"><MapPin size={16} className="text-blue-500"/> {meeting.location}</p>
                      <p className="flex items-center gap-2 text-sm text-slate-600 font-medium"><Users size={16} className="text-emerald-500"/> {meeting.participantCount} pessoa(s)</p>
                    </div>

                    {meeting.requirements && (
                      <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-sm text-orange-800">
                        <span className="font-bold text-[10px] uppercase tracking-widest block mb-1">O que preparar:</span>
                        <p className="italic">{meeting.requirements}</p>
                      </div>
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
                      <th className="p-4 font-semibold">Local</th>
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
                        <td className="p-4 font-medium text-sm text-slate-600">{meeting.title}</td>
                        <td className="p-4 text-sm">{meeting.location}</td>
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
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Coffee className="text-orange-600" />
              {isEditing ? 'Editar Evento' : 'Agendar Novo Evento'}
            </h2>
            <button onClick={() => setView('list')} className="text-slate-400 hover:text-slate-600"><XCircle size={24}/></button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Título do Evento</label>
              <input required type="text" placeholder="Ex: Café de Integração, Reunião de Alinhamento..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Data</label>
                <input required type="date" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Horário</label>
                <input required type="time" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Qtd. de Pessoas</label>
                <input required type="number" min="1" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.participantCount} onChange={e => setFormData({...formData, participantCount: Number(e.target.value)})} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Local</label>
              <input required type="text" placeholder="Ex: Copa, Sala de Reuniões Matriz..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">O que será necessário? (Checklist / Comes e Bebes)</label>
              <textarea rows={4} placeholder="Ex: Comprar 2 bolos, ligar projetor, imprimir crachás..." className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 resize-none" value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})}></textarea>
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