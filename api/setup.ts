
import { neon } from '@neondatabase/serverless';
// Importa APENAS as funções específicas
import { hash, compare } from 'bcryptjs';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Tabela de Usuários com UUID real
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

    // Tabela Genérica para Dados com UUID real
    await sql`
      CREATE TABLE IF NOT EXISTS entities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL, 
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        deleted_at TIMESTAMP
      );
    `;

    // Criar usuário Master padrão se não existir (Deixando o banco gerar o ID)
    const masterExists = await sql`SELECT * FROM users WHERE username = 'masteraccount'`;
    
    if (masterExists.length === 0) {
      const hashedPassword = await bcrypt.hash('master.123', 10);
      await sql`
        INSERT INTO users (username, password, name, role)
        VALUES ('masteraccount', ${hashedPassword}, 'Master Admin', 'MASTER')
      `;
    }

    return new Response(JSON.stringify({ message: 'Database tables updated to UUID successfully' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
