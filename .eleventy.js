const Image = require("@11ty/eleventy-img").default;
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const htmlmin = require("html-minifier-terser");
const sass = require('sass');
const sharp = require('sharp');
const { EleventyI18nPlugin } = require("@11ty/eleventy");

const i18n = require('eleventy-plugin-i18n');
const translations = require('./src/_data/i18n/');
const site = require('./src/_data/site.json');

// Shared by the works pages and the image sitemap, which must list a variant those pages publish.
const workImageWidths = [285, 570, 855, 1097, 2194, 3291];
// Keeps link previews within what messengers fetch reliably.
const previewImageMaxSide = 1200;

const escapeAttribute = value => String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');

module.exports = function (eleventyConfig) {
  // Separate encoder versions in the disk cache; Image hashes source bytes and settings.
  const dependencyHash = createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex').slice(0, 12);
  const imageFiles = new Map();
  eleventyConfig.on('eleventy.before', () => imageFiles.clear());
  eleventyConfig.on('eleventy.after', ({ incremental }) => {
    const outputDir = 'public/assets/images';
    // Partial development builds must retain images used by untouched pages.
    if (!incremental) fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });
    for (const [filename, source] of imageFiles) {
      fs.copyFileSync(source, path.join(outputDir, filename));
    }
  });

  eleventyConfig.addGlobalData('workImageWidths', workImageWidths);

  async function responsiveImage(src, widths, formats = ['avif', 'jpeg']) {
    const metadata = await Image('./src/assets/images/' + src, {
      widths,
      formats,
      sharpAvifOptions: { quality: 65, effort: 4 },
      outputDir: `.cache/images/${dependencyHash}`,
      urlPath: '/assets/images',
      svgShortCircuit: true,
    });
    for (const image of Object.values(metadata).flat()) {
      imageFiles.set(image.filename, image.outputPath);
    }
    return metadata;
  }

  // Replacement for the unpublished eleventy-plugin-inline-sass:
  // compiles companion .scss data files and exposes them as the `scss` key.
  eleventyConfig.addDataExtension('scss', contents => {
    return {
      scss: sass.compileString(contents, {
        style: 'compressed',
        loadPaths: ['src/_includes']
      }).css
    };
  });

  eleventyConfig.addPlugin(EleventyI18nPlugin, {
		// any valid BCP 47-compatible language tag is supported
		defaultLanguage: "ru", // Required, this site uses "ru"
    errorMode: "allow-fallback",
	});

  eleventyConfig.addPlugin(i18n, {
    translations,
    fallbackLocales: {
      // Required as i18n doesn't like permalinks
      // This should match the default language (one with permalinks)
      '*': 'ru'
    }
  });

  // Minify if 'dev' environmental variable is not set
  if (!process.env.dev) {
    eleventyConfig.addTransform("htmlmin", async function(content) {
      if (!this.page.outputPath || !this.page.outputPath.endsWith(".html")) {
        return content;
      }

      let minified = await htmlmin.minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyCSS: true,
        minifyJS: true,
      });

      return minified;
    });
  }

  eleventyConfig.addNunjucksAsyncShortcode("image", async function(src, alt, widths = ['auto'], sizes = "100vw", lazy = true) {
		// if(alt === undefined) {
		// 	// You bet we throw an error on missing alt (alt="" works okay)
		// 	throw new Error(`Missing \`alt\` on responsiveimage from: ${src}`);
		// }

    let metadata = await responsiveImage(src, widths);

		let lowsrc = metadata.jpeg[0];
		let highsrc = metadata.jpeg[metadata.jpeg.length - 1];

    return `<picture>
    ${Object.values(metadata).map(imageFormat => {
    return `<source type="${imageFormat[0].sourceType}" srcset="${imageFormat.map(entry => entry.srcset).join(", ")}" sizes="${sizes}">`;
  }).join("\n")}
      <img
        src="${lowsrc.url}"
        width="${highsrc.width}"
        height="${highsrc.height}"
        alt="${escapeAttribute(alt)}"
        ${lazy === true ? 'loading="lazy"' : ""}
        decoding="async"
        itemprop="image"
        onload="this.style.opacity = 1">
    </picture>`;
	});

  eleventyConfig.addNunjucksAsyncShortcode("imageWithPlaceholder", async function(src, alt, widths = ['auto'], sizes = "100vw", lazy = true, annotation = "", prev = false, next = false) {
		// if(alt === undefined) {
		// 	// You bet we throw an error on missing alt (alt="" works okay)
		// 	throw new Error(`Missing \`alt\` on responsiveimage from: ${src}`);
		// }
    
    let annotationBlock = "";

    if (annotation) {
      annotationBlock =
        `<div class="imageCounter">
          <button type="button" class="imageCounterButton" aria-label="${translations.gallery.previous[this.page.lang]}" ${prev ? 'onclick="this.parentNode.parentNode.parentNode.scrollLeft = this.parentNode.parentNode.previousElementSibling.offsetLeft - this.parentNode.parentNode.parentNode.firstElementChild.offsetLeft"' : 'disabled'}>
            <span class="arrow prev ${prev ? '' : 'inactive'}"></span>
          </button>
          <span class="annotation">${annotation}</span>
          <button type="button" class="imageCounterButton" aria-label="${translations.gallery.next[this.page.lang]}" ${next ? 'onclick="this.parentNode.parentNode.parentNode.scrollLeft = this.parentNode.parentNode.nextElementSibling.offsetLeft - this.parentNode.parentNode.parentNode.firstElementChild.offsetLeft"' : 'disabled'}>
            <span class="arrow next ${next ? '' : 'inactive'}"></span>
          </button>
        </div>`
        ;
    }

    let metadata = await responsiveImage(src, widths);

		let lowsrc = metadata.jpeg[0];
		let highsrc = metadata.jpeg[metadata.jpeg.length - 1];

    return `
      <div class="imageWrapper">
        <picture>
          ${Object.values(metadata).map(imageFormat => {
            return `<source type="${imageFormat[0].sourceType}" srcset="${imageFormat.map(entry => entry.srcset).join(", ")}" sizes="${sizes}">`;
          }).join("\n")}
            <img
              class="trueImage"
              src="${lowsrc.url}"
              alt="${escapeAttribute(alt)}"
              ${lazy === true ? 'loading="lazy"' : ""}
              ${lazy === false ? 'fetchpriority="high"' : ""}
              decoding="async"
              itemprop="image"
              onload="this.style.opacity = 1">
          </picture>
        <img
          class="placeholder"
          alt=""
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${highsrc.width}' height='${highsrc.height}'%3E%3Crect width='100%25' height='100%25' fill='%230000'/%3E%3C/svg%3E"
        >` + 
        annotationBlock
      + '</div>';
	});

  eleventyConfig.addNunjucksAsyncShortcode("previewImage", async function(src, alt) {
    const { width, height } = await sharp('./src/assets/images/' + src).metadata();
    const previewWidth = Math.min(previewImageMaxSide, Math.round(previewImageMaxSide * width / Math.max(width, height)));
    const image = (await responsiveImage(src, [previewWidth], ['jpeg'])).jpeg[0];

    return `<meta property="og:image" content="${site.url}${image.url}">
        <meta property="og:image:type" content="image/jpeg">
        <meta property="og:image:width" content="${image.width}">
        <meta property="og:image:height" content="${image.height}">
        <meta property="og:image:alt" content="${escapeAttribute(alt)}">`;
  });

  eleventyConfig.addNunjucksAsyncShortcode("workImageUrl", async function(src) {
    return (await responsiveImage(src, workImageWidths)).jpeg.at(-1).url;
  });

  // Build-time fallback for visitors without JS; base.njk keeps it current otherwise.
  eleventyConfig.addShortcode("currentYear", () => String(new Date().getFullYear()));

  eleventyConfig.addCollection("worksSortedRespectingOrder", function (collectionApi) {
    let sortedWorks = collectionApi
      .getFilteredByTag("work")
      .filter(work => !((Object.hasOwn(work.data, 'display')) && (work.data.display == false || work.data.display == 'no')))
      .sort((a, b) => b.data.dateEnd - a.data.dateEnd);

    sortedWorks
      .filter(work => Object.hasOwn(work.data, 'order'))
      .sort((a, b) => a.data.order - b.data.order)
      .forEach(work => {
        sortedWorks = sortedWorks.filter(i => i !== work);
        if (work.data.order == -1) {
          sortedWorks.push(work);
        } else if (work.data.order > 0) {
          sortedWorks.splice(work.data.order - 1, 0, work);
        } else if (work.data.order < 0) {
          sortedWorks.splice(work.data.order + 1, 0, work);
        } else {
          sortedWorks.splice(work.data.order, 0, work);
        }
      });

    // Work URLs and list anchors. A hidden work may share an English title with a visible one,
    // so showing it must not turn into a permalink conflict that fails the build.
    const slugify = eleventyConfig.getFilter('slugify');
    const usedSlugs = new Map();
    sortedWorks.forEach(work => {
      const slug = slugify(work.data.title.en);
      const uses = (usedSlugs.get(slug) || 0) + 1;
      usedSlugs.set(slug, uses);
      work.data.slug = uses > 1 ? `${slug}-${uses}` : slug;
    });

    return sortedWorks;
  });

  // Replaces locale_links, which resolves every page of a paginated template to a single URL.
  // Both languages have the same pages, with English ones under /en/.
  eleventyConfig.addFilter('other_language', url => url.startsWith('/en/')
    ? { url: url.slice('/en'.length), lang: 'ru', label: 'Русский' }
    : { url: '/en' + url, lang: 'en', label: 'English' });

  eleventyConfig.addFilter('prefixWithAssetsPath', (path) => {
    return '/assets/images/' + path;
  });

  eleventyConfig.addFilter('size_i18n', (size, lang, workPath) => {
    if (!size) {
      console.error(`An artwork ${workPath} does not have a size defined!`);
      return;
    }

    // Every token: sizes such as "35×21 cm / 33×21 cm" repeat the unit.
    return size.split(' ').map(token => translations.size[token]?.[lang] ?? token).join(' ');
  });

  eleventyConfig.addPassthroughCopy('./src/assets/favicon/');
  eleventyConfig.addPassthroughCopy('./src/admin/');
  eleventyConfig.ignores.add('src/admin/**');
  eleventyConfig.ignores.add('src/404.html');
  eleventyConfig.addPassthroughCopy('./src/_headers');
  eleventyConfig.addPassthroughCopy('./src/404.html');
  // Search Console and Yandex Webmaster ownership proofs; they must stay byte-identical.
  for (const file of ['googleb47c657284bf2cb9.html', 'yandex_f3f22969aca1e617.html']) {
    eleventyConfig.ignores.add(`src/${file}`);
    eleventyConfig.addPassthroughCopy(`./src/${file}`);
  }

  return {
    dir: {
      input: 'src',
      output: 'public',
    },
  };
};