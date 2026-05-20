import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mongoService } from '../../services/MongoService';

let mcpClient: Client | null = null;
let currentActiveUri: string | null = null;

/**
 * Lazy initializer to connect to the official mongodb-mcp-server subprocess over Standard I/O.
 * Uses the dynamic decrypted active connection string from the backend's connection profiles.
 */
async function getMcpClient(): Promise<Client | null> {
  try {
    const uri = mongoService.getActiveUri();
    if (!uri) {
      console.warn("[Agent Tool] No active connection URI registered. Operating in offline/fallback mode.");
      return null;
    }

    // If active URI changed, cleanly terminate old server first
    if (mcpClient && currentActiveUri !== uri) {
      console.log("[Agent Tool] Active URI connection changed. Re-spawning MCP server...");
      try {
        await mcpClient.close();
      } catch (err: any) {
        console.error("[Agent Tool] Error shutting down old MCP server:", err.message);
      }
      mcpClient = null;
    }

    if (!mcpClient) {
      console.log("[Agent Tool] Spawning mongodb-mcp-server over Standard I/O...");
      const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "mongodb-mcp-server"],
        env: {
          ...process.env,
          MDB_MCP_CONNECTION_STRING: uri
        }
      });

      const client = new Client(
        { name: "mongo-agent-client", version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(transport);
      mcpClient = client;
      currentActiveUri = uri;
      console.log("[Agent Tool] Successfully connected and synchronized with mongodb-mcp-server!");
    }

    return mcpClient;
  } catch (err: any) {
    console.error("[Agent Tool] Failed to spawn or connect to mongodb-mcp-server:", err.message);
    return null;
  }
}

/**
 * Generic JSON-RPC tool caller forwarding requests to the running mongodb-mcp-server subprocess.
 */
