var _ = require('lodash');
var fs = require('fs');
var path = require('path');

function getDb(mongo_db: any, db_name: any) {
    // mongo_db may be a MongoClient or a Db instance.
    // MongoClient does NOT have a `databaseName` property; Db does.
    if (mongo_db && !mongo_db.databaseName && typeof mongo_db.db === 'function') {
        // It is a MongoClient — switch database directly
        return mongo_db.db(db_name);
    }
    // It is a Db instance — get the underlying MongoClient in v6+ via .client
    if (mongo_db && mongo_db.client) {
        return mongo_db.client.db(db_name);
    }
    // It is a Db instance — get the underlying MongoClient in older drivers via s.client
    if (mongo_db && mongo_db.s && mongo_db.s.client) {
        return mongo_db.s.client.db(db_name);
    }
    // Last resort fallback
    return mongo_db;
}

async function getCollectionStats(dbInstance: any, collName: string) {
    try {
        const stats = await dbInstance.command({ collStats: collName });
        return {
            Storage: stats ? (stats.storageSize || stats.size || 0) : 0,
            Documents: stats ? (stats.count !== undefined ? stats.count : 0) : 0
        };
    } catch (err) {
        // Fallback if collStats command is not authorized or fails
        try {
            const count = await dbInstance.collection(collName).countDocuments();
            return { Storage: 0, Documents: count };
        } catch (e) {
            return { Storage: 0, Documents: 0 };
        }
    }
}

// Returns a Db pointing to 'admin', works for both MongoClient and Db instances
function getAdminDb(mongo_db: any) {
    if (mongo_db && !mongo_db.databaseName && typeof mongo_db.db === 'function') {
        // MongoClient — get the admin Db
        return mongo_db.db('admin');
    }
    // Already a Db — return as-is (caller will call .admin() on it)
    return mongo_db;
}

// Checks active password in config.json
exports.checkLogin = function (req: any, res: any, next: any) {
    var passwordConf = req.nconf.app.get('app');

    if (passwordConf && passwordConf.hasOwnProperty('password')) {
        if (req.session.loggedIn) {
            next();
        } else {
            res.status(401).json({ 'msg': 'Unauthorized. Please login.' });
        }
    } else {
        next();
    }
};

// Gets database server status
exports.get_db_status = function (mongo_db: any, cb: any) {
    var adminDb = getAdminDb(mongo_db).admin();
    adminDb.serverStatus()
        .then(function (status: any) {
            cb(null, status);
        })
        .catch(function (err: any) {
            cb('Error', null);
        });
};

// Gets the list of available database backups
exports.get_backups = function (cb: any) {
    var backupPath = path.join(__dirname, '../../data/backups');

    if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
    }

    fs.readdir(backupPath, function (err: any, files: any) {
        if (err) return cb(err, []);
        // Custom junk filter: ignore hidden files, Windows desktop files, and require .zip extension
        var filteredFiles = files.filter(function (filename: string) {
            return !filename.startsWith('.') && 
                   filename !== 'Thumbs.db' && 
                   filename !== 'desktop.ini' && 
                   filename.endsWith('.zip');
        });
        // Enrich each file with size and date metadata
        var enriched: any[] = [];
        filteredFiles.forEach(function (filename: string) {
            try {
                var fullPath = path.join(backupPath, filename);
                var stat = fs.statSync(fullPath);
                if (stat.isFile()) {
                    enriched.push({ name: filename, size: stat.size, date: stat.mtime.toISOString() });
                }
            } catch (e) {
                // Ignore files that cannot be stated
            }
        });
        // Sort by date descending (newest first)
        enriched.sort((a: any, b: any) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
        cb(null, enriched);
    });
};

