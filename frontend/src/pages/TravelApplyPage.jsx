import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, DollarSign } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { createTravelRequest, fetchTravelRequests } from '../services/travelService';

const initialForm = {
  travelType: 'booking',
  startDate: '',
  endDate: '',
  origin: '',
  destination: '',
  reason: '',
  estimatedCost: '',
  currency: 'KES',
  receiptFile: null,
  supportingDocuments: null,
  designation: '',
  travelCategory: '',
  travelTypeDetail: '',
  projectProgramme: '',
  dsaRate: '',
  dsaCurrency: 'KES',
  dsaAmount: ''
};

const getToday = () => new Date().toISOString().split('T')[0];

// DSA Rate Configuration
const getDSARate = (designation, travelCategory, travelTypeDetail) => {
  console.log('getDSARate called:', { designation, travelCategory, travelTypeDetail });
  
  if (!designation || !travelCategory) {
    console.log('Missing designation or travelCategory');
    return null;
  }

  // Normalize designation to handle case sensitivity and spacing
  const normalizedDesignation = designation.toLowerCase().replace(/\s+/g, '');
  console.log('Normalized designation:', normalizedDesignation);

  // Within Kenya - Official Overnight Travel
  if (travelCategory === 'Within Kenya' && travelTypeDetail === 'Official Overnight Travel') {
    if (normalizedDesignation === 'fieldofficer') {
      console.log('Match: Field Officer - Within Kenya Overnight');
      return { rate: 2500, currency: 'KES', unit: 'per night' };
    }
    if (normalizedDesignation === 'intern' || normalizedDesignation === 'secretariat' || normalizedDesignation === 'consultant') {
      console.log('Match: Intern/Secretariat/Consultant - Within Kenya Overnight');
      return { rate: 4000, currency: 'KES', unit: 'per night' };
    }
    console.log('No match for Within Kenya Overnight');
    return null;
  }

  // Within Kenya - Official Day Travel
  if (travelCategory === 'Within Kenya' && travelTypeDetail === 'Official Day Travel') {
    if (normalizedDesignation === 'fieldofficer') {
      console.log('Match: Field Officer - Within Kenya Day');
      return { rate: 1500, currency: 'KES', unit: 'per day' };
    }
    if (normalizedDesignation === 'intern' || normalizedDesignation === 'secretariat' || normalizedDesignation === 'consultant') {
      console.log('Match: Intern/Secretariat/Consultant - Within Kenya Day');
      return { rate: 2000, currency: 'KES', unit: 'per day' };
    }
    console.log('No match for Within Kenya Day');
    return null;
  }

  // East Africa - All designations
  if (travelCategory === 'East Africa') {
    console.log('Match: East Africa - All designations');
    return { rate: 35, currency: 'USD', unit: 'per day' };
  }

  // International - All designations
  if (travelCategory === 'International') {
    console.log('Match: International - All designations');
    return { rate: 50, currency: 'USD', unit: 'per day' };
  }

  console.log('No match for travel category');
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

export default function TravelApplyPage() {
  const navigate = useNavigate();
  const { user, token, settings } = useAuth();
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [submittedRequestId, setSubmittedRequestId] = useState(null);

  // Auto-populate designation from user profile
  useEffect(() => {
    console.log('User object:', user);
    console.log('User designation:', user?.designation);
    if (user?.designation) {
      setForm(prev => ({ ...prev, designation: user.designation }));
      console.log('Designation set to:', user.designation);
    } else {
      console.log('No designation found for user');
    }
  }, [user?.designation]);

  // Auto-calculate DSA when relevant fields change
  useEffect(() => {
    console.log('DSA Calculation Trigger:', { 
      designation: form.designation, 
      travelCategory: form.travelCategory, 
      travelTypeDetail: form.travelTypeDetail, 
      startDate: form.startDate, 
      endDate: form.endDate 
    });

    if (form.designation && form.travelCategory && form.startDate && form.endDate) {
      // For East Africa and International, travelTypeDetail is not needed
      const needsTravelType = form.travelCategory === 'Within Kenya';
      const hasRequiredFields = needsTravelType ? form.travelTypeDetail : true;

      console.log('DSA Calculation logic:', { needsTravelType, hasRequiredFields });

      if (hasRequiredFields) {
        const dsaRate = getDSARate(form.designation, form.travelCategory, form.travelTypeDetail);
        console.log('DSA Rate Result:', dsaRate);
        
        if (dsaRate) {
          const dsaAmount = calculateDSAAmount(form.startDate, form.endDate, dsaRate, form.travelTypeDetail);
          console.log('DSA Amount Result:', dsaAmount);
          
          setForm(prev => ({
            ...prev,
            dsaRate: dsaRate.rate,
            dsaCurrency: dsaRate.currency,
            dsaAmount: dsaAmount
          }));
        } else {
          console.log('No DSA rate found, clearing fields');
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

  // Reset travel type detail when category changes
  useEffect(() => {
    if (form.travelCategory && form.travelCategory !== 'Within Kenya') {
      setForm(prev => ({ ...prev, travelTypeDetail: '' }));
    }
  }, [form.travelCategory]);

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

    if (!form.startDate || !form.endDate || !form.origin || !form.destination || !form.reason) {
      setNotice({
        open: true,
        title: 'Missing required fields',
        description: 'Start date, end date, origin, destination, and reason are required.'
      });
      return;
    }

    const start = new Date(form.startDate);
    const end = new Date(form.endDate);

    if (start > end) {
      setNotice({
        open: true,
        title: 'Invalid date range',
        description: 'Start date must be before or equal to end date.'
      });
      return;
    }


    try {
      const requestData = {
        travelType: form.travelType,
        startDate: form.startDate,
        endDate: form.endDate,
        origin: form.origin,
        destination: form.destination,
        reason: form.reason,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
        currency: form.currency,
        designation: form.designation,
        travelCategory: form.travelCategory,
        travelTypeDetail: form.travelTypeDetail,
        projectProgramme: form.projectProgramme,
        dsaRate: form.dsaRate ? Number(form.dsaRate) : null,
        dsaCurrency: form.dsaCurrency,
        dsaAmount: form.dsaAmount ? Number(form.dsaAmount) : null
      };

      let request;
      
      if (form.travelType === 'booking' && form.supportingDocuments) {
        // Upload supporting document for booking
        const formData = new FormData();
        formData.append('supportingDocument', form.supportingDocuments);
        Object.keys(requestData).forEach(key => formData.append(key, requestData[key]));

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/travel/requests`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        const result = await response.json();
        request = result.request;
      } else {
        // Regular request without supporting document
        request = await createTravelRequest(requestData);
      }

      setSubmittedRequestId(request.id);

      // Handle receipt upload for reimbursement
      if (form.travelType === 'reimbursement' && form.receiptFile) {
        const formData = new FormData();
        formData.append('receipt', form.receiptFile);
        formData.append('travelRequestId', request.id);

        const receiptResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/travel/receipts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!receiptResponse.ok) {
          const errorData = await receiptResponse.json().catch(() => ({ message: 'Failed to upload receipt' }));
          throw new Error(errorData.message || 'Failed to upload receipt');
        }
      }

      setNotice({
        open: true,
        title: 'Travel request submitted',
        description: 'Your travel request has been submitted successfully.'
      });
      setForm(initialForm);
      setTimeout(() => navigate('/travel/official'), 2000);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Travel request error',
        description: error.response?.data?.message || 'Unable to submit travel request. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Official Travel Booking"
        subtitle="Plan official travel with automatic DSA calculation. Transportation costs are optional."
        actions={[
          <button key="back" type="button" onClick={() => navigate('/travel/official')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            Back to Official Travel
          </button>
        ]}
      />

      <SectionCard title="Official Travel Booking Form" subtitle="Enter your travel details including dates, route, and reason. DSA will be calculated automatically.">
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

          {/* Travel Type Detail (only for Within Kenya) */}
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
                min={form.startDate}
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Estimated Transportation Cost (Optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {form.currency === 'KES' ? 'KES' : form.currency}
                </span>
                <input
                  type="number"
                  className="bg-slate-50 pl-16"
                  placeholder="e.g., 50000"
                  value={form.estimatedCost}
                  onChange={(event) => setForm((current) => ({ ...current, estimatedCost: event.target.value }))}
                  min="0"
                  step="0.01"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Transportation costs only (separate from DSA)</p>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Currency</label>
              <select
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
                className="bg-slate-50"
              >
                <option value="KES">Kenya Shillings (KES)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="GBP">British Pound Sterling (GBP)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="CAD">Canadian Dollar (CAD)</option>
                <option value="AUD">Australian Dollar (AUD)</option>
                <option value="JPY">Japanese Yen (JPY)</option>
                <option value="CNY">Chinese Yuan (CNY)</option>
                <option value="INR">Indian Rupee (INR)</option>
                <option value="AED">UAE Dirham (AED)</option>
                <option value="SAR">Saudi Riyal (SAR)</option>
                <option value="ZAR">South African Rand (ZAR)</option>
                <option value="NGN">Nigerian Naira (NGN)</option>
                <option value="GHS">Ghanaian Cedi (GHS)</option>
                <option value="UGX">Ugandan Shilling (UGX)</option>
                <option value="TZS">Tanzanian Shilling (TZS)</option>
                <option value="RWF">Rwandan Franc (RWF)</option>
                <option value="ETB">Ethiopian Birr (ETB)</option>
                <option value="BWP">Botswana Pula (BWP)</option>
                <option value="NAD">Namibian Dollar (NAD)</option>
              </select>
            </div>
          </div>

          {/* DSA Section - appears right after estimated transportation cost */}
          {form.dsaRate && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <h4 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
                <DollarSign size={18} />
                DSA (Daily Subsistence Allowance)
              </h4>
              <p className="mb-3 text-xs text-emerald-700">Covers accommodation, meals, and incidental costs</p>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Applicable Rate:</span>
                  <span className="font-medium text-slate-900">
                    {form.dsaCurrency} {form.dsaRate?.toLocaleString()} {getDSARate(form.designation, form.travelCategory, form.travelTypeDetail)?.unit || ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Number of {form.travelTypeDetail === 'Official Overnight Travel' ? 'Nights' : 'Days'}:</span>
                  <span className="font-medium text-slate-900">
                    {form.startDate && form.endDate ? (
                      form.travelTypeDetail === 'Official Overnight Travel' 
                        ? Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24))
                        : Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24)) + 1
                    ) : 0}
                  </span>
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-2">
                  <span className="font-semibold text-slate-900">Total DSA:</span>
                  <span className="font-semibold text-emerald-700">
                    {form.dsaCurrency} {form.dsaAmount?.toLocaleString() || 0}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!form.dsaRate && form.designation && form.travelCategory && (form.travelCategory !== 'Within Kenya' || form.travelTypeDetail) && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">
                ⚠️ Select travel dates to calculate DSA
              </p>
            </div>
          )}

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

          {form.travelType === 'booking' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Supporting documents (optional)</label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                <Upload size={24} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Click to upload supporting documents</p>
                  <p className="mt-1 text-xs text-slate-400">PDF, images, or other files (max 10 MB) - Optional</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={(e) => setForm((current) => ({ ...current, supportingDocuments: e.target.files?.[0] || null }))}
                />
              </label>
              {form.supportingDocuments && (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <span>{form.supportingDocuments.name}</span>
                  <button type="button" className="text-slate-500" onClick={() => setForm((current) => ({ ...current, supportingDocuments: null }))}>
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {form.travelType === 'reimbursement' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Receipt upload (required for reimbursement)</label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                <Upload size={24} className="text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Click to upload receipt</p>
                  <p className="mt-1 text-xs text-slate-400">PDF, images, or other receipt files (max 10 MB)</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setForm((current) => ({ ...current, receiptFile: e.target.files?.[0] || null }))}
                />
              </label>
              {form.receiptFile && (
                <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                  <span>{form.receiptFile.name}</span>
                  <button type="button" className="text-slate-500" onClick={() => setForm((current) => ({ ...current, receiptFile: null }))}>
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => navigate('/travel/official')}>
              Back
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
