import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { Registry } from "./types.js";

// ─── Cache directory ─────────────────────────────────────────────────────────

const CACHE_DIR = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? "~",
  ".cache",
  "agent-cli",
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a source string like "github:user/repo" to an HTTPS git URL.
 */
export function sourceToUrl(source: string): string {
  const ghMatch = source.match(/^github:(.+)/);
  if (ghMatch) {
    return `https://github.com/${ghMatch[1]}.git`;
  }
  // Already a full URL
  if (source.startsWith("http") || source.startsWith("git@")) {
    return source;
  }
  throw new Error(
    `Unsupported source format: "${source}". Use "github:owner/repo" or a full git URL.`,
  );
}

/**
 * Clone (or fetch + checkout) the source repo into a local cache directory.
 * Returns the absolute path to the cached repo.
 */
export function cloneOrUpdate(source: string, ref: string): string {
  const repoUrl = sourceToUrl(source);
  const dirName = source.replace(/[^a-zA-Z0-9]/g, "_");
  const repoDir = path.join(CACHE_DIR, dirName);

  if (fs.existsSync(path.join(repoDir, ".git"))) {
    // Already cloned — fetch and checkout the requested ref
    exec("git fetch --all --tags --prune", repoDir);

    if (ref === "HEAD") {
      const defaultBranch = getDefaultBranch(repoDir);
      exec(`git checkout ${defaultBranch}`, repoDir);
      exec(`git reset --hard origin/${defaultBranch}`, repoDir);
    } else {
      exec(`git checkout ${ref}`, repoDir);
      // If it's a branch, try to fast-forward
      exec("git pull --ff-only 2>/dev/null || true", repoDir);
    }
  } else {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    exec(`git clone "${repoUrl}" "${repoDir}"`);
    if (ref !== "HEAD") {
      exec(`git checkout ${ref}`, repoDir);
    }
  }

  return repoDir;
}

/**
 * Load the registry.json from a checked-out repo.
 */
export function loadRegistry(repoDir: string): Registry {
  const registryPath = path.join(repoDir, "registry.json");
  if (!fs.existsSync(registryPath)) {
    throw new Error(
      `registry.json not found in "${repoDir}". Ensure the source repository contains a registry.json at its root.`,
    );
  }
  return JSON.parse(fs.readFileSync(registryPath, "utf-8")) as Registry;
}

/**
 * Recursively copy a directory.
 */
export function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Get the latest tag (or short SHA if no tags) from a repo directory.
 */
export function getLatestRef(repoDir: string): string {
  return exec(
    'git describe --tags --abbrev=0 2>/dev/null || git rev-parse --short HEAD',
    repoDir,
  ).trim();
}

// ─── Internal ────────────────────────────────────────────────────────────────

function exec(command: string, cwd?: string): string {
  return execSync(command, {
    cwd,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function getDefaultBranch(repoDir: string): string {
  const remoteHead = exec(
    "git symbolic-ref --short refs/remotes/origin/HEAD",
    repoDir,
  ).trim();

  return remoteHead.replace(/^origin\//, "");
}
