# Extending the game

Content is data, engine is code. Almost everything below is "add an entry".
Paths: `src/data/*` (typed data), `public/data/dialogues/*.json` (dialogue), `public/audio|images/*` (files).

## Add an NPC (data only, when you have a sprite)
1. Put `mia.png` in `public/images/`, then declare it in `src/data/assets.ts`:
   `lobby: { images: [{ key: "npc_mia", url: "images/mia.png" }], ... }`
   (spritesheet: `spritesheets: [{ key, url, frameWidth, frameHeight }]` + `frameCount` below)
2. Add to `entities` in `src/data/scenes/lobby.ts`:
   `{ id: "mia", kind: "sprite-npc", x: 700, y: 640, texture: "npc_mia", frameCount: 2, dialogueId: "lobby.mia" }`
3. Add the dialogue (next section). Done: no TypeScript changed.

Hand-drawn NPC (like Sajjad)? Write the class, then one line in `src/objects/register.ts`:
`entities.register("my-npc", (cfg, ctx) => { const n = new MyNPC(ctx.scene, cfg.x, cfg.y, cfg.dialogueId as string); ctx.interaction.add(n); ctx.updates.add(n); });`

## Add a dialogue (JSON only)
Append to `public/data/dialogues/lobby.json` (or a new file + one `json` line in the manifest with `role: "dialogue"`):
```json
{ "id": "lobby.mia", "speaker": "Mia", "start": [{ "when": { "has": "lobby_key" }, "node": "thanks" }, { "node": "hello" }],
  "nodes": {
    "hello":  { "pages": [["Hi! I lost my key.", "Seen it?"]],
                "choices": [{ "text": "Where did you lose it?", "next": "where" },
                            { "text": "Sorry, no.", "effects": [{ "setFlag": "mia_asked" }] }] },
    "where":  { "pages": ["Near the old log, I think."] },
    "thanks": { "pages": ["You found it! Thank you!"], "effects": [{ "take": "lobby_key" }, { "sfx": "sfx_collect" }] }
  } }
```
Fields: `pages` (string or array of lines), `next`, `choices` (`text`, `next`, `when`, `effects`), `links` (key of `LINK_SETS` or inline), `effects`, `repeat: { runs, then }` (resume + "after N read-throughs go to `then`", this is what Sajjad and the bear use).
Conditions: `{flag, equals|gte|lt}`, `{has, count}`, `{all}`, `{any}`, `{not}`. Effects: `setFlag`, `inc`, `give`, `take`, `sfx`, `emit` (listen with `GameState.get(scene).events.on(name, ...)` to build quests/cutscenes).
Typos in node ids are reported in the console when the file loads.

## Add a collectable
1. Define the item in `src/data/items.ts` (`type`: `coin` | `key` | `lore` or your own).
   `ruby: { type: "coin", name: "Ruby", value: 5, look: { shape: "orb", color: 0xe0115f } }`
2. Place it: `{ id: "ruby-1", kind: "collectable", item: "ruby", x: 900, y: 600 }` (unique `id`).
   Coins are collected by touch; keys and lore by E. Lore: add `dialogueId` to the item.
New behaviour for a new type: `itemTypes.register("heal", { pickup: "touch", onCollect: (scene, id, def) => { ... } })` in `src/systems/Items.ts`.
Trigger zone (fires dialogue/effects once on entering): `{ id: "t1", kind: "trigger", x: 300, y: 600, width: 120, height: 200, dialogueId: "lobby.hint" }`.

## Add audio
- Put `door.ogg` + `door.mp3` in `public/audio/sfx/`; manifest: `{ key: "sfx_door", urls: a("audio/sfx/door") }`; (optionally add to `SFX` in `src/data/audio.ts`).
- Play: `AudioManager.get(this).playSfx(SFX.door, { pitchJitter: 40 })` or from data: `{ "sfx": "sfx_door" }`.
- Music for a scene: `music: { key: "bgm_cave", volume: 0.5, fadeIn: 2000 }` in its content file + the file in that scene's bundle. Crossfades automatically.
- Volumes: `audio.setVolume("music" | "sfx" | "master", 0..1)`, `audio.toggleMute()` (key `M` in the lobby).

## Add a scene
1. `src/data/scenes/cave.ts`: `export const CAVE: SceneContent = { bundles: ["common", "cave"], music: {...}, entities: [...] }`
2. Add a `cave` bundle to `src/data/assets.ts`.
3. `src/scenes/Cave/CaveScene.ts`: copy the *structure* of `LobbyScene` (preload -> `queueBundles`; create -> `DialogueManager.registerFromCache`, `DialogueManager`, `InteractionManager`, `spawnEntities(CAVE.entities, ...)`, `attachMusic`). Only the scenery drawing is scene-specific.
4. Add it to `SCENES` in `src/scenes/index.ts`; switch with `this.scene.start("CaveScene")`.

## Add a new kind of interactive thing
Write a class implementing `IInteractable` (`dialogueId?`, `onInteract?`, `setNearby`), register it in `src/objects/register.ts`. Done.
