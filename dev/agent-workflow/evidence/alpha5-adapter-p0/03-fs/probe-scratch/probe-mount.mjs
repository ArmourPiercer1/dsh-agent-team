import { pathToFileURL } from 'node:url'
import { lstatSync } from 'node:fs'
import { join, resolve } from 'node:path'
const HERE = new URL('.', import.meta.url).pathname
const WT = resolve(HERE, '../../../../..') // probe-scratch -> 03-fs -> alpha5-adapter-p0 -> evidence -> agent-workflow -> dev -> WT? check
console.log('WT guess', WT)
const W = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/exp-alpha5-poc-20261016'
const links = ['cordis','dsh-scope','dsh-system-prompt','dsh-tools','dsh-llm'].map(n=>join(W,'node_modules/@deepseek-ai',n))
const snap = links.map(p=>[p, lstatSync(p).isSymbolicLink() ? process.argv0 && require('fs').readlinkSync(p) : 'real'])
