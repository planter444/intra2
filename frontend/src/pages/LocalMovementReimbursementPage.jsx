import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Trash2, Calendar, MapPin, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { createTravelRequest } from '../services/travelService';
import { fetchSettings } from '../services/settingsService';

export default function LocalMovementReimbursementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [settings, setSettings] = useState(null);
  const [receipts, setReceipts] = useState([]);

  const [form, setForm] = useState({
    travelType: 'reimbursement',
    travelCategory: 'Local Movement',
    projectProgramme: '',
    travelDate: '',
    origin: '',
    destination: '',
    estimatedCost: '',
    currency: 'KES',
    reason: '',
    receipts: [],
    referenceNumber: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch (error) {
      console.warn('Failed to load settings:', error.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        ...form,
        userId: user.id,
        travelCategory: 'Local Movement',
        startDate: form.travelDate,
        endDate: form.travelDate,
        estimatedCost: parseFloat(form.estimatedCost) || 0,
        receipts: receipts.map(r => r.name)
      };

      await createTravelRequest(payload);
      setNotice({
        open: true,
        title: 'Local movement reimbursement submitted',
        description: 'Your local movement reimbursement request has been submitted successfully.'
      });
      setTimeout(() => navigate('/travel/local'), 2000);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to submit reimbursement',
        description: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReceiptUpload = (e) => {
    const files = Array.from(e.target.files);
    const newReceipts = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: (file.size / 1024).toFixed(2) + ' KB'
    }));
    setReceipts([...receipts, ...newReceipts]);
  };

  const handleRemoveReceipt = (id) => {
    setReceipts(receipts.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Movement Reimbursement"
        subtitle="Submit local movement expenses for reimbursement with receipt uploads. Total cost required."
        actions={[
          <button
            key="back"
            type="button"
            onClick={() => navigate('/travel/local')}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        ]}
      />

      <SectionCard title="Local Movement Reimbursement Details" subtitle="Fill in the local movement details and upload receipts for reimbursement.">
        <form className="space-y-5" onSubmit={handleSubmit}>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Project / Programme / Activity</label>
            <select
              value={form.projectProgramme}
              onChange={(event) => setForm((current) => ({ ...current, projectProgramme: event.target.value }))}
              className="bg-slate-50"
              required
            >
              <option value="">Select project/programme</option>
              {(settings?.travel?.projects || ['CWF', 'KEREA', 'WRI', 'CLASP', 'GIZ', 'GOGLA']).map((project) => (
                <option key={project} value={project}>{project}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Travel Date</label>
            <input
              type="date"
              value={form.travelDate}
              onChange={(event) => setForm((current) => ({ ...current, travelDate: event.target.value }))}
              className="bg-slate-50"
              required
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Origin (Departure)</label>
              <input
                type="text"
                value={form.origin}
                onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
                placeholder="Starting location"
                className="bg-slate-50"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Destination</label>
              <input
                type="text"
                value={form.destination}
                onChange={(event) => setForm((current) => ({ ...current, destination: event.target.value }))}
                placeholder="Destination location"
                className="bg-slate-50"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Total Cost to be Reimbursed</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {form.currency === 'KES' ? 'KES' : form.currency}
                </span>
                <input
                  type="number"
                  value={form.estimatedCost}
                  onChange={(event) => setForm((current) => ({ ...current, estimatedCost: event.target.value }))}
                  placeholder="0.00"
                  className="bg-slate-50 pl-16"
                  required
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Total amount for local movement reimbursement</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Currency</label>
              <select
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
                className="bg-slate-50"
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Reason for Travel</label>
            <textarea
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Provide details about the purpose of this local movement..."
              rows={3}
              className="bg-slate-50"
              required
            />
          </div>

          {/* Receipt Upload Section (Required) */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Receipts (Required for Reimbursement)</label>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                id="receipt-upload"
                multiple
                accept="image/*,.pdf"
                onChange={handleReceiptUpload}
                className="hidden"
              />
              <label
                htmlFor="receipt-upload"
                className="cursor-pointer"
              >
                <Upload size={32} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Click to upload receipts</p>
                <p className="text-xs text-slate-500">PNG, JPG, PDF up to 10MB each</p>
              </label>
            </div>

            {receipts.length > 0 && (
              <div className="mt-3 space-y-2">
                {receipts.map((receipt) => (
                  <div key={receipt.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{receipt.name}</p>
                        <p className="text-xs text-slate-500">{receipt.size}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveReceipt(receipt.id)}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {receipts.length === 0 && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertCircle size={16} className="mt-0.5 text-amber-600 flex-shrink-0" />
                <p className="text-xs text-amber-700">At least one receipt is required for reimbursement.</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/travel/local')}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || receipts.length === 0}
              className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Reimbursement'}
            </button>
          </div>
        </form>
      </SectionCard>

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