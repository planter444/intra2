import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, ChartColumnIncreasing, Lock, Unlock, Save, Plus, Trash2, Sparkles, Settings } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { updateSettings } from '../services/settingsService';
import { usePagePresentation } from '../hooks/usePagePresentation';
import { getAverageKpiScore, getNormalizedKpiEntry } from '../utils/kpi';

const accentClasses = [
  'from-blue-600/15 to-blue-100',
  'from-emerald-600/15 to-emerald-100',
  'from-fuchsia-600/15 to-fuchsia-100',
  'from-amber-500/15 to-amber-100',
  'from-rose-500/15 to-rose-100',
  'from-cyan-500/15 to-cyan-100'
];

export default function KPIMatrixPage() {
  const navigate = useNavigate();
  const { settings, user, replaceSettings } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const { cardStyle, animationStyle } = usePagePresentation();
  const canManageKpi = ['admin', 'ceo', 'finance'].includes(user?.role) || settings?.kpi?.editors?.includes(String(user?.id));

  useEffect(() => {
    fetchUsers().then((list) => setUsers(list)).catch(() => setUsers([]));
  }, []);

  const rows = useMemo(
    () => users.filter((entry) => entry.isActive && !entry.isDeleted && entry.role !== 'ceo').sort((left, right) => left.fullName.localeCompare(right.fullName)),
    [users]
  );

  const employeesWithScores = useMemo(
    () => rows.filter((employee) => getAverageKpiScore(getNormalizedKpiEntry(settings?.kpi?.records?.[String(employee.id)] || settings?.kpi?.matrix?.[String(employee.id)] || {})) !== null).length,
    [rows, settings?.kpi?.matrix, settings?.kpi?.records]
  );

  const selectedEmployee = rows.find((emp) => String(emp.id) === String(selectedEmployeeId));
  const employeeKpiData = selectedEmployee ? (settings?.kpi?.records?.[String(selectedEmployee.id)] || settings?.kpi?.matrix?.[String(selectedEmployee.id)] || {}) : {};

  const handleSelectEmployee = (employeeId) => {
    setSelectedEmployeeId(employeeId);
    setEditMode(false);
    const emp = rows.find((e) => String(e.id) === String(employeeId));
    if (emp) {
      const kpiData = settings?.kpi?.records?.[String(employeeId)] || settings?.kpi?.matrix?.[String(employeeId)] || {};
      
      // Migrate old string-based coreRoles to object format
      const migratedCoreRoles = (kpiData.coreRoles || []).map(role => {
        if (typeof role === 'string') {
          return { role, comment: '' };
        }
        return role;
      });
      
      // Migrate old indicators without comment to include comment field
      const migratedIndicators = (kpiData.indicators || []).map(indicator => ({
        ...indicator,
        comment: indicator.comment || ''
      }));
      
      setEditForm({
        description: kpiData.description || '',
        coreRoles: migratedCoreRoles,
        indicators: migratedIndicators,
        assessmentFrequency: kpiData.assessmentFrequency || 'monthly',
        locked: kpiData.locked || false
      });
    }
  };

  const [notice, setNotice] = useState({ open: false, title: '', description: '' });

  const handleSave = async () => {
    try {
      const updatedKpi = {
        ...settings?.kpi,
        records: {
          ...settings?.kpi?.records,
          [String(selectedEmployeeId)]: {
            ...editForm,
            updatedAt: new Date().toISOString(),
            audit: {
              lastModifiedBy: user.id,
              lastModifiedAt: new Date().toISOString(),
              lastModifiedByName: user.fullName
            }
          }
        }
      };
      const newSettings = await updateSettings({ kpi: updatedKpi });
      replaceSettings(newSettings);
      setEditMode(false);
      setNotice({
        open: true,
        title: 'KPI Saved Successfully',
        description: `KPI data for ${selectedEmployee?.fullName} has been updated.`
      });
    } catch (error) {
      console.error('Failed to save KPI data:', error);
      setNotice({
        open: true,
        title: 'Save Failed',
        description: 'Unable to save KPI data. Please try again.'
      });
    }
  };

  const handleAddCoreRole = () => {
    setEditForm({ ...editForm, coreRoles: [...editForm.coreRoles, { role: '', comment: '' }] });
  };

  const handleRemoveCoreRole = (index) => {
    setEditForm({ ...editForm, coreRoles: editForm.coreRoles.filter((_, i) => i !== index) });
  };

  const handleCoreRoleChange = (index, field, value) => {
    const newRoles = [...editForm.coreRoles];
    newRoles[index] = { ...newRoles[index], [field]: value };
    setEditForm({ ...editForm, coreRoles: newRoles });
  };

  const handleAddIndicator = () => {
    setEditForm({ ...editForm, indicators: [...editForm.indicators, { label: '', score: '', weight: '', comment: '' }] });
  };

  const handleRemoveIndicator = (index) => {
    setEditForm({ ...editForm, indicators: editForm.indicators.filter((_, i) => i !== index) });
  };

  const handleIndicatorChange = (index, field, value) => {
    const newIndicators = [...editForm.indicators];
    newIndicators[index] = { ...newIndicators[index], [field]: value };
    setEditForm({ ...editForm, indicators: newIndicators });
  };

  const handleToggleLock = async () => {
    try {
      const updatedKpi = {
        ...settings?.kpi,
        records: {
          ...settings?.kpi?.records,
          [String(selectedEmployeeId)]: {
            ...employeeKpiData,
            locked: !employeeKpiData.locked,
            lockedAt: !employeeKpiData.locked ? new Date().toISOString() : null,
            lockedBy: !employeeKpiData.locked ? user.id : null
          }
        }
      };
      const newSettings = await updateSettings({ kpi: updatedKpi });
      replaceSettings(newSettings);
      setNotice({
        open: true,
        title: employeeKpiData.locked ? 'KPI Unlocked' : 'KPI Locked',
        description: employeeKpiData.locked 
          ? `KPI assessment for ${selectedEmployee?.fullName} has been unlocked and can now be edited.`
          : `KPI assessment for ${selectedEmployee?.fullName} has been locked. No further edits will be allowed.`
      });
    } catch (error) {
      console.error('Failed to toggle lock:', error);
      setNotice({
        open: true,
        title: 'Lock Toggle Failed',
        description: 'Unable to update lock status. Please try again.'
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Management"
        subtitle="Select an employee to view and manage their KPI configuration and scores."
        actions={canManageKpi ? [
          <Link
            key="settings"
            to="/settings"
            state={{ settingsPage: 'kpi' }}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Settings size={16} /> KPI Settings
          </Link>
        ] : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard title="Employees" value={rows.length} helper="Active employees available for KPI review" accent="from-emerald-700 to-green-500" />
        <StatCard title="Configured profiles" value={employeesWithScores} helper="Employees with at least one saved KPI score" accent="from-sky-700 to-cyan-500" />
        <StatCard title="KPI editing" value="Inline" helper="Edit KPIs directly from this page" accent="from-violet-700 to-fuchsia-500" />
      </div>

      <SectionCard title="Select Employee" subtitle="Choose an employee to view and manage their KPI details." style={{ ...cardStyle, ...animationStyle }}>
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-slate-700">Select Employee</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => handleSelectEmployee(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">-- Select an employee --</option>
            {rows.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName} - {employee.positionTitle || employee.roleTitle || 'No designation'}
              </option>
            ))}
          </select>
        </div>

        {selectedEmployee && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{selectedEmployee.fullName}</h3>
                <p className="text-sm text-slate-500">{selectedEmployee.positionTitle || selectedEmployee.roleTitle || 'No designation'}</p>
              </div>
              <div className="flex gap-2">
                {canManageKpi && !employeeKpiData.locked && (
                  <>
                    {editMode ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        onClick={handleSave}
                      >
                        <Save size={16} /> Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        onClick={() => setEditMode(true)}
                      >
                        <BriefcaseBusiness size={16} /> Edit
                      </button>
                    )}
                  </>
                )}
                {user.role === 'ceo' && (
                  <div className="relative group">
                    <button
                      type="button"
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${employeeKpiData.locked ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                      onClick={handleToggleLock}
                    >
                      {employeeKpiData.locked ? <Lock size={16} /> : <Unlock size={16} />}
                      {employeeKpiData.locked ? 'Locked' : 'Lock'}
                    </button>
                    <div className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      {employeeKpiData.locked 
                        ? 'Click to unlock this KPI assessment. Once unlocked, edits will be allowed again.'
                        : 'Click to lock this KPI assessment. Once locked, no further edits will be allowed by anyone.'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {editMode ? (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">KPI Description</label>
                  <textarea
                    rows="2"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Describe the KPI framework for this employee..."
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Assessment Frequency</label>
                  <select
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={editForm.assessmentFrequency}
                    onChange={(e) => setEditForm({ ...editForm, assessmentFrequency: e.target.value })}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half-yearly">Half-Yearly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">Core Roles</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={handleAddCoreRole}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {editForm.coreRoles.map((role, index) => (
                      <div key={index} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                            value={role.role || ''}
                            onChange={(e) => handleCoreRoleChange(index, 'role', e.target.value)}
                            placeholder="Enter core role..."
                          />
                          <button
                            type="button"
                            className="rounded-lg border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50"
                            onClick={() => handleRemoveCoreRole(index)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <textarea
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                          value={role.comment || ''}
                          onChange={(e) => handleCoreRoleChange(index, 'comment', e.target.value)}
                          placeholder="Add optional comment for grading..."
                          rows="2"
                        />
                      </div>
                    ))}
                    {editForm.coreRoles.length === 0 && (
                      <p className="text-sm text-slate-500">No core roles added yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">KPI Indicators</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={handleAddIndicator}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editForm.indicators.map((indicator, index) => (
                      <div key={index} className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                        <div className="mb-2 flex gap-2">
                          <input
                            type="text"
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                            value={indicator.label}
                            onChange={(e) => handleIndicatorChange(index, 'label', e.target.value)}
                            placeholder="KPI indicator name..."
                          />
                          <button
                            type="button"
                            className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50"
                            onClick={() => handleRemoveIndicator(index)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input
                            type="number"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                            value={indicator.score}
                            onChange={(e) => handleIndicatorChange(index, 'score', e.target.value)}
                            placeholder="Score (0-100)"
                            min="0"
                            max="100"
                          />
                          <input
                            type="number"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                            value={indicator.weight}
                            onChange={(e) => handleIndicatorChange(index, 'weight', e.target.value)}
                            placeholder="Weight (%)"
                            min="0"
                            max="100"
                          />
                        </div>
                        <textarea
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
                          value={indicator.comment || ''}
                          onChange={(e) => handleIndicatorChange(index, 'comment', e.target.value)}
                          placeholder="Add optional comment for grading..."
                          rows="2"
                        />
                      </div>
                    ))}
                    {editForm.indicators.length === 0 && (
                      <p className="text-sm text-slate-500">No KPI indicators added yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">KPI Description</h4>
                  <p className="text-slate-700">{employeeKpiData.description || 'No description provided.'}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Assessment Frequency</h4>
                  <p className="text-slate-700 capitalize">{employeeKpiData.assessmentFrequency || 'monthly'}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Core Roles</h4>
                  <div className="space-y-1.5">
                    {employeeKpiData.coreRoles?.filter((role) => {
                      const roleText = typeof role === 'string' ? role : role?.role;
                      return String(roleText || '').trim();
                    }).length > 0 ? (
                      employeeKpiData.coreRoles.filter((role) => {
                        const roleText = typeof role === 'string' ? role : role?.role;
                        return String(roleText || '').trim();
                      }).map((role, index) => {
                        const roleText = typeof role === 'string' ? role : role?.role;
                        const commentText = typeof role === 'string' ? '' : role?.comment;
                        return (
                          <div key={index} className="flex items-center gap-2 text-slate-700">
                            <BriefcaseBusiness size={16} className="text-emerald-600" />
                            <span>{roleText}</span>
                            {commentText && <span className="text-xs text-slate-500 italic">- {commentText}</span>}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-slate-500">No core roles configured.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">KPI Indicators & Scores</h4>
                  <div className="space-y-2">
                    {employeeKpiData.indicators?.filter((ind) => String(ind?.label || '').trim()).length > 0 ? (
                      employeeKpiData.indicators.filter((ind) => String(ind?.label || '').trim()).map((indicator, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 text-sm">{indicator.label}</p>
                            <p className="text-xs text-slate-500">Weight: {indicator.weight || 0}%</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${indicator.score >= 80 ? 'bg-emerald-100 text-emerald-700' : indicator.score >= 60 ? 'bg-amber-100 text-amber-700' : indicator.score >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-rose-100 text-rose-700'}`}>
                            {indicator.score || 0}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500">No KPI indicators configured.</p>
                    )}
                  </div>
                </div>

                {employeeKpiData.locked && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Lock size={14} />
                      <span className="font-medium text-sm">KPI Assessment Locked</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-700">This KPI assessment has been locked by CEO and cannot be modified.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
