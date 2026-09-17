import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Send, ArrowLeft, User, BriefcaseBusiness, Target, Lock, AlertCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { updateSettings } from '../services/settingsService';
import { getNormalizedKpiEntry, migrateLegacyKpiToAppraisal, normalizeAppraisalData, APPRAISAL_STATUS, getAppraisalStatusLabel, calculateAppraisalScore, canEditAppraisal } from '../utils/kpi';
import { fetchUsers } from '../services/userService';

export default function EmployeeSelfAppraisalPage() {
  const navigate = useNavigate();
  const { settings, user, replaceSettings } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [submitModal, setSubmitModal] = useState({ open: false });
  const [users, setUsers] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // Get current appraisal data for the user
  const currentAppraisal = settings?.kpi?.records?.[String(user.id)] || {};
  const normalizedAppraisal = normalizeAppraisalData(currentAppraisal);
  
  // Form state for self-appraisal
  const [form, setForm] = useState({
    period: {
      startDate: normalizedAppraisal.period.startDate || '',
      endDate: normalizedAppraisal.period.endDate || '',
      frequency: normalizedAppraisal.period.frequency || 'quarterly'
    },
    selfAppraisal: {
      coreRoles: normalizedAppraisal.selfAppraisal.coreRoles || [],
      indicators: normalizedAppraisal.selfAppraisal.indicators || [],
      overallComment: normalizedAppraisal.selfAppraisal.overallComment || ''
    }
  });

  const canEdit = canEditAppraisal(normalizedAppraisal, user.role, user.id);
  const isLocked = normalizedAppraisal.status === APPRAISAL_STATUS.LOCKED;
  const statusLabel = getAppraisalStatusLabel(normalizedAppraisal.status);

  useEffect(() => {
    // Load users for supervisor lookup
    const loadUsers = async () => {
      try {
        const usersList = await fetchUsers();
        setUsers(usersList);
      } catch (error) {
        console.error('Failed to load users:', error);
      }
    };
    loadUsers();

    // If no appraisal exists, migrate from legacy KPI data
    if (!currentAppraisal || Object.keys(currentAppraisal).length === 0) {
      const legacyKpi = settings?.kpi?.records?.[String(user.id)] || {};
      if (legacyKpi && (legacyKpi.coreRoles || legacyKpi.indicators)) {
        const migratedAppraisal = migrateLegacyKpiToAppraisal(legacyKpi);
        setForm({
          period: migratedAppraisal.period,
          selfAppraisal: migratedAppraisal.selfAppraisal
        });
      }
    }
    setLoading(false);
  }, [currentAppraisal, settings, user.id]);

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
        status: APPRAISAL_STATUS.DRAFT,
        audit: {
          ...normalizedAppraisal.audit,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: user.id
        }
      };

      const updatedKpi = {
        ...settings?.kpi,
        records: {
          ...settings?.kpi?.records,
          [String(user.id)]: updatedAppraisal
        }
      };

      const newSettings = await updateSettings({ kpi: updatedKpi });
      replaceSettings(newSettings);
      
      setNotice({
        open: true,
        title: 'Draft Saved',
        description: 'Your self-appraisal draft has been saved successfully.'
      });
    } catch (error) {
      console.error('Failed to save appraisal:', error);
      setNotice({
        open: true,
        title: 'Save Failed',
        description: 'Unable to save your appraisal. Please try again.'
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
        status: APPRAISAL_STATUS.SUBMITTED,
        selfAppraisal: {
          ...form.selfAppraisal,
          submittedAt: new Date().toISOString()
        },
        audit: {
          ...normalizedAppraisal.audit,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedBy: user.id
        }
      };

      const updatedKpi = {
        ...settings?.kpi,
        records: {
          ...settings?.kpi?.records,
          [String(user.id)]: updatedAppraisal
        }
      };

      const newSettings = await updateSettings({ kpi: updatedKpi });
      replaceSettings(newSettings);
      
      // Send email notification to supervisor (best-effort)
      try {
        const supervisor = users.find(u => String(u.id) === String(user.supervisorId));
        if (supervisor && supervisor.email) {
          const appraisalUrl = `${window.location.origin}/kpi-review/${user.id}`;
          await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/mail/appraisal-submitted`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              toEmail: supervisor.email,
              toName: supervisor.fullName,
              employeeName: user.fullName,
              period: form.period.frequency || 'quarterly',
              appraisalUrl
            })
          });
        }
      } catch (emailError) {
        console.error('Failed to send appraisal notification email:', emailError);
        // Continue even if email fails
      }
      
      setSubmitModal({ open: false });
      setNotice({
        open: true,
        title: 'Appraisal Submitted',
        description: 'Your self-appraisal has been submitted to your supervisor for review.'
      });
      
      // Navigate back after successful submission
      setTimeout(() => navigate('/kpi-self'), 2000);
    } catch (error) {
      console.error('Failed to submit appraisal:', error);
      setNotice({
        open: true,
        title: 'Submission Failed',
        description: 'Unable to submit your appraisal. Please try again.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCoreRoleCommentChange = (index, value) => {
    const newCoreRoles = [...form.selfAppraisal.coreRoles];
    newCoreRoles[index] = { ...newCoreRoles[index], selfComment: value };
    setForm({
      ...form,
      selfAppraisal: { ...form.selfAppraisal, coreRoles: newCoreRoles }
    });
  };

  const handleIndicatorScoreChange = (index, value) => {
    const newIndicators = [...form.selfAppraisal.indicators];
    newIndicators[index] = { ...newIndicators[index], selfScore: Math.min(100, Math.max(0, Number(value) || 0)) };
    setForm({
      ...form,
      selfAppraisal: { ...form.selfAppraisal, indicators: newIndicators }
    });
  };

  const handleIndicatorCommentChange = (index, value) => {
    const newIndicators = [...form.selfAppraisal.indicators];
    newIndicators[index] = { ...newIndicators[index], selfComment: value };
    setForm({
      ...form,
      selfAppraisal: { ...form.selfAppraisal, indicators: newIndicators }
    });
  };

  const selfScore = calculateAppraisalScore(form, 'self');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading your appraisal...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Self-Appraisal"
        subtitle="Evaluate your performance against your core roles and KPI indicators."
        actions={[
          <button
            key="back"
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        ]}
      />

      {/* Status Card */}
      <SectionCard title="Appraisal Status" subtitle="Current status of your appraisal">
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
          {selfScore !== null && (
            <div className="text-right">
              <p className="text-sm text-slate-500">Your Self-Assessment Score</p>
              <p className="text-2xl font-bold text-slate-900">{selfScore}%</p>
            </div>
          )}
        </div>
        
        {/* Audit Trail */}
        {normalizedAppraisal.audit && (normalizedAppraisal.audit.createdAt || normalizedAppraisal.audit.lastModifiedAt) && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">Appraisal Timeline</h4>
            <div className="space-y-2 text-sm">
              {normalizedAppraisal.audit.createdAt && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400">Created:</span>
                  <span>{new Date(normalizedAppraisal.audit.createdAt).toLocaleString()}</span>
                </div>
              )}
              {normalizedAppraisal.selfAppraisal.submittedAt && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400">Self-Appraisal Submitted:</span>
                  <span>{new Date(normalizedAppraisal.selfAppraisal.submittedAt).toLocaleString()}</span>
                </div>
              )}
              {normalizedAppraisal.supervisorReview.submittedAt && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400">Supervisor Review Completed:</span>
                  <span>{new Date(normalizedAppraisal.supervisorReview.submittedAt).toLocaleString()}</span>
                </div>
              )}
              {normalizedAppraisal.ceoReview.submittedAt && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400">CEO Review Completed:</span>
                  <span>{new Date(normalizedAppraisal.ceoReview.submittedAt).toLocaleString()}</span>
                </div>
              )}
              {normalizedAppraisal.audit.lastModifiedAt && (
                <div className="flex items-center gap-2 text-slate-600">
                  <span className="text-slate-400">Last Modified:</span>
                  <span>{new Date(normalizedAppraisal.audit.lastModifiedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* Assessment Period */}
      <SectionCard title="Assessment Period" subtitle="Define the time period for this appraisal">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Start Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
              value={form.period.startDate}
              onChange={(e) => setForm({ ...form, period: { ...form.period, startDate: e.target.value } })}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">End Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
              value={form.period.endDate}
              onChange={(e) => setForm({ ...form, period: { ...form.period, endDate: e.target.value } })}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Frequency</label>
            <select
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm"
              value={form.period.frequency}
              onChange={(e) => setForm({ ...form, period: { ...form.period, frequency: e.target.value } })}
              disabled={!canEdit}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="half-yearly">Half-Yearly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Core Roles */}
      <SectionCard title="Core Roles" subtitle="Your main responsibilities - add your self-evaluation comments">
        <div className="space-y-4">
          {form.selfAppraisal.coreRoles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
              No core roles have been configured for your appraisal yet. Please contact your supervisor.
            </div>
          ) : (
            form.selfAppraisal.coreRoles.map((coreRole, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                    <BriefcaseBusiness size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">{coreRole.role || `Core Role ${index + 1}`}</p>
                    <p className="text-xs text-slate-500">This role description is set by your supervisor and cannot be edited.</p>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Your Self-Evaluation Comment</label>
                  <textarea
                    rows="3"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={coreRole.selfComment || ''}
                    onChange={(e) => handleCoreRoleCommentChange(index, e.target.value)}
                    placeholder="Describe your performance in this role..."
                    disabled={!canEdit}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      {/* KPI Indicators */}
      <SectionCard title="KPI Indicators" subtitle="Rate your performance on each indicator (out of 100)">
        <div className="space-y-4">
          {form.selfAppraisal.indicators.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
              No KPI indicators have been configured for your appraisal yet. Please contact your supervisor.
            </div>
          ) : (
            form.selfAppraisal.indicators.map((indicator, index) => (
              <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <Target size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{indicator.label || `KPI Indicator ${index + 1}`}</p>
                      <p className="text-xs text-slate-500">This indicator is set by your supervisor and cannot be edited.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Your Score</p>
                    <p className="text-lg font-bold text-slate-900">{indicator.selfScore || 0}/100</p>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="mb-2 block text-sm font-medium text-slate-700">Your Self-Assessment Score (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={indicator.selfScore || ''}
                    onChange={(e) => handleIndicatorScoreChange(index, e.target.value)}
                    placeholder="Enter your score out of 100"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Your Self-Evaluation Comment</label>
                  <textarea
                    rows="2"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={indicator.selfComment || ''}
                    onChange={(e) => handleIndicatorCommentChange(index, e.target.value)}
                    placeholder="Add comments about your performance on this indicator..."
                    disabled={!canEdit}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      {/* Overall Comment */}
      <SectionCard title="Overall Self-Assessment" subtitle="Add your overall comments about your performance during this period">
        <textarea
          rows="4"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          value={form.selfAppraisal.overallComment || ''}
          onChange={(e) => setForm({ ...form, selfAppraisal: { ...form.selfAppraisal, overallComment: e.target.value } })}
          placeholder="Provide your overall self-assessment comments..."
          disabled={!canEdit}
        />
      </SectionCard>

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
            <Send size={16} /> {submitting ? 'Submitting...' : 'Submit to Supervisor'}
          </button>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      <Modal
        isOpen={submitModal.open}
        onClose={() => setSubmitModal({ open: false })}
        title="Submit Self-Appraisal"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Are you sure you want to submit your self-appraisal? Once submitted, it will be sent to your supervisor for review and you will not be able to make further edits.
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
              {submitting ? 'Submitting...' : 'Confirm Submit'}
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