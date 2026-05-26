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
    const db = new Datastore({ filename: dbStatsPath, autoload: true });
    // Check existence of backups dir, create if nothing
    const dir_backups = path_1.default.join(__dirname, '../../backups/');
    if (!fs_1.default.existsSync(dir_backups))
        fs_1.default.mkdirSync(dir_backups);
    return db;
}
