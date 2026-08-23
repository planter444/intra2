import { useEffect, useRef } from 'react';

const defaultMessage = "Are you sure you wanna leave this page? The changes won't be saved.";

export default function useUnsavedChangesGuard(when, message = defaultMessage) {
  const confirmingRef = useRef(false);

  useEffect(() => {
    if (!when) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [message, when]);

  useEffect(() => {
    if (!when) {
      return undefined;
    }

    const confirmNavigation = () => {
      if (confirmingRef.current) {
        return true;
      }

      confirmingRef.current = true;
      const shouldLeave = window.confirm(message);
      confirmingRef.current = false;
      return shouldLeave;
    };

    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);
    let lastHistoryIndex = window.history.state?.idx ?? 0;
    let ignoreNextPopState = false;

    window.history.pushState = function pushState(...args) {
      if (!confirmNavigation()) {
        return undefined;
      }

      return originalPushState(...args);
    };

    window.history.replaceState = function replaceState(...args) {
      if (!confirmNavigation()) {
        return undefined;
      }

      return originalReplaceState(...args);
    };

    const handlePopState = () => {
      if (ignoreNextPopState) {
        ignoreNextPopState = false;
        lastHistoryIndex = window.history.state?.idx ?? lastHistoryIndex;
        return;
      }

      const nextHistoryIndex = window.history.state?.idx ?? lastHistoryIndex;

      if (confirmNavigation()) {
        lastHistoryIndex = nextHistoryIndex;
        return;
      }

      ignoreNextPopState = true;

      if (nextHistoryIndex < lastHistoryIndex) {
        window.history.go(1);
        return;
      }

      if (nextHistoryIndex > lastHistoryIndex) {
        window.history.go(-1);
        return;
      }

      window.history.go(1);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', handlePopState);
    };
  }, [message, when]);
}
