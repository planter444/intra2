import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import { fetchAuditLogs } from '../services/auditService';

const formatKenyaTimestamp = (value) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Nairobi'
  }).format(date);
  const timePart = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Africa/Nairobi'
  }).format(date);

  return `${datePart} — (${timePart})`;
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchAuditLogs().then(setLogs).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="Critical actions are captured for traceability, accountability, and governance." />

      <SectionCard title="System activity trail" subtitle="IT Officer-only access to immutable action history.">
        <DataTable
          columns={[
            { key: 'createdAt', header: 'Timestamp', render: (row) => formatKenyaTimestamp(row.createdAt) },
            { key: 'actorName', header: 'Actor' },
            { key: 'actorRole', header: 'Role' },
            { key: 'action', header: 'Action' },
            { key: 'entityType', header: 'Entity' },
            { key: 'description', header: 'Description' }
          ]}
          rows={logs}
        />
      </SectionCard>
    </div>
  );
}
