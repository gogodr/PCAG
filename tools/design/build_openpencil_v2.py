"""Create the second, 16-bit-inspired PCAG design exploration in OpenPencil."""

import base64
import html
import json
import sys
from pathlib import Path

from openpencil_mcp import Client

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "docs/design/pcag-adventure-studio-v2.fig"
PREVIEWS = ROOT / "docs/design/previews-v2"
VIGNETTE = ROOT / "docs/design/assets/adventure-workbench-v2.png"
MARA = ROOT / "docs/design/assets/mara-lighthouse-keeper-v2.png"
SCENE = ROOT / "apps/creator/public/art/moonlit-ruins.png"

C = {
    "void": "#101727", "ink": "#182337", "deep": "#233650", "blue": "#34526C",
    "blue_light": "#55798B", "line": "#090F1B", "brass": "#C8954D",
    "gold": "#F1C777", "cream": "#F6E2AE", "paper": "#E9D3A2",
    "sea": "#71C5B4", "coral": "#E17D69", "muted": "#B9BFC0",
    "grass": "#578B68", "wine": "#683C4A", "well": "#111C2C",
}


def esc(value):
    return html.escape(str(value), quote=True)


def r(name, x, y, w, h, bg, stroke=None):
    border = f' stroke="{stroke}" strokeWidth={{1}}' if stroke else ""
    return f'<Rectangle name="{esc(name)}" x={{{x}}} y={{{y}}} w={{{w}}} h={{{h}}} bg="{bg}"{border} />'


def rr(name, x, y, w, h, bg, radius=8, stroke=None):
    border = f' stroke="{stroke}" strokeWidth={{1}}' if stroke else ""
    return f'<Rectangle name="{esc(name)}" x={{{x}}} y={{{y}}} w={{{w}}} h={{{h}}} rounded={{{radius}}} bg="{bg}"{border} />'


def icon(symbol, x, y, size, color):
    return f'<Icon name="material-symbols:{esc(symbol)}-rounded" x={{{x}}} y={{{y}}} size={{{size}}} color="{color}" />'


def t(value, x, y, w=300, h=28, size=14, color=None, pixel=False, weight=400):
    font = "Pixelify Sans" if pixel and size >= 16 else "IBM Plex Sans"
    return f'<Text name="{esc(str(value)[:32])}" x={{{int(x)}}} y={{{int(y)}}} w={{{int(w)}}} h={{{int(h)}}} size={{{max(size, 12)}}} font="{font}" weight={{{weight}}} color="{color or C["cream"]}">{esc(value)}</Text>'


def root(name, children):
    return f'<Frame name="{esc(name)}" x={{0}} y={{0}} w={{1440}} h={{900}} bg="{C["void"]}">{children}</Frame>'


def bevel(name, x, y, w, h, fill=None, accent=False):
    """Layered game-window trim with lit top/left and shadowed bottom/right."""
    fill = fill or C["deep"]
    s = r(name + " shadow", x + 5, y + 6, w, h, C["line"])
    s += r(name + " brass edge", x, y, w, h, C["brass"] if accent else C["blue_light"])
    s += r(name + " dark bevel", x + 3, y + 3, w - 6, h - 6, C["line"])
    s += r(name + " face", x + 6, y + 6, w - 12, h - 12, fill)
    s += r(name + " highlight", x + 7, y + 7, w - 14, 2, C["blue_light"] if not accent else C["gold"])
    s += r(name + " left glow", x + 7, y + 9, 2, h - 18, C["blue"] if not accent else C["brass"])
    s += r(name + " corner 1", x + 4, y + 4, 6, 6, C["brass"])
    s += r(name + " corner 2", x + w - 10, y + 4, 6, 6, C["brass"])
    s += r(name + " corner 3", x + 4, y + h - 10, 6, 6, C["brass"])
    s += r(name + " corner 4", x + w - 10, y + h - 10, 6, 6, C["brass"])
    # Four stepped cut corners break the rigid rectangle silhouette.
    for cx, cy in [(x, y), (x + w - 8, y), (x, y + h - 8), (x + w - 8, y + h - 8)]:
        s += r(name + " clipped corner", cx, cy, 8, 8, C["void"])
        s += r(name + " corner jewel", cx + 3, cy + 3, 3, 3, C["gold"])
    return s


