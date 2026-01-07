import path from "path";
import fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { app, BrowserWindow, shell } from "electron";

import { dbStore } from "./Database";

const LEGACY_JSON_PATH = path.join(app.getPath("userData"), "jobs.json");

interface JobFile {
  url: string;
  title: string;
  filename: string;
  status: "pending" | "downloading" | "completed" | "error";
}

export interface Job {
  id: string;
  playlistName: string;
  format: string;
  concurrentFragments: number;
  addPrefix: boolean;
  tempDir: string;
  files: JobFile[];
  status: "idle" | "downloading" | "paused" | "completed" | "error";
  createdAt: number;
  progress: {
    total: number;
    completed: number;
    currentFileIndex: number;
    currentSpeed?: string;
    currentFileSize?: string;
    currentFileTotalSize?: string;
    currentFilePercent?: number;
  };
}

export const jobs = new Map<string, Job>();

try {
  if (fs.existsSync(LEGACY_JSON_PATH)) {
    const data = fs.readFileSync(LEGACY_JSON_PATH, "utf-8");
    const legacyJobs = JSON.parse(data);
    for (const j of legacyJobs) {
      if (!dbStore.getJob(j.id)) {
        dbStore.insertJob(j);
      }
    }
    fs.renameSync(LEGACY_JSON_PATH, LEGACY_JSON_PATH + ".bak");
  }
} catch (e) {
  console.error("Migration failed:", e);
}

const activeProcesses = new Map<string, ChildProcess>();

function saveJob(job: Job) {
  const exists = dbStore.getJob(job.id);
  if (exists) {
    dbStore.updateJob(job);
  } else {
    dbStore.insertJob(job);
  }
}

function getYtDlpPath() {
  const platform = process.platform;
  let binName = "yt-dlp";
  if (platform === "win32") {
    binName = "yt-dlp.exe";
  } else if (platform === "darwin") {
    binName = "yt-dlp_macos";
  }

  const binPath = app.isPackaged
    ? path.join(process.resourcesPath, "bin", binName)
    : path.join(app.getAppPath(), "bin", binName);

  return binPath;
}

function getCookiePath() {
  const p = path.join(app.getPath("userData"), "cookies.txt");
  return fs.existsSync(p) ? p : undefined;
}

function sanitizeTitle(title: string, index: number) {
  const t = title.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  return t || `video_${index}`;
}

