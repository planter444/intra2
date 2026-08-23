const pendingStatuses = new Set(['pending_supervisor', 'pending_hr', 'pending_ceo']);

export const getReservedPendingDays = (requests, leaveTypeCode, excludeRequestId = null) => requests
  .filter((request) => pendingStatuses.has(request.status)
    && request.leaveTypeCode === leaveTypeCode
    && String(request.id) !== String(excludeRequestId || ''))
  .reduce((sum, request) => sum + Number(request.daysRequested || 0), 0);

export const getAvailableBalanceDays = (balance, requests, excludeRequestId = null) => {
  if (!balance) {
    return 0;
  }

  return Math.max(Number(balance.balanceDays || 0) - getReservedPendingDays(requests, balance.code, excludeRequestId), 0);
};

export const isLeaveRequestActionableByUser = (request, user) => {
  if (!request || !user) {
    return false;
  }

  if (user.role === 'supervisor') {
    return request.status === 'pending_supervisor' && String(request.supervisorApproverId) === String(user.id);
  }

  if (user.role === 'admin') {
    return request.status === 'pending_hr';
  }

  if (user.role === 'ceo') {
    return request.status === 'pending_ceo'
      || request.status === 'pending_hr'
      || (
        request.status === 'pending_supervisor'
        && (
          String(request.supervisorApproverId) === String(user.id)
          || String(request.employeeSupervisorId) === String(user.id)
        )
      );
  }

  return false;
};

export const getPendingReviewCount = (requests, user) => {
  if (!user) {
    return 0;
  }

  return requests.filter((request) => isLeaveRequestActionableByUser(request, user)).length;
};
