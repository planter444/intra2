import { useEffect, useState } from 'react';
import { Download, DollarSign, FileText, Printer } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import { fetchUsers } from '../services/userService';
import { generatePayslipPdf } from '../services/payslipService';

export default function PayslipsPage() {
  const { user, settings } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers()
      .then((data) => {
        const activeEmployees = data.filter((emp) => emp.isActive && !emp.isDeleted);
        setEmployees(activeEmployees);
        if (activeEmployees.length > 0) {
          setSelectedEmployeeId(activeEmployees[0].id);
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load employees');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const selectedEmployee = employees.find((emp) => String(emp.id) === String(selectedEmployeeId));

  const handleGeneratePayslip = async () => {
    if (!selectedEmployeeId || !selectedMonth) {
      setError('Please select an employee and month');
      return;
    }

    try {
      setGenerating(true);
      setError('');
      const blob = await generatePayslipPdf(selectedEmployeeId, selectedMonth);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${selectedEmployee?.employeeNo || selectedEmployeeId}_${selectedMonth}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate payslip');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintPayslip = async () => {
    if (!selectedEmployeeId || !selectedMonth) {
      setError('Please select an employee and month');
      return;
    }

    try {
      setGenerating(true);
      setError('');
      const blob = await generatePayslipPdf(selectedEmployeeId, selectedMonth);
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate payslip');
    } finally {
      setGenerating(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const calculateTotals = (employee) => {
    if (!employee) return { gross: 0, totalDeductions: 0, net: 0 };

    const gross = (employee.basicSalary || 0) +
                  (employee.housingAllowance || 0) +
                  (employee.transportAllowance || 0) +
                  (employee.medicalAllowance || 0) +
                  (employee.otherAllowances || 0);

    const totalDeductions = (employee.payeTax || 0) +
                           (employee.nssfContribution || 0) +
                           (employee.nhifContribution || 0) +
                           (employee.otherDeductions || 0);

    const net = gross - totalDeductions;

    return { gross, totalDeductions, net };
  };

  const { gross, totalDeductions, net } = calculateTotals(selectedEmployee);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslips"
        subtitle="Generate and download employee payslips in PDF format"
      />

      <SectionCard title="Generate Payslip" subtitle="Select an employee and month to generate their payslip">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading employees...</div>
        ) : error && !selectedEmployee ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} - {emp.employeeNo || 'No ID'} - {emp.departmentName || 'No Department'}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                />
              </div>
            </div>

            {selectedEmployee && (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">Payslip Preview</h3>
                
                <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Employee Name</p>
                      <p className="font-medium text-slate-900">{selectedEmployee.fullName}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Employee No</p>
                      <p className="font-medium text-slate-900">{selectedEmployee.employeeNo || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Department</p>
                      <p className="font-medium text-slate-900">{selectedEmployee.departmentName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Position</p>
                      <p className="font-medium text-slate-900">{selectedEmployee.positionTitle || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Bank</p>
                      <p className="font-medium text-slate-900">{selectedEmployee.bankName || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Account Number</p>
                      <p className="font-medium text-slate-900">{selectedEmployee.bankAccountNumber || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-emerald-50 p-4">
                    <h4 className="mb-3 font-semibold text-emerald-900">Earnings</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Basic Salary</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.basicSalary)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Housing Allowance</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.housingAllowance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Transport Allowance</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.transportAllowance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Medical Allowance</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.medicalAllowance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Other Allowances</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.otherAllowances)}</span>
                      </div>
                      <div className="mt-3 flex justify-between border-t border-emerald-200 pt-3 font-semibold">
                        <span className="text-emerald-900">Gross Pay</span>
                        <span className="text-emerald-900">{formatCurrency(gross)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-rose-50 p-4">
                    <h4 className="mb-3 font-semibold text-rose-900">Deductions</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">PAYE Tax</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.payeTax)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">NSSF Contribution</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.nssfContribution)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">NHIF Contribution</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.nhifContribution)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Other Deductions</span>
                        <span className="font-medium text-slate-900">{formatCurrency(selectedEmployee.otherDeductions)}</span>
                      </div>
                      <div className="mt-3 flex justify-between border-t border-rose-200 pt-3 font-semibold">
                        <span className="text-rose-900">Total Deductions</span>
                        <span className="text-rose-900">{formatCurrency(totalDeductions)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-brand-gradient p-4 text-white">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Net Pay</span>
                    <span>{formatCurrency(net)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={handlePrintPayslip}
                disabled={generating || !selectedEmployee}
                className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
              >
                <Printer size={16} />
                {generating ? 'Generating...' : 'Print'}
              </button>
              <button
                type="button"
                onClick={handleGeneratePayslip}
                disabled={generating || !selectedEmployee}
                className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
              >
                <Download size={16} />
                {generating ? 'Generating...' : 'Download PDF'}
              </button>
            </div>

            {error && (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
