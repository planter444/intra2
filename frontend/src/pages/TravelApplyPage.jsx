import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { createTravelRequest, fetchTravelRequests } from '../services/travelService';

const initialForm = {
  startDate: '',
  endDate: '',
  origin: '',
  destination: '',
  reason: '',
  estimatedCost: ''
};

const getToday = () => new Date().toISOString().split('T')[0];

export default function TravelApplyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [submittedRequestId, setSubmittedRequestId] = useState(null);

  useEffect(() => {
    fetchTravelRequests()
      .then((items) => {
        setRequests(items.filter((request) => String(request.userId) === String(user?.id)));
      })
      .catch((error) => {
        setNotice({
          open: true,
          title: 'Unable to load travel data',
          description: error.response?.data?.message || 'Please refresh and try again.'
        });
      });
  }, [user?.id]);

  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(initialForm);

  useUnsavedChangesGuard(hasUnsavedChanges && !submitting && !submittedRequestId);

  const validate = () => {
    if (user?.role === 'ceo') {
      return 'CEO accounts cannot apply for travel requests.';
    }

    if (!form.startDate || !form.endDate || !form.origin.trim() || !form.destination.trim() || !form.reason.trim()) {
      return 'Start date, end date, origin, destination, and reason are required.';
    }

    if (form.endDate < form.startDate) {
      return 'End date cannot be earlier than start date.';
    }

    if (form.estimatedCost && isNaN(parseFloat(form.estimatedCost))) {
      return 'Estimated cost must be a valid number.';
    }

    return '';
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errorMessage = validate();

    if (errorMessage) {
      setNotice({ open: true, title: 'Travel request error', description: errorMessage });
      return;
    }

    try {
      setSubmitting(true);
      const request = await createTravelRequest({
        ...form,
        estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : null
      });
      setSubmittedRequestId(request.id);
      setNotice({
        open: true,
        title: 'Travel request submitted',
        description: 'Your travel request has been submitted successfully and sent for approval.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Travel request error',
        description: error.response?.data?.message || 'Unable to submit your travel request.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Apply for Travel"
        subtitle="Submit a new travel request with your travel details and estimated cost."
        actions={[
          <button key="back" type="button" onClick={() => navigate('/travel')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            Back to travel dashboard
          </button>
        ]}
      />

      <SectionCard title="Travel request form" subtitle="Enter your travel details including dates, route, reason, and estimated cost.">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Start date</label>
              <input
                type="date"
                value={form.startDate}
                min={getToday()}
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
                min={form.startDate || getToday()}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Origin (departure)</label>
              <input
                type="text"
                className="bg-slate-50"
                placeholder="e.g., Nairobi Office"
                value={form.origin}
                onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Destination</label>
              <input
                type="text"
                className="bg-slate-50"
                placeholder="e.g., Mombasa Branch"
                value={form.destination}
                onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Estimated cost (optional)</label>
            <input
              type="number"
              className="bg-slate-50"
              placeholder="e.g., 50000"
              value={form.estimatedCost}
              onChange={(event) => setForm((current) => ({ ...current, estimatedCost: event.target.value }))}
              min="0"
              step="0.01"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Reason for travel</label>
            <textarea
              rows="5"
              className="bg-slate-50"
              placeholder="Please provide the reason for your travel request..."
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              required
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => navigate('/travel')}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60">
              {submitting ? 'Submitting...' : 'Submit Travel Request'}
            </button>
          </div>
        </form>
      </SectionCard>

      <Modal
        open={notice.open}
        title={notice.title}
        description={notice.description}
        onClose={() => {
          if (submittedRequestId) {
            navigate(`/travel/${submittedRequestId}`);
            return;
          }
          setNotice({ open: false, title: '', description: '' });
        }}
        actions={[
          <button key="close" type="button" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white" onClick={() => {
            if (submittedRequestId) {
              navigate(`/travel/${submittedRequestId}`);
              return;
            }
            setNotice({ open: false, title: '', description: '' });
          }}>
            {submittedRequestId ? 'View request' : 'Close'}
          </button>
        ]}
      />
    </div>
  );
}
