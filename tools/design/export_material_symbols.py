"""Export the editable Material Symbols used by the OpenPencil concept as local SVGs."""

import json
from pathlib import Path

from openpencil_mcp import Client

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/creator/public/icons/material"
DOCUMENT_PATH = str(ROOT / "docs/design/pcag-adventure-studio-v2.fig")


def data(response):
    return json.loads(response["content"][0]["text"])


def visit(nodes):
    for node in nodes:
        yield node
        yield from visit(node.get("children", []))


def main():
    client = Client()
    document = next(item for item in data(client.tool("list_documents"))["documents"] if item.get("path", "").lower() == DOCUMENT_PATH.lower())
    doc = document["id"]
    client.request("activate_document", {"document_id": doc})
    OUT.mkdir(parents=True, exist_ok=True)
    saved = set()
    for page in document["pages"]:
        page_id = page["id"]
        tree = data(client.tool("get_page_tree", document_id=doc, page_id=page_id))
        for node in visit(tree["children"]):
            name = node["name"]
            if node["type"] != "FRAME" or not name.endswith("-rounded") or name in saved:
                continue
            result = data(client.tool("export_svg", ids=[node["id"]], document_id=doc, page_id=page_id))
            if "svg" not in result:
                raise RuntimeError(f"Could not export {name}: {result}")
            (OUT / f"{name.removesuffix('-rounded')}.svg").write_text(result["svg"], encoding="utf-8")
            saved.add(name)
            print(name)
    print(f"Exported {len(saved)} icons to {OUT}")


if __name__ == "__main__":
    main()
