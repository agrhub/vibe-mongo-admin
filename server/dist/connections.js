"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var MongoClient = require('mongodb').MongoClient;
var common = require('./routes/common');
exports.addConnection = function (connection, app, callback) {
    if (!app.locals.dbConnections) {
        app.locals.dbConnections = {};
    }
    if (!connection.connOptions) {
        connection.connOptions = {};
    }
    // Connect using MongoClient
    MongoClient.connect(connection.connString, connection.connOptions)
        .then(function (client) {
        // Add error listener to prevent uncaught exceptions on network errors
        client.on('error', function (err) {
            console.error('MongoDB Client Network Error:', err.message || err);
        });
        client.on('serverHeartbeatFailed', function (event) {
            console.error('MongoDB Server Heartbeat Failed');
        });
        client.on('topologyClosed', function (event) {
            console.error('MongoDB Topology Closed');
        });
        var dbObj = {};
        dbObj.client = client;
        // Parse URI to get default DB, otherwise default to 'admin'
        var defaultDb = 'admin';
        try {
            var parsedUri = common.parseMongoUri(connection.connString);
            if (parsedUri.database) {
                defaultDb = parsedUri.database;
            }
        }
        catch (e) { }
        // Store Db instance under dbObj.native
        dbObj.native = client.db(defaultDb);
        dbObj.connString = connection.connString;
        dbObj.connOptions = connection.connOptions;
        app.locals.dbConnections[connection.connName] = dbObj;
        callback(null, null);
    })
        .catch(function (err) {
        callback(err, null);
    });
};
exports.removeConnection = function (connection, app) {
    if (!app.locals.dbConnections) {
        app.locals.dbConnections = {};
    }
    try {
        app.locals.dbConnections[connection].client.close();
    }
    catch (e) { }
    delete app.locals.dbConnections[connection];
    return;
};
