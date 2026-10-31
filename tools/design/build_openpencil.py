"""Build editable PCAG Adventure Studio boards in the running OpenPencil app."""

import base64
import html
import json
import sys
from pathlib import Path

from openpencil_mcp import Client


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs" / "design" / "pcag-adventure-studio.fig"
ART = ROOT / "apps" / "creator" / "public" / "art" / "moonlit-ruins.png"
C = {"bg": "#0B1824", "sidebar": "#101F2C", "panel": "#142636", "raised": "#1C3444", "border": "#365364", "text": "#E8E3D3", "muted": "#A8B9BB", "amber": "#F0C36F", "sea": "#69BDB2", "red": "#E28F82"}


def e(value):
    return html.escape(str(value), quote=True)


def frame(name, x, y, w, h, bg=None, children="", stroke=None):
    attrs = f'name="{e(name)}" x={{{x}}} y={{{y}}} w={{{w}}} h={{{h}}}'
    if bg:
        attrs += f' bg="{bg}"'
    if stroke:
        attrs += f' stroke="{stroke}" strokeWidth={{{1}}}'
    return f'<Frame {attrs}>{children}</Frame>'


def rect(name, x, y, w, h, color, stroke=None):
    attrs = f'name="{e(name)}" x={{{x}}} y={{{y}}} w={{{w}}} h={{{h}}} bg="{color}"'
    if stroke:
        attrs += f' stroke="{stroke}" strokeWidth={{{1}}}'
    return f'<Rectangle {attrs} />'


def txt(value, x, y, size=16, color=None, w=500, h=36, pixel=False, weight=400, name=None):
    font = "Pixelify Sans" if pixel else "IBM Plex Sans"
    color = color or C["text"]
    return f'<Text name="{e(name or value[:32])}" x={{{x}}} y={{{y}}} w={{{w}}} h={{{h}}} size={{{max(size, 12)}}} font="{font}" weight={{{weight}}} color="{color}">{e(value)}</Text>'


def line(x, y, w, color=None):
    return rect("Divider", x, y, w, 1, color or C["border"])


def panel(name, x, y, w, h, children=""):
    return frame(name, x, y, w, h, C["panel"], "", C["border"]) + children


def button(label, x, y, w, primary=False, icon=None):
    fill = C["amber"] if primary else C["raised"]
    ink = C["bg"] if primary else C["text"]
    content = ""
    if icon:
        content += txt(icon, 16, 10, 24, ink, 28, 28, True)
    small = w < 270
    content += txt(label, 52 if icon else 17, 11, 13 if small else 17, ink, w - (68 if icon else 34), 28, not small, 600)
    return frame(label + " button", x, y, w, 48, fill, content, None if primary else C["border"])


ICON_BITS = {
    "Project": ["011110", "110011", "100001", "101101", "100001", "111111"],
    "Assets": ["111000", "100100", "111111", "100001", "100001", "111111"],
    "Characters": ["011110", "100001", "101101", "011110", "011110", "110011"],
    "Scenes": ["111111", "100001", "101001", "101101", "100001", "111111"],
    "Animations": ["111111", "101001", "101101", "101001", "101001", "111111"],
}


def pixel_icon(name, x, y, color):
    bits = ICON_BITS[name]
    return "".join(rect(name + " icon pixel", x + col * 3, y + row * 3, 3, 3, color)
                   for row, cells in enumerate(bits) for col, cell in enumerate(cells) if cell == "1")


def field(label, value, x, y, w):
    return txt(label, x, y, 12, C["muted"], w, 20, weight=600) + rect(label + " field", x, y + 25, w, 43, C["bg"], C["border"]) + txt(value, x + 13, y + 35, 14, C["text"], w - 26, 25)


def button_component(name, x, y, w, primary=False):
    bg = C["amber"] if primary else C["raised"]
    color = C["bg"] if primary else C["text"]
    stroke = "" if primary else f' stroke="{C["border"]}" strokeWidth={{1}}'
    return (f'<Component name="{e(name)}" x={{{x}}} y={{{y}}} w={{{w}}} h={{48}} bg="{bg}"{stroke}>'
            f'<Text name="Label" x={{17}} y={{11}} w={{{w - 34}}} h={{28}} size={{14}} font="IBM Plex Sans" weight={{600}} color="{color}">{e(name.split(" / ")[-1])}</Text>'
            '</Component>')


