const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createHash } = require('node:crypto');
const { parse: parseYaml } = require('yaml');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const config = parseYaml(read('src/admin/config.yml'));

function builtPages(directory = 'public', found = []) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== 'admin' && entry.name !== 'assets') builtPages(file, found);
    if (entry.name === 'index.html') found.push(file.slice('public/'.length));
  }
  return found;
}
const workPages = () => builtPages().filter(file => /(^|\/)works\/[^/]+\/index\.html$/.test(file));

function parseFrontmatter(text) {
  // Match Sveltia's normalization and frontmatter extraction before YAML parsing.
  const match = text.trim().replace(/\r\n?/g, '\n').match(/^---\n(?:(?<head>[\s\S]*?)\n)?---(?:\n(?<body>[\s\S]*))?$/s);
  assert.ok(match, 'Expected YAML frontmatter');
  return parseYaml(match.groups.head || '');
}

function checkFields(data, fields, location) {
  for (const key of Object.keys(data)) {
    assert.ok(fields.some(field => field.name === key), `${location}: unmapped field ${key}`);
  }
  for (const field of fields) {
    const value = data[field.name];
    const label = `${location}.${field.name}`;
    if (value === undefined) {
      assert.equal(field.required, false, `${label}: missing required field`);
      continue;
    }
    if (field.widget === 'object') {
      checkFields(value, field.fields, label);
    } else if (field.widget === 'list') {
      assert.ok(Array.isArray(value), `${label}: expected array`);
      assert.ok(value.length >= (field.min || 0), `${label}: too few items`);
      value.forEach((item, index) => {
        if (field.fields) checkFields(item, field.fields, `${label}[${index}]`);
        if (field.field?.widget === 'image') checkImage(item);
      });
    } else if (field.widget === 'number') {
      assert.ok(Number.isInteger(value), `${label}: expected integer, not a timestamp`);
    } else if (field.widget === 'boolean') {
      assert.equal(typeof value, 'boolean', label);
    } else {
      assert.equal(typeof value, 'string', label);
      if (field.widget === 'image') checkImage(value);
    }
  }
}

function checkImage(value) {
  assert.equal(typeof value, 'string');
  assert.ok(!value.startsWith('/') && !value.split('/').includes('..') && !value.includes('://'), `Expected source-relative image: ${value}`);
  assert.ok(fs.existsSync(path.join(root, config.media_folder, value)), `Missing source image: ${value}`);
}

test('every artwork parses with Sveltia-compatible YAML and maps to CMS fields', () => {
  const works = config.collections.find(collection => collection.name === 'works');
  const files = fs.readdirSync(path.join(root, works.folder)).filter(file => file.endsWith('.md'));
  assert.ok(files.length > 0);
  assert.equal(config.backend.repo, 'izvyk/lena-mukosey-site');
  assert.equal(config.backend.branch, 'master');
  assert.equal(config.media_folder, 'src/assets/images');
  assert.equal(config.public_folder, '/assets/images');
  for (const collection of config.collections.filter(collection => ['works', 'biography'].includes(collection.name))) {
    assert.equal(collection.media_folder, '/src/assets/images');
    assert.equal(collection.public_folder, '', 'Filename-only paths require a collection-level override');
  }
  assert.equal(works.format, 'frontmatter');
  for (const file of files) {
    const data = parseFrontmatter(read(`${works.folder}/${file}`));
    checkFields(data, works.fields, file);
  }
});


test('CMS maps both biographies, contact links and all page frontmatter', () => {
  const files = config.collections.flatMap(collection => collection.files || []);
  assert.equal(files.length, 6);
  for (const file of files) {
    checkFields(parseFrontmatter(read(file.file)), file.fields, file.file);
  }
});

test('admin and Cloudflare files are copied verbatim, not rendered as templates', () => {
  for (const file of ['admin/index.html', 'admin/config.yml', '_headers', '404.html']) {
    assert.equal(read(`public/${file}`), read(`src/${file}`), `${file} must be copied unchanged`);
  }
  assert.ok(!fs.existsSync(path.join(root, 'public/404/index.html')), '404 must not become a directory URL');
  const admin = read('public/admin/index.html');
  assert.ok(admin.includes('@sveltia/cms@0.242.0/dist/sveltia-cms.js'));
  assert.ok(!admin.includes('mc.yandex.ru'), 'The CMS must not inherit portfolio analytics');
});

