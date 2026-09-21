import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, MapPin, DollarSign, FileText, CheckCircle, XCircle, Clock, AlertCircle, Users, Eye, Search, ArrowUpDown, User, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { fetchTravelRequests, cancelTravelRequest, decideTravelRequest, deleteTravelRequest, getApproverForEmployee, updateTravelRequestSettled, fetchTravelNotificationSettings } from '../services/travelService';
import { fetchUsers } from '../services/userService';

const statusConfig = {
  pending: { label: 'Pending Supervisor Approval', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', highlight: true },
  pending_ceo: { label: 'Pending CEO Approval', icon: Clock, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', highlight: true },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', highlight: false },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200', highlight: false },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', highlight: false },
  in_progress: { label: 'In Progress', icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', highlight: false },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', highlight: false }
};

// Helper function to determine if a request is local movement
const isLocalMovement = (request) => {
  // Check travel_category with case-insensitive comparison
  if (!request || !request.travelCategory) return false;
  const category = request.travelCategory.toLowerCase();
  return category === 'local movement' || category === 'local';
};

const canDecideTravel = (user, request, employeeApprovers) => {
  // ONLY check employee-specific routing - this is the only approval strategy
  const designatedApproverId = employeeApprovers[request.userId];
  
  // User must be the designated approver for this employee
  if (!designatedApproverId || String(designatedApproverId) !== String(user.id)) {
    return false;
  }
  
  // Can only approve pending, pending_ceo, or rejected requests
  return ['pending', 'pending_ceo', 'rejected'].includes(request.status);
};

const canDeleteTravel = (user, request) => {
  return user.role === 'admin' && ['approved', 'rejected'].includes(request.status);
};

