"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/google-calendar/callback', (req, res) => {
    res.send('Callback received');
});
exports.default = router;
//# sourceMappingURL=webhook.js.map