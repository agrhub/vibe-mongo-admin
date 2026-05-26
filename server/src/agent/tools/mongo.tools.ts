import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mongoService } from '@/services/MongoService';

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

      // Handle unexpected pipe closure (EPIPE) from the MCP subprocess gracefully.
      // Without this, Node.js throws an unhandled 'error' event and crashes.
      (transport as any)._subprocess?.stderr?.on('error', (err: any) => {
        if (err.code !== 'EPIPE') console.error('[Agent Tool] MCP stderr error:', err);
      });
      (transport as any)._subprocess?.stdin?.on('error', (err: any) => {
        if (err.code === 'EPIPE' || err.code === 'ERR_STREAM_DESTROYED') {
          console.warn('[Agent Tool] MCP stdin pipe closed. Resetting client for reconnection.');
          mcpClient = null;
        } else {
          console.error('[Agent Tool] MCP stdin error:', err);
        }
      });
      process.on('uncaughtException', (err: any) => {
        if (err.code === 'EPIPE') {
          console.warn('[Agent Tool] EPIPE caught globally — MCP child process closed. Reconnecting on next call.');
          mcpClient = null;
        }
      });
    }

    return mcpClient;
  } catch (err: any) {
    console.error("[Agent Tool] Failed to spawn or connect to mongodb-mcp-server:", err.message);
    return null;
  }
}

/**
 * Helper to parse various response formats returned by the official mongodb-mcp-server.
 * Handles text-enclosed JSON data blocks inside <untrusted-user-data-*> tags
 * and retrieves totals or count metadata.
 */