// Gets detailed statistics for a database or all databases
exports.get_db_stats = function (mongo_db: any, db_name: any, cb: any) {
    var async = require('async');
    var db_obj: any = {};

    if (db_name == null) {
        var adminDb = getAdminDb(mongo_db).admin();
        adminDb.listDatabases()
            .then(function (db_list: any) {
                if (db_list !== undefined) {
                    async.forEachOf(exports.order_object(db_list.databases), function (value: any, key: any, callback: any) {
                        var skipped_dbs = ['null', 'admin', 'local'];
                        if (skipped_dbs.indexOf(value.name) === -1) {
                            var tempDBName = value.name;
                            getDb(mongo_db, tempDBName).listCollections().toArray()
                                .then(function (coll_list: any) {
                                    var coll_obj: any = {};
                                    var collections = exports.cleanCollections(coll_list);
                                    async.forEachOf(collections, function (value: any, key: any, callback: any) {
                                        var targetDb = getDb(mongo_db, tempDBName);
                                        getCollectionStats(targetDb, value).then(function (st) {
                                            coll_obj[value] = st;
                                            callback();
                                        });
                                    }, function (err: any) {
                                        if (err) console.error(err.message);
                                        db_obj[tempDBName] = exports.order_object(coll_obj);
                                        callback();
                                    });
                                })
                                .catch(function (err: any) {
                                    console.error(err.message);
                                    callback();
                                });
                        } else {
                            callback();
                        }
                    }, function (err: any) {
                        if (err) console.error(err.message);
                        cb(null, exports.order_object(db_obj));
                    });
                } else {
                    cb(null, null);
                }
            })
            .catch(function (err: any) {
                cb('User is not authorised', null);
            });
    } else {
        getDb(mongo_db, db_name).listCollections().toArray()
            .then(function (coll_list: any) {
                var coll_obj: any = {};
                var collections = exports.cleanCollections(coll_list);
                async.forEachOf(collections, function (value: any, key: any, callback: any) {
                    var targetDb = getDb(mongo_db, db_name);
                    getCollectionStats(targetDb, value).then(function (st) {
                        coll_obj[value] = st;
                        callback();
                    });
                }, function (err: any) {
                    if (err) console.error(err.message);
                    db_obj[db_name] = exports.order_object(coll_obj);
                    cb(null, db_obj);
                });
            })
            .catch(function (err: any) {
                cb(err, null);
            });
    }
};

// Gets the list of databases
exports.get_db_list = function (uri: any, mongo_db: any, cb: any) {
    var async = require('async');
    var adminDb = getAdminDb(mongo_db).admin();
    var db_arr: any[] = [];

    if (uri.database === undefined || uri.database === null || uri.database === '') {
        adminDb.listDatabases()
            .then(function (db_list: any) {
                if (db_list !== undefined) {
                    async.forEachOf(db_list.databases, function (value: any, key: any, callback: any) {
                        var skipped_dbs = ['null', 'admin', 'local'];
                        if (skipped_dbs.indexOf(value.name) === -1) {
                            db_arr.push(value.name);
                        }
                        callback();
                    }, function (err: any) {
                        if (err) console.error(err.message);
                        exports.order_array(db_arr);
                        cb(null, db_arr);
                    });
                } else {
                    cb(null, null);
                }
            })
            .catch(function (err: any) {
                cb(err, null);
            });
    } else {
        db_arr.push(uri.database);
        cb(null, db_arr);
    }
};

// Parses document ID and tries standard types: ObjectId, Integer, String
exports.get_id_type = function (mongo: any, collection: any, doc_id: any, cb: any) {
    if (doc_id) {
        var ObjectId = require('mongodb').ObjectId;

        // Try as ObjectId
        var isValidObjectId = false;
        try {
            isValidObjectId = ObjectId.isValid(doc_id);
        } catch (e) { }

        if (isValidObjectId) {
            mongo.collection(collection).findOne({ _id: new ObjectId(doc_id) })
                .then(function (doc: any) {
                    if (doc) {
                        cb(null, { 'doc_id_type': new ObjectId(doc_id), 'doc': doc });
                    } else {
                        mongo.collection(collection).findOne({ _id: doc_id })
                            .then(function (doc2: any) {
                                if (doc2) {
                                    cb(null, { 'doc_id_type': doc_id, 'doc': doc2 });
                                } else {
                                    cb('Document not found', { 'doc_id_type': null, 'doc': null });
                                }
                            })
                            .catch(function (err: any) {
                                cb(err, { 'doc_id_type': null, 'doc': null });
                            });
                    }
                })
                .catch(function (err: any) {
                    cb(err, { 'doc_id_type': null, 'doc': null });
                });
        } else {
            // Try as integer
            var parsedInt = parseInt(doc_id);
            if (!isNaN(parsedInt)) {
                mongo.collection(collection).findOne({ _id: parsedInt })
                    .then(function (doc: any) {
                        if (doc) {
                            cb(null, { 'doc_id_type': parsedInt, 'doc': doc });
                        } else {
                            mongo.collection(collection).findOne({ _id: doc_id })
                                .then(function (doc2: any) {
                                    if (doc2) {
                                        cb(null, { 'doc_id_type': doc_id, 'doc': doc2 });
                                    } else {
                                        cb('Document not found', { 'doc_id_type': null, 'doc': null });
                                    }
                                })
                                .catch(function (err: any) {
                                    cb(err, { 'doc_id_type': null, 'doc': null });
                                });
                        }
                    })
                    .catch(function (err: any) {
                        cb(err, { 'doc_id_type': null, 'doc': null });
                    });
            } else {
                // Try as string
                mongo.collection(collection).findOne({ _id: doc_id })
                    .then(function (doc: any) {
                        if (doc) {
                            cb(null, { 'doc_id_type': doc_id, 'doc': doc });
                        } else {
                            cb('Document not found', { 'doc_id_type': null, 'doc': null });
                        }
                    })
                    .catch(function (err: any) {
                        cb(err, { 'doc_id_type': null, 'doc': null });
                    });
            }
        }
    } else {
        cb(null, { 'doc_id_type': null, 'doc': null });
    }
};

