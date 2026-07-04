import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Download, Eye, FileText, Plus, Printer, Save, Settings, Trash2, Users, X } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import {
  fetchPayslips,
  generatePayslips,
  downloadPayslipBlob,
  fetchPayrollProfile,
  savePayrollProfile
} from '../services/payslipService';

const PRIVILEGED_ROLES = ['admin', 'ceo', 'finance'];

const currentPeriod = () => new Date().toISOString().slice(0, 7);

const emptyProfile = {
  idNumber: '',
  kraPin: '',
  nssfNumber: '',
  shifNumber: '',
  paymentMode: 'Bank Transfer',
  grossSalary: 0,
  allowances: 0,
  bonuses: 0,
  overtime: 0,
  gratuity: 0,
  paye: 0,
  nssf: 0,
  shif: 0,
  housingLevy: 0,
  pension: 0,
  otherDeductions: 0,
  personalRelief: 2400,
  insuranceRelief: 0,
  otherContributions: []
};

const numberFields = [
  ['grossSalary', 'Basic / Gross Salary'],
  ['allowances', 'Allowances'],
  ['bonuses', 'Bonuses'],
  ['overtime', 'Overtime'],
  ['gratuity', 'Gratuity'],
  ['paye', 'PAYE'],
  ['nssf', 'NSSF'],
  ['shif', 'SHIF'],
  ['housingLevy', 'Housing Levy'],
  ['pension', 'Pension'],
  ['otherDeductions', 'Other Deductions'],
  ['personalRelief', 'Personal Relief'],
  ['insuranceRelief', 'Insurance Relief']
];

const textFields = [
  ['idNumber', 'ID Number'],
  ['kraPin', 'KRA PIN'],
  ['nssfNumber', 'NSSF Number'],
  ['shifNumber', 'SHIF Number'],
  ['paymentMode', 'Payment Mode']
];

