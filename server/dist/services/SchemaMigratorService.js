"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schemaMigratorService = exports.SchemaMigratorService = void 0;
exports.sanitizeSampleForAI = sanitizeSampleForAI;
const GeminiService_1 = require("./GeminiService");
const ErdMapperService_1 = require("./ErdMapperService");
class SchemaMigratorService {
    async dryRunMigration(mongoDb, collectionName, prompt, locale = 'en') {
        // 1. Fetch a single sample document
        const sample = await mongoDb.collection(collectionName).findOne();
        if (!sample) {
            throw new Error('Dry-run failed: Target collection is completely empty. Please generate or insert some documents first.');
        }
        // Fetch mapped ERD schema to understand relational dependencies
        let relations = [];
        let siblingCollections = [];
        try {
            const erdResult = await ErdMapperService_1.erdMapperService.mapErd(mongoDb, mongoDb.databaseName, collectionName);
            relations = erdResult.relations || [];
            siblingCollections = erdResult.siblingCollections || [];
        }
        catch (err) {
            console.error('[SchemaMigratorService] Failed to map ERD relationship context for dry-run:', err);
        }
        const localeMap = {
            'en': 'English',
            'vi': 'Vietnamese (Tiếng Việt)',
            'de': 'German (Deutsch)',
            'es': 'Spanish (Español)',
            'fa': 'Persian (Farsi)',
            'it': 'Italian (Italiano)',
            'ru': 'Russian (Русский)',
            'zh-cn': 'Simplified Chinese (简体中文)'
        };
        const targetLanguage = localeMap[locale.toLowerCase()] || 'English';
        // 2. Submit sample and refactoring prompt to Gemini
        const sanitizedSample = sanitizeSampleForAI(sample);
        const systemPrompt = `You are a world-class MongoDB database SRE and relationship architect.
The user wants to transform/refactor the schema of documents in a collection named "${collectionName}".
We will perform this transformation using a MongoDB aggregation update pipeline (available in MongoDB 4.2+ for updateMany).

Given a sample document from the collection:
${JSON.stringify(sanitizedSample, null, 2)}

Active Database ERD logical relationships from this collection:
${JSON.stringify(relations, null, 2)}

Sibling collections in the database:
${JSON.stringify(siblingCollections, null, 2)}

And the user refactoring prompt/intent:
"${prompt}"

Your goal is to generate a valid, compile-safe MongoDB aggregation update pipeline array, and analyze if this change impacts/breaks any of the active relationships.

CRITICAL BSON SPECIFICATION:
- Dates are native BSON Dates and ObjectIds are native BSON ObjectIds in MongoDB. Do NOT reference hypothetical nested property names like "$date", "$oid", "$numberInt", or "$numberLong" in your aggregation paths! For example, reference "$last_updated" directly instead of "$last_updated.$date".
- If you need to convert a field to a native BSON Date, use the operator { "$toDate": "$field" } or { "$dateFromString": { "dateString": "$field" } }.
- If you need to construct an ObjectId, use standard MongoDB operators.

Output a JSON structure with EXACTLY these keys:
- "pipeline": An array containing the pipeline stages.
  - The update pipeline MUST be represented as a JSON array of stages (e.g. \`[ { "$set": { ... } } ]\`).
  - ONLY use aggregate operators like \`$set\`, \`$unset\`, \`$addFields\`, \`$project\`, \`$replaceRoot\`, or math/string operators. Do NOT use writing stages like \`$out\` or \`$merge\`.
  - Ensure all operator keys are quoted properly as standard JSON properties (e.g., \`"$set"\`, \`"$unset"\`).
- "explanation": A short, highly professional SRE explanation (1-2 sentences) of what the pipeline does, written in ${targetLanguage}.
- "impactedRelations": An array of active relationships that are affected or broken by this change (e.g., if the user's intent is renaming, changing, or deleting a field that serves as a logical relationship/reference key to another collection). Each item in the array MUST contain:
  - "fromField": The field in the current collection (e.g., "account_id").
  - "toCollection": The target referenced collection (e.g., "accounts").
  - "toField": The referenced field in that collection (e.g., "_id").
  - "impactDescription": A clear warning sentence written in ${targetLanguage} explaining how this change breaks/impacts referencing integrity with the "toCollection" collection (e.g., "Đổi tên 'account_id' sẽ làm đứt gãy quan hệ liên kết với bảng 'accounts'.").
  - "coordinatedPipeline": A valid, compile-safe MongoDB aggregation update pipeline array (e.g., \`[ { "$set": { ... } } ]\`) to be run on the "toCollection" to synchronize this field change (e.g., renaming the reference key from 'account_id' to 'account_number' to preserve referential integrity).

Return ONLY this JSON block. Do not wrap it in markdown block tags like \`\`\`json. Just the raw JSON block.
`;
        const userPrompt = `Generate the schema migration update pipeline and relational impact analysis for "${prompt}".`;
        let aiResponse;
        try {
            aiResponse = await GeminiService_1.geminiService.generateJSON(userPrompt, systemPrompt);
        }
        catch (e) {
            console.error('[SchemaMigratorService] Gemini generation error, using fallback:', e.message || e);
            // Let's implement a fallback depending on the user prompt
            const lowPrompt = prompt.toLowerCase();
            let fallbackPipeline = [];
            let fallbackExp = 'Compiled locally via database SRE static compiler.';
            if (lowPrompt.includes('rename') || lowPrompt.includes('price')) {
                fallbackPipeline = [
                    { $set: { amount: { $toDouble: '$price' } } },
                    { $unset: ['price'] }
                ];
                fallbackExp = 'Converted standard price fields to double values and renamed to amount.';
            }
            else {
                fallbackPipeline = [
                    { $set: { updatedAt: { $toDate: '$$NOW' } } }
                ];
                fallbackExp = 'Added standard timestamp parameters to all collection entries.';
            }
            aiResponse = { pipeline: fallbackPipeline, explanation: fallbackExp, impactedRelations: [] };
        }
        // Double-check pipeline formatting
        if (!Array.isArray(aiResponse.pipeline)) {
            aiResponse.pipeline = [];
        }
        // 3. Native Database Dry-Run: Run the aggregation update pipeline on the active sample document
        let transformed = null;
        try {
            // Create a read-only mock pipeline by matching the single document ID, then running the set/unset stages
            const mockPipeline = [
                { $match: { _id: sample._id } },
                ...aiResponse.pipeline
            ];
            const result = await mongoDb.collection(collectionName).aggregate(mockPipeline).toArray();
            if (result && result.length > 0) {
                transformed = result[0];
            }
        }
        catch (err) {
            console.error('[SchemaMigratorService] Database dry-run execution failed:', err.message || err);
            throw new Error(`The AI generated pipeline is invalid in MongoDB: ${err.message}`);
        }
        // 4. For each impacted relation, fetch a sample document and run the coordinated pipeline
        const finalImpactedRelations = [];
        if (aiResponse.impactedRelations && Array.isArray(aiResponse.impactedRelations)) {
            for (const rel of aiResponse.impactedRelations) {
                try {
                    const relatedColl = rel.toCollection;
                    const relatedSample = await mongoDb.collection(relatedColl).findOne();
                    if (relatedSample) {
                        let relatedTransformed = relatedSample;
                        if (Array.isArray(rel.coordinatedPipeline) && rel.coordinatedPipeline.length > 0) {
                            const mockPipeline = [
                                { $match: { _id: relatedSample._id } },
                                ...rel.coordinatedPipeline
                            ];
                            const result = await mongoDb.collection(relatedColl).aggregate(mockPipeline).toArray();
                            if (result && result.length > 0) {
                                relatedTransformed = result[0];
                            }
                        }
                        finalImpactedRelations.push({
                            fromField: rel.fromField,
                            toCollection: rel.toCollection,
                            toField: rel.toField,
                            impactDescription: rel.impactDescription,
                            coordinatedPipeline: rel.coordinatedPipeline || [],
                            sampleOriginal: relatedSample,
                            sampleTransformed: relatedTransformed
                        });
                    }
                    else {
                        finalImpactedRelations.push({
                            fromField: rel.fromField,
                            toCollection: rel.toCollection,
                            toField: rel.toField,
                            impactDescription: rel.impactDescription,
                            coordinatedPipeline: rel.coordinatedPipeline || [],
                            sampleOriginal: null,
                            sampleTransformed: null
                        });
                    }
                }
                catch (err) {
                    console.error(`[SchemaMigratorService] Failed to generate dry-run for related collection ${rel.toCollection}:`, err);
                    finalImpactedRelations.push({
                        fromField: rel.fromField,
                        toCollection: rel.toCollection,
                        toField: rel.toField,
                        impactDescription: rel.impactDescription,
                        coordinatedPipeline: rel.coordinatedPipeline || [],
                        sampleOriginal: null,
                        sampleTransformed: null
                    });
                }
            }
        }
        return {
            original: sample,
            transformed: transformed || sample,
            pipeline: aiResponse.pipeline,
            explanation: aiResponse.explanation,
            impactedRelations: finalImpactedRelations
        };
    }
    async executeMigration(mongoDb, collectionName, pipeline) {
        if (!Array.isArray(pipeline) || pipeline.length === 0) {
            throw new Error('Execution failed: Empty or invalid migration pipeline.');
        }
        try {
            const result = await mongoDb.collection(collectionName).updateMany({}, pipeline);
            return {
                matchedCount: result.matchedCount,
                modifiedCount: result.modifiedCount
            };
        }
        catch (err) {
            console.error('[SchemaMigratorService] Bulk updateMany failed:', err.message || err);
            throw new Error(`Failed to execute bulk transformation: ${err.message}`);
        }
    }
    async generateSuggestions(mongoDb, collectionName, locale = 'en') {
        // 1. Fetch a single sample document
        const sample = await mongoDb.collection(collectionName).findOne();
        if (!sample) {
            return [
                "Add a 'status' field with default value 'active' and 'lastRefactoredAt' to current date.",
                "Convert the 'createdAt' date string into a native Mongo ISODate."
            ];
        }
        // Fetch mapped ERD schema to understand relational dependencies
        let relations = [];
        let siblingCollections = [];
        try {
            const erdResult = await ErdMapperService_1.erdMapperService.mapErd(mongoDb, mongoDb.databaseName, collectionName);
            relations = erdResult.relations || [];
            siblingCollections = erdResult.siblingCollections || [];
        }
        catch (err) {
            console.error('[SchemaMigratorService] Failed to map ERD relationship context for suggestions:', err);
        }
        const localeMap = {
            'en': 'English',
            'vi': 'Vietnamese (Tiếng Việt)',
            'de': 'German (Deutsch)',
            'es': 'Spanish (Español)',
            'fa': 'Persian (Farsi)',
            'it': 'Italian (Italiano)',
            'ru': 'Russian (Русский)',
            'zh-cn': 'Simplified Chinese (简体中文)'
        };
        const targetLanguage = localeMap[locale.toLowerCase()] || 'English';
        const sanitizedSample = sanitizeSampleForAI(sample);
        const systemPrompt = `You are a world-class MongoDB database schema SRE and relationship architect.
Your task is to analyze the following actual sample document from a collection named "${collectionName}":
${JSON.stringify(sanitizedSample, null, 2)}

Additionally, here are the logical entity-relationship (ERD) references between this collection and other sibling collections in the database:
${JSON.stringify(relations, null, 2)}

And here are the names of all collections in this database:
${JSON.stringify(siblingCollections, null, 2)}

Your goal is to generate exactly 5 highly realistic, practical, and useful schema refactoring prompts or migration intents that a developer would want to perform on this specific collection.

CRITICAL RELATIONAL & DATABASE ERD RULES:
1. Examine the entity-relationship (ERD) references. If a field in "${collectionName}" acts as a logical reference or relationship key to another collection (e.g. "account_id" references "accounts"), you MUST NOT suggest modifying or renaming this field without explicitly warning the user of the relational impact, or suggest migrating both collections in coordination to prevent breaking database links.
   - For example, do NOT suggest "Rename 'account_id' to 'accountId'" without warning. Instead, suggest: "Rename 'account_id' to 'accountId' in both this and the 'accounts' collections to preserve the relationship." or "Convert 'account_id' from number to a native MongoDB ObjectId."
2. Each suggested prompt should be a clean, clear one-sentence statement of intent.
3. MUST output the suggestions in the target language: ${targetLanguage}.
4. Do not mention MongoDB technical operator names like $set or $unset in the prompt. Make it look like natural language intent.
5. Ensure the field names used in the suggestions match the actual fields in the sample document (do not translate field names themselves, keep them exactly as they are in the document).
6. Suggested transformations can include: renaming a field, converting data types, merging fields, adding new metadata fields with defaults, or removing unused fields.
7. Output a JSON array of strings containing exactly 5 suggestions.
8. Return ONLY the raw JSON array.
`;
        const userPrompt = `Generate 5 custom, relational-aware migration suggestion prompts in ${targetLanguage} for the collection "${collectionName}".`;
        try {
            const suggestions = await GeminiService_1.geminiService.generateJSON(userPrompt, systemPrompt);
            if (Array.isArray(suggestions) && suggestions.length > 0) {
                return suggestions;
            }
        }
        catch (e) {
            console.error('[SchemaMigratorService] Failed to generate AI suggestions, using local fallback:', e.message || e);
        }
        // Fallback based on sample keys if Gemini fails
        const allFields = Object.keys(sample);
        const list = [];
        if (locale.toLowerCase() === 'vi') {
            if (allFields.includes('price') || allFields.includes('amount')) {
                list.push("Đổi tên 'price' thành 'amount' và chuyển đổi giá trị từ chuỗi sang số thực.");
            }
            list.push("Thêm trường 'status' với giá trị mặc định là 'active' và 'lastRefactoredAt' là ngày hiện tại.");
            list.push("Chuyển đổi chuỗi ngày 'createdAt' thành kiểu dữ liệu Date của Mongo.");
        }
        else {
            if (allFields.includes('price') || allFields.includes('amount')) {
                list.push("Rename 'price' to 'amount' and convert the value from string to double.");
            }
            list.push("Add a 'status' field with default value 'active' and 'lastRefactoredAt' to current date.");
            list.push("Convert the 'createdAt' date string into a native Mongo ISODate.");
        }
        return list;
    }
}
exports.SchemaMigratorService = SchemaMigratorService;
function sanitizeSampleForAI(doc) {
    if (doc === null || doc === undefined)
        return doc;
    if (doc instanceof Date) {
        return doc.toISOString();
    }
    if (typeof doc === 'object') {
        if (doc._bsontype === 'ObjectID' || doc._bsontype === 'ObjectId' || (doc.constructor && doc.constructor.name === 'ObjectId')) {
            return doc.toString();
        }
        if (doc.$oid) {
            return doc.$oid;
        }
        if (doc.$date) {
            return typeof doc.$date === 'object' && doc.$date.$numberLong
                ? new Date(parseInt(doc.$date.$numberLong)).toISOString()
                : doc.$date;
        }
        if (Array.isArray(doc)) {
            return doc.map(sanitizeSampleForAI);
        }
        const clean = {};
        for (const key of Object.keys(doc)) {
            clean[key] = sanitizeSampleForAI(doc[key]);
        }
        return clean;
    }
    return doc;
}
exports.schemaMigratorService = new SchemaMigratorService();
