// @vitest-environment node

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { Csv, CsvParseError } from '@oardi/csv';

const require = createRequire(import.meta.url);
const cjs = require('@oardi/csv');

describe('Node and module formats', () => {
	it('shares classes between ESM and CommonJS', () => {
		expect(Csv).toBe(cjs.Csv);
		expect(CsvParseError).toBe(cjs.CsvParseError);
	});
	it('parses CSV without browser globals', async () => {
		expect(typeof FileReader).toBe('undefined');
		const result = await Csv.parse('id,name\n001,Ada', { errorMode: 'throw' });
		expect(result.data).toEqual([{ id: '001', name: 'Ada' }]);
	});
	it('recognizes CommonJS errors through the ESM export', async () => {
		await expect(cjs.Csv.parse('id,name\n001', { errorMode: 'throw' })).rejects.toBeInstanceOf(
			CsvParseError
		);
	});
	it('rejects duplicate headers through CommonJS with the shared error class', async () => {
		await expect(
			cjs.Csv.parse('id,name\n001,Ada', {
				transformHeader: () => 'column',
				rejectDuplicateHeaders: true,
				errorMode: 'throw',
			})
		).rejects.toBeInstanceOf(CsvParseError);
	});
});
