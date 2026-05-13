import api from './api';

const notifyDocumentUpdates = () => window.dispatchEvent(new Event('documents-seen-updated'));
const getCurrentAuthToken = () => {
  const header = String(api.defaults.headers.common.Authorization || '');
  const tokenFromHeader = header.replace(/^Bearer\s+/i, '');
  if (tokenFromHeader) {
    return tokenFromHeader;
  }
  try {
    const saved = JSON.parse(localStorage.getItem('kerea_hrms_auth') || 'null');
    return saved?.token || '';
  } catch {
    return '';
  }
};
export const getDocumentUrl = (documentId, preview = false) => {
  const baseUrl = `${String(api.defaults.baseURL || '').replace(/\/$/, '')}/documents/${documentId}/download`;
  const params = new URLSearchParams();
  const token = getCurrentAuthToken();

  if (preview) {
    params.set('preview', 'true');
  }

  if (token) {
    params.set('token', token);
  }

  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
};

export const fetchDocuments = async (params = {}) => {
  const { data } = await api.get('/documents', { params });
  return data.documents;
};

export const uploadDocument = async ({ file, userId, folderType }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folderType', folderType);

  if (userId) {
    formData.append('userId', userId);
  }

  const { data } = await api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });

  notifyDocumentUpdates();

  return data.document;
};

const getFilenameFromDisposition = (contentDisposition) => {
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);
  return match?.[1] || 'document';
};

const normalizeDocumentRequestError = async (error) => {
  const responseData = error.response?.data;
  if (responseData instanceof Blob) {
    const text = await responseData.text();

    try {
      const payload = JSON.parse(text);
      if (payload?.message) {
        error.message = payload.message;
      }
    } catch {
      if (text) {
        error.message = text;
      }
    }
  } else if (error.response?.data?.message) {
    error.message = error.response.data.message;
  }

  throw error;
};

export const fetchDocumentBlob = async (documentId, preview = false) => {
  const { data, headers } = await api.get(`/documents/${documentId}/download${preview ? '?preview=true' : ''}`, {
    responseType: 'blob'
  }).catch(normalizeDocumentRequestError);

  return {
    blob: data,
    filename: getFilenameFromDisposition(headers['content-disposition'])
  };
};

export const previewDocument = async (documentId) => {
  window.location.assign(getDocumentUrl(documentId, true));
};

export const openDocumentInNewTab = (documentId) => {
  window.open(getDocumentUrl(documentId, true), '_blank', 'noopener,noreferrer');
};

export const downloadDocument = async (documentId) => {
  const { blob, filename } = await fetchDocumentBlob(documentId, false);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
};

export const deleteDocument = async (documentId) => {
  const { data } = await api.delete(`/documents/${documentId}`);
  notifyDocumentUpdates();
  return data;
};
