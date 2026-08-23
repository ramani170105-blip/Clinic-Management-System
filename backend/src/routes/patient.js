"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const index_1 = require("../index");
const router = (0, express_1.Router)();
router.get('/doctors', async (req, res) => {
    try {
        const doctors = await index_1.prisma.doctorProfile.findMany({
            include: { user: { select: { email: true } } },
        });
        res.json(doctors);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
router.get('/doctors/:id/slots', async (req, res) => {
    try {
        const doctorId = req.params.id;
        const dateStr = req.query.date; // YYYY-MM-DD
        if (!dateStr) {
            res.status(400).json({ error: 'Date is required' });
            return;
        }
        const doctor = await index_1.prisma.doctorProfile.findUnique({ where: { id: doctorId } });
        if (!doctor) {
            res.status(404).json({ error: 'Doctor not found' });
            return;
        }
        const targetDate = new Date(dateStr);
        // Check leave
        const leave = await index_1.prisma.doctorLeave.findFirst({
            where: {
                doctorId: doctor.id,
                date: {
                    gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                    lt: new Date(targetDate.setHours(23, 59, 59, 999))
                }
            }
        });
        if (leave) {
            res.json([]); // No slots if on leave
            return;
        }
        // Find all booked appointments for that day
        const appointments = await index_1.prisma.appointment.findMany({
            where: {
                doctorId: doctor.id,
                status: { in: ['BOOKED', 'COMPLETED'] },
                startTime: {
                    gte: new Date(targetDate.setHours(0, 0, 0, 0)),
                    lt: new Date(targetDate.setHours(23, 59, 59, 999))
                }
            }
        });
        // Generate all slots based on working hours
        const slots = [];
        const startParts = doctor.workingHoursStart.split(':').map(Number);
        const endParts = doctor.workingHoursEnd.split(':').map(Number);
        const startH = startParts[0] || 0;
        const startM = startParts[1] || 0;
        const endH = endParts[0] || 0;
        const endM = endParts[1] || 0;
        let current = new Date(targetDate.setHours(startH, startM, 0, 0));
        const endTime = new Date(targetDate.setHours(endH, endM, 0, 0));
        while (current < endTime) {
            const slotEnd = new Date(current.getTime() + doctor.slotDurationMins * 60000);
            if (slotEnd > endTime)
                break;
            // Check overlap
            const isBooked = appointments.some(app => (app.startTime < slotEnd && app.endTime > current));
            if (!isBooked && current > new Date()) { // Don't return past slots
                slots.push(current.toISOString());
            }
            current = slotEnd;
        }
        res.json(slots);
    }
    catch (error) {
        console.error('Error fetching slots:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
router.use(auth_1.authenticate);
router.use((0, auth_1.requireRole)(['PATIENT']));
router.get('/appointments', async (req, res) => {
    try {
        const patient = await index_1.prisma.patientProfile.findUnique({ where: { userId: req.user.id } });
        if (!patient)
            return res.status(404).json({ error: 'Patient profile not found' });
        const appointments = await index_1.prisma.appointment.findMany({
            where: { patientId: patient.id },
            include: { doctor: true, preVisitForm: true, postVisitNote: true },
        });
        res.json(appointments);
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});
const llm_1 = require("../services/llm");
const calendar_1 = require("../services/calendar");
const email_1 = require("../services/email");
router.post('/query', async (req, res) => {
    try {
        const { name, age, sex, phone, symptoms, doctorId, startTime } = req.body;
        if (!doctorId || !startTime) {
            res.status(400).json({ error: 'Missing doctorId or startTime for booking' });
            return;
        }
        let patient = await index_1.prisma.patientProfile.findUnique({ where: { userId: req.user.id }, include: { user: true } });
        if (!patient) {
            res.status(404).json({ error: 'Patient profile not found' });
            return;
        }
        // Update patient profile
        patient = await index_1.prisma.patientProfile.update({
            where: { id: patient.id },
            data: {
                name: name || patient.name,
                age: age ? parseInt(age) : patient.age,
                sex: sex || patient.sex,
                phone: phone || patient.phone,
            },
            include: { user: true }
        });
        const doctor = await index_1.prisma.doctorProfile.findUnique({
            where: { id: doctorId },
            include: { user: true }
        });
        if (!doctor) {
            res.status(404).json({ error: 'Doctor not found' });
            return;
        }
        const start = new Date(startTime);
        const end = new Date(start.getTime() + doctor.slotDurationMins * 60000);
        // Generate AI Summary before confirming booking (this takes a few seconds)
        const aiSummary = await (0, llm_1.generatePreVisitSummary)(symptoms);
        const parsedSummary = typeof aiSummary === 'string' ? JSON.parse(aiSummary) : aiSummary;
        // Concurrency / Double Booking check using Prisma transaction
        const appointment = await index_1.prisma.$transaction(async (tx) => {
            // 1. Check if doctor is on leave
            const leave = await tx.doctorLeave.findFirst({
                where: {
                    doctorId: doctor.id,
                    date: {
                        gte: new Date(start.setHours(0, 0, 0, 0)),
                        lt: new Date(start.setHours(23, 59, 59, 999))
                    }
                }
            });
            if (leave)
                throw new Error('Doctor is on leave on this date');
            // 2. Check for overlapping appointments for the doctor
            const overlapping = await tx.appointment.findFirst({
                where: {
                    doctorId: doctor.id,
                    status: { in: ['BOOKED', 'COMPLETED'] },
                    OR: [
                        { startTime: { lt: end }, endTime: { gt: start } }
                    ]
                }
            });
            if (overlapping)
                throw new Error('Time slot is no longer available');
            // 2.5. Check if the patient already has an overlapping appointment with ANY doctor
            const patientDoubleBooked = await tx.appointment.findFirst({
                where: {
                    patientId: patient.id,
                    status: { in: ['BOOKED', 'COMPLETED'] },
                    OR: [
                        { startTime: { lt: end }, endTime: { gt: start } }
                    ]
                }
            });
            if (patientDoubleBooked)
                throw new Error('You already have another appointment booked at this time');
            // 3. Create Appointment & PreVisitForm
            return await tx.appointment.create({
                data: {
                    patientId: patient.id, // ! used safely here
                    doctorId: doctor.id,
                    startTime: start,
                    endTime: end,
                    status: 'BOOKED',
                    preVisitForm: {
                        create: {
                            symptomsText: symptoms,
                            llmUrgencyLevel: parsedSummary.urgencyLevel || null,
                            llmChiefComplaint: parsedSummary.chiefComplaint || null,
                            llmSuggestedQuestions: Array.isArray(parsedSummary.suggestedQuestions)
                                ? parsedSummary.suggestedQuestions.join(' | ')
                                : (parsedSummary.suggestedQuestions || null)
                        }
                    }
                },
                include: { preVisitForm: true, doctor: true, patient: true }
            });
        });
        // Send confirmation email asynchronously
        const icsContent = (0, calendar_1.generateIcsContent)({
            title: `Medical Appointment with Dr. ${doctor.name}`,
            description: `Appointment for ${patient.name}. Symptoms: ${symptoms}`,
            start: start,
            end: end,
            organizer: { name: `Dr. ${doctor.name}`, email: doctor.user.email || 'no-reply@clinic.com' },
            attendees: [{ name: patient.name, email: patient.user.email || 'patient@example.com' }]
        });
        await (0, email_1.sendEmail)({
            to: patient.user.email || 'patient@example.com',
            subject: 'Appointment Booking Confirmation',
            html: `<h2>Appointment Confirmed!</h2>
             <p>Hi ${patient.name},</p>
             <p>Your appointment with Dr. ${doctor.name} is booked for <b>${start.toLocaleString()}</b>.</p>`,
            attachments: icsContent ? [{
                    filename: 'appointment.ics',
                    content: icsContent,
                    contentType: 'text/calendar'
                }] : []
        });
        if (doctor.user.email) {
            await (0, email_1.sendEmail)({
                to: doctor.user.email,
                subject: 'New Appointment Booked',
                html: `<h2>New Appointment!</h2>
               <p>Hi Dr. ${doctor.name},</p>
               <p>A new appointment has been booked by <b>${patient.name}</b> for <b>${start.toLocaleString()}</b>.</p>
               <p><b>Patient Symptoms:</b> ${symptoms}</p>`,
                attachments: icsContent ? [{
                        filename: 'appointment.ics',
                        content: icsContent,
                        contentType: 'text/calendar'
                    }] : []
            });
        }
        res.json({ message: 'Query submitted successfully', appointment });
    }
    catch (error) {
        console.error('Error submitting query:', error);
        if (error.message === 'Time slot is no longer available' ||
            error.message === 'Doctor is on leave on this date' ||
            error.message === 'You already have another appointment booked at this time') {
            res.status(409).json({ error: error.message });
        }
        else {
            res.status(500).json({ error: 'Server error' });
        }
    }
});
exports.default = router;
//# sourceMappingURL=patient.js.map