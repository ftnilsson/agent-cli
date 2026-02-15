# Project Setup & Architecture

## Description

This skill covers creating and structuring Godot 4 projects for long-term maintainability, scalability, and team collaboration. A well-organized project from the start prevents costly refactors, reduces merge conflicts, and makes onboarding new team members straightforward.

## When To Use

- Starting a new Godot 4 project from scratch
- Restructuring an existing project that has grown disorganized
- Setting up autoloads and plugin architecture
- Configuring project settings and export presets
- Establishing coding conventions and folder standards for a team

## Prerequisites

- Godot 4.3 or later installed
- Basic familiarity with the Godot Editor interface
- A code editor (built-in script editor, VS Code with godot-tools, or Rider)

## Instructions

### 1. Create the Project

Create a new project via the Godot Project Manager. Choose the appropriate renderer:

| Renderer | Use Case |
|----------|----------|
| **Forward+** | Most 3D games — best visual quality with modern features |
| **Mobile** | Mobile-optimized 3D with reduced feature set |
| **Compatibility** | Widest platform support (WebGL, older hardware), OpenGL-based |

> Use Forward+ unless targeting mobile or web. You can switch renderers later in Project Settings.

### 2. Establish the Folder Structure

Organize the project using a feature-based layout:

```
project/
├── project.godot
├── scenes/
│   ├── main.tscn              # Entry scene
│   ├── levels/
│   ├── characters/
│   ├── objects/
│   └── ui/
├── scripts/
│   ├── autoload/              # Singletons
│   ├── player/
│   ├── enemies/
│   ├── systems/
│   ├── ui/
│   └── utilities/
├── resources/                 # .tres custom resource files
│   ├── weapons/
│   ├── enemies/
│   └── config/
├── assets/
│   ├── art/
│   │   ├── sprites/
│   │   ├── models/
│   │   ├── textures/
│   │   └── materials/
│   ├── audio/
│   │   ├── music/
│   │   └── sfx/
│   ├── fonts/
│   ├── shaders/
│   └── themes/
├── addons/                    # Third-party plugins
└── tests/                     # GdUnit4 / Gut test scripts
```

**Key principles:**
- Separate scenes, scripts, and assets into top-level folders.
- Group scripts by feature, not by type.
- Use `resources/` for custom `.tres` files that are data-driven.
- The `addons/` folder is managed by Godot's plugin system.

### 3. Configure Autoloads

Register global singletons in **Project → Project Settings → Globals → Autoload**:

| Autoload | Purpose |
|----------|---------|
| `EventBus` | Global signal bus for decoupled communication |
| `GameManager` | Game state, pausing, game over |
| `SceneManager` | Scene transitions with loading screens |
| `AudioManager` | Music and SFX playback |
| `SaveManager` | Save/load game state |

```gdscript
# scripts/autoload/event_bus.gd
extends Node

signal player_died
signal score_changed(new_score: int)
signal level_completed(level_id: int)
```

**Rules for autoloads:**
- Keep them small and focused — one responsibility each.
- Autoloads coordinate; scenes own game logic.
- Access via their registered name: `EventBus.player_died.emit()`.

### 4. Configure Project Settings

#### Display
- Set **Viewport Width/Height** to your target resolution.
- Set **Stretch Mode** to `canvas_items` and **Stretch Aspect** to `expand` for responsive scaling.

#### Input Map
- Define all input actions early: `move_left`, `move_right`, `jump`, `attack`, `interact`, `pause`.
- Assign keyboard, gamepad, and touch bindings.

#### Physics
- Configure **Physics Ticks Per Second** (default 60).
- Set up **Collision Layers** with descriptive names (via Project Settings → Layer Names).

#### Rendering
- Choose the renderer backend.
- Configure anti-aliasing and shadow quality.

### 5. Set Up Version Control

#### .gitignore

```gitignore
# Godot
.godot/
*.translation

# Imports (regenerated)  
.import/

# Mono / .NET
.mono/
data_*/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
```

#### .gitattributes

```gitattributes
# Godot scene and resource files
*.tscn merge=union
*.tres merge=union

# Binary assets
*.png filter=lfs diff=lfs merge=lfs -text
*.jpg filter=lfs diff=lfs merge=lfs -text
*.ogg filter=lfs diff=lfs merge=lfs -text
*.wav filter=lfs diff=lfs merge=lfs -text
*.mp3 filter=lfs diff=lfs merge=lfs -text
*.glb filter=lfs diff=lfs merge=lfs -text
*.gltf filter=lfs diff=lfs merge=lfs -text
```

### 6. Configure GDScript Formatting

Set up consistent formatting in **Editor → Editor Settings → Text Editor**:
- **Indent Size**: 4 (tabs, matching Godot convention)
- Use the built-in GDScript formatter or `gdtoolkit` for CI.

## Best Practices

- Start every project with autoloads and folder structure before writing gameplay code.
- Use `class_name` for scripts that will be referenced by type.
- Keep scenes small and composable — avoid monolithic scenes with hundreds of nodes.
- Use feature branches and merge to `main` via pull requests.
- Set up export presets early so you can test builds throughout development.
- Use Godot's built-in plugin system (`addons/`) for reusable tools and editor extensions.

## Common Pitfalls

- **Giant autoloads.** Don't turn autoloads into god objects. Split responsibilities.
- **Flat folder structure.** Without sub-folders, projects become unmanageable at 50+ files.
- **Forgetting .gitignore.** The `.godot/` folder must never be committed — it contains generated cache.
- **Hardcoding paths.** Use `@export` and `preload()` / `load()` instead of string paths where possible.
- **Skipping collision layer setup.** Configure layers early to avoid expensive unnecessary collision checks.

## Reference

- [Godot Project Organization](https://docs.godotengine.org/en/stable/tutorials/best_practices/project_organization.html)
- [GDScript Style Guide](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_styleguide.html)
- [Autoloads (Singletons)](https://docs.godotengine.org/en/stable/tutorials/scripting/singletons_autoload.html)
