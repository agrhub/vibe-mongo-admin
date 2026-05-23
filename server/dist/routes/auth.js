"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
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
exports.default = router;
