import { useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordRequest } from '../services/authService';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [loading, setLoading] = useState(false);

  const isTokenMissing = useMemo(() => !token, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setMessageTone('error');
      setMessage('This password reset link is missing or invalid.');
      return;
    }

    if (!form.password || !form.confirmPassword) {
      setMessageTone('error');
      setMessage('Enter and confirm your new password.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setMessageTone('error');
      setMessage('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      const response = await resetPasswordRequest({ token, password: form.password });
      setMessageTone('success');
      setMessage(response.message || 'Password reset successfully. Redirecting to login...');
      window.setTimeout(() => navigate('/login', { replace: true }), 1600);
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to reset your password right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-gradient px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-soft sm:p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">Reset password</h1>
          <p className="mt-2 text-sm text-slate-500">Choose a new password for your KEREA HRMS account.</p>
        </div>

        {message ? <div className={`mb-4 rounded-2xl px-4 py-3 text-sm ${messageTone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{message}</div> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                className="pr-12"
                disabled={isTokenMissing || loading}
                required
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Confirm new password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="pr-12"
                disabled={isTokenMissing || loading}
                required
              />
              <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={isTokenMissing || loading} className="w-full rounded-2xl bg-brand-gradient px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? 'Saving...' : 'Save new password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-emerald-700">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
