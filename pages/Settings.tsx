import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Trash2, Plus, Download, Upload, Edit2, Check, X, Key, ShieldCheck, UserPlus, Users, Save } from 'lucide-react';
import { SettingItem, User, UserRole } from '../types';

export const SettingsPage: React.FC = () => {
  const { 
    settings, addSetting, removeSetting, updateSetting, 
    users, addUser, user: currentUser, changePassword, adminResetPassword,
    jobs, talents, candidates
  } = useData();
  
  const [newSettingName, setNewSettingName] = useState('');
  const [activeTab, setActiveTab] = useState<'SECTOR' | 'UNIT'>('SECTOR');
  
  // Estado de Criação de Usuário
  const [newUser, setNewUser] = useState({ 
    name: '', 
    username: '', 
    password: '', 
    role: 'RECRUITER' as UserRole 
  });

  // Estado de Troca de Senha (Pessoal)
  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Estado de Reset de Senha (Admin)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [resetData, setResetData] = useState({ new: '', confirm: '' });
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Estado de Edição de Setores
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // --- CORREÇÃO DO MASTER: Garante que lê maiúsculo ou minúsculo ---
  const isMaster = currentUser?.role?.toUpperCase() === 'MASTER';

  // --- LÓGICA DE SETORES/UNIDADES ---
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

  const handleAddSetting = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSettingName.trim()) {
      // Gera ID temporário (o backend pode substituir se quiser, mas UUID funciona bem)
      addSetting({
        id: crypto.randomUUID(),
        name: newSettingName,
        type: activeTab
      });
      setNewSettingName('');
    }
  };

  // --- LÓGICA DE SENHAS ---
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!isMaster) return;
    
    // Chama o DataContext (que chama a API save-user)
    await addUser({
      id: crypto.randomUUID(),
      name: newUser.name,
      username: newUser.username,
      password: newUser.password,
      role: newUser.role,
      createdBy: currentUser?.id
    });
    setNewUser({ name: '', username: '', password: '', role: 'RECRUITER' });
    alert('Usuário criado com sucesso!');
  };

  // --- LÓGICA DE BACKUP & RESTORE (CONECTADO AO BACKEND) ---
  
  const handleExportBackup = () => {
    // Cria o JSON com tudo
    const backupData = {
      metadata: {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        exportedBy: currentUser?.name
      },
      data: {
        settings,
        jobs,
        talents,
        candidates,
        users // Exporta usuários também
      }
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ATS_FULL_BACKUP_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm("ATENÇÃO: Isso irá adicionar todos os dados do arquivo ao sistema atual. Deseja continuar?")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonContent = JSON.parse(e.target?.result as string);
        const payload = jsonContent.data ? jsonContent.data : jsonContent;

        // Chama a API direta para restaurar
        const response = await fetch('/api/main?action=restore-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payload }),
        });

        const result = await response.json();

        if (response.ok) {
          alert('✅ Backup importado com sucesso! A página será recarregada.');
          window.location.reload();
        } else {
          alert('❌ Erro ao importar: ' + (result.error || 'Erro desconhecido'));
        }
      } catch (error) {
        console.error(error);
        alert('Erro ao processar arquivo. Verifique se é um JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
         <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Configurações</h1>
         <p className="text-slate-500 mt-1">Gestão do sistema, acessos e segurança</p>
      </div>

      {/* --- GRID SUPERIOR: SENHA PESSOAL E SETORES --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Card de Senha Pessoal */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
             <Key size={20} className="text-blue-600" /> Minha Senha
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
                  <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Confirmar</label>
                  <input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={passwordData.confirm} onChange={e => setPasswordData({...passwordData, confirm: e.target.value})} />
                </div>
              </div>

              <button type="submit" className="bg-slate-800 text-white font-bold py-2.5 px-6 rounded-lg w-full md:w-auto">Atualizar Senha</button>
           </form>
        </div>

        {/* Card de Setores e Unidades */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <div className="flex gap-6 mb-6 border-b border-slate-100 pb-2">
             <button className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide ${activeTab === 'SECTOR' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('SECTOR')}>Setores</button>
             <button className={`pb-2 font-bold transition-colors text-sm uppercase tracking-wide ${activeTab === 'UNIT' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`} onClick={() => setActiveTab('UNIT')}>Unidades</button>
           </div>

           <form onSubmit={handleAddSetting} className="flex gap-2 mb-4">
             <input type="text" className="flex-1 border border-slate-300 p-3 rounded-lg" placeholder={`Novo ${activeTab === 'SECTOR' ? 'Setor' : 'Unidade'}`} value={newSettingName} onChange={e => setNewSettingName(e.target.value)} />
             <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"><Plus size={20} /></button>
           </form>

           <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
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
                      {/* Opcional: Só Admin pode apagar */}
                      <button onClick={() => removeSetting(item.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18} /></button>
                    </div>
                   </>
                 )}
               </div>
             ))}
           </div>
        </div>
      </div>

      {/* --- ÁREA ADMINISTRATIVA (SÓ APARECE SE FOR MASTER) --- */}
      {isMaster && (
        <div className="bg-slate-900 text-slate-200 p-6 rounded-xl shadow-lg border border-slate-800">
          <div className="flex items-center gap-3 mb-6 border-b border-slate-700 pb-4">
            <ShieldCheck className="text-emerald-400" size={24} />
            <h2 className="text-xl font-bold text-white">Área Administrativa</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. Criar Novo Usuário */}
            <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><UserPlus size={18}/> Novo Usuário</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input required placeholder="Nome Completo" className="bg-slate-700 border-slate-600 text-white rounded-lg p-2.5" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                  <input required placeholder="Usuário (Login)" className="bg-slate-700 border-slate-600 text-white rounded-lg p-2.5" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <input required type="password" placeholder="Senha" className="bg-slate-700 border-slate-600 text-white rounded-lg p-2.5" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                  <select className="bg-slate-700 border-slate-600 text-white rounded-lg p-2.5" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                    <option value="RECRUITER">Recrutador</option>
                    <option value="MASTER">Master Admin</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg transition-colors">Criar Usuário</button>
              </form>
            </div>

            {/* 2. Gerenciar Usuários Existentes */}
            <div className="bg-slate-800 p-5 rounded-lg border border-slate-700">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Users size={18}/> Usuários do Sistema</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {users.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                    <div>
                      <div className="font-bold text-slate-200">{u.name}</div>
                      <div className="text-xs text-slate-400">@{u.username} • {u.role}</div>
                    </div>
                    <button onClick={() => openResetModal(u)} className="text-xs bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded text-white transition-colors">
                      Resetar Senha
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* 3. Backup e Restore */}
            <div className="lg:col-span-2 bg-slate-800 p-5 rounded-lg border border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
               <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2"><Save size={18}/> Backup & Dados</h3>
                  <p className="text-sm text-slate-400">Exporte ou importe todos os dados do sistema.</p>
               </div>
               <div className="flex gap-4">
                  <button onClick={handleExportBackup} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors font-medium">
                    <Download size={18} /> Exportar Backup
                  </button>
                  <label className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors font-medium cursor-pointer">
                    <Upload size={18} /> Restaurar Backup
                    <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
                  </label>
               </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal de Reset de Senha (Admin) */}
      {isResetModalOpen && userToReset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Resetar Senha: {userToReset.name}</h3>
            
            {resetMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm font-bold border ${resetMsg.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                {resetMsg.text}
              </div>
            )}

            <form onSubmit={handleAdminReset} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Nova Senha</label>
                <input autoFocus required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={resetData.new} onChange={e => setResetData({...resetData, new: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 mb-1">Confirmar Nova Senha</label>
                <input required type="password" className="w-full border border-slate-300 p-2.5 rounded-lg" value={resetData.confirm} onChange={e => setResetData({...resetData, confirm: e.target.value})} />
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" onClick={() => setIsResetModalOpen(false)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-lg transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors">Salvar Nova Senha</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
