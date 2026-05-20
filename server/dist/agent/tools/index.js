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
exports.mongoTools = exports.allTools = void 0;
const adk_1 = require("@google/adk");
const mongoTools = __importStar(require("./mongo.tools.js"));
const toolSchemas = {
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
function toFunctionTools(module) {
    return Object.entries(module)
        .filter(([_, fn]) => typeof fn === 'function')
        .map(([name, fn]) => {
        try {
            // Build readable summaries from method camelCases
            const description = name.replace(/([A-Z])/g, ' $1').toLowerCase();
            const schema = toolSchemas[name];
            return new adk_1.FunctionTool({
                name: name,
                description: `Tool to ${description}. Arguments must match types strictly. Query filters must be valid JSON strings.`,
                parameters: schema,
                execute: async (args) => await fn(args)
            });
        }
        catch (err) {
            console.error(`Failed to register tool: ${name}`, err);
            return null;
        }
    })
        .filter((tool) => tool !== null);
}
exports.allTools = [
    ...toFunctionTools(mongoTools)
];
exports.mongoTools = exports.allTools;
