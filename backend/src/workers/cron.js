"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCronJobs = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const index_1 = require("../index");
const email_1 = require("../services/email");
const startCronJobs = () => {
    console.log('⏳ Starting Cron Jobs...');
    // Run every 5 minutes to check for pending medication reminders
    node_cron_1.default.schedule('*/5 * * * *', async () => {
        try {
            const now = new Date();
            const reminders = await index_1.prisma.medicationReminder.findMany({
                where: {
                    active: true,
                    nextReminderTime: {
                        lte: now
                    }
                },
                include: {
                    patient: { include: { user: true } }
                }
            });
            if (reminders.length > 0) {
                console.log(`💊 Processing ${reminders.length} medication reminders...`);
            }
            for (const reminder of reminders) {
                // Send email
                await (0, email_1.sendEmail)({
                    to: reminder.patient.user.email || 'patient@example.com',
                    subject: `Medication Reminder: ${reminder.medicationName}`,
                    html: `<h2>Time for your medication!</h2>
                 <p>Hi ${reminder.patient.name},</p>
                 <p>This is a friendly reminder to take your medication: <b>${reminder.medicationName}</b>.</p>
                 <p>Stay healthy!</p>`
                });
                // Update next reminder time
                const nextTime = new Date(now.getTime() + reminder.frequencyHours * 3600000);
                await index_1.prisma.medicationReminder.update({
                    where: { id: reminder.id },
                    data: { nextReminderTime: nextTime }
                });
            }
        }
        catch (error) {
            console.error('Error processing cron job for reminders:', error);
        }
    });
    // Run every hour to check for appointments 24 hours from now
    node_cron_1.default.schedule('0 * * * *', async () => {
        try {
            const now = new Date();
            const tomorrow = new Date(now.getTime() + 24 * 3600000);
            const tomorrowNextHour = new Date(tomorrow.getTime() + 3600000);
            const upcomingAppointments = await index_1.prisma.appointment.findMany({
                where: {
                    status: 'BOOKED',
                    startTime: {
                        gte: tomorrow,
                        lt: tomorrowNextHour
                    }
                },
                include: {
                    patient: { include: { user: true } },
                    doctor: { include: { user: true } }
                }
            });
            if (upcomingAppointments.length > 0) {
                console.log(`📅 Sending ${upcomingAppointments.length} appointment reminders...`);
            }
            for (const app of upcomingAppointments) {
                // Notify patient
                if (app.patient.user.email) {
                    await (0, email_1.sendEmail)({
                        to: app.patient.user.email,
                        subject: 'Reminder: Upcoming Appointment Tomorrow',
                        html: `<h2>Appointment Reminder</h2>
                   <p>Hi ${app.patient.name},</p>
                   <p>This is a reminder that you have an appointment with Dr. ${app.doctor.name} tomorrow at <b>${app.startTime.toLocaleString()}</b>.</p>
                   <p>Please log in to the portal if you need to review your pre-visit information.</p>`
                    });
                }
                // Notify doctor
                if (app.doctor.user.email) {
                    await (0, email_1.sendEmail)({
                        to: app.doctor.user.email,
                        subject: 'Reminder: Upcoming Appointment Tomorrow',
                        html: `<h2>Appointment Reminder</h2>
                   <p>Hi Dr. ${app.doctor.name},</p>
                   <p>You have an appointment with <b>${app.patient.name}</b> tomorrow at <b>${app.startTime.toLocaleString()}</b>.</p>`
                    });
                }
            }
        }
        catch (error) {
            console.error('Error processing cron job for appointment reminders:', error);
        }
    });
};
exports.startCronJobs = startCronJobs;
//# sourceMappingURL=cron.js.map