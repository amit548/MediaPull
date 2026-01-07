const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BIN_DIR = path.join(__dirname, "..", "bin");

const BINS = {
  "yt-dlp": {
    win32:
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe",
    linux: "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp",
    darwin:
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos",
  },
  ffmpeg: {
    win32:
      "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-win-64.zip",
    linux:
      "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-linux-64.7z",
    darwin:
      "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffmpeg-4.4.1-osx-64.zip",
  },
  ffprobe: {
    win32:
      "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffprobe-4.4.1-win-64.zip",
    linux:
      "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffprobe-4.4.1-linux-64.7z",
    darwin:
      "https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v4.4.1/ffprobe-4.4.1-osx-64.zip",
  },
};

const DEST_NAMES = {
  "yt-dlp": {
    win32: "yt-dlp.exe",
    linux: "yt-dlp",
    darwin: "yt-dlp_macos",
  },
  ffmpeg: {
    win32: "ffmpeg.exe",
    linux: "ffmpeg",
    darwin: "ffmpeg",
  },
  ffprobe: {
    win32: "ffprobe.exe",
    linux: "ffprobe",
    darwin: "ffprobe",
  },
};

async function download(url, dest) {
  console.log(`Downloading ${url} -> ${dest}`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          download(res.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        res.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

function extract(file, dir) {
  console.log(`Extracting ${file} to ${dir}`);
  const ext = path.extname(file);
  try {
    if (process.platform === "win32") {
      if (ext === ".zip") {
        try {
          execSync(`tar -xf "${file}" -C "${dir}"`);
        } catch (e) {
          console.warn(`tar failed, falling back to PowerShell: ${e.message}`);
          execSync(
            `powershell -Command "Start-Sleep -s 2; Expand-Archive -Path '${file}' -DestinationPath '${dir}' -Force"`
          );
        }
      } else {
        console.warn(
          `Extraction for ${ext} not implemented on Windows automatically.`
        );
      }
    } else {
      if (ext === ".zip") {
        execSync(`unzip -o "${file}" -d "${dir}"`);
      } else {
        console.warn(`Extraction for ${ext} not implemented on this platform.`);
      }
    }
  } catch (e) {
    console.error(`Extraction failed: ${e.message}`);
    throw e;
  }
}

async function main() {
  console.log("Preparing binaries for platform:", process.platform);
  if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

  for (const bin of Object.keys(BINS)) {
    const platform = process.platform;
    const url = BINS[bin][platform];
    const name = DEST_NAMES[bin][platform];
    if (!url) {
      console.warn(`No binary URL for ${bin} on ${platform}`);
      continue;
    }
    const isZip = url.endsWith(".zip");
    const dest = path.join(BIN_DIR, isZip ? `${bin}_${platform}.zip` : name);
    const finalBinPath = path.join(BIN_DIR, name);

    if (fs.existsSync(finalBinPath)) {
      console.log(`${bin} already exists at ${finalBinPath}, skipping.`);
      continue;
    }

    try {
      await download(url, dest);
      if (isZip) {
        const tempExtractDir = path.join(BIN_DIR, `_temp_${bin}_${platform}`);
        if (!fs.existsSync(tempExtractDir)) fs.mkdirSync(tempExtractDir);
        extract(dest, tempExtractDir);

        const files = fs.readdirSync(tempExtractDir);
        const binFile = files.find((f) => f.startsWith(bin));
        if (binFile) {
          fs.copyFileSync(
            path.join(tempExtractDir, binFile),
            path.join(BIN_DIR, name)
          );
          if (process.platform !== "win32") {
            fs.chmodSync(path.join(BIN_DIR, name), 0o755);
          }
        }

        fs.rmSync(tempExtractDir, { recursive: true, force: true });
        fs.unlinkSync(dest);
      } else {
        if (platform !== "win32") {
          fs.chmodSync(dest, 0o755);
        }
      }
      console.log(`Successfully prepared ${bin} for ${platform}`);
    } catch (err) {
      console.error(`Failed to prepare ${bin} for ${platform}:`, err.message);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Critical error during binary preparation:", err);
    process.exit(1);
  });
}

module.exports = { main };
