"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Pause,
  Play,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface BatchProgressProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface JobStatus {
  id: string;
  status: "idle" | "downloading" | "paused" | "completed" | "error" | "zipping";
  error?: string;
  progress: {
    total: number;
    completed: number;
    currentFileIndex: number;
    currentSpeed?: string;
  };
  files: { filename: string; status: string }[];
}

export default function BatchProgress({
  jobId,
  open,
  onOpenChange,
}: BatchProgressProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(
          `http://localhost:4000/api/batch/status/${jobId}`
        );
        if (res.ok) {
          const data = await res.json();
          setStatus(data);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    };

    poll();
    const interval = setInterval(poll, 1000);

    return () => clearInterval(interval);
  }, [open, jobId]);

  const handlePause = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      await fetch(`http://localhost:4000/api/batch/pause/${jobId}`, {
        method: "POST",
      });
      toast.info("Pausing download...");
    } catch (e) {
      console.error(e);
      toast.error("Failed to pause");
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      await fetch(`http://localhost:4000/api/batch/resume/${jobId}`, {
        method: "POST",
      });
      toast.success("Resuming download...");
    } catch (e) {
      console.error(e);
      toast.error("Failed to resume");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadZip = () => {
    if (!jobId) return;
    window.location.assign(`http://localhost:4000/api/batch/zip/${jobId}`);
    toast.success("Download started!");
  };

  if (!status) return null;

  const percentage =
    status.progress.total > 0
      ? Math.round((status.progress.completed / status.progress.total) * 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Batch Download</DialogTitle>
          <DialogDescription>
            {status.status === "completed"
              ? "All files ready for download."
              : `Processing ${status.progress.completed} of ${status.progress.total} videos...`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{percentage}%</span>
              <div className="flex gap-2">
                {status.progress.currentSpeed && (
                  <span className="font-mono text-xs text-blue-500">
                    {status.progress.currentSpeed}
                  </span>
                )}
                <span>
                  {status.progress.completed}/{status.progress.total}
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-in-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="bg-muted p-3 rounded-md text-sm font-mono max-h-[100px] overflow-y-auto">
            {status.error ? (
              <div className="text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {status.error}
              </div>
            ) : status.status === "completed" ? (
              <div className="text-green-500 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Ready to Zip!
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-foreground font-semibold uppercase text-xs">
                  {status.status}
                </span>
                {status.files.map((f, i) => (
                  <div
                    key={i}
                    className="flex justify-between text-xs"
                    ref={(el) => {
                      if (i === status.progress.currentFileIndex && el) {
                        el.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }
                    }}
                  >
                    <span className="truncate max-w-[200px]" title={f.filename}>
                      {i + 1}. {f.filename}
                    </span>
                    <span
                      className={
                        f.status === "completed"
                          ? "text-green-500"
                          : f.status === "downloading"
                          ? "text-blue-500 animate-pulse"
                          : f.status === "error"
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }
                    >
                      {f.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {status.status === "downloading" && (
              <Button
                variant="outline"
                onClick={handlePause}
                disabled={loading}
              >
                <Pause className="w-4 h-4 mr-2" /> Pause
              </Button>
            )}

            {(status.status === "paused" ||
              status.status === "idle" ||
              status.status === "error") && (
              <Button onClick={handleResume} disabled={loading}>
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                {status.status === "idle" ? "Start" : "Resume"}
              </Button>
            )}

            {status.status === "completed" && (
              <Button onClick={handleDownloadZip} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" /> Download ZIP
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
