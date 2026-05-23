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
exports.addConnection = addConnection;
exports.updateConnection = updateConnection;
exports.deleteConnection = deleteConnection;
exports.listAllConnections = listAllConnections;
const ConnectionStore_1 = require("../../services/ConnectionStore");
const common = __importStar(require("../../routes/common"));
// We need to access req.app for these, but tools don't have direct access to req.
// However, mongoService might have references or we can use a singleton.
// Actually, connections.ts router uses require('../../utils/connections') and req.app.
// For the agent, we can implement these by calling the logic directly if we have access to the app instance or if the service doesn't need it.
/**
 * Add a new MongoDB connection profile.
 */
async function addConnection({ name, uri }) {
    console.log(`[Agent Tool] Adding connection: ${name}`);
    try {
        common.parseMongoUri(uri);
        const existing = await ConnectionStore_1.connectionStore.getConnection(name);
        if (existing) {
            throw new Error(`Connection with name "${name}" already exists.`);
        }
        await ConnectionStore_1.connectionStore.saveConnection(name, uri);
        return { success: true, message: `Connection "${name}" added successfully.` };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
/**
 * Update an existing MongoDB connection profile.
 */
async function updateConnection({ currentName, newName, newUri }) {
    console.log(`[Agent Tool] Updating connection: ${currentName} to ${newName}`);
    try {
        common.parseMongoUri(newUri);
        const existingRecord = await ConnectionStore_1.connectionStore.getConnection(currentName);
        if (!existingRecord) {
            throw new Error(`Connection "${currentName}" not found.`);
        }
        // If name changed, delete old one
        if (currentName !== newName) {
            if (existingRecord.id) {
                await ConnectionStore_1.connectionStore.deleteConnection(existingRecord.id);
            }
        }
        await ConnectionStore_1.connectionStore.saveConnection(newName, newUri);
        return { success: true, message: `Connection "${currentName}" updated to "${newName}" successfully.` };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
/**
 * Delete a MongoDB connection profile.
 */
async function deleteConnection({ name }) {
    console.log(`[Agent Tool] Deleting connection: ${name}`);
    try {
        const existingRecord = await ConnectionStore_1.connectionStore.getConnection(name);
        if (!existingRecord) {
            throw new Error(`Connection "${name}" not found.`);
        }
        if (existingRecord.id) {
            await ConnectionStore_1.connectionStore.deleteConnection(existingRecord.id);
        }
        return { success: true, message: `Connection "${name}" deleted successfully.` };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
/**
 * List all saved MongoDB connection profiles.
 */
async function listAllConnections() {
    try {
        const savedConnections = await ConnectionStore_1.connectionStore.listConnections();
        return {
            success: true,
            connections: savedConnections.map(c => ({ name: c.name, uri: c.uri }))
        };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
