import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Eye, Pencil, Trash2 } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import {
  cancelLeaveRequest,
  decideLeaveRequest,
  downloadLeaveSupportingDocument,
  fetchLeaveBalances,
  fetchLeaveRequest,
  fetchLeaveRequests,
  fetchLeaveTypes,
  previewLeaveSupportingDocument,
  updateLeaveRequest
} from '../services/leaveService';
import { countKenyaLeaveDays } from '../utils/leaveCalendar';
import { formatDateRangeDisplay, formatDateTimeDisplay, formatStatusLabel, normalizeDateInput } from '../utils/formatters';
import { getAvailableBalanceDays } from '../utils/leave';

const getStatusBadgeClassName = (status) => {
  if (status === 'approved') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (status === 'rejected' || status === 'cancelled') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-amber-100 text-amber-700';
};

const getDecisionBadgeClassName = (decision) => {
  if (decision === 'approved') {
    return 'bg-emerald-100 text-emerald-700';
  }

  if (decision === 'rejected') {
    return 'bg-rose-100 text-rose-700';
  }

  return 'bg-slate-100 text-slate-600';
};

const getDecisionLabel = (decision) => {
  if (decision === 'approved') {
    return 'Approved';
  }

  if (decision === 'rejected') {
    return 'Rejected';
  }

  return 'Pending';
};

const accentClasses = [
  'from-blue-600/15 to-blue-100',
  'from-emerald-600/15 to-emerald-100',
  'from-fuchsia-600/15 to-fuchsia-100',
  'from-amber-500/15 to-amber-100',
  'from-rose-500/15 to-rose-100',
  'from-cyan-500/15 to-cyan-100'
];

const calculateRequestedDays = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 0;
  }

  return countKenyaLeaveDays(startDate, endDate);
};

const getToday = () => new Date().toISOString().split('T')[0];

