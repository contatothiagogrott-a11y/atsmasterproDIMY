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
  
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  await sql`
    INSERT INTO users (username, password, name, role)
    VALUES ('admin', ${hashedPassword}, 'Administrador', 'MASTER')
    ON CONFLICT (username) DO NOTHING
  `;
}

// Assinatura Node.js: (req, res)
export default async function handler(request: any, response: any) {
  console.log("Tentando iniciar login...");
  
  // CORS Básico (opcional, ajuda em alguns casos)
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  
  try {
    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return response.status(500).json({ error: 'DATABASE_URL not configured' });
    }

    // Node.js já traz o body parseado automaticamente
    const { username, password } = request.body;
    const sql = neon(dbUrl);

    try {
      const rows = await sql`SELECT * FROM users WHERE username = ${username} AND deleted_at IS NULL`;
      
      if (rows.length > 0) {
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
          const { password: _, ...userWithoutPassword } = user;
          return response.status(200).json(userWithoutPassword);
        }
      }
      
      return response.status(401).json({ error: 'Usuário ou senha inválidos' });

    } catch (dbErr: any) {
      if (dbErr.code === '42P01' || dbErr.message?.includes('does not exist')) {
        console.log("Tabelas não encontradas. Inicializando...");
        await initTables(sql);
        
        const rows = await sql`SELECT * FROM users WHERE username = ${username} AND deleted_at IS NULL`;
        if (rows.length > 0) {
          const user = rows[0];
          const isMatch = await bcrypt.compare(password, user.password);
          if (isMatch) {
             const { password: _, ...userWithoutPassword } = user;
             return response.status(200).json(userWithoutPassword);
          }
        }
        return response.status(401).json({ error: 'Usuário ou senha inválidos' });
      }
      throw dbErr;
    }
  } catch (error: any) {
    console.error("ERRO FATAL NO LOGIN:", error);
    return response.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
