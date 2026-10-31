# Flux Kontext pose workflow on Runpod

This adapts the [Pose Selector Flux Kontext Workflow v1.2](https://civitai.com/models/1774551/pose-selector-flux-kontext-workflow) recommended pose LoRA variant for the project's walk-right OpenPose frames. It uses the [RefControl pose LoRA](https://civitai.com/models/1894154/refcontrol-flux-kontext-reference-pose-lora), the workflow's Q5_K_S Flux Kontext GGUF, CLIP-L, T5 FP8, and AE VAE. The 1024-pixel reference and pose panels are prepared on the client; GUI selector, image-stitch, rgthree, and TeaCache nodes are omitted from the headless graph.

`Dockerfile` builds on `runpod/worker-comfyui:5.10.0-base-cuda12.8.1`. It downloads the public Hugging Face weights while building and installs ComfyUI-GGUF. The LoRA is downloaded at worker startup with `CIVITAI_API_KEY` supplied as an endpoint environment variable. Keep this key out of source, image layers, job payloads, and logs. The four public weights total approximately 14.0 GB; the LoRA adds 344 MB. The workflow completed on a 32 GB RTX PRO 4500 Blackwell with a 50 GB container disk.

From the repository root, preview a frame with:

```powershell
python tools/sprites/runpod-flux/submit.py --dry-run --frame 0
```

The preview is written to `generated/flux-runpod/input_00.png`. Once a compatible queue Serverless image is deployed, set `CIVITAI_API_KEY` on the endpoint and run:

```powershell
python tools/sprites/runpod-flux/submit.py --endpoint-id ENDPOINT_ID --frame 0
```

The script saves the full model output and its right panel under `generated/flux-runpod/`. Use `--job-id` to resume polling an existing job without another paid generation. The packaging script below crops and reduces the result to 90 × 160.

## Walk-right experiment

The sparse OpenPose guides generated skeletal figures rather than the dummy. The workflow's detailed DW Pose guide worked better, so `make_dwpose_guides.py` adds face and hand landmarks to the project's eight walk-right poses. The detailed guides are in `generated/flux-runpod/dwpose-guides/`.

The eight completed renders are in `generated/flux-runpod/walk_right/`. To regenerate the guides, submit the batch, and package the output:

```powershell
python tools/sprites/runpod-flux/make_dwpose_guides.py
python tools/sprites/runpod-flux/batch_walk.py --endpoint-id 4o82a1di5juzij --wait-seconds 2400
python tools/sprites/runpod-flux/package_walk.py
```

`batch_walk.py` records accepted job IDs in `walk_right/jobs.json` so rerunning it resumes existing jobs. The package step writes a transparent 720 × 160 atlas, eight 90 × 160 frames, and an 8 fps GIF in `walk_right/packed/`. The source renders have a nearly uniform beige background; `package_walk.py` removes it by color distance. Inspect pale edges before using the atlas in production.

The generated dummy stays recognizable and the frames vary by pose, but stride, hand placement, and body proportions are inconsistent. This is an experiment, not a finished animation loop. The endpoint is paused at zero maximum workers after the batch; raise the maximum to one before submitting new jobs. The build still uses the historical `runpod-qwen` registry path because that is the repository's existing Runpod build integration.

Sources: [workflow download](https://civitai.com/models/1774551/pose-selector-flux-kontext-workflow), [GGUF node](https://github.com/city96/ComfyUI-GGUF), [Runpod worker customization](https://github.com/runpod-workers/worker-comfyui/blob/main/docs/customization.md).
