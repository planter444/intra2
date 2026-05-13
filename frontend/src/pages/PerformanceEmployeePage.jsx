import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Gauge, Medal, Printer, Sparkles, TrendingUp } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { getAverageKpiScore, getNormalizedKpiEntry, getPerformanceBand } from '../utils/kpi';

export default function PerformanceEmployeePage() {
  const { employeeId } = useParams();
  const { settings } = useAuth();
  const [users, setUsers] = useState([]);
  const { cardStyle, animationStyle } = usePagePresentation();

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
  const configuredIndicators = useMemo(
    () => entry.indicators.filter((indicator) => String(indicator?.label || '').trim() || indicator?.score !== ''),
    [entry.indicators]
  );
  const performanceBand = useMemo(() => getPerformanceBand(average, settings?.kpi?.performanceBands || {}), [average, settings?.kpi?.performanceBands]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee ? `${employee.fullName} Performance Overview` : 'Employee Performance Overview'}
        subtitle={employee ? `${employee.positionTitle || employee.roleTitle || 'No designation'} · ${performanceBand}` : 'This employee record could not be found.'}
        actions={[
          employee ? <button key="print" type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            <Printer size={16} />Print performance
          </button> : null,
          <Link key="back" to="/performance-dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            <ArrowLeft size={16} />Back to employees
          </Link>
        ].filter(Boolean)}
      />

      {!employee ? (
        <SectionCard style={{ ...cardStyle, ...animationStyle }}>
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">We could not find that employee. Go back to the performance list and choose another person.</div>
        </SectionCard>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr),minmax(360px,0.65fr)]">
            <SectionCard style={{ ...cardStyle, ...animationStyle }}>
              <div className="rounded-[32px] bg-gradient-to-br from-violet-950 via-fuchsia-900 to-pink-600 p-6 text-white">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-3">
                    <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/80">Performance dashboard</span>
                    <div>
                      <h2 className="text-3xl font-semibold tracking-tight">{employee.fullName}</h2>
                      <p className="mt-2 text-sm text-fuchsia-50/90">{employee.positionTitle || employee.roleTitle || 'No designation'} · {employee.departmentName || 'No department'}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-3 rounded-3xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-sm">
                    <Medal size={22} />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Performance band</p>
                      <p className="mt-1 text-lg font-semibold">{performanceBand}</p>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Overall score" subtitle="Average across all configured KPI scores." style={{ ...cardStyle, ...animationStyle }}>
              <div className="flex h-full flex-col items-center justify-center gap-4 rounded-[28px] border border-slate-200 bg-slate-50 px-6 py-8 text-center">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-[conic-gradient(from_180deg,_#8b5cf6_0deg,_#ec4899_140deg,_#22c55e_300deg,_#e2e8f0_300deg)] p-4">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Average</p>
                      <p className="mt-2 text-4xl font-bold text-slate-900">{average ?? '--'}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-500">{configuredIndicators.length} KPI item(s) currently contributing to this performance summary.</p>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <StatCard title="Employee" value={employee.fullName} helper="Performance profile" accent="from-violet-700 to-fuchsia-500" />
            <StatCard title="Designation" value={employee.positionTitle || employee.roleTitle || 'Not set'} helper="Saved employee role/title" accent="from-sky-700 to-cyan-500" />
            <StatCard title="Performance band" value={performanceBand} helper="Derived from the average KPI score" accent="from-emerald-700 to-green-500" />
          </div>

          <SectionCard title="Performance breakdown" subtitle="Each KPI is shown as an individual performance meter." style={{ ...cardStyle, ...animationStyle }}>
            <div className="space-y-4">
              {entry.indicators.map((indicator, index) => {
                const value = indicator.score === '' ? null : Number(indicator.score);
                return (
                  <div key={`performance-row-${index}`} className="rounded-3xl border border-slate-200 bg-white p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Performance KPI {index + 1}</p>
                        <p className="mt-2 text-sm font-semibold text-slate-900">{indicator.label || 'No KPI wording set yet.'}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${value === null ? 'bg-slate-100 text-slate-600' : 'bg-fuchsia-100 text-fuchsia-700'}`}>
                          <Gauge size={14} />
                          {value === null ? 'Pending' : `${value}%`}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          <Sparkles size={14} />
                          {getPerformanceBand(value, settings?.kpi?.performanceBands || {})}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" style={{ width: `${value ?? 0}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Momentum snapshot" subtitle="Quick ranking of the KPI scores that shape this employee's performance." style={{ ...cardStyle, ...animationStyle }}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {entry.indicators.map((indicator, index) => (
                <div key={`momentum-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">KPI {index + 1}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                      <TrendingUp size={12} />
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
