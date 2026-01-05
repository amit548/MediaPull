"use client";

import { useState } from "react";
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

interface VideoFormat {
  format_id: string;
  format_note?: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
}

interface VideoData {
  title: string;
  thumbnail: string;
  duration_string?: string;
  uploader?: string;
  formats?: VideoFormat[];
  entries?: VideoData[];
  webpage_url?: string;
  url?: string;
  id?: string;
}

import ThemeToggle from "@/components/ThemeToggle";
import SettingsDialog from "@/components/SettingsDialog";

export default function Home() {
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
  const [addPrefix, setAddPrefix] = useState(false);
  const [concurrentFragments, setConcurrentFragments] = useState(4);

  const handleSearch = async (url: string) => {
    setLoading(true);
    setError("");
    setData(null);
    setExpandedVideoId(null);
    setSelectedVideoIds(new Set());

    try {
      const res = await fetch(
        `http://localhost:4000/api/info?url=${encodeURIComponent(url)}`
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch video info");
      }

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
      const res = await fetch(
        `http://localhost:4000/api/info?url=${encodeURIComponent(url)}`
      );
      const json = await res.json();

      if (!res.ok) throw new Error(json.error);

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

  const handleBulkDownload = (format = "best") => {
    if (!data?.entries) return;
    const selectedEntries = data.entries.filter((e, idx) =>
      selectedVideoIds.has(e.id || String(idx))
    );

    if (selectedEntries.length === 0) return;

    setIsBulkDownloading(true);

    console.log(
      `[DEBUG] Starting ZIP bulk download for ${selectedEntries.length} items`
    );

    const queryParams = new URLSearchParams();
    selectedEntries.forEach((entry) => {
      queryParams.append("urls", entry.url || entry.webpage_url || "");
      queryParams.append("titles", entry.title || "");
    });
    queryParams.append("format", format);

    const downloadUrl = `http://localhost:4000/api/download/batch`;

    const form = document.createElement("form");
    form.method = "POST";
    form.action = downloadUrl;
    form.style.display = "none";

    selectedEntries.forEach((entry) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "urls[]";
      input.value = entry.url || entry.webpage_url || "";
      form.appendChild(input);

      const titleInput = document.createElement("input");
      titleInput.type = "hidden";
      titleInput.name = "titles[]";
      titleInput.value = entry.title || "";
      form.appendChild(titleInput);
    });

    const formatInput = document.createElement("input");
    formatInput.type = "hidden";
    formatInput.name = "format";
    formatInput.value = format;
    form.appendChild(formatInput);

    const playlistNameInput = document.createElement("input");
    playlistNameInput.type = "hidden";
    playlistNameInput.name = "playlistName";
    playlistNameInput.value = data?.title || "mediapull_batch";
    form.appendChild(playlistNameInput);

    const prefixInput = document.createElement("input");
    prefixInput.type = "hidden";
    prefixInput.name = "addPrefix";
    prefixInput.value = String(addPrefix);
    form.appendChild(prefixInput);

    const fragmentsInput = document.createElement("input");
    fragmentsInput.type = "hidden";
    fragmentsInput.name = "concurrentFragments";
    fragmentsInput.value = String(concurrentFragments);
    form.appendChild(fragmentsInput);

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      document.body.removeChild(form);
      setIsBulkDownloading(false);
    }, 4000);
  };
  const handleDownload = (
    formatId: string,
    urlOverride?: string,
    titleOverride?: string
  ) => {
    const videoUrl = urlOverride || data?.webpage_url;
    if (!videoUrl) return;

    const title = titleOverride || data?.title || "video";
    const downloadUrl = `http://localhost:4000/api/download?url=${encodeURIComponent(
      videoUrl
    )}&format=${formatId}&title=${encodeURIComponent(title)}`;

    console.log(`[DEBUG] Triggering download: ${title} (${formatId})`);

    const a = document.createElement("a");
    a.href = downloadUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("download", "");
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
    }, 200);
  };

  return (
    <main className="bg-background text-foreground py-12 px-4 transition-colors duration-300 relative animate-fade-in">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <SettingsDialog
          addPrefix={addPrefix}
          setAddPrefix={setAddPrefix}
          concurrentFragments={concurrentFragments}
          setConcurrentFragments={setConcurrentFragments}
        />
        <ThemeToggle />
      </div>
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-2 text-center">
          MediaPull
        </h1>
        <p className="text-muted-foreground mb-10 text-lg text-center">
          Premium YouTube Video & Playlist Downloader
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
                                  onDownload={(fmt) =>
                                    handleDownload(
                                      fmt,
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
                onDownload={(fmt) => handleDownload(fmt, undefined, data.title)}
              />
            )}
          </div>
        )}
      </div>
    </main>
  );
}
