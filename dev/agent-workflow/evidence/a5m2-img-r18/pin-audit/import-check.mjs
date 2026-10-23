// GATE G2: importing the kit must be INERT (no main(), no world, no disk writes, no exit).
const before = process.argv.slice()
const mod = await import('../tests/kits/a5m2-todo-c2/a5m2-todo-c2.mjs')
console.log('IMPORT-INERT-OK exports=', Object.keys(mod).length, 'argv-untouched=', JSON.stringify(process.argv.slice()) === JSON.stringify(before))
