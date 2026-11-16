import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { before, test } from 'node:test';
import { parse } from 'parse5';

const root = fileURLToPath(new URL('../', import.meta.url));
const pages = [
  { file: 'index.html', lang: 'es' },
  { file: 'en/index.html', lang: 'en' },
];

before(() => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
});

function walk(node) {
  return [node, ...(node.childNodes ?? []).flatMap(walk)];
}
function attr(node, name) {
  return node.attrs?.find(attribute => attribute.name === name)?.value;
}
function documentFor(file) {
  return walk(parse(readFileSync(resolve(root, 'dist', file), 'utf8')));
}
function text(node) {
  return node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
}

for (const page of pages) {
  test(`${page.lang}: the approved option B headline is the single page heading`, () => {
    const headings = documentFor(page.file).filter(node => node.tagName === 'h1');
    assert.equal(headings.length, 1);
    assert.equal(text(headings[0]).replace(/\s+/g, ' ').trim(), page.lang === 'es'
      ? 'Inglés para la vida real.'
      : 'English for real life.');
  });
  test(`${page.lang}: landing presents the supplied portrait instead of stock material`, () => {
    const nodes = documentFor(page.file);
    const portrait = nodes.find(node => node.tagName === 'img' && attr(node, 'alt') === 'Miss Daly');
    assert.ok(portrait, 'The landing must show the actual supplied portrait of Miss Daly');
    const src = attr(portrait, 'src');
    assert.ok(src?.startsWith('/images/'), 'The portrait must be self-hosted');
    assert.ok(!src.includes('english-notes'), 'The illustrative notebook must not replace the teacher');
    assert.ok(existsSync(resolve(root, 'dist', decodeURIComponent(src.slice(1)))), 'The portrait file must ship in dist');
    assert.ok(attr(portrait, 'srcset')?.includes('640w'), 'The hero offers a smaller image for mobile');
    assert.equal(attr(portrait, 'width'), '1122');
    assert.equal(attr(portrait, 'height'), '1402');
  });
  test(`${page.lang}: existing class information and native FAQ are preserved`, () => {
    const nodes = documentFor(page.file);
    const headings = nodes.filter(node => node.tagName === 'h2').map(node => text(node).trim());
    for (const heading of page.lang === 'es'
      ? ['Encuentra tu formato', 'Cómo son las clases', 'Preguntas frecuentes']
      : ['Find your format', 'How classes work', 'Frequently asked questions']) {
      assert.ok(headings.includes(heading), heading);
    }
    assert.equal(nodes.filter(node => node.tagName === 'details').length, 4);
    assert.equal(nodes.filter(node => node.tagName === 'script').length, 0, 'Native navigation and FAQ do not require client JavaScript');
  });
}

for (const page of [
  { file: 'index.html', lang: 'es', translation: '/en/', profile: '/perfil-profesional/' },
  { file: 'en/index.html', lang: 'en', translation: '/', profile: '/en/professional-profile/' },
  { file: 'perfil-profesional/index.html', lang: 'es', translation: '/en/professional-profile/' },
  { file: 'en/professional-profile/index.html', lang: 'en', translation: '/perfil-profesional/' },
]) {
  test(`${page.file}: footer contains the exact discreet Brilint signature`, () => {
    const nodes = documentFor(page.file);
    const footer = nodes.find(node => node.tagName === 'footer');
    const signature = walk(footer).find(node => attr(node, 'class')?.split(' ').includes('footer-credit'));
    assert.ok(signature, 'The authorship signature belongs inside the footer');
    assert.equal(text(signature).replace(/\s+/g, ' ').trim(), 'Hecho por Brilint');
    const links = walk(signature).filter(node => node.tagName === 'a');
    assert.equal(links.length, 1);
    assert.ok(links[0].parentNode === signature, 'The credit is inline text, not a separate badge');
    assert.equal(text(links[0]).trim(), 'Brilint', 'Only the brand name is a link');
    assert.equal(attr(links[0], 'href'), 'https://brilinr.dpdns.org/servicios/landing-page/');
    assert.equal(attr(links[0], 'target'), '_blank');
    assert.deepEqual(attr(links[0], 'rel')?.split(' ').sort(), ['noopener', 'noreferrer']);
    assert.match(attr(links[0], 'aria-label') ?? '', /Brilint/);
    assert.match(attr(links[0], 'aria-label') ?? '', /pestaña nueva|new tab/);
    assert.equal(walk(signature).filter(node => ['svg', 'img'].includes(node.tagName)).length, 0);
  });
  test(`${page.file}: language and real navigation remain intact`, () => {
    const nodes = documentFor(page.file);
    assert.equal(attr(nodes.find(node => node.tagName === 'html'), 'lang'), page.lang);
    const links = nodes.filter(node => node.tagName === 'a');
    assert.ok(links.some(node => attr(node, 'href') === page.translation && attr(node, 'hreflang')));
    if (page.profile) assert.ok(links.some(node => attr(node, 'href') === page.profile));
    const headings = nodes.filter(node => node.tagName === 'h1');
    assert.equal(headings.length, 1);
    const image = nodes.find(node => node.tagName === 'img' && attr(node, 'alt') === 'Miss Daly');
    assert.ok(image, 'The supplied portrait is also available on the professional profile');
    assert.ok(!readFileSync(resolve(root, 'dist', page.file), 'utf8').includes('Maqueta de composición'));
  });
}
