
import { User, Job, Candidate, TalentProfile, SettingItem } from '../types';

// --- MOCK DATA FOR FALLBACK (Using valid UUIDs) ---
const MOCK_DATA = {
  users: [
    { id: '550e8400-e29b-41d4-a716-446655440000', username: 'admin', password: '123', name: 'Admin User', role: 'MASTER' as const },
    { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', username: 'recruiter', password: '123', name: 'Recruiter User', role: 'RECRUITER' as const }
  ],
  jobs: [
    { 
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', title: 'Desenvolvedor Senior React', sector: 'Tecnologia', unit: 'Matriz SP', status: 'Aberta' as const, 
      openedAt: new Date().toISOString(), description: 'Vaga para liderança técnica.',
      isConfidential: false, createdBy: '550e8400-e29b-41d4-a716-446655440000', openingDetails: { reason: 'Aumento de Quadro' as const }
    }
  ],
  candidates: [
    { 
      id: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', jobId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', name: 'Maria Souza', age: 28, phone: '11999999999', email: 'maria@test.com', 
      origin: 'LinkedIn' as const, status: 'Entrevista' as const, createdAt: new Date().toISOString(), 
      timeline: { interview: new Date().toISOString() }, salaryExpectation: 'R$ 8.000'
    }
  ],
  talents: [],
  settings: [
    { id: '1b671a64-40d5-491e-99b0-da01ff1f3341', name: 'Tecnologia', type: 'SECTOR' as const },
    { id: '2c671a64-40d5-491e-99b0-da01ff1f3342', name: 'Matriz SP', type: 'UNIT' as const }
  ]
};

const apiRequest = async (action: string, method: string = 'GET', body?: any) => {
  try {
    const url = action.startsWith('/') ? action : `/api/main?action=${action}`;
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    return await response.json();
  } catch (e) {
    throw e;
  }
};

export const db = {
  loadAll: async () => {
    try {
      const data = await apiRequest('get-data');
      const entities = data.entities || [];
      return {
        users: data.users as User[],
        jobs: entities.filter((e: any) => e.type === 'JOB').map((e: any) => e.data) as Job[],
        candidates: entities.filter((e: any) => e.type === 'CANDIDATE').map((e: any) => e.data) as Candidate[],
        talents: entities.filter((e: any) => e.type === 'TALENT').map((e: any) => e.data) as TalentProfile[],
        settings: entities.filter((e: any) => e.type === 'SETTING').map((e: any) => e.data) as SettingItem[],
        isMock: false
      };
    } catch (e) {
      return { ...MOCK_DATA, isMock: true };
    }
  },
  
  login: async (username: string, pass: string): Promise<User | null> => {
    try {
      const userData = await apiRequest('/api/login', 'POST', { username, password: pass });
      localStorage.setItem('ats_session', JSON.stringify(userData));
      return userData;
    } catch (e) {
      const mockUser = MOCK_DATA.users.find(u => u.username === username && u.password === pass);
      if (mockUser) {
         localStorage.setItem('ats_session', JSON.stringify(mockUser));
         return mockUser;
      }
      return null;
    }
  },

  verifyPassword: async (userId: string, pass: string): Promise<boolean> => {
    try {
      const result = await apiRequest('verify-password', 'POST', { userId, password: pass });
      return !!result.valid;
    } catch {
      const mockUser = MOCK_DATA.users.find(u => u.id === userId && u.password === pass);
      return !!mockUser;
    }
  },

  logout: () => localStorage.removeItem('ats_session'),
  getSession: (): User | null => {
    const stored = localStorage.getItem('ats_session');
    return stored ? JSON.parse(stored) : null;
  },

  saveUser: async (user: User) => apiRequest('save-user', 'POST', user).catch(() => {}),
  saveEntity: async (id: string, type: string, data: any) => apiRequest('save-entity', 'POST', { id, type, data }).catch(() => {}),
  deleteEntity: async (id: string) => apiRequest('delete-entity', 'POST', { id }).catch(() => {}),

  saveJob: async (job: Job) => db.saveEntity(job.id, 'JOB', job),
  deleteJob: async (id: string, userId: string) => db.deleteEntity(id),
  saveCandidate: async (candidate: Candidate) => db.saveEntity(candidate.id, 'CANDIDATE', candidate),
  deleteCandidate: async (id: string) => db.deleteEntity(id),
  saveTalent: async (talent: TalentProfile) => db.saveEntity(talent.id, 'TALENT', talent),
  deleteTalent: async (id: string) => db.deleteEntity(id),
  saveSettings: async (settings: SettingItem[]) => {
    for (const s of settings) {
        await db.saveEntity(s.id, 'SETTING', s);
    }
  },
  deleteSetting: async (id: string) => db.deleteEntity(id)
};
