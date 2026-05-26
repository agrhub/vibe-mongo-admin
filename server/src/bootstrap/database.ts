import path from "path";
import fs from "fs";
const Datastore = require('@seald-io/nedb');

export function setupDatabaseStats() {
    const isProd = process.env.NODE_ENV === 'production';
    const dir_data = path.join(__dirname, '../../data/');
    const dbStatsPath = path.join(dir_data, isProd ? 'dbStats.db?nolock=1' : 'dbStats.db');

    // Check existence of data dir
    if (!fs.existsSync(dir_data)) fs.mkdirSync(dir_data);

    const db = new Datastore({ filename: dbStatsPath, autoload: true });

    // Check existence of backups dir, create if nothing
    const dir_backups = path.join(__dirname, '../../backups/');
    if (!fs.existsSync(dir_backups)) fs.mkdirSync(dir_backups);

    return db;
}
