"""Bind the visible OpenPencil swatches to the PCAG color variables."""

import json

from openpencil_mcp import Client


TOKENS = ("Midnight", "Panel", "Raised", "Border", "Parchment", "Muted", "Lantern", "Sea glass", "Warning")


def data(result):
    return json.loads(result["content"][0]["text"])


def main():
    client = Client()
    document = next(item for item in data(client.tool("list_documents"))["documents"] if item.get("path", "").endswith("pcag-adventure-studio.fig"))
    doc = document["id"]
    page = next(item["id"] for item in document["pages"] if "Components" in item["name"])
    variables = {item["name"]: item["id"] for item in data(client.tool("list_variables", document_id=doc, page_id=page))["variables"]}
    for name in TOKENS:
        nodes = data(client.tool("find_nodes", name=f"{name} swatch", document_id=doc, page_id=page))["nodes"]
        node = next(node for node in nodes if node["name"] == f"{name} swatch")
        result = data(client.tool("bind_variable", node_id=node["id"], field="fills/0/color", variable_id=variables[name], document_id=doc, page_id=page))
        if result.get("error"):
            raise RuntimeError(result)
        print(name, "bound")
    client.tool("save_file", document_id=doc)


if __name__ == "__main__":
    main()
