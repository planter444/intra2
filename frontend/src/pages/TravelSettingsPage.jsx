import { useEffect, useState } from 'react';
import { Save, Plus, X, Mail, Route, UserPlus, Trash2, Briefcase, Users, Calculator, DollarSign, Building2, MapPin, Phone, Check } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { fetchTravelNotificationSettings, updateTravelNotificationSettings, fetchAllEmployeeRouting, addEmployeeRouting, removeEmployeeRouting } from '../services/travelService';
import { fetchUsers, updateUser } from '../services/userService';
import { updateSettings } from '../services/settingsService';

export default function TravelSettingsPage() {
  const { user, settings, replaceSettings } = useAuth();
  const [notificationSettings, setNotificationSettings] = useState({
    recipientIds: []
  });
  const [employeeRouting, setEmployeeRouting] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedApprover, setSelectedApprover] = useState('');
  const [selectedNotificationRecipients, setSelectedNotificationRecipients] = useState([]);
  const [designationModal, setDesignationModal] = useState({ open: false, userId: null, designation: '' });
  const [projectsModal, setProjectsModal] = useState({ open: false, project: '' });
  const [dsaSettings, setDsaSettings] = useState({
    mode: 'designation', // 'designation' or 'standard'
    calculationBasis: 'nights', // 'nights' or 'days'
    kenyaRate: 2000,
    kenyaCurrency: 'KES',
    eastAfricaRate: 40,
    eastAfricaCurrency: 'USD',
    internationalRate: 50,
    internationalCurrency: 'USD',
    description: 'Covers accommodation, meals, and incidental costs'
  });
  const [hotelsModal, setHotelsModal] = useState({ open: false, hotel: null });
  const [hotelForm, setHotelForm] = useState({
    name: '',
    county: '',
    town: '',
    location: '',
    contact: '',
    notes: '',
    active: true
  });
  const [activeTab, setActiveTab] = useState('notifications');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (settings?.travel?.dsa) {
      setDsaSettings({
        mode: settings.travel.dsa.mode || 'designation',
        calculationBasis: settings.travel.dsa.calculationBasis || 'nights',
        kenyaRate: settings.travel.dsa.kenyaRate || 2000,
        kenyaCurrency: settings.travel.dsa.kenyaCurrency || 'KES',
        eastAfricaRate: settings.travel.dsa.eastAfricaRate || 40,
        eastAfricaCurrency: settings.travel.dsa.eastAfricaCurrency || 'USD',
        internationalRate: settings.travel.dsa.internationalRate || 50,
        internationalCurrency: settings.travel.dsa.internationalCurrency || 'USD'
      });
    }
  }, [settings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [notificationData, routingList, usersList] = await Promise.all([
        fetchTravelNotificationSettings(),
        fetchAllEmployeeRouting(),
        fetchUsers()
      ]);
      setNotificationSettings(notificationData);
      setEmployeeRouting(routingList);
      setUsers(usersList);
      setSelectedNotificationRecipients(notificationData.recipientIds || []);
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
      await updateTravelNotificationSettings({ recipientIds: selectedNotificationRecipients });
      setNotificationSettings({ ...notificationSettings, recipientIds: selectedNotificationRecipients });
      
      // Save DSA settings
      await updateSettings({
        ...settings,
        travel: {
          ...settings.travel,
          dsa: dsaSettings
        }
      });
      replaceSettings({
        ...settings,
        travel: {
          ...settings.travel,
          dsa: dsaSettings
        }
      });
      
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
    // Removed - using employee selection instead
  };

  const handleRemoveRecipient = (email) => {
    // Removed - using employee selection instead
  };

  const handleNotificationRecipientChange = (userId) => {
    setSelectedNotificationRecipients(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
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

  const handleUpdateDesignation = async () => {
    try {
      await updateUser(designationModal.userId, { designation: designationModal.designation });
      await loadSettings();
      setDesignationModal({ open: false, userId: null, designation: '' });
      setNotice({
        open: true,
        title: 'Designation updated',
        description: 'Employee designation has been updated successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to update designation',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleAddProject = async () => {
    if (!projectsModal.project.trim()) {
      setNotice({
        open: true,
        title: 'Invalid project name',
        description: 'Please enter a valid project name.'
      });
      return;
    }

    try {
      const currentProjects = settings.travel?.projects || ['CWF', 'KEREA', 'WRI', 'CLASP', 'GIZ', 'GOGLA'];
      const newProjects = [...currentProjects, projectsModal.project.trim().toUpperCase()];
      
      await updateSettings({
        ...settings,
        travel: {
          ...settings.travel,
          projects: newProjects
        }
      });
      
      replaceSettings({
        ...settings,
        travel: {
          ...settings.travel,
          projects: newProjects
        }
      });
      
      setProjectsModal({ open: false, project: '' });
      setNotice({
        open: true,
        title: 'Project added',
        description: 'Project has been added successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to add project',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleRemoveProject = async (projectToRemove) => {
    try {
      const currentProjects = settings.travel?.projects || ['CWF', 'KEREA', 'WRI', 'CLASP', 'GIZ', 'GOGLA'];
      const newProjects = currentProjects.filter(p => p !== projectToRemove);
      
      await updateSettings({
        ...settings,
        travel: {
          ...settings.travel,
          projects: newProjects
        }
      });
      
      replaceSettings({
        ...settings,
        travel: {
          ...settings.travel,
          projects: newProjects
        }
      });
      
      setNotice({
        open: true,
        title: 'Project removed',
        description: 'Project has been removed successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to remove project',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleAddHotel = async () => {
    if (!hotelForm.name || !hotelForm.town) {
      setNotice({
        open: true,
        title: 'Missing information',
        description: 'Hotel name and town are required.'
      });
      return;
    }

    try {
      const currentHotels = settings.travel?.hotels || [];
      const newHotel = {
        id: Date.now().toString(),
        ...hotelForm
      };
      
      await updateSettings({
        ...settings,
        travel: {
          ...settings.travel,
          hotels: [...currentHotels, newHotel]
        }
      });
      
      replaceSettings({
        ...settings,
        travel: {
          ...settings.travel,
          hotels: [...currentHotels, newHotel]
        }
      });
      
      setHotelForm({
        name: '',
        county: '',
        town: '',
        location: '',
        contact: '',
        notes: '',
        active: true
      });
      setHotelsModal({ open: false, hotel: null });
      
      setNotice({
        open: true,
        title: 'Hotel added',
        description: 'Preferred hotel has been added successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to add hotel',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleEditHotel = (hotel) => {
    setHotelForm(hotel);
    setHotelsModal({ open: true, hotel });
  };

  const handleUpdateHotel = async () => {
    if (!hotelForm.name || !hotelForm.town) {
      setNotice({
        open: true,
        title: 'Missing information',
        description: 'Hotel name and town are required.'
      });
      return;
    }

    try {
      const currentHotels = settings.travel?.hotels || [];
      const updatedHotels = currentHotels.map(h => 
        h.id === hotelsModal.hotel.id ? { ...hotelForm, id: h.id } : h
      );
      
      await updateSettings({
        ...settings,
        travel: {
          ...settings.travel,
          hotels: updatedHotels
        }
      });
      
      replaceSettings({
        ...settings,
        travel: {
          ...settings.travel,
          hotels: updatedHotels
        }
      });
      
      setHotelForm({
        name: '',
        county: '',
        town: '',
        location: '',
        contact: '',
        notes: '',
        active: true
      });
      setHotelsModal({ open: false, hotel: null });
      
      setNotice({
        open: true,
        title: 'Hotel updated',
        description: 'Preferred hotel has been updated successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to update hotel',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleDeleteHotel = async (hotelId) => {
    try {
      const currentHotels = settings.travel?.hotels || [];
      const updatedHotels = currentHotels.filter(h => h.id !== hotelId);
      
      await updateSettings({
        ...settings,
        travel: {
          ...settings.travel,
          hotels: updatedHotels
        }
      });
      
      replaceSettings({
        ...settings,
        travel: {
          ...settings.travel,
          hotels: updatedHotels
        }
      });
      
      setNotice({
        open: true,
        title: 'Hotel deleted',
        description: 'Preferred hotel has been deleted successfully.'
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to delete hotel',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleToggleHotelStatus = async (hotelId) => {
    try {
      const currentHotels = settings.travel?.hotels || [];
      const updatedHotels = currentHotels.map(h => 
        h.id === hotelId ? { ...h, active: !h.active } : h
      );
      
      await updateSettings({
        ...settings,
        travel: {
          ...settings.travel,
          hotels: updatedHotels
        }
      });
      
      replaceSettings({
        ...settings,
        travel: {
          ...settings.travel,
          hotels: updatedHotels
        }
      });
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to update hotel status',
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
        title="Travel Settings"
        subtitle="Configure travel management settings including designations, projects, notifications, and routing."
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

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'notifications' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Mail size={16} className="inline mr-2" />
          Notifications
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('routing')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'routing' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Route size={16} className="inline mr-2" />
          Routing
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('designations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'designations' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Users size={16} className="inline mr-2" />
          Designations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'projects' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Briefcase size={16} className="inline mr-2" />
          Projects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dsa')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'dsa' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Calculator size={16} className="inline mr-2" />
          DSA Settings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('hotels')}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'hotels' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          <Building2 size={16} className="inline mr-2" />
          Preferred Hotels
        </button>
      </div>

      {activeTab === 'notifications' && (
        <SectionCard title="Travel notification recipients" subtitle="Select employees who should receive notifications when travel requests are submitted or receipts are uploaded.">
          <div className="space-y-4">
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No employees available.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 cursor-pointer hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedNotificationRecipients.includes(String(u.id))}
                      onChange={() => handleNotificationRecipientChange(String(u.id))}
                      className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-slate-500">{u.email} • {u.role}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <p className="text-sm text-slate-500">
              {selectedNotificationRecipients.length} employee(s) selected for notifications
            </p>
          </div>
        </SectionCard>
      )}

      {activeTab === 'designations' && (
        <SectionCard title="Employee Designations" subtitle="Assign designations to employees for DSA calculation. Designations determine the applicable DSA rates.">
          <div className="space-y-4">
            {users.length === 0 ? (
              <p className="text-sm text-slate-500">No employees available.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-slate-500">{u.email} • {u.positionTitle || 'No position'}</p>
                      <p className="text-xs text-slate-400">Current: {u.designation || 'Not set'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDesignationModal({ open: true, userId: u.id, designation: u.designation || '' })}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Set Designation
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === 'projects' && (
        <SectionCard title="Projects / Programmes / Activities" subtitle="Manage the available project options for travel requests.">
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={projectsModal.project}
                onChange={(e) => setProjectsModal({ ...projectsModal, project: e.target.value })}
                placeholder="Enter new project name"
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setProjectsModal({ ...projectsModal, open: true })}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Plus size={16} />
                Add Project
              </button>
            </div>
            
            <div className="space-y-2">
              {(settings.travel?.projects || ['CWF', 'KEREA', 'WRI', 'CLASP', 'GIZ', 'GOGLA']).map((project) => (
                <div key={project} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                  <span className="font-medium text-slate-900">{project}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProject(project)}
                    className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                    title="Remove project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === 'dsa' && (
        <SectionCard title="DSA Settings" subtitle="Configure Daily Subsistence Allowance calculation method and rates.">
          <div className="space-y-6">
            {/* DSA Calculation Mode */}
            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700">DSA Calculation Mode</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="dsaMode"
                    value="designation"
                    checked={dsaSettings.mode === 'designation'}
                    onChange={(e) => setDsaSettings({ ...dsaSettings, mode: e.target.value })}
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Designation-Based DSA</p>
                    <p className="text-sm text-slate-500">DSA rates vary by employee designation (Field Officer, Intern, Secretariat, Consultant)</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="dsaMode"
                    value="standard"
                    checked={dsaSettings.mode === 'standard'}
                    onChange={(e) => setDsaSettings({ ...dsaSettings, mode: e.target.value })}
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Admin-Configured Standard DSA</p>
                    <p className="text-sm text-slate-500">Single DSA rate applies to all staff regardless of designation</p>
                  </div>
                </label>
              </div>
            </div>

            {/* DSA Description */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">DSA Description Message</label>
              <input
                type="text"
                value={dsaSettings.description}
                onChange={(e) => setDsaSettings({ ...dsaSettings, description: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                placeholder="e.g., Covers accommodation, meals, and incidental costs"
              />
              <p className="mt-1 text-xs text-slate-500">This message will be displayed to employees when they see their DSA amount in travel requests.</p>
            </div>

            {/* DSA Calculation Basis */}
            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700">DSA Calculation Basis</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="calculationBasis"
                    value="nights"
                    checked={dsaSettings.calculationBasis === 'nights'}
                    onChange={(e) => setDsaSettings({ ...dsaSettings, calculationBasis: e.target.value })}
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Charge by Nights</p>
                    <p className="text-sm text-slate-500">Calculate nights between start and end date (e.g., Monday to Friday = 4 nights)</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="calculationBasis"
                    value="days"
                    checked={dsaSettings.calculationBasis === 'days'}
                    onChange={(e) => setDsaSettings({ ...dsaSettings, calculationBasis: e.target.value })}
                    className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">Charge by Travel Days</p>
                    <p className="text-sm text-slate-500">Calculate calendar travel days (e.g., Monday to Friday = 5 days)</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Standard DSA Rates (only shown when mode is 'standard') */}
            {dsaSettings.mode === 'standard' && (
              <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <h3 className="flex items-center gap-2 font-medium text-emerald-800">
                  <DollarSign size={18} />
                  Standard DSA Rates
                </h3>
                
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">Within Kenya Rate</label>
                    <div className="flex gap-2">
                      <select
                        value={dsaSettings.kenyaCurrency}
                        onChange={(e) => setDsaSettings({ ...dsaSettings, kenyaCurrency: e.target.value })}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="KES">KES</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                      </select>
                      <input
                        type="number"
                        value={dsaSettings.kenyaRate || ''}
                        onChange={(e) => setDsaSettings({ ...dsaSettings, kenyaRate: e.target.value ? Number(e.target.value) : 0 })}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        min="0"
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">East Africa Rate</label>
                    <div className="flex gap-2">
                      <select
                        value={dsaSettings.eastAfricaCurrency}
                        onChange={(e) => setDsaSettings({ ...dsaSettings, eastAfricaCurrency: e.target.value })}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="KES">KES</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                      </select>
                      <input
                        type="number"
                        value={dsaSettings.eastAfricaRate || ''}
                        onChange={(e) => setDsaSettings({ ...dsaSettings, eastAfricaRate: e.target.value ? Number(e.target.value) : 0 })}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        min="0"
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">International Rate</label>
                    <div className="flex gap-2">
                      <select
                        value={dsaSettings.internationalCurrency}
                        onChange={(e) => setDsaSettings({ ...dsaSettings, internationalCurrency: e.target.value })}
                        className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        <option value="KES">KES</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                      </select>
                      <input
                        type="number"
                        value={dsaSettings.internationalRate || ''}
                        onChange={(e) => setDsaSettings({ ...dsaSettings, internationalRate: e.target.value ? Number(e.target.value) : 0 })}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                        min="0"
                        placeholder="Enter amount"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-slate-500">
              Changes to DSA settings will apply to new travel requests. Historical requests retain their original rates.
            </p>
          </div>
        </SectionCard>
      )}

      {activeTab === 'hotels' && (
        <SectionCard title="Preferred Hotels / Accommodation" subtitle="Manage KEREA-approved hotels for official travel. Employees will be prompted to select from these hotels when available for their destination.">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setHotelForm({
                  name: '',
                  county: '',
                  town: '',
                  location: '',
                  contact: '',
                  notes: '',
                  active: true
                });
                setHotelsModal({ open: true, hotel: null });
              }}
              className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white"
            >
              <Plus size={18} />
              Add Hotel
            </button>
            
            {(settings.travel?.hotels || []).length === 0 ? (
              <p className="text-sm text-slate-500">No preferred hotels configured yet.</p>
            ) : (
              <div className="space-y-3">
                {(settings.travel?.hotels || []).map((hotel) => (
                  <div key={hotel.id} className={`rounded-xl border ${hotel.active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'} p-4`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-slate-900">{hotel.name}</h4>
                          {!hotel.active && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">Inactive</span>
                          )}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <MapPin size={14} />
                            <span>{hotel.town}{hotel.county ? `, ${hotel.county}` : ''}</span>
                          </div>
                          {hotel.location && (
                            <div className="flex items-center gap-2">
                              <Building2 size={14} />
                              <span>{hotel.location}</span>
                            </div>
                          )}
                          {hotel.contact && (
                            <div className="flex items-center gap-2">
                              <Phone size={14} />
                              <span>{hotel.contact}</span>
                            </div>
                          )}
                          {hotel.notes && (
                            <p className="text-xs text-slate-500 italic">{hotel.notes}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleHotelStatus(hotel.id)}
                          className={`rounded-lg p-1.5 ${hotel.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-600 hover:bg-slate-100'}`}
                          title={hotel.active ? 'Deactivate hotel' : 'Activate hotel'}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditHotel(hotel)}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                          title="Edit hotel"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHotel(hotel.id)}
                          className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                          title="Delete hotel"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === 'routing' && (
        <SectionCard title="Employee-specific routing" subtitle="Configure specific approvers for individual employees. This is the only approval routing method - approvers will receive notifications for their assigned employees.">
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
                {users.map((u) => (
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
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Note: You can select the same person as both employee and approver if self-approval is needed.</p>
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
      )}

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

      <Modal
        open={designationModal.open}
        title="Set Employee Designation"
        description="Select the designation for this employee. This will determine their DSA rates for travel."
        onClose={() => setDesignationModal({ open: false, userId: null, designation: '' })}
      >
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Designation</label>
          <select
            value={designationModal.designation}
            onChange={(e) => setDesignationModal({ ...designationModal, designation: e.target.value })}
            className="bg-slate-50"
          >
            <option value="">Select designation</option>
            <option value="Field Officer">Field Officer</option>
            <option value="Intern">Intern</option>
            <option value="Secretariat">Secretariat</option>
            <option value="Consultant">Consultant</option>
          </select>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setDesignationModal({ open: false, userId: null, designation: '' })}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await updateUser(designationModal.userId, { designation: designationModal.designation });
                const updatedUsers = await fetchUsers();
                setUsers(updatedUsers);
                setDesignationModal({ open: false, userId: null, designation: '' });
                setNotice({
                  open: true,
                  title: 'Designation updated',
                  description: 'Employee designation has been updated successfully.'
                });
              } catch (error) {
                setNotice({
                  open: true,
                  title: 'Unable to update designation',
                  description: error.response?.data?.message || 'Please try again.'
                });
              }
            }}
            className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white"
          >
            Save Designation
          </button>
        </div>
      </Modal>

      <Modal
        open={hotelsModal.open}
        title={hotelsModal.hotel ? 'Edit Hotel' : 'Add Hotel'}
        description={hotelsModal.hotel ? 'Update the hotel information below.' : 'Enter the hotel details below to add it to the preferred hotels list.'}
        onClose={() => setHotelsModal({ open: false, hotel: null })}
      >
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Hotel Name *</label>
            <input
              type="text"
              value={hotelForm.name}
              onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              placeholder="Enter hotel name"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">County</label>
              <input
                type="text"
                value={hotelForm.county}
                onChange={(e) => setHotelForm({ ...hotelForm, county: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                placeholder="Enter county"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Town/City *</label>
              <input
                type="text"
                value={hotelForm.town}
                onChange={(e) => setHotelForm({ ...hotelForm, town: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                placeholder="Enter town or city"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Location</label>
            <input
              type="text"
              value={hotelForm.location}
              onChange={(e) => setHotelForm({ ...hotelForm, location: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              placeholder="Enter specific location/address"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Contact Details</label>
            <input
              type="text"
              value={hotelForm.contact}
              onChange={(e) => setHotelForm({ ...hotelForm, contact: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              placeholder="Phone number or email"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Notes</label>
            <textarea
              value={hotelForm.notes}
              onChange={(e) => setHotelForm({ ...hotelForm, notes: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              rows="2"
              placeholder="Any additional notes"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hotelActive"
              checked={hotelForm.active}
              onChange={(e) => setHotelForm({ ...hotelForm, active: e.target.checked })}
              className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="hotelActive" className="text-sm font-medium text-slate-700">Active</label>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setHotelsModal({ open: false, hotel: null })}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={hotelsModal.hotel ? handleUpdateHotel : handleAddHotel}
            className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white"
          >
            {hotelsModal.hotel ? 'Update Hotel' : 'Add Hotel'}
          </button>
        </div>
      </Modal>

      <Modal
        open={projectsModal.open}
        title="Add New Project"
        description="Enter the name of the new project/programme/activity."
        onClose={() => setProjectsModal({ open: false, project: '' })}
      >
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Project Name</label>
          <input
            type="text"
            value={projectsModal.project}
            onChange={(e) => setProjectsModal({ ...projectsModal, project: e.target.value })}
            placeholder="e.g., NEW_PROJECT"
            className="bg-slate-50"
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            onClick={() => setProjectsModal({ open: false, project: '' })}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            onClick={handleAddProject}
          >
            Add Project
          </button>
        </div>
      </Modal>
    </div>
  );
}
