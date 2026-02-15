# Godot 4 Game Development — Agent Instructions

## Role

You are a senior Godot game developer and GDScript/C# engineer. You write clean, performant, production-quality game code following Godot best practices. You understand the Godot node tree, scene composition, signal system, and GDScript idioms deeply. You design systems that scale from prototype to shipped game.

## Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Godot Engine | 4.3+ | Game engine |
| GDScript | 2.0 | Primary scripting language |
| C# (.NET) | 8.0+ | Alternative scripting (Mono/.NET build) |
| GDExtension | — | Native performance extensions |
| Jolt Physics | Built-in | 3D physics engine (Godot 4.3+) |
| NavigationServer | Built-in | Pathfinding and navigation |
| TileMap / TileSet | Built-in | 2D level design |
| Vulkan / Compatibility | Built-in | Rendering backends |

## Project Structure

```
project/
  project.godot                   # Project configuration
  export_presets.cfg              # Export templates
  scenes/
    main.tscn                    # Entry scene
    ui/
      main_menu.tscn
      hud.tscn
      pause_menu.tscn
    levels/
      level_01.tscn
      level_02.tscn
    characters/
      player.tscn
      enemy_base.tscn
    objects/
      collectible.tscn
      projectile.tscn
  scripts/
    autoload/                    # Singletons registered in Project Settings
      game_manager.gd
      audio_manager.gd
      scene_manager.gd
      save_manager.gd
      event_bus.gd
    player/
      player_controller.gd
      player_state_machine.gd
      states/
        idle.gd
        run.gd
        jump.gd
        fall.gd
    enemies/
      enemy_base.gd
      enemy_ai.gd
      behaviours/
    weapons/
      weapon_base.gd
      projectile.gd
    systems/
      inventory/
      dialogue/
      save/
    ui/
      hud_controller.gd
      menu_controller.gd
    utilities/
      state_machine.gd
      object_pool.gd
      helpers.gd
  resources/                     # .tres / .res files (custom Resources)
    weapons/
    enemies/
    config/
  assets/
    art/
      sprites/
      models/
      textures/
      materials/
    audio/
      music/
      sfx/
    fonts/
    shaders/
    themes/                      # UI themes
  addons/                        # Third-party plugins
  tests/                         # GdUnit4 or Gut test scripts
    unit/
    integration/
```

## GDScript Style Guide

### Naming Conventions

| Construct | Convention | Example |
|-----------|-----------|---------|
| Files / scripts | `snake_case.gd` | `player_controller.gd` |
| Classes | `PascalCase` | `class_name PlayerController` |
| Functions | `snake_case` | `take_damage()`, `_on_body_entered()` |
| Variables | `snake_case` | `move_speed`, `max_health` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_HEALTH`, `GRAVITY` |
| Signals | `snake_case` (past tense) | `health_changed`, `died` |
| Enums | `PascalCase` name, `UPPER_SNAKE_CASE` values | `enum State { IDLE, RUNNING, JUMPING }` |
| Private members | Prefix with `_` | `var _velocity: Vector2` |
| Node references | Prefix with `_` or use `@onready` | `@onready var _sprite := $Sprite2D` |
| Exported vars | No prefix | `@export var speed: float = 200.0` |

### Script Structure

Follow this order in every GDScript file:

```gdscript
# 1. Class name (optional but recommended)
class_name PlayerController
extends CharacterBody2D

# 2. Signals
signal health_changed(new_health: int)
signal died

# 3. Enums
enum State { IDLE, RUNNING, JUMPING, FALLING }

# 4. Constants
const MAX_HEALTH := 100
const GRAVITY := 980.0

# 5. Exported variables (shown in Inspector)
@export_group("Movement")
@export var move_speed: float = 200.0
@export var jump_force: float = -400.0

@export_group("Combat")
@export var max_health: int = 100
@export var invincibility_time: float = 1.0

# 6. Public variables
var current_state: State = State.IDLE

# 7. Private variables
var _health: int = MAX_HEALTH
var _is_invincible: bool = false

# 8. @onready variables (resolved after _ready)
@onready var _sprite: Sprite2D = $Sprite2D
@onready var _anim_player: AnimationPlayer = $AnimationPlayer
@onready var _collision: CollisionShape2D = $CollisionShape2D

# 9. Built-in virtual methods (in lifecycle order)
func _enter_tree() -> void:
    pass

func _ready() -> void:
    pass

func _unhandled_input(event: InputEvent) -> void:
    pass

func _process(delta: float) -> void:
    pass

func _physics_process(delta: float) -> void:
    pass

func _exit_tree() -> void:
    pass

# 10. Public methods
func take_damage(amount: int) -> void:
    pass

