import express, { Request, Response } from "express";
import cors from "cors";
import youtubedl from "youtube-dl-exec";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

interface YtFlags {
  dumpSingleJson?: boolean;
  noWarnings?: boolean;
  preferFreeFormats?: boolean;
  flatPlaylist?: boolean;
  extractorArgs?: string;
  [key: string]: boolean | string | undefined | number;
}

app.post("/api/settings/cookies", (req: Request, res: Response) => {
  const { content } = req.body;
  if (typeof content !== "string") {
    res.status(400).json({ error: "Invalid content" });
    return;
  }

  const cookiePath = path.join(process.cwd(), "cookies.txt");

  try {
    if (!content.trim()) {
      if (fs.existsSync(cookiePath)) {
        fs.unlinkSync(cookiePath);
      }
    } else {
      fs.writeFileSync(cookiePath, content);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to save cookies:", err);
    res.status(500).json({ error: "Failed to save cookies" });
  }
});

const getCookiePath = () => {
  const cookiePath = path.join(process.cwd(), "cookies.txt");
  return fs.existsSync(cookiePath) ? cookiePath : undefined;
};

const formatYtDlpError = (stderr: string, defaultMessage: string) => {
  console.error("yt-dlp stderr:", stderr);

  if (stderr.includes("Video unavailable")) {
    return "This video is unavailable (it may have been deleted or terminated).";
  }
  if (stderr.includes("Private video")) {
    return "This is a private video. Please provide valid cookies for access.";
  }
  if (stderr.includes("Join this channel to get access")) {
    return "This is a members-only video. Please provide cookies with an active membership.";
  }
  if (stderr.includes("Incomplete YouTube URL")) {
    return "The provided URL is incomplete or invalid.";
  }
  if (stderr.includes("Sign in to confirm your age")) {
    return "This content is age-restricted. Please provide cookies to verify your age.";
  }
  if (stderr.includes("Sign in to see more")) {
    return "Authentication required. Please provide cookies to access this content.";
  }
  if (stderr.includes("Playlists that require authentication")) {
    return "This playlist requires authentication/cookies to be extracted.";
  }

  const match = stderr.match(/ERROR: (.*)/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return defaultMessage;
};

app.get("/api/info", async (req: Request, res: Response) => {
  const url = req.query.url as string;

  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  try {
    let binaryPath = path.join(
      process.cwd(),
      "node_modules",
      "youtube-dl-exec",
      "bin",
      "yt-dlp.exe"
    );

    if (!fs.existsSync(binaryPath)) {
      binaryPath = path.join(
        process.cwd(),
        "../../node_modules",
        "youtube-dl-exec",
        "bin",
        "yt-dlp.exe"
      );
    }

    const ytExec = youtubedl as unknown as {
      create: (
        path: string
      ) => (url: string, flags: YtFlags) => Promise<unknown>;
    };
    const yt = ytExec.create(binaryPath);

    const cookies = getCookiePath();
    if (cookies) {
      console.log("Using cookies from:", cookies);
    }

    const output = await yt(url, {
      dumpSingleJson: true,
      noWarnings: true,
      preferFreeFormats: true,
      flatPlaylist: true,
      extractorArgs: "youtubetab:skip=authcheck",
      cookies: cookies,
    });

    res.json(output);
  } catch (error: any) {
    let errorMessage = "Failed to fetch video info";

    if (error.stderr) {
      errorMessage = formatYtDlpError(error.stderr.toString(), errorMessage);
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error("Error fetching video info:", error);
    res.status(500).json({ error: errorMessage });
  }
});

app.get("/api/download", async (req: Request, res: Response) => {
  const url = req.query.url as string;
  const format = (req.query.format as string) || "best";

  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  let binaryPath = path.join(
    process.cwd(),
    "node_modules",
    "youtube-dl-exec",
    "bin",
    "yt-dlp.exe"
  );

  if (!fs.existsSync(binaryPath)) {
    binaryPath = path.join(
      process.cwd(),
      "../../node_modules",
      "youtube-dl-exec",
      "bin",
      "yt-dlp.exe"
    );
  }

  if (!fs.existsSync(binaryPath)) {
    res.status(500).json({ error: "yt-dlp binary not found" });
    return;
  }

  const title = (req.query.title as string) || "video";
  console.log(`Downloading: ${url}, Title: ${title}, Format: ${format}`);

  let sanitizedTitle = title.replace(/\s*[<>:"/\\|?*]+\s*/g, "_").trim();

  if (!sanitizedTitle) {
    sanitizedTitle = "video_download";
  }

  let ext = "mp4";
  if (format.includes("audio")) {
    ext = "mp3";
  }

  console.log(`[DEBUG] Final Sanitized Filename: ${sanitizedTitle}.${ext}`);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${sanitizedTitle}.${ext}"`
  );

  const cookies = getCookiePath();
  const args = [
    "-f",
    format,
    "-o",
    "-",
    "--extractor-args",
    "youtubetab:skip=authcheck",
    url,
  ];
  if (cookies) {
    console.log("Using cookies for download");
    args.push("--cookies", cookies);
  }

  const child = spawn(binaryPath, args);

  child.stdout.pipe(res);

  let lastError = "";
  child.stderr.on("data", (data) => {
    const msg = data.toString();
    console.error(`yt-dlp stderr: ${msg}`);
    lastError = msg;
  });

  child.on("error", (err) => {
    console.error("yt-dlp error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Download process failed to start" });
    }
  });

  child.on("close", (code) => {
    if (code !== 0 && !res.headersSent) {
      const errorMessage = formatYtDlpError(lastError, "Download failed");
      res.status(500).json({ error: errorMessage });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
