"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const WebhookStore_1 = require("../services/WebhookStore");
const WebhookService_1 = require("../services/WebhookService");
const router = (0, express_1.Router)();
// Get configured webhook for connection
router.get('/api/:conn/webhooks', async function (req, res) {
    try {
        const config = await WebhookStore_1.webhookStore.getWebhook(req.params.conn);
        res.status(200).json(config || {
            connName: req.params.conn,
            url: '',
            email: '',
            slowQueries: 1,
            systemSpikes: 1,
            connectionFailures: 1,
            enableGrouping: 1,
            groupWindow: 5
        });
    }
    catch (err) {
        res.status(500).json({ msg: 'Error getting webhook: ' + (err.message || err) });
    }
});
// Save or update webhook config
router.post('/api/:conn/webhooks/save', async function (req, res) {
    const url = req.body.url || '';
    const email = req.body.email || '';
    const slowQueries = req.body.slowQueries ? 1 : 0;
    const systemSpikes = req.body.systemSpikes ? 1 : 0;
    const connectionFailures = req.body.connectionFailures ? 1 : 0;
    const smtpHost = req.body.smtpHost || '';
    const smtpPort = parseInt(req.body.smtpPort) || 587;
    const smtpSecure = req.body.smtpSecure ? 1 : 0;
    const smtpUser = req.body.smtpUser || '';
    const smtpPass = req.body.smtpPass || '';
    const smtpSender = req.body.smtpSender || '';
    const enableGrouping = req.body.enableGrouping ? 1 : 0;
    const groupWindow = parseInt(req.body.groupWindow) || 5;
    if (!url && !email) {
        return res.status(400).json({ msg: 'Either Webhook URL or Email Address is required' });
    }
    try {
        const config = await WebhookStore_1.webhookStore.saveWebhook(req.params.conn, url, slowQueries, systemSpikes, connectionFailures, email, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpSender, enableGrouping, groupWindow);
        res.status(200).json({ msg: 'Alert settings successfully saved!', config });
    }
    catch (err) {
        res.status(500).json({ msg: 'Error saving webhook: ' + (err.message || err) });
    }
});
// Trigger a mock SRE alert notification
router.post('/api/:conn/webhooks/test', async function (req, res) {
    try {
        const report = await WebhookService_1.webhookService.triggerTestWebhook(req.params.conn, req.body.url, req.body.email, req.body.smtpHost, req.body.smtpPort ? parseInt(req.body.smtpPort) : undefined, req.body.smtpSecure !== undefined ? (req.body.smtpSecure ? 1 : 0) : undefined, req.body.smtpUser, req.body.smtpPass, req.body.smtpSender);
        res.status(200).json({ msg: 'AI SRE mock incident notification sent successfully!', report });
    }
    catch (err) {
        res.status(500).json({ msg: 'Error triggering test webhook: ' + (err.message || err) });
    }
});
// Delete webhook config
router.post('/api/:conn/webhooks/delete', async function (req, res) {
    try {
        const deleted = await WebhookStore_1.webhookStore.deleteWebhook(req.params.conn);
        res.status(200).json({ msg: 'Webhook successfully disabled and deleted.', deleted });
    }
    catch (err) {
        res.status(500).json({ msg: 'Error deleting webhook: ' + (err.message || err) });
    }
});
exports.default = router;
