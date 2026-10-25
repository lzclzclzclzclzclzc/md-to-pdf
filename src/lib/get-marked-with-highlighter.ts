import hljs from 'highlight.js';
import { marked } from 'marked';

export const getMarked = (options: marked.MarkedOptions, extensions: marked.MarkedExtension[]) => {
	// Marked 4 uses a singleton. Do not leak extensions or renderers into the next document.
	marked.setOptions(marked.getDefaults());
	marked.setOptions({
		highlight: (code, languageName) => {
			const language = hljs.getLanguage(languageName) ? languageName : 'plaintext';

			return hljs.highlight(code, { language }).value;
		},
		langPrefix: 'hljs ',
		...options,
	});
	marked.use(...extensions);
	return marked;
};
