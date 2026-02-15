# Godot Game Development — Agent Skills

A comprehensive collection of agent skills for Godot 4 game development. Each skill provides structured instructions, best practices, code patterns, and pitfalls to avoid when working with specific Godot subsystems.

## Skills Overview

| # | Skill | Description |
|---|-------|-------------|
| 01 | [Project Setup & Architecture](skills/01-project-setup/skill.md) | Project structure, autoloads, plugins, and coding conventions |
| 02 | [GDScript Fundamentals](skills/02-gdscript-fundamentals/skill.md) | GDScript 2.0, type hints, signals, coroutines, design patterns |
| 03 | [Scene Architecture & Management](skills/03-scene-architecture/skill.md) | Scene tree, composition, transitions, and PackedScene workflows |
| 04 | [Player Controller](skills/04-player-controller/skill.md) | CharacterBody2D/3D, movement, state machines, camera systems |
| 05 | [Physics & Collision](skills/05-physics-and-collision/skill.md) | RigidBody, Area nodes, raycasting, collision layers |
| 06 | [Input System](skills/06-input-system/skill.md) | Input Map, actions, input events, rebinding |
| 07 | [Custom Resources](skills/07-custom-resources/skill.md) | Resource subclasses, data containers, shared configuration |
| 08 | [UI Development](skills/08-ui-development/skill.md) | Control nodes, themes, responsive layouts, signals |
| 09 | [Animation System](skills/09-animation-system/skill.md) | AnimationPlayer, AnimationTree, blend trees, tweens |
| 10 | [Audio System](skills/10-audio-system/skill.md) | AudioStreamPlayer, AudioBus, spatial audio, music management |
| 11 | [AI & Navigation](skills/11-ai-and-navigation/skill.md) | NavigationServer, pathfinding, state machines, behaviour trees |
| 12 | [Shaders & Visual Effects](skills/12-shaders-and-vfx/skill.md) | Godot shading language, VisualShader, post-processing |
| 13 | [Particle Systems & VFX](skills/13-particle-systems/skill.md) | GPUParticles2D/3D, CPUParticles, sub-emitters |
| 14 | [Networking & Multiplayer](skills/14-networking-multiplayer/skill.md) | MultiplayerAPI, RPCs, multiplayer spawner/synchronizer |
| 15 | [Performance Optimization](skills/15-performance-optimization/skill.md) | Profiling, servers API, object pooling, memory |
| 16 | [Testing & Debugging](skills/16-testing-and-debugging/skill.md) | GdUnit4/Gut, debug tooling, remote inspector |
| 17 | [Export & Deployment](skills/17-export-and-deployment/skill.md) | Export templates, platform builds, CI/CD pipelines |

## Skill File Standard

Each skill follows the **Skills.Md** standard:

```
skills/
└── <nn>-<skill-name>/
    └── skill.md
```

### Skill Markdown Structure

Every `skill.md` contains the following sections:

1. **Title** — Clear skill name
2. **Description** — What the skill covers and why it matters
3. **When To Use** — Trigger conditions for activating this skill
4. **Prerequisites** — Required Godot version, plugins, or prior skills
5. **Instructions** — Step-by-step guidance with code examples
6. **Best Practices** — Proven patterns and conventions
7. **Common Pitfalls** — Mistakes to avoid and how to fix them
8. **Reference** — Links to official Godot documentation

## Godot Version Target

These skills target **Godot 4.3+** with the **Vulkan Forward+** renderer as default, while noting Compatibility renderer differences where relevant.
