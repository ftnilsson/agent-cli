# Godot Performance Profiling

Review the following Godot/GDScript code for performance issues.

## Check For

1. **Allocations in _process** — Are there `Array`, `Dictionary`, or `String` allocations, `get_tree().get_nodes_in_group()` calls, or `get_node()` lookups in `_process()` or `_physics_process()`?
2. **Distance checks** — Is `distance_to()` used where `distance_squared_to()` would avoid the square root?
3. **Physics** — Are physics queries using `PhysicsDirectSpaceState` efficiently? Are collision layers and masks configured to limit checks?
4. **Object pooling** — Are frequently instantiated and `queue_free()`'d objects (bullets, particles, coins) using an object pool?
5. **Signal overhead** — Are signals connected and disconnected correctly? Are there unnecessary per-frame signal emissions?
6. **Node references** — Are `get_node()` and `find_child()` calls cached in `@onready` variables instead of called every frame?
7. **Draw calls** — Are materials shared? Is `CanvasGroup` used for 2D batching? Is `MultiMeshInstance3D` used for instanced geometry?
8. **Process toggles** — Are `_process()` and `_physics_process()` disabled on nodes that don't need per-frame updates (via `set_process(false)`)?
9. **Resource loading** — Are resources `preload()`'d or loaded asynchronously with `ResourceLoader.load_threaded_request()`? Are large assets loaded during gameplay without threading?
10. **String formatting** — Are string concatenations or `str()` calls in hot paths? Is `StringName` used for repeated comparisons?

## Output Format

For each finding:

- **Script/Method**: Where the issue is
- **Impact**: 🔴 Per-frame cost / 🟡 Spike risk / 🟢 Minor
- **Issue**: Description with estimated cost
- **Fix**: Optimised code example
