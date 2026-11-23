const db = require('../config/db');

let isMigrationChecked = false;
async function ensurePermissionsColumn() {
  if (isMigrationChecked) return;
  try {
    await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'`);
    isMigrationChecked = true;
  } catch (e) {
    // Graceful check ignore
  }
}

class UserModel {
  static async findByEmail(email) {
    await ensurePermissionsColumn();
    const cleanEmail = email.toLowerCase().trim();
    const sql = `
      SELECT 
        id, name, email, password_hash as "passwordHash",
        role, phone, COALESCE(permissions, '[]'::jsonb) as permissions,
        status, created_at as "createdAt"
      FROM users
      WHERE email = $1
    `;
    let result = await db.query(sql, [cleanEmail]);
    if (result.rows.length === 0 && (cleanEmail === 'admin@gmail.com' || cleanEmail === 'admin@distributor.com')) {
      const altEmail = cleanEmail === 'admin@gmail.com' ? 'admin@distributor.com' : 'admin@gmail.com';
      result = await db.query(sql, [altEmail]);
    }
    return result.rows[0];
  }

  static async findById(id) {
    await ensurePermissionsColumn();
    const sql = `
      SELECT 
        id, name, email, role, phone,
        COALESCE(permissions, '[]'::jsonb) as permissions,
        status, created_at as "createdAt"
      FROM users
      WHERE id = $1
    `;
    const result = await db.query(sql, [id]);
    return result.rows[0];
  }

  static async findAll() {
    await ensurePermissionsColumn();
    const sql = `
      SELECT 
        id, name, email, role, phone,
        COALESCE(permissions, '[]'::jsonb) as permissions,
        status, created_at as "createdAt"
      FROM users
      ORDER BY created_at ASC
    `;
    const result = await db.query(sql);
    return result.rows;
  }

  static async createUser({ id, name, email, passwordHash, role = 'distributor_owner', phone = null, permissions = [] }) {
    await ensurePermissionsColumn();
    const sql = `
      INSERT INTO users (id, name, email, password_hash, role, phone, permissions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, email, role, phone, COALESCE(permissions, '[]'::jsonb) as permissions, status, created_at as "createdAt"
    `;
    const result = await db.query(sql, [
      id,
      name,
      email.toLowerCase().trim(),
      passwordHash,
      role,
      phone,
      JSON.stringify(permissions || []),
    ]);
    return result.rows[0];
  }

  static async updateUser(id, { name, role, phone, permissions, status }) {
    await ensurePermissionsColumn();
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(name);
    }
    if (role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(role);
    }
    if (phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(phone);
    }
    if (permissions !== undefined) {
      fields.push(`permissions = $${idx++}`);
      values.push(JSON.stringify(permissions));
    }
    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
    }

    if (fields.length === 0) return await UserModel.findById(id);

    values.push(id);
    const sql = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING id, name, email, role, phone, COALESCE(permissions, '[]'::jsonb) as permissions, status, created_at as "createdAt"
    `;
    const result = await db.query(sql, values);
    return result.rows[0];
  }

  static async deleteUser(id) {
    const sql = `
      DELETE FROM users
      WHERE id = $1
      RETURNING id
    `;
    const result = await db.query(sql, [id]);
    return result.rowCount > 0;
  }
}

module.exports = UserModel;
