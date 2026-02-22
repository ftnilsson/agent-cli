#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import * as childProcess from "node:child_process";
import type { AgentManifest, Registry } from "./types.js";
import {
  cloneOrUpdate,
  loadRegistry,
  copyDir,
  getLatestRef,
} from "./git.js";
import { loadManifest, saveManifest, manifestExists } from "./manifest.js";
import { generateCompletions } from "./completions.js";
import {
  resolveAgentOutputPath,
  composeAgentFile,
  resolveIncludes,
  findAgentFile,
  hasDifferences,
  findMissingGitignoreEntries,
  generateSkillsIndexContent,
  type ResolvedEntry,
} from "./helpers.js";
import {
  printLogo,
  icon,
  color as c,
  Spinner,
  sectionHeader,
} from "./ui.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const VERSION = "1.1.0";
const MANIFEST_FILE = ".agent.json";
const LOCAL_INSTRUCTIONS_FILE = "local-instructions.md";

const AGENT_TEMPLATE = `# Project Agent Instructions

## Role

You are a [senior/expert] [your role] working on [project name]. You write [key quality attributes] code.

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| | | |

## Project Structure

\\\`\\\`\\\`
src/
  ...
\\\`\\\`\\\`

## Code Conventions

### Naming

| Construct | Convention | Example |
|-----------|-----------|---------|
| | | |

### Patterns

- Describe the patterns to follow for this project.
- Be specific — the agent will follow these literally.

## Workflow Rules

- How should the agent approach tasks?
- What should it do before writing code?
- What testing strategy should it follow?

## Anti-Patterns — Never Do These

- Never [specific thing to avoid].
- Never [another thing to avoid].
`;

const SKILL_TEMPLATE = `# Skill Name

## Description

What does this skill teach? What problem does it solve? Keep this to 2-3 sentences.

## When To Use

- Bullet list of situations where this skill applies.
- Be specific about triggers.

## Prerequisites

| Skill | Why |
|-------|-----|
| | |

## Instructions

### 1 — First Section

Teach the first concept. Include code examples where appropriate.

\\\`\\\`\\\`
// Example code
\\\`\\\`\\\`

### 2 — Second Section

Continue building on the concept.

| Approach | Pros | Cons |
|----------|------|------|
| | | |

### 3 — Common Mistakes

What goes wrong and how to avoid it.

## Checklist

- [ ] Did you apply the principle from section 1?
- [ ] Did you avoid the common mistakes from section 3?
`;

// ─── CLI entry point ─────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case "init":
    runAsync(cmdInit(args));
    break;
  case "install":
    cmdInstall(args);
    break;
  case "list":
    cmdList(args);
    break;
  case "update":
    cmdUpdate();
    break;
  case "add":
    cmdAdd(args);
    break;
  case "remove":
    cmdRemove(args);
    break;
  case "preset":
    cmdPreset(args);
    break;
  case "diff":
    cmdDiff(args);
    break;
  case "create":
    cmdCreate(args);
    break;
  case "prompt":
    cmdPrompt(args);
    break;
  case "completions":
    cmdCompletions(args);
    break;
  case "--version":
  case "-v":
    console.log(`\n  ${icon.agent} ${c.bold}agent-cli${c.reset} ${c.dim}v${VERSION}${c.reset}\n`);
    break;
  case "--help":
  case "-h":
  case undefined:
    printLogo();
    printHelp();
    break;
  default:
    console.error(`Unknown command: "${command}"\n`);
    printHelp();
    process.exit(1);
}

