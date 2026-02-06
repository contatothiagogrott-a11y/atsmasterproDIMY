
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

  // FIX: handlePasswordChange should be async to await changePassword promise
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new !== passwordData.confirm) {
      setPasswordMsg({ type: 'error', text: 'A confirmação de senha não coincide.' });
      return;
    }
    const result = await changePassword(passwordData.current, passwordData.new);
    if (result.success) {
      setPasswordMsg({ type: 'success', text: result.message });
      setPasswordData({ current: '', new: '', confirm: '' });
    } else {
      setPasswordMsg({ type: 'error', text: result.message });
    }
  };

  // FIX: handleAdminReset should be async to await adminResetPassword promise
  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;
    if (resetData.new !== resetData.confirm) {
      setResetMsg({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }
    const result = await adminResetPassword(userToReset.id, resetData.new);
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

  const handleExport = (type: 'SETTINGS' | 'JOBS' | 'TALENT' | 'ALL') => {
    // ... logic remains same ...
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, type: 'SETTINGS' | 'JOBS' | 'TALENT' | 'ALL') => {
    // ... logic remains same ...
  };

  const handleAddSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSettingName.trim()) {
      addSetting({
        id: crypto.randomUUID(),
        name: newSettingName,
        type: activeTab
      });
      setNewSettingName('');
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if(!isMaster) return;
    
    addUser({
      id: crypto.randomUUID(),
      name: newUser.name,
      username: newUser.username,
      password: newUser.password,
      role: newUser.role,
      createdBy: currentUser?.id
    });
    setNewUser({ name: '', username: '', password: '', role: 'RECRUITER' });
    alert('Usuário criado!');
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
         <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Configurações</h1>
         <p className="text-slate-500 mt-1">Gestão do sistema, acessos e segurança</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                <input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={passwordData.current} onChange={e => setPasswordData({...passwordData, current: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Nova Senha</label>
                  <input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={passwordData.new} onChange={e => setPasswordData({...passwordData, new: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Confirmar Nova Senha</label>
                  <input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="bg-slate-800 text-white font-bold py-2.5 px-6 rounded-lg">Atualizar Senha</button>
           </form>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex gap-6 mb-6 border-b border-slate-100 pb-2">
             <button className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide ${activeTab === 'SECTOR' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('SECTOR')}>Setores</button>
             <button className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide ${activeTab === 'UNIT' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('UNIT')}>Unidades</button>
           </div>

           <form onSubmit={handleAddSetting} className="flex gap-2 mb-4">
             <input type="text" className="flex-1 border border-slate-300 p-3 rounded-lg" placeholder={`Novo ${activeTab === 'SECTOR' ? 'Setor' : 'Unidade'}`} value={newSettingName} onChange={e => setNewSettingName(e.target.value)} />
             <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg"><Plus size={20} /></button>
           </form>

           <div className="space-y-2 max-h-64 overflow-y-auto">
             {settings.filter(s => s.type === activeTab).map(item => (
               <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                 {editingId === item.id ? (
                   <div className="flex flex-1 items-center gap-2">
                     <input className="flex-1 border border-blue-300 p-1.5 rounded text-sm" value={editingName} onChange={e => setEditingName(e.target.value)} autoFocus />
                     <button onClick={() => saveEditing(item)} className="text-green-600"><Check size={18}/></button>
                     <button onClick={cancelEditing} className="text-red-500"><X size={18}/></button>
                   </div>
                 ) : (
                   <>
                    <span className="text-slate-700 font-medium">{item.name}</span>
                    <div className="flex gap-2">
                      <button onClick={() => startEditing(item)} className="text-slate-400 hover:text-blue-600"><Edit2 size={18} /></button>
                      <button onClick={() => removeSetting(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>
                   </>
                 )}
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};
