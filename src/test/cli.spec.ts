import test, { before } from 'ava';
import { execFileSync, ExecFileSyncOptionsWithBufferEncoding } from 'child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const runCli = (args: string[], options: ExecFileSyncOptionsWithBufferEncoding = {}) =>
	execFileSync(
		process.execPath,
		['--require', require.resolve('ts-node/register'), resolve(__dirname, '..', 'cli.ts'), ...args],
		options,
	);

before(() => {
	const filesToDelete = [
		resolve(__dirname, 'basic', 'test.pdf'),
		resolve(__dirname, 'basic', 'test-stdio.pdf'),
		resolve(__dirname, 'nested', 'root.pdf'),
		resolve(__dirname, 'nested', 'level-one', 'one.pdf'),
		resolve(__dirname, 'nested', 'level-one', 'level-two', 'two.pdf'),
	];

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

test('compile the basic example to pdf using --basedir', (t) => {
	t.notThrows(() => runCli([resolve(__dirname, 'basic', 'test.md'), '--basedir', resolve(__dirname, 'basic')]));
	t.notThrows(() => readFileSync(resolve(__dirname, 'basic', 'test.pdf')));
});

test('compile the basic example using binary-safe stdio on Windows and Unix', (t) => {
	const output = runCli(['--basedir', resolve(__dirname, 'basic')], {
		input: readFileSync(resolve(__dirname, 'basic', 'test.md')),
	});
	t.true(output.subarray(0, 5).equals(Buffer.from('%PDF-')));
	writeFileSync(resolve(__dirname, 'basic', 'test-stdio.pdf'), output);
});

test('compile the nested example to pdfs', (t) => {
	t.notThrows(() =>
		runCli(['root.md', join('level-one', 'one.md'), join('level-one', 'level-two', 'two.md')], {
			cwd: resolve(__dirname, 'nested'),
		}),
	);
	t.notThrows(() => readFileSync(resolve(__dirname, 'nested', 'root.pdf')));
	t.notThrows(() => readFileSync(resolve(__dirname, 'nested', 'level-one', 'one.pdf')));
	t.notThrows(() => readFileSync(resolve(__dirname, 'nested', 'level-one', 'level-two', 'two.pdf')));
});

test('CLI flags override front matter and disable built-in renderers', (t) => {
	const output = runCli(['--as-html', '--no-math', '--no-mermaid'], {
		input: '---\nmath: true\nmermaid: true\n---\n$x$\n\n```mermaid\ngraph LR\nA-->B\n```',
	}).toString();
	t.false(output.includes('class="katex"'));
	t.false(output.includes('<svg'));
	t.true(output.includes('<code class="hljs mermaid">'));
});
