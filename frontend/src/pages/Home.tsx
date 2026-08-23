import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope, User, HeartPulse, LogIn } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="flex-center animate-fade-in" style={{ flexDirection: 'column', textAlign: 'center', minHeight: '60vh' }}>
      <h1>Next-Gen Healthcare Appointments</h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', marginBottom: '2rem' }}>
        Seamlessly book appointments, get AI-powered symptom analysis, and manage your health follow-ups.
      </p>

      <div style={{ marginBottom: '4rem' }}>
        <button 
          className="btn btn-primary" 
          onClick={() => navigate('/login?role=patient')}
          style={{ padding: '1rem 2rem', fontSize: '1.2rem', borderRadius: '50px' }}
        >
          Book an Appointment (Patient Portal)
        </button>
      </div>
      
      <div style={{ width: '100%', maxWidth: '800px', borderTop: '1px solid var(--border-color)', margin: '0 auto 3rem auto' }}></div>
      <h3 style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Staff Login</h3>

      <div className="login-cards-container">
        {/* Doctor Card */}
        <div className="login-card" style={{ borderTopColor: 'var(--accent-secondary)' }}>
          <div className="role-info">
            <Stethoscope size={48} style={{ color: 'var(--accent-secondary)' }} />
            <span className="role-title" style={{ color: 'var(--accent-secondary)' }}>Doctor</span>
          </div>
          <button className="login-btn doctor-btn" onClick={() => navigate('/login?role=doctor')}>
            <LogIn size={20} />
          </button>
        </div>


        {/* Nurse Card */}
        <div className="login-card" style={{ borderTopColor: 'var(--success-color)' }}>
          <div className="role-info">
            <HeartPulse size={48} style={{ color: 'var(--success-color)' }} />
            <span className="role-title" style={{ color: 'var(--success-color)' }}>Nurse</span>
          </div>
          <button className="login-btn nurse-btn" onClick={() => navigate('/login?role=nurse')}>
            <LogIn size={20} />
          </button>
        </div>
        {/* Admin Card */}
        <div className="login-card" style={{ borderTopColor: 'var(--primary)' }}>
          <div className="role-info">
            <User size={48} style={{ color: 'var(--primary)' }} />
            <span className="role-title" style={{ color: 'var(--primary)' }}>Admin</span>
          </div>
          <button className="login-btn admin-btn" onClick={() => navigate('/login?role=admin')}>
            <LogIn size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
