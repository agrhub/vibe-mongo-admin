import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import { mongoService } from '../services/MongoService';
import { schemaMigratorService } from '../services/SchemaMigratorService';

const router = Router();

// Post a dry-run migration query
router.post('/api/:conn/:db/:coll/migrations/dry-run', async function (req: Request, res: Response) {
  const prompt = req.body.prompt;
  if (!prompt) {
    return res.status(400).json({ msg: 'Refactoring prompt/intent is required' });
  }

  const connection_list = mongoService.getConnections();
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection name' });
  }

  try {
    const mongo_client = connection_list[req.params.conn].client;
    const mongoDb = mongo_client.db(req.params.db);

    const dryRunResult = await schemaMigratorService.dryRunMigration(
      mongoDb,
      req.params.coll,
      prompt,
      (req.query.locale as string) || 'en'
    );

    res.status(200).json({
      success: true,
      result: dryRunResult
    });
  } catch (err: any) {
    res.status(500).json({ msg: 'Dry-run failed: ' + (err.message || err) });
  }
});

// Execute the schema migration updates
router.post('/api/:conn/:db/:coll/migrations/execute', async function (req: Request, res: Response) {
  const pipeline = req.body.pipeline;
  if (!pipeline || !Array.isArray(pipeline)) {
    return res.status(400).json({ msg: 'A valid aggregation pipeline array is required for execution' });
  }

  const coordinatedUpdates = req.body.coordinatedUpdates; // optional array of { collectionName: string, pipeline: any[] }

  const connection_list = mongoService.getConnections();
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection name' });
  }

  try {
    const mongo_client = connection_list[req.params.conn].client;
    const mongoDb = mongo_client.db(req.params.db);

    // 1. Execute on the primary collection
    const executionResult = await schemaMigratorService.executeMigration(
      mongoDb,
      req.params.coll,
      pipeline
    );

    // 2. Synchronize related collections if requested
    const coordinatedResults: Array<{ collection: string; modifiedCount: number }> = [];
    if (coordinatedUpdates && Array.isArray(coordinatedUpdates)) {
      for (const update of coordinatedUpdates) {
        if (update.collectionName && Array.isArray(update.pipeline) && update.pipeline.length > 0) {
          const res = await schemaMigratorService.executeMigration(
            mongoDb,
            update.collectionName,
            update.pipeline
          );
          coordinatedResults.push({
            collection: update.collectionName,
            modifiedCount: res.modifiedCount
          });
        }
      }
    }

    let msg = `Schema migration successfully executed! Modified ${executionResult.modifiedCount} documents in collection "${req.params.coll}".`;
    if (coordinatedResults.length > 0) {
      const details = coordinatedResults.map(r => `modified ${r.modifiedCount} documents in "${r.collection}"`).join(', ');
      msg += ` Coordinated synchronization applied: ${details}.`;
    }

    res.status(200).json({
      success: true,
      msg,
      result: {
        primary: executionResult,
        coordinated: coordinatedResults
      }
    });
  } catch (err: any) {
    res.status(500).json({ msg: 'Execution failed: ' + (err.message || err) });
  }
});

// Get Gemini AI migration suggestions for a collection
router.get('/api/:conn/:db/:coll/migrations/suggestions', async function (req: Request, res: Response) {
  const connection_list = mongoService.getConnections();
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection name' });
  }

  try {
    const mongo_client = connection_list[req.params.conn].client;
    const mongoDb = mongo_client.db(req.params.db);
    const locale = (req.query.locale as string) || 'en';

    const suggestions = await schemaMigratorService.generateSuggestions(
      mongoDb,
      req.params.coll,
      locale
    );

    res.status(200).json({
      success: true,
      suggestions
    });
  } catch (err: any) {
    res.status(500).json({ msg: 'Failed to generate suggestions: ' + (err.message || err) });
  }
});

export default router;
