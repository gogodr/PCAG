FROM runpod/worker-comfyui:5.10.0-base-cuda12.8.1

# The source workflow needs only ComfyUI-GGUF beyond the built-in Kontext nodes.
RUN comfy-node-install ComfyUI-GGUF

RUN comfy model download --url https://huggingface.co/QuantStack/FLUX.1-Kontext-dev-GGUF/resolve/main/flux1-kontext-dev-Q5_K_S.gguf --relative-path models/unet --filename flux1-kontext-dev-Q5_K_S.gguf
RUN comfy model download --url https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/clip_l.safetensors --relative-path models/text_encoders --filename clip_l.safetensors
RUN comfy model download --url https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn_scaled.safetensors --relative-path models/text_encoders --filename t5xxl_fp8_e4m3fn_scaled.safetensors
RUN comfy model download --url https://huggingface.co/Comfy-Org/Lumina_Image_2.0_Repackaged/resolve/main/split_files/vae/ae.safetensors --relative-path models/vae --filename ae.safetensors

# Civitai requires the owner's API key for this LoRA. Download only at worker
# startup; no key or licensed model bytes are committed or placed in build logs.
COPY tools/sprites/runpod-flux/download_lora.py /download_lora.py
CMD ["/bin/sh", "-c", "python /download_lora.py && exec /start.sh"]
