const Image = require("@11ty/eleventy-img");
const htmlmin = require("html-minifier");
const posthtml = require('posthtml');
const minifyClassnames = require('posthtml-minify-classnames');
const pluginInlineSass = require('eleventy-plugin-inline-sass');

function transliterate(letter) {
  if (letter.length != 1) {
    throw Error(`Invalid argument: ${letter}`);
  }

  switch (letter) {
    case 'а':
      return 'a';
    case 'б':
      return 'b';
    case 'в':
      return 'v';
    case 'г':
      return 'g';
    case 'д':
      return 'd';
    case 'е':
      return 'ye';
    case 'ё':
      return 'yo';
    case 'ж':
      return 'z';
    case 'з':
      return 'z';
    case 'и':
      return 'i';
    case 'й':
      return 'y';
    case 'к':
      return 'k';
    case 'л':
      return 'l';
    case 'м':
      return 'm';
    case 'н':
      return 'n';
    case 'о':
      return 'o';
    case 'п':
      return 'p';
    case 'р':
      return 'r';
    case 'с':
      return 's';
    case 'т':
      return 't';
    case 'у':
      return 'u';
    case 'ф':
      return 'f';
    case 'х':
      return 'h';
    case 'ц':
      return 'c';
    case 'ч':
      return 'ch';
    case 'ш':
      return 'sh';
    case 'щ':
      return 'sh';
    case 'ъ':
      return '';
    case 'ы':
      return 'y';
    case 'ь':
      return '';
    case 'э':
      return 'e';
    case 'ю':
      return 'yu';
    case 'я':
      return 'ya';
    default:
      return letter;
  }
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginInlineSass, {
    compiler: {
      loadPaths: ['src/_includes']
    }
  });

  eleventyConfig.addTransform("htmlmin", async function(content) {
    if(this.page.outputPath && this.page.outputPath.endsWith(".html")) {
      const { html } = await posthtml().use(minifyClassnames({genNameId: false})).process(content);

      let minified = htmlmin.minify(html, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
      });

      return minified;
    }

    return content;
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

  eleventyConfig.addNunjucksAsyncShortcode("imageWithPlaceholder", async function(src, alt, widths = ['auto'], sizes = "100vw", lazy = true) {
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
          alt="${alt}"
        >
      </div>`;
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

  eleventyConfig.addFilter('transliterate', (string) => {
    let transliteration = '';
    for (let i = 0; i < string.length; i++) {
      transliteration += transliterate(string.charAt(i).toLowerCase());
    };
    return transliteration;
  });

  eleventyConfig.addFilter('prefixWithAssetsPath', (path) => {
    return '/assets/images/' + path;
  });

  eleventyConfig.addPassthroughCopy('./src/assets/favicon/');

  return {
    dir: {
      input: 'src',
      output: 'public',
    },
  };
};