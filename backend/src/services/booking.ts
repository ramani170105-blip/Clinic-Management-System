import { prisma } from '../index';
import { v4 as uuidv4 } from 'uuid';

// In-memory store for slot holds instead of Redis (since local docker might not be available)
// Key: `${doctorId}_${startTime.toISOString()}`, Value: { patientId, expiresAt }
const slotHolds = new Map<string, { patientId: string; expiresAt: number }>();

export const holdSlot = async (doctorId: string, patientId: string, startTime: Date, durationMins: number) => {
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

export const bookAppointment = async (
  patientId: string,
  doctorId: string,
  startTime: Date,
  endTime: Date,
  symptomsText: string
) => {
  const key = `${doctorId}_${startTime.toISOString()}`;
  const existingHold = slotHolds.get(key);
  
  if (existingHold && existingHold.patientId !== patientId && existingHold.expiresAt > Date.now()) {
    throw new Error('Slot is currently being held by another patient');
  }

  // Use a transaction to prevent double booking
  return await prisma.$transaction(async (tx) => {
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
