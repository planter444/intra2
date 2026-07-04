import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, Save, Trash2, Upload } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import {
  fetchTemplates,
  uploadTemplate,
  fetchTemplateFields,
  activateTemplate,
  deactivateTemplate,
  deleteTemplate,
  saveTemplateMapping,
  downloadTemplateBlob
} from '../services/payslipService';

export default function PayslipTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [mappingTemplateId, setMappingTemplateId] = useState(null);
  const [fields, setFields] = useState([]);
  const [dataKeys, setDataKeys] = useState([]);
  const [fieldMap, setFieldMap] = useState({});
  const [savingMap, setSavingMap] = useState(false);
  const fileInputRef = useRef(null);

  const notify = (type, text) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 7000);
  };

  const loadTemplates = () => {
    setLoading(true);
    fetchTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }
    try {
      setUploading(true);
      const result = await uploadTemplate(file);
      notify('success', `Template v${result.template.version} uploaded and activated. ${result.fields.length} form fields detected; mapping auto-filled where field names matched.`);
      loadTemplates();
      openMapping(result.template.id);
    } catch (error) {
      notify('error', error.response?.data?.message || 'Unable to upload template.');
    } finally {
      setUploading(false);
    }
  };

  const openMapping = async (templateId) => {
    try {
      const data = await fetchTemplateFields(templateId);
      setMappingTemplateId(templateId);
      setFields(data.fields);
      setDataKeys(data.dataKeys);
      setFieldMap(data.fieldMap || {});
    } catch (error) {
      notify('error', 'Unable to load template fields.');
    }
  };

  const handleSaveMapping = async () => {
    try {
      setSavingMap(true);
      await saveTemplateMapping(mappingTemplateId, fieldMap);
      notify('success', 'Field mapping saved.');
      loadTemplates();
    } catch (error) {
      notify('error', error.response?.data?.message || 'Unable to save mapping.');
    } finally {
      setSavingMap(false);
    }
  };

  const handleActivate = async (templateId) => {
    try {
      await activateTemplate(templateId);
      notify('success', 'Template activated.');
      loadTemplates();
    } catch (error) {
      notify('error', 'Unable to activate template.');
    }
  };

  const handleDeactivate = async (templateId) => {
    try {
      await deactivateTemplate(templateId);
      notify('success', 'Template deactivated. Payslip generation is paused until a template is activated.');
      loadTemplates();
    } catch (error) {
      notify('error', 'Unable to deactivate template.');
    }
  };

  const handleDelete = async (templateId, version) => {
    if (!window.confirm(`Delete template v${version}? This cannot be undone. Payslips already generated with it are kept.`)) {
      return;
    }
    try {
      await deleteTemplate(templateId);
      notify('success', `Template v${version} deleted.`);
      if (mappingTemplateId === templateId) {
        setMappingTemplateId(null);
      }
      loadTemplates();
    } catch (error) {
      notify('error', error.response?.data?.message || 'Unable to delete template.');
    }
  };

  const previewTemplate = async (templateId) => {
    try {
      const blob = await downloadTemplateBlob(templateId);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (error) {
      notify('error', 'Unable to preview template.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payslip Template Management"
        subtitle="Upload the official payslip PDF, map its form fields to payroll data, and manage version history. The design of the PDF is never modified — only the field values are filled."
      />

      {message ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {message.text}
        </div>
      ) : null}

      <SectionCard
        title="Upload official template"
        subtitle="The PDF must contain fillable form fields where the dynamic values go. Uploading a new template creates a new version and activates it automatically. No code changes are required."
      >
        <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleUpload} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Upload PDF template'}
        </button>
      </SectionCard>

      <SectionCard title="Version history" subtitle="Only one template is active at a time. Older versions are kept and can be re-activated.">
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-500">Loading templates...</p>
        ) : templates.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No template uploaded yet. Upload the official payslip PDF to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Mapped fields</th>
                  <th className="px-3 py-2">Uploaded</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-900">v{template.version}</td>
                    <td className="px-3 py-3">{template.fileName}</td>
                    <td className="px-3 py-3">{Object.values(template.fieldMap || {}).filter(Boolean).length}</td>
                    <td className="px-3 py-3 text-slate-500">{new Date(template.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-3">
                      {template.isActive ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 size={12} /> Active
                          </span>
                          <button type="button" onClick={() => handleDeactivate(template.id)} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                            Deactivate
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => handleActivate(template.id)} className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          Activate
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" title="Preview" onClick={() => previewTemplate(template.id)} className="rounded-xl bg-slate-100 p-2 text-slate-700">
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => openMapping(template.id)}
                          className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"
                        >
                          Map fields
                        </button>
                        <button
                          type="button"
                          title="Delete version"
                          onClick={() => handleDelete(template.id, template.version)}
                          className="rounded-xl bg-rose-50 p-2 text-rose-600"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {mappingTemplateId ? (
        <SectionCard
          title="Field mapping"
          subtitle="Link each form field found inside the PDF to a payroll data column. Fields left unmapped keep whatever is in the template."
        >
          {fields.length === 0 ? (
            <p className="text-sm text-slate-500">No form fields found in this PDF.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.name} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700" title={field.name}>{field.name}</span>
                    <select
                      value={fieldMap[field.name] || ''}
                      onChange={(event) => setFieldMap((current) => ({ ...current, [field.name]: event.target.value || undefined }))}
                      className="w-52 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <option value="">Not mapped</option>
                      {dataKeys.map((entry) => (
                        <option key={entry.key} value={entry.key}>{entry.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveMapping}
                  disabled={savingMap}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                >
                  <Save size={16} />
                  {savingMap ? 'Saving...' : 'Save mapping'}
                </button>
              </div>
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}
