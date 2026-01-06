"use client";

import { useState } from "react";
import { Settings, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.settings.saveCookies(cookies);

      toast.success("Cookies saved successfully!");
      setOpen(false);
    } catch (error) {
      console.error("Error saving cookies:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save cookies"
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

          <div className="grid gap-2">
            <Label htmlFor="cookies" className="text-left">
              YouTube Cookies (Netscape Format)
            </Label>
            <p className="text-xs text-muted-foreground">
              Required for Members-Only videos. Paste the content of your
              cookies.txt file here. Use an extension like &quot;Get cookies.txt
              locally&quot; to export them.
            </p>
            <Textarea
              id="cookies"
              placeholder="# Netscape HTTP Cookie File
.youtube.com	TRUE	/	TRUE	1735999999	VISITOR_INFO1_LIVE	..."
              className="h-[200px] font-mono text-xs"
              value={cookies}
              onChange={(e) => setCookies(e.target.value)}
            />
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
            <Button
              onClick={handleSave}
              disabled={saving || !cookies || clearing}
            >
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
