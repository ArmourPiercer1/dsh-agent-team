/* P2T6-MALFORMED-DECL-BUNDLE — valid bundle shipped with the malformed
 * declaration fixture so the composition failure is the declaration alone. */
window.__ModuleLoader__.load({
  id: "p2t6-malformed-decl",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var inject = [];

    function apply(ctx) {
      void ctx;
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
