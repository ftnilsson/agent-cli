# Player Controller

## Description

This skill covers implementing player character controllers in Godot 4 using `CharacterBody2D` and `CharacterBody3D`. It includes movement, jumping, state machines, and camera systems for both 2D and 3D games.

## When To Use

- Implementing player movement for a 2D platformer, top-down, or 3D game
- Building a state machine for player animations and behaviour
- Setting up camera follow systems
- Handling slopes, walls, and edge cases in character movement

## Prerequisites

- Godot 4.3+ with Input Map actions configured
- Understanding of `_physics_process()` and `move_and_slide()`
- GDScript fundamentals (type hints, signals, `@onready`)

## Instructions

### 1. 2D Platformer Controller

```gdscript
class_name PlayerController2D
extends CharacterBody2D

@export_group("Movement")
@export var move_speed: float = 200.0
@export var acceleration: float = 1500.0
@export var friction: float = 1200.0

@export_group("Jumping")
@export var jump_force: float = -350.0
@export var gravity: float = 980.0
@export var coyote_time: float = 0.12
@export var jump_buffer_time: float = 0.1

var _coyote_timer: float = 0.0
var _jump_buffer_timer: float = 0.0
var _was_on_floor: bool = false

@onready var _sprite: Sprite2D = $Sprite2D
@onready var _anim: AnimationPlayer = $AnimationPlayer

func _physics_process(delta: float) -> void:
    _apply_gravity(delta)
    _handle_jump(delta)
    _handle_movement(delta)
    _update_animations()
    move_and_slide()
    _was_on_floor = is_on_floor()

func _apply_gravity(delta: float) -> void:
    if not is_on_floor():
        velocity.y += gravity * delta

func _handle_jump(delta: float) -> void:
    # Coyote time
    if _was_on_floor and not is_on_floor():
        _coyote_timer = coyote_time
    _coyote_timer = maxf(0.0, _coyote_timer - delta)
    
    # Jump buffer
    if Input.is_action_just_pressed("jump"):
        _jump_buffer_timer = jump_buffer_time
    _jump_buffer_timer = maxf(0.0, _jump_buffer_timer - delta)
    
    # Execute jump
    var can_jump := is_on_floor() or _coyote_timer > 0.0
    if _jump_buffer_timer > 0.0 and can_jump:
        velocity.y = jump_force
        _coyote_timer = 0.0
        _jump_buffer_timer = 0.0
    
    # Variable jump height
    if Input.is_action_just_released("jump") and velocity.y < 0:
        velocity.y *= 0.5

func _handle_movement(delta: float) -> void:
    var direction := Input.get_axis("move_left", "move_right")
    
    if direction != 0.0:
        velocity.x = move_toward(velocity.x, direction * move_speed, acceleration * delta)
        _sprite.flip_h = direction < 0
    else:
        velocity.x = move_toward(velocity.x, 0.0, friction * delta)

func _update_animations() -> void:
    if not is_on_floor():
        _anim.play("jump" if velocity.y < 0 else "fall")
    elif absf(velocity.x) > 10.0:
        _anim.play("run")
    else:
        _anim.play("idle")
```

### 2. 3D Third-Person Controller

```gdscript
class_name PlayerController3D
extends CharacterBody3D

@export_group("Movement")
@export var move_speed: float = 5.0
@export var sprint_speed: float = 8.0
@export var acceleration: float = 10.0
@export var rotation_speed: float = 10.0

@export_group("Jumping")
@export var jump_force: float = 5.0
@export var gravity: float = 15.0

@onready var _camera_pivot: Node3D = $CameraPivot
@onready var _model: Node3D = $Model
@onready var _anim_tree: AnimationTree = $AnimationTree

func _physics_process(delta: float) -> void:
    # Gravity
    if not is_on_floor():
        velocity.y -= gravity * delta
    
    # Jump
    if Input.is_action_just_pressed("jump") and is_on_floor():
        velocity.y = jump_force
    
    # Movement relative to camera
    var input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
    var camera_basis := _camera_pivot.global_basis
    var direction := (camera_basis * Vector3(input.x, 0, input.y)).normalized()
    direction.y = 0
    
    var speed := sprint_speed if Input.is_action_pressed("sprint") else move_speed
    
    if direction.length() > 0.1:
        velocity.x = lerpf(velocity.x, direction.x * speed, acceleration * delta)
        velocity.z = lerpf(velocity.z, direction.z * speed, acceleration * delta)
        # Rotate model to face movement direction
        var target_rotation := atan2(-direction.x, -direction.z)
        _model.rotation.y = lerp_angle(_model.rotation.y, target_rotation, rotation_speed * delta)
    else:
        velocity.x = lerpf(velocity.x, 0.0, acceleration * delta)
        velocity.z = lerpf(velocity.z, 0.0, acceleration * delta)
    
    move_and_slide()
```

### 3. State Machine Integration

```gdscript
# Player with state machine
extends CharacterBody2D

@onready var state_machine: StateMachine = $StateMachine

# States are child nodes — IdleState, RunState, JumpState, FallState
# Each state handles its own input, movement, and animation
```

```gdscript
# states/idle.gd
extends State

func enter() -> void:
    owner.get_node("AnimationPlayer").play("idle")

func physics_update(delta: float) -> void:
    var direction := Input.get_axis("move_left", "move_right")
    
    if direction != 0.0:
        state_machine.transition_to($"../RunState")
    
    if Input.is_action_just_pressed("jump") and owner.is_on_floor():
        state_machine.transition_to($"../JumpState")
    
    if not owner.is_on_floor():
        state_machine.transition_to($"../FallState")
```

## Best Practices

- Always use `move_and_slide()` — it handles slopes, walls, and collision response.
- Implement coyote time and jump buffering for responsive platformer controls.
- Use `move_toward()` and `lerp()` for smooth acceleration/deceleration.
- Separate movement logic from animation logic.
- Use a state machine for characters with more than 3 states.
- Use `_physics_process()` for all movement code.

## Common Pitfalls

- **Using `_process()` for movement.** Always use `_physics_process()` for `CharacterBody` movement.
- **Forgetting delta.** Multiply speed by `delta` for frame-rate-independent movement (gravity, acceleration). Note: `velocity` in `move_and_slide()` is already per-second.
- **No coyote time.** Players feel like they "fell off" without a small grace window.
- **Hardcoded input keys.** Always use Input Map action names.
- **Rotating the CharacterBody instead of a child model in 3D.** Rotate a child `Model` node for visual rotation.

## Reference

- [CharacterBody2D](https://docs.godotengine.org/en/stable/classes/class_characterbody2d.html)
- [CharacterBody3D](https://docs.godotengine.org/en/stable/classes/class_characterbody3d.html)
- [Using move_and_slide](https://docs.godotengine.org/en/stable/tutorials/physics/using_character_body_2d.html)
