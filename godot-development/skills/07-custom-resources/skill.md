# Custom Resources

## Description

This skill covers using Godot 4's `Resource` class to create data-driven game configurations. Custom Resources replace hardcoded values with editor-friendly `.tres` files — the Godot equivalent of Unity's ScriptableObjects.

## When To Use

- Defining weapon stats, enemy data, item properties, or level configurations
- Sharing data between scenes without autoloads
- Creating data-driven systems (loot tables, dialogue, ability definitions)
- Building editor-friendly configuration that designers can tweak without code

## Prerequisites

- Godot 4.3+ project
- Understanding of `@export` and the Inspector
- GDScript fundamentals (class_name, type hints)

## Instructions

### 1. Define a Custom Resource

```gdscript
# resources/weapon_data.gd
class_name WeaponData
extends Resource

@export var name: String = ""
@export var damage: int = 10
@export var fire_rate: float = 0.5
@export var range_distance: float = 100.0
@export var projectile_scene: PackedScene
@export var fire_sound: AudioStream
@export var icon: Texture2D

@export_group("Upgrades")
@export var max_level: int = 5
@export var damage_per_level: int = 3
```

### 2. Create Instances in the Editor

1. Right-click in the FileSystem dock → **New Resource**.
2. Search for your class name (e.g., `WeaponData`).
3. Fill in the properties in the Inspector.
4. Save as `.tres` (text) or `.res` (binary) in `resources/weapons/`.

### 3. Reference in Scripts

```gdscript
@export var weapon: WeaponData

func fire() -> void:
    if weapon == null:
        return
    
    var projectile := weapon.projectile_scene.instantiate()
    projectile.damage = weapon.damage
    projectile.global_position = _muzzle.global_position
    get_tree().current_scene.add_child(projectile)
    
    _audio.stream = weapon.fire_sound
    _audio.play()
```

### 4. Resource Collections

```gdscript
# Inventory item
class_name ItemData
extends Resource

@export var id: StringName = &""
@export var display_name: String = ""
@export var description: String = ""
@export var icon: Texture2D
@export var max_stack: int = 99
@export var is_consumable: bool = false
```

```gdscript
# Loot table using resources
class_name LootTable
extends Resource

@export var entries: Array[LootEntry] = []

func roll() -> ItemData:
    var total_weight: float = 0.0
    for entry in entries:
        total_weight += entry.weight
    
    var roll := randf() * total_weight
    var current: float = 0.0
    for entry in entries:
        current += entry.weight
        if roll <= current:
            return entry.item
    
    return entries[-1].item
```

```gdscript
class_name LootEntry
extends Resource

@export var item: ItemData
@export var weight: float = 1.0
@export_range(1, 99) var min_quantity: int = 1
@export_range(1, 99) var max_quantity: int = 1
```

### 5. Resource Events (Signal Bus Pattern)

```gdscript
# Event channel as a Resource (shared reference)
class_name EventChannel
extends Resource

signal triggered(data: Variant)

func emit_event(data: Variant = null) -> void:
    triggered.emit(data)
```

Assign the same `.tres` to both emitter and listener via `@export`:

```gdscript
# Emitter
@export var on_score_changed: EventChannel

func add_score(points: int) -> void:
    _score += points
    on_score_changed.emit_event(_score)

# Listener (separate scene, no direct reference)
@export var on_score_changed: EventChannel

func _ready() -> void:
    on_score_changed.triggered.connect(_on_score_changed)
```

## Best Practices

- Use Resources for any data that should be editable in the Inspector without code changes.
- Store `.tres` files in a dedicated `resources/` folder, organized by type.
- Use `class_name` so resources appear in the "New Resource" dialog.
- Use `@export_group()` and `@export_subgroup()` to organize Inspector properties.
- Use `@export_range()`, `@export_enum()`, `@export_multiline` for validation and UX.
- Resources are reference-counted — they can be safely shared between nodes.

## Common Pitfalls

- **Mutating shared Resources at runtime.** If two enemies share the same `WeaponData.tres` and you modify `damage`, both are affected. Use `resource.duplicate()` for per-instance data.
- **Not registering `class_name`.** Without `class_name`, the resource won't appear in the editor's resource picker.
- **Storing node references in Resources.** Resources persist across scenes — they can't hold node references. Use signals or `NodePath` instead.
- **Using dictionaries instead of Resources.** Resources are type-safe, editor-friendly, and serializable. Dictionaries are not.

## Reference

- [Resources](https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html)
- [Creating Custom Resources](https://docs.godotengine.org/en/stable/tutorials/best_practices/node_alternatives.html)
