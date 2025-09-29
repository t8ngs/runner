/*
 * @t8ngs/runner
 *
 * (c) T8ngs
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { fileURLToPath } from 'node:url'
import { ErrorsPrinter } from '@t8ngs/show-screen-errors'
import type { TestExecutor } from '@t8ngs/core/types'

import debug from './src/debug.js'
import validator from './src/validator.js'
import { Planner } from './src/planner.js'
import { GlobalHooks } from './src/hooks.js'
import { CliParser } from './src/cli_parser.js'
import { printPinnedTests } from './src/helpers.js'
import { retryPlugin } from './src/plugins/retry.js'
import { ConfigManager } from './src/config_manager.js'
import { ExceptionsManager } from './src/exceptions_manager.js'
import { createTest, createTestGroup } from './src/create_test.js'
import type { CLIArgs, Config, NormalizedConfig } from './src/types.js'
import { Emitter, Group, Runner, Suite, Test, TestContext } from './modules/core/main.js'

type OmitFirstArg<F> = F extends [_: any, ...args: infer R] ? R : never

/**
 * Global emitter instance used by the test
 */
const emitter = new Emitter()

/**
 * The current active test
 */
let activeTest: Test<any> | undefined

/**
 * Parsed commandline arguments
 */
let cliArgs: CLIArgs = {}

/**
 * Hydrated config
 */
let runnerConfig: NormalizedConfig | undefined

/**
 * The state refers to the phase where we configure suites and import
 * test files. We stick this metadata to the test instance one can
 * later reference within the test.
 */
const executionPlanState: {
  phase: 'idle' | 'planning' | 'executing'
  file?: string
  suite?: Suite
  group?: Group
  timeout?: number
  retries?: number
} = {
  phase: 'idle',
}

/**
 * Create a T8ngs test. Defining a test without the callback
 * will create a todo test.
 */
export function test(title: string, callback?: TestExecutor<TestContext, undefined>) {
  validator.ensureIsInPlanningPhase(executionPlanState.phase)
  const debuggingError = new Error()

  const testInstance = createTest(
    title,
    emitter,
    runnerConfig!.refiner,
    debuggingError,
    executionPlanState
  )
  testInstance.setup((t) => {
    activeTest = t
    return () => {
      activeTest = undefined
    }
  })

  if (callback) {
    testInstance.run(callback, debuggingError)
  }

  return testInstance
}

/**
 * Create a T8ngs test group
 */
test.group = function (title: string, callback: (group: Group) => void): Group {
  validator.ensureIsInPlanningPhase(executionPlanState.phase)

  const group = createTestGroup(title, emitter, runnerConfig!.refiner, executionPlanState)
  executionPlanState.group = group

  /**
   * Enable bail on the group an when bailLayer is set to "group"
   */
  if (cliArgs.bail && cliArgs.bailLayer === 'group') {
    executionPlanState.group.bail(true)
  }

  callback(executionPlanState.group)
  executionPlanState.group = undefined

  return group
}

/**
 * Create a test bound macro. Within the macro, you can access the
 * currently executed test to read its context values or define
 * cleanup hooks
 */
test.macro = function <T extends (test: Test, ...args: any[]) => any>(
  callback: T
): (...args: OmitFirstArg<Parameters<T>>) => ReturnType<T> {
  return (...args) => {
    if (!activeTest) {
      throw new Error('Cannot invoke macro outside of the test callback')
    }
    return callback(activeTest, ...args)
  }
}

/**
 * Get the test of currently running test
 */
export function getActiveTest() {
  return activeTest
}

/**
 * Get the test of currently running test or throw an error
 */
export function getActiveTestOrFail() {
  if (!activeTest) throw new Error('Cannot access active test outside of a test callback')
  return activeTest
}

/**
 * Make T8ngs process command line arguments. Later the parsed output
 * will be used by T8ngs to compute the configuration
 */
export function processCLIArgs(argv: string[]) {
  cliArgs = new CliParser().parse(argv)
}

/**
 * Configure the tests runner with inline configuration. You must
 * call configure method before the run method.
 *
 * Do note: The CLI flags will overwrite the options provided
 * to the configure method.
 */
export function configure(options: Config) {
  runnerConfig = new ConfigManager(options, cliArgs).hydrate()
}

/**
 * Execute T8ngs tests. Calling this function will import the test
 * files behind the scenes
 */
