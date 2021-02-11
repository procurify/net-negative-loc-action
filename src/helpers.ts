import * as core from '@actions/core'

import execa from 'execa'
import path from 'path'
import simpleGit, {SimpleGit} from 'simple-git'

const git: SimpleGit = simpleGit()

interface Cloc {
  [ext: string]: {
    nFiles: number
    blank: number
    comment: number
    code: number
  }
  SUM: {
    nFiles: number
    blank: number
    comment: number
    code: number
  }
}

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
  core.startGroup(`Get Cloc from: ${ref}`)

  await git.checkout(ref, ['-f'])

  const cloc = await clocFolder(
    core.getInput('directory') || '.',
    core.getInput('exclude_dir') || '',
    core.getInput('exclude_ext') || '',
    core.getInput('include_ext') || ''
  )

  core.info(JSON.stringify(cloc))

  core.endGroup()

  return cloc
}

export const gitFetchRefs = async (refs: string[]): Promise<any> => {
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
