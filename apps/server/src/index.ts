import express, { Request, Response } from "express";
import cors from "cors";
import youtubedl from "youtube-dl-exec";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import archiver from "archiver";
import os from "os";

const app = express();
const PORT = 4000;

app.use(
  cors({
    origin: "*",
    exposedHeaders: ["Content-Disposition"],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

interface YtFlags {
  dumpSingleJson?: boolean;
  noWarnings?: boolean;
  preferFreeFormats?: boolean;
  flatPlaylist?: boolean;
  extractorArgs?: string;
  [key: string]: boolean | string | undefined | number;
}

interface JobFile {
  url: string;
  title: string;
  filename: string;
  status: "pending" | "downloading" | "completed" | "error";
  progress?: number;
}

interface Job {
  id: string;
  playlistName: string;
  format: string;
  concurrentFragments: number;
  addPrefix: boolean;
  tempDir: string;
  files: JobFile[];
  status: "idle" | "downloading" | "paused" | "completed" | "error" | "zipping";
  error?: string;
  createdAt: number;
  progress: {
    total: number;
    completed: number;
    currentFileIndex: number;
    currentSpeed?: string;
  };
}

const jobs = new Map<string, Job>();

const getCookiePath = () => {
  const cookiePath = path.join(process.cwd(), "cookies.txt");
  return fs.existsSync(cookiePath) ? cookiePath : undefined;
};

const formatYtDlpError = (stderr: string, defaultMessage: string) => {
  console.error("yt-dlp stderr:", stderr);
  if (stderr.includes("Video unavailable"))
    return "This video is unavailable (deleted/terminated).";
  if (stderr.includes("Private video"))
    return "Private video. Provide cookies.";
  if (stderr.includes("Join this channel"))
    return "Members-only video. Provide cookies.";
  if (stderr.includes("Sign in to confirm your age"))
    return "Age-restricted. Provide cookies.";
  const match = stderr.match(/ERROR: (.*)/);
  return match && match[1] ? match[1].trim() : defaultMessage;
};

const sanitizeFilename = (name: string) => {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
};

const sanitizeTitle = (title: string, index: number) => {
  let sanitized = title.replace(/\s*[<>:"/\\|?*]+\s*/g, "_").trim();
  return sanitized || `video_${index}`;
};

const processJob = async (jobId: string) => {
  const job = jobs.get(jobId);
  if (!job) return;

  if (job.status === "downloading") return;
  job.status = "downloading";

  console.log(`[JOB ${jobId}] Starting/Resuming processing...`);

  const binaryPath = path.join(
    process.cwd(),
    "node_modules",
    "youtube-dl-exec",
    "bin",
    "yt-dlp.exe"
  );

  let finalBinaryPath = fs.existsSync(binaryPath)
    ? binaryPath
    : path.join(
        process.cwd(),
        "../../node_modules/youtube-dl-exec/bin/yt-dlp.exe"
      );

  if (!fs.existsSync(finalBinaryPath)) {
    job.status = "error";
    job.error = "yt-dlp binary not found";
    return;
  }

  const cookies = getCookiePath();

  try {
    for (let i = 0; i < job.files.length; i++) {
      if ((job.status as string) === "paused") {
        console.log(`[JOB ${jobId}] Paused by user.`);
        break;
      }

      const file = job.files[i];

      if (file.status === "completed") {
        continue;
      }

      const filePath = path.join(job.tempDir, file.filename);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        console.log(`[JOB ${jobId}] File exists, skipping: ${file.filename}`);
        file.status = "completed";
        job.progress.completed++;
        job.progress.currentFileIndex = i + 1;
        continue;
      }

      file.status = "downloading";
      job.progress.currentFileIndex = i;

      console.log(
        `[JOB ${jobId}] Downloading ${i + 1}/${job.files.length}: ${
          file.filename
        }`
      );

      const args = [
        "-f",
        job.format,
        "-o",
        filePath,
        "-N",
        String(job.concurrentFragments),
        "-P",
        `temp:${os.tmpdir()}`,
        "--extractor-args",
        "youtubetab:skip=authcheck",
        file.url,
      ];

      if (cookies) args.push("--cookies", cookies);

      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn(finalBinaryPath, args);

          child.stdout.on("data", (data) => {
            const output = data.toString();
            const speedMatch = output.match(/at\s+([0-9.]+\w+\/s)/);
            if (speedMatch && speedMatch[1]) {
              job.progress.currentSpeed = speedMatch[1];
            }
          });

          child.stderr.on("data", (data) => {});

          child.on("close", (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Exit code ${code}`));
          });

          child.on("error", (err) => reject(err));
        });

        if (fs.existsSync(filePath)) {
          file.status = "completed";
          job.progress.completed++;
        } else {
          file.status = "error";
          console.error(
            `[JOB ${jobId}] File missing after success: ${file.filename}`
          );
        }
      } catch (err) {
        console.error(`[JOB ${jobId}] Failed ${file.filename}:`, err);
        file.status = "error";
      }
    }

    if ((job.status as string) !== "paused") {
      const allComplete = job.files.every((f) => f.status === "completed");
      if (allComplete) {
        job.status = "completed";
        console.log(`[JOB ${jobId}] All files completed.`);
      } else {
        job.status = "idle";
        console.log(`[JOB ${jobId}] Job finished loop with some errors.`);
      }
    }
  } catch (err) {
    console.error(`[JOB ${jobId}] Fatal error:`, err);
    job.status = "error";
    job.error = String(err);
  }
};

app.post("/api/batch/init", (req: Request, res: Response) => {
  const {
    urls,
    titles,
    format = "best",
    playlistName,
    addPrefix,
    concurrentFragments = 4,
  } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: "No URLs provided" });
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const tempDir = path.join(os.tmpdir(), `mediapull_job_${id}`);

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const files: JobFile[] = urls.map((url: string, index: number) => {
    const rawTitle = titles[index] || `video_${index}`;
    let ext = format.includes("audio") ? "mp3" : "mp4";

    let filename = `${sanitizeTitle(rawTitle, index)}.${ext}`;
    if (String(addPrefix) === "true") {
      filename = `${String(index + 1).padStart(2, "0")} - ${filename}`;
    }

    return {
      url,
      title: rawTitle,
      filename,
      status: "pending",
    };
  });

  const job: Job = {
    id,
    playlistName: playlistName || "mediapull_batch",
    format,
    concurrentFragments: Number(concurrentFragments),
    addPrefix: String(addPrefix) === "true",
    tempDir,
    files,
    status: "idle",
    createdAt: Date.now(),
    progress: {
      total: files.length,
      completed: 0,
      currentFileIndex: 0,
    },
  };

  jobs.set(id, job);

  res.json({ jobId: id });
});

app.post("/api/batch/resume/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const job = jobs.get(id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status === "downloading") {
    res.json({ success: true, message: "Already running" });
    return;
  }

  processJob(id);

  res.json({ success: true, status: "started" });
});

app.post("/api/batch/pause/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const job = jobs.get(id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status === "downloading") {
    job.status = "paused";
  }

  res.json({ success: true, status: job.status });
});

app.get("/api/batch/status/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const job = jobs.get(id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    files: job.files.map((f) => ({ filename: f.filename, status: f.status })),
  });
});

app.get("/api/batch/zip/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const job = jobs.get(id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const zipFilename = `${sanitizeFilename(job.playlistName)}.zip`;
  const encodedZipFilename = encodeURIComponent(zipFilename);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodedZipFilename}"; filename*=UTF-8''${encodedZipFilename}`
  );

  const archive = archiver("zip", { zlib: { level: 5 } });
  archive.pipe(res);

  let addedCount = 0;
  for (const file of job.files) {
    if (file.status === "completed") {
      const filePath = path.join(job.tempDir, file.filename);
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: file.filename });
        addedCount++;
      }
    }
  }

  if (addedCount === 0) {
    archive.append("No files downloaded successfully.", { name: "error.txt" });
  }

  await archive.finalize();
});

app.post("/api/settings/cookies", (req: Request, res: Response) => {
  const { content } = req.body;
  if (typeof content !== "string") {
    res.status(400).json({ error: "Invalid content" });
    return;
  }
  const cookiePath = path.join(process.cwd(), "cookies.txt");
  try {
    if (!content.trim()) {
      if (fs.existsSync(cookiePath)) fs.unlinkSync(cookiePath);
    } else {
      fs.writeFileSync(cookiePath, content);
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to save cookies:", err);
    res.status(500).json({ error: "Failed to save cookies" });
  }
});

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
    if (!fs.existsSync(binaryPath))
      binaryPath = path.join(
        process.cwd(),
        "../../node_modules/youtube-dl-exec/bin/yt-dlp.exe"
      );

    const ytExec = youtubedl as unknown as {
      create: (
        path: string
      ) => (url: string, flags: YtFlags) => Promise<unknown>;
    };
    const yt = ytExec.create(binaryPath);
    const cookies = getCookiePath();

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
    if (error.stderr)
      errorMessage = formatYtDlpError(error.stderr.toString(), errorMessage);
    else if (error instanceof Error) errorMessage = error.message;
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
  if (!fs.existsSync(binaryPath))
    binaryPath = path.join(
      process.cwd(),
      "../../node_modules/youtube-dl-exec/bin/yt-dlp.exe"
    );

  if (!fs.existsSync(binaryPath)) {
    res.status(500).json({ error: "yt-dlp binary not found" });
    return;
  }

  const title = (req.query.title as string) || "video";
  let sanitizedTitle =
    title.replace(/\s*[<>:"/\\|?*]+\s*/g, "_").trim() || "video_download";
  let ext = format.includes("audio") ? "mp3" : "mp4";
  const fullFilename = `${sanitizedTitle}.${ext}`;
  const encodedFilename = encodeURIComponent(fullFilename);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
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
  if (cookies) args.push("--cookies", cookies);

  const child = spawn(binaryPath, args);
  child.stdout.pipe(res);

  let lastError = "";
  child.stderr.on("data", (data) => {
    lastError = data.toString();
    console.error(`yt-dlp stderr: ${lastError}`);
  });
  child.on("close", (code) => {
    if (code !== 0 && !res.headersSent) {
      res
        .status(500)
        .json({ error: formatYtDlpError(lastError, "Download failed") });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
