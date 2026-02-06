import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Job, Candidate, TalentProfile, SettingItem } from '../types';

// Definição da Interface do Contexto
interface DataContextType {
  user: User | null;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean, message: string }>;
  adminResetPassword: (targetUserId: string, newPass: string) => Promise<{ success: boolean, message: string }>;
  
  users: User[];
  addUser: (u: User) => Promise<void>;
  updateUser: (u: User) => Promise<void>;
  removeUser: (id: string) => Promise<void>;

  settings: SettingItem[];
  addSetting: (s: SettingItem) => Promise<void>;
  removeSetting: (id: string) => Promise<void>;
  updateSetting: (s: SettingItem) => Promise<void>;
  importSettings: (s: SettingItem[]) => Promise<void>; // Mantido para compatibilidade

  jobs: Job[];
  addJob: (j: Job) => Promise<void>;
  updateJob: (j: Job) => Promise<void>;
  removeJob: (id: string) => Promise<void>;

  candidates: Candidate[];
  addCandidate: (c: Candidate) => Promise<void>;
  updateCandidate: (c: Candidate, manualInteraction?: boolean) => Promise<void>;
  removeCandidate: (id: string) => Promise<void>;

  talents: TalentProfile[];
  addTalent: (t: TalentProfile) => Promise<void>;
  removeTalent: (id: string) => Promise<void>;
  updateTalent: (t: TalentProfile) => Promise<void>;

  refreshData: () => Promise<void>;
  loading: boolean;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estados Locais
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // --- 1. FUNÇÃO MESTRA DE CARREGAMENTO (Chama API) ---
  const refreshData = async () => {
    try {
      const response = await fetch('/api/main?action=get-data');
      if (!response.ok) throw new Error('Falha ao conectar com o servidor');
      
      const data = await response.json();
      
      // Atualiza os estados com o que veio do banco
      if (data.users) setUsers(data.users);
      if (data.settings) setSettings(data.settings);
      if (data.jobs) setJobs(data.jobs);
      if (data.talents) setTalents(data.talents);
      if (data.candidates) setCandidates(data.candidates);
      
    } catch (error) {
      console.error("Erro ao sincronizar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  // Carrega dados ao iniciar e recupera sessão
  useEffect(() => {
    refreshData();
    const savedUser = localStorage.getItem('ats_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // --- 2. AUTENTICAÇÃO ---
  const login = async (username: string, pass: string) => {
    try {
      // Usamos a rota de login que já criamos
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass }),
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        localStorage.setItem('ats_user', JSON.stringify(userData));
        await refreshData(); // Garante que carregamos os dados frescos
        return true;
      }
      return false;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('ats_user');
    window.location.href = '/login'; // Força redirecionamento se necessário
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user) return { success: false, message: 'Não logado' };
    
    try {
      // 1. Verifica senha atual
      const verifyRes = await fetch('/api/main?action=verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, password: currentPass })
      });
      const verifyData = await verifyRes.json();
      
      if (!verifyData.valid) return { success: false, message: 'Senha atual incorreta' };

      // 2. Salva nova senha
      await addUser({ ...user, password: newPass });
      return { success: true, message: 'Senha alterada com sucesso!' };
    } catch (e) {
      return { success: false, message: 'Erro ao alterar senha' };
    }
  };

  const adminResetPassword = async (targetUserId: string, newPass: string) => {
    // Admin não precisa saber a senha antiga
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return { success: false, message: 'Usuário não encontrado' };

    await addUser({ ...targetUser, password: newPass });
    return { success: true, message: 'Senha resetada com sucesso!' };
  };

  // --- 3. PERSISTÊNCIA GENÉRICA (AJUDANTE) ---
  const saveEntity = async (type: string, item: any) => {
    try {
      await fetch('/api/main?action=save-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, type, data: item }),
      });
      refreshData();
    } catch (error) {
      console.error(`Erro ao salvar ${type}:`, error);
    }
  };

  const deleteEntity = async (id: string) => {
    try {
      await fetch('/api/main?action=delete-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      refreshData();
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  // --- 4. FUNÇÕES CRUD ESPECÍFICAS ---

  // Usuários
  const addUser = async (u: User) => {
    try {
      await fetch('/api/main?action=save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...u, created_by: user?.id }),
      });
      refreshData();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
    }
  };
  const updateUser = (u: User) => addUser(u); // Mesma lógica (Upsert)
  const removeUser = async (id: string) => {
     // Implementar se necessário exclusão de usuário via API
     console.warn("Remoção de usuário via API ainda não implementada");
  };

  // Configurações (Setores/Unidades)
  const addSetting = async (s: SettingItem) => {
    setSettings(prev => [...prev, s]); // Atualiza tela rápido
    await saveEntity('setting', s);
  };
  const updateSetting = async (s: SettingItem) => {
    setSettings(prev => prev.map(i => i.id === s.id ? s : i));
    await saveEntity('setting', s);
  };
  const removeSetting = async (id: string) => {
    setSettings(prev => prev.filter(i => i.id !== id));
    await deleteEntity(id);
  };
  const importSettings = async (s: SettingItem[]) => {
    // Compatibilidade: chama a lógica nova de backup se necessário, ou ignora
    console.log("ImportSettings legado chamado.");
  };

  // Vagas (Jobs)
  const addJob = async (j: Job) => {
    const jobWithOwner = { ...j, createdBy: user?.id };
    setJobs(prev => [...prev, jobWithOwner]);
    await saveEntity('job', jobWithOwner);
  };
  const updateJob = async (j: Job) => {
    setJobs(prev => prev.map(ex => ex.id === j.id ? j : ex));
    await saveEntity('job', j);
  };
  const removeJob = async (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    await deleteEntity(id);
  };

  // Candidatos
  const addCandidate = async (c: Candidate) => {
    const newCandidate = { ...c, lastInteractionAt: new Date().toISOString() };
    setCandidates(prev => [...prev, newCandidate]);
    await saveEntity('candidate', newCandidate);
  };
  const updateCandidate = async (c: Candidate, manualInteraction = false) => {
    let updated = { ...c };
    if (!manualInteraction) updated.lastInteractionAt = new Date().toISOString();
    
    setCandidates(prev => prev.map(ex => ex.id === c.id ? updated : ex));
    await saveEntity('candidate', updated);
  };
  const removeCandidate = async (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    await deleteEntity(id);
  };

  // Talentos
  const addTalent = async (t: TalentProfile) => {
    setTalents(prev => [...prev, t]);
    await saveEntity('talent', t);
  };
  const updateTalent = async (t: TalentProfile) => {
    setTalents(prev => prev.map(ex => ex.id === t.id ? t : ex));
    await saveEntity('talent', t);
  };
  const removeTalent = async (id: string) => {
    setTalents(prev => prev.filter(t => t.id !== id));
    await deleteEntity(id);
  };

  return (
    <DataContext.Provider value={{
      user, login, logout, changePassword, adminResetPassword,
      users, addUser, updateUser, removeUser,
      settings, addSetting, removeSetting, updateSetting, importSettings,
      jobs, addJob, updateJob, removeJob,
      candidates, addCandidate, updateCandidate, removeCandidate,
      talents, addTalent, removeTalent, updateTalent,
      refreshData, loading
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
};