export default function LeaveRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [request, setRequest] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ leaveTypeCode: '', startDate: '', endDate: '', reason: '', supportingDocument: null });
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [decisionModal, setDecisionModal] = useState({ open: false, decision: '', comment: '' });
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [requestData, types, balanceItems, requestItems] = await Promise.all([
        fetchLeaveRequest(id),
        fetchLeaveTypes(),
        fetchLeaveBalances(),
        fetchLeaveRequests()
      ]);
      setRequest(requestData);
      setLeaveTypes(types);
      setBalances(balanceItems);
      setRequests(requestItems.filter((entry) => String(entry.userId) === String(requestData.userId)));
      setForm({
        leaveTypeCode: requestData.leaveTypeCode,
        startDate: normalizeDateInput(requestData.startDate),
        endDate: normalizeDateInput(requestData.endDate),
        reason: requestData.reason || '',
        supportingDocument: null
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to load leave request',
        description: error.response?.data?.message || 'Please refresh and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData().catch(() => null);
  }, [id]);

  const selectedBalance = useMemo(
    () => balances.find((item) => item.code === form.leaveTypeCode),
    [balances, form.leaveTypeCode]
  );
  const hasSupervisorStage = Boolean(
    request?.requiresSupervisorReview
    || request?.status === 'pending_supervisor'
    || request?.supervisorApproverId
  );
  const isCeoSupervisor = request?.supervisorApproverRole === 'ceo';
  const visibleSupervisorStage = hasSupervisorStage && !isCeoSupervisor;

  const requestedDays = useMemo(
    () => calculateRequestedDays(form.startDate, form.endDate),
    [form.endDate, form.startDate]
  );

  const projectedRemaining = useMemo(() => {
    if (!selectedBalance) {
      return 0;
    }

    const availableBalance = getAvailableBalanceDays(selectedBalance, requests, request?.id);

    if (!requestedDays) {
      return availableBalance;
    }

    return availableBalance - requestedDays;
  }, [request?.id, requestedDays, requests, selectedBalance]);

  const isRequestOwner = request && String(request.userId) === String(user?.id);
  const canEditOrCancel = useMemo(() => {
    if (!request || String(request.userId) !== String(user?.id)) {
      return false;
    }

    if (request.status === 'pending_supervisor') {
      return true;
    }

    return request.status === 'pending_hr' && !hasSupervisorStage && !request.hrApproverId && !request.ceoApproverId;
  }, [hasSupervisorStage, request, user?.id]);

  const canSupervisorReview = request
    && !isRequestOwner
    && request.status === 'pending_supervisor'
    && (
      String(request.supervisorApproverId) === String(user?.id)
      || String(request.employeeSupervisorId) === String(user?.id)
    );
  const canOperationalReview = request && !isRequestOwner && (user?.role === 'admin' || user?.role === 'ceo') && request.status === 'pending_hr';
  const canFinalCeoReview = request && !isRequestOwner && user?.role === 'ceo' && request.status === 'pending_ceo';
  const canReviseSupervisorDecision = request
    && !isRequestOwner
    && user?.role !== 'ceo'
    && ['pending_ceo', 'rejected'].includes(request.status)
    && String(request.supervisorApproverId) === String(user?.id)
    && request.supervisorApproverRole !== 'ceo'
    && !request.ceoApproverId;
  const canReviseCeoDecision = request && !isRequestOwner && user?.role === 'ceo' && ['approved', 'rejected'].includes(request.status) && String(request.ceoApproverId) === String(user?.id);
  const timeline = request?.timeline || {
    submitted: { label: 'Applied', time: request?.createdAt, actorName: request?.employeeName },
    supervisor: visibleSupervisorStage ? { label: 'Supervisor', time: null, actorName: request?.supervisorApproverName, comment: request?.supervisorComment, decision: null } : null,
    ceo: {
      label: 'CEO',
      time: request?.ceoTime || request?.supervisorTime || null,
      actorName: isCeoSupervisor ? (request?.ceoApproverName || request?.supervisorApproverName || request?.hrApproverName) : (request?.ceoApproverName || request?.hrApproverName),
      comment: isCeoSupervisor ? (request?.ceoComment || request?.supervisorComment || request?.hrComment) : (request?.ceoComment || request?.hrComment),
      decision: null
    }
  };
  const hasUnsavedChanges = useMemo(
    () => editing && (
      form.leaveTypeCode !== (request?.leaveTypeCode || '')
      || form.startDate !== normalizeDateInput(request?.startDate)
      || form.endDate !== normalizeDateInput(request?.endDate)
      || form.reason !== (request?.reason || '')
      || Boolean(form.supportingDocument)
    ),
    [editing, form, request]
  );

  useUnsavedChangesGuard(hasUnsavedChanges);

  const validateEdit = () => {
    if (!form.leaveTypeCode || !form.startDate || !form.endDate || !form.reason.trim()) {
      return 'Leave type, dates, and reason are required.';
    }

    if (form.startDate < getToday()) {
      return 'Leave requests cannot start in the past.';
    }

    if (form.endDate < form.startDate) {
      return 'End date cannot be earlier than start date.';
    }

    if (!selectedBalance) {
      return 'No leave balance was found for the selected leave type.';
    }

    if (!requestedDays) {
      return 'Please select a valid date range.';
    }

    if (requestedDays > Number(selectedBalance.defaultDays || 0)) {
      return `This request exceeds the allocated ${selectedBalance.defaultDays} days for ${selectedBalance.label}.`;
    }

    if (requestedDays > getAvailableBalanceDays(selectedBalance, requests, request?.id)) {
      return `You only have ${getAvailableBalanceDays(selectedBalance, requests, request?.id)} remaining day(s) for ${selectedBalance.label}.`;
    }

    if (form.supportingDocument) {
      if (form.supportingDocument.size > 10 * 1024 * 1024) {
        return 'Supporting documents must not exceed 10 MB.';
      }
    }

    return '';
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const errorMessage = validateEdit();

    if (errorMessage) {
      setNotice({ open: true, title: 'Leave request error', description: errorMessage });
      return;
    }

    try {
      const updated = await updateLeaveRequest(id, form);
      setRequest(updated);
      setEditing(false);
      setNotice({ open: true, title: 'Leave request updated', description: 'Your leave request has been updated successfully.' });
      await loadData();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Leave request error',
        description: error.response?.data?.message || 'Unable to update this leave request.'
      });
    }
  };

  const handleCancelRequest = async () => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    try {
      await cancelLeaveRequest(id);
      navigate('/leaves', { replace: true });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Leave request error',
        description: error.response?.data?.message || 'Unable to cancel this leave request.'
      });
    }
  };

  const handleDecision = async () => {
    if (decisionSubmitting) {
      return;
    }

    try {
      setDecisionSubmitting(true);
      const updated = await decideLeaveRequest(id, { decision: decisionModal.decision, comment: decisionModal.comment });
      setRequest(updated);
      setDecisionModal({ open: false, decision: '', comment: '' });
      setNotice({
        open: true,
        title: decisionModal.decision === 'approve' ? 'Leave approved successfully' : 'Leave rejected successfully',
        description: decisionModal.decision === 'approve' ? 'The leave request has been approved successfully.' : 'The leave request has been rejected successfully.'
      });
      await loadData();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Leave decision error',
        description: error.response?.data?.message || 'Unable to complete this leave action.'
      });
    } finally {
      setDecisionSubmitting(false);
    }
  };

  if (loading) {
    return <div className="rounded-3xl bg-white p-8 text-sm text-slate-500 shadow-soft">Loading leave request...</div>;
  }

  if (!request) {
    return <EmptyState title="Leave request not found" description="The selected leave request could not be found or is no longer available." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Request Details"
        subtitle={`Request ID #${request.id}`}
        actions={[
          <span key="status" className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold ${getStatusBadgeClassName(request.status)}`}>
            {formatStatusLabel(request.status)}
          </span>,
          <button key="back" type="button" onClick={() => navigate('/leaves')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-2"><ArrowLeft size={16} />Back to leave dashboard</span>
          </button>
        ]}
      />

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,2fr),minmax(340px,0.75fr)]">
        <SectionCard
          title="Leave information"
          subtitle={editing ? 'Update the leave request before any superior review is completed.' : 'Review the selected leave request details and current status.'}
          actions={[
            canEditOrCancel && !editing ? (
              <button key="edit" type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setEditing(true)}>
                <span className="inline-flex items-center gap-2"><Pencil size={16} />Edit</span>
              </button>
            ) : null,
            canEditOrCancel ? (
              <button key="cancel" type="button" className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700" onClick={handleCancelRequest}>
                <span className="inline-flex items-center gap-2"><Trash2 size={16} />Cancel request</span>
              </button>
            ) : null,
          ].filter(Boolean)}
        >
          {editing ? (
            <form className="space-y-5" onSubmit={handleSave}>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Leave type</label>
                <select value={form.leaveTypeCode} onChange={(event) => setForm((current) => ({ ...current, leaveTypeCode: event.target.value }))}>
                  {leaveTypes.map((type) => {
                    const balance = balances.find((item) => item.code === type.code);
                    return <option key={type.code} value={type.code}>{`${type.label} (${getAvailableBalanceDays(balance, requests, request?.id)} day(s) remaining)`}</option>;
                  })}
                </select>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Start date</label>
                  <input type="date" min={getToday()} value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">End date</label>
                  <input type="date" min={form.startDate || getToday()} value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-3 rounded-2xl bg-slate-50 px-4 py-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Remaining balance</p>
                  <p className={`mt-1 text-lg font-semibold ${projectedRemaining < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{selectedBalance ? projectedRemaining : '--'} day(s)</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Requested days</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">{requestedDays || 0} day(s)</p>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Reason</label>
                <textarea rows="5" className="bg-slate-50" placeholder="please provide reason for your leave request..." value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Supporting document (optional)</label>
                <input type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp" onChange={(event) => setForm((current) => ({ ...current, supportingDocument: event.target.files?.[0] || null }))} />
                <p className="mt-2 text-xs text-slate-400">Supporting documents, medical certificate, etc</p>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setEditing(false)}>
                  Cancel edit
                </button>
                <button type="submit" className="rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-lg">
                  Save changes
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <div className={`rounded-3xl bg-gradient-to-br ${accentClasses[0]} p-5 shadow-soft`}>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Employee</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{request.employeeName}</p>
                  <p className="text-sm text-slate-500">{request.employeeNo || 'No employee number'}</p>
                  <p className="text-sm text-slate-500">{request.employeePositionTitle || 'No position title'}</p>
                  <p className="text-sm text-slate-500">{request.employeeDepartmentName || 'Not assigned'}</p>
                </div>
                <div className={`rounded-3xl bg-gradient-to-br ${accentClasses[1]} p-5 shadow-soft`}>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Leave Type</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{request.leaveTypeLabel}</p>
                  <p className="mt-1 text-sm text-slate-500">{request.daysRequested} day(s)</p>
                </div>
                <div className={`col-span-2 rounded-3xl bg-gradient-to-br ${accentClasses[2]} p-5 shadow-soft lg:col-span-1`}>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Duration</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{formatDateRangeDisplay(request.startDate, request.endDate)}</p>
                  <p className="text-sm text-slate-500">{request.daysRequested} day(s)</p>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Reason</p>
                <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">{request.reason || 'No reason provided.'}</p>
              </div>
              {request.supportingDocumentName ? (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Supporting document</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700" onClick={() => previewLeaveSupportingDocument(request.id)}>
                      <span className="inline-flex items-center gap-2"><Eye size={16} />{request.supportingDocumentName}</span>
                    </button>
                    <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700" onClick={() => downloadLeaveSupportingDocument(request.id)}>
                      <span className="inline-flex items-center gap-2"><Download size={16} />Download</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          {(canSupervisorReview || canOperationalReview || canFinalCeoReview || canReviseSupervisorDecision || canReviseCeoDecision) ? (
            <SectionCard title={canReviseSupervisorDecision || canReviseCeoDecision ? 'Update Decision' : 'Take Action'} subtitle={canReviseSupervisorDecision || canReviseCeoDecision ? 'Switch the recorded decision for this leave request.' : 'Approve or reject this request with an optional comment.'}>
              {canReviseSupervisorDecision || canReviseCeoDecision ? (
                <button type="button" className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white ${request.status === 'rejected' ? 'bg-emerald-600' : 'bg-rose-600'}`} onClick={() => setDecisionModal({ open: true, decision: request.status === 'rejected' ? 'approve' : 'reject', comment: canReviseSupervisorDecision ? request.supervisorComment || '' : request.ceoComment || '' })}>
                  {request.status === 'rejected' ? 'Mark as Approved' : 'Mark as Rejected'}
                </button>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  <button type="button" className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white" onClick={() => setDecisionModal({ open: true, decision: 'approve', comment: '' })}>
                    Approve
                  </button>
                  <button type="button" className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white" onClick={() => setDecisionModal({ open: true, decision: 'reject', comment: '' })}>
                    Reject
                  </button>
                </div>
              )}
            </SectionCard>
          ) : null}

          <SectionCard title="Approval timeline" subtitle="Track the current stage of this leave request.">
            <div className="space-y-4">
              {[timeline.submitted, timeline.supervisor, timeline.ceo].filter(Boolean).map((entry) => (
                <div key={entry.label} className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                  <div>
                    <p className="font-medium text-slate-900">{entry.label}</p>
                    <p className="mt-1 text-sm text-slate-500">{formatDateTimeDisplay(entry.time)}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getDecisionBadgeClassName(entry.decision)}`}>
                    {getDecisionLabel(entry.decision)}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className={`grid gap-6 ${timeline.supervisor ? 'xl:grid-cols-2' : ''}`}>
        {timeline.supervisor ? (
          <SectionCard title="Supervisor Review" subtitle="Latest supervisor review details for this leave request.">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Reviewer</p>
                  <p className="mt-1 font-medium text-slate-900">{timeline.supervisor.actorName || 'Pending'}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getDecisionBadgeClassName(timeline.supervisor.decision)}`}>
                  {getDecisionLabel(timeline.supervisor.decision)}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Reviewed on</p>
                <p className="mt-1 text-sm text-slate-700">{formatDateTimeDisplay(timeline.supervisor.time)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Comment</p>
                <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">{timeline.supervisor.comment || 'No comment added yet.'}</p>
              </div>
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title="CEO Review" subtitle="Latest CEO review details for this leave request.">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Reviewer</p>
                <p className="mt-1 font-medium text-slate-900">{timeline.ceo.actorName || 'Pending'}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getDecisionBadgeClassName(timeline.ceo.decision)}`}>
                {getDecisionLabel(timeline.ceo.decision)}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Reviewed on</p>
              <p className="mt-1 text-sm text-slate-700">{formatDateTimeDisplay(timeline.ceo.time)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Comment</p>
              <p className="mt-2 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">{timeline.ceo.comment || 'No comment added yet.'}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <Modal
        open={notice.open}
        title={notice.title}
        description={notice.description}
        onClose={() => setNotice({ open: false, title: '', description: '' })}
        actions={[
          <button key="close" type="button" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white" onClick={() => setNotice({ open: false, title: '', description: '' })}>
            Close
          </button>
        ]}
      />

      <Modal
        open={decisionModal.open}
        title={decisionModal.decision === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
        description="Add an optional comment before confirming this leave action."
        onClose={() => setDecisionModal({ open: false, decision: '', comment: '' })}
        actions={[
          <button key="cancel" type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => setDecisionModal({ open: false, decision: '', comment: '' })}>
            Cancel
          </button>,
          <button key="confirm" type="button" disabled={decisionSubmitting} className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70" onClick={handleDecision}>
            {decisionSubmitting ? 'Saving...' : decisionModal.decision === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
          </button>
        ]}
      >
        <textarea rows="5" placeholder="Add a comment..." value={decisionModal.comment} onChange={(event) => setDecisionModal((current) => ({ ...current, comment: event.target.value }))} />
      </Modal>
    </div>
  );
}
