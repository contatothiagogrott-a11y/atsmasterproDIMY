import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

export const config = {
  runtime: 'nodejs',
};

async function initTables(sql: any) {
  // MUDANÇA: id agora é TEXT para aceitar "u-master" e outros IDs antigos
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

  // MUDANÇA: id agora é TEXT
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
    // --- FUNÇÃO DE RESTAURAR BACKUP ---
    if (action === 'restore-backup') {
      const { data } = request.body;
      
      if (!data) {
        return response.status(400).json({ error: 'Dados inválidos ou vazios' });
      }

      // 1. Restaurar Usuários
      if (data.users && Array.isArray(data.users)) {
        for (const user of data.users) {
          let finalPassword = user.password;
          if (!user.password.startsWith('$2a$')) {
             finalPassword = await bcrypt.hash(user.password, 10);
          }
          const finalRole = user.role ? user.role.toUpperCase() : 'USER';

          // REMOVIDO ::uuid PARA ACEITAR TEXTO
          await sql`
            INSERT INTO users (id, username, password, name, role, created_by)
            VALUES (${user.id}, ${user.username}, ${finalPassword}, ${user.name}, ${finalRole}, ${user.createdBy || null})
            ON CONFLICT (username) DO UPDATE SET
            password = EXCLUDED.password,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            id = EXCLUDED.id
          `;
        }
      }

      // 2. Restaurar Entidades
      const insertEntity = async (type: string, item: any) => {
        // REMOVIDO ::uuid
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

      return response.status(200).json({ success: true, message: 'Backup restaurado com sucesso!' });
    }

    if (action === 'verify-password') {
      const { userId, password } = request.body;
      // REMOVIDO ::uuid
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

      // REMOVIDO ::uuid
      await sql`
        INSERT INTO users (id, username, password, name, role, created_by)
        VALUES (${user.id || crypto.randomUUID()}, ${user.username}, ${hashedPassword}, ${user.name}, ${role}, ${user.created_by || null})
        ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role
      `;
      return response.status(200).json({ success: true });
    }

    if (action === 'get-data') {
      try {
        const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
        const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;
        return response.status(200).json({ entities, users });
      } catch (err: any) {
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
           await initTables(sql);
           const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
           const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;
           return response.status(200).json({ entities, users });
        }
        throw err;
      }
    }

    if (action === 'save-entity') {
      const { id, type, data } = request.body;
      // REMOVIDO ::uuid
      await sql`
        INSERT INTO entities (id, type, data)
        VALUES (${id}, ${type}, ${data})
        ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data, deleted_at = NULL
      `;
      return response.status(200).json({ success: true });
    }

    if (action === 'delete-entity') {
      const { id } = request.body;
      // REMOVIDO ::uuid
      await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}`;
      return response.status(200).json({ success: true });
    }

    return response.status(404).json({ error: 'Action not found' });

  } catch (error: any) {
    console.error("API Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
