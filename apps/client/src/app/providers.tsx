"use client";

import * as React from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { api } from "@/lib/api";
import { SettingsProvider } from "@/contexts/SettingsContext";

function ThemeWatcher() {
  const { resolvedTheme } = useTheme();

  const applyAppearance = React.useCallback(async () => {
    try {
      const oled = await api.settings.get("oledMode");
      const accent = await api.settings.get("accentColor");

      if (oled === "true" && resolvedTheme === "dark") {
        document.documentElement.classList.add("oled");
      } else {
        document.documentElement.classList.remove("oled");
      }

      if (accent) {
        document.documentElement.style.setProperty("--primary", accent);
        document.documentElement.style.setProperty(
          "--primary-foreground",
          "0 0% 98%"
        );
      } else {
        document.documentElement.style.removeProperty("--primary");
        document.documentElement.style.removeProperty("--primary-foreground");
      }
    } catch (e) {
      console.error("Failed to apply appearance", e);
    }
  }, [resolvedTheme]);

  React.useEffect(() => {
    applyAppearance();

    const handleUpdate = () => applyAppearance();
    window.addEventListener("settings-updated", handleUpdate);
    return () => window.removeEventListener("settings-updated", handleUpdate);
  }, [applyAppearance]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
      <SettingsProvider>
        <ThemeWatcher />
        {children}
      </SettingsProvider>
    </ThemeProvider>
  );
}