// Gets Sidebar hierarchy list of databases and collections
exports.get_sidebar_list = function (mongo_db: any, db_name: any, cb: any) {
    var async = require('async');
    var db_obj: any = {};

    if (db_name == null) {
        var adminDb = getAdminDb(mongo_db).admin();
        adminDb.listDatabases()
            .then(function (db_list: any) {
                if (db_list) {
                    async.forEachOf(db_list.databases, function (value: any, key: any, callback: any) {
                        var skipped_dbs = ['null', 'admin', 'local'];
                        if (skipped_dbs.indexOf(value.name) === -1) {
                            getDb(mongo_db, value.name).listCollections().toArray()
                                .then(function (collections: any) {
                                    var cleaned = exports.cleanCollections(collections);
                                    exports.order_array(cleaned);
                                    db_obj[value.name] = cleaned;
                                    callback();
                                })
                                .catch(function (err: any) {
                                    console.error(err.message);
                                    callback();
                                });
                        } else {
                            callback();
                        }
                    }, function (err: any) {
                        if (err) console.error(err.message);
                        cb(null, exports.order_object(db_obj));
                    });
                } else {
                    cb(null, exports.order_object(db_obj));
                }
            })
            .catch(function (err: any) {
                cb(err, {});
            });
    } else {
        getDb(mongo_db, db_name).listCollections().toArray()
            .then(function (collections: any) {
                var cleaned = exports.cleanCollections(collections);
                exports.order_array(cleaned);
                db_obj[db_name] = cleaned;
                cb(null, db_obj);
            })
            .catch(function (err: any) {
                cb(err, {});
            });
    }
};

exports.order_object = function (unordered: any) {
    if (unordered !== undefined) {
        var ordered: any = {};
        var keys = Object.keys(unordered);
        exports.order_array(keys);
        keys.forEach(function (key) {
            ordered[key] = unordered[key];
        });
        return ordered;
    }
    return {};
};

exports.order_array = function (array: any) {
    if (array) {
        array.sort(function (a: any, b: any) {
            a = String(a).toLowerCase();
            b = String(b).toLowerCase();
            if (a === b) return 0;
            if (a > b) return 1;
            return -1;
        });
    }
    return array;
};

exports.cleanCollections = function (collection_list: any) {
    var list: any[] = [];
    _.each(collection_list, function (item: any) {
        list.push(item.name);
    });
    return list;
};

exports.parseMongoUri = function (uri: string) {
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
        throw new TypeError('uri must be mongodb scheme');
    }

    // Extract everything after scheme
    const afterScheme = uri.substring(uri.indexOf('://') + 3);

    // Find last '@' to isolate host list and path
    const atIndex = afterScheme.lastIndexOf('@');
    const hostAndPath = atIndex !== -1 ? afterScheme.substring(atIndex + 1) : afterScheme;

    // Find first '/' to isolate path (database and options)
    const slashIndex = hostAndPath.indexOf('/');
    if (slashIndex === -1) {
        return { database: '' };
    }

    const pathPart = hostAndPath.substring(slashIndex + 1);

    // Find first '?' to isolate database name
    const qIndex = pathPart.indexOf('?');
    const database = qIndex !== -1 ? pathPart.substring(0, qIndex) : pathPart;

    return { database: decodeURIComponent(database) };
};

export const checkLogin = exports.checkLogin;
export const get_db_status = exports.get_db_status;
export const get_backups = exports.get_backups;
export const get_db_stats = exports.get_db_stats;
export const get_db_list = exports.get_db_list;
export const get_id_type = exports.get_id_type;
export const get_sidebar_list = exports.get_sidebar_list;
export const order_object = exports.order_object;
export const order_array = exports.order_array;
export const cleanCollections = exports.cleanCollections;
export const parseMongoUri = exports.parseMongoUri;
