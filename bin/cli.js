#!/usr/bin/env node
const execa = require('execa')
const path = require('path')
const axios = require('axios')
const Analytics = require('analytics-node')

const yargs = require("yargs")
 .usage(`Usage: git-loc-diff <name> <options>`)
 .command('output-latest-tag', 'Output the latest release ref')
 .command('output-last-tag', 'Output the last release ref')
 .command('output-loc', 'Outline lines of code (JSON)')
 .command('slack <latest_tag> <last_tag> <latest_loc_json> <last_loc_json>', 'Send LoC diff summary to Slack')
 .option("t", { alias: "token", describe: "GitHub Token or set $GITHUB_TOKEN", type: "string", demandOption: false })

const { _: [command, ...commandArgs], token } = yargs.argv

if (!command) {
  yargs.showHelp()

  return
}

let GITHUB_TOKEN

if (!process.env.GITHUB_TOKEN && !token) {
  console.error('Error: Missing --token or $GITHUB_TOKEN')
  process.exit(1)
} else {
  GITHUB_TOKEN = process.env.GITHUB_TOKEN || token
}

/** Helper */
const clocFolder = async (folder) => {
  try {
    const { stdout } = await execa(
      path.resolve(__dirname, '../node_modules/.bin/cloc'),
      [
        '--exclude-dir=node_modules,dist',
        '--exclude-ext=json',
        '--json',
        folder,
      ]
    )

    return JSON.parse(stdout)
  } catch (e) {
    return {}
  }
}

/** Command Handlers */

const outputLatestTag = async () => {
  const releases = await axios
    .get('https://api.github.com/repos/procurify/procurify-react/releases', {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    })
    .then((res) => res.data)

  return releases[0].tag_name
}


const outputLastTag = async () => {
  const releases = await axios
    .get('https://api.github.com/repos/procurify/procurify-react/releases', {
      headers: { Authorization: `token ${GITHUB_TOKEN}` },
    })
    .then((res) => res.data)

  return releases[1].tag_name
}

const outputLoc = async (angularFolder) => {
  const { header, ...cloc } = await clocFolder(angularFolder)

  return JSON.stringify(cloc)
}

const slack = async (
  latestTag,
  lastTag,
  latestLoc,
  lastLoc,
  sourceLoc
) => {
  var latestCloc = JSON.parse(latestLoc)
  var lastCloc = JSON.parse(lastLoc)
  var sourceCloc = JSON.parse(sourceLoc)

  var diffLocFromLast =
    parseInt(latestCloc.SUM.code) - parseInt(lastCloc.SUM.code)

  var diffLocFromSource =
    parseInt(latestCloc.SUM.code) - parseInt(sourceCloc.SUM.code)

  axios
    .post(
      'https://hooks.slack.com/services/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',
      {
        text: `${latestTag} Released - Diff LoC: ${formatLocText(
          diffLocFromLast
        )}`,
        blocks: [
          {
            type: 'divider',
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `:angular2: *${latestTag} Released - Net Angular Code Breakdown* :angular2:`,
            },
          },
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `*Summary*`,
              },
            ],
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Diff LoC from <https://github.com/procurify/procurify-react/compare/${lastTag}...${latestTag}|${lastTag}>:*\n${formatLocText(
                  diffLocFromLast
                )}`,
              },
              {
                type: 'mrkdwn',
                text: `*Diff LoC since <https://github.com/procurify/procurify-react/releases/tag/net-negative-angular-source|Checkpoint>:*\n${formatLocText(
                  diffLocFromSource
                )}`,
              },
            ],
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Remaining Lines of Code*\n${latestCloc.SUM.code}`,
              },
            ],
          },
          ...(diffLocFromLast !== 0
            ? [
                {
                  type: 'divider',
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `*Diff breakdown from <https://github.com/procurify/procurify-react/compare/${lastTag}...${latestTag}|${lastTag}>*`,
                    },
                  ],
                },
                ...generateDiffMessage(lastCloc, latestCloc),
              ]
            : []),
          ...(diffLocFromSource !== 0
            ? [
                {
                  type: 'divider',
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `*Diff breakdown from <https://github.com/procurify/procurify-react/releases/tag/net-negative-angular-source|Source>*`,
                    },
                  ],
                },
                ...generateDiffMessage(sourceCloc, latestCloc),
              ]
            : []),
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `note: _/node_modules, /dist and *.json are ignored_`,
              },
            ],
          },
        ],
      }
    )
    .catch((err) => {
      console.log(err)
    })
}

