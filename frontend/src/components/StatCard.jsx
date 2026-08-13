import { usePagePresentation } from '../hooks/usePagePresentation';

export default function StatCard({ title, value, helper, accent = 'from-emerald-700 to-emerald-500', onClick, animationOrder = 0 }) {
  const { animationStyle, cardStyle } = usePagePresentation({ animationOrder });
  const classes = `min-w-0 rounded-3xl bg-white p-4 shadow-soft sm:p-5 ${onClick ? 'w-full text-left hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-200' : ''}`;
  const text = String(value ?? '');
  const tokens = text.split(/\s+/).filter(Boolean);
  const longestTokenLength = tokens.reduce((longest, token) => Math.max(longest, token.length), 0);
  const valueSizeClass = longestTokenLength > 16
    ? 'text-base sm:text-xl'
    : longestTokenLength > 12
      ? 'text-lg sm:text-2xl'
      : 'text-2xl sm:text-3xl';
  const renderValue = () => (
    <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1 break-words" style={{ overflowWrap: 'anywhere' }}>
      {tokens.length === 0 ? (
        <span>--</span>
      ) : (
        tokens.map((tok, idx) => (
          <span key={`${tok}-${idx}`} className={tok.length > 18 ? 'text-base sm:text-lg' : tok.length > 14 ? 'text-lg sm:text-xl' : undefined}>{tok}{idx < tokens.length - 1 ? ' ' : ''}</span>
        ))
      )}
    </span>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} style={{ ...cardStyle, ...animationStyle }}>
        <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`} />
        <p className="text-sm text-slate-500">{title}</p>
        <p className={`mt-2 font-semibold leading-tight text-slate-900 ${valueSizeClass}`}>{renderValue()}</p>
        {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
      </button>
    );
  }

  return (
    <div className={classes} style={{ ...cardStyle, ...animationStyle }}>
      <div className={`mb-4 h-2 w-20 rounded-full bg-gradient-to-r ${accent}`} />
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-2 font-semibold leading-tight text-slate-900 ${valueSizeClass}`}>{renderValue()}</p>
      {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}
