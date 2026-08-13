import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive, CheckCircle2, Download, Eye, FileText, Plus, Printer, Save, Settings, Trash2, Users, X
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import {
  fetchPayslips,
  generatePayslips,
  previewPayslipBlob,
  deletePayslip,
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
  nssfTier: 'I_II',
  shif: 0,
  housingLevy: 0,
  pension: 0,
  otherDeductions: 0,
  personalRelief: 2400,
  insuranceRelief: 0,
  otherContributions: []
};

const formatMoney = (value) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NSSF_TIER_OPTIONS = [
  { value: 'I', label: 'NSSF (Tier I)' },
  { value: 'I_II', label: 'NSSF (Tier I and Tier II)' },
  { value: 'I_II_III', label: 'NSSF (Tier I, Tier II and Tier III)' }
];

const periodLabelOf = (period) => {
  const date = new Date(`${period}-01T00:00:00`);
  return Number.isNaN(date.getTime()) ? period : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

function SlipSection({ title, children }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="bg-emerald-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white">{title}</div>
      <div className="bg-white">{children}</div>
    </div>
  );
}

function SlipRow({ label, children, alt }) {
  return (
    <div className={`flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 last:border-b-0 ${alt ? 'bg-emerald-50/40' : ''}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="w-44">{children}</div>
    </div>
  );
}

function MoneyInput({ value, onChange }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value ?? 0}
      onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}
      onFocus={(event) => event.target.select()}
      className="w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-right text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none"
    />
  );
}

function TextInput({ value, onChange, align = 'right' }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none ${align === 'right' ? 'text-right' : ''}`}
    />
  );
}

