
  import { parentPort } from 'node:worker_threads'
  import { register } from 'node:module'
  import { join, dirname } from 'node:path'
  import { fileURLToPath, pathToFileURL } from 'node:url'
  const HERE = dirname(fileURLToPath(import.meta.url))
  register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)
  const { buildWorld } = await import('./world-build.mjs')
  const world = await buildWorld()
  parentPort.on('message', async (msg) => {
    const sab = msg.sab
    const view = new Int32Array(sab)
    const value = world.ports['catalog.list']()
    const data = new Uint8Array(sab, 8, 92)
    for (let i = 0; i < 92; i++) data[i] = (i * 13 + 1) & 0xff
    Atomics.store(view, 1, 92)
    Atomics.store(view, 0, 1)
  })
