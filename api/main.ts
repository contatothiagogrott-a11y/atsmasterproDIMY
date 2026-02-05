
import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  try {
    // --- AUTHENTICATION ---
    if (action === 'login') {
      const { username, password } = await request.json();
      const { rows } = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password} AND deleted_at IS NULL`;
      
      if (rows.length > 0) {
        return Response.json(rows[0]);
      }
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (action === 'verify-password') {
      const { userId, password } = await request.json();
      const { rows } = await sql`SELECT * FROM users WHERE id = ${userId} AND password = ${password} AND deleted_at IS NULL`;
      return Response.json({ valid: rows.length > 0 });
    }

    // --- USERS CRUD ---
    if (action === 'get-users') {
      const { rows } = await sql`SELECT * FROM users WHERE deleted_at IS NULL`;
      return Response.json(rows);
    }

    if (action === 'save-user') {
      const user = await request.json();
      // Upsert logic
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
      // Retorna TUDO que não foi deletado (para carregar o app)
      const { rows: entities } = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
      const { rows: users } = await sql`SELECT * FROM users WHERE deleted_at IS NULL`;
      return Response.json({ entities, users });
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
      // Soft Delete
      await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}`;
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Action not found' }, { status: 404 });

  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
