import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
  onDownload: (formatId: string) => void;
}

export default function FormatSelector({
  formats,
  onDownload,
}: FormatSelectorProps) {
  const usefulFormats = formats
    .filter((f) => f.vcodec !== "none" && f.ext !== "mhtml")
    .sort((a, b) => {
      const resA = parseInt(a.resolution?.split("x")[1] || "0") || 0;
      const resB = parseInt(b.resolution?.split("x")[1] || "0") || 0;
      return resB - resA;
    });

  const uniqueFormats = usefulFormats.filter(
    (v, i, a) =>
      a.findIndex(
        (t) =>
          (t.format_note === v.format_note || t.resolution === v.resolution) &&
          t.ext === v.ext
      ) === i
  );

  return (
    <Card className="w-full max-w-lg mx-auto mt-6 shadow-xl">
      <CardHeader>
        <CardTitle className="text-center text-lg font-medium">
          Select Download Quality
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={() => onDownload("best")}
            className="w-full shadow-md"
            size="lg"
          >
            Highest Quality
          </Button>
          <Button
            onClick={() => onDownload("bestaudio")}
            variant="secondary"
            className="w-full shadow-sm"
            size="lg"
          >
            Audio Only
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              Or choose specific format
            </span>
          </div>
        </div>

        <Select onValueChange={onDownload}>
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
      </CardContent>
    </Card>
  );
}
