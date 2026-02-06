import { neon } from '@neondatabase/serverless';
// CORREÇÃO 1: Importamos direto as funções, sem o asterisco
import { hash, compare } from 'bcryptjs';

export const config = {
  runtime: 'edge',
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
  
  // CORREÇÃO 2: Usamos 'hash()' direto, sem 'bcrypt.'
  // Ajustei para admin/123456 para seu teste funcionar
  const hashedPassword = await hash('123456', 10);
  
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

    console.log("DATABASE_URL existe?", !!process.env.DATABASE_URL);
    const dbUrl = process.env.DATABASE_URL;
    
    if (!dbUrl) {
      return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), { status: 500 });
    }

    const { username, password } = await request.json();
    const sql = neon(dbUrl);

    try {
      // Busca usuário
      const rows = await sql`SELECT * FROM users WHERE username = ${username} AND deleted_at IS NULL`;
      
      if (rows.length > 0) {
        const user = rows[0];
        // CORREÇÃO 3: Usamos 'compare()' direto
        const isMatch = await compare(password, user.password);
        
        if (isMatch) {
          const { password: _, ...userWithoutPassword } = user;
          return new Response(JSON.stringify(userWithoutPassword), { status: 200 });
        }
      }
      
      return new Response(JSON.stringify({ error: 'Usuário ou senha inválidos' }), { status: 401 });

    } catch (dbErr: any) {
      // Se a tabela não existir, cria e tenta de novo
      if (dbErr.code === '42P01' || dbErr.message?.includes('does not exist')) {
        console.log("Tabelas não encontradas. Inicializando...");
        await initTables(sql);
        
        // Retry logic (Tenta logar de novo agora que criou o admin)
        const rows = await sql`SELECT * FROM users WHERE username = ${username} AND deleted_at IS NULL`;
        
        if (rows.length > 0) {
          const user = rows[0];
          // CORREÇÃO 4: Usamos 'compare()' direto
          const isMatch = await compare(password, user.password);
          
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
