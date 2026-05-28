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
exports.erdMapperService = exports.ErdMapperService = void 0;
const GeminiService_1 = require("./GeminiService");
const CollectionService_1 = require("./CollectionService");
const common = __importStar(require("../routes/common"));
class ErdMapperService {
    async mapErd(mongoDb, dbName, collName) {
        // 1. Fetch schema fields of active collection
        let fields = [];
        try {
            fields = await CollectionService_1.collectionService.getSchema(mongoDb, collName);
        }
        catch (e) {
            console.error('Error fetching schema in ERD:', e);
        }
        // 2. Fetch all collections in the database
        let siblingCollections = [];
        try {
            const collectionList = await mongoDb.listCollections().toArray();
            siblingCollections = common.cleanCollections(collectionList);
        }
        catch (e) {
            console.error('Error fetching collections in ERD:', e);
        }
        const systemInstruction = `You are a MongoDB schema architect and expert database SRE. Given a source collection's schema fields and a list of sibling collections in the database, your job is to infer and map logical references (relationships) from the source collection to any of the sibling collections.

RULES:
- Return ONLY a valid JSON object matching the requested structure.
- DO NOT include markdown formatting, backticks (\`\`\`json), or extra explanation text.
- "fields": The array of current collection fields.
- "relations": An array of inferred relationship edges, each containing:
  - "fromField": The field path in the current collection (e.g. "userId" or "items.productId").
  - "toCollection": The target sibling collection name (e.g. "users" or "products").
  - "toField": The referenced field name in the target collection (usually "_id").
  - "type": One of "One-to-One", "One-to-Many", "Many-to-One".
  - "reason": A brief 1-sentence logical justification for this inferred reference.
`;
        const userPrompt = `Source Collection: "${collName}" in database "${dbName}"
Schema Fields:
${JSON.stringify(fields, null, 2)}

List of Sibling Collections:
${JSON.stringify(siblingCollections, null, 2)}

Infer logical reference relationships between the source collection's fields and the sibling collections.`;
        try {
            const result = await GeminiService_1.geminiService.generateJSON(userPrompt, systemInstruction);
            return {
                fields: fields, // Always use the verified DB schema fields directly
                relations: result.relations || [],
                siblingCollections
            };
        }
        catch (err) {
            console.error('[ErdMapperService] Gemini ERD inference failed:', err);
            // Local Prefix/Suffix fallback mapping
            const relations = [];
            fields.forEach((f) => {
                const fieldName = String(f.field).toLowerCase();
                // Check for fieldName containing ID or _id
                if (fieldName.endsWith('id') || fieldName.endsWith('_id') || fieldName.includes('id')) {
                    // Extract matching collection guess
                    const cleanName = fieldName.replace(/id|_id/g, '').trim();
                    const target = siblingCollections.find(c => {
                        const lowColl = c.toLowerCase();
                        return lowColl.startsWith(cleanName) || cleanName.startsWith(lowColl) || lowColl === cleanName + 's';
                    });
                    if (target && target !== collName) {
                        relations.push({
                            fromField: f.field,
                            toCollection: target,
                            toField: '_id',
                            type: 'Many-to-One',
                            reason: `Locally inferred matching keys between '${f.field}' and collection '${target}'.`
                        });
                    }
                }
            });
            return {
                fields,
                relations,
                siblingCollections
            };
        }
    }
    /**
     * Infers and maps logical references across all collections in the database.
     */
    async mapDatabaseErd(mongoDb, dbName) {
        // 1. Fetch all collections in the database
        let siblingCollections = [];
        try {
            const collectionList = await mongoDb.listCollections().toArray();
            siblingCollections = common.cleanCollections(collectionList);
        }
        catch (e) {
            console.error('Error fetching collections in Database ERD:', e);
        }
        // 2. Fetch schemas for all collections
        const collectionsWithFields = {};
        for (const coll of siblingCollections) {
            try {
                collectionsWithFields[coll] = await CollectionService_1.collectionService.getSchema(mongoDb, coll);
            }
            catch (e) {
                collectionsWithFields[coll] = [];
            }
        }
        const systemInstruction = `You are a MongoDB database architect and expert database SRE. Given a dictionary of collections and their schema fields in the database "${dbName}", your job is to infer and map all logical reference relationships (foreign keys) between these collections.

RULES:
- Return ONLY a valid JSON object matching the requested structure.
- DO NOT include markdown formatting, backticks (\`\`\`json), or extra explanation text.
- "relations": An array of inferred relationship edges, each containing:
  - "fromCollection": The source collection name.
  - "fromField": The field path in the source collection (e.g. "userId" or "movie_id").
  - "toCollection": The target collection name.
  - "toField": The referenced field name in the target collection (usually "_id").
  - "type": One of "One-to-One", "One-to-Many", "Many-to-One".
  - "reason": A brief 1-sentence logical justification for this inferred reference.
`;
        const userPrompt = `Database Name: "${dbName}"
Collections & Schemas:
${JSON.stringify(collectionsWithFields, null, 2)}

Infer logical reference relationships between all collections.`;
        try {
            const result = await GeminiService_1.geminiService.generateJSON(userPrompt, systemInstruction);
            return {
                collections: collectionsWithFields,
                relations: result.relations || []
            };
        }
        catch (err) {
            console.error('[ErdMapperService] Gemini Database ERD inference failed:', err);
            // Fallback local matching
            const relations = [];
            for (const collName of siblingCollections) {
                const fields = collectionsWithFields[collName] || [];
                fields.forEach((f) => {
                    const fieldName = String(f.field).toLowerCase();
                    if (fieldName.endsWith('id') || fieldName.endsWith('_id') || fieldName.includes('id')) {
                        const cleanName = fieldName.replace(/id|_id/g, '').trim();
                        const target = siblingCollections.find(c => {
                            const lowColl = c.toLowerCase();
                            return lowColl.startsWith(cleanName) || cleanName.startsWith(lowColl) || lowColl === cleanName + 's';
                        });
                        if (target && target !== collName) {
                            relations.push({
                                fromCollection: collName,
                                fromField: f.field,
                                toCollection: target,
                                toField: '_id',
                                type: 'Many-to-One',
                                reason: `Locally inferred matching keys between '${collName}.${f.field}' and '${target}._id'.`
                            });
                        }
                    }
                });
            }
            return {
                collections: collectionsWithFields,
                relations
            };
        }
    }
}
exports.ErdMapperService = ErdMapperService;
exports.erdMapperService = new ErdMapperService();
