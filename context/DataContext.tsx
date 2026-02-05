
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
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(db.getSession());
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [talents, setTalents] = useState<TalentProfile[]>([]);

  const refreshData = async () => {
    try {
        const data = await db.loadAll();
        setUsers(data.users);
        setSettings(data.settings);
        setJobs(data.jobs);
        setCandidates(data.candidates);
        setTalents(data.talents);
    } catch (e) {
        console.error("Failed to load data from Vercel Postgres", e);
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
    
    // Verify old password against DB
    const isValid = await db.verifyPassword(user.id, currentPass);
    if (!isValid) {
      return { success: false, message: 'Senha atual incorreta.' };
    }

    if (newPass.length < 6) {
      return { success: false, message: 'A nova senha deve ter no mínimo 6 caracteres.' };
    }

    const updatedUser = { ...user, password: newPass };
    await db.saveUser(updatedUser);
    setUser(updatedUser);
    return { success: true, message: 'Senha alterada com sucesso!' };
  };

  const adminResetPassword = async (targetUserId: string, newPass: string) => {
    if (!user || user.role !== 'MASTER') {
      return { success: false, message: 'Acesso negado.' };
    }
    if (newPass.length < 6) {
      return { success: false, message: 'Mínimo 6 caracteres.' };
    }

    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return { success: false, message: 'Usuário não encontrado.' };

    const updatedUser = { ...targetUser, password: newPass };
    await db.saveUser(updatedUser);
    await refreshData();
    return { success: true, message: `Senha de ${targetUser.name} redefinida!` };
  };

  // CRUD Wrappers (Async)
  const addUser = async (u: User) => {
    await db.saveUser(u);
    refreshData();
  };

  const updateUser = async (u: User) => {
    await db.saveUser(u);
    refreshData();
  };

  const addSetting = async (s: SettingItem) => {
    await db.saveSettings([s]); // API handles single or array, wrapper logic adjusted
    refreshData();
  };

  const removeSetting = async (id: string) => {
    await db.deleteSetting(id);
    refreshData();
  };

  const updateSetting = async (s: SettingItem) => {
     await db.saveSettings([s]);
     refreshData();
  };

  const importSettings = async (s: SettingItem[]) => {
    await db.saveSettings(s);
    refreshData();
  };

  const addJob = async (j: Job) => {
    const jobWithOwner = { ...j, createdBy: user?.id };
    await db.saveJob(jobWithOwner);
    refreshData();
  };

  const updateJob = async (j: Job) => {
    await db.saveJob(j);
    refreshData();
  };

  const removeJob = async (id: string) => {
    if (user) {
        await db.deleteJob(id, user.id);
        refreshData();
    }
  };

  const addCandidate = async (c: Candidate) => {
    const newCandidate = {
      ...c,
      lastInteractionAt: c.lastInteractionAt || new Date().toISOString()
    };
    await db.saveCandidate(newCandidate);
    refreshData();
  };

  const updateCandidate = async (c: Candidate, manualInteraction: boolean = false) => {
    let updatedCandidate = { ...c };
    if (!manualInteraction) {
      updatedCandidate.lastInteractionAt = new Date().toISOString();
    }
    if (!updatedCandidate.firstContactAt && updatedCandidate.status !== 'Aguardando Triagem') {
      updatedCandidate.firstContactAt = new Date().toISOString();
    }
    await db.saveCandidate(updatedCandidate);
    refreshData();
  };

  const removeCandidate = async (id: string) => {
    await db.deleteCandidate(id);
    refreshData();
  };

  const addTalent = async (t: TalentProfile) => {
    await db.saveTalent(t);
    refreshData();
  };

  const removeTalent = async (id: string) => {
    await db.deleteTalent(id);
    refreshData();
  };

  return (
    <DataContext.Provider value={{
      user, login, verifyUserPassword, logout, changePassword, adminResetPassword,
      users, addUser, updateUser,
      settings, addSetting, removeSetting, updateSetting, importSettings,
      jobs, addJob, updateJob, removeJob,
      candidates, addCandidate, updateCandidate, removeCandidate,
      talents, addTalent, removeTalent,
      refreshData
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
