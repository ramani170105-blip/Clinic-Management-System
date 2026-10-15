import { API_URL } from '../services/api';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const roleParam = queryParams.get('role'); 
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  const [empId, setEmpId] = useState(roleParam?.toUpperCase() === 'DOCTOR' ? 'DOC00000' : '');
  const [password, setPassword] = useState(roleParam?.toUpperCase() === 'DOCTOR' ? 'password123' : '');
  const [role, setRole] = useState(roleParam ? roleParam.toUpperCase() : 'PATIENT');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (roleParam) {
      const upperRole = roleParam.toUpperCase();
      setRole(upperRole);
      if (upperRole === 'DOCTOR') {
        setEmpId('DOC00000');
        setPassword('password123');
      } else if (upperRole === 'ADMIN') {
        setEmail('ramani170105@gmail.com');
        setPassword('admin123');
      }
    }
  }, [roleParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        role,
        ...(role === 'ADMIN' 
             ? { email, password }
             : role === 'DOCTOR' || role === 'NURSE' 
               ? { empId, password } 
               : { name, phone, email })
      };
      const res = await axios.post(`${API_URL}/api/auth/login`, payload);
      login(res.data.token, res.data.user);
      if (res.data.user.role === 'PATIENT') navigate('/patient');
      if (res.data.user.role === 'DOCTOR') navigate('/doctor');
      if (res.data.user.role === 'ADMIN') navigate('/admin');
    } catch (error: any) {
      const errMsg = error.response?.data?.error 
        || (error.message?.includes('Network Error') 
            ? 'Server is waking up or unreachable. Please try again in a few moments.' 
            : 'Login failed. Please check your credentials and try again.');
      alert(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center animate-fade-in">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '420px' }}>
        <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>
          {role === 'PATIENT' ? 'Patient Portal' : (role === 'ADMIN' ? 'Admin Portal' : 'Staff Portal')}
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          {role === 'PATIENT' 
            ? 'Enter your details to book appointments & view your medical records' 
            : 'Sign in with your staff credentials'}
        </p>
        
        <form onSubmit={handleSubmit}>
          {role === 'ADMIN' ? (
            <>
              <div className="form-group">
                <label className="form-label">Admin Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="ramani170105@gmail.com"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
              </div>
            </>
          ) : (role === 'DOCTOR' || role === 'NURSE') ? (
            <>
              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={empId} 
                  onChange={e => setEmpId(e.target.value)} 
                  placeholder={role === 'DOCTOR' ? 'DOC00000' : 'NUR12345'}
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
              </div>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="e.g. John Doe"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="e.g. john@example.com"
                  required 
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>
                  Used for appointment confirmations & doctor summaries
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="e.g. 9876543210"
                  required 
                />
              </div>
            </>
          )}
          
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '1rem' }}
            disabled={loading}
          >
            {loading ? 'Connecting...' : (role === 'PATIENT' ? 'Continue to Patient Portal' : 'Login')}
          </button>
        </form>
      </div>
    </div>
  );
}
