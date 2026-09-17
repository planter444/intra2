import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Send, ArrowLeft, User, BriefcaseBusiness, Target, Lock, AlertCircle, ShieldCheck, Crown } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { updateSettings } from '../services/settingsService';
import { fetchUsers } from '../services/userService';
import { normalizeAppraisalData, APPRAISAL_STATUS, getAppraisalStatusLabel, calculateAppraisalScore, canEditAppraisal, canViewGrade } from '../utils/kpi';

export default function SupervisorAppraisalReviewPage() {
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const { settings, user, replaceSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [submitModal, setSubmitModal] = useState({ open: false });
  
  // Get employee data
  const employee = users.find(u => String(u.id) === String(employeeId));
  
  // Get current appraisal data for the employee
  const currentAppraisal = settings?.kpi?.records?.[String(employeeId)] || {};
  const normalizedAppraisal = normalizeAppraisalData(currentAppraisal);
  
  // Form state for supervisor review
  const [form, setForm] = useState({
    supervisorReview: {
      coreRoles: normalizedAppraisal.supervisorReview.coreRoles || [],
      indicators: normalizedAppraisal.supervisorReview.indicators || [],
      overallComment: normalizedAppraisal.supervisorReview.overallComment || ''
    },
    ceoReview: {
      overallComment: normalizedAppraisal.ceoReview.overallComment || ''
    }
  });

  const canEdit = canEditAppraisal(normalizedAppraisal, user.role, user.id);
  const isLocked = normalizedAppraisal.status === APPRAISAL_STATUS.LOCKED;
  const statusLabel = getAppraisalStatusLabel(normalizedAppraisal.status);
  const isCeo = user.role === 'ceo';
  const isSupervisor = user.role === 'supervisor';
  const isAdmin = user.role === 'admin';

  const canViewSupervisorGrade = canViewGrade(normalizedAppraisal, user.role, user.id, settings);
  const canViewCeoGrade = canViewGrade(normalizedAppraisal, user.role, user.id, settings);

  useEffect(() => {
    const loadData = async () => {
      try {
        const usersList = await fetchUsers();
        setUsers(usersList);
      } catch (error) {
        console.error('Failed to load users:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    if (!canEdit) {
      setNotice({
        open: true,
        title: 'Cannot Save',
        description: 'This appraisal cannot be edited in its current state.'
      });
      return;
    }

    try {
      setSaving(true);
      const updatedAppraisal = {
        ...normalizedAppraisal,
        ...form,
        audit: {
          ...normalizedAppraisal.audit,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: user.id
        }
      };

      // If CEO is editing, update CEO review section
      if (isCeo) {
        updatedAppraisal.ceoReview = {
          ...form.ceoReview,
          submittedAt: normalizedAppraisal.ceoReview.submittedAt || null
        };
      } else {
        // Supervisor or admin editing
        updatedAppraisal.supervisorReview = {
          ...form.supervisorReview,
          reviewerId: user.id,
          submittedAt: normalizedAppraisal.supervisorReview.submittedAt || null
        };
      }

      const updatedKpi = {
        ...settings?.kpi,
        records: {
          ...settings?.kpi?.records,
          [String(employeeId)]: updatedAppraisal
        }
      };

      const newSettings = await updateSettings({ kpi: updatedKpi });
      replaceSettings(newSettings);
      
      setNotice({
        open: true,
        title: 'Review Saved',
        description: 'Your appraisal review has been saved successfully.'
      });
    } catch (error) {
      console.error('Failed to save review:', error);
      setNotice({
        open: true,
        title: 'Save Failed',
        description: 'Unable to save your review. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!canEdit) {
      setNotice({
        open: true,
        title: 'Cannot Submit',
        description: 'This appraisal cannot be submitted in its current state.'
      });
      return;
    }

    try {
      setSubmitting(true);
      const updatedAppraisal = {
        ...normalizedAppraisal,
        ...form,
        audit: {
          ...normalizedAppraisal.audit,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: user.id
        }
      };

      if (isCeo) {
        // CEO submitting - can lock the appraisal
        updatedAppraisal.ceoReview = {
          ...form.ceoReview,
          submittedAt: new Date().toISOString()
        };
        updatedAppraisal.status = APPRAISAL_STATUS.LOCKED;
      } else {
        // Supervisor submitting
        updatedAppraisal.supervisorReview = {
          ...form.supervisorReview,
          reviewerId: user.id,
          submittedAt: new Date().toISOString()
        };
        updatedAppraisal.status = APPRAISAL_STATUS.REVIEWED;
        
        // Send email notification to employee (best-effort)
        try {
          if (employee && employee.email) {
            const appraisalUrl = `${window.location.origin}/kpi-self`;
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/mail/appraisal-reviewed`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                toEmail: employee.email,
                toName: employee.fullName,
                supervisorName: user.fullName,
                period: normalizedAppraisal.period.frequency || 'quarterly',
                appraisalUrl
              })
            });
          }
        } catch (emailError) {
          console.error('Failed to send appraisal review notification email:', emailError);
          // Continue even if email fails
        }
        
        // Send email notification to CEO (best-effort)
        try {
          const ceo = users.find(u => u.role === 'ceo');
          if (ceo && ceo.email) {
            const appraisalUrl = `${window.location.origin}/kpi-review/${employeeId}`;
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/mail/appraisal-to-ceo`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: JSON.stringify({
                toEmail: ceo.email,
                toName: ceo.fullName,
                employeeName: employee.fullName,
                supervisorName: user.fullName,
                period: normalizedAppraisal.period.frequency || 'quarterly',
                appraisalUrl
              })
            });
          }
        } catch (emailError) {
          console.error('Failed to send CEO appraisal notification email:', emailError);
          // Continue even if email fails
        }
      }

      const updatedKpi = {
        ...settings?.kpi,
        records: {
          ...settings?.kpi?.records,
          [String(employeeId)]: updatedAppraisal
        }
      };

      const newSettings = await updateSettings({ kpi: updatedKpi });
      replaceSettings(newSettings);
      
      setSubmitModal({ open: false });
      setNotice({
        open: true,
        title: isCeo ? 'Appraisal Locked' : 'Review Submitted',
        description: isCeo 
          ? 'The appraisal has been locked and finalized. No further edits will be allowed.'
          : 'Your supervisor review has been submitted. The CEO will be notified for final review.'
      });
      
      setTimeout(() => navigate('/kpi-matrix'), 2000);
    } catch (error) {
      console.error('Failed to submit review:', error);
      setNotice({
        open: true,
        title: 'Submission Failed',
        description: 'Unable to submit your review. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCoreRoleScoreChange = (index, value) => {
    const newCoreRoles = [...form.supervisorReview.coreRoles];
    newCoreRoles[index] = { ...newCoreRoles[index], supervisorScore: Math.min(100, Math.max(0, Number(value) || 0)) };
    setForm({
      ...form,
      supervisorReview: { ...form.supervisorReview, coreRoles: newCoreRoles }
    });
  };

  const handleCoreRoleCommentChange = (index, value) => {
    const newCoreRoles = [...form.supervisorReview.coreRoles];
    newCoreRoles[index] = { ...newCoreRoles[index], supervisorComment: value };
    setForm({
      ...form,
      supervisorReview: { ...form.supervisorReview, coreRoles: newCoreRoles }
    });
  };

  const handleIndicatorScoreChange = (index, value) => {
    const newIndicators = [...form.supervisorReview.indicators];
    newIndicators[index] = { ...newIndicators[index], supervisorScore: Math.min(100, Math.max(0, Number(value) || 0)) };
    setForm({
      ...form,
      supervisorReview: { ...form.supervisorReview, indicators: newIndicators }
    });
  };

  const handleIndicatorCommentChange = (index, value) => {
    const newIndicators = [...form.supervisorReview.indicators];
    newIndicators[index] = { ...newIndicators[index], supervisorComment: value };
    setForm({
      ...form,
      supervisorReview: { ...form.supervisorReview, indicators: newIndicators }
    });
  };

  const selfScore = calculateAppraisalScore(normalizedAppraisal.selfAppraisal, 'self');
  const supervisorScore = calculateAppraisalScore(form.supervisorReview, 'supervisor');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading appraisal...</div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Employee not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${employee.fullName} - Appraisal Review`}
        subtitle={`Review and evaluate ${employee.fullName}'s performance appraisal.`}
        actions={[
          <button
            key="back"
            type="button"
            onClick={() => navigate('/kpi-matrix')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            <ArrowLeft size={16} /> Back to KPI Management
          </button>
        ]}
      />

      {/* Status Card */}
      <SectionCard title="Appraisal Status" subtitle="Current status of this appraisal">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${
              normalizedAppraisal.status === APPRAISAL_STATUS.DRAFT ? 'bg-amber-50 text-amber-700' :
              normalizedAppraisal.status === APPRAISAL_STATUS.SUBMITTED ? 'bg-blue-50 text-blue-700' :
              normalizedAppraisal.status === APPRAISAL_STATUS.REVIEWED ? 'bg-emerald-50 text-emerald-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {normalizedAppraisal.status === APPRAISAL_STATUS.LOCKED && <Lock size={16} />}
              {statusLabel}
            </div>
            {isLocked && (
              <span className="text-sm text-slate-500">This appraisal has been locked by the CEO and cannot be edited.</span>
            )}
          </div>
          <div className="flex gap-6 text-right">
            {selfScore !== null && (
              <div>
                <p className="text-sm text-slate-500">Self-Assessment Score</p>
                <p className="text-2xl font-bold text-slate-900">{selfScore}%</p>
              </div>
            )}
            {supervisorScore !== null && canViewSupervisorGrade && (
              <div>
                <p className="text-sm text-slate-500">Supervisor Score</p>
                <p className="text-2xl font-bold text-slate-900">{supervisorScore}%</p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Employee's Self-Appraisal */}
      <SectionCard title="Employee Self-Appraisal" subtitle="View the employee's self-evaluation">
        <div className="space-y-4">
          {/* Core Roles */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">Core Roles</h4>
            {normalizedAppraisal.selfAppraisal.coreRoles.length === 0 ? (
              <p className="text-sm text-slate-500">No core roles provided by employee.</p>
            ) : (
              normalizedAppraisal.selfAppraisal.coreRoles.map((coreRole, index) => (
                <div key={index} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <BriefcaseBusiness size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{coreRole.role || `Core Role ${index + 1}`}</p>
                    </div>
                  </div>
                  {coreRole.selfComment && (
                    <div className="ml-11">
                      <p className="text-xs text-slate-500 mb-1">Employee Comment:</p>
                      <p className="text-sm text-slate-700">{coreRole.selfComment}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* KPI Indicators */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-slate-900">KPI Indicators</h4>
            {normalizedAppraisal.selfAppraisal.indicators.length === 0 ? (
              <p className="text-sm text-slate-500">No KPI indicators provided by employee.</p>
            ) : (
              normalizedAppraisal.selfAppraisal.indicators.map((indicator, index) => (
                <div key={index} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Target size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{indicator.label || `KPI Indicator ${index + 1}`}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Self Score</p>
                      <p className="text-lg font-bold text-slate-900">{indicator.selfScore || 0}/100</p>
                    </div>
                  </div>
                  {indicator.selfComment && (
                    <div className="ml-11">
                      <p className="text-xs text-slate-500 mb-1">Employee Comment:</p>
                      <p className="text-sm text-slate-700">{indicator.selfComment}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Overall Comment */}
          {normalizedAppraisal.selfAppraisal.overallComment && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Overall Self-Assessment</h4>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-sm text-slate-700">{normalizedAppraisal.selfAppraisal.overallComment}</p>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Supervisor Review Section */}
      {(isSupervisor || isAdmin) && (
        <SectionCard 
          title={isSupervisor ? "Your Supervisor Review" : "Admin Review"} 
          subtitle="Evaluate the employee's performance and provide your assessment"
        >
          <div className="space-y-4">
            {/* Core Roles Evaluation */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-900">Core Roles Evaluation</h4>
              {normalizedAppraisal.selfAppraisal.coreRoles.length === 0 ? (
                <p className="text-sm text-slate-500">No core roles to evaluate.</p>
              ) : (
                normalizedAppraisal.selfAppraisal.coreRoles.map((coreRole, index) => (
                  <div key={index} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                        <ShieldCheck size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-slate-900">{coreRole.role || `Core Role ${index + 1}`}</p>
                      </div>
                    </div>
                    <div className="ml-11 space-y-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Your Score (0-100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={form.supervisorReview.coreRoles[index]?.supervisorScore || ''}
                          onChange={(e) => handleCoreRoleScoreChange(index, e.target.value)}
                          placeholder="Enter your score out of 100"
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Your Comment</label>
                        <textarea
                          rows="2"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={form.supervisorReview.coreRoles[index]?.supervisorComment || ''}
                          onChange={(e) => handleCoreRoleCommentChange(index, e.target.value)}
                          placeholder="Add your evaluation comments..."
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* KPI Indicators Evaluation */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-slate-900">KPI Indicators Evaluation</h4>
              {normalizedAppraisal.selfAppraisal.indicators.length === 0 ? (
                <p className="text-sm text-slate-500">No KPI indicators to evaluate.</p>
              ) : (
                normalizedAppraisal.selfAppraisal.indicators.map((indicator, index) => (
                  <div key={index} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                          <ShieldCheck size={16} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">{indicator.label || `KPI Indicator ${index + 1}`}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Employee Score</p>
                        <p className="text-lg font-bold text-slate-900">{indicator.selfScore || 0}/100</p>
                      </div>
                    </div>
                    <div className="ml-11 space-y-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Your Score (0-100)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={form.supervisorReview.indicators[index]?.supervisorScore || ''}
                          onChange={(e) => handleIndicatorScoreChange(index, e.target.value)}
                          placeholder="Enter your score out of 100"
                          disabled={!canEdit}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">Your Comment</label>
                        <textarea
                          rows="2"
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={form.supervisorReview.indicators[index]?.supervisorComment || ''}
                          onChange={(e) => handleIndicatorCommentChange(index, e.target.value)}
                          placeholder="Add your evaluation comments..."
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Overall Comment */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Your Overall Evaluation Comment</label>
              <textarea
                rows="4"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.supervisorReview.overallComment || ''}
                onChange={(e) => setForm({ ...form, supervisorReview: { ...form.supervisorReview, overallComment: e.target.value } })}
                placeholder="Provide your overall evaluation of the employee's performance..."
                disabled={!canEdit}
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* CEO Review Section */}
      {isCeo && (
        <SectionCard title="CEO Review" subtitle="Add your executive comments and finalize the appraisal">
          <div className="space-y-4">
            {/* View Supervisor Review */}
            {normalizedAppraisal.supervisorReview.submittedAt && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-sm font-semibold text-slate-900">Supervisor's Evaluation</h4>
                {supervisorScore !== null && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-500">Supervisor Score</p>
                    <p className="text-lg font-bold text-slate-900">{supervisorScore}%</p>
                  </div>
                )}
                {normalizedAppraisal.supervisorReview.overallComment && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Supervisor Comment:</p>
                    <p className="text-sm text-slate-700">{normalizedAppraisal.supervisorReview.overallComment}</p>
                  </div>
                )}
              </div>
            )}

            {/* CEO Comment */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Your Executive Comment (Optional)</label>
              <textarea
                rows="4"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={form.ceoReview.overallComment || ''}
                onChange={(e) => setForm({ ...form, ceoReview: { ...form.ceoReview, overallComment: e.target.value } })}
                placeholder="Add your executive comments about this appraisal..."
                disabled={!canEdit}
              />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Action Buttons */}
      {canEdit && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={() => setSubmitModal({ open: true })}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-gradient px-6 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {isCeo ? <Crown size={16} /> : <Send size={16} />}
            {submitting ? 'Submitting...' : isCeo ? 'Lock Appraisal' : 'Submit Review'}
          </button>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={submitModal.open}
        onClose={() => setSubmitModal({ open: false })}
        title={isCeo ? 'Lock Appraisal' : 'Submit Review'}
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            {isCeo 
              ? 'Are you sure you want to lock this appraisal? Once locked, no further edits will be allowed by anyone.'
              : 'Are you sure you want to submit your review? Once submitted, the CEO will be notified for final review and you will not be able to make further edits.'}
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setSubmitModal({ open: false })}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : isCeo ? 'Confirm Lock' : 'Confirm Submit'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Notice Modal */}
      <Modal
        isOpen={notice.open}
        onClose={() => setNotice({ open: false, title: '', description: '' })}
        title={notice.title}
      >
        <p className="text-slate-600">{notice.description}</p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={() => setNotice({ open: false, title: '', description: '' })}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            OK
          </button>
        </div>
      </Modal>
    </div>
  );
}