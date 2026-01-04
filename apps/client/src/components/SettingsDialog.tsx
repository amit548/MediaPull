"use client";

import { useState } from "react";
import { Settings, Save } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [cookies, setCookies] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("http://localhost:4000/api/settings/cookies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: cookies }),
      });

      if (!res.ok) {
        let errorMessage = "Failed to save cookies";
        try {
          const text = await res.text();
          if (text) {
            try {
              const json = JSON.parse(text);
              if (json.error) errorMessage = json.error;
              else errorMessage = text;
            } catch {
              if (text.trim().startsWith("<")) {
                errorMessage = `Server Error (${res.status}): Please restart the backend server to apply updates.`;
              } else {
                errorMessage =
                  text.slice(0, 100) + (text.length > 100 ? "..." : "");
              }
            }
          }
        } catch (e) {
          console.error("Error reading error response:", e);
        }
        throw new Error(errorMessage);
      }

      setStatus({ type: "success", message: "Cookies saved successfully!" });
      setTimeout(() => setOpen(false), 1500);
    } catch (error) {
      console.error("Error saving cookies:", error);
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to save cookies",
      });
    } finally {
      setSaving(false);
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
        <DialogFooter className="flex-col items-end! gap-2">
          {status && (
            <div
              className={`text-sm font-medium ${
                status.type === "success"
                  ? "text-green-600"
                  : "text-destructive"
              }`}
            >
              {status.message}
            </div>
          )}
          <Button onClick={handleSave} disabled={saving || !cookies}>
            {saving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Settings
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