/** Wrap async commands so unhandled rejections show a clean error. */
function runAsync(p: Promise<void>): void {
  p.catch((err: Error) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}

// ─── Commands ────────────────────────────────────────────────────────────────

/**
 * `agent init` — Create a .agent.json manifest in the current directory.
 *
 * Usage:
 *   agent init [source] [--output <dir>]
 *   agent init [source] --interactive     ← browse & pick interactively
 *
 * If no source is provided, defaults to github:ftnilsson/agent-cli
 */
async function cmdInit(args: string[]): Promise<void> {
  if (manifestExists()) {
    console.error(
      `  ${icon.error} ${MANIFEST_FILE} already exists. Delete it first or edit manually.`,
    );
    process.exit(1);
  }

  const DEFAULT_SOURCE = "github:ftnilsson/agent-cli";
  const source = args.find((a) => !a.startsWith("--")) || DEFAULT_SOURCE;

  const outputIdx = args.indexOf("--output");
  const outputDir =
    outputIdx !== -1 && args[outputIdx + 1] ? args[outputIdx + 1] : ".agent";

  const interactive = args.includes("--interactive") || args.includes("-i");

  // Clone immediately so we can resolve the latest ref
  const spinner = new Spinner(`Resolving source: ${c.dim}${source}${c.reset}`);
  spinner.start();
  const repoDir = cloneOrUpdate(source, "HEAD");
  const ref = getLatestRef(repoDir);
  spinner.stop(`Source resolved ${c.dim}(${ref})${c.reset}`);

  const manifest: AgentManifest = {
    source,
    ref,
    outputDir,
    include: [],
    agentOutput: "agent.md",
  };

  if (interactive) {
    const registry = loadRegistry(repoDir);
    // Lazy-import interactive module (only loads readline when needed)
    const { interactiveSelect } = await import("./interactive.js");
    const selected = await interactiveSelect(registry);
    manifest.include = selected;
  }

  saveManifest(manifest);
  console.log(`\n  ${icon.success} Created ${c.bold}${MANIFEST_FILE}${c.reset} ${c.dim}(ref: ${ref})${c.reset}`);

  if (manifest.include.length > 0) {
    console.log(`  ${icon.skill} Selected ${manifest.include.length} item(s).`);
    console.log(`\n  ${icon.arrow} Run ${c.bold}agent install${c.reset} to download everything.`);
  } else {
    console.log(`\n  ${c.bold}Next steps:${c.reset}`);
    console.log(`  ${c.dim}1.${c.reset} Add skills:               ${c.cyan}agent add development/architecture${c.reset}`);
    console.log(`  ${c.dim}2.${c.reset} Add agent instructions:   ${c.cyan}agent add agents/nextjs${c.reset}`);
    console.log(`  ${c.dim}3.${c.reset} Install everything:       ${c.cyan}agent install${c.reset}`);
    console.log(`  ${c.dim}4.${c.reset} Browse what's available:  ${c.cyan}agent list --remote${c.reset}`);
  }
}

/**
 * `agent install` — Pull skills and compose agent instructions.
 *
 * Reads .agent.json, clones/updates the source, and:
 *   - Skills → copied into the output directory
 *   - Agent instructions → composed into a single agent.md at project root
 *
 * Flags:
 *   --format copilot   → write to .github/copilot-instructions.md
 *   --format cursor     → write to .cursorrules
 *   --format claude     → write to CLAUDE.md
 */
function cmdInstall(args: string[]): void {
  const manifest = loadManifest();

  if (manifest.include.length === 0) {
    console.log(
      `  ${icon.info} No skills or agents in your manifest. Use ${c.cyan}agent add <category/key>${c.reset} first.`,
    );
    return;
  }

  // Determine agent output path from --format flag or manifest
  const formatIdx = args.indexOf("--format");
  const format = formatIdx !== -1 ? args[formatIdx + 1] : undefined;
  const agentOutputPath = resolveAgentOutputPath(format, manifest.agentOutput);
  const skipGitignore = args.includes("--no-gitignore");

  console.log(`\n  ${icon.link} ${c.dim}Source:${c.reset}  ${manifest.source} @ ${c.cyan}${manifest.ref}${c.reset}`);
  console.log(`  ${icon.folder} ${c.dim}Skills:${c.reset}  ${manifest.outputDir}`);
  console.log(`  ${icon.agent} ${c.dim}Agent:${c.reset}   ${agentOutputPath}\n`);

  // 1. Clone / checkout
  const spinner = new Spinner(`Fetching from ${c.dim}${manifest.source}${c.reset}`);
  spinner.start();
  const repoDir = cloneOrUpdate(manifest.source, manifest.ref);
  spinner.stop(`Repository ready`);

  // 2. Load registry to resolve keys → folder paths
  const registry = loadRegistry(repoDir);

  // 3. Resolve each include entry, separating skills from agents
  const { skills, agents } = resolveIncludes(manifest.include, registry);

  // 4. Install skills into output directory
  if (skills.length > 0) {
    const outRoot = path.resolve(manifest.outputDir);
    if (fs.existsSync(outRoot)) {
      fs.rmSync(outRoot, { recursive: true });
    }
    fs.mkdirSync(outRoot, { recursive: true });

    for (const { key, srcPath, destFolder } of skills) {
      const src = path.join(repoDir, srcPath);
      const dest = path.join(outRoot, destFolder);

      if (!fs.existsSync(src)) {
        console.warn(`  ${icon.warning} Skipping "${key}" — source folder not found: ${srcPath}`);
        continue;
      }

      copyDir(src, dest);
      console.log(`  ${icon.success}  ${key} ${icon.arrow} ${path.relative(process.cwd(), dest)}`);
    }

    generateSkillsIndex(outRoot, skills);
    console.log(`\n  ${icon.install} Installed ${c.bold}${skills.length}${c.reset} skill(s) into ${c.cyan}${manifest.outputDir}/${c.reset}`);
  }

  // 5. Compose agent instructions into a single file
  if (agents.length > 0) {
    const sections: string[] = [];

    for (const { key, srcPath } of agents) {
      const src = path.join(repoDir, srcPath);
      const agentFile = findAgentFile(src);

      if (!agentFile) {
        console.warn(`  ${icon.warning} Skipping "${key}" — no agent.md found in: ${srcPath}`);
        continue;
      }

      const content = fs.readFileSync(agentFile, "utf-8").trim();
      sections.push(content);
      console.log(`  ${icon.success}  ${key} ${icon.arrow} ${agentOutputPath}`);
    }

    // Append local overrides if present
    const localOverridesPath = path.resolve(LOCAL_INSTRUCTIONS_FILE);
    if (fs.existsSync(localOverridesPath)) {
      const localContent = fs.readFileSync(localOverridesPath, "utf-8").trim();
      if (localContent) {
        sections.push(localContent);
        console.log(`  ${icon.success}  ${LOCAL_INSTRUCTIONS_FILE} ${icon.arrow} ${agentOutputPath} ${c.dim}(local overrides)${c.reset}`);
      }
    }

    if (sections.length > 0) {
      const composed = composeAgentFile(sections);
      const outputPath = path.resolve(agentOutputPath);

      // Ensure parent directory exists (e.g., .github/)
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, composed);

      console.log(`\n  ${icon.compose} Composed ${c.bold}${sections.length}${c.reset} agent instruction(s) into ${c.cyan}${agentOutputPath}${c.reset}`);
    }
  }

  if (skills.length === 0 && agents.length === 0) {
    console.log(`  ${icon.info} No valid entries found to install.`);
  }

  // 6. Install prompts for included categories
  const includedCats = new Set(manifest.include.map((i) => i.split("/")[0]));
  let promptCount = 0;
  const promptsOutDir = path.join(path.resolve(manifest.outputDir), "prompts");

  for (const [catKey, cat] of Object.entries(registry.categories)) {
    if (!cat.prompts || !includedCats.has(catKey)) continue;

    const promptsPath = cat.promptsPath ?? path.join(path.dirname(cat.path), "prompts");

    for (const [promptKey, filename] of Object.entries(cat.prompts)) {
      const src = path.join(repoDir, promptsPath, filename);
      if (!fs.existsSync(src)) {
        console.warn(`  ${icon.warning} Prompt file not found: ${promptsPath}/${filename}`);
        continue;
      }

      const destDir = path.join(promptsOutDir, catKey);
      fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, filename);
      fs.copyFileSync(src, dest);
      console.log(`  ${icon.prompt}  ${catKey}/${promptKey} ${icon.arrow} ${path.relative(process.cwd(), dest)}`);
      promptCount++;
    }
  }

  if (promptCount > 0) {
    console.log(`\n  ${icon.prompt} Installed ${c.bold}${promptCount}${c.reset} prompt(s) into ${c.cyan}${path.relative(process.cwd(), promptsOutDir)}/${c.reset}`);
  }

  // 7. .gitignore guard
  if (!skipGitignore) {
    checkGitignore(manifest.outputDir, agentOutputPath);
  } else {
    console.log(`\n  ${icon.info} Skipping .gitignore check ${c.dim}(--no-gitignore)${c.reset}`);
  }
}