def field_component(x, y):
    return (f'<Component name="Field / Project name" x={{{x}}} y={{{y}}} w={{535}} h={{69}}>'
            f'<Text name="Label" x={{0}} y={{0}} w={{535}} h={{20}} size={{12}} font="IBM Plex Sans" weight={{600}} color="{C["muted"]}">PROJECT NAME</Text>'
            f'<Rectangle name="Field background" x={{0}} y={{25}} w={{535}} h={{43}} bg="{C["bg"]}" stroke="{C["border"]}" strokeWidth={{1}} />'
            f'<Text name="Value" x={{13}} y={{35}} w={{500}} h={{25}} size={{14}} font="IBM Plex Sans" color="{C["text"]}">Moonlit Ruins</Text>'
            '</Component>')


def brand(x, y, small=False):
    size = 30 if small else 42
    mark = rect("Doorway mark", x, y, size, size, C["amber"])
    mark += rect("Doorway dark", x + size * .28, y + size * .24, size * .44, size * .76, C["bg"])
    mark += rect("Doorway light", x + size * .44, y + size * .46, size * .24, size * .54, C["sea"])
    mark += txt("PCAG", x + size + 10, y - 4, 27 if small else 37, C["text"], 160, 40, True, 600)
    mark += txt("ADVENTURE STUDIO", x + size + 11, y + (25 if small else 37), 9 if small else 11, C["sea"], 190, 20, weight=700)
    return mark


NAV = [("Project", "▣"), ("Assets", "▧"), ("Characters", "♟"), ("Scenes", "▤"), ("Animations", "▥")]


def shell(title, active, subtitle):
    s = rect("Canvas", 0, 0, 1440, 900, C["bg"])
    s += rect("Sidebar", 0, 0, 230, 900, C["sidebar"])
    s += line(229, 0, 1)
    s += brand(28, 28, True)
    s += txt("CURRENT PROJECT", 28, 123, 10, C["muted"], 170, 20, weight=700)
    s += rect("Project switcher", 18, 149, 194, 53, C["panel"], C["border"])
    s += txt("Moonlit Ruins", 32, 164, 15, C["text"], 150, 24, weight=600)
    s += txt("WORKSPACE", 28, 239, 10, C["muted"], 170, 20, weight=700)
    for i, (label, _icon) in enumerate(NAV):
        y = 270 + i * 54
        if label == active:
            s += rect(label + " selected", 18, y, 194, 43, C["raised"])
            s += rect("Selection rail", 18, y, 3, 43, C["amber"])
        s += pixel_icon(label, 32, y + 12, C["amber"] if label == active else C["sea"])
        s += txt(label, 70, y + 10, 15, C["text"] if label == active else C["muted"], 120, 25, weight=600 if label == active else 400)
    s += rect("Save status dot", 29, 846, 8, 8, C["sea"])
    s += txt("Saved to project folder", 45, 838, 11, C["muted"], 165, 25)
    s += line(230, 122, 1210)
    s += txt("MOONLIT RUINS  /  " + title.upper(), 278, 25, 10, C["sea"], 360, 20, weight=700)
    s += txt(title, 278, 46, 37, C["text"], 450, 50, True, 600)
    s += txt(subtitle, 278, 92, 13, C["muted"], 680, 22)
    s += button("Undo", 1230, 45, 75) + button("Redo", 1312, 45, 75)
    return s


