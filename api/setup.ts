import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

export const config = {
  runtime: 'nodejs',
};

export default async function handler(request: any, response: any) {
  try {
    const sql = neon(process.env.DATABASE_URL!);

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

    const masterExists = await sql`SELECT * FROM users WHERE username = 'masteraccount'`;
     
    if (masterExists.length === 0) {
      const hashedPassword = await bcrypt.hash('master.123', 10);
      await sql`
        INSERT INTO users (username, password, name, role)
        VALUES ('masteraccount', ${hashedPassword}, 'Master Admin', 'MASTER')
      `;
    }

    return response.status(200).json({ message: 'Database tables updated to UUID successfully' });
  } catch (error: any) {
    console.error(error);
    return response.status(500).json({ error: error.message });
  }
}
