import { connectionStore } from '../../services/ConnectionStore';
import * as common from '../../routes/common';

// We need to access req.app for these, but tools don't have direct access to req.
// However, mongoService might have references or we can use a singleton.
// Actually, connections.ts router uses require('@/utils/connections') and req.app.
// For the agent, we can implement these by calling the logic directly if we have access to the app instance or if the service doesn't need it.

/**
 * Add a new MongoDB connection profile.
 */
export async function addConnection({ name, uri }: { name: string; uri: string }) {
  console.log(`[Agent Tool] Adding connection: ${name}`);
  try {
    common.parseMongoUri(uri);
    const existing = await connectionStore.getConnection(name);
    if (existing) {
      throw new Error(`Connection with name "${name}" already exists.`);
    }
    await connectionStore.saveConnection(name, uri);
    return { success: true, message: `Connection "${name}" added successfully.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Update an existing MongoDB connection profile.
 */
export async function updateConnection({ currentName, newName, newUri }: { currentName: string; newName: string; newUri: string }) {
  console.log(`[Agent Tool] Updating connection: ${currentName} to ${newName}`);
  try {
    common.parseMongoUri(newUri);
    const existingRecord = await connectionStore.getConnection(currentName);
    if (!existingRecord) {
      throw new Error(`Connection "${currentName}" not found.`);
    }
    
    // If name changed, delete old one
    if (currentName !== newName) {
      if (existingRecord.id) {
        await connectionStore.deleteConnection(existingRecord.id);
      }
    }
    
    await connectionStore.saveConnection(newName, newUri);
    return { success: true, message: `Connection "${currentName}" updated to "${newName}" successfully.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete a MongoDB connection profile.
 */
export async function deleteConnection({ name }: { name: string }) {
  console.log(`[Agent Tool] Deleting connection: ${name}`);
  try {
    const existingRecord = await connectionStore.getConnection(name);
    if (!existingRecord) {
      throw new Error(`Connection "${name}" not found.`);
    }
    if (existingRecord.id) {
      await connectionStore.deleteConnection(existingRecord.id);
    }
    return { success: true, message: `Connection "${name}" deleted successfully.` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * List all saved MongoDB connection profiles.
 */
export async function listAllConnections() {
  try {
    const savedConnections = await connectionStore.listConnections();
    return { 
      success: true, 
      connections: savedConnections.map(c => ({ name: c.name, uri: c.uri }))
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
