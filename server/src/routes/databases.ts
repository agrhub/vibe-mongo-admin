import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
// import path from 'path';
// import fs from 'fs';
import * as common from './common.js';
import { geminiService } from '../services/GeminiService';
import { BSON } from "mongodb";
const ejson = BSON.EJSON;

const router = Router();

// ================= CONNECTION STATUS & DATABASES =================

// Database status & backup list
router.get('/api/:conn/stats', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    var conn_string = connection_list[req.params.conn].connString;
    var uri = common.parseMongoUri(conn_string);

    if (uri.database) {
        return res.status(200).json({ redirectDb: uri.database });
    }

    // Pass MongoClient for cross-db operations (status + stats)
    var mongo_client = connection_list[req.params.conn].client;
    var mongo_native = connection_list[req.params.conn].native;

    common.get_db_status(mongo_native, function (err: Error, db_status: any) {
        common.get_backups(function (err2: Error, backup_list: any) {
            common.get_db_stats(mongo_client, null, function (err3: Error, db_stats: any) {
                common.get_db_list(uri, mongo_client, function (err4: Error, db_list: any) {
                    var adminDb = mongo_client.db('admin').admin();
                    adminDb.listDatabases()
                        .then((result: any) => {
                            const sizeMap: Record<string, number> = {};
                            if (result && result.databases) {
                                result.databases.forEach((d: any) => {
                                    sizeMap[d.name] = d.sizeOnDisk || 0;
                                });
                            }

                            const enrichedList = (db_list || []).map((name: string) => {
                                let size = sizeMap[name] || 0;
                                if (size === 0 && db_stats && db_stats[name]) {
                                    Object.keys(db_stats[name]).forEach(collName => {
                                        if (db_stats[name][collName] && db_stats[name][collName].Storage) {
                                            size += db_stats[name][collName].Storage;
                                        }
                                    });
                                }
                                return {
                                    name: name,
                                    sizeOnDisk: size
                                };
                            });

                            res.status(200).json({
                                db_stats: db_stats,
                                db_status: db_status,
                                db_list: enrichedList,
                                backup_list: backup_list
                            });
                        })
                        .catch(() => {
                            const enrichedList = (db_list || []).map((name: string) => {
                                let size = 0;
                                if (db_stats && db_stats[name]) {
                                    Object.keys(db_stats[name]).forEach(collName => {
                                        if (db_stats[name][collName] && db_stats[name][collName].Storage) {
                                            size += db_stats[name][collName].Storage;
                                        }
                                    });
                                }
                                return {
                                    name: name,
                                    sizeOnDisk: size
                                };
                            });

                            res.status(200).json({
                                db_stats: db_stats,
                                db_status: db_status,
                                db_list: enrichedList,
                                backup_list: backup_list
                            });
                        });
                });
            });
        });
    });
});

// List of databases
router.get('/api/:conn/databases', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    var conn_string = connection_list[req.params.conn].connString;
    var uri = common.parseMongoUri(conn_string);
    var mongo_client = connection_list[req.params.conn].client;

    common.get_db_list(uri, mongo_client, function (err: Error, db_list: any) {
        if (err) {
            res.status(400).json({ 'msg': 'Error listing databases', 'err': err });
        } else {
            res.status(200).json({ db_list: db_list });
        }
    });
});

// Database level stats, collections and users
router.get('/api/:conn/:db/stats', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    common.get_db_stats(mongo_db, req.params.db, function (err: Error, db_stats: any) {
        common.get_backups(function (err2: Error, backup_list: any) {
            mongo_db.command({ usersInfo: 1 })
                .then(function (conn_users: any) {
                    mongo_db.listCollections().toArray()
                        .then(function (collection_list: any) {
                            res.status(200).json({
                                db_stats: db_stats ? db_stats[req.params.db] : {},
                                conn_users: conn_users,
                                coll_list: common.cleanCollections(collection_list),
                                backup_list: backup_list || []
                            });
                        })
                        .catch(function (err3: any) {
                            res.status(200).json({
                                db_stats: db_stats ? db_stats[req.params.db] : {},
                                conn_users: conn_users,
                                coll_list: [],
                                backup_list: backup_list || []
                            });
                        });
                })
                .catch(function (err2: any) {
                    // If usersInfo command is unauthorized (common on Atlas) or fails, swallow the error and pass null
                    mongo_db.listCollections().toArray()
                        .then(function (collection_list: any) {
                            res.status(200).json({
                                db_stats: db_stats ? db_stats[req.params.db] : {},
                                conn_users: null,
                                coll_list: common.cleanCollections(collection_list),
                                backup_list: backup_list || []
                            });
                        })
                        .catch(function (err3: any) {
                            res.status(200).json({
                                db_stats: db_stats ? db_stats[req.params.db] : {},
                                conn_users: null,
                                coll_list: [],
                                backup_list: backup_list || []
                            });
                        });
                });
        });
    });
});

