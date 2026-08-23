import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const fallbackPageExperience = {
  dashboard: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
  employees: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
  profile: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
  documents: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
  leave: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
  kpi: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
  performance: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
  login: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 },
  settings: { enabled: true, type: 'fade-up', delayMs: 0, durationMs: 420, cardBackgroundColor: '#ffffff', cardBackgroundOpacity: 1 }
};

const fallbackRedesignedTheme = {
  backgroundImageUrl: '',
  overlayColor: '#0b2e13',
  overlayOpacity: 0.45,
  sidebarGradientFrom: '#14532d',
  sidebarGradientTo: '#22c55e',
  glassCardColor: '#ffffff',
  glassCardOpacity: 0.18,
  glassBlurPx: 14,
  cardTextColor: '#0f172a'
};

export const isRedesignedActive = (settings) => {
  const ui = settings?.interface?.uiVariant;
  if (!ui || ui.active !== 'redesigned') {
    return false;
  }

  const applyTo = ui.applyTo || 'all';
  const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  const isLarge = !isSmall;
  return applyTo === 'all' || (applyTo === 'small_only' && isSmall) || (applyTo === 'large_only' && isLarge);
};

export const getRedesignedTheme = (settings) => ({
  ...fallbackRedesignedTheme,
  ...(settings?.interface?.uiVariant?.redesignedTheme || {})
});

const clamp = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
};

export const withOpacity = (color, opacity) => {
  const value = String(color || '').trim();
  const normalizedOpacity = clamp(opacity, 0, 1, 1);
  const fullHexMatch = value.match(/^#([0-9a-f]{6})$/i);
  const shortHexMatch = value.match(/^#([0-9a-f]{3})$/i);

  if (fullHexMatch) {
    const [, hex] = fullHexMatch;
    const red = parseInt(hex.slice(0, 2), 16);
    const green = parseInt(hex.slice(2, 4), 16);
    const blue = parseInt(hex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${normalizedOpacity})`;
  }

  if (shortHexMatch) {
    const [, hex] = shortHexMatch;
    const red = parseInt(`${hex[0]}${hex[0]}`, 16);
    const green = parseInt(`${hex[1]}${hex[1]}`, 16);
    const blue = parseInt(`${hex[2]}${hex[2]}`, 16);
    return `rgba(${red}, ${green}, ${blue}, ${normalizedOpacity})`;
  }

  return value || undefined;
};

const getInitialMotionStyle = (type) => {
  switch (type) {
    case 'slide-left':
      return { opacity: 0, transform: 'translateX(20px)' };
    case 'slide-right':
      return { opacity: 0, transform: 'translateX(-20px)' };
    case 'zoom-in':
      return { opacity: 0, transform: 'scale(0.96)' };
    case 'soft-blur':
      return { opacity: 0, transform: 'translateY(12px)', filter: 'blur(8px)' };
    case 'fade-up':
    default:
      return { opacity: 0, transform: 'translateY(18px)' };
  }
};

const getFinalMotionStyle = (type) => (type === 'soft-blur'
  ? { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }
  : { opacity: 1, transform: 'translate(0, 0) scale(1)' });

export const resolvePagePresentationKey = (pathname = '') => {
  if (pathname.startsWith('/login')) {
    return 'login';
  }
  if (pathname.startsWith('/employees')) {
    return 'employees';
  }
  if (pathname.startsWith('/profile')) {
    return 'profile';
  }
  if (pathname.startsWith('/documents')) {
    return 'documents';
  }
  if (pathname.startsWith('/leaves')) {
    return 'leave';
  }
  if (pathname.startsWith('/leave-status')) {
    return 'leave';
  }
  if (pathname.startsWith('/kpi-matrix')) {
    return 'kpi';
  }
  if (pathname.startsWith('/performance-dashboard')) {
    return 'performance';
  }
  if (pathname.startsWith('/settings') || pathname.startsWith('/audit-logs')) {
    return 'settings';
  }
  return 'dashboard';
};

export const getPagePresentation = (settings, pathname = '') => {
  const pageKey = resolvePagePresentationKey(pathname);
  const fallback = fallbackPageExperience[pageKey] || fallbackPageExperience.dashboard;
  const configured = settings?.interface?.pageExperience?.[pageKey] || {};

  return {
    pageKey,
    enabled: configured.enabled !== false,
    type: configured.type || fallback.type,
    delayMs: clamp(configured.delayMs, 0, 3000, fallback.delayMs),
    durationMs: clamp(configured.durationMs, 120, 2000, fallback.durationMs),
    cardBackgroundColor: configured.cardBackgroundColor || fallback.cardBackgroundColor,
    cardBackgroundOpacity: clamp(configured.cardBackgroundOpacity, 0, 1, fallback.cardBackgroundOpacity)
  };
};

export const usePagePresentation = ({ animationOrder = 0 } = {}) => {
  const { settings } = useAuth();
  const location = useLocation();
  const presentation = useMemo(
    () => getPagePresentation(settings, location.pathname),
    [location.pathname, settings]
  );
  const [entered, setEntered] = useState(presentation.enabled === false);

  useEffect(() => {
    if (!presentation.enabled) {
      setEntered(true);
      return undefined;
    }

    setEntered(false);
    const frameId = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frameId);
  }, [animationOrder, location.pathname, presentation.durationMs, presentation.enabled, presentation.type]);

  const animationStyle = useMemo(() => {
    if (!presentation.enabled) {
      return undefined;
    }

    const transitionDelay = presentation.delayMs + (Math.max(0, Number(animationOrder) || 0) * 70);
    return {
      ...(entered ? getFinalMotionStyle(presentation.type) : getInitialMotionStyle(presentation.type)),
      transition: `opacity ${presentation.durationMs}ms ease, transform ${presentation.durationMs}ms ease, filter ${presentation.durationMs}ms ease`,
      transitionDelay: `${transitionDelay}ms`,
      willChange: 'opacity, transform, filter'
    };
  }, [animationOrder, entered, presentation]);

  const cardStyle = useMemo(() => {
    if (isRedesignedActive(settings)) {
      const theme = getRedesignedTheme(settings);
      return {
        backgroundColor: withOpacity(theme.glassCardColor, theme.glassCardOpacity),
        backdropFilter: `saturate(160%) blur(${Number(theme.glassBlurPx) || 0}px)`,
        color: theme.cardTextColor || undefined
      };
    }

    return {
      backgroundColor: withOpacity(presentation.cardBackgroundColor, presentation.cardBackgroundOpacity)
    };
  }, [presentation.cardBackgroundColor, presentation.cardBackgroundOpacity, settings]);

  return {
    animationStyle,
    cardStyle,
    pageKey: presentation.pageKey,
    presentation
  };
};
