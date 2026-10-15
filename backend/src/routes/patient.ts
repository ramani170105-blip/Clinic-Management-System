import { Router, Request, Response } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { prisma } from "../index";
import { generatePreVisitSummary } from "../services/llm";
import { generateIcsContent } from "../services/calendar";
import { sendEmail } from "../services/email";

const router = Router();

router.get("/doctors", async (req: Request, res: Response) => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      include: { user: { select: { email: true, empId: true } } },
    });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/doctors/:id/slots", async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = req.params.id as string;
    const dateStr = req.query.date as string; // YYYY-MM-DD
    
    if (!dateStr) {
      res.status(400).json({ error: "Date is required" });
      return;
    }

    const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const parts = dateStr.split("-").map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const m = parts[1] ?? (new Date().getMonth() + 1);
    const d = parts[2] ?? new Date().getDate();
    const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);
    
    // Check leave
    const leave = await prisma.doctorLeave.findFirst({
      where: {
        doctorId: doctor.id,
        date: {
          gte: dayStart,
          lt: dayEnd
        }
      }
    });

    if (leave) {
      res.json([]); // No slots if on leave
      return;
    }

    // Find all booked appointments for that day
    const appointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: { in: ["BOOKED", "COMPLETED"] },
        startTime: {
          gte: dayStart,
          lt: dayEnd
        }
      }
    });

    // Generate all slots based on working hours
    const slots: string[] = [];
    const startParts = (doctor.workingHoursStart || "09:00").split(":").map(Number);
    const endParts = (doctor.workingHoursEnd || "17:00").split(":").map(Number);
    const startH = startParts[0] || 0;
    const startM = startParts[1] || 0;
    const endH = endParts[0] || 0;
    const endM = endParts[1] || 0;
    
    let current = new Date(y, m - 1, d, startH, startM, 0, 0);
    const endTime = new Date(y, m - 1, d, endH, endM, 0, 0);
    const slotDurationMins = doctor.slotDurationMins || 30;
    
    while (current < endTime) {
      const slotEnd = new Date(current.getTime() + slotDurationMins * 60000);
      if (slotEnd > endTime) break;

      // Check overlap
      const isBooked = appointments.some(app => 
        (new Date(app.startTime) < slotEnd && new Date(app.endTime) > current)
      );

      if (!isBooked && current > new Date()) { // Don't return past slots
        slots.push(current.toISOString());
      }
      current = slotEnd;
    }

    res.json(slots);
  } catch (error) {
    console.error("Error fetching slots:", error);
    res.status(500).json({ error: "Server error" });
  }
});

router.use(authenticate);
router.use(requireRole(["PATIENT"]));

