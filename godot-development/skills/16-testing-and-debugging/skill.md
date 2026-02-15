# Testing & Debugging

## Description

This skill covers testing GDScript code using GdUnit4 and Gut frameworks, using Godot's built-in debugging tools, and establishing quality assurance practices for Godot 4 projects.

## When To Use

- Writing unit tests for game systems and utilities
- Integration testing scenes and node interactions
- Using the Godot debugger to inspect state at runtime
- Setting up CI/CD test automation for Godot projects
- Debugging physics, signals, and performance issues

## Prerequisites

- Godot 4.3+ project with gameplay code to test
- GDScript Fundamentals skill
- Understanding of signals and the scene tree

## Instructions

### 1. GdUnit4 Setup

GdUnit4 is the recommended testing framework for Godot 4:

1. Open **AssetLib** in the Godot editor.
2. Search for **GdUnit4** and install it.
3. Enable the plugin: **Project → Project Settings → Plugins → GdUnit4**.
4. Create a `test/` directory at the project root.

### 2. Writing Unit Tests

```gdscript
# test/test_health_system.gd
class_name TestHealthSystem
extends GdUnitTestSuite

var _health: HealthComponent

func before_test() -> void:
    _health = HealthComponent.new()
    _health.max_health = 100
    _health.current_health = 100

func after_test() -> void:
    _health.free()

func test_take_damage_reduces_health() -> void:
    _health.take_damage(30)
    assert_int(_health.current_health).is_equal(70)

func test_heal_does_not_exceed_max() -> void:
    _health.take_damage(50)
    _health.heal(80)
    assert_int(_health.current_health).is_equal(100)

func test_is_dead_when_health_zero() -> void:
    _health.take_damage(100)
    assert_bool(_health.is_dead()).is_true()

func test_damage_signal_emitted() -> void:
    var monitor := monitor_signals(_health)
    _health.take_damage(10)
    await assert_signal(monitor).is_emitted("health_changed")
```

### 3. Scene Testing

```gdscript
# test/test_player_scene.gd
class_name TestPlayerScene
extends GdUnitTestSuite

var _player: CharacterBody2D
var _runner: GdUnitSceneRunner

func before_test() -> void:
    _runner = scene_runner("res://player/player.tscn")
    _player = _runner.scene() as CharacterBody2D

func after_test() -> void:
    _runner.free()

func test_player_starts_at_origin() -> void:
    assert_vector2(_player.global_position).is_equal(Vector2.ZERO)

func test_player_moves_right_on_input() -> void:
    _runner.simulate_key_pressed(KEY_D)
    await _runner.simulate_frames(10)
    assert_float(_player.global_position.x).is_greater(0.0)
```

### 4. Gut (Alternative Framework)

If using Gut instead of GdUnit4:

```gdscript
# test/test_inventory.gd
extends GutTest

var _inventory: Inventory

func before_each() -> void:
    _inventory = Inventory.new()

func after_each() -> void:
    _inventory.free()

func test_add_item() -> void:
    _inventory.add_item("sword", 1)
    assert_eq(_inventory.get_count("sword"), 1)

func test_remove_item() -> void:
    _inventory.add_item("potion", 3)
    _inventory.remove_item("potion", 1)
    assert_eq(_inventory.get_count("potion"), 2)

func test_cannot_remove_more_than_available() -> void:
    _inventory.add_item("arrow", 5)
    _inventory.remove_item("arrow", 10)
    assert_eq(_inventory.get_count("arrow"), 0)
```

### 5. Godot Debugger

#### Breakpoints

- Click the gutter (left margin) in the script editor to set breakpoints.
- When hit, execution pauses and the Inspector shows local variables.
- Use **Step Into**, **Step Over**, **Continue** in the debugger toolbar.

#### Remote Inspector

- While the game runs, the **Remote** tab in the Scene panel shows the live scene tree.
- Click any node to inspect its properties in real time.
- Edit properties live to test changes.

#### Print Debugging

```gdscript
# Debug prints with context
func _physics_process(delta: float) -> void:
    if OS.is_debug_build():
        print("vel: %s | on_floor: %s | state: %s" % [
            velocity, is_on_floor(), _current_state
        ])
```

#### Debug Draw

```gdscript
# Draw collision shapes, paths, etc.
func _draw() -> void:
    if not OS.is_debug_build():
        return
    draw_circle(Vector2.ZERO, _detection_range, Color(1, 0, 0, 0.2))
    draw_line(Vector2.ZERO, velocity, Color.GREEN, 2.0)
```

### 6. Common Debug Settings

| Setting | Location | Purpose |
|---|---|---|
| Visible Collision Shapes | Debug menu → Visible Collision Shapes | See all collision shapes |
| Visible Navigation | Debug menu → Visible Navigation | See navigation meshes |
| Print orphan nodes | Project Settings → Debug | Find memory leaks |
| FPS counter | Debug menu → Monitors → FPS | Frame rate display |

### 7. CI/CD Testing

Run GdUnit4 tests from the command line:

```bash
# Run all tests headlessly
godot --headless --script addons/gdUnit4/bin/GdUnitCmdTool.gd --add test/

# Run specific test suite
godot --headless --script addons/gdUnit4/bin/GdUnitCmdTool.gd --add test/test_health_system.gd
```

GitHub Actions example:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: barichello/godot-ci:4.3
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: godot --headless --script addons/gdUnit4/bin/GdUnitCmdTool.gd --add test/
```

## Best Practices

- Test game systems (health, inventory, scoring) as pure logic — don't require scene trees.
- Use `before_test()` / `after_test()` to set up and tear down consistently.
- Name tests descriptively: `test_<what>_<condition>_<expected>`.
- Free all created nodes in `after_test()` to prevent memory leaks.
- Run tests in CI on every push to catch regressions early.
- Use the Remote Inspector to debug scene tree issues at runtime.

## Common Pitfalls

- **Not freeing nodes in tests.** Leaked nodes cause false failures and warnings.
- **Testing visuals instead of logic.** Unit tests should verify data, not pixels.
- **Ignoring `await` in signal tests.** Signal assertions need `await` to work correctly.
- **Testing in `_ready()`.** Tests should be independent — don't rely on scene lifecycle.
- **Not running headless in CI.** Use `--headless` flag for CI environments without a display.

## Reference

- [GdUnit4](https://mikeschulze.github.io/gdUnit4/)
- [Gut](https://github.com/bitwes/Gut)
- [Debugger](https://docs.godotengine.org/en/stable/tutorials/scripting/debug/the_profiler.html)
- [Command-Line Tutorial](https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html)
