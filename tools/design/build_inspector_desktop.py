"""Draw the desktop-width scene inspector layout in OpenPencil."""

import base64
from pathlib import Path

from build_inspector_redesign import C, data, field, header, rect, text
from openpencil_mcp import Client

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/design/scene-inspector-desktop.fig"
PREVIEW = ROOT / "docs/design/previews-inspector/desktop.png"


def card(name, x, y, w, h):
    return rect(name, x, y, w, h, C["raised"], 6, C["line"])


def board():
    body = text("SCENE WORKBENCH  /  WIDE INSPECTOR", 30, 20, 1000, 14, C["gold"], 600)
    body += text("Desktop layout", 30, 47, 900, 26, C["text"], 600)
    body += text("The inspector spans the scene. Controls form short, readable rows and wrap into columns only when there is room.", 30, 76, 1500, 13, C["muted"])

    body += rect("Image inspector", 30, 111, 1540, 258, C["panel"], 8, C["line"])
    body += header("Door artwork", "Image element", "Scene 1  /  selected", 50, 123, 1100)
    body += card("Name card", 50, 204, 320, 71)
    body += field("Name", "Door artwork", 62, 211, 296)
    body += card("Geometry card", 382, 204, 640, 71)
    for label, value, offset in [("X", "1370", 0), ("Y", "505", 154), ("Width", "120", 308), ("Height", "275", 462)]:
        body += field(label, value, 394 + offset, 211, 142)
    body += card("Actions card", 1034, 204, 516, 71)
    body += text("AVAILABLE ACTIONS", 1046, 211, 250, 11, C["gold"], 600)
    body += text("View [on]    Move to [on]    Talk to [off]", 1046, 239, 490, 12)
    body += card("Source card", 50, 287, 745, 63)
    body += field("Source type", "Animation", 62, 292, 180)
    body += field("File", "door_open.json", 254, 292, 528)
    body += card("Playback card", 807, 287, 743, 63)
    body += field("Run", "Loop", 819, 292, 220)
    body += text("Reverse animation: off", 1060, 324, 330, 12)

    body += rect("Player inspector", 30, 389, 1540, 225, C["panel"], 8, C["line"])
    body += header("Player", "Character", "Starting position and animation", 50, 401, 1100)
    body += card("Character controls", 50, 479, 390, 115)
    body += field("Character", "Walker", 62, 486, 365)
    body += text("Idle   Walk front   Walk back   Walk right", 62, 565, 360, 11)
    body += card("Animation preview", 452, 479, 475, 115)
    body += rect("Player silhouette", 656, 494, 52, 82, C["teal"], 8)
    body += rect("Player anchor", 677, 573, 12, 12, C["gold"], 6)
    body += card("Placement controls", 939, 479, 611, 115)
    body += field("Initial X", "800", 951, 486, 173)
    body += field("Initial Y", "765", 1136, 486, 173)
    body += field("Scale", "1.00", 1321, 486, 215)
    body += text("Anchor X  0.50     Anchor Y  1.00", 951, 565, 550, 12)

    body += rect("Events inspector", 30, 634, 1540, 236, C["panel"], 8, C["line"])
    body += header("SceneManager", "Events and scripts", "2 events", 50, 647, 1100)
    body += card("View Poster event", 50, 724, 744, 125)
    body += text("View Poster", 65, 737, 370, 15, C["text"], 600)
    body += text("Player: View  /  test_poster", 65, 770, 600, 12, C["muted"])
    body += text("Edit Script", 665, 737, 110, 12, C["gold"], 600)
    body += card("Secret Door event", 806, 724, 744, 125)
    body += text("Secret Door Opens", 821, 737, 390, 15, C["text"], 600)
    body += text("SceneState variable change", 821, 770, 600, 12, C["muted"])
    body += text("Edit Script", 1421, 737, 110, 12, C["gold"], 600)
    return f'<Frame name="Desktop scene inspector" x={{0}} y={{0}} w={{1600}} h={{900}} bg="{C["ground"]}">{body}</Frame>'


def main():
    client = Client()
    created = data(client.tool("new_document"))["target"]
    document_id, page_id = created["documentId"], created["pageId"]
    client.tool("render", jsx=board(), document_id=document_id, page_id=page_id)
    nodes = data(client.tool("find_nodes", name="Desktop scene inspector", document_id=document_id, page_id=page_id))["nodes"]
    root = next(node for node in nodes if node["name"] == "Desktop scene inspector")
    image = data(client.tool("export_image", ids=[root["id"]], maxEdge=1600, document_id=document_id, page_id=page_id))
    PREVIEW.write_bytes(base64.b64decode(image["base64"]))
    client.tool("save_file", path=str(OUT), document_id=document_id)
    print(OUT)


if __name__ == "__main__":
    main()
