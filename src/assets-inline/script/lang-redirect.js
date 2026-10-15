(function () {
	// Language redirect: send visitors whose browser is not set to Russian
	// to the English version. Runs once per entry, before first paint.
	// Uses the browser language (navigator.languages) — no network, no
	// third-party geo API, respects an explicit manual language switch.

	try {
		var KEY = 'langChoice';

		// Only Russian pages redirect; English pages are the target.
		if (document.documentElement.lang !== 'ru') return;

		// Respect an explicit manual language switch.
		if (localStorage.getItem(KEY)) return;

		// Only redirect on first entry — internal navigation, refreshes and
		// back-button returns stay put.
		if (sessionStorage.getItem(KEY)) return;
		if (document.referrer && document.referrer.indexOf(location.origin) === 0) return;

		// If any preferred language is Russian (ru, ru-RU, be, uk fallbacks
		// are NOT included on purpose — only actual Russian), stay put.
		var languages = navigator.languages || [navigator.language || ''];
		for (var i = 0; i < languages.length; i++) {
			if (languages[i] && languages[i].toLowerCase().indexOf('ru') === 0) return;
		}

		// '/info/' -> '/en/info/', '/' -> '/en/', preserving query and hash.
		var path = location.pathname;
		var target = path === '/' ? '/en/' : '/en' + path;
		target += location.search + location.hash;

		sessionStorage.setItem(KEY, 'auto');
		location.replace(target);
	} catch (e) {
		// Never break the page over a failed redirect.
	}
})();