router.get("/profile", async (req: any, res: Response): Promise<void> => {
  try {
    const patient = await prisma.patientProfile.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { email: true } } }
    });
    if (!patient) {
      res.status(404).json({ error: "Patient profile not found" });
      return;
    }
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/appointments", async (req: any, res: Response) => {
  try {
    const patient = await prisma.patientProfile.findUnique({ where: { userId: req.user.id } });
    if (!patient) return res.status(404).json({ error: "Patient profile not found" });

    const appointments = await prisma.appointment.findMany({
      where: { patientId: patient.id },
      include: { doctor: true, preVisitForm: true, postVisitNote: true },
      orderBy: { startTime: "desc" }
    });
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/query", async (req: any, res: Response): Promise<void> => {
  try {
    const { name, age, sex, phone, email, symptoms, doctorId, startTime } = req.body;

    if (!doctorId || !startTime) {
      res.status(400).json({ error: "Missing doctorId or startTime for booking" });
      return;
    }
    
    let patient = await prisma.patientProfile.findUnique({ where: { userId: req.user.id }, include: { user: true } });
    if (!patient) {
      res.status(404).json({ error: "Patient profile not found" });
      return;
    }

    // Update patient email on User if provided
    if (email && typeof email === 'string' && (!patient.user.email || patient.user.email !== email.trim().toLowerCase())) {
      const cleanEmail = email.trim().toLowerCase();
      try {
        const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
        if (!existing || existing.id === patient.userId) {
          await prisma.user.update({
            where: { id: patient.userId },
            data: { email: cleanEmail }
          });
          patient.user.email = cleanEmail;
        }
      } catch (e) {
        console.warn('Could not update patient email:', e);
      }
    }

    // Update patient profile details if provided
    patient = await prisma.patientProfile.update({
      where: { id: patient.id },
      data: {
        name: name || patient.name,
        age: age ? parseInt(age) : patient.age,
        sex: sex || patient.sex,
        phone: phone || patient.phone,
      },
      include: { user: true }
    });

    const doctor = await prisma.doctorProfile.findUnique({ 
      where: { id: doctorId },
      include: { user: true }
    });
    if (!doctor) {
      res.status(404).json({ error: "Doctor not found" });
      return;
    }

    const start = new Date(startTime);
    const slotDurationMins = doctor.slotDurationMins || 30;
    const end = new Date(start.getTime() + slotDurationMins * 60000);

    const dayStart = new Date(start.getTime());
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start.getTime());
    dayEnd.setHours(23, 59, 59, 999);

    // Generate AI Summary before confirming booking
    const aiSummary = await generatePreVisitSummary(symptoms);
    const parsedSummary = typeof aiSummary === "string" ? JSON.parse(aiSummary) : aiSummary;

    // 1. Check if doctor is on leave
    const leave = await prisma.doctorLeave.findFirst({
      where: {
        doctorId: doctor.id,
        date: {
          gte: dayStart,
          lt: dayEnd
        }
      }
    });
    if (leave) {
      res.status(409).json({ error: "Doctor is on leave on this date" });
      return;
    }

    // 2. Check for overlapping appointments for the doctor
    const overlapping = await prisma.appointment.findFirst({
      where: {
        doctorId: doctor.id,
        status: { in: ["BOOKED", "COMPLETED"] },
        OR: [
          { startTime: { lt: end }, endTime: { gt: start } }
        ]
      }
    });
    if (overlapping) {
      res.status(409).json({ error: "Time slot is no longer available" });
      return;
    }

    // 2.5. Check if the patient already has an overlapping appointment with ANY doctor
    const patientDoubleBooked = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        status: { in: ["BOOKED", "COMPLETED"] },
        OR: [
          { startTime: { lt: end }, endTime: { gt: start } }
        ]
      }
    });
    if (patientDoubleBooked) {
      res.status(409).json({ error: "You already have another appointment booked at this time" });
      return;
    }

    // 3. Create Appointment & PreVisitForm
    const appointment = await prisma.appointment.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        startTime: start,
        endTime: end,
        status: "BOOKED",
        preVisitForm: {
          create: {
            symptomsText: symptoms,
            llmUrgencyLevel: parsedSummary.urgencyLevel || null,
            llmChiefComplaint: parsedSummary.chiefComplaint || null,
            llmSuggestedQuestions: Array.isArray(parsedSummary.suggestedQuestions) 
              ? parsedSummary.suggestedQuestions.join(" | ") 
              : (parsedSummary.suggestedQuestions || null)
          }
        }
      },
      include: { preVisitForm: true, doctor: true, patient: true }
    });

    // Send confirmation email asynchronously (non-blocking)
    const icsContent = generateIcsContent({
      title: `Medical Appointment with Dr. ${doctor.name}`,
      description: `Appointment for ${patient.name}. Symptoms: ${symptoms}`,
      start: start,
      end: end,
      organizer: { name: `Dr. ${doctor.name}`, email: doctor.user?.email || "no-reply@clinic.com" },
      attendees: [{ name: patient.name, email: patient.user?.email || "patient@example.com" }]
    });

    const patientEmailRecipient = patient.user?.email || (email && typeof email === 'string' ? email.trim().toLowerCase() : null);

    if (patientEmailRecipient) {
      const formattedDate = start.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
      sendEmail({
        to: patientEmailRecipient,
        subject: "Appointment Booking Confirmation - Clinic System",
        html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
                 <h2 style="color: #059669;">Appointment Confirmed!</h2>
                 <p>Dear ${patient.name},</p>
                 <p>Your medical appointment with <b>Dr. ${doctor.name} (${doctor.specialisation})</b> has been successfully booked.</p>
                 <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 18px; margin: 16px 0; border-radius: 6px;">
                   <p style="margin: 0 0 8px 0;"><b>Doctor:</b> Dr. ${doctor.name} (${doctor.specialisation})</p>
                   <p style="margin: 0 0 8px 0;"><b>Date & Time:</b> ${formattedDate}</p>
                   <p style="margin: 0;"><b>Symptoms Reported:</b> ${symptoms}</p>
                 </div>
                 <p>A calendar invitation (<code>appointment.ics</code>) is attached to this email. You can open it to automatically add the appointment to Google Calendar, Apple Calendar, or Outlook.</p>
                 <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">Warm regards,<br/>Clinic Care Team</p>
               </div>`,
        attachments: icsContent ? [{
          filename: "appointment.ics",
          content: icsContent,
          contentType: "text/calendar"
        }] : []
      }).catch(e => console.error("Patient confirmation email error:", e));
    }

    if (doctor.user?.email) {
      const formattedDate = start.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
      sendEmail({
        to: doctor.user.email,
        subject: "New Patient Appointment Booked - " + patient.name,
        html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
                 <h2 style="color: #0284c7;">New Patient Appointment</h2>
                 <p>Dear Dr. ${doctor.name},</p>
                 <p>A new appointment has been scheduled with you:</p>
                 <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; margin: 16px 0; border-radius: 6px;">
                   <p style="margin: 0 0 8px 0;"><b>Patient Name:</b> ${patient.name}</p>
                   <p style="margin: 0 0 8px 0;"><b>Date & Time:</b> ${formattedDate}</p>
                   <p style="margin: 0 0 8px 0;"><b>Phone:</b> ${patient.phone || 'N/A'}</p>
                   <p style="margin: 0 0 8px 0;"><b>Urgency Level:</b> ${parsedSummary.urgencyLevel || 'Medium'}</p>
                   <p style="margin: 0;"><b>Patient Symptoms:</b> ${symptoms}</p>
                 </div>
                 <p>A calendar invite is attached for your schedule.</p>
                 <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">Best regards,<br/>Clinic Management System</p>
               </div>`,
        attachments: icsContent ? [{
          filename: "appointment.ics",
          content: icsContent,
          contentType: "text/calendar"
        }] : []
      }).catch(e => console.error("Doctor notification email error:", e));
    }

    res.status(201).json({ message: "Query submitted successfully", appointment });
  } catch (error: any) {
    console.error("Error submitting query:", error);
    if (
      error.message === "Time slot is no longer available" || 
      error.message === "Doctor is on leave on this date" ||
      error.message === "You already have another appointment booked at this time"
    ) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Server error" });
    }
  }
});

export default router;
