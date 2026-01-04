# YouTube Downloader Monorepo

A modern, high-performance YouTube downloader built with a Next.js frontend and a Node.js/Express backend. This project is organized as a monorepo powered by **Turborepo** for efficient management and development.

## 🚀 Features

- **Video Info Retrieval**: Instantly fetch video metadata including title, duration, and multiple thumbnails.
- **Flexible Downloads**: Choose between multiple video resolutions and audio formats.
- **Modern UI**: Beautiful, responsive interface built with Shadcn UI and Tailwind CSS.
- **Theme Support**: Includes a premium theme toggle with Light, Dark, and System modes.
- **Optimized Assets**: Uses Next.js Image component for fast-loading, optimized thumbnails.
- **Developer Friendly**: Type-safe development with TypeScript across the entire stack.

## 🛠 Tech Stack

### Frontend (`apps/client`)

- **Framework**: [Next.js 15+](https://nextjs.org)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com)
- **Icons**: [Lucide React](https://lucide.dev)
- **Theme Management**: [next-themes](https://github.com/pacocoursey/next-themes)

### Backend (`apps/server`)

- **Runtime**: [Node.js](https://nodejs.org)
- **Framework**: [Express](https://expressjs.com)
- **Engine**: [youtube-dl-exec](https://github.com/microlinkhq/youtube-dl-exec) (yt-dlp wrapper)
- **Language**: TypeScript with `ts-node`

### Monorepo Tooling

- **Build System**: [Turborepo](https://turbo.build)
- **Package Manager**: npm

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (v18+ recommended)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) must be available on your system (or path) for the backend to function correctly.

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd youtube_downloader
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running Development Servers

Start both the frontend and backend in development mode using a single command:

```bash
npm run dev
```

- **Frontend**: [http://localhost:3000](http://localhost:3000) (or 3001 if 3000 is occupied)
- **Backend**: [http://localhost:4000](http://localhost:4000)

### Building for Production

```bash
npm run build
```

## 📂 Project Structure

```text
.
├── apps/
│   ├── client/      # Next.js web application
│   └── server/      # Express API server for video processing
├── package.json     # Root workspace configuration
└── turbo.json       # Turborepo configuration
```

## 📝 License

ISC
