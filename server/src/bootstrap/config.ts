import nconf from "nconf";

export interface AppConfig {
    app_host: string;
    app_port: number;
    app_context: string;
}

export function setupConfig(): AppConfig {
    // setup nconf files
    nconf.add('app', {
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

    if (nconf.stores.app.get('app:host') !== undefined) {
        app_host = nconf.stores.app.get('app:host');
    }
    if (nconf.stores.app.get('app:port') !== undefined) {
        app_port = Number(nconf.stores.app.get('app:port')) || 1234;
    }

    var app_context = '';
    if (nconf.stores.app.get('app:context') !== undefined && nconf.stores.app.get('app:context') !== '') {
        app_context = '/' + nconf.stores.app.get('app:context');
    }

    return {
        app_host,
        app_port,
        app_context
    };
}
