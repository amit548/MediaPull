"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Save,
  Trash2,
  Globe,
  RefreshCw,
  Layers,
  Palette,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";

type SettingsTab = "general" | "downloader" | "appearance" | "advanced";

export default function SettingsDialog() {
  const {
    addPrefix,
    setAddPrefix,
    concurrentFragments,
    setConcurrentFragments,
  } = useSettings();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [cookies, setCookies] = useState("");
  const [proxy, setProxy] = useState("");
  const [embedMetadata, setEmbedMetadata] = useState(false);
  const [embedThumbnail, setEmbedThumbnail] = useState(false);
  const [oledMode, setOledMode] = useState(false);
  const [accentColor, setAccentColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [updatingEngine, setUpdatingEngine] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      const load = async () => {
        try {
          const p = await api.settings.get("proxy");
          if (p) setProxy(p);

          const m = await api.settings.get("embedMetadata");
          setEmbedMetadata(m === "true");

          const t = await api.settings.get("embedThumbnail");
          setEmbedThumbnail(t === "true");

          const o = await api.settings.get("oledMode");
          setOledMode(o === "true");

          const a = await api.settings.get("accentColor");
          if (a) setAccentColor(a);
        } catch (e) {
          console.error("Failed to load settings", e);
        }
      };
      load();
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (cookies) await api.settings.saveCookies(cookies);
      await api.settings.save("proxy", proxy);
      await api.settings.save("embedMetadata", String(embedMetadata));
      await api.settings.save("embedThumbnail", String(embedThumbnail));
      await api.settings.save("oledMode", String(oledMode));
      await api.settings.save("accentColor", accentColor);

      window.dispatchEvent(new CustomEvent("settings-updated"));
      toast.success("Settings saved successfully!");
      setOpen(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const actualClear = async () => {
    setClearing(true);
    try {
      await api.settings.saveCookies("");
      setCookies("");
      toast.success("Cookies cleared successfully!");
      setShowClearConfirm(false);
    } catch (error) {
      console.error("Error clearing cookies:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to clear cookies"
      );
    } finally {
      setClearing(false);
    }
  };

  const handleUpdateEngine = async () => {
    setUpdatingEngine(true);
    try {
      const result = await api.settings.updateEngine();
      toast.success(result || "Engine updated successfully!");
    } catch (error) {
      console.error("Error updating engine:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update engine"
      );
    } finally {
      setUpdatingEngine(false);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "downloader", label: "Downloader", icon: Layers },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "advanced", label: "Advanced", icon: ShieldCheck },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Settings</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px] p-0 gap-0 overflow-hidden border-none shadow-2xl h-[600px]">
          <div className="flex h-full">
            <div className="w-[200px] bg-muted/30 border-r flex flex-col p-4 gap-2">
              <div className="flex items-center gap-2 px-2 pb-6 pt-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Settings className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-sm tracking-tight">
                  Configuration
                </span>
              </div>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SettingsTab)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        activeTab === tab.id
                          ? ""
                          : "opacity-70 group-hover:opacity-100"
                      )}
                    />
                    {tab.label}
                    {activeTab === tab.id && (
                      <ChevronRight className="ml-auto w-3.5 h-3.5 opacity-50" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 flex flex-col bg-background">
              <DialogHeader className="px-8 pt-8 pb-4 shrink-0">
                <DialogTitle className="text-2xl font-bold tracking-tight">
                  {tabs.find((t) => t.id === activeTab)?.label}
                </DialogTitle>
                <DialogDescription>
                  Customize your{" "}
                  {activeTab === "general" ? "application" : activeTab}{" "}
                  experience.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-8 py-4 custom-scrollbar">
                <div className="space-y-8 animate-in fade-in duration-300">
                  {activeTab === "general" && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          App Behavior
                        </Label>
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20 hover:bg-muted/30 transition-colors">
                          <div className="space-y-0.5">
                            <Label
                              htmlFor="addPrefix"
                              className="text-sm font-semibold"
                            >
                              Number Videos in Playlists
                            </Label>
                            <p className="text-xs text-muted-foreground max-w-[280px]">
                              Prefix files with &quot;01 - &quot;, &quot;02 -
                              &quot;, etc.
                            </p>
                          </div>
                          <Checkbox
                            id="addPrefix"
                            checked={addPrefix}
                            onCheckedChange={(checked) =>
                              setAddPrefix(checked as boolean)
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Engine Maintenance
                        </Label>
                        <div className="p-4 rounded-xl border bg-muted/20 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label className="text-sm font-semibold">
                                yt-dlp Core
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Extracting & Downloading Engine
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleUpdateEngine}
                              disabled={updatingEngine || saving}
                              className="h-8"
                            >
                              {updatingEngine ? (
                                <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                              )}
                              Check Updates
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "downloader" && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Injection & Post-Processing
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="embedMetadata"
                                className="text-sm font-semibold"
                              >
                                Embed Metadata
                              </Label>
                              <p className="text-[10px] text-muted-foreground">
                                Add file tags
                              </p>
                            </div>
                            <Checkbox
                              id="embedMetadata"
                              checked={embedMetadata}
                              onCheckedChange={(c) =>
                                setEmbedMetadata(c as boolean)
                              }
                            />
                          </div>
                          <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                            <div className="space-y-0.5">
                              <Label
                                htmlFor="embedThumbnail"
                                className="text-sm font-semibold"
                              >
                                Embed Thumbnail
                              </Label>
                              <p className="text-[10px] text-muted-foreground">
                                Cover art (MP3/MP4)
                              </p>
                            </div>
                            <Checkbox
                              id="embedThumbnail"
                              checked={embedThumbnail}
                              onCheckedChange={(c) =>
                                setEmbedThumbnail(c as boolean)
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Network Performance
                        </Label>
                        <div className="p-5 rounded-xl border bg-muted/20 space-y-6">
                          <div className="space-y-3">
                            <div className="flex justify-between items-end">
                              <Label className="text-sm font-semibold">
                                Parallel Connections
                              </Label>
                              <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded">
                                {concurrentFragments}x Stream
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="16"
                              step="1"
                              value={concurrentFragments}
                              onChange={(e) =>
                                setConcurrentFragments(Number(e.target.value))
                              }
                              className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                            />
                            <p className="text-[10px] text-muted-foreground italic">
                              Higher values = Faster speed, Higher CPU usage.
                              Default is 4.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "appearance" && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Display Mode
                        </Label>
                        <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                          <div className="space-y-0.5">
                            <Label
                              htmlFor="oledMode"
                              className="text-sm font-semibold"
                            >
                              OLED Optimization
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              True #000000 background for dark mode.
                            </p>
                          </div>
                          <Checkbox
                            id="oledMode"
                            checked={oledMode}
                            onCheckedChange={(c) => setOledMode(c as boolean)}
                          />
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Branding Accent
                        </Label>
                        <div className="p-4 rounded-xl border bg-muted/20">
                          <div className="flex flex-wrap gap-3">
                            {[
                              { name: "Slate", value: "" },
                              { name: "Amber", value: "25 95% 53%" },
                              { name: "Sky", value: "217 91% 60%" },
                              { name: "Emerald", value: "142 77% 42%" },
                              { name: "Rose", value: "0 100% 50%" },
                              { name: "Violet", value: "262 83% 58%" },
                            ].map((color) => (
                              <button
                                key={color.name}
                                onClick={() => setAccentColor(color.value)}
                                className={cn(
                                  "w-10 h-10 rounded-xl border-2 transition-all flex items-center justify-center",
                                  accentColor === color.value
                                    ? "border-primary scale-110 shadow-lg ring-4 ring-primary/20"
                                    : "border-transparent hover:scale-105 hover:border-muted-foreground/30"
                                )}
                                style={{
                                  backgroundColor:
                                    color.value === ""
                                      ? "hsl(240 5.9% 10%)"
                                      : `hsl(${color.value})`,
                                }}
                                title={color.name}
                              >
                                {accentColor === color.value && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "advanced" && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Network Routing
                          </Label>
                          <Globe className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
                        </div>
                        <div className="space-y-2">
                          <Input
                            placeholder="Proxy URL (e.g. http://127.0.0.1:1080)"
                            value={proxy}
                            onChange={(e) => setProxy(e.target.value)}
                            className="h-10 bg-muted/20"
                          />
                          <p className="text-[10px] text-muted-foreground px-1">
                            Supports HTTP, HTTPS, or SOCKS4/5.
                          </p>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div className="flex items-center justify-between font-bold text-xs uppercase tracking-wider text-muted-foreground">
                          <span>Authentication Bridge</span>
                          <ShieldCheck className="w-3.5 h-3.5 opacity-50" />
                        </div>
                        <div className="space-y-3">
                          <Textarea
                            placeholder="Paste Netscape cookie file content here..."
                            className="h-[120px] font-mono text-[10px] bg-muted/20 custom-scrollbar resize-none"
                            value={cookies}
                            onChange={(e) => setCookies(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleClear}
                              disabled={clearing || saving}
                              className="h-8 text-destructive border-destructive/20 hover:bg-destructive/10"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Clear All
                              Stored Data
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="px-8 py-6 bg-muted/10 border-t flex items-center justify-between gap-4 shrink-0">
                <span className="hidden sm:inline text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-50">
                  MediaPull Pro Hub
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="ghost"
                    onClick={() => setOpen(false)}
                    disabled={saving}
                    className="h-9 px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-9 px-8 shadow-lg shadow-primary/20"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />{" "}
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Apply Changes
                      </>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Clear stored cookies?</DialogTitle>
            <DialogDescription>
              This will remove all authentication cookies and you may need to
              re-authenticate for some sites.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
              disabled={clearing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={actualClear}
              disabled={clearing}
            >
              {clearing ? "Clearing..." : "Clear Everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