def welcome():
    s = rect("Midnight canvas", 0, 0, 1440, 900, C["bg"])
    s += brand(70, 47)
    s += txt("MAKE YOUR NEXT ADVENTURE", 1104, 65, 11, C["sea"], 280, 22, weight=700)
    s += txt("A HOME FOR YOUR IMAGINATION", 73, 210, 12, C["sea"], 475, 25, weight=700)
    s += txt("Build worlds.", 70, 264, 73, C["text"], 620, 92, True, 600)
    s += txt("Tell stories.", 70, 348, 73, C["amber"], 620, 92, True, 600)
    s += txt("Bring scenes, characters, and curious little details together.", 74, 465, 17, C["muted"], 590, 30)
    s += txt("Everything you need to make a point and click adventure.", 74, 494, 17, C["muted"], 590, 30)
    s += button("Create a new project", 73, 574, 510, True, "+")
    s += button("Import a PCAG project file", 73, 647, 247)
    s += button("Continue a local project", 336, 647, 247)
    s += txt("BRING IN A SHARED ADVENTURE", 76, 704, 10, C["muted"], 245, 22, weight=600)
    s += txt("PICK UP WHERE YOU LEFT OFF", 339, 704, 10, C["muted"], 245, 22, weight=600)
    s += rect("Artwork border", 694, 159, 680, 606, C["raised"], C["border"])
    s += rect("Moonlit ruin artwork", 704, 169, 660, 586, C["panel"])
    s += txt("EVERY STORY STARTS SOMEWHERE", 704, 779, 11, C["sea"], 440, 25, weight=700)
    s += txt("01 / 03", 1291, 779, 11, C["muted"], 75, 25)
    return frame("Welcome / desktop", 0, 0, 1440, 900, C["bg"], s)


def project():
    s = shell("Project", "Project", "Settings and publishing for this adventure.")
    d = txt("01 / GAME SETUP", 302, 190, 11, C["sea"], 250, 20, weight=700)
    d += txt("Game details", 302, 220, 27, C["text"], 500, 40, True, 600)
    d += txt("The settings used by every scene in this project.", 302, 261, 14, C["muted"], 540, 25)
    d += line(302, 306, 607)
    d += field("PROJECT NAME", "Moonlit Ruins", 302, 338, 607)
    d += field("TARGET WIDTH", "1280", 302, 444, 293)
    d += field("TARGET HEIGHT", "720", 616, 444, 293)
    d += field("STARTING SCENE", "The Old Lighthouse", 302, 550, 607)
    d += txt("Your game opens in this scene when a player presses Start.", 302, 634, 12, C["muted"], 570, 23)
    s += panel("Game details", 278, 166, 655, 580, d)
    a = txt("02 / PUBLISH & PLAY", 973, 190, 11, C["sea"], 270, 20, weight=700)
    a += txt("Ready for adventure?", 973, 220, 25, C["text"], 385, 42, True, 600)
    a += txt("Preview your game, then package it for players.", 973, 265, 13, C["muted"], 380, 25)
    a += rect("Readiness status", 973, 316, 384, 72, C["raised"], C["border"])
    a += rect("Ready light", 991, 343, 10, 10, C["sea"])
    a += txt("Ready to play", 1014, 326, 15, C["text"], 275, 24, weight=600)
    a += txt("Saved to project folder", 1014, 352, 12, C["muted"], 300, 20)
    a += button("Preview game", 973, 420, 384, True, "▶")
    a += button("Export player ZIP", 973, 482, 384)
    a += button("Export project", 973, 544, 384)
    a += line(973, 621, 384)
    a += txt("OPEN ANOTHER PROJECT", 973, 649, 12, C["sea"], 270, 20, weight=700)
    a += txt("CLOSE PROJECT", 973, 693, 12, C["red"], 270, 20, weight=700)
    s += panel("Project actions", 949, 166, 432, 580, a)
    return frame("Project / desktop", 0, 0, 1440, 900, C["bg"], s)


