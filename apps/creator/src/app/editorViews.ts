export const editorViews = [
  { id: 'Project', label: 'Project', icon: 'folder-open', description: 'Settings and publishing for this adventure.' },
  { id: 'Assets', label: 'Assets', icon: 'perm-media', description: 'Browse and organize the files in your project.' },
  { id: 'Characters', label: 'Characters', icon: 'groups', description: 'References, sprites, and animation assignments.' },
  { id: 'Scenes', label: 'Scenes', icon: 'landscape', description: 'Arrange locations and make them interactive.' },
  { id: 'Animations', label: 'Animations', icon: 'animation', description: 'Create and refine character motion.' },
] as const;

export type EditorView = (typeof editorViews)[number]['id'];

export function viewDescription(view: EditorView): string {
  return editorViews.find(item => item.id === view)?.description ?? '';
}
