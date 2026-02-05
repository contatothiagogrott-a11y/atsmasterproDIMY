
import { neon } from '@neondatabase/serverless';
import { User, Job, Candidate, TalentProfile, SettingItem } from '../types';

// --- MOCK DATA FOR FALLBACK ---
const MOCK_DATA = {
  users: [
    { id: 'u-admin', username: 'admin', password: '123', name: 'Admin User', role: 'MASTER' as const },
    { id: 'u-recruiter', username: 'recruiter', password: '123', name: 'Recruiter User', role: 'RECRUITER' as const }
  ],
  jobs: [
    { 
      id: 'j-1', title: 'Desenvolvedor Senior React', sector: 'Tecnologia', unit: 'Matriz SP', status: 'Aberta' as const, 
      openedAt: new Date().toISOString(), description: 'Vaga para liderança técnica.',
      isConfidential: false, createdBy: 'u-admin', openingDetails: { reason: 'Aumento de Quadro' as const }
    },
    { 
      id: 'j-2', title: 'Analista de RH Pleno', sector: 'Recursos Humanos', unit: 'Filial RJ', status: 'Fechada' as const, 
      openedAt: new Date(Date.now() - 86400000 * 10).toISOString(), closedAt: new Date().toISOString(),
      isConfidential: true, createdBy: 'u-admin', openingDetails: { reason: 'Substituição' as const, replacedEmployee: 'João Silva' }
    }
  ],
  candidates: [
    { 
      id: 'c-1', jobId: 'j-1', name: 'Maria Souza', age: 28, phone: '11999999999', email: 'maria@test.com', 
      origin: 'LinkedIn' as const, status: 'Entrevista' as const, createdAt: new Date().toISOString(), 
      timeline: { interview: new Date().toISOString() }, salaryExpectation: 'R$ 8.000'
    },
    { 
      id: 'c-2', jobId: 'j-1', name: 'Carlos Pereira', age: 35, phone: '11988888888', 
      origin: 'Indicação' as const, status: 'Aprovado' as const, createdAt: new Date().toISOString(),
      salaryExpectation: 'R$ 9.000', techTest: true, techTestResult: 'Aprovado'
    }
  ],
  talents: [
    { 
      id: 't-1', name: 'Talento Exemplo', age: 30, contact: 'email@talento.com | 11977777777', 
      city: 'São Paulo', targetRole: 'Dev Fullstack', tags: ['React', 'Node'], 
      education: [], experience: [], createdAt: new Date().toISOString() 
    }
  ],
  settings: [
    { id: 's-1', name: 'Tecnologia', type: 'SECTOR' as const },
    { id: 's-2', name: 'Recursos Humanos', type: 'SECTOR' as const },
    { id: 's-3', name: 'Matriz SP', type: 'UNIT' as const },
    { id: 's-4', name: 'Filial RJ', type: 'UNIT' as const }
  ]
};

// Helper to resolve Database URL
const getDbUrl = () => {
  // @ts-ignore
  if (import.meta.env?.VITE_DATABASE_URL) return import.meta.env.VITE_DATABASE_URL;
  try {
     // @ts-ignore
     if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  } catch (e) {}
  return null;
};

// Initialize SQL client safely
const getSql = () => {
  const url = getDbUrl();
  if (!url) return null; // Return null instead of throwing to allow fallback logic
  return neon(url);
};

