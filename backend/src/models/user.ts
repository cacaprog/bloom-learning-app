import { db } from '../services/db.service.js';

export interface User {
  id: string;
  email: string;
  created_at?: Date;
  timezone?: string;
}

export class UserModel {
  public static async create(user: User): Promise<User> {
    const query = `
      INSERT INTO users (id, email, timezone)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const res = await db.query(query, [user.id, user.email, user.timezone || 'UTC']);
    return res.rows[0];
  }

  public static async findById(id: string): Promise<User | null> {
    const query = `SELECT * FROM users WHERE id = $1;`;
    const res = await db.query(query, [id]);
    return res.rows[0] || null;
  }
}
