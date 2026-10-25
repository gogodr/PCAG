# The managed Runpod build still targets this path. Current experiment: Flux.
# The original Qwen recipe is preserved in Dockerfile.qwen.
FROM runpod/worker-comfyui:5.10.0-base-cuda12.8.1

# Install the GGUF node into the ComfyUI that /start.sh actually launches.
# comfy-node-install can leave its requirements in /comfyui/.venv instead of
# /opt/venv, causing ComfyUI to silently omit UnetLoaderGGUF at runtime.
RUN git clone https://github.com/city96/ComfyUI-GGUF.git /comfyui/custom_nodes/ComfyUI-GGUF \
    && git -C /comfyui/custom_nodes/ComfyUI-GGUF checkout 6ea2651e7df66d7585f6ffee804b20e92fb38b8a \
    && uv pip install --python /opt/venv/bin/python -r /comfyui/custom_nodes/ComfyUI-GGUF/requirements.txt \
    && /opt/venv/bin/python -c "import gguf; print('GGUF dependency ready')"

RUN comfy model download --url https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF/resolve/main/flux1-kontext-dev-Q5_K_S.gguf --relative-path models/unet --filename flux1-kontext-dev-Q5_K_S.gguf
RUN comfy model download --url https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors --relative-path models/text_encoders --filename clip_l.safetensors
RUN comfy model download --url https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn_scaled.safetensors --relative-path models/text_encoders --filename t5xxl_fp8_e4m3fn_scaled.safetensors
RUN comfy model download --url https://huggingface.co/Comfy-Org/Lumina_Image_2.0_Repackaged/resolve/main/split_files/vae/ae.safetensors --relative-path models/vae --filename ae.safetensors

# Civitai requires the owner's API key for this LoRA. Download only at worker
# startup; no key or licensed model bytes are committed or placed in build logs.
COPY tools/sprites/runpod-flux/download_lora.py /download_lora.py
CMD ["/bin/sh", "-c", "python /download_lora.py && exec /start.sh"]