const formatMoney = (value) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PayslipsPage() {
  const { user } = useAuth();
  const privileged = PRIVILEGED_ROLES.includes(user?.role);

  const [payslips, setPayslips] = useState([]);
  const [loadingPayslips, setLoadingPayslips] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [period, setPeriod] = useState(currentPeriod());
  const [profile, setProfile] = useState(emptyProfile);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);
  const [popup, setPopup] = useState(null);

  const loadPayslips = () => {
    setLoadingPayslips(true);
    fetchPayslips()
      .then(setPayslips)
      .catch(() => setPayslips([]))
      .finally(() => setLoadingPayslips(false));
  };

  useEffect(() => {
    loadPayslips();
  }, []);

  useEffect(() => {
    if (!privileged) {
      return;
    }
    fetchUsers()
      .then((data) => {
        const active = data.filter((emp) => emp.isActive && !emp.isDeleted);
        setEmployees(active);
        if (active.length) {
          setSelectedEmployeeId(String(active[0].id));
        }
      })
      .catch(() => setEmployees([]));
  }, [privileged]);

  useEffect(() => {
    if (!privileged || !selectedEmployeeId) {
      return;
    }
    setProfileLoading(true);
    fetchPayrollProfile(selectedEmployeeId)
      .then((data) => setProfile(data ? { ...emptyProfile, ...data } : emptyProfile))
      .catch(() => setProfile(emptyProfile))
      .finally(() => setProfileLoading(false));
  }, [privileged, selectedEmployeeId]);

  const selectedEmployee = useMemo(
    () => employees.find((emp) => String(emp.id) === String(selectedEmployeeId)),
    [employees, selectedEmployeeId]
  );

  const totals = useMemo(() => {
    const earnings = ['grossSalary', 'allowances', 'bonuses', 'overtime', 'gratuity']
      .reduce((sum, key) => sum + Number(profile[key] || 0), 0);
    const deductions = ['paye', 'nssf', 'shif', 'housingLevy', 'pension', 'otherDeductions']
      .reduce((sum, key) => sum + Number(profile[key] || 0), 0);
    return { earnings, deductions, net: earnings - deductions };
  }, [profile]);

  const notify = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 6000);
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      await savePayrollProfile(selectedEmployeeId, profile);
      setPopup({
        title: 'Payroll details saved',
        lines: [`Payroll details for ${selectedEmployee?.fullName || 'the employee'} have been saved successfully.`]
      });
    } catch (error) {
      notify('error', error.response?.data?.message || 'Unable to save payroll details.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async (all = false) => {
    try {
      setGenerating(true);
      const payload = all ? { period, all: true } : { period, userId: selectedEmployeeId };
      const result = await generatePayslips(payload);
      const generatedCount = result.generated?.length || 0;
      const failed = result.failed || [];
      const periodLabel = new Date(`${period}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const lines = [`${generatedCount} payslip${generatedCount === 1 ? '' : 's'} generated for ${periodLabel}.`];
      if (!all && generatedCount === 1) {
        lines[0] = `Payslip for ${result.generated[0].name} (${periodLabel}) has been generated successfully.`;
      }
      if (failed.length) {
        lines.push(`Skipped ${failed.length}: ${failed.map((item) => `${item.name || item.userId} — ${item.error}`).join('; ')}`);
      }
      setPopup({ title: failed.length ? 'Generation completed with warnings' : 'Payslips generated', lines, warning: failed.length > 0 });
      loadPayslips();
    } catch (error) {
      notify('error', error.response?.data?.message || 'Unable to generate payslips.');
    } finally {
      setGenerating(false);
    }
  };

  const openPayslip = async (payslip, print = false) => {
    try {
      const blob = await downloadPayslipBlob(payslip.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const win = window.open(url, '_blank');
      if (print && win) {
        win.onload = () => win.print();
      }
    } catch (error) {
      notify('error', 'Unable to open this payslip.');
    }
  };

  const downloadPayslip = async (payslip) => {
    try {
      const blob = await downloadPayslipBlob(payslip.id);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip_${payslip.employeeNo || payslip.userId}_${payslip.period}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      notify('error', 'Unable to download this payslip.');
    }
  };

  const updateContribution = (index, key, value) => {
    setProfile((current) => {
      const contributions = [...(current.otherContributions || [])];
      contributions[index] = { ...contributions[index], [key]: value };
      return { ...current, otherContributions: contributions };
    });
  };

  return (
    <div className="space-y-6">
      {popup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`rounded-2xl p-2 ${popup.warning ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <CheckCircle2 size={22} />
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{popup.title}</h3>
              </div>
              <button type="button" onClick={() => setPopup(null)} className="rounded-xl p-1 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {popup.lines.map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setPopup(null)}
                className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PageHeader
        title="Payslips"
        subtitle={privileged ? 'Generate official payslips from the uploaded PDF template.' : 'View, download and print your payslips.'}
        actions={privileged && user?.role === 'admin' ? [
          <Link
            key="templates"
            to="/payslip-templates"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm"
          >
            <Settings size={16} />
            Manage Template
          </Link>
        ] : undefined}
      />

      {message ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message.text}
        </div>
      ) : null}

      {privileged ? (
        <SectionCard title="Payroll & Generation" subtitle="Set employee payroll values, then generate payslips using the official template.">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} {emp.employeeNo ? `(${emp.employeeNo})` : ''} - {emp.departmentName || 'No department'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Payroll period</label>
                <input
                  type="month"
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                />
              </div>
            </div>

            {profileLoading ? (
              <p className="text-sm text-slate-500">Loading payroll details...</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">Statutory details</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {textFields.map(([key, label]) => (
                      <div key={key}>
                        <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
                        <input
                          type="text"
                          value={profile[key] ?? ''}
                          onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-semibold text-slate-900">Earnings, deductions & reliefs (KES)</h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {numberFields.map(([key, label]) => (
                      <div key={key}>
                        <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={profile[key] ?? 0}
                          onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value === '' ? 0 : Number(event.target.value) }))}
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">Other contributions</h4>
                    <button
                      type="button"
                      onClick={() => setProfile((current) => ({
                        ...current,
                        otherContributions: [...(current.otherContributions || []), { label: '', amount: 0 }]
                      }))}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Plus size={14} />
                      Add contribution
                    </button>
                  </div>
                  {(profile.otherContributions || []).length === 0 ? (
                    <p className="text-xs text-slate-500">No contributions configured for this employee.</p>
                  ) : (
                    <div className="space-y-2">
                      {(profile.otherContributions || []).map((entry, index) => (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                          <input
                            type="text"
                            placeholder="Contribution name (e.g. GIZ Contribution)"
                            value={entry.label || ''}
                            onChange={(event) => updateContribution(index, 'label', event.target.value)}
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Amount"
                            value={entry.amount ?? 0}
                            onChange={(event) => updateContribution(index, 'amount', event.target.value === '' ? 0 : Number(event.target.value))}
                            className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setProfile((current) => ({
                              ...current,
                              otherContributions: (current.otherContributions || []).filter((_, i) => i !== index)
                            }))}
                            className="rounded-xl bg-rose-50 p-2 text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-slate-500">Gross Earnings</p>
                    <p className="font-semibold text-slate-900">KES {formatMoney(totals.earnings)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Total Deductions</p>
                    <p className="font-semibold text-amber-700">KES {formatMoney(totals.deductions)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Net Pay</p>
                    <p className="font-semibold text-emerald-700">KES {formatMoney(totals.net)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving || !selectedEmployeeId}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save payroll details'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerate(false)}
                    disabled={generating || !selectedEmployeeId}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                  >
                    <FileText size={16} />
                    {generating ? 'Generating...' : 'Generate payslip'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerate(true)}
                    disabled={generating}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                  >
                    <Users size={16} />
                    {generating ? 'Generating...' : 'Generate for all employees'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Payslip History" subtitle={privileged ? 'All generated payslips. Regenerating a period replaces the previous version.' : 'Your generated payslips.'}>
        {loadingPayslips ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading payslips...</p>
        ) : payslips.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No payslips available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  {privileged ? <th className="px-3 py-2">Employee</th> : null}
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Net Pay (KES)</th>
                  <th className="px-3 py-2">Generated</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((payslip) => (
                  <tr key={payslip.id} className="border-b border-slate-100">
                    {privileged ? (
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {payslip.employeeName}
                        {payslip.employeeNo ? <span className="ml-1 text-xs text-slate-500">({payslip.employeeNo})</span> : null}
                      </td>
                    ) : null}
                    <td className="px-3 py-3">{payslip.period}</td>
                    <td className="px-3 py-3">{payslip.data?.summary ? formatMoney(payslip.data.summary.netPay) : '—'}</td>
                    <td className="px-3 py-3 text-slate-500">{new Date(payslip.updatedAt || payslip.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" title="Preview" onClick={() => openPayslip(payslip)} className="rounded-xl bg-slate-100 p-2 text-slate-700">
                          <Eye size={15} />
                        </button>
                        <button type="button" title="Download" onClick={() => downloadPayslip(payslip)} className="rounded-xl bg-emerald-50 p-2 text-emerald-700">
                          <Download size={15} />
                        </button>
                        <button type="button" title="Print" onClick={() => openPayslip(payslip, true)} className="rounded-xl bg-slate-100 p-2 text-slate-700">
                          <Printer size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
