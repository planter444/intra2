import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, DollarSign, FileText, CheckCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';

export default function LocalMovementPage() {
  const navigate = useNavigate();

  const options = [
    {
      id: 'booking',
      title: 'Local Movement Booking',
      description: 'Plan and book local movement for business purposes. Supporting documents are optional.',
      icon: Calendar,
      color: 'from-blue-500 to-blue-600',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      path: '/travel/local/booking'
    },
    {
      id: 'reimbursement',
      title: 'Local Movement Reimbursement',
      description: 'Submit local movement expenses for reimbursement. Receipts are required.',
      icon: FileText,
      color: 'from-purple-500 to-purple-600',
      borderColor: 'border-purple-200',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      path: '/travel/local/reimbursement'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Local Movement"
        subtitle="Manage local movement bookings and reimbursements for short-distance travel within the city."
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

      <SectionCard
        title="Select Local Movement Type"
        subtitle="Choose between booking a new local movement or submitting expenses for reimbursement."
      >
        <div className="grid gap-6 md:grid-cols-2">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => navigate(option.path)}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all hover:shadow-lg hover:border-slate-300"
              >
                <div className="flex items-start gap-4">
                  <div className={`rounded-xl ${option.bgColor} ${option.textColor} p-3`}>
                    <Icon size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900">{option.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{option.description}</p>
                  </div>
                </div>
                <div className={`absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r ${option.color} transition-all group-hover:h-2`} />
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <CheckCircle size={16} />
            Local Movement Information
          </h4>
          <ul className="space-y-1 text-sm text-amber-700">
            <li>• No DSA (Daily Subsistence Allowance) applicable</li>
            <li>• Single travel date (no end date needed)</li>
            <li>• Origin and destination required</li>
            <li>• Project/programme selection required</li>
            <li>• Booking: Supporting documents optional</li>
            <li>• Reimbursement: Receipts required</li>
          </ul>
        </div>
      </SectionCard>
    </div>
  );
}