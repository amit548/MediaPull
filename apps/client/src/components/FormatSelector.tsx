import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Download } from "lucide-react";

interface VideoFormat {
  format_id: string;
  format_note?: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
}

interface FormatSelectorProps {
  formats: VideoFormat[];
  onDownload: (formatId: string, targetExt?: string) => void;
}

export default function FormatSelector({
  formats,
  onDownload,
}: FormatSelectorProps) {
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [targetExt, setTargetExt] = useState<string>("auto");

  const usefulFormats = formats
    .filter((f) => f.vcodec !== "none" && f.ext !== "mhtml")
    .sort((a, b) => {
      const getRes = (res?: string) => {
        if (!res) return 0;
        if (res.includes("x")) {
          return parseInt(res.split("x")[1]) || 0;
        }
        return parseInt(res) || 0;
      };
      return getRes(b.resolution) - getRes(a.resolution);
    });

  const uniqueFormats = usefulFormats.filter(
    (v, i, a) =>
      a.findIndex(
        (t) =>
          t.format_note === v.format_note &&
          t.resolution === v.resolution &&
          t.ext === v.ext
      ) === i
  );

  return (
    <Card className="w-full max-lg mx-auto mt-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader className="pb-4">
        <CardTitle className="text-center text-lg font-medium">
          Download Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() =>
              onDownload("best", targetExt !== "auto" ? targetExt : undefined)
            }
            className="w-full shadow-md hover:scale-105 transition-transform"
            size="lg"
          >
            Highest Quality
          </Button>
          <Button
            onClick={() =>
              onDownload(
                "bestaudio",
                targetExt !== "auto" ? targetExt : undefined
              )
            }
            variant="secondary"
            className="w-full shadow-sm hover:scale-105 transition-transform"
            size="lg"
          >
            Audio Only
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase font-semibold">
            Target Container / Conversion
          </Label>
          <Select value={targetExt} onValueChange={setTargetExt}>
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Original Container" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Original / Auto</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="mp4">Video: MP4 (Recommended)</SelectItem>
              <SelectItem value="mkv">Video: MKV</SelectItem>
              <SelectItem value="webm">Video: WebM</SelectItem>
              <Separator className="my-1" />
              <SelectItem value="mp3">Audio: MP3</SelectItem>
              <SelectItem value="flac">Audio: FLAC</SelectItem>
              <SelectItem value="wav">Audio: WAV</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or Choose Specific Format
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <Select onValueChange={setSelectedFormat}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select specific resolution/format" />
            </SelectTrigger>
            <SelectContent>
              {uniqueFormats.map((f) => (
                <SelectItem key={f.format_id} value={f.format_id}>
                  <span className="font-medium">
                    {f.resolution || f.format_note}
                  </span>{" "}
                  <span className="text-muted-foreground text-xs ml-1">
                    ({f.ext.toUpperCase()})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedFormat && (
            <Button
              onClick={() =>
                onDownload(
                  selectedFormat,
                  targetExt !== "auto" ? targetExt : undefined
                )
              }
              className="w-full animate-in zoom-in-95 fade-in duration-300 gap-2"
              variant="default"
              size="lg"
            >
              <Download className="w-4 h-4" />
              Download Selected Quality
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
