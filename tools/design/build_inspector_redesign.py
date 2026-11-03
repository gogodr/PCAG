"""Draw the PCAG scene inspector redesign in the local OpenPencil app."""

import base64
import html
import json
from pathlib import Path

from openpencil_mcp import Client

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/design/scene-inspector-redesign.fig"
PREVIEWS = ROOT / "docs/design/previews-inspector"

C = {"ground": "#101727", "panel": "#142636", "raised": "#1B3445", "well": "#0E1C2A",
     "line": "#365364", "muted": "#A8B9BB", "text": "#E8E3D3", "gold": "#F0C36F", "teal": "#79C3BC"}


def esc(value):
    return html.escape(str(value), quote=True)


def rect(name, x, y, w, h, fill, radius=0, stroke=None):
    extra = f' rounded={{{radius}}}' if radius else ''
    extra += f' stroke="{stroke}" strokeWidth={{1}}' if stroke else ''
    return f'<Rectangle name="{esc(name)}" x={{{x}}} y={{{y}}} w={{{w}}} h={{{h}}} bg="{fill}"{extra} />'


def text(value, x, y, w=240, size=14, color=None, weight=400):
    return f'<Text name="{esc(value)}" x={{{x}}} y={{{y}}} w={{{w}}} h={{26}} size={{{size}}} font="IBM Plex Sans" weight={{{weight}}} color="{color or C["text"]}">{esc(value)}</Text>'


def field(label, value, x, y, w):
    return (text(label, x, y, w, 12, C["muted"], 600)
            + rect(label + " field", x, y + 23, w, 35, C["well"], 6, C["line"])
            + text(value, x + 10, y + 30, w - 18, 13))


def section(label, x, y, w):
    return rect(label + " rule", x, y, w, 1, C["line"]) + text(label, x, y + 12, w, 13, C["gold"], 600)


def header(title, kind, detail, x, y, w):
    return (rect(title + " marker", x, y + 2, 3, 53, C["gold"])
            + text("INSPECTOR / " + kind.upper(), x + 16, y, w - 16, 12, C["muted"], 600)
            + text(title, x + 16, y + 20, w - 16, 21, C["text"], 600)
            + text(detail, x + 16, y + 49, w - 16, 12, C["muted"]))


def button(label, x, y, w, accent=False):
    return (rect(label + " button", x, y, w, 34, C["gold"] if accent else C["raised"], 6,
                 C["gold"] if accent else C["line"])
            + text(label, x + 11, y + 8, w - 20, 12, C["ground"] if accent else C["text"], 600))


def page(name, cards):
    body = text("SCENE WORKBENCH  /  INSPECTOR", 30, 25, 720, 14, C["gold"], 600)
    body += text(name, 30, 54, 1200, 25, C["text"], 600)
    body += text("One selection header; related controls stay together; the active choice gets one brass line.", 30, 89, 1200, 13, C["muted"])
    for label, x, content in cards:
        body += rect(label + " panel", x, 135, 440, 720, C["panel"], 10, C["line"])
        body += content(x + 22, 158, 396)
    return f'<Frame name="{esc(name)}" x={{0}} y={{0}} w={{1440}} h={{900}} bg="{C["ground"]}">{body}</Frame>'


def element(x, y, w):
    s = header("Door artwork", "Image element", "id_door_open  ·  Scene 1", x, y, w)
    s += section("Identity & source", x, y + 93, w)
    s += field("Name", "Door artwork", x, y + 127, w)
    s += field("Source type", "Animation", x, y + 201, 132)
    s += field("File", "door_open.json", x + 144, y + 201, 252)
    s += section("Placement", x, y + 288, w)
    for label, value, dx in [("X", "1370", 0), ("Y", "505", 101), ("Width", "120", 202), ("Height", "275", 303)]:
        s += field(label, value, x + dx, y + 322, 93)
    s += text("●  Preserve aspect ratio", x, y + 390, w, 12, C["teal"])
    s += section("Playback", x, y + 425, w)
    s += field("Run", "Loop", x, y + 459, 189) + field("Direction", "Forward", x + 204, y + 459, 192)
    s += section("Available actions", x, y + 545, w)
    s += text("View     Open     Close     Use", x, y + 580, w, 13, C["text"])
    s += rect("Action selection line", x, y + 606, 31, 2, C["gold"])
    return s


def player(x, y, w):
    s = header("Player", "Actor", "Walker  ·  Scene 1", x, y, w)
    s += section("Character & motion", x, y + 93, w)
    s += field("Character", "Walker", x, y + 127, w)
    s += rect("Animation preview", x, y + 202, w, 167, C["well"], 6, C["line"])
    s += rect("Actor silhouette", x + 178, y + 232, 42, 104, C["teal"], 7)
    s += rect("Actor anchor", x + 192, y + 332, 14, 14, C["gold"], 7)
    s += text("Idle     Walk right     Walk left     Front     Back", x, y + 381, w, 12, C["text"])
    s += rect("Active animation line", x, y + 407, 23, 2, C["gold"])
    s += section("Scene placement", x, y + 435, w)
    s += field("Initial X", "800", x, y + 470, 122)
    s += field("Initial Y", "765", x + 137, y + 470, 122)
    s += field("Scale", "1.00", x + 274, y + 470, 122)
    s += field("Anchor X", "0.50", x, y + 547, 190)
    s += field("Anchor Y", "1.00", x + 206, y + 547, 190)
    s += text("Drag the marker on the preview to move the anchor.", x, y + 616, w, 12, C["muted"])
    return s


