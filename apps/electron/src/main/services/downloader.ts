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
  targetExt?: string;
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

async function spawnWithRetry(
  command: string,
  args: string[],
  options: any = {},
  win?: BrowserWindow,
  retries = 5,
  delay = 500
): Promise<ChildProcess> {
  const binaryName = path.basename(command);
  for (let i = 0; i <= retries; i++) {
    try {
      if (!fs.existsSync(command)) {
        throw new Error(`File not found: ${command}`);
      }

      if (process.platform === "win32") {
        try {
          const fd = fs.openSync(command, "r+");
          fs.closeSync(fd);
        } catch (err: any) {
          if (err.code === "EBUSY" || err.code === "EACCES") {
            if (win && !win.isDestroyed()) {
              win.webContents.send("engine:status", {
                status: "retrying",
                binary: binaryName,
                count: i + 1,
                max: retries,
                message: `System is busy. Retrying to launch ${binaryName}...`,
              });
            }
            throw err;
          }
        }
      }

      const child = spawn(command, args, options);
      if (win && !win.isDestroyed()) {
        win.webContents.send("engine:status", { status: "ready" });
      }
      return child;
    } catch (err: any) {
      if ((err.code === "EBUSY" || err.code === "EACCES") && i < retries) {
        console.warn(
          `Spawn target busy/locked, retrying in ${delay}ms... (${i + 1}/${retries})`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (win && !win.isDestroyed()) {
        win.webContents.send("engine:status", {
          status: "error",
          binary: binaryName,
          message: `Failed to launch ${binaryName} after multiple attempts. This usually happens if an antivirus is scanning the file or it's locked by another process. Please try restarting the application.`,
        });
      }
      throw err;
    }
  }
  throw new Error(`Failed to spawn ${command} after ${retries} retries`);
}

async function waitForEngine(
  command: string,
  win?: BrowserWindow,
  timeout = 10000
): Promise<void> {
  const start = Date.now();
  const binaryName = path.basename(command);

  while (Date.now() - start < timeout) {
    if (fs.existsSync(command)) {
      try {
        const fd = fs.openSync(command, "r+");
        fs.closeSync(fd);
        if (win && !win.isDestroyed()) {
          win.webContents.send("engine:status", { status: "ready" });
        }
        return;
      } catch (err: any) {
        if (err.code !== "EBUSY" && err.code !== "EACCES") {
          throw err;
        }
        if (win && !win.isDestroyed()) {
          win.webContents.send("engine:status", {
            status: "retrying",
            binary: binaryName,
            message: `Engine ${binaryName} is being prepared. Please wait...`,
          });
        }
      }
    } else {
      if (win && !win.isDestroyed()) {
        win.webContents.send("engine:status", {
          status: "retrying",
          binary: binaryName,
          message: `Downloading engine binaries...`,
        });
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Engine preparation timed out for: ${command}`);
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

function getFfmpegPath() {
  const platform = process.platform;
  let binName = "ffmpeg";
  if (platform === "win32") {
    binName = "ffmpeg.exe";
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

  await waitForEngine(binary, win);

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
      const embedMetadata = dbStore.getSettings("embedMetadata") === "true";
      const embedThumbnail = dbStore.getSettings("embedThumbnail") === "true";
      const ffmpegPath = path.resolve(getFfmpegPath());
      const ffmpegDir = path.dirname(ffmpegPath);

      const args = [
        file.url,
        "-o",
        dlFilePath,
        "--format",
        job!.format.includes("audio") ? "bestaudio/best" : job!.format,
        "--no-playlist",
        "--no-warnings",
      ];

      if (fs.existsSync(ffmpegPath)) {
        args.push("--ffmpeg-location", ffmpegDir);
      }

      if (proxy) {
        args.push("--proxy", proxy);
      }
      if (embedMetadata) {
        args.push("--add-metadata");
      }

      const supportedThumbnailFormats = [
        "mp3",
        "m4a",
        "mp4",
        "mkv",
        "mka",
        "ogg",
        "opus",
        "flac",
        "mov",
        "m4v",
      ];
      const targetExt = (job!.targetExt || "").toLowerCase();
      const isSupportedThumbnail =
        supportedThumbnailFormats.includes(targetExt);

      if (embedThumbnail && isSupportedThumbnail) {
        args.push("--embed-thumbnail");
      } else if (embedThumbnail) {
        console.warn(
          `[${jobId}] Skipping thumbnail embedding for unsupported format: ${targetExt}`
        );
      }

      const isAudioTarget = ["mp3", "flac", "wav", "m4a", "opus"].includes(
        job!.targetExt || ""
      );

      if (isAudioTarget || job!.format.includes("audio")) {
        args.push("--extract-audio");
        args.push("--audio-format", job!.targetExt || "mp3");
      } else if (job!.targetExt) {
        args.push("--recode-video", job!.targetExt);
      }

      if (cookies) {
        args.push("--cookies", cookies);
      }

      console.log(`[${jobId}] Spawning: yt-dlp ${args.join(" ")}`);

      spawnWithRetry(
        binary,
        args,
        {
          env: {
            ...process.env,
            PATH: `${ffmpegDir}${path.delimiter}${process.env.PATH || ""}`,
          },
        },
        win
      )
        .then((child) => {
          activeProcesses.set(jobId, child);

          let stderrOutput = "";
          if (child.stderr) {
            child.stderr.on("data", (d) => {
              const s = d.toString();
              stderrOutput += s;
              console.error(`[${jobId}] STDERR: ${s}`);
            });
          }

          if (child.stdout) {
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
          }

          child.on("close", async (code: number | null) => {
            activeProcesses.delete(jobId);
            if ((job as Job)?.status === "paused") {
              resolve();
              return;
            }

            console.log(`[${jobId}] Process exited with code ${code}`);

            let downloadedFile: string | null = null;
            try {
              if (
                fs.existsSync(dlFilePath) &&
                fs.statSync(dlFilePath).size > 0
              ) {
                downloadedFile = dlFilePath;
              } else {
                const filesInIncomplete = fs.readdirSync(incompleteDir);
                const matches = filesInIncomplete
                  .filter(
                    (f) =>
                      f.startsWith(base) &&
                      !f.endsWith(".part") &&
                      !f.endsWith(".ytdl") &&
                      fs.statSync(path.join(incompleteDir, f)).size > 0
                  )
                  .sort(
                    (a, b) =>
                      fs.statSync(path.join(incompleteDir, b)).mtimeMs -
                      fs.statSync(path.join(incompleteDir, a)).mtimeMs
                  );

                if (matches.length > 0) {
                  downloadedFile = path.join(incompleteDir, matches[0]);
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

                let moved = false;
                for (let attempt = 1; attempt <= 3; attempt++) {
                  try {
                    if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
                    fs.renameSync(downloadedFile, destPath);
                    moved = true;
                    break;
                  } catch (err: any) {
                    console.warn(
                      `[${jobId}] Move attempt ${attempt} failed: ${err.message}`
                    );
                    if (attempt < 3)
                      await new Promise((r) => setTimeout(r, 1000));
                  }
                }

                if (!moved) {
                  console.error(
                    `[${jobId}] Permanently failed to move file to ${destPath}`
                  );
                } else {
                  try {
                    const remaining = fs.readdirSync(incompleteDir);
                    if (remaining.length === 0) {
                      fs.rmdirSync(incompleteDir);
                    }
                  } catch {}
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
        })
        .catch((err: Error) => {
          console.error(`[${jobId}] Spawn failed:`, err);
          file.status = "error";
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
    targetExt: data.targetExt,
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

  return new Promise(async (resolve, reject) => {
    try {
      await waitForEngine(binary, win);
      const child = await spawnWithRetry(binary, args, {}, win);
      let stdout = "";
      let stderr = "";

      if (child.stdout) {
        child.stdout.on("data", (d) => (stdout += d.toString()));
      }
      if (child.stderr) {
        child.stderr.on("data", (d) => (stderr += d.toString()));
      }

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
    } catch (e) {
      reject(e);
    }
  });
}

export async function updateEngine() {
  const binary = getYtDlpPath();
  return new Promise(async (resolve, reject) => {
    try {
      const child = await spawnWithRetry(binary, ["-U"]);
      let output = "";
      if (child.stdout) {
        child.stdout.on("data", (d) => (output += d.toString()));
      }
      if (child.stderr) {
        child.stderr.on("data", (d) => (output += d.toString()));
      }
      child.on("close", (code) => {
        if (code === 0) resolve(output);
        else reject(new Error(output || `Exited with code ${code}`));
      });
    } catch (e) {
      reject(e);
    }
  });
}
