import { API_URL } from '../services/api';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface Doctor {
  id: string;
  name: string;
  specialisation: string;
}

interface Appointment {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  doctor: {
    name: string;
    specialisation: string;
  };
  preVisitForm?: {
    symptomsText: string;
    llmUrgencyLevel?: string;
    llmChiefComplaint?: string;
  };
  postVisitNote?: {
    clinicalNotes: string;
    prescriptionDetails?: string;
    llmPatientSummary?: string;
    llmFollowUpSteps?: string;
  };
}

export default function PatientDashboard() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'book' | 'my-appointments'>('book');
  
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedSpecialisation, setSelectedSpecialisation] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  
  const [myAppointments, setMyAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: '',
    phone: '',
    symptoms: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch doctors
  useEffect(() => {
    axios.get(`${API_URL}/api/patient/doctors`)
      .then(res => setDoctors(res.data))
      .catch(err => console.error('Error fetching doctors:', err));
  }, []);

  // Fetch profile to auto-fill
  useEffect(() => {
    if (token) {
      axios.get(`${API_URL}/api/patient/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.data) {
          setFormData(prev => ({
            ...prev,
            name: res.data.name || prev.name,
            phone: res.data.phone || prev.phone,
            age: res.data.age ? String(res.data.age) : prev.age,
            sex: res.data.sex || prev.sex
          }));
        }
      })
      .catch(err => console.log('Profile loading notice:', err?.response?.status));

      fetchAppointments();
    }
  }, [token]);

  const fetchAppointments = () => {
    if (!token) return;
    setLoadingAppointments(true);
    axios.get(`${API_URL}/api/patient/appointments`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setMyAppointments(res.data))
    .catch(err => console.error('Error fetching appointments:', err))
    .finally(() => setLoadingAppointments(false));
  };

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      axios.get(`${API_URL}/api/patient/doctors/${selectedDoctor}/slots?date=${selectedDate}`)
        .then(res => setSlots(res.data))
        .catch(err => console.error('Error fetching slots:', err));
    } else {
      setSlots([]);
    }
  }, [selectedDoctor, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !selectedSlot) {
      alert('Please select a doctor and a time slot first.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_URL}/api/patient/query`, {
        ...formData,
        doctorId: selectedDoctor,
        startTime: selectedSlot
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(true);
      fetchAppointments();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to submit query. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h2>Patient Portal</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className={`btn ${activeTab === 'book' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('book'); setSuccess(false); }}
            style={{ fontSize: '0.9rem' }}
          >
            Book Appointment
          </button>
          <button 
            className={`btn ${activeTab === 'my-appointments' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setActiveTab('my-appointments'); fetchAppointments(); }}
            style={{ fontSize: '0.9rem' }}
          >
            My Appointments ({myAppointments.length})
          </button>
        </div>
      </div>

      {activeTab === 'my-appointments' ? (
        <div className="glass-panel">
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>My Appointments & Summaries</h3>
          {loadingAppointments ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading appointments...</p>
          ) : myAppointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>You have no booked appointments yet.</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('book')}>Book Your First Appointment</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myAppointments.map(app => (
                <div key={app.id} style={{ 
                  padding: '1rem', 
                  borderRadius: '8px', 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '1.1rem' }}>Dr. {app.doctor.name} ({app.doctor.specialisation})</strong>
                    <span style={{ 
                      padding: '0.2rem 0.6rem', 
                      borderRadius: '12px', 
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      backgroundColor: app.status === 'COMPLETED' ? 'var(--success-color)' : app.status === 'CANCELLED' ? 'var(--danger-color)' : 'var(--primary)'
                    }}>
                      {app.status}
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    <b>Time:</b> {new Date(app.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                  {app.preVisitForm && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      <b>Symptoms:</b> {app.preVisitForm.symptomsText}
                    </p>
                  )}
                  {app.postVisitNote && (
                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,255,100,0.05)', borderRadius: '6px', border: '1px solid var(--success-color)' }}>
                      <strong style={{ color: 'var(--success-color)', fontSize: '0.9rem' }}>Doctor's Summary & Instructions:</strong>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>{app.postVisitNote.llmPatientSummary || app.postVisitNote.clinicalNotes}</p>
                      {app.postVisitNote.prescriptionDetails && (
                        <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                          <b>Prescription:</b> {app.postVisitNote.prescriptionDetails}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : success ? (
        <div className="glass-panel flex-center" style={{ minHeight: '40vh', flexDirection: 'column', textAlign: 'center', padding: '2rem' }}>
          <h2 style={{ color: 'var(--success-color)' }}>Appointment Booked Successfully!</h2>
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Check your email for the confirmation details and calendar invite.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button className="btn btn-secondary" onClick={() => { setSuccess(false); setFormData({...formData, symptoms: ''}); setSelectedSlot(''); }}>
              Book Another
            </button>
            <button className="btn btn-primary" onClick={() => setActiveTab('my-appointments')}>
              View My Appointments
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel">
          <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>1. Select Doctor & Time</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Specialisation</label>
                <select className="form-input" value={selectedSpecialisation} onChange={e => {
                  setSelectedSpecialisation(e.target.value);
                  setSelectedDoctor('');
                }}>
                  <option value="">-- All Specialisations --</option>
                  {Array.from(new Set(doctors.map(d => d.specialisation))).map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Doctor</label>
                <select className="form-input" value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)}>
                  <option value="">-- Choose Doctor --</option>
                  {doctors
                    .filter(d => !selectedSpecialisation || d.specialisation === selectedSpecialisation)
                    .map(d => (
                      <option key={d.id} value={d.id}>Dr. {d.name} ({d.specialisation})</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)} 
                min={new Date().toISOString().split('T')[0]} 
              />
            </div>

            {slots.length > 0 && (
              <div className="form-group">
                <label className="form-label">Available Slots</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {slots.map(slot => (
                    <button 
                      key={slot} 
                      type="button"
                      onClick={() => setSelectedSlot(slot)}
                      className="btn"
                      style={{
                        background: selectedSlot === slot ? 'var(--accent-primary)' : 'var(--surface-color)',
                        color: selectedSlot === slot ? '#000' : 'var(--text-primary)',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.85rem',
                        border: selectedSlot === slot ? 'none' : '1px solid var(--border-color)',
                        borderRadius: '6px'
                      }}
                    >
                      {new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {selectedDoctor && selectedDate && slots.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No available slots for this date.</p>
            )}
          </div>

          <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>2. Pre-Visit Intake</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. John Doe" />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Age</label>
                <input type="number" className="form-input" required value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Sex</label>
                <select className="form-input" required value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input type="tel" className="form-input" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">What's bothering you?</label>
              <textarea 
                className="form-input" 
                required 
                rows={4}
                value={formData.symptoms} 
                onChange={e => setFormData({...formData, symptoms: e.target.value})} 
                placeholder="Describe your symptoms (e.g. I have high fever and cough for 3 days...)" 
              />
              <small style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                Our AI will organize this information for your doctor.
              </small>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading || !selectedSlot}>
              {loading ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