export default function TravelPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [employeeApprovers, setEmployeeApprovers] = useState({});
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [actionModal, setActionModal] = useState({ open: false, request: null, action: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, request: null });
  const [cancelModal, setCancelModal] = useState({ open: false, request: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [users, setUsers] = useState([]);
  const [canEditSettled, setCanEditSettled] = useState(false);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await fetchTravelRequests();
      const filteredRequests = data.filter(r => r.status !== 'cancelled');
      setRequests(filteredRequests);

      // Check if user can edit settled status
      const oversightRoles = ['admin', 'ceo', 'finance', 'it_officer', 'administrator_and_membership_officer'];
      const hasRoleAccess = oversightRoles.includes(user.role) || user.positionTitle === 'Administration';
      console.log('loadRequests - User role:', user.role, 'User positionTitle:', user.positionTitle, 'hasRoleAccess:', hasRoleAccess);
      if (hasRoleAccess) {
        setCanEditSettled(true);
      } else {
        try {
          const notificationSettings = await fetchTravelNotificationSettings();
          const hasSettingsAccess = notificationSettings.settledEditorIds && notificationSettings.settledEditorIds.includes(String(user.id));
          console.log('loadRequests - hasSettingsAccess:', hasSettingsAccess, 'settledEditorIds:', notificationSettings.settledEditorIds);
          setCanEditSettled(hasSettingsAccess);
        } catch (error) {
          console.warn('Failed to load notification settings:', error.message);
          setCanEditSettled(false);
        }
      }

      // Only fetch users if user has permission (not regular employee)
      if (user.role !== 'employee') {
        try {
          const usersList = await fetchUsers();
          setUsers(usersList);
        } catch (error) {
          console.warn('Failed to load users:', error.message);
          setUsers([]);
        }
      } else {
        // For employees, only show themselves in the filter
        setUsers([{ id: user.id, firstName: user.firstName, lastName: user.lastName }]);
      }

      // Load approvers for each unique employee
      const uniqueEmployeeIds = [...new Set(filteredRequests.map(r => r.userId))];
      const approverMap = {};
      await Promise.all(
        uniqueEmployeeIds.map(async (employeeId) => {
          try {
            const approverId = await getApproverForEmployee(employeeId);
            if (approverId) {
              approverMap[employeeId] = approverId;
            }
          } catch (error) {
            // Ignore errors for individual approver lookups - don't let them cause logout
            console.warn(`Failed to load approver for employee ${employeeId}:`, error.message);
          }
        })
      );
      setEmployeeApprovers(approverMap);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to load travel requests',
        description: error.response?.data?.message || 'Please refresh and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleCancel = async (request) => {
    setCancelModal({ open: true, request });
  };

  const confirmCancel = async () => {
    const request = cancelModal.request;
    try {
      await cancelTravelRequest(request.id);
      setNotice({
        open: true,
        title: 'Travel request cancelled',
        description: 'Your travel request has been cancelled successfully.'
      });
      setCancelModal({ open: false, request: null });
      loadRequests();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to cancel request',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleDecision = async () => {
    const { request, action, comment } = actionModal;
    try {
      await decideTravelRequest(request.id, action, comment);
      setNotice({
        open: true,
        title: `Travel request ${action}d`,
        description: `The travel request has been ${action}d successfully.`
      });
      setActionModal({ open: false, request: null, action: null, comment: '' });
      loadRequests();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to process decision',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTravelRequest(deleteModal.request.id);
      setNotice({
        open: true,
        title: 'Travel request deleted',
        description: 'The travel request has been permanently deleted.'
      });
      setDeleteModal({ open: false, request: null });
      loadRequests();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to delete request',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const filteredRequests = requests.filter((request) => {
    // Employee filter
    if (selectedEmployee) {
      return String(request.userId) === String(selectedEmployee);
    }
    return true;
  }).filter((request) => {
    // Status/Settled filter
    if (sortBy === 'pending') {
      return request.status === 'pending';
    }
    if (sortBy === 'approved') {
      return request.status === 'approved';
    }
    if (sortBy === 'settled') {
      return request.settled === true;
    }
    if (sortBy === 'not_settled') {
      return request.settled === false;
    }
    return true;
  }).filter((request) => {
    // Hide pending_ceo from regular employees (they only need to see their own pending requests)
    if (user.role === 'employee' && request.status === 'pending_ceo') {
      return false;
    }
    return true;
  }).filter((request) => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        request.employeeName?.toLowerCase().includes(searchLower) ||
        request.origin?.toLowerCase().includes(searchLower) ||
        request.destination?.toLowerCase().includes(searchLower) ||
        request.travelType?.toLowerCase().includes(searchLower) ||
        request.status?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  }).sort((a, b) => {
    // Sorting logic
    let comparison = 0;
    
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.createdAt) - new Date(b.createdAt);
        break;
      case 'employee':
        comparison = (a.employeeName || '').localeCompare(b.employeeName || '');
        break;
      case 'destination':
        comparison = (a.destination || '').localeCompare(b.destination || '');
        break;
      case 'status':
        comparison = (a.status || '').localeCompare(b.status || '');
        break;
      case 'type':
        comparison = (a.travelType || '').localeCompare(b.travelType || '');
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const teamRequests = requests.filter((request) => {
    if (user.role === 'supervisor') {
      return String(request.userId) !== String(user.id);
    }
    return false;
  });

  const showTeamSection = user.role === 'supervisor' && teamRequests.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Travel Management"
        subtitle="View and manage travel requests, upload receipts for reimbursement, and track approval status."
        actions={[
          <div key="travel-options" className="flex gap-2">
            <button
              type="button"
              onClick={() => navigate('/travel/official')}
              className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-lg"
            >
              <MapPin size={18} />
              Official Travel
            </button>
            <button
              type="button"
              onClick={() => navigate('/travel/local')}
              className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg"
            >
              <MapPin size={18} />
              Local Movement
            </button>
          </div>
        ]}
      />

      <SectionCard 
        title="Travel requests" 
        subtitle="All travel requests with their current status and details."
        actions={null}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full mb-4">
          <div className="relative w-full sm:w-48 flex-shrink-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 sm:w-72">
              <User size={16} className="text-slate-400 flex-shrink-0" />
              <select
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">All Employees</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="date">Sort by Date</option>
              <option value="employee">Sort by Employee</option>
              <option value="destination">Sort by Destination</option>
              <option value="status">Sort by Status</option>
              <option value="type">Sort by Type</option>
              <option value="pending">Filter: Pending</option>
              <option value="pending_ceo">Filter: Pending CEO Approval</option>
              <option value="approved">Filter: Approved</option>
              <option value="settled">Filter: Settled</option>
              <option value="not_settled">Filter: Not Settled</option>
            </select>
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 flex-shrink-0"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <ArrowUpDown size={16} />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-slate-400">Loading travel requests...</div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <EmptyState
            title="No travel requests found"
            description={user.role === 'employee' ? 'You have not submitted any travel requests yet.' : 'No travel requests have been submitted yet.'}
          />
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => {
              const config = statusConfig[request.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              // Highlight pending requests for supervisors (not for staff's own requests)
              // Highlight pending_ceo requests for CEO (not for staff's own requests)
              const shouldHighlightForSupervisor = config.highlight && request.status === 'pending' && user.role === 'supervisor' && String(request.userId) !== String(user.id);
              const shouldHighlightForCEO = config.highlight && request.status === 'pending_ceo' && user.role === 'ceo' && String(request.userId) !== String(user.id);
              const shouldHighlight = shouldHighlightForSupervisor || shouldHighlightForCEO;
              return (
                <div
                  key={request.id}
                  className={`cursor-pointer rounded-2xl border p-5 transition-shadow hover:shadow-md ${
                    shouldHighlight ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white'
                  }`}
                  onClick={() => navigate(`/travel/${request.id}`)}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                          <StatusIcon size={12} />
                          {config.label}
                        </span>
                        <span className="text-xs text-slate-400 truncate">{request.employeeName}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                          isLocalMovement(request)
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : request.travelType === 'booking'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-purple-50 text-purple-600 border-purple-200'
                        } border`}>
                          {isLocalMovement(request)
                            ? (request.travelType === 'booking' ? 'Local Booking' : 'Local Reimbursement')
                            : request.travelType === 'booking' ? 'Official Booking' : 'Official Reimbursement'}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base sm:text-lg font-semibold text-slate-900 truncate">
                        {request.origin} → {request.destination}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs sm:text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={10} className="sm:size-10" />
                          {request.startDate} {request.endDate !== request.startDate ? `- ${request.endDate}` : ''}
                        </span>
                        {request.travelType === 'reimbursement' ? (
                          <span className="flex items-center gap-1.5">
                            <DollarSign size={10} className="sm:size-10" />
                            {(() => {
                              // Use saved total from database - do not recalculate
                              if (isLocalMovement(request)) {
                                // For local movement, estimatedCost is the total (transportation + DSA)
                                const total = request.estimatedCost || 0;
                                return `${total.toLocaleString()} ${request.currency || 'KES'}`;
                              } else {
                                // For official travel, calculate total from saved components
                                const dsa = request.dsaProvided ? 0 : (request.dsaAmount || 0);
                                const accommodation = request.accommodationProvided ? 0 : (request.accommodationAmount || 0);
                                const transportation = request.transportationCost || 0;
                                const other = request.estimatedCost || 0;
                                const total = dsa + accommodation + transportation + other;
                                return `${total.toLocaleString()} ${request.currency || 'KES'}`;
                              }
                            })()}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <DollarSign size={10} className="sm:size-10" />
                            {request.currency || 'KES'} {(() => {
                              // Use saved total from database for all request types
                              if (isLocalMovement(request)) {
                                // For local movement, estimatedCost is the total (transportation + DSA)
                                return (request.estimatedCost || 0).toLocaleString();
                              } else {
                                // For official travel, calculate total from saved components
                                const dsa = request.dsaProvided ? 0 : (request.dsaAmount || 0);
                                const accommodation = request.accommodationProvided ? 0 : (request.accommodationAmount || 0);
                                const transportation = request.transportationCost || 0;
                                const other = request.estimatedCost || 0;
                                return (dsa + accommodation + transportation + other).toLocaleString();
                              }
                            })()}
                          </span>
                        )}
                      </div>
                      {request.reason && (
                        <p className="mt-2 line-clamp-2 text-xs sm:text-sm text-slate-500">{request.reason}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
                      {/* Settled toggle for users with edit permission */}
                      {canEditSettled ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTravelRequestSettled(request.id, !request.settled).then(() => {
                              setRequests(requests.map(r => r.id === request.id ? { ...r, settled: !r.settled } : r));
                            });
                          }}
                          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                            request.settled
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 border'
                              : 'bg-slate-50 text-slate-500 border-slate-200 border hover:bg-slate-100'
                          }`}
                          title={request.settled ? 'Mark as not settled' : 'Mark as settled'}
                        >
                          <CheckCircle size={12} />
                          {request.settled ? 'Settled' : 'Settle'}
                        </button>
                      ) : (
                        /* View-only settled indicator for users without edit permission */
                        request.settled && (
                          <span className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-600 border-emerald-200 border">
                            <CheckCircle size={12} />
                            Settled
                          </span>
                        )
                      )}
                      {String(request.userId) === String(user.id) && request.status === 'pending' && !request.settled && (
                        <button
                          type="button"
                          className="flex-1 sm:flex-none rounded-lg border border-slate-200 px-1.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 sm:px-2 sm:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(request);
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      {canDecideTravel(user, request, employeeApprovers) && (
                        <button
                          type="button"
                          className="flex-1 sm:flex-none rounded-lg bg-brand-gradient px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 sm:px-3 sm:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/travel/${request.id}`);
                          }}
                        >
                          <Eye size={14} className="inline mr-1" />
                          View
                        </button>
                      )}
                      {canDeleteTravel(user, request) && (
                        <button
                          type="button"
                          className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteModal({ open: true, request });
                          }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {showTeamSection && (
        <SectionCard
          title="Team Travel Requests"
          subtitle="Manage travel requests from your team members."
          actions={[
            <button key="view-all" type="button" onClick={() => navigate('/travel')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
              View All
            </button>
          ]}
        >
          <div className="space-y-4">
            {teamRequests.slice(0, 5).map((request) => {
              const config = statusConfig[request.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              return (
                <div
                  key={request.id}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
                  onClick={() => navigate(`/travel/${request.id}`)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                          <StatusIcon size={14} />
                          {config.label}
                        </span>
                        <span className="text-sm text-slate-400">{request.employeeName}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${
                          isLocalMovement(request)
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : request.travelType === 'booking'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-purple-50 text-purple-600 border-purple-200'
                        } border`}>
                          {isLocalMovement(request)
                            ? (request.travelType === 'booking' ? 'Local Booking' : 'Local Reimbursement')
                            : request.travelType === 'booking' ? 'Official Booking' : 'Official Reimbursement'}
                        </span>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {request.origin} → {request.destination}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={16} />
                          {request.startDate} {request.endDate !== request.startDate ? `- ${request.endDate}` : ''}
                        </span>
                        {request.travelType === 'reimbursement' ? (
                          <span className="flex items-center gap-1.5">
                            <DollarSign size={16} />
                            {request.currency || 'KES'} {(
                              isLocalMovement(request)
                                ? (
                                  ((request.dsaProvided ? 0 : request.dsaAmount) || 0) +
                                  (request.transportationCost || 0)
                                ) // For local movement reimbursement: DSA + transportation
                                : (
                                  ((request.dsaProvided ? 0 : request.dsaAmount) || 0) +
                                  ((request.accommodationProvided ? 0 : request.accommodationAmount) || 0) +
                                  (request.transportationCost || 0) +
                                  (request.estimatedCost || 0)
                                )
                            ).toLocaleString()}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <DollarSign size={16} />
                            {request.currency || 'KES'} {(
                              isLocalMovement(request)
                                ? (request.estimatedCost || 0) // For local movement, estimatedCost is already the total
                                : (
                                  ((request.dsaProvided ? 0 : request.dsaAmount) || 0) +
                                  ((request.accommodationProvided ? 0 : request.accommodationAmount) || 0) +
                                  (request.estimatedCost || 0)
                                )
                            ).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {request.reason && (
                        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{request.reason}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {canDecideTravel(user, request, employeeApprovers) && (
                        <div className="flex w-full sm:w-auto gap-2">
                          <button
                            type="button"
                            className="flex-1 sm:flex-none rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionModal({ open: true, request, action: 'approve', comment: '' });
                            }}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="flex-1 sm:flex-none rounded-xl bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionModal({ open: true, request, action: 'reject', comment: '' });
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {teamRequests.length > 5 && (
              <button
                type="button"
                onClick={() => navigate('/travel')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                View {teamRequests.length - 5} more team requests
              </button>
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
        open={actionModal.open}
        title={`${actionModal.action === 'approve' ? 'Approve' : 'Reject'} travel request`}
        description={`You are about to ${actionModal.action} the travel request from ${actionModal.request?.employeeName} to ${actionModal.request?.destination}.`}
        onClose={() => setActionModal({ open: false, request: null, action: null, comment: '' })}
      >
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Comment (optional)</label>
          <textarea
            rows="3"
            className="bg-slate-50"
            placeholder="Add a comment for this decision..."
            value={actionModal.comment || ''}
            onChange={(e) => setActionModal({ ...actionModal, comment: e.target.value })}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            onClick={() => setActionModal({ open: false, request: null, action: null, comment: '' })}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white ${actionModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
            onClick={handleDecision}
          >
            {actionModal.action === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </Modal>

      <Modal
        open={cancelModal.open}
        title="Cancel travel request"
        description="Are you sure you want to cancel this travel request? This action cannot be undone."
        onClose={() => setCancelModal({ open: false, request: null })}
        actions={[
          <button key="cancel" type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => setCancelModal({ open: false, request: null })}>
            No, keep it
          </button>,
          <button key="confirm" type="button" className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700" onClick={confirmCancel}>
            Yes, cancel it
          </button>
        ]}
      />

      <Modal
        open={deleteModal.open}
        title="Delete travel request"
        description={`Are you sure you want to permanently delete the travel request from ${deleteModal.request?.employeeName}? This action cannot be undone.`}
        onClose={() => setDeleteModal({ open: false, request: null })}
        actions={[
          <button
            key="cancel"
            type="button"
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
            onClick={() => setDeleteModal({ open: false, request: null })}
          >
            Cancel
          </button>,
          <button
            key="delete"
            type="button"
            className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700"
            onClick={handleDelete}
          >
            Delete
          </button>
        ]}
      />
    </div>
  );
}
