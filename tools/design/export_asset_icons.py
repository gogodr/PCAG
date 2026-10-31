"""Export scalable Material Symbols for the live asset explorer."""

import json
from pathlib import Path

from openpencil_mcp import Client


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "apps/creator/public/icons/material"
SYMBOLS = ("folder", "image", "music-note", "description", "touch-app")


def data(response):
    return json.loads(response["content"][0]["text"])


def visit(nodes):
    for node in nodes:
        yield node
        yield from visit(node.get("children", []))


def main():
    client = Client()
    target = data(client.tool("new_document"))["target"]
    doc, page = target["documentId"], target["pageId"]
    icons = "".join(
        f'<Icon name="material-symbols:{symbol}-rounded" x={{{index * 40}}} y={{0}} size={{24}} color="#71C5B4" />'
        for index, symbol in enumerate(SYMBOLS)
    )
    client.tool("render", jsx=f'<Frame name="Asset icons" x={{0}} y={{0}} w={{{len(SYMBOLS) * 40}}} h={{40}} bg="#101727">{icons}</Frame>', document_id=doc, page_id=page)
    tree = data(client.tool("get_page_tree", document_id=doc, page_id=page))
    OUT.mkdir(parents=True, exist_ok=True)
    for node in visit(tree["children"]):
        name = node["name"]
        if node["type"] != "FRAME" or name not in {f"{symbol}-rounded" for symbol in SYMBOLS}:
            continue
        result = data(client.tool("export_svg", ids=[node["id"]], document_id=doc, page_id=page))
        (OUT / f"{name.removesuffix('-rounded')}.svg").write_text(result["svg"], encoding="utf-8")
        print(name)


if __name__ == "__main__":
    main()
