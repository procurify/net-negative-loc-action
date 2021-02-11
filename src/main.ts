import * as core from '@actions/core'
import * as github from '@actions/github'
import {getClocFromRef, gitFetchRefs, sendSlackMessage} from './helpers'

async function run(): Promise<void> {
  const octokit = github.getOctokit(core.getInput('token'))

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
  const lastCloc = await getClocFromRef(lastReleaseTag)
  const checkpointCloc = await getClocFromRef(checkpointTag)

  if (!latestCloc || !lastCloc) return

  const diffLocFromLast = latestCloc.SUM.code - lastCloc.SUM.code

  const diffLocFromCheckpoint = checkpointCloc
    ? latestCloc.SUM.code - checkpointCloc.SUM.code
    : 0

  const slackWebhook = core.getInput('slack_webhook')

  if (slackWebhook) {
    try {
      await sendSlackMessage({
        owner,
        repo,
        webhookUrl: slackWebhook,
        latestReleaseTag,
        lastReleaseTag,
        checkpointTag,
        checkpointTitle: core.getInput('checkpoint_title'),
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
    } catch {
      core.setFailed('Failed to send slack message')
    }
  }

  core.startGroup('Export LOC')
  core.info(`DIFF_LOC_CHECKPOINT=${diffLocFromCheckpoint}`)
  core.info(`DIFF_LOC_RELEASE=${diffLocFromLast}`)
  core.info(`DIFF_LOC_REMAINING=${latestCloc.SUM.code}`)

  core.exportVariable('DIFF_LOC_CHECKPOINT', diffLocFromCheckpoint)
  core.exportVariable('DIFF_LOC_RELEASE', diffLocFromLast)
  core.exportVariable('DIFF_LOC_REMAINING', latestCloc.SUM.code)

  core.endGroup()
}

run()