def manager(x, y, w):
    s = header("SceneManager", "Events", "3 events  ·  Scene 1", x, y, w)
    s += section("Events", x, y + 93, w) + button("Add event", x + 292, y + 123, 104, True)
    for n, name, trigger, row in [(1, "Open door", "Player: Open · door", 173),
                                   (2, "When player moves", "Character position", 272),
                                   (3, "Close scene", "Scene Close", 371)]:
        s += rect(name + " card", x, y + row, w, 88, C["well"], 6, C["line"])
        s += text(f"0{n}  {name}", x + 13, y + row + 12, w - 28, 14, C["text"], 600)
        s += text(trigger, x + 13, y + row + 42, w - 28, 12, C["muted"])
        s += rect(name + " selection", x + 13, y + row + 75, 60 if n == 2 else 0, 2, C["gold"])
    s += section("Selected event", x, y + 485, w)
    s += field("Trigger", "Character position", x, y + 518, w)
    s += text("Live: start, every 200 ms, end. Keep the script light.", x, y + 585, w, 12, C["gold"])
    s += button("Edit script", x, y + 623, 116)
    return s


def state(x, y, w):
    s = header("SceneState", "Variables", "4 variables  ·  Scene 1", x, y, w)
    s += section("Scene variables", x, y + 93, w)
    s += text("Current value can change while authoring.", x, y + 128, w, 12, C["muted"])
    for name, kind, value, default, row in [("doorOpen", "Boolean", "false", "false", 167),
                                            ("clueCount", "Number", "3", "0", 260),
                                            ("playerName", "Text", "Mara", "", 353)]:
        s += rect(name + " row", x, y + row, w, 83, C["well"], 6, C["line"])
        s += text(name, x + 12, y + row + 9, 200, 14, C["text"], 600)
        s += text(kind, x + 279, y + row + 9, 90, 12, C["muted"])
        s += text("Value", x + 12, y + row + 42, 60, 11, C["muted"])
        s += text(value or "—", x + 70, y + row + 42, 90, 12)
        s += text("Default", x + 196, y + row + 42, 75, 11, C["muted"])
        s += text(default or "—", x + 271, y + row + 42, 90, 12)
    s += button("Add variable", x, y + 463, 121, True)
    return s


def walkable(x, y, w):
    s = header("Walkable Area", "Navigation", "Mask aligned to background", x, y, w)
    s += section("Mask image", x, y + 93, w)
    s += rect("Mask preview", x, y + 132, w, 231, C["well"], 6, C["line"])
    s += rect("Walkable ground", x + 19, y + 273, w - 38, 67, C["teal"], 3)
    s += text("walk_mask.png", x + 12, y + 376, 230, 13)
    s += button("Choose PNG", x + 274, y + 365, 122)
    s += section("Perspective scale", x, y + 422, w)
    s += field("White · minimum", "0.50", x, y + 457, 190)
    s += field("Black · maximum", "1.50", x + 206, y + 457, 190)
    s += text("Transparent pixels block movement. Gray blends the scale.", x, y + 531, w, 12, C["muted"])
    return s


def background(x, y, w):
    s = header("Background", "Scene root", "1600 × 900  ·  Scene 1", x, y, w)
    s += section("Scene image", x, y + 93, w)
    s += rect("Background preview", x, y + 129, w, 265, C["well"], 6, C["line"])
    s += rect("Illustrated wall", x + 21, y + 158, w - 42, 207, C["raised"], 3)
    s += rect("Scene ground", x + 21, y + 316, w - 42, 49, C["teal"])
    s += field("Background file", "scene_1/background.png", x, y + 419, w)
    s += button("Browse backgrounds", x, y + 492, 186)
    s += text("Changing the background clears the walk mask and overlays.", x, y + 545, w, 12, C["muted"])
    return s


def data(result):
    return json.loads(result["content"][0]["text"])


def main():
    if OUT.exists():
        raise RuntimeError(f"Design already exists: {OUT}")
    client = Client()
    created = data(client.tool("new_document"))["target"]
    document_id = created["documentId"]
    boards = [("01 · Elements, Player, Events", [("Element", 24, element), ("Player", 500, player), ("Events", 976, manager)]),
              ("02 · State, Walkable, Background", [("State", 24, state), ("Walkable", 500, walkable), ("Background", 976, background)])]
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    for index, (name, cards) in enumerate(boards):
        page_id = created["pageId"] if index == 0 else data(client.tool("create_page", name=name, document_id=document_id))["id"]
        if index == 0:
            client.tool("update_node", id=page_id, name=name, document_id=document_id, page_id=page_id)
        client.tool("switch_page", page=page_id, document_id=document_id)
        client.tool("render", jsx=page(name, cards), document_id=document_id, page_id=page_id)
        nodes = data(client.tool("find_nodes", name=name, document_id=document_id, page_id=page_id))["nodes"]
        root = next(node for node in nodes if node["name"] == name)
        image = data(client.tool("export_image", ids=[root["id"]], maxEdge=1440, document_id=document_id, page_id=page_id))
        (PREVIEWS / f"board-{index + 1}.png").write_bytes(base64.b64decode(image["base64"]))
        print(name, "rendered", flush=True)
    client.tool("save_file", path=str(OUT), document_id=document_id)
    print(document_id, OUT, flush=True)


if __name__ == "__main__":
    main()
