import type { Dictionary, Optional } from '@oardi/ts-types';
import type { ParseResult, UnparseConfig, UnparseObject } from 'papaparse';
import pkg from 'papaparse';
import { CsvParseError } from './csv-parse.error.js';
import type { CsvParseOptions, CsvParseResult, CsvValidationIssue } from './csv.types.js';

const { parse, unparse } = pkg;

export class Csv {
	static unparse<T>(data: T[] | UnparseObject<T>, config?: UnparseConfig): string {
		return unparse(data, config);
	}

	/** Parse a complete CSV document. T alone does not validate the input at runtime. */
	static async parse<T = Dictionary<string>, TRow = Dictionary<string>>(
		content: string | File,
		options: CsvParseOptions<T, TRow> = {}
	): Promise<CsvParseResult<T>> {
		const {
			errorMode = 'collect',
			requiredColumns = [],
			rejectDuplicateHeaders = false,
			mapRow,
			validateRow,
			...config
		} = options;
		if (config.header === false && requiredColumns.length > 0) {
			throw new TypeError('requiredColumns requires header: true.');
		}
		if (config.header === false && rejectDuplicateHeaders) {
			throw new TypeError('rejectDuplicateHeaders requires header: true.');
		}

		const duplicateHeaders = new Set<string>();
		const parsed = await new Promise<ParseResult<TRow>>((resolve, reject) => {
			let failed = false;
			const seenHeaders = new Set<string>();
			// FileReader invokes parser callbacks after the Promise executor has returned.
			const guard = <TArgs extends unknown[], TResult>(
				callback: (...args: TArgs) => TResult,
				fallback: (...args: TArgs) => TResult
			) =>
				function (this: unknown, ...args: TArgs): TResult {
					if (!failed) {
						try {
							return callback.apply(this, args);
						} catch (error) {
							failed = true;
							reject(error);
						}
					}
					return fallback(...args);
				};
			const transformHeader =
				config.transformHeader || rejectDuplicateHeaders
					? guard(
							function (this: unknown, header: string, index: number) {
								const transformed = config.transformHeader
									? config.transformHeader.call(this, header, index)
									: header;
								// Keep each pass separate: Papa Parse may transform skipped rows or renamed headers.
								if (rejectDuplicateHeaders) {
									if (index === 0) seenHeaders.clear();
									if (seenHeaders.has(transformed))
										duplicateHeaders.add(transformed);
									seenHeaders.add(transformed);
								}
								return transformed;
							},
							header => header
						)
					: undefined;

			parse<TRow>(content, {
				header: true,
				skipEmptyLines: 'greedy',
				...config,
				delimiter:
					typeof config.delimiter === 'function'
						? guard(config.delimiter, () => ',')
						: config.delimiter,
				beforeFirstChunk:
					config.beforeFirstChunk && guard(config.beforeFirstChunk, () => undefined),
				transformHeader,
				transform: config.transform && guard(config.transform, value => value),
				dynamicTyping:
					typeof config.dynamicTyping === 'function'
						? guard(config.dynamicTyping, () => false)
						: config.dynamicTyping,
				complete: resolve,
				error: reject,
			});
		});

		const result: CsvParseResult<T> = {
			data: [],
			errors: [...parsed.errors],
			meta: parsed.meta,
		};
		const missingColumns = requiredColumns.filter(
			column => !parsed.meta.fields?.includes(column)
		);
		for (const column of missingColumns) {
			result.errors.push({
				type: 'Schema',
				code: 'MissingColumn',
				message: `Missing required column: ${column}`,
			});
		}
		for (const header of duplicateHeaders) {
			result.errors.push({
				type: 'Schema',
				code: 'DuplicateHeader',
				message: `Duplicate header: ${header}`,
			});
		}

		// An invalid schema makes every row unusable; do not invoke application callbacks.
		if (missingColumns.length === 0 && duplicateHeaders.size === 0) {
			parsed.data.forEach((rawRow, rowIndex) => {
				let row: T;
				try {
					row = mapRow ? mapRow(rawRow, rowIndex) : (rawRow as unknown as T);
				} catch (error) {
					result.errors.push({
						type: 'Mapping',
						code: 'RowMappingFailed',
						message: error instanceof Error ? error.message : String(error),
						row: rowIndex,
					});
					return;
				}

				let validationResult: Optional<string | readonly CsvValidationIssue[]>;
				try {
					validationResult = validateRow?.(row, rowIndex);
				} catch (error) {
					validationResult = error instanceof Error ? error.message : String(error);
				}
				const validationIssues: readonly CsvValidationIssue[] =
					typeof validationResult === 'string'
						? [{ message: validationResult }]
						: (validationResult ?? []);
				if (validationIssues.length > 0) {
					for (const issue of validationIssues) {
						result.errors.push({
							type: 'Validation',
							code: 'RowValidationFailed',
							message: issue.message,
							row: rowIndex,
							...(issue.column === undefined ? {} : { column: issue.column }),
						});
					}
					return;
				}
				result.data.push(row);
			});
		}

		if (errorMode === 'throw' && result.errors.length > 0) {
			throw new CsvParseError(result);
		}
		return result;
	}
}
