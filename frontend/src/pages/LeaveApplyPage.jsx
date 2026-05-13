import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { createLeaveRequest, fetchLeaveBalances, fetchLeaveRequests, fetchLeaveTypes } from '../services/leaveService';
import { countKenyaLeaveDays } from '../utils/leaveCalendar';
import { getAvailableBalanceDays } from '../utils/leave';

const initialForm = {
  leaveTypeCode: '',
  startDate: '',
  endDate: '',
  reason: '',
  supportingDocument: null
};

const getToday = () => new Date().toISOString().split('T')[0];

const calculateRequestedDays = (startDate, endDate) => {
  if (!startDate) {
    return 0;
  }

  return countKenyaLeaveDays(startDate, endDate || startDate);
};

export default function LeaveApplyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });

  useEffect(() => {
    Promise.all([fetchLeaveTypes(), fetchLeaveBalances(), fetchLeaveRequests()])
      .then(([types, balanceItems, requestItems]) => {
        setLeaveTypes(types);
        setBalances(balanceItems);
        setRequests(requestItems.filter((request) => String(request.userId) === String(user?.id)));
        setForm((current) => ({
          ...current,
          leaveTypeCode: current.leaveTypeCode || types[0]?.code || ''
        }));
      })
      .catch((error) => {
        setNotice({
          open: true,
          title: 'Unable to load leave data',
          description: error.response?.data?.message || 'Please refresh and try again.'
        });
      });
  }, [user?.id]);

  const selectedBalance = useMemo(
    () => balances.find((item) => item.code === form.leaveTypeCode),
    [balances, form.leaveTypeCode]
  );

  const selectedLeaveType = useMemo(
    () => leaveTypes.find((item) => item.code === form.leaveTypeCode) || null,
    [form.leaveTypeCode, leaveTypes]
  );

  const requestedDays = useMemo(
    () => calculateRequestedDays(form.startDate, form.endDate),
    [form.endDate, form.startDate]
  );

  const projectedRemaining = useMemo(() => {
    if (!selectedBalance) {
      return 0;
    }

    const availableBalance = getAvailableBalanceDays(selectedBalance, requests);

    if (!requestedDays) {
      return availableBalance;
    }

    return availableBalance - requestedDays;
  }, [requestedDays, requests, selectedBalance]);

  const pristineForm = useMemo(
    () => ({ ...initialForm, leaveTypeCode: leaveTypes[0]?.code || '' }),
    [leaveTypes]
  );

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify({ ...form, supportingDocument: form.supportingDocument ? form.supportingDocument.name : null }) !== JSON.stringify(pristineForm),
    [form, pristineForm]
  );

  useUnsavedChangesGuard(hasUnsavedChanges && !submitting);

  const validate = () => {
    if (user?.role === 'ceo') {
      return 'CEO accounts cannot apply for leave.';
    }

    if (!form.leaveTypeCode || !form.startDate || !form.endDate || !form.reason.trim()) {
      return 'Leave type, dates, and reason are required.';
    }

    if (form.endDate < form.startDate) {
      return 'End date cannot be earlier than start date.';
    }

    if (!selectedBalance) {
      return 'No leave balance was found for the selected leave type.';
    }

    if (selectedLeaveType?.requiresDocument && !form.supportingDocument) {
      return `${selectedLeaveType.label} requires a supporting document.`;
    }

    if (!requestedDays) {
      return 'Please select a valid date range.';
    }

    if (requestedDays > Number(selectedBalance.defaultDays || 0)) {
      return `This request exceeds the allocated ${selectedBalance.defaultDays} days for ${selectedBalance.label}.`;
    }

    if (requestedDays > getAvailableBalanceDays(selectedBalance, requests)) {
      return `You only have ${getAvailableBalanceDays(selectedBalance, requests)} remaining day(s) for ${selectedBalance.label}.`;
    }

    if (form.supportingDocument) {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/jpeg',
        'image/png',
        'image/webp'
      ];

      if (!allowedTypes.includes(form.supportingDocument.type)) {
        return 'Supporting documents must be PDF, DOC, DOCX, or image files.';
      }

      if (form.supportingDocument.size > 10 * 1024 * 1024) {
        return 'Supporting documents must not exceed 10 MB.';
      }
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errorMessage = validate();

    if (errorMessage) {
      setNotice({ open: true, title: 'Leave request error', description: errorMessage });
      return;
    }

    try {
      setSubmitting(true);
      const request = await createLeaveRequest(form);
      navigate(`/leaves/${request.id}`);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Leave request error',
        description: error.response?.data?.message || 'Unable to submit your leave request.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for Leave"
        subtitle="Submit a new leave request with live balance guidance before it moves through approval."
        actions={[
          <button key="back" type="button" onClick={() => navigate('/leaves')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            Back to leave dashboard
          </button>
        ]}
      />

      {!leaveTypes.length ? (
        <EmptyState title="No leave types available" description="There are no active leave types configured for your account yet." />
      ) : (
        <SectionCard title="Leave request form" subtitle="Choose your leave type, dates, reason, and optional supporting document.">
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Leave type</label>
              <select value={form.leaveTypeCode} onChange={(event) => setForm((current) => ({ ...current, leaveTypeCode: event.target.value }))}>
                {leaveTypes.map((type) => {
                  const balance = balances.find((item) => item.code === type.code);
                  return (
                    <option key={type.code} value={type.code}>
                      {`${type.label} (${getAvailableBalanceDays(balance, requests)} day(s) remaining)`}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Start date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => {
                    const nextStart = event.target.value;
                    const nextEnd = current.endDate && current.endDate >= nextStart ? current.endDate : nextStart;
                    return { ...current, startDate: nextStart, endDate: nextEnd };
                  })}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">End date</label>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                  required
                />
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
              <textarea
                rows="5"
                className="bg-slate-50"
                placeholder="please provide reason for your leave request..."
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Supporting document {selectedLeaveType?.requiresDocument ? '(required)' : '(optional)'}</label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                <Upload size={24} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Click to upload PDF, DOC, DOCX, or image files</p>
                  <p className="mt-1 text-xs text-slate-400">{selectedLeaveType?.requiresDocument ? 'A supporting document is mandatory for this leave type.' : 'Supporting documents, medical certificate, etc'}</p>
                  <p className="mt-1 text-xs text-slate-400">Maximum file size: 10 MB</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                  onChange={(event) => setForm((current) => ({ ...current, supportingDocument: event.target.files?.[0] || null }))}
                />
              </label>
              {form.supportingDocument ? (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <span>{form.supportingDocument.name}</span>
                  <button type="button" className="text-slate-500" onClick={() => setForm((current) => ({ ...current, supportingDocument: null }))}>
                    <X size={16} />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => navigate('/leaves')}>
                Cancel
              </button>
              <button type="submit" disabled={submitting} className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60">
                {submitting ? 'Submitting...' : 'Submit Leave Request'}
              </button>
            </div>
          </form>
        </SectionCard>
      )}

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
    </div>
  );
}
