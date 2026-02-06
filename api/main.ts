import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

export const config = {
  runtime: 'nodejs',
};

async function initTables(sql: any) {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS entities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type TEXT NOT NULL, 
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );
  `;

  const hashedPassword = await bcrypt.hash('master.123', 10);
  
  await sql`
    INSERT INTO users (username, password, name, role)
    VALUES ('masteraccount', ${hashedPassword}, 'Master Admin', 'MASTER')
    ON CONFLICT (username) DO NOTHING
  `;
}

export default async function handler(request: any, response: any) {
  // Configuração de CORS (Permite que o frontend acesse o backend)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Se for uma verificação (OPTIONS), responde OK e para.
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // --- CORREÇÃO AQUI ---
  // No Node.js, não usamos new URL(). Usamos request.query direto.
  const { action } = request.query;
  // ---------------------
  
  if (!process.env.DATABASE_URL) {
    return response.status(500).json({ error: 'DATABASE_URL is not set.' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Ação: Verificar Senha (Login)
    if (action === 'verify-password') {
      // No Node.js, o corpo vem em request.body
      const { userId, password } = request.body;
      const rows = await sql`SELECT password FROM users WHERE id = ${userId}::uuid AND deleted_at IS NULL`;
      if (rows.length > 0) {
        const isMatch = await bcrypt.compare(password, rows[0].password);
        return response.status(200).json({ valid: isMatch });
      }
      return response.status(200).json({ valid: false });
    }

    // Ação: Salvar Usuário
    if (action === 'save-user') {
      const user = request.body;
      let hashedPassword = user.password;
      // Verifica se precisa criptografar
      if (user.password && !user.password.startsWith('$2a$')) { 
        hashedPassword = await bcrypt.hash(user.password, 10);
      }

      await sql`
        INSERT INTO users (id, username, password, name, role, created_by)
        VALUES (${user.id}::uuid, ${user.username}, ${hashedPassword}, ${user.name}, ${user.role}, ${user.created_by ? user.created_by + '::uuid' : null})
        ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role
      `;
      return response.status(200).json({ success: true });
    }

    // Ação: Buscar Dados (Aqui que estava dando erro 500)
    if (action === 'get-data') {
      try {
        const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
        const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;
        return response.status(200).json({ entities, users });
      } catch (err: any) {
        // Se a tabela não existir, cria
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
           await initTables(sql);
           const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
           const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;
           return response.status(200).json({ entities, users });
        }
        throw err;
      }
    }

    // Ação: Salvar Entidade (Jobs, Candidates, etc)
    if (action === 'save-entity') {
      const { id, type, data } = request.body;
      await sql`
        INSERT INTO entities (id, type, data)
        VALUES (${id}::uuid, ${type}, ${data})
        ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data, deleted_at = NULL
      `;
      return response.status(200).json({ success: true });
    }

    // Ação: Deletar Entidade
    if (action === 'delete-entity') {
      const { id } = request.body;
      await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}::uuid`;
      return response.status(200).json({ success: true });
    }

    return response.status(404).json({ error: 'Action not found' });

  } catch (error: any) {
    console.error("API Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
