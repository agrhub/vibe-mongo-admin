"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexSanitizerService = exports.IndexSanitizerService = void 0;
const GeminiService_1 = require("./GeminiService");
class IndexSanitizerService {
    async sanitizeIndexes(mongoDb, collName, activeIndexes) {
        if (!activeIndexes || activeIndexes.length === 0) {
            return {
                healthScore: 100,
                statusDescription: 'No indexes found in this collection.',
                recommendations: [],
                indexStatuses: {}
            };
        }
        // 1. Local structural redundancy checking (Prefix Overlap Detection)
        // Map of index name -> suspected overlap index
        const localRedundancies = {};
        activeIndexes.forEach((idxA) => {
            if (idxA.name === '_id_')
                return;
            const keysA = Object.keys(idxA.key);
            activeIndexes.forEach((idxB) => {
                if (idxA.name === idxB.name || idxB.name === '_id_')
                    return;
                const keysB = Object.keys(idxB.key);
                // Check if B's keys form a prefix of A's keys
                if (keysB.length < keysA.length) {
                    const isPrefix = keysB.every((k, i) => keysA[i] === k && idxA.key[k] === idxB.key[k]);
                    if (isPrefix) {
                        localRedundancies[idxB.name] = idxA.name;
                    }
                }
            });
        });
        // 2. Query statistics if available (e.g. index usage statistics)
        let stats = [];
        try {
            stats = await mongoDb.collection(collName).aggregate([{ $indexStats: {} }]).toArray();
        }
        catch (e) {
            // Aggregate index stats might fail on some secondary/standalone environments or views
        }
        const usageMap = {};
        if (stats && stats.length > 0) {
            stats.forEach((s) => {
                if (s.name) {
                    usageMap[s.name] = s.accesses?.ops || 0;
                }
            });
        }
        // 3. specialized prompt for Gemini
        const systemInstruction = `You are a MongoDB database administrator and SRE expert specializing in index optimization and system scaling. Your job is to analyze the collection's active indexes and their usage statistics, identify redundancies or sub-optimal designs, and output a structured optimization report.

RULES:
- Return ONLY a valid JSON object matching the requested structure.
- DO NOT include markdown formatting, backticks (\`\`\`json), or extra explanation text. The response must be a single parseable JSON object.
- "healthScore": A number from 0 to 100 representing the efficiency of the current indexing configuration (100 means no redundant or sub-optimal indexes).
- "statusDescription": A concise 1-2 sentence summary of the current index health.
- "recommendations": An array of objects, each containing:
  - "indexName": The name of the index being evaluated.
  - "level": "info", "warning", or "danger" based on severity.
  - "reason": A clear explanation of why this index is suboptimal, redundant, or unused.
  - "safeToDrop": A boolean indicating if it is completely safe to drop this index.
- "indexStatuses": A record/map of index names to one of these states: "HEALTHY", "REDUNDANT", "UNUSED", "UNOPTIMIZED".
- Treat the primary '_id_' index as always "HEALTHY".
`;
        const userPrompt = `Collection name: "${collName}"
Active Indexes:
${JSON.stringify(activeIndexes, null, 2)}

Local Prefix Redundancy Analysis (Detected Overlaps):
${Object.keys(localRedundancies).length > 0
            ? Object.entries(localRedundancies).map(([idx, parent]) => `- Index "${idx}" is a strict prefix of compound index "${parent}" and is highly likely redundant.`).join('\n')
            : 'None detected locally.'}

Telemetry Index Usage Statistics (Ops count since database startup):
${Object.keys(usageMap).length > 0
            ? Object.entries(usageMap).map(([idx, ops]) => `- Index "${idx}": ${ops} read operations.`).join('\n')
            : 'Usage statistics telemetry not available.'}

Analyze the above data and return a structured optimization report in the specified JSON format.`;
        try {
            const result = await GeminiService_1.geminiService.generateJSON(userPrompt, systemInstruction);
            // Ensure result safety and validation defaults
            if (!result.healthScore && result.healthScore !== 0)
                result.healthScore = 80;
            if (!result.statusDescription)
                result.statusDescription = 'AI completed the evaluation of active indexes.';
            if (!result.recommendations)
                result.recommendations = [];
            if (!result.indexStatuses)
                result.indexStatuses = {};
            // Fill in _id_ as HEALTHY if not evaluated
            if (!result.indexStatuses['_id_']) {
                result.indexStatuses['_id_'] = 'HEALTHY';
            }
            return result;
        }
        catch (err) {
            console.error('[IndexSanitizerService] Gemini sanitization failed:', err);
            // Construct graceful fallback in case of AI parsing errors or timeouts
            const recommendations = [];
            const indexStatuses = { '_id_': 'HEALTHY' };
            let healthScore = 100;
            Object.entries(localRedundancies).forEach(([idx, parent]) => {
                healthScore -= 15;
                indexStatuses[idx] = 'REDUNDANT';
                recommendations.push({
                    indexName: idx,
                    level: 'warning',
                    reason: `This index is a strict prefix of compound index "${parent}" and can be safely covered by it.`,
                    safeToDrop: true
                });
            });
            activeIndexes.forEach((idx) => {
                if (idx.name !== '_id_' && !indexStatuses[idx.name]) {
                    const ops = usageMap[idx.name] ?? -1;
                    if (ops === 0) {
                        healthScore -= 10;
                        indexStatuses[idx.name] = 'UNUSED';
                        recommendations.push({
                            indexName: idx.name,
                            level: 'info',
                            reason: `This index has not recorded any read operations since database startup.`,
                            safeToDrop: true
                        });
                    }
                    else {
                        indexStatuses[idx.name] = 'HEALTHY';
                    }
                }
            });
            return {
                healthScore: Math.max(healthScore, 20),
                statusDescription: 'Completed local analysis. AI evaluation is temporarily unavailable.',
                recommendations,
                indexStatuses
            };
        }
    }
}
exports.IndexSanitizerService = IndexSanitizerService;
exports.indexSanitizerService = new IndexSanitizerService();
