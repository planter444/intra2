import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Users, Calendar, TrendingUp, FileText, Download, Eye, MapPin, DollarSign } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { getTravelReportData, getTravelReportFilters } from '../services/travelReportService';

export default function TravelReportPage() {
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
    travelCategory: '',
    status: ''
  });
  const [filterOptions, setFilterOptions] = useState({
    departments: [],
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
      const data = await getTravelReportFilters();
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
      const data = await getTravelReportData(filters);
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
    if (filters.travelCategory) params.append('travelCategory', filters.travelCategory);
    if (filters.status) params.append('status', filters.status);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/travel-report/export/pdf?${params.toString()}`, {
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
      link.download = `kerea-travel-report-${new Date().toISOString().slice(0, 10)}.pdf`;
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
    if (filters.travelCategory) params.append('travelCategory', filters.travelCategory);
    if (filters.status) params.append('status', filters.status);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/travel-report/export/pdf?${params.toString()}`, {
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
        title="Travel Report"
        subtitle="Generate comprehensive travel reports for the organization."
      />

      <SectionCard
        title="Report Filters"
        subtitle="Select filters to customize your travel report."
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
                <label className="mb-2 block text-sm font-medium text-slate-700">Travel Category</label>
                <select
                  className="bg-slate-50"
                  value={filters.travelCategory}
                  onChange={(e) => setFilters({ ...filters, travelCategory: e.target.value })}
                >
                  <option value="">All Categories</option>
                  <option value="Within Kenya">Within Kenya</option>
                  <option value="East Africa">East Africa</option>
                  <option value="International">International</option>
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
                onClick={() => setFilters({ startDate: '', endDate: '', employeeId: '', departmentId: '', travelCategory: '', status: '' })}
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
            subtitle="Overview of travel data across the organization."
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
                    <p className="text-sm text-slate-500">Approved Trips</p>
                    <p className="text-2xl font-semibold text-slate-900">{reportData.statistics.approvedTrips}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-amber-50 p-3">
                    <Calendar className="text-amber-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Pending Trips</p>
                    <p className="text-2xl font-semibold text-slate-900">{reportData.statistics.pendingTrips}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-purple-50 p-3">
                    <DollarSign className="text-purple-600" size={20} />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total DSA Amount</p>
                    <p className="text-2xl font-semibold text-slate-900">{reportData.statistics.totalDSA}</p>
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Travel by Category" subtitle="Travel trips by category.">
            <div className="space-y-3">
              {reportData.travelByCategory.map((item) => (
                <div key={item.travel_category} className="flex items-center gap-4">
                  <div className="w-48 text-sm font-medium text-slate-700">{item.travel_category}</div>
                  <div className="flex-1 h-8 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{
                        width: `${(item.trip_count / Math.max(...reportData.travelByCategory.map(d => d.trip_count), 1)) * 100}%`
                      }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-semibold text-slate-900">{item.trip_count} trips</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Travel by Department" subtitle="Travel utilization across departments.">
            <div className="space-y-3">
              {reportData.travelByDepartment.map((item) => (
                <div key={item.department} className="flex items-center gap-4">
                  <div className="w-48 text-sm font-medium text-slate-700">{item.department}</div>
                  <div className="flex-1 h-8 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width: `${(item.trip_count / Math.max(...reportData.travelByDepartment.map(d => d.trip_count), 1)) * 100}%`
                      }}
                    />
                  </div>
                  <div className="w-24 text-right text-sm font-semibold text-slate-900">{item.trip_count} trips</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Employee Travel Information" subtitle="Recent travel activities (first 25).">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Employee</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Department</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Destination</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">DSA Amount</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-700">Est. Cost</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.employeeTravelInfo.slice(0, 25).map((emp, index) => (
                    <tr key={`${emp.request_id}-${index}`} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{emp.employee_name}</p>
                          <p className="text-xs text-slate-500">{emp.employee_no}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{emp.department}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{(emp.travel_category || 'N/A').substring(0, 2).toUpperCase()}</td>
                      <td className="px-4 py-3 text-slate-600">{emp.destination}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{emp.dsa_amount ? Math.round(emp.dsa_amount).toLocaleString() : 'N/A'}</td>
                      <td className="px-4 py-3 text-right text-slate-900">{emp.estimated_cost ? Math.round(emp.estimated_cost).toLocaleString() : 'N/A'}</td>
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

          {reportData.travelSummary && (
            <SectionCard title="Travel Summary Statistics" subtitle="Financial breakdown by travel category.">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm">
                  <thead>
                    <tr className="border-b-2 border-slate-300 bg-slate-50">
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Category</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">DSA</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Accommodation</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Other Costs</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Reimbursement</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Within Kenya', 'East Africa', 'International', 'Local Movement'].map((category, index) => {
                      const catData = reportData.travelSummary.byCategory[category] || { dsa: {}, accommodation: {}, other: {}, reimbursement: {} };
                      
                      const formatCurrency = (amounts, field) => {
                        if (!amounts || Object.keys(amounts).length === 0) return '-';
                        
                        // For East Africa and International, only DSA is in USD
                        if ((category === 'East Africa' || category === 'International') && field === 'dsa') {
                          const totalAmount = Object.values(amounts).reduce((sum, amt) => sum + amt, 0);
                          if (totalAmount > 0) {
                            return `${Math.round(totalAmount).toLocaleString()} USD`;
                          }
                          return '-';
                        }
                        
                        return Object.entries(amounts).map(([currency, amount]) => 
                          `${currency} ${Math.round(amount).toLocaleString()}`
                        ).join(' + ');
                      };

                      const calculateTotalByCurrency = (dsa, accommodation, other, reimbursement) => {
                        const totalsByCurrency = {};
                        Object.entries(dsa || {}).forEach(([currency, amount]) => {
                          totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
                        });
                        Object.entries(accommodation || {}).forEach(([currency, amount]) => {
                          totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
                        });
                        Object.entries(other || {}).forEach(([currency, amount]) => {
                          totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
                        });
                        Object.entries(reimbursement || {}).forEach(([currency, amount]) => {
                          totalsByCurrency[currency] = (totalsByCurrency[currency] || 0) + amount;
                        });
                        return totalsByCurrency;
                      };

                      const formatTotalByCurrency = (totalsByCurrency, category) => {
                        if (!totalsByCurrency || Object.keys(totalsByCurrency).length === 0) return '-';
                        
                        // For East Africa and International, show KES first then USD separately
                        if (category === 'East Africa' || category === 'International') {
                          const kesAmount = totalsByCurrency['KES'] || 0;
                          const usdAmount = totalsByCurrency['USD'] || 0;
                          
                          let result = '';
                          if (kesAmount > 0) {
                            result += `KES ${Math.round(kesAmount).toLocaleString()}`;
                          }
                          if (usdAmount > 0) {
                            if (result) result += ' + ';
                            result += `${Math.round(usdAmount).toLocaleString()} USD`;
                          }
                          return result || '-';
                        }
                        
                        return Object.entries(totalsByCurrency).map(([currency, amount]) => 
                          `${currency} ${Math.round(amount).toLocaleString()}`
                        ).join(' + ');
                      };

                      const totalByCurrency = calculateTotalByCurrency(catData.dsa, catData.accommodation, catData.other, catData.reimbursement);

                      return (
                        <tr key={category} className={`border-b border-slate-100 ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <td className="px-4 py-3 font-medium text-slate-900">{category}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(catData.dsa, 'dsa')}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{category === 'Within Kenya' || category === 'Local Movement' ? '-' : formatCurrency(catData.accommodation, 'accommodation')}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(catData.other, 'other')}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(catData.reimbursement, 'reimbursement')}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{formatTotalByCurrency(totalByCurrency, category)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-emerald-50">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div>Total Money Spent</div>
                        <div>on Travels</div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {(() => {
                          const eastAfricaDSA = reportData.travelSummary.byCategory?.['East Africa']?.dsa || {};
                          const internationalDSA = reportData.travelSummary.byCategory?.['International']?.dsa || {};
                          const withinKenyaDSA = reportData.travelSummary.byCategory?.['Within Kenya']?.dsa || {};
                          const localMovementDSA = reportData.travelSummary.byCategory?.['Local Movement']?.dsa || {};
                          
                          const forcedUSDTotal = Object.values(eastAfricaDSA).reduce((sum, amt) => sum + amt, 0) + 
                                                Object.values(internationalDSA).reduce((sum, amt) => sum + amt, 0);
                          const kesDSATotal = Object.values(withinKenyaDSA).reduce((sum, amt) => sum + amt, 0) + 
                                             Object.values(localMovementDSA).reduce((sum, amt) => sum + amt, 0);
                          
                          let result = '';
                          if (kesDSATotal > 0) {
                            result += `KES ${Math.round(kesDSATotal).toLocaleString()}`;
                          }
                          if (forcedUSDTotal > 0) {
                            if (result) result += ' + ';
                            result += `${Math.round(forcedUSDTotal).toLocaleString()} USD`;
                          }
                          return result || '-';
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {(() => {
                          const totals = reportData.travelSummary.totals?.accommodation || {};
                          if (!totals || Object.keys(totals).length === 0) return '-';
                          return Object.entries(totals).map(([currency, amount]) => 
                            `${currency} ${Math.round(amount).toLocaleString()}`
                          ).join(' + ');
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {(() => {
                          const totals = reportData.travelSummary.totals?.other || {};
                          if (!totals || Object.keys(totals).length === 0) return '-';
                          return Object.entries(totals).map(([currency, amount]) => 
                            `${currency} ${Math.round(amount).toLocaleString()}`
                          ).join(' + ');
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {(() => {
                          const totals = reportData.travelSummary.totals?.reimbursement || {};
                          if (!totals || Object.keys(totals).length === 0) return '-';
                          return Object.entries(totals).map(([currency, amount]) => 
                            `${currency} ${Math.round(amount).toLocaleString()}`
                          ).join(' + ');
                        })()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700 text-lg">
                        {(() => {
                          // Calculate grand total from row components (not column totals)
                          let grandKesTotal = 0;
                          let grandUsdTotal = 0;
                          
                          ['Within Kenya', 'East Africa', 'International', 'Local Movement'].forEach(category => {
                            const catData = reportData.travelSummary.byCategory?.[category] || { dsa: {}, accommodation: {}, other: {}, reimbursement: {} };
                            
                            // For East Africa and International, DSA is forced to USD
                            if (category === 'East Africa' || category === 'International') {
                              grandUsdTotal += Object.values(catData.dsa || {}).reduce((sum, amt) => sum + amt, 0);
                              grandKesTotal += (catData.accommodation['KES'] || 0) + (catData.other['KES'] || 0) + (catData.reimbursement['KES'] || 0);
                              grandUsdTotal += (catData.accommodation['USD'] || 0) + (catData.other['USD'] || 0) + (catData.reimbursement['USD'] || 0);
                            } else {
                              grandKesTotal += Object.values(catData.dsa || {}).reduce((sum, amt) => sum + amt, 0);
                              grandKesTotal += (catData.accommodation['KES'] || 0) + (catData.other['KES'] || 0) + (catData.reimbursement['KES'] || 0);
                              grandUsdTotal += (catData.accommodation['USD'] || 0) + (catData.other['USD'] || 0) + (catData.reimbursement['USD'] || 0);
                            }
                          });
                          
                          // Format with KES on one line, USD on next
                          const kesLine = grandKesTotal > 0 ? `KES ${Math.round(grandKesTotal).toLocaleString()}` : '';
                          const usdLine = grandUsdTotal > 0 ? `${Math.round(grandUsdTotal).toLocaleString()} USD` : '';
                          
                          if (kesLine && usdLine) {
                            return (
                              <div>
                                <div>{kesLine}</div>
                                <div>{usdLine}</div>
                              </div>
                            );
                          } else if (kesLine) {
                            return kesLine;
                          } else if (usdLine) {
                            return usdLine;
                          }
                          return 'KES 0';
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>
          )}

          {reportData.employeesOnTravel.length > 0 && (
            <SectionCard title="Employees Currently on Travel" subtitle="Employees who are currently on travel.">
              <div className="overflow-x-auto">
                <div className="min-w-[500px] space-y-3">
                  {reportData.employeesOnTravel.map((emp) => (
                    <div key={emp.employee_no} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
                      <div>
                        <p className="font-medium text-slate-900">{emp.employee_name}</p>
                        <p className="text-sm text-slate-500">{emp.employee_no}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-900">{emp.travel_category}</p>
                        <p className="text-xs text-slate-500">{formatDate(emp.start_date)} to {formatDate(emp.end_date)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {!reportData && !generating && (
        <EmptyState
          icon={<FileText size={48} className="text-slate-300" />}
          title="No Report Generated"
          description="Use the filters above to generate a travel report."
        />
      )}
    </div>
  );
}
