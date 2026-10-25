# Qwen Image Edit + OpenPose on Runpod

This is an experimental Runpod ComfyUI worker for the Civitai Qwen Image Edit + InstantX Union ControlNet graph. It uses Nunchaku's FP4 8-step edit model for Blackwell GPUs. The Union ControlNet's official base is Qwen Image, so its behavior with Qwen Image Edit requires an actual GPU test.

The Dockerfile extends `runpod/worker-comfyui:5.11.0-base`. It must be built for `linux/amd64` and deployed as a Runpod queue Serverless worker. The image contains about 25 GB of public model weights. No API keys should be baked into it.

Build requirements: a Linux Docker builder with a registry, or Runpod's GitHub integration connected to the repository. The Dockerfile installs Nunchaku's official Linux wheel for Python 3.12, PyTorch 2.11, and CUDA 12.8, then checks that it imports. Do not deploy a failed build.

For the managed GitHub builder, connect the PCAG repository in Runpod, select `tools/sprites/runpod-qwen` as the build context and `Dockerfile` as its Dockerfile. This directory has a narrow `.dockerignore`, so the existing project and `.env` stay outside the build context. Build completion and worker startup must both be checked before sending the first frame.

Suggested endpoint settings: GPU `NVIDIA RTX PRO 4500 Blackwell`, one GPU, 40 GB container disk or more, minimum workers 0, maximum workers 1, idle timeout 5 seconds or greater. Run a single frame first, inspect the returned image and worker logs, then run the full eight-frame loop. A healthy endpoint alone does not prove pose adherence.

The source Civitai download is a GUI graph, not ComfyUI's API graph. `submit.py` assembles an API graph with the nonessential Easy Use and rgthree nodes removed, crops the right-facing dummy from the turnaround sheet, and sends it with one OpenPose frame. Run `python tools/sprites/runpod-qwen/submit.py --dry-run` to inspect the request size, then `python tools/sprites/runpod-qwen/submit.py --endpoint-id YOUR_ENDPOINT_ID --frame 0` after deployment. The result is saved under `generated/qwen-runpod/`. The graph still needs validation against the running worker's `/object_info` and a real GPU request.

Sources: [Runpod worker customization](https://github.com/runpod-workers/worker-comfyui/blob/main/docs/customization.md), [ComfyUI Qwen ControlNet tutorial](https://docs.comfy.org/tutorials/image/qwen/qwen-image), [Nunchaku plugin installation](https://github.com/nunchux-ai/ComfyUI-nunchaku/blob/main/docs/source/get_started/installation.rst).
