
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      // Successful login will trigger redirection via protected route or we can force it
      // Added a small delay for state update propagation
      setTimeout(() => navigate(from, { replace: true }), 100);
    } catch (err: any) {
      console.error(err);
      
      if (err.code === 'auth/too-many-requests' || err.code === 'auth/too-many-requests') {
        const resetTime = err.rateLimitInfo?.resetTime;
        if (resetTime) {
          const minutesUntilReset = Math.ceil((resetTime - Date.now()) / (1000 * 60));
          setError(`Too many failed login attempts. Please try again in ${minutesUntilReset} minute(s).`);
        } else {
          setError('Too many failed login attempts. Please try again later.');
        }
      } else if (err.code === 'auth/invalid-credential') {
        const remainingAttempts = err.rateLimitInfo?.remainingAttempts;
        if (remainingAttempts !== undefined && remainingAttempts > 0) {
          setError(`Invalid email or password. ${remainingAttempts} attempt(s) remaining.`);
        } else {
          setError('Invalid email or password.');
        }
      } else {
        setError('Failed to sign in. Please check your connection.');
      }
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 space-y-6 shadow-lg shadow-slate-200/40" aria-label="Sign in">
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-2">Email</label>
          <input id="login-email" name="email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} className="block w-full px-3 py-3 text-base bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900" />
        </div>
        <div>
          <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-2">Password</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="block w-full px-3 py-3 text-base bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900" />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={isSubmitting || !email || !password} className="w-full flex items-center justify-center gap-2 bg-[#345eae] hover:bg-[#2b5098] text-white font-semibold py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </main>
  );
};

export default Login;