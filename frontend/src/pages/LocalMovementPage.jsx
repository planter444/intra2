import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, FileText } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';

export default function LocalMovementPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Movement"
        subtitle="Manage local movement for short-distance travel within the city."
        actions={[
          <button
            key="back"
            type="button"
            onClick={() => navigate('/travel')}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        ]}
      />

      <SectionCard title="Select Local Movement Type">
        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate('/travel/local/booking')}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-blue-300 hover:bg-blue-50"
          >
            <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Local Movement Booking</h3>
              <p className="text-sm text-slate-600">Plan local movement (optional cost)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/travel/local/reimbursement')}
            className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-purple-300 hover:bg-purple-50"
          >
            <div className="rounded-lg bg-purple-100 p-3 text-purple-600">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="font-medium text-slate-900">Local Movement Reimbursement</h3>
              <p className="text-sm text-slate-600">Submit expenses (receipts required)</p>
            </div>
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm text-slate-600">
            <span className="font-medium">Note:</span> No DSA applies to local movement. Single travel date required.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}