import { useEffect, useMemo, useState } from 'react';
import type { WorkspaceFile } from '../../../../../packages/editor-workspace/src/index';
import { animationAtlasFromDataUrl } from '../../../../../packages/animation-atlas/src/index';
import type { ElementMedia } from '../../../../../packages/project-format/src/index';
import { UiIcon } from '../../components/UiIcon';

interface Props { media: ElementMedia; files: WorkspaceFile[] }

export function ElementMediaPreview({ media, files }: Props) {
  const source = files.find(file => file.path === media.path)?.dataUrl;
  const atlas = useMemo(() => media.kind === 'animation' ? animationAtlasFromDataUrl(source) : null, [media.kind, source]);
  const atlasPath = atlas && `${media.path.slice(0, media.path.lastIndexOf('/'))}/${atlas.image}`;
  const atlasImage = atlasPath ? files.find(file => file.path === atlasPath)?.dataUrl : undefined;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [run, setRun] = useState(0);
  const first = atlas && (media.reverse ? atlas.frames.length - 1 : 0);

  useEffect(() => {
    setPlaying(false);
    setFrame(first ?? 0);
  }, [atlas, atlasImage, first, media.loop, media.reverse]);

  useEffect(() => {
    if (!playing || !atlas || !atlasImage || first === null) return;
    if (atlas.frames.length < 2) {
      if (!media.loop) setPlaying(false);
      return;
    }
    let current = first;
    const timer = window.setInterval(() => {
      const next = current + (media.reverse ? -1 : 1);
      current = next < 0 || next >= atlas.frames.length ? first : next;
      setFrame(current);
      if (!media.loop && current === (media.reverse ? 0 : atlas.frames.length - 1)) {
        window.clearInterval(timer);
        setPlaying(false);
      }
    }, 1000 / atlas.fps);
    return () => window.clearInterval(timer);
  }, [atlas, atlasImage, first, media.loop, media.reverse, playing, run]);

  if (!media.path) return null;
  const available = media.kind === 'image' ? !!source : !!atlas && !!atlasImage;
  const scale = atlas ? Math.min(2, 320 / atlas.frameWidth, 220 / atlas.frameHeight) : 1;
  const play = () => {
    setFrame(first ?? 0);
    setRun(value => value + 1);
    setPlaying(true);
  };
  const stop = () => {
    setPlaying(false);
    setFrame(first ?? 0);
  };

  return <section className="element-inspector-group element-media-preview" aria-label="Element media preview">
    <div className="element-media-preview-heading"><h4>Preview</h4>{media.kind === 'animation' && available && <div className="element-media-preview-actions" role="group" aria-label="Animation preview controls"><button type="button" aria-label="Play preview" title="Play preview" onClick={play}><UiIcon name="play-arrow" /></button><button type="button" aria-label="Stop preview" title="Stop preview" onClick={stop}><UiIcon name="stop" /></button></div>}</div>
    <div className="element-media-preview-frame">
      {!available ? <span>Selected {media.kind} file is unavailable.</span>
        : media.kind === 'image' ? <img src={source} alt="Selected element image preview" />
          : atlas && <div role="img" aria-label="Selected element animation preview" className="element-media-preview-sprite" data-frame={frame} style={{ width: atlas.frameWidth * scale, height: atlas.frameHeight * scale, backgroundImage: `url(${atlasImage})`, backgroundSize: `${atlas.frames.length * 100}% 100%`, backgroundPosition: `${atlas.frames.length === 1 ? 0 : frame / (atlas.frames.length - 1) * 100}% 0%` }} />}
    </div>
  </section>;
}
