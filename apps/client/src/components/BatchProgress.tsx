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
import { Pause, Play, Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import { api, JobStatus } from "@/lib/api";

interface BatchProgressProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
        const data = await api.batch.getStatus(jobId);
        setStatus(data);
      } catch {}
    };

    poll();

    let removeListener: (() => void) | undefined;
    if (window.api && window.api.onProgress) {
      removeListener = window.api.onProgress((updatedJob: JobStatus) => {
        if (updatedJob.id === jobId) {
          setStatus(updatedJob);
        }
      });
    }

    const interval = setInterval(poll, 2000);
    return () => {
      clearInterval(interval);
      if (removeListener) removeListener();
    };
  }, [open, jobId]);

  const handlePause = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      await api.batch.pause(jobId);
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
      await api.batch.resume(jobId);
      toast.success("Resuming download...");
    } catch (e) {
      console.error(e);
      toast.error("Failed to resume");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenFolder = () => {
    if (!jobId) return;
    api.batch.openFolder(jobId);
    toast.success("Opening folder...");
  };

  if (!status) return null;

  const percentage =
    status.progress.total > 0
      ? Math.min(
          100,
          ((status.progress.completed +
            (status.status === "downloading" &&
            status.progress.currentFilePercent
              ? status.progress.currentFilePercent / 100
              : 0)) /
            status.progress.total) *
            100
        )
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
              <span>{percentage.toFixed(1)}%</span>
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

          <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 bg-muted/50">
            {status.files.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground py-4">
                Initializing...
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
              <Button onClick={handleOpenFolder} className="w-full sm:w-auto">
                <FolderOpen className="w-4 h-4 mr-2" /> Open Folder
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
