const svgNamespace = 'http://www.w3.org/2000/svg';
const elements = new Set(['svg', 'g', 'defs', 'symbol', 'use', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern']);
const attributes = new Set(['id', 'version', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'd', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'patternUnits', 'patternContentUnits', 'patternTransform', 'clip-path', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'display', 'visibility', 'font-size', 'font-family', 'font-weight', 'text-anchor', 'dominant-baseline', 'xml:space']);
const styleProperties = new Set(['fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity', 'stop-color', 'stop-opacity', 'clip-path', 'display', 'visibility', 'font-size', 'font-family', 'font-weight', 'text-anchor']);
const localReference = /^url\(\s*#[A-Za-z_][A-Za-z0-9_.:-]*\s*\)$/i;

function safeValue(value: string): boolean {
  return !/javascript:|data:|https?:|\/\/|@|expression\s*\(/i.test(value)
    && (!/url\s*\(/i.test(value) || localReference.test(value));
}

function safeStyle(value: string): boolean {
  return value.split(';').every(rule => {
    if (!rule.trim()) return true;
    const separator = rule.indexOf(':');
    return separator > 0 && styleProperties.has(rule.slice(0, separator).trim()) && safeValue(rule.slice(separator + 1).trim());
  });
}

/** Accept static SVG artwork only; SVGs may later be exported as standalone files. */
export function safeSvg(bytes: Uint8Array): boolean {
  if (typeof DOMParser === 'undefined') return false;
  let source: string;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return false; }
  if (/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)/i.test(source)) return false;
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (root.localName !== 'svg' || root.namespaceURI !== svgNamespace || document.getElementsByTagName('parsererror').length) return false;
  for (const element of Array.from(document.getElementsByTagName('*'))) {
    if (element.namespaceURI !== svgNamespace || !elements.has(element.localName)) return false;
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name;
      const value = attribute.value.trim();
      if (name === 'xmlns' && element === root && value === svgNamespace) continue;
      if (name === 'xmlns:xlink' && element === root && value === 'http://www.w3.org/1999/xlink') continue;
      if ((name === 'href' || name === 'xlink:href') && /^#[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value)) continue;
      if (name === 'style' && safeStyle(value)) continue;
      if (!attributes.has(name)) return false;
      if (!safeValue(value)) return false;
    }
  }
  return true;
}
