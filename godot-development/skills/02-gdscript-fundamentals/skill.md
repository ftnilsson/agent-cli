# GDScript Fundamentals

## Description

This skill covers writing correct, performant, and idiomatic GDScript 2.0 for Godot 4. It spans the node lifecycle, signals, coroutines with `await`, custom Resources, and essential design patterns used in game development. Mastering these fundamentals is the foundation for every other Godot skill.

## When To Use

- Writing any new GDScript for a Godot project
- Implementing game logic, systems, or utilities
- Choosing between Node scripts, Resources, or plain RefCounted classes
- Setting up signal-driven communication between systems
- Applying design patterns (State Machine, Observer, Command, Object Pool)
- Debugging lifecycle or execution-order issues

## Prerequisites

- Godot 4.3+ project with folder structure configured
- Basic GDScript knowledge (variables, functions, control flow)
- Familiarity with the Godot Editor (Inspector, Scene dock, Output)

## Instructions

### 1. Node Lifecycle

Understanding the execution order is critical:

```
Tree Events
  ├── _init()              — Constructor. Called when the object is created in memory.
  ├── _enter_tree()        — Called when the node enters the scene tree.
  ├── _ready()             — Called once after all children are ready. Setup cross-references here.
  ├── _process(delta)      — Called every frame. Visual updates and non-physics logic.
  ├── _physics_process(delta) — Called every physics tick (fixed timestep). Movement and physics.
  ├── _unhandled_input(event) — Called for input not consumed by UI or other nodes.
  ├── _input(event)        — Called for all input events (before _unhandled_input).
  ├── _exit_tree()         — Called when the node leaves the scene tree. Cleanup here.
  └── _notification(what)  — Low-level notification handler.
```

**Rules:**
- Use `_ready()` to cache node references and connect signals.
- Use `_physics_process()` for movement and physics — it runs at a fixed timestep.
- Use `_process()` for visual updates, UI, and non-physics logic.
- Use `_unhandled_input()` for gameplay input (respects UI consumption).
- Use `_exit_tree()` to disconnect signals from external nodes.

```gdscript
extends CharacterBody2D

@onready var _sprite: Sprite2D = $Sprite2D
@onready var _anim: AnimationPlayer = $AnimationPlayer

func _ready() -> void:
    # Cross-references and signal connections
    EventBus.game_paused.connect(_on_game_paused)

func _physics_process(delta: float) -> void:
    var direction := Input.get_axis("move_left", "move_right")
    velocity.x = direction * 200.0
    velocity.y += 980.0 * delta
    move_and_slide()

func _exit_tree() -> void:
    EventBus.game_paused.disconnect(_on_game_paused)
```

### 2. Signals

Signals are Godot's built-in observer pattern:

```gdscript
# Define signals
signal health_changed(current: int, maximum: int)
signal died

# Emit signals
func take_damage(amount: int) -> void:
    _health = maxi(0, _health - amount)
    health_changed.emit(_health, max_health)
    if _health == 0:
        died.emit()

# Connect signals (in _ready of the listener)
func _ready() -> void:
    player.health_changed.connect(_on_health_changed)
    player.died.connect(_on_player_died)

# Disconnect signals (in _exit_tree if connecting to external nodes)
func _exit_tree() -> void:
    player.health_changed.disconnect(_on_health_changed)
```

**Signal best practices:**
- Name signals in past tense: `died`, `health_changed`, `item_collected`.
- Use typed parameters for clarity.
- Use `CONNECT_ONE_SHOT` flag for one-time events.
- Use an EventBus autoload for cross-scene signals.

### 3. Await and Coroutines

GDScript 4 uses `await` instead of `yield`:

```gdscript
# Wait for a signal
await get_tree().create_timer(1.0).timeout

# Wait for an animation to finish
_anim_player.play("attack")
await _anim_player.animation_finished

# Async loading
ResourceLoader.load_threaded_request("res://scenes/level_02.tscn")
# ... check status in _process ...
var scene: PackedScene = ResourceLoader.load_threaded_get("res://scenes/level_02.tscn")
```

**Await rules:**
- `await` pauses the current function until the signal fires.
- The function resumes on the next frame after the signal.
- Don't `await` in `_physics_process()` — it breaks the fixed timestep.
- Guard against the node being freed during an await:
  ```gdscript
  await get_tree().create_timer(2.0).timeout
  if not is_inside_tree():
      return
  ```

### 4. Design Patterns

#### State Machine

```gdscript
# scripts/utilities/state_machine.gd
class_name StateMachine
extends Node

@export var initial_state: State

var current_state: State

func _ready() -> void:
    for child in get_children():
        if child is State:
            child.state_machine = self
    current_state = initial_state
    current_state.enter()

func _process(delta: float) -> void:
    current_state.update(delta)

func _physics_process(delta: float) -> void:
    current_state.physics_update(delta)

func transition_to(target_state: State) -> void:
    current_state.exit()
    current_state = target_state
    current_state.enter()
```

```gdscript
# scripts/utilities/state.gd
class_name State
extends Node

var state_machine: StateMachine

func enter() -> void:
    pass

func exit() -> void:
    pass

func update(_delta: float) -> void:
    pass

func physics_update(_delta: float) -> void:
    pass
```

#### Object Pool

```gdscript
class_name ObjectPool
extends Node

@export var scene: PackedScene
@export var initial_size: int = 10

var _pool: Array[Node] = []

func _ready() -> void:
    for i in initial_size:
        var instance := scene.instantiate()
        instance.set_process(false)
        instance.hide()
        add_child(instance)
        _pool.append(instance)

func get_instance() -> Node:
    for obj in _pool:
        if not obj.visible:
            obj.show()
            obj.set_process(true)
            return obj
    # Pool exhausted — grow
    var instance := scene.instantiate()
    add_child(instance)
    _pool.append(instance)
    return instance

func return_instance(obj: Node) -> void:
    obj.set_process(false)
    obj.hide()
```

### 5. Type Hints

**Always use type hints.** They enable autocompletion, catch bugs early, and self-document:

```gdscript
# Variables
var speed: float = 200.0
var enemies: Array[Enemy] = []
var health: int = 100

# Functions
func calculate_damage(base: int, multiplier: float) -> int:
    return int(base * multiplier)

# Type inference with :=
var max_speed := 200.0
var label := $Label as Label
```

## Best Practices

- Always use type hints for variables, parameters, and return types.
- Follow the standard script structure order (signals, enums, constants, exports, vars, onready, lifecycle, public, private, callbacks).
- Use `@onready` to cache all node references that use `$`.
- Use `class_name` to register reusable types.
- Prefer composition (child scenes) over deep inheritance hierarchies.
- Use signals for decoupled communication, EventBus for cross-scene events.
- Name private members and methods with a `_` prefix.

## Common Pitfalls

- **Using `get_node()` in `_process()`.** Cache references with `@onready`.
- **Forgetting `await` guards.** Node may be freed while awaiting — always check `is_inside_tree()`.
- **Connecting signals without disconnecting.** Disconnect in `_exit_tree()` to prevent errors from freed callers.
- **Using `yield()`.** That's Godot 3 syntax; use `await` in Godot 4.
- **Untyped code.** Skipping type hints defeats GDScript's static analysis and autocompletion.
- **Monolithic scripts.** Break large scripts into composable child nodes with focused responsibilities.

## Reference

- [GDScript Reference](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html)
- [GDScript Style Guide](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_styleguide.html)
- [Signals](https://docs.godotengine.org/en/stable/getting_started/step_by_step/signals.html)
- [Using await](https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/gdscript_basics.html#awaiting-for-signals-or-coroutines)
