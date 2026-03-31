## ADDED Requirements

### Requirement: Run files written to data/runs directory
The system SHALL write all run files to `data/runs/` subdirectory, not directly to `data/`.

#### Scenario: Run file location
- **WHEN** reporter creates a run file
- **THEN** file SHALL be written to `data/runs/<filename>.json`

### Requirement: Unique filenames with random suffix
The system SHALL generate filenames with format `<date>_<sha>_<random>.json` where random is a 4-character hex string.

#### Scenario: Filename format
- **WHEN** run file is generated for commit `abc1234` on `2026-03-27`
- **THEN** filename SHALL match pattern `2026-03-27_abc1234_[a-f0-9]{4}.json`

#### Scenario: No collision between shards
- **WHEN** two shards finish at the same millisecond with same commit
- **THEN** each SHALL have a unique filename due to random suffix

### Requirement: Run files deleted after processing
The system SHALL delete run files from `data/runs/` after successful aggregation.

#### Scenario: Files deleted after aggregation
- **WHEN** aggregator processes 5 run files and commits successfully
- **THEN** all 5 files SHALL be deleted from `data/runs/`

#### Scenario: Files preserved on aggregation failure
- **WHEN** aggregator processes files but commit fails
- **THEN** run files SHALL remain in `data/runs/` for retry

### Requirement: File existence indicates unprocessed
The system SHALL NOT track processed files in metadata. Presence in `data/runs/` indicates unprocessed.

#### Scenario: No processedFiles tracking
- **WHEN** aggregator runs
- **THEN** it SHALL NOT read or write `processedFiles` array
