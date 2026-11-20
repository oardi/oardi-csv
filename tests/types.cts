import { Csv, CsvParseError } from '@oardi/csv';
import type { CsvImportError, CsvParseOptions, CsvParseResult } from '@oardi/csv';

interface Person {
	name: string;
	age: number;
}
const options: CsvParseOptions<Person> = {
	requiredColumns: ['name', 'age'],
	mapRow: row => ({ name: row['name'] ?? '', age: Number(row['age']) }),
	validateRow: row => (Number.isFinite(row.age) ? undefined : 'Invalid age.'),
	errorMode: 'throw',
};
const result: Promise<CsvParseResult<Person>> = Csv.parse('name,age\nAda,36', options);
const inferred: Promise<CsvParseResult<{ age: number }>> = Csv.parse('age\n36', {
	delimiter: ',',
	mapRow: row => ({ age: Number(row['age']) }),
});
const arrays: Promise<CsvParseResult<string[]>> = Csv.parse<string[], string[]>('1,Ada', {
	header: false,
});
const numericRaw: Promise<CsvParseResult<Person>> = Csv.parse<Person, Person>('name,age\nAda,36', {
	dynamicTyping: { age: true },
	mapRow: row => ({ name: row.name, age: row.age }),
});
const fileResult: Promise<CsvParseResult<Person>> = Csv.parse<Person>(new File([], 'people.csv'), {
	encoding: 'utf-8',
});
const csv: string = Csv.unparse([{ name: 'Ada', age: 36 }], {
	columns: ['name', 'age'],
	delimiter: ';',
});
const issue: CsvImportError = {
	type: 'Validation',
	code: 'RowValidationFailed',
	message: 'Invalid age.',
	row: 0,
};
function inspect(error: unknown): void {
	if (error instanceof CsvParseError) {
		const failed: CsvParseResult<unknown> = error.result;
		void failed;
	}
}
// @ts-expect-error Streaming callbacks cannot provide a complete Promise result.
const streaming: CsvParseOptions = { step: () => {} };
// @ts-expect-error Worker parsing is outside this API.
const worker: CsvParseOptions = { worker: true };
// @ts-expect-error The helper owns the completion callback.
const completion: CsvParseOptions = { complete: () => {} };
// @ts-expect-error Error mode is limited to the documented strategies.
const invalidMode: CsvParseOptions = { errorMode: 'ignore' };
// @ts-expect-error Validators must return an error message or undefined.
const invalidValidator: CsvParseOptions<Person> = { validateRow: () => false };
// @ts-expect-error The mapper must produce the requested target type.
const invalidMapper: CsvParseOptions<Person> = { mapRow: () => ({ age: '36' }) };
// @ts-expect-error CsvHelper was renamed to Csv during extraction.
import { CsvHelper } from '@oardi/csv';
void [
	result,
	inferred,
	arrays,
	numericRaw,
	fileResult,
	csv,
	issue,
	inspect,
	streaming,
	worker,
	completion,
	invalidMode,
	invalidValidator,
	invalidMapper,
	CsvHelper,
];
