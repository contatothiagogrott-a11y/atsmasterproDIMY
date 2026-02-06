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

export default async function handler(request: Request) {
  console.log("Tentando iniciar login...");
  
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), { status: 500 });
    }

    const { username, password } = await request.json();
    const sql = neon(dbUrl);

    try {
      const rows = await sql`SELECT * FROM users WHERE username = ${username} AND deleted_at IS NULL`;
      
      if (rows.length > 0) {
        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (isMatch) {
          const { password: _, ...userWithoutPassword } = user;
          return new Response(JSON.stringify(userWithoutPassword), { status: 200 });
        }
      }
      
      return new Response(JSON.stringify({ error: 'Usuário ou senha inválidos' }), { status: 401 });

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
             return new Response(JSON.stringify(userWithoutPassword), { status: 200 });
          }
        }
        return new Response(JSON.stringify({ error: 'Usuário ou senha inválidos' }), { status: 401 });
      }
      throw dbErr;
    }
  } catch (error: any) {
    console.error("ERRO FATAL NO LOGIN:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { status: 500 });
  }
}