def assets():
    s = shell("Assets", "Assets", "Browse and organize the files in your project.")
    s += txt("PROJECT / ART / BACKGROUNDS", 278, 148, 11, C["sea"], 380, 23, weight=700)
    s += button("Import files", 1232, 140, 156, True)
    folders = txt("PROJECT FILES", 301, 211, 11, C["sea"], 170, 22, weight=700)
    for i, name in enumerate(["Art", "Audio", "Characters", "Scenes", "Scripts", "UI"]):
        y = 254 + i * 53
        if i == 0:
            folders += rect("Art selected", 288, y - 5, 206, 43, C["raised"])
        folders += pixel_icon("Assets", 301, y + 3, C["amber"] if i == 0 else C["sea"])
        folders += txt(name, 342, y + 5, 15, C["text"] if i == 0 else C["muted"], 130, 25, weight=600 if i == 0 else 400)
    s += panel("Folder rail", 278, 190, 230, 622, folders)
    files = txt("BACKGROUNDS", 548, 211, 19, C["text"], 300, 29, True, 600)
    files += txt("4 ITEMS", 943, 216, 10, C["muted"], 80, 19, weight=700) + line(540, 253, 470)
    for i, (name, meta) in enumerate([("lighthouse-night.png", "IMAGE · 1280×720"), ("harbor-dawn.png", "IMAGE · 1280×720"), ("forest-path.png", "IMAGE · 1280×720"), ("ruins-arch.png", "IMAGE · 1280×720")]):
        y = 273 + 85 * i
        if i == 0:
            files += rect("Selected asset", 538, y, 474, 75, C["raised"])
        files += rect(name + " thumbnail", 553, y + 10, 60, 54, C["bg"], C["border"])
        files += pixel_icon("Scenes", 572, y + 27, C["sea"])
        files += txt(name, 628, y + 13, 15, C["text"], 340, 24, weight=600)
        files += txt(meta, 628, y + 42, 11, C["muted"], 300, 20)
    s += panel("File list", 526, 190, 498, 622, files)
    prev = txt("PREVIEW", 1048, 211, 11, C["sea"], 220, 20, weight=700)
    prev += rect("Asset preview border", 1048, 247, 314, 210, C["bg"], C["border"])
    prev += rect("Asset preview image", 1056, 255, 298, 194, C["panel"])
    prev += txt("lighthouse-night.png", 1048, 488, 18, C["text"], 298, 30, True, 600)
    prev += txt("PNG IMAGE", 1048, 532, 11, C["sea"], 150, 20, weight=700)
    prev += txt("1280 × 720 pixels", 1048, 561, 13, C["muted"], 230, 23)
    prev += txt("Art / Backgrounds", 1048, 591, 13, C["muted"], 230, 23)
    prev += line(1048, 634, 314)
    prev += button("Use in scene", 1048, 662, 314, True)
    s += panel("Asset details", 1034, 190, 347, 622, prev)
    return frame("Assets / desktop", 0, 0, 1440, 900, C["bg"], s)


def characters():
    s = shell("Characters", "Characters", "References, sprites, and animation assignments.")
    roster = txt("CHARACTERS", 301, 190, 11, C["sea"], 190, 20, weight=700)
    roster += txt("3 in this project", 301, 221, 13, C["muted"], 180, 20)
    for i, name in enumerate(["Mara", "The Ferryman", "Iris"]):
        y = 265 + i * 81
        if i == 0:
            roster += rect("Mara selected", 289, y - 6, 250, 71, C["raised"])
        roster += rect(name + " portrait", 301, y, 52, 52, C["bg"], C["border"])
        roster += txt(name[0], 316, y + 8, 27, C["amber"], 28, 34, True)
        roster += txt(name, 368, y + 3, 16, C["text"], 158, 25, weight=600)
        roster += txt("4 animations" if i == 0 else "Needs sprites", 368, y + 30, 11, C["sea"] if i == 0 else C["muted"], 150, 20)
    roster += button("Add character", 301, 689, 226, True)
    s += panel("Character roster", 278, 166, 274, 580, roster)
    detail = txt("01 / SELECTED CHARACTER", 580, 190, 11, C["sea"], 300, 20, weight=700)
    detail += txt("Mara", 580, 221, 30, C["text"], 250, 40, True, 600)
    detail += txt("The lighthouse keeper", 580, 263, 14, C["muted"], 300, 25)
    detail += rect("Reference image", 580, 312, 221, 275, C["bg"], C["border"])
    detail += txt("CHARACTER REFERENCE", 602, 440, 10, C["muted"], 190, 20, weight=700)
    detail += field("DISPLAY NAME", "Mara", 827, 326, 270)
    detail += field("REFERENCE IMAGE", "mara-reference.png", 827, 431, 270)
    detail += button("Replace reference", 827, 536, 270)
    detail += line(580, 620, 510)
    detail += txt("ANIMATION SLOTS", 580, 644, 11, C["sea"], 260, 20, weight=700)
    detail += txt("Idle  ✓   Walk  ✓   Talk  +   Interact  +", 580, 676, 14, C["text"], 515, 26)
    s += panel("Character details", 566, 166, 546, 580, detail)
    aside = txt("SPRITE CHECKLIST", 1140, 190, 11, C["sea"], 220, 20, weight=700)
    aside += txt("2 of 4 ready", 1140, 225, 22, C["text"], 230, 35, True, 600)
    for i, (name, done) in enumerate([("Idle", True), ("Walk", True), ("Talk", False), ("Interact", False)]):
        y = 294 + 70 * i
        aside += rect(name + " status", 1140, y, 214, 53, C["raised"], C["border"])
        aside += txt("✓" if done else "+", 1153, y + 10, 20, C["sea"] if done else C["amber"], 30, 28, True)
        aside += txt(name, 1192, y + 13, 15, C["text"], 130, 25, weight=600)
    aside += button("Open animations", 1140, 624, 214, True)
    s += panel("Animation checklist", 1126, 166, 255, 580, aside)
    return frame("Characters / desktop", 0, 0, 1440, 900, C["bg"], s)


