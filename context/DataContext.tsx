
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../services/mockSupabase';
import { User, Job, Candidate, TalentProfile, SettingItem } from '../types';

interface DataContextType {
  user: User | null;
  login: (u: string, p: string) => Promise<boolean>;
  verifyUserPassword: (p: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean, message: string }>;
  adminResetPassword: (targetUserId: string, newPass: string) => Promise<{ success: boolean, message: string }>;
  
  users: User[];
  addUser: (u: User) => Promise<void>;
  updateUser: (u: User) => Promise<void>;

  settings: SettingItem[];
  addSetting: (s: SettingItem) => Promise<void>;
  removeSetting: (id: string) => Promise<void>;
  updateSetting: (s: SettingItem) => Promise<void>;
  importSettings: (s: SettingItem[]) => Promise<void>;

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

  refreshData: () => Promise<void>;
  isMockMode: boolean; // Exposed to UI
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(db.getSession());
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [isMockMode, setIsMockMode] = useState(false);

  const refreshData = async () => {
    try {
        // Now db.loadAll() is resilient and returns mock data on error
        const data = await db.loadAll();
        setUsers(data.users);
        setSettings(data.settings);
        setJobs(data.jobs);
        setCandidates(data.candidates);
        setTalents(data.talents);
        setIsMockMode(data.isMock);
    } catch (e: any) {
        console.error("Critical Failure in DataContext:", e);
        // Even if the mock fallback fails (unlikely), we don't crash the app
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const login = async (u: string, p: string) => {
    const loggedUser = await db.login(u, p);
    if (loggedUser) {
      setUser(loggedUser);
      await refreshData();
      return true;
    }
    return false;
  };

  const verifyUserPassword = async (p: string) => {
    if (!user) return false;
    return await db.verifyPassword(user.id, p);
  };

  const logout = () => {
    db.logout();
    setUser(null);
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user) return { success: false, message: 'Usuário não autenticado.' };
    const isValid = await db.verifyPassword(user.id, currentPass);
    if (!isValid) return { success: false, message: 'Senha atual incorreta.' };
    if (newPass.length < 3) return { success: false, message: 'Senha muito curta.' };

    const updatedUser = { ...user, password: newPass };
    await db.saveUser(updatedUser);
    setUser(updatedUser);
    return { success: true, message: 'Senha alterada!' };
  };

  const adminResetPassword = async (targetUserId: string, newPass: string) => {
    if (!user || user.role !== 'MASTER') return { success: false, message: 'Acesso negado.' };
    
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return { success: false, message: 'Usuário não encontrado.' };

    const updatedUser = { ...targetUser, password: newPass };
    await db.saveUser(updatedUser);
    await refreshData();
    return { success: true, message: `Senha de ${targetUser.name} redefinida!` };
  };

  // --- CRUD WRAPPERS ---
  // Note: In Mock Mode, these updates will update local state but won't persist if page reloads
  // The DataContext logic for updating state is optimistic (or we could fetch again).
  // For simplicity in this demo, we call refreshData(), but since refreshData calls db.loadAll(),
  // and db.loadAll returns STATIC mock data in failure mode, new items might disappear on refresh.
  // To make the UI feel responsive in Mock Mode, we manually update local state below.

  const addUser = async (u: User) => {
    await db.saveUser(u);
    if (isMockMode) setUsers([...users, u]); else refreshData();
  };

  const updateUser = async (u: User) => {
    await db.saveUser(u);
    if (isMockMode) setUsers(users.map(ex => ex.id === u.id ? u : ex)); else refreshData();
  };

  const addSetting = async (s: SettingItem) => {
    await db.saveSettings([s]);
    if (isMockMode) setSettings([...settings, s]); else refreshData();
  };

  const removeSetting = async (id: string) => {
    await db.deleteSetting(id);
    if (isMockMode) setSettings(settings.filter(s => s.id !== id)); else refreshData();
  };

  const updateSetting = async (s: SettingItem) => {
     await db.saveSettings([s]);
     if (isMockMode) setSettings(settings.map(ex => ex.id === s.id ? s : ex)); else refreshData();
  };

  const importSettings = async (s: SettingItem[]) => {
    await db.saveSettings(s);
    refreshData();
  };

  const addJob = async (j: Job) => {
    const jobWithOwner = { ...j, createdBy: user?.id };
    await db.saveJob(jobWithOwner);
    if (isMockMode) setJobs([...jobs, jobWithOwner]); else refreshData();
  };

  const updateJob = async (j: Job) => {
    await db.saveJob(j);
    if (isMockMode) setJobs(jobs.map(ex => ex.id === j.id ? j : ex)); else refreshData();
  };

  const removeJob = async (id: string) => {
    if (user) {
        await db.deleteJob(id, user.id);
        if (isMockMode) setJobs(jobs.filter(j => j.id !== id)); else refreshData();
    }
  };

  const addCandidate = async (c: Candidate) => {
    const newCandidate = { ...c, lastInteractionAt: c.lastInteractionAt || new Date().toISOString() };
    await db.saveCandidate(newCandidate);
    if (isMockMode) setCandidates([...candidates, newCandidate]); else refreshData();
  };

  const updateCandidate = async (c: Candidate, manualInteraction: boolean = false) => {
    let updatedCandidate = { ...c };
    if (!manualInteraction) updatedCandidate.lastInteractionAt = new Date().toISOString();
    if (!updatedCandidate.firstContactAt && updatedCandidate.status !== 'Aguardando Triagem') {
      updatedCandidate.firstContactAt = new Date().toISOString();
    }
    await db.saveCandidate(updatedCandidate);
    if (isMockMode) setCandidates(candidates.map(ex => ex.id === c.id ? updatedCandidate : ex)); else refreshData();
  };

  const removeCandidate = async (id: string) => {
    await db.deleteCandidate(id);
    if (isMockMode) setCandidates(candidates.filter(c => c.id !== id)); else refreshData();
  };

  const addTalent = async (t: TalentProfile) => {
    await db.saveTalent(t);
    if (isMockMode) setTalents([...talents, t]); else refreshData();
  };

  const removeTalent = async (id: string) => {
    await db.deleteTalent(id);
    if (isMockMode) setTalents(talents.filter(t => t.id !== id)); else refreshData();
  };

  return (
    <DataContext.Provider value={{
      user, login, verifyUserPassword, logout, changePassword, adminResetPassword,
      users, addUser, updateUser,
      settings, addSetting, removeSetting, updateSetting, importSettings,
      jobs, addJob, updateJob, removeJob,
      candidates, addCandidate, updateCandidate, removeCandidate,
      talents, addTalent, removeTalent,
      refreshData, isMockMode
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
