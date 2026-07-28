"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { UserPreferences } from "@/lib/types";
import { DEFAULT_PREFERENCES } from "@/lib/types";

interface PreferencesContextType {
  preferences: UserPreferences;
  loading: boolean;
  needsOnboarding: boolean;
  refreshPreferences: () => Promise<void>;
  savePreferences: (prefs: UserPreferences) => Promise<void>;
  skipOnboarding: () => void;
}

const PreferencesContext = createContext<PreferencesContextType | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [skipped, setSkipped] = useState(false);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/preferences");
      const data = await res.json();
      if (data.preferences) {
        setPreferences(data.preferences);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const savePreferences = useCallback(async (prefs: UserPreferences) => {
    try {
      const res = await fetch("/api/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (res.ok) {
        setPreferences(prefs);
      }
    } catch { /* ignore */ }
  }, []);

  const skipOnboarding = useCallback(() => {
    setSkipped(true);
  }, []);

  const needsOnboarding = !loading && !skipped && !preferences.has_completed_onboarding;

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        loading,
        needsOnboarding,
        refreshPreferences: fetchPreferences,
        savePreferences,
        skipOnboarding,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