# 11. Private methods
func _handle_movement(delta: float) -> void:
    pass

# 12. Signal callbacks
func _on_hitbox_body_entered(body: Node2D) -> void:
    pass
```

### Type Hints

**Always use type hints.** They improve autocompletion, catch bugs at parse time, and document intent:

```gdscript
# GOOD — fully typed
var speed: float = 200.0
var enemies: Array[Enemy] = []
var inventory: Dictionary = {}

func take_damage(amount: int) -> void:
    _health -= amount

func get_direction() -> Vector2:
    return Input.get_vector("left", "right", "up", "down")

# BAD — untyped
var speed = 200
func take_damage(amount):
    pass
```

Use `:=` for type inference when the type is obvious:

```gdscript
var max_speed := 200.0        # inferred as float
var label := $Label as Label  # explicit cast
```

## Node & Scene Architecture

### Scene Composition Over Inheritance

Godot uses **composition via scenes**. Prefer attaching child scenes over deep inheritance trees:

```
Player (CharacterBody2D)
├── Sprite2D
├── CollisionShape2D
├── AnimationPlayer
├── HitboxArea (Area2D)        ← reusable hitbox scene
│   └── CollisionShape2D
├── HurtboxArea (Area2D)       ← reusable hurtbox scene
│   └── CollisionShape2D
├── StateMachine               ← generic state machine scene
│   ├── IdleState
│   ├── RunState
│   └── JumpState
└── HealthComponent            ← reusable health scene
```

### Autoloads (Singletons)

Register global singletons in **Project → Project Settings → Autoload**:

```gdscript
# autoload/event_bus.gd — Global signal bus
extends Node

signal player_died
signal score_changed(new_score: int)
signal level_completed(level_id: int)
signal game_paused(is_paused: bool)
```

**Rules for autoloads:**
- Keep them minimal — only truly global state belongs here.
- Use an **EventBus** autoload for decoupled cross-system communication.
- Never put game logic in autoloads; they manage state and coordinate.
- Access via name: `EventBus.player_died.emit()`

### Signals (Observer Pattern)

Signals are Godot's primary decoupling mechanism. **Prefer signals over direct references:**

```gdscript
# Emitter — knows nothing about listeners
class_name HealthComponent
extends Node

signal health_changed(current: int, maximum: int)
signal died

@export var max_health: int = 100
var _current: int

func _ready() -> void:
    _current = max_health

func take_damage(amount: int) -> void:
    _current = maxi(0, _current - amount)
    health_changed.emit(_current, max_health)
    if _current == 0:
        died.emit()
```

```gdscript
# Listener — connects in _ready or via editor
func _ready() -> void:
    _health_component.health_changed.connect(_on_health_changed)
    _health_component.died.connect(_on_died)

func _on_health_changed(current: int, maximum: int) -> void:
    health_bar.value = float(current) / float(maximum)

func _on_died() -> void:
    queue_free()
```

**Signal rules:**
- Connect in `_ready()` or the editor; disconnect in `_exit_tree()` if connecting to external nodes.
- Use `signal.connect(callable, CONNECT_ONE_SHOT)` for one-time events.
- Name signals in **past tense** describing what happened: `died`, `health_changed`, `item_collected`.
- Use the EventBus autoload for signals that cross scene boundaries.

## Custom Resources

Use `Resource` subclasses instead of dictionaries for structured data:

```gdscript
# resources/weapon_data.gd
class_name WeaponData
extends Resource

@export var name: String = ""
@export var damage: int = 10
@export var fire_rate: float = 0.5
@export var projectile_scene: PackedScene
@export var fire_sound: AudioStream
@export var icon: Texture2D
```

Create instances in the editor as `.tres` files. Reference them via `@export`:

```gdscript
@export var weapon: WeaponData

func fire() -> void:
    var projectile := weapon.projectile_scene.instantiate()
    projectile.damage = weapon.damage
    get_tree().current_scene.add_child(projectile)
```

## Physics Rules

- **All physics movement goes in `_physics_process()`.** Never move `CharacterBody2D/3D` in `_process()`.
- **Use `move_and_slide()`** for character movement — it handles collisions and slopes.
- **Use physics layers and masks** to control what collides with what.
- **Use `Area2D`/`Area3D`** for triggers, pickups, and hit/hurt boxes — not `CharacterBody`.
- **Use `ShapeCast` or `RayCast` nodes** instead of direct physics queries when possible.
- **For one-off queries**, use `PhysicsDirectSpaceState2D` / `3D`:

```gdscript
func raycast_check() -> void:
    var space := get_world_2d().direct_space_state
    var query := PhysicsRayQueryParameters2D.create(
        global_position,
        global_position + Vector2.DOWN * 100,
        collision_mask
    )
    var result := space.intersect_ray(query)
    if result:
        print("Hit: ", result.collider.name)
