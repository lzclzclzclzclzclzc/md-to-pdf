import { Page } from 'puppeteer';

interface MermaidApi {
	initialize: (config: { startOnLoad: boolean; securityLevel: string; fontFamily: string }) => void;
	run: (options: { nodes: HTMLElement[] }) => Promise<void>;
}

export const renderMermaid = async (page: Page) => {
	const count = await page.evaluate(() => {
		const blocks = document.querySelectorAll<HTMLElement>('pre > code.mermaid, pre > code.language-mermaid');
		for (const block of blocks) {
			const diagram = document.createElement('div');
			diagram.className = 'mermaid';
			diagram.textContent = block.textContent;
			block.parentElement?.replaceWith(diagram);
		}

		return blocks.length;
	});

	if (count === 0) {
		return;
	}

	const script = await page.addScriptTag({ path: require.resolve('mermaid/dist/mermaid.min.js') });
	try {
		await page.evaluate(async () => {
			const { mermaid } = window as unknown as { mermaid: MermaidApi };
			mermaid.initialize({
				startOnLoad: false,
				securityLevel: 'strict',
				fontFamily: getComputedStyle(document.body).fontFamily,
			});
			await mermaid.run({ nodes: [...document.querySelectorAll<HTMLElement>('.mermaid')] });
		});
	} catch (error) {
		throw new Error(`Failed to render Mermaid diagram: ${(error as Error).message}`);
	} finally {
		// The SVGs are already rendered; HTML exports do not need the large runtime script.
		await script.evaluate((element) => element.remove());
	}
};
