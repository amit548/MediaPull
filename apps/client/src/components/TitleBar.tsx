"use client";

import { useEffect, useState } from "react";
import { Minus, Square, X, Copy, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import SettingsDialog from "@/components/SettingsDialog";
import { DownloadsDialog } from "@/components/DownloadsDialog";
import ThemeToggle from "@/components/ThemeToggle";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [platform] = useState(() => api.app.getPlatform());

  useEffect(() => {
    const checkMaximized = async () => {
      const maximized = await api.app.isMaximized();
      setIsMaximized(maximized);
    };

    checkMaximized();
    window.addEventListener("resize", checkMaximized);
    return () => window.removeEventListener("resize", checkMaximized);
  }, []);

  const handleMinimize = () => api.app.minimize();
  const handleMaximize = async () => {
    await api.app.maximize();
    setIsMaximized(await api.app.isMaximized());
  };
  const handleClose = () => api.app.close();

  if (platform === "darwin") {
    return (
      <div className="h-8 flex items-center px-4 select-none drag bg-background/50 backdrop-blur-md border-b">
        <div className="flex-1 text-center text-xs font-medium text-muted-foreground opacity-50">
          MediaPull Pro
        </div>
      </div>
    );
  }

  return (
    <div className="h-10 flex items-center justify-between bg-background/80 backdrop-blur-xl border-b z-[100] select-none drag">
      <div className="flex items-center gap-2 px-4 no-drag">
        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
        <span className="text-[11px] font-bold tracking-widest uppercase opacity-70">
          MediaPull
        </span>
      </div>

      <div className="flex-1 flex justify-center pointer-events-none">
        <span className="text-[10px] font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">
          Pro Edition
        </span>
      </div>

      <div className="flex items-center h-full no-drag px-2 gap-1 border-r mr-1">
        <div className="scale-85 origin-right flex items-center gap-0.5">
          <DownloadsDialog />
          <SettingsDialog />
          <ThemeToggle />
        </div>
      </div>

      <div className="flex items-center h-full no-drag">
        <button
          onClick={handleMinimize}
          className="h-full px-4 hover:bg-muted/50 transition-colors flex items-center justify-center"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-4 hover:bg-muted/50 transition-colors flex items-center justify-center"
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <Copy className="w-3 h-3 rotate-180" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="h-full px-4 hover:bg-destructive hover:text-white transition-colors flex items-center justify-center"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