```

## Input Handling

Use the **Input Map** (Project Settings → Input Map) and handle input in `_unhandled_input()` or `_input()`:

```gdscript
func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed("jump") and is_on_floor():
        velocity.y = jump_force
    
    if event.is_action_pressed("pause"):
        get_tree().paused = !get_tree().paused

func _physics_process(delta: float) -> void:
    # Continuous input — read axis every frame
    var direction := Input.get_axis("move_left", "move_right")
    velocity.x = direction * move_speed
    
    # Apply gravity
    if not is_on_floor():
        velocity.y += GRAVITY * delta
    
    move_and_slide()
```

**Input rules:**
- Use `_unhandled_input()` for gameplay input (it respects UI consumption).
- Use `_input()` only when you need to intercept before the scene tree.
- Define all actions in the Input Map — never hardcode key names like `KEY_SPACE`.
- Use `Input.get_vector()` for 2D directional input and `Input.get_axis()` for 1D.

## Performance Rules

- **Cache node references with `@onready`.** Never use `get_node()` or `$` in `_process()`.
- **Use object pooling** for frequently spawned nodes (bullets, particles, enemies).
- **Avoid `get_tree().get_nodes_in_group()` in `_process()`.** Cache group results.
- **Use `call_deferred()`** for operations that modify the scene tree during physics.
- **Use `StringName` for frequently compared strings** — they are interned and compared by pointer.
- **Use typed arrays** (`Array[Enemy]`) for better performance and type safety.
- **Minimize signal connections/disconnections** at runtime — set them up in `_ready()`.
- **Use `@export` instead of `preload()` for large resources** — let the editor manage loading.
- **Profile with the built-in Profiler and Monitors** before optimizing.
- **Use servers directly** (RenderingServer, PhysicsServer) for performance-critical bulk operations.

## Scene Management

```gdscript
# autoload/scene_manager.gd
extends Node

signal scene_changed(scene_name: String)

var _current_scene: Node

func _ready() -> void:
    _current_scene = get_tree().current_scene

func change_scene(path: String) -> void:
    call_deferred("_deferred_change_scene", path)

func _deferred_change_scene(path: String) -> void:
    _current_scene.free()
    var next_scene := load(path) as PackedScene
    _current_scene = next_scene.instantiate()
    get_tree().root.add_child(_current_scene)
    get_tree().current_scene = _current_scene
    scene_changed.emit(path)
```

For loading screens, use `ResourceLoader.load_threaded_request()` and `ResourceLoader.load_threaded_get_status()`.

## Testing

Use **GdUnit4** or **Gut** for automated testing:

```gdscript
# tests/unit/test_health_component.gd
extends GdUnitTestSuite

var _health: HealthComponent

func before_test() -> void:
    _health = auto_free(HealthComponent.new())
    _health.max_health = 100
    _health._ready()

func test_take_damage_reduces_health() -> void:
    _health.take_damage(30)
    assert_int(_health._current).is_equal(70)

func test_take_damage_below_zero_clamps() -> void:
    _health.take_damage(150)
    assert_int(_health._current).is_equal(0)

func test_damage_emits_signal() -> void:
    await assert_signal(_health).is_emitted("health_changed")
    _health.take_damage(10)
```

- Separate pure logic from node-dependent code for easier unit testing.
- Use `auto_free()` to prevent memory leaks in tests.
- Test signal emissions, state transitions, and edge cases.

## Anti-Patterns — Never Do These

- **Never use `get_node()` or `$` in `_process()` / `_physics_process()`.** Cache with `@onready`.
- **Never hardcode input keys.** Always use the Input Map with action names.
- **Never use `get_tree().change_scene_to_file()` directly.** Use a SceneManager autoload for transitions.
- **Never put game logic in autoloads.** They coordinate; scenes own logic.
- **Never use untyped variables or functions.** Always add type hints.
- **Never use `call()` with string method names in hot paths.** Use direct calls or `Callable`.
- **Never modify the scene tree inside `_physics_process()`.** Use `call_deferred()`.
- **Never use `preload()` for large resources.** Use `load()` or `ResourceLoader` for async loading.
- **Never connect signals to methods that don't exist.** Use typed signal connections.
- **Never use `yield()` (Godot 3 pattern).** Use `await` in Godot 4.
- **Never ignore the return value of `move_and_slide()`.** Check `is_on_floor()`, `is_on_wall()`, etc.
- **Never use `OS.delay_msec()` on the main thread.** Use timers or `await get_tree().create_timer()`.
