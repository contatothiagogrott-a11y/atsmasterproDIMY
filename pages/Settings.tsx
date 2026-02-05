import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Trash2, Plus, ShieldAlert, Download, Upload, AlertTriangle, FileJson, Edit2, Check, X, Key, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import { SettingItem, User, Job, TalentProfile, Candidate, UserRole } from '../types';

export const SettingsPage: React.FC = () => {
  const { 
    settings, addSetting, removeSetting, updateSetting, importSettings,
    users, addUser, updateUser, user: currentUser, changePassword, adminResetPassword,
    jobs, talents, candidates,
    addJob, addTalent, addCandidate, updateJob, updateCandidate
  } = useData();
  
  const [newSettingName, setNewSettingName] = useState('');
  const [activeTab, setActiveTab] = useState<'SECTOR' | 'UNIT'>('SECTOR');
  
  // Create User State
  const [newUser, setNewUser] = useState({ 
    name: '', 
    username: '', 
    password: '', 
    role: 'RECRUITER' as UserRole 
  });

  // Password Change State (Self)
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Admin Reset Password State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetData, setResetData] = useState({ new: '', confirm: '' });
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const isMaster = currentUser?.role === 'MASTER';

  const startEditing = (item: SettingItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEditing = (item: SettingItem) => {
    if (editingName.trim()) {
      updateSetting({ ...item, name: editingName });
      setEditingId(null);
      setEditingName('');
    }
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      setPasswordMsg({ type: 'error', text: 'A confirmação de senha não coincide.' });
      return;
    }
    const result = changePassword(passwordData.current, passwordData.new);
    if (result.success) {
      setPasswordMsg({ type: 'success', text: result.message });
      setPasswordData({ current: '', new: '', confirm: '' });
    } else {
      setPasswordMsg({ type: 'error', text: result.message });
    }
  };

  const handleAdminReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;
    if (resetData.new !== resetData.confirm) {
      setResetMsg({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }
    const result = adminResetPassword(userToReset.id, resetData.new);
    if (result.success) {
      setResetMsg({ type: 'success', text: result.message });
      setTimeout(() => {
        setIsResetModalOpen(false);
        setUserToReset(null);
        setResetData({ new: '', confirm: '' });
        setResetMsg(null);
      }, 2000);
    } else {
      setResetMsg({ type: 'error', text: result.message });
    }
  };

  const openResetModal = (u: User) => {
    setUserToReset(u);
    setResetData({ new: '', confirm: '' });
    setResetMsg(null);
    setIsResetModalOpen(true);
  };

  // Backup Functions
  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = filename + ".json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (type: 'SETTINGS' | 'JOBS' | 'TALENT' | 'ALL') => {
    if (!isMaster && type === 'ALL') return;
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (type === 'ALL') {
        const fullBackup = {
            metadata: {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                exportedBy: currentUser?.name
            },
            data: {
                settings: settings,
                jobs: jobs,
                talents: talents,
                candidates: candidates,
                users: isMaster ? users : []
            }
        };
        downloadJSON(fullBackup, `ATS_FULL_BACKUP_${timestamp}`);
    } 
    else if (type === 'SETTINGS') downloadJSON(settings, `ATS_Config_${timestamp}`);
    else if (type === 'JOBS') downloadJSON(jobs, `ATS_Vagas_${timestamp}`);
    else if (type === 'TALENT') downloadJSON(talents, `ATS_Talentos_${timestamp}`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, type: 'SETTINGS' | 'JOBS' | 'TALENT' | 'ALL') => {
    if (!isMaster) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        if (type === 'ALL') {
            if (!json.data || !json.data.settings) {
                alert('Formato de arquivo inválido. Certifique-se de usar um arquivo gerado pelo "Full Backup".');
                return;
            }

            const { data } = json;
            let log = { jobs: 0, talents: 0, candidates: 0, settings: 0, errors: 0 };

            if (data.settings && Array.isArray(data.settings)) {
                const mergedSettings = [...settings];
                data.settings.forEach((s: SettingItem) => {
                    const idx = mergedSettings.findIndex(cur => cur.id === s.id);
                    if (idx >= 0) mergedSettings[idx] = s;
                    else mergedSettings.push(s);
                });
                importSettings(mergedSettings);
                log.settings = data.settings.length;
            }

            if (data.jobs && Array.isArray(data.jobs)) {
                data.jobs.forEach((j: Job) => {
                    const exists = jobs.find(cur => cur.id === j.id);
                    if (exists) updateJob(j);
                    else addJob(j);
                    log.jobs++;
                });
            }

            if (data.talents && Array.isArray(data.talents)) {
                data.talents.forEach((t: TalentProfile) => {
                    addTalent(t); 
                    log.talents++;
                });
            }

            if (data.candidates && Array.isArray(data.candidates)) {
                data.candidates.forEach((c: Candidate) => {
                    const exists = candidates.find(cur => cur.id === c.id);
                    if (exists) updateCandidate(c);
                    else addCandidate(c);
                    log.candidates++;
                });
            }

            alert(`Importação concluída com sucesso!\n\nResumo:\n- Vagas: ${log.jobs}\n- Candidaturas: ${log.candidates}\n- Talentos: ${log.talents}\n- Configurações: ${log.settings}`);
        }
        else if (type === 'SETTINGS') {
           if (!Array.isArray(json)) {
             alert('Formato de arquivo inválido. O arquivo deve conter uma lista (array) de configurações.');
             return;
           }
           importSettings(json);
           alert('Configurações importadas.');
        }
        else if (type === 'JOBS') {
           if (Array.isArray(json)) {
             json.forEach((j: Job) => addJob(j));
             alert('Vagas importadas.');
           }
        }
        else if (type === 'TALENT') {
           if (Array.isArray(json)) {
             json.forEach((t: TalentProfile) => addTalent(t));
             alert('Talentos importados.');
           }
        }

      } catch (err) {
        console.error(err);
        alert('Erro crítico ao processar arquivo. Verifique o console para detalhes.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSettingName.trim()) {
      addSetting({
        id: Math.random().toString(36).substr(2, 9),
        name: newSettingName,
        type: activeTab
      });
      setNewSettingName('');
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if(!isMaster) return;
    
    // Backend Validation Simulation
    if (newUser.role === 'MASTER' && !confirm('Você está criando um usuário com permissões administrativas totais. Deseja continuar?')) {
        return;
    }

    addUser({
      id: Math.random().toString(36).substr(2, 9),
      name: newUser.name,
      username: newUser.username,
      password: newUser.password,
      role: newUser.role,
      createdBy: currentUser?.id
    });
    setNewUser({ name: '', username: '', password: '', role: 'RECRUITER' });
    alert('Usuário criado com sucesso!');
  };

  const handleRoleChange = (targetUser: User, newRole: UserRole) => {
    if (targetUser.id === currentUser?.id) {
        alert('Você não pode alterar seu próprio nível de acesso.');
        return;
    }

    // Anti-lockout: Check if downgrading the LAST Master
    if (targetUser.role === 'MASTER' && newRole === 'RECRUITER') {
        const masterCount = users.filter(u => u.role === 'MASTER').length;
        if (masterCount <= 1) {
            alert('Ação bloqueada: O sistema deve ter pelo menos um Administrador (Master).');
            return;
        }
    }

    updateUser({ ...targetUser, role: newRole });
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
         <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Configurações</h1>
         <p className="text-slate-500 mt-1">Gestão do sistema, acessos e segurança</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Segurança - TODOS os usuários */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
             <Key size={20} className="text-blue-600" /> Segurança & Alteração de Senha
           </h3>
           
           <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordMsg && (
                <div className={`p-3 rounded-lg text-sm font-bold border ${passwordMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {passwordMsg.text}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Senha Atual</label>
                <input 
                  required 
                  type="password" 
                  className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                  value={passwordData.current} 
                  onChange={e => setPasswordData({...passwordData, current: e.target.value})} 
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nova Senha</label>
                  <input 
                    required 
                    type="password" 
                    className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                    value={passwordData.new} 
                    onChange={e => setPasswordData({...passwordData, new: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Confirmar Nova Senha</label>
                  <input 
                    required 
                    type="password" 
                    className="w-full border border-slate-300 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" 
                    value={passwordData.confirm} 
                    onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} 
                  />
                </div>
              </div>

              <button type="submit" className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-lg transition-all shadow-md">
                Atualizar Senha
              </button>
           </form>
        </div>

        {/* Listas (Setores/Unidades) - TODOS os usuários */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex gap-6 mb-6 border-b border-slate-100 pb-2">
             <button 
               className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide ${activeTab === 'SECTOR' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
               onClick={() => setActiveTab('SECTOR')}
             >
               Setores
             </button>
             <button 
               className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide ${activeTab === 'UNIT' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
               onClick={() => setActiveTab('UNIT')}
             >
               Unidades
             </button>
           </div>

           <form onSubmit={handleAddSetting} className="flex gap-2 mb-4">
             <input 
               type="text" 
               className="flex-1 border border-slate-300 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
               placeholder={`Novo ${activeTab === 'SECTOR' ? 'Setor' : 'Unidade'}`}
               value={newSettingName}
               onChange={e => setNewSettingName(e.target.value)}
             />
             <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 shadow-sm">
               <Plus size={20} />
             </button>
           </form>

           <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
             {settings.filter(s => s.type === activeTab).map(item => (
               <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                 {editingId === item.id ? (
                   <div className="flex flex-1 items-center gap-2">
                     <input 
                       className="flex-1 border border-blue-300 p-1.5 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                       value={editingName}
                       onChange={e => setEditingName(e.target.value)}
                       autoFocus
                       onKeyDown={e => e.key === 'Enter' && saveEditing(item)}
                     />
                     <button onClick={() => saveEditing(item)} className="text-green-600 hover:text-green-700"><Check size={18}/></button>
                     <button onClick={cancelEditing} className="text-red-500 hover:text-red-600"><X size={18}/></button>
                   </div>
                 ) : (
                   <>
                    <span className="text-slate-700 font-medium">{item.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => startEditing(item)} className="text-slate-400 hover:text-blue-600 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => removeSetting(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                   </>
                 )}
               </div>
             ))}
           </div>
        </div>

        {/* Backup & Recuperação - APENAS MASTER */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-2 relative overflow-hidden">
           {!isMaster && (
             <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-[2px] z-20 flex items-center justify-center p-8">
               <div className="text-center">
                  <Lock size={48} className="mx-auto text-slate-300 mb-2"/>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Acesso Restrito ao Master Account</p>
                  <p className="text-xs text-slate-400">Funcionalidades de backup e exportação são de nível administrativo.</p>
               </div>
             </div>
           )}
           
           <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
             <ShieldAlert size={20} className="text-blue-600" /> Backup & Recuperação de Dados
           </h3>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <BackupCard title="Configurações (Setores/Unidades)" onExport={() => handleExport('SETTINGS')} onImport={(e) => handleImport(e, 'SETTINGS')} />
              <BackupCard title="Vagas (Legado)" onExport={() => handleExport('JOBS')} onImport={(e) => handleImport(e, 'JOBS')} />
              <BackupCard title="Banco de Talentos (Legado)" onExport={() => handleExport('TALENT')} onImport={(e) => handleImport(e, 'TALENT')} />
              <div className="border-2 border-dashed border-blue-300 bg-blue-50/50 p-4 rounded-xl flex flex-col justify-between hover:bg-blue-50 transition-colors">
                 <div className="flex items-center gap-2 text-blue-800 font-bold mb-2">
                   <FileJson size={20} /> Full Backup (Recomendado)
                 </div>
                 <p className="text-xs text-slate-500 mb-4">Exporta TODA a inteligência do sistema (Vagas, Candidatos, Histórico, Settings).</p>
                 <div className="space-y-2">
                   <button onClick={() => handleExport('ALL')} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2 rounded flex items-center justify-center gap-2 shadow-sm">
                     <Download size={14} /> Baixar Tudo
                   </button>
                   <label className="w-full bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 text-sm font-bold py-2 rounded flex items-center justify-center gap-2 cursor-pointer transition-colors">
                     <Upload size={14} /> Restaurar Backup
                     <input type="file" accept=".json" className="hidden" onChange={(e) => handleImport(e, 'ALL')} />
                   </label>
                 </div>
              </div>
           </div>
        </div>

        {/* Gestão de Usuários - APENAS MASTER */}
        {isMaster ? (
           <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
               <ShieldAlert size={20} className="text-indigo-600" /> Gestão de Usuários
             </h3>
             
             <form onSubmit={handleCreateUser} className="space-y-4 mb-6 bg-indigo-50 p-5 rounded-xl border border-indigo-100">
                <input required placeholder="Nome Completo" className="w-full p-3 rounded-lg border border-indigo-200 outline-none focus:border-indigo-500 shadow-sm" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                    <input required placeholder="Usuário de Login" className="w-full p-3 rounded-lg border border-indigo-200 outline-none focus:border-indigo-500 shadow-sm" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                    <input required type="password" placeholder="Senha" className="w-full p-3 rounded-lg border border-indigo-200 outline-none focus:border-indigo-500 shadow-sm" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
                
                {/* ROLE SELECTION */}
                <div>
                    <label className="block text-xs font-bold text-indigo-800 mb-1 ml-1 uppercase">Nível de Acesso</label>
                    <select 
                      className="w-full p-3 rounded-lg border border-indigo-200 outline-none focus:border-indigo-500 shadow-sm bg-white cursor-pointer"
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                    >
                        <option value="RECRUITER">Recrutador (Padrão)</option>
                        <option value="MASTER">Master / Administrador</option>
                    </select>
                    {newUser.role === 'MASTER' && (
                        <div className="flex items-center gap-2 mt-2 text-amber-700 bg-amber-100 p-2 rounded text-xs border border-amber-200">
                            <AlertTriangle size={14} />
                            <span><strong>Atenção:</strong> Este usuário terá acesso total às configurações e dados sensíveis do sistema.</span>
                        </div>
                    )}
                </div>

                <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 shadow-md transition-all">Criar Acesso</button>
             </form>

             <div>
               <h4 className="font-bold text-slate-600 mb-3 text-xs uppercase tracking-wide">Usuários Ativos</h4>
               <div className="space-y-2">
                 {users.map(u => (
                   <div key={u.id} className="text-sm p-3 border-b border-slate-100 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors rounded-lg group">
                     <div className="flex flex-col">
                       <span className="font-medium text-slate-700">{u.name} <span className="text-slate-400 text-xs font-normal">({u.username})</span></span>
                       <div className="mt-1">
                           {currentUser?.id === u.id ? (
                               <span className={`w-fit text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-sm ${u.role === 'MASTER' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-50 text-indigo-600'}`}>
                                   {u.role === 'MASTER' ? 'Master (Você)' : 'Recrutador (Você)'}
                               </span>
                           ) : (
                               <select 
                                 value={u.role} 
                                 onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                                 className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded shadow-sm border outline-none cursor-pointer hover:border-slate-300 ${u.role === 'MASTER' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}
                               >
                                   <option value="RECRUITER">Recrutador</option>
                                   <option value="MASTER">Master</option>
                               </select>
                           )}
                       </div>
                     </div>
                     <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openResetModal(u)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Redefinir Senha"
                        >
                          <RotateCcw size={18} />
                        </button>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           </div>
        ) : (
          <div className="bg-slate-50 p-8 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-slate-400">
             <Lock size={32} className="mb-2 opacity-50"/>
             <p className="font-bold text-sm uppercase tracking-wide">Gestão de Usuários Restrita</p>
             <p className="text-xs text-center mt-1">Apenas a Master Account pode criar ou gerenciar perfis de acesso.</p>
          </div>
        )}
      </div>

      {/* ADMIN PASSWORD RESET MODAL */}
      {isResetModalOpen && userToReset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md border-t-4 border-indigo-500">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Redefinir Senha</h3>
                <button onClick={() => setIsResetModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
              </div>

              <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-sm text-indigo-800">
                  Você está redefinindo a senha de acesso para o usuário:<br/>
                  <strong className="text-base">{userToReset.name}</strong> <span className="text-xs opacity-70">({userToReset.username})</span>
                </p>
              </div>

              <form onSubmit={handleAdminReset} className="space-y-4">
                {resetMsg && (
                   <div className={`p-3 rounded-lg text-sm font-bold border ${resetMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                     {resetMsg.text}
                   </div>
                )}
                
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Nova Senha Administrativa</label>
                  <input 
                    required 
                    type="password" 
                    autoFocus
                    className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                    value={resetData.new} 
                    onChange={e => setResetData({...resetData, new: e.target.value})} 
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">Confirmar Nova Senha</label>
                  <input 
                    required 
                    type="password" 
                    className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                    value={resetData.confirm} 
                    onChange={e => setResetData({...resetData, confirm: e.target.value})} 
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsResetModalOpen(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" className="flex-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5">
                    Salvar Nova Senha
                  </button>
                </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

const BackupCard = ({ title, onExport, onImport }: { title: string, onExport: () => void, onImport: (e: any) => void }) => (
  <div className="border border-slate-200 p-4 rounded-xl flex flex-col justify-between hover:border-blue-200 transition-colors bg-slate-50/30">
    <div className="text-sm font-bold text-slate-700 mb-3">{title}</div>
    <div className="space-y-2">
      <button onClick={onExport} className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold py-2 rounded flex items-center justify-center gap-2 transition-colors shadow-sm">
        <Download size={14} /> Exportar
      </button>
      <label className="w-full bg-slate-100 border border-transparent hover:bg-slate-200 text-slate-600 text-sm font-bold py-2 rounded flex items-center justify-center gap-2 cursor-pointer transition-colors">
        <Upload size={14} /> Importar
        <input type="file" accept=".json" className="hidden" onChange={onImport} />
      </label>
    </div>
  </div>
);