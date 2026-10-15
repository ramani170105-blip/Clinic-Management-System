import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { authenticate, requireRole } from "../middleware/auth";
import { prisma } from "../index";
import { sendEmail } from "../services/email";

const router = Router();

router.use(authenticate);
router.use(requireRole(["ADMIN"]));

router.get("/doctors", async (req: Request, res: Response) => {
  try {
    const doctors = await prisma.doctorProfile.findMany({
      include: { user: { select: { email: true, empId: true } } },
    });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: (error as any)?.message || "Server error" });
  }
});

router.post("/doctors", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, specialisation, workingHoursStart, workingHoursEnd, slotDurationMins, email, password } = req.body;
    
    const trimmedEmail = email ? email.trim().toLowerCase() : "";
    const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } });
    if (existingUser) {
      res.status(400).json({ error: "A user with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: trimmedEmail,
          role: "DOCTOR",
          passwordHash,
          empId: `DOC${Math.floor(10000 + Math.random() * 90000)}`
        }
      });

      const profile = await tx.doctorProfile.create({
        data: {
          userId: user.id,
          name: name ? name.trim() : "Doctor",
          specialisation: specialisation || "General",
          workingHoursStart: workingHoursStart || "09:00",
          workingHoursEnd: workingHoursEnd || "17:00",
          slotDurationMins: parseInt(slotDurationMins) || 30
        }
      });
      return { profile, user };
    });

    sendEmail({
      to: trimmedEmail,
      subject: "Welcome to Clinic System - Your Login Credentials",
      html: `<h2>Welcome Dr. ${name}!</h2>
             <p>Your account has been successfully created by the administrator.</p>
             <p>Here are your login credentials for the Doctor portal:</p>
             <ul>
               <li><b>Employee ID:</b> ${result.user.empId}</li>
               <li><b>Password:</b> ${password}</li>
             </ul>
             <p>Please log in to the portal using these credentials.</p>`
    }).catch(e => console.error("Doctor email error:", e));

    res.json({ doctor: result.profile, empId: result.user.empId });
  } catch (error) {
    console.error("Error creating doctor:", error);
    res.status(500).json({ error: (error as any)?.message || "Server error" });
  }
});

router.post("/doctors/leave", async (req: Request, res: Response): Promise<void> => {
  const { doctorId, date } = req.body;
  try {
    const parts = date.split("-").map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const m = parts[1] ?? (new Date().getMonth() + 1);
    const d = parts[2] ?? new Date().getDate();
    const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    const dayEnd = new Date(y, m - 1, d, 23, 59, 59, 999);

    const existingLeave = await prisma.doctorLeave.findFirst({
      where: {
        doctorId,
        date: dayStart
      }
    });

    if (existingLeave) {
      res.status(400).json({ error: "Doctor is already marked on leave for this date." });
      return;
    }
    
    const leave = await prisma.doctorLeave.create({
      data: {
        doctorId,
        date: dayStart,
      },
    });

    const affectedAppointments = await prisma.appointment.findMany({
      where: {
        doctorId,
        status: "BOOKED",
        startTime: {
          gte: dayStart,
          lt: dayEnd
        }
      },
      include: { patient: { include: { user: true } }, doctor: true }
    });

    for (const app of affectedAppointments) {
      await prisma.appointment.update({
        where: { id: app.id },
        data: { status: "CANCELLED" }
      });

      if (app.patient.user?.email) {
        sendEmail({
          to: app.patient.user.email,
          subject: "Appointment Rescheduling Required - Doctor on Leave",
          html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
                   <h2 style="color: #d9534f;">Appointment Cancelled</h2>
                   <p>Dear ${app.patient.name},</p>
                   <p>We regret to inform you that your upcoming appointment with <b>Dr. ${app.doctor.name}</b> on <b>${app.startTime.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</b> has been cancelled because the doctor is on approved leave.</p>
                   <p>Please sign in to the <a href="http://localhost:5173/login?role=patient" style="color: #0284c7; text-decoration: underline;">Patient Portal</a> to select an alternative date or choose another doctor.</p>
                   <p>We apologize for any inconvenience caused.</p>
                   <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">Best regards,<br/>Clinic Care Team</p>
                 </div>`
        }).catch(e => console.error("Patient leave cancellation email error:", e));
      }
    }

    const doc = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, include: { user: true } });
    if (doc?.user?.email) {
      const formattedDate = dayStart.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      sendEmail({
        to: doc.user.email,
        subject: "Leave Request Approved - Clinic Administration",
        html: `<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px;">
                 <h2 style="color: #0284c7;">Leave Approved & Schedule Updated</h2>
                 <p>Dear Dr. ${doc.name},</p>
                 <p>Your leave for <b>${formattedDate}</b> has been approved and registered in the system by the administrator.</p>
                 <div style="background: #f8fafc; border-left: 4px solid #0284c7; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
                   <p style="margin: 0 0 8px 0;"><b>Status:</b> Approved / On Leave</p>
                   <p style="margin: 0;"><b>Cancelled Appointments:</b> ${affectedAppointments.length}</p>
                 </div>
                 ${affectedAppointments.length > 0 
                   ? '<p>All affected patients have been automatically sent cancellation and rescheduling notices via email.</p>' 
                   : '<p>You had no scheduled appointments for this day.</p>'}
                 <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">Sincerely,<br/>Clinic Administration</p>
               </div>`
      }).catch(e => console.error("Doctor leave email error:", e));
    }

    res.json({ leave, cancelledCount: affectedAppointments.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as any)?.message || "Server error" });
  }
});

router.put("/doctors/:id", async (req: Request, res: Response): Promise<void> => {
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
    console.error("Error updating doctor:", error);
    res.status(500).json({ error: (error as any)?.message || "Server error" });
  }
});

export default router;
