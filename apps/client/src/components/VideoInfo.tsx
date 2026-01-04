import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PlayCircle, CheckCircle2 } from "lucide-react";
import Image from "next/image";

interface VideoFormat {
  format_id: string;
  format_note?: string;
  ext: string;
  resolution?: string;
  filesize?: number;
}

interface VideoData {
  title: string;
  thumbnail: string;
  id?: string;
  duration_string?: string;
  uploader?: string;
  formats?: VideoFormat[];
  entries?: VideoData[];
}

interface VideoInfoProps {
  data: VideoData;
}

export default function VideoInfo({ data }: VideoInfoProps) {
  const isPlaylist = !!data.entries;

  return (
    <Card className="w-full max-w-2xl mx-auto overflow-hidden shadow-2xl py-0 gap-0 animate-scale-in">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <div className="relative w-full md:w-72 aspect-video md:aspect-auto bg-muted">
            {(data.thumbnail || data.id) && (
              <Image
                src={
                  data.thumbnail ||
                  `https://i.ytimg.com/vi/${data.id}/hqdefault.jpg`
                }
                alt={data.title}
                fill
                className="object-cover"
                unoptimized
              />
            )}
            {data.duration_string && (
              <div className="absolute bottom-2 right-2">
                <Badge variant="secondary" className="shadow-sm">
                  {data.duration_string}
                </Badge>
              </div>
            )}
          </div>

          <div className="p-6 flex flex-col justify-center flex-1 space-y-3">
            <div>
              <h2 className="text-xl font-bold leading-tight line-clamp-2">
                {data.title}
              </h2>
              <p className="text-muted-foreground text-sm mt-1 font-medium">
                {data.uploader}
              </p>
            </div>

            <div className="pt-2">
              {isPlaylist ? (
                <Badge variant="default" className="gap-1.5">
                  <PlayCircle className="w-3.5 h-3.5" />
                  Playlist: {data.entries?.length} videos
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ready to Download
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
