import test, { before } from 'ava';
import { readFileSync, unlinkSync } from 'fs';
import { basename, resolve } from 'path';
import puppeteer from 'puppeteer';
import { mdToPdf } from '..';

const getPdfTextContent = async (content: Buffer) => {
	// Use the browser build to avoid native canvas / Node ABI dependencies on Windows.
	const browser = await puppeteer.launch();
	try {
		const page = await browser.newPage();
		await page.addScriptTag({ path: require.resolve('pdfjs-dist/build/pdf.js') });
		await page.addScriptTag({ path: require.resolve('pdfjs-dist/build/pdf.worker.js') });
		return await page.evaluate(
			async (data: number[]) => {
				const { pdfjsLib } = window as unknown as {
					pdfjsLib: {
						getDocument: (options: { data: Uint8Array }) => {
							promise: Promise<{
								getPage: (pageNumber: number) => Promise<{
									getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
								}>;
							}>;
						};
					};
				};
				const doc = await pdfjsLib.getDocument({ data: new Uint8Array(data) }).promise;
				const pdfPage = await doc.getPage(1);
				return (await pdfPage.getTextContent()).items.map(({ str }) => str ?? '').join('');
			},
			[...content],
		);
	} finally {
		await browser.close();
	}
};

before(() => {
	const filesToDelete = [resolve(__dirname, 'basic', 'api-test.pdf'), resolve(__dirname, 'basic', 'api-test.html')];

	for (const file of filesToDelete) {
		try {
			unlinkSync(file);
		} catch (error) {
			if ((error as { code: string }).code !== 'ENOENT') {
				throw error;
			}
		}
	}
});

test('compile the basic example to pdf', async (t) => {
	const pdf = await mdToPdf({ path: resolve(__dirname, 'basic', 'test.md') });

	t.is(pdf.filename, '');
	t.truthy(pdf.content);
	t.truthy(pdf.content instanceof Buffer);
});

test('compile the basic example to pdf and write to disk', async (t) => {
	const pdf = await mdToPdf(
		{ path: resolve(__dirname, 'basic', 'test.md') },
		{ dest: resolve(__dirname, 'basic', 'api-test.pdf') },
	);

	t.is(basename(pdf.filename!), 'api-test.pdf');

	t.notThrows(() => readFileSync(resolve(__dirname, 'basic', 'api-test.pdf'), 'utf-8'));
});

test('compile some content to html', async (t) => {
	const html = await mdToPdf({ content: '# Foo' }, { as_html: true });

	t.is(html.filename, '');
	t.is(typeof html.content, 'string');
	t.truthy(html.content.includes('<h1 id="foo">Foo</h1>'));
});

test('compile the basic example to html and then to pdf', async (t) => {
	const { content } = await mdToPdf({ path: resolve(__dirname, 'basic', 'test.md') }, { as_html: true });

	await mdToPdf(
		{ content },
		{ dest: resolve(__dirname, 'basic', 'api-test-from-html.pdf'), basedir: resolve(__dirname, 'basic') },
	);

	t.notThrows(() => readFileSync(resolve(__dirname, 'basic', 'api-test-from-html.pdf'), 'utf-8'));
});

test('compile the basic example to html and write to disk', async (t) => {
	const html = await mdToPdf(
		{ path: resolve(__dirname, 'basic', 'test.md') },
		{ dest: resolve(__dirname, 'basic', 'api-test.html'), as_html: true },
	);

	t.is(basename(html.filename!), 'api-test.html');

	t.notThrows(() => readFileSync(resolve(__dirname, 'basic', 'api-test.html'), 'utf-8'));
});

test('compile the MathJax test', async (t) => {
	const pdf = await mdToPdf({ path: resolve(__dirname, 'mathjax', 'math.md') });

	t.is(pdf.filename, '');
	t.truthy(pdf.content);

	const textContent = await getPdfTextContent(pdf.content);

	t.true(textContent.startsWith('Formulas with MathJax'));
	t.regex(textContent, /a\s≠\s0/);
});

test('the JS engine with `js` tag is disabled by default', async (t) => {
	const css = '`body::before { display: block; content: "${"i am injected"}"}`'; // eslint-disable-line no-template-curly-in-string

	const pdf = await mdToPdf({ content: `---js\n{ css: ${css} }\n---` });

	const textContent = await getPdfTextContent(pdf.content);

	t.is(textContent, '');
});

test('the JS engine with `javascript` tag is disabled by default', async (t) => {
	const css = '`body::before { display: block; content: "${"i am injected"}"}`'; // eslint-disable-line no-template-curly-in-string

	const pdf = await mdToPdf({ content: `---javascript\n{ css: ${css} }\n---` });

	const textContent = await getPdfTextContent(pdf.content);

	t.is(textContent, '');
});

test('the JS engine for front-matter can be enabled', async (t) => {
	const css = '`body::before { display: block; content: "${"i am injected"}"}`'; // eslint-disable-line no-template-curly-in-string

	const pdf = await mdToPdf({ content: `---js\n{ css: ${css} }\n---` }, { gray_matter_options: undefined });

	const textContent = await getPdfTextContent(pdf.content);

	t.is(textContent, 'i am injected');
});
