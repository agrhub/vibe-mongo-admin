"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockDataService = exports.MockDataService = void 0;
const GeminiService_1 = require("./GeminiService");
class MockDataService {
    async generateMockData(mongoDb, collName, count, locale, constraints) {
        // 1. Fetch up to 5 documents to sample the schema
        let sample = [];
        try {
            sample = await mongoDb.collection(collName).aggregate([{ $sample: { size: 5 } }]).toArray();
        }
        catch (e) {
            // Fallback if aggregate sample is not supported on this collection/view
        }
        let sampleStr = '';
        if (sample && sample.length > 0) {
            // Remove _id from sample to not confuse the model
            const cleanedSamples = sample.map(({ _id, ...rest }) => rest);
            sampleStr = JSON.stringify(cleanedSamples, null, 2);
        }
        else {
            sampleStr = 'No existing documents in this collection. It is currently empty.';
        }
        // 2. Specialized system prompt for Gemini
        const systemPrompt = `You are a high-fidelity database mock data generator. Your job is to generate a realistic, coherent JSON array of mock documents that perfectly match the schema of an existing MongoDB collection.

RULES:
- You must return ONLY a valid, raw JSON array of documents.
- DO NOT include markdown formatting, code block ticks (\`\`\`json), or any explanatory text. The entire response must be valid JSON that can be parsed with JSON.parse().
- Make the mock data look extremely realistic and coherent. For example, use realistic full names, valid emails, plausible transaction amounts, and correct date formats.
- If the collection contains samples, analyze the key names, structures, and types (numbers, dates, arrays, nested objects) and preserve them exactly.
- Do not generate dummy values like "test", "dummy", "placeholder", or "lorem ipsum".
- Ensure that the documents do NOT contain an "_id" field, so that MongoDB can automatically generate fresh ObjectIds upon insertion.
- The locale / country format is: "${locale}". Generate text, names, and formats appropriate for this locale.
${constraints ? `- Additional constraints requested by user: "${constraints}"` : ''}
`;
        const userPrompt = `Collection name: "${collName}"
Requested record count: ${count}
Sample document(s) representing the active schema structure:
${sampleStr}

Generate exactly ${count} mock documents as a JSON array of objects.`;
        let generatedDocs = [];
        try {
            generatedDocs = await GeminiService_1.geminiService.generateJSON(userPrompt, systemPrompt);
            if (!Array.isArray(generatedDocs)) {
                throw new Error('AI response did not yield a valid JSON array');
            }
        }
        catch (err) {
            console.error('[MockDataService] Gemini generation failed:', err);
            throw new Error('Failed to generate mock data from AI: ' + err.message);
        }
        // 3. Clean up the documents to make sure they do not have manual _id fields
        const cleanedDocs = generatedDocs.map((doc) => {
            if (doc && typeof doc === 'object') {
                const { _id, ...rest } = doc;
                return rest;
            }
            return doc;
        }).filter(doc => doc !== null && doc !== undefined && Object.keys(doc).length > 0);
        if (cleanedDocs.length === 0) {
            throw new Error('No valid documents generated');
        }
        // 4. Batch insert into the database
        const result = await mongoDb.collection(collName).insertMany(cleanedDocs);
        return { count: result.insertedCount };
    }
}
exports.MockDataService = MockDataService;
exports.mockDataService = new MockDataService();
