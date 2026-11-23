import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const temporary = mkdtempSync(join(tmpdir(), 'oardi-csv-package-'));
const npm = (args, cwd) =>
	execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

try {
	const [archive] = JSON.parse(
		npm(['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], root)
	);
	assert(archive.files.some(file => file.path === 'dist/index.mjs'));
	assert(archive.files.some(file => file.path === 'dist/index.js'));
	assert(archive.files.some(file => file.path === 'dist/index.d.ts'));
	assert(
		archive.files.every(
			file =>
				file.path.startsWith('dist/') ||
				['LICENSE', 'package.json', 'readme.md'].includes(file.path)
		)
	);

	writeFileSync(
		join(temporary, 'package.json'),
		JSON.stringify({ private: true, type: 'module' })
	);
	npm(
		[
			'install',
			'--ignore-scripts',
			'--no-audit',
			'--no-fund',
			'--package-lock=false',
			join(temporary, archive.filename),
		],
		temporary
	);

	const manifest = JSON.parse(
		readFileSync(join(temporary, 'node_modules/@oardi/csv/package.json'), 'utf8')
	);
	assert.equal(manifest.private, true);
	assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
		'@oardi/ts-types',
		'@types/papaparse',
		'papaparse',
	]);
	assert.equal(manifest.dependencies['@oardi/ts-types'], 'github:oardi/oardi-ts-types#v0.1.0');
	assert.equal(Object.keys(manifest.peerDependencies ?? {}).length, 0);

	writeFileSync(
		join(temporary, 'runtime.mjs'),
		`
        import assert from 'node:assert/strict';
        import { createRequire } from 'node:module';
        import * as esm from '@oardi/csv';
        const require = createRequire(import.meta.url);
        const cjs = require('@oardi/csv');
        assert.deepEqual(Object.keys(esm).sort(), ['Csv', 'CsvParseError']);
        assert.deepEqual(Object.keys(cjs).sort(), ['Csv', 'CsvParseError']);
        assert.equal(esm.Csv, cjs.Csv);
        assert.equal(esm.CsvParseError, cjs.CsvParseError);
        const result = await esm.Csv.parse('name,age\\nAda,36\\nGrace,invalid', {
            requiredColumns: ['name', 'age'],
            mapRow: row => ({ name: row.name, age: Number(row.age) }),
            validateRow: row => Number.isFinite(row.age) ? undefined : 'Invalid age.',
        });
        assert.deepEqual(result.data, [{ name: 'Ada', age: 36 }]);
        assert.equal(result.errors[0].row, 1);
        const validationResult = await cjs.Csv.parse('id,name\\n1,Ada\\n2,Grace', {
            validateRow: (_row, rowIndex) => rowIndex === 0 ? [
                { message: 'Invalid ID.', column: 'id' },
                { message: 'Invalid record.' },
            ] : [],
        });
        assert.deepEqual(validationResult.data, [{ id: '2', name: 'Grace' }]);
        assert.deepEqual(validationResult.errors, [
            { type: 'Validation', code: 'RowValidationFailed', message: 'Invalid ID.', row: 0, column: 'id' },
            { type: 'Validation', code: 'RowValidationFailed', message: 'Invalid record.', row: 0 },
        ]);
        await assert.rejects(cjs.Csv.parse('id,name\\n001', { errorMode: 'throw' }), esm.CsvParseError);
        const exported = cjs.Csv.unparse(result.data, { columns: ['name', 'age'], newline: '\\n' });
        assert.equal(exported, 'name,age\\nAda,36');
    `
	);
	execFileSync(process.execPath, ['runtime.mjs'], { cwd: temporary, stdio: 'inherit' });

	for (const name of ['types.mts', 'types.cts']) {
		copyFileSync(join(root, 'tests', name), join(temporary, name));
	}
	const config = JSON.parse(readFileSync(join(root, 'tsconfig.test.json'), 'utf8'));
	config.include = ['types.mts', 'types.cts'];
	writeFileSync(join(temporary, 'tsconfig.json'), JSON.stringify(config));
	execFileSync(
		process.execPath,
		[
			join(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc'),
			'--project',
			join(temporary, 'tsconfig.json'),
		],
		{ cwd: temporary, stdio: 'inherit' }
	);
	console.log(
		'Packed ESM/CommonJS, dependency installation, CSV behavior, and TypeScript contracts passed.'
	);
} finally {
	rmSync(temporary, { recursive: true, force: true });
}
