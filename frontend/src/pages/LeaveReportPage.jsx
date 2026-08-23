import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Users, Calendar, TrendingUp, FileText, Download, Eye } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { getLeaveReportData, getLeaveReportFilters } from '../services/leaveReportService';

export default function LeaveReportPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    employeeId: '',
    departmentId: '',
    leaveTypeId: '',
    status: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    departments: [],
    leaveTypes: [],
    employees: [],
    statuses: []
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const loadFilterOptions = async () => {
    try {
      setLoading(true);
      const data = await getLeaveReportFilters();
      setFilterOptions(data);
    } catch (error) {
      console.error('Failed to load filter options:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const data = await getLeaveReportData(filters);
      setReportData(data);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    const token = localStorage.getItem('kerea_hrms_auth') ? JSON.parse(localStorage.getItem('kerea_hrms_auth')).token : null;
    if (!token) {
      alert('Authentication required. Please log in again.');
      return;
    }

    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.departmentId) params.append('departmentId', filters.departmentId);
    if (filters.leaveTypeId) params.append('leaveTypeId', filters.leaveTypeId);
    if (filters.status) params.append('status', filters.status);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/leave-report/export/pdf?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to export PDF' }));
        throw new Error(errorData.message || 'Failed to export PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `kerea-leave-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert(`Failed to export PDF: ${error.message}. Please try again.`);
    }
  };

  const handlePreviewPDF = async () => {
    const token = localStorage.getItem('kerea_hrms_auth') ? JSON.parse(localStorage.getItem('kerea_hrms_auth')).token : null;
    if (!token) {
      alert('Authentication required. Please log in again.');
      return;
    }

    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.employeeId) params.append('employeeId', filters.employeeId);
    if (filters.departmentId) params.append('departmentId', filters.departmentId);
    if (filters.leaveTypeId) params.append('leaveTypeId', filters.leaveTypeId);
    if (filters.status) params.append('status', filters.status);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/leave-report/export/pdf?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to preview PDF' }));
        throw new Error(errorData.message || 'Failed to preview PDF');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to preview PDF:', error);
      alert(`Failed to preview PDF: ${error.message}. Please try again.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Report"
        subtitle="Generate comprehensive leave reports for the organization."
      />

      <SectionCard
        title="Report Filters"
        subtitle="Select filters to customize your leave report."
        actions={[
          <button
            key="toggle"
            type="button"
            className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        ]}
      >
        {showFilters && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Start Date</label>
                <input
                  type="date"
                  className="bg-slate-50"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">End Date</label>
                <input
                  type="date"
                  className="bg-slate-50"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Department</label>
                <select
                  className="bg-slate-50"
                  value={filters.departmentId}
                  onChange={(e) => setFilters({ ...filters, departmentId: e.target.value })}
                >
                  <option value="">All Departments</option>
                  {filterOptions.departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Leave Type</label>
                <select
                  className="bg-slate-50"
                  value={filters.leaveTypeId}
                  onChange={(e) => setFilters({ ...filters, leaveTypeId: e.target.value })}
                >
                  <option value="">All Leave Types</option>
                  {filterOptions.leaveTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Employee</label>
                <select
                  className="bg-slate-50"
                  value={filters.employeeId}
                  onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                >
                  <option value="">All Employees</option>
                  {filterOptions.employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_no})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
                <select
                  className="bg-slate-50"
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">All Statuses</option>
                  {filterOptions.statuses.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setFilters({ startDate: '', endDate: '', employeeId: '', departmentId: '', leaveTypeId: '', status: '' })}
              >
                Clear Filters
              </button>
              <button
                type="button"
                className="rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                onClick={handleGenerateReport}
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {reportData && (
        <>
          <SectionCard 
            title="Summary Statistics" 
            subtitle="Overview of leave data across the organization."
            actions={
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={handlePreviewPDF}
                >
                  <Eye size={18} />
                  Preview PDF
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-lg hover:opacity-90"
                  onClick={handleExportPDF}
                >
                  <Download size={18} />
                  Download PDF
                </button>
              </div>
            }
          >
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-blue-50 p-3">
                    <Users className="text-blue-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Employees</p>
                    <p className="text-2xl font-semibold text-slate-900">{reportData.statistics.totalEmployees}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-emerald-50 p-3">
                    <FileText className="text-emerald-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Approved Leaves</p>
                    <p className="text-2xl font-semibold text-slate-900">{reportData.statistics.approvedLeaves}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-50 p-3">
                    <Calendar className="text-amber-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Pending Leaves</p>
                    <p className="text-2xl font-semibold text-slate-900">{reportData.statistics.pendingLeaves}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-purple-50 p-3">
                    <TrendingUp className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Days Taken</p>
                    <p className="text-2xl font-semibold text-slate-900">{reportData.statistics.totalLeaveDaysTaken}</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Leave by Type" subtitle="Leave days taken by leave type.">
            <div className="space-y-3">
              {reportData.leaveByType.map((item) => (
                <div key={item.leave_type} className="flex items-center gap-4">
                  <div className="w-48 text-sm font-medium text-slate-700">{item.leave_type}</div>
                  <div className="flex-1 h-8 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{
                        width: `${(item.days_taken / Math.max(...reportData.leaveByType.map(d => d.days_taken), 1)) * 100}%`
                      }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-semibold text-slate-900">{Math.round(item.days_taken)} days</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Leave by Department" subtitle="Leave utilization across departments.">
            <div className="space-y-3">
              {reportData.leaveByDepartment.map((item) => (
                <div key={item.department} className="flex items-center gap-4">
                  <div className="w-48 text-sm font-medium text-slate-700">{item.department}</div>
                  <div className="flex-1 h-8 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${(item.days_taken / Math.max(...reportData.leaveByDepartment.map(d => d.days_taken), 1)) * 100}%`
                      }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-semibold text-slate-900">{Math.round(item.days_taken)} days</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Employee Leave Information" subtitle="Recent leave activities (first 25).">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Employee</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Department</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Type</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Entitlement</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Days Taken</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Remaining</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.employeeLeaveInfo.slice(0, 25).map((emp, index) => (
                    <tr key={`${emp.request_id}-${index}`} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{emp.employee_name}</p>
                          <p className="text-xs text-slate-500">{emp.employee_no}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{emp.department}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{(emp.leave_type || 'N/A').substring(0, 2).toUpperCase()}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{Math.round(emp.leave_entitlement)}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{Math.round(emp.days_taken)}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{Math.round(emp.remaining_days)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          emp.current_status === 'approved' ? 'bg-emerald-50 text-emerald-600' :
                          emp.current_status?.startsWith('pending') ? 'bg-amber-50 text-amber-600' :
                          emp.current_status === 'rejected' ? 'bg-rose-50 text-rose-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {emp.current_status || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {reportData.employeesOnLeave.length > 0 && (
            <SectionCard title="Employees Currently on Leave" subtitle="Employees who are currently on leave.">
              <div className="overflow-x-auto">
                <div className="min-w-[500px] space-y-3">
                  {reportData.employeesOnLeave.map((emp) => (
                    <div key={emp.employee_no} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                      <div>
                        <p className="font-medium text-slate-900">{emp.employee_name}</p>
                        <p className="text-sm text-slate-500">{emp.employee_no}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">{emp.leave_type}</p>
                        <p className="text-xs text-slate-500">{formatDate(emp.start_date)} to {formatDate(emp.end_date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title="Employee Leave Summary" subtitle="Summary of leave balances across all leave types for each employee.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Employee</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Department</th>
                    {(() => {
                      const leaveTypes = [...new Set(reportData.employeeLeaveSummary.map(e => e.leave_type))].sort();
                      return leaveTypes.map(lt => (
                        <th key={lt} className="px-4 py-3 text-center font-medium text-slate-700">{lt.substring(0, 10)}</th>
                      ));
                    })()}
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Remaining</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">% Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const employeeMap = new Map();
                    const leaveTypes = [...new Set(reportData.employeeLeaveSummary.map(e => e.leave_type))].sort();

                    reportData.employeeLeaveSummary.forEach((emp) => {
                      const empId = emp.employee_id;
                      if (!employeeMap.has(empId)) {
                        employeeMap.set(empId, {
                          name: emp.employee_name,
                          department: emp.department,
                          leaveTypes: {},
                          totalEntitlement: 0,
                          totalTaken: 0,
                          totalRemaining: 0
                        });
                      }

                      const empData = employeeMap.get(empId);
                      const entitlement = parseFloat(emp.leave_entitlement) || 0;
                      const daysTaken = parseFloat(emp.days_taken) || 0;
                      const calculatedRemaining = Math.max(0, entitlement - daysTaken);
                      empData.leaveTypes[emp.leave_type] = {
                        entitlement: entitlement,
                        taken: daysTaken,
                        remaining: calculatedRemaining
                      };
                      empData.totalEntitlement += entitlement;
                      empData.totalTaken += daysTaken;
                      empData.totalRemaining += calculatedRemaining;
                    });

                    return Array.from(employeeMap.values()).slice(0, 30).map((emp, index) => {
                      const totalPercentage = (emp.totalEntitlement > 0 && !isNaN(emp.totalEntitlement)) 
                        ? Math.round((emp.totalTaken / emp.totalEntitlement) * 100) 
                        : 0;
                      return (
                        <tr key={index} className="border-b border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-900">{emp.name.substring(0, 15)}</td>
                          <td className="px-4 py-3 text-slate-600">{emp.department.substring(0, 10)}</td>
                          {leaveTypes.map(lt => {
                            const ltData = emp.leaveTypes[lt];
                            if (ltData) {
                              const taken = Math.round(ltData.taken);
                              const entitlement = Math.round(ltData.entitlement);
                              return (
                                <td key={lt} className="px-4 py-3 text-center text-slate-900">{taken}/{entitlement}</td>
                              );
                            }
                            return <td key={lt} className="px-4 py-3 text-center text-slate-400">-</td>;
                          })}
                          <td className="px-4 py-3 text-right text-slate-900">{Math.round(emp.totalRemaining)}</td>
                          <td className="px-4 py-3 text-right text-slate-900">{totalPercentage}%</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}

      {!reportData && !generating && (
        <EmptyState
          title="No Report Generated"
          description="Select filters and click Generate Report to view leave data."
        />
      )}
    </div>
  );
}