/**
 * `agent list` — Show skills/agents in the manifest or in the remote registry.
 *
 * --remote   Show all available entries in the registry (requires clone).
 * (default)  Show locally included entries.
 */
function cmdList(args: string[]): void {
  const remote = args.includes("--remote");

  if (remote) {
    const manifest = loadManifest();
    const repoDir = cloneOrUpdate(manifest.source, "HEAD");
    const latestRef = getLatestRef(repoDir);
    const registry = loadRegistry(repoDir);

    console.log(`\nAvailable resources  (${manifest.source} @ ${c.cyan}${latestRef}${c.reset})\n`);

    if (manifest.ref !== latestRef) {
      console.log(
        `  ${icon.info} Your manifest is pinned to ${c.dim}${manifest.ref}${c.reset}. Run ${c.cyan}agent update${c.reset} to use the latest ref.`
      );
      console.log();
    }

    for (const [catKey, cat] of Object.entries(registry.categories)) {
      const typeLabel = cat.type === "agent" ? ` ${icon.agent}` : ` ${icon.skill}`;
      console.log(`  ${c.bold}${cat.name}${c.reset}${typeLabel}  ${c.dim}(${catKey})${c.reset}`);
      console.log(`  ${c.dim}${cat.description}${c.reset}`);
      for (const [skillKey, folder] of Object.entries(cat.skills)) {
        const included = manifest.include.includes(`${catKey}/${skillKey}`);
        const marker = included ? `${c.green}${icon.included}${c.reset}` : `${c.dim}${icon.available}${c.reset}`;
        console.log(`    ${marker}  ${catKey}/${skillKey}  ${icon.arrow}  ${c.dim}${folder}${c.reset}`);
      }
      if (cat.prompts && Object.keys(cat.prompts).length > 0) {
        const promptCount = Object.keys(cat.prompts).length;
        console.log(`    ${icon.prompt}  ${c.dim}${promptCount} prompt(s) available — use ${c.cyan}agent prompt list${c.reset}${c.dim} to browse${c.reset}`);
      }
      console.log();
    }

    console.log(`  ${c.green}${icon.included}${c.reset}  = included in your manifest`);
    console.log(`  ${c.dim}${icon.available}${c.reset}  = available but not included\n`);
  } else {
    const manifest = loadManifest();

    if (manifest.include.length === 0) {
      console.log(`  ${icon.info} No entries included. Use ${c.cyan}agent add <category/key>${c.reset}.`);
      return;
    }

    console.log(`\n  ${icon.list} Included entries  ${c.dim}(${manifest.source} @ ${manifest.ref})${c.reset}\n`);
    for (const entry of manifest.include) {
      console.log(`    ${icon.bullet}  ${entry}`);
    }
    console.log();
  }
}

/**
 * `agent update` — Update the ref in .agent.json to the latest tag/commit.
 *
 * Does NOT reinstall automatically; run `agent install` after.
 */
function cmdUpdate(): void {
  const manifest = loadManifest();

  const spinner = new Spinner(`Fetching latest from ${c.dim}${manifest.source}${c.reset}`);
  spinner.start();
  const repoDir = cloneOrUpdate(manifest.source, "HEAD");
  const latestRef = getLatestRef(repoDir);
  spinner.stop(`Fetched latest`);

  if (latestRef === manifest.ref) {
    console.log(`  ${icon.success} Already up-to-date ${c.dim}(${manifest.ref})${c.reset}`);
    return;
  }

  const oldRef = manifest.ref;
  manifest.ref = latestRef;
  saveManifest(manifest);
  console.log(`  ${icon.update} Updated ref: ${c.dim}${oldRef}${c.reset} ${icon.arrow} ${c.cyan}${latestRef}${c.reset}`);
  console.log(`  ${icon.arrow} Run ${c.bold}agent install${c.reset} to apply the update.`);
}

