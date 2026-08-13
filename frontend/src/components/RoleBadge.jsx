const styles = {
  employee: 'bg-emerald-50 text-emerald-700',
  supervisor: 'bg-cyan-50 text-cyan-700',
  admin: 'bg-purple-50 text-purple-700',
  ceo: 'bg-amber-50 text-amber-700',
  finance: 'bg-blue-50 text-blue-700'
};

export default function RoleBadge({ role, roleTitle }) {
  const labels = {
    employee: roleTitle || 'Employee',
    supervisor: 'Supervisor',
    admin: 'IT Officer',
    ceo: 'CEO',
    finance: 'Finance'
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${styles[role] || 'bg-slate-100 text-slate-700'}`}>
      {labels[role] || role}
    </span>
  );
}
