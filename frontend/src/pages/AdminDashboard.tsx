import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const SPECIALISATIONS = [
  "General Medicine",
  "Cardiology",
  "Dermatology",
  "Neurology",
  "Pediatrics",
  "Orthopedics",
  "Psychiatry",
  "Gynecology",
  "ENT"
];

export default function AdminDashboard() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  
  const [docForm, setDocForm] = useState({
    name: '', specialisation: '', workingHoursStart: '09:00', workingHoursEnd: '17:00', slotDurationMins: 30, email: '', password: ''
  });
  
  const [leaveForm, setLeaveForm] = useState({ doctorId: '', date: '' });

  const [editForm, setEditForm] = useState({
    doctorId: '', specialisation: '', workingHoursStart: '09:00', workingHoursEnd: '17:00', slotDurationMins: 30
  });

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'https://clinic-management-system-v4b7.onrender.com'}/api/admin/doctors`, { headers: { Authorization: `Bearer ${token}` } });
      setDoctors(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'https://clinic-management-system-v4b7.onrender.com'}/api/admin/doctors`, docForm, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Doctor created successfully!\n\nPlease share these credentials with the doctor:\nEmployee ID: ${res.data.empId}\nPassword: ${docForm.password}`);
      setDocForm({
        name: '', specialisation: '', workingHoursStart: '09:00', workingHoursEnd: '17:00', slotDurationMins: 30, email: '', password: ''
      });
      fetchDoctors();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error creating doctor');
    }
  };

  const handleMarkLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL || 'https://clinic-management-system-v4b7.onrender.com'}/api/admin/doctors/leave`, leaveForm, { headers: { Authorization: `Bearer ${token}` } });
      alert(`Leave marked. ${res.data.cancelledCount} appointments were cancelled and patients notified.`);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error marking leave');
    }
  };

  const handleEditDoctorSelect = (doctorId: string) => {
    const doc = doctors.find(d => d.id === doctorId);
    if (doc) {
      setEditForm({
        doctorId: doc.id,
        specialisation: doc.specialisation,
        workingHoursStart: doc.workingHoursStart,
        workingHoursEnd: doc.workingHoursEnd,
        slotDurationMins: doc.slotDurationMins
      });
    } else {
      setEditForm({ doctorId: '', specialisation: '', workingHoursStart: '09:00', workingHoursEnd: '17:00', slotDurationMins: 30 });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.doctorId) return;
    try {
      await axios.put(`${(import.meta.env.VITE_API_URL || 'https://clinic-management-system-v4b7.onrender.com')}/api/admin/doctors/${editForm.doctorId}`, editForm, { headers: { Authorization: `Bearer ${token}` } });
      alert('Doctor updated successfully');
      fetchDoctors();
      setEditForm({ doctorId: '', specialisation: '', workingHoursStart: '09:00', workingHoursEnd: '17:00', slotDurationMins: 30 });
    } catch (e: any) {
      alert(e.response?.data?.error || 'Error updating doctor');
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>Admin Portal</h2>
      
      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Add New Doctor</h3>
        <form onSubmit={handleAddDoctor}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input type="text" className="form-input" required value={docForm.name} onChange={e => setDocForm({...docForm, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Specialisation</label>
              <select className="form-input" required value={docForm.specialisation} onChange={e => setDocForm({...docForm, specialisation: e.target.value})}>
                <option value="">-- Select Specialisation --</option>
                {SPECIALISATIONS.map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Working Hours Start</label>
              <input type="time" className="form-input" required value={docForm.workingHoursStart} onChange={e => setDocForm({...docForm, workingHoursStart: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Working Hours End</label>
              <input type="time" className="form-input" required value={docForm.workingHoursEnd} onChange={e => setDocForm({...docForm, workingHoursEnd: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Slot Duration (Mins)</label>
              <input type="number" className="form-input" required value={docForm.slotDurationMins} onChange={e => setDocForm({...docForm, slotDurationMins: parseInt(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" required value={docForm.email} onChange={e => setDocForm({...docForm, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" required value={docForm.password} onChange={e => setDocForm({...docForm, password: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Create Doctor</button>
        </form>
      </div>

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Edit Doctor Profile</h3>
        <div className="form-group">
          <label className="form-label">Select Doctor to Edit</label>
          <select className="form-input" value={editForm.doctorId} onChange={e => handleEditDoctorSelect(e.target.value)}>
            <option value="">-- Select a Doctor --</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>Dr. {d.name} | {d.user?.empId} | ({d.specialisation})</option>
            ))}
          </select>
        </div>
        
        {editForm.doctorId && (
          <form onSubmit={handleEditSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Specialisation</label>
                <select className="form-input" required value={editForm.specialisation} onChange={e => setEditForm({...editForm, specialisation: e.target.value})}>
                  <option value="">-- Select Specialisation --</option>
                  {SPECIALISATIONS.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Slot Duration (Mins)</label>
                <input type="number" className="form-input" required value={editForm.slotDurationMins} onChange={e => setEditForm({...editForm, slotDurationMins: parseInt(e.target.value)})} />
              </div>
              <div className="form-group">
                <label className="form-label">Working Hours Start</label>
                <input type="time" className="form-input" required value={editForm.workingHoursStart} onChange={e => setEditForm({...editForm, workingHoursStart: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Working Hours End</label>
                <input type="time" className="form-input" required value={editForm.workingHoursEnd} onChange={e => setEditForm({...editForm, workingHoursEnd: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Changes</button>
          </form>
        )}
      </div>

      <div className="glass-panel">
        <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Manage Leaves</h3>
        <form onSubmit={handleMarkLeave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Doctor</label>
              <select className="form-input" required value={leaveForm.doctorId} onChange={e => setLeaveForm({...leaveForm, doctorId: e.target.value})}>
                <option value="">Select Doctor</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>Dr. {d.name} | {d.user?.empId}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-input" required value={leaveForm.date} onChange={e => setLeaveForm({...leaveForm, date: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn btn-secondary" style={{ marginTop: '1rem' }}>Mark Leave & Cancel Appointments</button>
        </form>
      </div>
    </div>
  );
}
