import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../index";
import { body, validationResult } from "express-validator";

const router = Router();

router.post(
  "/register",
  [
    body("password").isLength({ min: 6 }),
    body("role").isIn(["ADMIN", "DOCTOR", "PATIENT", "NURSE"]),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password, role, name, phone, specialisation, workingHoursStart, workingHoursEnd, age, medicalHistory, pictureUrl } = req.body;

    try {
      const trimmedEmail = email ? email.trim().toLowerCase() : null;
      if (trimmedEmail) {
        const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } });
        if (existingUser) {
          res.status(400).json({ error: "Email already exists" });
          return;
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);

      let empId = null;
      if (role === "DOCTOR" || role === "NURSE") {
        const prefix = role === "DOCTOR" ? "DOC" : "NUR";
        empId = `${prefix}${Math.floor(10000 + Math.random() * 90000)}`;
      }

      const user = await prisma.user.create({
        data: {
          email: role === "PATIENT" ? trimmedEmail : null,
          empId,
          passwordHash,
          role,
        },
      });

      if (role === "PATIENT") {
        await prisma.patientProfile.create({
          data: {
            userId: user.id,
            name: name ? name.trim() : "Patient",
            phone: phone ? phone.trim() : null,
            age: age ? parseInt(age) : null,
            medicalHistory,
            pictureUrl
          },
        });
      } else if (role === "DOCTOR") {
        await prisma.doctorProfile.create({
          data: {
            userId: user.id,
            name: name ? name.trim() : "Doctor",
            specialisation: specialisation || "General",
            workingHoursStart: workingHoursStart || "09:00",
            workingHoursEnd: workingHoursEnd || "17:00",
            slotDurationMins: 30,
          },
        });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || "super_secret_jwt",
        { expiresIn: "24h" }
      );

      res.status(201).json({ token, user: { id: user.id, email: user.email, empId: user.empId, role: user.role } });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/login",
  async (req: Request, res: Response): Promise<void> => {
    const { name, phone, email, empId, password, role } = req.body;

    try {
      let user;

      if (role === "ADMIN") {
        const trimmedEmail = email ? email.trim().toLowerCase() : "";
        if (!trimmedEmail || !password) {
          res.status(400).json({ error: "Email and password are required for admin" });
          return;
        }
        user = await prisma.user.findUnique({ where: { email: trimmedEmail } });
        if (!user || user.role !== "ADMIN" || !user.passwordHash) {
          res.status(401).json({ error: "Invalid admin credentials" });
          return;
        }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          res.status(401).json({ error: "Invalid admin credentials" });
          return;
        }
      } else if (role === "DOCTOR" || role === "NURSE") {
        const trimmedEmpId = empId ? empId.trim().toUpperCase() : "";
        if (!trimmedEmpId || !password) {
          res.status(400).json({ error: "Employee ID and password are required for this role" });
          return;
        }
        user = await prisma.user.findUnique({ where: { empId: trimmedEmpId } });
        
        if (!user || !user.passwordHash) {
          res.status(401).json({ error: "Invalid Employee ID or password" });
          return;
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          res.status(401).json({ error: "Invalid Employee ID or password" });
          return;
        }
      } else {
        // PATIENT role (Passwordless Auto-login / Registration)
        const trimmedEmail = email && typeof email === "string" ? email.trim().toLowerCase() : null;
        const trimmedPhone = phone && typeof phone === "string" ? phone.trim() : null;
        const trimmedName = name && typeof name === "string" ? name.trim() : null;

        if (!trimmedPhone && !trimmedEmail) {
          res.status(400).json({ error: "Please enter your phone number or email address" });
          return;
        }

        // 1. Check if an account already exists with this email
        let existingUserByEmail = null;
        if (trimmedEmail) {
          existingUserByEmail = await prisma.user.findUnique({ where: { email: trimmedEmail } });
          if (existingUserByEmail && existingUserByEmail.role !== "PATIENT") {
            res.status(400).json({ 
              error: `The email "${trimmedEmail}" belongs to an ${existingUserByEmail.role.toLowerCase()} account. Please sign in via the Staff portal or use a different email.`
            });
            return;
          }
        }

        // 2. Find existing patient profile by phone first
        let patientProfile = null;
        if (trimmedPhone) {
          patientProfile = await prisma.patientProfile.findFirst({
            where: { phone: trimmedPhone },
            include: { user: true }
          });
        }

        // If not found by phone, check by email
        if (!patientProfile && existingUserByEmail) {
          patientProfile = await prisma.patientProfile.findUnique({
            where: { userId: existingUserByEmail.id },
            include: { user: true }
          });
        }

        if (!patientProfile) {
          // New patient registration
          if (existingUserByEmail) {
            user = existingUserByEmail;
          } else {
            user = await prisma.user.create({
              data: {
                role: "PATIENT",
                email: trimmedEmail || null
              }
            });
          }

          patientProfile = await prisma.patientProfile.create({
            data: {
              userId: user.id,
              name: trimmedName || "Patient",
              phone: trimmedPhone || null
            },
            include: { user: true }
          });
        } else {
          // Existing patient returning
          user = patientProfile.user;

          // Safely update email if provided and not currently set or changed
          if (trimmedEmail && user.email !== trimmedEmail) {
            if (!existingUserByEmail || existingUserByEmail.id === user.id) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: { email: trimmedEmail }
              });
            }
          }

          // Update name/phone if changed
          const updates: any = {};
          if (trimmedName && patientProfile.name !== trimmedName) updates.name = trimmedName;
          if (trimmedPhone && patientProfile.phone !== trimmedPhone) updates.phone = trimmedPhone;
          if (Object.keys(updates).length > 0) {
            patientProfile = await prisma.patientProfile.update({
              where: { id: patientProfile.id },
              data: updates,
              include: { user: true }
            });
          }
        }
      }

      if (!user) {
         res.status(500).json({ error: "User data could not be retrieved" });
         return;
      }

      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET || "super_secret_jwt",
        { expiresIn: "24h" }
      );

      res.json({ token, user: { id: user.id, email: user.email, empId: user.empId, role: user.role } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
