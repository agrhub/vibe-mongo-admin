import { mongoService } from '../services/MongoService';
import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;

const router = Router();

// ================= DB USERS =================

// Create user
router.post('/api/:conn/:db/user/create', function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var username = req.body.username;
    var user_password = req.body.user_password;
    var roles_str = req.body.roles || '';

    if (!username || !user_password) {
        return res.status(400).json({ 'msg': 'Missing username or password' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    var roles = roles_str ? roles_str.split(/\s*,\s*/) : [];

    mongo_db.command({ createUser: username, pwd: user_password, roles: roles })
        .then(function () {
            res.status(200).json({ 'msg': 'User successfully created' });
        })
        .catch(function (err: any) {
            console.error('Error creating user: ' + err);
            res.status(400).json({ 'msg': 'Error creating user' + ': ' + err });
        });
});

// Delete user
router.post('/api/:conn/:db/user/delete', function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var username = req.body.username;
    if (!username) {
        return res.status(400).json({ 'msg': 'Missing username' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    mongo_db.command({ dropUser: username })
        .then(function () {
            res.status(200).json({ 'msg': 'User successfully deleted' });
        })
        .catch(function (err: any) {
            console.error('Error deleting user: ' + err);
            res.status(400).json({ 'msg': 'Error deleting user' + ': ' + err });
        });
});

export default router;
