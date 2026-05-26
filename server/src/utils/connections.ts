import { mongoService } from '../services/MongoService';
var common = require('@/routes/common');

exports.addConnection = function (connection: any, app: any, callback: any) {
    if (!connection.connOptions) {
        connection.connOptions = {};
    }

    // Connect using MongoService
    mongoService.connect(connection.connString, connection.connName, connection.connOptions)
        .then(() => {
            callback(null, null);
        })
        .catch((err) => {
            callback(err, null);
        });
};

exports.removeConnection = async function (connectionName: string, app: any) {
    await mongoService.disconnect(connectionName);
    return;
};
