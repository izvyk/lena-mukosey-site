const eleventySass = require('eleventy-sass');
const rev = require("eleventy-plugin-rev");
const Image = require("@11ty/eleventy-img");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(rev);

  eleventyConfig.addPlugin(eleventySass, {
    rev: true,
  });

  eleventyConfig.addNunjucksAsyncShortcode("image", async function(src, alt, widths = ['auto'], sizes = "100vw") {
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
        loading="lazy"
        decoding="async"
    </picture>`;
	});

  eleventyConfig.addNunjucksAsyncShortcode("imageWithPlaceholder", async function(src, alt, widths = ['auto'], sizes = "100vw") {
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
              loading="lazy"
              decoding="async">
          </picture>
        <img
          src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${highsrc.width}' height='${highsrc.height}'%3E%3Crect width='100%25' height='100%25' fill='%230000'/%3E%3C/svg%3E"
          alt="${alt}">
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

  eleventyConfig.addFilter('prefixWithAssetsPath', (path) => {
    // return '/test/assets/images/' + path;
    return '/assets/images/' + path;
  });

  eleventyConfig.addFilter('prefixWithStylesPath', (path) => {
    // return '/test/styles/' + path;
    return '/styles/' + path;
  });

  eleventyConfig.addPassthroughCopy('./src/assets/favicon/');

  return {
    dir: {
      input: 'src',
      output: 'public',
    },
  };
};