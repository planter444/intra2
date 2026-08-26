import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, FileText, Trash2, Calendar, MapPin, DollarSign, CheckCircle, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { createTravelRequest } from '../services/travelService';
import { fetchSettings } from '../services/settingsService';

// DSA Rate Configuration
const getDSARate = (designation, travelCategory, travelTypeDetail) => {
  if (!designation || !travelCategory) return null;

  // Normalize designation to handle case sensitivity and spacing
  const normalizedDesignation = designation.toLowerCase().replace(/\s+/g, '');

  // Within Kenya - Official Overnight Travel
  if (travelCategory === 'Within Kenya' && travelTypeDetail === 'Official Overnight Travel') {
    if (normalizedDesignation === 'fieldofficer') {
      return { rate: 2500, currency: 'KES', unit: 'per night' };
    }
    if (normalizedDesignation === 'intern' || normalizedDesignation === 'secretariat' || normalizedDesignation === 'consultant') {
      return { rate: 4000, currency: 'KES', unit: 'per night' };
    }
    return null;
  }

  // Within Kenya - Official Day Travel
  if (travelCategory === 'Within Kenya' && travelTypeDetail === 'Official Day Travel') {
    if (normalizedDesignation === 'fieldofficer') {
      return { rate: 1500, currency: 'KES', unit: 'per day' };
    }
    if (normalizedDesignation === 'intern' || normalizedDesignation === 'secretariat' || normalizedDesignation === 'consultant') {
      return { rate: 2000, currency: 'KES', unit: 'per day' };
    }
    return null;
  }

  // East Africa - All designations
  if (travelCategory === 'East Africa') {
    return { rate: 35, currency: 'USD', unit: 'per day' };
  }

  // International - All designations
  if (travelCategory === 'International') {
    return { rate: 50, currency: 'USD', unit: 'per day' };
  }

  return null;
};

