# MediaPull

A modern, high-performance desktop YouTube downloader built with **Electron** and **Next.js**.
MediaPull combines a beautiful React-based UI with the raw power of `yt-dlp` directly embedded in the application, offering a seamless and reliable download experience on Windows, macOS, and Linux.

## 🚀 Features

- **Cross-Platform**: Runs natively on Windows, macOS, and Linux.
- **Bundled Engine**: Comes with `yt-dlp` pre-packaged, requiring no external dependencies or Python installation.
- **Smart Downloads**:
  - Playlist & Bulk support.
  - Format selection (Video/Audio).
  - Pause, Resume, and Cancel capabilities.
- **Modern UI**: Built with Shadcn UI, Tailwind CSS, and Next.js 15.
- **Dark Mode**: Native support for dark/light themes.
- **Persistence**: Auto-saves download history and job states.

## 🛠 Tech Stack

- **Runtime**: [Electron](https://www.electronjs.org/)
- **Frontend**: [Next.js](https://nextjs.org/) (Exported to Static HTML)
- **Core**: [yt-dlp](https://github.com/yt-dlp/yt-dlp) (Binaries bundled in `apps/electron/bin`)
- **Language**: TypeScript

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18+)
- **Windows**: Visual Studio Build Tools (for Electron native modules)
- **Linux**: `rpm`, `dpkg` (for building installers)

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/amit548/MediaPull.git
    cd MediaPull
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### Development

Run the frontend and Electron app concurrently:

```bash
npm run dev
```

- **Frontend**: Runs on `http://localhost:3000`
- **Electron**: Loads the frontend URL. Backend logic runs in the main process.

### Building for Production

To create a diverse set of installers (EXE, DMG, DEB, etc.):

```bash
npm run build
```

This command will:

1.  Build the Next.js client (`apps/client`) and export it to `apps/client/out`.
2.  Package the Electron app (`apps/electron`) and bundle the `yt-dlp` binaries.
3.  Output installers to `apps/electron/out/make`.

**Note**: The build process automatically handles bundling the correct `yt-dlp` binary for your platform.

## 📂 Project Structure

```text
.
├── apps/
│   ├── client/      # Next.js Frontend (UI)
│   └── electron/    # Electron Main Process & Bundled Binaries
│       ├── bin/     # yt-dlp executables (Mac/Win/Linux)
│       └── src/     # Main process logic (Downloader service, etc.)
├── package.json     # Root scripts
└── README.md
```

## 📝 License

Distributed under the **MIT License**. See `LICENSE` for more information.
