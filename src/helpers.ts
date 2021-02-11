import * as core from '@actions/core'

import execa from 'execa'
import path from 'path'
import simpleGit, {Response, SimpleGit} from 'simple-git'
import fetch, {Response as FetchResponse} from 'node-fetch'

const git: SimpleGit = simpleGit()

type Cloc = Record<
  string,
  {
    nFiles: number
    blank: number
    comment: number
    code: number
  }
>

export const clocFolder = async (
  folder: string,
  excludeDir: string,
  excludeExt: string,
  includeExt: string
): Promise<Cloc | null> => {
  try {
    const options = []

    if (includeExt) options.push(`--include-ext=${includeExt}`)
    if (excludeDir) options.push(`--exclude-dir=${excludeDir}`)
    if (excludeExt) options.push(`--exclude-ext=${excludeExt}`)

    core.info(`cloc ${[...options, '--json', folder].join(' ')}`)

    const {stdout} = await execa(path.resolve(__dirname, '../bin/cloc'), [
      ...options,
      '--json',
      folder
    ])

    return JSON.parse(stdout)
  } catch (e) {
    return null
  }
}

export const getClocFromRef = async (ref: string): Promise<Cloc | null> => {
  if (!ref) return null

  try {
    core.startGroup(`Get Cloc from: ${ref}`)

    await git.checkout(ref, ['-f'])

    const cloc = await clocFolder(
      core.getInput('directory') || '.',
      core.getInput('exclude_dir') || '',
      core.getInput('exclude_ext') || '',
      core.getInput('include_ext') || ''
    )

    if (cloc) {
      delete cloc.header
    }

    core.info(JSON.stringify(cloc))

    core.endGroup()

    return cloc
  } catch {
    return null
  }
}

export const gitFetchRefs = async (refs: string[]): Promise<Response<{}>> => {
  core.startGroup('Fetching')

  const fetchOptions = [
    '--no-tags',
    '--prune',
    '--progress',
    '--no-recurse-submodules',
    '--depth=1',
    `origin`
  ]

  for (const ref of refs) {
    fetchOptions.push(
      ...[
        `+refs/tags/${ref}*:refs/tags/${ref}*`,
        `+refs/heads/${ref}*:refs/remotes/origin/${ref}*`
      ]
    )
  }
  core.info(`git fetch ${fetchOptions.join(' ')}`)

  const fetchResults = await git.fetch(fetchOptions)

  core.debug(JSON.stringify(fetchResults))

  core.endGroup()

  return git.fetch(fetchOptions)
}

const formatLocText = (loc: number): string => {
  if (loc > 0) {
    return `+ ${Math.abs(loc)}`
  } else if (loc < 0) {
    return `- ${Math.abs(loc)}`
  } else {
    return loc.toString()
  }
}

const diffCloc = (cloc1: Cloc, cloc2: Cloc): Record<string, {code: number}> => {
  const diff: Record<string, {code: number}> = {}

  // eslint-disable-next-line github/array-foreach
  Object.keys(cloc2).forEach(fileType => {
    diff[fileType] = {
      code: cloc2[fileType].code
    }
  })

  // eslint-disable-next-line github/array-foreach
  Object.keys(cloc1).forEach(fileType => {
    if (!diff[fileType]) {
      diff[fileType] = {
        code: 0
      }
    }

    diff[fileType].code = diff[fileType].code - cloc1[fileType].code
  })

  return diff
}

const generateDiffMessage = (
  cloc1: Cloc,
  cloc2: Cloc
): Record<string, unknown>[] => {
  const diffClocObj = diffCloc(cloc1, cloc2)

  return Object.keys(diffClocObj)
    .filter(fileType => {
      return diffClocObj[fileType].code !== 0 && fileType !== 'SUM'
    })
    .map(fileType => {
      return {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${fileType}`
        },
        accessory: {
          type: 'button',
          text: {
            type: 'plain_text',
            text: formatLocText(diffClocObj[fileType].code)
          },
          style: diffClocObj[fileType].code < 0 ? 'primary' : 'danger'
        }
      }
    })
}

export const sendSlackMessage = async ({
  owner,
  repo,
  webhookUrl,
  latestReleaseTag,
  lastReleaseTag,
  checkpointTag,
  checkpointTitle = 'Checkpoint',
  diffLocFromLast,
  diffLocFromCheckpoint,
  clocLatest,
  clocLast,
  clocCheckpoint,
  showReleaseBreakdown,
  showCheckpointBreakdown
}: {
  owner: string
  repo: string
  webhookUrl: string
  latestReleaseTag: string
  lastReleaseTag: string
  checkpointTag?: string
  checkpointTitle?: string
  diffLocFromLast: number
  diffLocFromCheckpoint?: number
  clocLatest: Cloc
  clocLast: Cloc
  clocCheckpoint?: Cloc
  showReleaseBreakdown?: boolean
  showCheckpointBreakdown?: boolean
}): Promise<FetchResponse> => {
  core.info('Sending report to Slack')

  const data = JSON.stringify({
    text: `${latestReleaseTag} Released - Diff LoC: ${formatLocText(
      diffLocFromLast
    )}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*<https://github.com/${owner}/${repo}/releases/tag/${latestReleaseTag}|${latestReleaseTag}> Released - Net Negative Code Breakdown*`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Summary*`
          }
        ]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Diff LoC from <https://github.com/${owner}/${repo}/compare/${lastReleaseTag}...${latestReleaseTag}|${lastReleaseTag}>:*\n${formatLocText(
              diffLocFromLast
            )}`
          },
          ...(checkpointTag && diffLocFromCheckpoint
            ? [
                {
                  type: 'mrkdwn',
                  text: `*Diff LoC since <https://github.com/${owner}/${repo}/releases/tag/${checkpointTag}|${checkpointTitle}>:*\n${formatLocText(
                    diffLocFromCheckpoint
                  )}`
                }
              ]
            : [])
        ]
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Remaining Lines of Code*\n${clocLatest.SUM.code}`
          }
        ]
      },
      ...(showReleaseBreakdown && diffLocFromLast !== 0
        ? [
            {
              type: 'divider'
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*Diff breakdown from <https://github.com/${owner}/${repo}/compare/${lastReleaseTag}...${latestReleaseTag}|${lastReleaseTag}>*`
                }
              ]
            },
            ...generateDiffMessage(clocLast, clocLatest)
          ]
        : []),
      ...(showCheckpointBreakdown &&
      diffLocFromCheckpoint !== 0 &&
      clocCheckpoint
        ? [
            {
              type: 'divider'
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `*Diff breakdown from <https://github.com/${owner}/${repo}/releases/tag/${checkpointTag}|${checkpointTitle}>*`
                }
              ]
            },
            ...generateDiffMessage(clocCheckpoint, clocLatest)
          ]
        : [])
    ]
  })

  return fetch(webhookUrl, {
    method: 'POST',
    body: data,
    headers: {'Content-Type': 'application/json'}
  })
}
