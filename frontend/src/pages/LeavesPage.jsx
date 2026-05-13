import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Eye, Plus } from 'lucide-react';
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

function CeoLeaveTypeCard({ lt, index, opacity = 1 }) {
  const { animationStyle } = usePagePresentation({ animationOrder: index + 1 });
  return (
    <div className={`rounded-3xl bg-gradient-to-br ${accentClasses[index % accentClasses.length]} p-5 shadow-soft`} style={{ ...animationStyle, opacity }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-700">{lt.label}</p>
          <p className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">{lt.defaultDays}</p>
          <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">default days</p>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 text-slate-700 shadow-sm">
          <CalendarDays size={18} />
        </div>
      </div>
    </div>
  );
}

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

export default function LeavesPage() {
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const isCeo = user?.role === 'ceo';
  const canApplyForLeave = !isCeo;
  const showPersonalHistory = !isCeo;
  const leaveCardsOpacity = Number(settings?.interface?.pageExperience?.leave?.leaveCardsOpacity ?? 1) || 1;

  useEffect(() => {
    Promise.all([fetchLeaveBalances(), fetchLeaveRequests()])
      .then(([balanceItems, requestItems]) => {
        setBalances(balanceItems);
        setRequests(requestItems);
      })
      .catch(console.error);
  }, []);

  const myRequests = useMemo(
    () => requests.filter((request) => String(request.userId) === String(user?.id)),
    [requests, user?.id]
  );

  const externalRequests = useMemo(
    () => requests.filter((request) => String(request.userId) !== String(user?.id)),
    [requests, user?.id]
  );

  const visibleLeaveRequests = useMemo(() => {
    if (user?.role === 'supervisor') {
      return externalRequests.filter((request) => String(request.employeeSupervisorId) === String(user.id));
    }

    if (user?.role === 'admin' || user?.role === 'ceo') {
      return externalRequests;
    }

    return [];
  }, [externalRequests, user]);

  const reviewRequests = useMemo(() => {
    if (user?.role === 'supervisor') {
      return visibleLeaveRequests.filter((request) => request.status === 'pending_supervisor');
    }

    if (user?.role === 'admin' || user?.role === 'ceo') {
      return visibleLeaveRequests.filter((request) => request.status === 'pending_hr' || request.status === 'pending_ceo');
    }

    return [];
  }, [user, visibleLeaveRequests]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={settings?.labels?.leaveModuleTitle || 'Leave Management'}
        subtitle="Track leave balances, request history, approval progress, and incoming review work from one dashboard."
        actions={canApplyForLeave ? [
          <button key="apply" type="button" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg" onClick={() => navigate('/leaves/new')}>
            <span className="inline-flex items-center gap-2"><Plus size={16} />Apply for Leave</span>
          </button>
        ] : undefined}
      />
      {isCeo ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(settings?.leaveTypes || []).map((lt, index) => (
            <CeoLeaveTypeCard key={lt.code || lt.label || index} lt={lt} index={index} opacity={leaveCardsOpacity} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {balances.map((balance, index) => <LeaveBalanceCard key={balance.id} balance={balance} index={index} myRequests={myRequests} opacity={leaveCardsOpacity} />)}
        </div>
      )}

      <div className={showPersonalHistory && user?.role !== 'supervisor' ? 'grid gap-6 lg:grid-cols-[minmax(0,1.15fr),minmax(0,1fr)]' : 'space-y-6'}>
        {showPersonalHistory ? (
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
        ) : null}

        <SectionCard
          title={user?.role === 'supervisor' ? 'Team Leaves' : user?.role === 'ceo' || user?.role === 'admin' ? 'Leaves' : 'Leave status tracker'}
          subtitle={user?.role === 'supervisor'
            ? 'Leave requests from employees who report to you.'
            : user?.role === 'ceo' || user?.role === 'admin'
              ? 'Company leave requests currently visible to you.'
              : 'Follow each request from applied to CEO, with supervisor review included when assigned.'}
        >
          {(user?.role === 'supervisor' || user?.role === 'ceo' || user?.role === 'admin') ? (
            visibleLeaveRequests.length ? (
              <div className="space-y-3">
                {visibleLeaveRequests.map((request) => {
                  const isPending = reviewRequests.some((entry) => entry.id === request.id);

                  return (
                    <div key={request.id} className={`rounded-2xl border px-4 py-4 ${isPending ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">{request.employeeName}</p>
                          <p className="text-sm text-slate-500">{request.leaveTypeLabel} · {formatDateRangeDisplay(request.startDate, request.endDate)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isPending ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                            {formatStatusLabel(request.status)}
                          </span>
                          <button type="button" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => navigate(`/leaves/${request.id}`)}>
                            <Eye size={16} />View
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No leave requests available" description="Leave requests from your visible team scope will appear here." />
            )
          ) : myRequests.length ? (
            <div className="space-y-4">
              {myRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{request.leaveTypeLabel}</p>
                      <p className="text-sm text-slate-500">{formatDateRangeDisplay(request.startDate, request.endDate)}</p>
                    </div>
                    <button type="button" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600" onClick={() => navigate(`/leaves/${request.id}`)}>
                      <Eye size={16} />View
                    </button>
                  </div>
                  <LeaveStatusTimeline request={request} compact />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No tracked leave requests" description="Once you submit a leave request, its workflow progress will appear here." />
          )}
        </SectionCard>
      </div>

      {!balances.length && !myRequests.length && !visibleLeaveRequests.length ? <EmptyState title="No leave records yet" description="Leave balances and request history will appear here when available." /> : null}
    </div>
  );
}
