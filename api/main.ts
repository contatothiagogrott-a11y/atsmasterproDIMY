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

export default async function handler(request: any, response: any) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const { action } = request.query;
  
  if (!process.env.DATABASE_URL) {
    return response.status(500).json({ error: 'DATABASE_URL is not set.' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    // --- NOVO: FUNÇÃO DE RESTAURAR BACKUP ---
    if (action === 'restore-backup') {
      const { data } = request.body; // Recebe o JSON completo (objeto 'data' do seu arquivo)
      
      if (!data) {
        return response.status(400).json({ error: 'Dados inválidos ou vazios' });
      }

      // 1. Restaurar Usuários
      if (data.users && Array.isArray(data.users)) {
        for (const user of data.users) {
          // Importante: Verifica se a senha já está criptografada (começa com $2a$)
          // Se for senha antiga (texto puro), criptografa agora.
          let finalPassword = user.password;
          if (!user.password.startsWith('$2a$')) {
             finalPassword = await bcrypt.hash(user.password, 10);
          }

          // Ajuste de role para MAIÚSCULO para evitar bugs
          const finalRole = user.role ? user.role.toUpperCase() : 'USER';

          await sql`
            INSERT INTO users (id, username, password, name, role)
            VALUES (${user.id}::uuid, ${user.username}, ${finalPassword}, ${user.name}, ${finalRole})
            ON CONFLICT (username) DO UPDATE SET
            password = EXCLUDED.password,
            name = EXCLUDED.name,
            role = EXCLUDED.role
          `;
        }
      }

      // 2. Restaurar Entidades (Vagas, Talentos, Candidatos, Configs)
      // Função auxiliar para inserir em lote
      const insertEntity = async (type: string, item: any) => {
        // Se o item não tiver ID, geramos um UUID aleatório temporário se o banco não gerar
        // Mas seu arquivo já tem IDs, então vamos usá-los (convertendo para UUID se necessário)
        // Nota: Se seus IDs antigos não forem UUIDs válidos (ex: "s1", "u1"), 
        // o ideal é deixar o banco gerar novo ID ou forçar uuid se possível.
        // Pelo seu arquivo, alguns IDs são curtos ("s1"). O Postgres vai chiar se tentar forçar UUID neles.
        // SOLUÇÃO: Para IDs curtos, vamos deixar o banco criar novos IDs UUID.
        // Para IDs que parecem UUIDs (longos), tentamos manter.
        
        const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        
        // Vamos salvar o ID antigo dentro do "data" para referência, mas usar ID novo no banco se não for UUID
        const itemData = { ...item, oldId: item.id };
        
        await sql`
          INSERT INTO entities (type, data)
          VALUES (${type}, ${itemData})
        `;
      };

      // Importar Settings (Setores/Unidades)
      if (data.settings) {
        for (const item of data.settings) await insertEntity('setting', item);
      }
      // Importar Jobs (Vagas)
      if (data.jobs) {
        for (const item of data.jobs) await insertEntity('job', item);
      }
      // Importar Talents (Banco de Talentos)
      if (data.talents) {
        for (const item of data.talents) await insertEntity('talent', item);
      }
      // Importar Candidates (Candidaturas)
      if (data.candidates) {
        for (const item of data.candidates) await insertEntity('candidate', item);
      }

      return response.status(200).json({ success: true, message: 'Backup restaurado com sucesso!' });
    }
    // ----------------------------------------

    if (action === 'verify-password') {
      const { userId, password } = request.body;
      const rows = await sql`SELECT password FROM users WHERE id = ${userId}::uuid AND deleted_at IS NULL`;
      if (rows.length > 0) {
        const isMatch = await bcrypt.compare(password, rows[0].password);
        return response.status(200).json({ valid: isMatch });
      }
      return response.status(200).json({ valid: false });
    }

    if (action === 'save-user') {
      const user = request.body;
      let hashedPassword = user.password;
      if (user.password && !user.password.startsWith('$2a$')) { 
        hashedPassword = await bcrypt.hash(user.password, 10);
      }

      const role = user.role ? user.role.toUpperCase() : 'USER';

      await sql`
        INSERT INTO users (id, username, password, name, role, created_by)
        VALUES (${user.id}::uuid, ${user.username}, ${hashedPassword}, ${user.name}, ${role}, ${user.created_by ? user.created_by + '::uuid' : null})
        ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username, password = EXCLUDED.password, name = EXCLUDED.name, role = EXCLUDED.role
      `;
      return response.status(200).json({ success: true });
    }

    if (action === 'get-data') {
      try {
        const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
        const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;
        return response.status(200).json({ entities, users });
      } catch (err: any) {
        if (err.code === '42P01' || err.message?.includes('does not exist')) {
           await initTables(sql);
           const entities = await sql`SELECT * FROM entities WHERE deleted_at IS NULL`;
           const users = await sql`SELECT id, username, name, role, created_by FROM users WHERE deleted_at IS NULL`;
           return response.status(200).json({ entities, users });
        }
        throw err;
      }
    }

    if (action === 'save-entity') {
      const { id, type, data } = request.body;
      await sql`
        INSERT INTO entities (id, type, data)
        VALUES (${id}::uuid, ${type}, ${data})
        ON CONFLICT (id) DO UPDATE SET
        data = EXCLUDED.data, deleted_at = NULL
      `;
      return response.status(200).json({ success: true });
    }

    if (action === 'delete-entity') {
      const { id } = request.body;
      await sql`UPDATE entities SET deleted_at = NOW() WHERE id = ${id}::uuid`;
      return response.status(200).json({ success: true });
    }

    return response.status(404).json({ error: 'Action not found' });

  } catch (error: any) {
    console.error("API Error:", error);
    return response.status(500).json({ error: error.message });
  }
}
