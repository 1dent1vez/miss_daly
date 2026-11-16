import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { parse } from 'parse5';

const root = fileURLToPath(new URL('../', import.meta.url));
const scratch = join(root, '.impeccable', 'review', 'contact-materials', 'fixtures');
mkdirSync(scratch, { recursive: true });
const walk = node => [node, ...(node.childNodes ?? []).flatMap(walk)];
const attr = (node, name) => node.attrs?.find(attribute => attribute.name === name)?.value;
const routes = ['index.html', 'en/index.html', 'perfil-profesional/index.html', 'en/professional-profile/index.html'];

const confirmed = '+527226278711';

for (const fixture of [
  { name: 'approved default without override', phone: undefined, enabled: true },
  { name: 'approved default with empty override', phone: '', enabled: true },
  { name: 'formatted override is rejected, not repaired', phone: '+52 722 627 8711', enabled: false },
  { name: 'invalid', phone: 'not-a-number', enabled: false },
  // Reserved fictional NANP number: inspected in generated HTML, never contacted.
  { name: 'configured', phone: '+12025550123', enabled: true },
]) {
  test(`contact configuration: ${fixture.name}`, () => {
    const output = mkdtempSync(join(scratch, `${fixture.name}-`));
    try {
      const env = { ...process.env, SITE_URL: 'https://miss-daly.example' };
      if (fixture.phone === undefined) delete env.PUBLIC_PHONE;
      else env.PUBLIC_PHONE = fixture.phone;
      execFileSync('npm', ['run', 'build', '--', '--outDir', output], {
        cwd: root,
        env,
        stdio: 'pipe',
      });
      for (const file of routes) {
        const nodes = walk(parse(readFileSync(join(output, file), 'utf8')));
        const links = nodes.filter(node => node.tagName === 'a').map(node => attr(node, 'href'));
        const whatsapp = links.filter(href => href?.startsWith('https://wa.me/'));
        const calls = links.filter(href => href?.startsWith('tel:'));
        const profile = file.includes('perfil-profesional') || file.includes('professional-profile');
        assert.ok(!links.some(href => href?.startsWith('mailto:')), 'No email fallback is added');
        if (fixture.enabled && !profile) {
          assert.ok(whatsapp.length >= 1);
          for (const href of whatsapp) {
            const url = new URL(href);
            assert.equal(url.pathname, `/${(fixture.phone || confirmed).slice(1)}`);
            assert.equal(url.searchParams.get('text'), file.startsWith('en/')
              ? 'Hi, Miss Daly. I’d like to ask about times and prices for English classes.'
              : 'Hola, Miss Daly. Quiero consultar horarios y precios para clases de inglés.');
          }
        } else {
          assert.equal(whatsapp.length, 0);
        }
        assert.deepEqual(calls, fixture.enabled && profile ? [`tel:${fixture.phone || confirmed}`] : []);
        if (!fixture.enabled) {
          const disabled = nodes.filter(node => node.tagName === 'button' && node.attrs?.some(attribute => attribute.name === 'disabled'));
          assert.ok(disabled.length >= 1, 'Missing destinations remain visibly disabled');
        }
        const downloads = nodes.filter(node => node.tagName === 'a' && attr(node, 'download') !== undefined);
        assert.equal(downloads.length, profile ? 1 : 0, 'CV availability is independent of phone overrides');
        if (profile) assert.equal(attr(downloads[0], 'href'), '/trabajos/CV_Daniela.Linares.pdf');
      }
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  });
}
