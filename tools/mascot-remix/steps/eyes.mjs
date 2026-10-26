// Pupil targets must live beside their own eye centres. Head-space targets stay behind when
// the face turns, making a positive gaze look in the opposite direction inside the eye.
export function addEyeTargets(source) {
  let rml = source.replace(
    /<!-- tavi:begin pupil-(?:offset|left-offset|right-offset) -->[\s\S]*?<!-- tavi:end pupil-(?:offset|left-offset|right-offset) -->/g,
    '',
  );
  const opening = (id) => {
    const match = new RegExp(`<([A-Za-z]+)\\b[^>]*\\bid="${id}"[^>]*>`).exec(rml);
    if (!match) throw new Error('pupil targets: missing component ' + id);
    return match;
  };
  const attr = (id, key) =>
    Number(new RegExp(`\\b${key}="([^"]*)"`).exec(opening(id)[0])?.[1] ?? 0);
  const insert = (id, content) => {
    const tag = opening(id);
    const index = tag.index + tag[0].length;
    rml = rml.slice(0, index) + content + rml.slice(index);
  };
  const block = (name, content) =>
    `<!-- tavi:begin pupil-${name} -->${content}<!-- tavi:end pupil-${name} -->`;
  const copy = (target, name, id) =>
    `<TranslationConstraint targetId="${target}" sourceSpaceValue="local" destSpaceValue="local" offset="true" name="${name}" id="${id}"/>`;
  // Retain the old control and all its expression keys. Subtract its setup translation to
  // produce a zero-rest local displacement, independent of head/face/world transforms.
  const x = -attr('0:1265', 'x'),
    y = -attr('0:1265', 'y');
  insert(
    '0:437',
    block(
      'offset',
      `<Node x="${x}" y="${y}" name="tavi/pupil-offset" id="8:100">${copy('0:1265', 'local pupil offset', '8:101')}</Node>`,
    ),
  );
  for (const [side, target, centre, group, id] of [
    ['left', '0:830', '0:819', '0:487', '8:102'],
    ['right', '0:836', '0:1268', '0:517', '8:103'],
  ]) {
    const tag = opening(target);
    const end = tag[0].endsWith('/>')
      ? tag.index + tag[0].length
      : rml.indexOf(`</${tag[1]}>`, tag.index) + tag[1].length + 3;
    let element = rml.slice(tag.index, end);
    for (const key of ['x', 'y'])
      element = element.replace(new RegExp(`\\b${key}="[^"]*"`), `${key}="${attr(centre, key)}"`);
    element = element.replace(
      /^(<[^>]+>)/,
      `$1${block(`${side}-offset`, copy('8:100', 'eye-local pupil target', id))}`,
    );
    rml = rml.slice(0, tag.index) + rml.slice(end);
    insert(group, element);
  }
  return rml;
}
