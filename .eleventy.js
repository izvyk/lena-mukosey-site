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

  eleventyConfig.addNunjucksAsyncShortcode("imageWithPlaceholder", async function(src, alt, widths = ['auto'], sizes = "100vw", lazy = true, annotation="") {
		// if(alt === undefined) {
		// 	// You bet we throw an error on missing alt (alt="" works okay)
		// 	throw new Error(`Missing \`alt\` on responsiveimage from: ${src}`);
		// }
    
    annotationBlock = "";

    if (annotation) {
      annotationBlock = `
        <div class="imageCounter">
          ${annotation}
        </div>
        `;
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
    const sortedWorks = collectionApi.getFilteredByTag("work").sort((a, b) => b.data.dateEnd - a.data.dateEnd);

    for (let i = 0; i < sortedWorks.length; i++) {
      if (Object.hasOwn(sortedWorks[i].data, 'display') && 
      (sortedWorks[i].data.display == false || sortedWorks[i].data.display == 'no')) {
        sortedWorks.splice(i, 1); 
      }
    }

    let explicitlyOrderedItems = [];
    for (let i = 0; i < sortedWorks.length; i++) {
      if (Object.hasOwn(sortedWorks[i].data, 'order')) {
        explicitlyOrderedItems.push(sortedWorks.splice(i, 1)[0]);
      }
    }

    explicitlyOrderedItems.forEach(i => {
      if (i.data.order == -1) {
        sortedWorks.push(i);
      } else if (i.data.order > 0) {
        sortedWorks.splice(i.data.order - 1, 0, i);
      } else if (i.data.order < 0) {
        sortedWorks.splice(i.data.order + 1, 0, i);
      } else {
        sortedWorks.splice(i.data.order, 0, i);
      }
    });

    return sortedWorks;
  });

  eleventyConfig.addFilter('prefixWithAssetsPath', (path) => {
    return '/assets/images/' + path;
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