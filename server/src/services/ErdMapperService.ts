import { Db } from 'mongodb';
import { geminiService } from './GeminiService';
import { collectionService } from './CollectionService';
import * as common from '../routes/common';

export interface SchemaErdRelation {
  fromField: string;
  toCollection: string;
  toField: string;
  type: 'One-to-One' | 'One-to-Many' | 'Many-to-One';
  reason: string;
}

export interface SchemaErdResult {
  fields: any[];
  relations: SchemaErdRelation[];
  siblingCollections: string[];
}

export class ErdMapperService {
  async mapErd(mongoDb: Db, dbName: string, collName: string): Promise<SchemaErdResult> {
    // 1. Fetch schema fields of active collection
    let fields: any[] = [];
    try {
      fields = await collectionService.getSchema(mongoDb, collName);
    } catch (e) {
      console.error('Error fetching schema in ERD:', e);
    }

    // 2. Fetch all collections in the database
    let siblingCollections: string[] = [];
    try {
      const collectionList = await mongoDb.listCollections().toArray();
      siblingCollections = common.cleanCollections(collectionList);
    } catch (e) {
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
      const result = await geminiService.generateJSON<any>(userPrompt, systemInstruction);
      
      return {
        fields: fields, // Always use the verified DB schema fields directly
        relations: result.relations || [],
        siblingCollections
      };
    } catch (err) {
      console.error('[ErdMapperService] Gemini ERD inference failed:', err);

      // Local Prefix/Suffix fallback mapping
      const relations: SchemaErdRelation[] = [];
      
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
  async mapDatabaseErd(mongoDb: Db, dbName: string): Promise<{ collections: Record<string, any[]>; relations: any[] }> {
    // 1. Fetch all collections in the database
    let siblingCollections: string[] = [];
    try {
      const collectionList = await mongoDb.listCollections().toArray();
      siblingCollections = common.cleanCollections(collectionList);
    } catch (e) {
      console.error('Error fetching collections in Database ERD:', e);
    }

    // 2. Fetch schemas for all collections
    const collectionsWithFields: Record<string, any[]> = {};
    for (const coll of siblingCollections) {
      try {
        collectionsWithFields[coll] = await collectionService.getSchema(mongoDb, coll);
      } catch (e) {
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
      const result = await geminiService.generateJSON<any>(userPrompt, systemInstruction);
      return {
        collections: collectionsWithFields,
        relations: result.relations || []
      };
    } catch (err) {
      console.error('[ErdMapperService] Gemini Database ERD inference failed:', err);
      // Fallback local matching
      const relations: any[] = [];
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

export const erdMapperService = new ErdMapperService();
