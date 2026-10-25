import test from 'ava';
import puppeteer from 'puppeteer';
import { mdToPdf } from '..';

const markdown = `# 中文公式与图表

Inline $x_1^2 + y_2^2 = z^2$.

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

\`\`\`js
const formula = "$x_1$";
\`\`\`
`;

test('formulas and fonts export to portable offline HTML', async (t) => {
	const html = await mdToPdf({ content: markdown }, { as_html: true });
	t.true(html.content.includes('class="katex"'));
	t.true(html.content.includes('data:font/woff2;base64,'));
	t.false(html.content.includes('src="https://'));

	const browser = await puppeteer.launch();
	try {
		const page = await browser.newPage();
		const requests: string[] = [];
		await page.setRequestInterception(true);
		page.on('request', (request) => {
			if (request.url().startsWith('data:')) {
				void request.continue();
			} else {
				requests.push(request.url());
				void request.abort();
			}
		});
		await page.setContent(html.content);
		await page.evaluate(async () => document.fonts.ready);

		const result = await page.evaluate(() => ({
			formulas: document.querySelectorAll('.katex').length,
			codeFont: getComputedStyle(document.querySelector('pre code')!).fontFamily,
			code: document.querySelector('pre code')!.textContent,
			fontLoaded: document.fonts.check('16px KaTeX_Main'),
		}));

		t.is(result.formulas, 2);
		t.regex(result.codeFont, /^Consolas,/);
		t.true(result.code!.includes('$x_1$'));
		t.true(result.fontLoaded);
		t.deepEqual(requests, []);
	} finally {
		await browser.close();
	}
});

test('built-in math rendering can be disabled in config and front matter', async (t) => {
	const { content } = await mdToPdf({ content: `---\nmath: false\n---\n${markdown}` }, { as_html: true });
	t.false(content.includes('class="katex"'));
});