// Automatic Schema Initialization
const initTables = async (sql: any) => {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        created_by TEXT,
        deleted_at TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, 
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `;
    // Master User
    await sql`
      INSERT INTO users (id, username, password, name, role)
      VALUES ('u-master', 'masteraccount', 'master.123', 'Master Admin', 'MASTER')
      ON CONFLICT (id) DO NOTHING
    `;
  } catch (e) {
    console.error("Failed to initialize tables (Expected if no DB connection):", e);
    throw e; // Re-throw to trigger fallback
  }
};

// Database Operations
export const db = {
  // Initial Load
  loadAll: async () => {
    try {
      const sql = getSql();
      if (!sql) throw new Error("No Database URL");

      // Ensure tables exist
      try {
          await sql`SELECT 1 FROM users LIMIT 1`; 
      } catch (e: any) {
          if (e.code === '42P01' || e.message?.includes('does not exist')) {
              await initTables(sql);
          } else {
              throw e; // Connection error
          }
      }

      // Fetch Data
      const users = await sql`SELECT * FROM users WHERE deleted_at IS NULL`;
      const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;

      return {
        users: users as User[],
        jobs: entities.filter((e: any) => e.type === 'JOB').map((e: any) => e.data) as Job[],
        candidates: entities.filter((e: any) => e.type === 'CANDIDATE').map((e: any) => e.data) as Candidate[],
        talents: entities.filter((e: any) => e.type === 'TALENT').map((e: any) => e.data) as TalentProfile[],
        settings: entities.filter((e: any) => e.type === 'SETTING').map((e: any) => e.data) as SettingItem[],
        isMock: false
      };
    } catch (e) {
      console.warn("⚠️ Database connection failed. Loading local MOCK data for preview.", e);
      // FALLBACK TO MOCK DATA
      return { ...MOCK_DATA, isMock: true };
    }
  },
  
  // Auth
  login: async (username: string, pass: string): Promise<User | null> => {
    try {
      const sql = getSql();
      if (!sql) throw new Error("No DB");
      
      const user = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${pass} AND deleted_at IS NULL`;
      if (user.length > 0) {
          const userData = user[0] as User;
          localStorage.setItem('ats_session', JSON.stringify(userData));
          return userData;
      }
    } catch (e) {
      console.warn("⚠️ Login via DB failed. Checking mock users.");
      // Fallback Login
      const mockUser = MOCK_DATA.users.find(u => u.username === username && u.password === pass);
      if (mockUser) {
         localStorage.setItem('ats_session', JSON.stringify(mockUser));
         return mockUser;
      }
    }
    return null;
  },

  verifyPassword: async (userId: string, pass: string): Promise<boolean> => {
    try {
      const sql = getSql();
      if (!sql) throw new Error("No DB");
      const rows = await sql`SELECT * FROM users WHERE id = ${userId} AND password = ${pass} AND deleted_at IS NULL`;
      return rows.length > 0;
    } catch {
      // Mock Fallback
      const mockUser = MOCK_DATA.users.find(u => u.id === userId && u.password === pass);
      return !!mockUser;
    }
  },

  logout: () => {
    localStorage.removeItem('ats_session');
  },

  getSession: (): User | null => {
    const stored = localStorage.getItem('ats_session');
    return stored ? JSON.parse(stored) : null;
  },

  // --- CRUD Wrappers (Resilient) ---
  // If DB fails, these functions will silently fail (or log) but not crash the UI
  // In a real mock scenario, we'd update an in-memory variable, but for preview visualization
  // simply returning success is often enough to show the UI change (since Context updates state locally).

  saveUser: async (user: User) => {
    try {
      const sql = getSql();
      if (!sql) throw new Error("No DB");
      await sql`
          INSERT INTO users (id, username, password, name, role, created_by)
          VALUES (${user.id}, ${user.username}, ${user.password}, ${user.name}, ${user.role}, ${user.createdBy})
          ON CONFLICT (id) DO UPDATE SET
          username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role
      `;
    } catch (e) { console.warn("Mock Save User (Persistence disabled)"); }
  },

  saveEntity: async (id: string, type: string, data: any) => {
     try {
       const sql = getSql();
       if (!sql) throw new Error("No DB");
       await sql`
          INSERT INTO entities (id, type, data)
          VALUES (${id}, ${type}, ${data})
          ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data, deleted_at = NULL
       `;
     } catch (e) { console.warn(`Mock Save ${type} (Persistence disabled)`); }
  },
  
  deleteEntity: async (id: string) => {
     try {
       const sql = getSql();
       if (!sql) throw new Error("No DB");
       await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}`;
     } catch (e) { console.warn("Mock Delete (Persistence disabled)"); }
  },

  // Typed Helpers
  saveJob: async (job: Job) => db.saveEntity(job.id, 'JOB', job),
  deleteJob: async (id: string, userId: string) => db.deleteEntity(id),

  saveCandidate: async (candidate: Candidate) => db.saveEntity(candidate.id, 'CANDIDATE', candidate),
  deleteCandidate: async (id: string) => db.deleteEntity(id),

  saveTalent: async (talent: TalentProfile) => db.saveEntity(talent.id, 'TALENT', talent),
  deleteTalent: async (id: string) => db.deleteEntity(id),

  saveSettings: async (settings: SettingItem[]) => {
    try {
        const sql = getSql();
        if (!sql) throw new Error("No DB");
        for (const s of settings) {
            await sql`INSERT INTO entities (id, type, data) VALUES (${s.id}, 'SETTING', ${s}) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
        }
    } catch (e) { console.warn("Mock Save Settings"); }
  },
  
  deleteSetting: async (id: string) => db.deleteEntity(id)
};
