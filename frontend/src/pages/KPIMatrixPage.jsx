import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, ChartColumnIncreasing, Pencil } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { getAverageKpiScore, getNormalizedKpiEntry } from '../utils/kpi';

export default function KPIMatrixPage() {
  const navigate = useNavigate();
  const { settings, user } = useAuth();
  const [users, setUsers] = useState([]);
  const { cardStyle, animationStyle } = usePagePresentation();
  const canManageKpi = ['admin', 'ceo', 'finance'].includes(user?.role);

  useEffect(() => {
    fetchUsers().then((list) => setUsers(list)).catch(() => setUsers([]));
  }, []);

  const rows = useMemo(
    () => users.filter((entry) => entry.isActive && !entry.isDeleted && entry.role !== 'ceo').sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [users]
  );

  const employeesWithScores = useMemo(
    () => rows.filter((employee) => getAverageKpiScore(getNormalizedKpiEntry(settings?.kpi?.records?.[String(employee.id)] || settings?.kpi?.matrix?.[String(employee.id)] || {})) !== null).length,
    [rows, settings?.kpi?.matrix, settings?.kpi?.records]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Matrix"
        subtitle="Choose an employee to open a dedicated KPI detail page with their configured roles, KPI wording, and saved scores."
        actions={canManageKpi ? [
          <button key="edit-kpi" type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => navigate('/settings', { state: { settingsPage: 'kpi' } })}>
            <Pencil size={16} />Edit KPI setup
          </button>
        ] : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard title="Employees" value={rows.length} helper="Active employees available for KPI review" accent="from-emerald-700 to-green-500" />
        <StatCard title="Configured profiles" value={employeesWithScores} helper="Employees with at least one saved KPI score" accent="from-sky-700 to-cyan-500" />
        <StatCard title="KPI editing" value="Settings" helper="Core roles, KPI wording, and scores are now managed in Settings" accent="from-violet-700 to-fuchsia-500" />
      </div>

      <SectionCard title="Employee KPI directory" subtitle="Open a full KPI page for any employee from this list." style={{ ...cardStyle, ...animationStyle }}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((employee) => {
            const entry = getNormalizedKpiEntry(settings?.kpi?.records?.[String(employee.id)] || settings?.kpi?.matrix?.[String(employee.id)] || {});
            const average = getAverageKpiScore(entry);
            const configuredRoles = entry.coreRoles.filter((role) => String(role || '').trim()).length;
            const configuredKpis = entry.indicators.filter((indicator) => String(indicator?.label || '').trim() || indicator?.score !== '').length;

            return (
              <Link
                key={employee.id}
                to={`/kpi-matrix/${employee.id}`}
                className="group rounded-[28px] border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900">{employee.fullName}</p>
                    <p className="mt-1 text-sm text-slate-500">{employee.positionTitle || employee.roleTitle || 'No designation'}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${average === null ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>{average ?? '—'}</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Core roles</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><BriefcaseBusiness size={14} />{configuredRoles}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Configured KPIs</p>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-800"><ChartColumnIncreasing size={14} />{configuredKpis}</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between text-sm font-semibold text-emerald-700">
                  <span>Open KPI profile</span>
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
