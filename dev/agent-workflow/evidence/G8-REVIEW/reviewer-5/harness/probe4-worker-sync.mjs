
    import { parentPort } from 'node:worker_threads'
    parentPort.on('message', async (msg) => {
      const sab = msg.sab
      const view = new Int32Array(sab)
      
      const data = new Uint8Array(sab, 8, 92)
      for (let i = 0; i < 92; i++) data[i] = (i * 13 + 1) & 0xff
      Atomics.store(view, 1, 92)
      Atomics.store(view, 0, 1)
    })
  