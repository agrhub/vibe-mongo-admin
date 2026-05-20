'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = exports.stringify = void 0;
var mongodb = require('mongodb');
function f(n) {
    return n < 10 ? '0' + n : n;
}
var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
var gap;
var indent;
var meta = {
    '\b': '\\b',
    '\t': '\\t',
    '\n': '\\n',
    '\f': '\\f',
    '\r': '\\r',
    '"': '\\"',
    '\\': '\\\\'
};
var rep;
function quote(string) {
    escapable.lastIndex = 0;
    return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
        var c = meta[a];
        return typeof c === 'string' ?
            c :
            '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"' : '"' + string + '"';
}
function str(key, holder) {
    var i;
    var k;
    var v;
    var length;
    var mind = gap;
    var partial;
    var value = holder[key];
    if (value) {
        var className = value.constructor ? value.constructor.name : '';
        var bsonType = value._bsontype || className;
        if (bsonType === 'ObjectID' || bsonType === 'ObjectId') {
            return 'ObjectId("' + value.toString() + '")';
        }
        else if (bsonType === 'Timestamp') {
            // Timestamp has high and low components
            var high = value.high !== undefined ? value.high : (value.high_ || 0);
            var low = value.low !== undefined ? value.low : (value.low_ || 0);
            return 'Timestamp(' + high + ', ' + low + ')';
        }
        else if (value instanceof Date) {
            return 'ISODate("' + value.toJSON() + '")';
        }
        else if (bsonType === 'DBRef') {
            var db = value.db || '';
            var namespace = value.namespace || value.collection || '';
            var oid = value.oid || value.id || '';
            if (db === '') {
                return 'DBRef("' + namespace + '", "' + oid + '")';
            }
            else {
                return 'DBRef("' + namespace + '", "' + oid + '", "' + db + '")';
            }
        }
        else if (bsonType === 'Code') {
            return 'Code("' + (value.code || '') + '")';
        }
        else if (bsonType === 'MinKey') {
            return 'MinKey()';
        }
        else if (bsonType === 'MaxKey') {
            return 'MaxKey()';
        }
        else if (bsonType === 'Symbol') {
            return 'Symbol("' + value.toString() + '")';
        }
    }
    if (value && typeof value === 'object' && typeof value.toJSON === 'function') {
        value = value.toJSON(key);
    }
    if (typeof rep === 'function') {
        value = rep.call(holder, key, value);
    }
    switch (typeof value) {
        case 'string':
            return quote(value);
        case 'number':
            return isFinite(value) ? String(value) : 'null';
        case 'boolean':
            return String(value);
        case 'object':
            if (!value) {
                return 'null';
            }
            gap += indent;
            partial = [];
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }
                v = partial.length === 0 ?
                    '[]' :
                    gap ?
                        '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                        '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }
            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === 'string') {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            else {
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            v = partial.length === 0 ?
                '{}' :
                gap ?
                    '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
                    '{' + partial.join(',') + '}';
            gap = mind;
            return v;
    }
}
exports.stringify = function (value, replacer, space) {
    var i;
    gap = '';
    indent = '';
    if (typeof space === 'number') {
        for (i = 0; i < space; i += 1) {
            indent += ' ';
        }
    }
    else if (typeof space === 'string') {
        indent = space;
    }
    rep = replacer;
    if (replacer && typeof replacer !== 'function' &&
        (typeof replacer !== 'object' ||
            typeof replacer.length !== 'number')) {
        throw new Error('JSON.stringify');
    }
    return str('', { '': value });
};
exports.stringify = exports.stringify;
exports.parse = function (str) {
    let cleanStr = str;
    // Replace ObjectId("...") or ObjectId('...')
    cleanStr = cleanStr.replace(/ObjectId\((['"])([a-fA-F0-9]+)\1\)/g, '{"$oid": "$2"}');
    // Replace ISODate("...") or ISODate('...')
    cleanStr = cleanStr.replace(/ISODate\((['"])([^'"]+)\1\)/g, '{"$date": "$2"}');
    // Replace Timestamp(t, i)
    cleanStr = cleanStr.replace(/Timestamp\((\d+),\s*(\d+)\)/g, '{"$timestamp": {"t": $1, "i": $2}}');
    // Replace NumberLong("...") or NumberLong(...)
    cleanStr = cleanStr.replace(/NumberLong\((['"])?(\d+)\1?\)/g, '{"$numberLong": "$2"}');
    // Replace NumberInt(...)
    cleanStr = cleanStr.replace(/NumberInt\((\d+)\)/g, '$1');
    // Replace Code("...")
    cleanStr = cleanStr.replace(/Code\((['"])([^'"]+)\1\)/g, '{"$code": "$2"}');
    // Replace MinKey() and MaxKey()
    cleanStr = cleanStr.replace(/MinKey\(\)/g, '{"$minKey": 1}');
    cleanStr = cleanStr.replace(/MaxKey\(\)/g, '{"$maxKey": 1}');
    const BSON = require('mongodb').BSON;
    return BSON.EJSON.parse(cleanStr);
};
exports.parse = exports.parse;
