# Export & Deployment

## Description

This skill covers exporting Godot 4 projects to desktop (Windows, macOS, Linux), mobile (Android, iOS), and web (HTML5) platforms. It includes export template management, platform-specific configuration, feature tags, and CI/CD deployment pipelines.

## When To Use

- Exporting the game for distribution or testing
- Configuring platform-specific settings (icons, permissions, signing)
- Setting up automated builds with CI/CD
- Optimising export size and load times
- Managing export presets for multiple platforms

## Prerequisites

- Godot 4.3+ with a runnable project
- Export templates installed for target platform(s)
- Platform SDKs: Android Studio (Android), Xcode (iOS), Emscripten (Web)

## Instructions

### 1. Installing Export Templates

1. Open **Editor → Manage Export Templates**.
2. Click **Download and Install** for the current Godot version.
3. Templates are installed once per Godot version.

### 2. Creating Export Presets

1. Open **Project → Export**.
2. Click **Add…** and select the target platform.
3. Configure settings in the preset panel.
4. Click **Export Project** to build.

### 3. Platform Configuration

#### Windows

```
Preset: Windows Desktop
- Product Name: My Game
- Company Name: Studio Name
- File Version: 1.0.0.0
- Icon: res://icon.ico (256×256 ICO)
- Console Wrapper: disabled (for GUI apps)
```

#### macOS

```
Preset: macOS
- Application: Bundle Identifier: com.studio.mygame
- Application: Short Version: 1.0.0
- Application: Icon: res://icon.icns
- Codesign: Identity (required for distribution)
- Notarization: Apple ID and team (for notarised builds)
```

#### Linux

```
Preset: Linux/X11
- Binary Format: x86_64
- No special configuration required for basic export
```

#### Android

```
Preset: Android
- Package: Unique Name: com.studio.mygame
- Version: Code: 1, Name: 1.0.0
- Screen: Orientation: Portrait / Landscape
- Keystore: Debug / Release keystore paths
- Permissions: INTERNET, VIBRATE, etc.
- Architectures: arm64-v8a (required for Play Store)
```

#### iOS

```
Preset: iOS
- Application: Bundle Identifier: com.studio.mygame
- Application: Short Version: 1.0.0
- Required Icons: 1024×1024, 180×180, 167×167, 152×152, 120×120, 76×76
- Requires Xcode for final build and signing
```

#### Web (HTML5)

```
Preset: Web
- HTML: Custom Shell: res://export/shell.html (optional)
- Variant: Thread support (requires SharedArrayBuffer headers)
- VRAM Texture Compression: For WebGL compatibility
```

### 4. Feature Tags

Use feature tags to conditionally include resources or run code per platform:

```gdscript
func _ready() -> void:
    if OS.has_feature("mobile"):
        _setup_touch_controls()
    elif OS.has_feature("pc"):
        _setup_keyboard_controls()
    
    if OS.has_feature("web"):
        # Disable unsupported features
        _disable_file_dialogs()
    
    if OS.has_feature("debug"):
        _enable_debug_overlay()
```

Custom feature tags can be set per export preset in the Export dialog.

### 5. Reducing Export Size

```
Project Settings → General:
- Disable unused modules in export
- Compress textures: VRAM for 3D, Lossless for 2D pixel art

Export Settings:
- Filters to Exclude: *.md, *.txt, test/*, docs/*
- Strip Debug Symbols: enabled for release builds
```

```gdscript
# In .gdignore — exclude folders from export
# Place a .gdignore file in any folder to exclude it
```

### 6. CI/CD with GitHub Actions

```yaml
name: Build & Release
on:
  push:
    tags:
      - 'v*'

jobs:
  export:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        platform: [windows, linux, web]
        include:
          - platform: windows
            preset: "Windows Desktop"
            extension: ".exe"
          - platform: linux
            preset: "Linux/X11"
            extension: ""
          - platform: web
            preset: "Web"
            extension: ".html"
    
    container:
      image: barichello/godot-ci:4.3
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup export templates
        run: |
          mkdir -p ~/.local/share/godot/export_templates/4.3.stable
          mv /root/.local/share/godot/export_templates/4.3.stable/* \
             ~/.local/share/godot/export_templates/4.3.stable/
      
      - name: Export ${{ matrix.platform }}
        run: |
          mkdir -p build/${{ matrix.platform }}
          godot --headless --export-release \
            "${{ matrix.preset }}" \
            build/${{ matrix.platform }}/game${{ matrix.extension }}
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}
          path: build/${{ matrix.platform }}/
```

### 7. Itch.io Deployment

```yaml
      - name: Deploy to itch.io
        uses: manleydev/butler-publish-itchio-action@master
        env:
          BUTLER_CREDENTIALS: ${{ secrets.BUTLER_API_KEY }}
          CHANNEL: ${{ matrix.platform }}
          ITCH_GAME: studio/game-name
          PACKAGE: build/${{ matrix.platform }}/
```

### 8. Version Management

```gdscript
# Autoload: GameVersion
class_name GameVersion
extends Node

const VERSION := "1.0.0"
const BUILD := "2024.01.15"

static func get_display_string() -> String:
    if OS.has_feature("debug"):
        return "v%s-dev (%s)" % [VERSION, BUILD]
    return "v%s" % VERSION
```

Update version in `project.godot`:

```ini
[application]
config/version="1.0.0"
```

## Best Practices

- Test exports early and often — don't wait until the game is "done".
- Use feature tags to handle platform differences in code.
- Keep export presets in version control (`export_presets.cfg`).
- Strip debug symbols from release builds to reduce size.
- Test web exports with proper CORS and SharedArrayBuffer headers.
- Automate builds with CI/CD to catch export issues immediately.

## Common Pitfalls

- **Missing export templates.** Install them via Editor → Manage Export Templates before exporting.
- **Android keystore not configured.** Release builds require a signed keystore. Set up a debug keystore for testing.
- **Web export not working locally.** Browsers require HTTPS and specific headers for SharedArrayBuffer. Use a local server.
- **Forgetting to exclude test files.** Add `test/*`, `*.md` to the exclude filter to reduce export size.
- **Not testing on target hardware.** Desktop framerate ≠ mobile framerate. Export and test on actual devices.

## Reference

- [Exporting Projects](https://docs.godotengine.org/en/stable/tutorials/export/index.html)
- [Exporting for Windows](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_windows.html)
- [Exporting for Android](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_android.html)
- [Exporting for Web](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)
- [Feature Tags](https://docs.godotengine.org/en/stable/tutorials/export/feature_tags.html)