export default function PayslipsPage() {
  const { user } = useAuth();
  const privileged = PRIVILEGED_ROLES.includes(user?.role);
  const isAdmin = user?.role === 'admin';

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
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

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

  useEffect(() => () => {
    if (previewUrl) {
      window.URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const selectedEmployee = useMemo(
    () => employees.find((emp) => String(emp.id) === String(selectedEmployeeId)),
    [employees, selectedEmployeeId]
  );

  const totals = useMemo(() => {
    const earnings = ['grossSalary', 'allowances', 'bonuses', 'overtime', 'gratuity']
      .reduce((sum, key) => sum + Number(profile[key] || 0), 0);
    const deductions = ['paye', 'nssf', 'shif', 'housingLevy', 'pension', 'otherDeductions']
      .reduce((sum, key) => sum + Number(profile[key] || 0), 0);
    const preTax = ['nssf', 'shif', 'housingLevy', 'pension'].reduce((sum, key) => sum + Number(profile[key] || 0), 0);
    return { earnings, deductions, net: earnings - deductions, taxable: earnings - preTax, preTax };
  }, [profile]);

  const setField = (key) => (value) => setProfile((current) => ({ ...current, [key]: value }));

  const notify = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 6000);
  };

  const openPreview = async () => {
    try {
      setPreviewLoading(true);
      const blob = await previewPayslipBlob(selectedEmployeeId, period);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPreviewUrl(url);
    } catch (error) {
      let text = 'Unable to load the payslip preview.';
      if (error.response?.data instanceof Blob) {
        try {
          text = JSON.parse(await error.response.data.text()).message || text;
        } catch (parseError) { /* keep default */ }
      }
      setPopup({ title: 'Preview failed', lines: [text], warning: true });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSaveProfile = async ({ thenPreview = true } = {}) => {
    try {
      setSaving(true);
      await savePayrollProfile(selectedEmployeeId, profile);
      if (thenPreview) {
        await openPreview();
      } else {
        setPopup({
          title: 'Payroll details saved',
          lines: [`Payroll details for ${selectedEmployee?.fullName || 'the employee'} have been saved successfully.`]
        });
      }
    } catch (error) {
      setPopup({ title: 'Save failed', lines: [error.response?.data?.message || 'Unable to save payroll details.'], warning: true });
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
      const label = periodLabelOf(period);
      const lines = [`${generatedCount} payslip${generatedCount === 1 ? '' : 's'} generated for ${label}.`];
      if (!all && generatedCount === 1) {
        lines[0] = `Payslip for ${result.generated[0].name} (${label}) has been generated successfully.`;
      }
      if (failed.length) {
        lines.push(`Skipped ${failed.length}: ${failed.map((item) => `${item.name || item.userId} \u2014 ${item.error}`).join('; ')}`);
      }
      setPopup({ title: failed.length ? 'Generation completed with warnings' : 'Payslips generated', lines, warning: failed.length > 0 });
      setPreviewUrl(null);
      loadPayslips();
    } catch (error) {
      setPopup({ title: 'Generation failed', lines: [error.response?.data?.message || 'Unable to generate payslips.'], warning: true });
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

  const handleDeletePayslip = async (payslip) => {
    if (!window.confirm(`Delete the ${payslip.period} payslip for ${payslip.employeeName}? This cannot be undone.`)) {
      return;
    }
    try {
      await deletePayslip(payslip.id);
      setPopup({ title: 'Payslip deleted', lines: [`The ${payslip.period} payslip for ${payslip.employeeName} has been deleted.`] });
      loadPayslips();
    } catch (error) {
      setPopup({ title: 'Delete failed', lines: [error.response?.data?.message || 'Unable to delete this payslip.'], warning: true });
    }
  };

  const handleBackupAll = async () => {
    try {
      setBackingUp(true);
      for (const payslip of payslips) {
        await downloadPayslip(payslip);
      }
      setPopup({ title: 'Backup complete', lines: [`${payslips.length} payslip PDF${payslips.length === 1 ? '' : 's'} downloaded to your computer.`] });
    } finally {
      setBackingUp(false);
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
              <button type="button" onClick={() => setPopup(null)} className="rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white">
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Payslip preview {'\u2014'} {selectedEmployee?.fullName} ({periodLabelOf(period)})</h3>
                <p className="text-xs text-slate-500">Review the payslip. To change any value, close this preview, edit the payroll form and save again. Then click Generate to produce the final locked payslip.</p>
              </div>
              <button type="button" onClick={() => setPreviewUrl(null)} className="rounded-xl p-2 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <iframe title="Payslip preview" src={previewUrl} className="min-h-0 flex-1 w-full" />
            <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={() => setPreviewUrl(null)} className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700">
                Close & edit values
              </button>
              <button
                type="button"
                onClick={() => handleGenerate(false)}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <FileText size={16} />
                {generating ? 'Generating...' : 'Generate payslip'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader
        title="Payslips"
        subtitle={privileged ? 'Generate official payslips from the uploaded PDF template.' : 'View, download and print your payslips.'}
        actions={isAdmin ? [
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
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-emerald-900 px-6 py-5 text-center">
            <h2 className="text-lg font-bold uppercase tracking-wide text-white">Kenya Renewable Energy Association</h2>
            <p className="mt-1 text-sm font-medium uppercase tracking-wider text-emerald-200">
              Employee Pay Slip {'\u2014'} {periodLabelOf(period).toUpperCase()}
            </p>
          </div>

          <div className="space-y-5 p-6">
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
                  onClick={(event) => event.target.showPicker?.()}
                  onFocus={(event) => event.target.showPicker?.()}
                  className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                />
              </div>
            </div>

            {profileLoading ? (
              <p className="py-6 text-center text-sm text-slate-500">Loading payroll details...</p>
            ) : (
              <>
                <SlipSection title="Employee Information">
                  <div className="grid md:grid-cols-2">
                    <div>
                      <SlipRow label="Employee No."><span className="block text-right text-sm font-semibold text-slate-900">{selectedEmployee?.employeeNo || '\u2014'}</span></SlipRow>
                      <SlipRow label="Full Name" alt><span className="block text-right text-sm font-semibold text-slate-900">{selectedEmployee?.fullName || '\u2014'}</span></SlipRow>
                      <SlipRow label="Department"><span className="block text-right text-sm font-semibold text-slate-900">{selectedEmployee?.departmentName || '\u2014'}</span></SlipRow>
                      <SlipRow label="Pay Period" alt><span className="block text-right text-sm font-semibold text-slate-900">{periodLabelOf(period)}</span></SlipRow>
                      <SlipRow label="Payment Mode"><TextInput value={profile.paymentMode} onChange={setField('paymentMode')} /></SlipRow>
                    </div>
                    <div className="border-t border-slate-100 md:border-l md:border-t-0">
                      <SlipRow label="ID Number"><TextInput value={profile.idNumber} onChange={setField('idNumber')} /></SlipRow>
                      <SlipRow label="KRA PIN" alt><TextInput value={profile.kraPin} onChange={setField('kraPin')} /></SlipRow>
                      <SlipRow label="NSSF No."><TextInput value={profile.nssfNumber} onChange={setField('nssfNumber')} /></SlipRow>
                      <SlipRow label="SHIF No." alt><TextInput value={profile.shifNumber} onChange={setField('shifNumber')} /></SlipRow>
                    </div>
                  </div>
                </SlipSection>

                <div className="grid gap-5 lg:grid-cols-2">
                  <SlipSection title="Statutory Deductions">
                    <SlipRow label="PAYE (Pay As You Earn)"><MoneyInput value={profile.paye} onChange={setField('paye')} /></SlipRow>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/40 px-4 py-2 last:border-b-0">
                      <select
                        value={profile.nssfTier || 'I_II'}
                        onChange={(event) => setField('nssfTier')(event.target.value)}
                        className="max-w-[60%] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600"
                      >
                        {NSSF_TIER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <div className="w-44"><MoneyInput value={profile.nssf} onChange={setField('nssf')} /></div>
                    </div>
                    <SlipRow label="SHIF (Social Health Insurance Fund)"><MoneyInput value={profile.shif} onChange={setField('shif')} /></SlipRow>
                    <SlipRow label="Housing Levy" alt><MoneyInput value={profile.housingLevy} onChange={setField('housingLevy')} /></SlipRow>
                    <SlipRow label="Pension"><MoneyInput value={profile.pension} onChange={setField('pension')} /></SlipRow>
                    <SlipRow label="Other Deductions" alt><MoneyInput value={profile.otherDeductions} onChange={setField('otherDeductions')} /></SlipRow>
                    <SlipRow label="Total Deductions"><span className="block text-right text-sm font-bold text-emerald-900">{formatMoney(totals.deductions)}</span></SlipRow>
                  </SlipSection>

                  <SlipSection title="PAYE Computation">
                    <SlipRow label="Total Earnings"><span className="block text-right text-sm font-semibold text-slate-900">{formatMoney(totals.earnings)}</span></SlipRow>
                    <SlipRow label="Less: Pre-Tax Deductions (NSSF + SHIF + Housing Levy + Pension)" alt><span className="block text-right text-sm font-semibold text-slate-900">({formatMoney(totals.preTax)})</span></SlipRow>
                    <SlipRow label="Taxable Pay"><span className="block text-right text-sm font-bold text-emerald-900">{formatMoney(totals.taxable)}</span></SlipRow>
                    <SlipRow label="Less: Personal Relief" alt><MoneyInput value={profile.personalRelief} onChange={setField('personalRelief')} /></SlipRow>
                    <SlipRow label="Less: Insurance Relief"><MoneyInput value={profile.insuranceRelief} onChange={setField('insuranceRelief')} /></SlipRow>
                    <SlipRow label="PAYE Payable" alt><span className="block text-right text-sm font-bold text-emerald-900">{formatMoney(profile.paye)}</span></SlipRow>
                  </SlipSection>

                  <SlipSection title="Earnings">
                    <SlipRow label="Basic / Gross Salary"><MoneyInput value={profile.grossSalary} onChange={setField('grossSalary')} /></SlipRow>
                    <SlipRow label="Allowances" alt><MoneyInput value={profile.allowances} onChange={setField('allowances')} /></SlipRow>
                    <SlipRow label="Bonuses"><MoneyInput value={profile.bonuses} onChange={setField('bonuses')} /></SlipRow>
                    <SlipRow label="Overtime" alt><MoneyInput value={profile.overtime} onChange={setField('overtime')} /></SlipRow>
                    <SlipRow label="Gratuity"><MoneyInput value={profile.gratuity} onChange={setField('gratuity')} /></SlipRow>
                    <SlipRow label="Total Earnings" alt><span className="block text-right text-sm font-bold text-emerald-900">{formatMoney(totals.earnings)}</span></SlipRow>
                  </SlipSection>

                  <SlipSection title="Other Contributions">
                    {(profile.otherContributions || []).length === 0 ? (
                      <p className="px-4 py-3 text-xs text-slate-500">No contributions configured for this employee.</p>
                    ) : (
                      (profile.otherContributions || []).map((entry, index) => (
                        <div key={index} className={`flex items-center gap-2 border-b border-slate-100 px-4 py-2 last:border-b-0 ${index % 2 ? 'bg-emerald-50/40' : ''}`}>
                          <input
                            type="text"
                            placeholder="Contribution name (e.g. GIZ Contribution)"
                            value={entry.label || ''}
                            onChange={(event) => updateContribution(index, 'label', event.target.value)}
                            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={entry.amount ?? 0}
                            onChange={(event) => updateContribution(index, 'amount', event.target.value === '' ? 0 : Number(event.target.value))}
                            className="w-32 rounded-lg border border-slate-200 bg-transparent px-2 py-1.5 text-right text-sm font-semibold focus:border-emerald-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setProfile((current) => ({
                              ...current,
                              otherContributions: (current.otherContributions || []).filter((_, i) => i !== index)
                            }))}
                            className="rounded-lg bg-rose-50 p-1.5 text-rose-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                    <div className="px-4 py-2.5">
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
                  </SlipSection>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="bg-emerald-900 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white">Net Pay Summary</div>
                  <div className="grid sm:grid-cols-3">
                    <div className="border-b border-slate-100 bg-emerald-50/60 px-4 py-4 text-center sm:border-b-0 sm:border-r">
                      <p className="text-xs text-slate-500">Gross Earnings</p>
                      <p className="mt-1 text-lg font-bold text-emerald-900">KES {formatMoney(totals.earnings)}</p>
                    </div>
                    <div className="border-b border-slate-100 bg-amber-50/70 px-4 py-4 text-center sm:border-b-0 sm:border-r">
                      <p className="text-xs text-amber-600">Total Deductions</p>
                      <p className="mt-1 text-lg font-bold text-amber-700">KES {formatMoney(totals.deductions)}</p>
                    </div>
                    <div className="bg-emerald-900 px-4 py-4 text-center">
                      <p className="text-xs text-emerald-200">NET PAY</p>
                      <p className="mt-1 text-lg font-bold text-white">KES {formatMoney(totals.net)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => handleSaveProfile({ thenPreview: false })}
                    disabled={saving || !selectedEmployeeId}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? 'Saving...' : 'Save payroll details'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveProfile({ thenPreview: true })}
                    disabled={saving || previewLoading || !selectedEmployeeId}
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                  >
                    <Eye size={16} />
                    {previewLoading ? 'Preparing preview...' : 'Save & preview payslip'}
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
              </>
            )}
          </div>
        </div>
      ) : null}

      <SectionCard
        title="Payslip History"
        subtitle={privileged ? 'All generated payslips. Regenerating a period replaces the previous version.' : 'Your generated payslips.'}
        actions={isAdmin && payslips.length ? [
          <button
            key="backup"
            type="button"
            onClick={handleBackupAll}
            disabled={backingUp}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm disabled:opacity-50"
          >
            <Archive size={14} />
            {backingUp ? 'Backing up...' : 'Backup all (download PDFs)'}
          </button>
        ] : undefined}
      >
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
                    <td className="px-3 py-3">{payslip.data?.summary ? formatMoney(payslip.data.summary.netPay) : '\u2014'}</td>
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
                        {privileged ? (
                          <button type="button" title="Delete" onClick={() => handleDeletePayslip(payslip)} className="rounded-xl bg-rose-50 p-2 text-rose-600">
                            <Trash2 size={15} />
                          </button>
                        ) : null}
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
