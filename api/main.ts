import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs'; // Importação Padrão do Node.js

export const config = {
  runtime: 'nodejs', // Garante compatibilidade total
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

  // Volta a usar bcrypt.hash (Seguro no Node)
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
        // Volta a usar bcrypt.compare
        const isMatch = await bcrypt.compare(password, rows[0].password);
        return Response.json({ valid: isMatch });
      }
