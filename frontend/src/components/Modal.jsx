export default function Modal({ open, title, description, children, actions, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 px-4 py-6" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5">
          <h3 className="text-2xl font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-2 text-sm text-slate-500">{description}</p> : null}
        </div>
        <div>{children}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">{actions}</div>
      </div>
    </div>
  );
}
