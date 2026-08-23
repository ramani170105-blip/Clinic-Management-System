"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookAppointment = exports.holdSlot = void 0;
const index_1 = require("../index");
// In-memory store for slot holds instead of Redis (since local docker might not be available)
// Key: `${doctorId}_${startTime.toISOString()}`, Value: { patientId, expiresAt }
const slotHolds = new Map();
const holdSlot = async (doctorId, patientId, startTime, durationMins) => {
    const key = `${doctorId}_${startTime.toISOString()}`;
    const now = Date.now();
    // Clean up expired holds
    for (const [k, v] of slotHolds.entries()) {
        if (v.expiresAt < now) {
            slotHolds.delete(k);
        }
    }
    // Check if someone else holds it
    const existingHold = slotHolds.get(key);
    if (existingHold && existingHold.expiresAt > now && existingHold.patientId !== patientId) {
        throw new Error('Slot is currently being held by another patient');
    }
    // Hold for 5 minutes
    slotHolds.set(key, { patientId, expiresAt: now + 5 * 60 * 1000 });
    return true;
};
exports.holdSlot = holdSlot;
const bookAppointment = async (patientId, doctorId, startTime, endTime, symptomsText) => {
    const key = `${doctorId}_${startTime.toISOString()}`;
    const existingHold = slotHolds.get(key);
    if (existingHold && existingHold.patientId !== patientId && existingHold.expiresAt > Date.now()) {
        throw new Error('Slot is currently being held by another patient');
    }
    // Use a transaction to prevent double booking
    return await index_1.prisma.$transaction(async (tx) => {
        // 1. Check if doctor is on leave
        const leave = await tx.doctorLeave.findFirst({
            where: {
                doctorId,
                date: {
                    gte: new Date(startTime.setHours(0, 0, 0, 0)),
                    lte: new Date(startTime.setHours(23, 59, 59, 999)),
                },
            },
        });
        if (leave) {
            throw new Error('Doctor is on leave on this date');
        }
        // 2. Check for overlapping appointments
        const overlapping = await tx.appointment.findFirst({
            where: {
                doctorId,
                status: 'BOOKED',
                OR: [
                    {
                        startTime: { lt: endTime },
                        endTime: { gt: startTime },
                    },
                ],
            },
        });
        if (overlapping) {
            throw new Error('This time slot is already booked');
        }
        // 3. Create appointment
        const appointment = await tx.appointment.create({
            data: {
                patientId,
                doctorId,
                startTime,
                endTime,
                status: 'BOOKED',
                preVisitForm: {
                    create: {
                        symptomsText,
                    },
                },
            },
            include: {
                preVisitForm: true,
                patient: { include: { user: true } },
                doctor: { include: { user: true } }
            }
        });
        // Remove the hold
        slotHolds.delete(key);
        return appointment;
    });
};
exports.bookAppointment = bookAppointment;
//# sourceMappingURL=booking.js.map