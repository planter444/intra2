import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Gauge, Sparkles, TrendingUp, Users } from 'lucide-react';
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

  const performanceBands = useMemo(
    () => {
      const bands = { outstanding: 0, strong: 0, developing: 0, needsSupport: 0, pending: 0 };
      rows.forEach((employee) => {
        const entry = getNormalizedKpiEntry(settings?.kpi?.records?.[String(employee.id)] || settings?.kpi?.matrix?.[String(employee.id)] || {});
        const average = getAverageKpiScore(entry);
        const band = getPerformanceBand(average, settings?.kpi?.performanceBands || {});
        if (bands.hasOwnProperty(band.toLowerCase().replace(/\s+/g, ''))) {
          bands[band.toLowerCase().replace(/\s+/g, '')]++;
        } else if (band === 'Pending') {
          bands.pending++;
        }
      });
      return bands;
    },
    [rows, settings?.kpi?.matrix, settings?.kpi?.records, settings?.kpi?.performanceBands]
  );

  const departmentAverages = useMemo(
    () => {
      const deptMap = {};
      rows.forEach((employee) => {
        const dept = employee.departmentName || 'Unassigned';
        const entry = getNormalizedKpiEntry(settings?.kpi?.records?.[String(employee.id)] || settings?.kpi?.matrix?.[String(employee.id)] || {});
        const average = getAverageKpiScore(entry);
        if (average !== null) {
          if (!deptMap[dept]) {
            deptMap[dept] = { total: 0, count: 0 };
          }
          deptMap[dept].total += average;
          deptMap[dept].count++;
        }
      });
      return Object.fromEntries(
        Object.entries(deptMap).map(([dept, data]) => [dept, (data.total / data.count).toFixed(1)])
      );
    },
    [rows, settings?.kpi?.matrix, settings?.kpi?.records]
  );

  const overallAverage = useMemo(
    () => {
      const scores = Object.values(averages).filter((v) => v !== null);
      if (scores.length === 0) return null;
      return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    },
    [averages]
  );

  const handleExportReport = () => {
    const headers = ['Employee Name', 'Designation', 'Department', 'Average Score', 'Performance Band', 'KPI Count', 'Last Modified By', 'Last Modified At'];
    const rows_data = rows.map((employee) => {
      const entry = getNormalizedKpiEntry(settings?.kpi?.records?.[String(employee.id)] || settings?.kpi?.matrix?.[String(employee.id)] || {});
      const average = averages[String(employee.id)] ?? null;
      const band = getPerformanceBand(average, settings?.kpi?.performanceBands || {});
      const configuredKpis = entry.indicators.filter((indicator) => String(indicator?.label || '').trim() || indicator?.score !== '').length;
      const audit = entry.audit || {};
      
      return [
        employee.fullName,
        employee.positionTitle || employee.roleTitle || 'Not set',
        employee.departmentName || 'Not set',
        average ?? 'N/A',
        band,
        configuredKpis,
        audit.lastModifiedByName || 'N/A',
        audit.lastModifiedAt ? new Date(audit.lastModifiedAt).toLocaleString() : 'N/A'
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows_data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `performance_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Performance Dashboard" 
        subtitle="Analytics and performance overview for all employees. View individual performance profiles by clicking on an employee card."
        actions={[
          <button key="export" type="button" onClick={handleExportReport} className="inline-flex items-center gap-2 rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg">
            <Download size={16} />Export Report
          </button>
        ]}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Employees" value={rows.length} helper="Active employees available" accent="from-violet-700 to-fuchsia-500" />
        <StatCard title="Assessed" value={employeesReady} helper="Employees with KPI scores" accent="from-sky-700 to-cyan-500" />
        <StatCard title="Overall Average" value={overallAverage ?? '--'} helper="Company-wide average score" accent="from-emerald-700 to-green-500" />
        <StatCard title="Assessment Frequency" value={settings?.kpi?.frequency || 'quarterly'} helper="Default KPI period" accent="from-amber-700 to-orange-500" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <SectionCard title="Performance Band Distribution" subtitle="Number of employees in each performance category." style={{ ...cardStyle, ...animationStyle }}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Outstanding</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">{performanceBands.outstanding}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Strong</span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">{performanceBands.strong}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Developing</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">{performanceBands.developing}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Needs Support</span>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-sm font-semibold text-rose-700">{performanceBands.needsSupport}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Pending</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">{performanceBands.pending}</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Department Averages" subtitle="Average KPI scores by department." style={{ ...cardStyle, ...animationStyle }}>
          <div className="space-y-3">
            {Object.keys(departmentAverages).length === 0 ? (
              <p className="text-sm text-slate-500">No department data available yet.</p>
            ) : (
              Object.entries(departmentAverages).map(([dept, avg]) => (
                <div key={dept} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{dept}</span>
                  <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-semibold text-violet-700">{avg}</span>
                </div>
              ))
            )}
          </div>
        </SectionCard>
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
