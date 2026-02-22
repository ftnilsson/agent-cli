# agent-cli

```
   ╔═══════════════════════════════════════════════════╗
   ║                                                   ║
   ║     █████╗  ██████╗ ███████╗███╗   ██╗████████╗   ║
   ║    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝   ║
   ║    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║      ║
   ║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║      ║
   ║    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║      ║
   ║    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝      ║
   ║                    ┌─┐┬  ┬                        ║
   ║                    │  │  │                        ║
   ║                    └─┘┴─┘┴                        ║
   ║                                                   ║
   ╚═══════════════════════════════════════════════════╝
```

A CLI tool for pulling agent skills and AI coding instructions from a central repository into any project. Pick only the skills and agent instructions you need — compose them into a single agent.md (or tool-specific format) with one command.

## Prerequisites

- **Node.js** ≥ 18
- **Git** installed and available on your `PATH`

## Installation

### From source (this repo)

```bash
cd agent-cli
npm install
npm run build
npm link        # makes the "agent" command available globally
```

### Or run directly without installing

```bash
cd agent-cli
npm install
npm run build
node dist/index.js <command>
```

## Uninstall

If installed globally with npm:

```bash
npm uninstall -g agent-cli
```

If linked from source with `npm link`:

```bash
npm unlink -g agent-cli
```

If `npm unlink -g agent-cli` fails with exit code `127`, your shell cannot find `npm`. Ensure Node.js is installed and available on `PATH`, then retry. If you use pnpm, run:

```bash
pnpm unlink -g agent-cli
```

## Quick Start

```bash
# 1. Quick start with default repository (interactive mode)
agent init --interactive

# 2. Or specify your own repository
agent init github:your-org/agents
agent preset nextjs
agent install

# 3. Output for your preferred AI tool
agent install --format copilot    # → .github/copilot-instructions.md
agent install --format cursor     # → .cursorrules
agent install --format claude     # → CLAUDE.md
```

## Commands

### `agent init [source]`

Create a `.agent.json` manifest in the current directory.

If no source is provided, defaults to `github:ftnilsson/agent-cli` (this repository).

```bash
agent init                                      # uses default repository
agent init --interactive                        # browse default repository interactively
agent init github:your-org/agents               # use custom repository  
agent init github:your-org/agents --output .agent-skills   # custom output dir
agent init github:your-org/agents --interactive             # browse & select
agent init github:your-org/agents -i                        # shorthand
```

| Option | Default | Description |
|---|---|---|
| `--output <dir>` | `.agent` | Directory where skills will be installed |
| `-i, --interactive` | — | Browse and select entries interactively |

### `agent install`

Read `.agent.json` and install everything:
- **Skills** → copied into the output directory
- **Agent instructions** → composed into a single file
- **Local overrides** → automatically appended from `local-instructions.md`

```bash
agent install
agent install --format copilot     # output to .github/copilot-instructions.md
agent install --format cursor      # output to .cursorrules
agent install --format claude      # output to CLAUDE.md
agent install --no-gitignore       # skip adding generated files to .gitignore
```

| Option | Description |
|---|---|
| `--format <target>` | Agent output format — `copilot`, `cursor`, `claude` (default: `agent.md`) |
| `--no-gitignore` | Skip auto-adding generated files to `.gitignore` |

By default, the CLI checks that generated files are listed in `.gitignore` and adds them automatically. Use `--no-gitignore` to opt out.

### `agent list`

Show which skills and agents are in your manifest.

```bash
agent list            # show included entries
agent list --remote   # show ALL available entries in the registry
```

Remote listing marks included entries with `●` and available ones with `○`.

`--remote` always reads the latest registry from HEAD. If your manifest ref is behind, you will see a note suggesting `agent update`.

### `agent update`

Fetch the latest ref (tag or commit) from the source repo and update `.agent.json`.

```bash
agent update           # updates the ref
agent install          # then re-install to apply
```

### `agent add <category[/key]>`

