import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

export const config = {
  runtime: 'nodejs',
};

async function initTables(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      type TEXT NOT NULL, 
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );
  `;

  const hashedPassword = await bcrypt.hash('master.123', 10);
  
  await sql`
    INSERT INTO users (id, username, password, name, role)
    VALUES ('u-master', 'masteraccount', ${hashedPassword}, 'Master Admin', 'MASTER')
    ON CONFLICT (username) DO NOTHING
  `;
}

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const { action } = request.query;
  
  if (!process.env.DATABASE_URL) {
    return response.status(500).json({ error: 'DATABASE_URL is not set.' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // --- 1. RESTAURAR BACKUP (CORRIGIDO) ---
    if (action === 'restore-backup') {
      const { data } = request.body;
      if (!data) return response.status(400).json({ error: 'Dados inválidos' });

      // Restaurar Usuários
      if (data.users && Array.isArray(data.users)) {
        for (const user of data.users) {
          // CORREÇÃO: Verifica se a senha existe. 
          // Se não existir (backup sem senha), define 'mudar.123'
          let passwordToSave = user.password;
          if (!passwordToSave) {
             passwordToSave = 'mudar.123';
          }

          let finalPassword = passwordToSave;
          // Se não for hash (começar com $2a$), criptografa
          if (!passwordToSave.startsWith('$2a$')) {
             finalPassword = await bcrypt.hash(passwordToSave, 10);
          }

          const finalRole = user.role ? user.role.toUpperCase() : 'USER';

          await sql`
            INSERT INTO users (id, username, password, name, role, created_by)
            VALUES (${user.id}, ${user.username}, ${finalPassword}, ${user.name}, ${finalRole}, ${user.createdBy || null})
            ON CONFLICT (username) DO UPDATE SET
            password = EXCLUDED.password, 
            role = EXCLUDED.role,
            name = EXCLUDED.name
          `;
        }
      }

      // Restaurar Entidades
      const insertEntity = async (type: string, item: any) => {
        await sql`
          INSERT INTO entities (id, type, data)
          VALUES (${item.id}, ${type}, ${item})
          ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data, deleted_at = NULL
        `;
      };

      if (data.settings) for (const item of data.settings) await insertEntity('setting', item);
      if (data.jobs) for (const item of data.jobs) await insertEntity('job', item);
      if (data.talents) for (const item of data.talents) await insertEntity('talent', item);
      if (data.candidates) for (const item of data.candidates) await insertEntity('candidate', item);
      
      // Restaurar Lixeira (Novo)
      if (data.trash) {
         for (const item of data.trash) {
            // Insere como deletado (deleted_at = NOW())
            await sql`
              INSERT INTO entities (id, type, data, deleted_at)
              VALUES (${item.id}, ${item.originalType}, ${item}, NOW())
              ON CONFLICT (id) DO UPDATE SET
              data = EXCLUDED.data, deleted_at = NOW()
            `;
         }
      }

      return response.status(200).json({ success: true });
    }

    // --- 2. GET DATA (COM LIXEIRA) ---
    if (action === 'get-data') {
      try {
        const rawEntities = await sql`SELECT * FROM entities`;
        // Nota: Não retornamos password no SELECT por segurança
        const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;

        const active = (type: string) => rawEntities
          .filter((e: any) => e.type === type && !e.deleted_at)
          .map((e: any) => e.data);

        const settings = active('setting');
        const jobs = active('job');
        const talents = active('talent');
        const candidates = active('candidate');

        const trash = rawEntities
          .filter((e: any) => e.deleted_at !== null)
          .map((e: any) => ({
            ...e.data,
            id: e.id,
            deletedAt: e.deleted_at,
            originalType: e.type
          }));

        return response.status(200).json({ 
          users, settings, jobs, talents, candidates, trash 
        });

      } catch (err: any) {
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
           await initTables(sql);
           return response.status(200).json({ users: [], settings: [], jobs: [], talents: [], candidates: [], trash: [] });
        }
        throw err;
      }
    }

    if (action === 'verify-password') {
      const { userId, password } = request.body;
      const rows = await sql`SELECT password FROM users WHERE id = ${userId} AND deleted_at IS NULL`;
      if (rows.length > 0) {
        const isMatch = await bcrypt.compare(password, rows[0].password);
        return response.status(200).json({ valid: isMatch });
      }
      return response.status(200).json({ valid: false });
    }

    if (action === 'save-user') {
      const user = request.body;
      let hashedPassword = user.password;
      if (user.password && !user.password.startsWith('$2a$')) { 
        hashedPassword = await bcrypt.hash(user.password, 10);
      }
      const role = user.role ? user.role.toUpperCase() : 'USER';

      await sql`
        INSERT INTO users (id, username, password, name, role, created_by)
        VALUES (${user.id || crypto.randomUUID()}, ${user.username}, ${hashedPassword}, ${user.name}, ${role}, ${user.created_by || null})
        ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role
      `;
      return response.status(200).json({ success: true });
    }

    if (action === 'save-entity') {
      const { id, type, data } = request.body;
      await sql`
        INSERT INTO entities (id, type, data)
        VALUES (${id}, ${type}, ${data})
        ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data, deleted_at = NULL
      `;
      return response.status(200).json({ success: true });
    }

    if (action === 'delete-entity') {
      const { id, userId } = request.body;
      try {
        const current = await sql`SELECT data FROM entities WHERE id = ${id}`;
        if (current.length > 0) {
           const newData = { ...current[0].data, deletedBy: userId };
           await sql`UPDATE entities SET deleted_at = NOW(), data = ${newData} WHERE id = ${id}`;
        } else {
           await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}`;
        }
      } catch (e) {
        await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}`;
      }
      return response.status(200).json({ success: true });
    }

    if (action === 'restore-entity') {
      const { id } = request.body;
      await sql`UPDATE entities SET deleted_at = NULL WHERE id = ${id}`;
      return response.status(200).json({ success: true });
    }

    if (action === 'permanently-delete-entity') {
      const { id } = request.body;
      await sql`DELETE FROM entities WHERE id = ${id}`;
      await sql`DELETE FROM users WHERE id = ${id}`;
      return response.status(200).json({ success: true });
    }

    return response.status(404).json({ error: 'Action not found' });

  } catch (error: any) {
    console.error("API Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
