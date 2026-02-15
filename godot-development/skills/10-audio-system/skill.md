# Audio System

## Description

This skill covers Godot 4's audio system — AudioStreamPlayer nodes, AudioBuses, spatial audio, music management, and sound effect playback patterns. Good audio design makes games feel alive and responsive.

## When To Use

- Playing music and sound effects
- Setting up an audio bus layout (Master, Music, SFX, UI)
- Implementing spatial / positional audio for 2D or 3D
- Building an AudioManager for centralized audio control
- Managing volume settings and audio transitions

## Prerequisites

- Godot 4.3+ project
- Audio files imported (.ogg for music, .wav for SFX)
- Understanding of the scene tree and autoloads

## Instructions

### 1. Audio Bus Layout

Configure in **Bottom Panel → Audio**:

```
Master
├── Music
├── SFX
├── UI
└── Ambient
```

Each bus can have effects (Reverb, Compressor, Limiter, EQ). Set the **Master** bus limiter to prevent clipping.

### 2. AudioStreamPlayer Nodes

| Node | Use Case |
|------|----------|
| `AudioStreamPlayer` | Non-positional (music, UI sounds) |
| `AudioStreamPlayer2D` | 2D positional audio |
| `AudioStreamPlayer3D` | 3D positional audio |

```gdscript
# Play a sound effect
@onready var _jump_sfx: AudioStreamPlayer = $JumpSFX

func jump() -> void:
    _jump_sfx.play()

# Play with variation
func play_footstep() -> void:
    _footstep.pitch_scale = randf_range(0.9, 1.1)
    _footstep.play()
```

### 3. AudioManager Autoload

```gdscript
# scripts/autoload/audio_manager.gd
extends Node

@onready var _music_player: AudioStreamPlayer = $MusicPlayer
@onready var _sfx_pool: Array[AudioStreamPlayer] = []

const SFX_POOL_SIZE := 8

func _ready() -> void:
    _music_player.bus = &"Music"
    for i in SFX_POOL_SIZE:
        var player := AudioStreamPlayer.new()
        player.bus = &"SFX"
        add_child(player)
        _sfx_pool.append(player)

func play_music(stream: AudioStream, fade_duration: float = 1.0) -> void:
    if _music_player.stream == stream and _music_player.playing:
        return
    
    var tween := create_tween()
    if _music_player.playing:
        tween.tween_property(_music_player, "volume_db", -40.0, fade_duration * 0.5)
        await tween.finished
    
    _music_player.stream = stream
    _music_player.volume_db = -40.0
    _music_player.play()
    
    var fade_in := create_tween()
    fade_in.tween_property(_music_player, "volume_db", 0.0, fade_duration * 0.5)

func stop_music(fade_duration: float = 1.0) -> void:
    var tween := create_tween()
    tween.tween_property(_music_player, "volume_db", -40.0, fade_duration)
    await tween.finished
    _music_player.stop()

func play_sfx(stream: AudioStream, volume_db: float = 0.0) -> void:
    for player in _sfx_pool:
        if not player.playing:
            player.stream = stream
            player.volume_db = volume_db
            player.play()
            return
    # All players busy — skip or grow pool
    push_warning("SFX pool exhausted")

func set_bus_volume(bus_name: StringName, volume: float) -> void:
    var bus_idx := AudioServer.get_bus_index(bus_name)
    AudioServer.set_bus_volume_db(bus_idx, linear_to_db(volume))

func set_bus_mute(bus_name: StringName, mute: bool) -> void:
    var bus_idx := AudioServer.get_bus_index(bus_name)
    AudioServer.set_bus_mute(bus_idx, mute)
```

### 4. 2D Positional Audio

```gdscript
# Attach AudioStreamPlayer2D to the source node
@onready var _hit_sound: AudioStreamPlayer2D = $HitSound

func take_damage() -> void:
    _hit_sound.play()  # Pans and attenuates based on distance to listener
```

Set `max_distance` and `attenuation` in the Inspector for appropriate falloff.

### 5. Volume Settings

```gdscript
func _ready() -> void:
    _music_slider.value = db_to_linear(
        AudioServer.get_bus_volume_db(AudioServer.get_bus_index(&"Music"))
    )
    _sfx_slider.value = db_to_linear(
        AudioServer.get_bus_volume_db(AudioServer.get_bus_index(&"SFX"))
    )

func _on_music_slider_changed(value: float) -> void:
    AudioManager.set_bus_volume(&"Music", value)

func _on_sfx_slider_changed(value: float) -> void:
    AudioManager.set_bus_volume(&"SFX", value)
```

## Best Practices

- Use audio buses to group and control volume by category (Music, SFX, UI).
- Pool `AudioStreamPlayer` nodes — don't create/destroy them at runtime.
- Use `.ogg` for music (smaller files), `.wav` for SFX (no decode latency).
- Add pitch variation to repeated sounds (footsteps, hits) to avoid repetition.
- Fade music in/out — never cut abruptly.
- Use `AudioStreamRandomizer` for automatic variation of the same sound.
- Set a Limiter effect on the Master bus to prevent clipping.

## Common Pitfalls

- **Playing audio on a freed node.** The sound cuts off when the node is freed. Use a persistent AudioManager.
- **All sounds on the Master bus.** Without separate buses, you can't control music vs SFX volume independently.
- **Using `.mp3` or `.wav` for music.** `.ogg` is much smaller and streams well.
- **Not setting max_distance on 2D/3D players.** Audio plays globally at full volume.
- **Creating AudioStreamPlayer per sound.** Pool them in an autoload instead.

## Reference

- [Audio Buses](https://docs.godotengine.org/en/stable/tutorials/audio/audio_buses.html)
- [AudioStreamPlayer](https://docs.godotengine.org/en/stable/classes/class_audiostreamplayer.html)
- [Audio Streams](https://docs.godotengine.org/en/stable/tutorials/audio/audio_streams.html)
