
import { neon } from '@neondatabase/serverless';

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
      deleted_at TIMESTAMP
    );
  `;
  // Seed initial user without forcing a hardcoded ID string
  await sql`
    INSERT INTO users (username, password, name, role)
    VALUES ('masteraccount', 'master.123', 'Master Admin', 'MASTER')
    ON CONFLICT (username) DO NOTHING
  `;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'DATABASE_URL not configured' }), { status: 500 });
  }

  try {
    const { username, password } = await request.json();
    const sql = neon(dbUrl);

    try {
      const rows = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password} AND deleted_at IS NULL`;
      if (rows.length > 0) {
        return new Response(JSON.stringify(rows[0]), { status: 200 });
      }
      return new Response(JSON.stringify({ error: 'Usuário ou senha inválidos' }), { status: 401 });
    } catch (dbErr: any) {
      if (dbErr.code === '42P01' || dbErr.message?.includes('does not exist')) {
        await initTables(sql);
        const rows = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password} AND deleted_at IS NULL`;
        if (rows.length > 0) return new Response(JSON.stringify(rows[0]), { status: 200 });
        return new Response(JSON.stringify({ error: 'Usuário ou senha inválidos' }), { status: 401 });
      }
      throw dbErr;
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