/**
 * `agent add <category/key> [...]` — Add one or more skills/agents to the manifest.
 *
 * Validates against the remote registry.
 */
function cmdAdd(args: string[]): void {
  if (args.length === 0) {
    console.error(`  ${icon.error} Usage: agent add <category/key> [<category/key> ...]`);
    console.error("  e.g. agent add development/architecture agents/nextjs");
    process.exit(1);
  }

  const manifest = loadManifest();
  const spinner = new Spinner("Validating against registry");
  spinner.start();
  const repoDir = cloneOrUpdate(manifest.source, "HEAD");
  const latestRef = getLatestRef(repoDir);
  const registry = loadRegistry(repoDir);
  spinner.stop("Registry loaded");

  let refUpdated = false;
  if (manifest.ref !== latestRef) {
    manifest.ref = latestRef;
    refUpdated = true;
  }

  const categoryAliases: Record<string, string> = {
    aws: "aws-cloud",
    azure: "azure-cloud",
  };

  const normalizeCategoryKey = (categoryKey: string): string => {
    return categoryAliases[categoryKey] ?? categoryKey;
  };

  let added = 0;

  for (const rawEntry of args) {
    const entry = rawEntry.includes("/") ? rawEntry : `${rawEntry}/*`;

    // Support adding a whole category with "category/*"
    if (entry.endsWith("/*")) {
      const catKey = normalizeCategoryKey(entry.slice(0, -2));
      const cat = registry.categories[catKey];
      if (!cat) {
        console.error(`  ${icon.error} Unknown category: "${entry.slice(0, -2)}"`);
        continue;
      }
      for (const skillKey of Object.keys(cat.skills)) {
        const full = `${catKey}/${skillKey}`;
        if (!manifest.include.includes(full)) {
          manifest.include.push(full);
          console.log(`  ${icon.add}  ${full}`);
          added++;
        }
      }
      continue;
    }

    // Validate "category/key"
    const [rawCatKey, skillKey] = entry.split("/");
    const catKey = normalizeCategoryKey(rawCatKey);
    if (!rawCatKey || !skillKey) {
      console.error(
        `  ${icon.error} Invalid format: "${rawEntry}". Use "category/key" (e.g. development/git, agents/nextjs) or a category name (e.g. serverless).`,
      );
      continue;
    }

    const cat = registry.categories[catKey];
    if (!cat) {
      console.error(`  ${icon.error} Unknown category: "${rawCatKey}"`);
      console.error(`      Available: ${Object.keys(registry.categories).join(", ")}`);
      continue;
    }

    if (!cat.skills[skillKey]) {
      console.error(`  ${icon.error} Unknown entry: "${skillKey}" in category "${catKey}"`);
      console.error(`      Available: ${Object.keys(cat.skills).join(", ")}`);
      continue;
    }

    const normalizedEntry = `${catKey}/${skillKey}`;

    if (manifest.include.includes(normalizedEntry)) {
      console.log(`  ${icon.skip}  ${normalizedEntry} ${c.dim}(already included)${c.reset}`);
      continue;
    }

    manifest.include.push(normalizedEntry);
    console.log(`  ${icon.add}  ${normalizedEntry}`);
    added++;
  }

  if (added > 0 || refUpdated) {
    saveManifest(manifest);
  }

  if (refUpdated) {
    console.log(`  ${icon.update} Updated manifest ref to ${c.cyan}${latestRef}${c.reset}`);
  }

  if (added > 0) {
    console.log(`\n  ${icon.success} Added ${c.bold}${added}${c.reset} item(s). Run ${c.bold}agent install${c.reset} to download.`);
  }
}

/**
 * `agent remove <category/key> [...]` — Remove entries from the manifest.
 */
function cmdRemove(args: string[]): void {
  if (args.length === 0) {
    console.error("Usage: agent remove <category/key> [<category/key> ...]");
    process.exit(1);
  }

  const manifest = loadManifest();
  let removed = 0;

  for (const entry of args) {
    // Support removing a whole category with "category/*"
    if (entry.endsWith("/*")) {
      const catKey = entry.slice(0, -2);
      const before = manifest.include.length;
      manifest.include = manifest.include.filter((i) => !i.startsWith(`${catKey}/`));
      const count = before - manifest.include.length;
      if (count > 0) {
        console.log(`  ${icon.remove} Removed ${count} item(s) from ${catKey}`);
        removed += count;
      } else {
        console.log(`  ${icon.skip}  No entries from "${catKey}" in manifest`);
      }
      continue;
    }

    const idx = manifest.include.indexOf(entry);
    if (idx === -1) {
      console.log(`  ${icon.skip}  ${entry} ${c.dim}(not in manifest)${c.reset}`);
      continue;
    }

    manifest.include.splice(idx, 1);
    console.log(`  ${icon.remove} ${entry}`);
    removed++;
  }

  if (removed > 0) {
    saveManifest(manifest);
    console.log(
      `\n  ${icon.success} Removed ${c.bold}${removed}${c.reset} item(s). Run ${c.bold}agent install${c.reset} to clean up.`,
    );
  }
}

/**
 * `agent preset <name>` — Apply a named preset from the registry.
 * `agent preset --list`  — Show all available presets.
 */
