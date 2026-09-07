import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Download, FileSpreadsheet, Plus, Save, Send, CheckCircle2, XCircle, FileText, User, Building2, PenTool, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { createTimesheet, getTimesheet, updateTimesheet, submitTimesheet, approveTimesheet, rejectTimesheet, listTimesheets, deleteTimesheet } from '../services/timesheetService';
import { usePagePresentation } from '../hooks/usePagePresentation';

const DEFAULT_PARTNERS = ['GIZ', 'CWF', 'Gogla', 'SNV'];
const ABSENCE_TYPES = ['Sick Leave', 'Annual Leave', 'Training', 'Other', 'Public Holiday', 'Did not work'];

const getDaysInMonth = (month, year) => new Date(year, month, 0).getDate();
const getDayOfWeek = (day, month, year) => new Date(year, month - 1, day).getDay();
const isWeekend = (day, month, year) => {
  const dayOfWeek = getDayOfWeek(day, month, year);
  return dayOfWeek === 0 || dayOfWeek === 6;
};
const getMonthName = (month) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return months[month - 1] || 'January';
};

const calculateWorkingDays = (month, year) => {
  const daysInMonth = getDaysInMonth(month, year);
  let workingDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (!isWeekend(day, month, year)) {
      workingDays++;
    }
  }
  return workingDays;
};

  const calculateTotalHours = (dailyEntries) => {
    let total = 0;
    Object.values(dailyEntries || {}).forEach(entry => {
      if (!entry) return;
      
      // Add main hours
      if (entry.hours !== '' && entry.hours !== null && entry.hours !== undefined) {
        total += parseFloat(entry.hours) || 0;
      }
      
      // Add partner hours
      if (entry.partnerHours) {
        Object.values(entry.partnerHours).forEach(hours => {
          if (hours !== '' && hours !== null && hours !== undefined) {
            total += parseFloat(hours) || 0;
          }
        });
      }
    });
    return total;
  };

const calculateLevelOfEffort = (totalHours, month, year, dailyEntries) => {
  const workingDays = calculateWorkingDays(month, year);
  let possibleHours = workingDays * 8;
  
  // Deduct 8 hours for each "Did not work" absence (person was supposed to work but didn't)
  // Don't deduct for other absences (Sick Leave, Annual Leave, Training, Other, Public Holiday)
  if (dailyEntries) {
    Object.values(dailyEntries).forEach(entry => {
      if (entry.absence === 'Did not work' && !isWeekend(parseInt(Object.keys(dailyEntries).find(k => dailyEntries[k] === entry)), month, year)) {
        possibleHours -= 8;
      }
    });
  }
  
  if (possibleHours <= 0) return 0;
  return ((totalHours / possibleHours) * 100).toFixed(2);
};