Add one or more skills or agent instructions to your manifest. Accepts `category/key`, `category/*`, or just a bare category name (treated as `category/*`).

```bash
agent add development/git                           # single skill
agent add development/architecture agents/nextjs    # multiple at once
agent add serverless aws-cloud                      # bare category names (= category/*)
agent add aws azure                                 # aliases for aws-cloud / azure-cloud
agent add game-dev/*                                # entire category with wildcard
agent add agents/*                                  # all agent instructions

# install multiple full categories
agent add development/* aws-cloud/* serverless/*
agent install
```

Validates against the latest remote registry — typos are caught immediately. If your manifest ref is behind, it is updated automatically.

### `agent remove <category/key>`

Remove entries from your manifest.

```bash
agent remove development/git
agent remove game-dev/*       # remove entire category
agent remove agents/*         # remove all agent instructions
```

### `agent preset <name>`

Apply a named preset — a curated set of skills and agent instructions for a specific stack.

```bash
agent preset --list            # show available presets
agent preset nextjs            # apply the Next.js preset
agent preset nestjs            # apply the NestJS preset
agent preset react             # apply the React SPA preset
agent preset unity-full        # apply the Unity game dev preset
agent preset aws-cloud         # apply the AWS cloud preset
agent preset serverless-aws    # apply the serverless + AWS preset
```

Presets are resolved against the latest remote registry. If your manifest ref is behind, it is updated automatically.

### `agent diff`

Preview what would change on the next `agent install` — like `terraform plan` for your AI instructions.

```bash
agent diff
agent diff --format copilot
```

Output markers:
- `+` — new (will be added)
- `~` — modified (will be updated)
- `=` — unchanged (no action)
- `-` — removed (will be deleted)

### `agent create <agent|skill>`

Scaffold a new agent.md or skill.md from a template.

```bash
agent create agent                   # creates agent.md template
agent create agent my-instructions   # creates my-instructions template
agent create skill                   # creates my-skill/skill.md template
agent create skill api-patterns      # creates api-patterns/skill.md template
```

### `agent prompt <list|show|copy>`

Browse, preview, and copy curated prompts that match your selected categories. Prompts are also installed as files during `agent install`.

```bash
agent prompt list              # show prompts for your included categories
agent prompt list --all        # show all available prompts
agent prompt show development/code-review    # display a prompt in the terminal
agent prompt copy development/code-review    # copy a prompt to your clipboard
```

| Subcommand | Description |
|---|---|
| `list` | Show prompts for categories in your manifest |
| `list --all` | Show all prompts in the registry |
| `show <key>` | Print a prompt's content to the terminal |
| `copy <key>` | Copy a prompt to the clipboard |

Keys use `category/prompt` format — e.g. `development/code-review`, `backend/api-review`, `frontend/accessibility-audit`.

During `agent install`, prompts are automatically copied into your output directory under `prompts/<category>/`.

### `agent completions <shell>`

Output shell completion scripts for tab-completion support.

```bash
# Zsh
agent completions zsh > ~/.zsh/completions/_agent

# Bash
agent completions bash >> ~/.bashrc

# Fish
agent completions fish > ~/.config/fish/completions/agent.fish
```

## Local Overrides

Create a `local-instructions.md` file in your project root to add project-specific rules that are automatically appended to the composed agent.md during `agent install`.

This lets you layer project-specific instructions on top of curated base instructions — without forking the source repository.

```markdown
<!-- local-instructions.md -->
# Project-Specific Rules

- Use pnpm instead of npm
- All API responses must follow the JSON:API spec
- Database migrations must be backward-compatible
```

## Manifest Format (`.agent.json`)

```json
{
  "source": "github:your-org/agents",
  "ref": "v1.0.0",
  "outputDir": ".agent",
  "include": [
    "development/architecture",
    "development/git",
    "agents/nextjs",
    "agents/typescript"
  ],
  "agentOutput": "agent.md"
}
```

