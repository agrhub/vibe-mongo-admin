"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseService = exports.DatabaseService = void 0;
const common = __importStar(require("../routes/common.js"));
const GeminiService_1 = require("./GeminiService");
class DatabaseService {
    /**
     * Retrieves status and stats for a given database connection
     */
    async getDatabaseStats(mongoClient, mongoNative, uri, dbName) {
        return new Promise((resolve, reject) => {
            common.get_db_status(mongoNative, function (err1, db_status) {
                if (err1)
                    return reject(err1);
                common.get_backups(function (err2, backup_list) {
                    common.get_db_stats(mongoClient, dbName || null, function (err3, db_stats) {
                        common.get_db_list(uri, mongoClient, function (err4, db_list) {
                            const adminDb = mongoClient.db('admin').admin();
                            adminDb.listDatabases()
                                .then((result) => {
                                const sizeMap = {};
                                if (result && result.databases) {
                                    result.databases.forEach((d) => {
                                        sizeMap[d.name] = d.sizeOnDisk || 0;
                                    });
                                }
                                const enrichedList = (db_list || []).map((name) => {
                                    let size = sizeMap[name] || 0;
                                    if (size === 0 && db_stats && db_stats[name]) {
                                        Object.keys(db_stats[name]).forEach(collName => {
                                            if (db_stats[name][collName] && db_stats[name][collName].Storage) {
                                                size += db_stats[name][collName].Storage;
                                            }
                                        });
                                    }
                                    return { name: name, sizeOnDisk: size };
                                });
                                resolve({
                                    db_stats: db_stats,
                                    db_status: db_status,
                                    db_list: enrichedList,
                                    backup_list: backup_list || []
                                });
                            })
                                .catch(() => {
                                const enrichedList = (db_list || []).map((name) => {
                                    let size = 0;
                                    if (db_stats && db_stats[name]) {
                                        Object.keys(db_stats[name]).forEach(collName => {
                                            if (db_stats[name][collName] && db_stats[name][collName].Storage) {
                                                size += db_stats[name][collName].Storage;
                                            }
                                        });
                                    }
                                    return { name: name, sizeOnDisk: size };
                                });
                                resolve({
                                    db_stats: db_stats,
                                    db_status: db_status,
                                    db_list: enrichedList,
                                    backup_list: backup_list || []
                                });
                            });
                        });
                    });
                });
            });
        });
    }
    /**
     * Retrieves collections, users, and detailed stats for a specific database
     */
    async getDatabaseDetails(mongoDb, dbName) {
        return new Promise((resolve, reject) => {
            common.get_db_stats(mongoDb, dbName, function (err, db_stats) {
                common.get_backups(function (err2, backup_list) {
                    mongoDb.command({ usersInfo: 1 })
                        .then(function (conn_users) {
                        mongoDb.listCollections().toArray()
                            .then(function (collection_list) {
                            resolve({
                                db_stats: db_stats ? db_stats[dbName] : {},
                                conn_users: conn_users,
                                coll_list: common.cleanCollections(collection_list),
                                backup_list: backup_list || []
                            });
                        })
                            .catch(function () {
                            resolve({
                                db_stats: db_stats ? db_stats[dbName] : {},
                                conn_users: conn_users,
                                coll_list: [],
                                backup_list: backup_list || []
                            });
                        });
                    })
                        .catch(function () {
                        // Unauthorized / atlas
                        mongoDb.listCollections().toArray()
                            .then(function (collection_list) {
                            resolve({
                                db_stats: db_stats ? db_stats[dbName] : {},
                                conn_users: null,
                                coll_list: common.cleanCollections(collection_list),
                                backup_list: backup_list || []
                            });
                        })
                            .catch(function () {
                            resolve({
                                db_stats: db_stats ? db_stats[dbName] : {},
                                conn_users: null,
                                coll_list: [],
                                backup_list: backup_list || []
                            });
                        });
                    });
                });
            });
        });
    }
    async getDatabasesList(mongoClient, uri) {
        return new Promise((resolve, reject) => {
            common.get_db_list(uri, mongoClient, function (err, db_list) {
                if (err)
                    return reject(err);
                resolve(db_list);
            });
        });
    }
    async createDatabase(mongoClient, dbName) {
        const db = mongoClient.db(dbName);
        await db.collection('test').insertOne({});
        return { msg: 'Database successfully created' };
    }
    async deleteDatabase(mongoClient, dbName) {
        const db = mongoClient.db(dbName);
        await db.dropDatabase();
        return { msg: 'Database successfully deleted', db_name: dbName };
    }
    async renameDatabase(mongoClient, oldDbName, newDbName) {
        const oldDb = mongoClient.db(oldDbName);
        const newDb = mongoClient.db(newDbName);
        const collections = await oldDb.listCollections().toArray();
        if (collections.length === 0) {
            await newDb.collection('test').insertOne({});
            await oldDb.dropDatabase();
            return { msg: 'Database successfully renamed' };
        }
        for (const col of collections) {
            if (col.type === 'view')
                continue;
            await oldDb.collection(col.name).aggregate([
                { $out: { db: newDbName, coll: col.name } }
            ]).toArray();
        }
        await oldDb.dropDatabase();
        return { msg: 'Database successfully renamed' };
    }
    async performAiAnalysis(mongoDb, dbName, customPrompt) {
        const collections = await mongoDb.listCollections().toArray();
        const cleanColls = common.cleanCollections(collections);
        if (cleanColls.length === 0) {
            return { insights: 'Database is empty.', charts: [] };
        }
        const overview = [];
        for (const coll of cleanColls.slice(0, 8)) {
            const count = await mongoDb.collection(coll).countDocuments();
            const sample = await mongoDb.collection(coll).find().limit(2).toArray();
            overview.push({
                name: coll,
                docCount: count,
                sampleDoc: sample[0] || {}
            });
        }
        const userPrompt = `Database: "${dbName}"
Collections Overview:
${JSON.stringify(overview, null, 2)}

${customPrompt ? `USER'S SPECIFIC ANALYSIS REQUEST: ${customPrompt}\n` : ''}
Generate 8 database-wide analytical charts. ${overview.length > 1 ? 'At least 4 MUST use $lookup to join 2+ collections.' : 'Since there is only one collection, focus on various single-collection insights.'}`;
        const AI_DATABASE_ANALYSIS_PROMPT = `You are an expert MongoDB data architect and analyst.
Given a list of collections in a database and their schemas/sample documents, generate exactly 8 database-level analytical charts.

At least 4 of the charts SHOULD aggregate data from 2 or more collections using MongoDB $lookup (join) IF the database has multiple collections.
If there is only one collection, focus on various distributions, filters, and trends within that single collection.

For each chart, provide a MongoDB aggregation pipeline running on the base collection.

STRICT RULES:
- EVERY pipeline MUST end with a $project stage that outputs EXACTLY at least two fields: one for the label and one for the value.
- Rename grouping identifiers from "_id" to a meaningful field name based on your schema analysis (e.g., "Category", "User", "Origin").
- MUST specify "labelField" as the string field from your final projection that best represents the data points.
- ALWAYS ignore "_id" as a label field in visualizations.
- Each pipeline MUST be a valid JSON array
- Return ONLY a valid JSON array. No markdown. No explanation.
- Use EXACTLY this structure:
[
  {
    "title": "Short descriptive title",
    "description": "One sentence describing what this chart reveals",
    "collection": "base_collection_to_run_on",
    "collections": ["base_collection", "other_joined_collection"],
    "pipeline": [..., { "$project": { "_id": 0, "<labelField>": "...", "<valueField>": "..." } }, { "$limit": 20 }],
    "chartType": "bar|pie|line",
    "labelField": "<labelField>",
    "valueField": "<valueField>"
  }
]`;
        let chartSpecs = [];
        try {
            chartSpecs = await GeminiService_1.geminiService.generateJSON(userPrompt, AI_DATABASE_ANALYSIS_PROMPT);
        }
        catch (parseErr) {
            return { insights: 'Failed to generate AI analysis.', charts: [] };
        }
        const charts = [];
        for (const spec of chartSpecs) {
            try {
                const collName = spec.collection;
                if (!cleanColls.includes(collName))
                    continue;
                const pipeline = spec.pipeline || [];
                const hasLimit = pipeline.some((s) => s['$limit'] !== undefined);
                const safePipeline = hasLimit ? pipeline : [...pipeline, { $limit: 20 }];
                const results = await mongoDb.collection(collName).aggregate(safePipeline).toArray();
                if (!results || results.length === 0)
                    continue;
                const keys = Object.keys(results[0]).filter(k => k !== '_id');
                if (keys.length === 0)
                    continue;
                const aiLabel = spec.labelField && keys.includes(spec.labelField) ? spec.labelField : null;
                const aiValue = spec.valueField && keys.includes(spec.valueField) ? spec.valueField : null;
                const involvedCollections = Array.isArray(spec.collections) && spec.collections.length > 0
                    ? spec.collections
                    : [collName];
                charts.push({
                    title: spec.title,
                    description: spec.description,
                    chartType: spec.chartType,
                    labelField: aiLabel || spec.labelField,
                    valueField: aiValue || spec.valueField,
                    pipeline: safePipeline,
                    collection: collName,
                    collections: involvedCollections,
                    resultCount: results.length,
                    results: results
                });
            }
            catch (e) {
                // Skip failures
            }
        }
        return {
            insights: `Database analysis complete for **${dbName}**. Generated ${charts.length} cross-collection visualizations.`,
            charts
        };
    }
}
exports.DatabaseService = DatabaseService;
exports.databaseService = new DatabaseService();
