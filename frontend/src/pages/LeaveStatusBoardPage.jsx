import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Plane } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import { fetchLeaveBalances, fetchLeaveOverview } from '../services/leaveService';
import { formatDateDisplay, formatDateRangeDisplay } from '../utils/formatters';
import { countKenyaLeaveDays, formatDateOnly, parseDateOnly } from '../utils/leaveCalendar';
import { usePagePresentation } from '../hooks/usePagePresentation';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getYearBounds = (year, joinedAt) => {
  const today = parseDateOnly(formatDateOnly(new Date()));
  const baseStart = new Date(year, 0, 1);
  const joinedDate = parseDateOnly(joinedAt);
  const start = joinedDate && joinedDate.getTime() > baseStart.getTime() ? joinedDate : baseStart;
  let end = new Date(year, 11, 31);

  if (today && year === today.getFullYear() && today.getTime() < end.getTime()) {
    end = today;
  }

  if (start.getTime() > end.getTime()) {
    return null;
  }

  return { start, end };
};

const getDisplayBounds = (year, joinedAt) => {
  const bounds = getYearBounds(year, joinedAt);
  if (!bounds) {
    return null;
  }

  const today = new Date();
  if (year !== today.getFullYear()) {
    return bounds;
  }

  const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return {
    start: bounds.start,
    end: endOfCurrentMonth.getTime() > bounds.end.getTime() ? endOfCurrentMonth : bounds.end
  };
};

const shiftDays = (date, days) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const getInclusiveCalendarDays = (startDate, endDate) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate || startDate);

  if (!start || !end || end.getTime() < start.getTime()) {
    return 0;
  }

  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

const getWorkingDays = (startDate, endDate) => countKenyaLeaveDays(startDate, endDate) || 0;

const maxDate = (left, right) => (left.getTime() >= right.getTime() ? left : right);
const minDate = (left, right) => (left.getTime() <= right.getTime() ? left : right);

const getOffsetPercent = (segmentStartDate, timelineStartDate, totalDays) => {
  const offsetDays = getInclusiveCalendarDays(formatDateOnly(timelineStartDate), segmentStartDate) - 1;
  return totalDays ? (offsetDays / totalDays) * 100 : 0;
};

const buildMonthSegments = (year, displayBounds) => {
  if (!displayBounds) {
    return [];
  }

  const totalCalendarDays = getInclusiveCalendarDays(formatDateOnly(displayBounds.start), formatDateOnly(displayBounds.end));

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const visibleStart = maxDate(monthStart, displayBounds.start);
    const visibleEnd = minDate(monthEnd, displayBounds.end);

    if (visibleStart.getTime() > visibleEnd.getTime()) {
      return null;
    }

    return {
      label: MONTH_LABELS[monthIndex],
      widthPercent: totalCalendarDays ? (getInclusiveCalendarDays(formatDateOnly(visibleStart), formatDateOnly(visibleEnd)) / totalCalendarDays) * 100 : 0
    };
  }).filter(Boolean);
};

const buildSegments = (requests, year, joinedAt, displayBounds) => {
  const dataBounds = getYearBounds(year, joinedAt);
  if (!dataBounds || !displayBounds) {
    return [];
  }

  const timelineStart = dataBounds.start;
  const timelineEnd = dataBounds.end;
  const today = formatDateOnly(new Date());
  const totalCalendarDays = getInclusiveCalendarDays(formatDateOnly(displayBounds.start), formatDateOnly(displayBounds.end));
  const sorted = [...(requests || [])].sort((left, right) => String(left.startDate).localeCompare(String(right.startDate)));
  const segments = [];
  let cursor = new Date(timelineStart.getTime());

  sorted.forEach((request) => {
    const requestStart = parseDateOnly(request.startDate);
    const requestEnd = parseDateOnly(request.endDate);
    if (!requestStart || !requestEnd) {
      return;
    }

    const segmentStart = maxDate(requestStart, timelineStart);
    const segmentEnd = minDate(requestEnd, timelineEnd);
    if (segmentEnd.getTime() < timelineStart.getTime() || segmentStart.getTime() > timelineEnd.getTime()) {
      return;
    }

    if (segmentEnd.getTime() < cursor.getTime()) {
      return;
    }

    if (segmentStart.getTime() > cursor.getTime()) {
      const workEnd = shiftDays(segmentStart, -1);
      const workDays = getWorkingDays(formatDateOnly(cursor), formatDateOnly(workEnd));
      if (workDays > 0) {
        segments.push({
          type: 'work',
          label: 'At Work',
          startDate: formatDateOnly(cursor),
          endDate: formatDateOnly(workEnd),
          days: workDays,
          isCurrent: false
        });
      }
    }

    const effectiveLeaveStart = maxDate(segmentStart, cursor);
    const leaveDays = getWorkingDays(formatDateOnly(effectiveLeaveStart), formatDateOnly(segmentEnd));
    if (leaveDays > 0) {
      segments.push({
        type: 'leave',
        label: request.leaveTypeLabel,
        startDate: formatDateOnly(effectiveLeaveStart),
        endDate: formatDateOnly(segmentEnd),
        days: leaveDays,
        requestId: request.id,
        isCurrent: false
      });
    }
    cursor = shiftDays(segmentEnd, 1);
  });

  if (cursor.getTime() <= timelineEnd.getTime()) {
    const workDays = getWorkingDays(formatDateOnly(cursor), formatDateOnly(timelineEnd));
    if (workDays > 0) {
      segments.push({
        type: 'work',
        label: 'At Work',
        startDate: formatDateOnly(cursor),
        endDate: formatDateOnly(timelineEnd),
        days: workDays,
        isCurrent: formatDateOnly(timelineEnd) === today
      });
    }
  }

  return segments.map((segment) => ({
    ...segment,
    widthPercent: totalCalendarDays ? (getInclusiveCalendarDays(segment.startDate, segment.endDate) / totalCalendarDays) * 100 : 0,
    offsetPercent: getOffsetPercent(segment.startDate, displayBounds.start, totalCalendarDays)
  }));
};