| Field | Description |
|---|---|
| `source` | Repository reference — `github:owner/repo` or a full git URL |
| `ref` | Git ref to pin to (tag, branch, or SHA) |
| `outputDir` | Local directory where skills are copied |
| `include` | Array of `category/key` entries to install |
| `agentOutput` | Default output path for composed agent instructions |

## Registry Format (`registry.json`)

The source repository must have a `registry.json` at its root:

```json
{
  "version": "1.0.0",
  "categories": {
    "agents": {
      "name": "Agent Instructions",
      "description": "AI coding agent instruction sets.",
      "path": "agents/instructions",
      "type": "agent",
      "skills": {
        "nextjs": "nextjs-fullstack",
        "typescript": "typescript-general"
      }
    },
    "development": {
      "name": "Development",
      "description": "Universal software development skills.",
      "path": "development/skills",
      "type": "skill",
      "skills": {
        "architecture": "01-architecture-and-system-design",
        "git": "02-version-control-and-git"
      }
    }
  },
  "presets": {
    "nextjs": ["development/*", "agents/nextjs", "agents/typescript"]
  }
}
```

Categories with `"type": "agent"` are composed into the agent instructions file; categories with `"type": "skill"` (or no type) are copied as individual files.

## Creating Your Own Skills Repository

To use agent-cli with your own repository, follow this structure:

### Required Structure

```
your-repo/
├── registry.json          # Required: defines categories, skills, and presets
├── development/
│   ├── README.md
│   ├── skills/
│   │   ├── 01-architecture-and-system-design/
│   │   │   └── skill.md
│   │   ├── 02-version-control-and-git/
│   │   │   └── skill.md
│   │   └── 03-debugging-and-problem-solving/
│   │       └── skill.md
│   └── prompts/
│       ├── code-review.md
│       └── refactor.md
├── backend/
│   ├── README.md
│   ├── skills/
│   │   ├── 01-api-design/
│   │   │   └── skill.md
│   │   └── 02-database-modelling/
│   │       └── skill.md
│   └── prompts/
│       └── api-review.md
└── agents/
    ├── README.md
    └── instructions/
        ├── nextjs-fullstack/
        │   └── agent.md
        └── react-spa/
            └── agent.md
```

### 1. Create `registry.json`

This file is **required** at the repository root. It defines:
- **Categories**: groups of related skills or agent instructions
- **Skills**: individual skill keys mapped to folder names
- **Prompts**: reusable prompts for each category
- **Presets**: predefined combinations for quick setup

```json
{
  "version": "1.0.0",
  "categories": {
    "development": {
      "name": "Development",
      "description": "Universal software development skills.",
      "path": "development/skills",
      "type": "skill",
      "skills": {
        "architecture": "01-architecture-and-system-design",
        "git": "02-version-control-and-git",
        "debugging": "03-debugging-and-problem-solving"
      },
      "promptsPath": "development/prompts",
      "prompts": {
        "code-review": "code-review.md",
        "refactor": "refactor.md"
      }
    },
    "backend": {
      "name": "Backend",
      "description": "Backend development skills.",
      "path": "backend/skills",
      "type": "skill",
      "skills": {
        "api-design": "01-api-design",
        "database": "02-database-modelling"
      },
      "promptsPath": "backend/prompts",
      "prompts": {
        "api-review": "api-review.md"
      }
    },
    "agents": {
      "name": "Agent Instructions",
      "description": "AI coding agent instruction sets.",
      "path": "agents/instructions",
      "type": "agent",
      "skills": {
        "nextjs": "nextjs-fullstack",
        "react-spa": "react-spa"
      }
    }
  },
  "presets": {
    "fullstack": ["development/*", "backend/*"],
    "nextjs": ["development/*", "backend/*", "agents/nextjs"]
  }
}
```

### 2. Skills vs Agent Instructions

**Skills** (`"type": "skill"` or no type):
- Individual, focused markdown files
- Copied as separate files during `agent install`
- Live in numbered folders (e.g., `01-api-design/`)
- Each contains a `skill.md` file