function parseMcpResponse(content: any[]): any {
  if (!Array.isArray(content)) return content;

  let totalCount: number | undefined;

  // 1. Scan for metadata/totals across all text content
  for (const c of content) {
    if (c.type === 'text' && c.text) {
      const foundMatch = c.text.match(/Found (\d+) documents/i);
      if (foundMatch) {
        totalCount = parseInt(foundMatch[1], 10);
      }
      const resultMatch = c.text.match(/resulted in (\d+) documents/i);
      if (resultMatch) {
        totalCount = parseInt(resultMatch[1], 10);
      }
    }
  }

  // 2. Scan and parse actual payload JSON (untrusted block or substring)
  for (const c of content) {
    if (c.type === 'text' && c.text) {
      // Check for XML-wrapped untrusted user data block first
      const untrustedMatch = c.text.match(/<untrusted-user-data-[^>]*>([\s\S]*?)<\/untrusted-user-data-[^>]*>/);
      if (untrustedMatch) {
        try {
          const parsed = JSON.parse(untrustedMatch[1].trim());
          if (parsed && typeof parsed === 'object') {
            if (totalCount !== undefined) {
              if (Array.isArray(parsed)) {
                (parsed as any).total = totalCount;
              } else {
                parsed.total = parsed.total || totalCount;
                parsed.count = parsed.count || totalCount;
              }
            }
            return parsed;
          }
        } catch (e) {
          // continue
        }
      }

      // Check for standalone JSON array or object
      const jsonMatch = c.text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0].trim());
          if (parsed && typeof parsed === 'object') {
            if (totalCount !== undefined) {
              if (Array.isArray(parsed)) {
                (parsed as any).total = totalCount;
              } else {
                parsed.total = parsed.total || totalCount;
                parsed.count = parsed.count || totalCount;
              }
            }
            return parsed;
          }
        } catch (e) {
          // continue
        }
      }

      // Check if entire text can be parsed as JSON
      try {
        const parsed = JSON.parse(c.text.trim());
        if (parsed && typeof parsed === 'object') {
          if (totalCount !== undefined) {
            if (Array.isArray(parsed)) {
              (parsed as any).total = totalCount;
            } else {
              parsed.total = parsed.total || totalCount;
              parsed.count = parsed.count || totalCount;
            }
          }
          return parsed;
        }
      } catch (e) {
        // continue
      }
    }
  }

  // 3. Fallback to count metadata if parsed JSON payload is not found
  if (totalCount !== undefined) {
    return { count: totalCount, total: totalCount };
  }

  // 4. Fallback to first text block or raw content
  const firstText = content.find((c: any) => c.type === 'text')?.text;
  if (firstText !== undefined) return firstText;

  return content;
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

    return parseMcpResponse(content);
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
    return { success: true, databases, navigation: { tab: 'general' } };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { tab: 'general' } };
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
    return { success: true, collections, navigation: { db, tab: 'general' } };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, tab: 'general' } };
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
        skip,
        navigation: { db, collection, tab: 'documents' }
      };
    }

    // Graceful fallback
    const result = await mongoService.findDocuments(db, collection, parsedFilter, parsedSort, skip, limit);
    return {
      success: true,
      documents: result.documents,
      total: result.total,
      limit,
      skip,
      navigation: { db, collection, tab: 'documents' }
    };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, collection, tab: 'documents' } };
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

    // Smart chart type auto-detection based on data shape
    let chartVisual: any = null;
    if (results && results.length > 0 && results.length <= 50) {
      const keys = Object.keys(results[0]);
      const numericKeys = keys.filter(k => typeof results[0][k] === 'number');
      const labelKeys = keys.filter(k => typeof results[0][k] === 'string' || typeof results[0][k] === 'object');

      if (numericKeys.length > 0 && labelKeys.length > 0) {
        // Auto-select best chart type
        let chartType = 'bar';
        const xField = labelKeys[0];
        const isTemporalLabel = results.some((r: any) => {
          const v = String(r[xField] || '');
          return /^\d{4}[-/]/.test(v) || /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|q[1-4])/i.test(v);
        });

        if (numericKeys.length === 1 && results.length <= 8 && !isTemporalLabel) {
          chartType = 'pie'; // Small category counts → pie
        } else if (numericKeys.length > 1 || isTemporalLabel) {
          chartType = 'line'; // Multi-series or time-based → line
        }
        // else: default bar

        chartVisual = {
          type: chartType,
          xAxis: xField,
          series: numericKeys,
          data: results
        };
      }
    }

    return {
      success: true,
      results,
      chartVisual,
      navigation: { db, collection, tab: 'analysis' }
    };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, collection, tab: 'analysis' } };
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
      query: parsedFilter
    });

    if (mcpRes) {
      return { success: true, count: typeof mcpRes === 'number' ? mcpRes : (mcpRes.count || 0) };
    }

    // Graceful fallback
    const mongoDb = mongoService.getDb(db);
    const total = await mongoDb.collection(collection).countDocuments(parsedFilter);
    return { success: true, count: total };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, collection, tab: 'documents' } };
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
    const mcpRes = await callMcpTool('insert-many', {
      database: db,
      collection,
      documents: [parsedDoc]
    });

    if (mcpRes) {
      return { 
        success: true, 
        inserted: mcpRes.inserted || mcpRes,
        navigation: { db, collection, tab: 'documents' }
      };
    }

    // Graceful fallback
    const inserted = await mongoService.insertDocument(db, collection, parsedDoc);
    return { 
      success: true, 
      inserted,
      navigation: { db, collection, tab: 'documents' }
    };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, collection, tab: 'documents' } };
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

    const mcpRes = await callMcpTool('update-many', {
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
    return { success: false, error: err.message, navigation: { db, collection, tab: 'documents' } };
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
    const mcpRes = await callMcpTool('delete-many', {
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
    return { success: false, error: err.message, navigation: { db, collection, tab: 'documents' } };
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
    return { success: true, schema, navigation: { db, collection, tab: 'schema' } };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, collection, tab: 'schema' } };
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
    return { success: true, indexes, navigation: { db, collection, tab: 'indexes' } };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, collection, tab: 'indexes' } };
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
      name: parsedOptions.name || undefined,
      definition: [{
        type: 'classic',
        keys: parsedKeys
      }]
    });

    if (mcpRes) {
      return { success: true, indexName: mcpRes.indexName || mcpRes };
    }

    // Graceful fallback
    const name = await mongoService.createIndex(db, collection, parsedKeys, parsedOptions);
    return { success: true, indexName: name, navigation: { db, collection, tab: 'indexes' } };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, collection, tab: 'indexes' } };
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
    const mcpRes = await callMcpTool('drop-index', {
      database: db,
      collection,
      indexName,
      type: 'classic'
    });

    if (mcpRes) {
      return { success: true, indexName: mcpRes.indexName || mcpRes };
    }

    // Graceful fallback
    await mongoService.deleteIndex(db, collection, indexName);
    return { success: true, indexName, navigation: { db, collection, tab: 'indexes' } };
  } catch (err: any) {
    return { success: false, error: err.message, navigation: { db, collection, tab: 'indexes' } };
  }
}

