"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectionStore = exports.ConnectionStore = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const crypto_1 = require("../utils/crypto");
const path_1 = __importDefault(require("path"));
const isProd = process.env.NODE_ENV === 'production';
const DB_PATH = path_1.default.join(__dirname, '../../data', isProd ? 'connections.db?nolock=1' : 'connections.db');
class ConnectionStore {
    dbPromise = null;
    async getDb() {
        if (!this.dbPromise) {
            const dbFilename = 'file:' + DB_PATH;
            this.dbPromise = (0, sqlite_1.open)({
                filename: dbFilename,
                driver: sqlite3_1.default.Database,
                mode: sqlite3_1.default.OPEN_READWRITE | sqlite3_1.default.OPEN_CREATE | sqlite3_1.default.OPEN_URI
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
    async listConnections() {
        const db = await this.getDb();
        const rows = await db.all('SELECT * FROM connections ORDER BY id DESC');
        return rows.map(row => ({
            ...row,
            uri: (0, crypto_1.decrypt)(row.uri)
        }));
    }
    /**
     * Save or update a connection profile
     */
    async saveConnection(name, uri) {
        const db = await this.getDb();
        const encryptedUri = (0, crypto_1.encrypt)(uri);
        // Check if name already exists
        const existing = await db.get('SELECT id FROM connections WHERE name = ?', name);
        if (existing) {
            await db.run('UPDATE connections SET uri = ? WHERE name = ?', encryptedUri, name);
            return { id: existing.id, name, uri };
        }
        else {
            const result = await db.run('INSERT INTO connections (name, uri) VALUES (?, ?)', name, encryptedUri);
            return { id: result.lastID, name, uri };
        }
    }
    /**
     * Get a saved connection profile by ID or name
     */
    async getConnection(idOrName) {
        const db = await this.getDb();
        let row;
        if (typeof idOrName === 'number') {
            row = await db.get('SELECT * FROM connections WHERE id = ?', idOrName);
        }
        else {
            row = await db.get('SELECT * FROM connections WHERE name = ?', idOrName);
        }
        if (!row)
            return null;
        return {
            ...row,
            uri: (0, crypto_1.decrypt)(row.uri)
        };
    }
    /**
     * Delete a connection profile
     */
    async deleteConnection(id) {
        const db = await this.getDb();
        const result = await db.run('DELETE FROM connections WHERE id = ?', id);
        return (result.changes ?? 0) > 0;
    }
}
exports.ConnectionStore = ConnectionStore;
exports.connectionStore = new ConnectionStore();
