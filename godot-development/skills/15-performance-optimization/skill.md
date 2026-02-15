# Performance Optimization

## Description

This skill covers profiling and optimising Godot 4 games for smooth frame rates and low memory usage. It covers the built-in profiler, Servers API for bulk operations, object pooling, draw call reduction, and platform-specific considerations.

## When To Use

- Frame rate drops below target (60 fps / 16.6 ms)
- Memory usage grows unbounded during gameplay
- Profiling to find bottlenecks before optimising
- Reducing draw calls in complex 2D/3D scenes
- Pooling frequently spawned and destroyed objects
- Targeting mobile or web platforms

## Prerequisites

- Godot 4.3+ project with gameplay to profile
- Understanding of `_process()` vs `_physics_process()`
- Scene Architecture skill for structural optimisations

## Instructions

### 1. Using the Built-In Profiler

1. Run the game from the editor.
2. Open **Debugger → Profiler** tab.
3. Enable profiling and analyse the flame graph.
4. Look for functions taking the most time per frame.

Key metrics:
- **Process Time**: Time spent in `_process()` callbacks
- **Physics Time**: Time spent in `_physics_process()` callbacks
- **Idle Time**: Time GPU is waiting (GPU-bound)
- **Draw Calls**: Number of rendering commands sent to GPU

### 2. Code-Level Profiling

```gdscript
# Manual timing for specific code sections
var _start_time: int

func _measure_start() -> void:
    _start_time = Time.get_ticks_usec()

func _measure_end(label: String) -> void:
    var elapsed := Time.get_ticks_usec() - _start_time
    print("%s: %.2f ms" % [label, elapsed / 1000.0])
```

### 3. Process Optimisation

```gdscript
# BAD — expensive work every frame
func _process(delta: float) -> void:
    var enemies := get_tree().get_nodes_in_group("enemies")
    for enemy in enemies:
        if global_position.distance_to(enemy.global_position) < 100.0:
            _react_to(enemy)

# GOOD — throttle expensive checks
var _check_timer: float = 0.0
const CHECK_INTERVAL: float = 0.2  # 5 times per second

func _process(delta: float) -> void:
    _check_timer += delta
    if _check_timer < CHECK_INTERVAL:
        return
    _check_timer = 0.0
    
    var enemies := get_tree().get_nodes_in_group("enemies")
    for enemy in enemies:
        if global_position.distance_squared_to(enemy.global_position) < 10000.0:
            _react_to(enemy)
```

Key optimisation: use `distance_squared_to()` instead of `distance_to()` to avoid the square root.

### 4. Object Pooling

```gdscript
class_name ObjectPool
extends Node

var _scene: PackedScene
var _pool: Array[Node] = []

func _init(scene: PackedScene, initial_size: int = 10) -> void:
    _scene = scene
    for i in initial_size:
        var obj := _scene.instantiate()
        obj.set_process(false)
        obj.set_physics_process(false)
        obj.hide()
        _pool.append(obj)
        add_child(obj)

func acquire() -> Node:
    for obj in _pool:
        if not obj.visible:
            obj.show()
            obj.set_process(true)
            obj.set_physics_process(true)
            return obj
    
    # Pool exhausted — grow
    var obj := _scene.instantiate()
    _pool.append(obj)
    add_child(obj)
    return obj

func release(obj: Node) -> void:
    obj.hide()
    obj.set_process(false)
    obj.set_physics_process(false)
```

Usage:
```gdscript
var _bullet_pool: ObjectPool

func _ready() -> void:
    _bullet_pool = ObjectPool.new(preload("res://projectiles/bullet.tscn"), 50)
    add_child(_bullet_pool)

func fire() -> void:
    var bullet := _bullet_pool.acquire()
    bullet.global_position = _muzzle.global_position
    bullet.direction = _aim_direction
```

### 5. Reducing Draw Calls

**2D:**
- Use `CanvasGroup` to batch child draw calls into one.
- Use texture atlases (sprite sheets) instead of individual textures.
- Minimise unique materials — shared materials get batched automatically.
- Set `z_index` carefully — layer changes break batching.

**3D:**
- Use `MultiMeshInstance3D` for many identical objects (grass, trees, debris).
- Enable occlusion culling for indoor scenes.
- Use LOD (Level of Detail) with `LODGroup` or manual distance checks.
- Merge static geometry when possible.

```gdscript
# MultiMesh for thousands of instances
func create_grass(positions: PackedVector3Array) -> void:
    var mm := MultiMesh.new()
    mm.transform_format = MultiMesh.TRANSFORM_3D
    mm.mesh = preload("res://meshes/grass_blade.tres")
    mm.instance_count = positions.size()
    
    for i in positions.size():
        var xform := Transform3D()
        xform.origin = positions[i]
        mm.set_instance_transform(i, xform)
    
    $MultiMeshInstance3D.multimesh = mm
```

### 6. Physics Optimisation

- Use simplified collision shapes — circles/spheres over polygons/meshes.
- Disable collision for objects that don't need it.
- Use collision layers and masks to limit what checks against what.
- Set `CharacterBody.motion_mode` to `GROUNDED` for platformers to reduce checks.

### 7. Memory Management

```gdscript
# Free resources explicitly when done
func _exit_tree() -> void:
    _large_texture = null  # Release reference so GC can collect

# Preload in _ready, not during gameplay
var _cached_scene: PackedScene

func _ready() -> void:
    _cached_scene = preload("res://scenes/heavy_scene.tscn")
```

- Use `ResourceLoader.load_threaded_request()` for loading large assets without stuttering.
- Monitor memory in **Debugger → Monitors → Memory**.

### 8. Rendering Budget

| Target | Frame Budget | Notes |
|---|---|---|
| 60 fps | 16.6 ms | Desktop / console standard |
| 30 fps | 33.3 ms | Acceptable for mobile / strategy |
| 120 fps | 8.3 ms | VR / competitive |

Split the budget: ~60% game logic, ~40% rendering. If rendering takes 12 ms, you have only 4.6 ms for game code at 60 fps.

## Best Practices

- **Measure first, optimise second.** Use the profiler to find actual bottlenecks.
- Use `distance_squared_to()` for range checks — it avoids the square root.
- Pool objects that are frequently created and destroyed (bullets, particles, coins).
- Use `call_deferred()` for non-urgent operations to spread load across frames.
- Move heavy calculations to separate threads with `Thread` or `WorkerThreadPool`.
- Disable `_process()` and `_physics_process()` on nodes that don't need per-frame updates.

## Common Pitfalls

- **Premature optimisation.** Don't optimise before profiling — you'll waste time on non-bottlenecks.
- **Using `get_node()` in loops.** Cache node references in `_ready()`.
- **Allocating in hot paths.** Avoid creating arrays, dictionaries, or objects in `_process()`.
- **Not using collision layers.** Every physics body checks against every other by default — limit this.
- **Loading resources synchronously.** Use `ResourceLoader.load_threaded_request()` for large assets.

## Reference

- [Performance](https://docs.godotengine.org/en/stable/tutorials/performance/index.html)
- [Using Profiler](https://docs.godotengine.org/en/stable/tutorials/scripting/debug/the_profiler.html)
- [MultiMesh](https://docs.godotengine.org/en/stable/tutorials/3d/using_multi_mesh_instance.html)
- [Thread](https://docs.godotengine.org/en/stable/classes/class_thread.html)