// Create new database
router.post('/api/:conn/db/create', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var db_name = req.body.db_name;
    if (!db_name || db_name.indexOf(' ') >= 0 || db_name.indexOf('.') >= 0) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(db_name);

    // Creating database by saving dummy collection doc
    mongo_db.collection('test').insertOne({})
        .then(function (docs: any) {
            res.status(200).json({ 'msg': 'Database successfully created' });
        })
        .catch(function (err: Error) {
            console.error('Error creating database: ' + err);
            res.status(400).json({ 'msg': 'Error creating database' + ': ' + err });
        });
});

// Delete database
router.post('/api/:conn/db/delete', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var db_name = req.body.db_name;
    if (!db_name) {
        return res.status(400).json({ 'msg': 'Missing database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(db_name);

    mongo_db.dropDatabase()
        .then(function (result: any) {
            res.status(200).json({ 'msg': 'Database successfully deleted', 'db_name': db_name });
        })
        .catch(function (err: Error) {
            console.error('Error deleting database: ' + err);
            res.status(400).json({ 'msg': 'Error deleting database' + ': ' + err });
        });
});

// Rename database (by copying all collections to a new database and dropping the old one)
router.post('/api/:conn/db/rename', async function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var old_db_name = req.body.old_db_name;
    var new_db_name = req.body.new_db_name;

    if (!old_db_name || !new_db_name) {
        return res.status(400).json({ 'msg': 'Missing old or new database name' });
    }

    if (new_db_name.indexOf(' ') >= 0 || new_db_name.indexOf('.') >= 0) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    try {
        var client = connection_list[req.params.conn].client;
        var old_db = client.db(old_db_name);
        var new_db = client.db(new_db_name);

        // Get list of collections in the old database
        var collections = await old_db.listCollections().toArray();

        if (collections.length === 0) {
            // If empty db, we can just drop it and create the new one
            await new_db.collection('test').insertOne({});
            await old_db.dropDatabase();
            return res.status(200).json({ 'msg': 'Database successfully renamed' });
        }

        for (var col of collections) {
            if (col.type === 'view') continue; // Skip views

            // Use $out aggregation to copy collection to the new database
            await old_db.collection(col.name).aggregate([
                { $out: { db: new_db_name, coll: col.name } }
            ]).toArray();
        }

        // Drop the old database
        await old_db.dropDatabase();

        res.status(200).json({ 'msg': 'Database successfully renamed' });
    } catch (err: any) {
        console.error('Error renaming database: ' + err);
        res.status(400).json({ 'msg': 'Error renaming database' + ': ' + err.message });
    }
});

// =============== AI-POWERED ANALYSIS ===============

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

router.post('/api/:conn/:db/ai-analysis', async function (req: Request, res: Response) {
  const connection_list = req.app.locals.dbConnections;
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection' });
  }

  const mongo_db = connection_list[req.params.conn].client.db(req.params.db);
  const dbName = req.params.db;
  const customPrompt = req.body.customPrompt || '';

  try {
    const collections = await mongo_db.listCollections().toArray();
    const cleanColls = common.cleanCollections(collections);
    
    if (cleanColls.length === 0) {
      return res.json({ insights: 'Database is empty.', charts: [] });
    }

    // Prepare overview of all collections
    const overview: any[] = [];
    for (const coll of cleanColls.slice(0, 8)) { // Limit to 8 collections for prompt size
      const count = await mongo_db.collection(coll).countDocuments();
      const sample = await mongo_db.collection(coll).find().limit(2).toArray();
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

    let chartSpecs: any[] = [];
    try {
      chartSpecs = await geminiService.generateJSON<any[]>(userPrompt, AI_DATABASE_ANALYSIS_PROMPT);
    } catch (parseErr) {
      return res.json({ insights: 'Failed to generate AI analysis.', charts: [] });
    }

    const charts: any[] = [];
    const seriesColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6'];

    for (const spec of chartSpecs) {
      try {
        const collName = spec.collection;
        if (!cleanColls.includes(collName)) continue;

        // Enforce a limit to avoid runaway aggregations
        const pipeline = spec.pipeline || [];
        const hasLimit = pipeline.some((s: any) => s['$limit'] !== undefined);
        const safePipeline = hasLimit ? pipeline : [...pipeline, { $limit: 20 }];

        const results = await mongo_db.collection(collName).aggregate(safePipeline).toArray();
        if (!results || results.length === 0) continue;

        const keys = Object.keys(results[0]).filter(k => k !== '_id');
        if (keys.length === 0) continue;

        // Prefer AI-specified fields first, then smart heuristics
        const aiLabel = spec.labelField && keys.includes(spec.labelField) ? spec.labelField : null;
        const aiValue = spec.valueField && keys.includes(spec.valueField) ? spec.valueField : null;

        // Heuristic fallback: prefer any available string/boolean field over _id
        const stringKeys = keys.filter(k => typeof results[0][k] === 'string' || typeof results[0][k] === 'boolean');
        const numericKeys = keys.filter(k => typeof results[0][k] === 'number');

        const labelKey: string = aiLabel
          || stringKeys[0]
          || keys[0];

        const valueKey: string = aiValue
          || numericKeys.find(k => k !== labelKey)
          || numericKeys[0]
          || keys.find(k => k !== labelKey)
          || keys[1]
          || keys[0];

        // Safety: don't let both axes show the same field
        if (labelKey === valueKey) {
          continue;
        }

        let option: any = {
          title: { text: spec.title, left: 'center', textStyle: { color: '#ccc', fontSize: 13 } },
          tooltip: { trigger: spec.chartType === 'pie' ? 'item' : 'axis' },
          backgroundColor: 'transparent',
          grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true }
        };

        if (spec.chartType === 'pie') {
          option.series = [{
            type: 'pie',
            radius: ['40%', '70%'],
            data: results.slice(0, 10).map((r: any, i: number) => ({
              name: String(r[labelKey] ?? 'unknown'),
              value: r[valueKey],
              itemStyle: { color: seriesColors[i % seriesColors.length] }
            })),
            label: { color: '#bbb' }
          }];
        } else {
          option.xAxis = {
            type: 'category',
            data: results.slice(0, 15).map((r: any) => String(r[labelKey] ?? '').slice(0, 20)),
            axisLabel: { color: '#999', rotate: results.length > 7 ? 25 : 0 },
            axisLine: { lineStyle: { color: '#444' } }
          };
          option.yAxis = { type: 'value', axisLabel: { color: '#999' }, splitLine: { lineStyle: { color: '#333' } } };
          option.series = [{
            type: spec.chartType || 'bar',
            data: results.slice(0, 15).map((r: any) => r[valueKey]),
            itemStyle: { color: seriesColors[0], borderRadius: [4, 4, 0, 0] }
          }];
        }

        // Determine all collections involved (single or multi-collection join)
        const involvedCollections: string[] = Array.isArray(spec.collections) && spec.collections.length > 0
          ? spec.collections
          : [collName];

        charts.push({
          title: spec.title,
          description: spec.description,
          chartType: spec.chartType,
          option,
          pipeline: safePipeline,
          collection: collName,
          collections: involvedCollections
        });
      } catch (e) {
        // Skip failures
      }
    }

    res.json({
      insights: `Database analysis complete for **${dbName}**. Generated ${charts.length} cross-collection visualizations.`,
      charts
    });
  } catch (err: any) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;
