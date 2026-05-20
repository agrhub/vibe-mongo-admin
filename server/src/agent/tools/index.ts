import { FunctionTool } from '@google/adk';
import * as mongoTools from './mongo.tools.js';

const toolSchemas: Record<string, any> = {
  listDatabases: {
    type: 'OBJECT',
    properties: {}
  },
  listCollections: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' }
    },
    required: ['db']
  },
  findDocuments: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' },
      filter: { type: 'STRING', description: 'BSON filter JSON string (e.g. \'{"age": {"$gt": 30}}\')' },
      sort: { type: 'STRING', description: 'BSON sort JSON string (e.g. \'{"name": 1}\')' },
      limit: { type: 'INTEGER', description: 'Limit count' },
      skip: { type: 'INTEGER', description: 'Skip count' }
    },
    required: ['db', 'collection']
  },
  aggregatePipeline: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' },
      pipeline: { type: 'STRING', description: 'Aggregation pipeline JSON string array (e.g. \'[{"$match": {"status": "A"}}, {"$group": {"_id": "$cust_id", "total": {"$sum": "$amount"}}}]\')' }
    },
    required: ['db', 'collection', 'pipeline']
  },
  countDocuments: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' },
      filter: { type: 'STRING', description: 'BSON filter JSON string (e.g. \'{"age": {"$gt": 30}}\')' }
    },
    required: ['db', 'collection']
  },
  insertOneDocument: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' },
      document: { type: 'STRING', description: 'JSON string of the document to insert' }
    },
    required: ['db', 'collection', 'document']
  },
  updateOneDocument: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' },
      filter: { type: 'STRING', description: 'BSON filter JSON string' },
      update: { type: 'STRING', description: 'JSON update operators patch string (e.g. \'{"$set": {"status": "C"}}\')' }
    },
    required: ['db', 'collection', 'filter', 'update']
  },
  deleteOneDocument: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' },
      filter: { type: 'STRING', description: 'BSON filter JSON string' }
    },
    required: ['db', 'collection', 'filter']
  },
  getCollectionSchema: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' }
    },
    required: ['db', 'collection']
  },
  listIndexes: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' }
    },
    required: ['db', 'collection']
  },
  createIndex: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' },
      keys: { type: 'STRING', description: 'Index keys JSON string (e.g. \'{"email": 1}\')' },
      options: { type: 'STRING', description: 'Index options JSON string (e.g. \'{"unique": true}\')' }
    },
    required: ['db', 'collection', 'keys']
  },
  deleteIndex: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name' },
      collection: { type: 'STRING', description: 'The collection name' },
      indexName: { type: 'STRING', description: 'The name of the index to delete' }
    },
    required: ['db', 'collection', 'indexName']
  },
  navigateDashboard: {
    type: 'OBJECT',
    properties: {
      db: { type: 'STRING', description: 'The database name to switch to' },
      collection: { type: 'STRING', description: 'The collection name to switch to' }
    }
  },
  getServerStatus: {
    type: 'OBJECT',
    properties: {}
  }
};

function toFunctionTools(module: Record<string, any>): FunctionTool[] {
  return Object.entries(module)
    .filter(([_, fn]) => typeof fn === 'function')
    .map(([name, fn]) => {
      try {
        // Build readable summaries from method camelCases
        const description = name.replace(/([A-Z])/g, ' $1').toLowerCase();
        const schema = toolSchemas[name];
        return new FunctionTool({
          name: name,
          description: `Tool to ${description}. Arguments must match types strictly. Query filters must be valid JSON strings.`,
          parameters: schema,
          execute: async (args: any) => await fn(args)
        });
      } catch (err) {
        console.error(`Failed to register tool: ${name}`, err);
        return null;
      }
    })
    .filter((tool): tool is FunctionTool => tool !== null);
}

export const allTools: FunctionTool[] = [
  ...toFunctionTools(mongoTools)
];
export { allTools as mongoTools };

