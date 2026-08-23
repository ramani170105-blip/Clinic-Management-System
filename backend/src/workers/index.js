"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWorkers = void 0;
const bullmq_1 = require("bullmq");
const email_1 = require("../services/email");
const index_1 = require("../index");
const email_2 = require("../services/email");
const node_cron_1 = __importDefault(require("node-cron"));
const startWorkers = () => {
    // 1. Email Worker
    const emailWorker = new bullmq_1.Worker('emailQueue', async (job) => {
        const { to, subject, text } = job.data;
        await (0, email_1.sendEmail)(to, subject, text);
    }, {
        connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
        },
    });
    emailWorker.on('completed', (job) => {
        console.log(`Email job ${job.id} completed successfully`);
    });
    emailWorker.on('failed', (job, err) => {
        console.error(`Email job ${job?.id} failed with ${err.message}`);
    });
    // 2. Cron Job for Medication Reminders
    // Runs every hour to check for due medication reminders
    node_cron_1.default.schedule('0 * * * *', async () => {
        console.log('Running medication reminder cron job...');
        try {
            const now = new Date();
            const dueReminders = await index_1.prisma.medicationReminder.findMany({
                where: {
                    active: true,
                    nextReminderTime: { lte: now },
                },
                include: { patient: { include: { user: true } } },
            });
            for (const reminder of dueReminders) {
                // Enqueue email
                await (0, email_2.enqueueEmail)(reminder.patient.user.email || '', 'Medication Reminder', `Hello ${reminder.patient.name}, it's time to take your medication: ${reminder.medicationName}.`);
                // Update next reminder time
                const nextTime = new Date(reminder.nextReminderTime);
                nextTime.setHours(nextTime.getHours() + reminder.frequencyHours);
                await index_1.prisma.medicationReminder.update({
                    where: { id: reminder.id },
                    data: { nextReminderTime: nextTime },
                });
            }
        }
        catch (error) {
            console.error('Error in medication reminder cron job:', error);
        }
    });
    console.log('Workers and cron jobs started.');
};
exports.startWorkers = startWorkers;
//# sourceMappingURL=index.js.map