// Keep the two original garment panels on the hip, instead of skinning them to
// separate thigh bones. The original colour IDs are preserved for palette tracks.
export function attachSkirt(source) {
  let rml = source;
  const shapeBounds = (id) => {
    const match = new RegExp(`<Shape [^>]*id="${id}"[^>]*>`).exec(rml);
    if (!match) throw new Error(`skirt: missing ${id}`);
    const tags = /<(\/?)Shape\b[^>]*?(\/?)>/g;
    tags.lastIndex = match.index;
    let depth = 0;
    for (let tag; (tag = tags.exec(rml)); ) {
      if (tag[2]) continue;
      depth += tag[1] ? -1 : 1;
      if (!depth) return [match.index, tags.lastIndex];
    }
    throw new Error(`skirt: unbalanced ${id}`);
  };
  const pants = /<Node [^>]*name="pants" id="0:635"[^>]*>/.exec(rml);
  if (!pants) throw new Error('skirt: missing hip garment node');
  // A prior run placed both panels at the beginning of this node.
  if (rml.slice(pants.index, pants.index + 400).includes('name="pant leg_right"')) return rml;
  const unskin = (shape) =>
    shape
      .replace(/<Skin\b[^>]*>[\s\S]*?<\/Skin>/g, '')
      .replace(/<(?:Weight|CubicWeight)\b[^>]*\/>/g, '')
      .replace(/<TranslationConstraint\b[^>]*\/>/g, '');
  let [start, end] = shapeBounds('0:636');
  // Its old parents were the right hip (+16,-11) and leg (-3.5,+1).
  const right = unskin(rml.slice(start, end))
    .replace('x="5.5994873" y="24.945007"', 'x="18.0994873" y="14.945007"')
    .replace(' complexDependency="true"', '');
  rml = rml.slice(0, start) + rml.slice(end);
  [start, end] = shapeBounds('0:646');
  const left = unskin(rml.slice(start, end));
  rml = rml.slice(0, start) + rml.slice(end);
  const updated = /<Node [^>]*name="pants" id="0:635"[^>]*>/.exec(rml);
  if (!updated) throw new Error('skirt: missing garment parent');
  const insert = updated.index + updated[0].length;
  // In Rive the first sibling draws in front, so the legs remain behind the skirt.
  return rml.slice(0, insert) + right + left + rml.slice(insert);
}
