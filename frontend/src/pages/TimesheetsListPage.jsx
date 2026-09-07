import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Calendar, Clock, CheckCircle2, XCircle, FileText, Filter } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import { useAuth } from '../context/AuthContext';
import { listTimesheets } from '../services/timesheetService';
import { usePagePresentation } from '../hooks/usePagePresentation';

export default function TimesheetsListPage() {
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const { cardStyle, animationStyle } = usePagePresentation();
  
  const [loading, setLoading] = useState(false);
  const [timesheets, setTimesheets] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const isSupervisor = user?.role === 'admin' || user?.role === 'ceo' || (settings?.timesheet?.supervisors || []).includes(String(user?.id));

  useEffect(() => {
    loadTimesheets();
  }, [filterStatus, filterMonth, filterYear]);

  const loadTimesheets = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterMonth) params.month = filterMonth;
      if (filterYear) params.year = filterYear;
      
      console.log('Loading timesheets with params:', params);
      const data = await listTimesheets(params);
      console.log('Timesheets loaded:', data);
      setTimesheets(data || []);
    } catch (error) {
      console.error('Failed to load timesheets:', error);
      console.error('Error response:', error.response?.data);
      setTimesheets([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      draft: 'bg-slate-100 text-slate-700',
      submitted: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-rose-100 text-rose-700'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status] || styles.draft}`}>
        {status ? String(status).charAt(0).toUpperCase() + String(status).slice(1) : 'Draft'}
      </span>
    );
  };

  const columns = [
    {
      key: 'employee_name',
      label: 'Employee',
      render: (value, row) => (
        <div>
          <div className="font-medium text-slate-900">{value || '-'}</div>
          <div className="text-xs text-slate-500">{row?.position_title || '-'}</div>
        </div>
      )
    },
    {
      key: 'period',
      label: 'Period',
      render: (value, row) => `${row?.month || 1}/${row?.year || new Date().getFullYear()}`
    },
    {
      key: 'total_hours',
      label: 'Total Hours',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-slate-500" />
          <span className="font-medium">{value || 0}</span>
        </div>
      )
    },
    {
      key: 'level_of_effort',
      label: 'Level of Effort',
      render: (value) => (
        <div className="flex items-center gap-2">
          <span className={`font-medium ${parseFloat(value || 0) >= 90 ? 'text-emerald-600' : parseFloat(value || 0) >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
            {value || 0}%
          </span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value) => getStatusBadge(value)
    },
    {
      key: 'supervisor_name',
      label: 'Supervisor',
      render: (value) => value || '-'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (value, row) => (
        <div className="flex gap-2">
          <Link
            to={`/timesheets/${row?.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            <FileText size={14} /> View
          </Link>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheets"
        subtitle="Manage monthly timesheets and approvals"
        actions={[
          <Link
            key="new"
            to="/timesheets/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus size={16} /> New Timesheet
          </Link>
        ]}
      />

      <SectionCard title="Filters" style={{ ...cardStyle, ...animationStyle }}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Months</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleDateString('en-US', { month: 'long' })}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Years</option>
              {[2024, 2025, 2026, 2027].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFilterStatus(''); setFilterMonth(''); setFilterYear(''); }}
              className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
            >
              <Filter size={16} className="inline mr-2" /> Clear Filters
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard style={{ ...cardStyle, ...animationStyle }}>
        {loading ? (
          <div className="py-8 text-center text-slate-500">Loading timesheets...</div>
        ) : (
          <DataTable
            columns={columns}
            rows={timesheets || []}
            emptyLabel="No timesheets found"
          />
        )}
      </SectionCard>
    </div>
  );
}
