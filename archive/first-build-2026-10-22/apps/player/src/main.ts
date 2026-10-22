import { requireProject } from '../../../packages/project-format/src/index';
import { mountPlayer } from '../../../packages/presentation/src/index';
import { validateProjectMedia } from '../../../packages/project-io/src/index';

const host = document.querySelector<HTMLElement>('#player')!;
async function start() {
  try {
    const data = import.meta.env.DEV
      ? (await import('../../../examples/foundation/project.json')).default
      : await fetch('./project.json').then(response => {
        if (!response.ok) throw new Error('The game project could not be loaded. Serve the complete exported folder over HTTP.');
        return response.json();
      });
    const project = requireProject(data);
    await validateProjectMedia(project);
    document.title = project.name;
    const player = mountPlayer(host, project);
    window.addEventListener('pagehide', () => player.dispose(), { once: true });
    import.meta.hot?.dispose(() => player.dispose());
  } catch (error) {
    host.textContent = error instanceof Error ? error.message : 'This game could not be started.';
    host.style.color = '#f8d7b8';
    host.setAttribute('role', 'alert');
  }
}
void start();
