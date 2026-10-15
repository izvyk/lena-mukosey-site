const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { parse: parseYaml } = require('yaml');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const config = parseYaml(read('src/admin/config.yml'));

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