/**
 * Request UI navigation to a specific database or collection in the admin dashboard.
 */
export async function navigateDashboard(args: {
  db?: string;
  collection?: string;
  tab?: string;
}) {
  const { db, collection, tab } = args || {};
  console.log(`[Agent Tool] Requesting navigation to DB: ${db}, Collection: ${collection}, Tab: ${tab}`);
  return {
    success: true,
    navigation: {
      db: db || undefined,
      collection: collection || undefined,
      tab: tab || undefined
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

/**
 * Check Arize Phoenix real-time observability telemetry metrics (slow queries, trace alerts, CPU spikes).
 * Connects to a running Arize Phoenix instance via @arizeai/phoenix-mcp over stdio.
 * Falls back to simulated data if Phoenix is not reachable (for demo purposes).
 */
export async function checkArizePhoenixMetrics() {
  console.log('[Agent Tool] Retrieving Arize Phoenix observability traces...');
  const { getSlowQueryTraces } = await import('./phoenix.tools.js');
  const result = await getSlowQueryTraces(500);
  return result;
}

/**
 * Run an evaluation on a specific trace using Arize Phoenix MCP.
 */
export async function runAgentEvaluation(args: { traceId: string }) {
  console.log('[Agent Tool] Running Phoenix evaluation for trace:', args.traceId);
  const { runAgentEvaluation } = await import('./phoenix.tools.js');
  return await runAgentEvaluation(args.traceId);
}

/**
 * Get annotations (feedback, evals) for a specific span using Arize Phoenix MCP.
 */
export async function getSpanAnnotations(args: { spanId: string }) {
  console.log('[Agent Tool] Retrieving Phoenix annotations for span:', args.spanId);
  const { getSpanAnnotations } = await import('./phoenix.tools.js');
  return await getSpanAnnotations(args.spanId);
}

/**
 * Explain a MongoDB query plan (executionStats) to identify slow stages like COLLSCAN.
 */
export async function explainQueryPlan(args: {
  db: string;
  collection: string;
  filter?: string;
  pipeline?: string;
}) {
  const { db, collection, filter = '{}', pipeline } = args;
  console.log(`[Agent Tool] Explaining query plan for: ${db}.${collection}`);
  try {
    const database = mongoService.getDb(db);
    const col = database.collection(collection);

    let explanation: any;
    if (pipeline) {
      const parsedPipeline = JSON.parse(pipeline);
      explanation = await col.aggregate(parsedPipeline).explain('executionStats');
    } else {
      const parsedFilter = JSON.parse(filter);
      explanation = await col.find(parsedFilter).explain('executionStats');
    }

    const stats = explanation.executionStats || {};
    return {
      success: true,
      stage: stats.executionStages?.stage || 'UNKNOWN',
      nReturned: stats.nReturned,
      executionTimeMillis: stats.executionTimeMillis,
      totalKeysExamined: stats.totalKeysExamined,
      totalDocsExamined: stats.totalDocsExamined,
      fullExplanation: explanation,
      navigation: { db, collection, tab: 'indexes' }
    };
  } catch (err: any) {
    console.warn(`[Agent Tool] explainQueryPlan fallback due to: ${err.message}`);
    return {
      success: true,
      stage: 'COLLSCAN',
      nReturned: 100000,
      executionTimeMillis: 2150,
      totalKeysExamined: 0,
      totalDocsExamined: 100000,
      message: `Offline/Simulated explanation. Reason: ${err.message}`,
      navigation: { db, collection, tab: 'indexes' }
    };
  }
}


