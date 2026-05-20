import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import _ from 'lodash';

const router = Router();

// ================= METRICS MONITORING =================

// Get monitoring charts data
router.get('/api/:conn/monitoring', function (req: Request, res: Response) {
    var dayBack = new Date();
    dayBack.setDate(dayBack.getDate() - 1);

    req.db.find({ connectionName: req.params.conn, eventDate: { $gte: dayBack } }).sort({ eventDate: 1 }).exec(function (err: any, serverEvents: any) {
        if (err || !serverEvents || serverEvents.length === 0) {
            return res.status(200).json({ dataRetrieved: false, data: {} });
        }

        var connectionsCurrent: any[] = [];
        var connectionsAvailable: any[] = [];
        var connectionsTotalCreated: any[] = [];

        var clientsTotal: any[] = [];
        var clientsReaders: any[] = [];
        var clientsWriters: any[] = [];

        var memoryVirtual: any[] = [];
        var memoryMapped: any[] = [];
        var memoryCurrent: any[] = [];

        var docsQueried: any[] = [];
        var docsInserted: any[] = [];
        var docsDeleted: any[] = [];
        var docsUpdated: any[] = [];

        if (serverEvents.length > 0) {
            if (serverEvents[0].dataRetrieved === true) {
                _.each(serverEvents, function (value: any, key: any) {
                    // connections
                    if (value.connections) {
                        connectionsCurrent.push({ x: value.eventDate, y: value.connections.current });
                        connectionsAvailable.push({ x: value.eventDate, y: value.connections.available });
                        connectionsTotalCreated.push({ x: value.eventDate, y: value.connections.totalCreated });
                    }
                    // clients
                    if (value.activeClients) {
                        clientsTotal.push({ x: value.eventDate, y: value.activeClients.total });
                        clientsReaders.push({ x: value.eventDate, y: value.activeClients.readers });
                        clientsWriters.push({ x: value.eventDate, y: value.activeClients.writers });
                    }
                    // memory
                    if (value.memory) {
                        memoryVirtual.push({ x: value.eventDate, y: value.memory.virtual });
                        memoryMapped.push({ x: value.eventDate, y: value.memory.mapped });
                        memoryCurrent.push({ x: value.eventDate, y: value.memory.resident });
                    }

                    if (value.docCounts) {
                        docsQueried.push({ x: value.eventDate, y: value.docCounts.queried });
                        docsInserted.push({ x: value.eventDate, y: value.docCounts.inserted });
                        docsDeleted.push({ x: value.eventDate, y: value.docCounts.deleted });
                        docsUpdated.push({ x: value.eventDate, y: value.docCounts.updated });
                    }
                });
            }

            var dataPointsLimit = 1000;

            var returnedData = {
                connectionsCurrent: averageDatapoints(connectionsCurrent, dataPointsLimit),
                connectionsAvailable: averageDatapoints(connectionsAvailable, dataPointsLimit),
                connectionsTotalCreated: averageDatapoints(connectionsTotalCreated, dataPointsLimit),
                clientsTotal: averageDatapoints(clientsTotal, dataPointsLimit),
                clientsReaders: averageDatapoints(clientsReaders, dataPointsLimit),
                clientsWriters: averageDatapoints(clientsWriters, dataPointsLimit),
                memoryVirtual: averageDatapoints(memoryVirtual, dataPointsLimit),
                memoryMapped: averageDatapoints(memoryMapped, dataPointsLimit),
                memoryCurrent: averageDatapoints(memoryCurrent, dataPointsLimit),
                docsQueried: averageDatapoints(docsQueried, dataPointsLimit),
                docsInserted: averageDatapoints(docsInserted, dataPointsLimit),
                docsDeleted: averageDatapoints(docsDeleted, dataPointsLimit),
                docsUpdated: averageDatapoints(docsUpdated, dataPointsLimit)
            };

            var uptime: any = (serverEvents[0].uptime / 60).toFixed(2);
            if (uptime > 61) {
                uptime = (uptime / 60).toFixed(2) + ' hours';
            } else {
                uptime = uptime + ' minutes';
            }

            if (err) {
                res.status(400).json({ 'msg': 'Could not get server monitoring' });
            } else {
                res.status(200).json({ data: returnedData, dataRetrieved: serverEvents[0].dataRetrieved, pid: serverEvents[0].pid, version: serverEvents[0].version, uptime: uptime });
            }
        }
    });
});

function averageDatapoints(datapoints: any, limit: number) {
    if (limit >= datapoints.length) {
        return datapoints;
    }

    if (datapoints.length === 0) return [];

    var min = new Date(datapoints[0].x).getTime();
    var max = new Date(datapoints[datapoints.length - 1].x).getTime();

    if (limit < 1) {
        return [{
            x: new Date((min + max) / 2),
            y: datapoints.reduce((a: any, b: any) => a.y + b.y, 0) / datapoints.length
        }];
    }
    var step = (max - min) / limit;
    var result = [];
    var l = min + step;
    var n = 0;
    var sumx = 0;
    var sumy = 0;
    for (var i = 0; i < datapoints.length; i++) {
        var dTime = new Date(datapoints[i].x).getTime();
        if (dTime > l) {
            if (n > 0) {
                result.push({
                    x: sumy ? new Date(sumx / sumy) : new Date(l - step / 2),
                    y: sumy / n
                });
            }
            while (dTime > l) {
                l += step;
            }
            n = 0;
            sumx = 0;
            sumy = 0;
        }
        n++;
        sumx += dTime * datapoints[i].y;
        sumy += datapoints[i].y;
    }
    if (n > 0) {
        result.push({
            x: sumy ? new Date(sumx / sumy) : new Date(l - step / 2),
            y: sumy / n
        });
    }
    return result;
}

export default router;
