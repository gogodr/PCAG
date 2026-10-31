const $ = (id) => document.getElementById(id);
const elements = {
  animation: $("animation"), title: $("animation-title"), preview: $("preview"),
  stageInfo: $("stage-info"), scrub: $("scrub"), play: $("play"),
  position: $("playback-position"), frames: $("frames"), count: $("frame-count"),
  duration: $("duration"), selected: $("selected-index"), selectedTime: $("selected-time"),
  targetFps: $("target-fps"), reduce: $("reduce"), removeFrame: $("remove-frame"),
  background: $("background"), backgroundNote: $("background-note"),
  undo: $("undo"), redo: $("redo"), width: $("width"), height: $("height"),
  exportGif: $("export-gif"), exportAtlas: $("export-atlas"), message: $("message"),
};

let catalog = [];
let current = null;
let edit = null;
let undoStack = [];
let redoStack = [];
let selectedPosition = 0;
let playing = false;
let ticker = null;

function clone(value) { return structuredClone(value); }
function frameUrl(index) {
  return `/api/frame/${encodeURIComponent(current.id)}/${index}?bg=${edit.removeBg ? 1 : 0}`;
}
function say(message, error = false, links = []) {
  elements.message.replaceChildren(document.createTextNode(message));
  elements.message.classList.toggle("error", error);
  for (const [label, url] of links) {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    elements.message.append(link);
  }
}
function change(next) {
  playing = false;
  undoStack.push(clone(edit));
  redoStack = [];
  edit = next;
  selectedPosition = Math.min(selectedPosition, edit.frames.length - 1);
  render();
}
function undo() {
  if (!undoStack.length) return;
  playing = false;
  redoStack.push(clone(edit));
  edit = undoStack.pop();
  selectedPosition = Math.min(selectedPosition, edit.frames.length - 1);
  render();
}
function redo() {
  if (!redoStack.length) return;
  playing = false;
  undoStack.push(clone(edit));
  edit = redoStack.pop();
  selectedPosition = Math.min(selectedPosition, edit.frames.length - 1);
  render();
}
function setPlayback() {
  clearInterval(ticker);
  ticker = null;
  elements.play.textContent = playing ? "Ⅱ" : "▶";
  elements.play.setAttribute("aria-label", playing ? "Pause animation" : "Play animation");
  if (playing && edit?.frames.length > 1) {
    ticker = setInterval(() => {
      selectedPosition = (selectedPosition + 1) % edit.frames.length;
      updatePreview();
    }, 1000 / edit.fps);
  }
}
function updatePreview() {
  if (!edit?.frames.length) return;
  const sourceIndex = edit.frames[selectedPosition];
  elements.preview.src = frameUrl(sourceIndex);
  elements.preview.alt = `Frame ${sourceIndex} of ${current.label}`;
  elements.scrub.value = String(selectedPosition);
  elements.position.textContent = `${selectedPosition + 1} / ${edit.frames.length}`;
  elements.selected.textContent = `Frame ${String(sourceIndex).padStart(3, "0")}`;
  elements.selectedTime.textContent = `${(selectedPosition / edit.fps).toFixed(2)} s in edit`;
  [...elements.frames.children].forEach((node, index) => {
    node.classList.toggle("selected", index === selectedPosition);
  });
}
function render() {
  if (!edit) return;
  elements.title.textContent = current.label;
  elements.stageInfo.textContent = `${current.width} × ${current.height} SOURCE · ${current.sourceFps} FPS`;
  elements.count.textContent = `(${edit.frames.length} frames)`;
  elements.duration.textContent = `${(edit.frames.length / edit.fps).toFixed(2)} s · ${edit.fps} fps`;
  elements.scrub.max = String(edit.frames.length - 1);
  elements.targetFps.value = String(edit.fps === current.sourceFps ? 6 : edit.fps);
  elements.undo.disabled = !undoStack.length;
  elements.redo.disabled = !redoStack.length;
  elements.removeFrame.disabled = edit.frames.length <= 1;
  elements.reduce.disabled = edit.frames.length <= 1;
  elements.background.textContent = edit.removeBg ? "Restore background" : "Remove background";
  elements.backgroundNote.textContent = edit.removeBg
    ? "Flat backdrop is removed in the preview and exports."
    : "Flat video backdrop is visible.";
  elements.frames.replaceChildren();
  edit.frames.forEach((sourceIndex, position) => {
    const item = document.createElement("button");
    item.className = "frame";
    item.type = "button";
    item.title = `Select source frame ${sourceIndex}`;
    const image = document.createElement("img");
    image.src = frameUrl(sourceIndex);
    image.alt = "";
    image.loading = "lazy";
    const label = document.createElement("span");
    label.textContent = `#${String(sourceIndex).padStart(3, "0")}`;
    item.append(image, label);
    item.addEventListener("click", () => {
      playing = false;
      setPlayback();
      selectedPosition = position;
      updatePreview();
    });
    elements.frames.append(item);
  });
  updatePreview();
  setPlayback();
}
function loadAnimation(id) {
  current = catalog.find((item) => item.id === id);
  if (!current) return;
  edit = {frames: [...current.frames], fps: current.sourceFps, removeBg: false};
  undoStack = [];
  redoStack = [];
  selectedPosition = 0;
  playing = false;
  say("Loaded extracted source loop. Changes are kept in this browser session until export.");
  render();
}
function reduce() {
  const target = Number(elements.targetFps.value);
  if (!Number.isInteger(target) || target < 1 || target > 60) {
    say("Enter a target FPS from 1 to 60.", true);
    return;
  }
  if (target >= edit.fps) {
    say("Choose an FPS below the current playback rate to remove frames.", true);
    return;
  }
  const desired = Math.max(2, Math.min(edit.frames.length,
    Math.round(edit.frames.length * target / edit.fps)));
  const positions = [...new Set(Array.from({length: desired}, (_, i) =>
    Math.round(i * (edit.frames.length - 1) / (desired - 1))))];
  const frames = positions.map((position) => edit.frames[position]);
  change({...edit, frames, fps: target});
  say(`Reduced to ${frames.length} frames at ${target} fps.`);
}
async function exportFile(kind) {
  const width = Number(elements.width.value);
  const height = Number(elements.height.value);
  if (![width, height].every((n) => Number.isInteger(n) && n >= 1 && n <= 1024)) {
    say("Enter whole-number frame dimensions from 1 to 1024.", true);
    return;
  }
  elements.exportGif.disabled = true;
  elements.exportAtlas.disabled = true;
  say(`Exporting ${kind}…`);
  try {
    const response = await fetch("/api/export", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        animation: current.id, kind, frames: edit.frames, fps: edit.fps,
        removeBg: edit.removeBg, width, height,
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Export failed");
    say(`Saved to ${result.folder}`, false,
      [["Open file", result.download], ["Metadata", result.metadata]]);
  } catch (error) {
    say(error.message || "Export failed", true);
  } finally {
    elements.exportGif.disabled = false;
    elements.exportAtlas.disabled = false;
  }
}

elements.animation.addEventListener("change", () => loadAnimation(elements.animation.value));
elements.play.addEventListener("click", () => { playing = !playing; setPlayback(); });
elements.scrub.addEventListener("input", () => {
  playing = false;
  setPlayback();
  selectedPosition = Number(elements.scrub.value);
  updatePreview();
});
elements.reduce.addEventListener("click", reduce);
elements.removeFrame.addEventListener("click", () => {
  if (edit.frames.length <= 1) return;
  const removed = edit.frames[selectedPosition];
  change({...edit, frames: edit.frames.filter((_, index) => index !== selectedPosition)});
  say(`Removed source frame ${removed} from this edit.`);
});
elements.background.addEventListener("click", () => {
  change({...edit, removeBg: !edit.removeBg});
  say(edit.removeBg ? "Background removed." : "Background restored.");
});
elements.undo.addEventListener("click", undo);
elements.redo.addEventListener("click", redo);
elements.exportGif.addEventListener("click", () => exportFile("gif"));
elements.exportAtlas.addEventListener("click", () => exportFile("atlas"));
document.addEventListener("keydown", (event) => {
  const typing = ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName);
  if (typing) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
  } else if (event.key === "Delete") {
    event.preventDefault();
    elements.removeFrame.click();
  } else if (event.code === "Space") {
    event.preventDefault();
    elements.play.click();
  }
});

fetch("/api/animations").then(async (response) => {
  if (!response.ok) throw new Error("Could not load extracted loops");
  catalog = await response.json();
  if (!catalog.length) throw new Error("No first_loop folders found under generated/minimax-h3");
  catalog.sort((a, b) => a.label.localeCompare(b.label));
  for (const item of catalog) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    elements.animation.append(option);
  }
  loadAnimation(catalog[0].id);
}).catch((error) => say(error.message, true));
