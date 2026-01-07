"use client";

import { useState, useEffect } from "react";
import { Settings, Save, Trash2, Globe, RefreshCw, Cpu } from "lucide-react";
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

import { api } from "@/lib/api";

interface SettingsDialogProps {
  addPrefix: boolean;
  setAddPrefix: (val: boolean) => void;
  concurrentFragments: number;
  setConcurrentFragments: (val: number) => void;
}

export default function SettingsDialog({
  addPrefix,
  setAddPrefix,
  concurrentFragments,
  setConcurrentFragments,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [cookies, setCookies] = useState("");
  const [proxy, setProxy] = useState("");
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [updatingEngine, setUpdatingEngine] = useState(false);

  useEffect(() => {
    if (open) {
      // Fetch current settings
      const load = async () => {
        try {
          const p = await api.settings.get("proxy");
          if (p) setProxy(p);
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

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear all stored cookies?")) return;

    setClearing(true);
    try {
      await api.settings.saveCookies("");

      setCookies("");
      toast.success("Cookies cleared successfully!");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure global settings for the downloader.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center space-x-2 border-b pb-4 mb-2">
            <Checkbox
              id="addPrefix"
              checked={addPrefix}
              onCheckedChange={(checked: boolean) =>
                setAddPrefix(checked as boolean)
              }
            />
            <div className="grid gap-1.5 leading-none">
              <label
                htmlFor="addPrefix"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Number Videos in Playlists
              </label>
              <p className="text-sm text-muted-foreground">
                Prefix downloaded video files with &quot;01 - &quot;, &quot;02 -
                &quot;, etc.
              </p>
            </div>
          </div>

          <div className="grid gap-2 border-b pb-4 mb-2">
            <Label htmlFor="fragments" className="text-left">
              Download Speed / Parallel Connections
            </Label>
            <div className="flex items-center gap-4">
              <input
                id="fragments"
                type="range"
                min="1"
                max="16"
                step="1"
                value={concurrentFragments}
                onChange={(e) => setConcurrentFragments(Number(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="font-mono text-sm w-8 text-right">
                {concurrentFragments}x
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Higher values increase speed but use more CPU/Bandwidth. Default
              is 4.
            </p>
          </div>

          <div className="grid gap-2 border-b pb-4 mb-2">
            <Label htmlFor="proxy" className="flex items-center gap-2">
              <Globe className="w-4 h-4" /> Global Proxy (Optional)
            </Label>
            <Input
              id="proxy"
              placeholder="e.g. http://127.0.0.1:1080"
              value={proxy}
              onChange={(e) => setProxy(e.target.value)}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">
              Used for all downloads and info requests. Supports HTTP, HTTPS, or
              SOCKS proxies.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="cookies" className="text-left">
              Platform Cookies (Netscape Format)
            </Label>
            <p className="text-xs text-muted-foreground">
              Required for restricted or private content (e.g., Members-only,
              Instagram, etc.). Paste the content of your cookies.txt file here.
            </p>
            <Textarea
              id="cookies"
              placeholder="# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1735999999	VISITOR_INFO1_LIVE	...
.instagram.com	TRUE	/	TRUE	... "
              className="h-[200px] font-mono text-xs"
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
            />
          </div>

          <div className="grid gap-2 border-b pb-4 mb-2">
            <Label className="flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Downloader Engine
            </Label>
            <div className="flex items-center justify-between gap-4 bg-muted/30 p-2 rounded-md border border-border/50">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">yt-dlp Engine</span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  Used for extracting & downloading
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUpdateEngine}
                disabled={updatingEngine || saving}
                className="h-8 shadow-sm"
              >
                {updatingEngine ? (
                  <>
                    <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Check for Updates
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Keeping the engine updated ensures compatibility with site
              changes.
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col items-stretch sm:items-end gap-3 sm:gap-2">
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={clearing || saving}
              className="text-destructive hover:bg-destructive/10"
            >
              {clearing ? (
                "Clearing..."
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" /> Clear Stored Cookies
                </>
              )}
            </Button>
            <Button onClick={handleSave} disabled={saving || clearing}>
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Settings
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