export async function processJob(win: BrowserWindow, jobId: string) {
  let job = jobs.get(jobId);
  if (!job) {
    job = dbStore.getJob(jobId);
    if (job) jobs.set(jobId, job);
  }

  if (!job || job.status === "downloading") return;

  job.status = "downloading";
  saveJob(job);

  const binary = getYtDlpPath();
  const cookies = getCookiePath();

  if (!fs.existsSync(binary)) {
    console.error("yt-dlp binary not found at:", binary);
    job.status = "error";
    saveJob(job);
    win.webContents.send("batch:progress", job);
    return;
  }

  let startIndex = job.files.findIndex((f) => f.status !== "completed");
  if (startIndex === -1 && job.files.length > 0) {
    startIndex = 0;
  }

  job.progress.currentFileIndex = startIndex;
  job.progress.completed = startIndex;

  for (let i = startIndex; i < job.files.length; i++) {
    const file = job.files[i];

    if ((job as Job).status === "paused") break;

    file.status = "downloading";
    job.progress.currentFileIndex = i;
    win.webContents.send("batch:progress", job);
    saveJob(job);

    const incompleteDir = path.join(job.tempDir, ".incomplete");
    if (!fs.existsSync(incompleteDir)) {
      fs.mkdirSync(incompleteDir, { recursive: true });
    }

    const finalFilePath = path.join(job.tempDir, file.filename);
    const base = path.parse(finalFilePath).name;

    const dlFilePath = path.join(incompleteDir, file.filename);

    await new Promise<void>((resolve) => {
      const proxy = dbStore.getSettings("proxy");

      const args = [
        file.url,
        "-o",
        dlFilePath,
        "--format",
        job!.format.includes("audio") ? "bestaudio/best" : job!.format,
        "--no-playlist",
        "--no-warnings",
      ];
      if (proxy) {
        args.push("--proxy", proxy);
      }
      if (job!.format.includes("audio")) {
        args.push("--extract-audio", "--audio-format", "mp3");
      }
      if (cookies) {
        args.push("--cookies", cookies);
      }

      console.log(`[${jobId}] Spawning: yt-dlp ${args.join(" ")}`);

      const child = spawn(binary, args);
      activeProcesses.set(jobId, child);

      let stderrOutput = "";
      child.stderr.on("data", (d) => {
        const s = d.toString();
        stderrOutput += s;
        console.error(`[${jobId}] STDERR: ${s}`);
      });

      child.stdout.on("data", (d) => {
        const line = d.toString();

        if (!line.trim().startsWith("[download]")) return;

        const percentMatch = line.match(/(\d+\.?\d*)%/);
        if (percentMatch) {
          job!.progress.currentFilePercent = parseFloat(percentMatch[1]);
        }

        const sizeMatch = line.match(
          /of\s+(~?\s?\d+(\.\d+)?(KiB|MiB|GiB|TiB|B|kB|MB|GB|TB))/i
        );
        if (sizeMatch) {
          job!.progress.currentFileTotalSize = sizeMatch[1];
        }

        const speedMatch = line.match(/at\s+([^\s]+)/);
        if (speedMatch) {
          job!.progress.currentSpeed = speedMatch[1];
        }

        if (percentMatch) {
          win.webContents.send("batch:progress", job);
        }
      });

      child.on("close", (code) => {
        activeProcesses.delete(jobId);
        if ((job as Job)?.status === "paused") {
          resolve();
          return;
        }

        console.log(`[${jobId}] Process exited with code ${code}`);

        let downloadedFile: string | null = null;
        try {
          if (fs.existsSync(dlFilePath) && fs.statSync(dlFilePath).size > 0) {
            downloadedFile = dlFilePath;
          } else {
            for (const ext of [".mkv", ".webm", ".mp4", ".mp3"]) {
              const alt = path.join(incompleteDir, base + ext);
              if (fs.existsSync(alt) && fs.statSync(alt).size > 0) {
                downloadedFile = alt;
                break;
              }
            }
          }
        } catch (e) {}

        if (code === 0 || downloadedFile) {
          if (code !== 0) {
            console.warn(
              `[${jobId}] Non-zero exit code (${code}) but file exists. Marking success.`
            );
          }

          if (downloadedFile) {
            const fileName = path.basename(downloadedFile);
            const destPath = path.join(job.tempDir, fileName);
            try {
              if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
              fs.renameSync(downloadedFile, destPath);
            } catch (err: any) {
              console.error(`[${jobId}] Failed to move file: ${err.message}`);
            }
          }

          file.status = "completed";
          job!.progress.completed = i + 1;
        } else {
          console.error(
            `[${jobId}] File failed to download. Stderr: ${stderrOutput}`
          );
          file.status = "error";
        }
        win.webContents.send("batch:progress", job!);
        saveJob(job!);
        resolve();
      });
    });

    if ((job as Job).status === "paused") break;
  }

  if ((job as Job).status !== "paused") {
    const allDone = job.files.every((f) => f.status === "completed");
    job.status = allDone ? "completed" : "error";
    saveJob(job);
    win.webContents.send("batch:progress", job);
  }
}

export async function initBatch(data: any) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const files: JobFile[] = [];

  let tempDir = "";
  if (data.folder && data.folder !== "") {
    tempDir = path.join(app.getPath("downloads"), "MediaPull", data.folder);
  } else {
    tempDir = path.join(app.getPath("downloads"), "MediaPull");
  }

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  if (data.urls) {
    files.push(
      ...data.urls.map((url: string, idx: number) => {
        let rawTitle = data.titles?.[idx] || `Video ${idx}`;
        let baseName = sanitizeTitle(rawTitle, idx);
        const ext = data.format?.includes("audio") ? "mp3" : "mp4";

        if (!data.folder || data.folder === "") {
          let counter = 1;
          let candidate = baseName;
          while (true) {
            const exists = [
              ".mp4",
              ".mp3",
              ".mkv",
              ".webm",
              ".part",
              ".ytdl",
            ].some((e) => fs.existsSync(path.join(tempDir, candidate + e)));
            if (!exists) {
              baseName = candidate;
              break;
            }
            candidate = `${baseName} (${counter})`;
            counter++;
          }
        }

        return {
          url,
          title: rawTitle,
          filename: `${baseName}.${ext}`,
          status: "pending",
        } as JobFile;
      })
    );
  }

  const job: Job = {
    id,
    playlistName: data.playlistName ?? "batch",
    format: data.format ?? "best",
    concurrentFragments: data.concurrentFragments ?? 4,
    addPrefix: !!data.addPrefix,
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
  saveJob(job);
  return { jobId: id };
}

