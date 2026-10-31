# PCAG Adventure Studio designs

## Current exploration: Adventure Workbench v2

Open [`pcag-adventure-studio-v2.fig`](pcag-adventure-studio-v2.fig) in OpenPencil. Its seven editable desktop boards cover Welcome, Project, Assets, Characters, Scenes, Animations, and Components. See [`previews-v2`](previews-v2/) for 1440 × 900 exports and [`16-bit-direction-v2.md`](16-bit-direction-v2.md) for research, visual rules, and UX notes.

The two generated illustrations are in [`assets`](assets/). The design uses the existing PCAG moonlit scene as example project content. Project names and file metadata are illustrative.

The document is generated through OpenPencil's local MCP server by [`build_openpencil_v2.py`](../../tools/design/build_openpencil_v2.py). With the document open, run `python tools/design/build_openpencil_v2.py --update <document-id>` to rebuild and export all pages. The output file and previews are saved in this folder.

## Earlier exploration

[`pcag-adventure-studio.fig`](pcag-adventure-studio.fig) and [`previews`](previews/) preserve the initial direction for comparison. [`build_openpencil.py`](../../tools/design/build_openpencil.py) generated it. That version uses a flatter, sparser interface and is superseded by v2.
