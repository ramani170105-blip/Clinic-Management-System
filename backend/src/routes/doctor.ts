import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

router.use(authenticate);
router.use(requireRole(['DOCTOR']));

router.get('/appointments', async (req: any, res: Response): Promise<void> => {
  try {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: req.user.id } });
    if (!doctor) {
      res.status(404).json({ error: 'Doctor profile not found' });
      return;
    }

    const appointments = await prisma.appointment.findMany({
      where: { doctorId: doctor.id },
      include: { 
        patient: {
          include: { user: { select: { email: true } } }
        }, 
        preVisitForm: true, 
        postVisitNote: true 
      },
      orderBy: { startTime: 'asc' }
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/patients/:id', async (req: any, res: Response): Promise<void> => {
  try {
    const patientId = req.params.id as string;
    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      include: {
        appointments: {
          include: { preVisitForm: true, postVisitNote: true },
          orderBy: { startTime: 'desc' }
        }
      }
    });

    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

import { generatePostVisitSummary, generateClinicalNotes } from '../services/llm';
import { sendEmail } from '../services/email';

// Generate AI Clinical Notes & Prescription
router.post('/appointments/:id/generate-notes', async (req: any, res: Response): Promise<void> => {
  try {
    const appointmentId = req.params.id as string;
    const { doctorObservations } = req.body;

    const appointment: any = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: true, preVisitForm: true }
    });

    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    const generated = await generateClinicalNotes(
      appointment.patient.name,
      String(appointment.patient.age || 'Unknown'),
      appointment.patient.sex || 'Unknown',
      appointment.preVisitForm?.symptomsText || '',
      appointment.preVisitForm?.llmChiefComplaint || '',
      doctorObservations || ''
    );

    res.json(generated);
  } catch (error) {
    console.error('Error generating clinical notes:', error);
    res.status(500).json({ error: 'Failed to generate notes' });
  }
});

router.post('/appointments/:id/notes', async (req: Request, res: Response): Promise<void> => {
  try {
    const appointmentId = req.params.id as string;
    const { clinicalNotes, prescriptionDetails, frequencyHours } = req.body;

    const appointment: any = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { patient: { include: { user: true } }, doctor: true }
    });

    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }

    // Generate AI Summary
    const aiSummary = await generatePostVisitSummary(clinicalNotes + "\nPrescription: " + prescriptionDetails);
    
    // Create PostVisitNote
    const postNote = await prisma.postVisitNote.create({
      data: {
        appointmentId,
        clinicalNotes,
        prescriptionDetails,
        llmPatientSummary: aiSummary.patientSummary,
        llmFollowUpSteps: aiSummary.followUpSteps,
      }
    });

    // Update appointment status
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'COMPLETED' }
    });

    // Create Medication Reminders if prescription provided
    if (prescriptionDetails && frequencyHours) {
      const freq = parseInt(frequencyHours);
      if (freq > 0) {
        await prisma.medicationReminder.create({
          data: {
            patientId: appointment.patientId,
            medicationName: prescriptionDetails,
            frequencyHours: freq,
            nextReminderTime: new Date(Date.now() + freq * 3600000)
          }
        });
      }
    }

    // Send Post-Visit Email
    await sendEmail({
      to: appointment.patient.user.email || 'patient@example.com',
      subject: 'Your Post-Visit Summary & Prescription',
      html: `<h2>Visit Summary</h2>
             <p>Hi ${appointment.patient.name}, here is the summary of your visit with Dr. ${appointment.doctor.name}:</p>
             <p><b>Summary:</b> ${aiSummary.patientSummary}</p>
             <p><b>Medication Schedule:</b> ${aiSummary.medicationSchedule}</p>
             <p><b>Follow-up Steps:</b> ${aiSummary.followUpSteps}</p>
             <p>Take care!</p>`
    });

    res.json({ message: 'Notes submitted successfully', postNote });
  } catch (error) {
    console.error('Error submitting notes:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
