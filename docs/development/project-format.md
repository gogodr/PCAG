# Project format v1

F06 also defines an editor [workspace wrapper](../../packages/editor-workspace/src/index.ts) for folders, file bytes, and target resolution. The creator exports `project.pcag`: eight ASCII identifier bytes (`PCAGPRJ1`), a 32-byte SHA-256 digest of the compressed payload, and gzip-compressed workspace JSON. Open project checks the identifier and digest before decompression, then validates the workspace before replacing editor state. Folder and file records are restored into the browser workspace, where media bytes become usable asset URLs. The nested `project` continues to use the v1 playable format. Player ZIP export writes that nested project as `project.json` alongside the media files. Legacy raw JSON is not accepted by Open project.

The working project is a directory on the local machine. Its `workspace.json` stores project settings and scene background paths, without an asset catalog or file bytes. The Assets view scans the actual files and subfolders under `backgrounds`, `images`, `sounds`, and `music` when a project opens and when the view refreshes. Asset edits write to those files directly; unrelated files added outside the editor are preserved. `.pcag` export collects supported assets from the working folder, and import extracts them into the selected folder. An IndexedDB record remembers the directory handle for the next launch; the browser may require the user to grant access again. Creating a new project seeds one empty scene with a blank PNG background so the current v1 room schema remains valid. The reference adventure is available only through the explicit `?sample=1` development route.

F03 introduces an executable schema in [project-format](../../packages/project-format/src/index.ts). `parseProject(text)` parses JSON and validates it; `validateProject(unknown)` validates an already-parsed object. Both return either `{ ok: true, project, diagnostics: [] }` with an independent data copy, or `{ ok: false, diagnostics }` without a partial project. They never repair or mutate the input. No renderer, UI, filesystem, storage, or dependency imports exist in this package.

## Authored records

Every field below is required. Unknown fields are rejected, including editor state, runtime state, and executable scripts. The TypeScript interfaces and runtime checks live together in the package; there is no second, independently maintained schema implementation.

| Record | Fields and meaning |
| --- | --- |
| Project | `schemaVersion: 1`, `id`, `name`, `startRoomId`, `assets`, `rooms` (at least one) |
| Image asset | `id`, `name`, `kind: "image"`, `path` relative to the project's asset root |
| Room | `id`, `name`, positive finite `width`/`height` in logical room coordinates, `backgroundAssetId`, `hotspots` |
| Hotspot | `id`, `name`, `bounds: { x, y, width, height }`, `inspect` text |

Names must be nonblank strings. `inspect` is a string and may be empty while drafting; F04 will supply presentation/fallback behavior. It is the internal identity for View text, not JavaScript or a general action language. Empty asset/hotspot lists are structurally valid; each room still needs a resolvable image declaration. Rectangular bounds have finite nonnegative x/y, positive width/height, and must fit inside their room. Fractional logical coordinates are allowed. A 16:9 player frame does not force all authored rooms to have that ratio; fitting their presentation is a renderer concern.

Image paths allow ASCII letters, digits, spaces, underscores, hyphens, dots, and parentheses, plus slashes and png/jpg/jpeg/webp/svg extensions. Absolute paths, URLs, query strings, backslashes, empty segments, `.` and `..` are rejected. This checks declarations, not file bytes or existence. The creator checks imported file signatures and accepts only static SVG artwork without scripts or external references. Archive limits, asset staging, and missing-file handling belong to project I/O in F05/B01.

## Identity and references

IDs start with a letter, contain letters/digits/underscores/hyphens, and have 1–64 characters. They are unique across project, assets, rooms, and hotspots. `createId()` uses platform `crypto.randomUUID()` with an `id_` prefix; it is called only on creation. Validation never invents or repairs IDs. Runtime reference checks use Map/Set value lookup, not object-prototype keys.

Display-name edits and list reordering keep IDs unchanged. The start room must reference a room; a background must reference an image asset. A deleted target leaves an explicit missing-reference diagnostic, never an automatic reassignment. Future editor duplication must create fresh IDs and remap references internal to the duplicated selection deliberately; references outside that selection keep their original meaning. No duplicate/delete editing operations ship in F03.

The new rebuild supports only v1. Missing, older, and future versions are rejected before interpreting their content. Archived first-build projects are not implicitly compatible even if their version number matches: their structure must pass the new validator, and no migration is claimed. Project-schema version is separate from future player-save and content-revision policies. No player saves exist yet.

## Diagnostics

Each diagnostic contains:

- `severity: "error"` and a stable code (`invalid_json`, `unsupported_version`, `invalid_type`, `unknown_field`, `invalid_value`, `duplicate_id`, `missing_reference`, `out_of_bounds`).
- `path`: JSON Pointer into the submitted document; empty means the document root. Array indexes describe that snapshot, not stable identity.
- `target`: entity `kind`, stable `id` when available, owning `roomId` for hotspots, and a relative `field` such as `backgroundAssetId` or `bounds.width`.
- `message`: a human-readable explanation and corrective direction where applicable.

For the missing-background fixture:

```json
{
  "severity": "error",
  "code": "missing_reference",
  "path": "/rooms/0/backgroundAssetId",
  "target": { "kind": "room", "id": "room_lake", "roomId": null, "field": "backgroundAssetId" },
  "message": "Background \"image_missing\" is missing. Choose an existing image for \"Lakeshore\"."
}
```

The creator translates the background field into “Background image” and exposes technical location in expandable details. F04 can navigate the same target to its actual inspector control. Invalid entity IDs can be null/unusable; use the diagnostic path until repaired. Duplicate IDs must be fixed before stable targeting is reliable.

Structural errors are collected first. Reference and bounds checks run only after structural success, avoiding misleading cascades from malformed records. Duplicate-ID diagnostics identify the later occurrence and name the first location. Validation does not prove puzzle solvability or asset integrity.

## Maintainer checks

```sh
npm run test:format
npm run review:format
npm run review:format -- tests/fixtures/missing-background.json
npm run review:format -- tests/fixtures/missing-start-room.json
```

The valid command exits 0 and prints the resolved start room. The invalid commands intentionally exit 1 and print field diagnostics. This CLI is a maintainer review aid, not a required creator workflow. It uses Node's built-in test/type-stripping support from the pinned Node 22 installation; application and test types are checked separately with `npm run typecheck`.

The [reference fixture](../../examples/reference-adventure/project.json) is loaded through the same parser in both app shells. Its small [adapter](../../examples/reference-adventure/sample.ts) maps a declared asset path to the bundled URL; it is not a general import/export API. F04 will implement actual hotspot rendering/interactions and authoring; F05 will supply storage/export boundaries.
