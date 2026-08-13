import BrandLogo from './BrandLogo';
import { useAuth } from '../context/AuthContext';

export default function LoadingScreen({ label = 'Loading KEREA HRMS...' }) {
  const { settings } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4">
      <div className="rounded-3xl bg-white px-8 py-10 text-center shadow-soft">
        <div className="mx-auto mb-4 animate-pulse">
          <BrandLogo
            logoUrl={settings?.branding?.faviconUrl}
            fallbackText={settings?.branding?.logoText || 'KH'}
            alt={`${settings?.branding?.organizationName || 'KEREA'} loading logo`}
            className="h-12 w-12"
            imageClassName="h-full w-full object-contain p-2"
          />
        </div>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
    </div>
  );
}
