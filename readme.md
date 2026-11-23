# @oardi/csv

CSV imports with required-column checks, row mapping, validation, and optional
strict error handling. Powered by Papa Parse. Supports ESM, CommonJS, TypeScript,
CSV strings in Node.js, and browser `File` input.

## Installation

Install directly from GitHub, pinned to a release tag:

```sh
npm install @oardi/csv@github:oardi/oardi-csv#v0.1.0
```

The release tag must exist on GitHub before installation. Alternatively, replace
`<full-commit-hash>` with an existing 40-character commit SHA:

```sh
npm install "@oardi/csv@github:oardi/oardi-csv#<full-commit-hash>"
```

Allow install scripts: `prepare` builds the package during GitHub installation.
Papa Parse, its public TypeScript definitions, and `@oardi/ts-types` are direct
package dependencies; no separate peer installation is required.
`@oardi/ts-types` is pinned to its GitHub release tag. Commit the consumer's
`package.json` and lockfile.

`Csv` uses Papa Parse for CSV parsing and export. It adds required-column checks,
row mapping and validation, and a shared error result with optional strict error handling
to a Promise-based import workflow.

Delimiter, header and export formatting options come from Papa Parse. `unparse()` forwards
directly to its exporter.

## Read CSV

```ts
import { Csv } from '@oardi/csv';

interface Person {
	id: string;
	name: string;
}

const result = await Csv.parse<Person>('id,name\n001,Ada');
console.log(result.data);
// [{ id: '001', name: 'Ada' }]
```

Accepts a CSV string or a browser `File` and always returns a Promise.
By default, the first row supplies column names, blank or whitespace-only rows are skipped,
and values remain strings. The type parameter describes the expected data; it does not validate it.

## Configure an import

```ts
const result = await Csv.parse<Person>(' ID ; Name \n001;Ada', {
	delimiter: ';',
	transformHeader: header => header.trim().toLowerCase(),
	requiredColumns: ['id', 'name'],
	rejectDuplicateHeaders: true,
	errorMode: 'throw',
});
```

Required columns are checked after header transformation; additional columns are allowed.
Missing columns prevent row processing. For a `File`, set `encoding` when needed.
Papa Parse options such as `dynamicTyping`, `transform`, `header` and `skipEmptyLines` are also supported.
`requiredColumns` requires header mode. Streaming, worker and download options are outside this API.

### Reject duplicate headers

Set `rejectDuplicateHeaders: true` to reject repeated column names, including names that
become identical after `transformHeader`:

```ts
const result = await Csv.parse(' ID ,id\n001,002', {
	transformHeader: header => header.trim().toLowerCase(),
	rejectDuplicateHeaders: true,
});

console.log(result.data);
// []
console.log(result.errors);
// [{ type: 'Schema', code: 'DuplicateHeader', message: 'Duplicate header: id' }]
```

Each duplicated name produces one schema error. Like missing required columns, duplicate
headers prevent row mapping and validation, and `data` stays empty. Parser metadata is
preserved. Use `errorMode: 'throw'` to receive a `CsvParseError` instead of collecting errors.
The option requires header mode. It defaults to `false`, preserving Papa Parse's automatic
renaming of duplicate headers.

## Map and validate rows

```ts
interface PersonWithAge {
	name: string;
	age: number;
}

const result = await Csv.parse<PersonWithAge>('name,age\nAda,36\nGrace,invalid', {
	requiredColumns: ['name', 'age'],
	mapRow: row => ({ name: (row['name'] ?? '').trim(), age: Number(row['age']) }),
	validateRow: person =>
		Number.isInteger(person.age) && person.age >= 0
			? undefined
			: 'Age must be a non-negative integer.',
});

console.log(result.data);
// [{ name: 'Ada', age: 36 }]
console.log(result.errors[0]);
// { type: 'Validation', code: 'RowValidationFailed', message: 'Age must be a non-negative integer.', row: 1 }
```

Mapping runs before validation. Return `undefined` to accept a row or an error message to reject it.
Exceptions from either callback also become row errors, and rejected rows are omitted from `data`.
Both callbacks receive a zero-based data row index as their second argument, excluding the header
and skipped empty rows. This is a record index, not a physical file line number.

### Report multiple validation issues

Return a list of `CsvValidationIssue` objects to report several problems in one row:

