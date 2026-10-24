const s = ".mjs";
export const a = import("./hostdep.js" + s);
const e = Math.random();
export const b = import/*c*/(e ? "./hostdep.js" : "./shared.js");
export default 0;
