import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BriefcaseBusiness, ChartColumnIncreasing, Pencil, Target } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { getAverageKpiScore, getNormalizedKpiEntry } from '../utils/kpi';

export default function KPIMatrixEmployeePage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { settings, user } = useAuth();
  const [users, setUsers] = useState([]);
  const { cardStyle, animationStyle } = usePagePresentation();
  const canManageKpi = ['admin', 'ceo', 'finance'].includes(user?.role);

  useEffect(() => {
    fetchUsers().then((list) => setUsers(list)).catch(() => setUsers([]));
  }, []);

  const employee = useMemo(
    () => users.find((entry) => String(entry.id) === String(employeeId) && entry.isActive && !entry.isDeleted) || null,
    [employeeId, users]
  );

  const entry = useMemo(
    () => getNormalizedKpiEntry(settings?.kpi?.records?.[String(employeeId)] || settings?.kpi?.matrix?.[String(employeeId)] || {}),
    [employeeId, settings?.kpi?.matrix, settings?.kpi?.records]
  );

  const average = useMemo(() => getAverageKpiScore(entry), [entry]);
  const configuredCoreRoles = useMemo(() => entry.coreRoles.filter((role) => String(role || '').trim()), [entry.coreRoles]);
  const configuredIndicators = useMemo(
    () => entry.indicators.filter((indicator) => String(indicator?.label || '').trim() || indicator?.score !== ''),
    [entry.indicators]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee ? `${employee.fullName} KPI Profile` : 'Employee KPI Profile'}
        subtitle={employee ? `${employee.positionTitle || employee.roleTitle || 'No designation'} · ${employee.departmentName || 'No department'}` : 'This employee record could not be found.'}
        actions={[
          canManageKpi ? <button key="edit" type="button" onClick={() => navigate('/settings', { state: { settingsPage: 'kpi', selectedKpiEmployeeId: employeeId } })} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            <Pencil size={16} />Edit KPI setup
          </button> : null,
          <Link key="back" to="/kpi-matrix" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            <ArrowLeft size={16} />Back to employees
          </Link>
        ].filter(Boolean)}
      />

      {!employee ? (
        <SectionCard style={{ ...cardStyle, ...animationStyle }}>
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">We could not find that employee. Go back to the KPI employee list and choose another person.</div>
        </SectionCard>
      ) : (
        <>
          <SectionCard style={{ ...cardStyle, ...animationStyle }}>
            <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-emerald-900 to-green-600 p-6 text-white">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">KPI employee profile</span>
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight">{employee.fullName}</h2>
                    <p className="mt-2 text-sm text-emerald-50/90">{employee.positionTitle || employee.roleTitle || 'No designation'} · {employee.departmentName || 'No department'}</p>
                  </div>
                </div>
                <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4 text-right backdrop-blur-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Average score</p>
                  <p className="mt-2 text-4xl font-bold">{average ?? '--'}</p>
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard title="Employee" value={employee.fullName} helper="KPI detail profile" accent="from-emerald-700 to-green-500" />
            <StatCard title="Designation" value={employee.positionTitle || employee.roleTitle || 'Not set'} helper="Displayed on KPI pages" accent="from-sky-700 to-cyan-500" />
            <StatCard title="Configured KPIs" value={configuredIndicators.length} helper="KPIs with wording or score" accent="from-violet-700 to-fuchsia-500" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.82fr),minmax(0,1.18fr)]">
            <SectionCard title="Core roles" subtitle="Main responsibilities saved for this employee." style={{ ...cardStyle, ...animationStyle }}>
              <div className="space-y-3">
                {configuredCoreRoles.length ? configuredCoreRoles.map((role, index) => (
                  <div key={`${role}-${index}`} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                    <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                      <BriefcaseBusiness size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Core role {index + 1}</p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{role}</p>
                    </div>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">No core roles have been configured for this employee yet.</div>}
              </div>
            </SectionCard>

            <SectionCard title="KPI scorecard" subtitle="Configured KPI wordings and the current recorded scores." style={{ ...cardStyle, ...animationStyle }}>
              <div className="grid gap-4 md:grid-cols-2">
                {entry.indicators.map((indicator, index) => {
                  const hasValue = String(indicator?.label || '').trim() || indicator?.score !== '';
                  return (
                    <div key={`kpi-${index}`} className={`rounded-3xl border p-5 ${hasValue ? 'border-slate-200 bg-white' : 'border-dashed border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">KPI {index + 1}</p>
                          <p className="mt-2 text-sm font-semibold text-slate-900">{indicator.label || 'No KPI wording set yet.'}</p>
                        </div>
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${indicator.score === '' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          <Target size={14} />
                          {indicator.score === '' ? 'No score' : `${indicator.score}%`}
                        </div>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-green-600" style={{ width: `${Number(indicator.score || 0)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {!configuredIndicators.length ? <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No KPI wording or score has been configured for this employee yet.</div> : null}
            </SectionCard>
          </div>

          <SectionCard title="KPI summary" subtitle="A compact matrix-style view of the saved KPI items for this employee." style={{ ...cardStyle, ...animationStyle }}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {entry.indicators.map((indicator, index) => (
                <div key={`summary-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">KPI {index + 1}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      <ChartColumnIncreasing size={12} />
                      {indicator.score === '' ? '--' : indicator.score}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{indicator.label || 'No KPI wording set yet.'}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
