"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupConfig = setupConfig;
const nconf_1 = __importDefault(require("nconf"));
function setupConfig() {
    // setup nconf files
    nconf_1.default.add('app', {
        type: 'literal', store: {
            app: {
                "port": Number(process.env.PORT) || 4000,
                "host": process.env.HOST || "localhost",
                "context": process.env.CONTEXT || "",
                "password": process.env.PASSWORD || "admin"
            }
        }
    });
    // set app defaults
    var app_host = process.env.HOST || 'localhost';
    var app_port = Number(process.env.PORT) || 1234;
    if (nconf_1.default.stores.app.get('app:host') !== undefined) {
        app_host = nconf_1.default.stores.app.get('app:host');
    }
    if (nconf_1.default.stores.app.get('app:port') !== undefined) {
        app_port = Number(nconf_1.default.stores.app.get('app:port')) || 1234;
    }
    var app_context = '';
    if (nconf_1.default.stores.app.get('app:context') !== undefined && nconf_1.default.stores.app.get('app:context') !== '') {
        app_context = '/' + nconf_1.default.stores.app.get('app:context');
    }
    return {
        app_host,
        app_port,
        app_context
    };
}
