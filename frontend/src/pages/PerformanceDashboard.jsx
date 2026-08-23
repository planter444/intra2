import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Gauge, Sparkles } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { getAverageKpiScore, getNormalizedKpiEntry, getPerformanceBand } from '../utils/kpi';

export default function PerformanceDashboard() {
  const { settings } = useAuth();
  const [users, setUsers] = useState([]);
  const { cardStyle, animationStyle } = usePagePresentation();

  useEffect(() => {
    fetchUsers().then((list) => setUsers(list)).catch(() => setUsers([]));
  }, []);

  const rows = useMemo(
    () => users.filter((entry) => entry.isActive && !entry.isDeleted && entry.role !== 'ceo').sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [users]
  );

  const averages = useMemo(
    () => Object.fromEntries(rows.map((employee) => {
      const entry = getNormalizedKpiEntry(settings?.kpi?.records?.[String(employee.id)] || settings?.kpi?.matrix?.[String(employee.id)] || {});
      return [String(employee.id), getAverageKpiScore(entry)];
    })),
    [rows, settings?.kpi?.matrix, settings?.kpi?.records]
  );

  const employeesReady = useMemo(
    () => Object.values(averages).filter((value) => value !== null).length,
    [averages]
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Performance Dashboard" subtitle="Open a dedicated performance page for any employee to review their average score, KPI breakdown, and current performance band." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard title="Employees" value={rows.length} helper="Active employees available for review" accent="from-violet-700 to-fuchsia-500" />
        <StatCard title="Performance-ready" value={employeesReady} helper="Employees with at least one saved KPI score" accent="from-sky-700 to-cyan-500" />
        <StatCard title="KPI source" value="Settings" helper="Performance content is driven by the KPI settings records" accent="from-emerald-700 to-green-500" />
      </div>

      <SectionCard title="Employee performance directory" subtitle="Each employee opens in a separate performance detail page." style={{ ...cardStyle, ...animationStyle }}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((employee) => {
            const entry = getNormalizedKpiEntry(settings?.kpi?.records?.[String(employee.id)] || settings?.kpi?.matrix?.[String(employee.id)] || {});
            const average = averages[String(employee.id)] ?? null;
            const band = getPerformanceBand(average, settings?.kpi?.performanceBands || {});
            const configuredKpis = entry.indicators.filter((indicator) => String(indicator?.label || '').trim() || indicator?.score !== '').length;

            return (
              <Link
                key={employee.id}
                to={`/performance-dashboard/${employee.id}`}
                className="group rounded-[28px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-fuchsia-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900">{employee.fullName}</p>
                    <p className="mt-1 text-sm text-slate-500">{employee.positionTitle || employee.roleTitle || 'No designation'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${average === null ? 'bg-slate-100 text-slate-600' : 'bg-fuchsia-100 text-fuchsia-700'}`}>{average ?? '—'}</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Performance band</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Sparkles size={14} />{band}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Configured KPIs</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><Gauge size={14} />{configuredKpis}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-sm font-semibold text-fuchsia-700">
                  <span>Open performance profile</span>
                  <ArrowRight size={16} className="transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
