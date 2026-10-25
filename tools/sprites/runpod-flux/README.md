# Flux Kontext pose workflow on Runpod

This adapts the [Pose Selector Flux Kontext Workflow v1.2](https://civitai.com/models/1774551/pose-selector-flux-kontext-workflow) recommended pose LoRA variant for the project's walk-right OpenPose frames. It uses the [RefControl pose LoRA](https://civitai.com/models/1894154/refcontrol-flux-kontext-reference-pose-lora), the workflow's Q5_K_S Flux Kontext GGUF, CLIP-L, T5 FP8, and AE VAE. The 1024-pixel reference and pose panels are prepared on the client; GUI selector, image-stitch, rgthree, and TeaCache nodes are omitted from the headless graph.

`Dockerfile` builds on `runpod/worker-comfyui:5.10.0-base-cuda12.8.1`. It downloads the public Hugging Face weights while building and installs ComfyUI-GGUF. The LoRA is downloaded at worker startup with `CIVITAI_API_KEY` supplied as an endpoint environment variable. Keep this key out of source, image layers, job payloads, and logs. The four public weights total approximately 14.0 GB; the LoRA adds 344 MB. A 50 GB container disk leaves room for the base image and runtime files. GPU memory fit on the 32 GB RTX PRO 4500 Blackwell must be confirmed by a real job.

From the repository root, preview a frame with:

```powershell
python tools/sprites/runpod-flux/submit.py --dry-run --frame 0
```

The preview is written to `generated/flux-runpod/input_00.png`. Once a compatible queue Serverless image is deployed, set `CIVITAI_API_KEY` on the endpoint and run:

```powershell
python tools/sprites/runpod-flux/submit.py --endpoint-id ENDPOINT_ID --frame 0
```

The script saves the full model output and its right panel under `generated/flux-runpod/`. The right panel is the experimental character frame; it is not yet cropped to the sprite silhouette or reduced to 90 × 160. Use `--job-id` to resume polling an existing job without another paid generation.

Sources: [workflow download](https://civitai.com/models/1774551/pose-selector-flux-kontext-workflow), [GGUF node](https://github.com/city96/ComfyUI-GGUF), [Runpod worker customization](https://github.com/runpod-workers/worker-comfyui/blob/main/docs/customization.md).
