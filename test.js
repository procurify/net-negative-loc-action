const core = require('@actions/core')
const github = require('@actions/github')

var token = '0881680951643bab0dce4c85daf4ba87498f5bf3'

const octokit = github.getOctokit(token)

;(async () => {
  const res = await octokit.repos.listReleases({
    owner: 'alexcheuk',
    repo: 'git-loc-diff-action',
    per_page: 2
  })

  console.log(res)
})()