def well(name, x, y, w, h):
    return r(name + " lip", x, y, w, h, C["line"]) + r(name, x + 3, y + 3, w - 6, h - 6, C["well"]) + r("Decorative inset gleam", x + 3, y + h - 5, w - 6, 2, C["blue_light"])


BUTTON_ICONS = {
    "Preview": "play-arrow", "Export": "ios-share", "Open a project": "folder-open",
    "New project": "add", "Import PCAG file": "upload-file", "Continue locally": "history",
    "Preview adventure": "play-arrow", "Export player build": "ios-share",
    "Import files": "upload-file", "Filters": "filter-list", "Sort by": "sort",
    "Use in scene": "add-photo-alternate", "Add character": "person-add",
    "Edit motion": "animation", "Add scene": "add", "+ Element": "add-circle",
    "Edit interaction": "edit", "Import frames": "upload-file",
}


def btn(label, x, y, w, primary=False, icon_hint=None, h=44):
    face = C["brass"] if primary else C["blue"]
    ink = C["void"] if primary else C["cream"]
    symbol = BUTTON_ICONS.get(label)
    s = rr(label + " shadow", x + 2, y + 4, w, h, C["line"], 9)
    inside = rr(label + " edge", 0, 0, w, h, C["gold"] if primary else C["blue_light"], 9)
    inside += rr(label + " face", 2, 2, w - 4, h - 5, face, 7)
    inside += rr(label + " soft highlight", 5, 4, w - 10, 3, C["gold"] if primary else C["sea"], 2)
    if symbol:
        inside += icon(symbol, 13, 10, 22, ink)
    inside += t(label.removeprefix("+ "), 42 if symbol else 16, 12, w - (50 if symbol else 25), 25, 14, ink, False, 700)
    return s + f'<Frame name="{esc(label)} button" x={{{x}}} y={{{y}}} w={{{w}}} h={{{h}}} rounded={{9}} bg="{face}">{inside}</Frame>'


def button_component(name, label_text, x, y, w, primary=False):
    edge = C["gold"] if primary else C["blue_light"]
    face = C["brass"] if primary else C["blue"]
    ink = C["void"] if primary else C["cream"]
    symbol = "add" if primary else "folder-open"
    return (f'<Component name="{esc(name)}" x={{{x}}} y={{{y}}} w={{{w}}} h={{44}} rounded={{9}} bg="{face}">'
            f'<Rectangle name="Border" x={{0}} y={{0}} w={{{w}}} h={{44}} rounded={{9}} bg="{edge}" />'
            f'<Rectangle name="Face" x={{2}} y={{2}} w={{{w-4}}} h={{39}} rounded={{7}} bg="{face}" />'
            f'<Rectangle name="Highlight" x={{5}} y={{4}} w={{{w-10}}} h={{3}} rounded={{2}} bg="{edge}" />'
            f'<Icon name="material-symbols:{symbol}-rounded" x={{13}} y={{10}} size={{22}} color="{ink}" />'
            f'<Text name="Label" x={{42}} y={{12}} w={{{w-54}}} h={{25}} size={{14}} font="IBM Plex Sans" weight={{700}} color="{ink}">{esc(label_text)}</Text>'
            '</Component>')


def field_component(x, y):
    return (f'<Component name="Field / Project name" x={{{x}}} y={{{y}}} w={{532}} h={{68}}>'
            f'<Text name="Field label" x={{0}} y={{0}} w={{500}} h={{22}} size={{12}} font="IBM Plex Sans" weight={{700}} color="{C["gold"]}">PROJECT NAME</Text>'
            f'<Rectangle name="Input well" x={{0}} y={{23}} w={{532}} h={{44}} bg="{C["well"]}" stroke="{C["blue_light"]}" strokeWidth={{1}} />'
            f'<Text name="Value" x={{13}} y={{34}} w={{506}} h={{26}} size={{15}} font="IBM Plex Sans" color="{C["cream"]}">Moonlit Ruins</Text>'
            '</Component>')


