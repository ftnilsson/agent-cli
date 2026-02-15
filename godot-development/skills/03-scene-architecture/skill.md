# Scene Architecture & Management

## Description

This skill covers designing, organizing, and transitioning between scenes in Godot 4. Godot's scene system is its core architecture — understanding scene composition, instancing, and lifecycle management is essential for building maintainable games.

## When To Use

- Designing the scene tree hierarchy for a new game
- Implementing scene transitions (level loading, menus)
- Working with additive scene loading
- Creating reusable scene components (prefabs)
- Managing scene lifecycle and cleanup

## Prerequisites

- Godot 4.3+ with project structure configured
- Understanding of node types and the scene tree
- GDScript fundamentals (signals, `await`)

## Instructions

### 1. Scene Composition

Godot scenes are the building blocks of your game. Think of them as reusable components:

```
# Good — small, focused scenes
player.tscn          → CharacterBody2D + Sprite + Collision + Scripts
enemy_goblin.tscn    → CharacterBody2D + AI + Animation
health_bar.tscn      → Control + ProgressBar + Label
door.tscn            → StaticBody2D + Area2D (trigger) + AnimationPlayer

# Compose them in level scenes
level_01.tscn
├── TileMap
├── Player (instance of player.tscn)
├── Enemies
│   ├── Goblin1 (instance of enemy_goblin.tscn)
│   └── Goblin2 (instance of enemy_goblin.tscn)
├── Objects
│   ├── Door (instance of door.tscn)
│   └── Chest (instance of chest.tscn)
└── UI (instance of hud.tscn)
```

### 2. Scene Transitions

Create a SceneManager autoload for smooth transitions:

```gdscript
# scripts/autoload/scene_manager.gd
extends Node

signal transition_started
signal transition_finished

@onready var _animation: AnimationPlayer = $AnimationPlayer

var _next_scene_path: String = ""

func change_scene(path: String) -> void:
    transition_started.emit()
    _next_scene_path = path
    _animation.play("fade_out")
    await _animation.animation_finished
    get_tree().change_scene_to_file(path)
    _animation.play("fade_in")
    await _animation.animation_finished
    transition_finished.emit()

func reload_current_scene() -> void:
    change_scene(get_tree().current_scene.scene_file_path)
```

### 3. Async Scene Loading

For large scenes, use threaded loading:

```gdscript
func change_scene_async(path: String) -> void:
    transition_started.emit()
    ResourceLoader.load_threaded_request(path)
    
    # Show loading screen
    var loading_screen := preload("res://scenes/ui/loading_screen.tscn").instantiate()
    get_tree().root.add_child(loading_screen)
    
    while true:
        var progress: Array = []
        var status := ResourceLoader.load_threaded_get_status(path, progress)
        loading_screen.update_progress(progress[0])
        
        if status == ResourceLoader.THREAD_LOAD_LOADED:
            break
        elif status == ResourceLoader.THREAD_LOAD_FAILED:
            push_error("Failed to load scene: " + path)
            loading_screen.queue_free()
            return
        
        await get_tree().process_frame
    
    var scene: PackedScene = ResourceLoader.load_threaded_get(path)
    get_tree().change_scene_to_packed(scene)
    loading_screen.queue_free()
    transition_finished.emit()
```

### 4. Additive Scene Loading

Load scenes additively to layer gameplay with UI, overlays, or sub-levels:

```gdscript
var _loaded_scenes: Dictionary = {}

func load_scene_additive(path: String, parent: Node = null) -> Node:
    var scene: PackedScene = load(path)
    var instance := scene.instantiate()
    var target := parent if parent else get_tree().current_scene
    target.add_child(instance)
    _loaded_scenes[path] = instance
    return instance

func unload_scene(path: String) -> void:
    if _loaded_scenes.has(path):
        _loaded_scenes[path].queue_free()
        _loaded_scenes.erase(path)
```

### 5. PackedScene as Prefabs

Use `PackedScene` references for instancing reusable objects:

```gdscript
@export var enemy_scene: PackedScene
@export var spawn_points: Array[Marker2D] = []

func spawn_enemies() -> void:
    for point in spawn_points:
        var enemy := enemy_scene.instantiate() as CharacterBody2D
        enemy.global_position = point.global_position
        add_child(enemy)
```

## Best Practices

- Keep scenes small and single-purpose — one scene per logical entity.
- Use scene inheritance for variants (e.g., `enemy_base.tscn` → `enemy_goblin.tscn`).
- Always use a SceneManager autoload — never call `change_scene_to_file()` directly.
- Use `@export var scene: PackedScene` instead of hardcoded `preload()` paths where possible.
- Organize scenes by feature: `scenes/characters/`, `scenes/ui/`, `scenes/levels/`.
- Use `Marker2D`/`Marker3D` nodes for spawn points and reference positions.

## Common Pitfalls

- **Monolithic scenes.** A single scene with hundreds of nodes is unmaintainable. Break it up.
- **Circular scene references.** Scene A instances Scene B which instances Scene A. Use signals or autoloads instead.
- **Forgetting cleanup.** Nodes added with `add_child()` must be freed with `queue_free()` or they leak.
- **Blocking the main thread.** Use `ResourceLoader.load_threaded_request()` for large scenes.
- **Hardcoded scene paths.** Use `@export var scene: PackedScene` for editor-assignable scene references.

## Reference

- [Scene Tree](https://docs.godotengine.org/en/stable/getting_started/step_by_step/scene_tree.html)
- [Change Scenes](https://docs.godotengine.org/en/stable/tutorials/scripting/change_scenes_manually.html)
- [Background Loading](https://docs.godotengine.org/en/stable/tutorials/io/background_loading.html)
