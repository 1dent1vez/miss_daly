import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { before, test } from 'node:test';
import { parse } from 'parse5';

const root = fileURLToPath(new URL('../', import.meta.url));
const walk = node => [node, ...(node.childNodes ?? []).flatMap(walk)];
const attr = (node, name) => node.attrs?.find(attribute => attribute.name === name)?.value;
const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
const cvFile = 'CV_Daniela.Linares.pdf';
const expected = readdirSync(join(root, 'public', 'trabajos')).filter(name => name.toLowerCase().endsWith('.pdf') && name !== cvFile).sort();

before(() => {
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'pipe' });
});

for (const file of ['perfil-profesional/index.html', 'en/professional-profile/index.html']) {
  test(`${file}: all supplied work samples have real, safely encoded PDF links`, () => {
    const nodes = walk(parse(readFileSync(join(root, 'dist', file), 'utf8')));
    const links = nodes.filter(node => node.tagName === 'a' && attr(node, 'class')?.split(' ').includes('material-link'));
    const filenames = links.map(node => decodeURIComponent(new URL(attr(node, 'href'), 'https://miss-daly.example').pathname.slice('/trabajos/'.length))).sort();
    assert.ok(expected.length > 0);
    assert.equal(links.length, expected.length, 'Every supplied PDF is linked exactly once');
    assert.deepEqual(filenames, expected, 'Original filenames are preserved, including spaces and accents');
    for (const link of links) {
      const pathname = decodeURIComponent(new URL(attr(link, 'href'), 'https://miss-daly.example').pathname);
      const shipped = join(root, 'dist', pathname.slice(1));
      assert.ok(existsSync(shipped));
      assert.ok(statSync(shipped).size > 0);
      assert.equal(readFileSync(shipped).subarray(0, 5).toString(), '%PDF-');
      assert.equal(attr(link, 'type'), 'application/pdf');
      assert.equal(attr(link, 'target'), '_blank');
      assert.ok(attr(link, 'rel')?.split(' ').includes('noopener'));
      assert.ok(text(link).includes('PDF'));
    }
    const visible = nodes.filter(node => node.nodeName === '#text').map(node => node.value).join(' ');
    assert.ok(!visible.includes('Hay muestras pendientes de adjuntar.'));
    assert.ok(!visible.includes('Some work samples are pending upload.'));
    const cv = nodes.find(node => node.tagName === 'a' && attr(node, 'download') !== undefined);
    assert.ok(cv, 'The supplied CV must be downloadable on both profile languages');
    assert.equal(attr(cv, 'href'), `/trabajos/${cvFile}`);
    assert.ok(existsSync(join(root, 'dist', 'trabajos', cvFile)));
    assert.ok(!visible.includes('CV pendiente de adjuntar.') && !visible.includes('CV upload pending.'));
    assert.ok(!filenames.includes(cvFile), 'The CV is separate from the five teaching samples');
  });
}
