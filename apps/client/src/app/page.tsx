"use client";

import { useState } from "react";
import { toast } from "sonner";
import SearchBar from "@/components/SearchBar";
import VideoInfo from "@/components/VideoInfo";
import FormatSelector from "@/components/FormatSelector";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, Download, CheckSquare, X } from "lucide-react";
import Image from "next/image";
import { api, VideoData, VideoFormat, EngineStatusData } from "@/lib/api";

import { useSettings } from "@/contexts/SettingsContext";
import BatchProgress from "@/components/BatchProgress";
import { EngineStatus } from "@/components/EngineStatus";
import { useEffect } from "react";

export default function Home() {
  const { addPrefix, concurrentFragments } = useSettings();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<VideoData | null>(null);
  const [error, setError] = useState("");

  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const [expandedVideoFormats, setExpandedVideoFormats] = useState<
    VideoFormat[] | null
  >(null);
  const [loadingVideoId, setLoadingVideoId] = useState<string | null>(null);

  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(
    new Set()
  );
  const [bulkFormat, setBulkFormat] = useState("best");
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);

  const [batchJobId, setBatchJobId] = useState<string | null>(null);
  const [showBatchProgress, setShowBatchProgress] = useState(false);

  const [engineError, setEngineError] = useState<{
    binary: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    return api.engine.onStatus((status: EngineStatusData) => {
      if (status.status === "retrying") {
        toast.info(status.message, {
          description: status.count
            ? `Attempt ${status.count} of ${status.max}`
            : undefined,
          id: "engine-status",
        });
      } else if (status.status === "ready") {
        toast.dismiss("engine-status");
        setEngineError(null);
      } else if (status.status === "error") {
        setEngineError({
          binary: status.binary || "yt-dlp",
          message: status.message || "Failed to launch engine",
        });
        toast.error("Downloader engine failed", { id: "engine-status" });
      }
    });
  }, []);

  const handleSearch = async (url: string) => {
    setLoading(true);
    setError("");
    setData(null);
    setExpandedVideoId(null);
    setSelectedVideoIds(new Set());

    try {
      const json = await api.video.getInfo(url);
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleFetchFormats = async (url: string, id: string) => {
    if (expandedVideoId === id) {
      setExpandedVideoId(null);
      return;
    }

    setLoadingVideoId(id);
    setExpandedVideoFormats(null);

    try {
      const json = await api.video.getInfo(url);
      setExpandedVideoFormats(json.formats || []);
      setExpandedVideoId(id);
    } catch (err) {
      console.error("Failed to fetch formats", err);
    } finally {
      setLoadingVideoId(null);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedVideoIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedVideoIds(newSet);
  };

  const selectAll = () => {
    if (!data?.entries) return;
    const allIds = data.entries.map((e, idx) => e.id || String(idx));
    setSelectedVideoIds(new Set(allIds));
  };

  const deselectAll = () => {
    setSelectedVideoIds(new Set());
  };

  const handleBulkDownload = async (format = "best", targetExt?: string) => {
    if (!data?.entries) return;
    const selectedEntries = data.entries.filter((e, idx) =>
      selectedVideoIds.has(e.id || String(idx))
    );

    if (selectedEntries.length === 0) return;

    setIsBulkDownloading(true);

    try {
      const payload = {
        urls: selectedEntries.map((e) => e.url || e.webpage_url || ""),
        titles: selectedEntries.map((e) => e.title || ""),
        format: format,
        targetExt,
        playlistName: data?.title || "mediapull_batch",
        addPrefix: addPrefix,
        concurrentFragments: concurrentFragments,
      };

      const { jobId } = await api.batch.init(payload);
      setBatchJobId(jobId);
      setShowBatchProgress(true);

      await api.batch.resume(jobId);

      toast.success("Batch job initialized!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to start batch download");
    } finally {
      setIsBulkDownloading(false);
    }
  };

  const handleDownload = async (
    formatId: string,
    targetExt?: string,
    urlOverride?: string,
    titleOverride?: string
  ) => {
    const videoUrl = urlOverride || data?.webpage_url;
    if (!videoUrl) return;

    const title = titleOverride || data?.title || "video";

    try {
      const payload = {
        urls: [videoUrl],
        titles: [title],
        format: formatId,
        targetExt,
        playlistName: title,
        folder: "",
        addPrefix: false,
        concurrentFragments: concurrentFragments,
      };

      const { jobId } = await api.batch.init(payload);
      setBatchJobId(jobId);
      setShowBatchProgress(true);

      await api.batch.resume(jobId);
      toast.success("Download started!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to start download");
    }
  };

  return (
    <main className="bg-background text-foreground pt-24 pb-12 px-4 transition-colors duration-300 relative animate-fade-in">
      <BatchProgress
        jobId={batchJobId}
        open={showBatchProgress}
        onOpenChange={setShowBatchProgress}
      />
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-2 text-center">
          MediaPull
        </h1>
        <p className="text-muted-foreground mb-10 text-lg text-center">
          Premium Universal Video & Playlist Downloader
        </p>

        <SearchBar onSearch={handleSearch} isLoading={loading} />

        {error && (
          <Alert variant="destructive" className="mb-8 max-w-2xl">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {data && (
          <div className="w-full animate-slide-up space-y-8">
            <VideoInfo data={data} />

            {data.entries && (
              <div className="space-y-4">
                <Card className="bg-muted/50 border-border">
                  <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium mr-2">
                        Bulk Actions:
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={selectAll}
                        className="h-8"
                      >
                        <CheckSquare className="w-4 h-4 mr-2" /> Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={deselectAll}
                        disabled={selectedVideoIds.size === 0}
                      >
                        <X className="mr-2 h-4 w-4" /> Deselect All
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-lg border shadow-sm">
                  {selectedVideoIds.size > 0 && (
                    <div className="flex flex-col sm:flex-row items-center gap-3 animate-fade-in w-full sm:w-auto">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Select
                          value={bulkFormat}
                          onValueChange={setBulkFormat}
                          disabled={isBulkDownloading}
                        >
                          <SelectTrigger className="w-[180px] h-9">
                            <SelectValue placeholder="Quality" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="best">
                              Best Quality (Auto)
                            </SelectItem>
                            <SelectItem value="bestvideo[height<=2160]+bestaudio/best[height<=2160]">
                              4K (2160p)
                            </SelectItem>
                            <SelectItem value="bestvideo[height<=1440]+bestaudio/best[height<=1440]">
                              2K (1440p)
                            </SelectItem>
                            <SelectItem value="bestvideo[height<=1080]+bestaudio/best[height<=1080]">
                              1080p (HD)
                            </SelectItem>
                            <SelectItem value="bestvideo[height<=720]+bestaudio/best[height<=720]">
                              720p (HD)
                            </SelectItem>
                            <SelectItem value="bestaudio">
                              Audio Only
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => handleBulkDownload(bulkFormat)}
                          size="sm"
                          className="gap-2"
                          disabled={isBulkDownloading}
                        >
                          <Download className="w-4 h-4" />
                          {isBulkDownloading
                            ? "Preparing ZIP..."
                            : `Download (${selectedVideoIds.size})`}
                        </Button>
                      </div>
                      {isBulkDownloading && (
                        <div className="w-full sm:w-48 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary animate-pulse w-full" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                  {data.entries.map((entry, idx) => {
                    const entryId = entry.id || String(idx);
                    const isSelected = selectedVideoIds.has(entryId);
                    const thumb =
                      entry.thumbnail ||
                      (entry.id
                        ? `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`
                        : null);

                    return (
                      <Card
                        key={idx}
                        className={`break-inside-avoid overflow-hidden transition-all duration-300 p-0 gap-0 ${
                          isSelected
                            ? "ring-2 ring-primary border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="relative aspect-video w-full bg-muted">
                          {thumb && (
                            <Image
                              src={thumb}
                              alt={entry.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          )}
                          <div className="absolute top-2 left-2 z-10 bg-background/90 backdrop-blur-md rounded-md p-1 shadow-sm">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(entryId)}
                              className="border-foreground/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          </div>
                        </div>

                        <div className="p-3 space-y-3">
                          <div>
                            <h4
                              className="font-semibold text-sm line-clamp-2"
                              title={entry.title}
                            >
                              {entry.title}
                            </h4>
                            {entry.uploader && (
                              <p className="text-xs text-muted-foreground">
                                {entry.uploader}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() =>
                                handleDownload(
                                  "best",
                                  undefined,
                                  entry.url || entry.webpage_url,
                                  entry.title
                                )
                              }
                            >
                              Quick DL
                            </Button>
                            <Button
                              variant={
                                loadingVideoId === entryId
                                  ? "secondary"
                                  : "default"
                              }
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() =>
                                handleFetchFormats(
                                  entry.url || entry.webpage_url || "",
                                  entryId
                                )
                              }
                              disabled={loadingVideoId === entryId}
                            >
                              {loadingVideoId === entryId
                                ? "Loading..."
                                : "Formats"}
                            </Button>
                          </div>

                          {expandedVideoId === entryId &&
                            expandedVideoFormats && (
                              <div className="pt-2 animate-fade-in">
                                <FormatSelector
                                  formats={expandedVideoFormats}
                                  onDownload={(fmt, target) =>
                                    handleDownload(
                                      fmt,
                                      target,
                                      entry.url || entry.webpage_url,
                                      entry.title
                                    )
                                  }
                                />
                              </div>
                            )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {!data.entries && data.formats && (
              <FormatSelector
                formats={data.formats}
                onDownload={(fmt, target) =>
                  handleDownload(fmt, target, undefined, data.title)
                }
              />
            )}
          </div>
        )}
      </div>

      <EngineStatus error={engineError} />
    </main>
  );
}
