# Physics & Collision

## Description

This skill covers Godot 4's physics system including RigidBody nodes, Area nodes, collision shapes, raycasting, and the collision layer/mask system. Understanding how physics bodies interact is essential for gameplay mechanics like combat, pickups, triggers, and environmental interactions.

## When To Use

- Implementing physics-based movement (RigidBody2D/3D)
- Setting up collision detection for combat, triggers, or pickups
- Using raycasts for line-of-sight, ground detection, or aiming
- Configuring collision layers to optimize physics performance
- Working with joints, springs, or ragdoll physics

## Prerequisites

- Godot 4.3+ project with collision layers named in Project Settings
- Understanding of CharacterBody, RigidBody, StaticBody, and Area nodes
- GDScript fundamentals

## Instructions

### 1. Physics Body Types

| Node | Use Case | Moved By |
|------|----------|----------|
| `StaticBody2D/3D` | Walls, floors, immovable objects | Never (or only via code, no physics) |
| `CharacterBody2D/3D` | Players, NPCs — game-controlled movement | `move_and_slide()` in `_physics_process()` |
| `RigidBody2D/3D` | Physics-driven objects (crates, balls, ragdolls) | Physics engine |
| `Area2D/3D` | Triggers, detection zones, pickups | Not a physics body — detects overlaps |

### 2. Collision Layers & Masks

Configure layers in **Project → Project Settings → General → Layer Names → 2D Physics / 3D Physics**:

```
Layer 1: Environment
Layer 2: Player
Layer 3: Enemy
Layer 4: Projectile
Layer 5: Pickup
Layer 6: Trigger
Layer 7: Interactable
```

- **Layer** = "I am on this layer" (what I am).
- **Mask** = "I interact with these layers" (what I detect).

```gdscript
# Set layers in code
collision_layer = 1 << 1   # Layer 2 (Player)
collision_mask = (1 << 0) | (1 << 2) | (1 << 6)  # Layers 1, 3, 7
```

### 3. Area Nodes for Triggers

```gdscript
# Pickup zone
extends Area2D

signal collected

func _ready() -> void:
    body_entered.connect(_on_body_entered)

func _on_body_entered(body: Node2D) -> void:
    if body is PlayerController2D:
        collected.emit()
        queue_free()
```

```gdscript
# Damage zone (hitbox/hurtbox pattern)
class_name Hitbox
extends Area2D

@export var damage: int = 10

func _ready() -> void:
    area_entered.connect(_on_area_entered)

func _on_area_entered(area: Area2D) -> void:
    if area is Hurtbox:
        area.take_hit(damage, global_position)
```

```gdscript
class_name Hurtbox
extends Area2D

signal hit_received(damage: int, from: Vector2)

func take_hit(damage: int, from: Vector2) -> void:
    hit_received.emit(damage, from)
```

### 4. Raycasting

#### RayCast Nodes (Persistent)

```gdscript
@onready var _ground_ray: RayCast2D = $GroundRay
@onready var _wall_ray: RayCast2D = $WallRay

func _physics_process(_delta: float) -> void:
    if _ground_ray.is_colliding():
        var collider := _ground_ray.get_collider()
        var point := _ground_ray.get_collision_point()
```

#### Direct Space Queries (One-Shot)

```gdscript
func shoot_ray(from: Vector2, to: Vector2) -> Dictionary:
    var space := get_world_2d().direct_space_state
    var query := PhysicsRayQueryParameters2D.create(from, to, collision_mask)
    query.exclude = [self]  # Don't hit yourself
    return space.intersect_ray(query)

# Usage
var result := shoot_ray(global_position, target_position)
if result:
    var hit_collider: Node2D = result.collider
    var hit_point: Vector2 = result.position
    var hit_normal: Vector2 = result.normal
```

#### Shape Queries

```gdscript
func overlap_circle(center: Vector2, radius: float, mask: int) -> Array[Dictionary]:
    var space := get_world_2d().direct_space_state
    var shape := CircleShape2D.new()
    shape.radius = radius
    var query := PhysicsShapeQueryParameters2D.new()
    query.shape = shape
    query.transform = Transform2D(0, center)
    query.collision_mask = mask
    return space.intersect_shape(query)
```

### 5. RigidBody Best Practices

```gdscript
extends RigidBody2D

# Apply forces in _integrate_forces for correct physics
func _integrate_forces(state: PhysicsDirectBodyState2D) -> void:
    # Apply custom force
    state.apply_central_force(Vector2(0, -500))

# Or use apply_force / apply_impulse from outside
func launch(direction: Vector2, power: float) -> void:
    apply_central_impulse(direction.normalized() * power)
```

## Best Practices

- Name collision layers descriptively in Project Settings before building levels.
- Use the Hitbox/Hurtbox pattern for combat — keep damage dealing and receiving separate.
- Use `Area` nodes for triggers and detection — not `CharacterBody` or `RigidBody`.
- Prefer `RayCast` nodes for persistent checks (ground detect); use direct queries for one-shot tests.
- Set collision masks precisely — a body should only detect layers it needs.
- Use `call_deferred("queue_free")` when freeing nodes inside physics callbacks.

## Common Pitfalls

- **Using `CharacterBody` for triggers.** Use `Area2D`/`Area3D` for detection zones.
- **Layer vs mask confusion.** Layer = what I am; Mask = what I scan for.
- **Modifying the scene tree in physics callbacks.** Use `call_deferred()`.
- **Not excluding self from raycasts.** Self-hits cause false positives.
- **Moving `RigidBody` with `position =`.** Use forces, impulses, or `_integrate_forces()`.
- **Too many collision layers on everything.** Be precise — fewer checks = better performance.

## Reference

- [Physics Introduction](https://docs.godotengine.org/en/stable/tutorials/physics/physics_introduction.html)
- [Ray-casting](https://docs.godotengine.org/en/stable/tutorials/physics/ray-casting.html)
- [Collision Layers and Masks](https://docs.godotengine.org/en/stable/tutorials/physics/physics_introduction.html#collision-layers-and-masks)
