# UI Development

## Description

This skill covers building user interfaces in Godot 4 using Control nodes, Themes, and responsive layouts. Godot's UI system uses a tree of Control nodes with anchors, margins, and containers for flexible layouts.

## When To Use

- Building menus, HUDs, inventory screens, or dialogue boxes
- Creating responsive UI that adapts to different screen sizes
- Theming UI elements consistently across the game
- Connecting UI to game state via signals

## Prerequisites

- Godot 4.3+ project
- Understanding of Control node hierarchy and anchoring
- GDScript fundamentals (signals, `@onready`)

## Instructions

### 1. Control Node Hierarchy

```
CanvasLayer (Layer 1 — always on top)
└── Control (full rect anchor)
    ├── MarginContainer
    │   └── VBoxContainer
    │       ├── Label (title)
    │       ├── Button (start)
    │       ├── Button (options)
    │       └── Button (quit)
    └── TextureRect (background)
```

### 2. Anchors and Containers

Use **containers** for automatic layout instead of manual positioning:

| Container | Purpose |
|-----------|---------|
| `HBoxContainer` | Horizontal row |
| `VBoxContainer` | Vertical column |
| `GridContainer` | Grid layout |
| `MarginContainer` | Add padding |
| `CenterContainer` | Center child |
| `PanelContainer` | Background panel |
| `ScrollContainer` | Scrollable content |

```gdscript
# Set Control to fill the screen
func _ready() -> void:
    # Use anchors (0,0 = top-left, 1,1 = bottom-right)
    anchor_left = 0.0
    anchor_top = 0.0
    anchor_right = 1.0
    anchor_bottom = 1.0
```

### 3. HUD Example

```gdscript
class_name HUD
extends CanvasLayer

@onready var _health_bar: ProgressBar = %HealthBar
@onready var _score_label: Label = %ScoreLabel
@onready var _ammo_label: Label = %AmmoLabel

func update_health(current: int, maximum: int) -> void:
    _health_bar.max_value = maximum
    _health_bar.value = current

func update_score(score: int) -> void:
    _score_label.text = "Score: %d" % score

func update_ammo(current: int, max_ammo: int) -> void:
    _ammo_label.text = "%d / %d" % [current, max_ammo]
```

Use **unique names** (`%NodeName`) for reliable references regardless of hierarchy changes.

### 4. Menu Navigation

```gdscript
class_name MainMenu
extends Control

@onready var _start_btn: Button = %StartButton
@onready var _options_btn: Button = %OptionsButton
@onready var _quit_btn: Button = %QuitButton

func _ready() -> void:
    _start_btn.pressed.connect(_on_start_pressed)
    _options_btn.pressed.connect(_on_options_pressed)
    _quit_btn.pressed.connect(_on_quit_pressed)
    _start_btn.grab_focus()  # Enable keyboard/gamepad navigation

func _on_start_pressed() -> void:
    SceneManager.change_scene("res://scenes/levels/level_01.tscn")

func _on_options_pressed() -> void:
    # Show options panel
    pass

func _on_quit_pressed() -> void:
    get_tree().quit()
```

### 5. Themes

Create a `Theme` resource for consistent styling:

```
# In the editor:
1. Create a new Theme resource
2. Add type variations for Button, Label, Panel, etc.
3. Set fonts, colors, margins, and styleboxes
4. Assign the theme to the root Control node — children inherit it
```

```gdscript
# Override theme properties in code
label.add_theme_color_override("font_color", Color.RED)
label.add_theme_font_size_override("font_size", 24)
```

### 6. Responsive Design

```gdscript
# In Project Settings:
# Display → Window → Stretch → Mode = canvas_items
# Display → Window → Stretch → Aspect = expand

# Use anchors for positioning:
# - Top-left HUD: anchor_preset = PRESET_TOP_LEFT
# - Centered menu: anchor_preset = PRESET_CENTER
# - Bottom bar: anchor_preset = PRESET_BOTTOM_WIDE
```

## Best Practices

- Use containers for layout — avoid manual positioning with pixel offsets.
- Use **unique names** (`%Name`) for signal-connected nodes.
- Always call `grab_focus()` on the default button for keyboard/gamepad support.
- Use `CanvasLayer` to keep UI above the game world.
- Use Themes for consistent styling — set one theme on the root Control node.
- Separate UI logic from game logic — UI listens to signals, doesn't drive gameplay.
- Use `Tween` for smooth UI animations (fade, slide, scale).

## Common Pitfalls

- **Not using containers.** Manual positioning breaks on different resolutions.
- **Forgetting `grab_focus()`.** Without it, keyboard/gamepad can't navigate menus.
- **UI consuming gameplay input.** Use `mouse_filter = MOUSE_FILTER_IGNORE` on non-interactive controls.
- **Deeply nested Control scenes.** Keep UI scenes shallow and composable.
- **Not setting stretch mode.** Without it, the game won't scale to different window sizes.

## Reference

- [GUI Tutorial](https://docs.godotengine.org/en/stable/tutorials/ui/index.html)
- [Control Nodes](https://docs.godotengine.org/en/stable/tutorials/ui/gui_containers.html)
- [Theme](https://docs.godotengine.org/en/stable/tutorials/ui/gui_skinning.html)
