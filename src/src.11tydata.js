const sass = require('sass');
const path = require('path');
const fs = require('fs');

module.exports = {
  eleventyComputed: {
    scss: async (data) => {
      const inputPath = data.page.inputPath;
      // Skip if inputPath is missing or if it's a scss file itself
      if (!inputPath || inputPath.endsWith('.scss') || inputPath.endsWith('.sass')) return "";

      const p = path.parse(inputPath);
      // We are looking for a scss or sass file with the same name in the same directory
      let scssPath = path.join(p.dir, p.name + '.scss');

      if (!fs.existsSync(scssPath)) {
        scssPath = path.join(p.dir, p.name + '.sass');
      }

      if (fs.existsSync(scssPath)) {
        try {
          const result = await sass.compileAsync(scssPath, {
             loadPaths: ['src/_includes'],
             style: 'compressed'
          });
          return result.css;
        } catch (err) {
          console.error(`Error compiling sass for ${inputPath} (searching for ${scssPath}):`, err);
          return "";
        }
      }
      return "";
    }
  }
};
