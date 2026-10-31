"""Export the PCAG OpenPencil artboards as review PNGs."""

import base64
import json
from pathlib import Path

from openpencil_mcp import Client


OUT = Path(__file__).resolve().parents[2] / "docs" / "design" / "previews"


def data(result):
    return json.loads(result["content"][0]["text"])


def main():
    client = Client()
    document = next(item for item in data(client.tool("list_documents"))["documents"] if item.get("path", "").endswith("pcag-adventure-studio.fig"))
    OUT.mkdir(parents=True, exist_ok=True)
    for index, page in enumerate(document["pages"], 1):
        root_name = ("Welcome", "Project", "Assets", "Characters", "Scenes", "Animations", "Components")[index - 1] + " / desktop"
        matches = [item for item in data(client.tool("find_nodes", name=root_name, document_id=document["id"], page_id=page["id"]))["nodes"] if item["name"] == root_name]
        if len(matches) != 1:
            raise RuntimeError(f"Could not find {root_name}: {matches}")
        result = data(client.tool("export_image", ids=[matches[0]["id"]], format="PNG", maxEdge=1440, document_id=document["id"], page_id=page["id"]))
        path = OUT / f"{index:02}-{root_name.split()[0].lower()}.png"
        path.write_bytes(base64.b64decode(result["base64"]))
        print(path.name, path.stat().st_size)


if __name__ == "__main__":
    main()
