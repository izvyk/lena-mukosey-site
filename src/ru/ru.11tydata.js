module.exports = {
	permalink: function ({ page }) {
        // if (page.filePathStem.endsWith('index'))
        //     return "/";

		return `/${this.slugify(page.fileSlug)}/`;
	},
};