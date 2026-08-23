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

  useEffect(() => {
    if (roleParam) {
      setRole(roleParam.toUpperCase());
      if (roleParam.toUpperCase() === 'DOCTOR') {
        setEmpId('DOC00000');
        setPassword('password123');
      }
    }
  }, [roleParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        role,
        ...(role === 'ADMIN' 
             ? { email, password }
             : role === 'DOCTOR' || role === 'NURSE' 
               ? { empId, password } 
               : { name, phone, email })
      };
      const res = await axios.post('http://localhost:3000/api/auth/login', payload);
      login(res.data.token, res.data.user);
      if (res.data.user.role === 'PATIENT') navigate('/patient');
      if (res.data.user.role === 'DOCTOR') navigate('/doctor');
      if (res.data.user.role === 'ADMIN') navigate('/admin');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Login failed');
    }
  };

  return (
    <div className="flex-center animate-fade-in">
      <div className="glass-panel" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>{role === 'PATIENT' ? 'Welcome' : 'Welcome Back'}</h2>
        
        <form onSubmit={handleSubmit}>
          {role === 'ADMIN' ? (
            <>
              <div className="form-group">
                <label className="form-label">Email</label>
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
                  placeholder={role === 'DOCTOR' ? 'DOC12345' : 'NUR12345'}
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
                <label className="form-label">Email</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="e.g. john@example.com"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input 
                  type="tel" 
                  className="form-input" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="e.g. +1 234 567 8900"
                  required 
                />
              </div>
            </>
          )}
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>{role === 'PATIENT' ? 'Register' : 'Login'}</button>
        </form>
      </div>
    </div>
  );
}
