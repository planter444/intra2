import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, MapPin, DollarSign, FileText, CheckCircle, XCircle, Clock, AlertCircle, Users, Eye, Search, ArrowUpDown, User, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { fetchTravelRequests, cancelTravelRequest, decideTravelRequest, deleteTravelRequest, getApproverForEmployee } from '../services/travelService';
import { fetchUsers } from '../services/userService';

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
  in_progress: { label: 'In Progress', icon: Calendar, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' }
};

const canDecideTravel = (user, request, employeeApprovers) => {
  // ONLY check employee-specific routing - this is the only approval strategy
  const designatedApproverId = employeeApprovers[request.userId];
  
  // User must be the designated approver for this employee
  if (!designatedApproverId || String(designatedApproverId) !== String(user.id)) {
    return false;
  }
  
  // Can only approve pending or rejected requests
  return ['pending', 'rejected'].includes(request.status);
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

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await fetchTravelRequests();
      const filteredRequests = data.filter(r => r.status !== 'cancelled');
      setRequests(filteredRequests);
      
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
    if (user.role === 'employee') {
      return String(request.userId) === String(user.id);
    }
    return true;
  }).filter((request) => {
    // Employee filter
    if (selectedEmployee) {
      return String(request.userId) === String(selectedEmployee);
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
          <button
            key="apply"
            type="button"
            onClick={() => navigate('/travel/apply')}
            className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            <Plus size={18} />
            New Travel Request
          </button>
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
              return (
                <div
                  key={request.id}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
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
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${request.travelType === 'booking' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-purple-50 text-purple-600 border-purple-200'} border`}>
                          {request.travelType === 'booking' ? 'Booking' : 'Reimbursement'}
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
                        {request.estimatedCost && (
                          <span className="flex items-center gap-1.5">
                            <DollarSign size={10} className="sm:size-10" />
                            {request.currency || 'KES'} {request.estimatedCost.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {request.reason && (
                        <p className="mt-2 line-clamp-2 text-xs sm:text-sm text-slate-500">{request.reason}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
                      {String(request.userId) === String(user.id) && request.status === 'pending' && (
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
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-slate-900">
                        {request.origin} → {request.destination}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={16} />
                          {request.startDate} {request.endDate !== request.startDate ? `- ${request.endDate}` : ''}
                        </span>
                        {request.estimatedCost && (
                          <span className="flex items-center gap-1.5">
                            <DollarSign size={16} />
                            {request.currency || 'KES'} {request.estimatedCost.toLocaleString()}
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
