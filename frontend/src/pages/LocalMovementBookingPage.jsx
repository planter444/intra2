import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Trash2, Calendar, MapPin, DollarSign, CheckCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { createTravelRequest, updateTravelRequest } from '../services/travelService';
import { uploadDocument } from '../services/documentService';
import { fetchSettings } from '../services/settingsService';

export default function LocalMovementBookingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [settings, setSettings] = useState(null);
  const [documents, setDocuments] = useState([]);

  const [form, setForm] = useState({
    travelType: 'booking',
    travelCategory: 'Local Movement',
    projectProgramme: '',
    travelDate: '',
    origin: '',
    destination: '',
    estimatedCost: '',
    currency: 'KES',
    reason: '',
    supportingDocuments: [],
    referenceNumber: '',
    fullDayEvent: false
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
      const baseCost = parseFloat(form.estimatedCost) || 0;
      const dsaAmount = form.fullDayEvent ? (settings?.travel?.dsa?.localMovementRate || 2000) : 0;
      const totalCost = baseCost + dsaAmount;

      const payload = {
        ...form,
        userId: user.id,
        travelCategory: 'Local Movement',
        startDate: form.travelDate,
        endDate: form.travelDate,
        estimatedCost: totalCost, // Store total cost for booking
        transportationCost: baseCost, // Store transportation cost separately
        dsaRate: form.fullDayEvent ? (settings?.travel?.dsa?.localMovementRate || 2000) : 0,
        dsaCurrency: 'KES',
        dsaAmount: dsaAmount,
        accommodationRate: 0,
        accommodationCurrency: 'KES',
        accommodationAmount: 0,
        fullDayEvent: form.fullDayEvent,
        projectProgramme: form.projectProgramme || null // Convert empty string to null
      };

      const request = await createTravelRequest(payload);

      // Upload supporting document after creating the request
      if (documents.length > 0 && documents[0].file) {
        try {
          console.log('Uploading supporting document...');
          const document = await uploadDocument({
            file: documents[0].file,
            folderType: 'travel'
          });
          console.log('Document uploaded:', document);
          // Update the travel request with the supporting document ID
          console.log('Updating travel request with document ID:', document.id);
          await updateTravelRequest(request.id, { supportingDocumentId: document.id });
          console.log('Travel request updated successfully');
        } catch (docError) {
          console.error('Failed to upload supporting document:', docError);
        }
      }

      setNotice({
        open: true,
        title: 'Local movement booking submitted',
        description: 'Your local movement booking has been submitted successfully.'
      });
      setTimeout(() => navigate('/travel/local'), 2000);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to submit booking',
        description: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = (e) => {
    const files = Array.from(e.target.files);
    const newDocuments = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size, // Send actual size in bytes
      sizeDisplay: (file.size / 1024).toFixed(2) + ' KB' // For display only
    }));
    setDocuments([...documents, ...newDocuments]);
  };

  const handleRemoveDocument = (id) => {
    setDocuments(documents.filter(d => d.id !== id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Movement Booking"
        subtitle="Book local movement for business purposes within the city. Estimated cost is optional."
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

      <SectionCard title="Local Movement Details" subtitle="Fill in the local movement details. Supporting documents are optional.">
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
              <label className="mb-2 block text-sm font-medium text-slate-700">Estimated Cost (Optional)</label>
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
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Optional - for local movement budgeting</p>
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

          {/* Full Day Event Checkbox */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.fullDayEvent}
                onChange={(e) => setForm((current) => ({ ...current, fullDayEvent: e.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-900">Full day event</span>
                <p className="mt-1 text-xs text-slate-600">
                  {form.fullDayEvent
                    ? `DSA of KES ${(settings?.travel?.dsa?.localMovementRate || 2000).toLocaleString()} will be added to the estimated cost.`
                    : 'No DSA will be included. Only the estimated transportation cost.'}
                </p>
              </div>
            </label>
          </div>

          {/* DSA Calculation Display - Only show if full day event */}
          {form.fullDayEvent && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <DollarSign size={16} />
                DSA (Daily Subsistence Allowance)
              </h4>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Rate:</span>
                  <span className="font-medium text-slate-900">KES {(settings?.travel?.dsa?.localMovementRate || 2000).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total DSA:</span>
                  <span className="font-semibold text-emerald-700">KES {(settings?.travel?.dsa?.localMovementRate || 2000).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Total Calculation Display */}
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-900">
              <DollarSign size={16} />
              Total Estimated Cost
            </h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Estimated Transportation Cost:</span>
                <span className="font-medium text-slate-900">KES {(parseFloat(form.estimatedCost) || 0).toLocaleString()}</span>
              </div>
              {form.fullDayEvent && (
                <div className="flex justify-between">
                  <span className="text-slate-600">DSA:</span>
                  <span className="font-medium text-slate-900">KES {(settings?.travel?.dsa?.localMovementRate || 2000).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-purple-200 pt-2">
                <span className="font-semibold text-slate-900">Total:</span>
                <span className="font-semibold text-purple-700">
                  KES {(
                    (parseFloat(form.estimatedCost) || 0) +
                    (form.fullDayEvent ? (settings?.travel?.dsa?.localMovementRate || 2000) : 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Supporting Documents (Optional) */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Supporting Documents (Optional)</label>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                id="document-upload"
                multiple
                accept="image/*,.pdf"
                onChange={handleDocumentUpload}
                className="hidden"
              />
              <label
                htmlFor="document-upload"
                className="cursor-pointer"
              >
                <Upload size={32} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium text-slate-700">Click to upload supporting documents</p>
                <p className="text-xs text-slate-500">PNG, JPG, PDF up to 10MB each (Optional)</p>
              </label>
            </div>

            {documents.length > 0 && (
              <div className="mt-3 space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                        <p className="text-xs text-slate-500">{doc.sizeDisplay || (doc.size / 1024).toFixed(2) + ' KB'}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
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
              disabled={loading}
              className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Booking'}
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