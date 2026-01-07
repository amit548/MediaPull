"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface EngineStatusProps {
  error: {
    binary: string;
    message: string;
  } | null;
}

export function EngineStatus({ error }: EngineStatusProps) {
  if (!error) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50 animate-in fade-in slide-in-from-bottom-4">
      <Alert
        variant="destructive"
        className="border-2 shadow-lg backdrop-blur-sm bg-destructive/10"
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-bold flex items-center gap-2">
          System Busy / Lock Issue
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-4">
          <p className="text-sm opacity-90">{error.message}</p>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              className="bg-background hover:bg-accent"
              onClick={() => api.app.relaunch()}
            >
              <RefreshCw className="mr-2 h-3 w-3" />
              Restart App
            </Button>
            <p className="text-xs text-muted-foreground italic">
              Tip: Check if your antivirus is blocking {error.binary}
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
