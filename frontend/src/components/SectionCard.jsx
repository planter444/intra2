import { usePagePresentation } from '../hooks/usePagePresentation';

export default function SectionCard({ title, subtitle, actions, children, className = '', style, animationOrder = 0 }) {
  const { animationStyle, cardStyle } = usePagePresentation({ animationOrder });

  return (
    <section className={`min-w-0 rounded-3xl bg-white p-4 shadow-soft sm:p-5 ${className}`} style={{ ...cardStyle, ...animationStyle, ...style }}>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:justify-end">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
