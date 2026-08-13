import { useEffect, useState } from 'react';
import { Save, Plus, X, Mail, Route, UserPlus, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { fetchTravelNotificationSettings, updateTravelNotificationSettings, fetchTravelRoutingSettings, updateTravelRoutingSettings, fetchAllEmployeeRouting, addEmployeeRouting, removeEmployeeRouting } from '../services/travelService';
import { fetchUsers } from '../services/userService';

export default function TravelSettingsPage() {
  const { user } = useAuth();
  const [notificationSettings, setNotificationSettings] = useState({
    notifyFinance: true,
    notifyAdmin: true,
    notifySupervisor: true,
    notifyCeo: false,
    customRecipients: []
  });
  const [routingSettings, setRoutingSettings] = useState({
    routeToSupervisor: true,
    routeToCeo: false,
    routeToAdmin: false
  });
  const [employeeRouting, setEmployeeRouting] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [newRecipient, setNewRecipient] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedApprover, setSelectedApprover] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [notificationData, routingData, routingList, usersList] = await Promise.all([
        fetchTravelNotificationSettings(),
        fetchTravelRoutingSettings(),
        fetchAllEmployeeRouting(),
        fetchUsers()
      ]);
      setNotificationSettings(notificationData);
      setRoutingSettings(routingData);
      setEmployeeRouting(routingList);
      setUsers(usersList);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to load settings',
        description: error.response?.data?.message || 'Please refresh and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await Promise.all([
        updateTravelNotificationSettings(notificationSettings),
        updateTravelRoutingSettings(routingSettings)
      ]);
      setNotice({
        open: true,
        title: 'Settings saved',
        description: 'Travel settings have been updated successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to save settings',
        description: error.response?.data?.message || 'Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRecipient = () => {
    if (!newRecipient.trim()) {
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newRecipient.trim())) {
      setNotice({
        open: true,
        title: 'Invalid email',
        description: 'Please enter a valid email address.'
      });
      return;
    }

    if (notificationSettings.customRecipients.includes(newRecipient.trim())) {
      setNotice({
        open: true,
        title: 'Email already exists',
        description: 'This email is already in the custom recipients list.'
      });
      return;
    }

    setNotificationSettings({
      ...notificationSettings,
      customRecipients: [...notificationSettings.customRecipients, newRecipient.trim()]
    });
    setNewRecipient('');
  };

  const handleRemoveRecipient = (email) => {
    setNotificationSettings({
      ...notificationSettings,
      customRecipients: notificationSettings.customRecipients.filter((r) => r !== email)
    });
  };

  const handleAddEmployeeRouting = async () => {
    if (!selectedEmployee || !selectedApprover) {
      setNotice({
        open: true,
        title: 'Missing selection',
        description: 'Please select both an employee and an approver.'
      });
      return;
    }

    if (selectedEmployee === selectedApprover) {
      setNotice({
        open: true,
        title: 'Invalid selection',
        description: 'Employee and approver cannot be the same person.'
      });
      return;
    }

    try {
      await addEmployeeRouting({ employeeId: selectedEmployee, approverId: selectedApprover });
      await loadSettings();
      setSelectedEmployee('');
      setSelectedApprover('');
      setNotice({
        open: true,
        title: 'Routing added',
        description: 'Employee routing has been added successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to add routing',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleRemoveEmployeeRouting = async (id) => {
    try {
      await removeEmployeeRouting(id);
      await loadSettings();
      setNotice({
        open: true,
        title: 'Routing removed',
        description: 'Employee routing has been removed successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to remove routing',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading travel settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Travel Notification Settings"
        subtitle="Configure who gets notified when employees upload travel receipts for reimbursement."
        actions={[
          <button
            key="save"
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-lg disabled:opacity-60"
          >
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        ]}
      />

      <SectionCard title="Notification recipients" subtitle="Choose which roles should receive email notifications when travel receipts are uploaded.">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">Finance Officer</p>
              <p className="text-sm text-slate-500">Notify finance officers when receipts are uploaded for reimbursement</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={notificationSettings.notifyFinance}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, notifyFinance: e.target.checked })}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300" />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">IT Officer (Admin)</p>
              <p className="text-sm text-slate-500">Notify IT officers when receipts are uploaded</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={notificationSettings.notifyAdmin}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, notifyAdmin: e.target.checked })}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300" />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">Supervisor</p>
              <p className="text-sm text-slate-500">Notify the employee's supervisor when receipts are uploaded</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={notificationSettings.notifySupervisor}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, notifySupervisor: e.target.checked })}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300" />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">CEO</p>
              <p className="text-sm text-slate-500">Notify CEO when receipts are uploaded</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={notificationSettings.notifyCeo}
                onChange={(e) => setNotificationSettings({ ...notificationSettings, notifyCeo: e.target.checked })}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300" />
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Custom email recipients" subtitle="Add additional email addresses to receive travel receipt notifications.">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className="bg-slate-50 pl-10"
                  placeholder="Enter email address"
                  value={newRecipient}
                  onChange={(e) => setNewRecipient(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddRecipient}
              className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white"
            >
              <Plus size={18} />
              Add
            </button>
          </div>

          {notificationSettings.customRecipients.length === 0 ? (
            <p className="text-sm text-slate-500">No custom recipients added yet.</p>
          ) : (
            <div className="space-y-2">
              {notificationSettings.customRecipients.map((email) => (
                <div key={email} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-900">{email}</span>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                    onClick={() => handleRemoveRecipient(email)}
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Travel request routing" subtitle="Configure who should receive and approve travel requests.">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">Route to Supervisor</p>
              <p className="text-sm text-slate-500">Send travel requests to the employee's supervisor for approval</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={routingSettings.routeToSupervisor}
                onChange={(e) => setRoutingSettings({ ...routingSettings, routeToSupervisor: e.target.checked })}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300" />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">Route to CEO</p>
              <p className="text-sm text-slate-500">Send travel requests to the CEO for approval</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={routingSettings.routeToCeo}
                onChange={(e) => setRoutingSettings({ ...routingSettings, routeToCeo: e.target.checked })}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300" />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-medium text-slate-900">Route to IT Officer (Admin)</p>
              <p className="text-sm text-slate-500">Send travel requests to IT officers for approval</p>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={routingSettings.routeToAdmin}
                onChange={(e) => setRoutingSettings({ ...routingSettings, routeToAdmin: e.target.checked })}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300" />
            </label>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Employee-specific routing" subtitle="Configure specific approvers for individual employees.">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Employee</label>
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="bg-slate-50"
              >
                <option value="">Select employee</option>
                {users.filter(u => u.role === 'employee' || u.role === 'supervisor').map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Approver</label>
              <select
                value={selectedApprover}
                onChange={(e) => setSelectedApprover(e.target.value)}
                className="bg-slate-50"
              >
                <option value="">Select approver</option>
                {users.filter(u => ['supervisor', 'admin', 'ceo', 'finance'].includes(u.role)).map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddEmployeeRouting}
            className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white"
          >
            <UserPlus size={18} />
            Add Routing
          </button>

          {employeeRouting.length === 0 ? (
            <p className="text-sm text-slate-500">No employee-specific routing configured yet.</p>
          ) : (
            <div className="space-y-2">
              {employeeRouting.map((routing) => (
                <div key={routing.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{routing.employeeName}</p>
                      <p className="text-xs text-slate-500">{routing.employeeEmail}</p>
                    </div>
                    <span className="text-slate-400">→</span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{routing.approverName}</p>
                      <p className="text-xs text-slate-500">{routing.approverRole}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                    onClick={() => handleRemoveEmployeeRouting(routing.id)}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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
