import * as core from '@actions/core'
import * as github from '@actions/github'
import {getClocFromRef, gitFetchRefs} from './helpers'

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
  const sourceRef = core.getInput('source_ref')

  /** Git fetch */
  await gitFetchRefs([latestReleaseTag, lastReleaseTag, sourceRef])

  /** Calculate LoC Difference */
  const latestCloc = await getClocFromRef(latestReleaseTag)
  const lastCloc = await getClocFromRef(latestReleaseTag)
  const sourceCloc = await getClocFromRef(sourceRef)

  if (!latestCloc || !lastCloc || !sourceCloc) return

  const diffLocFromLast = latestCloc.SUM.code - lastCloc.SUM.code
  const diffLocFromSource = latestCloc.SUM.code - sourceCloc.SUM.code

  core.info(diffLocFromLast.toString())
  core.info(diffLocFromSource.toString())
}

run()