def scenes():
    s = shell("Scenes", "Scenes", "Arrange locations and make them interactive.")
    s += rect("Scene switcher", 1005, 45, 196, 47, C["raised"], C["border"])
    s += txt("Old Lighthouse", 1021, 56, 15, C["text"], 175, 26)
    tree = txt("ELEMENTS", 300, 187, 11, C["sea"], 150, 20, weight=700)
    tree += txt("+", 468, 179, 25, C["amber"], 30, 30, True)
    for i, name in enumerate(["Lantern", "Old door", "Dock", "Background"]):
        y = 241 + 51 * i
        if i == 1:
            tree += rect("Selected element", 289, y - 6, 210, 43, C["raised"])
        tree += txt("◆" if i < 3 else "B", 301, y, 18, C["amber"] if i == 1 else C["sea"], 27, 25, True)
        tree += txt(name, 334, y + 1, 14, C["text"] if i == 1 else C["muted"], 155, 24, weight=600 if i == 1 else 400)
    s += panel("Scene elements", 278, 166, 232, 631, tree)
    s += panel("Scene canvas", 526, 166, 617, 631, txt("OLD LIGHTHOUSE  ·  1280 × 720", 549, 185, 11, C["sea"], 400, 21, weight=700))
    s += rect("Scene artwork frame", 549, 236, 571, 419, C["bg"], C["border"])
    s += rect("Scene artwork", 555, 242, 559, 407, C["panel"])
    s += rect("Selected element", 831, 420, 80, 105, "#F0C36F22", C["amber"])
    s += txt("100%  ·  SNAP OFF", 549, 704, 10, C["muted"], 300, 20, weight=700)
    ins = txt("INSPECTOR", 1170, 187, 11, C["sea"], 210, 20, weight=700)
    ins += txt("Old door", 1170, 221, 24, C["text"], 230, 35, True, 600)
    ins += txt("ELEMENT", 1170, 262, 10, C["amber"], 200, 20, weight=700)
    ins += line(1170, 301, 220)
    ins += field("NAME", "Old door", 1170, 324, 220)
    ins += field("X / Y", "640   /   365", 1170, 424, 220)
    ins += field("WIDTH / HEIGHT", "180   /   245", 1170, 524, 220)
    ins += txt("ON INSPECT", 1170, 635, 11, C["sea"], 200, 20, weight=700)
    ins += txt("The door is locked…", 1170, 665, 13, C["muted"], 220, 45)
    s += panel("Element inspector", 1159, 166, 252, 631, ins)
    return frame("Scenes / desktop", 0, 0, 1440, 900, C["bg"], s)


