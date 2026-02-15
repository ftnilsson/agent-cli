# Scene Architecture Review

Review the following Godot scene setup for architecture and best practices.

## Check For

1. **Node tree organisation** — Is the tree flat and logical? Are nodes grouped under descriptively named parent nodes? Are branch responsibilities clear?
2. **Scene composition** — Are reusable elements saved as separate `.tscn` scenes? Is `@export` used to configure instances instead of deep nesting?
3. **Script responsibility** — Does each script have a single responsibility? Are autoloads or "manager" scripts doing too much?
4. **Node references** — Are `@onready` and `@export` used for references? Are `get_node()` paths fragile or deeply nested?
5. **Signal connections** — Are signals used to decouple nodes? Are connections made in the editor or via `connect()` in `_ready()`? Are there circular signal chains?
6. **Custom Resources** — Could configuration data be moved to `Resource` subclasses instead of exported variables or dictionaries?
7. **Physics layers** — Are collision layers and masks configured to avoid unnecessary checks? Are they named descriptively in Project Settings?
8. **UI structure** — Are Control nodes structured with proper anchoring and layout containers? Are themes used instead of per-node styling?
9. **Scene loading** — Are heavy scenes loaded asynchronously with `ResourceLoader`? Is additive scene loading used where appropriate?
10. **Initialisation order** — Is there a clear init flow? Are `_ready()` dependencies between nodes handled correctly? Are autoloads used appropriately for cross-scene state?

## Output Format

1. Rate the scene architecture: ⭐ out of 5
2. List what's well-structured
3. List issues with suggested restructuring
4. If applicable, provide a sample node tree layout