test('responsive images use AVIF and JPEG, publishing only current variants', () => {
  const referenced = new Set();
  for (const file of builtPages()) {
    const html = read(`public/${file}`);
    assert.ok(html.includes('image/avif'), `${file}: missing AVIF sources`);
    assert.ok(html.includes('image/jpeg'), `${file}: missing JPEG fallback`);
    assert.ok(!html.includes('image/webp'), `${file}: unexpected WebP source`);
    for (const match of html.matchAll(/\/assets\/images\/([\w-]+\.(?:avif|jpeg))/g)) {
      referenced.add(match[1]);
    }
  }
  assert.ok(referenced.size > 0);
  const published = fs.readdirSync(path.join(root, 'public/assets/images'));
  assert.deepEqual(new Set(published), referenced, 'Missing variants or stale images in deployment');
  const dependencyHash = createHash('sha256').update(read('package-lock.json')).digest('hex').slice(0, 12);
  for (const file of published) {
    const cached = path.join(root, '.cache/images', dependencyHash, file);
    assert.deepEqual(fs.readFileSync(cached), fs.readFileSync(path.join(root, 'public/assets/images', file)), `${file}: published variant must match the persistent build cache`);
  }
});

test('pages declare absolute canonical, hreflang and link preview URLs', () => {
  const site = JSON.parse(read('src/_data/site.json'));
  for (const file of builtPages()) {
    const html = read(`public/${file}`);
    const url = `${site.url}/${file.replace(/index\.html$/, '')}`;
    const alternates = new Map([...html.matchAll(/<link rel="alternate" hreflang="([\w-]+)" href="([^"]*)"/g)].map(match => [match[1], match[2]]));
    const english = `${site.url}/en/${file.replace(/^en\//, '').replace(/index\.html$/, '')}`;
    assert.deepEqual([...alternates.keys()].sort(), ['en', 'ru', 'x-default'], file);
    assert.equal(alternates.get('en'), english, file);
    assert.equal(alternates.get('x-default'), english, file);
    assert.ok(html.includes(`<link rel="canonical" href="${url}">`), `${file}: canonical`);
    assert.ok(html.includes(`<meta property="og:url" content="${url}">`), `${file}: og:url`);

    const image = html.match(/<meta property="og:image" content="([^"]*)"/)?.[1];
    assert.ok(image?.startsWith(`${site.url}/assets/images/`), `${file}: og:image ${image}`);
    const { size } = fs.statSync(path.join(root, 'public', image.slice(site.url.length)));
    assert.ok(size <= 600 * 1024, `${file}: link preview image is too heavy for messengers: ${size}`);
  }
});

test('robots and sitemap expose every page and published artwork variants', () => {
  const site = JSON.parse(read('src/_data/site.json'));
  assert.ok(read('public/robots.txt').startsWith(`Sitemap: ${site.url}/sitemap.xml\n`));

  const sitemap = read('public/sitemap.xml');
  assert.ok(sitemap.startsWith('<?xml'), 'The XML declaration must be the first thing in the file');
  const locations = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map(match => match[1].slice(site.url.length));
  assert.deepEqual(locations.sort(), builtPages().map(file => `/${file.replace(/index\.html$/, '')}`).sort());

  const images = [...sitemap.matchAll(/<image:loc>([^<]*)<\/image:loc>/g)].map(match => match[1].slice(site.url.length));
  const shown = (read('public/works/index.html').match(/<picture>/g) || []).length;
  assert.equal(images.length, 2 * shown, 'Every artwork must be listed on its page in both languages');
  for (const image of images) assert.ok(fs.existsSync(path.join(root, 'public', image)), `Sitemap lists a missing image: ${image}`);
});

test('search engine ownership files are copied verbatim', () => {
  for (const file of ['googleb47c657284bf2cb9.html', 'yandex_f3f22969aca1e617.html']) {
    assert.equal(read(`public/${file}`), read(`src/${file}`), file);
  }
});

test('only the first images skip lazy loading', () => {
  const lazy = html => /loading="lazy"/.test(html);
  for (const file of ['index.html', 'en/index.html']) {
    const images = read(`public/${file}`).match(/<img [^>]*>/g).filter(image => image.includes('itemprop="image"'));
    assert.ok(images.slice(0, 7).every(image => !lazy(image)) && images.slice(7).every(lazy), file);
  }
  for (const file of ['works/index.html', 'en/works/index.html']) {
    const images = read(`public/${file}`).match(/<img class="trueImage"[^>]*>/g);
    assert.ok(!lazy(images[0]) && images.slice(1).every(lazy), file);
  }
});

