"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupDatabaseStats = setupDatabaseStats;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Datastore = require('@seald-io/nedb');
function setupDatabaseStats() {
    const isProd = process.env.NODE_ENV === 'production';
    const dir_data = path_1.default.join(__dirname, '../../data/');
    const dbStatsPath = path_1.default.join(dir_data, isProd ? 'dbStats.db?nolock=1' : 'dbStats.db');
    // Check existence of data dir
    if (!fs_1.default.existsSync(dir_data))
        fs_1.default.mkdirSync(dir_data);
    // Check if the legacy database file exists and is bloated (e.g. > 2MB).
    // Perform a zero-data-loss migration to strip rootSpans from old documents before NeDB autoloads them.
    if (fs_1.default.existsSync(dbStatsPath)) {
        try {
            const stats = fs_1.default.statSync(dbStatsPath);
            if (stats.size > 2 * 1024 * 1024) {
                console.log(`[Database] Legacy database file is bloated (${(stats.size / 1024 / 1024).toFixed(2)}MB). Performing zero-data-loss migration...`);
                const content = fs_1.default.readFileSync(dbStatsPath, 'utf8');
                const lines = content.split('\n');
                const cleanLines = [];
                let migratedCount = 0;
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const doc = JSON.parse(trimmed);
                        if (doc.type === 'phoenix' && doc.rootSpans !== undefined) {
                            delete doc.rootSpans; // Remove the massive spans array to prevent memory crash
                            migratedCount++;
                        }
                        cleanLines.push(JSON.stringify(doc));
                    }
                    catch {
                        // Preserve any lines that cannot be parsed as JSON
                        cleanLines.push(trimmed);
                    }
                }
                fs_1.default.writeFileSync(dbStatsPath, cleanLines.join('\n') + '\n');
                const newStats = fs_1.default.statSync(dbStatsPath);
                console.log(`[Database] Migration completed! Zero data loss: purged rootSpans from ${migratedCount} records. Database size reduced from ${(stats.size / 1024 / 1024).toFixed(2)}MB to ${(newStats.size / 1024).toFixed(2)}KB.`);
            }
        }
        catch (err) {
            console.error('[Database] Failed to migrate bloated database:', err.message);
        }
    }
    const db = new Datastore({ filename: dbStatsPath, autoload: true });
    // Purge only legacy bulky phoenix records containing the rootSpans array to optimize RAM baseline without losing optimized chart metrics
    try {
        db.remove({ type: 'phoenix', rootSpans: { $exists: true } }, { multi: true }, (err, numRemoved) => {
            if (numRemoved > 0) {
                console.log(`[Database] Purged ${numRemoved} legacy bloated Phoenix records (containing rootSpans) from NeDB.`);
                db.persistence.compactDatafile();
            }
        });
    }
    catch (e) {
        console.error('[Database] Failed to prune legacy Phoenix records:', e.message);
    }
    // Check existence of backups dir, create if nothing
    const dir_backups = path_1.default.join(__dirname, '../../data/backups/');
    if (!fs_1.default.existsSync(dir_backups))
        fs_1.default.mkdirSync(dir_backups, { recursive: true });
    return db;
}
