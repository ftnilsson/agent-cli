# Shaders & Visual Effects

## Description

This skill covers writing shaders in Godot's shading language, using VisualShader for node-based workflows, and applying post-processing effects. Godot shaders are written in a GLSL-like language and attached to materials.

## When To Use

- Writing custom visual effects (dissolve, outline, distortion)
- Creating 2D sprite effects (flash, glow, palette swap)
- Building post-processing pipelines (bloom, vignette, colour grading)
- Using VisualShader for rapid prototyping
- Optimising rendering with custom shader logic

## Prerequisites

- Godot 4.3+ rendering pipeline basics (Forward+, Mobile, Compatibility)
- Understanding of materials, textures, and the rendering flow
- Basic linear algebra (vectors, matrices)

## Instructions

### 1. Shader Basics

Create a new `ShaderMaterial` on a node, and assign a `Shader` resource. Godot shaders have three processor functions:

```glsl
shader_type canvas_item; // or spatial, particles, fog, sky

// Vertex shader
void vertex() {
    // Modify VERTEX, UV, COLOR
}

// Fragment shader
void fragment() {
    // Modify COLOR, ALPHA
    COLOR = texture(TEXTURE, UV);
}

// Light shader (per-light calculations)
void light() {
    // Modify LIGHT
}
```

### 2. Common 2D Effects

#### Hit Flash

```glsl
shader_type canvas_item;

uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
    vec4 tex = texture(TEXTURE, UV);
    COLOR.rgb = mix(tex.rgb, flash_color.rgb, flash_amount);
    COLOR.a = tex.a;
}
```

#### Outline

```glsl
shader_type canvas_item;

uniform vec4 outline_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);
uniform float outline_width : hint_range(0.0, 10.0) = 1.0;

void fragment() {
    vec2 size = TEXTURE_PIXEL_SIZE * outline_width;
    float alpha = texture(TEXTURE, UV).a;
    
    alpha += texture(TEXTURE, UV + vec2(size.x, 0.0)).a;
    alpha += texture(TEXTURE, UV + vec2(-size.x, 0.0)).a;
    alpha += texture(TEXTURE, UV + vec2(0.0, size.y)).a;
    alpha += texture(TEXTURE, UV + vec2(0.0, -size.y)).a;
    
    vec4 tex = texture(TEXTURE, UV);
    if (tex.a < 0.5 && alpha > 0.0) {
        COLOR = outline_color;
    } else {
        COLOR = tex;
    }
}
```

#### Dissolve

```glsl
shader_type canvas_item;

uniform sampler2D noise_texture;
uniform float dissolve_amount : hint_range(0.0, 1.0) = 0.0;
uniform float edge_width : hint_range(0.0, 0.1) = 0.02;
uniform vec4 edge_color : source_color = vec4(1.0, 0.5, 0.0, 1.0);

void fragment() {
    vec4 tex = texture(TEXTURE, UV);
    float noise = texture(noise_texture, UV).r;
    
    float edge = smoothstep(dissolve_amount, dissolve_amount + edge_width, noise);
    
    if (noise < dissolve_amount) {
        discard;
    }
    
    COLOR.rgb = mix(edge_color.rgb, tex.rgb, edge);
    COLOR.a = tex.a;
}
```

### 3. 3D Spatial Shaders

```glsl
shader_type spatial;
render_mode unshaded, cull_disabled;

uniform sampler2D albedo_texture : source_color;
uniform float rim_power : hint_range(0.0, 8.0) = 3.0;
uniform vec4 rim_color : source_color = vec4(0.0, 0.8, 1.0, 1.0);

void fragment() {
    vec4 tex = texture(albedo_texture, UV);
    ALBEDO = tex.rgb;
    
    float rim = 1.0 - dot(NORMAL, VIEW);
    rim = pow(rim, rim_power);
    EMISSION = rim_color.rgb * rim;
}
```

### 4. Post-Processing

Post-processing in Godot 4 uses a full-screen quad or the `Environment` resource.

#### Custom Post-Process with ColorRect

1. Add a `ColorRect` that covers the viewport.
2. Assign a `ShaderMaterial` with a screen-reading shader.

```glsl
shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;
uniform float vignette_intensity : hint_range(0.0, 1.0) = 0.4;
uniform float vignette_opacity : hint_range(0.0, 1.0) = 0.5;

void fragment() {
    vec4 screen_color = texture(screen_texture, SCREEN_UV);
    
    float vignette = distance(SCREEN_UV, vec2(0.5));
    vignette = smoothstep(0.3, 0.7, vignette * vignette_intensity);
    
    COLOR.rgb = mix(screen_color.rgb, vec3(0.0), vignette * vignette_opacity);
    COLOR.a = 1.0;
}
```

### 5. VisualShader

For non-coders or rapid prototyping, use the VisualShader editor:

1. Create a `VisualShader` resource on a `ShaderMaterial`.
2. Open it — the node graph editor appears.
3. Add nodes (Input, Texture, Math, Mix) and connect outputs to inputs.
4. The `Output` node exposes Albedo, Emission, Alpha, etc.

VisualShader compiles to the same GLSL-like code at runtime — no performance difference.

### 6. Shader Uniforms from GDScript

```gdscript
@onready var _sprite: Sprite2D = $Sprite2D

func flash_white(duration: float = 0.1) -> void:
    var mat := _sprite.material as ShaderMaterial
    mat.set_shader_parameter("flash_amount", 1.0)
    await get_tree().create_timer(duration).timeout
    mat.set_shader_parameter("flash_amount", 0.0)
```

## Best Practices

- Use `uniform` with type hints (`hint_range`, `source_color`) so values are editable in the Inspector.
- Keep shaders small and focused — one effect per shader.
- Use `instance uniform` when many objects share a shader but need different values.
- Prefer built-in `Environment` effects (tonemap, SSAO, SSR) over custom post-processing when available.
- Profile shader cost with the Godot profiler — fragment shaders run per pixel.

## Common Pitfalls

- **Using `hint_screen_texture` in non-screen shaders.** This only works in canvas_item shaders on a full-screen node.
- **Not setting render priority.** Transparent objects and post-processing need correct render order.
- **Forgetting `render_mode unshaded`.** Spatial shaders default to PBR lighting; use `unshaded` for custom lighting.
- **Branching in shaders.** GPUs dislike branches — use `mix()`, `step()`, `smoothstep()` instead of `if`.

## Reference

- [Shading Language](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/shading_language.html)
- [CanvasItem Shaders](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html)
- [Spatial Shaders](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/spatial_shader.html)
- [VisualShaders](https://docs.godotengine.org/en/stable/tutorials/shaders/visual_shaders.html)
