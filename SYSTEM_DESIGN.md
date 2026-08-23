# System Design: Clinic Booking & AI Assistant System

This document outlines the architectural decisions and robust mechanisms implemented to handle complex scheduling conflicts, booking integrity, and intelligent notifications.

## 1. Double-Booking Prevention

In a high-traffic clinic system, multiple patients may attempt to book the same doctor at the same time. To prevent double-booking, the system leverages PostgreSQL’s ACID compliance and Prisma’s transaction capabilities.

When a patient submits a booking request, the backend initiates an atomic `$transaction` containing:
1. A database read to check if the specific slot `(doctorId, startTime)` is already occupied.
2. A database write to create the `Appointment` record.

By encapsulating both operations in a single database transaction, the system ensures that concurrent requests to the same slot are strictly serialized. If two requests for the exact same `startTime` arrive simultaneously, the first request locks the state and completes. The second request, upon evaluation, will read the updated state, detect the conflict, and cleanly abort with a user-friendly error message, entirely eliminating race conditions.

## 2. Doctor Leave Conflict Handling

Doctors may unexpectedly mark themselves on leave for a specific day, impacting already scheduled appointments. The system handles this through a cascading invalidation pattern.

When an Admin marks a doctor on leave for a target date:
1. The backend first checks for duplicate leave entries to prevent unique constraint (`P2002`) errors.
2. The system then queries all appointments with `status: 'BOOKED'` for that specific doctor where the `startTime` falls between `00:00:00` and `23:59:59` of the target date.
3. It iterates through the affected appointments, updating their status to `'CANCELLED'`.
4. As part of this iteration, it automatically dispatches cancellation emails to the affected patients, explaining the situation.
5. Finally, the system emails the doctor, confirming the leave and providing a summary of how many appointments were automatically cancelled on their behalf.

This localized conflict resolution ensures that leaves are strictly enforced without requiring manual auditing of the schedule by the administrative staff.

## 3. Slot Hold Mechanism & Concurrency

The system uses an optimistic concurrency model to handle slot availability. Rather than implementing complex server-side "locking" timers (e.g., holding a slot for 5 minutes while a user types their symptoms), which are prone to deadlocks and require periodic cleanup jobs, the system validates the slot at the exact moment of confirmation.

When a patient views the booking calendar, they see a real-time reflection of available slots. They then fill out the pre-visit form. When they click "Confirm", the transaction (described in Section 1) immediately verifies if the slot is still available. If another user claimed it during the 30 seconds it took to fill the form, the transaction safely rolls back and prompts the user to select another slot. 

This approach minimizes server state overhead, maximizes system throughput, and provides a seamless, stateless user experience.

## 4. Notification Failure Handling

The application integrates with the Gmail SMTP server to send `.ics` calendar invites, post-visit summaries, and cancellation alerts. Because network requests to external SMTP servers can fail (due to rate limits, invalid credentials, or network drops), the notification logic is built with graceful error handling.

1. **Decoupled API Responses**: The core business logic (e.g., confirming a booking in the database) is executed *before* the email transport is triggered. 
2. **Error Swallowing for Non-Critical Paths**: If the `sendEmail` function fails (e.g., a patient provided an invalid email domain), the `catch` block logs the error to the server console but does *not* crash the request. The API still returns a `200 OK` or `201 Created` status to the client, ensuring the patient's appointment is successfully saved in the database even if the receipt fails to send.
3. **Cron Job Resilience**: For asynchronous notifications (like the 24-hour appointment reminder and 5-minute medication reminders), the cron workers map over pending records and utilize individual `try-catch` blocks per notification. If one email fails to send, the worker logs the specific failure and seamlessly proceeds to the next record in the queue, preventing a single failure from halting the entire batch job.

## 5. Integration of AI (Gemini 3.6 Flash)

The system delegates heavy cognitive tasks to the Gemini AI API:
- **Pre-Visit Triage**: Translating raw patient symptoms into professional medical terms and assessing clinical urgency (Low/Medium/High).
- **Clinical Notes**: Generating SOAP-formatted clinical notes based on short doctor observations.
- **Patient Summaries**: Translating dense clinical notes into patient-friendly post-visit summaries and clear medication schedules.

To handle potential AI latency or API downtime, every LLM call is wrapped in a `try-catch` block that returns a graceful fallback object. For instance, if the LLM fails to generate a summary, the system falls back to returning standard instructions ("Please refer to the doctor directly for your summary"), ensuring the application remains highly available and functional even if the external AI provider experiences an outage.
