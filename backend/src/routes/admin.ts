import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

router.use(authenticate);
router.use(requireRole(['ADMIN']));

import { sendEmail } from '../services/email';

router.get('/doctors', async (req: Request, res: Response) => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      include: { user: { select: { email: true, empId: true } } },
    });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/doctors', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, specialisation, workingHoursStart, workingHoursEnd, slotDurationMins, email, password } = req.body;
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ error: 'A user with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create new doctor user and profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
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
    await sendEmail({
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
  } catch (error) {
    console.error('Error creating doctor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/doctors/leave', async (req: Request, res: Response): Promise<void> => {
  const { doctorId, date } = req.body;
  try {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0); // Normalize time to midnight

    const existingLeave = await prisma.doctorLeave.findFirst({
      where: {
        doctorId,
        date: targetDate
      }
    });

    if (existingLeave) {
      res.status(400).json({ error: 'Doctor is already marked on leave for this date.' });
      return;
    }
    
    const leave = await prisma.doctorLeave.create({
      data: {
        doctorId,
        date: targetDate,
      },
    });

    // Find and cancel all affected appointments
    const affectedAppointments = await prisma.appointment.findMany({
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
      await prisma.appointment.update({
        where: { id: app.id },
        data: { status: 'CANCELLED' }
      });

      // Notify patient
      await sendEmail({
        to: app.patient.user.email || 'patient@example.com',
        subject: 'Appointment Cancelled - Doctor on Leave',
        html: `<h2>Appointment Cancellation</h2>
               <p>Hi ${app.patient.name},</p>
               <p>Unfortunately, your appointment with Dr. ${app.doctor.name} on <b>${app.startTime.toLocaleString()}</b> has been cancelled because the doctor is on leave.</p>
               <p>Please log in to the portal to book a new slot.</p>`
      });
    }

    const doc = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } });
    if (doc?.user?.email) {
      await sendEmail({
        to: doc.user.email,
        subject: 'You have been marked on leave',
        html: `<h2>Leave Notification</h2>
               <p>Hi Dr. ${doc.name},</p>
               <p>The administrator has marked you on leave for <b>${targetDate.toLocaleDateString()}</b>.</p>
               <p>As a result, <b>${affectedAppointments.length}</b> of your scheduled appointments for this day have been automatically cancelled and the patients have been notified.</p>`
      });
    }

    res.json({ leave, cancelledCount: affectedAppointments.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});
router.put('/doctors/:id', async (req: Request, res: Response): Promise<void> => {
  const doctorId = req.params.id as string;
  const { name, specialisation, workingHoursStart, workingHoursEnd, slotDurationMins } = req.body;
  
  try {
    const updatedDoctor = await prisma.doctorProfile.update({
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
  } catch (error) {
    console.error('Error updating doctor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
