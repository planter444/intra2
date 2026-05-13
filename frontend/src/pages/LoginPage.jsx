import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { forgotPasswordRequest } from '../services/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, error, loading, settings, isAuthenticated, user } = useAuth();
  const { animationStyle, cardStyle } = usePagePresentation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const [resetNoticeTone, setResetNoticeTone] = useState('success');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const branding = settings?.branding || {};
  const loginInterface = settings?.interface || {};
  const labels = settings?.labels || {};
  const primaryShapeColor = loginInterface.loginShapesPrimaryColor || branding.primaryColor || '#f97316';
  const secondaryShapeColor = loginInterface.loginShapesSecondaryColor || '#ffffff';
  const shapesOpacity = Number(loginInterface.loginShapesOpacity ?? 0.85) || 0.85;
  const shapesStyle = loginInterface.loginShapesStyle || 'diagonal';
  const shapesAnimated = loginInterface.loginShapesAnimated !== false;
  const loginBackground = `linear-gradient(135deg, ${branding.gradientFrom || '#14532d'}, ${branding.gradientTo || '#22c55e'})`;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setResetNotice('');

    try {
      await login(form);
    } catch (submitError) {
      console.error(submitError);
    }
  };

  const handleForgotPassword = async () => {
    if (!form.email.trim()) {
      setResetNoticeTone('error');
      setResetNotice('Enter your email address first, then use Forgot password.');
      return;
    }

    try {
      setResetLoading(true);
      const response = await forgotPasswordRequest({ email: form.email.trim() });
      setResetNoticeTone('success');
      setResetNotice(response.message || 'If that email exists in the system, a reset link has been sent.');
    } catch (requestError) {
      setResetNoticeTone('error');
      setResetNotice(requestError.response?.data?.message || 'Unable to send a reset link right now.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-gradient px-4 py-8 sm:px-6 lg:px-8" style={{ background: loginBackground }}>
      <style>{`
        @keyframes loginShapeFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          50% { transform: translate3d(18px, -16px, 0) rotate(3deg); }
        }
        @keyframes loginDiagonalFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-26deg); }
          50% { transform: translate3d(18px, -16px, 0) rotate(-23deg); }
        }
        @keyframes loginPatternDrift {
          0% { background-position: 0 0, 0 0; }
          100% { background-position: 90px 70px, 120px 90px; }
        }
      `}</style>
      {loginInterface.loginShapesEnabled ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ opacity: shapesOpacity }}
        >
          {shapesStyle === 'spiderweb' ? (
            <>
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-radial-gradient(circle at 26% 24%, transparent 0 16px, ${secondaryShapeColor} 16px 18px), repeating-conic-gradient(from 0deg at 26% 24%, ${primaryShapeColor} 0deg 1.4deg, transparent 1.4deg 10deg)`,
                  animation: shapesAnimated ? 'loginPatternDrift 18s linear infinite' : undefined
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `repeating-radial-gradient(circle at 76% 76%, transparent 0 18px, ${secondaryShapeColor} 18px 20px), repeating-conic-gradient(from 20deg at 76% 76%, ${primaryShapeColor} 0deg 1.3deg, transparent 1.3deg 11deg)`,
                  animation: shapesAnimated ? 'loginPatternDrift 22s linear infinite reverse' : undefined
                }}
              />
            </>
          ) : shapesStyle === 'glow' ? (
            <>
              <div
                className="absolute -left-32 -top-40 h-[560px] w-[560px] rounded-full blur-3xl"
                style={{ background: `radial-gradient(circle at 30% 30%, ${primaryShapeColor}, transparent 62%)`, animation: shapesAnimated ? 'loginShapeFloat 8s ease-in-out infinite' : undefined }}
              />
              <div
                className="absolute -right-44 top-20 h-[500px] w-[500px] rounded-full blur-3xl"
                style={{ background: `radial-gradient(circle at 60% 40%, ${secondaryShapeColor}, transparent 62%)`, animation: shapesAnimated ? 'loginShapeFloat 9s ease-in-out infinite reverse' : undefined }}
              />
              <div
                className="absolute left-1/3 top-2/3 h-[560px] w-[560px] -translate-x-1/2 rounded-full blur-3xl"
                style={{ background: `radial-gradient(circle at 50% 50%, ${secondaryShapeColor}, transparent 62%)`, animation: shapesAnimated ? 'loginShapeFloat 10s ease-in-out infinite' : undefined }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.75)_1px,transparent_0)] [background-size:30px_30px]" />
            </>
          ) : (
            <>
              <div
                className="absolute -left-24 top-0 h-[120vh] w-32 -rotate-[26deg] rounded-[3rem] shadow-2xl md:w-44"
                style={{ background: primaryShapeColor, animation: shapesAnimated ? 'loginDiagonalFloat 7s ease-in-out infinite' : undefined }}
              />
              <div
                className="absolute left-10 top-16 h-[120vh] w-28 -rotate-[26deg] rounded-[3rem] shadow-2xl md:w-40"
                style={{ background: secondaryShapeColor, animation: shapesAnimated ? 'loginDiagonalFloat 8s ease-in-out infinite reverse' : undefined }}
              />
              <div
                className="absolute -right-16 top-4 h-[120vh] w-32 -rotate-[26deg] rounded-[3rem] shadow-2xl md:w-44"
                style={{ background: primaryShapeColor, animation: shapesAnimated ? 'loginDiagonalFloat 7.5s ease-in-out infinite reverse' : undefined }}
              />
              <div
                className="absolute right-28 top-40 h-[120vh] w-24 -rotate-[26deg] rounded-[3rem] shadow-2xl md:w-36"
                style={{ background: secondaryShapeColor, animation: shapesAnimated ? 'loginDiagonalFloat 9s ease-in-out infinite' : undefined }}
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_0)] [background-size:32px_32px]" />
            </>
          )}
        </div>
      ) : null}
      <div className="relative z-10 w-full max-w-[440px] md:max-w-[460px]">
        <div className="w-full rounded-[2rem] bg-white/95 p-7 shadow-[0_30px_90px_rgba(15,23,42,0.24)] backdrop-blur sm:p-10 md:min-h-[620px]" style={{ ...cardStyle, ...animationStyle }}>
          <div className="mb-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-xl font-bold text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${branding.gradientFrom || '#14532d'}, ${branding.gradientTo || '#22c55e'})` }}>
              {branding.logoText || 'KH'}
            </div>
            <h1 className="mt-7 text-2xl font-bold" style={{ color: branding.primaryColor || '#166534' }}>{labels.loginTitle || 'Login to your account'}</h1>
            <p className="mt-2 text-sm text-slate-500">{labels.loginSubtitle || 'Sign in to your account'}</p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="sr-only">{labels.loginEmailLabel || 'Email'}</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder={labels.loginEmailPlaceholder || 'Email Address'}
                className="rounded-none border-0 border-b border-slate-200 bg-transparent px-0 py-3 text-sm shadow-none outline-none focus:border-emerald-700 focus:ring-0"
                required
              />
            </div>
            <div>
              <label className="sr-only">{labels.loginPasswordLabel || 'Password'}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  placeholder={labels.loginPasswordPlaceholder || 'Password'}
                  className="rounded-none border-0 border-b border-slate-200 bg-transparent px-0 py-3 pr-12 text-sm shadow-none outline-none focus:border-emerald-700 focus:ring-0"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex items-center px-3"
                  style={{ color: branding.primaryColor || '#166534' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="button" onClick={handleForgotPassword} disabled={resetLoading} className="text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70" style={{ color: branding.primaryColor || '#166534' }}>
              {resetLoading ? 'Sending reset link...' : 'Forgot Password?'}
            </button>
            {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
            {resetNotice ? <div className={`rounded-2xl px-4 py-3 text-sm ${resetNoticeTone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{resetNotice}</div> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-lg transition hover:scale-[1.01] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
              style={{ background: branding.primaryColor || '#166534' }}
            >
              {loading ? 'Signing in...' : labels.loginButtonText || 'Login'}
            </button>
          </form>
          <p className="mt-8 text-center text-xs text-slate-400">{labels.loginFooterText || '2026 KEREA. All rights reserved.'}</p>
        </div>
      </div>
    </div>
  );
}
