import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { LandingPage } from '../src/LandingPage';
import { sceneLayoutRect } from '../src/landing/sceneLayout';

it('measures the tabletop in local layout coordinates without reading viewport position', () => {
  const scene = {} as HTMLElement;
  const parent = { offsetLeft: 170, offsetTop: 110, offsetParent: scene } as unknown as HTMLElement;
  const element = {
    offsetLeft: 20,
    offsetTop: 30,
    offsetWidth: 140,
    offsetHeight: 100,
    offsetParent: parent,
    getBoundingClientRect: () => {
      throw new Error('Viewport position must not drive the anchor');
    },
  } as unknown as HTMLElement;
  expect(sceneLayoutRect(element, scene)).toEqual({ left: 190, top: 140, width: 140, height: 100 });
});

it('keeps Tavi and her contact shadow inside the desk scene, never fixed to the viewport', () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const stack: { tag: string; classes: string[] }[] = [];
  const voidTags = new Set([
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
  ]);
  let checked = 0;
  // React escapes attribute values; this walks the rendered element ancestry.
  for (const match of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
    const closing = match[1],
      tag = match[2] ?? '',
      attrs = match[3] ?? '';
    if (closing) {
      while (stack.length) {
        if (stack.pop()?.tag === tag) break;
      }
      continue;
    }
    const classes = (attrs.match(/\bclass="([^"]*)"/)?.[1] ?? '').split(/\s+/);
    if (classes.includes('page-walker') || classes.includes('hero-contact-shadow')) {
      expect(
        stack.some((parent) => parent.classes.includes('stream-stage')),
        classes.join(' '),
      ).toBe(true);
      checked++;
    }
    if (!voidTags.has(tag) && !attrs.endsWith('/')) stack.push({ tag, classes });
  }
  expect(checked).toBe(2);
  const css = readFileSync('src/landing.css', 'utf8');
  for (const name of ['page-walker', 'hero-contact-shadow']) {
    const block = css.match(new RegExp('\\.' + name + '\\s*\\{([^}]+)\\}'))?.[1];
    expect(block).toMatch(/position:\s*absolute/);
    expect(block).not.toMatch(/position:\s*fixed/);
  }
});
