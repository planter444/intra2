import { CheckCircle2, Circle } from 'lucide-react';

const getStageStatus = (request, index, totalStages) => {
  if (request.status === 'cancelled' || request.status === 'rejected') {
    if (index === 0) {
      return 'complete';
    }

    if (request.status === 'rejected' && ((request.status === 'pending_supervisor' && index === 1) || (request.status !== 'pending_supervisor' && index === totalStages - 1))) {
      return 'current';
    }
  }

  if (request.status === 'pending_supervisor') {
    return index === 0 ? 'complete' : index === 1 ? 'current' : 'upcoming';
  }

  if (request.status === 'pending_hr') {
    return index < totalStages - 1 ? 'complete' : 'current';
  }

  if (request.status === 'pending_ceo') {
    return index < totalStages - 1 ? 'complete' : 'current';
  }

  if (request.status === 'approved') {
    return 'complete';
  }

  return index === 0 ? 'complete' : 'upcoming';
};

export default function LeaveStatusTimeline({ request, actingHrLabel = 'CEO', compact = false }) {
  const isCeoSupervisor = request?.supervisorApproverRole === 'ceo';
  const hasSupervisorStage = Boolean(
    request?.requiresSupervisorReview
    || request?.status === 'pending_supervisor'
    || request?.supervisorApproverId
  ) && !isCeoSupervisor;

  const stages = [
    { key: 'applied', label: 'Applied' },
    ...(hasSupervisorStage ? [{ key: 'supervisor', label: 'Supervisor' }] : []),
    { key: 'final', label: actingHrLabel || 'CEO' }
  ];

  return (
    <div className={`flex ${compact ? 'items-center gap-3' : 'flex-col gap-4'}`}>
      {stages.map((stage, index) => {
        const state = getStageStatus(request, index, stages.length);
        const isLast = index === stages.length - 1;
        const isActive = state === 'current' || state === 'complete';

        return (
          <div key={stage.key} className={`flex ${compact ? 'items-center gap-2' : 'items-start gap-3'}`}>
            <div className="flex items-center gap-2">
              {state === 'complete' ? (
                <CheckCircle2 size={16} className="text-emerald-500" />
              ) : state === 'current' ? (
                <Circle size={16} className="text-amber-500" />
              ) : (
                <Circle size={16} className="text-slate-300" />
              )}
              {!compact ? null : <span className={`text-xs ${isActive ? 'text-slate-800' : 'text-slate-400'}`}>{stage.label}</span>}
            </div>
            {compact ? (
              !isLast ? <div className={`h-px w-6 ${isActive ? 'bg-emerald-300' : 'bg-slate-200'}`} /> : null
            ) : (
              <div className="min-w-0">
                <p className={`text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{stage.label}</p>
                {isLast ? null : <div className={`mt-2 h-8 w-px ${isActive ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
