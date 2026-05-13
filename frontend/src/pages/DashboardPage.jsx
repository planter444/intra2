import { useEffect, useState } from 'react';
import { Users, ClipboardList, CheckCircle, CalendarDays, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { fetchDashboardSummary } from '../services/dashboardService';
import { useAuth } from '../context/AuthContext';
import { usePagePresentation } from '../hooks/usePagePresentation';

export default function DashboardPage() {
  const { user, settings } = useAuth();
  const [summary, setSummary] = useState(null);
  const canViewOrgMetrics = !['employee', 'supervisor'].includes(user?.role);
  const isCeoDashboard = user?.role === 'ceo';
  const canOpenEmployees = ['supervisor', 'admin', 'ceo'].includes(user?.role);
  const canOpenDocuments = ['employee', 'supervisor', 'admin', 'ceo', 'finance'].includes(user?.role);
  const navigate = useNavigate();
  const roleLabel = user?.roleTitle || (user?.role ? user.role.toUpperCase() : '');
  const leaveSummaryTitle = user?.role === 'ceo' ? 'Leave Types' : 'My Leave Buckets';
  const leaveSummaryHelper = user?.role === 'ceo' ? 'Configured leave types available to the company' : 'Leave balances assigned to you';
  const documentSummaryTitle = user?.role === 'ceo' ? 'Documents' : 'My Documents';
  const documentSummaryHelper = user?.role === 'ceo' ? 'Company documents available to leadership' : 'Secure files available to you';

  useEffect(() => {
    fetchDashboardSummary().then(setSummary).catch(console.error);
  }, []);

  // Animation styles per card so the icon bubble follows the same page load style
  const iconAnim0 = usePagePresentation({ animationOrder: 0 }).animationStyle;
  const iconAnim1 = usePagePresentation({ animationOrder: 1 }).animationStyle;
  const iconAnim2 = usePagePresentation({ animationOrder: 2 }).animationStyle;
  const iconAnim3 = usePagePresentation({ animationOrder: 3 }).animationStyle;
  const iconAnim4 = usePagePresentation({ animationOrder: 4 }).animationStyle;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${settings?.branding?.organizationName || 'KEREA'} ${roleLabel || ''} ${settings?.labels?.dashboardTitleSuffix || 'Dashboard'}`.trim()}
        subtitle={settings?.interface?.dashboardHeroSubtitle}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {isCeoDashboard ? (
          <div className="relative">
            <StatCard title="Total Headcount" value={summary?.headcount ?? '--'} helper="Active non-deleted users" onClick={canOpenEmployees ? () => navigate('/employees') : undefined} />
            <div className="pointer-events-none absolute -right-2 -top-2 rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-500 p-3 text-white shadow-sm sm:right-3 sm:top-3" style={iconAnim0}><Users size={18} /></div>
          </div>
        ) : null}
        {(canViewOrgMetrics || ['employee', 'supervisor'].includes(user?.role)) ? (
          <div className="relative">
            <StatCard title="Pending Leave Actions" value={summary?.pendingLeaves ?? '--'} helper={canViewOrgMetrics ? 'Awaiting executive review' : 'Your requests awaiting decision'} accent="from-amber-600 to-orange-500" onClick={() => navigate('/leaves')} />
            <div className="pointer-events-none absolute -right-2 -top-2 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-500 p-3 text-white shadow-sm sm:right-3 sm:top-3" style={iconAnim1}><ClipboardList size={18} /></div>
          </div>
        ) : null}
        {(canViewOrgMetrics || ['employee', 'supervisor'].includes(user?.role)) ? (
          <div className="relative">
            <StatCard title="Approved Leave Requests" value={summary?.approvedLeaves ?? '--'} helper={canViewOrgMetrics ? 'Completed approvals' : 'Your approved leave requests'} accent="from-blue-700 to-cyan-500" onClick={() => navigate('/leaves')} />
            <div className="pointer-events-none absolute -right-2 -top-2 rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-500 p-3 text-white shadow-sm sm:right-3 sm:top-3" style={iconAnim2}><CheckCircle size={18} /></div>
          </div>
        ) : null}
        <div className="relative">
          <StatCard title={leaveSummaryTitle} value={summary?.myLeaveBalanceTypes ?? '--'} helper={leaveSummaryHelper} accent="from-blue-700 to-cyan-500" onClick={() => navigate('/leaves')} />
          <div className="pointer-events-none absolute -right-2 -top-2 rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-500 p-3 text-white shadow-sm sm:right-3 sm:top-3" style={iconAnim3}><CalendarDays size={18} /></div>
        </div>
        <div className="relative">
          <StatCard title={documentSummaryTitle} value={summary?.myDocuments ?? '--'} helper={documentSummaryHelper} accent="from-violet-700 to-fuchsia-500" onClick={canOpenDocuments ? () => navigate('/documents') : undefined} />
          <div className="pointer-events-none absolute -right-2 -top-2 rounded-2xl bg-gradient-to-br from-violet-700 to-fuchsia-500 p-3 text-white shadow-sm sm:right-3 sm:top-3" style={iconAnim4}><FileText size={18} /></div>
        </div>
      </div>

      <div>
        <SectionCard title={settings?.labels?.dashboardQuickActionsTitle || 'Quick actions'} subtitle={settings?.labels?.dashboardQuickActionsSubtitle || 'Jump straight into the areas you use most often.'}>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className="rounded-2xl bg-brand-gradient px-4 py-4 text-left text-sm font-semibold text-white shadow-lg" onClick={() => navigate('/leaves')}>
              {settings?.labels?.dashboardOpenLeavesText || 'Open leave dashboard'}
            </button>
            <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-700" onClick={() => navigate('/profile')}>
              {settings?.labels?.dashboardOpenProfileText || 'Review my profile'}
            </button>
            {canOpenEmployees ? (
              <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-700" onClick={() => navigate('/employees')}>
                {settings?.labels?.dashboardOpenEmployeesText || 'Manage employees'}
              </button>
            ) : null}
            {canOpenDocuments ? (
              <button type="button" className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-semibold text-slate-700" onClick={() => navigate('/documents')}>
                {settings?.labels?.dashboardOpenDocumentsText || 'Open documents'}
              </button>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
