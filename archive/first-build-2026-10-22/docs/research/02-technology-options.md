# Platforms and technology comparison

Date: 2026-10-21. Status: provisional recommendation; no implementation benchmark performed.

## Recommendation

Updated direction: games target browsers; nontechnical creators build games; programmers maintain the engine. Escoria is a reference, not a proposed dependency. This supersedes the original desktop-first recommendation.

Recommend **TypeScript plus Phaser** for a custom adventure runtime and a purpose-built visual creator. Browser-based authoring is recommended alongside browser game delivery, but its deployment model remains to be confirmed. Scene and asset tools are in potential scope. See the [creator product proposal](../planning/04-browser-creator.md).

This recommendation is an engineering judgment for this project's goals, not a measured performance ranking.

## Separate three platform decisions

| Decision | Initial proposal | Reason |
| --- | --- | --- |
| Where games run | Browsers; begin validation on desktop browsers | User-selected delivery platform; mobile browser usability remains separate |
| Where creators work | Proposed browser visual editor | Give nontechnical creators a dedicated adventure workflow |
| How the framework ships | Creator application, shared runtime, project format, playable export | Creators should not need to install development tools |

Mobile and consoles should be explicit later targets. Cross-platform export does not establish that the UI is usable on touch or controllers. A browser-playable game also does not imply a browser-based authoring environment.

## Candidate comparison

The fit and tradeoff columns are our assessment. Capabilities are grounded in the linked official documentation.

| Candidate | Documented foundation | Fit for this project | Main tradeoff |
| --- | --- | --- | --- |
| Godot + custom addon | Dedicated 2D tools, UI, reusable scenes/resources, editor extensibility, desktop/mobile/web export | Retained comparison; superseded by browser direction | General engine authoring does not directly provide our creator experience |
| Godot + Escoria | Adventure rooms, movement, inventory, dialogue, item combinations, save/load, extensible scripts | Feature and architecture reference | User prefers our own browser framework |
| Unity + Adventure Creator | Adventure interactions, conversations, inventory, visual action sequences, localization, saving | Strong candidate for assembling games with existing visual tooling | Framework design becomes coupled to Unity and this toolkit |
| Adventure Game Studio | Purpose-built adventure IDE and runtime; open-source implementation | Strong candidate if producing traditional adventures quickly is the priority | Custom creator experience must work within or modify its existing model |
| Phaser + TypeScript | Browser-oriented 2D framework with JavaScript/TypeScript development | Leading implementation candidate | Adventure systems and specialized authoring tools require additional work |
| Custom runtime on low-level libraries | We would choose rendering, audio, input, and packaging libraries | Maximum control | Largest scope and maintenance burden; no demonstrated need yet |

Sources: [Godot features](https://godotengine.org/features/), [Escoria overview](https://escoria-framework.org/), [Adventure Creator features](https://adventurecreator.org/), [AGS repository](https://github.com/adventuregamestudio/ags), [Phaser overview](https://docs.phaser.io/phaser/getting-started/what-is-phaser).

## Godot: retained desktop comparison

Godot offers scenes, custom resources, an extensible editor, and a dedicated 2D/UI workflow. These map naturally to rooms, hotspots, items, and shared interface scenes. It uses the MIT license. [Official features](https://godotengine.org/features/)

If the project returned to a desktop engine workflow, typed GDScript and a custom addon would be a possible implementation. This is no longer the proposed project stack.

Godot's current documentation states that Godot 4 C# projects cannot export to web. Web exports require WebAssembly and WebGL 2.0 and use the Compatibility renderer. Therefore, GDScript is the safer initial choice if web remains a target; test browser audio, persistence, and loading in the prototype. [Web export documentation](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html)

Console distribution needs a separate porting/support path; do not treat it as a standard public export target. [Godot platform information](https://godotengine.org/features/)

## Escoria: design reference

Escoria supplies adventure-specific systems on Godot and separates UI and dialogue implementations from its core. Its current documentation describes Godot 4 support and the ASHES scripting language. This could let us add a standardized UI over existing behavior. [Overview](https://docs.escoria-framework.org/en/devel/general/what_is_escoria.html), [project setup](https://docs.escoria-framework.org/en/devel/getting_started/step_by_step/1_create_escoria_project.html)

However, its documentation explicitly warns that it is under development and may be incomplete or outdated. Evaluate a specific repository revision and compatible Godot version; documentation availability alone does not establish production readiness. [Documentation notice](https://docs.escoria-framework.org/en/devel/)

Study how it divides rooms, actors, inventory, actions, dialogue, and persistence. Record which ideas suit our goals and which depend on Godot or scripting-oriented authoring. Implement browser-native equivalents through our own content model and creator tools. An Escoria adoption or Godot port is no longer planned; source-code reuse would require a separate, explicit technical decision.

## Unity + Adventure Creator: ready-made visual workflows

Adventure Creator provides visual ActionLists, multiple interface styles, inventory, conversations, localization, and saves. Its documented target platforms include desktop, WebGL, and mobile; console builds need custom scripting. [Official features](https://adventurecreator.org/)

This is attractive when the priority is authoring finished games with established tools. For a new framework, assess whether our changes can live in templates and extensions. Current purchase terms and Unity licensing have not been evaluated; verify those before a commercial commitment. No price assumptions are used here.

## Adventure Game Studio: purpose-built alternative

AGS combines an adventure editor and runtime. Its repository states that the editor is supported on Windows, while the runtime has other platform implementations. The editor and engine use Artistic License 2.0. [Official repository](https://github.com/adventuregamestudio/ags)

AGS deserves a practical comparison if a Windows authoring workflow is acceptable. Do not dismiss it merely because it targets traditional adventures: that is also our genre. Compare its customization effort and creator experience against a Godot addon. Confirm each required runtime export against a released version rather than inferring support from source folders.

## Phaser: leading browser candidate

Phaser is a web-focused 2D framework supporting JavaScript/TypeScript, WebGL/Canvas, and desktop/mobile browsers. Native packaging uses other tools; its documentation says modern console publishing is not its intended use. [Official overview](https://docs.phaser.io/phaser/getting-started/what-is-phaser)

A proposed web stack would use TypeScript for adventure rules and Phaser for presentation. A separate editor UI could use ordinary web components or a frontend framework. Store authored content in versioned structured files.

This route is compelling if creators should author and share games entirely through a website. It is not automatically less work: room editing, dialogue tools, validation, previews, persistence, and packaging still need implementation or integration.

## Why not a new low-level engine now?

The intended value is consistent adventure behavior and easier content creation. Reimplementing rendering, audio playback, asset loading, font handling, and platform integration does not directly improve those features. Existing engines let us concentrate on the domain systems.

A custom adventure runtime atop Godot or Phaser still gives us ownership of the game model. Reconsider a low-level engine only after identifying a measured limitation that prevents a required outcome.

## Confirmed direction and remaining decisions

Confirmed: nontechnical creators, programmer maintainers, browser games, Escoria as a reference, and potential scene/asset tooling.

Remaining: editor deployment, desktop versus mobile browser priorities, explicit verbs versus contextual actions, local project storage versus accounts/cloud storage, and public versus internal product distribution. Phaser and the editor UI library remain recommendations pending validation.