def animations():
    s = shell("Animations", "Animations", "Create and refine character motion.")
    s += txt("MARA  /  WALK  /  LEFT", 278, 153, 11, C["sea"], 350, 20, weight=700)
    s += txt("Walk cycle", 278, 181, 28, C["text"], 420, 42, True, 600)
    s += txt("8 frames · 12 FPS · looping", 278, 226, 13, C["muted"], 340, 23)
    stage = txt("SPRITE PREVIEW", 302, 278, 11, C["sea"], 300, 21, weight=700)
    stage += rect("Checkerboard stage", 302, 316, 704, 327, C["raised"], C["border"])
    stage += rect("Sprite silhouette", 611, 404, 75, 130, C["sea"])
    stage += rect("Sprite head", 625, 372, 48, 42, C["amber"])
    stage += txt("◀   ▶    100%", 302, 667, 14, C["text"], 230, 25)
    stage += txt("FRAME 04 / 08", 878, 668, 11, C["muted"], 128, 22, weight=700)
    s += panel("Animation stage", 278, 257, 752, 464, stage)
    tools = txt("ANIMATION TOOLS", 1055, 278, 11, C["sea"], 280, 21, weight=700)
    tools += field("CHARACTER", "Mara", 1055, 322, 305)
    tools += field("ACTION", "Walk", 1055, 424, 305)
    tools += field("DIRECTION", "Left", 1055, 526, 305)
    tools += button("Import frames", 1055, 639, 305, True)
    s += panel("Animation tools", 1042, 257, 339, 464, tools)
    timeline = txt("TIMELINE", 301, 752, 11, C["sea"], 210, 20, weight=700)
    for i in range(8):
        x = 301 + i * 109
        timeline += rect(f"Frame {i + 1:02}", x, 787, 92, 82, C["raised"], C["amber"] if i == 3 else C["border"])
        timeline += txt(f"{i + 1:02}", x + 11, 803, 24, C["text"], 60, 31, True)
        timeline += txt("FRAME", x + 11, 842, 9, C["muted"], 60, 18, weight=700)
    s += panel("Frame timeline", 278, 735, 1103, 165, timeline)
    return frame("Animations / desktop", 0, 0, 1440, 900, C["bg"], s)


def components():
    s = rect("Canvas", 0, 0, 1440, 900, C["bg"])
    s += brand(64, 48)
    s += txt("DESIGN SYSTEM / V01", 64, 131, 11, C["sea"], 330, 22, weight=700)
    s += txt("A workshop after dark.", 64, 163, 46, C["text"], 860, 64, True, 600)
    s += txt("COLOR TOKENS", 64, 268, 11, C["sea"], 310, 20, weight=700)
    swatches = [("Midnight", "bg"), ("Panel", "panel"), ("Raised", "raised"), ("Border", "border"), ("Parchment", "text"), ("Muted", "muted"), ("Lantern", "amber"), ("Sea glass", "sea"), ("Warning", "red")]
    for i, (name, key) in enumerate(swatches):
        x = 64 + i * 146
        s += rect(name + " swatch", x, 302, 128, 94, C[key], C["border"])
        s += txt(name, x, 405, 13, C["text"], 136, 23, weight=600)
        s += txt(C[key], x, 429, 11, C["muted"], 136, 20)
    s += line(64, 482, 1312)
    s += txt("TYPE", 64, 513, 11, C["sea"], 200, 20, weight=700)
    s += txt("Make something wonderful.", 64, 545, 39, C["text"], 720, 54, True, 600)
    s += txt("Readable tools for long creative sessions.", 64, 603, 17, C["muted"], 620, 30)
    s += txt("CONTROLS", 785, 513, 11, C["sea"], 200, 20, weight=700)
    s += button_component("Button / Primary action", 785, 552, 260, True)
    s += button_component("Button / Secondary action", 1060, 552, 260)
    s += field_component(785, 629)
    s += txt("EDITOR STATES", 64, 726, 11, C["sea"], 200, 20, weight=700)
    s += rect("Selected row", 64, 765, 300, 57, C["raised"])
    s += rect("Selected rail", 64, 765, 3, 57, C["amber"])
    s += pixel_icon("Scenes", 84, 783, C["amber"])
    s += txt("Scenes", 116, 782, 16, C["text"], 175, 28)
    s += rect("Ready status", 393, 765, 292, 57, C["panel"], C["border"])
    s += rect("Ready dot", 411, 788, 9, 9, C["sea"])
    s += txt("Ready to play", 435, 781, 15, C["text"], 200, 26, weight=600)
    return frame("Components / desktop", 0, 0, 1440, 900, C["bg"], s)


def result_data(result):
    for item in result.get("content", []):
        if item.get("type") == "text":
            try:
                return json.loads(item["text"])
            except json.JSONDecodeError:
                return {"message": item["text"]}
    return result


