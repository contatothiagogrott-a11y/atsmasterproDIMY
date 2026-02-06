
import { neon } from '@neondatabase/serverless';
// Importa APENAS as funções específicas
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

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  if (!process.env.DATABASE_URL) {
    return Response.json({ error: 'DATABASE_URL is not set.' }, { status: 500 });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    if (action === 'verify-password') {
      const { userId, password } = await request.json();
      const rows = await sql`SELECT password FROM users WHERE id = ${userId}::uuid AND deleted_at IS NULL`;
      if (rows.length > 0) {
        const isMatch = await bcrypt.compare(password, rows[0].password);
        return Response.json({ valid: isMatch });
      }
      return Response.json({ valid: false });
    }

    if (action === 'save-user') {
      const user = await request.json();
      // Hash password if provided (for new users or password changes)
      let hashedPassword = user.password;
      if (user.password && !user.password.startsWith('$2a$')) { // Simple check to see if it's already hashed
        hashedPassword = await bcrypt.hash(user.password, 10);
      }

      await sql`
        INSERT INTO users (id, username, password, name, role, created_by)
        VALUES (${user.id}::uuid, ${user.username}, ${hashedPassword}, ${user.name}, ${user.role}, ${user.created_by ? user.created_by + '::uuid' : null})
        ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role
      `;
      return Response.json({ success: true });
    }

    if (action === 'get-data') {
      try {
        const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
        const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;
        return Response.json({ entities, users });
      } catch (err: any) {
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
           await initTables(sql);
           const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
           const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;
           return Response.json({ entities, users });
        }
        throw err;
      }
    }

    if (action === 'save-entity') {
      const { id, type, data } = await request.json();
      await sql`
        INSERT INTO entities (id, type, data)
        VALUES (${id}::uuid, ${type}, ${data})
        ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data, deleted_at = NULL
      `;
      return Response.json({ success: true });
    }

    if (action === 'delete-entity') {
      const { id } = await request.json();
      await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}::uuid`;
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Action not found' }, { status: 404 });

  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
