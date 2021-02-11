import * as core from '@actions/core'
import * as github from '@actions/github'
import {getClocFromRef, gitFetchRefs, sendSlackMessage} from './helpers'

async function run(): Promise<void> {
  const myToken = core.getInput('token')

  const octokit = github.getOctokit(myToken)

  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0] as string
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] as string

  const releases = await octokit.repos.listReleases({
    owner,
    repo,
    per_page: 2
  })

  const latestReleaseTag = releases.data?.[0]?.tag_name
  const lastReleaseTag = releases.data?.[1]?.tag_name
  const checkpointTag = core.getInput('checkpoint_tag')

  /** Git fetch */
  await gitFetchRefs([latestReleaseTag, lastReleaseTag, checkpointTag])

  /** Calculate LoC Difference */
  const latestCloc = await getClocFromRef(latestReleaseTag)
  const lastCloc = await getClocFromRef(latestReleaseTag)
  const checkpointCloc = await getClocFromRef(checkpointTag)

  if (!latestCloc || !lastCloc) return

  const diffLocFromLast = latestCloc.SUM.code - lastCloc.SUM.code
  core.exportVariable('DIFF_LOC_RELEASE', diffLocFromLast)

  let diffLocFromCheckpoint
  if (checkpointCloc) {
    diffLocFromCheckpoint = latestCloc.SUM.code - checkpointCloc.SUM.code

    core.exportVariable('DIFF_LOC_CHECKPOINT', diffLocFromCheckpoint)
  }

  const slackWebhook = core.getInput('slack_webhook')

  if (slackWebhook) {
    core.info(core.getInput('slack_release_diff_breakdown'))

    await sendSlackMessage({
      owner,
      repo,
      webhookUrl: slackWebhook,
      latestReleaseTag,
      lastReleaseTag,
      diffLocFromLast,
      diffLocFromCheckpoint,
      clocLatest: latestCloc,
      clocLast: lastCloc,
      clocCheckpoint: checkpointCloc || undefined,
      showReleaseBreakdown:
        core.getInput('slack_release_diff_breakdown') === 'true',
      showCheckpointBreakdown:
        core.getInput('slack_checkpoint_diff_breakdown') === 'true'
    })
  }
}

run()