**Agent Instructions** (`"type": "agent"`):
- Complete instruction sets for AI coding assistants
- Composed together into a single output file (e.g., `agent.md`)
- Live in named folders (e.g., `nextjs-fullstack/`)
- Each contains an `agent.md` file

### 3. Folder Naming Convention

**Skills folders**: Use numbered prefixes for ordering:
```
01-architecture-and-system-design/
02-version-control-and-git/
03-debugging-and-problem-solving/
```

**Agent instruction folders**: Use descriptive names:
```
nextjs-fullstack/
react-spa/
typescript-general/
```

Both types require the corresponding markdown file inside:
- Skills: `skill.md`
- Agents: `agent.md`

### 4. Adding Prompts (Optional)

Prompts are reusable templates for common AI tasks. Add a `prompts/` folder to any category:

```
backend/
├── skills/
│   └── ...
└── prompts/
    ├── api-review.md
    ├── schema-review.md
    └── security-audit.md
```

Reference them in `registry.json`:
```json
{
  "categories": {
    "backend": {
      "promptsPath": "backend/prompts",
      "prompts": {
        "api-review": "api-review.md",
        "schema-review": "schema-review.md",
        "security-audit": "security-audit.md"
      }
    }
  }
}
```

Users can then access them with:
```bash
agent prompt list
agent prompt show backend/api-review
agent prompt copy backend/api-review
```

### 5. Using Your Repository

Once your repository is set up, users can pull from it:

```bash
# By default, agent-cli uses github:ftnilsson/agent-cli
agent init                              # uses the default repository
agent init --interactive                # browse default repository

# Point to your custom repository
agent init github:your-org/your-skills-repo

# Or use a different Git source
agent init https://github.com/your-org/your-skills-repo.git

# Browse and select interactively
agent init github:your-org/your-skills-repo --interactive

# Install the selected skills
agent install
```

### Example Skill File

**File**: `development/skills/01-architecture-and-system-design/skill.md`

```markdown
# Architecture and System Design

You are skilled in software architecture and system design principles.

## Core Principles

- Design systems that are scalable, maintainable, and testable
- Follow SOLID principles and design patterns
- Consider trade-offs between complexity and functionality
- Document architectural decisions using ADRs

## Approach

When designing systems:
1. Start with requirements and constraints
2. Identify key components and their relationships
3. Consider scalability, performance, and security
4. Document your decisions and reasoning
```

### Example Agent File

**File**: `agents/instructions/nextjs-fullstack/agent.md`

```markdown
# Next.js Fullstack Developer

You are an expert Next.js developer building full-stack applications.

## Stack

- Next.js 14+ with App Router
- TypeScript
- Tailwind CSS
- Server Actions for mutations
- React Server Components by default

## Conventions

- Use Server Components unless interactivity is needed
- Put client components in a `components/` folder with 'use client' directive
- Use Server Actions instead of API routes for data mutations
- Follow Next.js file-based routing conventions
```

### Tips

- **Start simple**: Begin with 1-2 categories and expand as needed
- **Use clear descriptions**: Help users understand what each skill provides
- **Leverage presets**: Create common combinations for quick setup
- **Number your skills**: Use prefixes (01-, 02-) to control ordering
- **Document everything**: Add README files to explain each category
- **Version your registry**: Update the version field when making breaking changes

## How It Works

1. **`init`** clones the source repo, resolves the latest ref, and writes `.agent.json`
2. **`add`/`remove`** validate against `registry.json` and update the manifest
3. **`install`** checks out the pinned ref, resolves each key to a folder path, copies skills, composes agent instructions, appends local overrides, and guards `.gitignore`
4. **`update`** fetches the latest tag (or commit SHA) and updates the manifest ref
5. **`diff`** compares what would be installed versus what's currently on disk

The source repo is cached at `~/.cache/agent-cli/` so subsequent operations are fast and work offline after the initial clone.

## Development

```bash
cd agent-cli
npm install

# Run in dev mode (no build step)
npx tsx src/index.ts --help

# Build
npm run build

# Run built version
node dist/index.js --help
```
