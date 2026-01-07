import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pause, Play, History, Trash2, FolderOpen } from "lucide-react";
import { api, JobStatus } from "@/lib/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export function DownloadsDialog() {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [limit, setLimit] = useState(20);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteData, setDeleteData] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const data = await api.batch.list(limit);
      setJobs(data);
    } catch {}
  }, [limit]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => void fetchJobs(), 0);

      const interval = setInterval(() => void fetchJobs(), 2000);

      let removeListener: (() => void) | undefined;
      if (window.api && window.api.onProgress) {
        removeListener = window.api.onProgress((updatedJob: JobStatus) => {
          setJobs((prevJobs) => {
            const idx = prevJobs.findIndex((j) => j.id === updatedJob.id);
            if (idx !== -1) {
              const newJobs = [...prevJobs];
              newJobs[idx] = updatedJob;
              return newJobs;
            } else {
              return prevJobs;
            }
          });
        });
      }

      return () => {
        clearTimeout(t);
        clearInterval(interval);
        if (removeListener) removeListener();
      };
    }
  }, [open, fetchJobs]);

  const handleOpenRootFolder = async () => {
    try {
      await api.batch.openDownloadsFolder();
      toast.success("Opening folder...");
    } catch {
      toast.error("Failed to open folder");
    }
  };

  const handleResume = async (id: string) => {
    try {
      await api.batch.resume(id);
      toast.success("Resuming...");
      void fetchJobs();
    } catch {
      toast.error("Failed to resume");
    }
  };

  const handlePause = async (id: string) => {
    try {
      await api.batch.pause(id);
      toast.info("Pausing...");
      void fetchJobs();
    } catch {
      toast.error("Failed to pause");
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.batch.delete(deleteConfirmId, deleteData);
      toast.success("Deleted");
      setDeleteConfirmId(null);
      setDeleteData(false);
      void fetchJobs();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const hasMore = jobs.length >= limit;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" title="Downloads">
            <History className="h-[1.2rem] w-[1.2rem]" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex justify-between items-center pr-8">
              <div>
                <DialogTitle>Media History</DialogTitle>
                <DialogDescription>Manage local downloads.</DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenRootFolder}
              >
                <FolderOpen className="mr-2 h-4 w-4" /> Open Folder
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto pr-4">
            <div className="space-y-4">
              {jobs.length === 0 ? (
                <div className="text-center text-muted-foreground py-10">
                  No downloads found.
                </div>
              ) : (
                <>
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="border rounded-lg p-4 flex flex-col gap-2 relative group"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="font-semibold flex items-center gap-2">
                            <span
                              className="truncate max-w-[200px] sm:max-w-[300px]"
                              title={job.playlistName}
                            >
                              {job.playlistName}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1 font-normal uppercase tracking-wider"
                            >
                              {job.progress.total > 1 ? "Playlist" : "Single"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(
                              Number(job.id.split("-")[0])
                            ).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge
                            variant={
                              job.status === "completed"
                                ? "default"
                                : job.status === "error"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {job.status}
                          </Badge>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive p-0"
                              onClick={() => {
                                setDeleteConfirmId(job.id);
                                setDeleteData(false);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>
                            {job.progress.completed} / {job.progress.total}{" "}
                            items
                          </span>
                          <span>
                            {job.status === "downloading" &&
                              job.progress.currentSpeed}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              job.status === "error"
                                ? "bg-destructive"
                                : job.status === "completed"
                                ? "bg-green-500"
                                : "bg-primary"
                            }`}
                            style={{
                              width: `${
                                job.progress.total > 0
                                  ? ((job.progress.completed +
                                      (job.status === "downloading" &&
                                      job.progress.currentFilePercent
                                        ? job.progress.currentFilePercent / 100
                                        : 0)) /
                                      job.progress.total) *
                                    100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        {job.status === "downloading" && (
                          <div className="flex justify-end text-xs text-muted-foreground">
                            <span>
                              {job.progress.currentFilePercent?.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>

                      {(job.status === "idle" ||
                        job.status === "error" ||
                        job.status === "paused" ||
                        job.status === "downloading") && (
                        <div className="flex gap-2 justify-end mt-2">
                          {(job.status === "idle" ||
                            job.status === "error" ||
                            job.status === "paused") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResume(job.id)}
                            >
                              <Play className="w-3 h-3 mr-2" /> Resume
                            </Button>
                          )}
                          {job.status === "downloading" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePause(job.id)}
                            >
                              <Pause className="w-3 h-3 mr-2" /> Pause
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {hasMore && (
                    <Button
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      onClick={() => setLimit((l) => l + 20)}
                    >
                      Load More
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(val) => !val && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Download?</DialogTitle>
            <DialogDescription>
              This will remove the item from your history list.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center space-x-2 py-4">
            <Checkbox
              id="delete-files"
              checked={deleteData}
              onCheckedChange={(c) => setDeleteData(c === true)}
            />
            <label
              htmlFor="delete-files"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Also permanently delete downloaded files
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