test('each work page shows and previews only its own work, loading it first', () => {
  const site = JSON.parse(read('src/_data/site.json'));
  const pages = workPages();
  const works = read('public/works/index.html').split('class="workContainer"').length - 1;
  assert.equal(pages.length, 2 * works);
  const previews = new Set();
  for (const file of pages) {
    const html = read(`public/${file}`);
    const slug = file.split('/').at(-2);
    assert.equal(html.split('class="workContainer"').length - 1, 1, `${file}: must hold a single work`);
    assert.ok(html.includes(`<div id="${slug}">`), `${file}: work id must match its URL`);
    assert.match(html, /<img class="trueImage"(?![^>]*loading=)[^>]*fetchpriority="high"/, `${file}: open work must load first`);

    const name = html.match(/<span class="name" itemprop="name">([^<]*)</)[1];
    assert.ok(html.includes(`<title>${name} — `), `${file}: title must name the work`);
    assert.ok(html.includes(`<meta property="og:title" content="${name} — `), `${file}: preview must name the work`);

    const preview = html.match(/<meta property="og:image" content="[^"]*\/([\w-]+)-\d+\.jpeg"/)[1];
    assert.ok(html.includes(`/assets/images/${preview}-`) && html.match(new RegExp(`class="trueImage" src="/assets/images/${preview}-`)), `${file}: preview must be the work's first image`);
    previews.add(preview);
  }
  assert.equal(previews.size, works, 'Every work needs its own preview image');
  for (const [file, prefix] of [['index.html', '/works/'], ['en/index.html', '/en/works/']]) {
    const links = [...read(`public/${file}`).matchAll(/<a href="([^"]*)" itemprop="url">/g)].map(match => match[1]);
    assert.equal(links.length, works, file);
    for (const link of links) {
      assert.ok(link.startsWith(prefix) && fs.existsSync(path.join(root, 'public', link, 'index.html')), `${file}: card must open its work page: ${link}`);
    }
  }
  assert.ok(read('public/en/info/index.html').includes(`${site.url}/assets/images/`));
});

test('sizes with several units are translated throughout', () => {
  assert.ok(read('public/works/index.html').includes('35×21 см / 33×21 см'));
  assert.ok(read('public/en/works/index.html').includes('35×21 cm / 33×21 cm'));
});

test('each work on the works pages has its own image counter and a non-empty alt', () => {
  for (const file of ['works/index.html', 'en/works/index.html']) {
    const works = read(`public/${file}`).split('class="workContainer"').slice(1);
    assert.ok(works.length > 0);
    for (const work of works) {
      const images = work.match(/<picture>/g).length;
      const counters = [...work.matchAll(/class="annotation">([^<]*)</g)].map(match => match[1]);
      const expected = images > 1 ? Array.from({ length: images }, (_, index) => `${index + 1} / ${images}`) : [];
      assert.deepEqual(counters, expected);
      for (const [, alt] of work.matchAll(/class="trueImage"[^>]*?alt="([^"]*)"/g)) assert.ok(alt, `${file}: artwork without alt`);
    }
  }
});

test('pages stay usable without JavaScript', () => {
  for (const file of ['index.html', 'info/index.html', 'works/index.html', 'en/index.html', 'en/info/index.html', 'en/works/index.html']) {
    const html = read(`public/${file}`);
    assert.match(html, /<noscript><style>[^<]*\.card img[^<]*opacity:1/, `${file}: images must not depend on onload`);
    assert.match(html, /class="current-year">\d{4}</, `${file}: footer year needs a build-time fallback`);
  }
});

test('all portfolio routes are built and the output fits Cloudflare Pages limits', () => {
  for (const file of ['index.html', 'info/index.html', 'works/index.html', 'en/index.html', 'en/info/index.html', 'en/works/index.html']) {
    assert.ok(read(`public/${file}`).includes('<!doctype html>'));
  }
  let count = 0;
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else {
        count++;
        assert.ok(fs.statSync(file).size <= 25 * 1024 * 1024, `Exceeds Pages' 25 MiB asset limit: ${file}`);
      }
    }
  }
  visit(path.join(root, 'public'));
  assert.ok(count <= 20000, `Exceeds Pages' free-plan 20,000 file limit: ${count}`);
});
