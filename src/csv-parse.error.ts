import type { CsvParseResult } from './csv.types.js';

export class CsvParseError extends Error {
	constructor(public readonly result: CsvParseResult<unknown>) {
		const firstError = result.errors[0];
		// Papa Parse's quote errors refer to raw records, which may include the header.
		const dataRow = firstError?.type === 'Quotes' ? undefined : firstError?.row;
		const location = dataRow === undefined ? '' : ` at data row ${dataRow + 1}`;
		super(`CSV import failed${location}: ${firstError?.message ?? 'Unknown error'}`);
		this.name = 'CsvParseError';
	}
}