function cmdPreset(args: string[]): void {
  if (args.length === 0) {
    console.error(`  ${icon.error} Usage: agent preset <name>`);
    console.error("       agent preset --list");
    process.exit(1);
  }

  const manifest = loadManifest();
  const repoDir = cloneOrUpdate(manifest.source, "HEAD");
  const latestRef = getLatestRef(repoDir);
  const registry = loadRegistry(repoDir);

  let refUpdated = false;
  if (manifest.ref !== latestRef) {
    manifest.ref = latestRef;
    refUpdated = true;
  }

  const categoryAliases: Record<string, string> = {
    aws: "aws-cloud",
    azure: "azure-cloud",
  };

  const normalizeCategoryKey = (categoryKey: string): string => {
    return categoryAliases[categoryKey] ?? categoryKey;
  };

  if (!registry.presets || Object.keys(registry.presets).length === 0) {
    console.error(`  ${icon.error} No presets defined in the registry.`);
    process.exit(1);
  }

  // --list: show available presets
  if (args.includes("--list")) {
    if (refUpdated) {
      saveManifest(manifest);
      console.log(`  ${icon.update} Updated manifest ref to ${c.cyan}${latestRef}${c.reset}`);
    }

    console.log(`\n  ${icon.preset} Available presets  ${c.dim}(${manifest.source} @ ${latestRef})${c.reset}\n`);
    for (const [name, patterns] of Object.entries(registry.presets)) {
      console.log(`    ${icon.star} ${c.bold}${name}${c.reset}`);
      for (const p of patterns) {
        console.log(`      └─ ${c.dim}${p}${c.reset}`);
      }
    }
    console.log();
    return;
  }

  const presetName = args[0];
  const patterns = registry.presets[presetName];

  if (!patterns) {
    console.error(`  ${icon.error} Unknown preset: "${presetName}"`);
    console.error(`  Available: ${Object.keys(registry.presets).join(", ")}`);
    process.exit(1);
  }

  console.log(`\n  ${icon.preset} Applying preset: ${c.bold}${presetName}${c.reset}\n`);

  let added = 0;
  for (const pattern of patterns) {
    if (pattern.endsWith("/*")) {
      const catKey = normalizeCategoryKey(pattern.slice(0, -2));
      const cat = registry.categories[catKey];
      if (!cat) {
        console.warn(`  ${icon.warning} Unknown category in preset: "${pattern.slice(0, -2)}"`);
        continue;
      }
      for (const skillKey of Object.keys(cat.skills)) {
        const full = `${catKey}/${skillKey}`;
        if (!manifest.include.includes(full)) {
          manifest.include.push(full);
          console.log(`  ${icon.add}  ${full}`);
          added++;
        }
      }
    } else {
      // Individual skill/agent reference
      const [rawCatKey, skillKey] = pattern.split("/");
      const catKey = normalizeCategoryKey(rawCatKey);
      const cat = registry.categories[catKey];
      if (!cat || !skillKey || !cat.skills[skillKey]) {
        console.warn(`  ${icon.warning} Unknown entry in preset: "${pattern}"`);
        continue;
      }
      const normalizedEntry = `${catKey}/${skillKey}`;
      if (!manifest.include.includes(normalizedEntry)) {
        manifest.include.push(normalizedEntry);
        console.log(`  ${icon.add}  ${normalizedEntry}`);
        added++;
      }
    }
  }

  if (added > 0 || refUpdated) {
    saveManifest(manifest);
  }

  if (refUpdated) {
    console.log(`  ${icon.update} Updated manifest ref to ${c.cyan}${latestRef}${c.reset}`);
  }

  if (added > 0) {
    console.log(`\n  ${icon.success} Added ${c.bold}${added}${c.reset} item(s) via preset "${presetName}". Run ${c.bold}agent install${c.reset} to download.`);
  } else {
    console.log(`\n  ${icon.info} All entries from preset "${presetName}" are already in your manifest.`);
  }
}

/**
 * `agent diff` — Preview what would change on next install.
 *
 * Shows files that would be added, updated, or removed compared to what's
 * currently on disk.
 */
