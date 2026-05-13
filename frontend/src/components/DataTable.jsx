export default function DataTable({ columns, rows, emptyLabel = 'No records found.', getRowProps }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200">
      <div className="w-full overflow-x-auto">
        <table className="min-w-[760px] divide-y divide-slate-200 text-sm lg:min-w-full">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length ? (
              rows.map((row, index) => {
                const rowProps = getRowProps ? (getRowProps(row, index) || {}) : {};
                const rowClassName = rowProps.className ? `align-top ${rowProps.className}` : 'align-top';

                return (
                <tr key={row.id || index} {...rowProps} className={rowClassName}>
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3 text-slate-700">
                      {column.render ? column.render(row) : row[column.key] ?? '-'}
                    </td>
                  ))}
                </tr>
                );
              })
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={columns.length}>
                  {emptyLabel}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
