import { readFile } from 'node:fs/promises';
import { parseProject } from '../packages/project-format/src/index.ts';

const path = process.argv[2] ?? 'examples/reference-adventure/project.json';
try {
  const result = parseProject(await readFile(path, 'utf8'));
  if (result.ok) {
    const room = result.project.rooms.find(candidate => candidate.id === result.project.startRoomId)!;
    console.log(JSON.stringify({ ok: true, project: result.project.name, startRoom: { id: room.id, name: room.name, width: room.width, height: room.height }, diagnostics: result.diagnostics }, null, 2));
  } else {
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
