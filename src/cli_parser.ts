/*
 * @t8ngs/runner
 *
 * (c) T8ngs
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

// @ts-ignore-error
import getopts from 'getopts'
import { colors } from './helpers.js'
import type { CLIArgs } from './types.js'

/**
 * Known commandline options. The user can still define additional flags and they
 * will be parsed aswell, but without any normalization
 */
const OPTIONS = {
  string: ['tests', 'groups', 'tags', 'files', 'timeout', 'retries', 'reporters', 'bailLayer'],
  boolean: ['help', 'matchAll', 'failed', 'bail', 'listPinned'],
  alias: {
    forceExit: 'force-exit',
    matchAll: 'match-all',
    listPinned: 'list-pinned',
    bailLayer: 'bail-layer',
    help: 'h',
  },
}

/**
 * Help string to display when the `--help flag is used`
 */
const GET_HELP = () => `
${colors.yellow('@t8ngs/runner v1.0.0')}

${colors.green('--tests')}                     ${colors.dim('Filter tests by the test title')}
${colors.green('--groups')}                    ${colors.dim('Filter tests by the group title')}
${colors.green('--tags')}                      ${colors.dim('Filter tests by tags')}
${colors.green('--match-all')}                 ${colors.dim('Run tests that matches all the supplied tags')}
${colors.green('--list-pinned')}               ${colors.dim('List pinned tests')}
${colors.green('--files')}                     ${colors.dim('Filter tests by the file name')}
${colors.green('--force-exit')}                ${colors.dim('Forcefully exit the process')}
${colors.green('--timeout')}                   ${colors.dim('Define default timeout for all tests')}
${colors.green('--retries')}                   ${colors.dim('Define default retries for all tests')}
${colors.green('--reporters')}                 ${colors.dim('Activate one or more test reporters')}
${colors.green('--failed')}                    ${colors.dim('Run tests failed during the last run')}
${colors.green('--bail')}                      ${colors.dim('Exit early when a test fails')}
${colors.green('--bail-layer')}                ${colors.dim('Specify at which layer to enable the bail mode. Can be "group" or "suite"')}
${colors.green('-h, --help')}                  ${colors.dim('View help')}

${colors.yellow('Examples:')}
${colors.dim('node bin/test.js --tags="@github"')}
${colors.dim('node bin/test.js --tags="~@github"')}
${colors.dim('node bin/test.js --tags="@github,@slow,@integration" --match-all')}
${colors.dim('node bin/test.js --force-exit')}
${colors.dim('node bin/test.js --files="user"')}
${colors.dim('node bin/test.js --files="functional/user"')}
${colors.dim('node bin/test.js --files="unit/user"')}
${colors.dim('node bin/test.js --failed')}
${colors.dim('node bin/test.js --bail')}
${colors.dim('node bin/test.js --bail=group')}

${colors.yellow('Notes:')}
- When groups and tests filters are applied together. We will first filter the
  tests by group title and then apply the tests filter.
- The timeout defined on test object takes precedence over the ${colors.green('--timeout')} flag.
- The retries defined on test object takes precedence over the ${colors.green('--retries')} flag.
- The ${colors.green('--files')} flag checks for the file names ending with the filter substring.
- The ${colors.green('--tags')} filter runs tests that has one or more of the supplied tags.
- You can use the ${colors.green('--match-all')} flag to run tests that has all the supplied tags.
`

/**
 * CLI Parser is used to parse the commandline argument
 */
export class CliParser {
  /**
   * Parses command-line arguments
   */
  parse(argv: string[]): CLIArgs {
    return getopts(argv, OPTIONS)
  }

  /**
   * Returns the help string
   */
  getHelp() {
    return GET_HELP()
  }
}
