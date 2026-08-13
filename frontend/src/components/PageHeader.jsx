import { usePagePresentation } from '../hooks/usePagePresentation';
import { useAuth } from '../context/AuthContext';
import { useLocation } from 'react-router-dom';

export default function PageHeader({ title, subtitle, actions, animationOrder = 0 }) {
  const { animationStyle } = usePagePresentation({ animationOrder });
  const { settings } = useAuth();
  const location = useLocation();
  const path = location?.pathname || '';
  const pageKey = (
    path.startsWith('/employees') ? 'employees'
    : path.startsWith('/profile') ? 'profile'
    : path.startsWith('/documents') ? 'documents'
    : path.startsWith('/leaves') ? 'leave'
    : path.startsWith('/leave-status') ? 'leave'
    : path.startsWith('/kpi-matrix') ? 'kpi'
    : path.startsWith('/performance-dashboard') ? 'performance'
    : path.startsWith('/settings') ? 'settings'
    : path.startsWith('/audit-logs') ? 'audit'
    : 'dashboard'
  );
  const perPage = settings?.interface?.pageHeaderColors || {};
  const titleColor = perPage?.[pageKey]?.title || '';
  const subtitleColor = perPage?.[pageKey]?.subtitle || '';

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" style={animationStyle}>
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold text-slate-900" style={titleColor ? { color: titleColor } : undefined}>{title}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm text-slate-500" style={subtitleColor ? { color: subtitleColor } : undefined}>{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">{actions}</div> : null}
    </div>
  );
}
