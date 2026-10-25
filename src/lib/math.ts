import { readFileSync } from 'fs';
import katex from 'katex';
import { marked } from 'marked';
import { dirname, extname, resolve } from 'path';

/** Find an unescaped closing delimiter without changing the original TeX. */
const findClosingDelimiter = (source: string, delimiter: string, start: number) => {
	for (let index = source.indexOf(delimiter, start); index !== -1; index = source.indexOf(delimiter, index + 1)) {
		let backslashes = 0;
		for (let cursor = index - 1; source[cursor] === '\\'; cursor--) {
			backslashes++;
		}

		if (backslashes % 2 === 0) {
			return index;
		}
	}

	return -1;
};

const tokenizeMath = (source: string, block: boolean) => {
	const opening = block ? /^ {0,3}(\$\$|\\\[)/.exec(source) : /^(\$\$|\$|\\\()/.exec(source);
	if (!opening?.[1]) {
		return;
	}

	const delimiter = opening[1];
	const closing = delimiter === '\\(' ? '\\)' : delimiter === '\\[' ? '\\]' : delimiter;
	const start = opening[0].length;

	// Follow the usual dollar-math whitespace rules to avoid interpreting prices as formulas.
	if (delimiter === '$' && /\s/.test(source[start] ?? '')) {
		return;
	}

	const end = findClosingDelimiter(source, closing, start);
	if (end === -1 || end === start) {
		return;
	}

	const text = source.slice(start, end);
	if (
		delimiter === '$' &&
		(/[\n`]/.test(text) || /\s/.test(source[end - 1] ?? '') || /\d/.test(source[end + 1] ?? ''))
	) {
		return;
	}

	const raw = source.slice(0, end + closing.length);
	if (block && !/^(?:[^\S\n]*\n|[^\S\n]*$)/.test(source.slice(raw.length))) {
		return;
	}

	return { type: block ? 'blockMath' : 'inlineMath', raw, text, display: delimiter !== '$' && delimiter !== '\\(' };
};

const renderMath = (token: marked.Tokens.Generic) => {
	try {
		return katex.renderToString(token.text as string, { displayMode: token.display as boolean, trust: false });
	} catch (error) {
		throw new Error(`Invalid LaTeX formula: ${(error as Error).message}`);
	}
};

/** Tokenize before Markdown consumes TeX backslashes, underscores, or matrix row separators. */
export const mathExtension: marked.MarkedExtension = {
	extensions: [
		{
			name: 'blockMath',
			level: 'block',
			start: (source) => source.search(/(?:^|\n) {0,3}(?:\$\$|\\\[)/),
			tokenizer: (source) => tokenizeMath(source, true),
			renderer: renderMath,
		},
		{
			name: 'inlineMath',
			level: 'inline',
			start: (source) => source.search(/\$|\\\(/),
			tokenizer: (source) => tokenizeMath(source, false),
			renderer: renderMath,
		},
	],
};

let stylesheet: string | undefined;

/** Embed the local font files so HTML exports are portable and conversion works offline. */
export const getMathStylesheet = () => {
	if (!stylesheet) {
		const cssPath = require.resolve('katex/dist/katex.min.css');
		stylesheet = readFileSync(cssPath, 'utf-8').replace(/url\(([^)]+)\)/g, (_, fontPath: string) => {
			const filename = resolve(dirname(cssPath), fontPath);
			const format = extname(filename).slice(1);
			return `url(data:font/${format};base64,${readFileSync(filename).toString('base64')})`;
		});
	}

	return stylesheet;
};
