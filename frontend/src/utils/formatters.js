export const normalizeDateInput = (value) => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    const matched = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (matched) {
      return matched[1];
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
};

export const formatDateDisplay = (value) => {
  const normalized = normalizeDateInput(value);
  if (!normalized) {
    return '--/--/----';
  }

  const [year, month, day] = normalized.split('-');
  return `${day}/${month}/${year}`;
};

export const formatDateRangeDisplay = (startDate, endDate) => `${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}`;

export const formatDateTimeDisplay = (value) => {
  if (!value) {
    return 'Pending';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Pending';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
};

const statusLabels = {
  pending_supervisor: 'Pending Supervisor',
  pending_hr: 'Pending CEO',
  pending_ceo: 'Pending CEO',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

export const formatStatusLabel = (status) => statusLabels[status] || (status || '').replaceAll('_', ' ');
