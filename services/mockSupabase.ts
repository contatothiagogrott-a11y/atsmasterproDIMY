
import { User, Job, Candidate, TalentProfile, SettingItem } from '../types';

// API Configuration
const API_URL = '/api/main';

// Helper for Fetch
const api = {
  get: async (action: string) => {
    const res = await fetch(`${API_URL}?action=${action}`);
    if (!res.ok) throw new Error('API Error');
    return res.json();
  },
  post: async (action: string, body: any) => {
    const res = await fetch(`${API_URL}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('API Error');
    return res.json();
  }
};

export const db = {
  // Initial Load (Busca tudo de uma vez para popular o Contexto)
  loadAll: async () => {
    const data = await api.get('get-data');
    return {
      users: data.users as User[],
      jobs: data.entities.filter((e: any) => e.type === 'JOB').map((e: any) => e.data) as Job[],
      candidates: data.entities.filter((e: any) => e.type === 'CANDIDATE').map((e: any) => e.data) as Candidate[],
      talents: data.entities.filter((e: any) => e.type === 'TALENT').map((e: any) => e.data) as TalentProfile[],
      settings: data.entities.filter((e: any) => e.type === 'SETTING').map((e: any) => e.data) as SettingItem[],
    };
  },
  
  // Auth
  login: async (username: string, pass: string): Promise<User | null> => {
    try {
      const user = await api.post('login', { username, password: pass });
      if (user && !user.error) {
        localStorage.setItem('ats_session', JSON.stringify(user)); // Client session cache
        return user;
      }
      return null;
    } catch {
      return null;
    }
  },

  verifyPassword: async (userId: string, pass: string): Promise<boolean> => {
    try {
      const res = await api.post('verify-password', { userId, password: pass });
      return res.valid;
    } catch {
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('ats_session');
  },

  getSession: (): User | null => {
    const stored = localStorage.getItem('ats_session');
    return stored ? JSON.parse(stored) : null;
  },

  // Users
  saveUser: async (user: User) => {
    await api.post('save-user', user);
  },

  // Generic Save for Entities
  saveJob: async (job: Job) => {
    await api.post('save-entity', { id: job.id, type: 'JOB', data: job });
  },
  deleteJob: async (id: string, userId: string) => {
    // Soft delete via API (Actually creates an update to set deleted_at, handled by backend for simple ID or complex logic)
    // For this app, we pass the deleted flag inside the object AND soft delete the row
    await api.post('delete-entity', { id }); 
  },

  saveCandidate: async (candidate: Candidate) => {
    await api.post('save-entity', { id: candidate.id, type: 'CANDIDATE', data: candidate });
  },
  deleteCandidate: async (id: string) => {
    await api.post('delete-entity', { id });
  },

  saveTalent: async (talent: TalentProfile) => {
    await api.post('save-entity', { id: talent.id, type: 'TALENT', data: talent });
  },
  deleteTalent: async (id: string) => {
    await api.post('delete-entity', { id });
  },

  saveSettings: async (settings: SettingItem[]) => {
    // Save each setting individually as the API expects entities
    for (const s of settings) {
        await api.post('save-entity', { id: s.id, type: 'SETTING', data: s });
    }
  },
  
  // Specific Delete for Settings (needs ID)
  deleteSetting: async (id: string) => {
      await api.post('delete-entity', { id });
  }
};
