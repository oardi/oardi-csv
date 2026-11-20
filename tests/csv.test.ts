// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Csv, CsvParseError } from '@oardi/csv';
import type { CsvParseOptions } from '@oardi/csv';

afterEach(() => vi.restoreAllMocks());

describe('Csv', () => {
	it('reads headers, quoted fields and skips blank or whitespace-only rows by default', async () => {
		const result = await Csv.parse('id,name\n001,"Ada, Lovelace"\n\n  \n002,Grace\n');

		expect(result.data).toEqual([
			{ id: '001', name: 'Ada, Lovelace' },
			{ id: '002', name: 'Grace' },
		]);
		expect(result.errors).toEqual([]);
	});

	it('accepts parser options and checks required columns after transforming headers', async () => {
		const result = await Csv.parse<{ id: string; age: number }>(' ID ; Age \n001;36', {
			delimiter: ';',
			transformHeader: header => header.trim().toLowerCase(),
			dynamicTyping: { age: true },
			requiredColumns: ['id', 'age'],
		});

		expect(result.data).toEqual([{ id: '001', age: 36 }]);
		expect(result.errors).toEqual([]);
	});

	it('allows overriding the empty-line default', async () => {
		const result = await Csv.parse<string[], string[]>('Ada,36\n\nGrace,40', {
			header: false,
			delimiter: ',',
			skipEmptyLines: false,
		});

		expect(result.data).toEqual([['Ada', '36'], [''], ['Grace', '40']]);
	});

	it('collects parser errors and retains parsed rows by default', async () => {
		const result = await Csv.parse('id,name\n1,Ada\n2');

		expect(result.data).toEqual([{ id: '1', name: 'Ada' }, { id: '2' }]);
		expect(result.errors).toContainEqual(expect.objectContaining({ code: 'TooFewFields' }));
	});

	it.each(['id,name\n1,Ada\n2', 'id,name\n1,"Ada'])(
		'rejects malformed CSV in strict mode: %j',
		async csv => {
			await expect(Csv.parse(csv, { errorMode: 'throw' })).rejects.toBeInstanceOf(
				CsvParseError
			);
		}
	);

	it('reports every missing column and skips row callbacks when the schema is incomplete', async () => {
		const mapRow = vi.fn();
		const result = await Csv.parse('id,name\n1,Ada', {
			requiredColumns: ['id', 'email', 'age'],
			mapRow,
		});

		expect(result.data).toEqual([]);
		expect(result.errors).toEqual([
			{ type: 'Schema', code: 'MissingColumn', message: 'Missing required column: email' },
			{ type: 'Schema', code: 'MissingColumn', message: 'Missing required column: age' },
		]);
		expect(mapRow).not.toHaveBeenCalled();
	});

	it('rejects a missing column in strict mode, including an empty document', async () => {
		await expect(
			Csv.parse('', {
				delimiter: ',',
				requiredColumns: ['id'],
				errorMode: 'throw',
			})
		).rejects.toMatchObject({
			result: { data: [], errors: [expect.objectContaining({ code: 'MissingColumn' })] },
		});
	});

	it('rejects column requirements without headers', async () => {
		await expect(
			Csv.parse('1,Ada', { header: false, requiredColumns: ['id'] })
		).rejects.toThrow('requiredColumns requires header: true.');
	});

	it('maps rows before validating and excludes rejected rows from collected data', async () => {
		const result = await Csv.parse<{ name: string; age: number }>(
			'name,age\nAda,36\nGrace,invalid\nLinus,55',
			{
				mapRow: row => ({ name: row['name'], age: Number(row['age']) }),
				validateRow: row =>
					Number.isFinite(row.age) ? undefined : 'Age must be a number.',
			}
		);

		expect(result.data).toEqual([
			{ name: 'Ada', age: 36 },
			{ name: 'Linus', age: 55 },
		]);
		expect(result.errors).toEqual([
			{
				type: 'Validation',
				code: 'RowValidationFailed',
				message: 'Age must be a number.',
				row: 1,
			},
		]);
	});

	it('reports mapping failures while continuing with subsequent rows', async () => {
		const result = await Csv.parse('id,name\n1,Ada\n2,Grace', {
			mapRow: row => {
				if (row['id'] === '1') throw new Error('Unsupported ID.');
				return row;
			},
		});

		expect(result.data).toEqual([{ id: '2', name: 'Grace' }]);
		expect(result.errors).toEqual([
			{
				type: 'Mapping',
				code: 'RowMappingFailed',
				message: 'Unsupported ID.',
				row: 0,
			},
		]);
	});

	it('uses logical data row indexes even with skipped blanks and multiline quoted fields', async () => {
		const indexes: number[] = [];
		const result = await Csv.parse('id,name\n\n1,"Ada\nLovelace"\n\n2,Grace', {
			validateRow: (_row, rowIndex) => {
				indexes.push(rowIndex);
				return rowIndex === 1 ? 'Rejected row.' : undefined;
			},
		});

		expect(indexes).toEqual([0, 1]);
		expect(result.errors[0]).toMatchObject({ row: 1 });
	});

	it('includes partial results and a readable row number in strict validation failures', async () => {
		await expect(
			Csv.parse('id,name\n1,Ada\n2,Grace', {
				errorMode: 'throw',
				validateRow: (_row, rowIndex) =>
					rowIndex === 1 ? 'Name is not allowed.' : undefined,
			})
		).rejects.toMatchObject({
			name: 'CsvParseError',
			message: 'CSV import failed at data row 2: Name is not allowed.',
			result: {
				data: [{ id: '1', name: 'Ada' }],
				errors: [expect.objectContaining({ row: 1 })],
			},
		});
	});

	it('collects exceptions from validators, including empty error messages', async () => {
		const result = await Csv.parse('id,name\n1,Ada', {
			validateRow: () => {
				throw new Error('');
			},
		});

		expect(result.data).toEqual([]);
		expect(result.errors[0]).toMatchObject({
			code: 'RowValidationFailed',
			message: '',
			row: 0,
		});
	});

	it('parses browser Files and forwards their encoding', async () => {
		const readAsText = vi.spyOn(FileReader.prototype, 'readAsText');
		const file = new File(['id;name\n1;Ada'], 'people.csv');
		const result = await Csv.parse(file, { delimiter: ';', encoding: 'utf-8' });

		expect(result.data).toEqual([{ id: '1', name: 'Ada' }]);
		expect(readAsText).toHaveBeenCalledWith(expect.any(Blob), 'utf-8');
	});

	it('rejects file reading failures even in collect mode', async () => {
		const error = new DOMException('Cannot read file.', 'NotReadableError');
		vi.spyOn(FileReader.prototype, 'error', 'get').mockReturnValue(error);
		vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (
			this: FileReader
		) {
			this.dispatchEvent(new ProgressEvent('error'));
		});

		await expect(Csv.parse(new File(['id,name'], 'people.csv'))).rejects.toBe(error);
	});

	it('preserves parser callback arguments and results for browser Files', async () => {
		const delimiter = vi.fn(() => ';');
		const beforeFirstChunk = vi.fn((chunk: string) => chunk.replace('preamble\n', ''));
		const transformHeader = vi.fn((header: string) => header.trim().toLowerCase());
		const transform = vi.fn((value: string) => value.trim());
		const dynamicTyping = vi.fn((field: string | number) => field === 'age');
		const csv = 'preamble\n Name ; Age \n Ada ; 36 ';
		const result = await Csv.parse(new File([csv], 'people.csv'), {
			delimiter,
			beforeFirstChunk,
			transformHeader,
			transform,
			dynamicTyping,
		});

		expect(result.data).toEqual([{ name: 'Ada', age: 36 }]);
		expect(result.errors).toEqual([]);
		expect(beforeFirstChunk).toHaveBeenCalledWith(csv);
		expect(delimiter).toHaveBeenCalledWith(' Name ; Age \n Ada ; 36 ');
		expect(transformHeader).toHaveBeenCalledWith(' Name ', 0);
		expect(transform).toHaveBeenCalledWith(' 36 ', 'age');
		expect(dynamicTyping).toHaveBeenCalledWith('age');
	});

	describe.each(['string', 'File'] as const)(
		'parser callback exceptions with %s input',
		input => {
			it.each(['collect', 'throw'] as const)('rejects in %s mode', async errorMode => {
				const failure = new Error('Invalid CSV value.');
				for (const callback of [
					'delimiter',
					'beforeFirstChunk',
					'transformHeader',
					'transform',
					'dynamicTyping',
				] as const) {
					const mapRow = vi.fn();
					const validateRow = vi.fn();
					const throwingCallback = vi.fn(() => {
						throw failure;
					});
					const options: CsvParseOptions = {
						errorMode,
						mapRow,
						validateRow,
						[callback]: throwingCallback,
					};
					const csv = 'id,name\n1,Ada\n2,Grace';
					const content = input === 'string' ? csv : new File([csv], 'people.csv');

					await expect(Csv.parse(content, options)).rejects.toBe(failure);
					expect(throwingCallback).toHaveBeenCalledTimes(1);
					expect(mapRow).not.toHaveBeenCalled();
					expect(validateRow).not.toHaveBeenCalled();
				}
			});
		}
	);

	it('exports an explicit column order with configurable CSV formatting', () => {
		expect(
			Csv.unparse([{ name: 'Ada, Lovelace', id: '001' }], {
				columns: ['id', 'name'],
				delimiter: ';',
				newline: '\n',
			})
		).toBe('id;name\n001;Ada, Lovelace');
	});

	it('round-trips quoted delimiters, quotes and multiline values', async () => {
		const data = [{ id: '001', name: 'Ada, "Lovelace"\nNotes' }];
		const result = await Csv.parse(Csv.unparse(data));

		expect(result.data).toEqual(data);
		expect(result.errors).toEqual([]);
	});
});
