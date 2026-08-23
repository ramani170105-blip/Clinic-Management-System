import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function PatientDashboard() {
  const { token, user } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedSpecialisation, setSelectedSpecialisation] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: '',
    phone: '',
    symptoms: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    axios.get('http://localhost:3000/api/patient/doctors')
      .then(res => setDoctors(res.data))
      .catch(err => console.error('Error fetching doctors:', err));
  }, []);

  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      axios.get(`${(import.meta.env.VITE_API_URL || 'https://clinic-management-system-v4b7.onrender.com')}/api/patient/doctors/${selectedDoctor}/slots?date=${selectedDate}`)
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
      await axios.post('http://localhost:3000/api/patient/query', {
        ...formData,
        doctorId: selectedDoctor,
        startTime: selectedSlot
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(true);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to submit query. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex-center animate-fade-in" style={{ height: '50vh', flexDirection: 'column' }}>
        <h2 style={{ color: 'var(--success)' }}>Appointment Booked Successfully!</h2>
        <p style={{ marginTop: '1rem' }}>Check your email for the confirmation and calendar invite.</p>
        <button className="btn btn-primary" onClick={() => { setSuccess(false); setFormData({...formData, symptoms: ''}); setSelectedSlot(''); }} style={{ marginTop: '2rem' }}>
          Book Another Appointment
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1rem' }}>Book an Appointment</h2>
      <div className="glass-panel">
        
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>1. Select Doctor & Time</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Specialisation</label>
              <select className="form-input" value={selectedSpecialisation} onChange={e => {
                setSelectedSpecialisation(e.target.value);
                setSelectedDoctor(''); // reset doctor when spec changes
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
            <input type="date" className="form-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
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
                      padding: '0.5rem',
                      fontSize: '0.85rem',
                      border: selectedSlot === slot ? 'none' : '1px solid var(--border-color)'
                    }}
                  >
                    {new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedDoctor && selectedDate && slots.length === 0 && (
            <p style={{ color: 'var(--text-secondary)' }}>No slots available for this date.</p>
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
    </div>
  );
}
