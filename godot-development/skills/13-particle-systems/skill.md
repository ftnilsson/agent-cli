# Particle Systems

## Description

This skill covers GPUParticles2D/3D and CPUParticles2D/3D in Godot 4 for visual effects like fire, smoke, explosions, trails, and ambient particles. GPU particles offer high performance for large counts; CPU particles provide deterministic results.

## When To Use

- Creating fire, smoke, sparks, explosions, dust clouds
- Adding ambient effects (rain, snow, fireflies, fog)
- Building projectile trails and impact effects
- Using sub-emitters for multi-stage particle effects
- Optimising particle systems for target platform

## Prerequisites

- Godot 4.3+ rendering basics
- Understanding of materials and textures
- Scene Architecture skill for organising VFX nodes

## Instructions

### 1. GPUParticles2D Basics

1. Add a `GPUParticles2D` node to your scene.
2. Create a new `ParticleProcessMaterial` in the `Process Material` property.
3. Assign a texture in the `Texture` property (or use the default point).
4. Configure in the Inspector: Amount, Lifetime, Speed, Gravity, Emission Shape.

```gdscript
# Spawning a one-shot particle effect from code
func spawn_hit_effect(position: Vector2) -> void:
    var particles := preload("res://effects/hit_particles.tscn").instantiate()
    particles.global_position = position
    particles.emitting = true
    particles.one_shot = true
    particles.finished.connect(particles.queue_free)
    get_tree().current_scene.add_child(particles)
```

### 2. ParticleProcessMaterial Properties

Key properties to tune for common effects:

| Property | Purpose |
|---|---|
| `direction` | Initial emission direction |
| `spread` | Cone angle of emission |
| `initial_velocity_min/max` | Starting speed range |
| `gravity` | Gravity vector (set to `(0, 0, 0)` for zero-g) |
| `angular_velocity_min/max` | Spin rate |
| `scale_min/max` | Starting size range |
| `scale_curve` | Size over lifetime |
| `color` | Base colour |
| `color_ramp` | Colour gradient over lifetime |
| `emission_shape` | Point, sphere, box, ring, points |
| `damping_min/max` | Speed decay over lifetime |

### 3. Common Effect Recipes

#### Fire

```
Amount: 50
Lifetime: 0.8
Direction: (0, -1, 0)
Spread: 15°
Initial Velocity: 40-80
Gravity: (0, -20, 0)  # negative = upward for 2D
Scale Curve: 1.0 → 0.0
Color Ramp: White → Yellow → Orange → Red → Transparent
```

#### Explosion (One-Shot)

```
Amount: 80
One Shot: true
Explosiveness: 1.0
Lifetime: 0.5
Emission Shape: Sphere (radius 5)
Direction: outward
Initial Velocity: 100-300
Damping: 50-80
Scale Curve: 1.0 → 0.3
Color Ramp: White → Yellow → Transparent
```

#### Trail

```
Amount: 30
Lifetime: 0.4
Emission Shape: Point
Initial Velocity: 0
Gravity: (0, 0, 0)
Scale Curve: 1.0 → 0.0
Use as Trail: true (set Trail properties)
```

### 4. Sub-Emitters (Godot 4+)

Sub-emitters let particles spawn child particles on birth, collision, or death.

1. Create a second `GPUParticles2D` node.
2. On the main particle's `ParticleProcessMaterial`, set `Sub Emitter` to the child node.
3. Choose the trigger: `at_end`, `at_collision`, or `constant`.

Example: Firework that spawns sparks on death.

### 5. GPUParticles3D

Same workflow as 2D, but in 3D space:

1. Add `GPUParticles3D` to the scene.
2. Configure `ParticleProcessMaterial` (same properties, 3D vectors).
3. Optionally assign a mesh in `Draw Pass 1` for 3D-shaped particles.

```gdscript
# Trigger explosion and auto-cleanup
func explode_3d(pos: Vector3) -> void:
    var fx := preload("res://effects/explosion_3d.tscn").instantiate()
    fx.global_position = pos
    fx.emitting = true
    fx.one_shot = true
    fx.finished.connect(fx.queue_free)
    add_child(fx)
```

### 6. CPUParticles (Deterministic)

When you need deterministic particles (replays, networking) or target low-end hardware:

1. Use `CPUParticles2D` or `CPUParticles3D` instead.
2. Same properties as GPU variants but processed on CPU.
3. Right-click a `GPUParticles` node → "Convert to CPUParticles" for quick conversion.

### 7. Particle Effect Manager

```gdscript
class_name EffectsManager
extends Node

const EFFECTS := {
    "hit": preload("res://effects/hit.tscn"),
    "explosion": preload("res://effects/explosion.tscn"),
    "dust": preload("res://effects/dust.tscn"),
}

func spawn(effect_name: String, pos: Vector2) -> void:
    var scene: PackedScene = EFFECTS.get(effect_name)
    if scene == null:
        push_warning("Unknown effect: %s" % effect_name)
        return
    
    var fx := scene.instantiate() as GPUParticles2D
    fx.global_position = pos
    fx.emitting = true
    fx.one_shot = true
    fx.finished.connect(fx.queue_free)
    get_tree().current_scene.add_child(fx)
```

## Best Practices

- Use `one_shot = true` and connect `finished` to `queue_free()` for transient effects.
- Create an effects manager autoload to centralize spawning.
- Preload particle scenes — don't load them on demand during gameplay.
- Keep particle counts low on mobile; prefer CPUParticles on low-end devices.
- Use `explosiveness = 1.0` for one-shot bursts; use `0.0` for continuous emission.
- Use `visibility_rect` (2D) or `visibility_aabb` (3D) to ensure particles aren't culled prematurely.

## Common Pitfalls

- **Particles disappear at edges.** The `visibility_rect`/`visibility_aabb` is too small. Increase it to cover the full effect area.
- **One-shot doesn't emit.** You must call `restart()` or set `emitting = true` after adding to the tree.
- **Too many particles.** Each GPU particle system has overhead. Pool or limit concurrent effects.
- **Not using object pooling.** Instantiating and freeing particle scenes every frame is expensive. Pool them.

## Reference

- [GPUParticles2D](https://docs.godotengine.org/en/stable/classes/class_gpuparticles2d.html)
- [GPUParticles3D](https://docs.godotengine.org/en/stable/classes/class_gpuparticles3d.html)
- [ParticleProcessMaterial](https://docs.godotengine.org/en/stable/classes/class_particleprocessmaterial.html)