def selected_row_component(x, y):
    return (f'<Component name="Row / Selected scene" x={{{x}}} y={{{y}}} w={{524}} h={{59}} bg="{C["well"]}">'
            f'<Rectangle name="Inset edge" x={{0}} y={{0}} w={{524}} h={{59}} bg="{C["line"]}" />'
            f'<Rectangle name="Face" x={{3}} y={{3}} w={{518}} h={{53}} bg="{C["well"]}" />'
            f'<Rectangle name="Active rail" x={{3}} y={{3}} w={{4}} h={{53}} bg="{C["gold"]}" />'
            f'<Text name="Selected label" x={{18}} y={{19}} w={{480}} h={{28}} size={{16}} font="IBM Plex Sans" color="{C["cream"]}">The Old Lighthouse</Text>'
            '</Component>')


def label(value, x, y, w=300):
    return t(value.upper(), x, y, w, 23, 12, C["gold"], False, 700)


def field(name, value, x, y, w, h=44):
    return label(name, x, y, w) + well(name + " input", x, y + 23, w, h) + t(value, x + 13, y + 34, w - 25, 27, 15)


def medallion(x, y, letter="P", size=54):
    s = r("Brand crest outer", x, y, size, size, C["line"])
    s += r("Brand crest gold", x + 3, y + 3, size - 6, size - 6, C["gold"])
    s += r("Brand crest inset", x + 8, y + 8, size - 16, size - 16, C["blue"])
    s += t(letter, x + size * .29, y + size * .12, size * .5, size * .8, int(size * .63), C["cream"], True, 700)
    return s


NAV = [("Project", "folder-open"), ("Assets", "perm-media"), ("Characters", "groups"), ("Scenes", "landscape"), ("Animations", "animation")]


def shell(title, active, breadcrumb):
    s = r("Backdrop", 0, 0, 1440, 900, C["void"])
    # A repeating-looking tile seam keeps the large background from feeling vacant.
    for x in range(0, 1440, 80):
        s += r("Subtle horizontal tile", x, 118, 1, 782, "#1D2B3C")
    s += r("Rail shadow", 0, 0, 246, 900, C["line"])
    s += r("Rail face", 0, 0, 239, 900, C["ink"])
    s += r("Rail brass seam", 236, 0, 3, 900, C["brass"])
    s += medallion(25, 22, "P", 49)
    s += t("PCAG", 84, 24, 142, 39, 31, C["cream"], True, 700)
    s += t("ADVENTURE STUDIO", 86, 62, 142, 19, 10, C["sea"], False, 700)
    s += label("YOUR ADVENTURE", 22, 112, 190)
    s += rr("Project selector shadow", 20, 143, 202, 69, C["line"], 10)
    s += rr("Project selector", 17, 139, 202, 69, C["deep"], 10, C["brass"])
    s += t("Moonlit Ruins", 36, 158, 160, 27, 17, C["cream"], False, 700)
    s += t("CHAPTER 01", 36, 183, 140, 17, 12, C["sea"])
    s += icon("expand-more", 187, 163, 20, C["gold"])
    s += label("THE WORKBENCH", 24, 239, 183)
    for i, (name, symbol) in enumerate(NAV):
        y = 272 + i * 62
        if active == name:
            s += rr(name + " navigation shadow", 18, y + 4, 208, 53, C["line"], 10)
            s += rr(name + " navigation", 15, y, 208, 53, C["blue"], 10, C["brass"])
        else:
            s += rr(name + " navigation", 21, y + 4, 194, 47, C["deep"], 9)
        s += icon(symbol, 37, y + 13, 25, C["gold"] if active == name else C["sea"])
        s += t(name, 75, y + 15, 140, 25, 16, C["cream"] if active == name else C["muted"], False, 700 if active == name else 400)
    s += bevel("Rail footer", 17, 793, 202, 83, C["deep"])
    s += t("◆", 33, 810, 20, 21, 15, C["sea"], True)
    s += t("All changes saved", 60, 811, 146, 25, 13, C["cream"], False, 600)
    s += t("LOCAL PROJECT", 34, 841, 166, 18, 10, C["muted"], True)
    s += r("Top bar", 239, 0, 1201, 119, C["ink"])
    s += r("Top bar trim", 239, 116, 1201, 3, C["brass"])
    s += label(breadcrumb, 275, 17, 630)
    s += t(title, 274, 39, 610, 62, 42, C["cream"], True, 600)
    s += btn("Preview", 1112, 39, 145, True, "▸")
    s += btn("Export", 1271, 39, 132, False, "↗")
    return s


def section_title(kicker, title, x, y, w):
    return label(kicker, x, y, w) + t(title, x, y + 25, w, 40, 26, C["cream"], True, 600)