const getSegmentClassName = (segment) => {
  if (segment.type === 'leave') {
    return 'bg-gradient-to-r from-amber-400 to-orange-500 text-white';
  }

  return 'bg-gradient-to-r from-emerald-500 to-green-600 text-white';
};

export default function LeaveStatusBoardPage() {
  const { user } = useAuth();
  const canViewJoinedCompany = ['admin', 'ceo', 'finance'].includes(user?.role);
  const canViewEmployeeBalances = ['admin', 'ceo', 'finance'].includes(user?.role);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBalances, setSelectedBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const { cardStyle, animationStyle } = usePagePresentation();
  const detailsSectionRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchLeaveOverview({ year })
      .then((data) => {
        if (!active) {
          return;
        }
        const list = data?.employees || [];
        setEmployees(list);
        setSelectedEmployeeId((current) => {
          if (current && list.some((employee) => String(employee.id) === String(current))) {
            return current;
          }
          return list[0]?.id || '';
        });
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setEmployees([]);
        setError(err.response?.data?.message || 'Unable to load the leave status board right now.');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [year]);

  useEffect(() => {
    if (!canViewEmployeeBalances || !selectedEmployeeId) {
      setSelectedBalances([]);
      return;
    }

    let active = true;
    setBalancesLoading(true);
    fetchLeaveBalances({ userId: selectedEmployeeId })
      .then((balances) => {
        if (!active) {
          return;
        }
        setSelectedBalances(Array.isArray(balances) ? balances : []);
      })
      .catch(() => {
        if (active) {
          setSelectedBalances([]);
        }
      })
      .finally(() => {
        if (active) {
          setBalancesLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [canViewEmployeeBalances, selectedEmployeeId]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return employees;
    }

    return employees.filter((employee) => [
      employee.fullName,
      employee.departmentName,
      employee.positionTitle,
      employee.roleTitle,
      employee.employeeNo
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [employees, search]);

  const selectedEmployee = useMemo(() => {
    const source = filteredEmployees.length ? filteredEmployees : employees;
    return source.find((employee) => String(employee.id) === String(selectedEmployeeId)) || source[0] || null;
  }, [employees, filteredEmployees, selectedEmployeeId]);

  const selectedTimelineBounds = useMemo(
    () => (selectedEmployee ? getDisplayBounds(year, selectedEmployee.joinedAt) : null),
    [selectedEmployee, year]
  );
  const selectedSegments = useMemo(
    () => (selectedEmployee ? buildSegments(selectedEmployee.approvedRequests || [], year, selectedEmployee.joinedAt, selectedTimelineBounds) : []),
    [selectedEmployee, selectedTimelineBounds, year]
  );
  const selectedMonthSegments = useMemo(
    () => buildMonthSegments(year, selectedTimelineBounds),
    [selectedTimelineBounds, year]
  );

  const summary = useMemo(() => {
    const atLeave = employees.filter((employee) => employee.currentStatus === 'At Leave').length;
    const atWork = employees.length - atLeave;
    const returningSoon = employees.filter((employee) => {
      if (!employee.nextReturnDate) {
        return false;
      }
      const returnDate = parseDateOnly(employee.nextReturnDate);
      const today = parseDateOnly(formatDateOnly(new Date()));
      if (!returnDate || !today) {
        return false;
      }
      const diff = Math.floor((returnDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    }).length;
    const leaveEvents = employees.reduce((total, employee) => total + (employee.approvedRequests || []).length, 0);
    return { atLeave, atWork, returningSoon, leaveEvents };
  }, [employees]);

  const yearOptions = useMemo(
    () => Array.from({ length: 7 }, (_, index) => currentYear - index),
    [currentYear]
  );

  const pageSubtitle = useMemo(() => {
    if (['ceo', 'admin', 'finance'].includes(user?.role)) {
      return 'See who is currently away, when they return, and how each employee’s year has moved between work and leave.';
    }

    if (user?.role === 'supervisor') {
      return 'Review your leave timeline and the leave activity of employees who report to you.';
    }

    return 'Review your leave timeline, current status, and year activity history.';
  }, [user?.role]);

  const currentMarkerPercent = useMemo(() => {
    if (year !== currentYear || !selectedTimelineBounds) {
      return null;
    }

    const today = formatDateOnly(new Date());
    const todayDate = parseDateOnly(today);
    if (!todayDate || todayDate.getTime() < selectedTimelineBounds.start.getTime() || todayDate.getTime() > selectedTimelineBounds.end.getTime()) {
      return null;
    }
    const totalCalendarDays = getInclusiveCalendarDays(formatDateOnly(selectedTimelineBounds.start), formatDateOnly(selectedTimelineBounds.end));
    const offsetDays = getInclusiveCalendarDays(formatDateOnly(selectedTimelineBounds.start), today) - 1;
    return totalCalendarDays ? (offsetDays / totalCalendarDays) * 100 : null;
  }, [currentYear, selectedTimelineBounds, year]);

  useEffect(() => {
    if (!selectedEmployee || typeof window === 'undefined' || window.innerWidth >= 1280) {
      return;
    }

    window.requestAnimationFrame(() => {
      detailsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [selectedEmployee]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Status Board"
        subtitle={pageSubtitle}
        actions={[
          <div key="year" className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
            <label htmlFor="leave-status-year" className="text-sm font-medium text-slate-600">Year</label>
            <select id="leave-status-year" value={year} onChange={(event) => setYear(Number(event.target.value))} className="border-0 bg-transparent py-0 pr-8 text-sm font-semibold text-slate-900 shadow-none focus:ring-0">
              {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>
        ]}
      />

      {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="At Leave" value={summary.atLeave} helper="Employees currently away" />
        <StatCard title="At Work" value={summary.atWork} helper="Employees available now" accent="from-blue-700 to-cyan-500" />
        <StatCard title="Returning Soon" value={summary.returningSoon} helper="Back within 7 days" accent="from-amber-500 to-orange-500" />
        <StatCard title="Leave Events" value={summary.leaveEvents} helper={`Approved leave periods in ${year}`} accent="from-violet-700 to-fuchsia-500" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.95fr),minmax(0,1.35fr)]">
        <SectionCard title="Employees" subtitle="Click an employee to see their current leave details and full year activity." style={{ ...cardStyle, ...animationStyle }}>
          <div className="mb-4">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, department, title, or employee number" />
          </div>

          <div className="space-y-3 max-h-[860px] overflow-y-auto pr-1">
            {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">Loading employees…</div> : null}
            {!loading && !filteredEmployees.length ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No employees matched your search.</div> : null}
            {!loading ? filteredEmployees.map((employee) => {
              const isSelected = String(employee.id) === String(selectedEmployee?.id);
              const miniTimelineBounds = getDisplayBounds(year, employee.joinedAt);
              const miniSegments = buildSegments(employee.approvedRequests || [], year, employee.joinedAt, miniTimelineBounds);
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  className={`w-full rounded-3xl border p-4 text-left transition ${isSelected ? 'border-emerald-300 bg-emerald-50/60 shadow-lg' : 'border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/30'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-slate-900">{employee.fullName}</p>
                      <p className="mt-1 text-sm text-slate-500">{employee.positionTitle || employee.roleTitle || 'Employee'} · {employee.departmentName || 'No department'}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${employee.currentStatus === 'At Leave' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {employee.currentStatus}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><CalendarDays size={14} />{employee.approvedRequests?.length || 0} leave item(s)</span>
                    {employee.currentLeave ? <span className="truncate">{employee.currentLeave.leaveTypeLabel}</span> : <span>Working now</span>}
                  </div>
                  <div className="relative mt-3 h-3 overflow-hidden rounded-full border border-slate-200 bg-white">
                    {miniSegments.map((segment, index) => (
                      <div
                        key={`${employee.id}-${segment.startDate}-${segment.endDate}-${index}`}
                        className={`absolute inset-y-0 ${segment.type === 'leave' ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        style={{ left: `${segment.offsetPercent}%`, width: `${segment.widthPercent}%` }}
                        title={`${segment.label}: ${formatDateRangeDisplay(segment.startDate, segment.endDate)}`}
                      />
                    ))}
                  </div>
                  {employee.currentLeave ? <p className="mt-3 text-xs text-slate-500">Returns on {formatDateDisplay(employee.currentLeave.returnDate)}</p> : null}
                </button>
              );
            }) : null}
          </div>
        </SectionCard>

        <div ref={detailsSectionRef} className="space-y-6">
          <SectionCard
            title={selectedEmployee ? selectedEmployee.fullName : 'Employee details'}
            subtitle={selectedEmployee ? `${selectedEmployee.positionTitle || selectedEmployee.roleTitle || 'Employee'} · ${selectedEmployee.departmentName || 'No department'} · ${selectedEmployee.employeeNo || 'No employee number'}` : 'Choose an employee to view their year overview.'}
            style={{ ...cardStyle, ...animationStyle }}
          >
            {!selectedEmployee ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">Select an employee from the left panel.</div> : (
              <div className="space-y-6">
                <div className={`grid gap-4 grid-cols-2 ${canViewJoinedCompany ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Current status</p>
                    <p className={`mt-2 text-lg font-semibold ${selectedEmployee.currentStatus === 'At Leave' ? 'text-amber-600' : 'text-emerald-600'}`}>{selectedEmployee.currentStatus}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Current leave</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{selectedEmployee.currentLeave?.leaveTypeLabel || 'None'}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedEmployee.currentLeave ? formatDateRangeDisplay(selectedEmployee.currentLeave.startDate, selectedEmployee.currentLeave.endDate) : 'Employee is currently at work.'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Expected return</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{selectedEmployee.nextReturnDate ? formatDateDisplay(selectedEmployee.nextReturnDate) : 'Already at work'}</p>
                  </div>
                  {canViewJoinedCompany ? <div className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Joined company</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{selectedEmployee.joinedAt ? formatDateDisplay(selectedEmployee.joinedAt) : 'Not set'}</p>
                  </div> : null}
                </div>

                <div className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex overflow-hidden rounded-xl bg-slate-50 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400 sm:text-[11px]">
                    {selectedMonthSegments.map((month) => <div key={month.label} style={{ width: `${month.widthPercent}%` }} className="truncate px-1 py-2">{month.label}</div>)}
                  </div>
                  <div className="relative mt-4">
                    <div className="relative min-h-[52px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {selectedSegments.map((segment, index) => (
                        <div
                          key={`${segment.startDate}-${segment.endDate}-${segment.label}-${index}`}
                          className={`absolute inset-y-0 flex min-w-0 items-center justify-center px-1 text-center text-[10px] font-semibold sm:px-2 sm:text-[11px] ${getSegmentClassName(segment)}`}
                          style={{ left: `${segment.offsetPercent}%`, width: `${segment.widthPercent}%` }}
                          title={`${segment.label}: ${formatDateRangeDisplay(segment.startDate, segment.endDate)}`}
                        >
                          <span className="truncate">{segment.widthPercent >= 9 ? segment.label : ''}</span>
                        </div>
                      ))}
                      {currentMarkerPercent !== null ? <div className="absolute inset-y-0 z-10 w-0.5 bg-slate-900/35" style={{ left: `${currentMarkerPercent}%` }} /> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" />At Work</span>
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" />Approved Leave</span>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Year activity history" subtitle={selectedEmployee ? `A visual breakdown of ${selectedEmployee.fullName}'s ${year} timeline.` : 'Select an employee to see activity.'} style={{ ...cardStyle, ...animationStyle }}>
            {selectedEmployee && canViewEmployeeBalances ? (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Leave balances</p>
                {balancesLoading ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Loading balances…</div>
                ) : selectedBalances.length ? (
                  <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {selectedBalances.map((balance, index) => (
                      <div key={balance.id || `${balance.code}-${index}`} className="rounded-3xl bg-white p-5 shadow-soft">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-700">{balance.label}</p>
                            <p className="mt-3 text-2xl font-semibold text-slate-900 sm:text-3xl">{Number(balance.balanceDays ?? 0)}</p>
                            <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">of {Number(balance.defaultDays ?? 0)} days remaining</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3 text-slate-700 shadow-sm">
                            <CalendarDays size={18} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No leave balances found for this employee.</div>
                )}
              </div>
            ) : null}
            {!selectedEmployee ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-sm text-slate-500">Select an employee to see their timeline history.</div> : (
              <div className="space-y-3">
                {selectedSegments.map((segment, index) => (
                  <div key={`${segment.startDate}-${segment.endDate}-${segment.label}-history-${index}`} className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
                    <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ${segment.type === 'leave' ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">{segment.label}</p>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">{segment.days} day(s)</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{formatDateRangeDisplay(segment.startDate, segment.endDate)}</p>
                    </div>
                    <div className="shrink-0 text-slate-400">
                      {segment.type === 'leave' ? <Plane size={16} /> : <CheckCircle2 size={16} />}
                    </div>
                  </div>
                ))}
                {!selectedSegments.length ? <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">No approved leave history for {year}.</div> : null}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
