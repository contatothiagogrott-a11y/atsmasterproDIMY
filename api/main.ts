
import { neon } from '@neondatabase/serverless';

export const config = {
  runtime: 'edge',
};

async function initTables(sql: any) {
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
      type TEXT NOT NULL, -- 'JOB', 'CANDIDATE', 'TALENT', 'SETTING'
      data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      deleted_at TIMESTAMP
    );
  `;

  // Safely insert master user if not exists
  await sql`
    INSERT INTO users (id, username, password, name, role)
    VALUES ('u-master', 'masteraccount', 'master.123', 'Master Admin', 'MASTER')
    ON CONFLICT (id) DO NOTHING
  `;
}

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL environment variable is not set.' }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // --- AUTHENTICATION ---
    if (action === 'login') {
      const { username, password } = await request.json();
      try {
        const rows = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password} AND deleted_at IS NULL`;
        if (rows.length > 0) {
          return Response.json(rows[0]);
        }
        return Response.json({ error: 'Invalid credentials' }, { status: 401 });
      } catch (err: any) {
        if (err.code === '42P01' || err.message?.includes('does not exist')) { // Undefined table
           await initTables(sql);
           // Retry login after init
           const rows = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password} AND deleted_at IS NULL`;
           if (rows.length > 0) return Response.json(rows[0]);
           return Response.json({ error: 'Invalid credentials' }, { status: 401 });
        }
        throw err;
      }
    }

    if (action === 'verify-password') {
      const { userId, password } = await request.json();
      const rows = await sql`SELECT * FROM users WHERE id = ${userId} AND password = ${password} AND deleted_at IS NULL`;
      return Response.json({ valid: rows.length > 0 });
    }

    // --- USERS CRUD ---
    if (action === 'get-users') {
      const rows = await sql`SELECT * FROM users WHERE deleted_at IS NULL`;
      return Response.json(rows);
    }

    if (action === 'save-user') {
      const user = await request.json();
      await sql`
        INSERT INTO users (id, username, password, name, role, created_by)
        VALUES (${user.id}, ${user.username}, ${user.password}, ${user.name}, ${user.role}, ${user.created_by})
        ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role
      `;
      return Response.json({ success: true });
    }

    // --- ENTITIES CRUD (Jobs, Candidates, Settings, Talents) ---
    if (action === 'get-data') {
      try {
        const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
        const users = await sql`SELECT * FROM users WHERE deleted_at IS NULL`;
        return Response.json({ entities, users });
      } catch (err: any) {
        // Postgres error 42P01: relation does not exist
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
           console.log("Tables missing in get-data, initializing...");
           await initTables(sql);
           // Retry fetch
           const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
           const users = await sql`SELECT * FROM users WHERE deleted_at IS NULL`;
           return Response.json({ entities, users });
        }
        throw err;
      }
    }

    if (action === 'save-entity') {
      const { id, type, data } = await request.json();
      await sql`
        INSERT INTO entities (id, type, data)
        VALUES (${id}, ${type}, ${data})
        ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data, deleted_at = NULL
      `;
      return Response.json({ success: true });
    }

    if (action === 'delete-entity') {
      const { id } = await request.json();
      await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}`;
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Action not found' }, { status: 404 });

  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