export async function run() {
  /**
   * Display help when help flag is used
   */
  if (cliArgs.help) {
    console.log(new CliParser().getHelp())
    return
  }

  validator.ensureIsConfigured(runnerConfig)

  executionPlanState.phase = 'planning'
  const runner = new Runner(emitter)

  /**
   * Enable bail on the runner and all the layers after the
   * runner when no specific bailLayer is specified
   */
  if (cliArgs.bail && cliArgs.bailLayer === '') {
    runner.bail(true)
  }

  const globalHooks = new GlobalHooks()
  const exceptionsManager = new ExceptionsManager()

  try {
    /**
     * Executing the retry plugin as the first thing
     */
    await retryPlugin({ config: runnerConfig!, runner, emitter, cliArgs })

    /**
     * Step 1: Executing plugins before creating a plan, so that it can mutate
     * the config
     */
    for (let plugin of runnerConfig!.plugins) {
      debug('executing "%s" plugin', plugin.name || 'anonymous')
      await plugin({ runner, emitter, cliArgs, config: runnerConfig! })
    }

    /**
     * Step 2: Creating an execution plan. The output is the result of
     * applying all the filters and validations.
     */
    const { config, reporters, suites, refinerFilters } = await new Planner(runnerConfig!).plan()

    /**
     * Step 3: Registering reporters and filters with the runner
     */
    reporters.forEach((reporter) => {
      debug('registering "%s" reporter', reporter.name)
      runner.registerReporter(reporter)
    })
    refinerFilters.forEach((filter) => {
      debug('apply %s filters "%O" ', filter.layer, filter.filters)
      config.refiner.add(filter.layer, filter.filters)
    })
    config.refiner.matchAllTags(cliArgs.matchAll ?? false)
    runner.onSuite(config.configureSuite)

    /**
     * Step 4: Running the setup hooks
     */
    debug('executing global hooks')
    globalHooks.apply(config)

    /**
     * Only run global hooks when we are not listing
     * pinned tests
     */
    if (!cliArgs.listPinned) {
      await globalHooks.setup(runner)
    }

    /**
     * Step 5: Register suites and import test files
     */
    for (let suite of suites) {
      /**
       * Creating and configuring the suite
       */
      debug('initiating suite %s', suite.name)
      executionPlanState.suite = new Suite(suite.name, emitter, config.refiner)
      executionPlanState.retries = suite.retries
      executionPlanState.timeout = suite.timeout
      if (typeof suite.configure === 'function') {
        suite.configure(executionPlanState.suite)
      }

      /**
       * Enable bail on the suite and all the layers after the
       * suite when bailLayer is set to "suite"
       */
      if (cliArgs.bail && cliArgs.bailLayer === 'suite') {
        debug('enabling bail mode for the suite %s', suite.name)
        executionPlanState.suite.bail(true)
      }
      runner.add(executionPlanState.suite)

      /**
       * Importing suite files
       */
      for (let fileURL of suite.filesURLs) {
        executionPlanState.file = fileURLToPath(fileURL)
        debug('importing test file %s', executionPlanState.file)
        await config.importer(fileURL)
      }

      /**
       * Resetting global state
       */
      executionPlanState.suite = undefined
    }

    /**
     * Exit early when there are one or more pinned tests
     */
    if (cliArgs.listPinned) {
      printPinnedTests(runner)
      if (config.forceExit) {
        debug('force exiting process')
        process.exit()
      }
      return
    }

    /**
     * Onto execution phase
     */
    executionPlanState.phase = 'executing'

    /**
     * Monitor for unhandled erorrs and rejections
     */
    exceptionsManager.monitor()

    await runner.start()
    await runner.exec()

    await globalHooks.teardown(null, runner)
    await runner.end()

    /**
     * Print unhandled errors
     */
    await exceptionsManager.report()

    const summary = runner.getSummary()
    if (summary.hasError || exceptionsManager.hasErrors) {
      debug(
        'updating exit code to 1. summary.hasError %s, process.hasError',
        summary.hasError,
        exceptionsManager.hasErrors
      )
      process.exitCode = 1
    }
    if (config.forceExit) {
      debug('force exiting process')
      process.exit()
    }
  } catch (error) {
    debug('error running tests %O', error)
    await globalHooks.teardown(error, runner)
    const printer = new ErrorsPrinter()
    await printer.printError(error)

    /**
     * Print unhandled errors in case the code inside
     * the try block never got triggered
     */
    await exceptionsManager.report()

    process.exitCode = 1
    if (runnerConfig!.forceExit) {
      debug('force exiting process')
      process.exit()
    }
  }
}
