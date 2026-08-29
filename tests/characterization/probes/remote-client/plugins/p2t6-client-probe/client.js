/* P2T6-CLIENT-BUNDLE — browser half of p2t6-client-probe.
 *
 * CJS-style ModuleLoader bundle in the exact format the web shell seeds
 * (window.__ModuleLoader__.load + factory(require)). The P2-T6 probe group
 * asserts the P2T6-CLIENT-BUNDLE marker in the bytes served through the
 * public /plugins combo route, which proves: discovery of an external
 * dsh.client package, boot-graph entry composition, and bundle serving.
 *
 * The apply body is deliberately inert: this probe runs without a browser,
 * so the seam is proven at the machine level (discovery + graph + serve),
 * not through rendered UI.
 */
window.__ModuleLoader__.load({
  id: "p2t6-client-probe",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    var inject = [];

    function apply(ctx) {
      // Inert by design (P2-T6 machine-level seam probe; no browser present).
      void ctx;
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
