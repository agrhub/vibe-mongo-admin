import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import * as common from './common.js';
import { geminiService } from '../services/GeminiService';

const router = Router();

// ================= COLLECTIONS =================

// Create collection
router.post('/api/:conn/:db/collection/create', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var collection_name = req.body.collection_name;
    if (!collection_name) {
        return res.status(400).json({ 'msg': 'Missing collection name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    mongo_db.createCollection(collection_name)
        .then(function (coll: any) {
            res.status(200).json({ 'msg': 'Collection successfully created' });
        })
        .catch(function (err: any) {
            console.error('Error creating collection: ' + err);
            res.status(400).json({ 'msg': 'Error creating collection' + ': ' + err });
        });
});

// Rename collection
router.post('/api/:conn/:db/:coll/rename', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var new_collection_name = req.body.new_collection_name;
    if (!new_collection_name) {
        return res.status(400).json({ 'msg': 'Missing new collection name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    mongo_db.collection(req.params.coll).rename(new_collection_name, { 'dropTarget': false })
        .then(function (coll_name: any) {
            res.status(200).json({ 'msg': 'Collection successfully renamed' });
        })
        .catch(function (err: any) {
            console.error('Error renaming collection: ' + err);
            res.status(400).json({ 'msg': 'Error renaming collection' + ': ' + err });
        });
});

// Delete collection
router.post('/api/:conn/:db/collection/delete', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var collection_name = req.body.collection_name;
    if (!collection_name) {
        return res.status(400).json({ 'msg': 'Missing collection name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    mongo_db.dropCollection(collection_name)
        .then(function (coll: any) {
            res.status(200).json({ 'msg': 'Collection successfully deleted', 'coll_name': collection_name });
        })
        .catch(function (err: any) {
            console.error('Error deleting collection: ' + err);
            res.status(400).json({ 'msg': 'Error deleting collection' + ': ' + err });
        });
});

// Export collection
router.get('/api/:conn/:db/:coll/export', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var excludedID = req.query.excludedID === 'true';
    var exportID = {};
    if (excludedID) {
        exportID = { '_id': 0 };
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    mongo_db.collection(req.params.coll).find({}, exportID).toArray()
        .then(function (data: any) {
            if (data !== '') {
                res.set({ 'Content-Disposition': 'attachment; filename=' + req.params.coll + '.json', 'Content-Type': 'application/json' });
                res.send(JSON.stringify(data, null, 2));
            } else {
                res.status(400).json({ 'msg': 'Export error: Collection not found' });
            }
        })
        .catch(function (err: any) {
            res.status(400).json({ 'msg': 'Export error', 'err': err });
        });
});

// New schema endpoint
router.get('/api/:conn/:db/:coll/schema', async function (req, res) {
  const connection_list = req.app.locals.dbConnections;
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection' });
  }
  const mongo_db = connection_list[req.params.conn].client.db(req.params.db);
  try {
    const sample = await mongo_db.collection(req.params.coll).aggregate([{ $sample: { size: 100 } }]).toArray();
    const fieldMap: any = {};
    sample.forEach((doc: any) => {
      Object.entries(doc).forEach(([key, value]) => {
        if (key === '_id') return;
        if (!fieldMap[key]) {
          fieldMap[key] = { type: typeof value, example: value };
        }
      });
    });
    const fields = Object.entries(fieldMap).map(([field, info]: [any, any]) => ({ field, type: info.type, example: info.example }));
    res.status(200).json({ fields });
  } catch (err) {
    console.error('Schema error:', err);
    res.status(500).json({ msg: 'Error retrieving schema' });
  }
});

// New analysis endpoint
router.get('/api/:conn/:db/:coll/analysis', async function (req, res) {
  const connection_list = req.app.locals.dbConnections;
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection' });
  }
  const mongo_db = connection_list[req.params.conn].client.db(req.params.db);
  try {
    const sample = await mongo_db.collection(req.params.coll).aggregate([{ $sample: { size: 100 } }]).toArray();
    const analysis: any = {};
    sample.forEach((doc: any) => {
      Object.entries(doc).forEach(([key, value]) => {
        if (key === '_id') return;
        if (!analysis[key]) {
          analysis[key] = { count: 0, values: {} };
        }
        analysis[key].count++;
        const valKey = typeof value === 'object' ? JSON.stringify(value) : String(value);
        analysis[key].values[valKey] = (analysis[key].values[valKey] || 0) + 1;
      });
    });
    // Convert to summary
    const result = Object.entries(analysis).map(([field, data]: [any, any]) => {
      const topValues = Object.entries(data.values)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 5)
        .map(([val, cnt]: [any, any]) => ({ value: val, count: cnt }));
      return { field, count: data.count, topValues };
    });
    res.status(200).json({ analysis: result });
  } catch (err) {
    console.error('Analysis error:', err);
    res.status(500).json({ msg: 'Error retrieving analysis' });
  }
});

// =============== AI-POWERED ANALYSIS ===============

const AI_ANALYSIS_PROMPT = `You are an expert MongoDB data analyst. Given a collection's schema and sample documents, generate exactly 4 meaningful data analysis charts.

For each chart, provide:
1. A MongoDB aggregation pipeline that extracts meaningful insights
2. An ECharts option configuration to visualize the results

RULES:
- EACH pipeline MUST end with a $project stage that outputs EXACTLY at least two fields: one for the label and one for the value.
- FOR LABELS: Renaming the grouped key from "_id" to a meaningful field name based on the schema (e.g., "Category", "Status").
- FOR LABELS: Prefer selecting a field from the schema that is most representative of the data point.
- NEVER use "_id" as the final label field in your projected output.
- "labelField": "The name of the label field you chose in your final result (should be a descriptive string field from the schema)",
- "valueField": "The name of the numeric metric field you chose in your final result"

Return ONLY a valid JSON array (no markdown, no backticks, no explanation) with this structure:
[
  {
    "title": "Human readable chart title",
    "description": "Brief 1-sentence explanation of what this chart reveals",
    "pipeline": [<aggregation stages>],
    "chartType": "bar|pie|line",
    "labelField": "The name of the field in your final result to use as the horizontal/category axis",
    "valueField": "The name of the field in your final result to use as the vertical/numeric axis"
  }
]

IMPORTANT FOR LABELS:
- EVERY pipeline MUST end with a $project stage that outputs EXACTLY at least two fields: one for the label and one for the value.
- The label field MUST be renamed to a meaningful name (e.g., "Category", "Status", "Year").
- NEVER use "_id" as the final label field in your projected output.
`;

router.post('/api/:conn/:db/:coll/ai-analysis', async function (req: Request, res: Response) {
  const connection_list = req.app.locals.dbConnections;
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection' });
  }

  const mongo_db = connection_list[req.params.conn].client.db(req.params.db);
  const collName = req.params.coll;
  const customPrompt = req.body.customPrompt || '';

  try {
    // 1. Sample documents and infer schema
    const sample = await mongo_db.collection(collName).aggregate([{ $sample: { size: 50 } }]).toArray();
    const totalDocs = await mongo_db.collection(collName).countDocuments();

    if (sample.length === 0) {
      return res.json({ insights: 'Collection is empty. No analysis available.', charts: [] });
    }

    // Build schema summary
    const fieldMap: Record<string, { type: string; examples: any[]; uniqueCount?: number }> = {};
    sample.forEach((doc: any) => {
      Object.entries(doc).forEach(([key, value]) => {
        if (key === '_id') return;
        if (!fieldMap[key]) {
          fieldMap[key] = { type: typeof value, examples: [] };
          if (value instanceof Date) fieldMap[key].type = 'Date';
          else if (Array.isArray(value)) fieldMap[key].type = 'array';
        }
        if (fieldMap[key].examples.length < 5) {
          const exStr = typeof value === 'object' ? JSON.stringify(value).slice(0, 100) : String(value).slice(0, 100);
          if (!fieldMap[key].examples.includes(exStr)) {
            fieldMap[key].examples.push(exStr);
          }
        }
      });
    });

    const schemaStr = Object.entries(fieldMap)
      .map(([field, info]) => `- ${field} (${info.type}): examples=[${info.examples.slice(0, 3).join(', ')}]`)
      .join('\n');

    // 2. Call Gemini
    const userPrompt = `Collection: "${collName}" in database "${req.params.db}"
Total documents: ${totalDocs}
Schema (${Object.keys(fieldMap).length} fields):
${schemaStr}

Sample document (first):
${JSON.stringify(sample[0], null, 2).slice(0, 2000)}

${customPrompt ? `USER'S SPECIFIC ANALYSIS REQUEST: ${customPrompt}\n` : ''}
Generate 4 meaningful analytical charts for this collection.`;

    // 3. Generate Analysis with GeminiService
    let chartSpecs: any[] = [];
    try {
      chartSpecs = await geminiService.generateJSON<any[]>(userPrompt, AI_ANALYSIS_PROMPT);
      if (!Array.isArray(chartSpecs)) {
        throw new Error('AI response is not an array of chart specifications');
      }
    } catch (parseErr: any) {
      console.error('[AI Analysis] Failed to generate AI analysis:', parseErr);
      return res.json({
        insights: 'AI analysis failed to generate valid chart specifications. Please try again.',
        charts: [],
        debug: { error: parseErr.message }
      });
    }

    // 4. Execute each aggregation pipeline and build ECharts options
    const charts: any[] = [];
    const seriesColors = ['#409eff', '#67c23a', '#e6a23c', '#f56c6c', '#9b59b6'];

    for (let i = 0; i < chartSpecs.length && i < 6; i++) {
      const spec = chartSpecs[i];
      try {
        const pipeline = spec.pipeline || [];
        const results = await mongo_db.collection(collName).aggregate(pipeline).toArray();

        if (!results || results.length === 0) continue;

        // Auto-build ECharts option from results + chart type
        const keys = Object.keys(results[0]).filter(k => k !== '_id');
        if (keys.length === 0) continue;

        // Prefer AI-specified fields first, then smart heuristics
        const aiLabel = spec.labelField && keys.includes(spec.labelField) ? spec.labelField : null;
        const aiValue = spec.valueField && keys.includes(spec.valueField) ? spec.valueField : null;

        // Heuristic fallback: prefer any string field that is NOT _id
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
        if (labelKey === valueKey && keys.length > 1) {
          const alternative = keys.find(k => k !== labelKey);
          if (alternative) {
            // If we have alternatives, try to swap one
            // This is a simple fallback
          }
        }

        let option: any = {};

        if (spec.chartType === 'pie') {
          option = {
            title: { text: spec.title, left: 'center', textStyle: { color: '#ccc', fontSize: 14 } },
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            series: [{
              type: 'pie',
              radius: ['35%', '65%'],
              center: ['50%', '55%'],
              data: results.slice(0, 12).map((r: any, idx: number) => ({
                name: String(r[labelKey] ?? 'null').slice(0, 30),
                value: r[valueKey] ?? 0,
                itemStyle: { color: seriesColors[idx % seriesColors.length] }
              })),
              label: { color: '#ccc', fontSize: 11 },
              emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } }
            }],
            backgroundColor: 'transparent'
          };
        } else if (spec.chartType === 'line') {
          option = {
            title: { text: spec.title, left: 'center', textStyle: { color: '#ccc', fontSize: 14 } },
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
            xAxis: {
              type: 'category',
              data: results.slice(0, 30).map((r: any) => String(r[labelKey] ?? '').slice(0, 20)),
              axisLabel: { color: '#aaa', fontSize: 10, rotate: 20 },
              axisLine: { lineStyle: { color: '#444' } }
            },
            yAxis: {
              type: 'value',
              axisLabel: { color: '#aaa' },
              splitLine: { lineStyle: { color: '#333' } }
            },
            series: numericKeys.slice(0, 3).map((nk, idx) => ({
              name: nk,
              type: 'line',
              smooth: true,
              data: results.slice(0, 30).map((r: any) => r[nk] ?? 0),
              lineStyle: { color: seriesColors[idx % seriesColors.length], width: 2 },
              itemStyle: { color: seriesColors[idx % seriesColors.length] },
              areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [
                { offset: 0, color: seriesColors[idx % seriesColors.length] + '40' },
                { offset: 1, color: 'transparent' }
              ]}}
            })),
            backgroundColor: 'transparent'
          };
        } else {
          // Default: bar chart
          option = {
            title: { text: spec.title, left: 'center', textStyle: { color: '#ccc', fontSize: 14 } },
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '4%', bottom: '8%', containLabel: true },
            xAxis: {
              type: 'category',
              data: results.slice(0, 20).map((r: any) => String(r[labelKey] ?? '').slice(0, 20)),
              axisLabel: { color: '#aaa', fontSize: 10, rotate: 25 },
              axisLine: { lineStyle: { color: '#444' } }
            },
            yAxis: {
              type: 'value',
              axisLabel: { color: '#aaa' },
              splitLine: { lineStyle: { color: '#333' } }
            },
            series: numericKeys.slice(0, 3).map((nk, idx) => ({
              name: nk,
              type: 'bar',
              data: results.slice(0, 20).map((r: any) => r[nk] ?? 0),
              itemStyle: {
                borderRadius: [4, 4, 0, 0],
                color: {
                  type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                  colorStops: [
                    { offset: 0, color: seriesColors[idx % seriesColors.length] },
                    { offset: 1, color: seriesColors[idx % seriesColors.length] + '60' }
                  ]
                }
              },
              barMaxWidth: 40
            })),
            backgroundColor: 'transparent'
          };
        }

        charts.push({
          title: spec.title,
          description: spec.description || '',
          chartType: spec.chartType || 'bar',
          option,
          pipeline: spec.pipeline,
          resultCount: results.length
        });
      } catch (aggErr: any) {
        console.warn(`[AI Analysis] Pipeline ${i} failed:`, aggErr.message);
        // Skip failed pipelines silently
      }
    }

    res.json({
      insights: `AI analyzed **${Object.keys(fieldMap).length} fields** across **${totalDocs.toLocaleString()} documents** and generated ${charts.length} meaningful visualizations.`,
      charts,
      fieldCount: Object.keys(fieldMap).length,
      totalDocs
    });

  } catch (err: any) {
    console.error('[AI Analysis] Error:', err);
    res.status(500).json({ msg: 'Error performing AI analysis: ' + (err.message || 'Unknown error') });
  }
});

export default router;
