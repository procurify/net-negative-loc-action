import * as core from '@actions/core'
import * as github from '@actions/github'
import execa from 'execa'
import simpleGit, {SimpleGit} from 'simple-git'
import path from 'path'

const git: SimpleGit = simpleGit()

const clocFolder = async (
  folder: string,
  excludeDir: string,
  excludeExt: string,
  includeExt: string
): Promise<Object> => {
  try {
    const options = []

    if (includeExt) options.push(`--include-ext=${includeExt}`)
    if (excludeDir) options.push(`--exclude-dir=${excludeDir}`)
    if (excludeExt) options.push(`--exclude-ext=${excludeExt}`)

    const {stdout} = await execa(path.resolve(__dirname, '../bin/cloc'), [
      ...options,
      '--json',
      folder
    ])

    return JSON.parse(stdout)
  } catch (e) {
    return {}
  }
}

const getClocFromRef = async (ref: string): Promise<Object> => {
  await git.checkout(ref, ['-f'])

  return clocFolder(
    '.',
    core.getInput('exclude_dir') || '',
    core.getInput('exclude_ext') || '',
    core.getInput('include_ext') || ''
  )
}

async function run(): Promise<void> {
  const myToken = core.getInput('token')

  const octokit = github.getOctokit(myToken)

  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0] as string
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] as string

  core.info(owner)
  core.info(repo)

  const releases = await octokit.repos.listReleases({
    owner,
    repo,
    per_page: 2
  })

  const latestReleaseTag = releases.data?.[0]?.tag_name
  const lastReleaseTag = releases.data?.[1]?.tag_name

  const fetch = await git.fetch([
    `origin`,
    `+refs/tags/${latestReleaseTag}*:refs/tags/${latestReleaseTag}*`,
    `+refs/heads/${latestReleaseTag}*:refs/remotes/origin/${latestReleaseTag}*`,
    `+refs/tags/${lastReleaseTag}*:refs/tags/${lastReleaseTag}*`,
    `+refs/heads/${lastReleaseTag}*:refs/remotes/origin/${lastReleaseTag}*`,
    '--depth=1'
  ])

  core.info(JSON.stringify(fetch))

  core.info(JSON.stringify(await getClocFromRef(latestReleaseTag)))
  core.info(JSON.stringify(await getClocFromRef(lastReleaseTag)))
}

run()
