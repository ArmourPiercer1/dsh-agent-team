const seamUrl = rowConfig.seamUrl ?? resolveDefaultSeamUrl(import.meta.url);
export const m = await import(seamUrl);
function resolveDefaultSeamUrl(u){ return u; }
