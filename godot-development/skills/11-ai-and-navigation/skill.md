# AI & Navigation

## Description

This skill covers implementing game AI in Godot 4 using the NavigationServer for pathfinding, state machines for behaviour, and behaviour trees for complex decision-making. It covers both 2D and 3D navigation.

## When To Use

- Implementing enemy AI that navigates the game world
- Using NavigationAgent for pathfinding
- Building state machines or behaviour trees for NPC decision-making
- Setting up navigation meshes or navigation regions
- Creating patrol, chase, flee, and attack behaviours

## Prerequisites

- Godot 4.3+ with navigation regions set up in the scene
- Understanding of CharacterBody2D/3D and `_physics_process()`
- State machine pattern from GDScript Fundamentals skill

## Instructions

### 1. Navigation Setup

#### 2D Navigation

1. Add a `NavigationRegion2D` to your level scene.
2. Create a `NavigationPolygon` resource and define the walkable area.
3. Add `NavigationAgent2D` to your enemy/NPC scene.

#### 3D Navigation

1. Add a `NavigationRegion3D` to your level scene.
2. Bake a `NavigationMesh` from the geometry.
3. Add `NavigationAgent3D` to your character scene.

### 2. NavigationAgent Movement

```gdscript
class_name EnemyAI
extends CharacterBody2D

@export var speed: float = 100.0
@export var chase_range: float = 300.0

@onready var _nav_agent: NavigationAgent2D = $NavigationAgent2D

var _target: Node2D

func _ready() -> void:
    _nav_agent.path_desired_distance = 4.0
    _nav_agent.target_desired_distance = 4.0
    _nav_agent.navigation_finished.connect(_on_navigation_finished)

func set_target(target: Node2D) -> void:
    _target = target

func _physics_process(delta: float) -> void:
    if _target == null:
        return
    
    _nav_agent.target_position = _target.global_position
    
    if _nav_agent.is_navigation_finished():
        return
    
    var next_point := _nav_agent.get_next_path_position()
    var direction := global_position.direction_to(next_point)
    velocity = direction * speed
    move_and_slide()

func _on_navigation_finished() -> void:
    velocity = Vector2.ZERO
```

### 3. AI State Machine

```gdscript
# Enemy with states: Idle, Patrol, Chase, Attack
extends CharacterBody2D

enum AIState { IDLE, PATROL, CHASE, ATTACK }

@export var patrol_speed: float = 60.0
@export var chase_speed: float = 120.0
@export var detection_range: float = 200.0
@export var attack_range: float = 40.0
@export var patrol_points: Array[Marker2D] = []

@onready var _nav_agent: NavigationAgent2D = $NavigationAgent2D

var _state: AIState = AIState.IDLE
var _target: CharacterBody2D
var _patrol_index: int = 0

func _physics_process(delta: float) -> void:
    _detect_player()
    
    match _state:
        AIState.IDLE:
            _process_idle(delta)
        AIState.PATROL:
            _process_patrol(delta)
        AIState.CHASE:
            _process_chase(delta)
        AIState.ATTACK:
            _process_attack(delta)

func _detect_player() -> void:
    var players := get_tree().get_nodes_in_group("player")
    if players.is_empty():
        return
    
    var player: CharacterBody2D = players[0]
    var dist := global_position.distance_to(player.global_position)
    
    if dist <= attack_range and _state != AIState.ATTACK:
        _target = player
        _change_state(AIState.ATTACK)
    elif dist <= detection_range and _state != AIState.CHASE:
        _target = player
        _change_state(AIState.CHASE)
    elif dist > detection_range * 1.5 and _state == AIState.CHASE:
        _target = null
        _change_state(AIState.PATROL)

func _process_idle(delta: float) -> void:
    velocity = Vector2.ZERO
    # Wait, then patrol
    await get_tree().create_timer(2.0).timeout
    if _state == AIState.IDLE:
        _change_state(AIState.PATROL)

func _process_patrol(delta: float) -> void:
    if patrol_points.is_empty():
        return
    
    var target_point := patrol_points[_patrol_index].global_position
    _nav_agent.target_position = target_point
    
    if _nav_agent.is_navigation_finished():
        _patrol_index = (_patrol_index + 1) % patrol_points.size()
        _change_state(AIState.IDLE)
        return
    
    var next := _nav_agent.get_next_path_position()
    var direction := global_position.direction_to(next)
    velocity = direction * patrol_speed
    move_and_slide()

func _process_chase(delta: float) -> void:
    if _target == null:
        _change_state(AIState.PATROL)
        return
    
    _nav_agent.target_position = _target.global_position
    var next := _nav_agent.get_next_path_position()
    var direction := global_position.direction_to(next)
    velocity = direction * chase_speed
    move_and_slide()

func _process_attack(_delta: float) -> void:
    velocity = Vector2.ZERO
    # Attack logic here

func _change_state(new_state: AIState) -> void:
    _state = new_state
```

### 4. Line of Sight

```gdscript
@onready var _ray: RayCast2D = $LineOfSight

func can_see_target(target: Node2D) -> bool:
    _ray.target_position = to_local(target.global_position)
    _ray.force_raycast_update()
    
    if _ray.is_colliding():
        return _ray.get_collider() == target
    return false
```

### 5. Avoidance

```gdscript
func _ready() -> void:
    _nav_agent.velocity_computed.connect(_on_velocity_computed)
    _nav_agent.avoidance_enabled = true

func _physics_process(delta: float) -> void:
    var next := _nav_agent.get_next_path_position()
    var desired := global_position.direction_to(next) * speed
    _nav_agent.velocity = desired  # avoidance will adjust this

func _on_velocity_computed(safe_velocity: Vector2) -> void:
    velocity = safe_velocity
    move_and_slide()
```

## Best Practices

- Use NavigationAgent for all pathfinding — don't write your own A*.
- Bake navigation meshes at edit time; rebake at runtime only when the level changes.
- Use state machines for simple AI (3-5 states); consider behaviour trees for complex AI.
- Check line of sight before chasing — don't let enemies see through walls.
- Use `detection_range * 1.5` as the "lose interest" range to prevent jittering at the boundary.
- Put enemies in a group (`"enemies"`) for easy lookups.

## Common Pitfalls

- **Not baking the NavigationMesh.** Without baking, the agent has no path data.
- **Updating target_position every frame for static targets.** Only update when the target moves significantly.
- **Using `get_tree().get_nodes_in_group()` in `_process()`.** Cache the result or use an Area for detection.
- **Forgetting avoidance.** Multiple agents on the same path will stack. Enable avoidance.
- **AI reacting instantly.** Add reaction time delays for more natural, less frustrating behaviour.

## Reference

- [Navigation](https://docs.godotengine.org/en/stable/tutorials/navigation/index.html)
- [NavigationAgent2D](https://docs.godotengine.org/en/stable/classes/class_navigationagent2d.html)
- [Using NavigationAgents](https://docs.godotengine.org/en/stable/tutorials/navigation/navigation_using_navigationagents.html)
