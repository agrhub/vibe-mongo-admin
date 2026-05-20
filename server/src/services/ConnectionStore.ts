import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { encrypt, decrypt } from '../utils/crypto.js';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'connections.db');

export interface MongoConnectionInfo {
  id?: number;
  name: string;
  uri: string;
  createdAt?: string;
}

export class ConnectionStore {
  private dbPromise: Promise<Database> | null = null;

  private async getDb(): Promise<Database> {
    if (!this.dbPromise) {
      this.dbPromise = open({
        filename: DB_PATH,
        driver: sqlite3.Database
      }).then(async (db) => {
        // Initialize schema
        await db.exec(`
          CREATE TABLE IF NOT EXISTS connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            uri TEXT NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        return db;
      });
    }
    return this.dbPromise;
  }

  /**
   * List all saved connections (with decrypted URIs)
   */
  async listConnections(): Promise<MongoConnectionInfo[]> {
    const db = await this.getDb();
    const rows = await db.all<MongoConnectionInfo[]>('SELECT * FROM connections ORDER BY id DESC');
    return rows.map(row => ({
      ...row,
      uri: decrypt(row.uri)
    }));
  }

  /**
   * Save or update a connection profile
   */
  async saveConnection(name: string, uri: string): Promise<MongoConnectionInfo> {
    const db = await this.getDb();
    const encryptedUri = encrypt(uri);

    // Check if name already exists
    const existing = await db.get('SELECT id FROM connections WHERE name = ?', name);
    if (existing) {
      await db.run('UPDATE connections SET uri = ? WHERE name = ?', encryptedUri, name);
      return { id: existing.id, name, uri };
    } else {
      const result = await db.run(
        'INSERT INTO connections (name, uri) VALUES (?, ?)',
        name,
        encryptedUri
      );
      return { id: result.lastID, name, uri };
    }
  }

  /**
   * Get a saved connection profile by ID or name
   */
  async getConnection(idOrName: number | string): Promise<MongoConnectionInfo | null> {
    const db = await this.getDb();
    let row;
    if (typeof idOrName === 'number') {
      row = await db.get<MongoConnectionInfo>('SELECT * FROM connections WHERE id = ?', idOrName);
    } else {
      row = await db.get<MongoConnectionInfo>('SELECT * FROM connections WHERE name = ?', idOrName);
    }

    if (!row) return null;
    return {
      ...row,
      uri: decrypt(row.uri)
    };
  }

  /**
   * Delete a connection profile
   */
  async deleteConnection(id: number): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.run('DELETE FROM connections WHERE id = ?', id);
    return (result.changes ?? 0) > 0;
  }
}

export const connectionStore = new ConnectionStore();
