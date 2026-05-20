"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// ================= AUTHENTICATION =================
// Get active auth state
router.get('/api/auth/status', function (req, res) {
    var passwordConf = req.nconf.app.get('app');
    var passwordRequired = !!(passwordConf && passwordConf.hasOwnProperty('password'));
    res.status(200).json({
        passwordRequired: passwordRequired,
        loggedIn: !passwordRequired || !!req.session.loggedIn
    });
});
// Login action
router.post('/api/auth/login', function (req, res) {
    var passwordConf = req.nconf.app.get('app');
    if (passwordConf && passwordConf.hasOwnProperty('password')) {
        if (req.body.password === passwordConf.password) {
            req.session.loggedIn = true;
            res.status(200).json({ 'msg': 'Logged in successfully' });
        }
        else {
            res.status(400).json({ 'msg': 'Incorrect password' });
        }
    }
    else {
        res.status(200).json({ 'msg': 'No password is set' });
    }
});
// Logout action
router.post('/api/auth/logout', function (req, res) {
    req.session.loggedIn = null;
    res.status(200).json({ 'msg': 'Logged out successfully' });
});
// ================= LOCALIZATION =================
// Expose locale strings to the client
router.get('/api/locales', function (req, res) {
    const currentDir = __dirname;
    // locales path is in the parent of routes/api or src/routes/api depending on structure
    // Let's resolve robustly:
    let localesPath = path_1.default.join(currentDir, '../locales');
    if (!fs_1.default.existsSync(localesPath)) {
        localesPath = path_1.default.join(currentDir, '../../locales');
    }
    var locales = {};
    if (fs_1.default.existsSync(localesPath)) {
        var files = fs_1.default.readdirSync(localesPath);
        files.forEach(function (file) {
            if (file.endsWith('.js') || file.endsWith('.cjs')) {
                var localeName = file.replace('.js', '').replace('.cjs', '');
                try {
                    // Dynamically import/require locale file
                    var localeJson = require(path_1.default.join(localesPath, file));
                    locales[localeName] = localeJson;
                }
                catch (e) {
                    console.error('Error loading locale file: ' + file, e);
                }
            }
        });
    }
    res.status(200).json(locales);
});
exports.default = router;