const runCommand = async () => {
  const { _: [command, ...commandArgs] } = yargs.argv

  switch (command) {
    case 'output-latest-tag':
      console.log(await outputLatestTag())
      break

    case 'output-last-tag':
      console.log(await outputLastTag())
      break

    case 'output-loc':
      const locPath = commandArgs[0] || '.'

      var angularFolder = locPath

      console.log(await outputLoc(angularFolder))
      break

    case 'slack':
      const [, latestTag, lastTag, latestLoc, lastLoc, sourceLoc] = cli.input

      if (!latestTag || !lastTag || !latestLoc || !lastLoc) return

      slack(latestTag, lastTag, latestLoc, lastLoc, sourceLoc)
      break

    case 'send-to-segment':
      const [, segmentApiKey, latestCloc] = cli.input

      if (!segmentApiKey || !latestCloc) process.exit(1)

      sendToSegment(segmentApiKey, latestCloc)
      break

    default:
      console.log(`\nInvalid command: ${command}`)
      cli.showHelp()
  }
}

;(async () => {
  await runCommand()
})()

// const command = cli.input[0]

// if (!command) {
//   cli.showHelp()
// }

// const clocFolder = async (folder) => {
//   try {
//     const { stdout } = await execa(
//       path.resolve(__dirname, './node_modules/.bin/cloc'),
//       [
//         '--exclude-dir=node_modules,dist',
//         '--exclude-ext=json',
//         '--json',
//         folder,
//       ]
//     )

//     return JSON.parse(stdout)
//   } catch (e) {
//     return {}
//   }
// }

// const diffCloc = (cloc1, cloc2) => {
//   var diffCloc = {}

//   Object.keys(cloc2).forEach((fileType) => {
//     diffCloc[fileType] = {
//       file: parseInt(cloc2[fileType].nFile),
//       code: parseInt(cloc2[fileType].code),
//     }
//   })

//   Object.keys(cloc1).forEach((fileType) => {
//     if (!diffCloc[fileType]) {
//       diffCloc[fileType] = {
//         file: 0,
//         code: 0,
//       }
//     }

//     diffCloc[fileType].file = diffCloc[fileType].file - cloc1[fileType].nFile
//     diffCloc[fileType].code = diffCloc[fileType].code - cloc1[fileType].code
//   })

//   return diffCloc
// }

// const generateDiffMessage = (cloc1, cloc2) => {
//   const diffClocObj = diffCloc(cloc1, cloc2)

//   return Object.keys(diffClocObj)
//     .filter((fileType) => {
//       return diffClocObj[fileType].code !== 0 && fileType !== 'SUM'
//     })
//     .map((fileType) => {
//       return {
//         type: 'section',
//         text: {
//           type: 'mrkdwn',
//           text: `${fileType}`,
//         },
//         accessory: {
//           type: 'button',
//           text: {
//             type: 'plain_text',
//             text: formatLocText(diffClocObj[fileType].code),
//           },
//           style: diffClocObj[fileType].code < 0 ? 'primary' : 'danger',
//         },
//       }
//     })
// }

// const formatLocText = (loc, withMeme = false) => {
//   if (loc > 0) {
//     return `+ ${Math.abs(loc)}${withMeme ? ` :gachi:` : ''}`
//   } else if (loc < 0) {
//     return `- ${Math.abs(loc)}${withMeme ? ` :feelsgoodman:` : ''}`
//   } else {
//     return loc.toString()
//   }
// }

// /** Command Methods */


// const getLastTag = async (githubToken) => {
//   const releases = await axios
//     .get('https://api.github.com/repos/procurify/procurify-react/releases', {
//       headers: { Authorization: `token ${githubToken}` },
//     })
//     .then((res) => res.data)

//   return releases[1].tag_name
// }

// const getAngularLoc = async (angularFolder) => {
//   const { header, ...cloc } = await clocFolder(angularFolder)

//   return JSON.stringify(cloc)
// }

// const sendSlackMessage = async (
//   latestTag,
//   lastTag,
//   latestLoc,
//   lastLoc,
//   sourceLoc
// ) => {
//   var latestCloc = JSON.parse(latestLoc)
//   var lastCloc = JSON.parse(lastLoc)
//   var sourceCloc = JSON.parse(sourceLoc)

//   var diffLocFromLast =
//     parseInt(latestCloc.SUM.code) - parseInt(lastCloc.SUM.code)

