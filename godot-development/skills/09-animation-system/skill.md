# Animation System

## Description

This skill covers Godot 4's animation tools — `AnimationPlayer`, `AnimationTree`, blend trees, procedural animation with `Tween`, and the integration of animation with gameplay logic via signals and method calls.

## When To Use

- Animating characters, enemies, or objects
- Building animation state machines with `AnimationTree`
- Using blend trees for smooth animation transitions
- Creating procedural animations with `Tween`
- Triggering gameplay events from animation keyframes

## Prerequisites

- Godot 4.3+ project
- Understanding of nodes and the scene tree
- GDScript fundamentals (signals, `@onready`)

## Instructions

### 1. AnimationPlayer Basics

```gdscript
@onready var _anim: AnimationPlayer = $AnimationPlayer

func _ready() -> void:
    _anim.animation_finished.connect(_on_animation_finished)

func play_attack() -> void:
    _anim.play("attack")
    await _anim.animation_finished
    # Attack animation done — return to idle
    _anim.play("idle")

func _on_animation_finished(anim_name: StringName) -> void:
    match anim_name:
        "death":
            queue_free()
        "attack":
            _can_attack = true
```

### 2. AnimationTree & State Machine

Set up an `AnimationTree` with an `AnimationNodeStateMachine` as the root:

```
AnimationTree
└── AnimationNodeStateMachine
    ├── idle
    ├── run
    ├── jump
    ├── fall
    └── attack
```

```gdscript
@onready var _anim_tree: AnimationTree = $AnimationTree
@onready var _state_machine: AnimationNodeStateMachinePlayback = _anim_tree["parameters/playback"]

func _physics_process(delta: float) -> void:
    # Update blend parameters
    _anim_tree["parameters/run/blend_position"] = velocity.length() / max_speed
    
    # Transition states
    if is_on_floor():
        if absf(velocity.x) > 10.0:
            _state_machine.travel("run")
        else:
            _state_machine.travel("idle")
    else:
        _state_machine.travel("jump" if velocity.y < 0 else "fall")
```

### 3. Blend Trees

For smooth transitions between animations (e.g., walk ↔ run):

```gdscript
# BlendSpace1D — blend by speed
_anim_tree["parameters/movement/blend_position"] = velocity.length() / max_speed

# BlendSpace2D — blend by direction (top-down games)
_anim_tree["parameters/movement/blend_position"] = Vector2(velocity.x, velocity.y).normalized()
```

### 4. Tweens (Procedural Animation)

```gdscript
# Bounce effect
func bounce() -> void:
    var tween := create_tween()
    tween.tween_property(_sprite, "scale", Vector2(1.2, 0.8), 0.1)
    tween.tween_property(_sprite, "scale", Vector2(0.9, 1.1), 0.1)
    tween.tween_property(_sprite, "scale", Vector2.ONE, 0.1)

# Fade in
func fade_in(duration: float = 0.5) -> void:
    modulate.a = 0.0
    var tween := create_tween()
    tween.tween_property(self, "modulate:a", 1.0, duration)

# UI slide in
func slide_in() -> void:
    var tween := create_tween()
    tween.set_ease(Tween.EASE_OUT)
    tween.set_trans(Tween.TRANS_BACK)
    position.x = -300.0
    tween.tween_property(self, "position:x", 0.0, 0.4)

# Chain and parallel tweens
func complex_animation() -> void:
    var tween := create_tween()
    tween.tween_property(self, "position", target_pos, 0.5)
    tween.parallel().tween_property(self, "rotation", PI, 0.5)
    tween.tween_callback(queue_free)  # After both finish
```

### 5. Animation Method Calls & Signals

In the AnimationPlayer timeline, add **Call Method** or **Emit Signal** tracks:

```gdscript
# Called from an animation keyframe
func spawn_hitbox() -> void:
    _hitbox.monitoring = true

func despawn_hitbox() -> void:
    _hitbox.monitoring = false

func play_sfx(sound_name: String) -> void:
    AudioManager.play_sfx(sound_name)
```

## Best Practices

- Use `AnimationTree` with state machines for characters with 4+ animations.
- Use `Tween` for procedural / dynamic animations — UI transitions, effects, juice.
- Trigger gameplay events (hitboxes, SFX, particles) from animation keyframes, not timers.
- Keep animations in their own `AnimationPlayer` nodes — separate visual from logic.
- Use animation libraries to organize animations by category.
- Cache `AnimationNodeStateMachinePlayback` in `@onready`.

## Common Pitfalls

- **Fighting between animation and code.** If AnimationPlayer animates `position` and code also sets it, they conflict. Use separate properties or disable one.
- **Not using `await` for sequential animations.** Calling `play()` twice immediately skips the first.
- **Forgetting to set AnimationTree to active.** Set `active = true` or it won't process.
- **Using `Tween` on freed nodes.** Check `is_inside_tree()` before tweening.
- **Hardcoded animation names.** Use constants or enums for animation names.

## Reference

- [AnimationPlayer](https://docs.godotengine.org/en/stable/tutorials/animation/introduction.html)
- [AnimationTree](https://docs.godotengine.org/en/stable/tutorials/animation/animation_tree.html)
- [Tween](https://docs.godotengine.org/en/stable/classes/class_tween.html)
