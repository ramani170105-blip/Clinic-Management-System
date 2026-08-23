const API = 'http://localhost:3000/api';

async function req(method, endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

async function runTest() {
  console.log("🚀 Starting End-to-End API Test...");
  try {
    // 1. Admin Login
    console.log("\n--- 1. Admin Login ---");
    const adminRes = await req('POST', '/auth/login', { email: 'ramani170105@gmail.com', password: 'admin123', role: 'ADMIN' });
    const adminToken = adminRes.token;
    console.log("✅ Admin logged in successfully.");

    // 2. Create Doctor
    console.log("\n--- 2. Create Doctor ---");
    const doctorData = { name: 'Dr. Automated', specialisation: 'Cardiology', workingHoursStart: '09:00', workingHoursEnd: '17:00', slotDurationMins: 30, email: `auto_doc_${Date.now()}@gmail.com`, password: 'password123' };
    const docRes = await req('POST', '/admin/doctors', doctorData, adminToken);
    const doctorId = docRes.doctor.id;
    const empId = docRes.empId;
    console.log(`✅ Doctor created successfully! EmpID: ${empId}`);

    // 3. Patient Login/Register
    console.log("\n--- 3. Patient Booking ---");
    const patientRes = await req('POST', '/auth/login', { name: 'Auto Patient', phone: '9998887776', email: 'auto_patient@gmail.com', role: 'PATIENT' });
    const patientToken = patientRes.token;
    console.log("✅ Patient logged in/registered.");

    // Book Appointment
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const bookingRes = await req('POST', '/patient/query', {
      name: 'Auto Patient', age: '30', sex: 'Male', phone: '9998887776',
      symptoms: 'I have a very severe headache and a high fever.',
      doctorId: doctorId,
      startTime: tomorrow.toISOString()
    }, patientToken);
    const appointmentId = bookingRes.appointment.id;
    console.log(`✅ Appointment booked successfully! ID: ${appointmentId}`);

    // 4. Doctor Login & Generate Notes
    console.log("\n--- 4. Doctor AI Notes ---");
    const docLogin = await req('POST', '/auth/login', { empId: empId, password: 'password123', role: 'DOCTOR' });
    const docToken = docLogin.token;
    console.log("✅ Doctor logged in using EmpID.");
    
    console.log("⏳ Asking AI to generate notes...");
    const aiRes = await req('POST', `/doctor/appointments/${appointmentId}/generate-notes`, { doctorObservations: 'Patient looks pale.' }, docToken);
    console.log("✅ AI Generated Notes:");
    console.log("Prescription: " + aiRes.prescription);
    
    const notesRes = await req('POST', `/doctor/appointments/${appointmentId}/notes`, {
      clinicalNotes: aiRes.clinicalNotes,
      prescriptionDetails: aiRes.prescription,
      frequencyHours: aiRes.recommendedFrequencyHours
    }, docToken);
    console.log("✅ Notes submitted and Patient summary generated/emailed!");

    // 5. Admin Cancel Leave
    console.log("\n--- 5. Admin Leave Cancellation ---");
    const leaveDate = new Date();
    leaveDate.setDate(leaveDate.getDate() + 2); // Use a different day to avoid P2002 if we run it again
    leaveDate.setHours(0,0,0,0);
    const leaveRes = await req('POST', '/admin/doctors/leave', {
      doctorId: doctorId,
      date: leaveDate.toISOString()
    }, adminToken);
    console.log(`✅ Doctor marked on leave. Cancelled ${leaveRes.cancelledCount} appointments.`);

    console.log("\n🎉 END-TO-END TEST SUCCESSFUL! All APIs are working perfectly.");
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error.message);
  }
}
runTest();
