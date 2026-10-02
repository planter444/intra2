import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, ArrowRight, CalendarDays, Eye } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import LeaveStatusTimeline from '../components/LeaveStatusTimeline';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { fetchLeaveBalances, fetchLeaveRequests } from '../services/leaveService';
import { formatDateRangeDisplay, formatStatusLabel } from '../utils/formatters';
import { getAvailableBalanceDays } from '../utils/leave';

const accentClasses = [
  'from-blue-600/15 to-blue-100',
  'from-emerald-600/15 to-emerald-100',
  'from-fuchsia-600/15 to-fuchsia-100',
  'from-amber-500/15 to-amber-100',
  'from-rose-500/15 to-rose-100',
  'from-cyan-500/15 to-cyan-100'
];

function LeaveBalanceCard({ balance, index, myRequests, opacity = 1 }) {
  const { animationStyle } = usePagePresentation({ animationOrder: index + 1 });

  return (
    <div key={balance.id} className={`rounded-3xl bg-gradient-to-br ${accentClasses[index % accentClasses.length]} p-5 shadow-soft`} style={{ ...animationStyle, opacity }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">{balance.label}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">{getAvailableBalanceDays(balance, myRequests)}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">of {balance.defaultDays} days remaining</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 text-slate-700 shadow-sm">
          <CalendarDays size={18} />
        </div>
      </div>
    </div>
  );
}

export default function CeoMyLeavePage() {
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const leaveCardsOpacity = Number(settings?.interface?.pageExperience?.leave?.leaveCardsOpacity ?? 1) || 1;

  useEffect(() => {
    const refreshLeaveData = () => {
      Promise.all([fetchLeaveBalances(), fetchLeaveRequests()])
        .then(([balanceItems, requestItems]) => {
          setBalances(balanceItems);
          setRequests(requestItems);
        })
        .catch((error) => {
          if (error.response?.status !== 429) {
            console.error(error);
          }
        });
    };

    refreshLeaveData();
    const intervalId = window.setInterval(refreshLeaveData, 60000);
    window.addEventListener('focus', refreshLeaveData);
    window.addEventListener('leave-requests-updated', refreshLeaveData);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshLeaveData);
      window.removeEventListener('leave-requests-updated', refreshLeaveData);
    };
  }, []);

  const myRequests = useMemo(
    () => requests.filter((request) => String(request.userId) === String(user?.id)),
    [requests, user?.id]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for Leave"
        subtitle="View your leave balances and submit leave requests."
        actions={[
          <button key="apply" type="button" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg" onClick={() => navigate('/leaves/new')}>
            <span className="inline-flex items-center gap-2"><Plus size={16} />Apply for Leave</span>
          </button>,
          <Link key="management" to="/leaves" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <span className="inline-flex items-center gap-2"><Eye size={16} />Leave Management</span>
          </Link>
        ]}
      />
      
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {balances.map((balance, index) => <LeaveBalanceCard key={balance.id} balance={balance} index={index} myRequests={myRequests} opacity={leaveCardsOpacity} />)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)]">
        <SectionCard title="My leave history" subtitle="Your submitted leave requests and current statuses.">
          {myRequests.length ? (
            <div className="space-y-3">
              {myRequests.map((request) => (
                <button key={request.id} type="button" className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left hover:border-emerald-200 hover:bg-emerald-50/40" onClick={() => navigate(`/leaves/${request.id}`)}>
                  <div>
                    <p className="font-medium text-slate-900">{request.leaveTypeLabel}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateRangeDisplay(request.startDate, request.endDate)} ({request.daysRequested} day(s))</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${request.status.startsWith('pending') ? 'bg-amber-100 text-amber-700' : request.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : request.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                      {formatStatusLabel(request.status)}
                    </span>
                    <ArrowRight size={16} className="text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No leave history yet" description="Your submitted leave requests will appear here once you apply." />
          )}
        </SectionCard>

        <SectionCard
          title="Leave status tracker"
          subtitle="Follow each request from applied to approved."
        >
          {myRequests.length ? (
            <div className="space-y-4">
              {myRequests.map((request) => (
                <LeaveStatusTimeline key={request.id} request={request} actingHrLabel="Chairperson" />
              ))}
            </div>
          ) : (
            <EmptyState title="No leave requests to track" description="Your leave request statuses will appear here." />
          )}
        </SectionCard>
      </div>
    </div>
  );
}
