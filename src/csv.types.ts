import type { Dictionary, Optional } from '@oardi/ts-types';
import type { ParseConfig, ParseError, ParseResult } from 'papaparse';

export interface CsvParseOptions<T = Dictionary<string>, TRow = Dictionary<string>> extends Omit<
	ParseConfig<TRow>,
	'complete' | 'step'
> {
	/** File encoding; ignored for string input. */
	encoding?: string;
	/** Defaults to 'collect', preserving Papa Parse's non-throwing error handling. */
	errorMode?: 'collect' | 'throw';
	/** Checked after transformHeader. Requires header mode. */
	requiredColumns?: readonly string[];
	/** Reject duplicate names after transformHeader. Requires header mode. Defaults to false. */
	rejectDuplicateHeaders?: boolean;
	/** Convert a parsed row. Throw an Error to reject that row. rowIndex is zero-based. */
	mapRow?: (row: TRow, rowIndex: number) => T;
	/** Return an error message to reject a mapped row, or undefined to accept it. */
	validateRow?: (row: T, rowIndex: number) => Optional<string>;
}

export interface CsvImportError {
	type: 'Schema' | 'Mapping' | 'Validation';
	code: 'MissingColumn' | 'DuplicateHeader' | 'RowMappingFailed' | 'RowValidationFailed';
	message: string;
	/** Zero-based data row index, excluding the header and skipped empty rows. */
	row?: number;
}

export interface CsvParseResult<T> extends Omit<ParseResult<T>, 'errors'> {
	errors: (ParseError | CsvImportError)[];
}
