const Image = require("@11ty/eleventy-img");
const htmlmin = require("html-minifier");
const posthtml = require('posthtml');
const minifyClassnames = require('posthtml-minify-classnames');
const pluginInlineSass = require('eleventy-plugin-inline-sass');
const { EleventyI18nPlugin } = require("@11ty/eleventy");

const i18n = require('eleventy-plugin-i18n');
const translations = require('./src/_data/i18n/');

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginInlineSass, {
    compiler: {
      loadPaths: ['src/_includes']
    }
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

      const { html } = await posthtml().use(minifyClassnames({genNameId: false})).process(content);

      let minified = htmlmin.minify(html, {
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

		let metadata = await Image("./src/assets/images/" + src, {
			widths,
			formats: ['avif', 'jpeg'],
      outputDir: 'public/assets/images',
      urlPath: '/assets/images',
      svgShortCircuit: true,
		});

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
        alt="${alt}"
        ${lazy === true ? 'loading="lazy"' : ""}
        decoding="async"
        itemprop="image"
        >
    </picture>`;
	});

  eleventyConfig.addNunjucksAsyncShortcode("imageWithPlaceholder", async function(src, alt, widths = ['auto'], sizes = "100vw", lazy = true, annotation = "", prev = false, next = false) {
		// if(alt === undefined) {
		// 	// You bet we throw an error on missing alt (alt="" works okay)
		// 	throw new Error(`Missing \`alt\` on responsiveimage from: ${src}`);
		// }
    
    annotationBlock = "";

    if (annotation) {
      annotationBlock =
        `<div class="imageCounter">
          <div class="imageCounterButton" ${prev ? 'onclick="this.parentNode.parentNode.parentNode.scrollLeft = this.parentNode.parentNode.previousElementSibling.offsetLeft - this.parentNode.parentNode.parentNode.firstElementChild.offsetLeft"' : ''}>
            <div class="arrow prev ${prev ? '' : 'inactive'}"></div>
          </div>
          <span class="annotation">${annotation}</span>
          <div class="imageCounterButton" ${next ? 'onclick="this.parentNode.parentNode.parentNode.scrollLeft = this.parentNode.parentNode.nextElementSibling.offsetLeft - this.parentNode.parentNode.parentNode.firstElementChild.offsetLeft"' : ''}>
            <div class="arrow next ${next ? '' : 'inactive'}"></div>
          </div>
        </div>`
        ;
    }

		let metadata = await Image("./src/assets/images/" + src, {
			widths,
			formats: ['avif', 'jpeg'],
      outputDir: 'public/assets/images',
      urlPath: '/assets/images',
      svgShortCircuit: true,
		});

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
              alt="${alt}"
              ${lazy === true ? 'loading="lazy"' : ""}
              decoding="async"
              itemprop="image">
          </picture>
        <img
          class="placeholder"
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${highsrc.width}' height='${highsrc.height}'%3E%3Crect width='100%25' height='100%25' fill='%230000'/%3E%3C/svg%3E"
        >` + 
        annotationBlock
      + '</div>';
	});

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

    return sortedWorks;
  });

  eleventyConfig.addFilter('prefixWithAssetsPath', (path) => {
    return '/assets/images/' + path;
  });

  eleventyConfig.addFilter('toUpperCase', (str) => {
    return str.toUpperCase();
  });

  eleventyConfig.addFilter('size_i18n', (size, lang, workPath) => {
    if (!size) {
      console.error(`An artwork ${workPath} does not have a size defined!`);
      return;
    }

    let splitted = size.split(' ');

    let unit = splitted[splitted.length - 1];
    if (unit in translations.size && lang in translations.size[unit]) {
      splitted[splitted.length - 1] = translations.size[unit][lang];
    }
    
    return splitted.join(' ');
  });

  eleventyConfig.addPassthroughCopy('./src/assets/favicon/');

  return {
    dir: {
      input: 'src',
      output: 'public',
    },
  };
};