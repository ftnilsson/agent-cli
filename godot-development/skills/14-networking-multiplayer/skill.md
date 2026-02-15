# Networking & Multiplayer

## Description

This skill covers Godot 4's high-level multiplayer API, including ENet and WebSocket transports, RPCs, the MultiplayerSpawner, MultiplayerSynchronizer, and authority management for building networked games.

## When To Use

- Building online or LAN multiplayer games
- Setting up client-server or peer-to-peer architecture
- Synchronising player state, transforms, and game events
- Implementing lobbies, matchmaking, and player management
- Using RPCs for remote function calls

## Prerequisites

- Godot 4.3+ multiplayer nodes
- Understanding of SceneTree and scene architecture
- Player Controller skill (for synchronised movement)

## Instructions

### 1. Network Architecture

Godot 4 uses `MultiplayerAPI` with pluggable transports:

- **ENetMultiplayerPeer** — UDP, fast, best for real-time games
- **WebSocketMultiplayerPeer** — WebSocket, works in browsers
- **WebRTCMultiplayerPeer** — peer-to-peer without a relay server

Peer ID `1` is always the server (authority). Each client gets a unique ID.

### 2. Hosting and Joining

```gdscript
# Autoload: NetworkManager
class_name NetworkManager
extends Node

signal player_connected(peer_id: int)
signal player_disconnected(peer_id: int)
signal connection_succeeded
signal connection_failed

const DEFAULT_PORT := 7000
const MAX_CLIENTS := 8

var players: Dictionary = {}  # peer_id -> player data

func host_game(port: int = DEFAULT_PORT) -> Error:
    var peer := ENetMultiplayerPeer.new()
    var error := peer.create_server(port, MAX_CLIENTS)
    if error != OK:
        push_error("Failed to create server: %s" % error_string(error))
        return error
    
    multiplayer.multiplayer_peer = peer
    multiplayer.peer_connected.connect(_on_peer_connected)
    multiplayer.peer_disconnected.connect(_on_peer_disconnected)
    
    players[1] = _local_player_data()
    print("Server started on port %d" % port)
    return OK

func join_game(address: String, port: int = DEFAULT_PORT) -> Error:
    var peer := ENetMultiplayerPeer.new()
    var error := peer.create_client(address, port)
    if error != OK:
        push_error("Failed to connect: %s" % error_string(error))
        return error
    
    multiplayer.multiplayer_peer = peer
    multiplayer.connected_to_server.connect(_on_connected_to_server)
    multiplayer.connection_failed.connect(_on_connection_failed)
    multiplayer.server_disconnected.connect(_on_server_disconnected)
    return OK

func _on_peer_connected(peer_id: int) -> void:
    player_connected.emit(peer_id)

func _on_peer_disconnected(peer_id: int) -> void:
    players.erase(peer_id)
    player_disconnected.emit(peer_id)

func _on_connected_to_server() -> void:
    connection_succeeded.emit()

func _on_connection_failed() -> void:
    multiplayer.multiplayer_peer = null
    connection_failed.emit()

func _on_server_disconnected() -> void:
    multiplayer.multiplayer_peer = null

func _local_player_data() -> Dictionary:
    return { "name": "Player" }
```

### 3. RPCs (Remote Procedure Calls)

```gdscript
extends CharacterBody2D

# Server-authoritative movement
@rpc("any_peer", "call_local", "reliable")
func request_action(action: String) -> void:
    if not multiplayer.is_server():
        return
    # Validate and process on server
    _execute_action.rpc(action)

@rpc("authority", "call_local", "reliable")
func _execute_action(action: String) -> void:
    # Runs on all peers
    match action:
        "jump":
            velocity.y = -300.0
```

RPC annotations:
- **Authority**: `"authority"` (only authority can call) or `"any_peer"` (anyone can call)
- **Call mode**: `"call_local"` (also runs locally) or `"call_remote"` (only on remotes)
- **Transfer mode**: `"reliable"`, `"unreliable"`, or `"unreliable_ordered"`

### 4. MultiplayerSpawner

Automatically replicates scene instantiation across peers:

1. Add a `MultiplayerSpawner` node to the scene.
2. In the Inspector, add spawnable scenes to the `Auto Spawn List`.
3. Set the `Spawn Path` to the parent node where spawned scenes are added.
4. When the server adds a child matching a registered scene, it's automatically spawned on all clients.

```gdscript
# Server spawns a player — clients receive it automatically
func _spawn_player(peer_id: int) -> void:
    if not multiplayer.is_server():
        return
    
    var player := preload("res://player/player.tscn").instantiate()
    player.name = str(peer_id)
    $Players.add_child(player, true)  # spawner replicates this
```

### 5. MultiplayerSynchronizer

Automatically syncs properties across the network:

1. Add a `MultiplayerSynchronizer` as a child of the node to sync.
2. In the Inspector, add properties to the `Replication Config`.
3. Set each property's mode:
   - **On Change**: Sent when value changes (reliable)
   - **Always**: Sent every frame (unreliable, for transforms)

```gdscript
extends CharacterBody2D

# These properties are synced via MultiplayerSynchronizer
@export var synced_position: Vector2
@export var synced_animation: String

func _physics_process(delta: float) -> void:
    if is_multiplayer_authority():
        # Owner processes input and sets values
        _handle_input(delta)
        synced_position = global_position
    else:
        # Non-owners interpolate to synced values
        global_position = global_position.lerp(synced_position, 10.0 * delta)
```

### 6. Authority Management

```gdscript
func _spawn_player(peer_id: int) -> void:
    var player := preload("res://player/player.tscn").instantiate()
    player.name = str(peer_id)
    # Set the owning peer as the multiplayer authority
    player.set_multiplayer_authority(peer_id)
    $Players.add_child(player, true)
```

The authority peer controls the node's gameplay logic. Use `is_multiplayer_authority()` to gate input processing:

```gdscript
func _physics_process(delta: float) -> void:
    if not is_multiplayer_authority():
        return
    # Only process input for the local player
```

## Best Practices

- Use server authority for game-critical state (health, scores, inventory).
- Use `unreliable` transfer for high-frequency data (position, rotation).
- Use `reliable` transfer for important events (damage, item pickup).
- Interpolate remote player positions to smooth out network jitter.
- Validate all client inputs on the server — never trust the client.
- Use `MultiplayerSpawner` and `MultiplayerSynchronizer` instead of writing custom sync code.

## Common Pitfalls

- **Not setting multiplayer authority.** Without `set_multiplayer_authority()`, all nodes default to server authority and clients can't control their characters.
- **Calling RPCs before connection.** Ensure the peer is connected before sending RPCs.
- **Syncing too much data.** Only sync what's needed — position, rotation, key state. Derive everything else locally.
- **Not handling disconnections.** Always clean up player nodes and state when a peer disconnects.
- **Using `call_local` everywhere.** Only use `call_local` when the function should also run on the caller.

## Reference

- [High-Level Multiplayer](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html)
- [MultiplayerSpawner](https://docs.godotengine.org/en/stable/classes/class_multiplayerspawner.html)
- [MultiplayerSynchronizer](https://docs.godotengine.org/en/stable/classes/class_multiplayersynchronizer.html)
- [RPCs](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html#remote-procedure-calls)
