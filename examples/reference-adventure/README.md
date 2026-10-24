# Example project

This example is a snapshot of `C:\Users\gogod\Documents\PCAG\Test1` taken on 2026-10-23. The source project was left untouched.

- [workspace.json](workspace.json) preserves the local project's manifest, including its two scenes, current name, and background paths.
- [backgrounds](backgrounds) and [images](images) contain the copied project assets. Both scenes currently use `backgrounds/scene_2/bg.png`; the scene 1 background is available in Assets.
- [project.json](project.json) is the authored project representation generated from that manifest and its files for the bundled creator and player samples.
- [sample.ts](sample.ts) maps the bundled files into the creator's sample workspace and player asset URLs.

The current snapshot has no hotspots. The sample's project data and files can be validated with `npm run review:format`.