def scene_thumb(name, x, y, w, h, selected=False):
    s = bevel(name + " thumbnail", x, y, w, h, C["well"], selected)
    s += r(name + " art", x + 10, y + 10, w - 20, h - 47, C["blue"])
    if name not in ("Moonlit Ruins", "Old Lighthouse"):
        s += r(name + " land 1", x + 10, y + h - 76, w - 20, 24, C["grass"])
        s += r(name + " land 2", x + 10, y + h - 57, w - 20, 13, C["ink"])
        s += r(name + " moon", x + w - 58, y + 25, 24, 24, C["gold"])
    s += t(name, x + 12, y + h - 32, w - 24, 25, 13, C["cream"], False, 700)
    return s


def welcome():
    s = r("Night sky", 0, 0, 1440, 900, C["void"])
    for x, y in [(724, 72), (1038, 59), (1194, 119), (1363, 42), (748, 481), (1267, 518)]:
        s += r("Pixel star", x, y, 4, 4, C["gold"])
    s += medallion(54, 37, "P", 56)
    s += t("PCAG", 125, 38, 220, 48, 42, C["cream"], True, 700)
    s += label("ADVENTURE STUDIO", 128, 79, 230)
    s += btn("Open a project", 1199, 51, 186)
    s += label("THE STORY STARTS HERE", 63, 164, 500)
    s += t("Make worlds", 59, 202, 665, 76, 64, C["cream"], True, 600)
    s += t("worth exploring.", 59, 272, 665, 76, 64, C["gold"], True, 600)
    s += t("Build a point-and-click adventure, one curious detail at a time.", 64, 381, 557, 54, 19, C["muted"])
    s += bevel("New adventure feature", 52, 468, 583, 118, C["deep"], True)
    s += t("01", 73, 487, 63, 47, 37, C["gold"], True)
    s += t("CREATE AN ADVENTURE", 136, 486, 417, 25, 14, C["gold"], True, 700)
    s += t("Scene  •  Character  •  Mystery", 136, 522, 260, 28, 14)
    s += btn("New project", 402, 530, 211, True, "+")
    s += btn("Import PCAG file", 58, 611, 278, False, "↓")
    s += btn("Continue locally", 356, 611, 277, False, "▸")
    s += label("RECENT ADVENTURES", 60, 706, 300)
    s += scene_thumb("Moonlit Ruins", 56, 735, 279, 127, True)
    s += scene_thumb("The Clockwork Isle", 355, 735, 279, 127)
    s += bevel("Illustration stage", 679, 157, 704, 699, C["deep"])
    s += r("Illustration inset", 693, 171, 676, 618, C["well"])
    s += r("Adventure workbench art", 708, 178, 645, 607, C["well"])
    s += r("Illustration caption plate", 693, 788, 676, 54, C["ink"])
    s += label("THE ADVENTURE WORKBENCH", 717, 802, 387)
    s += t("Scenes • Stories • Secrets", 1132, 802, 220, 24, 12, C["muted"])
    return root("Welcome / V2", s)


def project():
    s = shell("Project", "Project", "WORKBENCH / GAME SETUP")
    s += bevel("Project overview", 269, 143, 730, 311)
    s += section_title("THE ADVENTURE", "Moonlit Ruins", 292, 165, 470)
    s += t("A mystery among the drowned stones", 293, 230, 486, 26, 16, C["muted"])
    for i, (value, caption) in enumerate([("05", "SCENES"), ("03", "CHARACTERS"), ("24", "ASSETS"), ("08", "ANIMATIONS")]):
        x = 290 + i * 172
        s += well(caption + " metric", x, 302, 157, 112)
        s += t(value, x + 17, 315, 100, 46, 35, C["gold"], True)
        s += label(caption, x + 17, 367, 125)
    s += bevel("Settings", 269, 475, 730, 384)
    s += section_title("01 / WORLD SETTINGS", "Game details", 292, 498, 500)
    s += field("Project name", "Moonlit Ruins", 292, 577, 445)
    s += field("Canvas width", "1280 px", 292, 671, 212)
    s += field("Canvas height", "720 px", 524, 671, 212)
    s += field("Opening scene", "The Old Lighthouse", 292, 765, 445)
    s += bevel("Project preview", 1019, 143, 388, 433)
    s += label("COVER ART", 1040, 165, 270)
    s += r("Project scene artwork", 1040, 195, 346, 251, C["well"])
    s += t("THE OLD LIGHTHOUSE", 1041, 465, 310, 27, 15, C["cream"], True)
    s += t("Your opening scene", 1041, 499, 300, 21, 13, C["muted"])
    s += bevel("Publishing", 1019, 597, 388, 262, C["deep"], True)
    s += section_title("02 / SHIP IT", "Ready to play", 1042, 618, 300)
    s += btn("Preview adventure", 1042, 715, 341, True, "▸")
    s += btn("Export player build", 1042, 782, 341)
    return root("Project / V2", s)


