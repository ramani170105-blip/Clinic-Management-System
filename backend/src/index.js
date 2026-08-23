"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const auth_1 = __importDefault(require("./routes/auth"));
const doctor_1 = __importDefault(require("./routes/doctor"));
const patient_1 = __importDefault(require("./routes/patient"));
const admin_1 = __importDefault(require("./routes/admin"));
const webhook_1 = __importDefault(require("./routes/webhook"));
exports.prisma = new client_1.PrismaClient();
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/doctor', doctor_1.default);
app.use('/api/patient', patient_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/webhook', webhook_1.default); // e.g. for Google Calendar
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});
const cron_1 = require("./workers/cron");
(0, cron_1.startCronJobs)();
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
//# sourceMappingURL=index.js.map