def main():
    client = Client()
    pages = [("01 · Welcome", welcome), ("02 · Project", project), ("03 · Assets", assets), ("04 · Characters", characters), ("05 · Scenes", scenes), ("06 · Animations", animations), ("07 · Components", components)]
    if len(sys.argv) > 1 and sys.argv[1] in ("--resume", "--update"):
        doc = sys.argv[2]
        documents = result_data(client.tool("list_documents"))["documents"]
        document = next(item for item in documents if item["id"] == doc)
        page_ids = [item["id"] for item in document["pages"]]
        if len(page_ids) != len(pages):
            raise RuntimeError(f"Expected {len(pages)} pages, got {len(page_ids)}")
        if sys.argv[1] == "--update":
            for index, (name, build) in enumerate(pages):
                page = page_ids[index]
                root_name = name.split(" · ", 1)[-1] + " / desktop"
                matches = [item for item in result_data(client.tool("find_nodes", name=root_name, document_id=doc, page_id=page))["nodes"] if item["name"] == root_name]
                if len(matches) != 1:
                    raise RuntimeError(f"Expected one {root_name} layer on {page}")
                rendered = result_data(client.tool("render", jsx=build(), replace_id=matches[0]["id"], document_id=doc, page_id=page))
                print(name, page, "updated", rendered.get("id", "ok"))
    else:
        if OUT.exists():
            raise RuntimeError(f"Design already exists at {OUT}; open it in OpenPencil and use --update with its document ID")
        created = result_data(client.tool("new_document"))["target"]
        doc = created["documentId"]
        client.tool("update_node", id=created["pageId"], name=pages[0][0], document_id=doc, page_id=created["pageId"])
        page_ids = []
        for index, (name, build) in enumerate(pages):
            if index == 0:
                page = created["pageId"]
            else:
                page = result_data(client.tool("create_page", name=name, document_id=doc))["id"]
            page_ids.append(page)
            client.tool("switch_page", page=page, document_id=doc)
            rendered = result_data(client.tool("render", jsx=build(), document_id=doc, page_id=page))
            print(name, page, "rendered", rendered.get("created", rendered.get("id", "ok")))
    art_data = base64.b64encode(ART.read_bytes()).decode("ascii")
    for page, name in ((page_ids[0], "Moonlit ruin artwork"), (page_ids[2], "Asset preview image"), (page_ids[4], "Scene artwork")):
        matches = [item for item in result_data(client.tool("find_nodes", name=name, document_id=doc, page_id=page))["nodes"] if item["name"] == name]
        if len(matches) != 1:
            raise RuntimeError(f"Expected one {name} layer on {page}, got {len(matches)}")
        client.tool("set_image_fill", id=matches[0]["id"], image_data=art_data, scale_mode="FILL", document_id=doc, page_id=page)
    component_page = page_ids[-1]
    variables = {item["name"]: item["id"] for item in result_data(client.tool("list_variables", document_id=doc, page_id=component_page))["variables"]}
    if not variables:
        collection = result_data(client.tool("create_collection", name="PCAG Colors", document_id=doc, page_id=component_page))["id"]
        for name, value in (("Midnight", C["bg"]), ("Sidebar", C["sidebar"]), ("Panel", C["panel"]), ("Raised", C["raised"]), ("Border", C["border"]), ("Parchment", C["text"]), ("Muted", C["muted"]), ("Lantern", C["amber"]), ("Sea glass", C["sea"]), ("Warning", C["red"])):
            variables[name] = result_data(client.tool("create_variable", name=name, type="COLOR", collection_id=collection, value=value, document_id=doc, page_id=component_page))["id"]
    for name in ("Midnight", "Panel", "Raised", "Border", "Parchment", "Muted", "Lantern", "Sea glass", "Warning"):
        nodes = [item for item in result_data(client.tool("find_nodes", name=f"{name} swatch", document_id=doc, page_id=component_page))["nodes"] if item["name"] == f"{name} swatch"]
        if len(nodes) != 1:
            raise RuntimeError(f"Expected one {name} swatch")
        client.tool("bind_variable", node_id=nodes[0]["id"], field="fills/0/color", variable_id=variables[name], document_id=doc, page_id=component_page)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    print("save", result_data(client.tool("save_file", path=str(OUT), document_id=doc)))
    print("output", OUT, OUT.stat().st_size)


if __name__ == "__main__":
    main()
