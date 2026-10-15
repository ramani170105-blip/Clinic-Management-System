import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

export default function DoctorDashboard() {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);

  // Form State
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');
  const [frequency, setFrequency] = useState('24');
  const [doctorObs, setDoctorObs] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'https://clinic-management-system-v4b7.onrender.com'}/api/doctor/appointments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAppointments(res.data);
    } catch (error) {
      console.error('Failed to fetch appointments', error);
    }
  };

  const handleGenerateNotes = async () => {
    if (!selectedAppointment) return;
    setGenerating(true);
    try {
      const res = await axios.post(
        `${(import.meta.env.VITE_API_URL || 'https://clinic-management-system-v4b7.onrender.com')}/api/doctor/appointments/${selectedAppointment.id}/generate-notes`,
        { doctorObservations: doctorObs },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotes(res.data.clinicalNotes);
      setPrescription(res.data.prescription);
      setFrequency(String(res.data.recommendedFrequencyHours));
    } catch (error) {
      console.error(error);
      alert('Failed to generate notes. Please write them manually.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmitNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    setLoading(true);
    try {
      await axios.post(`${(import.meta.env.VITE_API_URL || 'https://clinic-management-system-v4b7.onrender.com')}/api/doctor/appointments/${selectedAppointment.id}/notes`, {
        clinicalNotes: notes,
        prescriptionDetails: prescription,
        frequencyHours: frequency
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Notes submitted! Patient will receive the AI summary shortly.');
      setNotes('');
      setPrescription('');
      fetchAppointments();
      setSelectedAppointment(null);
    } catch (error) {
      console.error(error);
      alert('Failed to submit notes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', gap: '2rem', height: 'calc(100vh - 100px)' }}>
      
      {/* Left Column: List of Appointments */}
      <div className="glass-panel" style={{ flex: '1', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Upcoming Appointments</h2>
        {appointments.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No appointments scheduled.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {appointments.map((apt) => (
              <div 
                key={apt.id} 
                onClick={() => setSelectedAppointment(apt)}
                style={{
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  backgroundColor: selectedAppointment?.id === apt.id ? 'var(--surface-hover)' : 'transparent',
                  transition: 'background-color var(--transition-fast)'
                }}
              >
                <div style={{ fontWeight: '600' }}>
                  {apt.patient.name} 
                  {apt.status === 'COMPLETED' && <span style={{ color: 'var(--success-color)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>(Completed)</span>}
                  {apt.status === 'CANCELLED' && <span style={{ color: 'var(--danger-color)', marginLeft: '0.5rem', fontSize: '0.8rem' }}>(Cancelled)</span>}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  {format(new Date(apt.startTime), 'MMM dd, yyyy h:mm a')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Patient Details & AI Summary */}
      <div className="glass-panel" style={{ flex: '2', overflowY: 'auto' }}>
        {!selectedAppointment ? (
          <div className="flex-center" style={{ height: '100%', color: 'var(--text-secondary)' }}>
            <p>Select a patient from the list to view details.</p>
          </div>
        ) : (
          <div>
            {/* Patient Header */}
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
              <img 
                src={selectedAppointment.patient.pictureUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedAppointment.patient.name)}&background=random`} 
                alt="Patient Avatar" 
                style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-secondary)' }}
              />
              <div>
                <h2 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>{selectedAppointment.patient.name}</h2>
                <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  <span><strong>Age:</strong> {selectedAppointment.patient.age || 'Unknown'}</span>
                  <span><strong>Sex:</strong> {selectedAppointment.patient.sex || 'Unknown'}</span>
                  <span><strong>Phone:</strong> {selectedAppointment.patient.phone || 'N/A'}</span>
                </div>
                <div>
                  <strong>Medical History:</strong>
                  <p style={{ marginTop: '0.25rem', color: 'var(--text-primary)' }}>
                    {selectedAppointment.patient.medicalHistory || 'No previous medical history recorded.'}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Diagnosis Summary */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--accent-secondary)' }}>AI Diagnosis Summary</h3>
              
              {selectedAppointment.preVisitForm ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  
                  <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '1.5rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <strong style={{ fontSize: '1.1rem' }}>Chief Complaint:</strong>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '20px', 
                        fontSize: '0.875rem',
                        fontWeight: 'bold',
                        backgroundColor: 
                          selectedAppointment.preVisitForm.llmUrgencyLevel === 'High' ? 'var(--danger-color)' :
                          selectedAppointment.preVisitForm.llmUrgencyLevel === 'Medium' ? 'var(--warning-color)' : 'var(--success-color)'
                      }}>
                        Urgency: {selectedAppointment.preVisitForm.llmUrgencyLevel || 'Unknown'}
                      </span>
                    </div>
                    <p>{selectedAppointment.preVisitForm.llmChiefComplaint || selectedAppointment.preVisitForm.symptomsText}</p>
                  </div>

                  <div>
                    <strong>Patient's Raw Symptoms:</strong>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>"{selectedAppointment.preVisitForm.symptomsText}"</p>
                  </div>

                  <div>
                    <strong>Suggested Questions for the Doctor:</strong>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem', color: 'var(--text-primary)' }}>
                      {(selectedAppointment.preVisitForm.llmSuggestedQuestions || '').split('|').map((q: string, i: number) => (
                        q.trim() && <li key={i} style={{ marginBottom: '0.25rem' }}>{q.trim()}</li>
                      ))}
                    </ul>
                  </div>
                  
                </div>
              ) : (
                <p style={{ color: 'var(--text-secondary)' }}>No pre-visit form or AI summary available for this appointment.</p>
              )}
            </div>

            {/* Complete Visit Section */}
            {selectedAppointment.status === 'BOOKED' && (
              <div style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(0,0,0,0.1)' }}>
                <h3 style={{ marginBottom: '1rem', color: 'var(--primary)' }}>Complete Visit</h3>
                
                {/* AI Generation Section */}
                <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px dashed var(--accent-secondary)', borderRadius: '8px', background: 'rgba(0,200,255,0.05)' }}>
                  <h4 style={{ color: 'var(--accent-secondary)', marginBottom: '0.75rem' }}>🤖 AI-Powered Notes Generator</h4>
                  <div className="form-group">
                    <label className="form-label">Doctor's Observations (optional — helps AI generate better notes)</label>
                    <textarea 
                      className="form-input" 
                      rows={3} 
                      value={doctorObs} 
                      onChange={(e) => setDoctorObs(e.target.value)} 
                      placeholder="e.g. Patient appears fatigued, mild fever 101°F, throat inflammation observed..." 
                    />
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    style={{ width: '100%' }} 
                    disabled={generating}
                    onClick={handleGenerateNotes}
                  >
                    {generating ? '⏳ AI is generating...' : '✨ Generate Clinical Notes & Prescription'}
                  </button>
                </div>

                <form onSubmit={handleSubmitNotes}>
                  <div className="form-group">
                    <label className="form-label">Clinical Notes</label>
                    <textarea 
                      className="form-input" 
                      rows={6} 
                      required 
                      value={notes} 
                      onChange={(e) => setNotes(e.target.value)} 
                      placeholder="Enter or generate clinical notes..." 
                      style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Prescription Details</label>
                      <textarea 
                        className="form-input" 
                        rows={3}
                        value={prescription} 
                        onChange={(e) => setPrescription(e.target.value)} 
                        placeholder="e.g., Amoxicillin 500mg - Every 8 hours - 7 days" 
                        style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reminder Frequency</label>
                      <select className="form-input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                        <option value="0">No Reminders</option>
                        <option value="6">Every 6 Hours</option>
                        <option value="8">Every 8 Hours</option>
                        <option value="12">Every 12 Hours</option>
                        <option value="24">Daily (24h)</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                    {loading ? 'Processing...' : 'Submit Notes & Generate Patient Summary'}
                  </button>
                </form>
              </div>
            )}
            
            {selectedAppointment.status === 'COMPLETED' && selectedAppointment.postVisitNote && (
               <div style={{ padding: '1.5rem', border: '1px solid var(--success-color)', borderRadius: '8px', background: 'rgba(0,255,0,0.05)' }}>
                  <h3 style={{ color: 'var(--success-color)', marginBottom: '1rem' }}>Visit Completed</h3>
                  <p><strong>Your Notes:</strong> {selectedAppointment.postVisitNote.clinicalNotes}</p>
                  <hr style={{ margin: '1rem 0', borderColor: 'var(--border)' }} />
                  <h4>Generated Patient Summary (Emailed):</h4>
                  <p>{selectedAppointment.postVisitNote.llmPatientSummary}</p>
               </div>
            )}
            
          </div>
        )}
      </div>

    </div>
  );
}
