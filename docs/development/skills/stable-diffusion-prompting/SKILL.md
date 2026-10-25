---
name: stable-diffusion-prompting
description: Write and diagnose Stable Diffusion prompts for local ComfyUI image generation, especially reference-guided pixel-art sprites. Use when a prompt or generation result misses a specified subject, style, palette, or pose. Do not use for unrelated image models or general prose writing.
---

# Stable Diffusion prompting

Use the [Stable Diffusion prompt guide](https://www.imagetoprompt.dev/blog/stable-diffusion-prompt-guide/) for a starting vocabulary: compact descriptive phrases, positive and negative conditioning, modest emphasis, and deliberate sampler/CFG experiments. Treat its numeric ranges and quality-token lists as suggestions to test, not guarantees for a particular checkpoint or LoRA. Check [ComfyUI's documentation](https://docs.comfy.org/) and the actual saved workflow for node semantics.

## Before changing words

Read the exact positive and negative prompts **and** the saved graph/settings of the result. Record the checkpoint, LoRA and trigger word, image-to-image source, denoise, ControlNet image/strength/timing, resolution, sampler, steps, CFG, and seed. Inspect the full-resolution output and any pose overlay before diagnosing a 90 × 160 sprite; downsampling can hide defects or create apparent ones.

Separate the controls: the prompt describes subject and appearance; the reference image contributes existing pixels/composition; denoise controls how far image-to-image can depart from it; ControlNet supplies pose; the LoRA biases style; the seed fixes a sampling path. A prompt cannot guarantee exact joints or the same character identity across independent frames. If pose fails, check the control image and conditioning. If identity fails, check reference conditioning and denoise as well as wording.

## Draft the prompt

1. Extract observable invariants from the target image: subject type, silhouette, materials, palette, distinctive marks, viewing direction, pixel-art treatment, framing, and background. Name visible attributes rather than inventing a genre or costume.
2. Write a short positive prompt in ordered, comma-separated phrases: LoRA trigger if required; medium/style; precise subject; defining colors and parts; view/action; framing/background. Put essential identity terms early. Describe the desired output, including an otherwise blank face or bare surface, affirmatively.
3. Use the negative prompt for concrete failure modes seen in the output. Remove terms that fight the intended subject. For example, a humanoid mannequin may need humanlike limbs even if it should lack facial features; excluding `human` or `person` can work against that anatomy. Avoid broad copied negative lists and repeated synonyms.
4. Resolve ambiguous or contradictory terms. `Robot` may imply chrome, `wooden` may imply brown grain, `costume` may imply clothing, and `ultra-detailed` may fight a small pixel sprite. Prefer precise palette and construction terms supported by the reference.
5. Add phrase weights only when the chosen ComfyUI text encoder supports them and a specific trait stays weak. Start with plain wording; test a modest weight rather than stacking emphasis across many phrases. Keep LoRA strength separate from prompt syntax in ComfyUI.

## Compare changes

Save the baseline prompt, graph, and reference image. Render a small diagnostic set with the same seed and settings, changing one factor at a time: wording, negative prompt, denoise, ControlNet strength, LoRA strength, or resolution. For an animation, inspect at least two meaningfully different poses before committing to all frames. Compare full-resolution images, downsampled frames, and the pose overlay. Keep each trial in a separate output directory and report both gains and remaining failures.

For PCAG's walk workflow, read `generated/character-animations-comfy/walk_right-sheet-profile/settings.json` and `tools/sprites/comfy_walk.py` before proposing changes. The side-profile run used image-to-image denoise `0.75`, which allows substantial redesign; its prompt also combined `wooden mannequin robot doll` and excluded `human, person`. Treat these as hypotheses to test, not as proven sole causes of the gray color and character drift.
