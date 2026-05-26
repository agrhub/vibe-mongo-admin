import { MongoClient, Db } from 'mongodb';
import { geminiService } from './GeminiService';

export class CollectionService {
  async createCollection(mongoDb: Db, collectionName: string) {
    await mongoDb.createCollection(collectionName);
    return { msg: 'Collection successfully created' };
  }

  async renameCollection(mongoDb: Db, oldName: string, newName: string) {
    await mongoDb.collection(oldName).rename(newName, { dropTarget: false });
    return { msg: 'Collection successfully renamed' };
  }

  async deleteCollection(mongoDb: Db, collectionName: string) {
    await mongoDb.dropCollection(collectionName);
    return { msg: 'Collection successfully deleted', coll_name: collectionName };
  }

  async exportCollection(mongoDb: Db, collectionName: string, excludedID: boolean) {
    const exportID = excludedID ? { _id: 0 } : {};
    const data = await mongoDb.collection(collectionName).find({}, { projection: exportID }).toArray();
    if (data !== null && data !== undefined) {
      return data;
    }
    throw new Error('Collection not found or empty');
  }

  async getSchema(mongoDb: Db, collectionName: string) {
    const sample = await mongoDb.collection(collectionName).aggregate([{ $sample: { size: 100 } }]).toArray();
    const fieldMap: any = {};
    sample.forEach((doc: any) => {
      Object.entries(doc).forEach(([key, value]) => {
        if (key === '_id') return;
        if (!fieldMap[key]) {
          fieldMap[key] = { type: typeof value, example: value };
        }
      });
    });
    return Object.entries(fieldMap).map(([field, info]: [any, any]) => ({ field, type: info.type, example: info.example }));
  }

  async getAnalysis(mongoDb: Db, collectionName: string) {
    const sample = await mongoDb.collection(collectionName).aggregate([{ $sample: { size: 100 } }]).toArray();
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

    return Object.entries(analysis).map(([field, data]: [any, any]) => {
      const topValues = Object.entries(data.values)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 5)
        .map(([val, cnt]: [any, any]) => ({ value: val, count: cnt }));
      return { field, count: data.count, topValues };
    });
  }

  async performAiAnalysis(mongoDb: Db, dbName: string, collName: string, customPrompt: string) {
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
    "pipeline": [/* aggregation stages */],
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

    const sample = await mongoDb.collection(collName).aggregate([{ $sample: { size: 50 } }]).toArray();
    const totalDocs = await mongoDb.collection(collName).countDocuments();

    if (sample.length === 0) {
      return { insights: 'Collection is empty. No analysis available.', charts: [] };
    }

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

    const userPrompt = `Collection: "${collName}" in database "${dbName}"
Total documents: ${totalDocs}
Schema (${Object.keys(fieldMap).length} fields):
${schemaStr}

Sample document (first):
${JSON.stringify(sample[0], null, 2).slice(0, 2000)}

${customPrompt ? `USER'S SPECIFIC ANALYSIS REQUEST: ${customPrompt}\n` : ''}
Generate 4 meaningful analytical charts for this collection.`;

    let chartSpecs: any[] = [];
    try {
      chartSpecs = await geminiService.generateJSON<any[]>(userPrompt, AI_ANALYSIS_PROMPT);
      if (!Array.isArray(chartSpecs)) {
        throw new Error('AI response is not an array of chart specifications');
      }
    } catch (parseErr: any) {
      throw new Error('Failed to generate AI analysis valid chart specifications: ' + parseErr.message);
    }

    const charts: any[] = [];
    for (let i = 0; i < chartSpecs.length && i < 6; i++) {
      const spec = chartSpecs[i];
      try {
        const pipeline = spec.pipeline || [];
        const results = await mongoDb.collection(collName).aggregate(pipeline).toArray();

        if (!results || results.length === 0) continue;

        charts.push({
          title: spec.title,
          description: spec.description || '',
          chartType: spec.chartType || 'bar',
          labelField: spec.labelField,
          valueField: spec.valueField,
          pipeline: spec.pipeline,
          resultCount: results.length,
          results: results
        });
      } catch (aggErr: any) {
        // Skip failed pipelines silently
      }
    }

    return {
      insights: `AI analyzed **${Object.keys(fieldMap).length} fields** across **${totalDocs.toLocaleString()} documents** and generated ${charts.length} meaningful visualizations.`,
      charts,
      fieldCount: Object.keys(fieldMap).length,
      totalDocs
    };
  }
}

export const collectionService = new CollectionService();
