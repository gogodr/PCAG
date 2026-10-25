FROM runpod/worker-comfyui:5.10.0-base-cuda12.8.1

# The Runpod base image supplies the serverless handler and ComfyUI. This layer
# adds the only custom node required by the exported Qwen Edit workflow.
RUN /opt/venv/bin/python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/nunchux-ai/nunchaku/releases/download/v1.2.1/nunchaku-1.2.1%2Bcu12.8torch2.10-cp312-cp312-linux_x86_64.whl', '/tmp/nunchaku-1.2.1+cu12.8torch2.10-cp312-cp312-linux_x86_64.whl')" \
    && /opt/venv/bin/python -c "from pathlib import Path; p=Path('/tmp/nunchaku-1.2.1+cu12.8torch2.10-cp312-cp312-linux_x86_64.whl'); assert p.stat().st_size > 100_000_000" \
    && uv pip install --python /opt/venv/bin/python --no-deps /tmp/nunchaku-1.2.1+cu12.8torch2.10-cp312-cp312-linux_x86_64.whl \
    && rm /tmp/nunchaku-1.2.1+cu12.8torch2.10-cp312-cp312-linux_x86_64.whl
RUN comfy-node-install ComfyUI-nunchaku

# The backend wheel matches the 5.10.0 base image's Python 3.12, PyTorch 2.10,
# and CUDA 12.8. Catch an upstream base-image change at build time.
RUN python -c "import torch,sys; print('Python',sys.version,'PyTorch',torch.__version__,'CUDA',torch.version.cuda)" \
    && python -c "import nunchaku"

RUN comfy model download --url https://huggingface.co/nunchaku-ai/nunchaku-qwen-image-edit/resolve/main/svdq-fp4_r32-qwen-image-edit-lightningv1.0-8steps.safetensors --relative-path models/diffusion_models --filename svdq-fp4_r32-qwen-image-edit-lightningv1.0-8steps.safetensors
RUN comfy model download --url https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors --relative-path models/text_encoders --filename qwen_2.5_vl_7b_fp8_scaled.safetensors
RUN comfy model download --url https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors --relative-path models/vae --filename qwen_image_vae.safetensors
RUN comfy model download --url https://huggingface.co/Comfy-Org/Qwen-Image-InstantX-ControlNets/resolve/main/split_files/controlnet/Qwen-Image-InstantX-ControlNet-Union.safetensors --relative-path models/controlnet --filename Qwen-Image-InstantX-ControlNet-Union.safetensors
