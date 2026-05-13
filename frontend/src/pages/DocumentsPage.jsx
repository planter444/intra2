import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Trash2, X } from 'lucide-react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { useAuth } from '../context/AuthContext';
import useUnsavedChangesGuard from '../hooks/useUnsavedChangesGuard';
import { fetchUsers } from '../services/userService';
import { deleteDocument, downloadDocument, fetchDocumentBlob, fetchDocuments, openDocumentInNewTab, uploadDocument } from '../services/documentService';

const SEEN_DOCUMENT_IDS_KEY = 'kerea_hrms_seen_document_ids';
const getSeenDocumentIdsStorageKey = (userId) => `${SEEN_DOCUMENT_IDS_KEY}_${userId}`;

const getDocumentTypeLabel = (document) => {
  const extension = document.fileName?.split('.').pop()?.trim();
  if (extension) {
    return extension.toUpperCase();
  }

  const subtype = document.mimeType?.split('/').pop()?.split('.').pop();
  return subtype ? subtype.toUpperCase() : 'FILE';
};

const formatDocumentSizeMb = (size) => `${Math.max(1, Math.round(Number(size || 0) / (1024 * 1024) || 0))} MB`;
const createEmptyPreviewState = () => ({ open: false, loading: false, objectUrl: '', fileName: '', mimeType: '', documentId: '', error: '' });

// Extract custom category/label if the filename starts with a tag like: [Category - Label] OriginalName.ext
const parseCustomLabelFromFileName = (fileName = '') => {
  const match = String(fileName || '').match(/^\[([^\]-]+)\s*-\s*([^\]]+)\]\s*/);
  if (!match) return null;
  return { category: match[1].trim(), label: match[2].trim() };
};

const isAddendumDocument = (document) => String(document?.folderType || '').trim().toLowerCase() === 'addendum';
const isEmploymentDocument = (document) => {
  const normalized = String(document?.folderType || '').trim().toLowerCase();
  return normalized === 'employment' || ['offer_letter', 'contract', 'warning'].includes(normalized);
};
const isRestrictedDocument = (document) => isAddendumDocument(document) || isEmploymentDocument(document);

const getDocumentDisplayLabel = (document, folderLabelMap) => {
  const parsed = ['other', 'addendum'].includes(String(document?.folderType || '').trim().toLowerCase())
    ? parseCustomLabelFromFileName(document?.fileName)
    : null;

  if (parsed) {
    return `${parsed.category} · ${parsed.label}`;
  }

  return folderLabelMap[document?.folderType] || document?.folderType;
};

