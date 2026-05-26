"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MongoService_1 = require("../services/MongoService");
var common = require('../routes/common');
exports.addConnection = function (connection, app, callback) {
    if (!connection.connOptions) {
        connection.connOptions = {};
    }
    // Connect using MongoService
    MongoService_1.mongoService.connect(connection.connString, connection.connName, connection.connOptions)
        .then(() => {
        callback(null, null);
    })
        .catch((err) => {
        callback(err, null);
    });
};
exports.removeConnection = async function (connectionName, app) {
    await MongoService_1.mongoService.disconnect(connectionName);
    return;
};
