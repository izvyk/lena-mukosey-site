const eleventySass = require('eleventy-sass');
// const htmlmin = require('html-minifier');
// const posthtml = require('posthtml');
// const uglify = require('posthtml-minify-classnames');
// const { minify } = require("terser");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(eleventySass);

  // eleventyConfig.addTransform('htmlmin', async function(content, outputPath) {
  //   if (outputPath.endsWith('.html')) {
  //     const { html } = await posthtml().use(uglify()).process(content);

  //     let minified = htmlmin.minify(html, {
  //       useShortDoctype: true,
  //       removeComments: true,
  //       collapseWhitespace: true
  //     });
  //     return minified;
  //   }
  //   return content;
  // });

//   eleventyConfig.addFilter('embeddableYoutubeLink', (link) => {
//     return link.replace('watch?v=', 'embed/');
//   });

//   eleventyConfig.addFilter('replaceCommasWithWhitespaces', (list) => {
//     return String(list).replaceAll(',', ' ');
//   });

//   eleventyConfig.addFilter('toUpper', (str) => {
//     return str.toUpperCase();
//   });

//   eleventyConfig.addFilter("findAll", function findAll(collection = [], names = []) {
//     let result = [];
//     names.forEach(name => {
//       let found = collection.find(project => project.data.title[0].toLowerCase() === name.toLowerCase());
//       if (found) {
//         result.push(found);
//       }
//     });
//     return result.length ? result : null;
//   });

//   eleventyConfig.addFilter("findByCategory", function find(collection = [], category = "", ...namesToExclude) {
//     return collection.filter(project => project.data.categories.includes(category) && !namesToExclude.includes(project.data.title[0]));
//   });

//   eleventyConfig.addFilter("keepOnly", function keepOnly(collection = [], number) {
//     return collection.slice(0, number);
//   });

//   eleventyConfig.addNunjucksAsyncFilter("jsmin", async function (
//     code,
//     callback
//   ) {
//     try {
//       const minified = await minify(code);
//       callback(null, minified.code);
//     } catch (err) {
//       console.error("Terser error: ", err);
//       // Fail gracefully.
//       callback(null, code);
//     }
//   });

  eleventyConfig.addFilter('prefixWithAssetsPath', (path) => {
    return '/assets/images/' + path;
  });

  eleventyConfig.addPassthroughCopy('./src/assets');

  return {
    dir: {
      input: 'src',
      output: 'public',
    },
  };
};