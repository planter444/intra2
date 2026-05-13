import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="rounded-3xl bg-white p-10 text-center shadow-soft">
        <p className="text-sm uppercase tracking-[0.35em] text-slate-400">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-3 text-sm text-slate-500">The route you requested does not exist in this HRMS shell.</p>
        <Link to="/dashboard" className="mt-6 inline-flex rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
