import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, meRequest } from '../services/authService';
import { setAuthToken } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'kerea_hrms_auth';
const SETTINGS_CACHE_KEY = 'kerea_hrms_settings_cache';

const applyBranding = (settings) => {
  const branding = settings?.branding;

  if (!branding) {
    return;
  }

  const isMobileViewport = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const useMobileBranding = isMobileViewport && branding.useDesktopColorsOnMobile === false;
  const resolvedBranding = {
    primaryColor: useMobileBranding ? (branding.mobilePrimaryColor || branding.primaryColor) : branding.primaryColor,
    secondaryColor: useMobileBranding ? (branding.mobileSecondaryColor || branding.secondaryColor) : branding.secondaryColor,
    accentColor: useMobileBranding ? (branding.mobileAccentColor || branding.accentColor) : branding.accentColor,
    backgroundColor: useMobileBranding ? (branding.mobileBackgroundColor || branding.backgroundColor) : branding.backgroundColor,
    cardColor: useMobileBranding ? (branding.mobileCardColor || branding.cardColor) : branding.cardColor,
    textColor: useMobileBranding ? (branding.mobileTextColor || branding.textColor) : branding.textColor,
    gradientFrom: useMobileBranding ? (branding.mobileGradientFrom || branding.gradientFrom) : branding.gradientFrom,
    gradientTo: useMobileBranding ? (branding.mobileGradientTo || branding.gradientTo) : branding.gradientTo
  };

  const root = document.documentElement;
  root.style.setProperty('--brand-primary', resolvedBranding.primaryColor || '#166534');
  root.style.setProperty('--brand-secondary', resolvedBranding.secondaryColor || '#22c55e');
  root.style.setProperty('--brand-accent', resolvedBranding.accentColor || '#86efac');
  root.style.setProperty('--brand-gradient-from', resolvedBranding.gradientFrom || '#14532d');
  root.style.setProperty('--brand-gradient-to', resolvedBranding.gradientTo || '#22c55e');
  root.style.setProperty('--surface-page', resolvedBranding.backgroundColor || '#f4fbf6');
  root.style.setProperty('--surface-card', resolvedBranding.cardColor || '#ffffff');
  root.style.setProperty('--text-primary', resolvedBranding.textColor || '#0f172a');
  document.title = branding.appName || 'KEREA HRMS';

   const faviconHref = String(branding.faviconUrl || '').trim();
   let faviconElement = document.querySelector("link[rel='icon']");
   if (!faviconElement) {
     faviconElement = document.createElement('link');
     faviconElement.setAttribute('rel', 'icon');
     document.head.appendChild(faviconElement);
   }

   if (faviconHref) {
     faviconElement.setAttribute('href', faviconHref);
   } else {
     faviconElement.removeAttribute('href');
   }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).token : null;
  });
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).user : null;
  });
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved).settings;
    }
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  });
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    const syncBranding = () => applyBranding(settings);
    syncBranding();
    window.addEventListener('resize', syncBranding);
    return () => window.removeEventListener('resize', syncBranding);
  }, [settings]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const restoreSession = async () => {
      try {
        setLoading(true);
        const data = await meRequest();
        setUser(data.user);
        setSettings(data.settings);
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data.settings));
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: data.user, settings: data.settings }));
      } catch (restoreError) {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
        setSettings(() => {
          const cached = localStorage.getItem(SETTINGS_CACHE_KEY);
          return cached ? JSON.parse(cached) : null;
        });
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, [token]);

  const login = async (credentials) => {
    setError('');
    setLoading(true);

    try {
      const data = await loginRequest(credentials);
      setAuthToken(data.token);
      setToken(data.token);
      setUser(data.user);
      setSettings(data.settings);
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data.settings));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token, user: data.user, settings: data.settings }));
      return data.user;
    } catch (loginError) {
      const message = loginError.response?.data?.message || 'Unable to sign in.';
      setError(message);
      throw loginError;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
    setSettings((current) => current);
  };

  const replaceUser = (nextUser) => {
    setUser(nextUser);
    if (token && nextUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: nextUser, settings }));
    }
  };

  const replaceSettings = (nextSettings) => {
    setSettings(nextSettings);
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(nextSettings));
    if (token && user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user, settings: nextSettings }));
    }
  };

  const value = useMemo(() => ({
    token,
    user,
    settings,
    loading,
    error,
    login,
    logout,
    replaceUser,
    replaceSettings,
    isAuthenticated: Boolean(token && user)
  }), [token, user, settings, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
