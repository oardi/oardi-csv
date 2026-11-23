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
	/** Return a message or validation issues to reject a row; undefined or an empty list accepts it. */
	validateRow?: (row: T, rowIndex: number) => Optional<string | readonly CsvValidationIssue[]>;
}

export interface CsvValidationIssue {
	message: string;
	/** Application-supplied column identifier; not checked against CSV headers. */
	column?: string;
}

export interface CsvImportError {
	type: 'Schema' | 'Mapping' | 'Validation';
	code: 'MissingColumn' | 'DuplicateHeader' | 'RowMappingFailed' | 'RowValidationFailed';
	message: string;
	/** Zero-based data row index, excluding the header and skipped empty rows. */
	row?: number;
	/** Optional column identifier supplied by row validation. */
	column?: string;
}

export interface CsvParseResult<T> extends Omit<ParseResult<T>, 'errors'> {
	errors: (ParseError | CsvImportError)[];
}
