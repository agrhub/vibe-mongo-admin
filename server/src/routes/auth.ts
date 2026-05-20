import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import path from 'path';
import fs from 'fs';


const router = Router();

// ================= AUTHENTICATION =================

// Get active auth state
router.get('/api/auth/status', function (req: Request, res: Response) {
    var passwordConf = req.nconf.app.get('app');
    var passwordRequired = !!(passwordConf && passwordConf.hasOwnProperty('password'));
    res.status(200).json({
        passwordRequired: passwordRequired,
        loggedIn: !passwordRequired || !!req.session.loggedIn
    });
});

// Login action
router.post('/api/auth/login', function (req: Request, res: Response) {
    var passwordConf = req.nconf.app.get('app');
    if (passwordConf && passwordConf.hasOwnProperty('password')) {
        if (req.body.password === passwordConf.password) {
            req.session.loggedIn = true;
            res.status(200).json({ 'msg': 'Logged in successfully' });
        } else {
            res.status(400).json({ 'msg': 'Incorrect password' });
        }
    } else {
        res.status(200).json({ 'msg': 'No password is set' });
    }
});

// Logout action
router.post('/api/auth/logout', function (req: Request, res: Response) {
    req.session.loggedIn = null;
    res.status(200).json({ 'msg': 'Logged out successfully' });
});

// ================= LOCALIZATION =================

// Expose locale strings to the client
router.get('/api/locales', function (req: Request, res: Response) {
    const currentDir = __dirname;

    // locales path is in the parent of routes/api or src/routes/api depending on structure
    // Let's resolve robustly:
    let localesPath = path.join(currentDir, '../locales');
    if (!fs.existsSync(localesPath)) {
        localesPath = path.join(currentDir, '../../locales');
    }

    var locales: any = {};
    if (fs.existsSync(localesPath)) {
        var files = fs.readdirSync(localesPath);
        files.forEach(function (file) {
            if (file.endsWith('.js') || file.endsWith('.cjs')) {
                var localeName = file.replace('.js', '').replace('.cjs', '');
                try {
                    // Dynamically import/require locale file
                    var localeJson = require(path.join(localesPath, file));
                    locales[localeName] = localeJson;
                } catch (e) {
                    console.error('Error loading locale file: ' + file, e);
                }
            }
        });
    }
    res.status(200).json(locales);
});

export default router;
