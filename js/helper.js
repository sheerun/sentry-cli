'use strict';

const os = require('os');
const path = require('path');
const childProcess = require('child_process');

/**
 * Absolute path to the sentry-cli binary (platform dependant).
 * @type {string}
 */
// istanbul ignore next
let binaryPath =
  os.platform() === 'win32'
    ? path.resolve(__dirname, '..\\bin\\sentry-cli.exe')
    : path.resolve(__dirname, '../sentry-cli');

/**
 * Overrides the default binary path with a mock value, useful for testing.
 *
 * @param {string} mockPath The new path to the mock sentry-cli binary
 */
function mockBinaryPath(mockPath) {
  binaryPath = mockPath;
}

/**
 * The javascript type of a command line option.
 * @typedef {'array'|'string'|'boolean'|'inverted-boolean'} OptionType
 */

/**
 * Schema definition of a command line option.
 * @typedef {object} OptionSchema
 * @prop {string} param The flag of the command line option including dashes.
 * @prop {OptionType} type The value type of the command line option.
 */

/**
 * Schema definition for a command.
 * @typedef {Object.<string, OptionSchema>} OptionsSchema
 */

/**
 * Serializes command line options into an arguments array.
 *
 * @param {OptionsSchema} schema An options schema required by the command.
 * @param {object} options An options object according to the schema.
 * @returns {string[]} An arguments array that can be passed via command line.
 */
function serializeOptions(schema, options) {
  return Object.keys(schema).reduce((newOptions, option) => {
    const paramValue = options[option];
    if (paramValue === undefined) {
      return newOptions;
    }

    // eslint-disable-next-line no-shadow
    return schema[option].reduce((newOptions, action) => {
      const paramType = action.type;
      const paramName = action.param;

      if (paramType === 'array') {
        if (!Array.isArray(paramValue)) {
          throw new Error(`${option} should be an array`);
        }

        return newOptions.concat(
          paramValue.reduce((acc, value) => acc.concat([paramName, String(value)]), [])
        );
      }

      if (paramType === 'boolean' || paramType === 'inverted-boolean') {
        if (typeof paramValue !== 'boolean') {
          throw new Error(`${option} should be a bool`);
        }
        if (paramType === 'boolean' && paramValue) {
          return newOptions.concat([paramName]);
        }

        if (paramType === 'inverted-boolean' && paramValue === false) {
          return newOptions.concat([paramName]);
        }
        return newOptions;
      }

      return newOptions.concat(paramName, paramValue);
    }, newOptions);
  }, []);
}

/**
 * Serializes the command and its options into an arguments array.
 *
 * @param {string} command The literal name of the command.
 * @param {OptionsSchema} [schema] An options schema required by the command.
 * @param {object} [options] An options object according to the schema.
 * @returns {string[]} An arguments array that can be passed via command line.
 */
function prepareCommand(command, schema, options) {
  return command.concat(serializeOptions(schema || {}, options || {}));
}

/**
 * Returns the absolute path to the `sentry-cli` binary.
 * @returns {string}
 */
function getPath() {
  return binaryPath;
}

/**
 * Runs `sentry-cli` with the given command line arguments.
 *
 * Use {@link prepareCommand} to specify the command and add arguments for command-
 * specific options. For top-level options, use {@link serializeOptions} directly.
 *
 * The returned promise resolves with the standard output of the command invocation
 * including all newlines. In order to parse this output, be sure to trim the output
 * first.
 *
 * If the command failed to execute, the Promise rejects with the error returned by the
 * CLI. This error includes a `code` property with the process exit status.
 *
 * @example
 * const output = await execute(['--version']);
 * expect(output.trim()).toBe('sentry-cli x.y.z');
 *
 * @param {string[]} args Command line arguments passed to `sentry-cli`.
 * @param {boolean} live We inherit stdio to display `sentry-cli` output directly.
 * @returns {Promise.<string>} A promise that resolves to the standard output.
 */
function execute(args, live) {
  const env = Object.assign({}, process.env);
  return new Promise((resolve, reject) => {
    if (live === true) {
      const pid = childProcess.spawn(getPath(), args, {
        env,
        stdio: 'inherit',
      });
      pid.on('exit', () => {
        resolve();
      });
    } else {
      childProcess.execFile(getPath(), args, { env }, (err, stdout) => {
        if (err) {
          reject(err);
        } else {
          resolve(stdout);
        }
      });
    }
  });
}

module.exports = {
  mockBinaryPath,
  serializeOptions,
  prepareCommand,
  getPath,
  execute,
};
