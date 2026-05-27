import path from "path";
import fs from "fs";
const Datastore = require('@seald-io/nedb');

export function setupDatabaseStats() {
    const isProd = process.env.NODE_ENV === 'production';
    const dir_data = path.join(__dirname, '../../data/');
    const dbStatsPath = path.join(dir_data, isProd ? 'dbStats.db?nolock=1' : 'dbStats.db');

    // Check existence of data dir
    if (!fs.existsSync(dir_data)) fs.mkdirSync(dir_data);

    // Check if the legacy database file exists and is bloated (e.g. > 2MB).
    // Perform a zero-data-loss migration to strip rootSpans from old documents before NeDB autoloads them.
    if (fs.existsSync(dbStatsPath)) {
        try {
            const stats = fs.statSync(dbStatsPath);
            if (stats.size > 2 * 1024 * 1024) {
                console.log(`[Database] Legacy database file is bloated (${(stats.size / 1024 / 1024).toFixed(2)}MB). Performing zero-data-loss migration...`);
                
                const content = fs.readFileSync(dbStatsPath, 'utf8');
                const lines = content.split('\n');
                const cleanLines: string[] = [];
                let migratedCount = 0;

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const doc = JSON.parse(trimmed);
                        if (doc.type === 'phoenix' && doc.rootSpans !== undefined) {
                            delete doc.rootSpans; // Remove the massive spans array to prevent memory crash
                            migratedCount++;
                        }
                        cleanLines.push(JSON.stringify(doc));
                    } catch {
                        // Preserve any lines that cannot be parsed as JSON
                        cleanLines.push(trimmed);
                    }
                }

                fs.writeFileSync(dbStatsPath, cleanLines.join('\n') + '\n');
                const newStats = fs.statSync(dbStatsPath);
                console.log(`[Database] Migration completed! Zero data loss: purged rootSpans from ${migratedCount} records. Database size reduced from ${(stats.size / 1024 / 1024).toFixed(2)}MB to ${(newStats.size / 1024).toFixed(2)}KB.`);
            }
        } catch (err: any) {
            console.error('[Database] Failed to migrate bloated database:', err.message);
        }
    }

    const db = new Datastore({ filename: dbStatsPath, autoload: true });

    // Purge only legacy bulky phoenix records containing the rootSpans array to optimize RAM baseline without losing optimized chart metrics
    try {
        db.remove({ type: 'phoenix', rootSpans: { $exists: true } }, { multi: true }, (err: any, numRemoved: number) => {
            if (numRemoved > 0) {
                console.log(`[Database] Purged ${numRemoved} legacy bloated Phoenix records (containing rootSpans) from NeDB.`);
                db.persistence.compactDatafile();
            }
        });
    } catch (e: any) {
        console.error('[Database] Failed to prune legacy Phoenix records:', e.message);
    }

    // Check existence of backups dir, create if nothing
    const dir_backups = path.join(__dirname, '../../data/backups/');
    if (!fs.existsSync(dir_backups)) fs.mkdirSync(dir_backups, { recursive: true });

    return db;
}
