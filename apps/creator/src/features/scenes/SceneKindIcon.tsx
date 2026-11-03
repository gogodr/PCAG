import sceneElementIcons from '../../assets/scene-element-icons.png';

export type SceneKind = 'box' | 'shape' | 'image' | 'overlay' | 'player' | 'walkable' | 'background' | 'sceneManager' | 'sceneState' | 'gameState';

const cell: Record<SceneKind, number> = {
  box: 0, shape: 1, image: 2, overlay: 3,
  player: 4, walkable: 5, background: 6, sceneManager: 7,
  sceneState: 8, gameState: 9,
};

export function SceneKindIcon({ kind }: { kind: SceneKind }) {
  const index = cell[kind];
  return <span className="scene-tree-icon scene-kind-icon" aria-hidden="true">
    <span className="scene-kind-icon-art" style={{ backgroundImage: `url(${sceneElementIcons})`, backgroundPosition: `${-(index % 4) * 30}px ${-Math.floor(index / 4) * 30}px` }} />
  </span>;
}
