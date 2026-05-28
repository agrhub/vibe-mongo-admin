import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

const isProd = process.env.NODE_ENV === 'production';
const DB_PATH = path.join(__dirname, '../../data', isProd ? 'connections.db?nolock=1' : 'connections.db');

export interface WebhookConfig {
  id?: number;
  connName: string;
  url: string;
  email?: string;
  slowQueries: number; // 0 or 1
  systemSpikes: number; // 0 or 1
  connectionFailures: number; // 0 or 1
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: number; // 0 or 1
  smtpUser?: string;
  smtpPass?: string;
  smtpSender?: string;
  enableGrouping?: number; // 0 or 1
  groupWindow?: number; // minutes
  createdAt?: string;
}

export class WebhookStore {
  private dbPromise: Promise<Database> | null = null;

  private async getDb(): Promise<Database> {
    if (!this.dbPromise) {
      const dbFilename = 'file:' + DB_PATH;
      this.dbPromise = open({
        filename: dbFilename,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE | sqlite3.OPEN_URI
      }).then(async (db) => {
        // Initialize schema
        await db.exec(`
          CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            connName TEXT UNIQUE NOT NULL,
            url TEXT NOT NULL,
            slowQueries INTEGER DEFAULT 1,
            systemSpikes INTEGER DEFAULT 1,
            connectionFailures INTEGER DEFAULT 1,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        // Safely add column if not exists
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN email TEXT DEFAULT ""');
        } catch (e) {}
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN smtpHost TEXT DEFAULT ""');
        } catch (e) {}
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN smtpPort INTEGER DEFAULT 587');
        } catch (e) {}
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN smtpSecure INTEGER DEFAULT 0');
        } catch (e) {}
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN smtpUser TEXT DEFAULT ""');
        } catch (e) {}
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN smtpPass TEXT DEFAULT ""');
        } catch (e) {}
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN smtpSender TEXT DEFAULT ""');
        } catch (e) {}
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN enableGrouping INTEGER DEFAULT 1');
        } catch (e) {}
        try {
          await db.exec('ALTER TABLE webhooks ADD COLUMN groupWindow INTEGER DEFAULT 5');
        } catch (e) {}
        return db;
      });
    }
    return this.dbPromise;
  }

  async getWebhook(connName: string): Promise<WebhookConfig | null> {
    const db = await this.getDb();
    const row = await db.get<WebhookConfig>('SELECT * FROM webhooks WHERE connName = ?', connName);
    if (!row) return null;
    return row;
  }

  async saveWebhook(
    connName: string,
    url: string,
    slowQueries: number,
    systemSpikes: number,
    connectionFailures: number,
    email: string = '',
    smtpHost: string = '',
    smtpPort: number = 587,
    smtpSecure: number = 0,
    smtpUser: string = '',
    smtpPass: string = '',
    smtpSender: string = '',
    enableGrouping: number = 1,
    groupWindow: number = 5
  ): Promise<WebhookConfig> {
    const db = await this.getDb();

    const existing = await db.get('SELECT id FROM webhooks WHERE connName = ?', connName);
    if (existing) {
      await db.run(
        `UPDATE webhooks SET 
          url = ?, 
          slowQueries = ?, 
          systemSpikes = ?, 
          connectionFailures = ?, 
          email = ?, 
          smtpHost = ?, 
          smtpPort = ?, 
          smtpSecure = ?, 
          smtpUser = ?, 
          smtpPass = ?, 
          smtpSender = ?,
          enableGrouping = ?,
          groupWindow = ?
        WHERE connName = ?`,
        url,
        slowQueries,
        systemSpikes,
        connectionFailures,
        email,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        smtpSender,
        enableGrouping,
        groupWindow,
        connName
      );
      return { 
        id: existing.id, 
        connName, 
        url, 
        slowQueries, 
        systemSpikes, 
        connectionFailures, 
        email, 
        smtpHost, 
        smtpPort, 
        smtpSecure, 
        smtpUser, 
        smtpPass, 
        smtpSender,
        enableGrouping,
        groupWindow
      };
    } else {
      const result = await db.run(
        `INSERT INTO webhooks (
          connName, 
          url, 
          slowQueries, 
          systemSpikes, 
          connectionFailures, 
          email, 
          smtpHost, 
          smtpPort, 
          smtpSecure, 
          smtpUser, 
          smtpPass, 
          smtpSender,
          enableGrouping,
          groupWindow
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        connName,
        url,
        slowQueries,
        systemSpikes,
        connectionFailures,
        email,
        smtpHost,
        smtpPort,
        smtpSecure,
        smtpUser,
        smtpPass,
        smtpSender,
        enableGrouping,
        groupWindow
      );
      return { 
        id: result.lastID, 
        connName, 
        url, 
        slowQueries, 
        systemSpikes, 
        connectionFailures, 
        email, 
        smtpHost, 
        smtpPort, 
        smtpSecure, 
        smtpUser, 
        smtpPass, 
        smtpSender,
        enableGrouping,
        groupWindow
      };
    }
  }

  async deleteWebhook(connName: string): Promise<boolean> {
    const db = await this.getDb();
    const result = await db.run('DELETE FROM webhooks WHERE connName = ?', connName);
    return (result.changes ?? 0) > 0;
  }
}

export const webhookStore = new WebhookStore();