function cmdDiff(args: string[]): void {
  const manifest = loadManifest();

  if (manifest.include.length === 0) {
    console.log(`  ${icon.info} No entries in manifest. Nothing to diff.`);
    return;
  }

  const formatIdx = args.indexOf("--format");
  const format = formatIdx !== -1 ? args[formatIdx + 1] : undefined;
  const agentOutputPath = resolveAgentOutputPath(format, manifest.agentOutput);

  const spinner = new Spinner("Comparing manifest against installed files");
  spinner.start();

  const repoDir = cloneOrUpdate(manifest.source, manifest.ref);
  const registry = loadRegistry(repoDir);
  const { skills, agents } = resolveIncludes(manifest.include, registry);
  spinner.stop("Comparison ready");

  let changes = 0;

  console.log();

  // ── Skills diff ──
  const outRoot = path.resolve(manifest.outputDir);

  for (const { key, srcPath, destFolder } of skills) {
    const dest = path.join(outRoot, destFolder);
    if (!fs.existsSync(dest)) {
      console.log(`  ${c.green}+${c.reset}  ${key}  ${c.dim}(new)${c.reset}`);
      changes++;
    } else {
      const src = path.join(repoDir, srcPath);
      if (fs.existsSync(src) && hasDifferences(src, dest)) {
        console.log(`  ${c.yellow}~${c.reset}  ${key}  ${c.dim}(modified)${c.reset}`);
        changes++;
      } else {
        console.log(`  ${c.dim}=${c.reset}  ${key}  ${c.dim}(unchanged)${c.reset}`);
      }
    }
  }

  // Check for skills installed but no longer in manifest
  if (fs.existsSync(outRoot)) {
    const installedDirs = fs.readdirSync(outRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const expectedDirs = new Set(skills.map((s) => s.destFolder));
    for (const dir of installedDirs) {
      if (!expectedDirs.has(dir)) {
        console.log(`  ${c.magenta}-${c.reset}  ${dir}  ${c.dim}(will be removed)${c.reset}`);
        changes++;
      }
    }
  }

  // ── Agent instructions diff ──
  if (agents.length > 0) {
    const outputPath = path.resolve(agentOutputPath);
    if (!fs.existsSync(outputPath)) {
      console.log(`  ${c.green}+${c.reset}  ${agentOutputPath}  ${c.dim}(new agent instructions)${c.reset}`);
      changes++;
    } else {
      const sections: string[] = [];
      for (const { srcPath } of agents) {
        const src = path.join(repoDir, srcPath);
        const agentFile = findAgentFile(src);
        if (agentFile) {
          sections.push(fs.readFileSync(agentFile, "utf-8").trim());
        }
      }
      // Include local overrides in comparison
      const localPath = path.resolve(LOCAL_INSTRUCTIONS_FILE);
      if (fs.existsSync(localPath)) {
        const local = fs.readFileSync(localPath, "utf-8").trim();
        if (local) sections.push(local);
      }
      if (sections.length > 0) {
        const newContent = composeAgentFile(sections);
        const currentContent = fs.readFileSync(outputPath, "utf-8");
        if (newContent !== currentContent) {
          console.log(`  ${c.yellow}~${c.reset}  ${agentOutputPath}  ${c.dim}(agent instructions modified)${c.reset}`);
          changes++;
        } else {
          console.log(`  ${c.dim}=${c.reset}  ${agentOutputPath}  ${c.dim}(unchanged)${c.reset}`);
        }
      }
    }
  }

  const summary = changes === 0
    ? `${icon.success} No changes detected.`
    : `${icon.diff} ${c.bold}${changes}${c.reset} change(s) detected. Run ${c.bold}agent install${c.reset} to apply.`;
  console.log(`\n  ${summary}`);
}

/**
 * `agent create <type>` — Scaffold a new agent.md or skill.md template.
 */
function cmdCreate(args: string[]): void {
  const type = args[0];
  if (!type || !["agent", "skill"].includes(type)) {
    console.error("Usage: agent create <agent|skill>");
    console.error("  e.g. agent create agent     → scaffold agent.md template");
    console.error("  e.g. agent create skill     → scaffold skill.md template");
    process.exit(1);
  }

  const outputArg = args[1];

  if (type === "agent") {
    const fileName = outputArg ?? "agent.md";
    if (fs.existsSync(fileName)) {
      console.error(`  ${icon.error} File already exists: ${fileName}`);
      process.exit(1);
    }
    fs.writeFileSync(fileName, AGENT_TEMPLATE);
    console.log(`  ${icon.scaffold} Created ${c.bold}${fileName}${c.reset} — edit with your project-specific instructions.`);
    console.log(`\n  ${c.dim}Tip: To use as local overrides, rename to ${LOCAL_INSTRUCTIONS_FILE}.${c.reset}`);
    console.log(`  ${c.dim}     Local overrides are automatically appended during agent install.${c.reset}`);
  } else {
    const dirName = outputArg ?? "my-skill";
    const skillPath = path.join(dirName, "skill.md");
    if (fs.existsSync(skillPath)) {
      console.error(`  ${icon.error} File already exists: ${skillPath}`);
      process.exit(1);
    }
    fs.mkdirSync(dirName, { recursive: true });
    fs.writeFileSync(skillPath, SKILL_TEMPLATE);
    console.log(`  ${icon.scaffold} Created ${c.bold}${skillPath}${c.reset} — edit with your skill content.`);
    console.log(`\n  ${c.dim}To add to the registry, update registry.json with a reference to this folder.${c.reset}`);
  }
}

/**
 * `agent prompt` — Browse, view, and copy prompts from the registry.
 *
 * Subcommands:
 *   agent prompt list           Show prompts for your included categories
 *   agent prompt list --all     Show all available prompts
 *   agent prompt show <key>     Display a prompt in the terminal
 *   agent prompt copy <key>     Copy a prompt to the clipboard
 */
function cmdPrompt(args: string[]): void {
  const sub = args[0];

  if (!sub || sub === "--help") {
    console.error(`  ${icon.prompt} Usage: agent prompt <list|show|copy>`);
    console.error("");
    console.error("  Subcommands:");
    console.error(`    list              Show prompts for your included categories`);
    console.error(`    list --all        Show all available prompts`);
    console.error(`    show <key>        Display a prompt in the terminal`);
    console.error(`    copy <key>        Copy a prompt to the clipboard`);
    console.error("");
    console.error("  Keys use category/prompt format, e.g. development/code-review");
    process.exit(1);
  }

  const manifest = loadManifest();
  const repoDir = cloneOrUpdate(manifest.source, manifest.ref);
  const registry = loadRegistry(repoDir);

  switch (sub) {
    case "list": {
      const showAll = args.includes("--all");
      const includedCats = new Set(
        manifest.include.map((i) => i.split("/")[0]),
      );

      console.log(
        `\n  ${icon.prompt} ${c.bold}Available prompts${c.reset}  ${c.dim}(${showAll ? "all categories" : "your categories"})${c.reset}\n`,
      );

      let total = 0;

      for (const [catKey, cat] of Object.entries(registry.categories)) {
        if (!cat.prompts || Object.keys(cat.prompts).length === 0) continue;
        if (!showAll && !includedCats.has(catKey)) continue;

        const typeIcon = cat.type === "agent" ? icon.agent : icon.skill;
        console.log(`  ${typeIcon} ${c.bold}${cat.name}${c.reset}  ${c.dim}(${catKey})${c.reset}`);

        for (const [promptKey, filename] of Object.entries(cat.prompts)) {
          const key = `${catKey}/${promptKey}`;
          console.log(`    ${icon.prompt}  ${c.cyan}${key}${c.reset}  ${c.dim}${icon.arrow} ${filename}${c.reset}`);
          total++;
        }
        console.log();
      }

      if (total === 0) {
        if (showAll) {
          console.log(`  ${icon.info} No prompts defined in the registry.`);
        } else {
          console.log(`  ${icon.info} No prompts available for your included categories.`);
          console.log(`  ${c.dim}  Use ${c.cyan}agent prompt list --all${c.reset}${c.dim} to see all prompts.${c.reset}`);
        }
      } else {
        console.log(`  ${c.dim}Use ${c.cyan}agent prompt show <key>${c.reset}${c.dim} to view a prompt.${c.reset}`);
        console.log(`  ${c.dim}Use ${c.cyan}agent prompt copy <key>${c.reset}${c.dim} to copy to clipboard.${c.reset}`);
      }
      break;
    }

    case "show": {
      const key = args[1];
      if (!key) {
        console.error(`  ${icon.error} Usage: agent prompt show <category/prompt>`);
        console.error("  e.g. agent prompt show development/code-review");
        process.exit(1);
      }
      const content = resolvePromptContent(key, registry, repoDir);
      console.log(`\n  ${icon.prompt} ${c.bold}${key}${c.reset}\n`);
      console.log(content);
      break;
    }

    case "copy": {
      const key = args[1];
      if (!key) {
        console.error(`  ${icon.error} Usage: agent prompt copy <category/prompt>`);
        console.error("  e.g. agent prompt copy development/code-review");
        process.exit(1);
      }
      const content = resolvePromptContent(key, registry, repoDir);
      copyToClipboard(content);
      console.log(`  ${icon.success} Copied ${c.cyan}${key}${c.reset} to clipboard ${icon.clipboard}`);
      break;
    }

    default:
      console.error(`  ${icon.error} Unknown prompt subcommand: "${sub}"`);
      console.error(`  Available: list, show, copy`);
      process.exit(1);
  }
}

/**
 * Resolve a prompt key (e.g. "development/code-review") to its file content.
 */
function resolvePromptContent(
  key: string,
  registry: Registry,
  repoDir: string,
): string {
  const [catKey, promptKey] = key.split("/");
  if (!catKey || !promptKey) {
    console.error(`  ${icon.error} Invalid prompt key: "${key}". Use "category/prompt" format.`);
    process.exit(1);
  }

  const cat = registry.categories[catKey];
  if (!cat) {
    console.error(`  ${icon.error} Unknown category: "${catKey}"`);
    process.exit(1);
  }

  if (!cat.prompts || !cat.prompts[promptKey]) {
    console.error(`  ${icon.error} Unknown prompt: "${promptKey}" in category "${catKey}"`);
    if (cat.prompts) {
      console.error(`  Available: ${Object.keys(cat.prompts).join(", ")}`);
    } else {
      console.error(`  No prompts defined for category "${catKey}"`);
    }
    process.exit(1);
  }

  const promptsPath = cat.promptsPath ?? path.join(path.dirname(cat.path), "prompts");
  const filePath = path.join(repoDir, promptsPath, cat.prompts[promptKey]);

  if (!fs.existsSync(filePath)) {
    console.error(`  ${icon.error} Prompt file not found: ${filePath}`);
    process.exit(1);
  }

  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Copy text to the system clipboard.
 */
function copyToClipboard(text: string): void {
  const { execSync } = childProcess;
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text });
    } else if (process.platform === "win32") {
      execSync("clip", { input: text });
    } else {
      // Linux — try xclip, then xsel
      try {
        execSync("xclip -selection clipboard", { input: text });
      } catch {
        execSync("xsel --clipboard --input", { input: text });
      }
    }
  } catch {
    console.error(`  ${icon.warning} Could not copy to clipboard. Content printed above instead.`);
    console.log(text);
  }
}

