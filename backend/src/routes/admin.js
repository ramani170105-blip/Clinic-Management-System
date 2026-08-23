"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const auth_1 = require("../middleware/auth");
const index_1 = require("../index");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.requireRole)(['ADMIN']));
const email_1 = require("../services/email");
router.get('/doctors', async (req, res) => {
    try {
        const doctors = await index_1.prisma.doctorProfile.findMany({
            include: { user: { select: { email: true, empId: true } } },
        });
        res.json(doctors);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/doctors', async (req, res) => {
    try {
        const { name, specialisation, workingHoursStart, workingHoursEnd, slotDurationMins, email, password } = req.body;
        // Check if email already exists
        const existingUser = await index_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ error: 'A user with this email already exists' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // Create new doctor user and profile in a transaction
        const result = await index_1.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email,
                    role: 'DOCTOR',
                    passwordHash,
                    empId: `DOC${Math.floor(Math.random() * 100000)}`
                }
            });
            const profile = await tx.doctorProfile.create({
                data: {
                    userId: user.id,
                    name,
                    specialisation,
                    workingHoursStart,
                    workingHoursEnd,
                    slotDurationMins: parseInt(slotDurationMins)
                }
            });
            return { profile, user };
        });
        // Send email to the doctor with their credentials
        await (0, email_1.sendEmail)({
            to: email,
            subject: 'Welcome to Clinic System - Your Login Credentials',
            html: `<h2>Welcome Dr. ${name}!</h2>
             <p>Your account has been successfully created by the administrator.</p>
             <p>Here are your login credentials for the Doctor portal:</p>
             <ul>
               <li><b>Employee ID:</b> ${result.user.empId}</li>
               <li><b>Password:</b> ${password}</li>
             </ul>
             <p>Please log in to the portal using these credentials.</p>`
        });
        res.json({ doctor: result.profile, empId: result.user.empId });
    }
    catch (error) {
        console.error('Error creating doctor:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
router.post('/doctors/leave', async (req, res) => {
    const { doctorId, date } = req.body;
    try {
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0); // Normalize time to midnight
        const existingLeave = await index_1.prisma.doctorLeave.findFirst({
            where: {
                doctorId,
                date: targetDate
            }
        });
        if (existingLeave) {
            res.status(400).json({ error: 'Doctor is already marked on leave for this date.' });
            return;
        }
        const leave = await index_1.prisma.doctorLeave.create({
            data: {
                doctorId,
                date: targetDate,
            },
        });
        // Find and cancel all affected appointments
        const affectedAppointments = await index_1.prisma.appointment.findMany({
            where: {
                doctorId,
                status: 'BOOKED',
                startTime: {
                    gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                    lt: new Date(targetDate.setHours(23, 59, 59, 999))
                }
            },
            include: { patient: { include: { user: true } }, doctor: true }
        });
        for (const app of affectedAppointments) {
            await index_1.prisma.appointment.update({
                where: { id: app.id },
                data: { status: 'CANCELLED' }
            });
            // Notify patient
            await (0, email_1.sendEmail)({
                to: app.patient.user.email || 'patient@example.com',
                subject: 'Appointment Cancelled - Doctor on Leave',
                html: `<h2>Appointment Cancellation</h2>
               <p>Hi ${app.patient.name},</p>
               <p>Unfortunately, your appointment with Dr. ${app.doctor.name} on <b>${app.startTime.toLocaleString()}</b> has been cancelled because the doctor is on leave.</p>
               <p>Please log in to the portal to book a new slot.</p>`
            });
        }
        const doc = await index_1.prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } });
        if (doc?.user?.email) {
            await (0, email_1.sendEmail)({
                to: doc.user.email,
                subject: 'You have been marked on leave',
                html: `<h2>Leave Notification</h2>
               <p>Hi Dr. ${doc.name},</p>
               <p>The administrator has marked you on leave for <b>${targetDate.toLocaleDateString()}</b>.</p>
               <p>As a result, <b>${affectedAppointments.length}</b> of your scheduled appointments for this day have been automatically cancelled and the patients have been notified.</p>`
            });
        }
        res.json({ leave, cancelledCount: affectedAppointments.length });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
});
router.put('/doctors/:id', async (req, res) => {
    const doctorId = req.params.id;
    const { name, specialisation, workingHoursStart, workingHoursEnd, slotDurationMins } = req.body;
    try {
        const updatedDoctor = await index_1.prisma.doctorProfile.update({
            where: { id: doctorId },
            data: {
                ...(name && { name }),
                ...(specialisation && { specialisation }),
                ...(workingHoursStart && { workingHoursStart }),
                ...(workingHoursEnd && { workingHoursEnd }),
                ...(slotDurationMins && { slotDurationMins: parseInt(slotDurationMins) }),
            },
        });
        res.json(updatedDoctor);
    }
    catch (error) {
        console.error('Error updating doctor:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map