export default function DocumentsPage() {
  const { user, settings } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState('success');
  const [uploadState, setUploadState] = useState({ folderType: 'id', folderCategoryCode: '', folderLabelCode: '', customCategoryText: '', customLabelText: '', userId: '', employeeName: '', file: null });
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [seenDocumentIds, setSeenDocumentIds] = useState([]);
  const [seenIdsReady, setSeenIdsReady] = useState(user.role !== 'ceo');
  const [previewState, setPreviewState] = useState(createEmptyPreviewState);
  const [isUploading, setIsUploading] = useState(false);
  const canManageEmployeeDocuments = ['ceo', 'admin'].includes(user.role);
  const canManageRestrictedDocuments = ['ceo', 'admin'].includes(user.role);
  const canAddDocumentAddendums = canManageRestrictedDocuments;
  const folderOptions = useMemo(
    () => (settings?.folders || []).filter((folder) => folder?.code && folder?.label),
    [settings?.folders]
  );
  const documentCategories = useMemo(() => settings?.documentCategories || [], [settings?.documentCategories]);
  const uploadCategories = useMemo(
    () => documentCategories.filter((category) => {
      const code = String(category?.code || '').trim().toLowerCase();
      if (code === 'addendum') {
        return canManageRestrictedDocuments;
      }
      if (code === 'employment') {
        return canManageRestrictedDocuments;
      }
      return true;
    }),
    [canManageRestrictedDocuments, documentCategories]
  );
  const folderLabelMap = useMemo(() => {
    const map = new Map();
    (settings?.folders || []).forEach((f) => { if (f?.code) map.set(f.code, f.label || f.code); });
    (settings?.documentCategories || []).forEach((cat) => {
      (cat?.types || []).forEach((t) => { if (t?.code) map.set(t.code, t.label || t.code); });
    });
    return Object.fromEntries(map);
  }, [settings?.folders, settings?.documentCategories]);

  useUnsavedChangesGuard(Boolean(uploadState.file || uploadState.employeeName || uploadState.userId));

  useEffect(() => {
    const defaultCategory = (uploadCategories[0]?.code) || '';
    if (!uploadState.folderCategoryCode) {
      setUploadState((c) => ({ ...c, folderCategoryCode: defaultCategory, folderLabelCode: (uploadCategories[0]?.types?.[0]?.code) || '' }));
    }
  }, [uploadCategories, uploadState.folderCategoryCode]);

  const employeeMatch = useMemo(
    () => employees.find((employee) => employee.fullName.toLowerCase() === uploadState.employeeName.trim().toLowerCase()),
    [employees, uploadState.employeeName]
  );

  const loadDocuments = async () => {
    const results = await fetchDocuments();
    setDocuments(results);
  };

  useEffect(() => {
    loadDocuments().catch(console.error);
  }, [user.role]);

  useEffect(() => {
    if (!canManageEmployeeDocuments) {
      return;
    }

    fetchUsers()
      .then((results) => setEmployees(results.filter((employee) => employee.isActive && !employee.isDeleted && employee.role !== 'ceo')))
      .catch(console.error);
  }, [canManageEmployeeDocuments]);

  useEffect(() => {
    if (user.role !== 'ceo') {
      setSeenIdsReady(true);
      return;
    }

    const scopedKey = getSeenDocumentIdsStorageKey(user.id);
    const scopedSeenIds = JSON.parse(localStorage.getItem(scopedKey) || 'null');
    const legacySeenIds = JSON.parse(localStorage.getItem(SEEN_DOCUMENT_IDS_KEY) || '[]');
    const nextSeenIds = Array.isArray(scopedSeenIds) ? scopedSeenIds : legacySeenIds;
    setSeenDocumentIds(nextSeenIds.map(String));
    setSeenIdsReady(true);
  }, [user.id, user.role]);

  useEffect(() => {
    if (user.role !== 'ceo' || !seenIdsReady) {
      return;
    }

    localStorage.setItem(getSeenDocumentIdsStorageKey(user.id), JSON.stringify(seenDocumentIds));
    window.dispatchEvent(new Event('documents-seen-updated'));
  }, [seenDocumentIds, seenIdsReady, user.id, user.role]);

  useEffect(() => () => {
    if (previewState.objectUrl) {
      URL.revokeObjectURL(previewState.objectUrl);
    }
  }, [previewState.objectUrl]);

  const handleUpload = async (event) => {
    event.preventDefault();
    if (!uploadState.file) {
      return;
    }

    if (canManageEmployeeDocuments && uploadState.employeeName && !employeeMatch) {
      setMessageTone('error');
      setMessage('Select an employee from the employee-name list before uploading.');
      return;
    }

    setIsUploading(true);
    try {
      // Resolve final folderType from selected label or fall back to 'other'
      const selectedCategory = documentCategories.find((c) => c.code === uploadState.folderCategoryCode);
      const selectedType = (selectedCategory?.types || []).find((t) => t.code === uploadState.folderLabelCode);
      const isAddendumSelection = uploadState.folderCategoryCode === 'addendum';
      const finalFolderType = isAddendumSelection ? 'addendum' : (selectedType?.code || 'other');

      if (isEmploymentDocument({ folderType: finalFolderType }) && !canManageRestrictedDocuments) {
        setMessageTone('error');
        setMessage('Only CEO and IT Officer can upload employment documents.');
        return;
      }

      if (!canAddDocumentAddendums && (uploadState.folderCategoryCode === '__other' || uploadState.folderLabelCode === '__otherLabel' || finalFolderType === 'other')) {
        setMessageTone('error');
        setMessage('Only CEO and IT Officer can create custom folder-type or label addendums.');
        return;
      }

      if (isAddendumSelection && !canAddDocumentAddendums) {
        setMessageTone('error');
        setMessage('Only CEO and IT Officer can create addendums.');
        return;
      }

      // If uploading to 'Other', embed the custom labels in the filename for display later
      const needsCustomTags = (finalFolderType === 'other' && (uploadState.customCategoryText || uploadState.customLabelText))
        || (finalFolderType === 'addendum' && uploadState.customLabelText);
      const sendFile = needsCustomTags
        ? new File([uploadState.file], `[${(finalFolderType === 'addendum' ? 'Addendum' : (uploadState.customCategoryText || 'Other')).trim()} - ${(uploadState.customLabelText || (finalFolderType === 'addendum' ? 'Addendum' : 'Other')).trim()}] ${uploadState.file.name}`.trim(), { type: uploadState.file.type })
        : uploadState.file;

      await uploadDocument({
        file: sendFile,
        folderType: finalFolderType,
        userId: (canManageEmployeeDocuments && selectedEmployeeId) ? selectedEmployeeId : (uploadState.userId || employeeMatch?.id || undefined)
      });
      setMessageTone('success');
      setMessage('Document uploaded successfully.');
      setUploadState((current) => ({
        ...current,
        file: null,
        employeeName: '',
        userId: '',
        folderCategoryCode: (uploadCategories[0]?.code) || current.folderCategoryCode,
        folderLabelCode: (uploadCategories[0]?.types?.[0]?.code) || '',
        customCategoryText: '',
        customLabelText: ''
      }));
      event.target.reset();
      await loadDocuments();
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to upload this document right now.');
    } finally {
      setIsUploading(false);
    }
  };

  const visibleDocuments = useMemo(
    () => documents
      .filter((doc) => doc.folderType !== 'profile' && doc.folderType !== 'branding')
      .map((document) => ({
        ...document,
        isNew: user.role === 'ceo'
          ? seenIdsReady && String(document.uploadedBy) !== String(user.id) && !seenDocumentIds.map(String).includes(String(document.id))
          : false
      })).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
    [documents, seenDocumentIds, seenIdsReady, user.id, user.role]
  );

  const allFolderRows = useMemo(() => {
    if (!canManageEmployeeDocuments) {
      return [];
    }

    const grouped = visibleDocuments.reduce((accumulator, document) => {
      const key = String(document.userId);
      if (!accumulator[key]) {
        accumulator[key] = {
          id: key,
          userId: document.userId,
          employeeName: document.employeeName || 'Employee',
          employeeNo: document.employeeNo || 'No employee number',
          totalSize: 0,
          documentCount: 0,
          newCount: 0,
          documentIds: []
        };
      }

      accumulator[key].totalSize += Number(document.fileSize || 0);
      accumulator[key].documentCount += 1;
      accumulator[key].newCount += document.isNew ? 1 : 0;
      accumulator[key].documentIds.push(String(document.id));
      return accumulator;
    }, {});

    return Object.values(grouped).sort((left, right) => {
      if (right.newCount !== left.newCount) {
        return right.newCount - left.newCount;
      }

      return left.employeeName.localeCompare(right.employeeName);
    });
  }, [canManageEmployeeDocuments, visibleDocuments]);

  const folderRows = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    if (!searchValue) {
      return allFolderRows;
    }

    return allFolderRows.filter((row) => row.employeeName.toLowerCase().includes(searchValue) || row.employeeNo.toLowerCase().includes(searchValue));
  }, [allFolderRows, search]);

  const selectedFolder = useMemo(
    () => allFolderRows.find((row) => String(row.userId) === String(selectedEmployeeId)) || null,
    [allFolderRows, selectedEmployeeId]
  );

  const selectedFolderDocuments = useMemo(
    () => visibleDocuments.filter((document) => String(document.userId) === String(selectedEmployeeId)),
    [selectedEmployeeId, visibleDocuments]
  );
  const documentsByCategory = useMemo(() => {
    const map = new Map();
    documentCategories.forEach((cat) => map.set(cat.code, []));
    selectedFolderDocuments.forEach((doc) => {
      const found = documentCategories.find((cat) => (cat.types || []).some((t) => t.code === doc.folderType));
      const key = found ? found.code : 'uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(doc);
    });
    return map;
  }, [documentCategories, selectedFolderDocuments]);

  // Group current user's documents by category as well
  const myDocumentsByCategory = useMemo(() => {
    if (canManageEmployeeDocuments) return new Map();
    const map = new Map();
    documentCategories.forEach((cat) => map.set(cat.code, []));
    visibleDocuments.forEach((doc) => {
      const found = documentCategories.find((cat) => (cat.types || []).some((t) => t.code === doc.folderType));
      const key = found ? found.code : 'uncategorized';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(doc);
    });
    return map;
  }, [canManageEmployeeDocuments, documentCategories, visibleDocuments]);

  // When leaving the Documents page, mark all visible documents as seen for CEO
  useEffect(() => () => {
    if (user.role !== 'ceo') return;
    const scopedKey = getSeenDocumentIdsStorageKey(user.id);
    const existing = JSON.parse(localStorage.getItem(scopedKey) || '[]');
    const union = [...new Set([...existing.map(String), ...visibleDocuments.map((d) => String(d.id))])];
    localStorage.setItem(scopedKey, JSON.stringify(union));
    window.dispatchEvent(new Event('documents-seen-updated'));
  }, [user.id, user.role, visibleDocuments]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      return;
    }

    const hasVisibleDocuments = visibleDocuments.some((document) => String(document.userId) === String(selectedEmployeeId));
    if (!hasVisibleDocuments) {
      setSelectedEmployeeId('');
    }
  }, [selectedEmployeeId, visibleDocuments]);

  const handleDelete = async (document) => {
    if (isRestrictedDocument(document) && !canManageRestrictedDocuments) {
      setMessageTone('error');
      setMessage('Only CEO and IT Officer can delete documents in this folder type.');
      return;
    }

    if (!window.confirm(`Delete ${document.fileName}?`)) {
      return;
    }

    try {
      await deleteDocument(document.id);
      setMessageTone('success');
      setMessage('Document deleted successfully.');
      await loadDocuments();
    } catch (error) {
      setMessageTone('error');
      setMessage(error.response?.data?.message || 'Unable to delete this document right now.');
    }
  };

  const closePreview = () => {
    setPreviewState((current) => {
      if (current.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }

      return createEmptyPreviewState();
    });
  };

  const handlePreview = async (document) => {
    // Mark this document as seen for CEO when previewing
    if (user.role === 'ceo') {
      setSeenDocumentIds((current) => [...new Set([...current.map(String), String(document.id)])]);
    }
    setPreviewState((current) => {
      if (current.objectUrl) {
        URL.revokeObjectURL(current.objectUrl);
      }

      return {
        open: true,
        loading: true,
        objectUrl: '',
        fileName: document.fileName,
        mimeType: document.mimeType,
        documentId: document.id,
        error: ''
      };
    });

    try {
      const { blob } = await fetchDocumentBlob(document.id, true);
      const objectUrl = URL.createObjectURL(blob);
      setPreviewState({
        open: true,
        loading: false,
        objectUrl,
        fileName: document.fileName,
        mimeType: blob.type || document.mimeType,
        documentId: document.id,
        error: ''
      });
    } catch (error) {
      setPreviewState({
        open: true,
        loading: false,
        objectUrl: '',
        fileName: document.fileName,
        mimeType: document.mimeType,
        documentId: document.id,
        error: error.message || 'Unable to preview this document right now.'
      });
    }
  };

  const handleDownload = async (documentId) => {
    try {
      await downloadDocument(documentId);
    } catch (error) {
      setMessageTone('error');
      setMessage(error.message || 'Unable to download this document right now.');
    }
  };

  const handleOpenDocument = (documentId) => {
    if (user.role === 'ceo') {
      setSeenDocumentIds((current) => [...new Set([...current.map(String), String(documentId)])]);
    }
    openDocumentInNewTab(documentId);
  };

  const previewIsImage = previewState.mimeType.startsWith('image/');
  const previewIsPdf = previewState.mimeType === 'application/pdf';
  const previewIsVideo = previewState.mimeType.startsWith('video/');

  return (
    <div className="space-y-6">
      <PageHeader
        title={settings?.labels?.documentsModuleTitle || 'Document Center'}
        subtitle={settings?.labels?.documentsSubtitle || 'Structured employee folders are secured behind authenticated download and preview endpoints.'}
      />

      {message ? <div className={`rounded-2xl px-4 py-3 text-sm ${messageTone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{message}</div> : null}

      <div className="space-y-6">
        <SectionCard title="Upload document" subtitle={`Folder types: ${(documentCategories.length ? documentCategories.map((c) => c.label).join(', ') : 'No folder types configured yet')}.`}>
          <form className="space-y-4" onSubmit={handleUpload}>
            {canManageEmployeeDocuments ? (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Employee name</label>
                <input list="employee-document-options" placeholder="Search employee by name" value={uploadState.employeeName} onChange={(event) => setUploadState((current) => ({ ...current, employeeName: event.target.value, userId: employees.find((employee) => employee.fullName.toLowerCase() === event.target.value.trim().toLowerCase())?.id || '' }))} />
                <datalist id="employee-document-options">
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.fullName}>{employee.employeeNo || employee.email}</option>
                  ))}
                </datalist>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Folder type</label>
                <select value={uploadState.folderCategoryCode} onChange={(e) => {
                  const nextCode = e.target.value;
                  if (nextCode === '__other') {
                    if (!canAddDocumentAddendums) {
                      return;
                    }
                    setUploadState((c) => ({ ...c, folderCategoryCode: nextCode, folderLabelCode: '__otherLabel' }));
                    return;
                  }
                  const firstType = (uploadCategories.find((c) => c.code === nextCode)?.types || [])[0]?.code || '';
                  setUploadState((c) => ({ ...c, folderCategoryCode: nextCode, folderLabelCode: firstType, customCategoryText: nextCode === 'addendum' ? 'Addendum' : '', customLabelText: '' }));
                }}>
                  {uploadCategories.map((cat) => (
                    <option key={cat.code} value={cat.code}>{cat.label}</option>
                  ))}
                  {canAddDocumentAddendums ? <option value="__other">Other…</option> : null}
                </select>
                {uploadState.folderCategoryCode === '__other' ? (
                  <input className="mt-2" placeholder="Enter folder type" value={uploadState.customCategoryText} onChange={(e) => setUploadState((c) => ({ ...c, customCategoryText: e.target.value }))} />
                ) : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Label</label>
                {uploadState.folderCategoryCode === 'addendum' ? (
                  <input placeholder="Enter addendum label" value={uploadState.customLabelText} onChange={(e) => setUploadState((c) => ({ ...c, folderLabelCode: 'addendum', customLabelText: e.target.value }))} />
                ) : (
                  <select value={uploadState.folderLabelCode} onChange={(e) => {
                    if (e.target.value === '__otherLabel' && !canAddDocumentAddendums) {
                      return;
                    }
                    setUploadState((c) => ({ ...c, folderLabelCode: e.target.value }));
                  }}>
                    {(uploadCategories.find((c) => c.code === uploadState.folderCategoryCode)?.types || []).map((t) => (
                      <option key={t.code} value={t.code}>{t.label}</option>
                    ))}
                    {canAddDocumentAddendums ? <option value="__otherLabel">Other…</option> : null}
                  </select>
                )}
                {uploadState.folderLabelCode === '__otherLabel' ? (
                  <input className="mt-2" placeholder="Enter label" value={uploadState.customLabelText} onChange={(e) => setUploadState((c) => ({ ...c, customLabelText: e.target.value }))} />
                ) : null}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">File</label>
              <input type="file" onChange={(event) => setUploadState((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
            </div>
            <button type="submit" disabled={isUploading} className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${isUploading ? 'bg-slate-400' : 'bg-brand-gradient'}`}>
              {isUploading ? 'Uploading…' : (canManageEmployeeDocuments && selectedEmployeeId ? 'Upload document to employee' : 'Upload document')}
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Document repository" subtitle={canManageEmployeeDocuments ? (selectedFolder ? `Viewing all documents stored for ${selectedFolder.employeeName}.` : 'Open an employee folder to review the documents inside it.') : 'Preview, download, or open your own documents in a new tab.'}>
          {canManageEmployeeDocuments ? (
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-slate-700">Search employee documents</label>
              <input placeholder="Search by employee name" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          ) : null}
          {canManageEmployeeDocuments && !selectedFolder ? (
            <DataTable
              columns={[
                {
                  key: 'employeeName',
                  header: 'Employee',
                  render: (row) => (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{row.employeeName}</p>
                        {row.newCount ? <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">+{row.newCount} new</span> : null}
                      </div>
                      <p className="text-xs uppercase tracking-wide text-slate-400">{row.employeeNo}</p>
                    </div>
                  )
                },
                { key: 'totalSize', header: 'Folder Size', render: (row) => formatDocumentSizeMb(row.totalSize) },
                { key: 'documentCount', header: 'Documents' },
                {
                  key: 'actions',
                  header: 'Actions',
                  render: (row) => (
                    <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700" onClick={() => setSelectedEmployeeId(String(row.userId))}>
                      <Eye size={14} />View
                    </button>
                  )
                }
              ]}
              rows={folderRows}
              emptyLabel="No employee folders found."
            />
          ) : (
            <div className="space-y-4">
              {canManageEmployeeDocuments ? (
                <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => setSelectedEmployeeId('')}>
                  <ArrowLeft size={16} />Back to employee folders
                </button>
              ) : null}
              <DataTable
                columns={[
                  {
                    key: 'fileName',
                    header: 'Document type',
                    render: (row) => (
                      <div className={row.isNew ? `rounded-2xl px-3 py-2 ${isAddendumDocument(row) ? 'bg-rose-50' : 'bg-amber-50'}` : isAddendumDocument(row) ? 'rounded-2xl border border-rose-100 bg-rose-50/70 px-3 py-2' : ''}>
                        <p className={`font-medium ${isAddendumDocument(row) ? 'text-rose-700' : 'text-slate-900'}`}>{getDocumentDisplayLabel(row, folderLabelMap)}</p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{row.fileName}</p>
                      </div>
                    )
                  },
                  { key: 'mimeType', header: 'Type', render: (row) => getDocumentTypeLabel(row) },
                  { key: 'fileSize', header: 'Size', render: (row) => formatDocumentSizeMb(row.fileSize) },
                  { key: 'isNew', header: 'Status', render: (row) => row.isNew ? <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">New</span> : <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Seen</span> },
                  {
                    key: 'actions',
                    header: 'Actions',
                    render: (row) => (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700" onClick={(event) => {
                          event.stopPropagation();
                          handlePreview(row);
                        }}>
                          Preview
                        </button>
                        <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700" onClick={(event) => {
                          event.stopPropagation();
                          handleDownload(row.id);
                        }}>
                          Download
                        </button>
                        {(canManageEmployeeDocuments || (String(row.userId) === String(user.id) && (!isRestrictedDocument(row) || canManageRestrictedDocuments))) ? (
                          <button type="button" className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700" onClick={(event) => {
                            event.stopPropagation();
                            handleDelete(row);
                          }}>
                            <Trash2 size={12} />Delete
                          </button>
                        ) : null}
                      </div>
                    )
                  }
                ]}
                rows={canManageEmployeeDocuments ? selectedFolderDocuments : visibleDocuments}
                getRowProps={(row) => ({
                  onClick: () => handleOpenDocument(row.id),
                  className: `cursor-pointer transition ${isAddendumDocument(row) ? 'hover:bg-rose-50/70' : 'hover:bg-slate-50'}`
                })}
                emptyLabel={canManageEmployeeDocuments ? 'No documents were found in this folder.' : 'No documents found.'}
              />
              {canManageEmployeeDocuments ? (
                <div className="space-y-6">
                  {Array.from(documentsByCategory.entries()).map(([catCode, docs]) => {
                    const cat = documentCategories.find((c) => c.code === catCode);
                    if (!docs.length) return null;
                    return (
                      <div key={catCode} className={`rounded-3xl bg-white p-4 shadow-soft ${catCode === 'addendum' ? 'border border-rose-200' : 'border border-slate-200'}`}>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className={`text-base font-semibold ${catCode === 'addendum' ? 'text-rose-700' : 'text-slate-900'}`}>{cat ? cat.label : 'Other Documents'}</h4>
                          <span className="text-xs text-slate-500">{docs.length} item(s)</span>
                        </div>
                        <DataTable
                          columns={[
                            { key: 'type', header: 'Type', render: (row) => <span className={isAddendumDocument(row) ? 'font-medium text-rose-700' : ''}>{getDocumentDisplayLabel(row, folderLabelMap)}</span> },
                            { key: 'size', header: 'Size', render: (row) => formatDocumentSizeMb(row.fileSize) },
                            { key: 'createdAt', header: 'Uploaded', render: (row) => new Date(row.createdAt).toLocaleDateString() },
                            { key: 'actions', header: 'Actions', render: (row) => (
                              <div className="flex flex-wrap gap-2">
                                <button type="button" className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700" onClick={(e) => { e.stopPropagation(); handlePreview(row); }}>Preview</button>
                                <button type="button" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700" onClick={(e) => { e.stopPropagation(); handleDownload(row.id); }}>Download</button>
                              </div>
                            ) }
                          ]}
                          rows={docs}
                          getRowProps={(row) => ({ onClick: () => handleOpenDocument(row.id), className: `cursor-pointer transition ${isAddendumDocument(row) ? 'hover:bg-rose-50/70' : 'hover:bg-slate-50'}` })}
                          emptyLabel="No documents in this category."
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-6">
                  {Array.from(myDocumentsByCategory.entries()).map(([catCode, docs]) => {
                    const cat = documentCategories.find((c) => c.code === catCode);
                    if (!docs.length) return null;
                    return (
                      <div key={catCode} className={`rounded-3xl bg-white p-4 shadow-soft ${catCode === 'addendum' ? 'border border-rose-200' : 'border border-slate-200'}`}>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className={`text-base font-semibold ${catCode === 'addendum' ? 'text-rose-700' : 'text-slate-900'}`}>{cat ? cat.label : 'Other Documents'}</h4>
                          <span className="text-xs text-slate-500">{docs.length} item(s)</span>
                        </div>
                        <DataTable
                          columns={[
                            { key: 'type', header: 'Type', render: (row) => <span className={isAddendumDocument(row) ? 'font-medium text-rose-700' : ''}>{getDocumentDisplayLabel(row, folderLabelMap)}</span> },
                            { key: 'size', header: 'Size', render: (row) => formatDocumentSizeMb(row.fileSize) },
                            { key: 'createdAt', header: 'Uploaded', render: (row) => new Date(row.createdAt).toLocaleDateString() }
                          ]}
                          rows={docs}
                          getRowProps={(row) => ({ onClick: () => handleOpenDocument(row.id), className: `cursor-pointer transition ${isAddendumDocument(row) ? 'hover:bg-rose-50/70' : 'hover:bg-slate-50'}` })}
                          emptyLabel="No documents in this category."
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {previewState.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onClick={closePreview}>
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-slate-900">Preview</h3>
                <p className="truncate text-sm text-slate-500">{previewState.fileName}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700" onClick={() => handleDownload(previewState.documentId)}>
                  Download
                </button>
                <button type="button" className="rounded-xl border border-slate-200 p-2 text-slate-600" onClick={closePreview} aria-label="Close preview">
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 sm:p-5">
              {previewState.loading ? (
                <div className="flex h-[70vh] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">Loading preview...</div>
              ) : previewState.error ? (
                <div className="flex h-[70vh] flex-col items-center justify-center rounded-3xl border border-dashed border-rose-200 bg-white px-6 text-center text-sm text-rose-700">
                  <p>{previewState.error}</p>
                </div>
              ) : previewIsImage ? (
                <div className="flex min-h-[70vh] items-center justify-center rounded-3xl bg-white p-4">
                  <img src={previewState.objectUrl} alt={previewState.fileName} className="max-h-[78vh] max-w-full rounded-2xl object-contain" />
                </div>
              ) : previewIsPdf ? (
                <iframe title={previewState.fileName} src={previewState.objectUrl} className="h-[78vh] w-full rounded-3xl border border-slate-200 bg-white" />
              ) : previewIsVideo ? (
                <div className="flex min-h-[70vh] items-center justify-center rounded-3xl bg-white p-4">
                  <video src={previewState.objectUrl} controls className="max-h-[78vh] w-full rounded-2xl bg-black" />
                </div>
              ) : (
                <div className="flex h-[70vh] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center text-sm text-slate-500">
                  <p>This file type cannot be shown inside the popup preview.</p>
                  <p className="mt-2">Use Download or open the row in a new tab.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