/**
 * `agent completions <shell>` — Output shell completion script.
 */
function cmdCompletions(args: string[]): void {
  const shell = args[0];
  if (!shell) {
    console.error("Usage: agent completions <zsh|bash|fish>");
    console.error("");
    console.error("Install completions:");
    console.error("  zsh:   agent completions zsh > ~/.zsh/completions/_agent");
    console.error("  bash:  agent completions bash >> ~/.bashrc");
    console.error("  fish:  agent completions fish > ~/.config/fish/completions/agent.fish");
    process.exit(1);
  }
  try {
    const script = generateCompletions(shell);
    process.stdout.write(script);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Write a README.md index file inside the skills output directory.
 */
function generateSkillsIndex(outRoot: string, resolved: ResolvedEntry[]): void {
  const content = generateSkillsIndexContent(resolved);
  fs.writeFileSync(path.join(outRoot, "README.md"), content);
}

/**
 * Check that generated outputs are listed in .gitignore and warn if not.
 */
function checkGitignore(outputDir: string, agentOutputPath: string): void {
  const gitignorePath = path.resolve(".gitignore");

  // Only check if we're in a git repo
  if (!fs.existsSync(path.resolve(".git"))) return;

  const gitignoreContent = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf-8")
    : null;

  const missing = findMissingGitignoreEntries(
    [outputDir, agentOutputPath],
    gitignoreContent,
  );

  if (missing.length > 0) {
    console.log(`\n  ${icon.warning} The following generated paths are not in .gitignore:\n`);
    for (const m of missing) {
      console.log(`      ${m}`);
    }

    const additions = missing.join("\n");
    const header = "\n# agent-cli generated files\n";
    const existing = gitignoreContent ?? "";
    const newContent = existing.endsWith("\n")
      ? existing + header + additions + "\n"
      : existing + "\n" + header + additions + "\n";

    fs.writeFileSync(gitignorePath, newContent);
    console.log(`\n  ${icon.success} Auto-added to .gitignore`);
  }
}

/**
 * Print CLI help text.
 */
function printHelp(): void {
  console.log(`
  ${c.dim}v${VERSION}${c.reset}  ${c.dim}─${c.reset} Pull agent skills and instructions from a central repository.

  ${c.bold}USAGE${c.reset}
    ${c.cyan}agent${c.reset} <command> [options]

  ${c.bold}COMMANDS${c.reset}
    ${icon.init}  ${c.cyan}init${c.reset} [source]              Create a ${MANIFEST_FILE} manifest
        --output <dir>           Output directory for skills ${c.dim}(default: .agent)${c.reset}
        -i, --interactive        Browse and select entries interactively
        ${c.dim}(defaults to github:ftnilsson/agent-cli)${c.reset}

    ${icon.install}  ${c.cyan}install${c.reset}                    Pull skills + compose agent instructions
        --format <target>        Agent output format:
                                   copilot  ${icon.arrow} .github/copilot-instructions.md
                                   cursor   ${icon.arrow} .cursorrules
                                   claude   ${icon.arrow} CLAUDE.md
                                   ${c.dim}(default ${icon.arrow} agent.md)${c.reset}
        --no-gitignore           Skip auto-adding generated files to .gitignore

    ${icon.list}  ${c.cyan}list${c.reset}                       Show entries in your manifest
        --remote                 Show all available entries from the registry

    ${icon.update}  ${c.cyan}update${c.reset}                     Update the ref to the latest tag/commit

    ${icon.add}  ${c.cyan}add${c.reset} <category/key>         Add skill(s) or agent instruction(s)
        e.g. agent add development/git agents/nextjs
        e.g. agent add game-dev/*          ${c.dim}(add entire category)${c.reset}
        e.g. agent add agents/*            ${c.dim}(add all agent instructions)${c.reset}

    ${icon.remove}  ${c.cyan}remove${c.reset} <category/key>      Remove entries from the manifest
        e.g. agent remove development/git
        e.g. agent remove agents/*         ${c.dim}(remove all agent instructions)${c.reset}

    ${icon.preset}  ${c.cyan}preset${c.reset} <name>              Apply a named preset (adds skills + agents)
        --list                   Show available presets
        e.g. agent preset nextjs
        e.g. agent preset --list

    ${icon.diff}  ${c.cyan}diff${c.reset}                       Preview what would change on next install
        --format <target>        Same format options as install

    ${icon.scaffold}  ${c.cyan}create${c.reset} <agent|skill>       Scaffold a new agent.md or skill.md template
        e.g. agent create agent
        e.g. agent create skill my-skill

    ${icon.prompt}  ${c.cyan}prompt${c.reset} <list|show|copy>    Browse and use prompts
        list                     Show prompts for your categories
        list --all               Show all available prompts
        show <key>               Display a prompt in the terminal
        copy <key>               Copy a prompt to the clipboard
        e.g. agent prompt show development/code-review

    ${c.cyan}completions${c.reset} <shell>        Output shell completion script
        e.g. agent completions zsh > ~/.zsh/completions/_agent

  ${c.bold}OPTIONS${c.reset}
    -v, --version              Show version
    -h, --help                 Show this help

  ${c.bold}LOCAL OVERRIDES${c.reset}
    Create a ${c.cyan}${LOCAL_INSTRUCTIONS_FILE}${c.reset} file in your project root.
    Its contents are automatically appended to the composed agent.md
    during ${c.cyan}agent install${c.reset}.

  ${c.bold}EXAMPLES${c.reset}
    ${c.dim}# Quick start with default repository${c.reset}
    ${c.cyan}agent init --interactive${c.reset}

    ${c.dim}# Or use a custom repository${c.reset}
    ${c.cyan}agent init github:your-org/agents${c.reset}
    ${c.cyan}agent preset nextjs${c.reset}
    ${c.cyan}agent install${c.reset}

    ${c.dim}# Preview changes before installing${c.reset}
    ${c.cyan}agent diff${c.reset}

    ${c.dim}# Output for different tools${c.reset}
    ${c.cyan}agent install --format copilot${c.reset}
    ${c.cyan}agent install --format cursor${c.reset}
    ${c.cyan}agent install --format claude${c.reset}

    ${c.dim}# Scaffold templates${c.reset}
    ${c.cyan}agent create agent${c.reset}
    ${c.cyan}agent create skill my-new-skill${c.reset}

    ${c.dim}# Browse and use prompts${c.reset}
    ${c.cyan}agent prompt list${c.reset}
    ${c.cyan}agent prompt show development/code-review${c.reset}
    ${c.cyan}agent prompt copy frontend/accessibility-audit${c.reset}

    ${c.dim}# Install shell completions${c.reset}
    ${c.cyan}agent completions zsh > ~/.zsh/completions/_agent${c.reset}
`);
}
