import { useNavigate } from 'react-router-dom';
import { FileText, MapPin, ArrowLeft } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';

export default function ReportPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Generate comprehensive reports for the organization."
        actions={[
          <button
            key="back"
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </button>
        ]}
      />

      <SectionCard title="Select Report Type" subtitle="Choose the type of report you want to generate.">
        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate('/leave-report')}
            className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-emerald-500 hover:bg-emerald-50"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <FileText size={32} />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">Leave Report</p>
              <p className="mt-1 text-sm text-slate-500">Generate comprehensive leave reports for the organization.</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => navigate('/travel-report')}
            className="flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-slate-200 bg-white p-6 text-left transition-all hover:border-blue-500 hover:bg-blue-50"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <MapPin size={32} />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">Travel Report</p>
              <p className="mt-1 text-sm text-slate-500">Generate comprehensive travel reports for the organization.</p>
            </div>
          </button>
        </div>
      </SectionCard>
    </div>
  );
}
