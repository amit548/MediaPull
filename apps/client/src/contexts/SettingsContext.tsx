"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api } from "@/lib/api";

interface SettingsContextType {
  addPrefix: boolean;
  setAddPrefix: (val: boolean) => void;
  concurrentFragments: number;
  setConcurrentFragments: (val: number) => void;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [addPrefix, setAddPrefixState] = useState(false);
  const [concurrentFragments, setConcurrentFragmentsState] = useState(4);

  const refreshSettings = useCallback(async () => {
    try {
      const prefix = await api.settings.get("addPrefix");
      const fragments = await api.settings.get("concurrentFragments");

      if (prefix !== null) setAddPrefixState(prefix === "true");
      if (fragments !== null) setConcurrentFragmentsState(Number(fragments));
    } catch (error) {
      console.error("Failed to load settings in context:", error);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await refreshSettings();
    };
    load();

    window.addEventListener("settings-updated", refreshSettings);
    return () =>
      window.removeEventListener("settings-updated", refreshSettings);
  }, [refreshSettings]);

  const setAddPrefix = async (val: boolean) => {
    setAddPrefixState(val);
    await api.settings.save("addPrefix", String(val));
    window.dispatchEvent(new CustomEvent("settings-updated"));
  };

  const setConcurrentFragments = async (val: number) => {
    setConcurrentFragmentsState(val);
    await api.settings.save("concurrentFragments", String(val));
    window.dispatchEvent(new CustomEvent("settings-updated"));
  };

  return (
    <SettingsContext.Provider
      value={{
        addPrefix,
        setAddPrefix,
        concurrentFragments,
        setConcurrentFragments,
        refreshSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
