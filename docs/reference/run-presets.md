# Run Presets

Run presets are optional local JSON files for reusing CLI run settings. They are intended for rerunning the same analysis without re-answering interactive prompts.

Repository meaning stays in repository profiles. Put file rules, PR class rules, workflow context, branch or release strategy, and contributor-source declarations in a repository profile. A run preset may only point at a profile and store run inputs or preferences such as the target repository, sample size, output directory, dry-run mode, CSV preference, JSON completion preference, validation-target mode, and requested PR class exclusions.

## Save A Preset

Interactive setup asks whether to save a local run preset near the end of the prompt flow. If you answer yes, you choose the preset path explicitly. The CLI does not invent a global or cloud-synced preset location.

Saving a preset may overwrite an existing regular file at that path, but the path must not be a directory, symbolic link, or other special file.

You can also save a preset from flags:

```sh
npm run analyze:github -- \
  --repo example/example-repo \
  --limit 30 \
  --profile profiles/example-repo.json \
  --out reports/example-repo \
  --save-preset .delivery-friction-analyzer/example-repo.run-preset.json
```

When a preset is written, the completion output includes:

```text
Run preset saved: .delivery-friction-analyzer/example-repo.run-preset.json.
```

With `--json`, the same path is emitted as `savedRunPresetPath` in the machine-readable completion receipt.

## Rerun From A Preset

Use `--preset <path>` to load saved settings without prompts:

```sh
npm run analyze:github -- --preset .delivery-friction-analyzer/example-repo.run-preset.json
```

Explicit CLI flags override preset values. This makes one-off reruns predictable:

```sh
npm run analyze:github -- \
  --preset .delivery-friction-analyzer/example-repo.run-preset.json \
  --limit 10 \
  --no-csv
```

In that command, the preset still supplies values such as `--repo`, `--profile`, and `--out`, while `--limit 10` and `--no-csv` win over the saved sample size and CSV preference.

Boolean preset values can be overridden in either direction:

- `--dry-run` or `--no-dry-run`
- `--validation-target` or `--no-validation-target`
- `--csv` or `--no-csv`
- `--json` or `--no-json`

If both forms are provided in one command, the later flag wins. For example, `--preset local.json --dry-run --no-dry-run` runs a full analysis, while `--preset local.json --no-csv --csv` writes CSV evidence files.

## Format

Preset files use `analyze-github-run-preset.v1`:

```json
{
  "schemaVersion": "analyze-github-run-preset.v1",
  "run": {
    "repository": "example/example-repo",
    "limit": 30,
    "profilePath": "profiles/example-repo.json",
    "outDir": "reports/example-repo",
    "dryRun": false,
    "isValidationTarget": false,
    "csv": true,
    "json": false,
    "excludedPrClasses": []
  }
}
```

The CLI only reads and writes the allowlisted `run` keys shown above. Presets must not contain GitHub tokens, secrets, raw source bundles, normalized data, metrics, reports, methodology text, CSV contents, contributor file contents, or repository profile rules.

## Cleanup

Preset files are local user-owned files. Delete a preset when it no longer matches how you want to run the analyzer:

```sh
rm .delivery-friction-analyzer/example-repo.run-preset.json
```

Deleting a preset does not delete generated reports or repository profiles. If a preset points at a generated profile, review and clean up that profile separately.