def assets():
    s = shell("Assets", "Assets", "WORKBENCH / INVENTORY")
    s += bevel("Asset library", 269, 143, 1138, 716)
    s += section_title("YOUR INVENTORY", "Art, audio & everything else", 291, 166, 680)
    s += btn("Import files", 1211, 175, 172, True, "+")
    s += well("Asset search", 291, 256, 693, 48)
    s += t("Search 24 project assets...", 309, 269, 460, 25, 15, C["muted"])
    s += btn("Filters", 1005, 256, 167)
    s += btn("Sort by", 1184, 256, 198)
    for i, (name, count) in enumerate([("All files", "24"), ("Backgrounds", "05"), ("Characters", "08"), ("Objects", "07"), ("Audio", "04")]):
        y = 337 + 70 * i
        if i == 1:
            s += bevel(name + " category", 289, y, 215, 57, C["blue"], True)
        else:
            s += r(name + " category", 295, y + 4, 203, 48, C["deep"])
        s += t("▣", 311, y + 12, 25, 24, 18, C["gold"], True)
        s += t(name, 341, y + 15, 125, 25, 14, C["cream"])
        s += t(count, 465, y + 15, 27, 22, 12, C["sea"], True)
    s += label("BACKGROUNDS / 05", 534, 338, 400)
    for i, name in enumerate(["Old Lighthouse", "Harbor at Dawn", "Forest Path", "Ruined Gate"]):
        x = 532 + (i % 2) * 267
        y = 379 + (i // 2) * 205
        s += scene_thumb(name, x, y, 251, 180, i == 0)
    s += bevel("Selected asset", 1086, 333, 297, 494, C["ink"])
    s += label("SELECTED", 1104, 352, 220)
    s += r("Selected asset artwork", 1104, 383, 259, 175, C["well"])
    s += t("lighthouse-night.png", 1104, 585, 259, 28, 16, C["cream"], False, 700)
    s += t("PNG  •  1280 × 720", 1104, 621, 239, 25, 12, C["sea"], True)
    s += t("Art / Backgrounds", 1104, 656, 239, 25, 13, C["muted"])
    s += btn("Use in scene", 1104, 751, 259, True, "▸")
    return root("Assets / V2", s)


def characters():
    s = shell("Characters", "Characters", "WORKBENCH / CAST")
    s += bevel("Roster", 269, 143, 336, 716)
    s += section_title("THE CAST", "Characters", 291, 165, 270)
    for i, (name, role, shade) in enumerate([("Mara", "Lighthouse keeper", C["coral"]), ("Ferryman", "A voice on the water", C["sea"]), ("Iris", "The lost cartographer", C["gold"])]):
        y = 267 + i * 125
        s += bevel(name + " roster card", 289, y, 294, 105, C["blue"] if i == 0 else C["deep"], i == 0)
        s += r(name + " portrait", 301, y + 14, 73, 73, C["well"])
        s += r(name + " portrait halo", 317, y + 24, 42, 42, shade)
        s += t(name, 391, y + 22, 177, 27, 18, C["cream"], True)
        s += t(role, 391, y + 56, 177, 24, 12, C["muted"])
    s += btn("Add character", 291, 775, 291, True, "+")
    s += bevel("Character sheet", 626, 143, 558, 716)
    s += section_title("01 / CHARACTER SHEET", "Mara", 649, 165, 440)
    s += t("The lighthouse keeper", 649, 226, 380, 29, 16, C["muted"])
    s += well("Sprite stage", 649, 281, 510, 320)
    s += r("Character backdrop", 659, 291, 490, 300, C["deep"])
    s += r("Mara character art", 772, 305, 269, 270, C["deep"])
    s += label("SPRITE SHEET / IDLE", 665, 568, 320)
    s += field("Display name", "Mara", 649, 637, 510)
    s += field("Reference image", "mara-reference.png", 649, 732, 510)
    s += bevel("Animation assignment", 1204, 143, 203, 716)
    s += label("ANIMATIONS", 1221, 165, 173)
    s += t("2 of 4 ready", 1221, 205, 163, 29, 17, C["cream"], True)
    for i, (name, ready) in enumerate([("Idle", True), ("Walk", True), ("Talk", False), ("Interact", False)]):
        y = 268 + i * 89
        s += well(name + " slot", 1221, y, 163, 70)
        s += t("◆" if ready else "+", 1236, y + 15, 32, 32, 20, C["sea"] if ready else C["gold"], True)
        s += t(name, 1271, y + 21, 102, 26, 14)
    s += btn("Edit motion", 1221, 775, 163, True)
    return root("Characters / V2", s)


def scenes():
    s = shell("Scenes", "Scenes", "WORKBENCH / WORLD MAP")
    s += bevel("Scene list", 269, 143, 231, 716)
    s += label("LOCATIONS / 05", 289, 164, 190)
    for i, name in enumerate(["Old Lighthouse", "Harbor", "Forest Path", "Ruined Gate"]):
        y = 202 + i * 132
        s += scene_thumb(name, 286, y, 196, 116, i == 0)
    s += btn("Add scene", 287, 785, 192, True, "+")
    s += bevel("Scene workspace", 520, 143, 612, 716)
    s += label("OLD LIGHTHOUSE / 1280 × 720", 541, 164, 395)
    s += t("01: Old Lighthouse", 541, 192, 414, 34, 25, C["cream"], True)
    s += btn("+ Element", 983, 181, 130)
    s += well("Scene canvas", 540, 242, 572, 430)
    s += r("Scene artwork", 550, 252, 552, 410, C["deep"])
    s += r("Selected element outline top", 835, 409, 84, 3, C["gold"])
    s += r("Selected element outline left", 835, 409, 3, 117, C["gold"])
    s += r("Selected element outline right", 916, 409, 3, 117, C["gold"])
    s += r("Selected element outline bottom", 835, 523, 84, 3, C["gold"])
    s += t("DOOR", 842, 385, 100, 25, 12, C["gold"], True)
    s += label("ZOOM 100%   •   GRID OFF", 543, 691, 340)
    s += bevel("Scene layer stack", 540, 736, 572, 100, C["ink"])
    s += t("Background", 555, 769, 116, 26, 13)
    s += t("Door element", 678, 769, 125, 26, 13, C["gold"])
    s += t("Lantern", 820, 769, 87, 26, 13)
    s += t("Dock exit", 921, 769, 88, 26, 13)
    s += bevel("Element inspector", 1152, 143, 255, 716)
    s += label("INSPECTOR / ELEMENT", 1172, 164, 213)
    s += t("Old door", 1172, 201, 205, 34, 24, C["cream"], True)
    s += t("◆  INTERACTIVE", 1172, 244, 199, 25, 12, C["sea"], True)
    s += field("Name", "Old door", 1171, 293, 212)
    s += field("Position X / Y", "640 / 365", 1171, 388, 212)
    s += field("Size W / H", "180 / 245", 1171, 483, 212)
    s += label("ON INSPECT", 1171, 600, 200)
    s += well("Inspect text", 1171, 629, 212, 92)
    s += t("The door is locked...", 1182, 646, 184, 52, 14)
    s += btn("Edit interaction", 1171, 766, 212, True)
    return root("Scenes / V2", s)


def animations():
    s = shell("Animations", "Animations", "WORKBENCH / MOTION")
    s += bevel("Animation stage", 269, 143, 858, 507)
    s += section_title("MARA / WALK / LEFT", "Walk cycle", 291, 166, 465)
    s += t("8 frames  •  12 FPS  •  Looping", 292, 230, 465, 25, 13, C["sea"])
    s += well("Sprite preview", 292, 274, 812, 333)
    for yy in range(284, 596, 52):
        for xx in range(302, 1093, 52):
            s += r("Preview checker", xx, yy, 52, 52, C["blue"] if (xx + yy) // 52 % 2 else C["deep"])
    s += r("Mara animation art", 577, 300, 244, 288, C["deep"])
    s += t("Prev       Play       Next", 308, 618, 290, 30, 15, C["cream"])
    s += label("FRAME 04 / 08", 950, 620, 150)
    s += bevel("Animation controls", 1148, 143, 259, 507)
    s += label("MOTION SETTINGS", 1168, 166, 216)
    s += field("Character", "Mara", 1168, 215, 215)
    s += field("Action", "Walk", 1168, 312, 215)
    s += field("Direction", "Left", 1168, 409, 215)
    s += field("Frame rate", "12 FPS", 1168, 506, 215)
    s += bevel("Timeline", 269, 670, 1138, 189)
    s += label("FRAME STRIP / WALK LEFT", 290, 689, 440)
    s += btn("Import frames", 1207, 691, 176, True, "+")
    for i in range(8):
        x = 291 + i * 133
        s += bevel(f"Frame {i+1:02}", x, 746, 119, 89, C["blue"] if i == 3 else C["deep"], i == 3)
        s += t(f"{i+1:02}", x + 15, 765, 73, 38, 28, C["gold"] if i == 3 else C["cream"], True)
        s += label("FRAME", x + 63, 794, 50)
    return root("Animations / V2", s)


def components():
    s = r("Components backdrop", 0, 0, 1440, 900, C["void"])
    s += medallion(54, 41, "P", 59)
    s += t("PCAG / THE ADVENTURE WORKBENCH", 137, 51, 900, 48, 40, C["cream"], True)
    s += label("DESIGN SYSTEM / V02", 59, 119, 330)
    s += bevel("Palette specimen", 54, 170, 1332, 225)
    s += section_title("COLOR RAMPS", "A brighter world after dark", 76, 193, 740)
    colors = [("VOID", "void"), ("INK", "ink"), ("OCEAN", "blue"), ("BRASS", "brass"), ("LANTERN", "gold"), ("PARCHMENT", "cream"), ("SEA GLASS", "sea"), ("CORAL", "coral")]
    for i, (name, key) in enumerate(colors):
        x = 76 + i * 160
        s += r(name + " swatch", x, 286, 143, 49, C[key], C["line"])
        s += label(name, x, 347, 148)
    s += bevel("Control specimen", 54, 416, 772, 430)
    s += section_title("CONTROLS", "A tool that feels like a game", 76, 440, 700)
    s += button_component("Button / Primary", "Create adventure", 77, 532, 291, True)
    s += button_component("Button / Secondary", "Open project", 386, 532, 266)
    s += field_component(77, 624)
    s += selected_row_component(77, 751)
    s += bevel("Texture specimen", 847, 416, 539, 430)
    s += section_title("ART DIRECTION", "Layered, never empty", 869, 440, 470)
    s += r("Artwork crop", 870, 519, 494, 243, C["well"])
    s += label("TILE CLUSTERS  /  INSET WELLS  /  BRASS TRIM", 872, 783, 490)
    return root("Components / V2", s)


def data(response):
    return json.loads(response["content"][0]["text"])


def image_fill(client, doc, page, name, path, mode="FILL"):
    matches = [n for n in data(client.tool("find_nodes", name=name, document_id=doc, page_id=page))["nodes"] if n["name"] == name]
    if len(matches) != 1:
        raise RuntimeError(f"Expected one image layer named {name}; found {len(matches)}")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    client.tool("set_image_fill", id=matches[0]["id"], image_data=encoded, scale_mode=mode, document_id=doc, page_id=page)


def main():
    resume = len(sys.argv) > 1 and sys.argv[1] in ("--resume", "--update")
    update = len(sys.argv) > 1 and sys.argv[1] == "--update"
    if OUT.exists() and not resume:
        raise RuntimeError(f"Design already exists: {OUT}")
    pages = [("01 · Welcome", welcome), ("02 · Project", project), ("03 · Assets", assets), ("04 · Characters", characters), ("05 · Scenes", scenes), ("06 · Animations", animations), ("07 · Components", components)]
    client = Client()
    if resume:
        doc = sys.argv[2]
        document = next(d for d in data(client.tool("list_documents"))["documents"] if d["id"] == doc)
        page_ids = [page["id"] for page in document["pages"]]
        if update:
            for (name, build), page in zip(pages, page_ids):
                root_name = name.split(" · ")[1] + " / V2"
                matches = [n for n in data(client.tool("find_nodes", name=root_name, document_id=doc, page_id=page))["nodes"] if n["name"] == root_name]
                if len(matches) != 1:
                    raise RuntimeError(f"Expected one root {root_name}")
                client.tool("render", jsx=build(), replace_id=matches[0]["id"], document_id=doc, page_id=page)
                print(name, "updated", flush=True)
    else:
        created = data(client.tool("new_document"))["target"]
        doc = created["documentId"]
        page_ids = []
        for index, (name, build) in enumerate(pages):
            page = created["pageId"] if index == 0 else data(client.tool("create_page", name=name, document_id=doc))["id"]
            if index == 0:
                client.tool("update_node", id=page, name=name, document_id=doc, page_id=page)
            page_ids.append(page)
            client.tool("switch_page", page=page, document_id=doc)
            rendered = data(client.tool("render", jsx=build(), document_id=doc, page_id=page))
            print(name, page, "rendered", rendered.get("created", "ok"), flush=True)
    if not resume or update:
        image_fill(client, doc, page_ids[0], "Adventure workbench art", VIGNETTE)
        image_fill(client, doc, page_ids[0], "Moonlit Ruins art", SCENE)
        for index, name in [(1, "Project scene artwork"), (2, "Selected asset artwork"), (4, "Scene artwork")]:
            image_fill(client, doc, page_ids[index], name, SCENE)
        image_fill(client, doc, page_ids[2], "Old Lighthouse art", SCENE)
        image_fill(client, doc, page_ids[4], "Old Lighthouse art", SCENE)
        image_fill(client, doc, page_ids[3], "Mara character art", MARA, "FIT")
        image_fill(client, doc, page_ids[5], "Mara animation art", MARA, "FIT")
        image_fill(client, doc, page_ids[6], "Artwork crop", VIGNETTE)
    component_page = page_ids[6]
    existing = data(client.tool("list_variables", document_id=doc, page_id=component_page))["variables"]
    variables = {item["name"]: item["id"] for item in existing}
    if not variables:
        collection = data(client.tool("create_collection", name="Adventure Workbench Colors", document_id=doc, page_id=component_page))["id"]
        for name, key in [("Void", "void"), ("Ink", "ink"), ("Ocean", "blue"), ("Brass", "brass"), ("Lantern", "gold"), ("Parchment", "cream"), ("Sea glass", "sea"), ("Coral", "coral")]:
            variables[name] = data(client.tool("create_variable", name=name, type="COLOR", collection_id=collection, value=C[key], document_id=doc, page_id=component_page))["id"]
    for name in ("Void", "Ink", "Ocean", "Brass", "Lantern", "Parchment", "Sea glass", "Coral"):
        nodes = [n for n in data(client.tool("find_nodes", name=name.upper() + " swatch", document_id=doc, page_id=component_page))["nodes"] if n["name"] == name.upper() + " swatch"]
        if len(nodes) == 1:
            client.tool("bind_variable", node_id=nodes[0]["id"], field="fills/0/color", variable_id=variables[name], document_id=doc, page_id=component_page)
    PREVIEWS.mkdir(parents=True, exist_ok=True)
    client.request("activate_document", {"document_id": doc})
    for (name, _), page in zip(pages, page_ids):
        client.tool("switch_page", page=page, document_id=doc)
        lint = data(client.tool("lint", document_id=doc, page_id=page))
        errors = lint.get("errors", 0)
        warnings = lint.get("warnings", 0)
        print(name, "lint", errors if isinstance(errors, int) else len(errors), warnings if isinstance(warnings, int) else len(warnings), flush=True)
        nodes = data(client.tool("find_nodes", name=name.split(" · ")[1] + " / V2", document_id=doc, page_id=page))["nodes"]
        target = next(n for n in nodes if n["name"] == name.split(" · ")[1] + " / V2")
        export = data(client.tool("export_image", ids=[target["id"]], maxEdge=1440, document_id=doc, page_id=page))
        if "base64" not in export:
            raise RuntimeError(f"OpenPencil export failed on {name} target={target}: {str(export)[:1000]}")
        (PREVIEWS / (name.split(" · ")[1].lower() + ".png")).write_bytes(base64.b64decode(export["base64"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    print("save", data(client.tool("save_file", path=str(OUT), document_id=doc)), flush=True)
    print("document", doc, "output", OUT, OUT.stat().st_size, flush=True)


if __name__ == "__main__":
    main()