```ts
import type { CsvValidationIssue } from '@oardi/csv';

const result = await Csv.parse<PersonWithAge>('name,age\nAda,36\n,-1', {
	mapRow: row => ({ name: (row['name'] ?? '').trim(), age: Number(row['age']) }),
	validateRow: person => {
		const issues: CsvValidationIssue[] = [];
		if (!person.name) issues.push({ column: 'name', message: 'Name is required.' });
		if (!Number.isInteger(person.age) || person.age < 0) {
			issues.push({ column: 'age', message: 'Age must be a non-negative integer.' });
		}
		return issues;
	},
});

console.log(result.errors);
// [
//   { type: 'Validation', code: 'RowValidationFailed', message: 'Name is required.', row: 1, column: 'name' },
//   { type: 'Validation', code: 'RowValidationFailed', message: 'Age must be a non-negative integer.', row: 1, column: 'age' }
// ]
```

Each issue becomes a separate error in list order, with the same data row index. A nonempty
list excludes the row from `data`; an empty list accepts it, just like `undefined`.
Existing validators returning a string continue to work, including empty error messages.
Readonly issue lists are also accepted. Every issue needs a `message`; `column` is optional
and is copied as supplied without checking it against CSV headers, allowing identifiers for
mapped or derived fields. For CSV column references, use the name after `transformHeader`.
With `errorMode: 'throw'`, `CsvParseError.result` contains all issues and accepted rows.

## Handle errors

The default `errorMode: 'collect'` returns data alongside `errors`.
Papa Parse errors retain their original details, and rows flagged by the parser may still appear in `data`.
Check `errors` before using the result, or use `'throw'` to reject any import containing errors:

```ts
import { CsvParseError } from '@oardi/csv';

try {
	await Csv.parse<Person>('id,name\n001', { errorMode: 'throw' });
} catch (error) {
	if (!(error instanceof CsvParseError)) throw error;
	console.log(error.result.errors);
}
```

`CsvParseError.result` contains the data, errors and parser metadata for inspection.
File reading failures and exceptions from parser callbacks (such as `transform` or
`transformHeader`) reject the Promise in either mode, preserving the original error.

## Export CSV

`unparse()` accepts Papa Parse's `UnparseConfig`, including column order, delimiters and quoting.

Use `columns` to select and order exported properties, `delimiter` for the separator,
and `quotes: true` to quote every value:

```ts
const csv = Csv.unparse([{ name: 'Ada, Lovelace', id: '001', internal: true }], {
	columns: ['id', 'name'],
	delimiter: ';',
	quotes: true,
	newline: '\n',
});

console.log(csv);
// "id";"name"\n"001";"Ada, Lovelace"
```

The `internal` property is omitted. Without `quotes: true`, values containing the delimiter,
quotes or line breaks are still quoted automatically, and embedded quotes are escaped.

### Escape formula-like values

When exporting user-provided text for spreadsheet software, enable `escapeFormulae`:

```ts
const csv = Csv.unparse([{ value: '=1+1' }], {
	escapeFormulae: true,
	newline: '\n',
});

console.log(csv);
// value\n"'=1+1"
```

Papa Parse prefixes string values beginning with `=`, `+`, `-`, `@`, tab or carriage return
with an apostrophe so spreadsheet software treats them as text. This changes the exported
values; the option defaults to `false` and can also accept a custom regular expression.

CommonJS: `const { Csv, CsvParseError } = require('@oardi/csv');`.
Both formats share class identity, so `instanceof CsvParseError` works across them.
The package exports `CsvParseOptions`, `CsvParseResult`, `CsvImportError`, and `CsvValidationIssue` as types.
When mapping non-string values or parsing without headers, supply the raw row type
as the second generic argument, for example `Csv.parse<string[], string[]>(text, { header: false })`.

## Migration from @oardi/ts-utils

Replace `CsvHelper` imports from `@oardi/ts-utils` or its `helpers/csv` subpath
with `Csv` from `@oardi/csv`. Import CSV types and `CsvParseError` from the new
package too. The parsing, validation, and export behavior is unchanged.
Once no application code imports Papa Parse directly, its separate dependency
entries can be removed from the application.

## Development and releases

Use Node.js 24 and npm:

```sh
npm ci
npm run validate
```

Validation builds into ignored `dist/`, checks ESM/CommonJS type contracts and
CSV behavior, installs a local package archive in an isolated consumer, and
checks formatting. CI runs the same commands. `npm run format` applies formatting.

For a release, align `package.json`, both root version fields in `package-lock.json`,
and the dated entry in `changelog.md`. After validation, create a `v<version>` tag
on the matching commit. Commits, tags, and pushes require an explicit request.
The package stays private and is distributed through GitHub; there is no npm
publication or automated release.

## License

[MIT](LICENSE)
