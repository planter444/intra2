import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, FileText, CheckCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';

export default function OfficialTravelPage() {
  const navigate = useNavigate();

  const options = [
    {
      id: 'booking',
      title: 'Official Travel Booking',
      description: 'Plan and book official travel with automatic DSA calculation. Transportation costs optional.',
      icon: Calendar,
      color: 'from-blue-500 to-blue-600',
      borderColor: 'border-blue-200',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      path: '/travel/apply'
    },
    {
      id: 'reimbursement',
      title: 'Official Travel Reimbursement',
      description: 'Submit official travel expenses for reimbursement with receipt uploads. Total cost required.',
      icon: FileText,
      color: 'from-purple-500 to-purple-600',
      borderColor: 'border-purple-200',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      path: '/travel/reimbursement'
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Official Travel"
        subtitle="Manage official travel bookings and reimbursements with automatic DSA calculation."
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
        title="Select Official Travel Type"
        subtitle="Choose between booking a new official travel or submitting expenses for reimbursement."
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

        <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-800">
            <CheckCircle size={16} />
            Official Travel Information
          </h4>
          <ul className="space-y-1 text-sm text-blue-700">
            <li>• Automatic DSA calculation based on designation and travel category</li>
            <li>• Travel categories: Within Kenya, East Africa, International</li>
            <li>• Booking: Transportation costs optional, DSA calculated automatically</li>
            <li>• Reimbursement: Total cost required, receipts mandatory</li>
            <li>• DSA covers accommodation, meals, and incidental costs</li>
          </ul>
        </div>
      </SectionCard>
    </div>
  );
}