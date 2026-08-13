export default function BrandLogo({
  logoUrl,
  fallbackText = 'KH',
  alt = 'Brand logo',
  className = 'h-12 w-12',
  imageClassName = 'h-full w-full object-contain p-2',
  textClassName = 'text-sm font-bold text-white',
  surfaceClassName = 'bg-brand-gradient'
}) {
  const resolvedLogoUrl = String(logoUrl || '').trim();

  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-lg ${surfaceClassName} ${className}`}>
      {resolvedLogoUrl ? (
        <img src={resolvedLogoUrl} alt={alt} className={imageClassName} />
      ) : (
        <span className={textClassName}>{fallbackText}</span>
      )}
    </div>
  );
}
