# Changelog

## [Unreleased]

## [0.2.0] - 2026-11-22

- added optional duplicate-header rejection after header transformation, including after leading blank or whitespace-only rows, with schema errors and skipped row processing
- documented duplicate-header checks and export examples for column selection, delimiters, quoting, and formula escaping

## [0.1.0] - 2026-11-20

- fixed browser File imports remaining pending when a parser callback throws
- extracted the CSV import and export API from `@oardi/ts-utils`, renaming `CsvHelper` to `Csv`
- preserved required-column checks, row mapping and validation, error modes, parser options, and browser File support
- moved Papa Parse, its public type definitions, and shared utility types into direct dependencies
- added ESM/CommonJS builds, strict type contracts, behavioral and packed-consumer tests, CI, and GitHub installation instructions