export default function TimesheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const { cardStyle, animationStyle } = usePagePresentation();
  
  const [loading, setLoading] = useState(false);
  const [timesheet, setTimesheet] = useState(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [partners, setPartners] = useState([]);
  const [dailyEntries, setDailyEntries] = useState({});
  const [selectedPartners, setSelectedPartners] = useState([]);
  const [employeeSignature, setEmployeeSignature] = useState('');
  const [supervisorSignature, setSupervisorSignature] = useState('');
  const [supervisorComment, setSupervisorComment] = useState('');
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [signatureModal, setSignatureModal] = useState({ open: false, type: '' });
  const [approvalModal, setApprovalModal] = useState({ open: false, action: '' });
  const [signatureUpload, setSignatureUpload] = useState(null);

  const daysInMonth = useMemo(() => getDaysInMonth(month || 1, year || new Date().getFullYear()), [month, year]);
  const workingDays = useMemo(() => calculateWorkingDays(month || 1, year || new Date().getFullYear()), [month, year]);
  const totalHours = useMemo(() => calculateTotalHours(dailyEntries), [dailyEntries]);
  const levelOfEffort = useMemo(() => calculateLevelOfEffort(totalHours, month || 1, year || new Date().getFullYear(), dailyEntries), [totalHours, month, year, dailyEntries]);

  const isSupervisor = user?.role === 'admin' || user?.role === 'ceo' || settings?.timesheet?.supervisors?.includes(String(user?.id));
  const canEdit = !timesheet || timesheet.status === 'draft';
  const canApprove = isSupervisor && timesheet?.status === 'submitted';
  const canDelete = user?.role === 'admin' && (!timesheet || timesheet.status === 'draft');

  const handleMonthChange = async (delta) => {
    let newMonth = month + delta;
    let newYear = year;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear = year + 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear = year - 1;
    }
    
    setMonth(newMonth);
    setYear(newYear);
    
    // Check if timesheet exists for new month by listing user's timesheets
    try {
      const timesheets = await listTimesheets({ userId: user?.id, month: newMonth, year: newYear });
      const existing = timesheets?.[0];
      if (existing) {
        console.log('Loading existing timesheet for month:', newMonth, 'year:', newYear, 'status:', existing.status);
        setTimesheet(existing);
        setDailyEntries(existing.daily_entries || {});
        setSelectedPartners(existing.partners || []);
        setEmployeeSignature(existing.employee_signature || localStorage.getItem(`employeeSignature_${user?.id}`) || '');
        setSupervisorSignature(existing.supervisor_signature || localStorage.getItem(`supervisorSignature_${user?.id}`) || '');
      } else {
        console.log('No existing timesheet for month:', newMonth, 'year:', newYear);
        setTimesheet(null);
        setDailyEntries({});
        setSelectedPartners([]);
        // Use persisted signatures from localStorage
        setEmployeeSignature(localStorage.getItem(`employeeSignature_${user?.id}`) || '');
        setSupervisorSignature(localStorage.getItem(`supervisorSignature_${user?.id}`) || '');
        initializeDailyEntries();
      }
    } catch (error) {
      console.error('Failed to load timesheet for month:', error);
      setTimesheet(null);
      setDailyEntries({});
      setSelectedPartners([]);
      setEmployeeSignature(localStorage.getItem(`employeeSignature_${user?.id}`) || '');
      setSupervisorSignature(localStorage.getItem(`supervisorSignature_${user?.id}`) || '');
      initializeDailyEntries();
    }
  };

  useEffect(() => {
    if (id) {
      loadTimesheet();
    } else {
      initializeDailyEntries();
      // Load signatures from localStorage for new timesheets
      setEmployeeSignature(localStorage.getItem(`employeeSignature_${user?.id}`) || '');
      setSupervisorSignature(localStorage.getItem(`supervisorSignature_${user?.id}`) || '');
    }
    setPartners(settings?.timesheet?.partners || DEFAULT_PARTNERS);
  }, [id, month, year]);

  const initializeDailyEntries = () => {
    const entries = {};
    const days = daysInMonth || 31;
    for (let day = 1; day <= days; day++) {
      entries[day] = {
        hours: '',
        partnerHours: {},
        absence: null,
        isWeekend: isWeekend(day, month || 1, year || new Date().getFullYear())
      };
    }
    setDailyEntries(entries);
    setSelectedPartners([]);
  };

  const loadTimesheet = async () => {
    try {
      setLoading(true);
      console.log('Loading timesheet with ID:', id);
      const data = await getTimesheet(id);
      console.log('Timesheet data loaded:', data);
      if (!data) {
        setNotice({
          open: true,
          title: 'Error',
          description: 'Timesheet not found.'
        });
        initializeDailyEntries();
        return;
      }
      setTimesheet(data);
      setMonth(data.month || month || 1);
      setYear(data.year || year || new Date().getFullYear());
      setSelectedPartners(data.partners || []);
      setDailyEntries(data.daily_entries || {});
      const loadedEmployeeSig = data.employee_signature || localStorage.getItem(`employeeSignature_${user?.id}`) || '';
      const loadedSupervisorSig = data.supervisor_signature || localStorage.getItem(`supervisorSignature_${user?.id}`) || '';
      console.log('Loaded employee signature:', loadedEmployeeSig ? 'Yes' : 'No');
      console.log('Loaded supervisor signature:', loadedSupervisorSig ? 'Yes' : 'No');
      setEmployeeSignature(loadedEmployeeSig);
      setSupervisorSignature(loadedSupervisorSig);
    } catch (error) {
      console.error('Failed to load timesheet:', error);
      console.error('Error response:', error.response?.data);
      setNotice({
        open: true,
        title: 'Error',
        description: 'Failed to load timesheet. Please try again.'
      });
      initializeDailyEntries();
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerToggle = (partner) => {
    setSelectedPartners(prev => 
      (prev || []).includes(partner) 
        ? (prev || []).filter(p => p !== partner)
        : [...(prev || []), partner]
    );
  };

  const handleDayHoursChange = (day, value) => {
    const hours = parseFloat(value) || 0;
    if (hours > 8) {
      setNotice({
        open: true,
        title: 'Invalid Hours',
        description: 'Maximum 8 hours per day allowed.'
      });
      return;
    }
    setDailyEntries(prev => ({
      ...prev,
      [day]: { ...prev[day], hours }
    }));
  };

  const handlePartnerHoursChange = (day, partner, value) => {
    const hours = parseFloat(value) || 0;
    
    // Calculate total hours for this day across all partners
    let dayTotal = hours;
    const entry = dailyEntries[day] || {};
    if (entry.partnerHours) {
      Object.entries(entry.partnerHours).forEach(([p, h]) => {
        if (p !== partner && h !== '' && h !== null && h !== undefined) {
          dayTotal += parseFloat(h) || 0;
        }
      });
    }
    
    if (dayTotal > 8) {
      setNotice({
        open: true,
        title: 'Invalid Hours',
        description: `Total hours across all partners cannot exceed 8 hours per day. Current total: ${dayTotal} hours.`
      });
      return;
    }
    
    setDailyEntries(prev => ({
      ...prev,
      [day]: {
        ...(prev[day] || { hours: '', partnerHours: {}, absence: null, isWeekend: isWeekend(day, month || 1, year || new Date().getFullYear()) }),
        partnerHours: { ...(prev[day]?.partnerHours || {}), [partner]: hours }
      }
    }));
  };

  const handleAbsenceChange = (day, value) => {
    setDailyEntries(prev => ({
      ...prev,
      [day]: { ...prev[day], absence: value, hours: value ? 0 : prev[day].hours }
    }));
  };

  const handleSignatureUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        if (type === 'employee') {
          setEmployeeSignature(base64);
          localStorage.setItem(`employeeSignature_${user?.id}`, base64);
        } else {
          setSupervisorSignature(base64);
          localStorage.setItem(`supervisorSignature_${user?.id}`, base64);
        }
        setSignatureModal({ open: false, type: '' });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const saveData = {
        partners: selectedPartners,
        dailyEntries,
        totalHours: parseFloat(totalHours) || 0,
        levelOfEffort: parseFloat(levelOfEffort) || 0,
        employeeSignature,
        supervisorSignature
      };
      
      console.log('Saving timesheet with data:', saveData);
      
      if (timesheet) {
        const updated = await updateTimesheet(timesheet.id, saveData);
        console.log('Updated timesheet:', updated);
        setTimesheet(updated);
      } else {
        const newTimesheet = await createTimesheet({
          month: parseInt(month),
          year: parseInt(year),
          partners: selectedPartners,
          dailyEntries,
          totalHours: parseFloat(totalHours) || 0,
          levelOfEffort: parseFloat(levelOfEffort) || 0,
          employeeSignature,
          supervisorSignature
        });
        console.log('Created new timesheet:', newTimesheet);
        setTimesheet(newTimesheet);
      }
      setNotice({
        open: true,
        title: 'Saved',
        description: 'Timesheet saved successfully.'
      });
    } catch (error) {
      console.error('Failed to save timesheet:', error);
      console.error('Error response:', error.response?.data);
      setNotice({
        open: true,
        title: 'Error',
        description: error.response?.data?.message || 'Failed to save timesheet. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!employeeSignature) {
      setSignatureModal({ open: true, type: 'employee' });
      return;
    }
    
    try {
      setLoading(true);
      await submitTimesheet(timesheet.id, employeeSignature);
      await loadTimesheet();
      setNotice({
        open: true,
        title: 'Submitted',
        description: 'Timesheet submitted for approval.'
      });
    } catch (error) {
      console.error('Failed to submit timesheet:', error);
      setNotice({
        open: true,
        title: 'Error',
        description: 'Failed to submit timesheet. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!supervisorSignature) {
      setSignatureModal({ open: true, type: 'supervisor' });
      return;
    }

    try {
      setLoading(true);
      console.log('Approving timesheet with signature:', supervisorSignature ? 'Present' : 'Missing');
      await approveTimesheet(timesheet.id, supervisorSignature, supervisorComment);
      await loadTimesheet();
      setApprovalModal({ open: false, action: '' });
      setNotice({
        open: true,
        title: 'Approved',
        description: 'Timesheet approved successfully.'
      });
    } catch (error) {
      console.error('Failed to approve timesheet:', error);
      setNotice({
        open: true,
        title: 'Error',
        description: 'Failed to approve timesheet. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setLoading(true);
      await rejectTimesheet(timesheet.id, supervisorComment);
      await loadTimesheet();
      setApprovalModal({ open: false, action: '' });
      setNotice({
        open: true,
        title: 'Rejected',
        description: 'Timesheet rejected successfully.'
      });
    } catch (error) {
      console.error('Failed to reject timesheet:', error);
      setNotice({
        open: true,
        title: 'Error',
        description: 'Failed to reject timesheet. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignatureCapture = (signature) => {
    if (signatureModal.type === 'employee') {
      setEmployeeSignature(signature);
    } else {
      setSupervisorSignature(signature);
    }
    setSignatureModal({ open: false, type: '' });
  };

  const handleExportExcel = () => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    let csvContent = '\ufeff'; // BOM for Excel UTF-8
    
    // Header Section
    csvContent += '====================================================================================================\n';
    csvContent += `${settings?.branding?.organizationName || 'KEREA HRMS'} - TIMESHEET REPORT\n`;
    csvContent += '====================================================================================================\n\n';
    
    // Employee Information
    csvContent += 'EMPLOYEE INFORMATION\n';
    csvContent += '----------------------------------------\n';
    csvContent += `Employee Name,${user?.fullName || 'N/A'}\n`;
    csvContent += `Position,${user?.positionTitle || 'N/A'}\n`;
    csvContent += `Department,${user?.departmentName || 'N/A'}\n`;
    csvContent += `Employee ID,${user?.employeeId || 'N/A'}\n\n`;
    
    // Timesheet Information
    csvContent += 'TIMESHEET INFORMATION\n';
    csvContent += '----------------------------------------\n';
    csvContent += `Period,${monthNames[month - 1]} ${year}\n`;
    csvContent += `Working Days,${workingDays}\n`;
    csvContent += `Total Hours Worked,${totalHours.toFixed(1)}\n`;
    csvContent += `Level of Effort,${levelOfEffort}%\n`;
    csvContent += `Status,${timesheet?.status ? String(timesheet.status).charAt(0).toUpperCase() + String(timesheet.status).slice(1) : 'Draft'}\n\n`;
    
    // Daily Entries Table
    csvContent += 'DAILY ENTRIES\n';
    csvContent += '====================================================================================================\n';
    csvContent += 'Day,Date,Day of Week';
    (selectedPartners || []).forEach(partner => {
      csvContent += `,${partner} (Hours)`;
    });
    csvContent += ',Total Hours,Absence Type\n';
    csvContent += '----------------------------------------------------------------------------------------------------\n';

    for (let day = 1; day <= daysInMonth; day++) {
      const entry = dailyEntries[day] || {};
      const dayOfWeek = getDayOfWeek(day, month, year);
      const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
      
      csvContent += `${day},${dateStr},${dayNames[dayOfWeek]}`;
      (selectedPartners || []).forEach(partner => {
        csvContent += `,${entry.partnerHours?.[partner] || 0}`;
      });
      const totalForDay = parseFloat(entry.hours || 0) + Object.values(entry.partnerHours || {}).reduce((sum, h) => sum + parseFloat(h || 0), 0);
      csvContent += `,${totalForDay.toFixed(1)},${entry.absence || ''}\n`;
    }

    // Summary Section
    csvContent += '\nSUMMARY\n';
    csvContent += '====================================================================================================\n';
    csvContent += `Total Hours Worked,${totalHours.toFixed(1)}\n`;
    csvContent += `Possible Hours (${workingDays} days × 8 hours),${workingDays * 8}\n`;
    csvContent += `Level of Effort,${levelOfEffort}%\n`;
    csvContent += `Completion Rate,${((totalHours / (workingDays * 8)) * 100).toFixed(1)}%\n\n`;
    
    // Signature Information
    csvContent += 'SIGNATURE INFORMATION\n';
    csvContent += '====================================================================================================\n';
    if (timesheet?.employee_signature_date) {
      csvContent += `Employee Signed,${new Date(timesheet.employee_signature_date).toLocaleString()}\n`;
    } else {
      csvContent += `Employee Signature,Pending\n`;
    }
    if (timesheet?.supervisor_signature_date) {
      csvContent += `Supervisor Signed,${new Date(timesheet.supervisor_signature_date).toLocaleString()}\n`;
    } else {
      csvContent += `Supervisor Signature,Pending\n`;
    }
    if (timesheet?.supervisor_comment) {
      csvContent += `\nSupervisor Comment,${timesheet.supervisor_comment}\n`;
    }
    
    csvContent += '\n====================================================================================================\n';
    csvContent += `Report Generated,${new Date().toLocaleString()}\n`;
    csvContent += '====================================================================================================\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Timesheet_${monthNames[month - 1]}_${year}_${user?.fullName?.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  const handleExportPDF = () => {
    const printContent = `
      <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 1200px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #059669;">
          <h1 style="color: #1e293b; margin: 0; font-size: 28px;">${settings?.branding?.organizationName || 'KEREA'}</h1>
          <h2 style="color: #64748b; margin: 10px 0; font-size: 20px;">Monthly Timesheet</h2>
        </div>
        
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 25px; border-radius: 16px; margin-bottom: 25px; border-left: 5px solid #059669;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <p style="margin: 5px 0; color: #374151;"><strong>Employee:</strong> ${user?.fullName || 'N/A'}</p>
            <p style="margin: 5px 0; color: #374151;"><strong>Position:</strong> ${user?.positionTitle || 'N/A'}</p>
            <p style="margin: 5px 0; color: #374151;"><strong>Period:</strong> ${new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            <p style="margin: 5px 0; color: #374151;"><strong>Status:</strong> ${timesheet?.status || 'Draft'}</p>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 25px;">
          <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); padding: 25px; border-radius: 16px; border-left: 5px solid #0ea5e9;">
            <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 16px;">Total Hours Worked</h3>
            <div style="font-size: 48px; font-weight: bold; color: #0ea5e9; margin: 10px 0;">${totalHours}</div>
            <div style="font-size: 14px; color: #64748b;">hours this month</div>
          </div>
          <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 25px; border-radius: 16px; border-left: 5px solid #f59e0b;">
            <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 16px;">Working Days</h3>
            <div style="font-size: 48px; font-weight: bold; color: #f59e0b; margin: 10px 0;">${workingDays}</div>
            <div style="font-size: 14px; color: #64748b;">days this month</div>
          </div>
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); padding: 25px; border-radius: 16px; border-left: 5px solid #059669;">
            <h3 style="color: #1e293b; margin: 0 0 10px 0; font-size: 16px;">Level of Effort</h3>
            <div style="font-size: 48px; font-weight: bold; color: #059669; margin: 10px 0;">${levelOfEffort}%</div>
            <div style="font-size: 14px; color: #64748b;">productivity score</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);">
              <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1; color: #1e293b;">Day</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1; color: #1e293b;">Date</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1; color: #1e293b;">Day of Week</th>
              ${(selectedPartners || []).map(p => `<th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1; color: #1e293b;">${p} (hrs)</th>`).join('')}
              <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1; color: #1e293b;">Total</th>
              <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1; color: #1e293b;">Absence</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: daysInMonth || 31 }, (_, i) => {
              const day = i + 1;
              const entry = dailyEntries[day] || {};
              const dayOfWeek = getDayOfWeek(day, month, year);
              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
              const dayTotal = (selectedPartners || []).reduce((sum, p) => sum + (parseFloat(entry.partnerHours?.[p]) || 0), 0);
              return `
                <tr style="background: ${isWeekendDay ? '#f1f5f9' : 'white'};">
                  <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; color: #374151;">${day}</td>
                  <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; color: #374151;">${day}/${month}/${year}</td>
                  <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; color: ${isWeekendDay ? '#dc2626' : '#374151'}; font-weight: ${isWeekendDay ? 'bold' : 'normal'};">${dayNames[dayOfWeek]}</td>
                  ${(selectedPartners || []).map(p => `<td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; color: #374151;">${entry.partnerHours?.[p] || 0}</td>`).join('')}
                  <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; color: #374151; font-weight: bold;">${dayTotal || 0}</td>
                  <td style="padding: 10px; text-align: center; border: 1px solid #cbd5e1; color: ${entry.absence ? '#dc2626' : '#374151'};">${entry.absence || '-'}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background: #059669; color: white; font-weight: bold;">
              <td colspan="3" style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">Monthly Total</td>
              ${(selectedPartners || []).map(p => {
                const partnerTotal = Object.values(dailyEntries || {}).reduce((sum, entry) => sum + (parseFloat(entry.partnerHours?.[p]) || 0), 0);
                return `<td style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">${partnerTotal.toFixed(2)}</td>`;
              }).join('')}
              <td style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">${totalHours}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">-</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
            <div>
              <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #059669; padding-bottom: 10px;">Employee Signature</h3>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 60px; display: flex; align-items: center; justify-content: center;">
                ${employeeSignature ? `<img src="${employeeSignature}" style="max-width: 100%; max-height: 40px;" alt="Employee Signature" />` : '<span style="color: #94a3b8;">No signature</span>'}
              </div>
              ${timesheet?.employee_signature_date ? `<p style="margin-top: 10px; font-size: 12px; color: #64748b;">Signed: ${new Date(timesheet.employee_signature_date).toLocaleString()}</p>` : ''}
            </div>
            <div>
              <h3 style="color: #1e293b; margin: 0 0 15px 0; font-size: 16px; border-bottom: 2px solid #0ea5e9; padding-bottom: 10px;">Supervisor Signature</h3>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 60px; display: flex; align-items: center; justify-content: center;">
                ${supervisorSignature ? `<img src="${supervisorSignature}" style="max-width: 100%; max-height: 40px;" alt="Supervisor Signature" />` : '<span style="color: #94a3b8;">No signature</span>'}
              </div>
              ${timesheet?.supervisor_signature_date ? `<p style="margin-top: 10px; font-size: 12px; color: #64748b;">Signed: ${new Date(timesheet.supervisor_signature_date).toLocaleString()}</p>` : ''}
              ${timesheet?.supervisor_comment ? `<p style="margin-top: 10px; font-size: 12px; color: #64748b;"><strong>Comment:</strong> ${timesheet.supervisor_comment}</p>` : ''}
            </div>
          </div>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 5px 0;">Generated on ${new Date().toLocaleString()}</p>
          <p style="margin: 5px 0;">${settings?.branding?.organizationName || 'KEREA'} HRMS - Timesheet Management</p>
        </div>
      </div>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Timesheet - ${month}/${year}</title>
        <style>
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { margin: 20px; }
          }
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const SignaturePad = ({ onSave, onCancel }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const startDrawing = (e) => {
      setIsDrawing(true);
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.getContext('2d').beginPath();
      canvas.getContext('2d').moveTo(e.clientX - rect.left, e.clientY - rect.top);
    };

    const draw = (e) => {
      if (!isDrawing) return;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      canvas.getContext('2d').lineTo(e.clientX - rect.left, e.clientY - rect.top);
      canvas.getContext('2d').stroke();
    };

    const stopDrawing = () => {
      setIsDrawing(false);
    };

    const clear = () => {
      const canvas = canvasRef.current;
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    };

    const save = () => {
      const canvas = canvasRef.current;
      onSave(canvas.toDataURL());
    };

    return (
      <div className="space-y-4">
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => document.getElementById(`signature-upload-${signatureModal.type}`).click()}
            className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            <Upload size={16} className="inline mr-2" /> Upload Image/PDF
          </button>
          <input
            id={`signature-upload-${signatureModal.type}`}
            type="file"
            accept="image/*,.pdf"
            onChange={(e) => handleSignatureUpload(e, signatureModal.type)}
            className="hidden"
          />
        </div>
        <div className="text-center text-xs text-slate-500 mb-2">- OR -</div>
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full border-2 border-slate-200 rounded-lg cursor-crosshair bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        <div className="flex gap-2">
          <button type="button" onClick={clear} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
            Clear
          </button>
          <button type="button" onClick={save} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
            Save
          </button>
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
            Cancel
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={id ? `Timesheet - ${month}/${year}` : 'New Timesheet'}
        subtitle={id ? `Status: ${timesheet?.status || 'Draft'}` : 'Create a new monthly timesheet'}
        actions={[
          <Link key="back" to="/timesheets" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">
            <ArrowLeft size={16} /> Back
          </Link>,
          canEdit && (
            <button key="save" type="button" onClick={handleSave} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Save size={16} /> Save
            </button>
          ),
          canEdit && !id && (
            <button key="submit" type="button" onClick={handleSubmit} className="inline-flex items-center gap-2 rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white hover:opacity-90">
              <Send size={16} /> Submit
            </button>
          ),
          <button key="pdf" type="button" onClick={handleExportPDF} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileText size={16} /> Export PDF
          </button>,
          <button key="excel" type="button" onClick={handleExportExcel} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileSpreadsheet size={16} /> Export Excel
          </button>,
          canApprove && (
            <>
              <button key="approve" type="button" onClick={() => setApprovalModal({ open: true, action: 'approve' })} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
                <CheckCircle2 size={16} /> Approve
              </button>
              <button key="reject" type="button" onClick={() => setApprovalModal({ open: true, action: 'reject' })} className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700">
                <XCircle size={16} /> Reject
              </button>
            </>
          )
        ].filter(Boolean)}
      />

      <SectionCard title="Timesheet" description={`Fill in your daily hours for ${getMonthName(month)} ${year}`}>
        {timesheet && timesheet.status !== 'draft' && !canApprove && (
          <div className={`mb-6 p-4 rounded-lg border ${
            timesheet.status === 'submitted' ? 'bg-amber-50 border-amber-200' :
            timesheet.status === 'approved' ? 'bg-emerald-50 border-emerald-200' :
            'bg-rose-50 border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {timesheet.status === 'submitted' && <Clock size={20} className="text-amber-600" />}
              {timesheet.status === 'approved' && <CheckCircle2 size={20} className="text-emerald-600" />}
              {timesheet.status === 'rejected' && <XCircle size={20} className="text-rose-600" />}
              <p className={`font-medium ${
                timesheet.status === 'submitted' ? 'text-amber-800' :
                timesheet.status === 'approved' ? 'text-emerald-800' :
                'text-rose-800'
              }`}>
                This timesheet has been {timesheet.status}. {timesheet.status === 'submitted' ? 'It is pending approval.' : ''}
                {timesheet.status === 'rejected' ? ' You can create a new timesheet for this month.' : ''}
                {timesheet.status !== 'draft' && ' Editing is disabled.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Employee</label>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <User size={16} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-900">{user?.fullName || 'N/A'}</span>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Position</label>
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <Building2 size={16} className="text-slate-500" />
              <span className="text-sm font-medium text-slate-900">{user?.positionTitle || 'N/A'}</span>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Period</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleMonthChange(-1)}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                disabled={!canEdit}
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg flex-1 justify-center">
                <Calendar size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-900">
                  {new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleMonthChange(1)}
                className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                disabled={!canEdit}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
            <div className={`px-3 py-2 rounded-lg text-center text-sm font-medium ${
              timesheet?.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
              timesheet?.status === 'submitted' ? 'bg-amber-100 text-amber-700' :
              timesheet?.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
              'bg-slate-100 text-slate-700'
            }`}>
              {timesheet?.status ? String(timesheet.status).charAt(0).toUpperCase() + String(timesheet.status).slice(1) : 'Draft'}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="mb-6">
            <label className="mb-3 block text-sm font-medium text-slate-700">Select Partners</label>
            <div className="flex flex-wrap gap-2">
              {partners?.map(partner => (
                <button
                  key={partner}
                  type="button"
                  onClick={() => handlePartnerToggle(partner)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    (selectedPartners || []).includes(partner)
                      ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-500'
                      : 'bg-slate-100 text-slate-700 border-2 border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {partner}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <Clock size={16} />
              <span className="text-sm font-medium">Total Hours</span>
            </div>
            <div className="text-3xl font-bold text-blue-900">{totalHours}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
            <div className="flex items-center gap-2 text-amber-700 mb-2">
              <Calendar size={16} />
              <span className="text-sm font-medium">Working Days</span>
            </div>
            <div className="text-3xl font-bold text-amber-900">{workingDays}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-2 text-emerald-700 mb-2">
              <FileSpreadsheet size={16} />
              <span className="text-sm font-medium">Level of Effort</span>
            </div>
            <div className="text-3xl font-bold text-emerald-900">{levelOfEffort}%</div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Daily Entries" style={{ ...cardStyle, ...animationStyle }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="px-3 py-2 text-left font-medium text-slate-700 border">Day</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700 border">Date</th>
                <th className="px-3 py-2 text-left font-medium text-slate-700 border">Day</th>
                {(selectedPartners || []).map(partner => (
                  <th key={partner} className="px-3 py-2 text-center font-medium text-slate-700 border">{partner} (hrs)</th>
                ))}
                <th className="px-3 py-2 text-center font-medium text-slate-700 border">Total</th>
                <th className="px-3 py-2 text-center font-medium text-slate-700 border">Absence</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: daysInMonth || 31 }, (_, i) => {
                const day = i + 1;
                const entry = dailyEntries[day] || {};
                const dayOfWeek = getDayOfWeek(day, month, year);
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <tr key={day} className={isWeekendDay ? 'bg-slate-50' : ''}>
                    <td className="px-3 py-2 border text-slate-900">{day}</td>
                    <td className="px-3 py-2 border text-slate-600">{day}/{month}/{year}</td>
                    <td className={`px-3 py-2 border font-medium ${isWeekendDay ? 'text-red-600' : 'text-slate-900'}`}>
                      {dayNames[dayOfWeek]}
                    </td>
                    {(selectedPartners || []).map(partner => (
                      <td key={partner} className="px-3 py-2 border text-center">
                        {entry.absence ? 'X' : (
                          <input
                            type="number"
                            min="0"
                            max="8"
                            step="0.5"
                            value={entry.partnerHours?.[partner] || ''}
                            onChange={(e) => handlePartnerHoursChange(day, partner, e.target.value)}
                            disabled={!canEdit || isWeekendDay || !!entry.absence}
                            placeholder=""
                            className="w-full px-2 py-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 border text-center font-medium text-slate-900">
                      {entry.absence ? (entry.absence === 'Did not work' ? 'N/A' : 'S') : (() => {
                        let dayTotal = 0;
                        if (entry.hours !== '' && entry.hours !== null && entry.hours !== undefined) {
                          dayTotal += parseFloat(entry.hours) || 0;
                        }
                        if (entry.partnerHours) {
                          Object.values(entry.partnerHours).forEach(hours => {
                            if (hours !== '' && hours !== null && hours !== undefined) {
                              dayTotal += parseFloat(hours) || 0;
                            }
                          });
                        }
                        return dayTotal > 0 ? dayTotal.toFixed(1) : '';
                      })()}
                    </td>
                    <td className="px-3 py-2 border">
                      <select
                        value={entry.absence || ''}
                        onChange={(e) => handleAbsenceChange(day, e.target.value)}
                        disabled={!canEdit || isWeekendDay}
                        className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                      >
                        <option value="">-</option>
                        {ABSENCE_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-emerald-50 font-semibold">
                <td colSpan={3 + (selectedPartners || []).length} className="px-3 py-3 border text-right text-slate-700">
                  Total Hours
                </td>
                <td className="px-3 py-3 border text-center text-emerald-700">{totalHours.toFixed(1)}</td>
                <td className="px-3 py-3 border text-center text-slate-500">-</td>
              </tr>
              <tr className="bg-slate-50">
                <td colSpan={3 + (selectedPartners || []).length} className="px-3 py-3 border text-right text-slate-700">
                  Level of Effort
                </td>
                <td colSpan="2" className="px-3 py-3 border text-center">
                  <span className={`font-semibold ${parseFloat(levelOfEffort) >= 90 ? 'text-emerald-600' : parseFloat(levelOfEffort) >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {levelOfEffort}%
                  </span>
                  <span className="ml-2 text-xs text-slate-500">({totalHours.toFixed(1)} / {workingDays * 8} possible hours)</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Signatures" style={{ ...cardStyle, ...animationStyle }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="mb-3 block text-sm font-medium text-slate-700">Employee Signature</label>
            <div className="p-4 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 min-h-[100px] flex items-center justify-center">
              {employeeSignature ? (
                <img src={employeeSignature} alt="Employee Signature" className="max-h-24" />
              ) : (
                <span className="text-slate-400">No signature</span>
              )}
            </div>
            {timesheet?.employee_signature_date && (
              <p className="mt-2 text-xs text-slate-500">Signed: {new Date(timesheet.employee_signature_date).toLocaleString()}</p>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setSignatureModal({ open: true, type: 'employee' })}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200"
              >
                <PenTool size={16} /> {employeeSignature ? 'Update Signature' : 'Add Signature'}
              </button>
            )}
          </div>
          <div>
            <label className="mb-3 block text-sm font-medium text-slate-700">Supervisor Signature</label>
            <div className="p-4 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300 min-h-[100px] flex items-center justify-center">
              {supervisorSignature ? (
                <img src={supervisorSignature} alt="Supervisor Signature" className="max-h-24" />
              ) : (
                <span className="text-slate-400">No signature</span>
              )}
            </div>
            {timesheet?.supervisor_signature_date && (
              <p className="mt-2 text-xs text-slate-500">Signed: {new Date(timesheet.supervisor_signature_date).toLocaleString()}</p>
            )}
            {canApprove && (
              <button
                type="button"
                onClick={() => setSignatureModal({ open: true, type: 'supervisor' })}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200"
              >
                <PenTool size={16} /> {supervisorSignature ? 'Update Signature' : 'Add Signature'}
              </button>
            )}
          </div>
        </div>
        {timesheet?.supervisor_comment && (
          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm font-medium text-amber-900">Supervisor Comment:</p>
            <p className="text-sm text-amber-800">{timesheet.supervisor_comment}</p>
          </div>
        )}
        
        {canEdit && (
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={16} />
              {loading ? 'Saving...' : 'Save Timesheet'}
            </button>
          </div>
        )}
      </SectionCard>

      <Modal
        open={signatureModal.open}
        title={signatureModal.type === 'employee' ? 'Employee Signature' : 'Supervisor Signature'}
        description="Draw your signature below"
        onClose={() => setSignatureModal({ open: false, type: '' })}
      >
        <SignaturePad
          onSave={handleSignatureCapture}
          onCancel={() => setSignatureModal({ open: false, type: '' })}
        />
      </Modal>

      <Modal
        open={approvalModal.open}
        title={approvalModal.action === 'approve' ? 'Approve Timesheet' : 'Reject Timesheet'}
        description={approvalModal.action === 'approve' ? 'Confirm approval of this timesheet' : 'Provide reason for rejection'}
        onClose={() => setApprovalModal({ open: false, action: '' })}
        actions={[
          <button key="cancel" type="button" onClick={() => setApprovalModal({ open: false, action: '' })} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">
            Cancel
          </button>,
          <button
            key="confirm"
            type="button"
            onClick={approvalModal.action === 'approve' ? handleApprove : handleReject}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg ${approvalModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
          >
            {approvalModal.action === 'approve' ? 'Approve' : 'Reject'}
          </button>
        ]}
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {approvalModal.action === 'approve' ? 'Comment (Optional)' : 'Rejection Reason (Optional)'}
            </label>
            <textarea
              rows="3"
              value={supervisorComment}
              onChange={(e) => setSupervisorComment(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder={approvalModal.action === 'approve' ? 'Add any comments for the employee...' : 'Provide reason for rejection...'}
            />
          </div>
        </div>
      </Modal>

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
