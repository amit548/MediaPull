import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, Clipboard, Globe } from "lucide-react";
import { toast } from "sonner";

interface SearchBarProps {
  onSearch: (url: string) => void;
  isLoading: boolean;
}

export default function SearchBar({ onSearch, isLoading }: SearchBarProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSearch(url.trim());
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
        toast.success("URL pasted from clipboard");
      }
    } catch {
      toast.error("Could not access clipboard");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto mb-10">
      <div className="relative group transition-all duration-300">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Link2 className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>

        <Input
          type="text"
          placeholder="Paste Video, Music, or Playlist URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={isLoading}
          className="w-full h-14 pl-12 pr-32 text-lg bg-background/50 border-2 border-border/50 focus:border-primary/50 rounded-2xl shadow-md backdrop-blur-sm transition-all"
        />

        <div className="absolute inset-y-0 right-2 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePaste}
            disabled={isLoading}
            className="h-10 px-3 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-xl transition-all"
            title="Paste from clipboard"
          >
            <Clipboard className="h-4 w-4 mr-2" />
            <span className="text-xs font-semibold">Paste</span>
          </Button>

          <Button
            type="submit"
            disabled={isLoading || !url.trim()}
            size="sm"
            className="h-10 px-6 rounded-xl shadow-md shadow-primary/20 active:scale-95 transition-all"
          >
            {isLoading ? <Globe className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      </div>

      <p className="mt-4 text-center text-[10px] text-muted-foreground uppercase tracking-widest opacity-40">
        Supports YouTube, Twitch, Instagram, Twitter & 1000+ more
      </p>
    </form>
  );
}
