
import { sql } from '@vercel/postgres';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  try {
    // Tabela de Usuários
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

    // Tabela Genérica para Dados (Jobs, Candidates, Talents, Settings)
    // Utilizamos JSONB para armazenar a estrutura complexa do TypeScript sem precisar de centenas de colunas
    // e separamos por 'type' para filtrar.
    await sql`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, -- 'JOB', 'CANDIDATE', 'TALENT', 'SETTING'
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `;

    // Criar usuário Master padrão se não existir
    const masterExists = await sql`SELECT * FROM users WHERE username = 'masteraccount'`;
    if (masterExists.rowCount === 0) {
      await sql`
        INSERT INTO users (id, username, password, name, role)
        VALUES ('u-master', 'masteraccount', 'master.123', 'Master Admin', 'MASTER')
      `;
    }

    return new Response(JSON.stringify({ message: 'Database tables created successfully' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