// Calculate DSA amount based on dates and rate
const calculateDSAAmount = (startDate, endDate, dsaRate, travelTypeDetail) => {
  if (!startDate || !endDate || !dsaRate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end - start;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (travelTypeDetail === 'Official Overnight Travel') {
    // Nights = End Date - Start Date
    const nights = diffDays;
    return nights * dsaRate.rate;
  } else {
    // Days = End Date - Start Date + 1
    const days = diffDays + 1;
    return days * dsaRate.rate;
  }
};

export default function TravelReimbursementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [settings, setSettings] = useState(null);
  const [receipts, setReceipts] = useState([]);

  const [form, setForm] = useState({
    travelType: 'reimbursement',
    designation: '',
    travelCategory: '',
    travelTypeDetail: '',
    projectProgramme: '',
    startDate: '',
    endDate: '',
    origin: '',
    destination: '',
    estimatedCost: '',
    currency: 'KES',
    dsaRate: '',
    dsaCurrency: 'KES',
    dsaAmount: '',
    dsaProvided: false,
    reason: '',
    supportingDocuments: [],
    referenceNumber: ''
  });

  useEffect(() => {
    loadSettings();
    // Auto-populate designation from user profile
    if (user?.designation) {
      setForm(prev => ({ ...prev, designation: user.designation }));
    }
  }, [user?.designation]);

  // Auto-calculate DSA when relevant fields change
  useEffect(() => {
    if (form.designation && form.travelCategory && form.startDate && form.endDate) {
      const needsTravelType = form.travelCategory === 'Within Kenya';
      const hasRequiredFields = needsTravelType ? form.travelTypeDetail : true;

      if (hasRequiredFields) {
        const dsaRate = getDSARate(form.designation, form.travelCategory, form.travelTypeDetail);
        
        if (dsaRate) {
          const dsaAmount = calculateDSAAmount(form.startDate, form.endDate, dsaRate, form.travelTypeDetail);
          setForm(prev => ({
            ...prev,
            dsaRate: dsaRate.rate,
            dsaCurrency: dsaRate.currency,
            dsaAmount: dsaAmount
          }));
        } else {
          setForm(prev => ({
            ...prev,
            dsaRate: '',
            dsaCurrency: 'KES',
            dsaAmount: ''
          }));
        }
      }
    }
  }, [form.designation, form.travelCategory, form.travelTypeDetail, form.startDate, form.endDate]);

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
        receipts: receipts,
        dsaAmount: parseFloat(form.dsaAmount) || 0,
        estimatedCost: parseFloat(form.estimatedCost) || 0,
        dsaProvided: form.dsaProvided || false
      };

      await createTravelRequest(payload);
      setNotice({
        open: true,
        title: 'Travel reimbursement submitted',
        description: 'Your travel reimbursement request has been submitted successfully.'
      });
      setTimeout(() => navigate('/travel/official'), 2000);
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
        title="Official Travel Reimbursement"
        subtitle="Submit official travel expenses for reimbursement with receipt uploads."
        actions={[
          <button
            key="back"
            type="button"
            onClick={() => navigate('/travel/official')}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        ]}
      />

      <SectionCard title="Travel Reimbursement Details" subtitle="Fill in the travel details and upload receipts for reimbursement.">
        <form className="space-y-5" onSubmit={handleSubmit}>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Travel Category</label>
              <select
                value={form.travelCategory}
                onChange={(event) => setForm((current) => ({ ...current, travelCategory: event.target.value }))}
                className="bg-slate-50"
                required
              >
                <option value="">Select travel category</option>
                <option value="Within Kenya">Within Kenya</option>
                <option value="East Africa">East Africa</option>
                <option value="International">International</option>
              </select>
            </div>
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
          </div>

          {form.travelCategory === 'Within Kenya' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Travel Type</label>
              <select
                value={form.travelTypeDetail}
                onChange={(event) => setForm((current) => ({ ...current, travelTypeDetail: event.target.value }))}
                className="bg-slate-50"
                required
              >
                <option value="">Select travel type</option>
                <option value="Official Overnight Travel">Official Overnight Travel</option>
                <option value="Official Day Travel">Official Day Travel</option>
              </select>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                className="bg-slate-50"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                className="bg-slate-50"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Origin</label>
              <input
                type="text"
                value={form.origin}
                onChange={(event) => setForm((current) => ({ ...current, origin: event.target.value }))}
                placeholder="Departure location"
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

          {/* DSA Provided Checkbox */}
          {form.dsaAmount > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.dsaProvided}
                  onChange={(event) => setForm((current) => ({ ...current, dsaProvided: event.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-900">DSA was provided during travel</span>
                  <p className="mt-1 text-xs text-slate-600">
                    {form.dsaProvided 
                      ? 'DSA will be excluded from the total reimbursement amount.' 
                      : 'DSA will be included in the total reimbursement amount.'}
                  </p>
                </div>
              </label>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Total Cost for Reimbursement</label>
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
              <p className="mt-1 text-xs text-slate-500">Total amount to be reimbursed (includes all expenses)</p>
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

          {/* DSA Section */}
          {form.dsaAmount > 0 && (
            <div className={`rounded-xl border p-4 ${form.dsaProvided ? 'border-slate-200 bg-slate-100' : 'border-emerald-200 bg-emerald-50'}`}>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <DollarSign size={16} />
                DSA (Daily Subsistence Allowance)
                {form.dsaProvided && (
                  <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                    Excluded from total
                  </span>
                )}
              </h4>
              <p className="mb-3 text-xs text-slate-600">
                {form.dsaProvided 
                  ? 'DSA was provided during travel and will not be reimbursed.' 
                  : 'Covers accommodation, meals, and incidental costs - included in reimbursement.'}
              </p>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Rate:</span>
                  <span className="font-medium text-slate-900">{form.dsaRate} {form.dsaCurrency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total DSA:</span>
                  <span className={`font-semibold ${form.dsaProvided ? 'text-slate-500 line-through' : 'text-emerald-700'}`}>
                    {form.dsaAmount} {form.dsaCurrency}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Reason for Travel</label>
            <textarea
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Provide details about the purpose of this travel..."
              rows={3}
              className="bg-slate-50"
              required
            />
          </div>

          {/* Receipt Upload Section */}
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
              <p className="mt-2 text-xs text-amber-600">⚠️ At least one receipt is required for reimbursement.</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/travel')}
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