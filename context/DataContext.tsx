import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom'; 
import { 
  User, Job, Candidate, TalentProfile, SettingItem, 
  AbsenceRecord, Employee, MeetingEvent, 
  AppModule, PermissionLevel, 
  RefeitorioRecord
} from '../types';

interface DataContextType {
  user: User | null;
  login: (u: string, p: string) => Promise<boolean>;
  logout: () => void;
  verifyUserPassword: (p: string) => Promise<boolean>;
  changePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean, message: string }>;
  adminResetPassword: (targetUserId: string, newPass: string) => Promise<{ success: boolean, message: string }>;
  
  // --- O MOTOR DE PERMISSÕES DINÂMICAS ---
  hasPermission: (module: AppModule, minLevel: PermissionLevel) => boolean;

  users: User[];
  addUser: (u: User) => Promise<void>;
  updateUser: (u: User) => Promise<void>;
  removeUser: (id: string) => Promise<void>;

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
  updateCandidate: (c: Candidate) => Promise<void>;
  removeCandidate: (id: string) => Promise<void>;

  talents: TalentProfile[];
  addTalent: (t: TalentProfile) => Promise<void>;
  removeTalent: (id: string) => Promise<void>;
  updateTalent: (t: TalentProfile) => Promise<void>;

  absences: AbsenceRecord[];
  addAbsence: (a: AbsenceRecord) => Promise<void>;
  updateAbsence: (a: AbsenceRecord) => Promise<void>;
  removeAbsence: (id: string) => Promise<void>;

  employees: Employee[];
  addEmployee: (e: Employee) => Promise<void>;
  updateEmployee: (e: Employee) => Promise<void>;
  removeEmployee: (id: string) => Promise<void>;

  meetings: MeetingEvent[];
  addMeeting: (m: MeetingEvent) => Promise<void>;
  updateMeeting: (m: MeetingEvent) => Promise<void>;
  removeMeeting: (id: string) => Promise<void>;

  // --- REFEITÓRIO ---
  refeitorioRecords: RefeitorioRecord[];
  addRefeitorioRecord: (r: RefeitorioRecord) => Promise<void>;
  updateRefeitorioRecord: (r: RefeitorioRecord) => Promise<void>;
  removeRefeitorioRecord: (id: string) => Promise<void>;

  trash: any[];
  restoreItem: (id: string) => Promise<void>;
  permanentlyDeleteItem: (id: string) => Promise<void>;

  refreshData: () => Promise<void>;
  loading: boolean;
  isMockMode?: boolean; 
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [talents, setTalents] = useState<TalentProfile[]>([]);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]); 
  const [meetings, setMeetings] = useState<MeetingEvent[]>([]); 
  const [refeitorioRecords, setRefeitorioRecords] = useState<RefeitorioRecord[]>([]); 
  const [trash, setTrash] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const refreshData = async () => {
    try {
      const timestamp = Date.now();
      const response = await fetch(`/api/main?action=get-data&t=${timestamp}`, {
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!response.ok) throw new Error('Falha ao conectar com o servidor');
      
      const data = await response.json();
      
      if (data.users) {
        const activeUsers = data.users.filter((u: any) => u.role !== 'DELETED' && !u.deletedAt);
        setUsers(activeUsers);
      }
      
      if (data.settings) setSettings(data.settings);
      if (data.jobs) setJobs(data.jobs);
      if (data.talents) setTalents(data.talents);
      if (data.candidates) setCandidates(data.candidates);
      if (data.absences) setAbsences(data.absences);
      if (data.employees) setEmployees(data.employees); 
      if (data.meetings) setMeetings(data.meetings); 
      if (data.refeitorio) setRefeitorioRecords(data.refeitorio); 
      if (data.trash) setTrash(data.trash);
      
    } catch (error) {
      console.error("Erro ao sincronizar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('ats_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [location.pathname]);

  const login = async (username: string, pass: string) => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: pass }),
      });

      if (response.ok) {
        const userData = await response.json();
        
        if (userData.role === 'DELETED' || userData.deletedAt) {
            return false;
        }

        setUser(userData);
        localStorage.setItem('ats_user', JSON.stringify(userData));
        await refreshData();
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
    window.location.href = '/'; 
  };

  const verifyUserPassword = async (password: string) => {
    if (!user) return false;
    try {
        const response = await fetch('/api/main?action=verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, password })
        });
        const data = await response.json();
        return data.valid === true;
    } catch (error) {
        console.error("Erro ao verificar senha:", error);
        return false;
    }
  };

  const changePassword = async (currentPass: string, newPass: string) => {
    if (!user) return { success: false, message: 'Não logado' };
    const isValid = await verifyUserPassword(currentPass);
    if (!isValid) return { success: false, message: 'Senha atual incorreta' };
    await addUser({ ...user, password: newPass });
    return { success: true, message: 'Senha alterada com sucesso!' };
  };

  const adminResetPassword = async (targetUserId: string, newPass: string) => {
    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return { success: false, message: 'Usuário não encontrado' };
    await addUser({ ...targetUser, password: newPass });
    return { success: true, message: 'Senha resetada com sucesso!' };
  };

  const hasPermission = (module: AppModule, minLevel: PermissionLevel): boolean => {
    if (!user) return false;

    const weights: Record<PermissionLevel, number> = {
      'NONE': 0,
      'VIEW': 1,
      'EDIT_BASIC': 2,
      'EDIT_FULL': 3
    };

    if (user.role === 'MASTER') return true; 

    // --- NOVA REGRA DO GESTOR ---
    if (user.role === 'GESTOR') {
      // Retorna 'true' se o que a página pede (minLevel) for no máximo 'VIEW' (peso 1).
      // Nunca vai retornar true se a página pedir EDIT_BASIC (peso 2) ou EDIT_FULL (peso 3).
      return weights['VIEW'] >= weights[minLevel];
    }

    if (user.role === 'RECRUITER') {
      if (module === 'CONFIGURACOES' || module === 'QUADRO_PESSOAL') return false;
      return true; 
    }

    if (user.role === 'AUXILIAR_RH') {
      if (module === 'CONFIGURACOES' || module === 'QUADRO_PESSOAL' || module === 'DASHBOARD') return false;
      return weights['EDIT_BASIC'] >= weights[minLevel];
    }

    if (user.role === 'RECEPCAO') {
      if (module === 'ENTREVISTAS_GERAIS') return weights['EDIT_BASIC'] >= weights[minLevel];
      return false; 
    }

    const customRoleSetting = settings.find(s => s.type === 'CUSTOM_ROLE' && s.id === user.role);
    
    if (customRoleSetting && customRoleSetting.value) {
      try {
        const roleConfig = JSON.parse(customRoleSetting.value);
        const userModuleLevel = roleConfig.permissions[module] || 'NONE';
        
        return weights[userModuleLevel as PermissionLevel] >= weights[minLevel];
      } catch (e) {
        console.error("Erro ao ler permissão dinâmica:", e);
        return false;
      }
    }

    return false;
  };

  const saveEntity = async (type: string, item: any) => {
    try {
      await fetch('/api/main?action=save-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, type, data: item }),
      });
      await refreshData();
    } catch (error) {
      console.error(`Erro ao salvar ${type}:`, error);
    }
  };

  const deleteEntity = async (id: string, type?: string) => {
    try {
      await fetch('/api/main?action=delete-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, type, userId: user?.id }),
      });
      await refreshData();
    } catch (error) {
      console.error("Erro ao deletar:", error);
    }
  };

  const restoreItem = async (id: string) => {
    try {
      await fetch('/api/main?action=restore-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await refreshData();
    } catch (error) { console.error("Erro ao restaurar:", error); }
  };

  const permanentlyDeleteItem = async (id: string) => {
    try {
      await fetch('/api/main?action=permanently-delete-entity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      await refreshData();
    } catch (error) { console.error("Erro ao excluir permanentemente:", error); }
  };

  const addUser = async (u: User) => {
    try {
      await fetch('/api/main?action=save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...u, created_by: user?.id }),
      });
      await refreshData();
    } catch (error) { console.error("Erro ao salvar usuário:", error); }
  };
  const updateUser = (u: User) => addUser(u);

  const removeUser = async (id: string) => { 
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) return;

    setUsers(prev => prev.filter(u => u.id !== id));
    
    try {
      await fetch('/api/main?action=save-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...targetUser, role: 'DELETED', deletedAt: new Date().toISOString() })
      });
      await refreshData();
    } catch (error) {
      console.error("Erro ao realizar soft-delete do usuário:", error);
    }
  };

  const addSetting = async (s: SettingItem) => {
    setSettings(prev => [...prev, s]); 
    await saveEntity('setting', s);
  };
  const updateSetting = async (s: SettingItem) => {
    setSettings(prev => prev.map(i => i.id === s.id ? s : i));
    await saveEntity('setting', s);
  };
  const removeSetting = async (id: string) => {
    setSettings(prev => prev.filter(i => i.id !== id));
    await deleteEntity(id, 'setting');
  };
  const importSettings = async (s: SettingItem[]) => { console.log("Legacy import"); };

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
    await deleteEntity(id, 'job');
  };

  const addCandidate = async (c: Candidate) => {
    const newCandidate = { ...c };
    if (!newCandidate.createdAt) newCandidate.createdAt = new Date().toISOString();
    setCandidates(prev => [...prev, newCandidate]);
    await saveEntity('candidate', newCandidate);
  };

  const updateCandidate = async (c: Candidate) => {
    setCandidates(prev => prev.map(ex => ex.id === c.id ? c : ex));
    await saveEntity('candidate', c);
  };

  const removeCandidate = async (id: string) => {
    setCandidates(prev => prev.filter(c => c.id !== id));
    await deleteEntity(id, 'candidate');
  };

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
    await deleteEntity(id, 'talent');
  };

  const addAbsence = async (a: AbsenceRecord) => {
    setAbsences(prev => [...prev, a]);
    await saveEntity('absence', a);
  };
  const updateAbsence = async (a: AbsenceRecord) => {
    setAbsences(prev => prev.map(ex => ex.id === a.id ? a : ex));
    await saveEntity('absence', a);
  };
  const removeAbsence = async (id: string) => {
    setAbsences(prev => prev.filter(a => a.id !== id));
    await deleteEntity(id, 'absence');
  };

  const addEmployee = async (e: Employee) => {
    setEmployees(prev => [...prev, e]);
    await saveEntity('employee', e);
  };
  const updateEmployee = async (e: Employee) => {
    setEmployees(prev => prev.map(ex => ex.id === e.id ? e : ex));
    await saveEntity('employee', e);
  };
  const removeEmployee = async (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
    await deleteEntity(id, 'employee');
  };

  const addMeeting = async (m: MeetingEvent) => {
    setMeetings(prev => [...prev, m]);
    await saveEntity('meeting', m); 
  };
  const updateMeeting = async (m: MeetingEvent) => {
    setMeetings(prev => prev.map(ex => ex.id === m.id ? m : ex));
    await saveEntity('meeting', m);
  };
  const removeMeeting = async (id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id));
    await deleteEntity(id, 'meeting');
  };

  const addRefeitorioRecord = async (r: RefeitorioRecord) => {
    setRefeitorioRecords(prev => [...prev, r]);
    await saveEntity('refeitorio', r); 
  };
  const updateRefeitorioRecord = async (r: RefeitorioRecord) => {
    setRefeitorioRecords(prev => prev.map(ex => ex.id === r.id ? r : ex));
    await saveEntity('refeitorio', r);
  };
  const removeRefeitorioRecord = async (id: string) => {
    setRefeitorioRecords(prev => prev.filter(r => r.id !== id));
    await deleteEntity(id, 'refeitorio');
  };

  return (
    <DataContext.Provider value={{
      user, login, logout, 
      verifyUserPassword, changePassword, adminResetPassword,
      hasPermission, 
      users, addUser, updateUser, removeUser,
      settings, addSetting, removeSetting, updateSetting, importSettings,
      jobs, addJob, updateJob, removeJob,
      candidates, addCandidate, updateCandidate, removeCandidate,
      talents, addTalent, removeTalent, updateTalent,
      absences, addAbsence, updateAbsence, removeAbsence,
      employees, addEmployee, updateEmployee, removeEmployee, 
      meetings, addMeeting, updateMeeting, removeMeeting,
      refeitorioRecords, addRefeitorioRecord, updateRefeitorioRecord, removeRefeitorioRecord,
      trash, restoreItem, permanentlyDeleteItem,
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