async function callMcpTool(toolName: string, args: any) {
  const client = await getMcpClient();
  if (!client) {
    console.warn(`[Agent Tool] Stdio MCP server not available. Running fallback driver action for: ${toolName}`);
    return null;
  }

  console.log(`[Agent Tool] Invoking MCP tool: ${toolName}`, args);
  try {
    const response = await client.callTool({
      name: toolName,
      arguments: args
    });

    const content = (response.content || []) as any[];

    if (response.isError) {
      const errorMsg = content.find((c: any) => c.type === 'text')?.text || 'Unknown MCP execution error';
      throw new Error(errorMsg);
    }

    const text = content.find((c: any) => c.type === 'text')?.text || '{}';
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (err: any) {
    console.error(`[Agent Tool] MCP execution failed for ${toolName}:`, err.message);
    throw err;
  }
}

/**
 * List all databases on the active server.
 */
export async function listDatabases() {
  console.log('[Agent Tool] Listing all databases');
  try {
    const mcpRes = await callMcpTool('list-databases', {});
    if (mcpRes) {
      const databases = mcpRes.databases || mcpRes;
      return { success: true, databases };
    }

    // Graceful fallback
    const databases = await mongoService.listDatabases();
    return { success: true, databases };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * List all collections inside a specific database.
 */
export async function listCollections({ db }: { db: string }) {
  console.log(`[Agent Tool] Listing collections in database: ${db}`);
  try {
    const mcpRes = await callMcpTool('list-collections', { database: db });
    if (mcpRes) {
      const collections = mcpRes.collections || mcpRes;
      return { success: true, collections };
    }

    // Graceful fallback
    const collections = await mongoService.listCollections(db);
    return { success: true, collections };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Query documents in a collection with filtering, sorting, limits, and pagination.
 */
export async function findDocuments({
  db,
  collection,
  filter = '{}',
  sort = '{}',
  limit = 20,
  skip = 0
}: {
  db: string;
  collection: string;
  filter?: string;
  sort?: string;
  limit?: number;
  skip?: number;
}) {
  console.log(`[Agent Tool] Querying collection: ${db}.${collection} (Filter: ${filter}, Sort: ${sort}, Limit: ${limit})`);
  try {
    const parsedFilter = filter ? JSON.parse(filter) : {};
    const parsedSort = sort ? JSON.parse(sort) : {};

    const mcpRes = await callMcpTool('find', {
      database: db,
      collection,
      filter: parsedFilter,
      sort: parsedSort,
      limit,
      skip
    });

    if (mcpRes) {
      return {
        success: true,
        documents: mcpRes.documents || mcpRes,
        total: mcpRes.total || (mcpRes.documents || mcpRes).length,
        limit,
        skip
      };
    }

    // Graceful fallback
    const result = await mongoService.findDocuments(db, collection, parsedFilter, parsedSort, skip, limit);
    return {
      success: true,
      documents: result.documents,
      total: result.total,
      limit,
      skip
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Aggregate documents in a collection using aggregation pipelines.
 * Returns aggregation results. If the results are categoric, it includes a visual suggestion.
 */
export async function aggregatePipeline({
  db,
  collection,
  pipeline = '[]'
}: {
  db: string;
  collection: string;
  pipeline: string;
}) {
  console.log(`[Agent Tool] Aggregating collection: ${db}.${collection} (Pipeline: ${pipeline})`);
  try {
    const parsedPipeline = JSON.parse(pipeline);
    let results: any[] = [];

    const mcpRes = await callMcpTool('aggregate', {
      database: db,
      collection,
      pipeline: parsedPipeline
    });

    if (mcpRes) {
      results = mcpRes.results || mcpRes;
    } else {
      // Graceful fallback
      const mongoDb = mongoService.getDb(db);
      const col = mongoDb.collection(collection);
      results = await col.aggregate(parsedPipeline).toArray();
    }

    // Preserve the beautiful, premium auto chart visual analyzer logic!
    let chartVisual: any = null;
    if (results && results.length > 0 && results.length <= 50) {
      const keys = Object.keys(results[0]);
      const numericKeys = keys.filter(k => typeof results[0][k] === 'number');
      const labelKeys = keys.filter(k => typeof results[0][k] === 'string' || typeof results[0][k] === 'object');

      if (numericKeys.length > 0 && labelKeys.length > 0) {
        chartVisual = {
          type: numericKeys.length > 1 ? 'line' : 'bar',
          xAxis: labelKeys[0],
          series: numericKeys,
          data: results
        };
      }
    }

    return {
      success: true,
      results,
      chartVisual
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Count documents in a collection matching a filter query.
 */
export async function countDocuments({
  db,
  collection,
  filter = '{}'
}: {
  db: string;
  collection: string;
  filter?: string;
}) {
  console.log(`[Agent Tool] Counting documents in: ${db}.${collection} (Filter: ${filter})`);
  try {
    const parsedFilter = JSON.parse(filter);
    const mcpRes = await callMcpTool('count', {
      database: db,
      collection,
      filter: parsedFilter
    });

    if (mcpRes) {
      return { success: true, count: typeof mcpRes === 'number' ? mcpRes : (mcpRes.count || 0) };
    }

    // Graceful fallback
    const mongoDb = mongoService.getDb(db);
    const total = await mongoDb.collection(collection).countDocuments(parsedFilter);
    return { success: true, count: total };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Insert a document in JSON format.
 */
export async function insertOneDocument({
  db,
  collection,
  document
}: {
  db: string;
  collection: string;
  document: string;
}) {
  console.log(`[Agent Tool] Inserting document in: ${db}.${collection}`);
  try {
    const parsedDoc = JSON.parse(document);
    const mcpRes = await callMcpTool('insert-one', {
      database: db,
      collection,
      document: parsedDoc
    });

    if (mcpRes) {
      return { success: true, inserted: mcpRes.inserted || mcpRes };
    }

    // Graceful fallback
    const inserted = await mongoService.insertDocument(db, collection, parsedDoc);
    return { success: true, inserted };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update dynamic documents by filtering and applying a JSON patch.
 */
export async function updateOneDocument({
  db,
  collection,
  filter,
  update
}: {
  db: string;
  collection: string;
  filter: string;
  update: string;
}) {
  console.log(`[Agent Tool] Updating document in: ${db}.${collection} (Filter: ${filter})`);
  try {
    const parsedFilter = JSON.parse(filter);
    const parsedUpdate = JSON.parse(update);

    const mcpRes = await callMcpTool('update-one', {
      database: db,
      collection,
      filter: parsedFilter,
      update: parsedUpdate
    });

    if (mcpRes) {
      return {
        success: true,
        matchedCount: mcpRes.matchedCount,
        modifiedCount: mcpRes.modifiedCount
      };
    }

    // Graceful fallback
    const mongoDb = mongoService.getDb(db);
    const col = mongoDb.collection(collection);
    const result = await col.updateOne(parsedFilter, parsedUpdate);
    return {
      success: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a document using a matching filter.
 */
export async function deleteOneDocument({
  db,
  collection,
  filter
}: {
  db: string;
  collection: string;
  filter: string;
}) {
  console.log(`[Agent Tool] Deleting document in: ${db}.${collection} (Filter: ${filter})`);
  try {
    const parsedFilter = JSON.parse(filter);
    const mcpRes = await callMcpTool('delete-one', {
      database: db,
      collection,
      filter: parsedFilter
    });

    if (mcpRes) {
      return { success: true, deletedCount: mcpRes.deletedCount };
    }

    // Graceful fallback
    const mongoDb = mongoService.getDb(db);
    const result = await mongoDb.collection(collection).deleteOne(parsedFilter);
    return { success: true, deletedCount: result.deletedCount };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Analyze and generate a smart visual schema analysis based on document sampling.
 */
export async function getCollectionSchema({
  db,
  collection
}: {
  db: string;
  collection: string;
}) {
  console.log(`[Agent Tool] Extracting schema for: ${db}.${collection}`);
  try {
    const mcpRes = await callMcpTool('collection-schema', {
      database: db,
      collection
    });

    if (mcpRes) {
      return { success: true, schema: mcpRes.schema || mcpRes };
    }

    // Graceful fallback
    const schema = await mongoService.getCollectionSchema(db, collection);
    return { success: true, schema };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Get all indexes of a collection.
 */
export async function listIndexes({
  db,
  collection
}: {
  db: string;
  collection: string;
}) {
  console.log(`[Agent Tool] Listing indexes for: ${db}.${collection}`);
  try {
    const mcpRes = await callMcpTool('collection-indexes', {
      database: db,
      collection
    });

    if (mcpRes) {
      return { success: true, indexes: mcpRes.indexes || mcpRes };
    }

    // Graceful fallback
    const indexes = await mongoService.listIndexes(db, collection);
    return { success: true, indexes };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Create a custom index. Keys must be passed as a JSON object (e.g. '{"email":1}').
 */
export async function createIndex({
  db,
  collection,
  keys,
  options = '{}'
}: {
  db: string;
  collection: string;
  keys: string;
  options?: string;
}) {
  console.log(`[Agent Tool] Creating index on: ${db}.${collection} (Keys: ${keys})`);
  try {
    const parsedKeys = JSON.parse(keys);
    const parsedOptions = JSON.parse(options);

    const mcpRes = await callMcpTool('create-index', {
      database: db,
      collection,
      index: parsedKeys,
      unique: parsedOptions.unique || false,
      name: parsedOptions.name || undefined
    });

    if (mcpRes) {
      return { success: true, indexName: mcpRes.indexName || mcpRes };
    }

    // Graceful fallback
    const name = await mongoService.createIndex(db, collection, parsedKeys, parsedOptions);
    return { success: true, indexName: name };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete an index by name.
 */
export async function deleteIndex({
  db,
  collection,
  indexName
}: {
  db: string;
  collection: string;
  indexName: string;
}) {
  console.log(`[Agent Tool] Deleting index: ${indexName} from: ${db}.${collection}`);
  try {
    const mcpRes = await callMcpTool('delete-index', {
      database: db,
      collection,
      indexName
    });

    if (mcpRes) {
      return { success: true, indexName: mcpRes.indexName || mcpRes };
    }

    // Graceful fallback
    await mongoService.deleteIndex(db, collection, indexName);
    return { success: true, indexName };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Request UI navigation to a specific database or collection in the admin dashboard.
 */
export async function navigateDashboard(args: {
  db?: string;
  collection?: string;
}) {
  const { db, collection } = args || {};
  console.log(`[Agent Tool] Requesting navigation to DB: ${db}, Collection: ${collection}`);
  return {
    success: true,
    navigation: {
      db: db || undefined,
      collection: collection || undefined
    }
  };
}

/**
 * Get MongoDB server status, version, connections, and system metrics.
 */
export async function getServerStatus() {
  console.log('[Agent Tool] Fetching server status');
  try {
    const stats = await mongoService.getServerStatus();
    return { success: true, stats };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

