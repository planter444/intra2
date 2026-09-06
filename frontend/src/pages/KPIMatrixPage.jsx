import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BriefcaseBusiness, ChartColumnIncreasing, Lock, Unlock, Save, Plus, Trash2, Sparkles } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
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
  const { settings, user, updateSettings } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const { cardStyle, animationStyle } = usePagePresentation();
  const canManageKpi = ['admin', 'ceo', 'finance'].includes(user?.role);

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
      setEditForm({
        description: kpiData.description || '',
        coreRoles: kpiData.coreRoles || [],
        indicators: kpiData.indicators || [],
        assessmentFrequency: kpiData.assessmentFrequency || 'monthly',
        locked: kpiData.locked || false
      });
    }
  };

  const handleSave = async () => {
    try {
      const updatedKpi = {
        ...settings?.kpi,
        records: {
          ...settings?.kpi?.records,
          [String(selectedEmployeeId)]: {
            ...editForm,
            updatedAt: new Date().toISOString()
          }
        }
      };
      await updateSettings({ kpi: updatedKpi });
      setEditMode(false);
    } catch (error) {
      console.error('Failed to save KPI data:', error);
    }
  };

  const handleAddCoreRole = () => {
    setEditForm({ ...editForm, coreRoles: [...editForm.coreRoles, ''] });
  };

  const handleRemoveCoreRole = (index) => {
    setEditForm({ ...editForm, coreRoles: editForm.coreRoles.filter((_, i) => i !== index) });
  };

  const handleCoreRoleChange = (index, value) => {
    const newRoles = [...editForm.coreRoles];
    newRoles[index] = value;
    setEditForm({ ...editForm, coreRoles: newRoles });
  };

  const handleAddIndicator = () => {
    setEditForm({ ...editForm, indicators: [...editForm.indicators, { label: '', score: '', weight: '' }] });
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
      await updateSettings({ kpi: updatedKpi });
    } catch (error) {
      console.error('Failed to toggle lock:', error);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="KPI Management"
        subtitle="Select an employee to view and manage their KPI configuration and scores."
        actions={user.role === 'admin' || user.role === 'ceo' ? [
          <button
            key="seed-kpi"
            type="button"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={async () => {
              if (confirm('This will seed KPI data for all employees with random core roles and indicators. Continue?')) {
                try {
                  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/settings/seed-kpi`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                  });
                  const data = await response.json();
                  if (data.success) {
                    alert(data.message);
                    window.location.reload();
                  }
                } catch (error) {
                  alert('Failed to seed KPI data');
                }
              }
            }}
          >
            <Sparkles size={16} /> Seed KPI Data
          </button>
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
                {canManageKpi && (
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
                    {user.role === 'ceo' && (
                      <button
                        type="button"
                        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${employeeKpiData.locked ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                        onClick={handleToggleLock}
                      >
                        {employeeKpiData.locked ? <Lock size={16} /> : <Unlock size={16} />}
                        {employeeKpiData.locked ? 'Locked' : 'Lock'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {editMode ? (
              <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">KPI Description</label>
                  <textarea
                    rows="3"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Describe the KPI framework for this employee..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Assessment Frequency</label>
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
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">Core Roles</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={handleAddCoreRole}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editForm.coreRoles.map((role, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                          value={role}
                          onChange={(e) => handleCoreRoleChange(index, e.target.value)}
                          placeholder="Enter core role..."
                        />
                        <button
                          type="button"
                          className="rounded-lg border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleRemoveCoreRole(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {editForm.coreRoles.length === 0 && (
                      <p className="text-sm text-slate-500">No core roles added yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">KPI Indicators</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      onClick={handleAddIndicator}
                    >
                      <Plus size={14} /> Add
                    </button>
                  </div>
                  <div className="space-y-3">
                    {editForm.indicators.map((indicator, index) => (
                      <div key={index} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="mb-2 flex gap-2">
                          <input
                            type="text"
                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
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
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={indicator.score}
                            onChange={(e) => handleIndicatorChange(index, 'score', e.target.value)}
                            placeholder="Score (0-100)"
                            min="0"
                            max="100"
                          />
                          <input
                            type="number"
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                            value={indicator.weight}
                            onChange={(e) => handleIndicatorChange(index, 'weight', e.target.value)}
                            placeholder="Weight (%)"
                            min="0"
                            max="100"
                          />
                        </div>
                      </div>
                    ))}
                    {editForm.indicators.length === 0 && (
                      <p className="text-sm text-slate-500">No KPI indicators added yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">KPI Description</h4>
                  <p className="text-slate-700">{employeeKpiData.description || 'No description provided.'}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Assessment Frequency</h4>
                  <p className="text-slate-700 capitalize">{employeeKpiData.assessmentFrequency || 'monthly'}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Core Roles</h4>
                  <div className="space-y-2">
                    {employeeKpiData.coreRoles?.filter((role) => String(role || '').trim()).length > 0 ? (
                      employeeKpiData.coreRoles.filter((role) => String(role || '').trim()).map((role, index) => (
                        <div key={index} className="flex items-center gap-2 text-slate-700">
                          <BriefcaseBusiness size={16} className="text-emerald-600" />
                          <span>{role}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500">No core roles configured.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">KPI Indicators & Scores</h4>
                  <div className="space-y-3">
                    {employeeKpiData.indicators?.filter((ind) => String(ind?.label || '').trim()).length > 0 ? (
                      employeeKpiData.indicators.filter((ind) => String(ind?.label || '').trim()).map((indicator, index) => (
                        <div key={index} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">{indicator.label}</p>
                            <p className="text-xs text-slate-500">Weight: {indicator.weight || 0}%</p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${indicator.score >= 80 ? 'bg-emerald-100 text-emerald-700' : indicator.score >= 60 ? 'bg-amber-100 text-amber-700' : indicator.score >= 40 ? 'bg-orange-100 text-orange-700' : 'bg-rose-100 text-rose-700'}`}>
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
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Lock size={16} />
                      <span className="font-medium">KPI Assessment Locked</span>
                    </div>
                    <p className="mt-1 text-sm text-amber-700">This KPI assessment has been locked by CEO and cannot be modified.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
