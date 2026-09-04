import { pathToFileURL } from 'node:url'
const [,, cacDir] = process.argv
const mod = await import(pathToFileURL(cacDir + '/dist/index.js').href)
const { cac } = mod
const cli = cac('tsdown')
cli
  .command('[...files]', 'Bundle files', { ignoreOptionDefaultValue: true, allowUnknownOptions: true })
  .option('-c, --config <filename>', 'Use a custom config file')
  .option('--env.* <value>', 'Define compile-time env variables')
  .option('--clean', 'Clean output directory, --no-clean to disable')
  .action(async (input, flags) => {
    console.log('input=' + JSON.stringify(input))
    console.log('flags=' + JSON.stringify(flags))
  })
cli.parse(['tsdown', '--env.DSH_BUILD_FACE', 'host'], { run: true })
