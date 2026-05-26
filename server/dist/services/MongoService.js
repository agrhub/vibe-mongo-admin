"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mongoService = exports.MongoService = void 0;
const mongodb_1 = require("mongodb");
class MongoService {
    connections = new Map();
    defaultConnectionName = null;
    /**
     * Connect to a MongoDB instance and store it
     */
    async connect(uri, name, options = {}) {
        try {
            if (this.connections.has(name)) {
                await this.disconnect(name);
            }
            console.log(`[MongoService] Connecting to MongoDB: ${name} (URI: ${uri.replace(/:([^@:]+)@/, ':****@')})`);
            const client = new mongodb_1.MongoClient(uri, {
                connectTimeoutMS: 5000,
                serverSelectionTimeoutMS: 5000,
                ...options
            });
            await client.connect();
            // Ping database to confirm validity
            await client.db('admin').command({ ping: 1 });
            const dbObj = {
                client,
                connString: uri,
                connOptions: options,
                native: client.db('admin')
            };
            this.connections.set(name, dbObj);
            console.log(`[MongoService] Connected successfully to ${name}`);
            return true;
        }
        catch (err) {
            console.error(`[MongoService] Connection failed to ${name}:`, err);
            throw err;
        }
    }
    /**
     * Disconnect from a MongoDB instance
     */
    async disconnect(name) {
        const conn = this.connections.get(name);
        if (conn) {
            try {
                await conn.client.close();
            }
            catch (e) { }
            this.connections.delete(name);
            console.log(`[MongoService] Disconnected from ${name}`);
        }
    }
    /**
     * Set a default/active connection for legacy/singleton operations (like Agent Tools)
     */
    setActiveConnection(client, uri, name) {
        if (!this.connections.has(name)) {
            this.connections.set(name, {
                client,
                connString: uri,
                connOptions: {},
                native: client.db('admin')
            });
        }
        this.defaultConnectionName = name;
    }
    getActiveUri() {
        if (this.defaultConnectionName && this.connections.has(this.defaultConnectionName)) {
            return this.connections.get(this.defaultConnectionName).connString;
        }
        if (this.connections.size > 0) {
            return Array.from(this.connections.values())[0].connString;
        }
        return null;
    }
    /**
     * Add an already established connection (e.g. from legacy utils/connections.ts)
     */
    addConnectionObject(name, connObj) {
        this.connections.set(name, connObj);
    }
    /**
     * Safe getter for a connection object
     */
    getConnection(name) {
        const conn = this.connections.get(name);
        if (!conn) {
            throw new Error(`Invalid connection name: ${name}`);
        }
        return conn;
    }
    /**
     * Get all active connections
     */
    getConnections() {
        const result = {};
        for (const [key, value] of this.connections.entries()) {
            result[key] = value;
        }
        return result;
    }
    /**
     * Safe getter for the active MongoClient (for backwards compatibility if needed, using the first connection, or specific name)
     */
    getClient(name) {
        if (name) {
            return this.getConnection(name).client;
        }
        if (this.defaultConnectionName && this.connections.has(this.defaultConnectionName)) {
            return this.connections.get(this.defaultConnectionName).client;
        }
        if (this.connections.size === 0) {
            throw new Error('No active database connection. Please connect to a MongoDB server first.');
        }
        return Array.from(this.connections.values())[0].client;
    }
    /**
     * Safe getter for a DB
     */
    getDb(dbName, name) {
        return this.getClient(name).db(dbName);
    }
    /**
     * List all databases
     */
    async listDatabases() {
        const client = this.getClient();
        const result = await client.db('admin').admin().listDatabases();
        return result.databases;
    }
    /**
     * Drop a database
     */
    async dropDatabase(dbName) {
        const client = this.getClient();
        await client.db(dbName).dropDatabase();
        return true;
    }
    /**
     * Create a new database with its first collection
     */
    async createDatabase(dbName, collectionName) {
        const db = this.getDb(dbName);
        // Databases in MongoDB are created lazily. We create the collection first,
        // then insert a placeholder document to force creation of the db.
        await db.createCollection(collectionName);
        const col = db.collection(collectionName);
        await col.insertOne({
            _id: new mongodb_1.ObjectId(),
            info: 'Database successfully initialized via VibeMongo portal.'
        });
        return true;
    }
    /**
     * List database users
     */
    async listDatabaseUsers(dbName) {
        const db = this.getDb(dbName);
        try {
            const result = await db.command({ usersInfo: 1 });
            return result.users || [];
        }
        catch (err) {
            console.error(`[MongoService] Error listing users for ${dbName}:`, err);
            throw err;
        }
    }
    /**
     * Create database user
     */
    async createDatabaseUser(dbName, username, password, roles) {
        const db = this.getDb(dbName);
        await db.command({
            createUser: username,
            pwd: password,
            roles: roles.map(r => ({ role: r, db: dbName }))
        });
        return true;
    }
    /**
     * Delete database user
     */
    async deleteDatabaseUser(dbName, username) {
        const db = this.getDb(dbName);
        await db.command({ dropUser: username });
        return true;
    }
    /**
     * Export collection as raw JSON documents array
     */
    async exportCollection(dbName, collectionName) {
        const db = this.getDb(dbName);
        const col = db.collection(collectionName);
        return await col.find({}).toArray();
    }
    /**
     * List all collections in a database
     */
    async listCollections(dbName) {
        const db = this.getDb(dbName);
        const collections = await db.listCollections().toArray();
        const statsList = [];
        for (const col of collections) {
            try {
                const stats = await db.command({ collStats: col.name });
                statsList.push({
                    name: col.name,
                    count: stats.count,
                    size: stats.size,
                    avgObjSize: stats.avgObjSize || 0,
                    storageSize: stats.storageSize || 0,
                    nindexes: stats.nindexes || 0,
                    totalIndexSize: stats.totalIndexSize || 0
                });
            }
            catch (err) {
                // Fallback if collStats fails (e.g. System collections)
                const count = await db.collection(col.name).countDocuments();
                statsList.push({
                    name: col.name,
                    count,
                    size: 0,
                    avgObjSize: 0,
                    storageSize: 0,
                    nindexes: 0,
                    totalIndexSize: 0
                });
            }
        }
        return statsList;
    }
    /**
     * Create a new collection
     */
    async createCollection(dbName, collectionName) {
        const db = this.getDb(dbName);
        await db.createCollection(collectionName);
        return true;
    }
    /**
     * Drop an existing collection
     */
    async dropCollection(dbName, collectionName) {
        const db = this.getDb(dbName);
        await db.collection(collectionName).drop();
        return true;
    }
    /**
     * Paginated documents search with dynamic query support
     */
    async findDocuments(dbName, collectionName, query = {}, sort = {}, skip = 0, limit = 20) {
        const db = this.getDb(dbName);
        const col = db.collection(collectionName);
        // Parse ID filtering if '_id' is specified as string and fits ObjectId pattern
        const processedQuery = { ...query };
        if (processedQuery._id && typeof processedQuery._id === 'string' && mongodb_1.ObjectId.isValid(processedQuery._id)) {
            processedQuery._id = new mongodb_1.ObjectId(processedQuery._id);
        }
        else if (processedQuery._id && typeof processedQuery._id === 'object' && processedQuery._id.$oid) {
            processedQuery._id = new mongodb_1.ObjectId(processedQuery._id.$oid);
        }
        const total = await col.countDocuments(processedQuery);
        const documents = await col
            .find(processedQuery)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .toArray();
        return { documents, total };
    }
    /**
     * Insert a document
     */
    async insertDocument(dbName, collectionName, doc) {
        const db = this.getDb(dbName);
        const col = db.collection(collectionName);
        // Auto-generate ObjectId if not specified
        const processedDoc = { ...doc };
        if (processedDoc._id && typeof processedDoc._id === 'string' && mongodb_1.ObjectId.isValid(processedDoc._id)) {
            processedDoc._id = new mongodb_1.ObjectId(processedDoc._id);
        }
        const result = await col.insertOne(processedDoc);
        return { ...processedDoc, _id: result.insertedId };
    }
    /**
     * Update a document
     */
    async updateDocument(dbName, collectionName, idStr, updateDoc) {
        const db = this.getDb(dbName);
        const col = db.collection(collectionName);
        let selector = { _id: idStr };
        if (mongodb_1.ObjectId.isValid(idStr)) {
            selector = { _id: new mongodb_1.ObjectId(idStr) };
        }
        // Strip _id from update document to prevent mutating immutable fields
        const { _id, ...cleanUpdate } = updateDoc;
        const result = await col.replaceOne(selector, cleanUpdate);
        if (result.matchedCount === 0) {
            throw new Error(`Document with ID ${idStr} not found`);
        }
        return { _id: idStr, ...cleanUpdate };
    }
    /**
     * Delete a document
     */
    async deleteDocument(dbName, collectionName, idStr) {
        const db = this.getDb(dbName);
        const col = db.collection(collectionName);
        let selector = { _id: idStr };
        if (mongodb_1.ObjectId.isValid(idStr)) {
            selector = { _id: new mongodb_1.ObjectId(idStr) };
        }
        const result = await col.deleteOne(selector);
        return (result.deletedCount ?? 0) > 0;
    }
    /**
     * List indexes on a collection
     */
    async listIndexes(dbName, collectionName) {
        const db = this.getDb(dbName);
        return await db.collection(collectionName).indexes();
    }
    /**
     * Create an index
     */
    async createIndex(dbName, collectionName, keys, options = {}) {
        const db = this.getDb(dbName);
        return await db.collection(collectionName).createIndex(keys, options);
    }
    /**
     * Delete an index
     */
    async deleteIndex(dbName, collectionName, indexName) {
        const db = this.getDb(dbName);
        await db.collection(collectionName).dropIndex(indexName);
        return true;
    }
    /**
     * Smart schema visualizer: samples 20 documents and parses types, occurrence percentage, and samples.
     */
    async getCollectionSchema(dbName, collectionName) {
        const db = this.getDb(dbName);
        const col = db.collection(collectionName);
        const sampleDocs = await col.find().limit(20).toArray();
        if (sampleDocs.length === 0) {
            return { message: 'Collection is empty. Schema cannot be analyzed.' };
        }
        const schema = {};
        sampleDocs.forEach(doc => {
            Object.entries(doc).forEach(([key, val]) => {
                if (!schema[key]) {
                    schema[key] = { types: new Set(), count: 0, examples: [] };
                }
                schema[key].count++;
                let typeStr = typeof val;
                if (val === null) {
                    typeStr = 'null';
                }
                else if (Array.isArray(val)) {
                    typeStr = 'array';
                }
                else if (val instanceof Date) {
                    typeStr = 'date';
                }
                else if (val instanceof mongodb_1.ObjectId) {
                    typeStr = 'objectId';
                }
                schema[key].types.add(typeStr);
                if (schema[key].examples.length < 3 && val !== undefined) {
                    schema[key].examples.push(val);
                }
            });
        });
        const parsedSchema = {};
        Object.entries(schema).forEach(([key, meta]) => {
            parsedSchema[key] = {
                types: Array.from(meta.types),
                occurrenceRate: Math.round((meta.count / sampleDocs.length) * 100),
                examples: meta.examples
            };
        });
        return parsedSchema;
    }
    /**
     * Fetch server telemetry & resource stats
     */
    async getServerStatus() {
        const client = this.getClient();
        try {
            // Runs serverStatus administrative call
            const status = await client.db('admin').command({ serverStatus: 1 });
            return {
                version: status.version,
                uptime: status.uptime,
                connections: status.connections,
                network: status.network,
                opcounters: status.opcounters,
                mem: status.mem,
                pid: status.pid
            };
        }
        catch (err) {
            // Graceful fallback for environments with limited administrative permissions
            return {
                version: 'Unknown (limited credentials)',
                uptime: 0,
                connections: { current: 1, available: 100 },
                network: { bytesIn: 0, bytesOut: 0 },
                opcounters: { insert: 0, query: 0, update: 0, delete: 0 },
                mem: { virtual: 0, resident: 0 }
            };
        }
    }
}
exports.MongoService = MongoService;
exports.mongoService = new MongoService();
