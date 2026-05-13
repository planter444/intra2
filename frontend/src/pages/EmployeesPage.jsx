import { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import RoleBadge from '../components/RoleBadge';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { createUser, fetchUsers, resetUserPassword, softDeleteUser, updateUser } from '../services/userService';
import { normalizeDateInput } from '../utils/formatters';

const EMPLOYEE_ROLE_SELECTION_PREFIX = 'title:';
const privilegedRoleOptions = [
  { value: 'supervisor', role: 'supervisor', roleTitle: 'Supervisor', label: 'Supervisor' },
  { value: 'admin', role: 'admin', roleTitle: 'IT Officer', label: 'IT Officer' },
  { value: 'ceo', role: 'ceo', roleTitle: 'CEO', label: 'CEO' },
  { value: 'finance', role: 'finance', roleTitle: 'Finance Officer', label: 'Finance Officer' }
];

const normalizeRoleTitleValue = (value) => String(value || '').trim() || 'Employee';
const getEmployeeRoleSelection = (roleTitle) => `${EMPLOYEE_ROLE_SELECTION_PREFIX}${normalizeRoleTitleValue(roleTitle)}`;
const getRoleSelection = (role, roleTitle) => (role === 'employee' ? getEmployeeRoleSelection(roleTitle) : role);
const resolveRoleSelection = (selection) => {
  const privilegedRole = privilegedRoleOptions.find((option) => option.value === selection);
  if (privilegedRole) {
    return { role: privilegedRole.role, roleTitle: privilegedRole.roleTitle };
  }

  return {
    role: 'employee',
    roleTitle: normalizeRoleTitleValue(String(selection || '').replace(EMPLOYEE_ROLE_SELECTION_PREFIX, ''))
  };
};

const defaultForm = {
  employeeNo: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  gender: '',
  roleSelection: getEmployeeRoleSelection('Employee'),
  departmentId: '',
  supervisorId: '',
  joinedAt: '',
  positionTitle: '',
  password: ''
};

export default function EmployeesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [form, setForm] = useState(defaultForm);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filters, setFilters] = useState({ search: '', role: '', departmentId: '' });
  const formSectionRef = useRef(null);
  const firstFieldRef = useRef(null);

  const loadUsers = async () => {
    const results = await fetchUsers();
    setUsers(results);
  };

  useEffect(() => {
    loadUsers().catch(console.error);
  }, []);

  const canManage = user?.role === 'admin' || user?.role === 'ceo';
  const isSupervisorView = user?.role === 'supervisor';

  useEffect(() => {
    if (!formOpen) {
      return;
    }

    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => firstFieldRef.current?.focus(), 150);
  }, [formOpen, editingUserId]);

  useEffect(() => {
    if (!location.state?.openCreateForm || !canManage) {
      return;
    }

    openCreateForm();
    navigate(location.pathname, { replace: true, state: {} });
  }, [canManage, location.pathname, location.state, navigate]);

  const departmentOptions = useMemo(
    () => (settings?.departments || []).filter((department) => department?.name !== 'Human Resources'),
    [settings]
  );
  const roleOptions = useMemo(() => {
    const configuredTitles = Array.isArray(settings?.roleTitles) ? settings.roleTitles : [];
    const employeeTitleOptions = [...new Set(configuredTitles
      .map((item) => normalizeRoleTitleValue(item?.value))
      .filter(Boolean)
      .concat('Employee'))]
      .map((title) => ({
        value: getEmployeeRoleSelection(title),
        role: 'employee',
        roleTitle: title,
        label: title
      }));

    return [...privilegedRoleOptions, ...employeeTitleOptions];
  }, [settings?.roleTitles]);
  const supervisorOptions = useMemo(
    () => users.filter((candidate) => candidate.isActive && !candidate.isDeleted && ['supervisor', 'admin', 'ceo'].includes(candidate.role)),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const searchValue = filters.search.trim().toLowerCase();

    return users.filter((candidate) => {
      const matchesSearch = !searchValue
        || [candidate.fullName, candidate.email, candidate.employeeNo, candidate.departmentName, candidate.positionTitle, candidate.roleTitle]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(searchValue));
      const matchesRole = !filters.role || getRoleSelection(candidate.role, candidate.roleTitle) === filters.role;
      const matchesDepartment = !filters.departmentId || String(candidate.departmentId || '') === String(filters.departmentId);
      return matchesSearch && matchesRole && matchesDepartment;
    });
  }, [filters, users]);

  const editingRecord = useMemo(
    () => users.find((candidate) => String(candidate.id) === String(editingUserId || '')),
    [editingUserId, users]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!formOpen) {
      return false;
    }

    if (!editingUserId) {
      return JSON.stringify(form) !== JSON.stringify(defaultForm);
    }

    if (!editingRecord) {
      return false;
    }

    return JSON.stringify(form) !== JSON.stringify({
      employeeNo: editingRecord.employeeNo || '',
      firstName: editingRecord.firstName || '',
      lastName: editingRecord.lastName || '',
      email: editingRecord.email || '',
      phone: editingRecord.phone || '',
      gender: editingRecord.gender || '',
      roleSelection: getRoleSelection(editingRecord.role, editingRecord.roleTitle),
      departmentId: editingRecord.departmentId || '',
      supervisorId: editingRecord.supervisorId || '',
      joinedAt: normalizeDateInput(editingRecord.joinedAt),
      positionTitle: editingRecord.positionTitle || '',
      password: ''
    });
  }, [editingRecord, editingUserId, form, formOpen]);

  useUnsavedChangesGuard(hasUnsavedChanges);

  const resetForm = (closePanel = false) => {
    setForm(defaultForm);
    setEditingUserId(null);
    if (closePanel) {
      setFormOpen(false);
    }
  };

  const openCreateForm = () => {
    setForm(defaultForm);
    setEditingUserId(null);
    setFormOpen(true);
  };

  const handleEdit = (record) => {
    setEditingUserId(record.id);
    setFormOpen(true);
    setForm({
      employeeNo: record.employeeNo || '',
      firstName: record.firstName || '',
      lastName: record.lastName || '',
      email: record.email || '',
      phone: record.phone || '',
      gender: record.gender || '',
      roleSelection: getRoleSelection(record.role, record.roleTitle),
      departmentId: record.departmentId || '',
      supervisorId: record.supervisorId || '',
      joinedAt: normalizeDateInput(record.joinedAt),
      positionTitle: record.positionTitle || '',
      password: ''
    });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    const roleAssignment = resolveRoleSelection(form.roleSelection);
    const payload = {
      ...form,
      employeeNo: form.employeeNo || null,
      gender: form.gender || null,
      departmentId: form.departmentId || null,
      supervisorId: form.supervisorId || null,
      joinedAt: form.joinedAt || null,
      role: roleAssignment.role,
      roleTitle: roleAssignment.roleTitle
    };

    delete payload.roleSelection;

    try {
      if (editingUserId) {
        delete payload.password;
        await updateUser(editingUserId, payload);
        setMessageTone('success');
        setMessage('Employee updated successfully.');
      } else {
        await createUser(payload);
        setMessageTone('success');
        setMessage('Employee created successfully.');
      }

      resetForm(true);
      await loadUsers();
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to save this employee right now.');
    }
  };

  const handleReset = async (record) => {
    if (!window.confirm(`Reset ${record.fullName} password?`)) {
      return;
    }

    const password = window.prompt(`Enter a new password for ${record.fullName}`, 'Password@123');
    if (!password) {
      return;
    }

    try {
      await resetUserPassword(record.id, password);
      setMessageTone('success');
      setMessage('Credentials reset successfully.');
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to reset that password right now.');
    }
  };

  const handleSoftDelete = async (record) => {
    if (!window.confirm(`Delete ${record.fullName}?`)) {
      return;
    }

    try {
      await softDeleteUser(record.id);
      setMessageTone('success');
      setMessage('Employee deleted successfully.');
      await loadUsers();
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to delete this employee right now.');
    }
  };

  const clearFilters = () => setFilters({ search: '', role: '', departmentId: '' });

  const getUserInitials = (record) => `${record.firstName?.[0] || ''}${record.lastName?.[0] || ''}`.toUpperCase() || 'U';

  const roleFilterOptions = roleOptions.map((role) => [role.value, role.label]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={canManage ? (settings?.labels?.employeeDirectoryTitle || 'Employees') : user?.role === 'supervisor' ? 'My Team' : (settings?.labels?.employeeDirectoryTitle || 'Employees')}
        subtitle={canManage ? (settings?.labels?.employeeDirectorySubtitle || 'Manage employee records and staff.') : user?.role === 'supervisor' ? 'View the employees who report to you.' : 'View the employees in your current reporting scope.'}
        actions={canManage ? [
          <button key="add-employee" type="button" className="inline-flex items-center gap-2 rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg" onClick={openCreateForm}>
            <Plus size={16} />Add Employee
          </button>
        ] : undefined}
      />

      {message ? <div className={`rounded-2xl px-4 py-3 text-sm ${messageTone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{message}</div> : null}

      {formOpen && canManage ? (
        <div ref={formSectionRef}>
          <SectionCard
            title={editingUserId ? 'Edit Employee' : 'New Employee'}
            subtitle="Create or update employee details without leaving this page."
            actions={[
              <button key="close-form" type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => resetForm(true)}>
                <X size={16} />Close
              </button>
            ]}
          >
            <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Employee number</label>
                <input ref={firstFieldRef} value={form.employeeNo} onChange={(event) => setForm((current) => ({ ...current, employeeNo: event.target.value }))} placeholder="Optional" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">First name</label>
                <input value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Last name</label>
                <input value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
                <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Phone</label>
                <input inputMode="numeric" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value.replace(/\D/g, '') }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Gender</label>
                <select value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Role</label>
                <select value={form.roleSelection} onChange={(event) => setForm((current) => ({ ...current, roleSelection: event.target.value }))}>
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Department</label>
                <select value={form.departmentId} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value }))}>
                  <option value="">No department</option>
                  {departmentOptions.map((department) => (
                    <option key={department.id || department.name} value={department.id || ''}>{department.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Supervisor</label>
                <select value={form.supervisorId} onChange={(event) => setForm((current) => ({ ...current, supervisorId: event.target.value }))}>
                  <option value="">No supervisor</option>
                  {supervisorOptions
                    .filter((candidate) => String(candidate.id) !== String(editingUserId || ''))
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.fullName}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Joined date</label>
                <input type="date" value={form.joinedAt} onChange={(event) => setForm((current) => ({ ...current, joinedAt: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Position title</label>
                <input value={form.positionTitle} onChange={(event) => setForm((current) => ({ ...current, positionTitle: event.target.value }))} />
              </div>
              {!editingUserId ? (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Temporary password</label>
                  <input value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required />
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white shadow-lg">
                <Plus size={16} />{editingUserId ? 'Save employee changes' : 'Create employee'}
              </button>
              <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => resetForm(true)}>
                Cancel
              </button>
            </div>
            </form>
          </SectionCard>
        </div>
      ) : null}

      <SectionCard subtitle="Filter employees by name, role, and department. Supervisors only see employees under them.">
        <div className={`grid gap-3 ${isSupervisorView ? 'lg:grid-cols-[minmax(0,1fr),180px]' : 'lg:grid-cols-[minmax(0,1.3fr),220px,220px,180px]'}`}>
          <label className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><Search size={16} /></span>
            <input className="pl-11" placeholder="Search employees..." value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
          </label>
          {!isSupervisorView ? (
            <select value={filters.role} onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}>
              <option value="">All Roles</option>
              {roleFilterOptions.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          ) : null}
          {!isSupervisorView ? (
            <select value={filters.departmentId} onChange={(event) => setFilters((current) => ({ ...current, departmentId: event.target.value }))}>
              <option value="">All Departments</option>
              {departmentOptions.map((department) => (
                <option key={department.id || department.name} value={department.id || ''}>{department.name}</option>
              ))}
            </select>
          ) : null}
          <button type="button" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700" onClick={clearFilters}>
            <RotateCcw size={16} />Clear Filters
          </button>
        </div>

        <div className="mt-6 space-y-4 lg:hidden">
          {filteredUsers.length ? filteredUsers.map((row) => (
            <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{getUserInitials(row)}</div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{row.fullName}</p>
                    <p className="truncate text-sm text-slate-500">{row.email}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{row.employeeNo || 'No employee number'}</p>
                  </div>
                </div>
                <RoleBadge role={row.role} roleTitle={row.roleTitle} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Department</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{row.departmentName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
                  <p className="mt-1"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{row.isActive ? 'Active' : 'Inactive'}</span></p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Supervisor</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{row.supervisorName || 'No supervisor'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Position</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{row.positionTitle || 'Not set'}</p>
                </div>
              </div>
              {canManage ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700" onClick={() => handleEdit(row)}>
                    <Pencil size={14} />Edit
                  </button>
                  <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700" onClick={() => handleReset(row)}>
                    <RotateCcw size={14} />Reset
                  </button>
                  <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700" onClick={() => handleSoftDelete(row)}>
                    <Trash2 size={14} />Delete
                  </button>
                </div>
              ) : null}
            </div>
          )) : <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">No employees matched your filters.</p>}
        </div>

        <div className="mt-6 hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-3 pr-4 font-medium">Employee</th>
                <th className="pb-3 pr-4 font-medium">Role</th>
                <th className="pb-3 pr-4 font-medium">Department</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length ? filteredUsers.map((row) => (
                <tr key={row.id}>
                  <td className="py-4 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">{getUserInitials(row)}</div>
                      <div>
                        <p className="font-medium text-slate-900">{row.fullName}</p>
                        <p className="text-sm text-slate-500">{row.email}</p>
                        <p className="text-xs uppercase tracking-wide text-slate-400">{row.employeeNo || 'No employee number'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 pr-4"><RoleBadge role={row.role} roleTitle={row.roleTitle} /></td>
                  <td className="py-4 pr-4 text-slate-600">{row.departmentName || 'N/A'}</td>
                  <td className="py-4 pr-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {row.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-4">
                    {canManage ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-xl p-2 text-blue-600 transition hover:bg-blue-50" onClick={() => handleEdit(row)} aria-label={`Edit ${row.fullName}`}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100" onClick={() => handleReset(row)} aria-label={`Reset ${row.fullName}`}>
                          <RotateCcw size={16} />
                        </button>
                        <button type="button" className="rounded-xl p-2 text-rose-600 transition hover:bg-rose-50" onClick={() => handleSoftDelete(row)} aria-label={`Delete ${row.fullName}`}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-slate-400">View only</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="py-10 text-center text-slate-500" colSpan={5}>No employees matched your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
