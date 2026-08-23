import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, Download, X, Plus, Trash2, Edit2, Eye } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import {
  fetchTravelRequest,
  updateTravelRequest,
  cancelTravelRequest,
  decideTravelRequest,
  deleteTravelRequest,
  uploadTravelReceipt,
  updateTravelReceiptStatus,
  deleteTravelReceipt,
  downloadTravelReceipt,
  getApproverForEmployee
} from '../services/travelService';

const statusConfig = {
  pending: { label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  approved: { label: 'Approved', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  rejected: { label: 'Rejected', color: 'text-rose-600', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
  cancelled: { label: 'Cancelled', color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  completed: { label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' }
};

const receiptStatusConfig = {
  pending: { label: 'Pending', color: 'text-slate-600', bgColor: 'bg-slate-50' },
  submitted: { label: 'Submitted', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  under_review: { label: 'Under Review', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  approved: { label: 'Approved', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  rejected: { label: 'Rejected', color: 'text-rose-600', bgColor: 'bg-rose-50' },
  settled: { label: 'Settled', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
  not_settled: { label: 'Not Settled', color: 'text-rose-600', bgColor: 'bg-rose-50' }
};

const canUpdateReceiptStatus = (user, receipt) => {
  if (['admin', 'ceo', 'finance'].includes(user.role)) {
    return true;
  }
  if (user.role === 'supervisor') {
    // Supervisor can update if they are the employee's supervisor
    return true;
  }
  return false;
};

export default function TravelDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState({ open: false, title: '', description: '' });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [uploadModal, setUploadModal] = useState({ open: false, file: null, amount: '', description: '' });
  const [statusModal, setStatusModal] = useState({ open: false, receipt: null, status: '', comment: '' });
  const [deleteModal, setDeleteModal] = useState({ open: false, type: null, item: null });
  const [cancelModal, setCancelModal] = useState({ open: false });
  const [approverForEmployee, setApproverForEmployee] = useState(null);

  const loadRequest = async () => {
    try {
      setLoading(true);
      const data = await fetchTravelRequest(id);
      setRequest(data);
      setEditForm({
        startDate: data.startDate,
        endDate: data.endDate,
        origin: data.origin,
        destination: data.destination,
        reason: data.reason,
        estimatedCost: data.estimatedCost || ''
      });
      
      // Load approver for this employee
      try {
        const approverId = await getApproverForEmployee(data.userId);
        setApproverForEmployee(approverId);
      } catch (error) {
        console.warn('Failed to load approver:', error.message);
        setApproverForEmployee(null);
      }
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to load travel request',
        description: error.response?.data?.message || 'Please refresh and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
  }, [id]);

  const handleUpdate = async () => {
    try {
      await updateTravelRequest(id, editForm);
      setEditMode(false);
      setNotice({
        open: true,
        title: 'Travel request updated',
        description: 'Your travel request has been updated successfully.'
      });
      loadRequest();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to update request',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelTravelRequest(id);
      setCancelModal({ open: false });
      setNotice({
        open: true,
        title: 'Travel request cancelled',
        description: 'Your travel request has been cancelled.'
      });
      loadRequest();
    } catch (error) {
      setCancelModal({ open: false });
      setNotice({
        open: true,
        title: 'Unable to cancel request',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleDecision = async (decision, comment) => {
    try {
      await decideTravelRequest(id, decision, comment);
      setNotice({
        open: true,
        title: `Travel request ${decision}d`,
        description: `The travel request has been ${decision}d successfully.`
      });
      loadRequest();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to process decision',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleDeleteRequest = async () => {
    try {
      await deleteTravelRequest(id);
      setNotice({
        open: true,
        title: 'Travel request deleted',
        description: 'The travel request has been permanently deleted.'
      });
      navigate('/travel');
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to delete request',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleUploadReceipt = async () => {
    if (!uploadModal.file) {
      setNotice({
        open: true,
        title: 'No file selected',
        description: 'Please select a receipt file to upload.'
      });
      return;
    }

    try {
      await uploadTravelReceipt({
        travelRequestId: id,
        receipt: uploadModal.file,
        amount: uploadModal.amount || null,
        description: uploadModal.description || null
      });
      setUploadModal({ open: false, file: null, amount: '', description: '' });
      setNotice({
        open: true,
        title: 'Receipt uploaded',
        description: 'Your travel receipt has been uploaded successfully for reimbursement.'
      });
      loadRequest();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to upload receipt',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleUpdateReceiptStatus = async () => {
    try {
      await updateTravelReceiptStatus(statusModal.receipt.id, statusModal.status, statusModal.comment);
      setStatusModal({ open: false, receipt: null, status: '', comment: '' });
      setNotice({
        open: true,
        title: 'Receipt status updated',
        description: 'The receipt status has been updated successfully.'
      });
      loadRequest();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to update status',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleDeleteReceipt = async () => {
    try {
      await deleteTravelReceipt(deleteModal.item.id);
      setDeleteModal({ open: false, type: null, item: null });
      setNotice({
        open: true,
        title: 'Receipt deleted',
        description: 'The receipt has been deleted successfully.'
      });
      loadRequest();
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to delete receipt',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleDownloadReceipt = async (receipt) => {
    try {
      const blob = await downloadTravelReceipt(receipt.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = receipt.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to download receipt',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handlePreviewReceipt = async (receipt) => {
    try {
      const blob = await downloadTravelReceipt(receipt.id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to preview receipt',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handlePreviewSupportingDocument = async () => {
    if (!request.supportingDocumentId) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/documents/${request.supportingDocumentId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to preview document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to preview supporting document',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  const handleDownloadSupportingDocument = async () => {
    if (!request.supportingDocumentId) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/documents/${request.supportingDocumentId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `supporting-document-${request.id}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setNotice({
        open: true,
        title: 'Unable to download supporting document',
        description: error.response?.data?.message || 'Please try again.'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading travel request...</div>
      </div>
    );
  }

  if (!request) {
    return <EmptyState title="Travel request not found" description="The travel request you are looking for does not exist." />;
  }

  const config = statusConfig[request.status] || statusConfig.pending;
  const canEdit = String(request.userId) === String(user.id) && ['pending', 'rejected'].includes(request.status);
  const canCancel = String(request.userId) === String(user.id) && request.status === 'pending';
  // ONLY check employee-specific routing for approval
  const canDecide = approverForEmployee && String(approverForEmployee) === String(user.id) && ['pending', 'rejected'].includes(request.status);
  const canDelete = user.role === 'admin' && ['approved', 'rejected'].includes(request.status);
  const canUploadReceipt = String(request.userId) === String(user.id) && request.status === 'approved';
  const isApprover = String(request.userId) !== String(user.id) && approverForEmployee && String(approverForEmployee) === String(user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Travel Request Details"
        subtitle="View travel request details and manage receipts for reimbursement."
        actions={[
          <button key="back" type="button" onClick={() => navigate('/travel')} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
            Back to Travel
          </button>
        ]}
      />

      <SectionCard title="Travel information" subtitle="Travel request details and approval status.">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${config.bgColor} ${config.color} ${config.borderColor} border`}>
              {config.label}
            </span>
            {canEdit && !editMode && (
              <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => setEditMode(true)}>
                <Edit2 size={16} />
                Edit
              </button>
            )}
          </div>

          {editMode ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Start date</label>
                  <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">End date</label>
                  <input type="date" value={editForm.endDate} min={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Origin</label>
                  <input type="text" className="bg-white" value={editForm.origin} onChange={(e) => setEditForm({ ...editForm, origin: e.target.value })} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">Destination</label>
                  <input type="text" className="bg-white" value={editForm.destination} onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Estimated cost</label>
                <input type="number" className="bg-white" value={editForm.estimatedCost} onChange={(e) => setEditForm({ ...editForm, estimatedCost: e.target.value })} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Reason</label>
                <textarea rows="3" className="bg-white" value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setEditMode(false)}>
                  Cancel
                </button>
                <button type="button" className="rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white" onClick={handleUpdate}>
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${config.bgColor} ${config.color} ${config.borderColor} border`}>
                  {config.label}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${request.travelType === 'booking' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-purple-50 text-purple-600 border-purple-200'} border`}>
                  {request.travelType === 'booking' ? 'Booking' : 'Reimbursement'}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">Employee</p>
                  <p className="font-medium text-slate-900">{request.employeeName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Department</p>
                  <p className="font-medium text-slate-900">{request.employeeDepartmentName || 'N/A'}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">Start date</p>
                  <p className="font-medium text-slate-900">{request.startDate}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">End date</p>
                  <p className="font-medium text-slate-900">{request.endDate}</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-slate-500">Origin</p>
                  <p className="font-medium text-slate-900">{request.origin}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Destination</p>
                  <p className="font-medium text-slate-900">{request.destination}</p>
                </div>
              </div>
              {request.estimatedCost && (
                <div>
                  <p className="text-sm text-slate-500">Estimated cost</p>
                  <p className="font-medium text-slate-900">{request.currency} {request.estimatedCost.toLocaleString()}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500">Reason</p>
                <p className="font-medium text-slate-900">{request.reason}</p>
              </div>
              {request.approverName && (
                <div>
                  <p className="text-sm text-slate-500">Approved by</p>
                  <p className="font-medium text-slate-900">{request.approverName}</p>
                </div>
              )}
              {request.rejectionReason && (
                <div>
                  <p className="text-sm text-slate-500">Rejection reason</p>
                  <p className="font-medium text-rose-600">{request.rejectionReason}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
            {canCancel && (
              <button type="button" className="w-full sm:w-auto rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setCancelModal({ open: true })}>
                Cancel Request
              </button>
            )}
            {canDecide && (
              <div className="flex w-full sm:w-auto gap-3">
                <button type="button" className="flex-1 sm:flex-none rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700" onClick={() => handleDecision('approve', '')}>
                  Approve
                </button>
                <button type="button" className="flex-1 sm:flex-none rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700" onClick={() => handleDecision('reject', '')}>
                  Reject
                </button>
              </div>
            )}
            {canDelete && (
              <button type="button" className="w-full sm:w-auto rounded-2xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50" onClick={() => setDeleteModal({ open: true, type: 'request', item: request })}>
                Delete
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Travel receipts"
        subtitle={isApprover ? "Receipts uploaded by the employee for reimbursement." : "Upload receipts for reimbursement after your travel is approved."}
        actions={
          !isApprover && canUploadReceipt && (
            <button type="button" className="flex items-center gap-2 rounded-2xl bg-brand-gradient px-4 py-2 text-sm font-medium text-white" onClick={() => setUploadModal({ open: true, file: null, amount: '', description: '' })}>
              <Plus size={18} />
              Upload Receipt
            </button>
          )
        }
      >
        {!request.receipts || request.receipts.length === 0 ? (
          <EmptyState 
            title={isApprover ? "No receipts uploaded" : "No receipts uploaded"} 
            description={isApprover ? "The employee has not uploaded any receipts yet." : "Upload your travel receipts here for reimbursement processing."} 
          />
        ) : (
          <div className="space-y-3">
            {request.receipts && request.receipts.map((receipt) => {
              const receiptConfig = receiptStatusConfig[receipt.reimbursementStatus] || receiptStatusConfig.pending;
              return (
                <div key={receipt.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${receiptConfig.bgColor} ${receiptConfig.color}`}>
                          {receiptConfig.label}
                        </span>
                        <span className="text-sm text-slate-400 truncate">{receipt.fileName}</span>
                      </div>
                      {receipt.amount && (
                        <p className="mt-1 text-sm font-medium text-slate-900">Amount: {receipt.amount.toLocaleString()}</p>
                      )}
                      {receipt.description && (
                        <p className="mt-1 text-sm text-slate-600 break-words">{receipt.description}</p>
                      )}
                      {receipt.reviewComment && (
                        <p className="mt-1 text-sm text-slate-500 break-words">Review comment: {receipt.reviewComment}</p>
                      )}
                      <p className="mt-1 text-xs text-slate-400">Uploaded by {receipt.uploaderName}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => handlePreviewReceipt(receipt)} title="Preview">
                        <Eye size={16} />
                      </button>
                      <button type="button" className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" onClick={() => handleDownloadReceipt(receipt)} title="Download">
                        <Download size={16} />
                      </button>
                      {canUpdateReceiptStatus(user, receipt) && (
                        <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50" onClick={() => setStatusModal({ open: true, receipt, status: receipt.reimbursementStatus, comment: '' })}>
                          Update Status
                        </button>
                      )}
                      {user.role === 'admin' && (
                        <button type="button" className="rounded-xl border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" onClick={() => setDeleteModal({ open: true, type: 'receipt', item: receipt })}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {(!request.receipts || request.receipts.length === 0) && request.travelType === 'reimbursement' && (
              <EmptyState title="No receipts uploaded" description="Upload your travel receipts here for reimbursement processing." />
            )}
          </div>
        )}
      </SectionCard>

      {request.travelType === 'booking' && request.supportingDocumentId && (
        <SectionCard title="Supporting document" subtitle="Supporting document uploaded with this travel booking request.">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                    Attached
                  </span>
                  <span className="text-sm text-slate-400 truncate">Supporting document</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Uploaded with travel request</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  onClick={handlePreviewSupportingDocument}
                  title="Preview"
                >
                  <Eye size={16} />
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                  onClick={handleDownloadSupportingDocument}
                  title="Download"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
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
        open={cancelModal.open}
        title="Cancel Travel Request"
        description="Are you sure you want to cancel this travel request? This action cannot be undone."
        onClose={() => setCancelModal({ open: false })}
        actions={[
          <button key="cancel" type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => setCancelModal({ open: false })}>
            No, Keep Request
          </button>,
          <button key="confirm" type="button" className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700" onClick={handleCancel}>
            Yes, Cancel Request
          </button>
        ]}
      />

      <Modal
        open={uploadModal.open}
        title="Upload travel receipt"
        description="Upload a receipt for reimbursement processing."
        onClose={() => setUploadModal({ open: false, file: null, amount: '', description: '' })}
      >
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Receipt file</label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
              <Upload size={24} className="text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">Click to upload receipt</p>
                <p className="mt-1 text-xs text-slate-400">PDF, images, or other receipt files (max 10 MB)</p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setUploadModal({ ...uploadModal, file: e.target.files?.[0] || null })}
              />
            </label>
            {uploadModal.file && (
              <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <span>{uploadModal.file.name}</span>
                <button type="button" className="text-slate-500" onClick={() => setUploadModal({ ...uploadModal, file: null })}>
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Amount (optional)</label>
            <input type="number" className="bg-slate-50" placeholder="e.g., 5000" value={uploadModal.amount} onChange={(e) => setUploadModal({ ...uploadModal, amount: e.target.value })} />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Description (optional)</label>
            <textarea rows="3" className="bg-slate-50" placeholder="Describe this receipt..." value={uploadModal.description} onChange={(e) => setUploadModal({ ...uploadModal, description: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => setUploadModal({ open: false, file: null, amount: '', description: '' })}>
            Cancel
          </button>
          <button type="button" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white" onClick={handleUploadReceipt}>
            Upload Receipt
          </button>
        </div>
      </Modal>

      <Modal
        open={statusModal.open}
        title="Update receipt status"
        description={`Update the reimbursement status for ${statusModal.receipt?.fileName}.`}
        onClose={() => setStatusModal({ open: false, receipt: null, status: '', comment: '' })}
      >
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Status</label>
            <select value={statusModal.status} onChange={(e) => setStatusModal({ ...statusModal, status: e.target.value })}>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="settled">Settled</option>
              <option value="not_settled">Not Settled</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Review comment (optional)</label>
            <textarea rows="3" className="bg-slate-50" placeholder="Add a comment for this status update..." value={statusModal.comment} onChange={(e) => setStatusModal({ ...statusModal, comment: e.target.value })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => setStatusModal({ open: false, receipt: null, status: '', comment: '' })}>
            Cancel
          </button>
          <button type="button" className="rounded-2xl bg-brand-gradient px-5 py-3 text-sm font-semibold text-white" onClick={handleUpdateReceiptStatus}>
            Update Status
          </button>
        </div>
      </Modal>

      <Modal
        open={deleteModal.open}
        title={`Delete ${deleteModal.type === 'request' ? 'travel request' : 'receipt'}`}
        description={`Are you sure you want to permanently delete this ${deleteModal.type === 'request' ? 'travel request' : 'receipt'}? This action cannot be undone.`}
        onClose={() => setDeleteModal({ open: false, type: null, item: null })}
        actions={[
          <button key="cancel" type="button" className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700" onClick={() => setDeleteModal({ open: false, type: null, item: null })}>
            Cancel
          </button>,
          <button key="delete" type="button" className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white hover:bg-rose-700" onClick={deleteModal.type === 'request' ? handleDeleteRequest : handleDeleteReceipt}>
            Delete
          </button>
        ]}
      />
    </div>
  );
}
