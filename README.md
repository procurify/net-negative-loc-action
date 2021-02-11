# Net Negative Lines of Code
![build-test](https://github.com/procurify/net-negative-loc-action/workflows/build-test/badge.svg)

This action allows you to get a report of the net negative lines of code per release.
At Procurify, we use this to keep track of our Angular to React migration and Java to Kotlin migration.

<p align="center">
  <img alt="Slack Example" src="images/slack-example.png?raw=true">
</p>

## Usage
```yaml
on:
  release:
    types:
      - created

jobs:
  report-angular:
    name: Report Net Negative Lines of Code
    runs-on: ubuntu-latest

    steps:
      - name: Report Net Negative Lines of Code
        uses: procurify/net-negative-loc-action@v1
        with:
          token: ${{ github.token }}
          slack_webhook: ${{ secrets.SLACK_WEBHOOK }}
          directory: './packages/angular'
```

## Advanced Options
```yaml
- uses: procurify/net-negative-loc-action@v1
  with:
    token: ${{ github.token }}
    slack_webhook: ${{ secrets.SLACK_WEBHOOK }}  # The slack webhook where this action will post to
    directory: './packages/angular'              # The directory to run the report in
    checkpoint_tag: 2021-Q1                      # A git tag that the report will always check the diff of line of codes against
    checkpoint_title: 2021 1st Quarter           # The title of the checkpoint, to be shown in the report
    exclude_dir: node_modules,dist,build         # List of dir to exclude, comma-separated
    exclude_ext: json,md                         # List of extensions to exclude, comma-separated
    include_ext: tsx,jsx                         # List of extensions to include, comma-separated
    slack_release_diff_breakdown: true           # Show the breakdown of the diff by extension in the report between the latest release and the last release
    slack_checkpoint_diff_breakdown: true        # Show the breakdown of the diff by extension in the report between the latest release and the checkpoint
```