export function pauseBatch(id: string) {
  let job = jobs.get(id);
  if (!job) {
    job = dbStore.getJob(id);
    if (job) jobs.set(id, job);
  }

  if (job) {
    job.status = "paused";
    saveJob(job);

    const child = activeProcesses.get(id);
    if (child) {
      child.kill("SIGKILL");
    }
  }
}

export function batchStatus(id: string) {
  const job = jobs.get(id) || dbStore.getJob(id);
  if (!job) throw new Error("Job not found");
  return job;
}

export function getAllJobs(limit?: number) {
  const dbJobs = dbStore.getAllJobs(limit);
  return dbJobs.map((j) => {
    const memoryJob = jobs.get(j.id);
    if (memoryJob) {
      return memoryJob;
    }
    return j;
  });
}

export function deleteJob(id: string, deleteFiles: boolean = false) {
  const job = jobs.get(id) || dbStore.getJob(id);

  if (job) {
    if (job.status === "downloading") {
      pauseBatch(id);
    }

    if (deleteFiles) {
      for (const file of job.files) {
        try {
          const p = path.join(job.tempDir, file.filename);
          if (fs.existsSync(p)) fs.unlinkSync(p);

          const base = path.parse(p).name;
          [".mkv", ".webm", ".part", ".ytdl"].forEach((ext) => {
            const alt = path.join(job.tempDir, base + ext);
            if (fs.existsSync(alt)) fs.unlinkSync(alt);
          });
        } catch (e) {
          console.error("Error deleting file:", e);
        }
      }

      const mediaPullRoot = path.join(app.getPath("downloads"), "MediaPull");
      if (path.resolve(job.tempDir) !== path.resolve(mediaPullRoot)) {
        try {
          if (
            fs.existsSync(job.tempDir) &&
            fs.readdirSync(job.tempDir).length === 0
          ) {
            fs.rmdirSync(job.tempDir);
          }
        } catch (e) {}
      }
    }

    activeProcesses.delete(id);
    jobs.delete(id);
    dbStore.deleteJob(id);
  }
}

export async function openBatchFolder(id: string) {
  const job = jobs.get(id) || dbStore.getJob(id);
  if (job && fs.existsSync(job.tempDir)) {
    await shell.openPath(job.tempDir);
  }
}

export async function openDownloadsFolder() {
  const downloadPath = app.getPath("downloads");
  const mediaPullDir = path.join(downloadPath, "MediaPull");
  if (!fs.existsSync(mediaPullDir)) {
    fs.mkdirSync(mediaPullDir, { recursive: true });
  }
  await shell.openPath(mediaPullDir);
}

export function saveCookies(content: string) {
  const p = path.join(app.getPath("userData"), "cookies.txt");
  content.trim() ? fs.writeFileSync(p, content) : fs.rmSync(p, { force: true });
}

export async function videoInfo(win: BrowserWindow, url: string) {
  const binary = getYtDlpPath();
  const cookies = getCookiePath();
  const proxy = dbStore.getSettings("proxy");

  const args = [
    url,
    "--dump-single-json",
    "--no-warnings",
    "--flat-playlist",
    "--extractor-args",
    "youtubetab:skip=authcheck",
  ];

  if (proxy) {
    args.push("--proxy", proxy);
  }

  if (cookies) {
    args.push("--cookies", cookies);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(binary, args);
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(new Error("Failed to parse JSON output from yt-dlp"));
        }
      } else {
        reject(new Error(`yt-dlp exited with code ${code}: ${stderr}`));
      }
    });
  });
}

export async function updateEngine() {
  const binary = getYtDlpPath();
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ["-U"]);
    let output = "";
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(output || `Exited with code ${code}`));
    });
  });
}
