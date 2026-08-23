# AI-Powered Clinic Booking & Management System

An end-to-end, full-stack clinic management system featuring AI-driven patient triage, automated clinical notes generation, intelligent email notifications, and robust scheduling conflict management.

## 🚀 Features

- **Admin Portal**: Manage doctors, enforce leave policies with automated cascading cancellations, and oversee the clinic.
- **Doctor Portal**: View schedules and utilize the **AI-Powered Notes Generator** to instantly draft SOAP clinical notes, prescriptions, and patient-friendly post-visit summaries.
- **Patient Portal**: Seamless passwordless login (via Phone number), dynamic booking slots, and AI-assisted symptom intake.
- **Smart Notifications**: Automated email delivery via Gmail SMTP, including:
  - `.ics` calendar attachments for confirmed bookings.
  - 24-hour upcoming appointment reminders.
  - Leave cancellation alerts.
  - Post-visit AI summaries with medication schedules.

---

## 🛠️ Setup Guide

### Prerequisites
- Node.js (v18+)
- PostgreSQL (running locally or via a cloud provider like Supabase/Neon)
- A Google Account (for Gemini API and Gmail SMTP)

### 1. Database & Backend Setup
1. Open the `backend` folder: `cd backend`
2. Install dependencies: `npm install`
3. Copy the environment variables template: `cp .env.example .env`
4. Fill in the `.env` variables (see the Configuration section below).
5. Push the database schema: `npx prisma db push`
6. Start the development server: `npm run dev`

### 2. Frontend Setup
1. Open a new terminal and navigate to the `frontend` folder: `cd frontend`
2. Install dependencies: `npm install`
3. Start the Vite development server: `npm run dev`
4. Open your browser to `http://localhost:5173`.

---

## ⚙️ Configuration & Environment Variables

### Google Calendar Setup (.ics Attachments)
The system automatically generates `.ics` files and attaches them to booking confirmation emails. To enable this, simply configure the Gmail SMTP settings. When patients open the email in Gmail or Apple Mail, they will see an "Add to Calendar" button.

### Google Gemini AI & SMTP Setup
In your `backend/.env` file, you need to provide the following:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/clinicdb?schema=public"
JWT_SECRET="your_secret_key"

# 1. Get an API key from Google AI Studio (https://aistudio.google.com/)
GOOGLE_API_KEY="your_gemini_api_key"

# 2. Gmail SMTP Setup:
# - Go to your Google Account -> Security.
# - Enable 2-Step Verification.
# - Go to App Passwords and create a new password for "Mail".
# - Paste the 16-character password below (no spaces).
GMAIL_USER="your_email@gmail.com"
GMAIL_APP_PASSWORD="your_16_character_app_password"
```

---

## 🗄️ Database Schema Overview

The database is managed via Prisma ORM and consists of the following core models:
- **User**: The base authentication entity. Roles include `ADMIN`, `DOCTOR`, `PATIENT`. Uses `empId` for staff and `phone` for patients.
- **DoctorProfile**: Links to a User. Stores specialisation, working hours, and slot durations.
- **PatientProfile**: Links to a User. Stores demographic data and medical history.
- **DoctorLeave**: Tracks days off for doctors. Enforces a unique constraint on `(doctorId, date)` to prevent duplicate leaves.
- **Appointment**: The core scheduling entity linking a Patient and Doctor. Includes `status` (`BOOKED`, `COMPLETED`, `CANCELLED`) and `startTime`.
- **PreVisitForm**: Captures raw patient symptoms and stores AI-generated triage data (Urgency, Chief Complaint).
- **PostVisitNote**: Captures the doctor's clinical notes, prescriptions, and the AI-generated patient-friendly summary.
- **MedicationReminder**: Tracks prescribed medications and reminder frequencies (processed by a cron worker).

---

## 🔑 Default Test Credentials

When reviewing the application, you can log into the **Staff Login (Admin Portal)** using the following seeded credentials:

- **Email**: `ramani170105@gmail.com`
- **Password**: `admin123`

*(Note: From the Admin dashboard, you can create new Doctor accounts. The system will auto-generate their Employee IDs and email them their passwords).*

---

## 🤖 LLM Prompts (Gemini 3.6 Flash)

The system utilizes highly specialized prompts to interact with the Gemini AI model. These prompts are located in `backend/src/services/llm.ts`.

1. **Pre-Visit Triage Prompt**:
   *Purpose*: Filters out conversational noise and spelling mistakes from the patient's intake form.
   *Prompt*: "You are an expert medical AI assistant. Your task is to process raw patient complaints... Return a JSON object with 'urgencyLevel', 'chiefComplaint', and 'suggestedQuestions'."

2. **Clinical Notes Generation Prompt**:
   *Purpose*: Helps doctors save time by auto-generating professional notes based on short observations.
   *Prompt*: "You are a senior physician assistant AI. Based on the following patient data [symptoms, observations], generate professional clinical notes in SOAP format and a realistic prescription. Return a JSON object..."

3. **Post-Visit Summary Prompt**:
   *Purpose*: Translates dense medical jargon into a simple, easy-to-read email for the patient.
   *Prompt*: "Convert these clinical notes into a patient-friendly summary with a medication schedule and follow-up steps. Return a JSON object..."

---

## 📖 API Documentation

### Authentication
- `POST /api/auth/register`: Register a new user (Admin/Doctor/Patient).
- `POST /api/auth/login`: Authenticate and receive a JWT token.

### Patient Routes (Requires `PATIENT` role)
- `POST /api/patient/query`: Create a new appointment and trigger AI pre-visit analysis.
- `GET /api/patient/appointments`: List all appointments for the logged-in patient.

### Doctor Routes (Requires `DOCTOR` role)
- `GET /api/doctor/appointments`: List all booked appointments for the doctor.
- `POST /api/doctor/appointments/:id/generate-notes`: Generate AI clinical notes based on observations.
- `POST /api/doctor/appointments/:id/notes`: Finalize clinical notes, generate the patient summary, and trigger the post-visit email.

### Admin Routes (Requires `ADMIN` role)
- `GET /api/admin/doctors`: List all doctors.
- `POST /api/admin/doctors`: Add a new doctor (auto-generates EmpID and emails credentials).
- `POST /api/admin/doctors/leave`: Mark a doctor on leave, cascading cancellations to affected appointments and emailing patients.

---

## 🏗️ System Design
For a detailed technical explanation of concurrency handling, slot holding, and notification resilience, please refer to the `system_design.md` file included in this repository.
