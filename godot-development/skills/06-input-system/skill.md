# Input System

## Description

This skill covers Godot 4's input handling — the Input Map, action-based input, event processing, and input remapping. Proper input handling ensures responsive controls across keyboard, gamepad, and touch devices.

## When To Use

- Setting up player controls for a new project
- Handling keyboard, gamepad, mouse, and touch input
- Implementing input remapping or accessibility options
- Processing input events in the correct order (UI vs gameplay)
- Building input buffering or combo systems

## Prerequisites

- Godot 4.3+ project
- Input Map actions defined in Project Settings
- Understanding of `_unhandled_input()` vs `_input()` vs `_process()`

## Instructions

### 1. Input Map Configuration

Define actions in **Project → Project Settings → Input Map**:

| Action | Keys | Gamepad |
|--------|------|---------|
| `move_left` | A, Left Arrow | Left Stick Left |
| `move_right` | D, Right Arrow | Left Stick Right |
| `move_up` | W, Up Arrow | Left Stick Up |
| `move_down` | S, Down Arrow | Left Stick Down |
| `jump` | Space | A / Cross |
| `attack` | Left Click, X | X / Square |
| `interact` | E | Y / Triangle |
| `pause` | Escape | Start |

### 2. Input Methods

```gdscript
# Polling — check state every frame (in _process or _physics_process)
func _physics_process(delta: float) -> void:
    # Axis input (analog-aware, -1 to 1)
    var direction := Input.get_axis("move_left", "move_right")
    
    # 2D vector input
    var move := Input.get_vector("move_left", "move_right", "move_up", "move_down")
    
    # Continuous press
    if Input.is_action_pressed("sprint"):
        speed = sprint_speed

# Event-driven — for discrete actions
func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed("jump"):
        _jump()
    
    if event.is_action_pressed("interact"):
        _interact()
    
    if event.is_action_pressed("pause"):
        _toggle_pause()
```

### 3. Input Event Processing Order

```
_input()              ← All input (intercept before anything else)
  ↓
Control nodes         ← UI buttons, sliders, text fields consume input
  ↓
_shortcut_input()     ← Shortcut processing
  ↓
_unhandled_key_input() ← Key events not handled above
  ↓
_unhandled_input()    ← Everything not consumed (gameplay input goes here)
```

**Rule:** Use `_unhandled_input()` for gameplay. UI elements automatically consume input first, so pressing a button won't also trigger a jump.

### 4. Mouse and Touch Input

```gdscript
func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseButton:
        if event.button_index == MOUSE_BUTTON_LEFT and event.pressed:
            _shoot(get_global_mouse_position())
    
    if event is InputEventMouseMotion:
        _aim_direction = (get_global_mouse_position() - global_position).normalized()
    
    # Touch (mobile)
    if event is InputEventScreenTouch:
        if event.pressed:
            _handle_touch(event.position)
```

### 5. Input Remapping

```gdscript
func remap_action(action: String, new_event: InputEvent) -> void:
    # Clear existing bindings
    InputMap.action_erase_events(action)
    # Add new binding
    InputMap.action_add_event(action, new_event)

func get_action_key_name(action: String) -> String:
    var events := InputMap.action_get_events(action)
    for event in events:
        if event is InputEventKey:
            return event.as_text()
    return "Unbound"
```

### 6. Input Buffering

```gdscript
var _input_buffer: Dictionary = {}
const BUFFER_DURATION := 0.15

func buffer_action(action: String) -> void:
    _input_buffer[action] = BUFFER_DURATION

func consume_buffer(action: String) -> bool:
    if _input_buffer.has(action) and _input_buffer[action] > 0:
        _input_buffer[action] = 0.0
        return true
    return false

func _process(delta: float) -> void:
    for action in _input_buffer:
        _input_buffer[action] = maxf(0.0, _input_buffer[action] - delta)

func _unhandled_input(event: InputEvent) -> void:
    if event.is_action_pressed("jump"):
        buffer_action("jump")
```

## Best Practices

- Define all actions in the Input Map — never check raw key codes in scripts.
- Use `_unhandled_input()` for gameplay, `_input()` only for intercepting before UI.
- Use `Input.get_vector()` for directional movement — it handles analog sticks and normalization.
- Mark input events as handled with `get_viewport().set_input_as_handled()` when consumed.
- Support both keyboard and gamepad from the start by configuring both in the Input Map.
- Implement input buffering for actions like jumping to improve responsiveness.

## Common Pitfalls

- **Hardcoding key names.** `Input.is_key_pressed(KEY_SPACE)` breaks remapping. Use actions.
- **Using `_input()` for gameplay.** UI input will bleed through. Use `_unhandled_input()`.
- **Polling discrete actions in `_process()`.** Use `is_action_just_pressed()` or event callbacks.
- **Forgetting gamepad dead zones.** Configure dead zones in the Input Map per-action.
- **Not testing with both keyboard and gamepad.** Input Map lets you bind multiple devices per action.

## Reference

- [InputEvent](https://docs.godotengine.org/en/stable/tutorials/inputs/inputevent.html)
- [Input Map](https://docs.godotengine.org/en/stable/tutorials/inputs/input_examples.html)
- [Handling Input](https://docs.godotengine.org/en/stable/tutorials/inputs/index.html)