//   var diffLocFromSource =
//     parseInt(latestCloc.SUM.code) - parseInt(sourceCloc.SUM.code)

//   axios
//     .post(
//       'https://hooks.slack.com/services/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',
//       {
//         text: `${latestTag} Released - Diff LoC: ${formatLocText(
//           diffLocFromLast
//         )}`,
//         blocks: [
//           {
//             type: 'divider',
//           },
//           {
//             type: 'section',
//             text: {
//               type: 'mrkdwn',
//               text: `:angular2: *${latestTag} Released - Net Angular Code Breakdown* :angular2:`,
//             },
//           },
//           {
//             type: 'divider',
//           },
//           {
//             type: 'context',
//             elements: [
//               {
//                 type: 'mrkdwn',
//                 text: `*Summary*`,
//               },
//             ],
//           },
//           {
//             type: 'section',
//             fields: [
//               {
//                 type: 'mrkdwn',
//                 text: `*Diff LoC from <https://github.com/procurify/procurify-react/compare/${lastTag}...${latestTag}|${lastTag}>:*\n${formatLocText(
//                   diffLocFromLast
//                 )}`,
//               },
//               {
//                 type: 'mrkdwn',
//                 text: `*Diff LoC since <https://github.com/procurify/procurify-react/releases/tag/net-negative-angular-source|Checkpoint>:*\n${formatLocText(
//                   diffLocFromSource
//                 )}`,
//               },
//             ],
//           },
//           {
//             type: 'section',
//             fields: [
//               {
//                 type: 'mrkdwn',
//                 text: `*Remaining Lines of Code*\n${latestCloc.SUM.code}`,
//               },
//             ],
//           },
//           ...(diffLocFromLast !== 0
//             ? [
//                 {
//                   type: 'divider',
//                 },
//                 {
//                   type: 'context',
//                   elements: [
//                     {
//                       type: 'mrkdwn',
//                       text: `*Diff breakdown from <https://github.com/procurify/procurify-react/compare/${lastTag}...${latestTag}|${lastTag}>*`,
//                     },
//                   ],
//                 },
//                 ...generateDiffMessage(lastCloc, latestCloc),
//               ]
//             : []),
//           ...(diffLocFromSource !== 0
//             ? [
//                 {
//                   type: 'divider',
//                 },
//                 {
//                   type: 'context',
//                   elements: [
//                     {
//                       type: 'mrkdwn',
//                       text: `*Diff breakdown from <https://github.com/procurify/procurify-react/releases/tag/net-negative-angular-source|Source>*`,
//                     },
//                   ],
//                 },
//                 ...generateDiffMessage(sourceCloc, latestCloc),
//               ]
//             : []),
//           {
//             type: 'divider',
//           },
//           {
//             type: 'context',
//             elements: [
//               {
//                 type: 'mrkdwn',
//                 text: `note: _/node_modules, /dist and *.json are ignored_`,
//               },
//             ],
//           },
//         ],
//       }
//     )
//     .catch((err) => {
//       console.log(err)
//     })
// }

// const sendToSegment = (segmentApiKey, latestCloc) => {
//   const analytics = new Analytics(segmentApiKey)
//   const segmentCloc = JSON.parse(latestCloc)

//   analytics.track({
//     userId: 'frontend-metric',
//     event: `angular-loc`,
//     properties: {
//       linesOfCode: segmentCloc.SUM.code,
//     },
//   })
// }

// ;(async () => {
//   switch (command) {
//     case 'output-latest-tag':
//       console.log(await getLatestTag(cli.flags.token))
//       break

//     case 'output-last-tag':
//       console.log(await getLastTag(cli.flags.token))
//       break

//     case 'output-angular-loc':
//       var angularFolder =
//         cli.input[1] || path.resolve(__dirname, '../../packages/angular')

//       console.log(await getAngularLoc(angularFolder))
//       break

//     case 'slack':
//       const [, latestTag, lastTag, latestLoc, lastLoc, sourceLoc] = cli.input

//       if (!latestTag || !lastTag || !latestLoc || !lastLoc) return

//       sendSlackMessage(latestTag, lastTag, latestLoc, lastLoc, sourceLoc)
//       break

//     case 'send-to-segment':
//       const [, segmentApiKey, latestCloc] = cli.input

//       if (!segmentApiKey || !latestCloc) process.exit(1)

//       sendToSegment(segmentApiKey, latestCloc)
//       break

//     default:
//       console.log(`\nInvalid command: ${command}`)
//       cli.showHelp()
//   }
// })()
