window.__ModuleLoader__.load({
	id: "@dsh-agent-team/client",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		/* S8 composition adapter (D-T9-11 territory): the P9 client product ships a plain tsc ESM dist; this single-file facade inlines its module graph, externalizes the baseline module-table specifiers, and maps .module.css to identity class maps with real CSS <style> injection. */
		var __extCache = {};
		function __extReq(spec) { var m = __extCache[spec]; if (m === undefined) { m = __extCache[spec] = require(spec); } return m; }
		var __cssTable = {"ui/TeamDock.module.css":{"classes":{"root":"root","row":"row","jump":"jump","title":"title","sep":"sep","readout":"readout","chevron":"chevron","expanded":"expanded","members":"members","tasks":"tasks","member":"member","task":"task","dotSlot":"dotSlot","name":"name","subject":"subject","taskStatus":"taskStatus","empty":"empty"},"text":"/* Team dock in the composer context stack (the D12 thin readout): one\r\n   collapsed 13px row in the shared dock column (same card alignment as the\r\n   todo/queue strips above it), the expanded body a compact member status and\r\n   task list. The --dsh-composer-* width axis inherits from the conversation\r\n   root, whose subtree hosts the dock slot. */\r\n\r\n.root {\r\n  box-sizing: border-box;\r\n  flex: none;\r\n  overflow: hidden;\r\n  margin: 0 auto;\r\n  width: calc(\r\n    100% -\r\n    var(--dsh-composer-side-clearance) -\r\n    var(--dsh-composer-side-clearance) -\r\n    var(--dsh-composer-dock-inset) -\r\n    var(--dsh-composer-dock-inset) -\r\n    var(--dsh-composer-dock-inset) -\r\n    var(--dsh-composer-dock-inset)\r\n  );\r\n  max-width: calc(\r\n    var(--dsh-composer-card-max-width) -\r\n    var(--dsh-composer-dock-inset) -\r\n    var(--dsh-composer-dock-inset) -\r\n    var(--dsh-composer-dock-inset) -\r\n    var(--dsh-composer-dock-inset)\r\n  );\r\n  border: 1px solid var(--dsw-alias-border-l1);\r\n  border-radius: 12px;\r\n  background: var(--dsw-specific-tip);\r\n  /* Elevated surface: the same tip rung as the sibling dock cards, and the\r\n     expanded lists scroll inside this card, so the thumb takes the l2\r\n     elevation tokens (they inherit down to the lists). */\r\n  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);\r\n  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);\r\n}\r\n\r\n.row {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 2px;\r\n  padding: 0 4px 0 12px;\r\n}\r\n\r\n.jump {\r\n  display: flex;\r\n  flex: 1 1 auto;\r\n  align-items: center;\r\n  min-width: 0;\r\n  padding: 4px;\r\n  border: none;\r\n  border-radius: 8px;\r\n  background: transparent;\r\n  text-align: left;\r\n  cursor: pointer;\r\n}\r\n\r\n.title {\r\n  flex: none;\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 500;\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n/* The D12 separators (title→first segment, segment→segment) share one\r\n   en-space joiner, so the readout line carries its own spacing and the\r\n   flex gap stays zero. */\r\n.sep {\r\n  flex: none;\r\n  font: var(--dsw-font-xs-13);\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n.readout {\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  font: var(--dsw-font-xs-13);\r\n  color: var(--dsw-alias-label-tertiary);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.jump:hover .sep,\r\n.jump:focus-visible .sep,\r\n.jump:hover .readout,\r\n.jump:focus-visible .readout {\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.jump:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.chevron {\r\n  display: grid;\r\n  flex: none;\r\n  place-items: center;\r\n  padding: 6px;\r\n  border: none;\r\n  border-radius: 8px;\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  cursor: pointer;\r\n}\r\n\r\n.chevron:hover {\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.chevron:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.expanded {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  padding: 2px 12px 8px;\r\n}\r\n\r\n.members,\r\n.tasks {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  margin: 0;\r\n  padding: 0;\r\n  list-style: none;\r\n  max-height: 132px;\r\n  overflow-y: auto;\r\n}\r\n\r\n.member,\r\n.task {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  min-width: 0;\r\n  font: var(--dsw-font-xs-13);\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.dotSlot {\r\n  display: grid;\r\n  flex: none;\r\n  place-items: center;\r\n  width: 14px;\r\n  height: 14px;\r\n}\r\n\r\n.name,\r\n.subject {\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.taskStatus {\r\n  flex: none;\r\n  font: var(--dsw-font-xxxs-11);\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n.empty {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n"},"ui/TeamSettingsSection.module.css":{"classes":{"container":"container","title":"title","emptyState":"emptyState","emptyTitle":"emptyTitle","emptyDescription":"emptyDescription","steps":"steps"},"text":".container {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 12px;\r\n  padding: 16px;\r\n}\r\n\r\n.title {\r\n  font-size: 16px;\r\n  font-weight: 600;\r\n  color: var(--dsw-alias-label-primary);\r\n  margin: 0;\r\n}\r\n\r\n.emptyState {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  padding: 12px;\r\n  border-radius: 8px;\r\n  background: var(--dsw-alias-bg-module-platform);\r\n}\r\n\r\n.emptyTitle {\r\n  font-weight: 500;\r\n  color: var(--dsw-alias-label-secondary);\r\n  margin: 0;\r\n}\r\n\r\n.emptyDescription {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  margin: 0;\r\n}\r\n\r\n.steps {\r\n  margin: 0;\r\n  padding-left: 24px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n}\r\n\r\n.steps li {\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.steps code {\r\n  font-family: var(--ds-font-family-code);\r\n  font-size: 13px;\r\n  background: var(--dsw-alias-bg-overlay);\r\n  padding: 2px 6px;\r\n  border-radius: 4px;\r\n}\r\n"},"ui/TeamView.module.css":{"classes":{"zero":"zero","zeroInner":"zeroInner","zeroText":"zeroText","zeroStart":"zeroStart","body":"body","section":"section","sectionTitle":"sectionTitle","legacyBanner":"legacyBanner","legacySummary":"legacySummary","legacySummaryTitle":"legacySummaryTitle","legacyNote":"legacyNote"},"text":".zero {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  min-height: 100%;\r\n  padding: 24px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n.zeroInner {\r\n  display: flex;\r\n  flex-direction: column;\r\n  align-items: center;\r\n  gap: 12px;\r\n  width: 100%;\r\n  max-width: 720px;\r\n}\r\n\r\n.zeroText {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-tertiary);\r\n}\r\n\r\n.zeroStart {\r\n  padding: 6px 14px;\r\n  border: 1px solid var(--dsw-alias-state-business-primary);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-state-business-primary);\r\n  color: var(--dsw-alias-bg-layer-1);\r\n  font: var(--dsw-font-xs-13);\r\n  cursor: pointer;\r\n}\r\n\r\n.zeroStart:hover {\r\n  opacity: 0.88;\r\n}\r\n\r\n.zeroStart:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: 1px;\r\n}\r\n\r\n.body {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 16px;\r\n  min-height: 100%;\r\n  padding: 16px 24px;\r\n}\r\n\r\n.section {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  min-width: 0;\r\n}\r\n\r\n.sectionTitle {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n}\r\n\r\n/* P9-T8 (S5-D): the legacy zero state (UI §34 read-only banner + summary). */\r\n\r\n.legacyBanner {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  padding: 10px 12px;\r\n  border: 1px solid var(--dsw-alias-state-warn-primary);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-state-warn-tertiary);\r\n}\r\n\r\n.legacyBanner p {\r\n  margin: 0;\r\n  color: var(--dsw-alias-state-warn-label);\r\n  font: var(--dsw-font-xs-13);\r\n  line-height: 1.4;\r\n}\r\n\r\n.legacySummary {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  padding: 10px 12px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.legacySummaryTitle {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n}\r\n\r\n.legacySummary p {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.legacySummary ul {\r\n  margin: 0;\r\n  padding-left: 16px;\r\n  list-style: none;\r\n}\r\n\r\n.legacySummary li {\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.legacyNote {\r\n  margin: 0;\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n"},"ui/TeamTimeline.module.css":{"classes":{"root":"root","empty":"empty","plot":"plot","corner":"corner","axis":"axis","tick":"tick","gutter":"gutter","gutterRow":"gutterRow","swatch":"swatch","laneName":"laneName","track":"track","domain":"domain","lane":"lane","bar":"bar"},"text":".root {\r\n  --team-lane-height: 28px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l2);\r\n  user-select: none;\r\n}\r\n\r\n.root :global([role='tooltip']) {\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.empty {\r\n  margin: 0;\r\n  padding: 12px 16px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n\r\n.plot {\r\n  display: grid;\r\n  grid-template-columns: 160px minmax(0, 1fr);\r\n  grid-template-rows: 20px auto;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.corner {\r\n  border-right: 1px solid var(--dsw-alias-border-l1);\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n}\r\n\r\n.axis {\r\n  position: relative;\r\n  overflow: hidden;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n}\r\n\r\n.tick {\r\n  position: absolute;\r\n  top: 3px;\r\n  left: var(--team-tick-left);\r\n  padding-left: 4px;\r\n  border-left: 1px solid var(--dsw-alias-border-l2);\r\n  height: 100%;\r\n  color: var(--dsw-alias-label-caption);\r\n  font: var(--dsw-font-xxxs-11);\r\n  white-space: nowrap;\r\n}\r\n\r\n.gutter {\r\n  border-right: 1px solid var(--dsw-alias-border-l1);\r\n}\r\n\r\n.gutterRow {\r\n  display: flex;\r\n  gap: 6px;\r\n  align-items: center;\r\n  height: var(--team-lane-height);\r\n  padding: 0 8px;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n}\r\n\r\n.gutterRow:last-child {\r\n  border-bottom: 0;\r\n}\r\n\r\n.swatch {\r\n  flex: none;\r\n  width: 8px;\r\n  height: 8px;\r\n  border-radius: 2px;\r\n  background: var(--team-lane-color, var(--dsw-alias-label-tertiary));\r\n}\r\n\r\n.laneName {\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.gutterRow[data-current='true'] .laneName {\r\n  color: var(--dsw-alias-label-primary);\r\n  font-weight: 600;\r\n}\r\n\r\n.track {\r\n  position: relative;\r\n  overflow: hidden;\r\n  height: calc(var(--team-lane-count, 1) * var(--team-lane-height));\r\n  cursor: grab;\r\n  touch-action: none;\r\n}\r\n\r\n.track[data-panning='true'] {\r\n  cursor: grabbing;\r\n}\r\n\r\n.track:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.domain {\r\n  position: absolute;\r\n  top: 0;\r\n  bottom: 0;\r\n  left: var(--team-domain-left);\r\n  width: var(--team-domain-width);\r\n}\r\n\r\n.lane {\r\n  position: relative;\r\n  height: var(--team-lane-height);\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n}\r\n\r\n.lane:last-child {\r\n  border-bottom: 0;\r\n}\r\n\r\n.lane[data-current='true'] {\r\n  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent);\r\n}\r\n\r\n.bar {\r\n  position: absolute;\r\n  top: 50%;\r\n  left: var(--team-bar-left);\r\n  width: max(2px, var(--team-bar-width));\r\n  height: 14px;\r\n  min-width: 2px;\r\n  transform: translateY(-50%);\r\n  border-radius: 2px;\r\n  background: var(--team-lane-color, var(--dsw-alias-label-tertiary));\r\n  opacity: 0.85;\r\n  cursor: pointer;\r\n}\r\n\r\n.bar:hover {\r\n  opacity: 1;\r\n}\r\n\r\n.bar[data-running='true'] {\r\n  animation: team-bar-pulse 1.2s ease-in-out infinite;\r\n}\r\n\r\n@keyframes team-bar-pulse {\r\n  0%,\r\n  100% {\r\n    opacity: 1;\r\n  }\r\n\r\n  50% {\r\n    opacity: 0.55;\r\n  }\r\n}\r\n\r\n@media (prefers-reduced-motion: reduce) {\r\n  .bar[data-running='true'] {\r\n    animation: none;\r\n  }\r\n}\r\n\r\n/* The lane-color ramp (slot index → existing state token; the tint tier\r\n   lightens a hue toward the layer background for members beyond the four\r\n   base colors). */\r\n[data-lane-color='0'] {\r\n  --team-lane-color: var(--dsw-alias-state-business-primary);\r\n}\r\n\r\n[data-lane-color='1'] {\r\n  --team-lane-color: var(--dsw-alias-state-success-primary);\r\n}\r\n\r\n[data-lane-color='2'] {\r\n  --team-lane-color: var(--dsw-alias-state-warn-primary);\r\n}\r\n\r\n[data-lane-color='3'] {\r\n  --team-lane-color: var(--dsw-alias-state-error-primary);\r\n}\r\n\r\n[data-lane-color='4'] {\r\n  --team-lane-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, var(--dsw-alias-bg-layer-2));\r\n}\r\n\r\n[data-lane-color='5'] {\r\n  --team-lane-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 55%, var(--dsw-alias-bg-layer-2));\r\n}\r\n\r\n[data-lane-color='6'] {\r\n  --team-lane-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 55%, var(--dsw-alias-bg-layer-2));\r\n}\r\n\r\n[data-lane-color='7'] {\r\n  --team-lane-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 55%, var(--dsw-alias-bg-layer-2));\r\n}\r\n"},"ui/TeamMembers.module.css":{"classes":{"root":"root","group":"group","groupRow":"groupRow","groupName":"groupName","instances":"instances","instanceRow":"instanceRow","instanceNav":"instanceNav","actions":"actions","actionButton":"actionButton","commandError":"commandError","dotSlot":"dotSlot","instanceStatus":"instanceStatus","instanceAction":"instanceAction","waitingBadge":"waitingBadge","noInstances":"noInstances","createButton":"createButton"},"text":".root {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  min-width: 0;\r\n}\r\n\r\n.group {\r\n  overflow: hidden;\r\n  min-width: 0;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.group[data-current='true'] {\r\n  border-color: var(--dsw-alias-state-business-primary);\r\n}\r\n\r\n.groupRow {\r\n  display: flex;\r\n  align-items: center;\r\n  width: 100%;\r\n  padding: 6px 10px;\r\n  border: 0;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n  text-align: left;\r\n}\r\n\r\n.groupRow[data-leader='true'] {\r\n  cursor: pointer;\r\n}\r\n\r\n.groupRow[data-leader='true']:hover {\r\n  background: var(--dsw-alias-bg-layer-3);\r\n}\r\n\r\n.groupRow[data-leader='true']:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.groupName {\r\n  overflow: hidden;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.group[data-current='true'] .groupName {\r\n  color: var(--dsw-alias-state-business-primary);\r\n}\r\n\r\n.instances {\r\n  display: flex;\r\n  flex-direction: column;\r\n}\r\n\r\n.instanceRow {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 4px 8px;\r\n  width: 100%;\r\n  padding: 6px 10px 6px 18px;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n\r\n.instanceRow:last-child {\r\n  border-bottom: 0;\r\n}\r\n\r\n.instanceRow[data-current='true'] {\r\n  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 7%, transparent);\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.instanceNav {\r\n  display: flex;\r\n  flex: 1 1 auto;\r\n  align-items: center;\r\n  gap: 8px;\r\n  min-width: 0;\r\n  padding: 0;\r\n  border: 0;\r\n  background: transparent;\r\n  color: inherit;\r\n  font: inherit;\r\n  text-align: left;\r\n  cursor: pointer;\r\n}\r\n\r\n.instanceNav:hover {\r\n  background: var(--dsw-alias-bg-layer-3);\r\n}\r\n\r\n.instanceNav:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: 2px;\r\n}\r\n\r\n.instanceNav:disabled {\r\n  cursor: default;\r\n  opacity: 0.55;\r\n}\r\n\r\n.actions {\r\n  display: flex;\r\n  flex: none;\r\n  gap: 4px;\r\n}\r\n\r\n.actionButton {\r\n  padding: 2px 8px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 4px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  cursor: pointer;\r\n}\r\n\r\n.actionButton:hover:not(:disabled) {\r\n  background: var(--dsw-alias-bg-layer-3);\r\n}\r\n\r\n.actionButton:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.actionButton:disabled {\r\n  opacity: 0.5;\r\n  cursor: default;\r\n}\r\n\r\n.commandError {\r\n  width: 100%;\r\n  padding: 4px 8px;\r\n  border-radius: 4px;\r\n  background: color-mix(in srgb, var(--dsw-alias-state-error-secondary) 18%, transparent);\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  line-height: 1.4;\r\n  word-break: break-word;\r\n}\r\n\r\n.dotSlot {\r\n  display: inline-flex;\r\n  flex: none;\r\n  align-items: center;\r\n}\r\n\r\n.instanceStatus {\r\n  flex: none;\r\n}\r\n\r\n.instanceAction {\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-caption);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.waitingBadge {\r\n  flex: none;\r\n  margin-left: auto;\r\n  padding: 0 6px;\r\n  border-radius: 4px;\r\n  background: var(--dsw-alias-state-warn-tertiary);\r\n  color: var(--dsw-alias-state-warn-label);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.noInstances {\r\n  display: block;\r\n  padding: 6px 10px 6px 18px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.createButton {\r\n  flex: none;\r\n  margin-left: auto;\r\n  padding: 0 8px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 4px;\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n  line-height: 18px;\r\n  cursor: pointer;\r\n}\r\n\r\n.createButton:hover {\r\n  background: var(--dsw-alias-bg-layer-3);\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.createButton:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n"},"ui/TeamActivity.module.css":{"classes":{"root":"root","empty":"empty","taskRow":"taskRow","dotSlot":"dotSlot","taskMain":"taskMain","taskLine":"taskLine","taskSubject":"taskSubject","taskStatus":"taskStatus","taskAssignee":"taskAssignee","taskSummary":"taskSummary"},"text":".root {\r\n  display: flex;\r\n  flex-direction: column;\r\n  min-width: 0;\r\n  overflow: hidden;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.empty {\r\n  display: block;\r\n  padding: 6px 10px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n\r\n.taskRow {\r\n  display: flex;\r\n  gap: 8px;\r\n  padding: 6px 10px;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n  min-width: 0;\r\n}\r\n\r\n.taskRow:last-child {\r\n  border-bottom: 0;\r\n}\r\n\r\n.dotSlot {\r\n  display: inline-flex;\r\n  flex: none;\r\n  align-items: flex-start;\r\n  padding-top: 3px;\r\n}\r\n\r\n.taskMain {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  min-width: 0;\r\n}\r\n\r\n.taskLine {\r\n  display: flex;\r\n  align-items: baseline;\r\n  gap: 8px;\r\n  min-width: 0;\r\n}\r\n\r\n.taskSubject {\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.taskStatus {\r\n  flex: none;\r\n  color: var(--dsw-alias-label-caption);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.taskAssignee {\r\n  color: var(--dsw-alias-label-caption);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.taskSummary {\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n"},"ui/TeamLedger.module.css":{"classes":{"root":"root","empty":"empty","top":"top","loadEarlier":"loadEarlier","loadFailed":"loadFailed","truncated":"truncated","rows":"rows","row":"row","dotSlot":"dotSlot","time":"time","marker":"marker","actor":"actor","summary":"summary","state":"state","stateReason":"stateReason","filter":"filter"},"text":".root {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  min-width: 0;\r\n}\r\n\r\n.empty {\r\n  display: block;\r\n  padding: 12px 16px;\r\n  border: 1px dashed var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xs-13);\r\n  text-align: center;\r\n}\r\n\r\n.top {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  min-height: 22px;\r\n}\r\n\r\n.loadEarlier {\r\n  padding: 2px 10px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  cursor: pointer;\r\n}\r\n\r\n.loadEarlier:hover {\r\n  background: var(--dsw-alias-bg-layer-3);\r\n  color: var(--dsw-alias-label-primary);\r\n}\r\n\r\n.loadEarlier:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.loadFailed {\r\n  padding: 2px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-state-warn-tertiary);\r\n  color: var(--dsw-alias-state-warn-label);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.truncated {\r\n  padding: 2px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.rows {\r\n  display: flex;\r\n  flex-direction: column;\r\n  overflow: hidden;\r\n  min-width: 0;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.row {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  width: 100%;\r\n  padding: 6px 10px;\r\n  border: 0;\r\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\r\n  background: transparent;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n  text-align: left;\r\n  cursor: pointer;\r\n  min-width: 0;\r\n}\r\n\r\n.row:last-child {\r\n  border-bottom: 0;\r\n}\r\n\r\n.row:hover {\r\n  background: var(--dsw-alias-bg-layer-3);\r\n}\r\n\r\n.row:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.row:disabled {\r\n  cursor: default;\r\n  opacity: 0.55;\r\n}\r\n\r\n.dotSlot {\r\n  display: inline-flex;\r\n  flex: none;\r\n  align-items: center;\r\n}\r\n\r\n.time {\r\n  flex: none;\r\n  color: var(--dsw-alias-label-caption);\r\n  font: var(--dsw-font-xxxs-11);\r\n  font-variant-numeric: tabular-nums;\r\n}\r\n\r\n.marker {\r\n  flex: none;\r\n  padding: 0 6px;\r\n  border-radius: 4px;\r\n  background: var(--dsw-alias-bg-layer-3);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.actor {\r\n  flex: none;\r\n  max-width: 220px;\r\n  overflow: hidden;\r\n  color: var(--dsw-alias-label-primary);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.summary {\r\n  overflow: hidden;\r\n  min-width: 0;\r\n  flex: 1 1 auto;\r\n  color: var(--dsw-alias-label-secondary);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n.state {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  flex: none;\r\n  max-width: 40%;\r\n  padding: 0 6px;\r\n  border-radius: 4px;\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.state[data-pending='true'] {\r\n  background: var(--dsw-alias-state-warn-tertiary);\r\n  color: var(--dsw-alias-state-warn-label);\r\n}\r\n\r\n.state:not([data-pending='true']) {\r\n  background: var(--dsw-alias-bg-layer-3);\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.stateReason {\r\n  overflow: hidden;\r\n  max-width: 100%;\r\n  color: var(--dsw-alias-label-caption);\r\n  text-overflow: ellipsis;\r\n  white-space: nowrap;\r\n}\r\n\r\n/* P9-T6 addition (UI §27.4): the client-local category / instance filter\r\n   selects, styled in the same control language as `.loadEarlier`. */\r\n.filter {\r\n  padding: 2px 6px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  max-width: 180px;\r\n  cursor: pointer;\r\n}\r\n\r\n.filter:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n"},"ui/TeamCreationPanel.module.css":{"classes":{"panel":"panel","title":"title","field":"field","fieldLabel":"fieldLabel","select":"select","textarea":"textarea","hint":"hint","detail":"detail","detailName":"detailName","detailSource":"detailSource","detailDescription":"detailDescription","detailTemplates":"detailTemplates","compat":"compat","compatTitle":"compatTitle","compatNote":"compatNote","compatReady":"compatReady","compatUnknown":"compatUnknown","warningList":"warningList","warningRow":"warningRow","warningOwner":"warningOwner","warningSubjects":"warningSubjects","warningDetail":"warningDetail","ack":"ack","fatal":"fatal","fatalTitle":"fatalTitle","fatalRow":"fatalRow","fatalPreset":"fatalPreset","error":"error","rootKept":"rootKept","actions":"actions","primary":"primary","secondary":"secondary","handoff":"handoff","handoffTitle":"handoffTitle","handoffNote":"handoffNote","handoffReady":"handoffReady","handoffPreview":"handoffPreview","handoffError":"handoffError","handoffFailed":"handoffFailed","handoffTriad":"handoffTriad"},"text":".panel {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 12px;\r\n  padding: 14px 16px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 8px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n}\r\n\r\n.title {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-s-14);\r\n  font-weight: 600;\r\n}\r\n\r\n.field {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  min-width: 0;\r\n}\r\n\r\n.fieldLabel {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.select,\r\n.textarea {\r\n  width: 100%;\r\n  padding: 5px 8px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n\r\n.textarea {\r\n  min-height: 54px;\r\n  resize: vertical;\r\n}\r\n\r\n.select:focus-visible,\r\n.textarea:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.select:disabled {\r\n  opacity: 0.5;\r\n  cursor: default;\r\n}\r\n\r\n.hint {\r\n  margin: -6px 0 0;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  line-height: 1.4;\r\n}\r\n\r\n.detail {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: baseline;\r\n  gap: 6px;\r\n  padding: 8px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.detailName {\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n}\r\n\r\n.detailSource {\r\n  padding: 1px 6px;\r\n  border-radius: 4px;\r\n  background: var(--dsw-alias-bg-layer-3);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.detailDescription {\r\n  flex-basis: 100%;\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n  line-height: 1.5;\r\n}\r\n\r\n.detailTemplates {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.compat {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n  padding: 8px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.compatTitle {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.compatNote,\r\n.compatReady,\r\n.compatUnknown {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n  line-height: 1.5;\r\n}\r\n\r\n.compatReady {\r\n  color: var(--dsw-alias-state-success-primary);\r\n}\r\n\r\n.compatUnknown {\r\n  color: var(--dsw-alias-state-error-primary);\r\n}\r\n\r\n.warningList {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n  margin: 0;\r\n  padding: 0;\r\n  list-style: none;\r\n}\r\n\r\n.warningRow {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  padding: 6px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-state-warn-tertiary);\r\n  color: var(--dsw-alias-state-warn-label);\r\n}\r\n\r\n.warningOwner {\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n}\r\n\r\n.warningSubjects,\r\n.warningDetail {\r\n  color: var(--dsw-alias-state-warn-label);\r\n  font: var(--dsw-font-xxxs-11);\r\n  line-height: 1.4;\r\n}\r\n\r\n.ack {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  cursor: pointer;\r\n}\r\n\r\n.ack input {\r\n  margin: 0;\r\n}\r\n\r\n.fatal {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  padding: 8px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-state-error-secondary);\r\n}\r\n\r\n.fatalTitle,\r\n.fatalRow {\r\n  margin: 0;\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  line-height: 1.5;\r\n}\r\n\r\n.fatalRow {\r\n  font: var(--dsw-font-xxxs-11);\r\n  color: var(--dsw-alias-label-secondary);\r\n}\r\n\r\n.fatalPreset {\r\n  margin: 0;\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  line-height: 1.5;\r\n}\r\n\r\n.error {\r\n  padding: 8px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-state-error-secondary);\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  line-height: 1.5;\r\n}\r\n\r\n.rootKept {\r\n  margin: 4px 0 0;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.actions {\r\n  display: flex;\r\n  gap: 8px;\r\n}\r\n\r\n.primary,\r\n.secondary {\r\n  padding: 6px 14px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  cursor: pointer;\r\n}\r\n\r\n.primary {\r\n  background: var(--dsw-alias-state-business-primary);\r\n  border-color: var(--dsw-alias-state-business-primary);\r\n  color: var(--dsw-alias-bg-layer-1);\r\n}\r\n\r\n.primary:hover:not(:disabled),\r\n.secondary:hover:not(:disabled) {\r\n  opacity: 0.88;\r\n}\r\n\r\n.primary:focus-visible,\r\n.secondary:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: 1px;\r\n}\r\n\r\n.primary:disabled,\r\n.secondary:disabled {\r\n  opacity: 0.5;\r\n  cursor: default;\r\n}\r\n\r\n/* P9-T8 (S5-D): the §32 handoff block (the optional face + source surface). */\r\n\r\n.handoff {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n  padding: 10px 12px;\r\n  border: 1px solid var(--dsw-alias-border-l1);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.handoffTitle {\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n}\r\n\r\n.handoff > span:not(.handoffTitle) {\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.handoff > label {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n\r\n.handoff > label:has(input:disabled) {\r\n  opacity: 0.5;\r\n  cursor: default;\r\n}\r\n\r\n.handoffNote {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.handoffReady {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 8px;\r\n}\r\n\r\n.handoffReady > span {\r\n  color: var(--dsw-alias-state-success-primary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  font-weight: 600;\r\n}\r\n\r\n.handoffPreview {\r\n  width: 100%;\r\n  padding: 6px 8px;\r\n  border-left: 2px solid var(--dsw-alias-border-l2);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.handoffPreview > p {\r\n  margin: 0 0 3px;\r\n  color: var(--dsw-alias-label-primary);\r\n  font-weight: 600;\r\n}\r\n\r\n.handoffPreview ul {\r\n  margin: 0;\r\n  padding-left: 16px;\r\n  list-style: disc;\r\n}\r\n\r\n.handoffPreview li {\r\n  margin: 1px 0;\r\n  word-break: break-word;\r\n}\r\n\r\n.handoffError,\r\n.handoffFailed > p {\r\n  margin: 0;\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.handoffFailed {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n  padding: 8px 10px;\r\n  border: 1px solid var(--dsw-alias-state-error-secondary);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n}\r\n\r\n.handoffTriad {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  gap: 6px;\r\n}\r\n"},"ui/TeamGovernance.module.css":{"classes":{"section":"section","card":"card","cardHead":"cardHead","cardTitle":"cardTitle","badge":"badge","badgeUnknown":"badgeUnknown","counts":"counts","meta":"meta","freshRead":"freshRead","freshReadTitle":"freshReadTitle","actions":"actions","primary":"primary","secondary":"secondary","help":"help","note":"note","noteError":"noteError","cells":"cells","cell":"cell","cellName":"cellName","cellLocked":"cellLocked","cellCurrent":"cellCurrent","cellEditor":"cellEditor","select":"select","input":"input","preview":"preview","memberBlock":"memberBlock","memberName":"memberName","lanes":"lanes","lane":"lane","laneName":"laneName","laneValue":"laneValue","laneState":"laneState","laneFlag":"laneFlag","hardPolicy":"hardPolicy","override":"override","overrideEditor":"overrideEditor"},"text":".section {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 10px;\r\n  min-width: 0;\r\n}\r\n\r\n.card {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n  min-width: 0;\r\n  padding: 10px 12px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n}\r\n\r\n.cardHead {\r\n  display: flex;\r\n  align-items: center;\r\n  gap: 8px;\r\n  min-width: 0;\r\n}\r\n\r\n.cardTitle {\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-s-14);\r\n  font-weight: 600;\r\n}\r\n\r\n.badge {\r\n  padding: 1px 8px;\r\n  border-radius: 999px;\r\n  background: var(--dsw-alias-state-success-primary);\r\n  color: var(--dsw-alias-bg-layer-1);\r\n  font: var(--dsw-font-xxxs-11);\r\n  font-weight: 600;\r\n  white-space: nowrap;\r\n}\r\n\r\n.badge[data-governance-compat-mark='warning'] {\r\n  background: var(--dsw-alias-state-warn-primary);\r\n}\r\n\r\n.badge[data-governance-compat-mark='fatal'] {\r\n  background: var(--dsw-alias-state-error-primary);\r\n}\r\n\r\n.badgeUnknown {\r\n  padding: 1px 8px;\r\n  border-radius: 999px;\r\n  background: var(--dsw-alias-bg-layer-3);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  font-weight: 600;\r\n  white-space: nowrap;\r\n}\r\n\r\n.counts {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 2px;\r\n  min-width: 0;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n\r\n.meta {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.freshRead {\r\n  padding: 6px 8px;\r\n  border-left: 2px solid var(--dsw-alias-border-l2);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.freshReadTitle {\r\n  margin: 0 0 2px;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  font-weight: 600;\r\n}\r\n\r\n.actions {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  gap: 6px;\r\n}\r\n\r\n.primary,\r\n.secondary {\r\n  padding: 3px 10px;\r\n  border-radius: 4px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  background: var(--dsw-alias-bg-layer-3);\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  cursor: pointer;\r\n}\r\n\r\n.primary {\r\n  border-color: var(--dsw-alias-state-business-primary);\r\n  background: var(--dsw-alias-state-business-primary);\r\n  color: var(--dsw-alias-bg-layer-1);\r\n}\r\n\r\n.primary:disabled,\r\n.secondary:disabled {\r\n  opacity: 0.5;\r\n  cursor: default;\r\n}\r\n\r\n.help {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.note {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.noteError {\r\n  margin: 0;\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.cells {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n}\r\n\r\n.cell {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 8px;\r\n  padding: 6px 8px;\r\n  border: 1px solid var(--dsw-alias-border-l1);\r\n  border-radius: 4px;\r\n  background: var(--dsw-alias-bg-layer-3);\r\n}\r\n\r\n.cellName {\r\n  min-width: 90px;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n}\r\n\r\n.cellLocked {\r\n  color: var(--dsw-alias-state-warn-label);\r\n  font: var(--dsw-font-xxxs-11);\r\n  font-weight: 400;\r\n}\r\n\r\n.cellCurrent {\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.cellEditor {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  gap: 6px;\r\n  margin-left: auto;\r\n}\r\n\r\n.select,\r\n.input {\r\n  padding: 2px 6px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 4px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.preview {\r\n  margin: 0;\r\n  padding: 4px 8px;\r\n  border-radius: 4px;\r\n  background: var(--dsw-alias-state-warn-tertiary);\r\n  color: var(--dsw-alias-state-warn-label);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.memberBlock {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 6px;\r\n  padding: 8px 10px;\r\n  border: 1px solid var(--dsw-alias-border-l1);\r\n  border-radius: 4px;\r\n  background: var(--dsw-alias-bg-layer-3);\r\n}\r\n\r\n.memberName {\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  font-weight: 600;\r\n}\r\n\r\n.lanes {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 3px;\r\n}\r\n\r\n.lane {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 8px;\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.laneName {\r\n  min-width: 110px;\r\n  color: var(--dsw-alias-label-primary);\r\n  font-weight: 600;\r\n}\r\n\r\n.laneValue {\r\n  min-width: 120px;\r\n  word-break: break-all;\r\n}\r\n\r\n.laneState {\r\n  font-weight: 600;\r\n}\r\n\r\n.laneFlag {\r\n  padding: 0 6px;\r\n  border-radius: 999px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.hardPolicy {\r\n  padding: 1px 6px;\r\n  border-radius: 3px;\r\n  background: var(--dsw-alias-state-error-secondary);\r\n  color: var(--dsw-alias-state-error-primary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  word-break: break-all;\r\n}\r\n\r\n.override {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n}\r\n\r\n.overrideEditor {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: center;\r\n  gap: 6px;\r\n}\r\n"},"ui/TeamMemberDialogs.module.css":{"classes":{"dialog":"dialog","title":"title","body":"body","warning":"warning","notice":"notice","field":"field","fieldLabel":"fieldLabel","templateName":"templateName","actions":"actions","button":"button"},"text":".dialog {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 10px;\r\n  width: min(420px, 100%);\r\n  padding: 14px 16px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 8px;\r\n  background: var(--dsw-alias-bg-layer-1);\r\n  box-shadow: 0 4px 16px rgb(0 0 0 / 18%);\r\n}\r\n\r\n.title {\r\n  margin: 0;\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-s-14);\r\n  font-weight: 600;\r\n}\r\n\r\n.body {\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xs-13);\r\n  line-height: 1.5;\r\n}\r\n\r\n.warning {\r\n  padding: 8px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-state-warn-tertiary);\r\n  color: var(--dsw-alias-state-warn-label);\r\n  font: var(--dsw-font-xs-13);\r\n  line-height: 1.5;\r\n}\r\n\r\n.notice {\r\n  padding: 6px 10px;\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-3);\r\n  color: var(--dsw-alias-label-secondary);\r\n  font: var(--dsw-font-xxxs-11);\r\n  line-height: 1.4;\r\n}\r\n\r\n.field {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  min-width: 0;\r\n}\r\n\r\n.fieldLabel {\r\n  color: var(--dsw-alias-label-tertiary);\r\n  font: var(--dsw-font-xxxs-11);\r\n}\r\n\r\n.field input,\r\n.field select {\r\n  width: 100%;\r\n  padding: 5px 8px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n\r\n.field input:focus-visible,\r\n.field select:focus-visible,\r\n.field textarea:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.field textarea {\r\n  width: 100%;\r\n  padding: 5px 8px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  resize: vertical;\r\n}\r\n\r\n.templateName {\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n}\r\n\r\n.actions {\r\n  display: flex;\r\n  justify-content: flex-end;\r\n  gap: 8px;\r\n  margin-top: 4px;\r\n}\r\n\r\n.button {\r\n  padding: 5px 12px;\r\n  border: 1px solid var(--dsw-alias-border-l2);\r\n  border-radius: 6px;\r\n  background: var(--dsw-alias-bg-layer-2);\r\n  color: var(--dsw-alias-label-primary);\r\n  font: var(--dsw-font-xs-13);\r\n  cursor: pointer;\r\n}\r\n\r\n.button:hover:not(:disabled) {\r\n  background: var(--dsw-alias-bg-layer-3);\r\n}\r\n\r\n.button:focus-visible {\r\n  outline: 1px solid var(--dsw-alias-state-business-primary);\r\n  outline-offset: -1px;\r\n}\r\n\r\n.button:disabled {\r\n  opacity: 0.5;\r\n  cursor: default;\r\n}\r\n"}};
		var __cssDone = {};
		function __css(key) {
			if (!__cssDone[key]) {
				__cssDone[key] = true;
				var el = document.createElement("style");
				el.setAttribute("data-dsh-agent-team-s8", key);
				el.textContent = __cssTable[key].text;
				(document.head || document.documentElement).appendChild(el);
			}
			return __cssTable[key].classes;
		}
		var __mods = {};
		function __req(id) {
			var m = __mods[id];
			if (!m) throw new Error("s8-team-bundle: unresolved module " + id);
			if (!m.done) { m.done = true; m.fn(m.exports); }
			return m.exports;
		}
		__mods["plugin/client.js"] = { done: false, fn: function (exports) {
			const __imp45 = __req("ui/TeamDock.js");
			const TeamDock = __imp45.TeamDock;
			const __imp46 = __req("ui/TeamSettingsSection.js");
			const TeamSettingsSection = __imp46.TeamSettingsSection;
			const __imp47 = __req("ui/TeamView.js");
			const TeamView = __imp47.TeamView;
			const __imp48 = __req("plugin/team-mount-core.js");
			const applyTeamMount = __imp48.applyTeamMount;
			/**
			 * Client half of the dsh-agent-team Cordis plugin — the P9-S6 unique
			 * client mount (P9-T9; plan §P9-S6, the L1568–1604 block of
			 * docs/plans/active/DSH_Agent_Team_vNext_P9_UI_T12_T24_Legacy_Reuse_
			 * Implementation_Test_Plan.md).
			 *
			 * Public shape (Cordis composition plugin): a plain module whose named
			 * exports form the plugin object — a stable `name`, the `inject` service
			 * list, a `Config` type, and the `apply(ctx, config?)` entrypoint.
			 * Browser-safe by construction: no Node.js builtins, no DOM assumptions,
			 * no DSH internal API (CORE PATCH BUDGET = 0).
			 *
			 * This module is the thin glue of the D-T9-13 core/glue split: it is the
			 * ONLY module in the package that value-imports a `.tsx` component. The
			 * whole mount (seam bindings, store wiring, slot registrations) lives in
			 * `./team-mount-core.js` (pure `.ts`), so the package's executed tests
			 * (plain-node runner: `.test.ts` only, no `.tsx`/`.css` resolution) can
			 * load and drive the mount through the core without the component value
			 * imports.
			 *
			 * Registrations (expected by P9-S6):
			 *   - `conversation.view`       -> the TeamView "团队" tab (id `team`, order 20);
			 *   - `conversation.input.dock` -> the TeamDock (id `team`, order 15);
			 *   - `settings.section`        -> the minimal Team settings/help page
			 *     (id `team`, order 50).
			 * Explicit non-registrations (P9-S6): NO `conversation.chat.node` team
			 * marker and NO synthetic trajectory — a native Chat/Trajectory/fork stays
			 * exactly what native DSH renders. New Team enters through the actual
			 * public surface (the S0 seam map: `ctx.sessions.create` for the native
			 * root, `ctx.remote.agentPresets.list` for the runtime presets, the
			 * workspace bound through the plugin row config); Seam 4 (cross-entry view
			 * activation) is ABSENT, so the dock's jump degrades to a CLIENT_LOCAL
			 * no-op (D-T9-4 — no DOM hack, no private store reach).
			 *
			 * D-T9-1: `dshHome` arrives through the plugin row config
			 * (`apply(ctx, config?)`); absent or blank after trim -> the parameterless
			 * `legacyInspect` face is omitted (the T8 degraded zero-state path).
			 * D-T9-11: the package.json carries no `./client` export subpath — the
			 * composition wiring is S8/main-agent territory, not widened in T9.
			 *
			 * Verified by `test/client.test.ts` (identity/shape),
			 * `test/client-plugin-mount.test.ts` (behavior, through the core), and
			 * `scripts/composition-smoke.mjs` (built output).
			 * @module @dsh-agent-team/client/plugin/client
			 */
			Object.defineProperty(exports, "inject", { enumerable: true, get: () => __re0.inject });
			Object.defineProperty(exports, "name", { enumerable: true, get: () => __re0.name });
			const __re0 = __req("plugin/team-mount-core.js");
			/**
			 * Plugin entrypoint (the P9-S6 unique client mount): registers the team
			 * locale dictionaries and the three slot entries on the public seams,
			 * wires the per-team projection/ledger stores to the frozen Remote
			 * channel, and returns nothing — every side effect is fiber-tracked and
			 * removed on stop/update.
			 * @param ctx - the Cordis client plugin context (the five public seams +
			 *   the fiber `effect`).
			 * @param config - the plugin row config (the `dshHome` bind; D-T9-1).
			 */
			function apply(ctx, config) {
			    applyTeamMount(ctx, {
			        config,
			        components: {
			            view: TeamView,
			            dock: TeamDock,
			            settings: TeamSettingsSection,
			        },
			    });
			}
			Object.defineProperty(exports, "apply", { enumerable: true, get: () => apply });
			//# sourceMappingURL=client.js.map
			}, exports: module.exports };
		/* entry "plugin/client.js": its exports object IS the facade module.exports */
		__mods["ui/TeamDock.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _Fragment = __imp0.Fragment;
			const _jsxs = __imp0.jsxs;
			const __imp18 = __extReq("react");
			const useEffect = __imp18.useEffect;
			const useId = __imp18.useId;
			const useMemo = __imp18.useMemo;
			const useState = __imp18.useState;
			const __imp19 = __req("state/team-session-resolution.js");
			const resolveTeamProjection = __imp19.resolveTeamProjection;
			const sameTeamProjectionResolution = __imp19.sameTeamProjectionResolution;
			const __imp20 = __req("model/projection-adapter.js");
			const adaptTeamProjection = __imp20.adaptTeamProjection;
			const __imp21 = __extReq("@deepseek-ai/dsh-client-ui-primitives");
			const IconChevronDownOutline14 = __imp21.IconChevronDownOutline14;
			const IconChevronUpOutline14 = __imp21.IconChevronUpOutline14;
			const StateDot = __imp21.StateDot;
			const __imp22 = __req("model/team-dock-model.js");
			const deriveTeamDockContent = __imp22.deriveTeamDockContent;
			const deriveTeamDockCounts = __imp22.deriveTeamDockCounts;
			const styles = __css("ui/TeamDock.module.css").default;
			/**
			 * The resident team dock bar above the input (D11–D13): the thin collapsed
			 * readout `团队 · N 运行中 · M 待裁决` (zero-count segments omitted, D12/D23)
			 * plus the expandable compact member status rows (name + state dot) and
			 * current-work activity rows, all read straight from the team projection
			 * (D20). The entry renders only for a team session — the frozen
			 * resolveTeamProjection test, the tab's same criterion — and cold-fills a
			 * projection-mirror gap through `ensureProjection` like the tab. The jump
			 * entry activates the "团队" view tab (D13) and the chevron toggles the
			 * expansion.
			 *
			 * P9-T5 (S3-C) mechanical adaptation (plan §8.6): the dock reads the vNext
			 * projection mirror + normalized snapshot instead of the leader-keyed view
			 * mirror; N comes from the projection lifecycle (never the session log), M
			 * from the frozen team-wide ledger summary (never a per-row sum), and the
			 * compact task rows become the snapshot's current-work activity rows.
			 */
			const MEMBER_STATUS_KEYS = {
			    created: 'view.members.created',
			    running: 'view.members.running',
			    settled: 'view.members.settled',
			    archived: 'view.members.archived',
			    disposed: 'view.members.disposed',
			};
			/**
			 * The activity status reuses the Activity section's progress vocabulary
			 * keys (the values are the same frozen ProgressValues the Activity rows
			 * render; the hyphenated wire value maps onto the underscore key).
			 */
			const ACTIVITY_STATUS_KEYS = {
			    'in-progress': 'view.activity.in_progress',
			    completed: 'view.activity.completed',
			    blocked: 'view.activity.blocked',
			};
			/**
			 * Map a member display status onto the StateDot states.
			 * Provisional T5 mapping (T6 may refine lifecycle colors): created: amber,
			 * running: blue, settled/archived/disposed: green (terminal states).
			 * @param status - the member row's display status.
			 * @returns the dot state.
			 */
			function memberDot(status) {
			    switch (status) {
			        case 'created': return 'warning';
			        case 'running': return 'ongoing';
			        case 'settled': return 'done';
			        case 'archived': return 'done';
			        case 'disposed': return 'done';
			    }
			}
			/**
			 * Map an activity status onto the StateDot states.
			 * @param status - the activity row's progress status.
			 * @returns the dot state (in progress: blue, completed: green, blocked: red).
			 */
			function activityDot(status) {
			    switch (status) {
			        case 'in-progress': return 'ongoing';
			        case 'completed': return 'done';
			        case 'blocked': return 'error';
			    }
			}
			/**
			 * The presentational dock bar (D11/D12): the collapsed one-line readout
			 * (zero-count segments omitted) and the expandable compact member status and
			 * activity rows. The jump entry activates the team tab (D13); the chevron
			 * toggles the expansion.
			 * @param props - the normalized snapshot, the tab-jump callback, and the team dictionary.
			 * @returns the dock bar.
			 */
			function TeamDockPanel({ snapshot, openTeamTab, t }) {
			    const [collapsed, setCollapsed] = useState(true);
			    const bodyId = useId();
			    const counts = deriveTeamDockCounts(snapshot);
			    const content = deriveTeamDockContent(snapshot);
			    // En spaces (U+2002): HTML collapses runs of ASCII spaces, so widening the
			    // separator breathing room needs a literal wide space (the todo strip's
			    // same pattern). D12 format `团队 · N 运行中 · M 待裁决`: zero-count
			    // segments are omitted with the separator that would dangle; the leading
			    // separator after the title renders only while some segment remains.
			    const readout = [
			        ...counts.runningSessions > 0 ? [t('dock.running', { count: counts.runningSessions })] : [],
			        ...counts.pendingControls > 0 ? [t('dock.pending', { count: counts.pendingControls })] : [],
			    ].join('\u2002·\u2002');
			    return (_jsxs("section", { className: styles.root, "data-team-dock": true, "aria-label": t('dock.title'), children: [_jsxs("div", { className: styles.row, children: [_jsxs("button", { type: "button", className: styles.jump, "data-team-dock-jump": true, title: t('dock.jump'), onClick: () => { openTeamTab(); }, children: [_jsx("span", { className: styles.title, "data-dock-title": true, children: t('dock.title') }), readout !== '' && (_jsxs(_Fragment, { children: [_jsx("span", { className: styles.sep, "data-dock-sep": true, "aria-hidden": "true", children: '\u2002·\u2002' }), _jsx("span", { className: styles.readout, "data-dock-readout": true, children: readout })] }))] }), _jsx("button", { type: "button", className: styles.chevron, "data-team-dock-toggle": true, "aria-expanded": !collapsed, "aria-controls": collapsed ? undefined : bodyId, "aria-label": collapsed ? t('dock.expand') : t('dock.collapse'), onClick: () => { setCollapsed(value => !value); }, children: collapsed ? _jsx(IconChevronUpOutline14, {}) : _jsx(IconChevronDownOutline14, {}) })] }), !collapsed && (_jsxs("div", { id: bodyId, className: styles.expanded, "data-team-dock-expanded": true, children: [_jsx("ul", { className: styles.members, children: content.members.length === 0
			                            ? _jsx("li", { className: styles.empty, "data-dock-members-empty": true, children: t('dock.members.empty') })
			                            : content.members.map(member => (_jsxs("li", { className: styles.member, "data-dock-member": true, "data-member-status": member.status, "aria-label": `${member.name} ${t(MEMBER_STATUS_KEYS[member.status])}`, children: [_jsx("span", { className: styles.dotSlot, "aria-hidden": "true", children: _jsx(StateDot, { state: memberDot(member.status) }) }), _jsx("span", { className: styles.name, children: member.name })] }, member.key))) }), _jsx("ul", { className: styles.tasks, children: content.activities.length === 0
			                            ? _jsx("li", { className: styles.empty, "data-dock-activities-empty": true, children: t('dock.activities.empty') })
			                            : content.activities.map(activity => (_jsxs("li", { className: styles.task, "data-dock-activity": true, "data-activity-status": activity.status ?? 'none', "aria-label": `${activity.label}${activity.status !== undefined ? ` ${t(ACTIVITY_STATUS_KEYS[activity.status])}` : ''}`, children: [activity.status !== undefined && (_jsx("span", { className: styles.dotSlot, "aria-hidden": "true", children: _jsx(StateDot, { state: activityDot(activity.status) }) })), activity.subject !== undefined && _jsx("span", { className: styles.subject, children: activity.subject }), activity.status !== undefined && (_jsx("span", { className: styles.taskStatus, children: t(ACTIVITY_STATUS_KEYS[activity.status]) }))] }, activity.key))) })] }))] }));
			}
			/**
			 * The dock entry adapter: resolves the current session's team projection
			 * through the frozen team-ness test (the tab's same criterion — the
			 * mirror's presence), cold-fills a mirror gap through `ensureProjection`,
			 * renders nothing for a non-team session, and hands the normalized
			 * snapshot to the presentational panel.
			 * @param props - the framework session kit, the injected mirror hook and
			 *   cold-pull/jump callbacks, and the team dictionary.
			 * @returns the dock bar, or nothing for a non-team session.
			 */
			export function TeamDock({ sessionId, useProjectionMirror, ensureProjection, openTeamTab, t, }) {
			    const resolution = useProjectionMirror(mirror => resolveTeamProjection(mirror, sessionId), sameTeamProjectionResolution);
			    useEffect(() => {
			        // The dock mounts with every session, so a resolution gap means the
			        // team projection is still unknown for this session: fill it once,
			        // then let frames win.
			        if (resolution === undefined)
			            void ensureProjection(sessionId);
			    }, [sessionId, resolution, ensureProjection]);
			    const snapshot = useMemo(() => (resolution === undefined ? null : adaptTeamProjection(resolution.team, resolution.perspective)), [resolution]);
			    if (snapshot === null)
			        return null;
			    return _jsx(TeamDockPanel, { snapshot: snapshot, openTeamTab: openTeamTab, t: t });
			}
			//# sourceMappingURL=TeamDock.js.map
			}, exports: {} };
		__mods["ui/TeamSettingsSection.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const styles = __css("ui/TeamSettingsSection.module.css").default;
			/**
			 * Team settings section: shows the configuration status and the
			 * instructions for configuring team members.
			 * @param props - the composed section props (only the `t` seat is consumed).
			 */
			function TeamSettingsSection({ t }) {
			    return (_jsxs("div", { className: styles.container, children: [_jsx("h3", { className: styles.title, children: t('title') }), _jsxs("div", { className: styles.emptyState, children: [_jsx("p", { className: styles.emptyTitle, children: t('empty.title') }), _jsx("p", { className: styles.emptyDescription, children: t('empty.description') }), _jsxs("ol", { className: styles.steps, children: [_jsx("li", { children: _jsx("code", { children: t('empty.step1') }) }), _jsx("li", { children: _jsx("code", { children: t('empty.step2') }) }), _jsx("li", { children: t('empty.step3') })] })] })] }));
			}
			Object.defineProperty(exports, "TeamSettingsSection", { enumerable: true, get: () => TeamSettingsSection });
			//# sourceMappingURL=TeamSettingsSection.js.map
			}, exports: {} };
		__mods["ui/TeamView.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const __imp14 = __extReq("react");
			const useEffect = __imp14.useEffect;
			const useMemo = __imp14.useMemo;
			const useState = __imp14.useState;
			const __imp15 = __req("state/team-session-resolution.js");
			const resolveTeamProjection = __imp15.resolveTeamProjection;
			const sameTeamProjectionResolution = __imp15.sameTeamProjectionResolution;
			const __imp16 = __req("model/projection-adapter.js");
			const adaptTeamProjection = __imp16.adaptTeamProjection;
			const __imp17 = __req("model/ledger-adapter.js");
			const ledgerModelFromStoreState = __imp17.ledgerModelFromStoreState;
			const __imp18 = __req("model/team-intent-model.js");
			const emptyTeamIntentDraft = __imp18.emptyTeamIntentDraft;
			const teamWorkspaceOptions = __imp18.teamWorkspaceOptions;
			const __imp19 = __req("ui/TeamTimeline.js");
			const TeamTimeline = __imp19.TeamTimeline;
			const __imp20 = __req("ui/TeamMembers.js");
			const TeamMembers = __imp20.TeamMembers;
			const __imp21 = __req("ui/TeamActivity.js");
			const TeamActivity = __imp21.TeamActivity;
			const __imp22 = __req("ui/TeamLedger.js");
			const TeamLedger = __imp22.TeamLedger;
			const __imp23 = __req("ui/TeamCreationPanel.js");
			const TeamCreationPanel = __imp23.TeamCreationPanel;
			const __imp24 = __req("ui/TeamGovernance.js");
			const TeamGovernance = __imp24.TeamGovernance;
			const __imp25 = __req("model/team-legacy.js");
			const parseLegacyInspection = __imp25.parseLegacyInspection;
			const styles = __css("ui/TeamView.module.css").default;
			/**
			 * Team conversation view entry: the "团队" tab (P9-T6 collapse). Every
			 * section — zero state, timeline, members, activity, and the durable
			 * ledger Events surface — resolves the current session through the vNext
			 * projection path (the per-session projection mirror plus the per-team
			 * ledger store), cold-pulled once when the mirror lacks the session (the
			 * frames win), and renders the one-line zero state for every non-team
			 * session. The compat mirror path (TeamMirror / `resolveTeamView` /
			 * `ensureTeam` / `pageTeamMessages`) is folded away: the durable ledger is
			 * the only event authority (plan §8.10 ADAPT), and the four sections are
			 * the UI §12.1 fixed order — Timeline → Members → Activity → Events —
			 * from ONE input.
			 */
			/**
			 * The team tab body: the one-line zero state for a non-team session (or a
			 * team session whose frame has not landed yet) — carrying the S5-A "Start
			 * Team from Here" entry and New Team panel when the injected creation face
			 * is present; otherwise the UI §12.1
			 * four sections from one input — the timeline and the member groups, the
			 * activity / progress rows from the snapshot's current-work face, and the
			 * durable-ledger Events surface from the per-team ledger store — with the
			 * current session's member lane and member group highlighted when the
			 * session is a member's.
			 * @param props - the framework session kit, the injected mirror hooks and
			 *   cold-pull / retry / navigation callbacks, and the team dictionary.
			 * @returns the view body.
			 */
			function TeamView(props) {
			    const { sessionId, useProjectionMirror, useTeamLedgers, ensureProjection, refreshTeamLedger, openSession, creation, memberCommands, governance, legacyInspect, handoff, useWorkspaces, t, } = props;
			    const [creationOpen, setCreationOpen] = useState(false);
			    // UI §5.3: the intent draft is page-run UI state only (never authority) —
			    // held here so the panel can open and close in the zero state without
			    // losing the in-flight selection.
			    const [intentDraft, setIntentDraft] = useState(emptyTeamIntentDraft);
			    const workspaceViews = useWorkspaces(s => s.items);
			    const workspaceOptions = useMemo(() => teamWorkspaceOptions(workspaceViews), [workspaceViews]);
			    const resolution = useProjectionMirror(mirror => resolveTeamProjection(mirror, sessionId), sameTeamProjectionResolution);
			    useEffect(() => {
			        // The tab mounts per session and one-at-a-time, so "mounted" IS "the
			        // team UI needs the view": fill a mirror gap once, then let frames win.
			        if (resolution === undefined)
			            void ensureProjection(sessionId);
			    }, [sessionId, resolution, ensureProjection]);
			    const snapshot = useMemo(() => (resolution === undefined
			        ? null
			        : adaptTeamProjection(resolution.team, resolution.perspective)), [resolution]);
			    // P9-T8 (S5-D): the one-shot legacy inspection for the ZERO state (plan
			    // §10.6, UI §34). It is a read, not a command flow — no projection pull;
			    // it only decides WHICH zero state renders. Gated to the zero state and
			    // skipped while the creation panel is open (the result is irrelevant
			    // there). A typed failure keeps the ordinary zero state + ONE verbatim
			    // note; `legacy-team` REPLACES the zero state with the read-only banner.
			    const [legacy, setLegacy] = useState(null);
			    const inZeroState = resolution === undefined || snapshot === null;
			    useEffect(() => {
			        if (!inZeroState || legacyInspect === undefined || creationOpen)
			            return;
			        let live = true;
			        setLegacy({ status: 'pending' });
			        void legacyInspect().then(response => {
			            if (!live)
			                return;
			            if (!response.ok) {
			                setLegacy({ status: 'error', code: response.error.code, message: response.error.message });
			                return;
			            }
			            setLegacy({ status: 'ok', inspection: parseLegacyInspection(response.value.data) });
			        }).catch(error => {
			            if (!live)
			                return;
			            setLegacy({
			                status: 'error',
			                code: 'native-error',
			                message: error instanceof Error ? error.message : String(error),
			            });
			        });
			        return () => { live = false; };
			    }, [inZeroState, legacyInspect, creationOpen, sessionId]);
			    const ledgerState = useTeamLedgers(map => map[snapshot?.teamSessionId ?? '']);
			    const ledger = useMemo(() => ledgerModelFromStoreState(ledgerState), [ledgerState]);
			    if (resolution === undefined || snapshot === null) {
			        if (creation === undefined) {
			            return _jsx("div", { className: styles.zero, "data-team-zero": true, children: t('view.zero') });
			        }
			        // P9-T8 (S5-D, UI §34.1): a decoded `legacy-team` inspection REPLACES
			        // the ordinary zero state with the persistent read-only banner — NO
			        // Start-Team entry (§34.3 forbidden executable list: no Resume Team /
			        // Restore Member / Create Member / Change PolicyState / Edit Team
			        // override / Continue legacy Team mutation / Upgrade in place).
			        if (legacy !== null && legacy.status === 'ok' && legacy.inspection.status === 'legacy-team') {
			            const inspection = legacy.inspection;
			            return (_jsxs("div", { className: styles.zero, "data-team-zero": true, "data-legacy-zero": "legacy-team", children: [_jsxs("div", { className: styles.legacyBanner, "data-legacy-banner": true, children: [_jsx("p", { children: t('legacy.banner.line1') }), _jsx("p", { children: t('legacy.banner.line2') }), _jsx("p", { children: t('legacy.banner.line3') })] }), _jsxs("div", { className: styles.legacySummary, "data-legacy-summary": true, children: [_jsx("h3", { className: styles.legacySummaryTitle, children: t('legacy.summary') }), inspection.teamId !== null && (_jsx("p", { "data-legacy-team-id": true, children: inspection.teamId })), inspection.leaderSessionId !== null && (_jsx("p", { "data-legacy-leader-session": true, children: inspection.leaderSessionId })), _jsx("p", { "data-legacy-counts": true, children: t('legacy.counts', {
			                                    roster: String(inspection.roster.length),
			                                    sessions: String(inspection.sessionCount),
			                                }) }), inspection.rosterWarningCount > 0 && (_jsx("p", { "data-legacy-roster-warning": true, children: String(inspection.rosterWarningCount) })), inspection.roster.length > 0 && (_jsx("ul", { "data-legacy-roster": true, children: inspection.roster.map((row, index) => (_jsxs("li", { "data-legacy-roster-row": true, children: [row.name ?? row.id ?? row.fileName, row.role !== null ? ` (${row.role})` : ''] }, `${row.source}:${row.fileName}:${String(index)}`))) }))] })] }));
			        }
			        // UI §3: a non-team session (or an unlanded team frame) offers the New
			        // Team entry; the panel replaces the entry while open, and the intent
			        // draft persists in view state across open/close. The inspection
			        // failure / unrecognized status keeps this zero state + ONE verbatim
			        // note (UI §38: a greyed surface must state its reason).
			        const legacyNote = legacy !== null && legacy.status === 'error'
			            ? t('legacy.inspectError', { message: `${legacy.code}: ${legacy.message}` })
			            : legacy !== null && legacy.status === 'ok' &&
			                legacy.inspection.status === 'unknown'
			                ? t('legacy.inspectError', {
			                    message: `unrecognized status: ${JSON.stringify(legacy.inspection.raw)}`,
			                })
			                : null;
			        return (_jsx("div", { className: styles.zero, "data-team-zero": true, children: _jsxs("div", { className: styles.zeroInner, children: [_jsx("p", { className: styles.zeroText, children: t('view.zero') }), legacyNote !== null && (_jsx("p", { className: styles.legacyNote, "data-legacy-note": true, children: legacyNote })), creationOpen
			                        ? _jsx(TeamCreationPanel, { listCatalog: creation.listCatalog, getCatalog: creation.getCatalog, probeCompatibility: creation.probeCompatibility, teamCreate: creation.teamCreate, createRootSession: creation.createRootSession, listAgentPresets: creation.listAgentPresets, openSession: openSession, workspaces: workspaceOptions, handoffSource: {
			                                sourceSessionId: sessionId,
			                                sourceWorkspaceId: workspaceViews.find(item => item.sessionIds.includes(sessionId))?.workspaceId ?? null,
			                            }, handoffFace: handoff, draft: intentDraft, onDraftChange: setIntentDraft, onCancel: () => setCreationOpen(false), t: t })
			                        : (_jsx("button", { type: "button", className: styles.zeroStart, "data-intent-start-here": true, onClick: () => setCreationOpen(true), children: t('intent.startHere') }))] }) }));
			    }
			    const currentInstanceId = resolution.perspective.kind === 'member-child'
			        ? resolution.perspective.memberInstanceId
			        : undefined;
			    return (_jsxs("div", { className: styles.body, "data-team-view": true, children: [_jsxs("section", { className: styles.section, "data-team-section": "timeline", children: [_jsx("h3", { className: styles.sectionTitle, children: t('view.timeline.title') }), _jsx(TeamTimeline, { snapshot: snapshot, ledger: ledger, currentInstanceId: currentInstanceId, onSelectSession: openSession, t: t })] }), _jsxs("section", { className: styles.section, "data-team-section": "members", children: [_jsx("h3", { className: styles.sectionTitle, children: t('view.members.title') }), _jsx(TeamMembers, { snapshot: snapshot, ledger: ledger, currentSessionId: sessionId, onSelectSession: openSession, memberCommands: memberCommands, workspaces: workspaceOptions, t: t })] }), governance !== undefined && (_jsxs("section", { className: styles.section, "data-team-section": "governance", children: [_jsx("h3", { className: styles.sectionTitle, children: t('governance.title') }), _jsx(TeamGovernance, { snapshot: snapshot, governance: governance, t: t })] })), _jsxs("section", { className: styles.section, "data-team-section": "activity", children: [_jsx("h3", { className: styles.sectionTitle, children: t('view.activity.title') }), _jsx(TeamActivity, { activity: snapshot.activity, t: t })] }), _jsxs("section", { className: styles.section, "data-team-section": "ledger", children: [_jsx("h3", { className: styles.sectionTitle, children: t('view.ledger.title') }), _jsx(TeamLedger, { snapshot: snapshot, ledger: ledger, ledgerState: ledgerState, onRetry: refreshTeamLedger, onSelectSession: openSession, t: t })] })] }));
			}
			//# sourceMappingURL=TeamView.js.map
			}, exports: {} };
		__mods["plugin/team-mount-core.js"] = { done: false, fn: function (exports) {
			const __imp44 = __extReq("@deepseek-ai/dsh-client-store");
			const createSnapshotStore = __imp44.createSnapshotStore;
			const __imp45 = __req("model/projection-adapter.js");
			const projectionFromWire = __imp45.projectionFromWire;
			const __imp46 = __req("state/team-ledger-store.js");
			const createTeamLedgerStore = __imp46.createTeamLedgerStore;
			const __imp47 = __req("state/team-projection-store.js");
			const createTeamProjectionStore = __imp47.createTeamProjectionStore;
			const __imp48 = __req("state/team-session-resolution.js");
			const resolveTeamProjection = __imp48.resolveTeamProjection;
			const __imp49 = __req("transport/team-remote-client.js");
			const createTeamRemoteClient = __imp49.createTeamRemoteClient;
			const __imp50 = __req("ui/locales.js");
			const en = __imp50.en;
			const zh = __imp50.zh;
			/**
			 * P9-T9 (P9-S6) — the unique client mount of the dsh-agent-team Cordis
			 * client plugin.
			 *
			 * This module is the pure-TypeScript core of the client plugin (D-T9-13):
			 * every seam binding, slot registration, and store wiring lives here so the
			 * package's executed tests can load the mount WITHOUT value-importing a
			 * `.tsx` module (the plain-node runner executes only `.test.ts` files and
			 * resolves no `.tsx`/`.css` — see test/client-plugin-mount.test.ts). The
			 * three `.tsx` components are referenced here TYPE-ONLY (erased at runtime —
			 * the executed module graph stays `.tsx`-free) and enter the runtime graph
			 * exclusively through `plugin/client.ts` (the thin glue).
			 *
			 * Registrations (plan §P9-S6; frozen seam map
			 * dev/agent-workflow/evidence/P9/host-seam-map.md pinned at cd5ef814):
			 *   - `conversation.view`       -> the TeamView "团队" tab (id `team`, order 20);
			 *   - `conversation.input.dock` -> the TeamDock (id `team`, order 15);
			 *   - `settings.section`        -> the minimal Team settings/help page
			 *     (id `team`, order 50; the SlotMap entry is mirrored below from the
			 *     ui-settings shell contract — that package is not linked into this
			 *     package).
			 * Explicit non-registrations: NO `conversation.chat.node` team marker and
			 * NO synthetic trajectory — a native Chat/Trajectory/fork stays exactly
			 * what native DSH renders; the Team surfaces are slot entries only.
			 *
			 * Native integration: opening a root/member session goes through the
			 * public `ctx.sessions` seam (Seam 3, RENAMED `open`/`create`); the New
			 * Team entry creates its native root through the same seam (Seam 3) and
			 * its workspace comes from the public preset/row config; projection sync
			 * is the frozen "generation invalidation + team.getProjection pull" only
			 * (plan §6.3 — no live push, the CLIENT_LOCAL policy owns the retry);
			 * runtime presets arrive through the public `ctx.remote.agentPresets`
			 * seam (Seam 6). No private DSH import anywhere (CORE PATCH BUDGET = 0).
			 *
			 * D-T9-1: `dshHome` arrives through the plugin row config
			 * (`apply(ctx, config?)`); absent or blank after trim -> the parameterless
			 * `legacyInspect` face is OMITTED (the T8 degraded zero-state path).
			 * D-T9-4: `openTeamTab` is a documented degraded no-op (Seam 4 ABSENT —
			 * cross-entry view activation; the seam map forbids private store reach,
			 * DOM hacks, or a new framework extension).
			 *
			 * Pure module: no React value imports, no node: builtins, no I/O. Erasable
			 * TS only. @module @dsh-agent-team/client/plugin/team-mount-core
			 */
			/**
			 * The injected services (only the seams the mount actually reads — the
			 * legacy precedent's `uiConversation` edge is dropped: vNext registers no
			 * conversation chat node, so the marker event face is never consumed).
			 */
			const inject = ['slots', 'locale', 'sessions', 'connection', 'remote'];
			Object.defineProperty(exports, "inject", { enumerable: true, get: () => inject });
			/** Stable Cordis plugin name of the dsh-agent-team client half. */
			const name = 'dsh-agent-team-client';
			Object.defineProperty(exports, "name", { enumerable: true, get: () => name });
			/**
			 * Mount the Team client on the public seams (the full P9-S6 body).
			 *
			 * @param ctx - the Cordis client plugin context (the five public seams + effect).
			 * @param opts - the plugin row config (the `dshHome` bind) and the three
			 *   concrete components (the `.tsx` entries).
			 */
			function applyTeamMount(ctx, opts) {
			    const { config, components } = opts;
			    // (1) The team locale dictionaries (the renderer rebinds on locale change).
			    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-agent-team: dictionaries');
			    const t = ctx.locale.bind(NS);
			    // (2) The frozen Remote client on the one seam channel.
			    const teamRemote = createTeamRemoteClient(ctx.connection.rpc);
			    // (3) The per-team store registries + the teardown effect (disposers run
			    // in reverse registration order; reset cancels pending backoff retries so
			    // a stopped mount issues no stray carrier call).
			    const projectionStores = new Map();
			    const ledgerStores = new Map();
			    const storeDisposers = [];
			    const ledgerOpened = new Set();
			    ctx.effect(() => () => {
			        for (const dispose of storeDisposers.splice(0).reverse())
			            dispose();
			        for (const store of projectionStores.values())
			            store.reset();
			        for (const store of ledgerStores.values())
			            store.reset();
			    }, 'dsh-agent-team: store teardown');
			    // (4) The two published observables (the inject `hooks` compartment):
			    // the team-keyed projection mirror and the per-team ledger states.
			    const mirrorStore = createSnapshotStore({});
			    const ledgerStatesStore = createSnapshotStore({});
			    // (5) The lazy per-team ledger store (published onto the ledger-states
			    // observable; the page pull rides the frozen Remote client).
			    const ledgerStoreOf = (teamSessionId) => {
			        const existing = ledgerStores.get(teamSessionId);
			        if (existing !== undefined)
			            return existing;
			        const store = createTeamLedgerStore({
			            getLedgerPage: (id, afterSequence, limit) => teamRemote.getLedgerPage(id, afterSequence, limit),
			        });
			        const dispose = store.subscribe(() => {
			            const snapshot = store.getState();
			            const current = ledgerStatesStore.getSnapshot();
			            // The ledger store publishes `entriesBySequence` by reference (the
			            // T4 "published by reference" contract: the store stays the
			            // mutation authority). The snapshot store's `set()` deep-freezes
			            // state outside production, so the bridge republishes a Map copy:
			            // the published state is freeze-safe and the live Map — the one
			            // object the store mutates (page merge, team switch, reset) — is
			            // never embedded, so `reset()` cannot die on a frozen collection.
			            ledgerStatesStore.set({
			                ...current,
			                [teamSessionId]: {
			                    ...snapshot,
			                    entriesBySequence: new Map(snapshot.entriesBySequence),
			                },
			            });
			        });
			        storeDisposers.push(dispose);
			        ledgerStores.set(teamSessionId, store);
			        return store;
			    };
			    // (6) The lazy per-team projection store (publishes the applied frame onto
			    // the mirror; the first applied frame opens the team's ledger store —
			    // `open` never rejects; a typed failure settles into `state.error`).
			    const projectionStoreOf = (teamSessionId) => {
			        const existing = projectionStores.get(teamSessionId);
			        if (existing !== undefined)
			            return existing;
			        const store = createTeamProjectionStore({
			            getProjection: (id) => teamRemote.getProjection(id),
			        });
			        const dispose = store.subscribe(() => {
			            const frame = store.getState().frame;
			            if (frame === null)
			                return;
			            const dto = projectionFromWire(frame.projection);
			            const current = mirrorStore.getSnapshot();
			            // Status-only store changes keep the same frame reference: skip the
			            // republish so the mirror snapshot stays identity-stable between
			            // changes (client AGENTS reactive rule 5).
			            if (current[teamSessionId] === dto)
			                return;
			            // The ONE documented boundary cast in the mount (house style of
			            // team-session-resolution: plain string wire ids, branded mirror keys).
			            mirrorStore.set({ ...current, [teamSessionId]: dto });
			            if (!ledgerOpened.has(teamSessionId)) {
			                ledgerOpened.add(teamSessionId);
			                void ledgerStoreOf(teamSessionId).open(teamSessionId);
			            }
			        });
			        storeDisposers.push(dispose);
			        projectionStores.set(teamSessionId, store);
			        return store;
			    };
			    // (7) The single-flight cold read (plan §6.1: the mirror wins; the
			    // invariant-9 candidate-root probe — an unresolved session id is itself
			    // the TeamSession id to pull).
			    const inflightPulls = new Map();
			    const ensureProjection = (sessionId) => {
			        const resolution = resolveTeamProjection(mirrorStore.getSnapshot(), sessionId);
			        const teamSessionId = resolution?.team.teamSessionId ?? sessionId;
			        const existing = inflightPulls.get(teamSessionId);
			        if (existing !== undefined)
			            return existing;
			        const pull = projectionStoreOf(teamSessionId)
			            .pull(teamSessionId)
			            .then(() => undefined);
			        inflightPulls.set(teamSessionId, pull);
			        void pull.finally(() => inflightPulls.delete(teamSessionId));
			        return pull;
			    };
			    // (8) The per-session ledger refresh (no-op when the session resolves to
			    // no team or the team's ledger store was never opened).
			    const refreshTeamLedgerFor = (sessionId) => () => {
			        const resolution = resolveTeamProjection(mirrorStore.getSnapshot(), sessionId);
			        if (resolution === undefined)
			            return Promise.resolve();
			        const store = ledgerStores.get(resolution.team.teamSessionId);
			        if (store === undefined)
			            return Promise.resolve();
			        return store.refresh();
			    };
			    // (9) Native session switch (Seam 3; the public `open` path).
			    const openSession = (sessionId) => {
			        ctx.sessions.open(sessionId);
			    };
			    // (10) D-T9-4 degraded no-op: Seam 4 (cross-entry view activation) is
			    // ABSENT in the served web app, and the seam map forbids private store
			    // reach, DOM hacks (the legacy tab click), or a new framework extension.
			    // The dock's jump button is its title button; clicking it activates the
			    // dock entry's own session context through the ordinary renderer path.
			    const openTeamTab = () => { };
			    // (11) The post-success projection pull (the final-state authority).
			    const pullProjection = (teamSessionId) => projectionStoreOf(teamSessionId).pull(teamSessionId);
			    // (12) The S5-A New Team creation face (frozen Remote wrappers + the
			    // native seam members; the seam-6 preset mapping filters the `broken`
			    // rows and drops the trust field before the UI sees it).
			    const creation = {
			        listCatalog: () => teamRemote.catalogList(),
			        getCatalog: (params) => teamRemote.catalogGet(params),
			        probeCompatibility: (params) => teamRemote.intentProbe(params),
			        teamCreate: (params) => teamRemote.teamCreate(params),
			        createRootSession: (opts) => ctx.sessions.create(opts),
			        listAgentPresets: async () => (await ctx.remote.agentPresets.list())
			            .filter((row) => row.broken === undefined)
			            .map((row) => ({
			            id: row.id,
			            name: row.name,
			            description: row.description,
			            isDefault: row.isDefault,
			        })),
			    };
			    // (13) The S5-B member command face (frozen Remote wrappers verbatim).
			    const memberCommands = {
			        memberCreate: (params) => teamRemote.memberCreate(params),
			        memberSend: (params) => teamRemote.memberSend(params),
			        memberFollowup: (params) => teamRemote.memberFollowup(params),
			        memberArchive: (params) => teamRemote.memberArchive(params),
			        memberRestore: (params) => teamRemote.memberRestore(params),
			        memberDispose: (params) => teamRemote.memberDispose(params),
			        pullProjection,
			    };
			    // (14) The S5-C governance face (frozen Remote wrappers verbatim; the
			    // compat-ack wire gap stays UI-disabled on the T8 surface).
			    const governance = {
			        compatibilityGet: (params) => teamRemote.compatibilityGet(params),
			        compatibilityAck: (params) => teamRemote.compatibilityAck(params),
			        compatibilityReprobe: (params) => teamRemote.compatibilityReprobe(params),
			        policyStateGet: (params) => teamRemote.policyStateGet(params),
			        policyStateSet: (params) => teamRemote.policyStateSet(params),
			        overrideGet: (params) => teamRemote.overrideGet(params),
			        overrideSet: (params) => teamRemote.overrideSet(params),
			        overrideReset: (params) => teamRemote.overrideReset(params),
			        pullProjection,
			    };
			    // (15) The S5-D handoff face (frozen Remote wrappers verbatim).
			    const handoff = {
			        prepare: (params) => teamRemote.handoffPrepare(params),
			        create: (params) => teamRemote.handoffCreate(params),
			    };
			    // (16) D-T9-1: the parameterless legacyInspect face binds the `dshHome`
			    // closure here; absent/blank config -> the face is omitted (the T8
			    // degraded zero-state path).
			    const dshHome = (config?.dshHome ?? '').trim();
			    const legacyInspect = dshHome === ''
			        ? undefined
			        : () => teamRemote.legacyInspect({ dshHome });
			    // (17) The connection-generation rebaseline (plan §6.3: the frozen
			    // guarantee is generation invalidation + the team.getProjection pull
			    // only — no live push). `undefined` -> markConnectionLost on every bound
			    // PROJECTION store (schedules the CLIENT_LOCAL backoff retry); defined ->
			    // markConnectionRestored (cancels the pending retry, fires the pull).
			    // Both are no-ops on an unbound store, so no initial-snapshot read is
			    // taken (the maps are empty at apply time; stores self-bind on their
			    // first pull). Ledger stores are deliberately NOT rebaselined: the
			    // frozen guarantee covers the projection pull only — a ledger page
			    // failure surfaces in `state.error` and is re-requested through
			    // `refreshTeamLedger`.
			    ctx.effect(() => {
			        const unsubscribe = ctx.connection.generation.subscribe(() => {
			            const snapshot = ctx.connection.generation.getSnapshot();
			            for (const store of projectionStores.values()) {
			                if (snapshot === undefined)
			                    store.markConnectionLost();
			                else
			                    store.markConnectionRestored();
			            }
			        });
			        return unsubscribe;
			    }, 'dsh-agent-team: generation rebaseline');
			    // (18) The injected faces (the `hooks` compartment carries the two bare
			    // observable sources; everything else is plain data + callbacks).
			    const viewInject = (sessionId) => ({
			        hooks: { projectionMirror: mirrorStore, teamLedgers: ledgerStatesStore },
			        ensureProjection,
			        refreshTeamLedger: refreshTeamLedgerFor(sessionId),
			        openSession,
			        creation,
			        memberCommands,
			        governance,
			        handoff,
			        ...(legacyInspect === undefined ? {} : { legacyInspect }),
			    });
			    const dockInject = () => ({
			        hooks: { projectionMirror: mirrorStore },
			        ensureProjection,
			        openTeamTab,
			    });
			    // (19) The three slot registrations (inline option literals: the slot
			    // key is inferred from `name` per call; the legacy orders/labels are
			    // preserved verbatim).
			    ctx.slots.inject('settings.section', () => ctx.slots.register({
			        name: 'settings.section',
			        id: 'team',
			        order: 50,
			        locale: NS,
			        label: () => t('nav'),
			    }, components.settings));
			    ctx.slots.inject('conversation.view', () => ctx.slots.register({
			        name: 'conversation.view',
			        id: 'team',
			        order: 20,
			        locale: NS,
			        label: () => t('view.team'),
			        inject: (sessionId) => viewInject(sessionId),
			    }, components.view));
			    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
			        name: 'conversation.input.dock',
			        id: 'team',
			        order: 15,
			        locale: NS,
			        inject: () => dockInject(),
			    }, components.dock));
			}
			/** The locale namespace owned by this plugin (literal type preserved). */
			const NS = 'team';
			//# sourceMappingURL=team-mount-core.js.map
			}, exports: {} };
		__mods["state/team-session-resolution.js"] = { done: false, fn: function (exports) {
			/**
			 * P9-T4 (S3-A) — team-session resolution over the vNext projection mirror.
			 *
			 * The vNext successor of the legacy `resolveTeamView` (the frozen legacy
			 * fork's derivation, evidence only — the transitional client bridge was
			 * folded away in P9-T6): same two-stage derivation, same
			 * identity-stable references, plus the vNext additions the legacy
			 * surface did not need:
			 *
			 *   1. OWN KEY — the session IS a TeamSession (root DSH session id,
			 *      invariant 9: `TeamSessionId = RootSessionId`): the session's own
			 *      projection frame, perspective `team-root`;
			 *   2. MEMBER CHILD — a member instance's durable child session (invariant
			 *      23): the projection frame of the member's team, perspective
			 *      `member-child` naming the instance (the plan §8.10 "current member
			 *      perspective highlight" input);
			 *   3. DISPOSED CHILD (vNext addition over the legacy surface) — a
			 *      `disposedHistory` row's child session: the disposed instance's
			 *      team is still reachable from its (now archived) child session,
			 *      with the same `member-child` perspective;
			 *   4. otherwise `undefined` — an ordinary or legacy session: the kept
			 *      UI's one-line zero state (unchanged criterion).
			 *
			 * Never inferred from labels, templates, or a session list: only the
			 * frozen id fields (`teamSessionId`, `members[].childSessionId`,
			 * `disposedHistory[].childSessionId`) participate (plan §7.2 "never infer
			 * from label/template/session list").
			 *
			 * Determinism: mirror entries are walked in `Object.keys` order; within a
			 * frame, `members` then `disposedHistory` in array order; the FIRST match
			 * wins (one root session -> 0 or 1 TeamSession, invariant 8, so a
			 * collision is a source anomaly, not a tie-break).
			 *
			 * Pure module: no React, no I/O. Erasable TS only.
			 * @module @dsh-agent-team/client/state/team-session-resolution
			 */
			/**
			 * Resolve one session's team projection and viewer perspective over the
			 * mirror (semantics above; the legacy own-key-first, member-scan-second
			 * order is preserved).
			 *
			 * @param mirror - the team-keyed projection mirror (may be empty).
			 * @param sessionId - the session to resolve (any DSH session id; branded
			 *   vNext ids are accepted, plain strings are the wire level).
			 * @returns the frame + perspective, or `undefined` for a non-team session.
			 */
			function resolveTeamProjection(mirror, sessionId) {
			    // 1. Own key: the session IS the TeamSession (root session, invariant 9).
			    //    One documented boundary cast: the mirror is keyed by the branded
			    //    TeamSessionId; the caller's session id is the same string at the
			    //    wire level.
			    const own = mirror[sessionId];
			    if (own !== undefined) {
			        return { team: own, perspective: { kind: 'team-root' } };
			    }
			    // 2./3. Member child scan, then disposed child scan (deterministic
			    //   Object.keys order; members before disposedHistory).
			    for (const key of Object.keys(mirror)) {
			        const view = mirror[key];
			        if (view === undefined)
			            continue;
			        const member = view.members.find(candidate => candidate.childSessionId === sessionId);
			        if (member !== undefined) {
			            return { team: view, perspective: { kind: 'member-child', memberInstanceId: member.instanceId } };
			        }
			        const history = view.disposedHistory?.find(candidate => candidate.childSessionId === sessionId);
			        if (history !== undefined) {
			            return {
			                team: view,
			                perspective: { kind: 'member-child', memberInstanceId: history.instanceId },
			            };
			        }
			    }
			    return undefined;
			}
			/**
			 * Equality comparator for the resolution selector (the slot selector
			 * hook's optional `eq` seat): `resolveTeamProjection` returns a fresh
			 * wrapper object per call, so the default Object.is comparison would
			 * re-render on every notification even when nothing changed. Two
			 * resolutions are equal when they name the same team reference (the
			 * projection frames are identity-stable) and the same viewer perspective.
			 * @param a - the previously selected resolution (or `undefined`).
			 * @param b - the freshly selected resolution (or `undefined`).
			 * @returns whether both selections name the same team + perspective.
			 */
			export function sameTeamProjectionResolution(a, b) {
			    if (a === b)
			        return true;
			    if (a === undefined || b === undefined)
			        return false;
			    if (a.team !== b.team)
			        return false;
			    if (a.perspective.kind === 'member-child' && b.perspective.kind === 'member-child') {
			        return a.perspective.memberInstanceId === b.perspective.memberInstanceId;
			    }
			    return a.perspective.kind === 'team-root' && b.perspective.kind === 'team-root';
			}
			//# sourceMappingURL=team-session-resolution.js.map
			}, exports: {} };
		__mods["model/projection-adapter.js"] = { done: false, fn: function (exports) {
			/**
			 * P9-T4 (S3-A) — the pure projection adapter: `TeamProjectionDto` (+ the
			 * viewer perspective) → `TeamUiSnapshot`.
			 *
			 * Purity (plan §7.1): `output = pure(TeamProjectionDto, perspective)` —
			 * no backend write, no authoritative lifecycle storage, no session-log
			 * scan, no DOM, no TeamDomain import. Every output field is copied
			 * verbatim from a frozen DTO field or derived by one of the documented
			 * mappings below; a missing fact stays missing (never invented).
			 *
			 * Documented mappings:
			 *   - §7.2 display mapping: `lifecycle` (RAW, always kept) →
			 *     `displayStatus` (CREATED→`created`, RUNNING→`running`,
			 *     SETTLED→`settled`, ARCHIVED→`archived`, DISPOSED→`disposed`).
			 *   - §7.2 presentation fallback: `currentAction =
			 *     liveActivity?.currentAction ?? activity?.lastAction ?? undefined`
			 *     (presentation, NOT lifecycle inference).
			 *   - §7.2 navigation: the leader's absent `childSessionId` becomes
			 *     `null` (navigation target = teamSessionId / root); a non-leader
			 *     row reads its frozen `childSessionId` directly; never inferred
			 *     from label / template / session list.
			 *   - §7.3: the per-instance `pendingControlCount` is `null` here —
			 *     this adapter sees the projection only; the ledger adapter fills
			 *     it for a KNOWN-COMPLETE ledger (the dock top-level count is the
			 *     summary's `pendingControlCount` directly, in the snapshot).
			 *   - §7.4: `activity` rows are the current-work summary (member
			 *     `activity` + `liveActivity`), emitted only when at least one of
			 *     `status` / `subject` / `summary` / `currentAction` is present.
			 *   - G3: disposed-history DTO rows are merged into `members`
			 *     (`fromHistory: true`, lifecycle forced to the RAW `DISPOSED` the
			 *     history implies, no live overlay) AND retained verbatim in
			 *     `disposedHistory` as the durable fact rows.
			 *
			 * Wire entry: `projectionFromWire` lifts the frozen
			 * `RemoteProjectionValue` (the exact 9-field value-level D-4 mirror of
			 * the projection DTO) to the typed DTO.
			 *
			 * Pure module: no React, no I/O. Erasable TS only.
			 * @module @dsh-agent-team/client/model/projection-adapter
			 */
			/**
			 * Lift one frozen wire projection value to the typed projection DTO.
			 *
			 * The ONE documented boundary narrowing in the client data layer (see
			 * the P9-T4 evidence note): the frozen `RemoteProjectionValue` is the
			 * exact 9-field value-level mirror of `TeamProjectionDto` (remote D-4:
			 * same field names, nested pass-through), so the conversion is
			 * structurally identity — but the wire's `RemoteSafeRecord` fields are
			 * not nominally assignable to the branded/readonly DTO fields, and a
			 * direct cast is a TS2352. The single `as unknown as` keeps the
			 * narrowing at exactly one auditable site; every field read downstream
			 * goes through the typed DTO.
			 */
			function projectionFromWire(value) {
			    return value;
			}
			Object.defineProperty(exports, "projectionFromWire", { enumerable: true, get: () => projectionFromWire });
			/** The §7.2 display mapping (closed; the raw lifecycle is always kept alongside). */
			function displayStatusOf(lifecycle) {
			    switch (lifecycle) {
			        case 'CREATED':
			            return 'created';
			        case 'RUNNING':
			            return 'running';
			        case 'SETTLED':
			            return 'settled';
			        case 'ARCHIVED':
			            return 'archived';
			        case 'DISPOSED':
			            return 'disposed';
			    }
			}
			/** One live member DTO row → the merged roster row (history rows appended separately). */
			function adaptLiveMember(member) {
			    const activity = member.activity;
			    const liveActivity = member.liveActivity;
			    return {
			        instanceId: member.instanceId,
			        templateId: member.templateId,
			        label: member.label,
			        ...(member.groupId === undefined ? {} : { groupId: member.groupId }),
			        // §7.2: leader = key ABSENT → null (nav target: the root session).
			        childSessionId: member.childSessionId === undefined ? null : member.childSessionId,
			        lifecycle: member.lifecycle,
			        displayStatus: displayStatusOf(member.lifecycle),
			        // §7.2 presentation fallback (not lifecycle inference).
			        ...(member.liveActivity?.currentAction !== undefined
			            ? { currentAction: member.liveActivity.currentAction }
			            : activity?.lastAction !== undefined
			                ? { currentAction: activity.lastAction }
			                : {}),
			        workspace: member.workspace,
			        contextPolicy: member.contextPolicy,
			        effectiveConfig: member.effectiveConfig,
			        ...(activity === undefined ? {} : { activity }),
			        liveActivity,
			        // §7.3: projection-only — the per-instance badge is unknown until
			        // the ledger adapter sees known-complete control facts.
			        pendingControlCount: null,
			        fromHistory: false,
			        createdAt: member.createdAt,
			    };
			}
			/** One disposed-history DTO row → the merged roster row (history-only). */
			function adaptHistoryMember(history) {
			    return {
			        instanceId: history.instanceId,
			        templateId: history.templateId,
			        label: history.label,
			        ...(history.groupId === undefined ? {} : { groupId: history.groupId }),
			        // The history DTO requires the durable child session (never the leader).
			        childSessionId: history.childSessionId,
			        // RAW lifecycle for a disposed instance; the history row implies it.
			        lifecycle: 'DISPOSED',
			        displayStatus: 'disposed',
			        // The history DTO carries no workspace / context policy /
			        // effective config / activity: absent, never invented.
			        liveActivity: null,
			        pendingControlCount: null,
			        fromHistory: true,
			        createdAt: history.createdAt,
			        ...(history.disposedAt === undefined ? {} : { disposedAt: history.disposedAt }),
			    };
			}
			/**
			 * One §7.4 current-work row from a live member's `activity` +
			 * `liveActivity`; `undefined` when the member carries no work facts at
			 * all (no invented rows).
			 */
			function adaptCurrentWork(member) {
			    const activity = member.activity;
			    const liveActivity = member.liveActivity;
			    const status = activity?.status;
			    const subject = activity?.subject;
			    const summary = activity?.summary;
			    const currentAction = liveActivity?.currentAction ?? activity?.lastAction;
			    if (status === undefined &&
			        subject === undefined &&
			        summary === undefined &&
			        currentAction === undefined) {
			        return undefined;
			    }
			    return {
			        instanceId: member.instanceId,
			        label: member.label,
			        ...(status === undefined ? {} : { status }),
			        ...(subject === undefined ? {} : { subject }),
			        ...(summary === undefined ? {} : { summary }),
			        ...(currentAction === undefined ? {} : { currentAction }),
			        ...(activity?.lastProgressAt === undefined ? {} : { lastProgressAt: activity.lastProgressAt }),
			        ...(liveActivity?.lastActivityAt === undefined ? {} : { lastActivityAt: liveActivity.lastActivityAt }),
			        ...(liveActivity?.runningSince === undefined ? {} : { runningSince: liveActivity.runningSince }),
			        ...(liveActivity?.admittedWorkCorrelation === undefined
			            ? {}
			            : { admittedWorkCorrelation: liveActivity.admittedWorkCorrelation }),
			        openIntervals: activity?.openIntervals ?? [],
			    };
			}
			/**
			 * Adapt one projection frame + viewer perspective to the normalized
			 * UI snapshot (pure; deterministic for one frame + perspective).
			 *
			 * @param projection - the generation-verified team projection frame.
			 * @param perspective - the viewer perspective (team-root or the member
			 *   child; carried as data for the §8.10 current-member highlight).
			 */
			function adaptTeamProjection(projection, perspective) {
			    const templates = projection.templates.map(template => ({
			        kind: template.kind,
			        templateId: template.templateId,
			        displayName: template.displayName,
			        ...(template.description === undefined ? {} : { description: template.description }),
			        contextPolicy: template.contextPolicy,
			        ...(template.instanceQuota === undefined ? {} : { instanceQuota: template.instanceQuota }),
			    }));
			    // Live members in frame order, then the disposed-history rows in frame
			    // order (G3: archived/disposed represented; identity = instanceId,
			    // labels never participate).
			    const members = projection.members.map(adaptLiveMember);
			    const history = projection.disposedHistory ?? [];
			    for (const row of history)
			        members.push(adaptHistoryMember(row));
			    const activity = [];
			    for (const member of projection.members) {
			        const row = adaptCurrentWork(member);
			        if (row !== undefined)
			            activity.push(row);
			    }
			    return {
			        teamSessionId: projection.teamSessionId,
			        generation: projection.generation,
			        blueprint: projection.blueprint,
			        perspective,
			        templates,
			        members,
			        compatibility: projection.root.compatibility,
			        policyState: projection.root.policyState,
			        ledgerSummary: projection.ledger,
			        activity,
			        disposedHistory: history,
			    };
			}
			//# sourceMappingURL=projection-adapter.js.map
			}, exports: {} };
		__mods["model/team-dock-model.js"] = { done: false, fn: function (exports) {
			/**
			 * Count the D23 readout over the whole team: N is the member instances in
			 * the running lifecycle (the raw frozen lifecycle — never the session-log
			 * overlay — and archived/disposed instances are never counted), M is the
			 * frozen team-wide pending control count read directly from the ledger
			 * summary.
			 * @param snapshot - the normalized team snapshot.
			 * @returns the team-wide counts.
			 */
			function deriveTeamDockCounts(snapshot) {
			    let runningSessions = 0;
			    for (const member of snapshot.members) {
			        if (member.fromHistory)
			            continue;
			        if (member.lifecycle === 'RUNNING')
			            runningSessions += 1;
			    }
			    return { runningSessions, pendingControls: snapshot.ledgerSummary.pendingControlCount };
			}
			Object.defineProperty(exports, "deriveTeamDockCounts", { enumerable: true, get: () => deriveTeamDockCounts });
			/**
			 * Project the expanded content: every current-roster member instance
			 * (history-only rows skipped, the leader instance included) plus every
			 * current-work activity row, each field read straight from the snapshot.
			 * @param snapshot - the normalized team snapshot.
			 * @returns the compact member status rows and activity rows.
			 */
			function deriveTeamDockContent(snapshot) {
			    const members = [];
			    for (const member of snapshot.members) {
			        if (member.fromHistory)
			            continue;
			        members.push({
			            key: member.instanceId,
			            instanceId: member.instanceId,
			            name: member.label,
			            status: member.displayStatus,
			        });
			    }
			    const activities = snapshot.activity.map(row => ({
			        key: row.instanceId,
			        instanceId: row.instanceId,
			        label: row.label,
			        ...(row.status !== undefined ? { status: row.status } : {}),
			        ...(row.subject !== undefined ? { subject: row.subject }
			            : row.summary !== undefined ? { subject: row.summary }
			                : row.currentAction !== undefined ? { subject: row.currentAction }
			                    : {}),
			    }));
			    return { members, activities };
			}
			Object.defineProperty(exports, "deriveTeamDockContent", { enumerable: true, get: () => deriveTeamDockContent });
			//# sourceMappingURL=team-dock-model.js.map
			}, exports: {} };
		__mods["model/ledger-adapter.js"] = { done: false, fn: function (exports) {
			const __imp33 = __req("model/projection-adapter.js");
			const adaptTeamProjection = __imp33.adaptTeamProjection;
			/**
			 * P9-T4 (S3-B) — the pure durable-ledger adapter: loaded
			 * `RemoteLedgerEntryValue[]` (+ completeness authority) →
			 * `TeamUiLedgerModel`, and the combined entry `adaptTeamUi` that
			 * satisfies the plan §7.1 purity contract
			 * `output = pure(TeamProjectionDto, loaded RemoteLedgerEntryValue[])`.
			 *
			 * Purity / forbidden edges (plan §7.1, gate G3): no backend write, no
			 * authoritative lifecycle storage, no session-log scan, no DOM, no
			 * TeamDomain import. Payloads are heterogeneous wire records, so every
			 * leaf read is FAIL-SAFE (typeof string / integer guards); a row that
			 * lacks a leaf it needs is SKIPPED, never patched with an invented
			 * value. The raw `payload` is passed through on every row verbatim.
			 *
			 * Completeness gating (plan §7.4; design lock): `entries` / `controls`
			 * / `messages` / `intervals` are always derived from the LOADED entries
			 * (the `completeness` marker carries the authority); `progress`
			 * (historical work rows) and `pendingControlByInstance` are emitted
			 * ONLY for a known-complete ledger — a partial ledger never claims a
			 * complete task board and never distributes pending counts.
			 *
			 * `adaptTeamUi` additionally overlays the §7.3 per-instance pending
			 * badges onto the snapshot member rows — and only then: the projection
			 * adapter alone always leaves them `null` (unknown).
			 *
			 * Implementation note: the pairing passes (control decisions, interval
			 * closes) run over MUTABLE internal drafts; the exported rows are the
			 * readonly public types, produced once at the end. The module itself is
			 * pure: inputs are never mutated, every output is freshly built.
			 *
			 * Pure module: no React, no I/O. Erasable TS only.
			 * @module @dsh-agent-team/client/model/ledger-adapter
			 */
			/**
			 * CLIENT-LOCAL frozen mirror of the host fact-type → category
			 * vocabulary. PROVENANCE (the client may not import the host package —
			 * `packages/runtime` is host-side authority):
			 * `packages/runtime/src/plugin/projection-source.ts` `FACT_TYPE_CATEGORY`
			 * (the 12-fact vNext vocabulary; the host fails closed
			 * `LEDGER_CATEGORY_UNKNOWN` on any unmapped fact type, so an unknown
			 * `category` here can only ever be display-side, never authority-side).
			 * A row whose fact type is absent from this map carries NO `category`
			 * (omitted, never guessed).
			 */
			const FACT_TYPE_CATEGORY = {
			    'team-work-admitted': 'team',
			    'provision-member-instance': 'member',
			    'member-lifecycle-changed': 'lifecycle',
			    'team-message-delivered': 'message',
			    'team-coordination-recorded': 'message',
			    'control-request-recorded': 'control',
			    'control-decision-recorded': 'control',
			    'control-allow-consumed': 'control',
			    'activity-progress-recorded': 'progress',
			    'activity-interval-opened': 'progress',
			    'activity-interval-closed': 'progress',
			    'policy-state-transitioned': 'policy',
			};
			/** Fail-safe string leaf read (`undefined` for any non-string / absent). */
			function str(payload, key) {
			    const value = payload[key];
			    return typeof value === 'string' ? value : undefined;
			}
			/** Fail-safe integer leaf read (`undefined` for any non-integer / absent). */
			function num(payload, key) {
			    const value = payload[key];
			    return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
			}
			/** The closed progress vocabulary check (fail-safe; absent → undefined). */
			function progressOf(value) {
			    return value === 'in-progress' || value === 'completed' || value === 'blocked' ? value : undefined;
			}
			/** One raw entry → the row (skips the entries whose identity leaves are broken). */
			function adaptEntry(entry) {
			    if (!Number.isInteger(entry.sequence))
			        return undefined;
			    if (typeof entry.factType !== 'string')
			        return undefined;
			    const category = FACT_TYPE_CATEGORY[entry.factType];
			    return {
			        sequence: entry.sequence,
			        factType: entry.factType,
			        ...(category === undefined ? {} : { category }),
			        rootSessionId: entry.rootSessionId,
			        operationId: entry.operationId,
			        createdAt: entry.createdAt,
			        payload: (entry.payload ?? {}),
			    };
			}
			/** One `control-request-recorded` fact → the draft (skipped when identity leaves are broken). */
			function adaptControlRequestDraft(entry, payload) {
			    const requestId = str(payload, 'requestId');
			    const targetInstanceId = str(payload, 'targetInstanceId');
			    const actionName = str(payload, 'actionName');
			    if (requestId === undefined || targetInstanceId === undefined || actionName === undefined)
			        return undefined;
			    return {
			        requestId,
			        requestSequence: entry.sequence,
			        targetInstanceId,
			        actionName,
			        requestedAt: entry.createdAt,
			        pending: true,
			        kind: str(payload, 'kind'),
			        toolName: str(payload, 'toolName'),
			        capabilityDomain: str(payload, 'capabilityDomain'),
			        summary: str(payload, 'summary'),
			    };
			}
			/**
			 * Pair one `control-decision-recorded` fact onto its request draft
			 * (join key: the frozen `requestId`). An orphan decision (no loaded
			 * request fact) becomes a draft only when the writer's own `scope`
			 * names the target + action + request sequence — no invented values;
			 * otherwise it is skipped.
			 */
			function adaptControlDecisionDraft(entry, payload, requests, orphans) {
			    const requestId = str(payload, 'requestId');
			    const decision = str(payload, 'decision');
			    if (requestId === undefined || decision === undefined)
			        return;
			    const target = payload['scope'];
			    const scope = typeof target === 'object' && target !== null ? target : undefined;
			    const reason = str(payload, 'reason');
			    const note = str(payload, 'note');
			    const block = {
			        value: decision,
			        sequence: entry.sequence,
			        decidedAt: entry.createdAt,
			        ...(reason === undefined ? {} : { reason }),
			        ...(note === undefined ? {} : { note }),
			    };
			    const request = requests.get(requestId);
			    if (request !== undefined) {
			        request.pending = false;
			        request.decision = block;
			        return;
			    }
			    const targetInstanceId = scope === undefined ? undefined : str(scope, 'targetInstanceId');
			    const actionName = scope === undefined ? undefined : str(scope, 'actionName');
			    const requestSequence = num(payload, 'requestSequence');
			    if (targetInstanceId === undefined || actionName === undefined || requestSequence === undefined)
			        return;
			    orphans.push({
			        requestId,
			        requestSequence,
			        targetInstanceId,
			        actionName,
			        requestedAt: entry.createdAt,
			        pending: false,
			        toolName: scope === undefined ? undefined : str(scope, 'toolName'),
			        decision: block,
			    });
			}
			/** One `team-message-delivered` fact → the row (recipient pair only — no invented sender). */
			function adaptDeliveredMessage(entry, payload) {
			    const subject = str(payload, 'subject');
			    const to = str(payload, 'recipientInstanceId') ?? str(payload, 'deliveredToInstanceId');
			    if (subject === undefined || to === undefined)
			        return undefined;
			    return { sequence: entry.sequence, kind: 'delivered', to, subject, at: entry.createdAt };
			}
			/** One `team-coordination-recorded` fact → the row (only `send-message` actions are message rows). */
			function adaptCoordinationMessage(entry, payload) {
			    if (str(payload, 'action') !== 'send-message')
			        return undefined;
			    const subject = str(payload, 'subject');
			    const to = str(payload, 'targetInstanceId') ?? str(payload, 'recipientInstanceId');
			    if (subject === undefined || to === undefined)
			        return undefined;
			    const from = str(payload, 'caller');
			    return {
			        sequence: entry.sequence,
			        kind: 'coordination',
			        ...(from === undefined ? {} : { from }),
			        to,
			        subject,
			        at: entry.createdAt,
			    };
			}
			/** One `activity-interval-opened` fact → the draft (correlation + instance are required). */
			function adaptIntervalOpenDraft(entry, payload) {
			    const correlation = str(payload, 'correlation');
			    const instanceId = str(payload, 'instanceId');
			    if (correlation === undefined || instanceId === undefined)
			        return undefined;
			    return {
			        correlation,
			        instanceId,
			        openedAt: entry.createdAt,
			        openedSequence: entry.sequence,
			        isOpen: true,
			        subject: str(payload, 'subject'),
			        note: str(payload, 'note'),
			    };
			}
			/** Pair one `activity-interval-closed` fact onto its open draft (join key: `correlation`). */
			function adaptIntervalCloseDraft(entry, payload, opens) {
			    const correlation = str(payload, 'correlation');
			    if (correlation === undefined)
			        return;
			    const open = opens.get(correlation);
			    if (open === undefined)
			        return; // close without a loaded open: no invented interval
			    if (open.isOpen === false)
			        return; // a second close is an anomaly: the first stands
			    open.isOpen = false;
			    open.closedAt = entry.createdAt;
			    open.closedSequence = entry.sequence;
			    const closeNote = str(payload, 'closeNote') ?? str(payload, 'note');
			    if (closeNote !== undefined)
			        open.closeNote = closeNote;
			}
			/** One `activity-progress-recorded` fact → the historical work row (complete-ledger only). */
			function adaptProgressRow(entry, payload) {
			    const instanceId = str(payload, 'instanceId');
			    const subject = str(payload, 'subject');
			    const progress = progressOf(payload['progress']);
			    if (instanceId === undefined || subject === undefined || progress === undefined)
			        return undefined;
			    return {
			        sequence: entry.sequence,
			        instanceId,
			        subject,
			        progress,
			        at: entry.createdAt,
			        summary: str(payload, 'summary'),
			        lastAction: str(payload, 'lastAction'),
			        correlation: str(payload, 'correlation'),
			    };
			}
			/**
			 * Adapt the loaded ledger entries to the durable-ledger model (pure;
			 * deterministic for one entry set + completeness).
			 *
			 * @param entries - the store's merged, sequence-ordered loaded entries
			 *   (the adapter re-sorts defensively; the store is the order authority).
			 * @param complete - the store's completeness verdict
			 *   (`total !== null && completeThrough >= total`); the authority for the
			 *   `progress` / `pendingControlByInstance` gates.
			 */
			function adaptTeamLedger(entries, complete) {
			    const ordered = [...entries].sort((a, b) => a.sequence - b.sequence);
			    const rows = [];
			    const requests = new Map();
			    const orphans = [];
			    const messages = [];
			    const opens = new Map();
			    const progressRows = [];
			    for (const entry of ordered) {
			        const row = adaptEntry(entry);
			        if (row !== undefined)
			            rows.push(row);
			        const payload = (entry.payload ?? {});
			        switch (entry.factType) {
			            case 'control-request-recorded': {
			                const draft = adaptControlRequestDraft(entry, payload);
			                if (draft !== undefined && requests.has(draft.requestId) === false)
			                    requests.set(draft.requestId, draft);
			                break;
			            }
			            case 'control-decision-recorded':
			                adaptControlDecisionDraft(entry, payload, requests, orphans);
			                break;
			            case 'team-message-delivered': {
			                const message = adaptDeliveredMessage(entry, payload);
			                if (message !== undefined)
			                    messages.push(message);
			                break;
			            }
			            case 'team-coordination-recorded': {
			                const message = adaptCoordinationMessage(entry, payload);
			                if (message !== undefined)
			                    messages.push(message);
			                break;
			            }
			            case 'activity-interval-opened': {
			                const draft = adaptIntervalOpenDraft(entry, payload);
			                if (draft !== undefined && opens.has(draft.correlation) === false)
			                    opens.set(draft.correlation, draft);
			                break;
			            }
			            case 'activity-interval-closed':
			                adaptIntervalCloseDraft(entry, payload, opens);
			                break;
			            case 'activity-progress-recorded': {
			                const rowFact = adaptProgressRow(entry, payload);
			                if (rowFact !== undefined)
			                    progressRows.push(rowFact);
			                break;
			            }
			            default:
			                break; // rows-only facts (team / member / lifecycle / policy / allow-consumed)
			        }
			    }
			    // The pairing passes are done: drafts become the readonly public rows.
			    const controls = [...requests.values(), ...orphans]
			        .sort((a, b) => a.requestSequence - b.requestSequence)
			        .map(draft => draft);
			    const intervals = [...opens.values()]
			        .sort((a, b) => a.openedSequence - b.openedSequence)
			        .map(draft => draft);
			    // §7.4 gate: historical work rows + per-instance pending counts only
			    // over a KNOWN-COMPLETE ledger; a partial ledger yields neither.
			    let progress = [];
			    let pendingControlByInstance = {};
			    if (complete) {
			        progress = progressRows;
			        const byInstance = {};
			        for (const chain of controls) {
			            if (chain.pending === false)
			                continue;
			            byInstance[chain.targetInstanceId] = (byInstance[chain.targetInstanceId] ?? 0) + 1;
			        }
			        pendingControlByInstance = byInstance;
			    }
			    return {
			        completeness: complete ? 'complete' : 'partial',
			        entries: rows,
			        controls,
			        messages,
			        intervals,
			        progress,
			        pendingControlByInstance,
			    };
			}
			/**
			 * The plan §7.1 combined pure adapter:
			 * `pure(TeamProjectionDto, loaded RemoteLedgerEntryValue[])` (+ the
			 * viewer perspective and the store's completeness verdict).
			 *
			 * The §7.3 overlay: ONLY when the ledger is known complete are the
			 * snapshot member rows' `pendingControlCount` badges filled from
			 * `pendingControlByInstance` (absence of a pending request is a known
			 * zero, not unknown); under `partial` they stay `null`.
			 */
			export function adaptTeamUi(projection, perspective, entries, complete) {
			    const base = adaptTeamProjection(projection, perspective);
			    const ledger = adaptTeamLedger(entries, complete);
			    if (complete === false)
			        return { snapshot: base, ledger };
			    const members = base.members.map(member => ({
			        ...member,
			        pendingControlCount: ledger.pendingControlByInstance[member.instanceId] ?? 0,
			    }));
			    return { snapshot: { ...base, members }, ledger };
			}
			/**
			 * P9-T5 (S3-C) — lift one `TeamLedgerState` (the T4 store's published
			 * snapshot) into the UI ledger model: the loaded entries are replayed
			 * through the same pure `adaptTeamLedger`, and completeness is the
			 * store's own verdict rule — known complete iff the last accepted `total`
			 * is non-null and the catch-up frontier has reached it. `undefined` (no
			 * binding yet) yields the empty partial model: a partial ledger clearly
			 * represented (gate G3), never a claim over an unknown ledger.
			 *
			 * Type-only import of the store state (no runtime cycle: the store module
			 * imports nothing from `model/`).
			 * @param state - the store's published snapshot, or `undefined` for no binding.
			 * @returns the UI ledger model over the loaded entries.
			 */
			export function ledgerModelFromStoreState(state) {
			    if (state === undefined)
			        return adaptTeamLedger([], false);
			    const entries = [];
			    for (const sequence of state.orderedSequences) {
			        const entry = state.entriesBySequence.get(sequence);
			        if (entry !== undefined)
			            entries.push(entry);
			    }
			    const complete = state.total !== null && state.completeThrough >= state.total;
			    return adaptTeamLedger(entries, complete);
			}
			//# sourceMappingURL=ledger-adapter.js.map
			}, exports: {} };
		__mods["model/team-intent-model.js"] = { done: false, fn: function (exports) {
			/**
			 * P9-T7 (S5-A) — pure model for the New Team flow (plan P9-S5 S5-A; UI
			 * doc §4–§9): parsing the `catalog.list` rows, the `catalog.get`
			 * blueprint detail, and the `intent.probe` compatibility result, plus the
			 * create gate (button label / enablement) derived from the parsed
			 * compatibility status, the warning-acknowledgement checkbox, and the
			 * initial-work draft.
			 *
			 * Authority discipline: the host judges compatibility (the domain engine
			 * over `environmentFacts`); this module only maps the frozen closed sets
			 * (`OPEN` / `BLOCKED_WARNING` / `BLOCKED_FATAL` /
			 * `DEGRADED_ACKNOWLEDGED` and `PASS` / `WARNING` / `FATAL`) onto UI
			 * facts. Fail-safe leaf reads: only the fields the panel renders are
			 * read; an unrecognized status or outcome fails loud (never a silent
			 * "ready").
			 *
			 * Pure module: no React, no I/O, no transport. Erasable TS only.
			 * @module @dsh-agent-team/client/model/team-intent-model
			 */
			function asRecord(value) {
			    return typeof value === 'object' && value !== null ? value : undefined;
			}
			function readString(record, key) {
			    const value = record[key];
			    return typeof value === 'string' ? value : undefined;
			}
			function readNumber(record, key) {
			    const value = record[key];
			    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
			}
			function readStringArray(record, key) {
			    const value = record[key];
			    if (!Array.isArray(value))
			        return undefined;
			    const out = [];
			    for (const item of value) {
			        if (typeof item === 'string')
			            out.push(item);
			    }
			    return out;
			}
			/**
			 * Parse the `catalog.list` data (`{ blueprints: [...] }`). Rows missing an
			 * id or every numeric revision are dropped; a malformed envelope is a loud
			 * failure (the panel shows its catalog error state).
			 * @param data - the `data` field of a successful `catalog.list` response.
			 * @returns the parsed rows, or the loud failure message.
			 */
			function parseCatalogList(data) {
			    const root = asRecord(data);
			    const list = root?.['blueprints'];
			    if (!Array.isArray(list)) {
			        return { ok: false, message: 'catalog.list: missing `blueprints` list' };
			    }
			    const rows = [];
			    for (const entry of list) {
			        const record = asRecord(entry);
			        if (record === undefined)
			            continue;
			        const blueprintId = readString(record, 'blueprintId');
			        const raw = record['revisions'];
			        if (blueprintId === undefined || !Array.isArray(raw))
			            continue;
			        const revisions = [];
			        for (const item of raw) {
			            if (typeof item === 'number' && Number.isFinite(item))
			                revisions.push(item);
			        }
			        if (revisions.length === 0)
			            continue;
			        let latest = revisions[0];
			        for (const revision of revisions) {
			            if (revision > latest)
			                latest = revision;
			        }
			        rows.push({ blueprintId, revisions, latestRevision: latest });
			    }
			    return { ok: true, rows };
			}
			Object.defineProperty(exports, "parseCatalogList", { enumerable: true, get: () => parseCatalogList });
			/**
			 * Parse the `catalog.get` data (`{ blueprint: <record> }`). Returns
			 * `undefined` for a malformed envelope (the panel fails loud with its
			 * generic detail error).
			 * @param data - the `data` field of a successful `catalog.get` response.
			 * @returns the parsed detail, or `undefined` when unparseable.
			 */
			function parseBlueprintDetail(data) {
			    const root = asRecord(data);
			    const record = root === undefined ? undefined : asRecord(root['blueprint']);
			    if (record === undefined)
			        return undefined;
			    const blueprintId = readString(record, 'blueprintId');
			    const revision = readNumber(record, 'revision');
			    if (blueprintId === undefined || revision === undefined)
			        return undefined;
			    const members = Array.isArray(record['members']) ? record['members'] : [];
			    return {
			        blueprintId,
			        revision,
			        displayName: readString(record, 'displayName'),
			        description: readString(record, 'description'),
			        source: asRecord(record['metadata']) === undefined
			            ? undefined
			            : readString(asRecord(record['metadata']), 'source'),
			        templateCount: (record['leader'] !== undefined ? 1 : 0) + members.length,
			    };
			}
			Object.defineProperty(exports, "parseBlueprintDetail", { enumerable: true, get: () => parseBlueprintDetail });
			const STATUS_VALUES = new Set([
			    'OPEN', 'BLOCKED_WARNING', 'BLOCKED_FATAL', 'DEGRADED_ACKNOWLEDGED',
			]);
			const OUTCOME_VALUES = new Set(['PASS', 'WARNING', 'FATAL']);
			/**
			 * Parse the `intent.probe` data (`{ compatibility: <result> }`). The
			 * frozen closed sets decide: an unknown `status` or requirement `outcome`
			 * is a loud failure — never a silent "ready".
			 * @param data - the `data` field of a successful `intent.probe` response.
			 * @returns the parsed result, or the loud failure message.
			 */
			function parseCompatibilityResult(data) {
			    const root = asRecord(data);
			    const record = root === undefined ? undefined : asRecord(root['compatibility']);
			    if (record === undefined) {
			        return { ok: false, message: 'intent.probe: missing `compatibility` result' };
			    }
			    const statusRaw = readString(record, 'status');
			    if (statusRaw === undefined || !STATUS_VALUES.has(statusRaw)) {
			        return {
			            ok: false,
			            message: `intent.probe: unknown compatibility status ${statusRaw ?? '(absent)'}`,
			        };
			    }
			    const requirements = Array.isArray(record['requirements']) ? record['requirements'] : [];
			    const warnings = [];
			    const fatals = [];
			    for (const entry of requirements) {
			        const row = asRecord(entry);
			        if (row === undefined)
			            continue;
			        const outcome = readString(row, 'outcome');
			        if (outcome === undefined || !OUTCOME_VALUES.has(outcome)) {
			            return {
			                ok: false,
			                message: `intent.probe: unknown requirement outcome ${outcome ?? '(absent)'}`,
			            };
			        }
			        if (outcome !== 'WARNING' && outcome !== 'FATAL')
			            continue;
			        const requirementId = readString(row, 'requirementId') ?? '(unknown)';
			        const unavailableSubjects = readStringArray(row, 'unavailableSubjects') ?? [];
			        const detail = readString(row, 'detail') ?? '';
			        const complete = row['complete'] === true;
			        const reasonCode = readString(row, 'reasonCode');
			        const requirement = reasonCode === undefined
			            ? { requirementId, unavailableSubjects, detail, complete }
			            : { requirementId, unavailableSubjects, detail, complete, reasonCode };
			        if (outcome === 'WARNING')
			            warnings.push(requirement);
			        else
			            fatals.push(requirement);
			    }
			    return { ok: true, status: statusRaw, warnings, fatals };
			}
			Object.defineProperty(exports, "parseCompatibilityResult", { enumerable: true, get: () => parseCompatibilityResult });
			/**
			 * The create gate (UI §4.3 / §5 / §9) for the current draft. `checking`
			 * is the in-flight probe; `acknowledged` is the explicit
			 * "Acknowledge warnings and create" checkbox (never default-checked).
			 * Initial work (non-blank) switches the ready label from "Create Team"
			 * to "Create & Send" (UI §4.3); it still rides along under the
			 * acknowledgement label.
			 * @param compat - the parsed probe result, if one has landed.
			 * @param checking - true while a probe is in flight.
			 * @param acknowledged - the warning-ack checkbox state.
			 * @param initialWork - the initial-work draft text.
			 * @returns the button label selection and enablement.
			 */
			function intentCreateGate(compat, checking, acknowledged, initialWork) {
			    if (checking)
			        return { label: 'create', enabled: false };
			    if (compat === undefined || !compat.ok)
			        return { label: 'create', enabled: false };
			    switch (compat.status) {
			        case 'OPEN':
			        case 'DEGRADED_ACKNOWLEDGED':
			            return {
			                label: initialWork.trim() !== '' ? 'createAndSend' : 'create',
			                enabled: true,
			            };
			        case 'BLOCKED_WARNING':
			            return { label: 'acknowledge', enabled: acknowledged };
			        case 'BLOCKED_FATAL':
			            return { label: 'create', enabled: false };
			    }
			}
			Object.defineProperty(exports, "intentCreateGate", { enumerable: true, get: () => intentCreateGate });
			/**
			 * Whether the FATAL verdict is the §7.4 complete-persona preset conflict
			 * (the panel then offers "change runtime preset" as the remedy and keeps
			 * Create disabled with no Continue-anyway path).
			 * @param compat - the parsed probe result, if one has landed.
			 * @returns true when a FATAL row carries the frozen conflict reason code.
			 */
			function isPersonaPresetFatal(compat) {
			    if (compat === undefined || !compat.ok)
			        return false;
			    if (compat.status !== 'BLOCKED_FATAL')
			        return false;
			    return compat.fatals.some(row => row.reasonCode === 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT');
			}
			Object.defineProperty(exports, "isPersonaPresetFatal", { enumerable: true, get: () => isPersonaPresetFatal });
			/**
			 * The default runtime-preset preselect (UI §7.2: `team` is the recommended
			 * default, not a Team Mode switch). The `team` row wins when present;
			 * otherwise the row flagged `isDefault`; otherwise no preselect (the user
			 * picks explicitly).
			 * @param presets - the seam rows (broken rows already filtered).
			 * @returns the preset id to preselect, or `null`.
			 */
			function selectDefaultPresetId(presets) {
			    const team = presets.find(row => row.id === 'team');
			    if (team !== undefined)
			        return team.id;
			    const flagged = presets.find(row => row.isDefault);
			    return flagged !== undefined ? flagged.id : null;
			}
			Object.defineProperty(exports, "selectDefaultPresetId", { enumerable: true, get: () => selectDefaultPresetId });
			/** The blank draft (the panel's initial value). */
			const emptyTeamIntentDraft = {
			    blueprintId: null,
			    revision: null,
			    presetId: null,
			    workspaceId: null,
			    initialWork: '',
			    ack: false,
			};
			Object.defineProperty(exports, "emptyTeamIntentDraft", { enumerable: true, get: () => emptyTeamIntentDraft });
			/**
			 * Build the probe environment facts for one draft: the single persona fact
			 * for the selected preset when a seam row attests it, else no facts.
			 * @param draft - the draft (only its `presetId` is read).
			 * @param presets - the seam rows (broken rows already filtered).
			 * @returns the facts array (possibly empty) for `RemoteIntentProbeParams`.
			 */
			function intentEnvironmentFacts(draft, presets) {
			    if (draft.presetId === null)
			        return [];
			    const row = presets.find(candidate => candidate.id === draft.presetId);
			    if (row === undefined)
			        return [];
			    return [{ domain: 'persona', subject: row.id, available: true, generation: 0 }];
			}
			Object.defineProperty(exports, "intentEnvironmentFacts", { enumerable: true, get: () => intentEnvironmentFacts });
			/**
			 * Map the native workspace feed rows to the picker options (UI §8: the
			 * select shows titles, the value is the workspace id, and the team
			 * commands consume the path string downstream).
			 * @param views - the feed rows (`undefined` = feed not landed yet).
			 * @returns the picker options (empty when the feed is absent).
			 */
			function teamWorkspaceOptions(views) {
			    if (views === undefined)
			        return [];
			    return views.map(view => ({ id: view.workspaceId, title: view.title, path: view.path }));
			}
			Object.defineProperty(exports, "teamWorkspaceOptions", { enumerable: true, get: () => teamWorkspaceOptions });
			//# sourceMappingURL=team-intent-model.js.map
			}, exports: {} };
		__mods["ui/TeamTimeline.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const __imp10 = __extReq("react");
			const useEffect = __imp10.useEffect;
			const useMemo = __imp10.useMemo;
			const useRef = __imp10.useRef;
			const useState = __imp10.useState;
			const __imp11 = __extReq("@deepseek-ai/dsh-client-ui-primitives");
			const Tooltip = __imp11.Tooltip;
			const __imp12 = __req("model/team-timeline-model.js");
			const deriveTeamTimeline = __imp12.deriveTeamTimeline;
			const formatTeamClock = __imp12.formatTeamClock;
			const formatTeamDuration = __imp12.formatTeamDuration;
			const teamTimelineTicks = __imp12.teamTimelineTicks;
			const styles = __css("ui/TeamTimeline.module.css").default;
			/**
			 * The "团队" tab's timeline section (the first of the four sections): one
			 * lane per member instance (side labels carry the name and the stable lane
			 * color; leader-kind instances get no lane), one bar per activity interval
			 * span over the linear honest time domain, wheel zoom at the pointer, drag
			 * pan, keyboard pan/zoom/reset, hover tooltips (name, range, duration), and
			 * bar-click-to-switch into the member's child session. The running span's
			 * "now" is a component-local clock — no external subscription here.
			 */
			/** The deepest zoom of the visible domain (ms). */
			const MINIMUM_ZOOM_MS = 1_000;
			/** A press under this radius reads as a click, not a drag (px). */
			const MINIMUM_DRAG_PX = 3;
			/** Wheel deltaY → zoom-factor exponent. */
			const WHEEL_ZOOM_EXPONENT = 0.0015;
			/** The tooltip reveal delay (ms). */
			const TIMELINE_TOOLTIP_DELAY_MS = 200;
			/** The local "now" tick while a span runs (ms). */
			const RUNNING_TICK_MS = 1_000;
			/**
			 * Compose one bar's tooltip label: the member name, the start → end clock
			 * range (the effective end while running), the duration, and the running
			 * marker.
			 * @param name - the lane's member name.
			 * @param span - the bar's projection row.
			 * @param t - the team dictionary translate seat.
			 * @returns the two-line tooltip label.
			 */
			function barTooltipLabel(name, span, t) {
			    const running = span.inProgress ? `（${t('view.timeline.running')}）` : '';
			    return `${name}\n${formatTeamClock(span.startedAt)} → ${formatTeamClock(span.endedAt)}`
			        + ` · ${formatTeamDuration(span.endedAt - span.startedAt)}${running}`;
			}
			/**
			 * The team timeline section (D8a–D8d, D9).
			 * @param props - the team snapshot + ledger, the current instance highlight, the session-switch callback, and the dictionary.
			 * @returns the timeline section.
			 */
			function TeamTimeline({ snapshot, ledger, currentInstanceId, onSelectSession, t, }) {
			    const [now, setNow] = useState(() => Date.now());
			    const model = useMemo(() => deriveTeamTimeline(snapshot, ledger, now), [snapshot, ledger, now]);
			    const hasRunning = model !== null
			        && model.lanes.some(lane => lane.spans.some(span => span.inProgress));
			    useEffect(() => {
			        if (!hasRunning)
			            return;
			        const timer = setInterval(() => { setNow(Date.now()); }, RUNNING_TICK_MS);
			        return () => { clearInterval(timer); };
			    }, [hasRunning]);
			    const [viewport, setViewport] = useState(null);
			    const [panning, setPanning] = useState(false);
			    const panRef = useRef(null);
			    const rootRef = useRef(null);
			    const trackRef = useRef(null);
			    const fullDuration = model === null ? 1 : Math.max(1, model.end - model.start);
			    const viewportDuration = model === null || viewport === null
			        ? fullDuration
			        : Math.min(fullDuration, Math.max(1, viewport.end - viewport.start));
			    const domainDuration = viewportDuration;
			    const domainStart = model === null || viewport === null
			        ? model?.start ?? 0
			        : Math.min(Math.max(viewport.start, model.start), model.end - viewportDuration);
			    useEffect(() => {
			        const root = rootRef.current;
			        /* v8 ignore next -- the section ref is attached in the same commit as this effect. */
			        if (root === null || model === null)
			            return;
			        const onWheel = (event) => {
			            event.preventDefault();
			            const track = trackRef.current;
			            /* v8 ignore next -- the track renders unconditionally inside the section. */
			            if (track === null)
			                return;
			            const rect = track.getBoundingClientRect();
			            const anchorFraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
			            /* jscpd:ignore-start -- D8d: home-grown wheel-zoom math paralleling TrajectoryTimeline (cross-package import forbidden) */
			            const nextDuration = Math.min(fullDuration, Math.max(MINIMUM_ZOOM_MS, domainDuration * Math.exp(event.deltaY * WHEEL_ZOOM_EXPONENT)));
			            if (nextDuration >= fullDuration * 0.999) {
			                setViewport(null);
			                return;
			            }
			            const anchorTime = domainStart + anchorFraction * domainDuration;
			            const nextStart = Math.min(Math.max(anchorTime - anchorFraction * nextDuration, model.start), model.end - nextDuration);
			            setViewport({ start: nextStart, end: nextStart + nextDuration });
			        };
			        root.addEventListener('wheel', onWheel, { passive: false });
			        return () => { root.removeEventListener('wheel', onWheel); };
			    }, [domainDuration, domainStart, fullDuration, model]);
			    /* jscpd:ignore-end */
			    if (model === null) {
			        return (_jsx("section", { ref: rootRef, className: styles.root, "data-team-timeline": true, children: _jsx("p", { className: styles.empty, "data-team-timeline-empty": true, children: t('view.timeline.empty') }) }));
			    }
			    const projectedDomainStyle = {
			        '--team-domain-left': `${(-(domainStart - model.start) / fullDuration) * 100}%`,
			        '--team-domain-width': `${(fullDuration / domainDuration) * 100}%`,
			    };
			    const ticks = teamTimelineTicks(domainStart, domainStart + domainDuration);
			    const barSessionIdAt = (event) => {
			        /* v8 ignore next -- a browser pointer event's target is always an element; the check only narrows the synthetic event type. */
			        const target = event.target instanceof HTMLElement ? event.target : null;
			        return target?.closest('[data-team-timeline-bar]')
			            ?.dataset.teamTimelineBar ?? null;
			    };
			    const onPointerDown = (event) => {
			        if (event.button !== 0 && event.button !== 2)
			            return;
			        setPanning(true);
			        event.currentTarget.setPointerCapture(event.pointerId);
			        panRef.current = {
			            pointerId: event.pointerId,
			            button: event.button,
			            anchorClientX: event.clientX,
			            anchorStart: domainStart,
			            barSessionId: barSessionIdAt(event),
			            moved: false,
			        };
			    };
			    const onPointerMove = (event) => {
			        const pan = panRef.current;
			        if (pan === null || pan.pointerId !== event.pointerId)
			            return;
			        if (Math.abs(event.clientX - pan.anchorClientX) >= MINIMUM_DRAG_PX)
			            pan.moved = true;
			        const rect = event.currentTarget.getBoundingClientRect();
			        /* jscpd:ignore-start -- D8d: home-grown pan math paralleling TrajectoryTimeline (cross-package import forbidden) */
			        const delta = (event.clientX - pan.anchorClientX) / Math.max(1, rect.width);
			        const nextStart = Math.min(Math.max(pan.anchorStart - delta * domainDuration, model.start), model.end - domainDuration);
			        setViewport({ start: nextStart, end: nextStart + domainDuration });
			    };
			    /* jscpd:ignore-end */
			    const onPointerUp = (event) => {
			        const pan = panRef.current;
			        if (pan === null || pan.pointerId !== event.pointerId)
			            return;
			        const moved = pan.moved || Math.abs(event.clientX - pan.anchorClientX) >= MINIMUM_DRAG_PX;
			        panRef.current = null;
			        setPanning(false);
			        if (!moved && pan.button === 0 && pan.barSessionId !== null) {
			            onSelectSession(pan.barSessionId);
			        }
			    };
			    const onPointerCancel = () => {
			        panRef.current = null;
			        setPanning(false);
			    };
			    const panByFraction = (fraction) => {
			        const nextStart = Math.min(Math.max(domainStart + fraction * domainDuration, model.start), model.end - domainDuration);
			        if (nextStart === domainStart)
			            return;
			        setViewport({ start: nextStart, end: nextStart + domainDuration });
			    };
			    const zoomBy = (factor) => {
			        const nextDuration = Math.min(fullDuration, Math.max(MINIMUM_ZOOM_MS, domainDuration * factor));
			        if (nextDuration >= fullDuration * 0.999) {
			            setViewport(null);
			            return;
			        }
			        const center = domainStart + domainDuration / 2;
			        const nextStart = Math.min(Math.max(center - nextDuration / 2, model.start), model.end - nextDuration);
			        setViewport({ start: nextStart, end: nextStart + nextDuration });
			    };
			    const reset = () => { setViewport(null); };
			    const onKeyDown = (event) => {
			        switch (event.key) {
			            case 'ArrowLeft':
			                event.preventDefault();
			                panByFraction(-0.1 * (event.shiftKey ? 5 : 1));
			                return;
			            case 'ArrowRight':
			                event.preventDefault();
			                panByFraction(0.1 * (event.shiftKey ? 5 : 1));
			                return;
			            case '+':
			            case '=':
			                event.preventDefault();
			                zoomBy(0.5);
			                return;
			            case '-':
			            case '_':
			                event.preventDefault();
			                zoomBy(2);
			                return;
			            case '0':
			            case 'Escape':
			                event.preventDefault();
			                reset();
			                return;
			            default:
			                return;
			        }
			    };
			    return (_jsx("section", { ref: rootRef, className: styles.root, "data-team-timeline": true, children: _jsxs("div", { className: styles.plot, style: { '--team-lane-count': model.lanes.length }, children: [_jsx("div", { className: styles.corner, "aria-hidden": "true" }), _jsx("div", { className: styles.axis, "aria-hidden": "true", children: _jsx("div", { className: styles.domain, style: projectedDomainStyle, children: ticks.map(tick => (_jsx("span", { className: styles.tick, style: {
			                                '--team-tick-left': `${((tick - model.start) / fullDuration) * 100}%`,
			                            }, children: formatTeamClock(tick) }, tick))) }) }), _jsx("div", { className: styles.gutter, children: model.lanes.map(lane => (_jsxs("div", { className: styles.gutterRow, "data-team-lane-label": true, "data-lane": lane.lane, "data-lane-color": lane.colorSlot, "data-current": lane.instanceId === currentInstanceId || undefined, children: [_jsx("span", { className: styles.swatch, "aria-hidden": "true" }), _jsx("span", { className: styles.laneName, children: lane.name })] }, lane.instanceId))) }), _jsx("div", { ref: trackRef, className: styles.track, "data-panning": panning || undefined, "data-team-timeline-track": true, tabIndex: 0, "aria-label": t('view.timeline.aria'), onPointerDown: onPointerDown, onPointerMove: onPointerMove, onPointerUp: onPointerUp, onPointerCancel: onPointerCancel, onKeyDown: onKeyDown, onDoubleClick: (event) => {
			                        event.preventDefault();
			                        reset();
			                    }, onContextMenu: (event) => { event.preventDefault(); }, children: _jsx("div", { className: styles.domain, "data-team-timeline-domain": true, style: projectedDomainStyle, children: model.lanes.map(lane => (_jsx("div", { className: styles.lane, "data-team-lane": true, "data-lane-color": lane.colorSlot, "data-current": lane.instanceId === currentInstanceId || undefined, children: lane.spans.map(span => (_jsx(Tooltip, { label: () => barTooltipLabel(lane.name, span, t), side: "top", delayMs: TIMELINE_TOOLTIP_DELAY_MS, children: _jsx("span", { className: styles.bar, "data-team-timeline-bar": lane.childSessionId === '' ? undefined : lane.childSessionId, "data-running": span.inProgress || undefined, "aria-hidden": "true", style: {
			                                        '--team-bar-left': `${((span.startedAt - model.start) / fullDuration) * 100}%`,
			                                        '--team-bar-width': `${((span.endedAt - span.startedAt) / fullDuration) * 100}%`,
			                                    } }) }, span.key))) }, lane.instanceId))) }) })] }) }));
			}
			Object.defineProperty(exports, "TeamTimeline", { enumerable: true, get: () => TeamTimeline });
			//# sourceMappingURL=TeamTimeline.js.map
			}, exports: {} };
		__mods["ui/TeamMembers.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const __imp35 = __extReq("react");
			const useMemo = __imp35.useMemo;
			const useState = __imp35.useState;
			const __imp36 = __extReq("@deepseek-ai/dsh-client-ui-primitives");
			const StateDot = __imp36.StateDot;
			const __imp37 = __req("model/team-members-model.js");
			const deriveTeamMembers = __imp37.deriveTeamMembers;
			const __imp38 = __req("model/team-member-commands.js");
			const buildMemberCreateParams = __imp38.buildMemberCreateParams;
			const buildMemberFollowupParams = __imp38.buildMemberFollowupParams;
			const buildMemberLifecycleParams = __imp38.buildMemberLifecycleParams;
			const buildMemberSendParams = __imp38.buildMemberSendParams;
			const createRequestTokenGenerator = __imp38.createRequestTokenGenerator;
			const memberActionLabel = __imp38.memberActionLabel;
			const memberActionsForLifecycle = __imp38.memberActionsForLifecycle;
			const parseMemberCommandOutcome = __imp38.parseMemberCommandOutcome;
			const __imp39 = __req("ui/TeamMemberDialogs.js");
			const TeamConfirmDialog = __imp39.TeamConfirmDialog;
			const TeamCreateMemberDialog = __imp39.TeamCreateMemberDialog;
			const TeamMemberMessageDialog = __imp39.TeamMemberMessageDialog;
			const TeamMemberPromptDialog = __imp39.TeamMemberPromptDialog;
			const styles = __css("ui/TeamMembers.module.css").default;
			/**
			 * The "团队" tab's member-group section (the second of the four sections):
			 * the fixed leading leader row (the "回到 leader" entry, anchored to the
			 * first leader-kind instance — synthesized from the team session when the
			 * rows carry none, rendered even then) plus one group per member template.
			 * A group's container row reads `Name · N 活跃`; its expansion lists the
			 * member's instance rows — the five-state display status
			 * (created/running/settled/archived/disposed, read straight from the
			 * snapshot per plan §7.2), the latest tool call or the action placeholder,
			 * and a waiting badge while control requests are unresolved (the badge is
			 * completeness-aware per plan §7.3: hidden under a partial ledger).
			 * Clicking the leading row or an instance row switches the current session
			 * to the child session (D9); the group and instance rows whose session is
			 * the current one highlight (D7).
			 *
			 * P9-T5 (S3-C) mechanical adaptation (plan §8.4): the section reads the
			 * vNext snapshot + durable-ledger model instead of the leader-keyed view;
			 * the three-state status vocabulary becomes the five-state §7.2 display
			 * status (the "bound" state is superseded by "created").
			 *
			 * P9-T7 (S5-B) extension (UI §17/§23/§40, Gate P9-G5): an instance row is
			 * now a container `div` wrapping the session-navigation button and a
			 * lifecycle-gated action cluster — send work / follow-up / message /
			 * archive / restore / dispose (the §40 matrix; `Yes` = lifecycle-allowed,
			 * policy may still block at admission). Each command runs through the
			 * injected command face with a fresh local request token; NO optimistic
			 * authority patch is applied (the post-success projection pull is the
			 * state authority), and a typed failure lands verbatim (code + message +
			 * token echo) in the row's error note. Teammate group rows carry the §17
			 * "+" create-instance entry (never the leader row) opening the §17.1
			 * template / label / group / workspace dialog (with the
			 * `fresh_per_delegation` copy). When the command face is absent the
			 * section stays display-only (T5 behavior).
			 */
			const INSTANCE_STATUS_KEYS = {
			    created: 'view.members.created',
			    running: 'view.members.running',
			    settled: 'view.members.settled',
			    archived: 'view.members.archived',
			    disposed: 'view.members.disposed',
			};
			const ACTION_LABEL_KEYS = {
			    sendWork: 'member.action.sendWork',
			    followup: 'member.action.followup',
			    resume: 'member.action.resume',
			    message: 'member.action.message',
			    archive: 'member.action.archive',
			    restore: 'member.action.restore',
			    dispose: 'member.action.dispose',
			};
			/**
			 * Map an instance display status onto the four StateDot states.
			 * Provisional T5 mapping (T6 may refine lifecycle colors): created: amber,
			 * running: blue, settled/archived/disposed: green (terminal states).
			 * @param status - the instance row's display status.
			 * @returns the dot state.
			 */
			function memberDot(status) {
			    switch (status) {
			        case 'created': return 'warning';
			        case 'running': return 'ongoing';
			        case 'settled': return 'done';
			        case 'archived': return 'done';
			        case 'disposed': return 'done';
			    }
			}
			/**
			 * The instance id carried by the row key
			 * (`instanceId:childSessionId:index`, team-members-model).
			 * @param instance - the row.
			 * @returns the instance id.
			 */
			function instanceInstanceKey(instance) {
			    return instance.key.split(':')[0];
			}
			/** One instance row: the navigation button, the lifecycle-gated action cluster, the error note. */
			function InstanceRow({ instance, current, onSelect, onCommand, pendingKind, error, t, }) {
			    const pending = instance.pendingControlCount;
			    const actions = onCommand === undefined
			        ? []
			        : memberActionsForLifecycle(instance.lifecycle);
			    return (_jsxs("div", { className: styles.instanceRow, "data-member-instance": true, "data-status": instance.status, "data-current": current || undefined, "data-member-command-pending": pendingKind, children: [_jsxs("button", { type: "button", className: styles.instanceNav, "data-member-instance-nav": true, disabled: onSelect === undefined, onClick: onSelect, children: [_jsx("span", { className: styles.dotSlot, "aria-hidden": "true", children: _jsx(StateDot, { state: memberDot(instance.status) }) }), _jsx("span", { className: styles.instanceStatus, "data-member-status-text": true, children: t(INSTANCE_STATUS_KEYS[instance.status]) }), _jsx("span", { className: styles.instanceAction, "data-member-action": true, children: instance.currentAction ?? t('view.members.action.empty') }), pending !== null && pending > 0
			                        ? _jsx("span", { className: styles.waitingBadge, "data-member-waiting": true, children: t('view.members.waiting', { count: pending }) })
			                        : null] }), actions.length > 0
			                ? (_jsx("div", { className: styles.actions, "data-member-actions": true, children: actions.map(kind => (_jsx("button", { type: "button", className: styles.actionButton, "data-member-action-button": kind, disabled: pendingKind !== undefined, onClick: () => {
			                            if (onCommand !== undefined)
			                                onCommand(kind);
			                        }, children: t(ACTION_LABEL_KEYS[memberActionLabel(kind, instance.lifecycle)]) }, kind))) }))
			                : null, error !== undefined
			                ? (_jsxs("div", { className: styles.commandError, "data-member-command-error": true, children: [t('member.command.error', { code: error.code, message: error.message }), error.requestToken !== null ? ` [${error.requestToken}]` : ''] }))
			                : null] }));
			}
			/** One member group: the container row (plus the §17 "+" on teammate rows) and the instance expansion. */
			function MemberGroup({ group, current, currentSessionId, onSelectSession, onSelectLeader, onCommand, pendingByInstance, errorsByInstance, onCreateInstance, createPending, createError, t, }) {
			    const name = group.name ?? t('member.leader');
			    const label = `${name} · ${t('view.members.active', { count: group.activeCount })}`;
			    return (_jsxs("div", { className: styles.group, "data-member-group": true, "data-current": current || undefined, children: [onSelectLeader === undefined
			                ? (_jsxs("div", { className: styles.groupRow, "data-member-group-row": true, children: [_jsx("span", { className: styles.groupName, "data-member-group-name": true, children: label }), onCreateInstance !== undefined
			                            ? (_jsx("button", { type: "button", className: styles.createButton, "data-member-create-instance": true, "aria-label": t('member.action.create'), disabled: createPending || undefined, onClick: onCreateInstance, children: "+" }))
			                            : null] }))
			                : (_jsx("button", { type: "button", className: styles.groupRow, "data-member-group-row": true, "data-leader": "true", onClick: onSelectLeader, children: _jsx("span", { className: styles.groupName, "data-member-group-name": true, children: label }) })), createError !== undefined
			                ? (_jsxs("div", { className: styles.commandError, "data-member-command-error": true, "data-member-create-error": true, children: [t('member.command.error', { code: createError.code, message: createError.message }), createError.requestToken !== null ? ` [${createError.requestToken}]` : ''] }))
			                : null, _jsx("div", { className: styles.instances, "data-member-instances": true, children: group.instances.length === 0
			                    ? _jsx("span", { className: styles.noInstances, "data-member-no-instances": true, children: t('view.members.noInstances') })
			                    : group.instances.map(instance => {
			                        const instanceId = instanceInstanceKey(instance);
			                        // Instance keys only ever hold instance commands; the group-row
			                        // 'create' lives under the separate `template:*` key space.
			                        const instancePending = pendingByInstance?.[instanceId];
			                        return (_jsx(InstanceRow, { instance: instance, current: instance.childSessionId !== '' && instance.childSessionId === currentSessionId, onSelect: instance.childSessionId === '' ? undefined : () => { onSelectSession(instance.childSessionId); }, onCommand: onCommand === undefined ? undefined : kind => { onCommand(kind, instance); }, pendingKind: instancePending === 'create' ? undefined : instancePending, error: errorsByInstance?.[instanceId], t: t }, instance.key));
			                    }) })] }));
			}
			/**
			 * The team member-group section (D8e, D8f, D9, D10) with the D7
			 * highlight and the S5-B command flows (the §40 action matrix, the §17
			 * create dialog, the §23 confirmations, the G5 typed-result discipline).
			 * @param props - the vNext snapshot pair, the current session, the
			 *   session-switch callback, the optional command face and workspace
			 *   feed, and the dictionary.
			 * @returns the members section.
			 */
			function TeamMembers({ snapshot, ledger, currentSessionId, onSelectSession, memberCommands, workspaces, t, }) {
			    const model = deriveTeamMembers(snapshot, ledger);
			    const [open, setOpen] = useState(null);
			    const [pending, setPending] = useState({});
			    const [errors, setErrors] = useState({});
			    const nextToken = useMemo(() => createRequestTokenGenerator('ui'), []);
			    const teamSessionId = snapshot.teamSessionId;
			    const workspaceOptions = workspaces ?? [];
			    /**
			     * Run one command to settlement (G5): mark the key pending, run the
			     * request, on success pull the projection (the final-state authority),
			     * on a typed failure keep the verbatim error on the key, on a transport
			     * loss record the loss note; always clear the pending mark when it
			     * still belongs to this command.
			     * @param kind - the command kind (the pending-mark identity).
			     * @param key - the instance id (or `template:<id>` for create).
			     * @param token - the local request token (the loss-note echo).
			     * @param request - the settled request thunk.
			     */
			    const dispatch = (kind, key, token, request) => {
			        const commands = memberCommands;
			        if (commands === undefined)
			            return;
			        setOpen(null);
			        setPending(prev => ({ ...prev, [key]: kind }));
			        setErrors(prev => {
			            const next = { ...prev };
			            delete next[key];
			            return next;
			        });
			        void request()
			            .then(parseMemberCommandOutcome)
			            .then(outcome => {
			            if (outcome.ok) {
			                void commands.pullProjection(teamSessionId);
			            }
			            else {
			                setErrors(prev => ({ ...prev, [key]: outcome }));
			            }
			        })
			            .catch((error) => {
			            setErrors(prev => ({
			                ...prev,
			                [key]: {
			                    ok: false,
			                    code: 'transport-loss',
			                    message: error instanceof Error ? error.message : String(error),
			                    requestToken: token,
			                },
			            }));
			        })
			            .finally(() => {
			            setPending(prev => {
			                if (prev[key] !== kind)
			                    return prev;
			                const next = { ...prev };
			                delete next[key];
			                return next;
			            });
			        });
			    };
			    /**
			     * Run one instance command (send / follow-up / archive / restore /
			     * dispose): build the frozen params with a fresh local token, then
			     * settle through `dispatch`.
			     * @param kind - the command kind.
			     * @param instance - the target row.
			     * @param text - the prompt text (follow-up) or message body (send).
			     * @param subject - the optional message subject (send only).
			     */
			    const runInstanceCommand = (kind, instance, text, subject) => {
			        const commands = memberCommands;
			        if (commands === undefined)
			            return;
			        const instanceId = instanceInstanceKey(instance);
			        const token = nextToken();
			        if (kind === 'send') {
			            dispatch(kind, instanceId, token, () => commands.memberSend(buildMemberSendParams({
			                teamSessionId,
			                recipientInstanceId: instanceId,
			                requestToken: token,
			                body: text ?? '',
			                ...(subject !== undefined ? { subject } : {}),
			            })));
			        }
			        else if (kind === 'followup') {
			            dispatch(kind, instanceId, token, () => commands.memberFollowup(buildMemberFollowupParams({
			                teamSessionId,
			                targetInstanceId: instanceId,
			                requestToken: token,
			                prompt: text ?? '',
			            })));
			        }
			        else if (kind === 'archive') {
			            dispatch(kind, instanceId, token, () => commands.memberArchive(buildMemberLifecycleParams(teamSessionId, instanceId)));
			        }
			        else if (kind === 'restore') {
			            dispatch(kind, instanceId, token, () => commands.memberRestore(buildMemberLifecycleParams(teamSessionId, instanceId)));
			        }
			        else {
			            dispatch(kind, instanceId, token, () => commands.memberDispose(buildMemberLifecycleParams(teamSessionId, instanceId)));
			        }
			    };
			    /**
			     * Run the §17 create dialog submit: the template delegation plus the
			     * host-consumed payload fields (label required; group / workspace when
			     * given), settled through `dispatch` on the group's template key.
			     * @param group - the teammate group the "+" opened.
			     * @param draft - the trimmed dialog fields.
			     */
			    const runCreateCommand = (group, draft) => {
			        const commands = memberCommands;
			        if (commands === undefined)
			            return;
			        const token = nextToken();
			        dispatch('create', `template:${group.templateId}`, token, () => commands.memberCreate(buildMemberCreateParams({
			            teamSessionId,
			            templateId: group.templateId,
			            requestToken: token,
			            label: draft.label,
			            ...(draft.groupId !== undefined ? { groupId: draft.groupId } : {}),
			            ...(draft.workspace !== undefined ? { workspace: draft.workspace } : {}),
			        })));
			    };
			    const createTemplate = open?.kind === 'create'
			        ? snapshot.templates.find(template => template.templateId === open.group.templateId)
			        : undefined;
			    return (_jsxs("div", { className: styles.root, "data-team-members": true, children: [_jsx(MemberGroup, { group: model.leader, current: snapshot.teamSessionId === currentSessionId, currentSessionId: currentSessionId, onSelectSession: onSelectSession, onSelectLeader: () => { onSelectSession(snapshot.teamSessionId); }, t: t }), model.groups.map(group => (_jsx(MemberGroup, { group: group, current: group.instances.some(instance => instance.childSessionId === currentSessionId), currentSessionId: currentSessionId, onSelectSession: onSelectSession, onCommand: memberCommands === undefined ? undefined : (kind, instance) => {
			                    if (kind === 'restore') {
			                        // §23.4: restore is a direct click (no confirmation, no model
			                        // call — ARCHIVED → SETTLED after the real admission).
			                        runInstanceCommand('restore', instance);
			                    }
			                    else {
			                        setOpen({ kind, instance });
			                    }
			                }, pendingByInstance: pending, errorsByInstance: errors, onCreateInstance: memberCommands === undefined
			                    ? undefined
			                    : () => { setOpen({ kind: 'create', group }); }, createPending: pending[`template:${group.templateId}`] === 'create', createError: errors[`template:${group.templateId}`], t: t }, group.templateId))), open !== null && memberCommands !== undefined && (open.kind === 'create'
			                ? createTemplate !== undefined
			                    ? (_jsx(TeamCreateMemberDialog, { template: createTemplate, workspaces: workspaceOptions, onSubmit: draft => { runCreateCommand(open.group, draft); }, onCancel: () => { setOpen(null); }, t: t }))
			                    : null
			                : open.kind === 'archive'
			                    ? (_jsx(TeamConfirmDialog, { title: t('member.archive.title'), body: t('member.archive.plain'), warning: open.instance.lifecycle === 'RUNNING' ? t('member.archive.running') : undefined, confirmLabel: t('member.archive.confirm'), cancelLabel: t('member.archive.cancel'), onConfirm: () => { runInstanceCommand('archive', open.instance); }, onCancel: () => { setOpen(null); } }))
			                    : open.kind === 'dispose'
			                        ? (_jsx(TeamConfirmDialog, { title: t('member.dispose.title'), body: t('member.dispose.body'), confirmLabel: t('member.dispose.confirm'), cancelLabel: t('member.dispose.cancel'), onConfirm: () => { runInstanceCommand('dispose', open.instance); }, onCancel: () => { setOpen(null); } }))
			                        : open.kind === 'followup'
			                            ? (_jsx(TeamMemberPromptDialog, { title: t('member.send.title', { member: open.instance.label }), placeholder: t('member.send.prompt.placeholder'), submitLabel: t('member.send.submit'), cancelLabel: t('member.send.cancel'), onSubmit: text => { runInstanceCommand('followup', open.instance, text); }, onCancel: () => { setOpen(null); }, t: t }))
			                            : (_jsx(TeamMemberMessageDialog, { title: t('member.message.title', { member: open.instance.label }), onSubmit: (body, subject) => { runInstanceCommand('send', open.instance, body, subject); }, onCancel: () => { setOpen(null); }, t: t })))] }));
			}
			//# sourceMappingURL=TeamMembers.js.map
			}, exports: {} };
		__mods["ui/TeamActivity.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const __imp1 = __extReq("@deepseek-ai/dsh-client-ui-primitives");
			const StateDot = __imp1.StateDot;
			const styles = __css("ui/TeamActivity.module.css").default;
			/** The frozen progress-value label keys (the contracts `ProgressValue` closed set). */
			const STATUS_KEYS = {
			    'in-progress': 'view.activity.in_progress',
			    'completed': 'view.activity.completed',
			    'blocked': 'view.activity.blocked',
			};
			/**
			 * Map a current-work status onto the StateDot states (UI §25 status dot):
			 * in-progress blue, completed green, blocked red, and an ABSENT status
			 * reads as ongoing (the row exists only because some work fact named the
			 * instance — no status is never an error).
			 * @param status - the frozen progress value, or `undefined` when the row carries none.
			 * @returns the dot state.
			 */
			function rowDot(status) {
			    switch (status) {
			        case 'completed': return 'done';
			        case 'blocked': return 'error';
			        case 'in-progress': return 'ongoing';
			        case undefined: return 'ongoing';
			    }
			}
			/**
			 * The Activity / Progress section: the snapshot's current-work rows in
			 * roster order, one non-interactive row each.
			 * @param props - the current-work rows and the team dictionary.
			 * @returns the Activity section.
			 */
			function TeamActivity({ activity, t }) {
			    return (_jsx("div", { className: styles.root, "data-team-activity": true, children: activity.length === 0
			            ? _jsx("span", { className: styles.empty, "data-activity-empty": true, children: t('view.activity.empty') })
			            : activity.map(row => {
			                // The row's subject line: the durable subject, falling back
			                // through the adapter's presentation fields to the instance label.
			                const subject = row.subject ?? row.currentAction ?? row.summary ?? row.label;
			                return (_jsxs("div", { className: styles.taskRow, "data-activity-row": true, "data-activity-status": row.status, children: [_jsx("span", { className: styles.dotSlot, "aria-hidden": "true", children: _jsx(StateDot, { state: rowDot(row.status) }) }), _jsxs("div", { className: styles.taskMain, children: [_jsxs("div", { className: styles.taskLine, children: [_jsx("span", { className: styles.taskSubject, "data-activity-subject": true, children: subject }), row.status !== undefined
			                                            ? _jsx("span", { className: styles.taskStatus, "data-activity-status-text": true, children: t(STATUS_KEYS[row.status]) })
			                                            : null] }), _jsx("div", { className: styles.taskAssignee, "data-activity-member": true, children: t('view.activity.member', { member: row.label }) }), row.summary !== undefined
			                                    ? _jsx("div", { className: styles.taskSummary, "data-activity-summary": true, children: row.summary })
			                                    : null] })] }, row.instanceId));
			            }) }));
			}
			//# sourceMappingURL=TeamActivity.js.map
			}, exports: {} };
		__mods["ui/TeamLedger.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const _Fragment = __imp0.Fragment;
			const __imp28 = __extReq("react");
			const useEffect = __imp28.useEffect;
			const useState = __imp28.useState;
			const __imp29 = __extReq("@deepseek-ai/dsh-client-ui-primitives");
			const StateDot = __imp29.StateDot;
			const __imp30 = __req("model/team-ledger-model.js");
			const TEAM_LEDGER_INITIAL_LIMIT = __imp30.TEAM_LEDGER_INITIAL_LIMIT;
			const TEAM_LEDGER_STEP = __imp30.TEAM_LEDGER_STEP;
			const deriveTeamLedgerSection = __imp30.deriveTeamLedgerSection;
			const __imp31 = __req("model/team-timeline-model.js");
			const formatTeamClock = __imp31.formatTeamClock;
			const styles = __css("ui/TeamLedger.module.css").default;
			/**
			 * The "团队" tab's durable-ledger Events section (P9-T6, plan §8.9 ADAPT,
			 * UI §27): the loaded ledger facts as compact single-line rows in durable
			 * sequence order (oldest first), capped to the most recent 200 filtered
			 * rows with a client-local "load earlier" depth append, the client-local
			 * category / instance-or-template filter (UI §27.4), a loud retryable
			 * error note for the last typed store failure, and the partial-ledger
			 * counted remainder while the catch-up frontier is behind the total.
			 *
			 * ADAPT (plan §8.9): the legacy `TeamFeed` list-section structure is kept
			 * — the same `TeamLedger.module.css` (ex `TeamFeed.module.css`) classes,
			 * the compact single-line row with dot / time / type marker / actor /
			 * summary, the `title` full-detail affordance, the load-earlier button,
			 * the loud error note, the row-click session navigation (D9), and the
			 * local window state — while the input is rewritten from the compat
			 * `TeamView` (snapshot approvals/messages + wire `olderMessages` +
			 * `messagesBefore` anchor paging) to the vNext durable surface: the
			 * `TeamUiLedgerModel` over the ledger store's loaded entries. The store
			 * pages FORWARD from the ledger head, so the legacy anchor wire-paging arm
			 * is gone: "load earlier" is a pure local window deepening over the loaded
			 * set, and the legacy counted remainder re-binds to the partial-ledger
			 * remainder (`total - completeThrough`).
			 *
			 * Row families (plan §8.9): one family per frozen fact type, plus the safe
			 * generic row for an unknown / future fact type (no throw, no actor or
			 * session-link guessing — see `team-ledger-model`).
			 */
			/** The closed frozen category filter options (the contracts `LedgerCategory` set). */
			const CATEGORY_FILTER_OPTIONS = [
			    ['team', 'view.ledger.filter.team'],
			    ['member', 'view.ledger.filter.members'],
			    ['lifecycle', 'view.ledger.filter.lifecycle'],
			    ['message', 'view.ledger.filter.messages'],
			    ['control', 'view.ledger.filter.controls'],
			    ['policy', 'view.ledger.filter.policy'],
			    ['compatibility', 'view.ledger.filter.compatibility'],
			    ['progress', 'view.ledger.filter.progress'],
			];
			/** The type-marker labels for the eleven known row families (unknown: the raw fact type). */
			const FACT_MARKER_KEYS = {
			    'work-admitted': 'view.ledger.fact.work_admitted',
			    'member-created': 'view.ledger.fact.member_created',
			    'lifecycle-changed': 'view.ledger.fact.lifecycle',
			    'message': 'view.ledger.fact.message',
			    'control-request': 'view.ledger.fact.control_request',
			    'control-decision': 'view.ledger.fact.control_decision',
			    'control-consumed': 'view.ledger.fact.control_consumed',
			    'progress-recorded': 'view.ledger.fact.progress',
			    'interval-opened': 'view.ledger.fact.interval_opened',
			    'interval-closed': 'view.ledger.fact.interval_closed',
			    'policy-transitioned': 'view.ledger.fact.policy',
			};
			/** The frozen decision-value labels; an unknown wire value renders raw (fail-open display). */
			const DECISION_KEYS = {
			    allow: 'view.ledger.decision.allow',
			    deny: 'view.ledger.decision.deny',
			    'stale-denied': 'view.ledger.decision.stale_denied',
			};
			/** The frozen progress-value labels (shared with the Activity section). */
			const STATUS_KEYS = {
			    'in-progress': 'view.activity.in_progress',
			    'completed': 'view.activity.completed',
			    'blocked': 'view.activity.blocked',
			};
			/**
			 * Map one ledger row onto the StateDot state: a control request is amber
			 * while unpaired (no loaded decision) and green once the chain settles;
			 * the settled control facts and the interval close read as done; a
			 * progress row reads by its frozen value (absent: ongoing); everything
			 * else reads as ongoing.
			 * @param row - the ledger row.
			 * @returns the dot state.
			 */
			function rowDot(row) {
			    switch (row.kind) {
			        case 'control-request':
			            return row.pending ? 'warning' : 'done';
			        case 'control-decision':
			        case 'control-consumed':
			        case 'interval-closed':
			            return 'done';
			        case 'progress-recorded':
			            switch (row.progressValue) {
			                case 'completed': return 'done';
			                case 'blocked': return 'error';
			                case 'in-progress': return 'ongoing';
			                case undefined: return 'ongoing';
			            }
			        default:
			            return 'ongoing';
			    }
			}
			/**
			 * The row's trailing state badge: the waiting badge on a pending control
			 * request, the decision label (+ optional reason) on a control decision,
			 * the progress label on a progress row; no badge otherwise.
			 * @param row - the ledger row.
			 * @param t - the team dictionary translate seat.
			 * @returns the badge element, or null.
			 */
			function stateBadge(row, t) {
			    if (row.kind === 'control-request') {
			        if (row.pending === false)
			            return null;
			        return _jsx("span", { className: styles.state, "data-ledger-state": true, "data-pending": "true", children: t('view.ledger.pending') });
			    }
			    if (row.kind === 'control-decision') {
			        const value = row.decisionValue;
			        if (value === undefined)
			            return null;
			        const key = DECISION_KEYS[value];
			        return (_jsxs("span", { className: styles.state, "data-ledger-state": true, "data-decision": value, children: [key === undefined ? value : t(key), row.decisionReason !== undefined
			                    ? _jsx("span", { className: styles.stateReason, "data-ledger-state-reason": true, title: row.decisionReason, children: row.decisionReason })
			                    : null] }));
			    }
			    if (row.kind === 'progress-recorded') {
			        if (row.progressValue === undefined)
			            return null;
			        return _jsx("span", { className: styles.state, "data-ledger-state": true, "data-progress": row.progressValue, children: t(STATUS_KEYS[row.progressValue]) });
			    }
			    return null;
			}
			/** One durable-ledger row: time, type marker, actor, one-line summary, and the family's state badge. */
			function LedgerRow({ row, onSelect, t }) {
			    const marker = row.kind === 'unknown'
			        ? row.factType
			        : t(FACT_MARKER_KEYS[row.kind]);
			    return (_jsxs("button", { type: "button", className: styles.row, "data-ledger-row": true, "data-ledger-kind": row.kind, "data-ledger-fact": row.factType, disabled: onSelect === undefined, onClick: onSelect, children: [_jsx("span", { className: styles.dotSlot, "aria-hidden": "true", children: _jsx(StateDot, { state: rowDot(row) }) }), _jsx("span", { className: styles.time, "data-ledger-time": true, children: formatTeamClock(row.at) }), _jsx("span", { className: styles.marker, "data-ledger-marker": true, children: marker }), row.actorLabel !== ''
			                ? _jsx("span", { className: styles.actor, "data-ledger-actor": true, children: row.actorLabel })
			                : null, _jsx("span", { className: styles.summary, "data-ledger-summary": true, title: row.detail, children: row.summary }), stateBadge(row, t)] }));
			}
			/**
			 * The durable-ledger Events section with the top control bar (the client
			 * local filters, the loud typed error + retry, the load-earlier depth
			 * append, and the partial-ledger remainder note).
			 * @param props - the snapshot, the ledger model, the store state, the
			 *   retry and D9 callbacks, and the dictionary.
			 * @returns the Events section.
			 */
			function TeamLedger(props) {
			    const { snapshot, ledger, ledgerState, onRetry, onSelectSession, t } = props;
			    const [loadedCount, setLoadedCount] = useState(TEAM_LEDGER_INITIAL_LIMIT);
			    const [filter, setFilter] = useState({ category: 'all', instanceId: null });
			    // A NEW TEAM rebinds the window: the depth and the client-local filter
			    // reset, because the loaded set is that team's ledger. Frames of the same
			    // team keep the window: arriving events must not jump the viewed window.
			    useEffect(() => {
			        setLoadedCount(TEAM_LEDGER_INITIAL_LIMIT);
			        setFilter({ category: 'all', instanceId: null });
			    }, [snapshot.teamSessionId]);
			    const section = deriveTeamLedgerSection({
			        ledger,
			        snapshot,
			        loadedCount,
			        filter,
			        total: ledgerState?.total ?? null,
			        completeThrough: ledgerState?.completeThrough ?? 0,
			    });
			    const error = ledgerState?.error;
			    const errorMessage = error === undefined ? '' : ('reason' in error ? error.reason : error.error.message);
			    const loading = ledgerState?.loading ?? false;
			    const loadEarlier = () => {
			        setLoadedCount(count => Math.min(count + TEAM_LEDGER_STEP, section.total));
			    };
			    return (_jsx("div", { className: styles.root, "data-team-ledger": true, children: section.total === 0
			            ? (_jsx("span", { className: styles.empty, "data-ledger-empty": true, children: loading ? t('view.ledger.loading') : t('view.ledger.empty') }))
			            : (_jsxs(_Fragment, { children: [_jsxs("div", { className: styles.top, "data-ledger-top": true, children: [_jsxs("select", { className: styles.filter, "data-ledger-filter-category": true, value: filter.category, onChange: event => {
			                                    const value = event.target.value;
			                                    setFilter(current => ({ ...current, category: value === 'all' ? 'all' : value }));
			                                }, children: [_jsx("option", { value: "all", children: t('view.ledger.filter.all') }), CATEGORY_FILTER_OPTIONS.map(([category, key]) => (_jsx("option", { value: category, children: t(key) }, category)))] }), _jsxs("select", { className: styles.filter, "data-ledger-filter-instance": true, value: filter.instanceId ?? '', onChange: event => {
			                                    const value = event.target.value;
			                                    setFilter(current => ({ ...current, instanceId: value === '' ? null : value }));
			                                }, children: [_jsx("option", { value: "", children: t('view.ledger.filter.all') }), snapshot.members.map(member => (_jsx("option", { value: member.instanceId, children: member.label }, member.instanceId))), snapshot.templates.map(template => (_jsx("option", { value: template.templateId, children: template.displayName }, template.templateId)))] }), error !== undefined
			                                ? _jsx("span", { className: styles.loadFailed, "data-ledger-error": true, children: t('view.ledger.loadFailed', { message: errorMessage }) })
			                                : null, error !== undefined
			                                ? (_jsx("button", { type: "button", className: styles.loadEarlier, "data-ledger-retry": true, onClick: () => { void onRetry(); }, children: t('view.ledger.retry') }))
			                                : null, section.hasMore
			                                ? (_jsx("button", { type: "button", className: styles.loadEarlier, "data-ledger-load-earlier": true, disabled: loading, onClick: loadEarlier, children: t('view.ledger.loadEarlier') }))
			                                : null, section.complete === false && section.remainingCount > 0
			                                ? _jsx("span", { className: styles.truncated, "data-ledger-remaining": true, children: t('view.ledger.remaining', { count: section.remainingCount }) })
			                                : null] }), _jsx("div", { className: styles.rows, children: section.rows.map(row => (_jsx(LedgerRow, { row: row, onSelect: row.navigationSessionId === '' ? undefined : () => { onSelectSession(row.navigationSessionId); }, t: t }, row.key))) })] })) }));
			}
			//# sourceMappingURL=TeamLedger.js.map
			}, exports: {} };
		__mods["ui/TeamCreationPanel.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const __imp31 = __extReq("react");
			const useEffect = __imp31.useEffect;
			const useRef = __imp31.useRef;
			const useState = __imp31.useState;
			const __imp32 = __req("model/team-intent-model.js");
			const intentCreateGate = __imp32.intentCreateGate;
			const intentEnvironmentFacts = __imp32.intentEnvironmentFacts;
			const isPersonaPresetFatal = __imp32.isPersonaPresetFatal;
			const parseBlueprintDetail = __imp32.parseBlueprintDetail;
			const parseCatalogList = __imp32.parseCatalogList;
			const parseCompatibilityResult = __imp32.parseCompatibilityResult;
			const selectDefaultPresetId = __imp32.selectDefaultPresetId;
			const __imp33 = __req("model/team-member-commands.js");
			const createRequestTokenGenerator = __imp33.createRequestTokenGenerator;
			const __imp34 = __req("model/team-handoff.js");
			const HANDOFF_DECISION_OPTIONS = __imp34.HANDOFF_DECISION_OPTIONS;
			const handoffDecisionActions = __imp34.handoffDecisionActions;
			const handoffRetryPlan = __imp34.handoffRetryPlan;
			const parseHandoffCreateState = __imp34.parseHandoffCreateState;
			const parseHandoffPrepareValue = __imp34.parseHandoffPrepareValue;
			const styles = __css("ui/TeamCreationPanel.module.css").default;
			/**
			 * P9-T7 (S5-A) — the New Team creation panel (UI doc §3–§9, plan P9-S5
			 * S5-A; Gate P9-G5): the blueprint picker over the frozen `catalog.list` /
			 * `catalog.get` rows, the revision select, the native workspace picker
			 * (`useWorkspaces` rows, hidden when the feed is empty), the runtime
			 * AgentPreset select (UI §7: `team` recommended default; free switching
			 * re-runs the probe), the initial-work draft, and the live `intent.probe`
			 * compatibility block — PASS ✓ Ready, WARNING list + explicit (never
			 * default-checked) acknowledgement, FATAL ✕ with no Continue-anyway
			 * (the §7.4 complete-persona preset conflict gets its dedicated copy).
			 *
			 * Create sequence (UI §4.3 canonical order, locked T7): CREATING → native
			 * `createRootSession` (the Root DSH session, carrying the selected
			 * workspace) → frozen `team.create` (binds the TeamSession, admits the
			 * initial work through the real path) → `openSession(rootId)`. On a typed
			 * `team.create` failure the panel stays mounted on CREATION_FAILED with
			 * the typed error preserved verbatim (NO optimistic authority patch) and a
			 * RETRY that re-runs `team.create` on the SAME retained root (cold-root
			 * recovery); the real root is never pretended away.
			 *
			 * Authority discipline: the selected preset reaches the pre-creation
			 * probe ONLY through the frozen `environmentFacts` channel (a persona
			 * fact for the selected preset id; the domain engine treats a missing
			 * fact as unavailable, which is how the §7.4 structural FATAL is
			 * reached). The warning ack is a LOCAL UI gate: the frozen probe carries
			 * no ack param, and the durable `compatibility.ack` applies
			 * post-creation. Everything rendered after the create click is either the
			 * retained typed Remote error or the opened Root session — never a
			 * locally patched "success".
			 */
			/** The create button label per gate state (the locale-owned copy). */
			const CREATE_LABEL_KEYS = {
			    create: 'intent.create',
			    createAndSend: 'intent.createAndSend',
			    acknowledge: 'intent.acknowledge',
			};
			/** A typed Remote failure rendered as `code: message` (verbatim, G5). */
			function remoteFailureMessage(response) {
			    return response.ok ? '' : `${response.error.code}: ${response.error.message}`;
			}
			/** A thrown error (channel loss / native create) rendered to a string. */
			function throwableMessage(error) {
			    return error instanceof Error ? error.message : String(error);
			}
			/**
			 * The `data-intent-status` value for the current panel state (the four
			 * wire statuses when a result has landed, `checking` while a probe is in
			 * flight, `unknown` when none has (a loud state, never a silent ready),
			 * `none` before any blueprint is selected).
			 */
			function panelCompatStatus(blueprintId, checking, compat) {
			    if (blueprintId === null)
			        return 'none';
			    if (checking)
			        return 'checking';
			    if (compat === undefined || !compat.ok)
			        return 'unknown';
			    return compat.status;
			}
			/** The New Team creation panel (UI §3–§9). */
			function TeamCreationPanel(props) {
			    const { listCatalog, getCatalog, probeCompatibility, teamCreate, createRootSession, openSession, listAgentPresets, workspaces, handoffSource, handoffFace, draft, onDraftChange, onCancel, t, } = props;
			    // -- catalog + per-row details (the §6 picker display names) -------------
			    const [catalog, setCatalog] = useState(undefined);
			    const [catalogDetails, setCatalogDetails] = useState({});
			    // -- runtime presets (UI §7) ----------------------------------------------
			    const [presets, setPresets] = useState([]);
			    const [presetsReady, setPresetsReady] = useState(false);
			    // -- probe + detail (generation-guarded: stale results are ignored) ------
			    const [checking, setChecking] = useState(false);
			    const [compat, setCompat] = useState(undefined);
			    const [detail, setDetail] = useState(undefined);
			    // -- create (CREATING / CREATION_FAILED on the retained root) -------------
			    const [creating, setCreating] = useState(false);
			    const [createdRootId, setCreatedRootId] = useState(null);
			    const [createError, setCreateError] = useState(null);
			    // -- handoff (P9-T8 S5-D, UI §32): inert when the face or the source is
			    // absent; enabled by default (§32.2) when both are present. -------------
			    const [handoffEnabled, setHandoffEnabled] = useState(handoffFace !== undefined && handoffSource !== undefined);
			    const [handoffPreparing, setHandoffPreparing] = useState(false);
			    const [handoffSummary, setHandoffSummary] = useState(null);
			    const [handoffPreviewOpen, setHandoffPreviewOpen] = useState(false);
			    const [handoffPrepareError, setHandoffPrepareError] = useState(null);
			    const [handoffCreateBusy, setHandoffCreateBusy] = useState(false);
			    const [handoffCreateState, setHandoffCreateState] = useState(null);
			    /** A typed `handoff.create` RESPONSE failure (no stored state). */
			    const [handoffFailed, setHandoffFailed] = useState(null);
			    const [handoffRequestToken, setHandoffRequestToken] = useState(null);
			    const [handoffCanceled, setHandoffCanceled] = useState(false);
			    const handoffTokenGen = useRef(createRequestTokenGenerator('handoff-create'));
			    // Latest draft/face refs: async settlements must never act on a stale
			    // closure, and the settle-time ack reset must not feed the probe effect.
			    const draftRef = useRef(draft);
			    useEffect(() => { draftRef.current = draft; }, [draft]);
			    const probeSeq = useRef(0);
			    const detailSeq = useRef(0);
			    const handoffActive = handoffFace !== undefined && handoffSource !== undefined;
			    // §32.2 prefill: the default workspace = the source session's workspace
			    // (only when the native feed carries it and the user has not picked one
			    // yet; the draft is page-run UI state, never authority).
			    useEffect(() => {
			        const source = handoffSource;
			        if (!handoffActive || source === undefined)
			            return;
			        const workspaceId = source.sourceWorkspaceId;
			        if (workspaceId === null)
			            return;
			        if (draftRef.current.workspaceId !== null)
			            return;
			        if (!workspaces.some(option => option.id === workspaceId))
			            return;
			        onDraftChange({ ...draftRef.current, workspaceId });
			    }, [handoffActive, handoffSource, workspaces, onDraftChange]);
			    // §32.3: enabling the handoff runs the read-only `handoff.prepare` once
			    // (the one-shot summary PREVIEW). Its failure — including the production
			    // fail-closed source surface — is rendered verbatim and NEVER blocks the
			    // create: the `handoff.create` path snapshots the source itself.
			    useEffect(() => {
			        const face = handoffFace;
			        const source = handoffSource;
			        if (face === undefined || source === undefined || !handoffEnabled)
			            return;
			        let live = true;
			        setHandoffPreparing(true);
			        setHandoffPrepareError(null);
			        setHandoffSummary(null);
			        void face
			            .prepare({ sourceSessionId: source.sourceSessionId })
			            .then(response => {
			            if (!live)
			                return;
			            if (!response.ok) {
			                setHandoffPrepareError({ code: response.error.code, message: response.error.message });
			                return;
			            }
			            setHandoffSummary(parseHandoffPrepareValue(response.value.data));
			        })
			            .catch(error => {
			            if (!live)
			                return;
			            setHandoffPrepareError({ code: 'native-error', message: throwableMessage(error) });
			        })
			            .finally(() => {
			            if (live)
			                setHandoffPreparing(false);
			        });
			        return () => { live = false; };
			    }, [handoffFace, handoffSource, handoffEnabled]);
			    // The catalog load (mount once): the rows, then one `catalog.get` per
			    // row's latest revision for the picker display names (fail-safe per row:
			    // a detail failure degrades that option to the blueprint id, never the
			    // whole list).
			    useEffect(() => {
			        let live = true;
			        void listCatalog().then(async (response) => {
			            if (!response.ok) {
			                if (live)
			                    setCatalog({ ok: false, message: remoteFailureMessage(response) });
			                return;
			            }
			            const parsed = parseCatalogList(response.value.data);
			            if (!parsed.ok) {
			                if (live)
			                    setCatalog({ ok: false, message: parsed.message });
			                return;
			            }
			            const rows = parsed.rows;
			            const details = {};
			            await Promise.all(rows.map(async (row) => {
			                try {
			                    const detailResponse = await getCatalog({
			                        blueprintId: row.blueprintId,
			                        blueprintRevision: row.latestRevision,
			                    });
			                    if (detailResponse.ok)
			                        details[row.blueprintId] = parseBlueprintDetail(detailResponse.value.data);
			                }
			                catch {
			                    // Per-row fail-safe: the option falls back to the blueprint id.
			                }
			            }));
			            if (live) {
			                setCatalogDetails(details);
			                setCatalog(parsed);
			            }
			        }).catch(error => {
			            if (live)
			                setCatalog({ ok: false, message: throwableMessage(error) });
			        });
			        return () => { live = false; };
			        // The injected face is built once per mount (T9 wiring); the load is
			        // deliberately mount-scoped.
			        // eslint-disable-next-line react-hooks/exhaustive-deps
			    }, []);
			    // The preset rows (mount once): after they land, preselect the §7.2
			    // default when the draft has no explicit selection yet.
			    useEffect(() => {
			        let live = true;
			        void listAgentPresets().then(rows => {
			            if (!live)
			                return;
			            setPresets(rows);
			            setPresetsReady(true);
			            const current = draftRef.current;
			            if (current.presetId === null) {
			                const id = selectDefaultPresetId(rows);
			                if (id !== null)
			                    onDraftChange({ ...current, presetId: id });
			            }
			        }).catch(() => {
			            if (live)
			                setPresetsReady(true);
			        });
			        return () => { live = false; };
			        // eslint-disable-next-line react-hooks/exhaustive-deps
			    }, []);
			    // The live probe (UI §7.3: free preset switching re-runs compatibility):
			    // re-fires on blueprint / revision / preset changes; the generation
			    // counter drops stale settlements. The selected preset travels as the
			    // persona environment fact (the only frozen environment channel).
			    useEffect(() => {
			        if (draft.blueprintId === null) {
			            setCompat(undefined);
			            setChecking(false);
			            return;
			        }
			        const seq = ++probeSeq.current;
			        setChecking(true);
			        const params = {
			            blueprintId: draft.blueprintId,
			            ...(draft.revision !== null ? { blueprintRevision: draft.revision } : {}),
			            environmentFacts: intentEnvironmentFacts(draftRef.current, presets),
			        };
			        void probeCompatibility(params).then(response => {
			            if (probeSeq.current !== seq)
			                return;
			            setChecking(false);
			            setCompat(response.ok
			                ? parseCompatibilityResult(response.value.data)
			                : { ok: false, message: remoteFailureMessage(response) });
			            // A new verdict binds to a new mismatch set: the local ack gate
			            // resets (the frozen engine's drift semantics, UI §9.2).
			            const current = draftRef.current;
			            if (current.ack)
			                onDraftChange({ ...current, ack: false });
			        }).catch(error => {
			            if (probeSeq.current !== seq)
			                return;
			            setChecking(false);
			            setCompat({ ok: false, message: throwableMessage(error) });
			        });
			        // eslint-disable-next-line react-hooks/exhaustive-deps
			    }, [draft.blueprintId, draft.revision, draft.presetId, presets]);
			    // The selected blueprint's detail (the §6 display block under the
			    // picker): one `catalog.get` per selection, generation-guarded.
			    useEffect(() => {
			        if (draft.blueprintId === null || draft.revision === null) {
			            setDetail(undefined);
			            return;
			        }
			        const seq = ++detailSeq.current;
			        void getCatalog({
			            blueprintId: draft.blueprintId,
			            blueprintRevision: draft.revision,
			        }).then(response => {
			            if (detailSeq.current !== seq)
			                return;
			            setDetail(response.ok ? parseBlueprintDetail(response.value.data) : undefined);
			        }).catch(() => {
			            if (detailSeq.current !== seq)
			                return;
			            setDetail(undefined);
			        });
			        // eslint-disable-next-line react-hooks/exhaustive-deps
			    }, [draft.blueprintId, draft.revision]);
			    // A blueprint / revision change starts a NEW creation attempt: the
			    // retained root and its error belong to the previous attempt (the old
			    // bound root stays real and reachable; it is never pretended away).
			    useEffect(() => {
			        setCreatedRootId(null);
			        setCreateError(null);
			        // eslint-disable-next-line react-hooks/exhaustive-deps
			    }, [draft.blueprintId, draft.revision]);
			    const rows = catalog !== undefined && catalog.ok ? catalog.rows : [];
			    const setBlueprint = (blueprintId) => {
			        const row = rows.find(candidate => candidate.blueprintId === blueprintId);
			        onDraftChange({
			            ...draft,
			            blueprintId: blueprintId === '' ? null : blueprintId,
			            revision: row !== undefined ? row.latestRevision : null,
			            ack: false,
			        });
			    };
			    const setRevision = (raw) => {
			        onDraftChange({ ...draft, revision: raw === '' ? null : Number(raw), ack: false });
			    };
			    const setPreset = (presetId) => {
			        onDraftChange({ ...draft, presetId: presetId === '' ? null : presetId, ack: false });
			    };
			    const setWorkspace = (workspaceId) => {
			        onDraftChange({ ...draft, workspaceId: workspaceId === '' ? null : workspaceId });
			    };
			    const setInitialWork = (initialWork) => {
			        onDraftChange({ ...draft, initialWork });
			    };
			    const setAck = (ack) => {
			        onDraftChange({ ...draft, ack });
			    };
			    const gate = intentCreateGate(compat, checking, draft.ack, draft.initialWork);
			    const runCreate = (retry) => {
			        if (creating)
			            return;
			        if (!retry && !gate.enabled)
			            return;
			        const blueprintId = draft.blueprintId;
			        if (blueprintId === null)
			            return;
			        setCreating(true);
			        setCreateError(null);
			        const workspaceId = draft.workspaceId;
			        void (async () => {
			            try {
			                // 1) the real Root DSH session (retained on every later failure).
			                let rootSessionId = createdRootId;
			                if (rootSessionId === null) {
			                    rootSessionId = workspaceId !== null
			                        ? await createRootSession({ workspaceId })
			                        : await createRootSession();
			                    setCreatedRootId(rootSessionId);
			                }
			                // 2) the frozen team.create on that root (cold path on retry).
			                const initialWork = draft.initialWork.trim();
			                const params = {
			                    rootSessionId,
			                    blueprintId,
			                    ...(draft.revision !== null ? { blueprintRevision: draft.revision } : {}),
			                    ...(initialWork !== '' ? { initialWork: { prompt: initialWork } } : {}),
			                };
			                const response = await teamCreate(params);
			                if (!response.ok) {
			                    // CREATION_FAILED: the typed Remote result, verbatim (G5). The
			                    // root is retained; RETRY re-runs team.create on the same root.
			                    setCreateError({ code: response.error.code, message: response.error.message });
			                    return;
			                }
			                // 3) Root + TeamSession exist → open the Root (UI §4.3 order).
			                openSession(rootSessionId);
			            }
			            catch (error) {
			                // Channel loss (the only Remote rejection kind) or a native
			                // create failure: a local marker code, the message verbatim.
			                setCreateError({ code: 'native-error', message: throwableMessage(error) });
			            }
			            finally {
			                setCreating(false);
			            }
			        })();
			    };
			    // -- the handoff create flow (P9-T8 S5-D, Gate P9-G5) ---------------------
			    // The frozen `handoff.create` is a command flow: NO optimistic authority
			    // patch (the panel renders the stored state / typed error verbatim), the
			    // typed Remote result preserved (G5(b)), the new team's projection
			    // cold-pulled exactly once — by the NEW session's TeamView after
			    // `openSession(rootSessionId)` (G5(c)) — and the rendered final state
			    // comes from that Projection (G5(d)).
			    /** The display failure: the typed response failure, else the stored
			     * failing create state's code/message (verbatim, G5(b)). */
			    const handoffFailure = handoffFailed !== null
			        ? handoffFailed
			        : handoffCreateState !== null &&
			            (handoffCreateState.kind === 'awaiting-decision' || handoffCreateState.kind === 'creation-failed')
			            ? { code: handoffCreateState.failureCode, message: handoffCreateState.failureMessage }
			            : null;
			    const handoffActions = handoffCreateState !== null
			        ? handoffDecisionActions(handoffCreateState)
			        : handoffFailed !== null
			            ? HANDOFF_DECISION_OPTIONS
			            : [];
			    const invokeHandoffCreate = (token) => {
			        const face = handoffFace;
			        const source = handoffSource;
			        if (face === undefined || source === undefined || handoffCreateBusy || creating)
			            return;
			        setHandoffCreateBusy(true);
			        setHandoffFailed(null);
			        setHandoffCanceled(false);
			        setHandoffRequestToken(token);
			        void face
			            .create({ sourceSessionId: source.sourceSessionId, requestToken: token })
			            .then(response => {
			            if (!response.ok) {
			                // Typed create failure (no stored state): the §32.4 triad with a
			                // fresh-token retry (no operation exists under the used token).
			                setHandoffFailed({ code: response.error.code, message: response.error.message });
			                return;
			            }
			            const state = parseHandoffCreateState(response.value.data);
			            setHandoffCreateState(state);
			            if (state.kind === 'completed' || state.kind === 'completed-without-handoff') {
			                // Root + TeamSession exist (invariant 9: the same id) → open the
			                // Root; the new session's TeamView cold-pulls the projection.
			                openSession(state.rootSessionId);
			            }
			        })
			            .catch(error => {
			            // Channel loss (the only Remote rejection kind): a local marker.
			            setHandoffFailed({ code: 'native-error', message: throwableMessage(error) });
			        })
			            .finally(() => {
			            setHandoffCreateBusy(false);
			        });
			    };
			    const runHandoffRetry = () => {
			        const face = handoffFace;
			        const source = handoffSource;
			        if (face === undefined || source === undefined)
			            return;
			        if (handoffCreateState === null) {
			            // Typed response failure: nothing stored to replay → a fresh token.
			            invokeHandoffCreate(handoffTokenGen.current());
			            return;
			        }
			        // §10.5 idempotency mapping: creation-failed → SAME token (the host
			        // re-drives creation only); awaiting-decision → FRESH token.
			        const plan = handoffRetryPlan(handoffCreateState, source.sourceSessionId, handoffRequestToken ?? '', handoffTokenGen.current());
			        if (plan !== null)
			            invokeHandoffCreate(plan.requestToken);
			    };
			    const continueWithoutHandoff = () => {
			        // Client-local EXPLICIT user decision (§32.4; plan §10.5: no backend
			        // method): the standard non-handoff create sequence (native root +
			        // `team.create`) — a new team WITHOUT handoff provenance.
			        setHandoffFailed(null);
			        setHandoffCreateState(null);
			        setHandoffRequestToken(null);
			        setHandoffCanceled(false);
			        setHandoffEnabled(false);
			        runCreate(false);
			    };
			    const cancelHandoff = () => {
			        // Client-local: the attempt is discarded; NO Remote call (plan §10.5).
			        setHandoffFailed(null);
			        setHandoffCreateState(null);
			        setHandoffRequestToken(null);
			        setHandoffCanceled(true);
			    };
			    /** The create button: with the handoff on (and no stored attempt and no
			     * canceled decision) the frozen `handoff.create` runs (NO native root);
			     * otherwise the T7 standard sequence. A CANCELED handoff (the user's
			     * explicit no-handoff decision) routes every later create to the
			     * standard path: cancel is terminal within the panel run (the checkbox
			     * is disabled after it), so a plain create click must not silently
			     * re-open the handoff attempt. */
			    const handleCreateClick = () => {
			        if (handoffActive && handoffEnabled && !handoffCanceled &&
			            handoffCreateState === null && handoffFailed === null &&
			            !handoffCreateBusy && !creating) {
			            invokeHandoffCreate(handoffTokenGen.current());
			            return;
			        }
			        runCreate(false);
			    };
			    const status = panelCompatStatus(draft.blueprintId, checking, compat);
			    const selectedRow = rows.find(row => row.blueprintId === draft.blueprintId);
			    return (_jsxs("div", { className: styles.panel, "data-team-creation-panel": true, children: [_jsx("h2", { className: styles.title, children: t('intent.title') }), _jsxs("label", { className: styles.field, children: [_jsx("span", { className: styles.fieldLabel, children: t('intent.blueprint') }), _jsxs("select", { className: styles.select, "data-intent-blueprint": true, value: draft.blueprintId ?? '', disabled: catalog === undefined, onChange: event => setBlueprint(event.target.value), children: [catalog === undefined && _jsx("option", { value: "", children: t('intent.blueprint.loading') }), catalog !== undefined && !catalog.ok && _jsx("option", { value: "", children: t('intent.blueprint.empty') }), catalog !== undefined && catalog.ok && catalog.rows.length === 0 && (_jsx("option", { value: "", children: t('intent.blueprint.empty') })), rows.map(row => {
			                                const rowDetail = catalogDetails[row.blueprintId];
			                                return (_jsx("option", { value: row.blueprintId, children: rowDetail !== undefined && rowDetail.displayName !== undefined
			                                        ? `${rowDetail.displayName} (rev ${String(row.latestRevision)})`
			                                        : `${row.blueprintId} (rev ${String(row.latestRevision)})` }, row.blueprintId));
			                            })] })] }), catalog !== undefined && !catalog.ok && (_jsx("div", { className: styles.error, "data-intent-error": true, "data-intent-catalog-error": true, children: t('intent.blueprint.error', { message: catalog.message }) })), detail !== undefined && (_jsxs("div", { className: styles.detail, "data-intent-detail": true, children: [detail.displayName !== undefined && (_jsx("span", { className: styles.detailName, "data-intent-detail-name": true, children: detail.displayName })), detail.source !== undefined && (_jsx("span", { className: styles.detailSource, "data-intent-detail-source": true, children: detail.source })), detail.description !== undefined && (_jsx("p", { className: styles.detailDescription, "data-intent-detail-description": true, children: detail.description })), _jsx("span", { className: styles.detailTemplates, "data-intent-detail-templates": true, children: String(detail.templateCount) })] })), selectedRow !== undefined && (_jsxs("label", { className: styles.field, children: [_jsx("span", { className: styles.fieldLabel, children: t('intent.revision') }), _jsx("select", { className: styles.select, "data-intent-revision": true, value: draft.revision === null ? '' : String(draft.revision), onChange: event => setRevision(event.target.value), children: selectedRow.revisions.map(revision => (_jsx("option", { value: String(revision), children: String(revision) }, revision))) })] })), workspaces.length > 0 && (_jsxs("label", { className: styles.field, children: [_jsx("span", { className: styles.fieldLabel, children: t('intent.workspace') }), _jsxs("select", { className: styles.select, "data-intent-workspace": true, value: draft.workspaceId ?? '', onChange: event => setWorkspace(event.target.value), children: [_jsx("option", { value: "", children: t('intent.workspace') }), workspaces.map(option => (_jsx("option", { value: option.id, children: option.title }, option.id)))] })] })), handoffActive && handoffSource !== undefined && (_jsxs("div", { className: styles.handoff, "data-intent-handoff": true, children: [_jsx("span", { className: styles.handoffTitle, "data-intent-handoff-title": true, children: t('handoff.title') }), _jsx("span", { "data-intent-handoff-source": true, children: t('handoff.source', { id: handoffSource.sourceSessionId }) }), _jsxs("label", { "data-intent-handoff-generate": true, children: [_jsx("input", { type: "checkbox", "data-intent-handoff-checkbox": true, checked: handoffEnabled, disabled: creating || handoffCreateBusy ||
			                                    handoffCreateState !== null || handoffFailed !== null || handoffCanceled, onChange: event => {
			                                    const enabled = event.target.checked;
			                                    setHandoffEnabled(enabled);
			                                    setHandoffPreparing(false);
			                                    setHandoffSummary(null);
			                                    setHandoffPrepareError(null);
			                                    setHandoffPreviewOpen(false);
			                                } }), _jsx("span", { children: t('handoff.generate') })] }), handoffPreparing && (_jsx("p", { className: styles.handoffNote, "data-intent-handoff-preparing": true, children: t('handoff.preparing') })), handoffSummary !== null && (_jsxs("div", { className: styles.handoffReady, "data-intent-handoff-ready": true, children: [_jsx("span", { "data-intent-handoff-ready-label": true, children: t('handoff.ready') }), _jsx("button", { type: "button", className: styles.secondary, "data-intent-handoff-preview": true, onClick: () => setHandoffPreviewOpen(open => !open), children: t('handoff.preview') }), handoffPreviewOpen && (_jsxs("div", { className: styles.handoffPreview, "data-intent-handoff-preview-body": true, children: [_jsx("p", { "data-intent-handoff-summary-title": true, children: handoffSummary.title }), _jsx("ul", { "data-intent-handoff-summary-bullets": true, children: handoffSummary.bullets.map(bullet => (_jsx("li", { children: bullet }, bullet))) })] }))] })), handoffPrepareError !== null && (_jsx("p", { className: styles.handoffError, "data-intent-handoff-prepare-error": true, children: t('governance.error', {
			                            message: `${handoffPrepareError.code}: ${handoffPrepareError.message}`,
			                        }) })), handoffFailure !== null && (_jsxs("div", { className: styles.handoffFailed, "data-intent-handoff-failed": true, "data-intent-handoff-failed-code": handoffFailure.code, "data-intent-handoff-failed-token": handoffRequestToken ?? '', children: [_jsx("p", { children: t('handoff.failed', {
			                                    message: `${handoffFailure.code}: ${handoffFailure.message}`,
			                                }) }), _jsxs("div", { className: styles.handoffTriad, children: [handoffActions.includes('retry') && (_jsx("button", { type: "button", className: styles.secondary, "data-intent-handoff-retry": true, disabled: handoffCreateBusy, onClick: runHandoffRetry, children: t('handoff.retry') })), handoffActions.includes('continue-without-handoff') && (_jsx("button", { type: "button", className: styles.secondary, "data-intent-handoff-continue": true, disabled: handoffCreateBusy, onClick: continueWithoutHandoff, children: t('handoff.continue') })), handoffActions.includes('cancel') && (_jsx("button", { type: "button", className: styles.secondary, "data-intent-handoff-cancel": true, disabled: handoffCreateBusy, onClick: cancelHandoff, children: t('handoff.cancel') }))] })] })), handoffCanceled && (_jsx("p", { className: styles.handoffNote, "data-intent-handoff-canceled": true, children: t('handoff.canceled') }))] })), _jsxs("label", { className: styles.field, children: [_jsx("span", { className: styles.fieldLabel, children: t('intent.preset') }), _jsxs("select", { className: styles.select, "data-intent-preset": true, value: draft.presetId ?? '', disabled: !presetsReady || presets.length === 0, onChange: event => setPreset(event.target.value), children: [!presetsReady && _jsx("option", { value: "", children: t('intent.blueprint.loading') }), presetsReady && presets.length === 0 && _jsx("option", { value: "", children: t('intent.blueprint.empty') }), presets.map(row => (_jsx("option", { value: row.id, children: row.name !== undefined ? row.name : row.id }, row.id)))] })] }), _jsx("p", { className: styles.hint, children: t('intent.preset.hint') }), _jsxs("label", { className: styles.field, children: [_jsx("span", { className: styles.fieldLabel, children: t('intent.initialWork') }), _jsx("textarea", { className: styles.textarea, "data-intent-initial-work": true, value: draft.initialWork, placeholder: t('intent.initialWork.placeholder'), onChange: event => setInitialWork(event.target.value) })] }), _jsxs("div", { className: styles.compat, "data-intent-compatibility": true, "data-intent-status": status, role: "status", children: [_jsx("span", { className: styles.compatTitle, children: t('intent.compatibility') }), status === 'checking' && (_jsx("p", { className: styles.compatNote, children: t('intent.compatibility.checking') })), status === 'OPEN' && (_jsx("p", { className: styles.compatReady, children: t('intent.compatibility.ready') })), status === 'DEGRADED_ACKNOWLEDGED' && (_jsx("p", { className: styles.compatNote, children: t('intent.compatibility.degraded') })), status === 'unknown' && (_jsx("p", { className: styles.compatUnknown, children: t('intent.compatibility.unknown', {
			                            message: compat !== undefined && !compat.ok ? compat.message : '',
			                        }) })), compat !== undefined && compat.ok && compat.status === 'BLOCKED_WARNING' && (_jsx("ul", { className: styles.warningList, children: compat.warnings.map(row => (_jsxs("li", { className: styles.warningRow, "data-intent-warning": true, children: [_jsxs("span", { className: styles.warningOwner, children: [t('intent.compatibility.owner'), " ", row.requirementId] }), row.unavailableSubjects.length > 0 && (_jsxs("span", { className: styles.warningSubjects, children: [t('intent.compatibility.subjects'), ": ", row.unavailableSubjects.join(', ')] })), _jsx("span", { className: styles.warningDetail, children: row.detail })] }, row.requirementId))) })), compat !== undefined && compat.ok && compat.status === 'BLOCKED_WARNING' && (_jsxs("label", { className: styles.ack, "data-intent-ack": true, children: [_jsx("input", { type: "checkbox", checked: draft.ack, onChange: event => setAck(event.target.checked) }), t('intent.ack')] })), status === 'BLOCKED_FATAL' && (_jsxs("div", { className: styles.fatal, "data-intent-fatal": true, children: [_jsx("p", { className: styles.fatalTitle, children: t('intent.compatibility.fatal') }), compat !== undefined && compat.ok && compat.fatals.map(row => (_jsxs("p", { className: styles.fatalRow, children: [t('intent.compatibility.owner'), " ", row.requirementId, " \u2014 ", row.detail] }, row.requirementId))), isPersonaPresetFatal(compat) && (_jsx("p", { className: styles.fatalPreset, children: t('intent.fatal.preset') }))] }))] }), createError !== null && (_jsxs("div", { className: styles.error, "data-intent-error": true, "data-intent-create-error": true, children: [t('intent.error', { message: `${createError.code}: ${createError.message}` }), createdRootId !== null && _jsx("p", { className: styles.rootKept, children: t('intent.rootKept') })] })), _jsxs("div", { className: styles.actions, children: [_jsx("button", { type: "button", className: styles.primary, "data-intent-create": true, disabled: !gate.enabled || creating || handoffCreateBusy, onClick: handleCreateClick, children: creating ? t('intent.creating') : t(CREATE_LABEL_KEYS[gate.label]) }), createError !== null && createdRootId !== null && (_jsx("button", { type: "button", className: styles.secondary, "data-intent-retry": true, disabled: creating, onClick: () => runCreate(true), children: t('intent.retry') })), _jsx("button", { type: "button", className: styles.secondary, "data-intent-cancel": true, disabled: creating, onClick: onCancel, children: t('intent.cancel') })] })] }));
			}
			//# sourceMappingURL=TeamCreationPanel.js.map
			}, exports: {} };
		__mods["ui/TeamGovernance.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const __imp33 = __extReq("react");
			const useMemo = __imp33.useMemo;
			const useState = __imp33.useState;
			const __imp34 = __req("../../remote/src/index.js");
			const REMOTE_CAPABILITY_VALUES = __imp34.REMOTE_CAPABILITY_VALUES;
			const __imp35 = __req("model/team-member-commands.js");
			const createRequestTokenGenerator = __imp35.createRequestTokenGenerator;
			const parseMemberCommandOutcome = __imp35.parseMemberCommandOutcome;
			const __imp36 = __req("model/team-governance.js");
			const HUMAN_RECHECK_TRIGGER = __imp36.HUMAN_RECHECK_TRIGGER;
			const compatibilityBadge = __imp36.compatibilityBadge;
			const compatibilityGetParams = __imp36.compatibilityGetParams;
			const compatibilityReprobeParams = __imp36.compatibilityReprobeParams;
			const effectiveConfigLanes = __imp36.effectiveConfigLanes;
			const hardPolicyDisplay = __imp36.hardPolicyDisplay;
			const overrideGetParams = __imp36.overrideGetParams;
			const overrideResetParams = __imp36.overrideResetParams;
			const overrideSetParams = __imp36.overrideSetParams;
			const parseCompatibilityStateValue = __imp36.parseCompatibilityStateValue;
			const parseOverrideValue = __imp36.parseOverrideValue;
			const parsePolicyStateValue = __imp36.parsePolicyStateValue;
			const policyStateGetParams = __imp36.policyStateGetParams;
			const policyStateLabel = __imp36.policyStateLabel;
			const policyStateSetParams = __imp36.policyStateSetParams;
			const styles = __css("ui/TeamGovernance.module.css").default;
			/**
			 * P9-T8 (S5-C) — the config/policy/compatibility governance section
			 * (plan P9-S5 S5-C; UI doc §10/§18/§19/§21; Gate P9-G5).
			 *
			 * Rendered as the team section between Members and Activity, and ONLY when
			 * the injected `governance` face is present (absent → the T7 rendering is
			 * unchanged; the T9 mount supplies the real face).
			 *
			 * G5 discipline (plan §10.3 mutation rule: remote command → typed result
			 * → projection re-pull → render):
			 * - NO optimistic authority patch: the pending mark and the local "will
			 *   commit" preview are UI state only; nothing rendered as durable state
			 *   changes before the typed result lands and the projection pull settles.
			 * - Every command (recheck / policy-state set / override set / override
			 *   reset) runs through `dispatch`, which reuses the shared
			 *   `parseMemberCommandOutcome`: the remote typed result is preserved
			 *   verbatim (`code`, `message`, `requestToken` echo) and rendered
			 *   unrewritten; the projection is pulled EXACTLY ONCE on success and
			 *   NEVER on a typed failure; a transport loss records a local
			 *   `transport-loss` note only (no projection pull).
			 * - The READS (`compatibility.get`, `policyState.get`, `override.get`)
			 *   are not command flows: they never pull the projection (the T7 catalog
			 *   precedent) and their typed failures render verbatim as local notes.
			 * - The rendered durable state (the compatibility badge + counts, the
			 *   policy-state id) comes from the PROJECTION snapshot, never from a
			 *   wire read; the fresh reads are displayed as labeled detail.
			 *
			 * Wire gap (recorded divergence): `compatibility.ack` requires a
			 * `requirementId`, but the frozen `compatibility.get` exposes aggregate
			 * counts only — the ack control is rendered DISABLED with the explicit
			 * reason (UI §38: no grey button without a reason).
			 */
			/** A thrown error (channel loss / malformed read) rendered to a string. */
			function throwableMessage(error) {
			    return error instanceof Error ? error.message : String(error);
			}
			/** Parse a comma-separated allow-items field (trimmed, empties dropped). */
			function parseItemsField(raw) {
			    return raw
			        .split(',')
			        .map(part => part.trim())
			        .filter(part => part !== '');
			}
			const EMPTY_POLICY_CELLS = {};
			/**
			 * The governance section (UI §10/§18/§19/§21): the compatibility card
			 * (the Projection badge + counts, the fresh-read detail, the Recheck
			 * command, the disabled ack with its explicit reason), the policy-state
			 * row (the Projection state id, the §21 help copy, the cell view +
			 * editor + commit), and the per-member effective-config lanes (the
			 * §18.3 distinct state words, the §19 hard-policy display, the §19
			 * override editor).
			 */
			function TeamGovernance({ snapshot, governance, t, }) {
			    const teamSessionId = snapshot.teamSessionId;
			    // -- the G5 command channel state ----------------------------------------
			    const [pending, setPending] = useState({});
			    const [errors, setErrors] = useState({});
			    const nextToken = useMemo(() => createRequestTokenGenerator('governance'), []);
			    // -- the read state (reads never pull the projection) ---------------------
			    const [compatRead, setCompatRead] = useState(undefined);
			    const [compatReading, setCompatReading] = useState(false);
			    const [policyRead, setPolicyRead] = useState(undefined);
			    const [policyReading, setPolicyReading] = useState(false);
			    const [policyCells, setPolicyCells] = useState(EMPTY_POLICY_CELLS);
			    const [overrideReads, setOverrideReads] = useState({});
			    const [overrideDrafts, setOverrideDrafts] = useState({});
			    /**
			     * Run one command to settlement (Gate P9-G5, the T7 pattern verbatim):
			     * mark the key pending, clear its stale error, run the request, on
			     * success pull the projection EXACTLY ONCE (the final-state authority),
			     * on a typed failure keep the verbatim error on the key, on a transport
			     * loss record the loss note; always clear the pending mark when it
			     * still belongs to this command.
			     * @param kind - the command kind (the pending-mark identity).
			     * @param key - the command slot (e.g. `compat-recheck`, `policy-set`).
			     * @param token - the local request token (the loss-note echo).
			     * @param request - the settled request thunk.
			     */
			    const dispatch = (kind, key, token, request) => {
			        setPending(prev => ({ ...prev, [key]: kind }));
			        setErrors(prev => {
			            const next = { ...prev };
			            delete next[key];
			            return next;
			        });
			        void request()
			            .then(parseMemberCommandOutcome)
			            .then(outcome => {
			            if (outcome.ok) {
			                void governance.pullProjection(teamSessionId);
			            }
			            else {
			                setErrors(prev => ({ ...prev, [key]: outcome }));
			            }
			        })
			            .catch((error) => {
			            setErrors(prev => ({
			                ...prev,
			                [key]: {
			                    ok: false,
			                    code: 'transport-loss',
			                    message: error instanceof Error ? error.message : String(error),
			                    requestToken: token,
			                },
			            }));
			        })
			            .finally(() => {
			            setPending(prev => {
			                if (prev[key] !== kind)
			                    return prev;
			                const next = { ...prev };
			                delete next[key];
			                return next;
			            });
			        });
			    };
			    // -- the reads (no projection pull — the T7 catalog precedent) ------------
			    /** `compatibility.get`: the fresh-read detail (the badge stays Projection-driven). */
			    const runCompatRead = () => {
			        if (compatReading)
			            return;
			        setCompatReading(true);
			        void governance.compatibilityGet(compatibilityGetParams(teamSessionId))
			            .then(response => {
			            if (!response.ok) {
			                setCompatRead({ ok: false, message: `${response.error.code}: ${response.error.message}` });
			                return;
			            }
			            try {
			                setCompatRead({ ok: true, state: parseCompatibilityStateValue(response.value.data) });
			            }
			            catch (error) {
			                setCompatRead({ ok: false, message: throwableMessage(error) });
			            }
			        })
			            .catch(error => {
			            setCompatRead({ ok: false, message: throwableMessage(error) });
			        })
			            .finally(() => {
			            setCompatReading(false);
			        });
			    };
			    /** `policyState.get`: the cell view; the editor drafts initialize from it. */
			    const runPolicyRead = () => {
			        if (policyReading)
			            return;
			        setPolicyReading(true);
			        void governance.policyStateGet(policyStateGetParams(teamSessionId))
			            .then(response => {
			            if (!response.ok) {
			                setPolicyRead({ ok: false, message: `${response.error.code}: ${response.error.message}` });
			                return;
			            }
			            try {
			                const view = parsePolicyStateValue(response.value.data);
			                const drafts = { ...policyCells };
			                for (const cell of view.cells) {
			                    drafts[cell.capability] = cellToDraft(cell);
			                }
			                setPolicyCells(drafts);
			                setPolicyRead({ ok: true, view });
			            }
			            catch (error) {
			                setPolicyRead({ ok: false, message: throwableMessage(error) });
			            }
			        })
			            .catch(error => {
			            setPolicyRead({ ok: false, message: throwableMessage(error) });
			        })
			            .finally(() => {
			            setPolicyReading(false);
			        });
			    };
			    /** `override.get` for one member/capability (the current override layer). */
			    const runOverrideRead = (instanceId, capability) => {
			        const key = `${instanceId}:${capability}`;
			        if (overrideReads[key] !== undefined)
			            return;
			        setOverrideReads(prev => ({ ...prev, [key]: { ok: false, message: t('governance.override.reading') } }));
			        void governance.overrideGet(overrideGetParams(teamSessionId, capability, 'instance', instanceId))
			            .then(response => {
			            if (!response.ok) {
			                setOverrideReads(prev => ({ ...prev, [key]: { ok: false, message: `${response.error.code}: ${response.error.message}` } }));
			                return;
			            }
			            try {
			                setOverrideReads(prev => ({ ...prev, [key]: { ok: true, wire: parseOverrideValue(response.value.data) } }));
			            }
			            catch (error) {
			                setOverrideReads(prev => ({ ...prev, [key]: { ok: false, message: throwableMessage(error) } }));
			            }
			        })
			            .catch(error => {
			            setOverrideReads(prev => ({ ...prev, [key]: { ok: false, message: throwableMessage(error) } }));
			        });
			    };
			    // -- the commands (the G5 dispatch) ---------------------------------------
			    /** The human Recheck (UI §10.4): a new probe generation; the closed
			     * frozen trigger is `CAPABILITY_GENERATION_CHANGE`. */
			    const runRecheck = () => {
			        const token = nextToken();
			        dispatch('recheck', 'compat-recheck', token, () => governance.compatibilityReprobe(compatibilityReprobeParams(teamSessionId, HUMAN_RECHECK_TRIGGER)));
			    };
			    /** The policy-state commit: the current stateId (from the PROJECTION —
			     * never invented locally) + the edited cell map (partial maps are
			     * wire-legal; only the capabilities the editor touched are sent). */
			    const runPolicyCommit = () => {
			        const cells = {};
			        for (const capability of REMOTE_CAPABILITY_VALUES) {
			            const draft = policyCells[capability];
			            if (draft === undefined || draft.kind === 'none')
			                continue;
			            const items = parseItemsField(draft.items);
			            if (draft.kind === 'deny') {
			                cells[capability] = { value: { kind: 'deny' } };
			            }
			            else if (items.length > 0) {
			                cells[capability] = { value: { kind: 'allow', items } };
			            }
			        }
			        if (Object.keys(cells).length === 0)
			            return;
			        const token = nextToken();
			        dispatch('policy-set', 'policy-set', token, () => governance.policyStateSet(policyStateSetParams(teamSessionId, snapshot.policyState, cells)));
			    };
			    /** The per-member override set (scope `instance`, targeting the member). */
			    const runOverrideSet = (instance, instanceId) => {
			        const draft = overrideDrafts[instanceId] ?? { capability: 'model', kind: 'allow', items: '' };
			        const items = parseItemsField(draft.items);
			        if (draft.kind === 'allow' && items.length === 0)
			            return;
			        const value = draft.kind === 'deny'
			            ? { kind: 'deny' }
			            : { kind: 'allow', items };
			        const token = nextToken();
			        dispatch('override-set', `override-set:${instanceId}`, token, () => governance.overrideSet(overrideSetParams(teamSessionId, draft.capability, value, 'instance', instanceId)));
			    };
			    /** The per-member override reset (the value is recomputed from the lower layers). */
			    const runOverrideReset = (instanceId, capability) => {
			        const token = nextToken();
			        dispatch('override-reset', `override-reset:${instanceId}`, token, () => governance.overrideReset(overrideResetParams(teamSessionId, capability, 'instance', instanceId)));
			    };
			    // -- the derived display values -------------------------------------------
			    const compat = snapshot.compatibility;
			    const badge = compatibilityBadge(compat.status);
			    const policyLabel = policyStateLabel(snapshot.policyState);
			    const badgeKey = badge === null
			        ? null
			        : badge.mark === 'pass'
			            ? 'governance.compatibility.badge.pass'
			            : badge.mark === 'fatal'
			                ? 'governance.compatibility.badge.fatal'
			                : badge.state === 'DEGRADED_ACKNOWLEDGED'
			                    ? 'governance.compatibility.badge.degraded'
			                    : 'governance.compatibility.badge.actionRequired';
			    const recheckPending = pending['compat-recheck'] !== undefined;
			    const policyPending = pending['policy-set'] !== undefined;
			    const recheckError = errors['compat-recheck'];
			    const policyError = errors['policy-set'];
			    const commitPreview = useMemo(() => {
			        const parts = [];
			        for (const capability of REMOTE_CAPABILITY_VALUES) {
			            const draft = policyCells[capability];
			            if (draft === undefined || draft.kind === 'none')
			                continue;
			            const items = parseItemsField(draft.items);
			            if (draft.kind === 'deny')
			                parts.push(`${capability} → deny`);
			            else if (items.length > 0)
			                parts.push(`${capability} → allow [${items.join(', ')}]`);
			        }
			        return parts;
			    }, [policyCells]);
			    const setPolicyCell = (capability, patch) => {
			        setPolicyCells(prev => ({
			            ...prev,
			            [capability]: {
			                kind: 'none',
			                items: '',
			                ...prev[capability],
			                ...patch,
			            },
			        }));
			    };
			    const setOverrideDraft = (instanceId, patch) => {
			        setOverrideDrafts(prev => ({
			            ...prev,
			            [instanceId]: {
			                capability: 'model',
			                kind: 'allow',
			                items: '',
			                ...prev[instanceId],
			                ...patch,
			            },
			        }));
			    };
			    return (_jsxs("div", { className: styles.section, "data-governance": true, children: [_jsxs("div", { className: styles.card, "data-governance-compat": true, children: [_jsxs("div", { className: styles.cardHead, children: [_jsx("span", { className: styles.cardTitle, children: t('governance.compatibility') }), badge !== null && badgeKey !== null ? (_jsx("span", { className: styles.badge, "data-governance-compat-badge": true, "data-governance-compat-mark": badge.mark, children: t(badgeKey) })) : (_jsx("span", { className: styles.badgeUnknown, "data-governance-compat-badge": true, children: compat.status }))] }), _jsxs("div", { className: styles.counts, "data-governance-compat-counts": true, children: [t('governance.compatibility.counts', {
			                                warning: compat.warningCount,
			                                fatal: compat.fatalCount,
			                                acknowledged: compat.acknowledgedWarningCount,
			                            }), _jsx("span", { className: styles.meta, "data-governance-compat-generation": true, children: t('governance.compatibility.generation', { generation: compat.probeGeneration }) }), compat.lastProbedAt !== undefined && (_jsx("span", { className: styles.meta, children: t('governance.compatibility.probed', { at: compat.lastProbedAt }) }))] }), compatRead !== undefined && compatRead.ok && (_jsxs("div", { className: styles.freshRead, "data-governance-compat-read": true, children: [_jsx("p", { className: styles.freshReadTitle, children: t('governance.compatibility.freshRead') }), _jsxs("p", { children: [compatRead.state.status, " \u00B7 ", t('governance.compatibility.generation', { generation: compatRead.state.generation }), " \u00B7 ", compatRead.state.environmentFingerprint, " \u00B7 ", compatRead.state.recordedAt] }), _jsx("p", { children: t('governance.compatibility.readCounts', {
			                                    pass: compatRead.state.pass,
			                                    warning: compatRead.state.warning,
			                                    fatal: compatRead.state.fatal,
			                                    unacked: compatRead.state.unackedWarning,
			                                    stale: compatRead.state.staleAcknowledgement,
			                                }) })] })), compatRead !== undefined && !compatRead.ok && (_jsx("p", { className: styles.noteError, "data-governance-compat-read-error": true, children: t('governance.error', { message: compatRead.message }) })), recheckError !== undefined && (_jsx("p", { className: styles.noteError, "data-governance-recheck-error": true, children: t('governance.error', {
			                            message: `${recheckError.code}: ${recheckError.message}${recheckError.requestToken !== null ? ` [${recheckError.requestToken}]` : ''}`,
			                        }) })), _jsxs("div", { className: styles.actions, children: [_jsx("button", { type: "button", className: styles.secondary, "data-governance-compat-review": true, disabled: compatReading, onClick: runCompatRead, children: compatReading ? t('governance.reading') : t('governance.compatibility.review') }), _jsx("button", { type: "button", className: styles.secondary, "data-governance-recheck": true, disabled: recheckPending, onClick: runRecheck, children: recheckPending ? t('governance.pending') : t('governance.compatibility.recheck') }), _jsx("button", { type: "button", className: styles.secondary, "data-governance-ack": true, disabled: true, title: t('governance.compatibility.ackDisabled'), children: t('governance.compatibility.ack') })] }), _jsx("p", { className: styles.help, children: t('governance.compatibility.recheckHelp') })] }), _jsxs("div", { className: styles.card, "data-governance-policy": true, children: [_jsx("span", { className: styles.cardTitle, "data-governance-policy-label": true, children: t('governance.policy.header', { state: policyLabel }) }), _jsx("p", { className: styles.help, children: t('governance.policy.help') }), policyError !== undefined && (_jsx("p", { className: styles.noteError, "data-governance-policy-error": true, children: t('governance.error', {
			                            message: `${policyError.code}: ${policyError.message}${policyError.requestToken !== null ? ` [${policyError.requestToken}]` : ''}`,
			                        }) })), _jsxs("div", { className: styles.actions, children: [_jsx("button", { type: "button", className: styles.secondary, "data-governance-policy-review": true, disabled: policyReading, onClick: runPolicyRead, children: policyReading ? t('governance.reading') : t('governance.policy.review') }), _jsx("button", { type: "button", className: styles.primary, "data-governance-policy-commit": true, disabled: policyPending || commitPreview.length === 0, onClick: runPolicyCommit, children: policyPending ? t('governance.pending') : t('governance.policy.commit') })] }), policyRead !== undefined && policyRead.ok && (_jsx("div", { className: styles.cells, "data-governance-policy-cells": true, children: policyRead.view.cells.map(cell => (_jsxs("div", { className: styles.cell, "data-governance-policy-cell": cell.capability, children: [_jsxs("span", { className: styles.cellName, children: [cell.capability, cell.locked && _jsxs("span", { className: styles.cellLocked, children: [" ", t('governance.policy.cell.locked')] })] }), _jsx("span", { className: styles.cellCurrent, children: cell.entry === null
			                                        ? t('governance.policy.entry.none')
			                                        : cell.entry.kind === 'deny'
			                                            ? t('governance.policy.entry.deny')
			                                            : `${t('governance.policy.entry.allow')} [${cell.entry.items.join(', ')}]` }), cell.locked ? null : (_jsxs("div", { className: styles.cellEditor, children: [_jsxs("select", { className: styles.select, "data-governance-policy-cell-kind": true, value: policyCells[cell.capability]?.kind ?? 'none', onChange: event => setPolicyCell(cell.capability, { kind: event.target.value, items: event.target.value === 'deny' || event.target.value === 'none' ? '' : (policyCells[cell.capability]?.items ?? '') }), children: [_jsx("option", { value: "none", children: t('governance.policy.entry.none') }), _jsx("option", { value: "allow", children: t('governance.policy.entry.allow') }), _jsx("option", { value: "deny", children: t('governance.policy.entry.deny') })] }), policyCells[cell.capability]?.kind === 'allow' && (_jsx("input", { className: styles.input, type: "text", "data-governance-policy-cell-items": true, value: policyCells[cell.capability]?.items ?? '', placeholder: t('governance.policy.items'), onChange: event => setPolicyCell(cell.capability, { items: event.target.value }) }))] }))] }, cell.capability))) })), policyRead !== undefined && !policyRead.ok && (_jsx("p", { className: styles.noteError, "data-governance-policy-read-error": true, children: t('governance.error', { message: policyRead.message }) })), commitPreview.length > 0 && (_jsx("p", { className: styles.preview, "data-governance-policy-preview": true, children: t('governance.policy.preview', { capabilities: commitPreview.join(' · ') }) }))] }), _jsxs("div", { className: styles.card, "data-governance-effective-config": true, children: [_jsx("span", { className: styles.cardTitle, children: t('governance.effectiveConfig') }), snapshot.members.filter(member => member.effectiveConfig !== undefined).length === 0 && (_jsx("p", { className: styles.help, children: t('governance.effectiveConfig.empty') })), snapshot.members.map(member => {
			                        const dto = member.effectiveConfig;
			                        if (dto === undefined)
			                            return null;
			                        const rows = effectiveConfigLanes(dto);
			                        const draft = overrideDrafts[member.instanceId];
			                        const setPendingMark = pending[`override-set:${member.instanceId}`] !== undefined;
			                        const resetPendingMark = pending[`override-reset:${member.instanceId}`] !== undefined;
			                        const setError = errors[`override-set:${member.instanceId}`];
			                        const resetError = errors[`override-reset:${member.instanceId}`];
			                        const readKey = `${member.instanceId}:${draft?.capability ?? 'model'}`;
			                        const overrideRead = overrideReads[readKey];
			                        return (_jsxs("div", { className: styles.memberBlock, "data-governance-member": member.instanceId, children: [_jsx("span", { className: styles.memberName, children: member.label }), _jsx("div", { className: styles.lanes, "data-governance-lanes": true, children: rows.map(row => {
			                                        const hard = hardPolicyDisplay(row);
			                                        return (_jsxs("div", { className: styles.lane, "data-governance-lane": row.lane, children: [_jsx("span", { className: styles.laneName, children: row.lane }), _jsx("span", { className: styles.laneValue, children: row.value ?? '—' }), _jsx("span", { className: styles.laneSource, children: row.source }), _jsx("span", { className: styles.laneState, "data-governance-lane-state": row.state, children: row.stateWord }), row.suppressed === true && _jsx("span", { className: styles.laneFlag, children: t('governance.lane.suppressed') }), row.unavailable === true && _jsx("span", { className: styles.laneFlag, children: t('governance.lane.unavailable') }), row.effectiveFrom !== null && (_jsx("span", { className: styles.laneFlag, children: t('governance.lane.effectiveFrom', { step: row.effectiveFrom }) })), hard !== null && (_jsx("span", { className: styles.hardPolicy, "data-governance-hard-policy": true, children: t('governance.hardPolicy', {
			                                                        requested: hard.requested,
			                                                        effective: hard.effective,
			                                                        reason: hard.reason,
			                                                    }) }))] }, row.lane));
			                                    }) }), _jsxs("div", { className: styles.override, "data-governance-override": true, children: [_jsxs("div", { className: styles.overrideEditor, children: [_jsx("select", { className: styles.select, "data-governance-override-capability": true, value: draft?.capability ?? 'model', onChange: event => setOverrideDraft(member.instanceId, { capability: event.target.value }), children: REMOTE_CAPABILITY_VALUES.map(capability => (_jsx("option", { value: capability, children: capability }, capability))) }), _jsxs("select", { className: styles.select, "data-governance-override-kind": true, value: draft?.kind ?? 'allow', onChange: event => setOverrideDraft(member.instanceId, { kind: event.target.value, items: event.target.value === 'allow' ? (draft?.items ?? '') : '' }), children: [_jsx("option", { value: "allow", children: t('governance.policy.entry.allow') }), _jsx("option", { value: "deny", children: t('governance.policy.entry.deny') })] }), draft?.kind === 'allow' && (_jsx("input", { className: styles.input, type: "text", "data-governance-override-items": true, value: draft?.items ?? '', placeholder: t('governance.policy.items'), onChange: event => setOverrideDraft(member.instanceId, { items: event.target.value }) })), _jsx("button", { type: "button", className: styles.secondary, "data-governance-override-show": true, onClick: () => {
			                                                        const capability = draft?.capability ?? 'model';
			                                                        runOverrideRead(member.instanceId, capability);
			                                                    }, children: t('governance.override.show') }), _jsx("button", { type: "button", className: styles.primary, "data-governance-override-set": true, disabled: setPendingMark || (draft?.kind === 'allow' && parseItemsField(draft?.items ?? '').length === 0), onClick: () => runOverrideSet(member, member.instanceId), children: setPendingMark ? t('governance.pending') : t('governance.override.set') }), _jsx("button", { type: "button", className: styles.secondary, "data-governance-override-reset": true, disabled: resetPendingMark, onClick: () => runOverrideReset(member.instanceId, draft?.capability ?? 'model'), children: resetPendingMark ? t('governance.pending') : t('governance.override.reset') })] }), overrideRead !== undefined && (_jsx("p", { className: overrideRead.ok ? styles.note : styles.noteError, "data-governance-override-read": true, children: overrideRead.ok
			                                                ? (overrideRead.wire.override === null
			                                                    ? t('governance.override.none')
			                                                    : `${overrideRead.wire.override['kind'] ?? ''} ${Array.isArray(overrideRead.wire.override['items']) ? `[${overrideRead.wire.override['items'].join(', ')}]` : ''}`.trim())
			                                                : t('governance.error', { message: overrideRead.message }) })), setError !== undefined && (_jsx("p", { className: styles.noteError, "data-governance-override-set-error": true, children: t('governance.error', {
			                                                message: `${setError.code}: ${setError.message}${setError.requestToken !== null ? ` [${setError.requestToken}]` : ''}`,
			                                            }) })), resetError !== undefined && (_jsx("p", { className: styles.noteError, "data-governance-override-reset-error": true, children: t('governance.error', {
			                                                message: `${resetError.code}: ${resetError.message}${resetError.requestToken !== null ? ` [${resetError.requestToken}]` : ''}`,
			                                            }) }))] })] }, member.instanceId));
			                    })] })] }));
			}
			/**
			 * Initialize one policy cell editor draft from the wire cell: a deny
			 * entry → `deny`; an allow entry → `allow` + the items joined; no entry
			 * → `none`. A locked cell keeps `none` (locked cells are not edited —
			 * they render with the locked marker only).
			 */
			function cellToDraft(cell) {
			    if (cell.locked)
			        return { kind: 'none', items: '' };
			    if (cell.entry === null)
			        return { kind: 'none', items: '' };
			    if (cell.entry.kind === 'deny')
			        return { kind: 'deny', items: '' };
			    return { kind: 'allow', items: cell.entry.items.join(', ') };
			}
			//# sourceMappingURL=TeamGovernance.js.map
			}, exports: {} };
		__mods["model/team-legacy.js"] = { done: false, fn: function (exports) {
			/**
			 * P9-T8 (S5-D) — pure model for the legacy Team inspection (plan P9-S5
			 * S5-D "legacy.inspect banner/zero-state"; UI doc §34; DevPlan §20.6
			 * degradation): the `legacy.inspect` wire value narrowing over the
			 * closed `LegacyTeamInspection` union (the P7-T7 reader's lossless-JSON
			 * mirror) and the banner/zero-state selection.
			 *
			 * Zero-state rule (plan §10.6 + UI §34):
			 * - `legacy-team` → the Team tab zero state is REPLACED by the
			 *   persistent read-only banner (UI §34.1 verbatim copy) plus the
			 *   decoded legacy summary (roster + scanned sessions) — NO Start-Team
			 *   entry (UI §34.3 forbidden executable list: no Resume Team / Restore
			 *   Member / Create Member / Change PolicyState / Edit Team override /
			 *   Continue legacy Team mutation / Upgrade in place).
			 * - `native-fallback` → the ordinary zero state (the inspection degraded
			 *   to native Chat/Trajectory data; the session is NOT a legacy team).
			 * - inspection failure → the ordinary zero state + ONE verbatim note.
			 *
			 * The inspection is READ-ONLY by construction (the legacy reader never
			 * writes); it is a read, not a command flow — no projection pull (G5(c)
			 * applies to command flows; the rendered durable state still comes from
			 * the Projection).
			 *
			 * Pure module: no React, no I/O. Erasable TS only.
			 * @module @dsh-agent-team/client/model/team-legacy
			 */
			function nullableString(raw) {
			    return typeof raw === 'string' ? raw : null;
			}
			function parseRosterRow(raw) {
			    const roleRaw = raw['role'];
			    return {
			        source: typeof raw['source'] === 'string' ? raw['source'] : '',
			        fileName: typeof raw['fileName'] === 'string' ? raw['fileName'] : '',
			        id: nullableString(raw['id']),
			        role: roleRaw === 'leader' || roleRaw === 'teammate' ? roleRaw : null,
			        name: nullableString(raw['name']),
			        description: nullableString(raw['description']),
			    };
			}
			function parseStringArray(raw) {
			    if (!Array.isArray(raw))
			        return [];
			    return raw.filter((entry) => typeof entry === 'string');
			}
			/**
			 * Parse the `legacy.inspect` success value (`{ inspection }` → the
			 * closed union, narrowed defensively by the `status` tag; malformed
			 * nested fields degrade to null/empty rather than failing the
			 * inspection — the reader is best-effort by contract).
			 */
			function parseLegacyInspection(value) {
			    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			        throw new Error('LEGACY_MALFORMED: value must be an object');
			    }
			    const record = value;
			    const rawInspection = record['inspection'];
			    if (typeof rawInspection !== 'object' ||
			        rawInspection === null ||
			        Array.isArray(rawInspection)) {
			        throw new Error('LEGACY_MALFORMED: inspection must be an object');
			    }
			    const inspection = rawInspection;
			    const status = inspection['status'];
			    if (status === 'legacy-team') {
			        const rawTeam = inspection['team'];
			        const team = typeof rawTeam === 'object' && rawTeam !== null && !Array.isArray(rawTeam)
			            ? rawTeam
			            : {};
			        const rawRoster = team['roster'];
			        const roster = [];
			        if (Array.isArray(rawRoster)) {
			            for (const row of rawRoster) {
			                if (typeof row === 'object' && row !== null && !Array.isArray(row)) {
			                    roster.push(parseRosterRow(row));
			                }
			            }
			        }
			        const rawWarnings = team['rosterWarnings'];
			        const rawSessions = team['sessions'];
			        const selectionRaw = team['leaderSelection'];
			        return {
			            status,
			            teamId: nullableString(team['teamId']),
			            leaderSessionId: nullableString(team['leaderSessionId']),
			            leaderSelection: selectionRaw === 'team-events' || selectionRaw === 'roster-only'
			                ? selectionRaw
			                : null,
			            roster,
			            rosterWarningCount: Array.isArray(rawWarnings) ? rawWarnings.length : 0,
			            sessionCount: Array.isArray(rawSessions) ? rawSessions.length : 0,
			            memberChildSessionIds: parseStringArray(team['memberChildSessionIds']),
			        };
			    }
			    if (status === 'native-fallback') {
			        const rawNative = inspection['native'];
			        return {
			            status,
			            reason: 'no-legacy-metadata',
			            degradedTo: 'native-chat-trajectory',
			            nativeSessionCount: Array.isArray(rawNative) ? rawNative.length : 0,
			        };
			    }
			    return { status: 'unknown', raw: inspection };
			}
			Object.defineProperty(exports, "parseLegacyInspection", { enumerable: true, get: () => parseLegacyInspection });
			/**
			 * Select the Team-tab zero-state kind for an inspection result:
			 * `legacy-team` replaces the ordinary zero state with the persistent
			 * read-only banner; `native-fallback` keeps the ordinary zero state;
			 * `unknown` (future status tag) keeps the ordinary zero state + note.
			 */
			function legacyZeroStateKind(inspection) {
			    switch (inspection.status) {
			        case 'legacy-team':
			            return 'legacy-team';
			        case 'native-fallback':
			            return 'ordinary';
			        default:
			            return 'unknown';
			    }
			}
			Object.defineProperty(exports, "legacyZeroStateKind", { enumerable: true, get: () => legacyZeroStateKind });
			//# sourceMappingURL=team-legacy.js.map
			}, exports: {} };
		__mods["state/team-ledger-store.js"] = { done: false, fn: function (exports) {
			const __imp54 = __req("../../remote/src/index.js");
			const createLedgerPageTracker = __imp54.createLedgerPageTracker;
			/**
			 * P9-T4 (S2-C) — the cursor-safe durable-ledger store.
			 *
			 * REIMPLEMENT orchestration per plan §6.4; the cursor-validity algorithm
			 * is REUSED, never reimplemented: every page passes through the frozen
			 * `createLedgerPageTracker().applyPage`, which applies the frozen
			 * `verifyLedgerPageAnchor` shape rule (total non-regression, anchor
			 * ordering, strict ascending, limit bound, cursor consistency) ON TOP
			 * of the correlation guard (a page answering an older anchor is
			 * `anchor-mismatch`-rejected before any shape check). The store
			 * implements NO cursor-validity logic of its own (plan §6.4: 禁止自己
			 * 再实现 cursor validity; gate G2).
			 *
			 * Correctness-first forward paging (plan §6.4, frozen D-5 `sequence >
			 * afterSequence` cursor — there is NO reverse-paging backend API):
			 *   1. one tracker per team binding (recreated on a team switch — a new
			 *      authority episode; a mid-episode tracker recreation would drop
			 *      the `total` monotonicity guard, so the SAME tracker serves the
			 *      whole episode);
			 *   2. page-by-page merge with sequence dedupe (the map key IS the
			 *      dedupe; re-reading an anchor re-yields the same page, frozen
			 *      slicer stability);
			 *   3. the tracker validates every page — a rejected page NEVER merges
			 *      and publishes the typed `LedgerPageReject` reason;
			 *   4. the store keeps catching up until the frozen slicer reports the
			 *      tail (a page without a cursor); the UI-side window ("Load
			 *      earlier") is client-visible state, never ledger authority;
			 *   5. `completeThrough` is the HIGHEST LOADED sequence (the tracker's
			 *      anchor advances only on cursor pages, so the store tracks the
			 *      frontier itself); completeness = `total !== null &&
			 *      completeThrough >= total` — a partial ledger is never presented
			 *      as complete;
			 *   6. a new event appends: `refresh()` re-pulls at the tracker's
			 *      current anchor (the frozen stable re-read), and the dedupe merge
			 *      keeps the loaded window un-reordered.
			 *
			 * Failure discipline: an RPC-level typed error is stored as `error`
			 * (the frozen `RemoteErrorResult`, intact — never exception-ified,
			 * never re-wrapped); a transport-level rejection (the frozen
			 * `PushTransportLossError` is the only kind the seam carrier rejects
			 * with) is stored as the closed `transport-loss` page-reject reason. A
			 * rejected page stores its frozen `reason`. The catch-up episode ends
			 * on any failure; nothing auto-retries (the pull is on-demand: `open` /
			 * `refresh`).
			 *
			 * The store is React-free (data-object layer): a bare observable source
			 * — stable snapshot between changes, `subscribe` — plus the pull
			 * actions. One page pull at a time (single-flight); a team switch while
			 * a pull is in flight binds immediately and the stale-team response is
			 * dropped by the team guard (never merged).
			 *
			 * Pure module: no React, no node: builtins, no I/O. Erasable TS only.
			 * @module @dsh-agent-team/client/state/team-ledger-store
			 */
			/** The frozen default page size. */
			const DEFAULT_LEDGER_PAGE_LIMIT = 50;
			/**
			 * Create one ledger store bound to one ledger page pull.
			 * @param options - the injected frozen page pull + CLIENT_LOCAL page size.
			 * @returns the store (a bare observable source + actions).
			 */
			function createTeamLedgerStore(options) {
			    const limit = options.limit === undefined ? DEFAULT_LEDGER_PAGE_LIMIT : options.limit;
			    let tracker = createLedgerPageTracker(0);
			    const entriesBySequence = new Map();
			    let state = {
			        teamSessionId: null,
			        entriesBySequence,
			        orderedSequences: [],
			        total: null,
			        completeThrough: 0,
			        loading: false,
			    };
			    const listeners = new Set();
			    let inFlight = false;
			    let pendingStart = false;
			    let settleResolvers = [];
			    const publish = (next) => {
			        state = next;
			        for (const listener of [...listeners])
			            listener();
			    };
			    const orderedSnapshot = () => [...entriesBySequence.keys()].sort((a, b) => a - b);
			    const notifySettled = () => {
			        const resolvers = settleResolvers;
			        settleResolvers = [];
			        for (const resolve of resolvers)
			            resolve();
			    };
			    /** Settled when no catch-up episode is in flight (or one becomes idle). */
			    const nextSettled = () => {
			        if (inFlight === false && pendingStart === false)
			            return Promise.resolve();
			        return new Promise(resolve => {
			            settleResolvers.push(resolve);
			        });
			    };
			    /**
			     * The catch-up loop: fetch page at the tracker's anchor, gate it
			     * through the frozen tracker, merge on accept, continue while the
			     * frozen slicer reports a cursor. Ends on: the tail (no cursor), a
			     * tracker rejection, an RPC error, a transport loss, or a stale team.
			     */
			    const runCatchUp = async () => {
			        inFlight = true;
			        try {
			            while (true) {
			                const team = state.teamSessionId;
			                if (team === null)
			                    return;
			                const anchor = tracker.state().anchor;
			                const request = { afterSequence: anchor, limit };
			                if (state.loading === false)
			                    publish({ ...state, loading: true });
			                let response;
			                try {
			                    response = await options.getLedgerPage(team, anchor, limit);
			                }
			                catch {
			                    // Transport-level rejection (frozen: PushTransportLossError is
			                    // the only kind the seam carrier rejects with).
			                    if (state.teamSessionId === team) {
			                        publish({ ...state, loading: false, error: { ok: false, reason: 'transport-loss' } });
			                    }
			                    return;
			                }
			                // Team guard: a stale-team response is dropped, never merged.
			                if (state.teamSessionId !== team)
			                    return;
			                if (response.ok === false) {
			                    // Typed RPC error: stored intact (never exception-ified).
			                    publish({ ...state, loading: false, error: response });
			                    return;
			                }
			                // The ONE documented boundary narrowing of a page value: the seam
			                // data is `RemoteSafeJsonValue` (structurally no overlap with the
			                // page shape, hence the two-step lift); at the wire it is the
			                // frozen `RemoteLedgerPageValue` (lossless-JSON checked). Same
			                // pattern as `projectionFromWire` (see the P9-T4 evidence note).
			                const page = response.value.data;
			                const check = tracker.applyPage(request, page);
			                if (check.ok === false) {
			                    // Frozen gate: a rejected page never merges (G2 hard invariant).
			                    publish({ ...state, loading: false, error: { ok: false, reason: check.reason } });
			                    return;
			                }
			                // Merge with sequence dedupe (the map key IS the dedupe).
			                let frontier = state.completeThrough;
			                for (const entry of page.entries) {
			                    entriesBySequence.set(entry.sequence, entry);
			                    if (entry.sequence > frontier)
			                        frontier = entry.sequence;
			                }
			                const total = check.total;
			                const nextComplete = total !== null && frontier >= total;
			                const tailReached = page.nextAfterSequence === null;
			                // `loading` mirrors the loop: true only while another page will be
			                // fetched, so every episode exit publishes loading: false.
			                const continuePaging = tailReached === false && nextComplete === false;
			                publish({
			                    ...state,
			                    loading: continuePaging,
			                    error: undefined,
			                    total,
			                    completeThrough: frontier,
			                    entriesBySequence,
			                    orderedSequences: orderedSnapshot(),
			                });
			                // The frozen slicer sets the cursor only while more entries
			                // remain: the tail ends the catch-up episode (the completeness
			                // verdict stands on the numbers, a total/frontier mismatch is
			                // reported by the `partial` marker, never by a fetch loop).
			                if (continuePaging === false)
			                    return;
			            }
			        }
			        finally {
			            inFlight = false;
			            const wantsMore = pendingStart;
			            pendingStart = false;
			            if (wantsMore && state.teamSessionId !== null) {
			                void runCatchUp();
			            }
			            else {
			                notifySettled();
			            }
			        }
			    };
			    /** Single-flight request for a catch-up episode (queue one restart). */
			    const requestCatchUp = () => {
			        if (inFlight) {
			            pendingStart = true;
			            return;
			        }
			        void runCatchUp();
			    };
			    const open = (teamSessionId) => {
			        if (state.teamSessionId !== teamSessionId) {
			            // A new authority episode: a fresh tracker (anchor 0), no entries.
			            tracker = createLedgerPageTracker(0);
			            entriesBySequence.clear();
			            publish({
			                teamSessionId,
			                entriesBySequence,
			                orderedSequences: [],
			                total: null,
			                completeThrough: 0,
			                loading: false,
			                error: undefined,
			            });
			        }
			        requestCatchUp();
			        return nextSettled();
			    };
			    const refresh = () => {
			        if (state.teamSessionId === null)
			            return Promise.resolve();
			        requestCatchUp();
			        return nextSettled();
			    };
			    const reset = () => {
			        tracker = createLedgerPageTracker(0);
			        entriesBySequence.clear();
			        publish({
			            teamSessionId: null,
			            entriesBySequence,
			            orderedSequences: [],
			            total: null,
			            completeThrough: 0,
			            loading: false,
			            error: undefined,
			        });
			    };
			    const getState = () => state;
			    const subscribe = (listener) => {
			        listeners.add(listener);
			        return () => {
			            listeners.delete(listener);
			        };
			    };
			    return { getState, subscribe, open, refresh, reset };
			}
			//# sourceMappingURL=team-ledger-store.js.map
			}, exports: {} };
		__mods["state/team-projection-store.js"] = { done: false, fn: function (exports) {
			const __imp43 = __req("../../remote/src/index.js");
			const assessProjectionSync = __imp43.assessProjectionSync;
			const backoffCapMs = __imp43.backoffCapMs;
			const extractPushFrame = __imp43.extractPushFrame;
			const isApplyAssessment = __imp43.isApplyAssessment;
			const isStateChange = __imp43.isStateChange;
			const pickBackoffDelayMs = __imp43.pickBackoffDelayMs;
			const stateOnConnect = __imp43.stateOnConnect;
			const stateOnLoss = __imp43.stateOnLoss;
			/**
			 * P9-T3 (S2-B) — the generation-safe Team projection store.
			 *
			 * REIMPLEMENT orchestration per plan §6.2; the verdict algorithm is
			 * REUSED, never reimplemented: every incoming response is assessed by
			 * the frozen `assessProjectionSync` (which lifts `decideFrameVerdict`
			 * onto the response) and a frame is written to the store ONLY when the
			 * assessment is `apply` — the hard invariant: no response may write to
			 * the store before the generation check. A delayed, duplicated,
			 * out-of-order, foreign, or provenance-mismatched response can never
			 * overwrite newer state (gate G2).
			 *
			 * The store is React-free (data-object layer per the web client
			 * stack rules): a bare observable source — stable snapshot between
			 * changes, `subscribe`/`getSnapshot` — plus pull/transport actions.
			 * The browser binding (framework `useStore` seat or a hook composed at
			 * the T9 mount site) is deliberately NOT owned here.
			 *
			 * Reconnect policy (Seam 5: no push channel exists, so sync is
			 * invalidation + pull): a transport loss or a rejected pull enters
			 * `reconnecting` and schedules ONE retry through the frozen backoff
			 * helpers (`backoffCapMs` + `pickBackoffDelayMs`, deterministic lower
			 * bound by default); `markConnectionRestored` fires the invalidation
			 * pull. The internal channel state (`connected` / `reconnecting`, the
			 * frozen `ReconnectState`) deduplicates loss reports (frozen
			 * `stateOnLoss` / `stateOnConnect` / `isStateChange`): a loss report
			 * after a successful round trip is stale and ignored, a loss report
			 * while a retry is already pending does not double-schedule, and every
			 * successful round trip cancels the pending retry. The backoff
			 * tunables and the scheduler are CLIENT_LOCAL transport policy — never
			 * authority: authority always comes from the next fresh
			 * `team.getProjection` response. No native timer is assumed by the
			 * store logic (the default scheduler may use `setTimeout`; tests
			 * inject a manual scheduler).
			 *
			 * Failure discipline: a typed RPC error is stored as `lastError` (the
			 * frozen `RemoteErrorResult`, never exception-ified); only a
			 * transport-level rejection (`PushTransportLossError` class) drives
			 * the reconnect path.
			 *
			 * Pure module: no React, no I/O. Erasable TS only.
			 * @module @dsh-agent-team/client/state/team-projection-store
			 */
			/**
			 * The CLIENT_LOCAL default backoff (transport policy, never authority):
			 * 1s base, ×2 per attempt, capped at 30s (frozen formula, local
			 * tunables — plan Trap B: no backend push, the client owns the retry).
			 */
			const DEFAULT_TEAM_PROJECTION_BACKOFF = {
			    baseMs: 1000,
			    factor: 2,
			    maxMs: 30000,
			};
			Object.defineProperty(exports, "DEFAULT_TEAM_PROJECTION_BACKOFF", { enumerable: true, get: () => DEFAULT_TEAM_PROJECTION_BACKOFF });
			/**
			 * Create one projection store bound to one projection pull.
			 * @param options - injected pull + CLIENT_LOCAL transport policy.
			 * @returns the store (a bare observable source + actions).
			 */
			function createTeamProjectionStore(options) {
			    const backoff = options.backoff === undefined ? DEFAULT_TEAM_PROJECTION_BACKOFF : options.backoff;
			    const scheduler = options.scheduler === undefined ? createDefaultScheduler() : options.scheduler;
			    let state = {
			        status: 'idle',
			        teamSessionId: null,
			        appliedGeneration: null,
			        frame: null,
			        lastAssessment: null,
			        retryAttempt: 0,
			        nextRetryDelayMs: null,
			    };
			    const listeners = new Set();
			    let pendingRetry = null;
			    let channel = null;
			    const publish = (next) => {
			        state = next;
			        for (const listener of [...listeners])
			            listener();
			    };
			    const cancelPendingRetry = () => {
			        if (pendingRetry === null)
			            return;
			        scheduler.cancel(pendingRetry);
			        pendingRetry = null;
			    };
			    const appliedIdentity = () => state.frame === null || state.teamSessionId === null
			        ? null
			        : { teamSessionId: state.teamSessionId, generation: state.appliedGeneration };
			    /**
			     * Schedule the backoff retry (one pending at a time) and publish the
			     * `reconnecting` snapshot.
			     * @param base - the snapshot to advance (session already bound).
			     */
			    const scheduleRetry = (base) => {
			        const attempt = base.retryAttempt + 1;
			        const capMs = backoffCapMs(attempt, backoff);
			        const delayMs = pickBackoffDelayMs(capMs);
			        cancelPendingRetry();
			        const session = base.teamSessionId;
			        pendingRetry = scheduler.schedule(delayMs, () => {
			            pendingRetry = null;
			            if (session !== null)
			                void pull(session);
			        });
			        const nextChannel = stateOnLoss(channel);
			        if (isStateChange(channel, nextChannel))
			            channel = nextChannel;
			        publish({
			            ...base,
			            status: 'reconnecting',
			            lastAssessment: { status: 'transport-loss', receivedGeneration: null },
			            retryAttempt: attempt,
			            nextRetryDelayMs: delayMs,
			        });
			    };
			    /** A completed round trip: channel restored, pending retry useless. */
			    const noteRoundTrip = () => {
			        cancelPendingRetry();
			        const nextChannel = stateOnConnect();
			        if (isStateChange(channel, nextChannel))
			            channel = nextChannel;
			    };
			    const pull = async (teamSessionId) => {
			        cancelPendingRetry();
			        // First data for this session: the surface shows loading. A
			        // background refresh keeps its current status until the outcome.
			        // The just-cancelled retry no longer exists: no pending delay.
			        publish({
			            ...state,
			            teamSessionId,
			            status: state.frame === null && state.status !== 'ready' ? 'loading' : state.status,
			            nextRetryDelayMs: null,
			        });
			        let response;
			        try {
			            response = await options.getProjection(teamSessionId);
			        }
			        catch {
			            // Transport-level rejection (frozen: PushTransportLossError is
			            // the only kind the seam carrier rejects with).
			            const assessment = {
			                status: 'transport-loss',
			                receivedGeneration: null,
			            };
			            if (channel === 'connected') {
			                // A later round trip succeeded: this loss report is stale.
			                return assessment;
			            }
			            if (pendingRetry !== null) {
			                // A loss was already recorded while this pull was in flight:
			                // the pending retry stands — no double schedule, no churn.
			                return assessment;
			            }
			            // First loss record, or the pending retry itself failed again:
			            // schedule the next backoff attempt (the episode continues).
			            scheduleRetry({ ...state, teamSessionId });
			            return assessment;
			        }
			        const assessment = assessProjectionSync(appliedIdentity(), response);
			        noteRoundTrip();
			        if (response.ok === false) {
			            // Typed RPC error: stored intact, never exception-ified.
			            publish({
			                ...state,
			                teamSessionId,
			                status: 'error',
			                lastError: response.error,
			                lastAssessment: assessment,
			                retryAttempt: 0,
			                nextRetryDelayMs: null,
			            });
			            return assessment;
			        }
			        if (isApplyAssessment(assessment)) {
			            const frame = extractPushFrame(response);
			            if (frame === null) {
			                // Unreachable by the frozen contract (apply ⟹ usable frame);
			                // treat it as the inconsistent class rather than a write.
			                publish({
			                    ...state,
			                    teamSessionId,
			                    status: 'error',
			                    lastAssessment: { status: 'inconsistent', receivedGeneration: null },
			                    retryAttempt: 0,
			                    nextRetryDelayMs: null,
			                });
			                return { status: 'inconsistent', receivedGeneration: null };
			            }
			            publish({
			                ...state,
			                teamSessionId,
			                status: 'ready',
			                appliedGeneration: assessment.receivedGeneration,
			                frame,
			                lastError: undefined,
			                lastAssessment: assessment,
			                retryAttempt: 0,
			                nextRetryDelayMs: null,
			            });
			            return assessment;
			        }
			        // Non-apply verdicts: the applied frame is never touched (G2 hard
			        // invariant). duplicate / stale are normal ordering events — an
			        // existing frame stays `ready`; foreign / inconsistent are source
			        // anomalies — surface `error` (the frame is kept, never discarded,
			        // but the stale data is not presented as current).
			        if (assessment.status === 'duplicate' || assessment.status === 'stale') {
			            publish({
			                ...state,
			                teamSessionId,
			                status: state.frame !== null ? 'ready' : 'error',
			                lastAssessment: assessment,
			                retryAttempt: 0,
			                nextRetryDelayMs: null,
			            });
			        }
			        else {
			            publish({
			                ...state,
			                teamSessionId,
			                status: 'error',
			                lastAssessment: assessment,
			                retryAttempt: 0,
			                nextRetryDelayMs: null,
			            });
			        }
			        return assessment;
			    };
			    const markConnectionLost = () => {
			        if (state.teamSessionId === null)
			            return;
			        if (channel === 'reconnecting')
			            return;
			        scheduleRetry({ ...state });
			    };
			    const markConnectionRestored = () => {
			        if (state.teamSessionId === null)
			            return;
			        cancelPendingRetry();
			        const nextChannel = stateOnConnect();
			        if (isStateChange(channel, nextChannel))
			            channel = nextChannel;
			        // Frozen P2-T6 / P8 semantics: a restored connection restarts the
			        // backoff episode (the attempt counter resets on connect — the P8
			        // test client's `markConnected`).
			        publish({ ...state, retryAttempt: 0, nextRetryDelayMs: null });
			        void pull(state.teamSessionId);
			    };
			    const reset = () => {
			        cancelPendingRetry();
			        channel = null;
			        publish({
			            status: 'idle',
			            teamSessionId: null,
			            appliedGeneration: null,
			            frame: null,
			            lastAssessment: null,
			            retryAttempt: 0,
			            nextRetryDelayMs: null,
			        });
			    };
			    return {
			        getState: () => state,
			        subscribe(listener) {
			            listeners.add(listener);
			            return () => {
			                listeners.delete(listener);
			            };
			        },
			        pull,
			        markConnectionLost,
			        markConnectionRestored,
			        reset,
			    };
			}
			/**
			 * The default scheduler: setTimeout-backed (browser/node). Replaceable
			 * via options for deterministic tests.
			 */
			function createDefaultScheduler() {
			    const timers = new Map();
			    let nextHandle = 1;
			    return {
			        schedule(delayMs, task) {
			            const handle = nextHandle++;
			            const timer = setTimeout(task, delayMs);
			            timers.set(handle, timer);
			            return handle;
			        },
			        cancel(handle) {
			            const timer = timers.get(handle);
			            if (timer === undefined)
			                return;
			            timers.delete(handle);
			            clearTimeout(timer);
			        },
			    };
			}
			//# sourceMappingURL=team-projection-store.js.map
			}, exports: {} };
		__mods["transport/team-remote-client.js"] = { done: false, fn: function (exports) {
			const __imp29 = __req("../../remote/src/index.js");
			const REMOTE_CONTRACT_VERSION = __imp29.REMOTE_CONTRACT_VERSION;
			const REMOTE_RPC_CHANNEL = __imp29.REMOTE_RPC_CHANNEL;
			const PushTransportLossError = __imp29.PushTransportLossError;
			/**
			 * P9-T3 (S2-A) — the Team Remote client over the frozen public seam.
			 *
			 * REIMPLEMENT per plan §6.1 (the legacy TeamMirror transport is on the
			 * DROP list). This is the ONLY place in the client that assembles the
			 * frozen request envelope `{ version, params }` and that names the
			 * `/team-remote` channel: React components never hand-build the channel
			 * or the envelope, and no UI mapping happens here — the typed
			 * `RemoteResponse` (frozen `code` / `details` / `provenance` intact) is
			 * returned as-is, never exception-ified.
			 *
			 * Failure discipline (frozen `RemotePushTransport` contract, mirrored
			 * here for the unary path): every RPC-level outcome arrives as a typed
			 * `RemoteResponse`; the promise REJECTS only on transport-level
			 * channel loss (seam fetch/HTTP failure, malformed server-response
			 * envelope, correlation mismatch), reported as the frozen
			 * `PushTransportLossError` — the ONLY rejection kind.
			 *
			 * Forbidden edges (plan §6.1): no TeamDomain, no storage, no Session log
			 * scan, no private DSH server API — the only outbound edge is the
			 * public unary seam carrier (host-seams.ts, Seam 5).
			 *
			 * Cross-package import style follows the vNext repo convention
			 * (packages/runtime, packages/domain): relative source imports into
			 * `packages/remote/src` — no dist build in between.
			 *
			 * Pure module: no React, no node: builtins, no I/O. Erasable TS only.
			 * @module @dsh-agent-team/client/transport/team-remote-client
			 */
			/**
			 * Create the Team Remote client bound to one seam carrier.
			 * @param carrier - the public unary RPC carrier (Seam 5; structurally
			 *   `ClientConnectionRpc` of the served web app).
			 * @returns the client; all methods share the one carrier.
			 */
			function createTeamRemoteClient(carrier) {
			    const call = async (method, params) => {
			        // The single envelope-assembly boundary (plan §6.1): the cast papers
			        // over nominal/readonly variance against the RemoteSafeRecord index
			        // signature only — the wire value is exactly the frozen fields and
			        // the host validates them per field.
			        const envelope = {
			            version: REMOTE_CONTRACT_VERSION,
			            params: params,
			        };
			        let result;
			        try {
			            result = await carrier.call(REMOTE_RPC_CHANNEL, method, envelope);
			        }
			        catch (error) {
			            // Transport-level loss: the ONLY rejection kind (frozen contract).
			            throw new PushTransportLossError(`team-remote transport: ${method} — ${error instanceof Error ? error.message : String(error)}`);
			        }
			        if (!isRemoteResponse(result)) {
			            // Envelope anomaly on the carrier (not a typed RPC outcome): the
			            // channel cannot be trusted for this round trip — same channel-loss
			            // class, never a silent value.
			            throw new PushTransportLossError(`team-remote transport: ${method} — malformed seam envelope`);
			        }
			        return result;
			    };
			    return {
			        call,
			        getProjection: (teamSessionId) => call('team.getProjection', { teamSessionId }),
			        getLedgerPage: (teamSessionId, afterSequence = 0, limit = 50) => call('team.getLedgerPage', { teamSessionId, afterSequence, limit }),
			        catalogList: () => call('catalog.list', {}),
			        catalogGet: (params) => call('catalog.get', params),
			        intentProbe: (params) => call('intent.probe', params),
			        teamCreate: (params) => call('team.create', params),
			        memberCreate: (params) => call('member.create', params),
			        memberSend: (params) => call('member.send', params),
			        memberFollowup: (params) => call('member.followup', params),
			        memberArchive: (params) => call('member.archive', params),
			        memberRestore: (params) => call('member.restore', params),
			        memberDispose: (params) => call('member.dispose', params),
			        overrideGet: (params) => call('override.get', params),
			        overrideSet: (params) => call('override.set', params),
			        overrideReset: (params) => call('override.reset', params),
			        policyStateGet: (params) => call('policyState.get', params),
			        policyStateSet: (params) => call('policyState.set', params),
			        compatibilityGet: (params) => call('compatibility.get', params),
			        compatibilityAck: (params) => call('compatibility.ack', params),
			        compatibilityReprobe: (params) => call('compatibility.reprobe', params),
			        handoffPrepare: (params) => call('handoff.prepare', params),
			        handoffCreate: (params) => call('handoff.create', params),
			        legacyInspect: (params) => call('legacy.inspect', params),
			    };
			}
			/**
			 * Defensive client-boundary re-check that one carrier result is
			 * structurally a frozen `RemoteResponse` (success: `value.data` +
			 * `value.provenance`; failure: typed `error.code/message/details`).
			 * The frozen dispatcher already validated the response before it
			 * existed; this mirrors the remote package's own boundary re-check
			 * (`readFrameShape`) against a corrupt carrier, not a re-validation of
			 * the DTO.
			 * @param result - one carrier result of a `/team-remote` call, typed
			 *   `unknown` because the carrier value is not type-trusted end-to-end:
			 *   this guard IS the validation, not a formality.
			 * @returns whether the result is a usable frozen `RemoteResponse`.
			 */
			function isRemoteResponse(result) {
			    if (typeof result !== 'object' || result === null)
			        return false;
			    const block = result;
			    if (block.ok === true) {
			        const value = block.value;
			        if (typeof value !== 'object' || value === null)
			            return false;
			        const valueRecord = value;
			        return ('data' in valueRecord &&
			            typeof valueRecord.provenance === 'object' &&
			            valueRecord.provenance !== null);
			    }
			    if (block.ok !== false)
			        return false;
			    const error = block.error;
			    if (typeof error !== 'object' || error === null)
			        return false;
			    const errorRecord = error;
			    return (typeof errorRecord.code === 'string' &&
			        typeof errorRecord.message === 'string' &&
			        typeof errorRecord.details === 'object' &&
			        errorRecord.details !== null);
			}
			//# sourceMappingURL=team-remote-client.js.map
			}, exports: {} };
		__mods["ui/locales.js"] = { done: false, fn: function (exports) {
			/** Team UI locale dictionaries. */
			/** Simplified Chinese UI strings for every {@link TeamKey}. */
			const zh = {
			    'nav': '团队',
			    'title': '团队成员配置',
			    'empty.title': '未配置团队成员',
			    'empty.description': '在以下目录创建 Markdown 定义文件以配置团队成员：',
			    'empty.step1': '全局：$DSH_HOME/teammates/*.md',
			    'empty.step2': '项目级：.dsh/teammates/*.md',
			    'empty.step3': '需要恰好一个 role: leader 的定义',
			    'member.leader': '领导者',
			    'member.teammate': '队员',
			    'field.model': '模型',
			    'field.tools': '工具',
			    'field.mcp': 'MCP 服务器',
			    'field.context': '上下文策略',
			    'view.team': '团队',
			    'view.zero': '当前会话未加入任何团队',
			    'view.timeline.title': '时间线',
			    'view.timeline.empty': '暂无委派记录',
			    'view.timeline.aria': '团队委派时间线：滚轮缩放，拖拽平移，方向键平移，按 0 复位',
			    'view.timeline.running': '进行中',
			    'view.members.title': '成员组',
			    'view.members.active': '{count} 活跃',
			    'view.members.created': '已创建',
			    'view.members.running': '运行中',
			    'view.members.settled': '已结算',
			    'view.members.archived': '已归档',
			    'view.members.disposed': '已处置',
			    'view.members.noInstances': '尚无实例',
			    'view.members.action.empty': '暂无动作',
			    'view.members.waiting': '{count} 项待裁决',
			    'view.activity.title': '活动与进度',
			    'view.activity.empty': '暂无活动进度',
			    'view.activity.member': '负责人 {member}',
			    'view.activity.in_progress': '进行中',
			    'view.activity.completed': '已完成',
			    'view.activity.blocked': '受阻',
			    'view.ledger.title': '团队事件',
			    'view.ledger.empty': '暂无团队事件',
			    'view.ledger.loading': '正在加载团队事件…',
			    'view.ledger.remaining': '还有 {count} 条事件未加载',
			    'view.ledger.retry': '重试',
			    'view.ledger.loadEarlier': '加载更早',
			    'view.ledger.loadFailed': '事件加载失败：{message}',
			    'view.ledger.pending': '等待裁决',
			    'view.ledger.filter.all': '全部',
			    'view.ledger.filter.team': '团队',
			    'view.ledger.filter.members': '成员',
			    'view.ledger.filter.lifecycle': '生命周期',
			    'view.ledger.filter.messages': '消息',
			    'view.ledger.filter.controls': '控制',
			    'view.ledger.filter.policy': '策略',
			    'view.ledger.filter.compatibility': '兼容',
			    'view.ledger.filter.progress': '进度',
			    'view.ledger.fact.work_admitted': '工作准入',
			    'view.ledger.fact.member_created': '成员创建',
			    'view.ledger.fact.lifecycle': '生命周期',
			    'view.ledger.fact.message': '消息',
			    'view.ledger.fact.control_request': '控制请求',
			    'view.ledger.fact.control_decision': '控制裁决',
			    'view.ledger.fact.control_consumed': '裁决消费',
			    'view.ledger.fact.progress': '进度',
			    'view.ledger.fact.interval_opened': '活动开始',
			    'view.ledger.fact.interval_closed': '活动结束',
			    'view.ledger.fact.policy': '策略变更',
			    'view.ledger.decision.allow': '允许',
			    'view.ledger.decision.deny': '拒绝',
			    'view.ledger.decision.stale_denied': '过期拒绝',
			    'intent.startHere': '从此处开始团队',
			    'intent.title': '新建团队',
			    'intent.blueprint': '团队蓝图',
			    'intent.blueprint.placeholder': '选择蓝图…',
			    'intent.blueprint.loading': '正在加载蓝图目录…',
			    'intent.blueprint.error': '蓝图目录加载失败：{message}',
			    'intent.blueprint.empty': '没有可用蓝图',
			    'intent.revision': '修订',
			    'intent.workspace': '默认工作区',
			    'intent.workspace.placeholder': '(未选择)',
			    'intent.preset': '运行时预设',
			    'intent.preset.hint': '选择团队运行的 Agent 预设；切换会重新运行兼容性检查。',
			    'intent.initialWork': '初始任务（可选）',
			    'intent.initialWork.placeholder': '交给 Leader 的初始任务…',
			    'intent.compatibility': '兼容性',
			    'intent.compatibility.checking': '正在检查兼容性…',
			    'intent.compatibility.ready': '✓ 就绪',
			    'intent.compatibility.degraded': '已按确认降级运行',
			    'intent.compatibility.fatal': '✕ 团队无法创建',
			    'intent.compatibility.unknown': '兼容性结果无法识别：{message}',
			    'intent.compatibility.owner': '需求',
			    'intent.compatibility.subjects': '不可用',
			    'intent.ack': '我已了解上述降级，继续创建',
			    'intent.create': '创建团队',
			    'intent.createAndSend': '创建并发送',
			    'intent.acknowledge': '确认警告并创建',
			    'intent.creating': '正在创建…',
			    'intent.error': '创建失败：{message}',
			    'intent.retry': '重试',
			    'intent.cancel': '取消',
			    'intent.rootKept': 'Root 会话已创建；团队创建失败，可重试（会话保留）。',
			    'intent.fatal.preset': '该运行时预设拥有完整的系统人格，无法承载此团队蓝图的 Leader/Member 身份（不改变 DSH 核心语义）。',
			    'member.action.sendWork': '发送任务…',
			    'member.action.followup': '发送跟进',
			    'member.action.resume': '恢复…',
			    'member.action.message': '发送消息…',
			    'member.action.archive': '归档',
			    'member.action.restore': '恢复',
			    'member.action.dispose': '处置',
			    'member.action.create': '创建成员实例',
			    'member.command.pending': '处理中…',
			    'member.command.error': '命令失败：{code} {message}',
			    'member.create.title': '创建成员实例',
			    'member.create.template': '模板',
			    'member.create.label': '标签',
			    'member.create.label.placeholder': '例如：研究员-1',
			    'member.create.group': '分组（可选）',
			    'member.create.workspace': '工作区（可选）',
			    'member.create.fresh': '新的委派会创建新实例。',
			    'member.create.submit': '创建',
			    'member.create.cancel': '取消',
			    'member.send.title': '向 {member} 发送任务',
			    'member.send.prompt': '任务内容',
			    'member.send.prompt.placeholder': '描述要交给该成员的工作…',
			    'member.send.submit': '发送',
			    'member.send.cancel': '取消',
			    'member.message.title': '给 {member} 发消息',
			    'member.message.subject': '主题（可选）',
			    'member.message.body': '消息内容',
			    'member.message.body.placeholder': '消息正文…',
			    'member.message.submit': '发送消息',
			    'member.message.cancel': '取消',
			    'member.archive.title': '归档该成员？',
			    'member.archive.running': '该成员正在运行。归档将停止当前工作，并在归档前排空其驻留子成员。',
			    'member.archive.plain': '归档后，该成员将不再接收新的团队任务，直到恢复。',
			    'member.archive.confirm': '归档',
			    'member.archive.cancel': '取消',
			    'member.dispose.title': '处置该成员？',
			    'member.dispose.body': '该成员无法再恢复或接收新的团队任务。其会话历史、Chat、Trajectory 与团队审计历史将保留。',
			    'member.dispose.confirm': '处置',
			    'member.dispose.cancel': '取消',
			    'dock.title': '团队',
			    'dock.running': '{count} 运行中',
			    'dock.pending': '{count} 待裁决',
			    'dock.jump': '打开团队标签页',
			    'dock.expand': '展开团队概览',
			    'dock.collapse': '收起团队概览',
			    'dock.members.empty': '暂无成员状态',
			    'dock.activities.empty': '暂无活动进度',
			    'marker.progress': '进度',
			    'marker.decision': '裁决',
			    'governance.compatibility': '兼容性',
			    'governance.title': '治理',
			    'governance.compatibility.badge.pass': '✓ 兼容',
			    'governance.compatibility.badge.degraded': '⚠ 降级',
			    'governance.compatibility.badge.actionRequired': '⚠ 需要处理',
			    'governance.compatibility.badge.fatal': '✕ 结构性错误',
			    'governance.compatibility.counts': '{warning} 项警告 · {fatal} 项致命 · {acknowledged} 项已确认',
			    'governance.compatibility.generation': '代数 {generation}',
			    'governance.compatibility.probed': '最后探测于 {at}',
			    'governance.compatibility.freshRead': '最新兼容性读取',
			    'governance.compatibility.readCounts': '{pass} 项通过 · {warning} 项警告 · {fatal} 项致命 · {unacked} 项未确认警告 · {stale} 项过期确认',
			    'governance.compatibility.review': '审查',
			    'governance.compatibility.recheck': '重新检查',
			    'governance.compatibility.recheckHelp': '重新检查会生成新的兼容性代数；旧的确认不会自动覆盖新代数。',
			    'governance.compatibility.ack': '确认警告',
			    'governance.compatibility.ackDisabled': '兼容汇总只暴露聚合计数，未暴露逐项确认标识；无法逐项确认。',
			    'governance.policy.header': '策略 [ {state} ]',
			    'governance.policy.help': '策略控制团队当前的运行时治理范围，不代表任务进度。',
			    'governance.policy.review': '审查',
			    'governance.policy.commit': '提交',
			    'governance.policy.preview': '将提交：{capabilities}',
			    'governance.policy.cell.locked': '已锁定',
			    'governance.policy.entry.none': '未设置',
			    'governance.policy.entry.allow': '允许',
			    'governance.policy.entry.deny': '拒绝',
			    'governance.policy.items': '条目',
			    'governance.effectiveConfig': '生效配置',
			    'governance.effectiveConfig.empty': '该成员暂无生效配置数据',
			    'governance.lane.suppressed': '已抑制',
			    'governance.lane.unavailable': '不可用',
			    'governance.lane.effectiveFrom': '自 {step} 生效',
			    'governance.hardPolicy': '请求：{requested} / 生效：{effective} / 原因：{reason}',
			    'governance.override.show': '查看覆盖',
			    'governance.override.set': '设置覆盖',
			    'governance.override.reset': '重置覆盖',
			    'governance.override.none': '无显式人工覆盖',
			    'governance.override.reading': '正在读取覆盖…',
			    'governance.reading': '正在读取…',
			    'governance.pending': '处理中…',
			    'governance.error': '错误：{message}',
			    'handoff.title': '上下文交接',
			    'handoff.source': '源会话："{id}"',
			    'handoff.generate': '生成一次性摘要',
			    'handoff.preparing': '正在生成摘要…',
			    'handoff.ready': '摘要已就绪',
			    'handoff.preview': '预览',
			    'handoff.failed': '上下文交接失败：{message}',
			    'handoff.retry': '重试',
			    'handoff.continue': '不带交接继续',
			    'handoff.cancel': '取消',
			    'handoff.canceled': '交接已取消',
			    'handoff.provenance': '源自会话：{id}',
			    'legacy.banner.line1': '本会话由旧版 Team 实现创建。',
			    'legacy.banner.line2': 'Team vNext 不会将其作为 vNext 团队恢复或变更。',
			    'legacy.banner.line3': '历史 Chat 与 Trajectory 仍可访问。',
			    'legacy.summary': '已解码的旧版团队摘要（只读）',
			    'legacy.counts': '{roster} 名花名册成员 · {sessions} 个扫描会话',
			    'legacy.inspectError': '旧版团队检查失败：{message}',
			};
			Object.defineProperty(exports, "zh", { enumerable: true, get: () => zh });
			/** English UI strings for every {@link TeamKey}. */
			const en = {
			    'nav': 'Team',
			    'title': 'Team Member Configuration',
			    'empty.title': 'No Team Members Configured',
			    'empty.description': 'Create Markdown definition files in one of these directories:',
			    'empty.step1': 'Global: $DSH_HOME/teammates/*.md',
			    'empty.step2': 'Project: .dsh/teammates/*.md',
			    'empty.step3': 'Exactly one definition must have role: leader',
			    'member.leader': 'Leader',
			    'member.teammate': 'Teammate',
			    'field.model': 'Model',
			    'field.tools': 'Tools',
			    'field.mcp': 'MCP Servers',
			    'field.context': 'Context Policy',
			    'view.team': 'Team',
			    'view.zero': 'This session is not part of a team',
			    'view.timeline.title': 'Timeline',
			    'view.timeline.empty': 'No delegations yet',
			    'view.timeline.aria': 'Team delegation timeline: wheel to zoom, drag to pan, arrow keys to pan, press 0 to reset',
			    'view.timeline.running': 'In progress',
			    'view.members.title': 'Members',
			    'view.members.active': '{count} active',
			    'view.members.created': 'Created',
			    'view.members.running': 'Running',
			    'view.members.settled': 'Settled',
			    'view.members.archived': 'Archived',
			    'view.members.disposed': 'Disposed',
			    'view.members.noInstances': 'No instances yet',
			    'view.members.action.empty': 'No action yet',
			    'view.members.waiting': '{count} pending',
			    'view.activity.title': 'Activity & Progress',
			    'view.activity.empty': 'No activity progress yet',
			    'view.activity.member': 'Assignee {member}',
			    'view.activity.in_progress': 'In progress',
			    'view.activity.completed': 'Completed',
			    'view.activity.blocked': 'Blocked',
			    'view.ledger.title': 'Team events',
			    'view.ledger.empty': 'No team events yet',
			    'view.ledger.loading': 'Loading team events…',
			    'view.ledger.remaining': '{count} event(s) not loaded yet',
			    'view.ledger.retry': 'Retry',
			    'view.ledger.loadEarlier': 'Load earlier',
			    'view.ledger.loadFailed': 'Loading events failed: {message}',
			    'view.ledger.pending': 'Pending decision',
			    'view.ledger.filter.all': 'All',
			    'view.ledger.filter.team': 'Team',
			    'view.ledger.filter.members': 'Members',
			    'view.ledger.filter.lifecycle': 'Lifecycle',
			    'view.ledger.filter.messages': 'Messages',
			    'view.ledger.filter.controls': 'Controls',
			    'view.ledger.filter.policy': 'Policy',
			    'view.ledger.filter.compatibility': 'Compatibility',
			    'view.ledger.filter.progress': 'Progress',
			    'view.ledger.fact.work_admitted': 'Work admitted',
			    'view.ledger.fact.member_created': 'Member created',
			    'view.ledger.fact.lifecycle': 'Lifecycle',
			    'view.ledger.fact.message': 'Message',
			    'view.ledger.fact.control_request': 'Control request',
			    'view.ledger.fact.control_decision': 'Control decision',
			    'view.ledger.fact.control_consumed': 'Decision consumed',
			    'view.ledger.fact.progress': 'Progress',
			    'view.ledger.fact.interval_opened': 'Interval opened',
			    'view.ledger.fact.interval_closed': 'Interval closed',
			    'view.ledger.fact.policy': 'Policy change',
			    'view.ledger.decision.allow': 'Allowed',
			    'view.ledger.decision.deny': 'Denied',
			    'view.ledger.decision.stale_denied': 'Stale denied',
			    'intent.startHere': 'Start Team from Here',
			    'intent.title': 'New Team',
			    'intent.blueprint': 'Team blueprint',
			    'intent.blueprint.placeholder': 'Select a blueprint…',
			    'intent.blueprint.loading': 'Loading the blueprint catalog…',
			    'intent.blueprint.error': 'Failed to load the blueprint catalog: {message}',
			    'intent.blueprint.empty': 'No blueprints available',
			    'intent.revision': 'Revision',
			    'intent.workspace': 'Default workspace',
			    'intent.workspace.placeholder': '(none)',
			    'intent.preset': 'Runtime preset',
			    'intent.preset.hint': 'Choose the AgentPreset the team runs with; switching re-runs compatibility.',
			    'intent.initialWork': 'Initial work (optional)',
			    'intent.initialWork.placeholder': 'The initial work for the leader…',
			    'intent.compatibility': 'Compatibility',
			    'intent.compatibility.checking': 'Checking compatibility…',
			    'intent.compatibility.ready': '✓ Ready',
			    'intent.compatibility.degraded': 'Running degraded per acknowledgements',
			    'intent.compatibility.fatal': '✕ Team cannot be created',
			    'intent.compatibility.unknown': 'Unrecognized compatibility result: {message}',
			    'intent.compatibility.owner': 'Requirement',
			    'intent.compatibility.subjects': 'Unavailable',
			    'intent.ack': 'I understand the degradations above and want to continue',
			    'intent.create': 'Create Team',
			    'intent.createAndSend': 'Create & Send',
			    'intent.acknowledge': 'Acknowledge warnings and create',
			    'intent.creating': 'Creating…',
			    'intent.error': 'Creation failed: {message}',
			    'intent.retry': 'Retry',
			    'intent.cancel': 'Cancel',
			    'intent.rootKept': 'The Root session was created; team creation failed — retry it (the session is kept).',
			    'intent.fatal.preset': "This runtime preset owns a complete system persona and cannot host this Team Blueprint's Leader/Member identity without changing DSH core semantics.",
			    'member.action.sendWork': 'Send work…',
			    'member.action.followup': 'Send follow-up',
			    'member.action.resume': 'Resume…',
			    'member.action.message': 'Message…',
			    'member.action.archive': 'Archive',
			    'member.action.restore': 'Restore',
			    'member.action.dispose': 'Dispose',
			    'member.action.create': 'Create a MemberInstance',
			    'member.command.pending': 'Pending…',
			    'member.command.error': 'Command failed: {code} {message}',
			    'member.create.title': 'Create MemberInstance',
			    'member.create.template': 'Template',
			    'member.create.label': 'Label',
			    'member.create.label.placeholder': 'e.g. researcher-1',
			    'member.create.group': 'Group (optional)',
			    'member.create.workspace': 'Workspace (optional)',
			    'member.create.fresh': 'New delegation creates a new instance.',
			    'member.create.submit': 'Create',
			    'member.create.cancel': 'Cancel',
			    'member.send.title': 'Send work to {member}',
			    'member.send.prompt': 'Work / prompt',
			    'member.send.prompt.placeholder': 'Describe the work for this member…',
			    'member.send.submit': 'Send',
			    'member.send.cancel': 'Cancel',
			    'member.message.title': 'Message {member}',
			    'member.message.subject': 'Subject (optional)',
			    'member.message.body': 'Message',
			    'member.message.body.placeholder': 'Message body…',
			    'member.message.submit': 'Send message',
			    'member.message.cancel': 'Cancel',
			    'member.archive.title': 'Archive this member?',
			    'member.archive.running': 'This member is currently running. Archiving will stop current work and drain resident descendants before the member is archived.',
			    'member.archive.plain': 'The member will not receive new Team work until restored.',
			    'member.archive.confirm': 'Archive',
			    'member.archive.cancel': 'Cancel',
			    'member.dispose.title': 'Dispose this member?',
			    'member.dispose.body': 'This member cannot be restored or receive new Team work. Its Session history, Chat, Trajectory, and Team audit history will be retained.',
			    'member.dispose.confirm': 'Dispose',
			    'member.dispose.cancel': 'Cancel',
			    'dock.title': 'Team',
			    'dock.running': '{count} running',
			    'dock.pending': '{count} pending',
			    'dock.jump': 'Open the Team tab',
			    'dock.expand': 'Expand the team overview',
			    'dock.collapse': 'Collapse the team overview',
			    'dock.members.empty': 'No member status yet',
			    'dock.activities.empty': 'No activity progress yet',
			    'marker.progress': 'Progress',
			    'marker.decision': 'Decision',
			    'governance.compatibility': 'Compatibility',
			    'governance.title': 'Governance',
			    'governance.compatibility.badge.pass': '✓ Compatible',
			    'governance.compatibility.badge.degraded': '⚠ Degraded',
			    'governance.compatibility.badge.actionRequired': '⚠ Action required',
			    'governance.compatibility.badge.fatal': '✕ Structural error',
			    'governance.compatibility.counts': '{warning} warning(s) · {fatal} fatal · {acknowledged} acknowledged',
			    'governance.compatibility.generation': 'Generation {generation}',
			    'governance.compatibility.probed': 'Last probed at {at}',
			    'governance.compatibility.freshRead': 'Latest compatibility read',
			    'governance.compatibility.readCounts': '{pass} pass · {warning} warning · {fatal} fatal · {unacked} unacknowledged · {stale} stale acknowledgements',
			    'governance.compatibility.review': 'Review',
			    'governance.compatibility.recheck': 'Recheck',
			    'governance.compatibility.recheckHelp': 'Rechecking starts a new compatibility generation; old acknowledgements never cover it.',
			    'governance.compatibility.ack': 'Acknowledge warning',
			    'governance.compatibility.ackDisabled': 'The compatibility summary exposes aggregate counts only; per-requirement acknowledgement is not exposed on the wire.',
			    'governance.policy.header': 'Policy [ {state} ]',
			    'governance.policy.help': 'Policy controls the Team\'s current runtime governance envelope. It does not represent task progress.',
			    'governance.policy.review': 'Review',
			    'governance.policy.commit': 'Commit',
			    'governance.policy.preview': 'Will commit: {capabilities}',
			    'governance.policy.cell.locked': 'locked',
			    'governance.policy.entry.none': 'not set',
			    'governance.policy.entry.allow': 'Allow',
			    'governance.policy.entry.deny': 'Deny',
			    'governance.policy.items': 'items',
			    'governance.effectiveConfig': 'Effective config',
			    'governance.effectiveConfig.empty': 'No effective config data for this member yet',
			    'governance.lane.suppressed': 'Suppressed',
			    'governance.lane.unavailable': 'Unavailable',
			    'governance.lane.effectiveFrom': 'effective from {step}',
			    'governance.hardPolicy': 'Requested: {requested} / Effective: {effective} / Reason: {reason}',
			    'governance.override.show': 'Show override',
			    'governance.override.set': 'Set override',
			    'governance.override.reset': 'Reset override',
			    'governance.override.none': 'No explicit human override',
			    'governance.override.reading': 'Reading override…',
			    'governance.reading': 'Reading…',
			    'governance.pending': 'Pending…',
			    'governance.error': 'Error: {message}',
			    'handoff.title': 'Context handoff',
			    'handoff.source': 'Source: "{id}"',
			    'handoff.generate': 'Generate a one-shot summary',
			    'handoff.preparing': 'Generating summary…',
			    'handoff.ready': 'Summary ready',
			    'handoff.preview': 'Preview',
			    'handoff.failed': 'Context handoff failed: {message}',
			    'handoff.retry': 'Retry',
			    'handoff.continue': 'Continue without handoff',
			    'handoff.cancel': 'Cancel',
			    'handoff.canceled': 'Handoff canceled',
			    'handoff.provenance': 'Started from Session: {id}',
			    'legacy.banner.line1': 'This Session was created by the previous Team implementation.',
			    'legacy.banner.line2': 'Team vNext will not resume or mutate it as a vNext Team.',
			    'legacy.banner.line3': 'Historical Chat and Trajectory remain available.',
			    'legacy.summary': 'Decoded legacy team summary (read-only)',
			    'legacy.counts': '{roster} roster members · {sessions} scanned sessions',
			    'legacy.inspectError': 'Legacy inspection failed: {message}',
			};
			Object.defineProperty(exports, "en", { enumerable: true, get: () => en });
			//# sourceMappingURL=locales.js.map
			}, exports: {} };
		__mods["model/team-timeline-model.js"] = { done: false, fn: function (exports) {
			/** Lane-color ramp length; the CSS module defines one slot per index. */
			const TEAM_LANE_COLOR_SLOTS = 8;
			Object.defineProperty(exports, "TEAM_LANE_COLOR_SLOTS", { enumerable: true, get: () => TEAM_LANE_COLOR_SLOTS });
			/**
			 * Project the ledger's activity intervals onto member-instance lanes over
			 * the linear time domain.
			 * @param snapshot - the normalized team snapshot (the roster lanes).
			 * @param ledger - the durable ledger model (the interval rows; durable
			 *   progress facts extend the domain only when the ledger is known complete).
			 * @param now - the caller's clock (epoch ms); read by open intervals only.
			 * @returns the lane model, or `null` when the ledger carries no activity
			 *   intervals (the renderer then shows the one-line empty state instead of
			 *   a lane matrix).
			 */
			function deriveTeamTimeline(snapshot, ledger, now) {
			    const intervals = ledger.intervals;
			    if (intervals.length === 0)
			        return null;
			    let start = Infinity;
			    let end = -Infinity;
			    for (const interval of intervals) {
			        const openedAt = Date.parse(interval.openedAt);
			        if (openedAt < start)
			            start = openedAt;
			        const settled = interval.isOpen ? openedAt : Date.parse(interval.closedAt ?? interval.openedAt);
			        const closing = interval.isOpen ? Math.max(settled, now) : settled;
			        if (closing > end)
			            end = closing;
			    }
			    // Plan §7.4: durable progress facts extend the domain only over a
			    // known-complete ledger — the mechanical successor of the legacy task-at
			    // extension; a partial ledger never claims a wider board.
			    if (ledger.completeness === 'complete') {
			        for (const progress of ledger.progress) {
			            const at = Date.parse(progress.at);
			            if (at < start)
			                start = at;
			            if (at > end)
			                end = at;
			        }
			    }
			    if (end <= start)
			        end = start + 1;
			    const builds = [];
			    const buildById = new Map();
			    const kindByTemplate = new Map(snapshot.templates.map(template => [template.templateId, template.kind]));
			    for (const member of snapshot.members) {
			        // Leader-kind instances carry no lane (the fixed leading leader entry
			        // lives in the members section); unknown templates read as teammates.
			        if (kindByTemplate.get(member.templateId) === 'leader')
			            continue;
			        const build = {
			            id: member.instanceId,
			            name: member.label,
			            childSessionId: member.childSessionId ?? '',
			            spans: [],
			        };
			        builds.push(build);
			        buildById.set(member.instanceId, build);
			    }
			    intervals.forEach((interval, index) => {
			        let build = buildById.get(interval.instanceId);
			        // An activity interval whose instance never reached a roster row still
			        // renders: a fallback lane named by the raw id, appended after the
			        // roster lanes in first-seen order, instead of silently dropping the
			        // bar.
			        if (build === undefined) {
			            build = { id: interval.instanceId, name: interval.instanceId, childSessionId: '', spans: [] };
			            builds.push(build);
			            buildById.set(interval.instanceId, build);
			        }
			        const openedAt = Date.parse(interval.openedAt);
			        const settled = interval.isOpen ? openedAt : Date.parse(interval.closedAt ?? interval.openedAt);
			        build.spans.push({
			            key: `${interval.instanceId}:${openedAt}:${index}`,
			            startedAt: openedAt,
			            endedAt: interval.isOpen ? Math.max(settled, now) : settled,
			            inProgress: interval.isOpen,
			        });
			    });
			    const lanes = builds.map((build, lane) => ({
			        instanceId: build.id,
			        name: build.name,
			        lane,
			        colorSlot: lane % TEAM_LANE_COLOR_SLOTS,
			        childSessionId: build.childSessionId,
			        spans: build.spans.sort((left, right) => left.startedAt - right.startedAt),
			    }));
			    return { start, end, lanes };
			}
			/**
			 * Pick "nice" axis ticks inside one visible domain: the step is the first
			 * 1/2/5×10^n multiple at or above the raw span, so label density stays near
			 * the target across zoom levels.
			 * @param start - visible domain start (epoch ms).
			 * @param end - visible domain end (epoch ms, inclusive).
			 * @param target - approximate tick count (default 6).
			 * @returns ascending tick times, or the single point for a degenerate domain.
			 */
			export function teamTimelineTicks(start, end, target = 6) {
			    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
			        return [];
			    if (end === start)
			        return [start];
			    const rawStep = (end - start) / Math.max(1, target - 1);
			    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
			    const normalized = rawStep / magnitude;
			    const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
			    const first = Math.ceil(start / step) * step;
			    const count = Math.floor((end - first) / step) + 1;
			    return Array.from({ length: Math.max(0, count) }, (_, index) => first + index * step);
			}
			function pad2(value) {
			    return String(value).padStart(2, '0');
			}
			/**
			 * Format one epoch-ms mark as a fixed 24-hour `HH:MM:SS` label in the local
			 * timezone. Deliberately locale-free (no localized number or weekday
			 * formatting): the print format is identical on every host; the wall-clock
			 * readout follows the browser's timezone like every other local time on the
			 * page.
			 * @param timestamp - epoch milliseconds.
			 * @returns the clock label.
			 */
			export function formatTeamClock(timestamp) {
			    const date = new Date(timestamp);
			    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
			}
			/**
			 * Format a non-negative duration as a Chinese label: sub-second rounds to
			 * `N毫秒`, seconds keep one decimal below 10 s, then `N分NN秒`, then
			 * `N小时NN分`.
			 * @param milliseconds - duration in milliseconds (negative or non-finite reads as 0).
			 * @returns the duration label.
			 */
			export function formatTeamDuration(milliseconds) {
			    const ms = Number.isFinite(milliseconds) && milliseconds > 0 ? Math.floor(milliseconds) : 0;
			    if (ms < 1_000)
			        return `${ms}毫秒`;
			    if (ms < 60_000) {
			        const seconds = ms / 1_000;
			        return `${seconds < 10 ? Math.round(seconds * 10) / 10 : Math.round(seconds)}秒`;
			    }
			    if (ms < 3_600_000) {
			        return `${Math.floor(ms / 60_000)}分${pad2(Math.floor((ms % 60_000) / 1_000))}秒`;
			    }
			    return `${Math.floor(ms / 3_600_000)}小时${pad2(Math.floor((ms % 3_600_000) / 60_000))}分`;
			}
			//# sourceMappingURL=team-timeline-model.js.map
			}, exports: {} };
		__mods["model/team-members-model.js"] = { done: false, fn: function (exports) {
			/**
			 * Plan §7.3 completeness-aware pending count: the per-instance badge comes
			 * only from known-complete control facts; a partial ledger leaves it
			 * unknown.
			 * @param member - the snapshot member instance.
			 * @param ledger - the durable ledger model.
			 * @returns the count, or `null` when the ledger is not known complete.
			 */
			function pendingOf(member, ledger) {
			    if (ledger.completeness !== 'complete')
			        return null;
			    return ledger.pendingControlByInstance[member.instanceId] ?? 0;
			}
			/**
			 * Fold one snapshot member instance into a group's running tally and
			 * instance list. Every instance is a real row (the legacy "unbound" skip
			 * has no vNext successor).
			 * @param group - the group being built (mutated in place while the fold runs).
			 * @param member - the snapshot member instance.
			 * @param ledger - the durable ledger model (for the completeness-aware count).
			 */
			function appendRow(group, member, ledger) {
			    group.instances.push({
			        key: `${member.instanceId}:${member.childSessionId ?? ''}:${group.instances.length}`,
			        childSessionId: member.childSessionId ?? '',
			        lifecycle: member.lifecycle,
			        label: member.label,
			        status: member.displayStatus,
			        ...(member.currentAction !== undefined ? { currentAction: member.currentAction } : {}),
			        pendingControlCount: pendingOf(member, ledger),
			        fromHistory: member.fromHistory,
			    });
			    if (member.lifecycle === 'RUNNING')
			        group.activeCount += 1;
			}
			/**
			 * Project the snapshot's member instances onto the members-section model.
			 * @param snapshot - the normalized team snapshot.
			 * @param ledger - the durable ledger model.
			 * @returns the leading leader row — synthesized from the team session when
			 *   the rows carry no leader kind — plus the non-leader groups in `members`
			 *   order, instances sharing a templateId folded into one group.
			 */
			function deriveTeamMembers(snapshot, ledger) {
			    const groups = [];
			    const groupById = new Map();
			    const templateById = new Map(snapshot.templates.map(template => [template.templateId, template]));
			    let leader;
			    for (const member of snapshot.members) {
			        const kind = templateById.get(member.templateId)?.kind;
			        if (kind === 'leader') {
			            if (leader === undefined) {
			                leader = {
			                    templateId: member.templateId,
			                    name: templateById.get(member.templateId)?.displayName ?? member.label,
			                    role: 'leader',
			                    activeCount: 0,
			                    instances: [],
			                };
			            }
			            appendRow(leader, member, ledger);
			            continue;
			        }
			        let group = groupById.get(member.templateId);
			        if (group === undefined) {
			            group = {
			                templateId: member.templateId,
			                name: templateById.get(member.templateId)?.displayName ?? member.label,
			                role: 'teammate',
			                activeCount: 0,
			                instances: [],
			            };
			            groupById.set(member.templateId, group);
			            groups.push(group);
			        }
			        appendRow(group, member, ledger);
			    }
			    return {
			        leader: leader ?? {
			            templateId: snapshot.teamSessionId,
			            role: 'leader',
			            activeCount: 0,
			            instances: [],
			        },
			        groups,
			    };
			}
			Object.defineProperty(exports, "deriveTeamMembers", { enumerable: true, get: () => deriveTeamMembers });
			//# sourceMappingURL=team-members-model.js.map
			}, exports: {} };
		__mods["model/team-member-commands.js"] = { done: false, fn: function (exports) {
			/**
			 * P9-T7 (S5-B) — pure model for the member command flows (plan P9-S5
			 * S5-B + Gate P9-G5; UI doc §17/§23/§40): the per-lifecycle action set
			 * (the UI §40 matrix), the frozen Remote param builders (`member.create` /
			 * `member.send` / `member.followup` / `member.archive` / `member.restore` /
			 * `member.dispose`), the typed-outcome parser (the remote typed result is
			 * preserved verbatim — `code`, `message`, and the `requestToken` echo —
			 * and no optimistic authority patch is ever applied), and a local
			 * request-token generator.
			 *
			 * Caller convention (host test convention): the human caller is
			 * `{ kind: 'human', humanId: <teamSessionId> }` — humanId is the
			 * TeamSession id, which IS the root DSH session id (invariant 9).
			 *
			 * Pure module: no React, no I/O, no crypto. Erasable TS only.
			 * @module @dsh-agent-team/client/model/team-member-commands
			 */
			/**
			 * The §40 action matrix: the commands allowed per lifecycle (`Yes` in the
			 * matrix = lifecycle-allowed; policy may still block at admission).
			 * Send work / follow-up / message are exposed on the three live states;
			 * archive and dispose everywhere except DISPOSED; restore only from
			 * ARCHIVED.
			 */
			const MEMBER_ACTIONS = {
			    CREATED: ['send', 'followup', 'archive', 'dispose'],
			    RUNNING: ['send', 'followup', 'archive', 'dispose'],
			    SETTLED: ['send', 'followup', 'archive', 'dispose'],
			    ARCHIVED: ['restore', 'dispose'],
			    DISPOSED: [],
			};
			/**
			 * The commands the §40 matrix allows for one lifecycle.
			 * @param lifecycle - the instance's closed lifecycle state.
			 * @returns the allowed row command kinds (empty for DISPOSED; never `create`).
			 */
			function memberActionsForLifecycle(lifecycle) {
			    return MEMBER_ACTIONS[lifecycle];
			}
			Object.defineProperty(exports, "memberActionsForLifecycle", { enumerable: true, get: () => memberActionsForLifecycle });
			/**
			 * The label token for one command in one lifecycle.
			 * @param kind - the command kind (never `create` — that has its own entry).
			 * @param lifecycle - the instance's closed lifecycle state.
			 * @returns the label token.
			 */
			function memberActionLabel(kind, lifecycle) {
			    switch (kind) {
			        case 'send':
			            return lifecycle === 'CREATED' ? 'sendWork' : 'message';
			        case 'followup':
			            return lifecycle === 'SETTLED' ? 'resume' : 'followup';
			        case 'archive':
			            return 'archive';
			        case 'restore':
			            return 'restore';
			        case 'dispose':
			            return 'dispose';
			    }
			}
			Object.defineProperty(exports, "memberActionLabel", { enumerable: true, get: () => memberActionLabel });
			/**
			 * The human caller for a team (the host test convention): humanId is the
			 * TeamSession id (the root DSH session id, invariant 9).
			 * @param teamSessionId - the TeamSession id.
			 * @returns the frozen caller object.
			 */
			function humanCaller(teamSessionId) {
			    return { kind: 'human', humanId: teamSessionId };
			}
			Object.defineProperty(exports, "humanCaller", { enumerable: true, get: () => humanCaller });
			/**
			 * Build the `member.create` params: the template delegation (exactly one
			 * of the two delegation fields) plus the host-consumed payload fields
			 * (`label` required; `groupId` / `workspace` when given).
			 * @param input - the dialog input.
			 * @returns the frozen param object.
			 */
			function buildMemberCreateParams(input) {
			    const payload = { label: input.label };
			    if (input.groupId !== undefined)
			        payload['groupId'] = input.groupId;
			    if (input.workspace !== undefined)
			        payload['workspace'] = input.workspace;
			    return {
			        teamSessionId: input.teamSessionId,
			        caller: humanCaller(input.teamSessionId),
			        requestToken: input.requestToken,
			        delegationTemplateId: input.templateId,
			        payload,
			    };
			}
			Object.defineProperty(exports, "buildMemberCreateParams", { enumerable: true, get: () => buildMemberCreateParams });
			/**
			 * Build the `member.followup` params: the prompt rides the `payload`
			 * (`payload.prompt`, host admission) — the frozen follow-up channel.
			 * @param input - the dialog input.
			 * @returns the frozen param object.
			 */
			function buildMemberFollowupParams(input) {
			    return {
			        teamSessionId: input.teamSessionId,
			        caller: humanCaller(input.teamSessionId),
			        targetInstanceId: input.targetInstanceId,
			        requestToken: input.requestToken,
			        payload: { prompt: input.prompt },
			    };
			}
			Object.defineProperty(exports, "buildMemberFollowupParams", { enumerable: true, get: () => buildMemberFollowupParams });
			/**
			 * Build the `member.send` params: a coordination message to the member's
			 * Chat (UI §28: relays in the Member Chat, correlated in the TeamLedger).
			 * @param input - the dialog input.
			 * @returns the frozen param object.
			 */
			function buildMemberSendParams(input) {
			    return input.subject === undefined
			        ? {
			            teamSessionId: input.teamSessionId,
			            caller: humanCaller(input.teamSessionId),
			            recipientInstanceId: input.recipientInstanceId,
			            body: input.body,
			            requestToken: input.requestToken,
			        }
			        : {
			            teamSessionId: input.teamSessionId,
			            caller: humanCaller(input.teamSessionId),
			            recipientInstanceId: input.recipientInstanceId,
			            body: input.body,
			            subject: input.subject,
			            requestToken: input.requestToken,
			        };
			}
			Object.defineProperty(exports, "buildMemberSendParams", { enumerable: true, get: () => buildMemberSendParams });
			/**
			 * Build the `member.archive` / `member.restore` / `member.dispose` params
			 * (the frozen lifecycle pair — no token, no payload).
			 * @param teamSessionId - the TeamSession id.
			 * @param instanceId - the target instance id.
			 * @returns the frozen param object.
			 */
			function buildMemberLifecycleParams(teamSessionId, instanceId) {
			    return { teamSessionId, instanceId };
			}
			Object.defineProperty(exports, "buildMemberLifecycleParams", { enumerable: true, get: () => buildMemberLifecycleParams });
			/**
			 * Parse a member command's raw `RemoteResponse`, preserving the remote
			 * typed result verbatim (Gate P9-G5). A success carries no further UI
			 * state — the post-success projection pull is the authority, and no
			 * optimistic authority patch is applied before the response lands.
			 * @param response - the raw remote response for the command.
			 * @returns the preserved outcome.
			 */
			function parseMemberCommandOutcome(response) {
			    if (response.ok)
			        return { ok: true };
			    const details = response.error.details;
			    return {
			        ok: false,
			        code: response.error.code,
			        message: response.error.message,
			        requestToken: details.requestToken,
			    };
			}
			Object.defineProperty(exports, "parseMemberCommandOutcome", { enumerable: true, get: () => parseMemberCommandOutcome });
			/**
			 * Create a local request-token generator: `prefix-<n>` per call (a pure
			 * counter — no crypto dependency; the host treats the token as an opaque
			 * echo idempotency marker).
			 * @param prefix - the token prefix (e.g. the command kind).
			 * @returns a function yielding the next token.
			 */
			function createRequestTokenGenerator(prefix) {
			    let next = 0;
			    return () => {
			        next += 1;
			        return `${prefix}-${next}`;
			    };
			}
			Object.defineProperty(exports, "createRequestTokenGenerator", { enumerable: true, get: () => createRequestTokenGenerator });
			//# sourceMappingURL=team-member-commands.js.map
			}, exports: {} };
		__mods["ui/TeamMemberDialogs.js"] = { done: false, fn: function (exports) {
			const __imp0 = __extReq("react/jsx-runtime");
			const _jsx = __imp0.jsx;
			const _jsxs = __imp0.jsxs;
			const __imp16 = __extReq("react");
			const useState = __imp16.useState;
			const styles = __css("ui/TeamMemberDialogs.module.css").default;
			/**
			 * P9-T7 (S5-B) — the member command dialogs (UI doc §17/§23):
			 * `TeamCreateMemberDialog` (the §17.1 template / label / group /
			 * workspace dialog with the `fresh_per_delegation` copy "New delegation
			 * creates a new instance.") and `TeamConfirmDialog` (the §23.2 archive
			 * confirmation with the RUNNING drain warning, and the §23.5 dispose
			 * confirmation — its primary copy is "Dispose", never "Delete member").
			 *
			 * Both are pure presentation: the field draft state is dialog-local
			 * (reset on close — only the TeamIntent draft, UI §5.3, must persist
			 * within the page run); the parent (`TeamMembers`) owns the in-flight
			 * command, the error note, and the injected command face.
			 *
			 * @module @dsh-agent-team/client/ui/TeamMemberDialogs
			 */
			/**
			 * The §17.1 create-member dialog: the read-only template row, the
			 * required label, the optional group, the optional workspace (hidden
			 * when the feed is absent), and the `fresh_per_delegation` notice.
			 * The submit is disabled while the label is blank.
			 * @param props - the template, the workspace feed, the callbacks, the dictionary.
			 * @returns the dialog.
			 */
			function TeamCreateMemberDialog({ template, workspaces, onSubmit, onCancel, t, }) {
			    const [label, setLabel] = useState('');
			    const [groupId, setGroupId] = useState('');
			    const [workspace, setWorkspace] = useState('');
			    const submit = () => {
			        const trimmedLabel = label.trim();
			        if (trimmedLabel === '')
			            return;
			        const trimmedGroup = groupId.trim();
			        onSubmit({
			            label: trimmedLabel,
			            ...(trimmedGroup !== '' ? { groupId: trimmedGroup } : {}),
			            ...(workspace !== '' ? { workspace } : {}),
			        });
			    };
			    return (_jsxs("div", { className: styles.dialog, "data-member-dialog": true, "data-member-create-dialog": true, role: "dialog", "aria-modal": "true", children: [_jsx("h3", { className: styles.title, "data-member-create-title": true, children: t('member.create.title') }), _jsxs("div", { className: styles.field, "data-member-create-template": true, children: [_jsx("span", { className: styles.fieldLabel, children: t('member.create.template') }), _jsx("span", { className: styles.templateName, "data-member-create-template-name": true, children: template.displayName })] }), template.contextPolicy === 'fresh_per_delegation'
			                ? _jsx("div", { className: styles.notice, "data-member-fresh-notice": true, children: t('member.create.fresh') })
			                : null, _jsxs("label", { className: styles.field, "data-member-create-label-field": true, children: [_jsx("span", { className: styles.fieldLabel, children: t('member.create.label') }), _jsx("input", { type: "text", "data-member-create-label": true, placeholder: t('member.create.label.placeholder'), value: label, onChange: event => { setLabel(event.target.value); } })] }), _jsxs("label", { className: styles.field, "data-member-create-group-field": true, children: [_jsx("span", { className: styles.fieldLabel, children: t('member.create.group') }), _jsx("input", { type: "text", "data-member-create-group": true, value: groupId, onChange: event => { setGroupId(event.target.value); } })] }), workspaces.length > 0
			                ? (_jsxs("label", { className: styles.field, "data-member-create-workspace-field": true, children: [_jsx("span", { className: styles.fieldLabel, children: t('member.create.workspace') }), _jsxs("select", { "data-member-create-workspace": true, value: workspace, onChange: event => { setWorkspace(event.target.value); }, children: [_jsx("option", { value: "", children: t('intent.workspace.placeholder') }), workspaces.map(option => (_jsx("option", { value: option.path, children: option.title }, option.id)))] })] }))
			                : null, _jsxs("div", { className: styles.actions, "data-member-create-actions": true, children: [_jsx("button", { type: "button", className: styles.button, "data-member-create-cancel": true, onClick: onCancel, children: t('member.create.cancel') }), _jsx("button", { type: "button", className: styles.button, "data-member-create-submit": true, disabled: label.trim() === '', onClick: submit, children: t('member.create.submit') })] })] }));
			}
			Object.defineProperty(exports, "TeamCreateMemberDialog", { enumerable: true, get: () => TeamCreateMemberDialog });
			/**
			 * The work-prompt dialog (UI §23.1 "Send work…" / the follow-up
			 * interaction; the SETTLED "Resume…" opens the same dialog): one
			 * non-empty prompt field; the submit is disabled while blank.
			 * @param props - the copy, the callbacks, the dictionary.
			 * @returns the dialog.
			 */
			function TeamMemberPromptDialog({ title, placeholder, submitLabel, cancelLabel, onSubmit, onCancel, t, }) {
			    const [text, setText] = useState('');
			    return (_jsxs("div", { className: styles.dialog, "data-member-dialog": true, "data-member-prompt-dialog": true, role: "dialog", "aria-modal": "true", children: [_jsx("h3", { className: styles.title, "data-member-prompt-title": true, children: title }), _jsxs("label", { className: styles.field, "data-member-prompt-field": true, children: [_jsx("span", { className: styles.fieldLabel, children: t('member.send.prompt') }), _jsx("input", { type: "text", "data-member-prompt-input": true, placeholder: placeholder, value: text, onChange: event => { setText(event.target.value); } })] }), _jsxs("div", { className: styles.actions, "data-member-prompt-actions": true, children: [_jsx("button", { type: "button", className: styles.button, "data-member-prompt-cancel": true, onClick: onCancel, children: cancelLabel }), _jsx("button", { type: "button", className: styles.button, "data-member-prompt-submit": true, disabled: text.trim() === '', onClick: () => { onSubmit(text.trim()); }, children: submitLabel })] })] }));
			}
			Object.defineProperty(exports, "TeamMemberPromptDialog", { enumerable: true, get: () => TeamMemberPromptDialog });
			/**
			 * The `member.send` message dialog: an optional subject line plus the
			 * required body (the frozen 1..200000 bound is enforced host-side; a
			 * violation surfaces as the verbatim typed error note).
			 * @param props - the copy, the callbacks, the dictionary.
			 * @returns the dialog.
			 */
			function TeamMemberMessageDialog({ title, onSubmit, onCancel, t, }) {
			    const [subject, setSubject] = useState('');
			    const [body, setBody] = useState('');
			    return (_jsxs("div", { className: styles.dialog, "data-member-dialog": true, "data-member-message-dialog": true, role: "dialog", "aria-modal": "true", children: [_jsx("h3", { className: styles.title, "data-member-message-title": true, children: title }), _jsxs("label", { className: styles.field, "data-member-message-subject-field": true, children: [_jsx("span", { className: styles.fieldLabel, children: t('member.message.subject') }), _jsx("input", { type: "text", "data-member-message-subject": true, value: subject, onChange: event => { setSubject(event.target.value); } })] }), _jsxs("label", { className: styles.field, "data-member-message-body-field": true, children: [_jsx("span", { className: styles.fieldLabel, children: t('member.message.body') }), _jsx("textarea", { "data-member-message-body": true, placeholder: t('member.message.body.placeholder'), rows: 3, value: body, onChange: event => { setBody(event.target.value); } })] }), _jsxs("div", { className: styles.actions, "data-member-message-actions": true, children: [_jsx("button", { type: "button", className: styles.button, "data-member-message-cancel": true, onClick: onCancel, children: t('member.message.cancel') }), _jsx("button", { type: "button", className: styles.button, "data-member-message-submit": true, disabled: body.trim() === '', onClick: () => {
			                            const trimmedBody = body.trim();
			                            const trimmedSubject = subject.trim();
			                            onSubmit(trimmedBody, trimmedSubject === '' ? undefined : trimmedSubject);
			                        }, children: t('member.message.submit') })] })] }));
			}
			Object.defineProperty(exports, "TeamMemberMessageDialog", { enumerable: true, get: () => TeamMemberMessageDialog });
			/**
			 * The §23 lifecycle confirmation: title, body, the optional drain
			 * warning, and the two actions (the primary is the lifecycle verb —
			 * "Archive" / "Dispose" — never a delete framing).
			 * @param props - the copy, the callbacks.
			 * @returns the dialog.
			 */
			function TeamConfirmDialog({ title, body, warning, confirmLabel, cancelLabel, onConfirm, onCancel, }) {
			    return (_jsxs("div", { className: styles.dialog, "data-member-dialog": true, "data-member-confirm-dialog": true, role: "dialog", "aria-modal": "true", children: [_jsx("h3", { className: styles.title, "data-member-confirm-title": true, children: title }), _jsx("div", { className: styles.body, "data-member-confirm-body": true, children: body }), warning !== undefined
			                ? _jsx("div", { className: styles.warning, "data-member-confirm-warning": true, children: warning })
			                : null, _jsxs("div", { className: styles.actions, "data-member-confirm-actions": true, children: [_jsx("button", { type: "button", className: styles.button, "data-member-confirm-cancel": true, onClick: onCancel, children: cancelLabel }), _jsx("button", { type: "button", className: styles.button, "data-member-confirm-ok": true, onClick: onConfirm, children: confirmLabel })] })] }));
			}
			Object.defineProperty(exports, "TeamConfirmDialog", { enumerable: true, get: () => TeamConfirmDialog });
			//# sourceMappingURL=TeamMemberDialogs.js.map
			}, exports: {} };
		__mods["model/team-ledger-model.js"] = { done: false, fn: function (exports) {
			/** The first-render depth (plan §8.8: the legacy TEAM_FEED_INITIAL_LIMIT = 200). */
			const TEAM_LEDGER_INITIAL_LIMIT = 200;
			Object.defineProperty(exports, "TEAM_LEDGER_INITIAL_LIMIT", { enumerable: true, get: () => TEAM_LEDGER_INITIAL_LIMIT });
			/** The "load earlier" depth step (plan §8.8: the legacy TEAM_FEED_STEP = 200). */
			const TEAM_LEDGER_STEP = 200;
			Object.defineProperty(exports, "TEAM_LEDGER_STEP", { enumerable: true, get: () => TEAM_LEDGER_STEP });
			/** The closed fact-type → family map (the client-local frozen vocabulary). */
			const FACT_ROW_KIND = {
			    'team-work-admitted': 'work-admitted',
			    'provision-member-instance': 'member-created',
			    'member-lifecycle-changed': 'lifecycle-changed',
			    'team-message-delivered': 'message',
			    'team-coordination-recorded': 'message',
			    'control-request-recorded': 'control-request',
			    'control-decision-recorded': 'control-decision',
			    'control-allow-consumed': 'control-consumed',
			    'activity-progress-recorded': 'progress-recorded',
			    'activity-interval-opened': 'interval-opened',
			    'activity-interval-closed': 'interval-closed',
			    'policy-state-transitioned': 'policy-transitioned',
			};
			/** Fail-safe string leaf read (the ledger-adapter discipline). */
			function str(payload, key) {
			    const value = payload[key];
			    return typeof value === 'string' ? value : undefined;
			}
			/** Fail-safe progress-value leaf read (the frozen closed set). */
			function progress(payload) {
			    const value = payload['progress'];
			    return value === 'in-progress' || value === 'completed' || value === 'blocked' ? value : undefined;
			}
			/** The lossless-safe serialized payload summary (lossless JSON in, JSON text out). */
			function safePayloadSummary(payload) {
			    try {
			        return JSON.stringify(payload);
			    }
			    catch {
			        return '{}';
			    }
			}
			/**
			 * Build one Events-section row from one loaded fact (the fail-safe leaf
			 * reads per family; the generic family for an unknown fact type).
			 * @param row - the loaded ledger fact row.
			 * @param labels - instanceId → display label (the snapshot member rows).
			 * @param navSessions - instanceId → session target ('' = none).
			 * @param templates - instanceId → templateId (the snapshot member rows).
			 * @param pendingRequestIds - the request ids with no paired decision in the loaded facts.
			 * @param intervalInstance - correlation → instanceId (the loaded paired intervals; the close facts name only the correlation).
			 * @returns the rendered row.
			 */
			function buildRow(row, labels, navSessions, templates, pendingRequestIds, intervalInstance) {
			    const kind = FACT_ROW_KIND[row.factType] ?? 'unknown';
			    const payload = row.payload;
			    let actorInstanceId = '';
			    let summary = '';
			    let detail = '';
			    let pending = false;
			    let decisionValue;
			    let decisionReason;
			    let progressValue;
			    switch (kind) {
			        case 'message': {
			            // Per-fact leaf reads (mirroring the adapter's frozen leaf order):
			            // the delivered fact names only the recipient
			            // (`recipientInstanceId` ?? `deliveredToInstanceId`); the
			            // coordination fact names the target (`targetInstanceId` ??
			            // `recipientInstanceId`) and MAY name the caller. Each fact carries
			            // at most one of the aliases, so one ?? chain covers both orders.
			            const from = str(payload, 'caller');
			            const to = str(payload, 'targetInstanceId') ?? str(payload, 'recipientInstanceId') ?? str(payload, 'deliveredToInstanceId');
			            const subject = str(payload, 'subject');
			            if (from !== undefined)
			                actorInstanceId = from;
			            if (to !== undefined && from === undefined)
			                actorInstanceId = to;
			            const fromLabel = from === undefined ? '' : (labels.get(from) ?? from);
			            const toLabel = to === undefined ? '' : (labels.get(to) ?? to);
			            summary = subject ?? safePayloadSummary(payload);
			            detail = [from === undefined ? '' : fromLabel, to === undefined ? '' : `→ ${toLabel}`, subject]
			                .filter(part => part !== '')
			                .join(' ');
			            if (detail === '')
			                detail = safePayloadSummary(payload);
			            break;
			        }
			        case 'control-request': {
			            actorInstanceId = str(payload, 'targetInstanceId') ?? '';
			            const actionName = str(payload, 'actionName');
			            const toolName = str(payload, 'toolName');
			            summary = actionName ?? safePayloadSummary(payload);
			            detail = [actionName, toolName, str(payload, 'summary')]
			                .filter(part => part !== undefined && part !== '')
			                .join(' · ');
			            if (detail === '')
			                detail = safePayloadSummary(payload);
			            const requestId = str(payload, 'requestId');
			            pending = requestId === undefined ? false : pendingRequestIds.has(requestId);
			            break;
			        }
			        case 'control-decision': {
			            decisionValue = str(payload, 'decision');
			            decisionReason = str(payload, 'reason') ?? str(payload, 'note');
			            const scope = payload['scope'];
			            if (typeof scope === 'object' && scope !== null) {
			                actorInstanceId = str(scope, 'targetInstanceId') ?? '';
			            }
			            summary = [decisionValue, decisionReason].filter(part => part !== undefined && part !== '').join(' · ');
			            if (summary === '')
			                summary = safePayloadSummary(payload);
			            detail = [str(payload, 'requestId'), decisionValue, decisionReason]
			                .filter(part => part !== undefined && part !== '')
			                .join(' · ');
			            if (detail === '')
			                detail = safePayloadSummary(payload);
			            break;
			        }
			        case 'interval-opened': {
			            actorInstanceId = str(payload, 'instanceId') ?? '';
			            summary = str(payload, 'subject') ?? str(payload, 'note') ?? safePayloadSummary(payload);
			            detail = [str(payload, 'correlation'), summary].filter(part => part !== undefined && part !== '').join(' · ');
			            break;
			        }
			        case 'interval-closed': {
			            // The close fact names only the correlation: the actor joins through
			            // the loaded paired interval (no pairing, no actor — no guessing).
			            const correlation = str(payload, 'correlation');
			            if (correlation !== undefined)
			                actorInstanceId = intervalInstance.get(correlation) ?? '';
			            summary = str(payload, 'closeNote') ?? str(payload, 'note') ?? safePayloadSummary(payload);
			            detail = [correlation, summary].filter(part => part !== undefined && part !== '').join(' · ');
			            break;
			        }
			        case 'progress-recorded': {
			            actorInstanceId = str(payload, 'instanceId') ?? '';
			            progressValue = progress(payload);
			            const subject = str(payload, 'subject');
			            summary = subject ?? safePayloadSummary(payload);
			            detail = [subject, progressValue, str(payload, 'lastAction')]
			                .filter(part => part !== undefined && part !== '')
			                .join(' · ');
			            if (detail === '')
			                detail = safePayloadSummary(payload);
			            break;
			        }
			        case 'work-admitted':
			        case 'member-created':
			        case 'lifecycle-changed':
			        case 'policy-transitioned':
			        case 'control-consumed':
			        case 'unknown': {
			            // The generic display: the first instance leaf the fact names
			            // (fail-safe, in the frozen leaf order), else none — never guessed.
			            actorInstanceId =
			                str(payload, 'instanceId')
			                    ?? str(payload, 'targetInstanceId')
			                    ?? str(payload, 'memberInstanceId')
			                    ?? '';
			            summary =
			                str(payload, 'subject')
			                    ?? str(payload, 'summary')
			                    ?? str(payload, 'note')
			                    ?? (kind === 'unknown' ? row.factType : safePayloadSummary(payload));
			            detail = `${row.factType} · #${row.sequence} · ${row.createdAt}`;
			            const serialized = safePayloadSummary(payload);
			            if (serialized !== '{}')
			                detail = `${detail}\n${serialized}`;
			            break;
			        }
			    }
			    const actorLabel = actorInstanceId === '' ? '' : (labels.get(actorInstanceId) ?? actorInstanceId);
			    const navigationSessionId = actorInstanceId === '' ? '' : (navSessions.get(actorInstanceId) ?? '');
			    const at = Date.parse(row.createdAt);
			    return {
			        kind,
			        key: `ledger:${row.sequence}`,
			        sequence: row.sequence,
			        at: Number.isFinite(at) ? at : 0,
			        factType: row.factType,
			        ...(row.category === undefined ? {} : { category: row.category }),
			        actorInstanceId,
			        actorLabel,
			        summary,
			        detail,
			        pending,
			        ...(decisionValue === undefined ? {} : { decisionValue }),
			        ...(decisionReason === undefined ? {} : { decisionReason }),
			        ...(progressValue === undefined ? {} : { progressValue }),
			        navigationSessionId,
			    };
			}
			/**
			 * Project the loaded ledger onto the Events-section model at one depth and
			 * one filter.
			 * @param input - the loaded ledger model, the snapshot (labels + navigation
			 *   targets), the render depth, the client-local filter, and the store's
			 *   completeness facts (total + frontier).
			 * @returns the loaded window (oldest first) plus the filtered loaded total,
			 *   the depth-axis hasMore flag, the completeness marker, and the partial
			 *   ledger's counted remainder.
			 */
			function deriveTeamLedgerSection(input) {
			    const { ledger, snapshot, loadedCount, filter, total, completeThrough } = input;
			    const labels = new Map();
			    const navSessions = new Map();
			    const templates = new Map();
			    for (const member of snapshot.members) {
			        labels.set(member.instanceId, member.label);
			        navSessions.set(member.instanceId, member.childSessionId ?? snapshot.teamSessionId);
			        templates.set(member.instanceId, member.templateId);
			    }
			    const pendingRequestIds = new Set();
			    for (const chain of ledger.controls) {
			        if (chain.pending === false)
			            continue;
			        pendingRequestIds.add(chain.requestId);
			    }
			    const intervalInstance = new Map();
			    for (const interval of ledger.intervals) {
			        if (intervalInstance.has(interval.correlation) === false)
			            intervalInstance.set(interval.correlation, interval.instanceId);
			    }
			    const items = [];
			    for (const row of ledger.entries) {
			        if (filter.category !== 'all' && (row.category === undefined || row.category !== filter.category))
			            continue;
			        const built = buildRow(row, labels, navSessions, templates, pendingRequestIds, intervalInstance);
			        if (filter.instanceId !== null) {
			            // Instance OR template filter (UI §27.4): a row matches its actor's
			            // own id or its actor's template; a row without an actor never matches.
			            const matches = built.actorInstanceId !== ''
			                && (built.actorInstanceId === filter.instanceId || templates.get(built.actorInstanceId) === filter.instanceId);
			            if (matches === false)
			                continue;
			        }
			        items.push({ sequence: row.sequence, row: built });
			    }
			    // The loaded entries arrive in durable sequence order; re-assert it
			    // (the sort identity is the SEQUENCE, never the timestamp).
			    items.sort((left, right) => left.sequence - right.sequence);
			    const filteredTotal = items.length;
			    const limit = Math.max(0, Math.min(loadedCount, filteredTotal));
			    const rows = items.slice(filteredTotal - limit).map(item => item.row);
			    const remainingCount = total === null ? 0 : Math.max(0, total - completeThrough);
			    return {
			        rows,
			        total: filteredTotal,
			        hasMore: limit < filteredTotal,
			        complete: ledger.completeness === 'complete',
			        remainingCount,
			    };
			}
			//# sourceMappingURL=team-ledger-model.js.map
			}, exports: {} };
		__mods["model/team-handoff.js"] = { done: false, fn: function (exports) {
			/**
			 * P9-T8 (S5-D) — pure model for the handoff flows (plan P9-S5 S5-D +
			 * Gate P9-G5; UI doc §32; Architecture §34): the `handoff.prepare`
			 * one-shot summary value (read-only preview — the source is NEVER
			 * re-read and the target team NEVER gets source-history live-read),
			 * the `handoff.create` state narrowing over the frozen
			 * `HandoffOperationState` wire mirror, and the client-side decision
			 * mapping of the §32.4 triad.
			 *
			 * Frozen-wire decision mapping (plan §10.5 verbatim: "retry 依赖
			 * (sourceSessionId, requestToken) idempotency; continue/cancel 是
			 * client-local decision，不添加 backend method"):
			 *
			 * - `creation-failed` → RETRY re-invokes `handoff.create` with the SAME
			 *   `(sourceSessionId, requestToken)`: the host re-drives ONLY the team
			 *   creation idempotently (the frozen context stays; the source is not
			 *   re-read — runtime/handoff/service.ts re-invocation semantics).
			 * - `awaiting-decision` → RETRY uses a FRESH request token: a same-token
			 *   re-invocation is a pure idempotent replay of the stored failure
			 *   (the one-shot summarization is NEVER re-run under a used token), so
			 *   a meaningful retry is a fresh operation. No double-creation risk:
			 *   `awaiting-decision` means NO team exists under the old token yet.
			 * - CONTINUE-WITHOUT-HANDOFF is always client-local: the panel falls
			 *   back to the standard non-handoff create sequence (native root +
			 *   `team.create`) — a new team WITHOUT handoff provenance; no backend
			 *   decision method exists on the frozen wire.
			 * - CANCEL is always client-local: the panel discards; no remote call,
			 *   no team.
			 *
			 * G5: the typed outcome parser is the shared `parseMemberCommandOutcome`
			 * (team-member-commands) — preserved verbatim, never exception-ified;
			 * no optimistic authority patch; projection pull exactly once on
			 * success (the completed team renders from the NEW session's projection
			 * after `openSession`, exactly as the T7 `team.create` path).
			 *
			 * Pure module: no React, no I/O. Erasable TS only.
			 * @module @dsh-agent-team/client/model/team-handoff
			 */
			/** Every frozen triad option (closed set, canonical order). */
			const HANDOFF_DECISION_OPTIONS = [
			    'retry',
			    'continue-without-handoff',
			    'cancel',
			];
			Object.defineProperty(exports, "HANDOFF_DECISION_OPTIONS", { enumerable: true, get: () => HANDOFF_DECISION_OPTIONS });
			/** Closed-set membership test for a triad option. */
			function isHandoffDecisionOption(value) {
			    return (typeof value === 'string' &&
			        HANDOFF_DECISION_OPTIONS.includes(value));
			}
			Object.defineProperty(exports, "isHandoffDecisionOption", { enumerable: true, get: () => isHandoffDecisionOption });
			function requireString(value, field) {
			    const raw = value[field];
			    if (typeof raw !== 'string') {
			        throw new Error(`HANDOFF_MALFORMED: ${field} must be a string`);
			    }
			    return raw;
			}
			/** Parse the `handoff.prepare` success value. */
			function parseHandoffPrepareValue(value) {
			    const record = asRecord(value, 'value');
			    const sourceSessionId = requireString(record, 'sourceSessionId');
			    const rawSummary = record['summary'];
			    if (typeof rawSummary !== 'object' || rawSummary === null || Array.isArray(rawSummary)) {
			        throw new Error('HANDOFF_MALFORMED: summary must be an object');
			    }
			    const summary = rawSummary;
			    const rawBullets = summary['bullets'];
			    if (!Array.isArray(rawBullets) || !rawBullets.every((b) => typeof b === 'string')) {
			        throw new Error('HANDOFF_MALFORMED: summary.bullets must be a string array');
			    }
			    return {
			        sourceSessionId,
			        title: requireString(summary, 'title'),
			        bullets: rawBullets,
			    };
			}
			Object.defineProperty(exports, "parseHandoffPrepareValue", { enumerable: true, get: () => parseHandoffPrepareValue });
			function asRecord(value, label) {
			    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			        throw new Error(`HANDOFF_MALFORMED: ${label} must be an object`);
			    }
			    return value;
			}
			function requireBool(value, field) {
			    const raw = value[field];
			    if (typeof raw !== 'boolean') {
			        throw new Error(`HANDOFF_MALFORMED: ${field} must be a boolean`);
			    }
			    return raw;
			}
			function parseTeamOutcome(value) {
			    const rawTeam = value['team'];
			    if (typeof rawTeam !== 'object' || rawTeam === null || Array.isArray(rawTeam)) {
			        throw new Error('HANDOFF_MALFORMED: team must be an object');
			    }
			    const team = rawTeam;
			    return {
			        teamSessionId: requireString(team, 'teamSessionId'),
			        rootSessionId: requireString(team, 'rootSessionId'),
			    };
			}
			function parseFailure(value) {
			    const rawFailure = value['failure'];
			    if (typeof rawFailure !== 'object' || rawFailure === null || Array.isArray(rawFailure)) {
			        throw new Error('HANDOFF_MALFORMED: failure must be an object');
			    }
			    const failure = rawFailure;
			    return {
			        failureCode: requireString(failure, 'code'),
			        failureMessage: requireString(failure, 'message'),
			    };
			}
			/**
			 * Parse the `handoff.create` success value (`{ state }` → the narrowed
			 * `HandoffOperationState` mirror). Unknown `kind` → the fail-safe
			 * `unknown` arm (rendered verbatim, never a crash).
			 */
			function parseHandoffCreateState(value) {
			    const record = asRecord(value, 'value');
			    const rawState = record['state'];
			    if (typeof rawState !== 'object' || rawState === null || Array.isArray(rawState)) {
			        throw new Error('HANDOFF_MALFORMED: state must be an object');
			    }
			    const state = rawState;
			    const kind = state['kind'];
			    const replayed = requireBool(state, 'replayed');
			    switch (kind) {
			        case 'completed': {
			            return { kind, replayed, ...parseTeamOutcome(state) };
			        }
			        case 'completed-without-handoff': {
			            return { kind, replayed, ...parseTeamOutcome(state) };
			        }
			        case 'canceled': {
			            return { kind, replayed };
			        }
			        case 'awaiting-decision': {
			            const rawOptions = state['options'];
			            const options = [];
			            if (Array.isArray(rawOptions)) {
			                for (const option of rawOptions) {
			                    if (isHandoffDecisionOption(option))
			                        options.push(option);
			                }
			            }
			            return {
			                kind,
			                replayed,
			                ...parseFailure(state),
			                options,
			            };
			        }
			        case 'creation-failed': {
			            return { kind, replayed, ...parseFailure(state) };
			        }
			        default: {
			            return { kind: 'unknown', raw: state };
			        }
			    }
			}
			Object.defineProperty(exports, "parseHandoffCreateState", { enumerable: true, get: () => parseHandoffCreateState });
			// --- the §32.4 triad mapping ---------------------------------------------------------
			/**
			 * The triad actions available for a create state:
			 * - `awaiting-decision` → the host-surfaced options (falling back to the
			 *   full frozen triad when the array is absent/empty);
			 * - `creation-failed` → RETRY only (the host re-drives creation; there
			 *   is no wire decision channel for the frozen-context path);
			 * - terminal states (`completed` / `completed-without-handoff` /
			 *   `canceled`) and `unknown` → no actions.
			 */
			function handoffDecisionActions(state) {
			    switch (state.kind) {
			        case 'awaiting-decision': {
			            return state.options.length > 0 ? state.options : HANDOFF_DECISION_OPTIONS;
			        }
			        case 'creation-failed':
			            return ['retry'];
			        default:
			            return [];
			    }
			}
			Object.defineProperty(exports, "handoffDecisionActions", { enumerable: true, get: () => handoffDecisionActions });
			function handoffRetryPlan(state, sourceSessionId, currentToken, nextToken) {
			    switch (state.kind) {
			        case 'creation-failed':
			            return { sourceSessionId, requestToken: currentToken, freshToken: false };
			        case 'awaiting-decision':
			            return { sourceSessionId, requestToken: nextToken, freshToken: true };
			        default:
			            return null;
			    }
			}
			Object.defineProperty(exports, "handoffRetryPlan", { enumerable: true, get: () => handoffRetryPlan });
			//# sourceMappingURL=team-handoff.js.map
			}, exports: {} };
		__mods["../../remote/src/index.js"] = { done: false, fn: function (exports) {
			/**
			 * @dsh-agent-team/remote — Remote contract v1 and host-side handlers.
			 *
			 * Responsibility (TaskDoc §11 package boundary, P8-T3): the typed Remote
			 * contract for the Team remote seam — the closed method catalog, the
			 * lossless-JSON wire envelope (request/response with provenance), the
			 * frozen-ID and boundary-code error vocabulary, the per-method closed
			 * param schemas, and the host-side handler layer that routes a parsed
			 * request to the category handlers backed by structural service ports.
			 *
			 * The remote never writes team state: handlers are read/projection and
			 * typed-effect surfaces over TeamDomain; the dispatcher guarantees the
			 * closed invariants (unknown method before envelope, per-method param
			 * parse, typed error results only, promise never rejects).
			 *
			 * Wiring note (host): registration goes through
			 * `registerRemoteHandlers` + `ctx.effect` in the host composition —
			 * this package itself has no seam dependency.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions (design note, deviation D-1: self-contained, no
			 * cross-package .ts imports).
			 * @module @dsh-agent-team/remote
			 */
			/**
			 * Stable identity marker of the remote package (skeleton contract, P1-T4:
			 * asserted by the package unit test; retained through P8-T3 additively).
			 */
			const PACKAGE_ID = 'remote';
			Object.defineProperty(exports, "PACKAGE_ID", { enumerable: true, get: () => PACKAGE_ID });
			Object.defineProperty(exports, "isRemoteSafeJsonValue", { enumerable: true, get: () => __re0.isRemoteSafeJsonValue });
			Object.defineProperty(exports, "assertRemoteSafeJsonValue", { enumerable: true, get: () => __re0.assertRemoteSafeJsonValue });
			Object.defineProperty(exports, "toRemoteSafeDetail", { enumerable: true, get: () => __re0.toRemoteSafeDetail });
			const __re0 = __req("../../remote/src/contracts/remote-safe.js");
			Object.defineProperty(exports, "REMOTE_CONTRACT_ERROR_CODES", { enumerable: true, get: () => __re1.REMOTE_CONTRACT_ERROR_CODES });
			Object.defineProperty(exports, "REMOTE_CONTRACT_ERROR_CODE_VALUES", { enumerable: true, get: () => __re1.REMOTE_CONTRACT_ERROR_CODE_VALUES });
			Object.defineProperty(exports, "RemoteContractError", { enumerable: true, get: () => __re1.RemoteContractError });
			Object.defineProperty(exports, "isRemoteContractError", { enumerable: true, get: () => __re1.isRemoteContractError });
			Object.defineProperty(exports, "remoteContractError", { enumerable: true, get: () => __re1.remoteContractError });
			const __re1 = __req("../../remote/src/contracts/errors.js");
			Object.defineProperty(exports, "REMOTE_ID_MAX_LENGTH", { enumerable: true, get: () => __re2.REMOTE_ID_MAX_LENGTH });
			Object.defineProperty(exports, "REMOTE_ID_ERROR_CODES", { enumerable: true, get: () => __re2.REMOTE_ID_ERROR_CODES });
			Object.defineProperty(exports, "parseRemoteTeamSessionId", { enumerable: true, get: () => __re2.parseRemoteTeamSessionId });
			Object.defineProperty(exports, "parseRemoteRootSessionId", { enumerable: true, get: () => __re2.parseRemoteRootSessionId });
			Object.defineProperty(exports, "parseRemoteSessionId", { enumerable: true, get: () => __re2.parseRemoteSessionId });
			Object.defineProperty(exports, "parseRemoteInstanceId", { enumerable: true, get: () => __re2.parseRemoteInstanceId });
			Object.defineProperty(exports, "parseRemoteTemplateId", { enumerable: true, get: () => __re2.parseRemoteTemplateId });
			Object.defineProperty(exports, "parseRemoteBlueprintId", { enumerable: true, get: () => __re2.parseRemoteBlueprintId });
			Object.defineProperty(exports, "parseRemoteBlueprintRevision", { enumerable: true, get: () => __re2.parseRemoteBlueprintRevision });
			const __re2 = __req("../../remote/src/contracts/ids.js");
			Object.defineProperty(exports, "REMOTE_CONTRACT_VERSION", { enumerable: true, get: () => __re3.REMOTE_CONTRACT_VERSION });
			Object.defineProperty(exports, "SUPPORTED_REMOTE_CONTRACT_VERSIONS", { enumerable: true, get: () => __re3.SUPPORTED_REMOTE_CONTRACT_VERSIONS });
			Object.defineProperty(exports, "isSupportedRemoteContractVersion", { enumerable: true, get: () => __re3.isSupportedRemoteContractVersion });
			Object.defineProperty(exports, "assertSupportedRemoteContractVersion", { enumerable: true, get: () => __re3.assertSupportedRemoteContractVersion });
			Object.defineProperty(exports, "parseRemoteContractVersion", { enumerable: true, get: () => __re3.parseRemoteContractVersion });
			const __re3 = __req("../../remote/src/contracts/version.js");
			Object.defineProperty(exports, "REMOTE_CATEGORIES", { enumerable: true, get: () => __re4.REMOTE_CATEGORIES });
			Object.defineProperty(exports, "REMOTE_CATEGORY_VALUES", { enumerable: true, get: () => __re4.REMOTE_CATEGORY_VALUES });
			Object.defineProperty(exports, "REMOTE_METHOD_CATALOG", { enumerable: true, get: () => __re4.REMOTE_METHOD_CATALOG });
			Object.defineProperty(exports, "REMOTE_METHOD_NAMES", { enumerable: true, get: () => __re4.REMOTE_METHOD_NAMES });
			Object.defineProperty(exports, "REMOTE_METHODS_BY_CATEGORY", { enumerable: true, get: () => __re4.REMOTE_METHODS_BY_CATEGORY });
			Object.defineProperty(exports, "isRemoteMethod", { enumerable: true, get: () => __re4.isRemoteMethod });
			Object.defineProperty(exports, "remoteCategoryOf", { enumerable: true, get: () => __re4.remoteCategoryOf });
			const __re4 = __req("../../remote/src/contracts/catalog.js");
			Object.defineProperty(exports, "REMOTE_REQUEST_FIELDS", { enumerable: true, get: () => __re5.REMOTE_REQUEST_FIELDS });
			Object.defineProperty(exports, "parseRemoteRequest", { enumerable: true, get: () => __re5.parseRemoteRequest });
			const __re5 = __req("../../remote/src/contracts/request.js");
			Object.defineProperty(exports, "REMOTE_ORIGIN", { enumerable: true, get: () => __re6.REMOTE_ORIGIN });
			Object.defineProperty(exports, "buildRemoteSuccess", { enumerable: true, get: () => __re6.buildRemoteSuccess });
			Object.defineProperty(exports, "buildRemoteError", { enumerable: true, get: () => __re6.buildRemoteError });
			const __re6 = __req("../../remote/src/contracts/response.js");
			Object.defineProperty(exports, "REMOTE_CAPABILITY_VALUES", { enumerable: true, get: () => __re7.REMOTE_CAPABILITY_VALUES });
			Object.defineProperty(exports, "REMOTE_PROBE_TRIGGER_VALUES", { enumerable: true, get: () => __re7.REMOTE_PROBE_TRIGGER_VALUES });
			Object.defineProperty(exports, "REMOTE_MUTATION_ACTOR_KINDS", { enumerable: true, get: () => __re7.REMOTE_MUTATION_ACTOR_KINDS });
			Object.defineProperty(exports, "REMOTE_MUTATION_SCOPES", { enumerable: true, get: () => __re7.REMOTE_MUTATION_SCOPES });
			Object.defineProperty(exports, "REMOTE_ADMISSION_ACTIONS", { enumerable: true, get: () => __re7.REMOTE_ADMISSION_ACTIONS });
			Object.defineProperty(exports, "REMOTE_CATALOG_LIST_FIELDS", { enumerable: true, get: () => __re7.REMOTE_CATALOG_LIST_FIELDS });
			Object.defineProperty(exports, "REMOTE_CATALOG_GET_FIELDS", { enumerable: true, get: () => __re7.REMOTE_CATALOG_GET_FIELDS });
			Object.defineProperty(exports, "REMOTE_INTENT_PROBE_FIELDS", { enumerable: true, get: () => __re7.REMOTE_INTENT_PROBE_FIELDS });
			Object.defineProperty(exports, "REMOTE_TEAM_CREATE_FIELDS", { enumerable: true, get: () => __re7.REMOTE_TEAM_CREATE_FIELDS });
			Object.defineProperty(exports, "REMOTE_TEAM_GET_PROJECTION_FIELDS", { enumerable: true, get: () => __re7.REMOTE_TEAM_GET_PROJECTION_FIELDS });
			Object.defineProperty(exports, "REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS", { enumerable: true, get: () => __re7.REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS });
			Object.defineProperty(exports, "REMOTE_MEMBER_CREATE_FIELDS", { enumerable: true, get: () => __re7.REMOTE_MEMBER_CREATE_FIELDS });
			Object.defineProperty(exports, "REMOTE_MEMBER_SEND_FIELDS", { enumerable: true, get: () => __re7.REMOTE_MEMBER_SEND_FIELDS });
			Object.defineProperty(exports, "REMOTE_MEMBER_FOLLOWUP_FIELDS", { enumerable: true, get: () => __re7.REMOTE_MEMBER_FOLLOWUP_FIELDS });
			Object.defineProperty(exports, "REMOTE_MEMBER_LIFECYCLE_FIELDS", { enumerable: true, get: () => __re7.REMOTE_MEMBER_LIFECYCLE_FIELDS });
			Object.defineProperty(exports, "REMOTE_OVERRIDE_GET_FIELDS", { enumerable: true, get: () => __re7.REMOTE_OVERRIDE_GET_FIELDS });
			Object.defineProperty(exports, "REMOTE_OVERRIDE_SET_FIELDS", { enumerable: true, get: () => __re7.REMOTE_OVERRIDE_SET_FIELDS });
			Object.defineProperty(exports, "REMOTE_OVERRIDE_RESET_FIELDS", { enumerable: true, get: () => __re7.REMOTE_OVERRIDE_RESET_FIELDS });
			Object.defineProperty(exports, "REMOTE_POLICY_STATE_GET_FIELDS", { enumerable: true, get: () => __re7.REMOTE_POLICY_STATE_GET_FIELDS });
			Object.defineProperty(exports, "REMOTE_POLICY_STATE_SET_FIELDS", { enumerable: true, get: () => __re7.REMOTE_POLICY_STATE_SET_FIELDS });
			Object.defineProperty(exports, "REMOTE_COMPATIBILITY_GET_FIELDS", { enumerable: true, get: () => __re7.REMOTE_COMPATIBILITY_GET_FIELDS });
			Object.defineProperty(exports, "REMOTE_COMPATIBILITY_ACK_FIELDS", { enumerable: true, get: () => __re7.REMOTE_COMPATIBILITY_ACK_FIELDS });
			Object.defineProperty(exports, "REMOTE_COMPATIBILITY_REPROBE_FIELDS", { enumerable: true, get: () => __re7.REMOTE_COMPATIBILITY_REPROBE_FIELDS });
			Object.defineProperty(exports, "REMOTE_HANDOFF_PREPARE_FIELDS", { enumerable: true, get: () => __re7.REMOTE_HANDOFF_PREPARE_FIELDS });
			Object.defineProperty(exports, "REMOTE_HANDOFF_CREATE_FIELDS", { enumerable: true, get: () => __re7.REMOTE_HANDOFF_CREATE_FIELDS });
			Object.defineProperty(exports, "REMOTE_LEGACY_INSPECT_FIELDS", { enumerable: true, get: () => __re7.REMOTE_LEGACY_INSPECT_FIELDS });
			Object.defineProperty(exports, "parseRemoteCatalogListParams", { enumerable: true, get: () => __re7.parseRemoteCatalogListParams });
			Object.defineProperty(exports, "parseRemoteCatalogGetParams", { enumerable: true, get: () => __re7.parseRemoteCatalogGetParams });
			Object.defineProperty(exports, "parseRemoteIntentProbeParams", { enumerable: true, get: () => __re7.parseRemoteIntentProbeParams });
			Object.defineProperty(exports, "parseRemoteTeamCreateParams", { enumerable: true, get: () => __re7.parseRemoteTeamCreateParams });
			Object.defineProperty(exports, "parseRemoteTeamGetProjectionParams", { enumerable: true, get: () => __re7.parseRemoteTeamGetProjectionParams });
			Object.defineProperty(exports, "parseRemoteTeamGetLedgerPageParams", { enumerable: true, get: () => __re7.parseRemoteTeamGetLedgerPageParams });
			Object.defineProperty(exports, "parseRemoteMemberCreateParams", { enumerable: true, get: () => __re7.parseRemoteMemberCreateParams });
			Object.defineProperty(exports, "parseRemoteMemberSendParams", { enumerable: true, get: () => __re7.parseRemoteMemberSendParams });
			Object.defineProperty(exports, "parseRemoteMemberFollowupParams", { enumerable: true, get: () => __re7.parseRemoteMemberFollowupParams });
			Object.defineProperty(exports, "parseRemoteMemberArchiveParams", { enumerable: true, get: () => __re7.parseRemoteMemberArchiveParams });
			Object.defineProperty(exports, "parseRemoteMemberRestoreParams", { enumerable: true, get: () => __re7.parseRemoteMemberRestoreParams });
			Object.defineProperty(exports, "parseRemoteMemberDisposeParams", { enumerable: true, get: () => __re7.parseRemoteMemberDisposeParams });
			Object.defineProperty(exports, "parseRemoteOverrideGetParams", { enumerable: true, get: () => __re7.parseRemoteOverrideGetParams });
			Object.defineProperty(exports, "parseRemoteOverrideSetParams", { enumerable: true, get: () => __re7.parseRemoteOverrideSetParams });
			Object.defineProperty(exports, "parseRemoteOverrideResetParams", { enumerable: true, get: () => __re7.parseRemoteOverrideResetParams });
			Object.defineProperty(exports, "parseRemotePolicyStateGetParams", { enumerable: true, get: () => __re7.parseRemotePolicyStateGetParams });
			Object.defineProperty(exports, "parseRemotePolicyStateSetParams", { enumerable: true, get: () => __re7.parseRemotePolicyStateSetParams });
			Object.defineProperty(exports, "parseRemoteCompatibilityGetParams", { enumerable: true, get: () => __re7.parseRemoteCompatibilityGetParams });
			Object.defineProperty(exports, "parseRemoteCompatibilityAckParams", { enumerable: true, get: () => __re7.parseRemoteCompatibilityAckParams });
			Object.defineProperty(exports, "parseRemoteCompatibilityReprobeParams", { enumerable: true, get: () => __re7.parseRemoteCompatibilityReprobeParams });
			Object.defineProperty(exports, "parseRemoteHandoffPrepareParams", { enumerable: true, get: () => __re7.parseRemoteHandoffPrepareParams });
			Object.defineProperty(exports, "parseRemoteHandoffCreateParams", { enumerable: true, get: () => __re7.parseRemoteHandoffCreateParams });
			Object.defineProperty(exports, "parseRemoteLegacyInspectParams", { enumerable: true, get: () => __re7.parseRemoteLegacyInspectParams });
			Object.defineProperty(exports, "parseRemoteMethodParams", { enumerable: true, get: () => __re7.parseRemoteMethodParams });
			const __re7 = __req("../../remote/src/contracts/params.js");
			Object.defineProperty(exports, "REMOTE_PROJECTION_FIELDS", { enumerable: true, get: () => __re8.REMOTE_PROJECTION_FIELDS });
			Object.defineProperty(exports, "REMOTE_LEDGER_ENTRY_FIELDS", { enumerable: true, get: () => __re8.REMOTE_LEDGER_ENTRY_FIELDS });
			const __re8 = __req("../../remote/src/contracts/types.js");
			Object.defineProperty(exports, "createRemoteCatalogHandler", { enumerable: true, get: () => __re9.createRemoteCatalogHandler });
			const __re9 = __req("../../remote/src/handlers/catalog.js");
			Object.defineProperty(exports, "createRemoteIntentHandler", { enumerable: true, get: () => __re10.createRemoteIntentHandler });
			const __re10 = __req("../../remote/src/handlers/intent.js");
			Object.defineProperty(exports, "createRemoteTeamHandler", { enumerable: true, get: () => __re11.createRemoteTeamHandler });
			const __re11 = __req("../../remote/src/handlers/team.js");
			Object.defineProperty(exports, "createRemoteMemberHandler", { enumerable: true, get: () => __re12.createRemoteMemberHandler });
			const __re12 = __req("../../remote/src/handlers/member.js");
			Object.defineProperty(exports, "createRemoteOverrideHandler", { enumerable: true, get: () => __re13.createRemoteOverrideHandler });
			const __re13 = __req("../../remote/src/handlers/override.js");
			Object.defineProperty(exports, "createRemotePolicyStateHandler", { enumerable: true, get: () => __re14.createRemotePolicyStateHandler });
			const __re14 = __req("../../remote/src/handlers/policy-state.js");
			Object.defineProperty(exports, "createRemoteCompatibilityHandler", { enumerable: true, get: () => __re15.createRemoteCompatibilityHandler });
			const __re15 = __req("../../remote/src/handlers/compatibility.js");
			Object.defineProperty(exports, "createRemoteHandoffHandler", { enumerable: true, get: () => __re16.createRemoteHandoffHandler });
			const __re16 = __req("../../remote/src/handlers/handoff.js");
			Object.defineProperty(exports, "createRemoteLegacyHandler", { enumerable: true, get: () => __re17.createRemoteLegacyHandler });
			const __re17 = __req("../../remote/src/handlers/legacy.js");
			Object.defineProperty(exports, "createRemoteDispatcher", { enumerable: true, get: () => __re18.createRemoteDispatcher });
			const __re18 = __req("../../remote/src/handlers/dispatch.js");
			Object.defineProperty(exports, "REMOTE_RPC_CHANNEL", { enumerable: true, get: () => __re19.REMOTE_RPC_CHANNEL });
			Object.defineProperty(exports, "registerRemoteHandlers", { enumerable: true, get: () => __re19.registerRemoteHandlers });
			const __re19 = __req("../../remote/src/handlers/register.js");
			// ---------------------------------------------------------------------------
			// P8-T4 push model (whole-projection generation, versioned invalidation +
			// pull): the pure client-side sync engine over the frozen contract v1
			// surface (Gate G8: a new state is never overwritten by a stale response).
			// ---------------------------------------------------------------------------
			Object.defineProperty(exports, "PushBackoffRangeError", { enumerable: true, get: () => __re20.PushBackoffRangeError });
			Object.defineProperty(exports, "backoffCapMs", { enumerable: true, get: () => __re20.backoffCapMs });
			Object.defineProperty(exports, "defaultDelayPicker", { enumerable: true, get: () => __re20.defaultDelayPicker });
			Object.defineProperty(exports, "isStateChange", { enumerable: true, get: () => __re20.isStateChange });
			Object.defineProperty(exports, "pickBackoffDelayMs", { enumerable: true, get: () => __re20.pickBackoffDelayMs });
			Object.defineProperty(exports, "stateOnConnect", { enumerable: true, get: () => __re20.stateOnConnect });
			Object.defineProperty(exports, "stateOnLoss", { enumerable: true, get: () => __re20.stateOnLoss });
			const __re20 = __req("../../remote/src/push/reconnect.js");
			Object.defineProperty(exports, "PUSH_MIN_GENERATION", { enumerable: true, get: () => __re21.PUSH_MIN_GENERATION });
			Object.defineProperty(exports, "decideFrameVerdict", { enumerable: true, get: () => __re21.decideFrameVerdict });
			Object.defineProperty(exports, "isStrictlyNewerGeneration", { enumerable: true, get: () => __re21.isStrictlyNewerGeneration });
			const __re21 = __req("../../remote/src/push/generation.js");
			Object.defineProperty(exports, "PULL_PROJECTION_ENDPOINT", { enumerable: true, get: () => __re22.PULL_PROJECTION_ENDPOINT });
			Object.defineProperty(exports, "assessProjectionSync", { enumerable: true, get: () => __re22.assessProjectionSync });
			Object.defineProperty(exports, "extractPushFrame", { enumerable: true, get: () => __re22.extractPushFrame });
			Object.defineProperty(exports, "isApplyAssessment", { enumerable: true, get: () => __re22.isApplyAssessment });
			const __re22 = __req("../../remote/src/push/pull.js");
			Object.defineProperty(exports, "createLedgerPageTracker", { enumerable: true, get: () => __re23.createLedgerPageTracker });
			Object.defineProperty(exports, "verifyLedgerPageAnchor", { enumerable: true, get: () => __re23.verifyLedgerPageAnchor });
			const __re23 = __req("../../remote/src/push/ledger-page.js");
			Object.defineProperty(exports, "PushTransportLossError", { enumerable: true, get: () => __re24.PushTransportLossError });
			const __re24 = __req("../../remote/src/push/types.js");
			//# sourceMappingURL=index.js.map
			}, exports: {} };
		__mods["model/team-governance.js"] = { done: false, fn: function (exports) {
			const __imp40 = __req("../../contracts/src/index.js");
			const ADMISSION_STATES = __imp40.ADMISSION_STATES;
			const EFFECTIVE_CONFIG_STATES = __imp40.EFFECTIVE_CONFIG_STATES;
			const __imp41 = __req("../../remote/src/index.js");
			const REMOTE_PROBE_TRIGGER_VALUES = __imp41.REMOTE_PROBE_TRIGGER_VALUES;
			/**
			 * P9-T8 (S5-C) — pure model for the config/governance command flows
			 * (plan P9-S5 S5-C + Gate P9-G5; UI doc §10/§18/§19/§21):
			 *
			 * - the closed re-probe trigger set (the five frozen DevPlan §20.1
			 *   triggers — the ONLY wire-legal `compatibility.reprobe` inputs);
			 * - the compatibility badge mapping (the four frozen AdmissionStates →
			 *   UI §10.2 marks) and the two wire-value parsers for the TWO distinct
			 *   compatibility shapes on the frozen contract v1 wire: the durable
			 *   `compatibility.get` state (aggregate `counts` block) and the
			 *   re-derived verdict (`compatibility.ack` / `compatibility.reprobe`
			 *   results, flat counters; the reprobe verdict carries the trigger);
			 * - the frozen Remote param builders (`override.get/set/reset`,
			 *   `policyState.get/set`, `compatibility.get/ack/reprobe`) — the
			 *   human actor convention `{ kind: 'human' }`;
			 * - the policy-state display mapping (state id shown verbatim — the
			 *   state id is an open blueprint-defined vocabulary; cell rows for the
			 *   `policyState.get` view) and the §19 hard-policy display rule
			 *   (never pretend an override beats a hard policy);
			 * - the per-member effective-config lane rows (UI §18.1/§18.3: value /
			 *   effective state / source / v2 additive flags, the DISTINCT state
			 *   words — never unified "Disabled").
			 *
			 * G5 outcome parsing: the typed-outcome parser is the shared
			 * `parseMemberCommandOutcome` (team-member-commands) — the remote typed
			 * result is preserved verbatim (`code`, `message`, the `requestToken`
			 * echo), never exception-ified, and no optimistic authority patch is
			 * ever applied. This module adds no second parser.
			 *
			 * Wire gap (recorded divergence, frozen contract v1): `compatibility.ack`
			 * requires a `requirementId`, but the frozen `compatibility.get` exposes
			 * AGGREGATE counts only — the durable per-requirement rows are not on
			 * the wire and there is no compatibility fact in the ledger. The ack
			 * param builder + parser are implemented and tested here; the UI renders
			 * the ack control DISABLED with the explicit reason (UI §38: no grey
			 * button without a reason).
			 *
			 * Pure module: no React, no I/O, no crypto. Erasable TS only.
			 * @module @dsh-agent-team/client/model/team-governance
			 */
			// --- the closed re-probe trigger set (DevPlan §20.1) --------------------------
			/** The five frozen re-probe triggers (wire-legal closed set; the frozen
			 * `REMOTE_PROBE_TRIGGER_VALUES` vocabulary, re-exported under the local
			 * name for the S5-C surface). */
			const GOVERNANCE_REPROBE_TRIGGERS = REMOTE_PROBE_TRIGGER_VALUES;
			Object.defineProperty(exports, "GOVERNANCE_REPROBE_TRIGGERS", { enumerable: true, get: () => GOVERNANCE_REPROBE_TRIGGERS });
			/** Closed-set membership test for a re-probe trigger. */
			function isReprobeTrigger(value) {
			    return (typeof value === 'string' &&
			        GOVERNANCE_REPROBE_TRIGGERS.includes(value));
			}
			Object.defineProperty(exports, "isReprobeTrigger", { enumerable: true, get: () => isReprobeTrigger });
			/**
			 * The human "Recheck" (§10.4: the user repaired the environment and asks
			 * for a new generation) mapped to the closed trigger vocabulary: a
			 * repaired environment is a capability-topology change, which is
			 * `CAPABILITY_GENERATION_CHANGE`. The other four triggers are
			 * lifecycle-driven and never human-initiated on this surface.
			 */
			const HUMAN_RECHECK_TRIGGER = 'CAPABILITY_GENERATION_CHANGE';
			Object.defineProperty(exports, "HUMAN_RECHECK_TRIGGER", { enumerable: true, get: () => HUMAN_RECHECK_TRIGGER });
			/** The frozen AdmissionState → badge mark map (UI §10.2 semantics). */
			const COMPATIBILITY_BADGE_MARKS = {
			    [ADMISSION_STATES.OPEN]: 'pass',
			    [ADMISSION_STATES.DEGRADED_ACKNOWLEDGED]: 'warning',
			    [ADMISSION_STATES.BLOCKED_WARNING]: 'warning',
			    [ADMISSION_STATES.BLOCKED_FATAL]: 'fatal',
			};
			Object.defineProperty(exports, "COMPATIBILITY_BADGE_MARKS", { enumerable: true, get: () => COMPATIBILITY_BADGE_MARKS });
			/**
			 * Resolve the UI §10.2 badge for a status string (the rendered status is
			 * ALWAYS the projection's `snapshot.compatibility.status` — G5(d); this
			 * only maps it to a mark).
			 * @param status - the admission status string.
			 * @returns the badge, or `null` when the string is outside the frozen
			 *   four-state vocabulary (the UI then renders the raw status verbatim).
			 */
			function compatibilityBadge(status) {
			    for (const state of Object.values(ADMISSION_STATES)) {
			        if (state === status) {
			            return { state, mark: COMPATIBILITY_BADGE_MARKS[state] };
			        }
			    }
			    return null;
			}
			Object.defineProperty(exports, "compatibilityBadge", { enumerable: true, get: () => compatibilityBadge });
			function asRecord(value, label) {
			    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			        throw new Error(`GOVERNANCE_MALFORMED: ${label} must be an object`);
			    }
			    return value;
			}
			function requireString(value, field) {
			    const raw = value[field];
			    if (typeof raw !== 'string') {
			        throw new Error(`GOVERNANCE_MALFORMED: ${field} must be a string`);
			    }
			    return raw;
			}
			function requireInt(value, field) {
			    const raw = value[field];
			    if (typeof raw !== 'number' || !Number.isSafeInteger(raw)) {
			        throw new Error(`GOVERNANCE_MALFORMED: ${field} must be a safe integer`);
			    }
			    return raw;
			}
			function parseCounts(value) {
			    const raw = value['counts'];
			    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
			        throw new Error('GOVERNANCE_MALFORMED: counts must be an object');
			    }
			    const counts = raw;
			    const counter = (key) => {
			        const cell = counts[key];
			        if (typeof cell !== 'number' || !Number.isSafeInteger(cell)) {
			            throw new Error(`GOVERNANCE_MALFORMED: counts.${key} must be a safe integer`);
			        }
			        return cell;
			    };
			    return {
			        pass: counter('pass'),
			        warning: counter('warning'),
			        fatal: counter('fatal'),
			        unackedWarning: counter('unackedWarning'),
			        staleAcknowledgement: counter('staleAcknowledgement'),
			    };
			}
			/**
			 * Parse the `compatibility.get` success value (the durable aggregate
			 * state). Throws `Error` with a stable `GOVERNANCE_MALFORMED:` prefix on
			 * a structurally malformed value (the UI renders the message verbatim
			 * as a local channel note — never a typed Remote error).
			 */
			function parseCompatibilityStateValue(value) {
			    const record = asRecord(value, 'value');
			    const counts = parseCounts(record);
			    return {
			        status: requireString(record, 'status'),
			        generation: requireInt(record, 'generation'),
			        environmentFingerprint: requireString(record, 'environmentFingerprint'),
			        recordedAt: requireString(record, 'recordedAt'),
			        ...counts,
			    };
			}
			Object.defineProperty(exports, "parseCompatibilityStateValue", { enumerable: true, get: () => parseCompatibilityStateValue });
			/**
			 * Parse the `compatibility.ack` / `compatibility.reprobe` success value
			 * (the re-derived verdict; flat counters, optional trigger).
			 */
			function parseCompatibilityVerdictValue(value) {
			    const record = asRecord(value, 'value');
			    const triggerRaw = record['trigger'];
			    return {
			        status: requireString(record, 'status'),
			        generation: requireInt(record, 'generation'),
			        environmentFingerprint: requireString(record, 'environmentFingerprint'),
			        recordedAt: requireString(record, 'recordedAt'),
			        pass: requireInt(record, 'pass'),
			        warning: requireInt(record, 'warning'),
			        fatal: requireInt(record, 'fatal'),
			        unackedWarning: requireInt(record, 'unackedWarning'),
			        staleAcknowledgement: 0,
			        trigger: typeof triggerRaw === 'string' ? triggerRaw : null,
			    };
			}
			Object.defineProperty(exports, "parseCompatibilityVerdictValue", { enumerable: true, get: () => parseCompatibilityVerdictValue });
			// --- the frozen Remote param builders (S5-C) ----------------------------------
			/**
			 * Build the `override.get` params (read: the Explicit Human Override
			 * record of one capability at one scope; `scope`/`targetInstanceId`
			 * travel together — target present iff scope is `'instance'`).
			 */
			function overrideGetParams(teamSessionId, capability, scope, targetInstanceId) {
			    return {
			        teamSessionId,
			        capability,
			        ...(scope !== undefined ? { scope } : {}),
			        ...(scope !== undefined && targetInstanceId !== undefined
			            ? { targetInstanceId }
			            : {}),
			    };
			}
			Object.defineProperty(exports, "overrideGetParams", { enumerable: true, get: () => overrideGetParams });
			/**
			 * Build the `override.set` params (the §19 override editor: it edits
			 * ONLY the Explicit Human Override layer — never the Blueprint).
			 */
			function overrideSetParams(teamSessionId, capability, value, scope, targetInstanceId) {
			    return {
			        teamSessionId,
			        capability,
			        value,
			        actor: { kind: 'human' },
			        ...(scope !== undefined ? { scope } : {}),
			        ...(scope !== undefined && targetInstanceId !== undefined
			            ? { targetInstanceId }
			            : {}),
			    };
			}
			Object.defineProperty(exports, "overrideSetParams", { enumerable: true, get: () => overrideSetParams });
			/** Build the `override.reset` params (removes the override; the value is recomputed from the lower layers). */
			function overrideResetParams(teamSessionId, capability, scope, targetInstanceId) {
			    return {
			        teamSessionId,
			        capability,
			        actor: { kind: 'human' },
			        ...(scope !== undefined ? { scope } : {}),
			        ...(scope !== undefined && targetInstanceId !== undefined
			            ? { targetInstanceId }
			            : {}),
			    };
			}
			Object.defineProperty(exports, "overrideResetParams", { enumerable: true, get: () => overrideResetParams });
			/** Build the `policyState.get` params. */
			function policyStateGetParams(teamSessionId) {
			    return { teamSessionId };
			}
			Object.defineProperty(exports, "policyStateGetParams", { enumerable: true, get: () => policyStateGetParams });
			/**
			 * Build the `policyState.set` params. The target is the frozen
			 * `PolicyStateView` mirror: the current `stateId` (from the projection —
			 * never invented locally) plus the cell map to commit.
			 */
			function policyStateSetParams(teamSessionId, stateId, cells) {
			    // The frozen param schema accepts a PARTIAL cell map (provided keys are
			    // validated against the closed capability set); the TS mirror over-
			    // constrains `cells` to the full record, so the cast carries the wire truth.
			    const target = cells !== undefined
			        ? { stateId, cells: { ...cells } }
			        : { stateId };
			    return { teamSessionId, target, actor: { kind: 'human' } };
			}
			/** Build the `compatibility.get` params. */
			export function compatibilityGetParams(teamSessionId) {
			    return { teamSessionId };
			}
			/**
			 * Build the `compatibility.ack` params. NOTE (wire gap): the frozen
			 * `compatibility.get` exposes aggregate counts only, so the UI cannot
			 * currently enumerate a `requirementId` to ack — the builder is complete
			 * and tested; the UI renders the ack control disabled with the explicit
			 * reason until the wire exposes the per-requirement rows.
			 */
			export function compatibilityAckParams(teamSessionId, requirementId, acknowledgedBy, note) {
			    return {
			        teamSessionId,
			        requirementId,
			        acknowledgedBy,
			        ...(note !== undefined ? { note } : {}),
			    };
			}
			/**
			 * Build the `compatibility.reprobe` params. The trigger MUST be one of
			 * the five frozen values (closed set — anything else throws before a
			 * wire round-trip is spent).
			 */
			export function compatibilityReprobeParams(teamSessionId, trigger) {
			    if (!isReprobeTrigger(trigger)) {
			        throw new Error(`GOVERNANCE_MALFORMED: compatibility.reprobe trigger '${trigger}' is outside the frozen closed set`);
			    }
			    return { teamSessionId, trigger };
			}
			/** Parse the `override.get` success value. */
			export function parseOverrideValue(value) {
			    const record = asRecord(value, 'value');
			    const raw = record['override'];
			    if (raw === null)
			        return { override: null };
			    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
			        throw new Error('GOVERNANCE_MALFORMED: override must be an object or null');
			    }
			    return { override: raw };
			}
			/**
			 * Parse the `policyState.get` success value (the frozen `PolicyStateView`
			 * mirror: `stateId` + optional `cells` keyed by closed capability).
			 */
			export function parsePolicyStateValue(value) {
			    const record = asRecord(value, 'value');
			    const stateId = requireString(record, 'stateId');
			    const rawCells = record['cells'];
			    const cells = [];
			    if (rawCells !== undefined) {
			        if (typeof rawCells !== 'object' || rawCells === null || Array.isArray(rawCells)) {
			            throw new Error('GOVERNANCE_MALFORMED: cells must be an object');
			        }
			        const cellsRecord = rawCells;
			        for (const capability of Object.keys(cellsRecord).sort()) {
			            const cell = cellsRecord[capability];
			            if (typeof cell !== 'object' || cell === null || Array.isArray(cell)) {
			                throw new Error(`GOVERNANCE_MALFORMED: cells['${capability}'] must be an object`);
			            }
			            const cellRecord = cell;
			            const locked = cellRecord['locked'] === true;
			            const entryRaw = cellRecord['value'];
			            let entry = null;
			            if (entryRaw !== undefined) {
			                if (typeof entryRaw !== 'object' ||
			                    entryRaw === null ||
			                    Array.isArray(entryRaw)) {
			                    throw new Error(`GOVERNANCE_MALFORMED: cells['${capability}'].value must be an object`);
			                }
			                const entryRecord = entryRaw;
			                const kind = entryRecord['kind'];
			                if (kind === 'deny') {
			                    entry = { kind: 'deny' };
			                }
			                else if (kind === 'allow') {
			                    const itemsRaw = entryRecord['items'];
			                    if (!Array.isArray(itemsRaw) || !itemsRaw.every((i) => typeof i === 'string')) {
			                        throw new Error(`GOVERNANCE_MALFORMED: cells['${capability}'].value.items must be a string array`);
			                    }
			                    entry = { kind: 'allow', items: itemsRaw };
			                }
			                else {
			                    throw new Error(`GOVERNANCE_MALFORMED: cells['${capability}'].value.kind must be 'allow' or 'deny'`);
			                }
			            }
			            cells.push({ capability: capability, locked, entry });
			        }
			    }
			    return { stateId, cells };
			}
			/**
			 * The §21 policy-state display mapping. State ids are blueprint-defined
			 * OPEN vocabulary (no closed list on the wire), so the display shows the
			 * id verbatim — no case transformation or invented alias (the UI §21
			 * `Policy [ Exploration ▾ ]` header renders the current state id from
			 * the projection).
			 */
			export function policyStateLabel(stateId) {
			    return stateId;
			}
			// --- the effective config lanes (UI §18) ----------------------------------------
			/** The §18.3 DISTINCT state words (never unified "Disabled"). */
			export const EFFECTIVE_CONFIG_STATE_WORDS = {
			    [EFFECTIVE_CONFIG_STATES.inherited]: 'Inherited',
			    [EFFECTIVE_CONFIG_STATES.overridden]: 'Overridden',
			    [EFFECTIVE_CONFIG_STATES.suppressed]: 'Suppressed',
			    [EFFECTIVE_CONFIG_STATES.unavailable]: 'Unavailable',
			    [EFFECTIVE_CONFIG_STATES.denied]: 'Denied',
			    [EFFECTIVE_CONFIG_STATES.locked]: 'Locked',
			    [EFFECTIVE_CONFIG_STATES.pending_next_boundary]: 'Pending next boundary',
			    [EFFECTIVE_CONFIG_STATES.degraded]: 'Degraded',
			};
			function laneRow(lane, entry) {
			    return {
			        lane,
			        value: entry.value,
			        source: entry.source,
			        state: entry.state,
			        stateWord: EFFECTIVE_CONFIG_STATE_WORDS[entry.state] ?? entry.state,
			        suppressed: entry.suppressed ?? null,
			        unavailable: entry.unavailable ?? null,
			        deniedBy: entry.deniedBy ?? null,
			        effectiveFrom: entry.effectiveFrom ?? null,
			        locked: entry.locked ?? null,
			    };
			}
			/**
			 * Flatten one member's effective config (v1 or v2 DTO — v1 entries are
			 * structural subsets of v2) into the lane rows: `model`, `workspace`,
			 * the sorted `permissions` entries, `autonomy` (UI §18.2 order).
			 */
			export function effectiveConfigLanes(dto) {
			    const rows = [
			        laneRow('model', dto.model),
			        laneRow('workspace', dto.workspace),
			    ];
			    for (const name of Object.keys(dto.permissions).sort()) {
			        const entry = dto.permissions[name];
			        if (entry !== undefined) {
			            rows.push(laneRow(`permissions:${name}`, entry));
			        }
			    }
			    rows.push(laneRow('autonomy', dto.autonomy));
			    return rows;
			}
			/**
			 * The §19 hard-policy display for a denied lane: `Requested: <value> /
			 * Effective: Denied / Reason: <deniedBy>`. `null` for every non-denied
			 * lane (an override is never shown as if it beat the policy).
			 */
			export function hardPolicyDisplay(row) {
			    if (row.state !== EFFECTIVE_CONFIG_STATES.denied || row.deniedBy === null) {
			        return null;
			    }
			    return {
			        requested: row.value ?? '(no value)',
			        effective: 'Denied',
			        reason: row.deniedBy,
			    };
			}
			//# sourceMappingURL=team-governance.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/remote-safe.js"] = { done: false, fn: function (exports) {
			const __imp20 = __req("../../remote/src/contracts/errors.js");
			const RemoteContractError = __imp20.RemoteContractError;
			/**
			 * Lossless-JSON value discipline for the Remote contract v1 boundary.
			 *
			 * Value-level mirror of `packages/contracts/src/remote-safe.ts` (contracts
			 * v1, P3-T1) — the frozen module remains the authority for the shape of
			 * `RemoteSafeJsonValue`; this mirror exists because `packages/remote` is
			 * deliberately self-contained (no cross-package `.ts` imports; see the P8-T3
			 * design note, deviation D-1) while carrying an identical wire vocabulary.
			 *
			 * A value is *lossless-JSON-safe* when it survives a
			 * `JSON.stringify` / `JSON.parse` round-trip without losing information:
			 * `null`, booleans, FINITE numbers (not `NaN`, not `±Infinity`, not `-0` —
			 * `-0` serializes to `0`), strings, arrays of safe values, and PLAIN objects
			 * (prototype `Object.prototype` or `null`) of safe values. `undefined`,
			 * functions, symbols, `Date`s, `BigInt`s, class instances, and circular
			 * structures are rejected.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
			 * @module @dsh-agent-team/remote/contracts/remote-safe
			 */
			/** The JSON value kinds, in deterministic report order. */
			function kindOf(value) {
			    if (value === null)
			        return 'null';
			    if (Array.isArray(value))
			        return 'array';
			    return typeof value;
			}
			/**
			 * Is `value` a lossless-JSON value (see module doc)?
			 * @param value - the unknown input.
			 * @returns `true` when a `JSON.stringify`/`JSON.parse` round-trip preserves it.
			 */
			function isRemoteSafeJsonValue(value) {
			    if (value === null)
			        return true;
			    switch (typeof value) {
			        case 'boolean':
			            return true;
			        case 'number':
			            return Number.isFinite(value) && !Object.is(value, -0);
			        case 'string':
			            return true;
			        case 'object': {
			            if (Array.isArray(value)) {
			                for (const item of value) {
			                    if (!isRemoteSafeJsonValue(item))
			                        return false;
			                }
			                return true;
			            }
			            const proto = Object.getPrototypeOf(value);
			            if (proto !== null && proto !== Object.prototype)
			                return false;
			            for (const key of Object.keys(value)) {
			                if (!isRemoteSafeJsonValue(value[key])) {
			                    return false;
			                }
			            }
			            return true;
			        }
			        default:
			            return false;
			    }
			}
			Object.defineProperty(exports, "isRemoteSafeJsonValue", { enumerable: true, get: () => isRemoteSafeJsonValue });
			/**
			 * Assert `value` is a lossless-JSON value.
			 * @param value - the unknown input.
			 * @param path - the JSON-path label used in the error detail.
			 * @returns the input typed as a safe JSON value.
			 * @throws {RemoteContractError} `internal-error` (boundary integrity failure)
			 *   when the value is not lossless-JSON safe.
			 */
			function assertRemoteSafeJsonValue(value, path = '$') {
			    if (!isRemoteSafeJsonValue(value)) {
			        throw new RemoteContractError('internal-error', `remote boundary integrity failure: value at ${path} is not lossless-JSON safe (kind: ${kindOf(value)})`, { path, kind: kindOf(value) });
			    }
			    return value;
			}
			Object.defineProperty(exports, "assertRemoteSafeJsonValue", { enumerable: true, get: () => assertRemoteSafeJsonValue });
			/**
			 * Reduce an unknown value to a lossless-JSON-safe detail representation for
			 * inclusion in wire error details (never a raw object reference, never a
			 * cycle).
			 * @param value - the unknown input (typically an error `details` payload).
			 * @returns the safe value when the input is already lossless-JSON safe;
			 *   otherwise a short `[non-lossless-<kind>]` marker string.
			 */
			function toRemoteSafeDetail(value) {
			    if (isRemoteSafeJsonValue(value)) {
			        // A JSON round-trip yields a detached, plain, lossless copy (the input
			        // may be a frozen or class-shaped record; the copy is wire-ready).
			        return JSON.parse(JSON.stringify(value));
			    }
			    const kind = kindOf(value);
			    return `[non-lossless-${kind}]`;
			}
			//# sourceMappingURL=remote-safe.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/errors.js"] = { done: false, fn: function (exports) {
			/**
			 * Closed wire-error vocabulary of the Remote contract v1 boundary.
			 *
			 * Two closed code sets travel on the Remote wire (design note, deviation
			 * D-3):
			 *
			 * 1. **Boundary codes** — failure classes the remote layer itself detects
			 *    (unsupported contract version, unknown method, malformed request
			 *    envelope, malformed method params, and the last-resort internal
			 *    failure). Lowercase-kebab vocabulary, owned by this package.
			 * 2. **Mirrored frozen P3 codes** — the value-level mirror of the ID
			 *    validation codes of contracts v1 (`packages/contracts/src/ids/*`),
			 *    thrown by the local ID parsers in `ids.ts`. The wire values are the
			 *    EXACT frozen strings (invariant 9: a TeamSessionId violation surfaces
			 *    as `INVALID_ROOT_SESSION_ID`, because `parseTeamSessionId` IS
			 *    `parseRootSessionId` in the frozen contracts).
			 *
			 * Backing-service closed codes (P6-T2 admission, P7-T1 compatibility,
			 * P7-T2 mutation, P7-T3 lifecycle, P7-T5 handoff, P7-T7 legacy reader) pass
			 * through the dispatcher unchanged when they arrive as typed errors (own
			 * string `code` on an `Error`) — see `handlers/dispatch.ts`.
			 *
			 * NO raw exception ever reaches the wire: an error result is always
			 * `{ code, message, details }` with lossless-JSON-checked details.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
			 * @module @dsh-agent-team/remote/contracts/errors
			 */
			/**
			 * The closed Remote-boundary error codes (contract v1). Adding a code is a
			 * remote contract change (a version bump), never a silent edit.
			 */
			const REMOTE_CONTRACT_ERROR_CODES = {
			    /** The request `version` is not in the supported set. */
			    CONTRACT_VERSION_UNSUPPORTED: 'contract-version-unsupported',
			    /** The endpoint is not a method of the closed catalog. */
			    UNKNOWN_METHOD: 'unknown-method',
			    /** The request envelope itself is malformed (or carries unsafe values). */
			    MALFORMED_REQUEST: 'malformed-request',
			    /** A method's `params` object fails that method's closed schema. */
			    MALFORMED_PARAMS: 'malformed-params',
			    /** Last-resort dispatcher failure (handler/port threw an untyped error). */
			    INTERNAL_ERROR: 'internal-error',
			};
			Object.defineProperty(exports, "REMOTE_CONTRACT_ERROR_CODES", { enumerable: true, get: () => REMOTE_CONTRACT_ERROR_CODES });
			/** Every boundary code value, for closed-set membership tests. */
			const REMOTE_CONTRACT_ERROR_CODE_VALUES = Object.freeze(Object.values(REMOTE_CONTRACT_ERROR_CODES));
			Object.defineProperty(exports, "REMOTE_CONTRACT_ERROR_CODE_VALUES", { enumerable: true, get: () => REMOTE_CONTRACT_ERROR_CODE_VALUES });
			/**
			 * A typed remote-contract error: the error the remote layer itself throws
			 * (boundary codes) or its local parsers throw (mirrored frozen P3 codes).
			 *
			 * `code` is typed `string` on purpose: the closed registries this package
			 * emits are {@link REMOTE_CONTRACT_ERROR_CODES} (boundary) and
			 * {@link REMOTE_ID_ERROR_CODES} (`ids.ts`, mirrored P3 values). The wire
			 * union additionally carries pass-through backing-service codes (D-3) that
			 * the dispatcher maps without re-typing.
			 */
			class RemoteContractError extends Error {
			    /** The closed error code (boundary or mirrored frozen P3 value). */
			    code;
			    /**
			     * Lossless-JSON-safe structured details (absent when the failure carries
			     * none). Always plain data — never a live object reference.
			     */
			    details;
			    constructor(code, message, details) {
			        super(message);
			        this.name = 'RemoteContractError';
			        this.code = code;
			        if (details !== undefined) {
			            this.details = { ...details };
			        }
			    }
			}
			Object.defineProperty(exports, "RemoteContractError", { enumerable: true, get: () => RemoteContractError });
			/**
			 * Type guard for {@link RemoteContractError}.
			 * @param value - the unknown input.
			 */
			function isRemoteContractError(value) {
			    return value instanceof RemoteContractError;
			}
			Object.defineProperty(exports, "isRemoteContractError", { enumerable: true, get: () => isRemoteContractError });
			/**
			 * Build a typed remote-contract error.
			 * @param code - the closed code (boundary or mirrored frozen P3 value).
			 * @param message - the human-readable wire message (no stack, no internals).
			 * @param details - optional lossless-JSON-safe structured details.
			 */
			function remoteContractError(code, message, details) {
			    return new RemoteContractError(code, message, details);
			}
			Object.defineProperty(exports, "remoteContractError", { enumerable: true, get: () => remoteContractError });
			//# sourceMappingURL=errors.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/ids.js"] = { done: false, fn: function (exports) {
			const __imp23 = __req("../../remote/src/contracts/errors.js");
			const remoteContractError = __imp23.remoteContractError;
			/**
			 * Identity parsing at the Remote contract v1 boundary.
			 *
			 * Value-level mirror of the P3 ID rules in `packages/contracts/src/ids/*`
			 * (frozen contracts v1 — the authority): every DSH session id is an opaque
			 * branded string; the vNext boundary rules reject structurally unusable
			 * values without inventing an upstream format:
			 *
			 * - non-empty string;
			 * - at most 255 characters;
			 * - no ASCII control characters (0x00–0x1F, 0x7F);
			 * - no whitespace characters.
			 *
			 * The WIRE CODES are the exact frozen P3 values (design note, deviation
			 * D-1): a TeamSessionId violation surfaces as `INVALID_ROOT_SESSION_ID`
			 * (invariant 9: `TeamSessionId = RootSessionId`, and the frozen
			 * `parseTeamSessionId` delegates to `parseRootSessionId`), an InstanceId
			 * violation as `INVALID_INSTANCE_ID`, and so on — so a client matching the
			 * P3 contract vocabulary sees the frozen codes on the Remote wire.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
			 * @module @dsh-agent-team/remote/contracts/ids
			 */
			/** Maximum structural length of any id parsed at the remote boundary. */
			const REMOTE_ID_MAX_LENGTH = 255;
			Object.defineProperty(exports, "REMOTE_ID_MAX_LENGTH", { enumerable: true, get: () => REMOTE_ID_MAX_LENGTH });
			/**
			 * The mirrored frozen P3 ID error codes (exact values of
			 * `packages/contracts/src/ids/*` — `TeamContractErrorCode` subset).
			 */
			const REMOTE_ID_ERROR_CODES = {
			    /** A generic DSH session id violates the rule. */
			    INVALID_SESSION_ID: 'INVALID_SESSION_ID',
			    /** A root / team session id violates the rule (invariant 9: same value). */
			    INVALID_ROOT_SESSION_ID: 'INVALID_ROOT_SESSION_ID',
			    /** A member child session id violates the rule. */
			    INVALID_CHILD_SESSION_ID: 'INVALID_CHILD_SESSION_ID',
			    /** A member instance id violates the rule. */
			    INVALID_INSTANCE_ID: 'INVALID_INSTANCE_ID',
			    /** A member template id violates the rule. */
			    INVALID_TEMPLATE_ID: 'INVALID_TEMPLATE_ID',
			    /** A blueprint id violates the rule. */
			    INVALID_BLUEPRINT_ID: 'INVALID_BLUEPRINT_ID',
			};
			Object.defineProperty(exports, "REMOTE_ID_ERROR_CODES", { enumerable: true, get: () => REMOTE_ID_ERROR_CODES });
			/**
			 * Format an unknown raw value for an error message (never throws; never
			 * leaks a live object — only its structural JSON form or a kind marker).
			 */
			function formatRaw(raw) {
			    try {
			        const text = JSON.stringify(raw);
			        if (text !== undefined)
			            return text;
			    }
			    catch {
			        /* circular / unsafe — fall through to the kind marker */
			    }
			    if (raw === null)
			        return 'null';
			    return typeof raw;
			}
			/** Rejects ASCII control characters and DEL (0x00-0x1F, 0x7F). */
			function hasControlChars(value) {
			    for (let i = 0; i < value.length; i++) {
			        const code = value.charCodeAt(i);
			        if (code < 0x20 || code === 0x7f)
			            return true;
			    }
			    return false;
			}
			/** Rejects any whitespace character (Unicode `\s`). */
			function hasWhitespace(value) {
			    return /\s/.test(value);
			}
			/**
			 * Assert `raw` is a string satisfying the structural ID rule.
			 * @param raw - the unknown input.
			 * @param field - the field name, used in the error message/detail.
			 * @param code - the (mirrored frozen P3) code to throw.
			 * @returns the input as a plain string.
			 * @throws {RemoteContractError} the given `code` on any violation.
			 */
			function assertRemoteIdValue(raw, field, code) {
			    if (typeof raw !== 'string') {
			        throw remoteContractError(code, `${field} must be a string, got ${formatRaw(raw)}`, { field });
			    }
			    if (raw.length === 0) {
			        throw remoteContractError(code, `${field} must not be empty`, { field });
			    }
			    if (raw.length > REMOTE_ID_MAX_LENGTH) {
			        throw remoteContractError(code, `${field} must be at most ${REMOTE_ID_MAX_LENGTH} characters (got ${raw.length})`, { field, length: raw.length });
			    }
			    if (hasControlChars(raw)) {
			        throw remoteContractError(code, `${field} must not contain control characters`, { field });
			    }
			    if (hasWhitespace(raw)) {
			        throw remoteContractError(code, `${field} must not contain whitespace`, { field });
			    }
			    return raw;
			}
			/**
			 * Parse and validate a TeamSession id (== the root session id, invariant 9).
			 * @throws `INVALID_ROOT_SESSION_ID` on any rule violation (frozen P3 value).
			 */
			function parseRemoteTeamSessionId(raw, field = 'teamSessionId') {
			    return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_ROOT_SESSION_ID);
			}
			Object.defineProperty(exports, "parseRemoteTeamSessionId", { enumerable: true, get: () => parseRemoteTeamSessionId });
			/**
			 * Parse and validate a root session id (team.create input).
			 * @throws `INVALID_ROOT_SESSION_ID` on any rule violation (frozen P3 value).
			 */
			function parseRemoteRootSessionId(raw, field = 'rootSessionId') {
			    return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_ROOT_SESSION_ID);
			}
			Object.defineProperty(exports, "parseRemoteRootSessionId", { enumerable: true, get: () => parseRemoteRootSessionId });
			/**
			 * Parse and validate a generic DSH session id (e.g. a handoff source).
			 * @throws `INVALID_SESSION_ID` on any rule violation (frozen P3 value).
			 */
			function parseRemoteSessionId(raw, field = 'sourceSessionId') {
			    return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_SESSION_ID);
			}
			Object.defineProperty(exports, "parseRemoteSessionId", { enumerable: true, get: () => parseRemoteSessionId });
			/**
			 * Parse and validate a member instance id (instance-first addressing).
			 * @throws `INVALID_INSTANCE_ID` on any rule violation (frozen P3 value).
			 */
			function parseRemoteInstanceId(raw, field = 'instanceId') {
			    return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_INSTANCE_ID);
			}
			Object.defineProperty(exports, "parseRemoteInstanceId", { enumerable: true, get: () => parseRemoteInstanceId });
			/**
			 * Parse and validate a member template id.
			 * @throws `INVALID_TEMPLATE_ID` on any rule violation (frozen P3 value).
			 */
			function parseRemoteTemplateId(raw, field = 'templateId') {
			    return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_TEMPLATE_ID);
			}
			Object.defineProperty(exports, "parseRemoteTemplateId", { enumerable: true, get: () => parseRemoteTemplateId });
			/**
			 * Parse and validate a blueprint id.
			 * @throws `INVALID_BLUEPRINT_ID` on any rule violation (frozen P3 value).
			 */
			function parseRemoteBlueprintId(raw, field = 'blueprintId') {
			    return assertRemoteIdValue(raw, field, REMOTE_ID_ERROR_CODES.INVALID_BLUEPRINT_ID);
			}
			Object.defineProperty(exports, "parseRemoteBlueprintId", { enumerable: true, get: () => parseRemoteBlueprintId });
			/**
			 * Parse and validate a blueprint revision (positive safe integer).
			 * @throws `INVALID_BLUEPRINT_REVISION` on any violation (frozen P3 value).
			 */
			function parseRemoteBlueprintRevision(raw, field = 'blueprintRevision') {
			    if (typeof raw !== 'number' ||
			        !Number.isInteger(raw) ||
			        raw < 1 ||
			        !Number.isSafeInteger(raw)) {
			        throw remoteContractError('INVALID_BLUEPRINT_REVISION', `${field} must be a positive integer, got ${formatRaw(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseRemoteBlueprintRevision", { enumerable: true, get: () => parseRemoteBlueprintRevision });
			//# sourceMappingURL=ids.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/version.js"] = { done: false, fn: function (exports) {
			const __imp21 = __req("../../remote/src/contracts/errors.js");
			const remoteContractError = __imp21.remoteContractError;
			/**
			 * Remote contract version discipline (contract v1).
			 *
			 * Mirrors the P8-T1 schema-version pattern of
			 * `packages/contracts/src/schema-version.ts` (value-level mirror; the frozen
			 * module remains the authority for the *pattern*):
			 *
			 * - a request whose `version` is not in the supported set is a
			 *   `contract-version-unsupported` error;
			 * - a request whose `version` is missing or not a positive integer is a
			 *   `malformed-request` error (the envelope itself is malformed);
			 * - version bumps are contract changes: a new version is introduced by a new
			 *   remote contract version that ADDS (never edits) the supported-set
			 *   semantics; v1 endpoints keep working.
			 *
			 * Every response (success or error) echoes the serving `contractVersion` in
			 * provenance / error details, so a client can attribute the reply.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
			 * @module @dsh-agent-team/remote/contracts/version
			 */
			/**
			 * The remote contract version stamped by this build.
			 * Frozen by P8-T3; changing or replacing it is a remote contract change.
			 */
			const REMOTE_CONTRACT_VERSION = 1;
			Object.defineProperty(exports, "REMOTE_CONTRACT_VERSION", { enumerable: true, get: () => REMOTE_CONTRACT_VERSION });
			/** All remote contract versions this build accepts. Frozen: `[1]`. */
			const SUPPORTED_REMOTE_CONTRACT_VERSIONS = [1];
			Object.defineProperty(exports, "SUPPORTED_REMOTE_CONTRACT_VERSIONS", { enumerable: true, get: () => SUPPORTED_REMOTE_CONTRACT_VERSIONS });
			/**
			 * Is `value` a supported remote contract version (a positive integer in the
			 * supported set)?
			 * @param value - the raw value.
			 */
			function isSupportedRemoteContractVersion(value) {
			    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
			        return false;
			    return SUPPORTED_REMOTE_CONTRACT_VERSIONS.includes(value);
			}
			Object.defineProperty(exports, "isSupportedRemoteContractVersion", { enumerable: true, get: () => isSupportedRemoteContractVersion });
			/**
			 * Assert `value` is in the supported set.
			 * @throws {RemoteContractError} `contract-version-unsupported` otherwise.
			 */
			function assertSupportedRemoteContractVersion(value) {
			    if (!isSupportedRemoteContractVersion(value)) {
			        throw remoteContractError('contract-version-unsupported', `remote contract version ${String(value)} is not supported (supported: ${JSON.stringify([...SUPPORTED_REMOTE_CONTRACT_VERSIONS])})`, { field: 'version', value: String(value) });
			    }
			}
			Object.defineProperty(exports, "assertSupportedRemoteContractVersion", { enumerable: true, get: () => assertSupportedRemoteContractVersion });
			/**
			 * Parse the request `version` field of a remote request envelope.
			 * @param value - the raw `version` value.
			 * @returns the version number (guaranteed a supported positive integer).
			 * @throws {RemoteContractError} `malformed-request` when the value is not a
			 *   positive integer (the envelope is malformed), or
			 *   `contract-version-unsupported` when it is an integer outside the
			 *   supported set.
			 */
			function parseRemoteContractVersion(value) {
			    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
			        throw remoteContractError('malformed-request', `request 'version' must be a positive integer, got ${JSON.stringify(value)}`, { field: 'version', value: String(value) });
			    }
			    assertSupportedRemoteContractVersion(value);
			    return value;
			}
			Object.defineProperty(exports, "parseRemoteContractVersion", { enumerable: true, get: () => parseRemoteContractVersion });
			//# sourceMappingURL=version.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/catalog.js"] = { done: false, fn: function (exports) {
			/**
			 * The CLOSED method catalog of the Remote contract v1.
			 *
			 * Development Plan §21.3 freezes the API CATEGORY SET (the separation is
			 * fixed; the exact method names were chosen here and are now frozen for
			 * contract v1):
			 *
			 *   catalog, intent, team, member, override, policyState,
			 *   compatibility, handoff, legacy
			 *
			 * 9 categories, 23 methods. Adding a method or category is a remote
			 * contract change (a version bump), never a silent edit — the catalog is
			 * the closed surface a client may call through the seam channel
			 * `/team-remote` (one dotted method name per endpoint; see
			 * `handlers/register.ts`).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
			 * @module @dsh-agent-team/remote/contracts/catalog
			 */
			/** The closed Remote contract v1 categories (DevPlan §21.3 — fixed). */
			const REMOTE_CATEGORIES = {
			    /** Read access to the blueprint catalog (pre-creation discovery). */
			    CATALOG: 'catalog',
			    /** Pre-creation compatibility probing (Architecture §7 TeamIntent flow). */
			    INTENT: 'intent',
			    /** TeamSession lifecycle + observation (create / projection / ledger). */
			    TEAM: 'team',
			    /** MemberInstance operations (create / send / follow-up / lifecycle). */
			    MEMBER: 'member',
			    /** Autonomy overlays and explicit human overrides (Architecture §19.4/§19.5). */
			    OVERRIDE: 'override',
			    /** The TeamSession PolicyState (Architecture §20; invariant 40). */
			    POLICY_STATE: 'policyState',
			    /** Durable environment-compatibility state (Architecture §27/§28). */
			    COMPATIBILITY: 'compatibility',
			    /** Start-a-team-from-here handoff (Architecture §34). */
			    HANDOFF: 'handoff',
			    /** Read-only legacy Team inspection (DevPlan §20.6 degradation). */
			    LEGACY: 'legacy',
			};
			Object.defineProperty(exports, "REMOTE_CATEGORIES", { enumerable: true, get: () => REMOTE_CATEGORIES });
			/** Every category value, in declaration order. */
			const REMOTE_CATEGORY_VALUES = Object.freeze(Object.values(REMOTE_CATEGORIES));
			Object.defineProperty(exports, "REMOTE_CATEGORY_VALUES", { enumerable: true, get: () => REMOTE_CATEGORY_VALUES });
			/**
			 * The closed Remote contract v1 method catalog (23 methods).
			 * Key = endpoint = method name (dotted: `<category>.<action>`).
			 */
			const REMOTE_METHOD_CATALOG = {
			    'catalog.list': { category: REMOTE_CATEGORIES.CATALOG },
			    'catalog.get': { category: REMOTE_CATEGORIES.CATALOG },
			    'intent.probe': { category: REMOTE_CATEGORIES.INTENT },
			    'team.create': { category: REMOTE_CATEGORIES.TEAM },
			    'team.getProjection': { category: REMOTE_CATEGORIES.TEAM },
			    'team.getLedgerPage': { category: REMOTE_CATEGORIES.TEAM },
			    'member.create': { category: REMOTE_CATEGORIES.MEMBER },
			    'member.send': { category: REMOTE_CATEGORIES.MEMBER },
			    'member.followup': { category: REMOTE_CATEGORIES.MEMBER },
			    'member.archive': { category: REMOTE_CATEGORIES.MEMBER },
			    'member.restore': { category: REMOTE_CATEGORIES.MEMBER },
			    'member.dispose': { category: REMOTE_CATEGORIES.MEMBER },
			    'override.get': { category: REMOTE_CATEGORIES.OVERRIDE },
			    'override.set': { category: REMOTE_CATEGORIES.OVERRIDE },
			    'override.reset': { category: REMOTE_CATEGORIES.OVERRIDE },
			    'policyState.get': { category: REMOTE_CATEGORIES.POLICY_STATE },
			    'policyState.set': { category: REMOTE_CATEGORIES.POLICY_STATE },
			    'compatibility.get': { category: REMOTE_CATEGORIES.COMPATIBILITY },
			    'compatibility.ack': { category: REMOTE_CATEGORIES.COMPATIBILITY },
			    'compatibility.reprobe': { category: REMOTE_CATEGORIES.COMPATIBILITY },
			    'handoff.prepare': { category: REMOTE_CATEGORIES.HANDOFF },
			    'handoff.create': { category: REMOTE_CATEGORIES.HANDOFF },
			    'legacy.inspect': { category: REMOTE_CATEGORIES.LEGACY },
			};
			Object.defineProperty(exports, "REMOTE_METHOD_CATALOG", { enumerable: true, get: () => REMOTE_METHOD_CATALOG });
			/** Every method name, in deterministic (sorted) order. */
			const REMOTE_METHOD_NAMES = Object.freeze(Object.keys(REMOTE_METHOD_CATALOG).sort());
			Object.defineProperty(exports, "REMOTE_METHOD_NAMES", { enumerable: true, get: () => REMOTE_METHOD_NAMES });
			/**
			 * Per-category method lists (deterministic, sorted), for catalog reporting
			 * and test assertions.
			 */
			function methodsForCategory(category) {
			    return REMOTE_METHOD_NAMES.filter((name) => REMOTE_METHOD_CATALOG[name]?.category === category);
			}
			const REMOTE_METHODS_BY_CATEGORY = Object.freeze({
			    catalog: methodsForCategory(REMOTE_CATEGORIES.CATALOG),
			    intent: methodsForCategory(REMOTE_CATEGORIES.INTENT),
			    team: methodsForCategory(REMOTE_CATEGORIES.TEAM),
			    member: methodsForCategory(REMOTE_CATEGORIES.MEMBER),
			    override: methodsForCategory(REMOTE_CATEGORIES.OVERRIDE),
			    policyState: methodsForCategory(REMOTE_CATEGORIES.POLICY_STATE),
			    compatibility: methodsForCategory(REMOTE_CATEGORIES.COMPATIBILITY),
			    handoff: methodsForCategory(REMOTE_CATEGORIES.HANDOFF),
			    legacy: methodsForCategory(REMOTE_CATEGORIES.LEGACY),
			});
			Object.defineProperty(exports, "REMOTE_METHODS_BY_CATEGORY", { enumerable: true, get: () => REMOTE_METHODS_BY_CATEGORY });
			/**
			 * Is `name` a method of the closed catalog?
			 * @param name - the candidate endpoint / method name.
			 */
			function isRemoteMethod(name) {
			    return typeof name === 'string' && name in REMOTE_METHOD_CATALOG;
			}
			Object.defineProperty(exports, "isRemoteMethod", { enumerable: true, get: () => isRemoteMethod });
			/**
			 * The category of a catalog method.
			 * @param method - a method name known to be in the catalog.
			 * @returns the owning category.
			 */
			function remoteCategoryOf(method) {
			    const spec = REMOTE_METHOD_CATALOG[method];
			    if (spec === undefined) {
			        throw new TypeError(`remote catalog: unknown method '${method}'`);
			    }
			    return spec.category;
			}
			Object.defineProperty(exports, "remoteCategoryOf", { enumerable: true, get: () => remoteCategoryOf });
			//# sourceMappingURL=catalog.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/request.js"] = { done: false, fn: function (exports) {
			const __imp19 = __req("../../remote/src/contracts/errors.js");
			const remoteContractError = __imp19.remoteContractError;
			const __imp20 = __req("../../remote/src/contracts/remote-safe.js");
			const assertRemoteSafeJsonValue = __imp20.assertRemoteSafeJsonValue;
			const __imp21 = __req("../../remote/src/contracts/version.js");
			const parseRemoteContractVersion = __imp21.parseRemoteContractVersion;
			/**
			 * The Remote contract v1 request envelope.
			 *
			 * Every request the client sends through the seam (`POST
			 * /<channel>/<endpoint>`, body `{ type: 'client-request', rpcId, method,
			 * payload }` — P2-T6 characterization) carries, in `payload`, exactly:
			 *
			 * ```
			 * { "version": <positive integer in SUPPORTED_REMOTE_CONTRACT_VERSIONS>,
			 *   "params":  { ...the method's closed param object... } }
			 * ```
			 *
			 * The envelope is CLOSED: unknown top-level fields are rejected
			 * (`malformed-request`). Per-method `params` validation lives in
			 * `params.ts` (each method has its own closed field set).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
			 * @module @dsh-agent-team/remote/contracts/request
			 */
			/** The closed top-level fields of a remote request envelope. */
			const REMOTE_REQUEST_FIELDS = ['params', 'version'];
			Object.defineProperty(exports, "REMOTE_REQUEST_FIELDS", { enumerable: true, get: () => REMOTE_REQUEST_FIELDS });
			/** Is `value` a plain (non-array) object? */
			function isPlainRecord(value) {
			    if (value === null || typeof value !== 'object' || Array.isArray(value))
			        return false;
			    const proto = Object.getPrototypeOf(value);
			    return proto === null || proto === Object.prototype;
			}
			/**
			 * Parse the `payload` of one remote request into the typed envelope.
			 * @param payload - the raw seam payload (the client's `payload` field).
			 * @returns the parsed envelope (lossless-JSON-safe by construction).
			 * @throws {RemoteContractError} `malformed-request` when the payload is not
			 *   a lossless-JSON-safe closed record, when `version` is missing or not a
			 *   positive integer, when `params` is missing or not an object, or when an
			 *   unknown top-level field is present; `contract-version-unsupported` when
			 *   `version` is a positive integer outside the supported set.
			 */
			function parseRemoteRequest(payload) {
			    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
			        throw remoteContractError('malformed-request', `request payload must be an object, got ${payload === null ? 'null' : typeof payload}`);
			    }
			    assertRemoteSafeJsonValue(payload, '$');
			    const record = payload;
			    for (const key of Object.keys(record)) {
			        if (key !== 'version' && key !== 'params') {
			            throw remoteContractError('malformed-request', `request envelope has unknown field '${key}' (closed fields: ${REMOTE_REQUEST_FIELDS.join(', ')})`, { field: key });
			        }
			    }
			    if (!('version' in record)) {
			        throw remoteContractError('malformed-request', "request envelope is missing required field 'version'", { field: 'version' });
			    }
			    const version = parseRemoteContractVersion(record['version']);
			    if (!('params' in record)) {
			        throw remoteContractError('malformed-request', "request envelope is missing required field 'params'", { field: 'params' });
			    }
			    const params = record['params'];
			    if (!isPlainRecord(params)) {
			        throw remoteContractError('malformed-request', `request 'params' must be an object, got ${params === null ? 'null' : typeof params}`, { field: 'params' });
			    }
			    const safeParams = assertRemoteSafeJsonValue(params, 'params');
			    return { version, params: safeParams };
			}
			Object.defineProperty(exports, "parseRemoteRequest", { enumerable: true, get: () => parseRemoteRequest });
			//# sourceMappingURL=request.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/response.js"] = { done: false, fn: function (exports) {
			const __imp46 = __req("../../remote/src/contracts/version.js");
			const REMOTE_CONTRACT_VERSION = __imp46.REMOTE_CONTRACT_VERSION;
			const __imp47 = __req("../../remote/src/contracts/remote-safe.js");
			const assertRemoteSafeJsonValue = __imp47.assertRemoteSafeJsonValue;
			const toRemoteSafeDetail = __imp47.toRemoteSafeDetail;
			/**
			 * The Remote contract v1 response envelope + provenance.
			 *
			 * The dispatcher (see `handlers/dispatch.ts`) returns exactly one of:
			 *
			 * ```
			 * // success — every value carries provenance (G8):
			 * { "ok": true,
			 *   "value": { "data": <typed method value>,
			 *              "provenance": {
			 *                "origin": "team-remote",
			 *                "method": "<catalog method>",
			 *                "endpoint": "<seam endpoint>",
			 *                "contractVersion": 1,
			 *                "requestToken": "<echo>" | null,
			 *                "projectionGeneration": <number> | null,
			 *                "effectSequence": <number> | null
			 *              } } }
			 *
			 * // failure — typed code + message, never a raw exception:
			 * { "ok": false,
			 *   "error": { "code": "<closed code>",
			 *              "message": "<wire message>",
			 *              "details": { "method", "endpoint", "contractVersion",
			 *                           "requestToken", "field"? , "reason"?, "cause"? } } }
			 * ```
			 *
			 * Provenance semantics (design note §5):
			 * - `origin` — the fixed package origin marker (`team-remote`), so UI state
			 *   can attribute its source;
			 * - `method` / `endpoint` — the catalog method that served the request
			 *   (they are equal by construction);
			 * - `contractVersion` — the version that served the request;
			 * - `requestToken` — request echo for the token-carrying methods
			 *   (member.create/send/followup, handoff.create) — the client matches
			 *   async replies to its own logical operations (Architecture §18.2);
			 * - `projectionGeneration` — the whole-projection generation
			 *   (team.getProjection): the client detects stale responses by comparing
			 *   against its last accepted generation for the same team session
			 *   (the frozen `isStaleTeamProjection` discipline, P8-T1);
			 * - `effectSequence` — the durable effect sequence when the underlying
			 *   action has one (admission outcomes).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
			 * @module @dsh-agent-team/remote/contracts/response
			 */
			/** The fixed origin marker of the Remote surface. */
			const REMOTE_ORIGIN = 'team-remote';
			Object.defineProperty(exports, "REMOTE_ORIGIN", { enumerable: true, get: () => REMOTE_ORIGIN });
			/**
			 * Build a success result: lossless-JSON-checks `data` and attaches the
			 * provenance block.
			 * @param data - the typed method value (checked before the reply is built).
			 * @param ctx - the per-request provenance context.
			 * @throws {RemoteContractError} `internal-error` when `data` is not
			 *   lossless-JSON safe (a backing port returned an unsafe value).
			 */
			function buildRemoteSuccess(data, ctx) {
			    const checkedData = assertRemoteSafeJsonValue(data, 'value.data');
			    const provenance = {
			        origin: REMOTE_ORIGIN,
			        method: ctx.method,
			        endpoint: ctx.endpoint,
			        contractVersion: ctx.contractVersion,
			        requestToken: ctx.requestToken,
			        projectionGeneration: ctx.projectionGeneration === undefined ? null : ctx.projectionGeneration,
			        effectSequence: ctx.effectSequence === undefined ? null : ctx.effectSequence,
			    };
			    return { ok: true, value: { data: checkedData, provenance } };
			}
			Object.defineProperty(exports, "buildRemoteSuccess", { enumerable: true, get: () => buildRemoteSuccess });
			/**
			 * Build an error result: typed code + message + structured details (with
			 * the provenance fields folded into `details` so the client can attribute
			 * the failure).
			 * @param code - the closed error code.
			 * @param message - the wire message.
			 * @param ctx - the per-request provenance context.
			 * @param extra - optional extra detail fields (`field`, `reason`, `cause`,
			 *   and the source error's details, lossless-checked under `cause.details`).
			 */
			function buildRemoteError(code, message, ctx, extra) {
			    const details = {
			        method: ctx.method,
			        endpoint: ctx.endpoint,
			        contractVersion: ctx.contractVersion,
			        requestToken: ctx.requestToken,
			        ...(extra?.field !== undefined ? { field: extra.field } : {}),
			        ...(extra?.reason !== undefined ? { reason: extra.reason } : {}),
			        ...(extra?.cause !== undefined
			            ? {
			                cause: {
			                    code: extra.cause.code,
			                    message: extra.cause.message,
			                    ...(extra.sourceDetails !== undefined
			                        ? { details: toRemoteSafeDetail(extra.sourceDetails) }
			                        : {}),
			                },
			            }
			            : {}),
			    };
			    return { ok: false, error: { code, message, details } };
			}
			Object.defineProperty(exports, "buildRemoteError", { enumerable: true, get: () => buildRemoteError });
			/** The contract version constant re-exported for response builders. */
			Object.defineProperty(exports, "REMOTE_CONTRACT_VERSION", { enumerable: true, get: () => REMOTE_SERVED_VERSION });
			//# sourceMappingURL=response.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/params.js"] = { done: false, fn: function (exports) {
			const __imp24 = __req("../../remote/src/contracts/errors.js");
			const remoteContractError = __imp24.remoteContractError;
			const __imp25 = __req("../../remote/src/contracts/ids.js");
			const parseRemoteBlueprintId = __imp25.parseRemoteBlueprintId;
			const parseRemoteBlueprintRevision = __imp25.parseRemoteBlueprintRevision;
			const parseRemoteInstanceId = __imp25.parseRemoteInstanceId;
			const parseRemoteRootSessionId = __imp25.parseRemoteRootSessionId;
			const parseRemoteSessionId = __imp25.parseRemoteSessionId;
			const parseRemoteTeamSessionId = __imp25.parseRemoteTeamSessionId;
			const parseRemoteTemplateId = __imp25.parseRemoteTemplateId;
			const REMOTE_ID_MAX_LENGTH = __imp25.REMOTE_ID_MAX_LENGTH;
			const __imp26 = __req("../../remote/src/contracts/remote-safe.js");
			const assertRemoteSafeJsonValue = __imp26.assertRemoteSafeJsonValue;
			/**
			 * Per-method closed param schemas of the Remote contract v1.
			 *
			 * Every catalog method declares a CLOSED set of param fields (design note
			 * §3 table, "Input params (closed)"). Parsing one request's `params`
			 * object:
			 *
			 * 1. rejects any unknown field (`malformed-params`, reason
			 *    `unknown-field`, the offending field in `details.field`);
			 * 2. requires every required field (`missing-required`);
			 * 3. validates each value — structural ID fields throw the mirrored frozen
			 *    P3 codes from `ids.ts` (e.g. a malformed TeamSessionId surfaces as
			 *    `INVALID_ROOT_SESSION_ID`, invariant 9), everything else throws
			 *    `malformed-params` with a machine-readable `reason`;
			 * 4. returns the typed param object the handler layer consumes.
			 *
			 * Free-form content fields (the message `body`, the compatibility `note`)
			 * are exempt from the no-control-char / no-whitespace ID rule — newlines
			 * are legal content — but bound by a length cap (design note §3).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/contracts/params
			 */
			// ---------------------------------------------------------------------------
			// Shared closed vocabularies (value-level mirrors of the frozen contracts)
			// ---------------------------------------------------------------------------
			/** The closed capability set (`packages/domain/policy` `CAPABILITY_NAMES`). */
			const REMOTE_CAPABILITY_VALUES = [
			    'model',
			    'tools',
			    'permissions',
			    'skills',
			    'mcp',
			];
			Object.defineProperty(exports, "REMOTE_CAPABILITY_VALUES", { enumerable: true, get: () => REMOTE_CAPABILITY_VALUES });
			/** The five frozen probe triggers (`packages/runtime/compatibility`). */
			const REMOTE_PROBE_TRIGGER_VALUES = [
			    'ROOT_COLD_RESUME',
			    'MEMBER_COLD_RESUME',
			    'NEW_ACTIVATION',
			    'CAPABILITY_GENERATION_CHANGE',
			    'STALE_GENERATION_BEFORE_NEW_WORK',
			];
			Object.defineProperty(exports, "REMOTE_PROBE_TRIGGER_VALUES", { enumerable: true, get: () => REMOTE_PROBE_TRIGGER_VALUES });
			/** The closed mutation actor kinds (`packages/runtime/mutation`). */
			const REMOTE_MUTATION_ACTOR_KINDS = ['human', 'leader', 'member'];
			Object.defineProperty(exports, "REMOTE_MUTATION_ACTOR_KINDS", { enumerable: true, get: () => REMOTE_MUTATION_ACTOR_KINDS });
			/** The closed mutation scopes. */
			const REMOTE_MUTATION_SCOPES = ['team', 'instance'];
			Object.defineProperty(exports, "REMOTE_MUTATION_SCOPES", { enumerable: true, get: () => REMOTE_MUTATION_SCOPES });
			/** The closed admission actions the remote surface exposes (P6-T2). */
			const REMOTE_ADMISSION_ACTIONS = [
			    'create-member',
			    'send-message',
			    'follow-up',
			];
			Object.defineProperty(exports, "REMOTE_ADMISSION_ACTIONS", { enumerable: true, get: () => REMOTE_ADMISSION_ACTIONS });
			// ---------------------------------------------------------------------------
			// Closed field sets (one per method — the "closed" part of the schemas)
			// ---------------------------------------------------------------------------
			const REMOTE_CATALOG_LIST_FIELDS = [];
			Object.defineProperty(exports, "REMOTE_CATALOG_LIST_FIELDS", { enumerable: true, get: () => REMOTE_CATALOG_LIST_FIELDS });
			const REMOTE_CATALOG_GET_FIELDS = ['blueprintId', 'blueprintRevision'];
			Object.defineProperty(exports, "REMOTE_CATALOG_GET_FIELDS", { enumerable: true, get: () => REMOTE_CATALOG_GET_FIELDS });
			const REMOTE_INTENT_PROBE_FIELDS = [
			    'blueprintId',
			    'blueprintRevision',
			    'environmentFacts',
			];
			Object.defineProperty(exports, "REMOTE_INTENT_PROBE_FIELDS", { enumerable: true, get: () => REMOTE_INTENT_PROBE_FIELDS });
			const REMOTE_TEAM_CREATE_FIELDS = [
			    'blueprintId',
			    'blueprintRevision',
			    'initialWork',
			    'rootSessionId',
			];
			Object.defineProperty(exports, "REMOTE_TEAM_CREATE_FIELDS", { enumerable: true, get: () => REMOTE_TEAM_CREATE_FIELDS });
			const REMOTE_TEAM_GET_PROJECTION_FIELDS = ['teamSessionId'];
			Object.defineProperty(exports, "REMOTE_TEAM_GET_PROJECTION_FIELDS", { enumerable: true, get: () => REMOTE_TEAM_GET_PROJECTION_FIELDS });
			const REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS = [
			    'afterSequence',
			    'limit',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS", { enumerable: true, get: () => REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS });
			const REMOTE_MEMBER_CREATE_FIELDS = [
			    'caller',
			    'delegationInstanceId',
			    'delegationTemplateId',
			    'payload',
			    'requestToken',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_MEMBER_CREATE_FIELDS", { enumerable: true, get: () => REMOTE_MEMBER_CREATE_FIELDS });
			const REMOTE_MEMBER_SEND_FIELDS = [
			    'body',
			    'caller',
			    'payload',
			    'recipientInstanceId',
			    'requestToken',
			    'subject',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_MEMBER_SEND_FIELDS", { enumerable: true, get: () => REMOTE_MEMBER_SEND_FIELDS });
			const REMOTE_MEMBER_FOLLOWUP_FIELDS = [
			    'caller',
			    'payload',
			    'requestToken',
			    'targetInstanceId',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_MEMBER_FOLLOWUP_FIELDS", { enumerable: true, get: () => REMOTE_MEMBER_FOLLOWUP_FIELDS });
			const REMOTE_MEMBER_LIFECYCLE_FIELDS = [
			    'instanceId',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_MEMBER_LIFECYCLE_FIELDS", { enumerable: true, get: () => REMOTE_MEMBER_LIFECYCLE_FIELDS });
			const REMOTE_OVERRIDE_GET_FIELDS = [
			    'capability',
			    'scope',
			    'targetInstanceId',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_OVERRIDE_GET_FIELDS", { enumerable: true, get: () => REMOTE_OVERRIDE_GET_FIELDS });
			const REMOTE_OVERRIDE_SET_FIELDS = [
			    'actor',
			    'capability',
			    'scope',
			    'targetInstanceId',
			    'teamSessionId',
			    'value',
			];
			Object.defineProperty(exports, "REMOTE_OVERRIDE_SET_FIELDS", { enumerable: true, get: () => REMOTE_OVERRIDE_SET_FIELDS });
			const REMOTE_OVERRIDE_RESET_FIELDS = [
			    'actor',
			    'capability',
			    'scope',
			    'targetInstanceId',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_OVERRIDE_RESET_FIELDS", { enumerable: true, get: () => REMOTE_OVERRIDE_RESET_FIELDS });
			const REMOTE_POLICY_STATE_GET_FIELDS = ['teamSessionId'];
			Object.defineProperty(exports, "REMOTE_POLICY_STATE_GET_FIELDS", { enumerable: true, get: () => REMOTE_POLICY_STATE_GET_FIELDS });
			const REMOTE_POLICY_STATE_SET_FIELDS = [
			    'actor',
			    'target',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_POLICY_STATE_SET_FIELDS", { enumerable: true, get: () => REMOTE_POLICY_STATE_SET_FIELDS });
			const REMOTE_COMPATIBILITY_GET_FIELDS = ['teamSessionId'];
			Object.defineProperty(exports, "REMOTE_COMPATIBILITY_GET_FIELDS", { enumerable: true, get: () => REMOTE_COMPATIBILITY_GET_FIELDS });
			const REMOTE_COMPATIBILITY_ACK_FIELDS = [
			    'acknowledgedBy',
			    'note',
			    'requirementId',
			    'teamSessionId',
			];
			Object.defineProperty(exports, "REMOTE_COMPATIBILITY_ACK_FIELDS", { enumerable: true, get: () => REMOTE_COMPATIBILITY_ACK_FIELDS });
			const REMOTE_COMPATIBILITY_REPROBE_FIELDS = [
			    'teamSessionId',
			    'trigger',
			];
			Object.defineProperty(exports, "REMOTE_COMPATIBILITY_REPROBE_FIELDS", { enumerable: true, get: () => REMOTE_COMPATIBILITY_REPROBE_FIELDS });
			const REMOTE_HANDOFF_PREPARE_FIELDS = ['sourceSessionId'];
			Object.defineProperty(exports, "REMOTE_HANDOFF_PREPARE_FIELDS", { enumerable: true, get: () => REMOTE_HANDOFF_PREPARE_FIELDS });
			const REMOTE_HANDOFF_CREATE_FIELDS = [
			    'requestToken',
			    'sourceSessionId',
			    'staged',
			];
			Object.defineProperty(exports, "REMOTE_HANDOFF_CREATE_FIELDS", { enumerable: true, get: () => REMOTE_HANDOFF_CREATE_FIELDS });
			const REMOTE_LEGACY_INSPECT_FIELDS = [
			    'dshHome',
			    'projectDir',
			    'workspaceCwd',
			];
			Object.defineProperty(exports, "REMOTE_LEGACY_INSPECT_FIELDS", { enumerable: true, get: () => REMOTE_LEGACY_INSPECT_FIELDS });
			// ---------------------------------------------------------------------------
			// Shared parsing helpers (module-private)
			// ---------------------------------------------------------------------------
			/** Is `value` a plain (non-array) object? */
			function isPlainRecord(value) {
			    if (value === null || typeof value !== 'object' || Array.isArray(value))
			        return false;
			    const proto = Object.getPrototypeOf(value);
			    return proto === null || proto === Object.prototype;
			}
			/** Build a `malformed-params` boundary error with the standard details. */
			function paramMalformed(method, field, reason, message) {
			    return remoteContractError('malformed-params', message, { method, field, reason });
			}
			/** Reject any field of `params` outside the method's closed field set. */
			function assertNoUnknownFields(method, params, allowed) {
			    for (const key of Object.keys(params)) {
			        if (!allowed.includes(key)) {
			            throw paramMalformed(method, key, 'unknown-field', `method '${method}' has unknown param field '${key}' (closed fields: ${allowed.length > 0 ? allowed.join(', ') : 'none'})`);
			        }
			    }
			}
			/** Reject any key of `object` outside `allowed` (sub-object closed check). */
			function assertNoUnknownKeys(method, fieldPath, object, allowed) {
			    for (const key of Object.keys(object)) {
			        if (!allowed.includes(key)) {
			            throw paramMalformed(method, `${fieldPath}.${key}`, 'unknown-field', `${fieldPath} has unknown field '${key}' (closed fields: ${allowed.join(', ')})`);
			        }
			    }
			}
			/** Read a required field (throws `missing-required` when absent). */
			function requiredField(method, params, field) {
			    if (!(field in params) || params[field] === undefined) {
			        throw paramMalformed(method, field, 'missing-required', `method '${method}' requires param field '${field}'`);
			    }
			    return params[field];
			}
			/** Read an optional field (`undefined` when absent). */
			function optionalField(method, params, field) {
			    if (!(field in params) || params[field] === undefined)
			        return undefined;
			    return params[field];
			}
			/** Rejects ASCII control characters and DEL (0x00–0x1F, 0x7F). */
			function hasControlChars(value) {
			    for (let i = 0; i < value.length; i++) {
			        const code = value.charCodeAt(i);
			        if (code < 0x20 || code === 0x7f)
			            return true;
			    }
			    return false;
			}
			/** Rejects any whitespace character (Unicode `\s`). */
			function hasWhitespace(value) {
			    return /\s/.test(value);
			}
			/**
			 * A structural opaque token (request tokens, human ids, requirement ids,
			 * state ids, subjects): string, 1..255 chars, no control chars, no
			 * whitespace. (The ID rule of `ids.ts` minus the frozen P3 code.)
			 */
			function parseRemoteOpaqueToken(value, method, field) {
			    if (typeof value !== 'string' || value.length === 0 || value.length > REMOTE_ID_MAX_LENGTH) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be a string of 1..${REMOTE_ID_MAX_LENGTH} characters`);
			    }
			    if (hasControlChars(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must not contain control characters`);
			    }
			    if (hasWhitespace(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must not contain whitespace`);
			    }
			    return value;
			}
			/**
			 * A filesystem path (legacy.inspect fields): string, 1..4096 chars, no
			 * control characters (whitespace allowed — Windows paths carry spaces).
			 */
			function parseRemotePath(value, method, field) {
			    if (typeof value !== 'string' || value.length === 0 || value.length > 4096) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be a string of 1..4096 characters`);
			    }
			    if (hasControlChars(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must not contain control characters`);
			    }
			    return value;
			}
			/** A free-form content string (message body): 1..200000 chars, any content. */
			function parseRemoteBody(value, method, field) {
			    if (typeof value !== 'string' || value.length === 0 || value.length > 200000) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be a non-empty string of at most 200000 characters`);
			    }
			    return value;
			}
			/** A free-form note (compatibility.ack): 1..2048 chars, any content. */
			function parseRemoteNote(value, method, field) {
			    if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be a non-empty string of at most 2048 characters`);
			    }
			    return value;
			}
			/** A non-negative safe integer (ledger `afterSequence`). */
			function parseRemoteNonNegativeInt(value, method, field) {
			    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || !Number.isSafeInteger(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be a non-negative integer, got ${String(value)}`);
			    }
			    return value;
			}
			/** A bounded positive safe integer (ledger `limit`: 1..500). */
			function parseRemoteBoundedInt(value, method, field, max) {
			    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be an integer in 1..${max}, got ${String(value)}`);
			    }
			    return value;
			}
			/** A closed-enum string field. */
			function parseRemoteEnum(value, method, field, allowed) {
			    if (typeof value !== 'string' || !allowed.includes(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be one of: ${allowed.join(' | ')}`);
			    }
			    return value;
			}
			/** A plain-record field (lossless safety already guaranteed by the envelope). */
			function parseRemoteLosslessRecord(value, method, field) {
			    if (!isPlainRecord(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object, got ${value === null ? 'null' : typeof value}`);
			    }
			    return assertRemoteSafeJsonValue(value, field);
			}
			/** The admission caller object (closed per `kind`). */
			function parseRemoteCaller(value, method, field) {
			    if (!isPlainRecord(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object with kind 'human' or 'instance'`);
			    }
			    const kind = value['kind'];
			    if (kind === 'human') {
			        assertNoUnknownKeys(method, field, value, ['humanId', 'kind']);
			        const humanId = requiredField(method, value, 'humanId');
			        return { kind: 'human', humanId: parseRemoteOpaqueToken(humanId, method, `${field}.humanId`) };
			    }
			    if (kind === 'instance') {
			        assertNoUnknownKeys(method, field, value, ['instanceId', 'kind']);
			        const instanceId = requiredField(method, value, 'instanceId');
			        return {
			            kind: 'instance',
			            instanceId: parseRemoteInstanceId(instanceId, `${field}.instanceId`),
			        };
			    }
			    throw paramMalformed(method, `${field}.kind`, 'invalid-value', `${field}.kind must be 'human' or 'instance'`);
			}
			/** The mutation actor object (closed per `kind`; `member` requires its identity). */
			function parseRemoteMutationActor(value, method, field) {
			    if (!isPlainRecord(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object with kind 'human', 'leader', or 'member'`);
			    }
			    const kind = value['kind'];
			    if (kind === 'human' || kind === 'leader') {
			        assertNoUnknownKeys(method, field, value, ['kind']);
			        return { kind };
			    }
			    if (kind === 'member') {
			        assertNoUnknownKeys(method, field, value, ['kind', 'member']);
			        const rawMember = requiredField(method, value, 'member');
			        if (!isPlainRecord(rawMember)) {
			            throw paramMalformed(method, `${field}.member`, 'invalid-value', `${field}.member must be an object { rootSessionId, instanceId }`);
			        }
			        assertNoUnknownKeys(method, `${field}.member`, rawMember, ['instanceId', 'rootSessionId']);
			        return {
			            kind: 'member',
			            member: {
			                rootSessionId: parseRemoteRootSessionId(requiredField(method, rawMember, 'rootSessionId'), `${field}.member.rootSessionId`),
			                instanceId: parseRemoteInstanceId(requiredField(method, rawMember, 'instanceId'), `${field}.member.instanceId`),
			            },
			        };
			    }
			    throw paramMalformed(method, `${field}.kind`, 'invalid-value', `${field}.kind must be 'human', 'leader', or 'member'`);
			}
			/** The frozen PolicyEntry value (closed per `kind`). */
			function parseRemotePolicyEntry(value, method, field) {
			    if (!isPlainRecord(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object with kind 'allow' or 'deny'`);
			    }
			    const kind = value['kind'];
			    if (kind === 'allow') {
			        assertNoUnknownKeys(method, field, value, ['items', 'kind']);
			        const rawItems = requiredField(method, value, 'items');
			        if (!Array.isArray(rawItems)) {
			            throw paramMalformed(method, `${field}.items`, 'invalid-value', `${field}.items must be an array of strings`);
			        }
			        const items = [];
			        for (let i = 0; i < rawItems.length; i++) {
			            const item = rawItems[i];
			            if (typeof item !== 'string' ||
			                item.length === 0 ||
			                item.length > REMOTE_ID_MAX_LENGTH ||
			                hasControlChars(item)) {
			                throw paramMalformed(method, `${field}.items[${i}]`, 'invalid-value', `${field}.items entries must be non-empty strings of at most ${REMOTE_ID_MAX_LENGTH} characters without control characters`);
			            }
			            items.push(item);
			        }
			        return { kind: 'allow', items };
			    }
			    if (kind === 'deny') {
			        assertNoUnknownKeys(method, field, value, ['kind']);
			        return { kind: 'deny' };
			    }
			    throw paramMalformed(method, `${field}.kind`, 'invalid-value', `${field}.kind must be 'allow' or 'deny'`);
			}
			/** The frozen PolicyStateView object (cells keyed by closed capability). */
			function parseRemotePolicyStateView(value, method, field) {
			    if (!isPlainRecord(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be an object { stateId, cells? }`);
			    }
			    assertNoUnknownKeys(method, field, value, ['cells', 'stateId']);
			    const stateId = parseRemoteOpaqueToken(requiredField(method, value, 'stateId'), method, `${field}.stateId`);
			    const rawCells = optionalField(method, value, 'cells');
			    if (rawCells === undefined)
			        return { stateId };
			    if (!isPlainRecord(rawCells)) {
			        throw paramMalformed(method, `${field}.cells`, 'invalid-value', `${field}.cells must be an object keyed by capability name`);
			    }
			    const cells = {};
			    for (const capability of Object.keys(rawCells)) {
			        if (!REMOTE_CAPABILITY_VALUES.includes(capability)) {
			            throw paramMalformed(method, `${field}.cells.${capability}`, 'invalid-value', `${field}.cells keys must be capability names: ${REMOTE_CAPABILITY_VALUES.join(' | ')}`);
			        }
			        const rawCell = rawCells[capability];
			        if (!isPlainRecord(rawCell)) {
			            throw paramMalformed(method, `${field}.cells.${capability}`, 'invalid-value', `${field}.cells.${capability} must be an object { locked?, value? }`);
			        }
			        assertNoUnknownKeys(method, `${field}.cells.${capability}`, rawCell, ['locked', 'value']);
			        const rawLocked = optionalField(method, rawCell, 'locked');
			        if (rawLocked !== undefined && typeof rawLocked !== 'boolean') {
			            throw paramMalformed(method, `${field}.cells.${capability}.locked`, 'invalid-value', `${field}.cells.${capability}.locked must be a boolean`);
			        }
			        const rawCellValue = optionalField(method, rawCell, 'value');
			        const cellValue = {
			            ...(rawLocked !== undefined ? { locked: rawLocked } : {}),
			            ...(rawCellValue !== undefined
			                ? {
			                    value: parseRemotePolicyEntry(rawCellValue, method, `${field}.cells.${capability}.value`),
			                }
			                : {}),
			        };
			        cells[capability] = cellValue;
			    }
			    return { stateId, cells };
			}
			/**
			 * The `environmentFacts` array: plain records only (lossless safety is
			 * guaranteed by the envelope), capped at 10000 entries.
			 */
			function parseRemoteEnvironmentFacts(value, method, field) {
			    if (!Array.isArray(value)) {
			        throw paramMalformed(method, field, 'invalid-value', `${field} must be an array of objects`);
			    }
			    if (value.length > 10000) {
			        throw paramMalformed(method, field, 'too-large', `${field} must contain at most 10000 entries, got ${value.length}`);
			    }
			    const facts = [];
			    for (let i = 0; i < value.length; i++) {
			        const fact = value[i];
			        if (!isPlainRecord(fact)) {
			            throw paramMalformed(method, `${field}[${i}]`, 'invalid-value', `${field} entries must be objects`);
			        }
			        facts.push(assertRemoteSafeJsonValue(fact, `${field}[${i}]`));
			    }
			    return facts;
			}
			/**
			 * Cross-field rule for the mutation-addressed override methods:
			 * `targetInstanceId` is present iff `scope === 'instance'` (a team-scope
			 * address has no target; an instance-scope address names exactly one).
			 */
			function assertOverrideTargetConsistency(method, scope, targetInstanceId) {
			    if (targetInstanceId !== undefined && scope !== 'instance') {
			        throw paramMalformed(method, 'targetInstanceId', 'conflicting-fields', `${method}: targetInstanceId requires scope 'instance'`);
			    }
			    if (scope === 'instance' && targetInstanceId === undefined) {
			        throw paramMalformed(method, 'targetInstanceId', 'missing-required', `${method}: scope 'instance' requires targetInstanceId`);
			    }
			}
			/**
			 * Cross-field rule for the mutation-addressed override methods (deviation
			 * D-7 / P7-T2): agent-origin actors (leader/member) may only address the
			 * team scope — `scope`/`targetInstanceId` are rejected for them.
			 */
			function assertActorScopeConsistency(method, actor, scope, targetInstanceId) {
			    if (actor.kind !== 'human' && (scope !== undefined || targetInstanceId !== undefined)) {
			        throw paramMalformed(method, 'scope', 'invalid-value', `${method}: actor kind '${actor.kind}' may not use instance scope`);
			    }
			}
			// ---------------------------------------------------------------------------
			// Per-method param parsers (exported — one per catalog method)
			// ---------------------------------------------------------------------------
			/** Parse `catalog.list` params (no fields). */
			function parseRemoteCatalogListParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_CATALOG_LIST_FIELDS);
			    return {};
			}
			Object.defineProperty(exports, "parseRemoteCatalogListParams", { enumerable: true, get: () => parseRemoteCatalogListParams });
			/** Parse `catalog.get` params. */
			function parseRemoteCatalogGetParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_CATALOG_GET_FIELDS);
			    const blueprintId = parseRemoteBlueprintId(requiredField(method, params, 'blueprintId'), 'blueprintId');
			    const rawRevision = optionalField(method, params, 'blueprintRevision');
			    return {
			        blueprintId,
			        ...(rawRevision === undefined
			            ? {}
			            : { blueprintRevision: parseRemoteBlueprintRevision(rawRevision, 'blueprintRevision') }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteCatalogGetParams", { enumerable: true, get: () => parseRemoteCatalogGetParams });
			/** Parse `intent.probe` params (`environmentFacts` required, may be empty). */
			function parseRemoteIntentProbeParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_INTENT_PROBE_FIELDS);
			    const blueprintId = parseRemoteBlueprintId(requiredField(method, params, 'blueprintId'), 'blueprintId');
			    const rawRevision = optionalField(method, params, 'blueprintRevision');
			    return {
			        blueprintId,
			        ...(rawRevision === undefined
			            ? {}
			            : { blueprintRevision: parseRemoteBlueprintRevision(rawRevision, 'blueprintRevision') }),
			        environmentFacts: parseRemoteEnvironmentFacts(requiredField(method, params, 'environmentFacts'), method, 'environmentFacts'),
			    };
			}
			Object.defineProperty(exports, "parseRemoteIntentProbeParams", { enumerable: true, get: () => parseRemoteIntentProbeParams });
			/** Parse `team.create` params. */
			function parseRemoteTeamCreateParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_TEAM_CREATE_FIELDS);
			    const rawRevision = optionalField(method, params, 'blueprintRevision');
			    const rawInitialWork = optionalField(method, params, 'initialWork');
			    return {
			        rootSessionId: parseRemoteRootSessionId(requiredField(method, params, 'rootSessionId'), 'rootSessionId'),
			        blueprintId: parseRemoteBlueprintId(requiredField(method, params, 'blueprintId'), 'blueprintId'),
			        ...(rawRevision === undefined
			            ? {}
			            : { blueprintRevision: parseRemoteBlueprintRevision(rawRevision, 'blueprintRevision') }),
			        ...(rawInitialWork === undefined
			            ? {}
			            : { initialWork: parseRemoteLosslessRecord(rawInitialWork, method, 'initialWork') }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteTeamCreateParams", { enumerable: true, get: () => parseRemoteTeamCreateParams });
			/** Parse `team.getProjection` params. */
			function parseRemoteTeamGetProjectionParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_TEAM_GET_PROJECTION_FIELDS);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			    };
			}
			Object.defineProperty(exports, "parseRemoteTeamGetProjectionParams", { enumerable: true, get: () => parseRemoteTeamGetProjectionParams });
			/** Parse `team.getLedgerPage` params (defaults: afterSequence 0, limit 50). */
			function parseRemoteTeamGetLedgerPageParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS);
			    const rawAfter = optionalField(method, params, 'afterSequence');
			    const rawLimit = optionalField(method, params, 'limit');
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        afterSequence: rawAfter === undefined ? 0 : parseRemoteNonNegativeInt(rawAfter, method, 'afterSequence'),
			        limit: rawLimit === undefined ? 50 : parseRemoteBoundedInt(rawLimit, method, 'limit', 500),
			    };
			}
			Object.defineProperty(exports, "parseRemoteTeamGetLedgerPageParams", { enumerable: true, get: () => parseRemoteTeamGetLedgerPageParams });
			/** Parse `member.create` params (at most one delegation field). */
			function parseRemoteMemberCreateParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_MEMBER_CREATE_FIELDS);
			    const rawTemplateId = optionalField(method, params, 'delegationTemplateId');
			    const rawInstanceId = optionalField(method, params, 'delegationInstanceId');
			    if (rawTemplateId !== undefined && rawInstanceId !== undefined) {
			        throw paramMalformed(method, 'delegationInstanceId', 'conflicting-fields', `${method}: delegationTemplateId and delegationInstanceId are mutually exclusive`);
			    }
			    const rawPayload = optionalField(method, params, 'payload');
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        caller: parseRemoteCaller(requiredField(method, params, 'caller'), method, 'caller'),
			        requestToken: parseRemoteOpaqueToken(requiredField(method, params, 'requestToken'), method, 'requestToken'),
			        ...(rawTemplateId === undefined
			            ? {}
			            : { delegationTemplateId: parseRemoteTemplateId(rawTemplateId, 'delegationTemplateId') }),
			        ...(rawInstanceId === undefined
			            ? {}
			            : { delegationInstanceId: parseRemoteInstanceId(rawInstanceId, 'delegationInstanceId') }),
			        ...(rawPayload === undefined
			            ? {}
			            : { payload: parseRemoteLosslessRecord(rawPayload, method, 'payload') }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteMemberCreateParams", { enumerable: true, get: () => parseRemoteMemberCreateParams });
			/** Parse `member.send` params. */
			function parseRemoteMemberSendParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_MEMBER_SEND_FIELDS);
			    const rawSubject = optionalField(method, params, 'subject');
			    const rawPayload = optionalField(method, params, 'payload');
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        caller: parseRemoteCaller(requiredField(method, params, 'caller'), method, 'caller'),
			        recipientInstanceId: parseRemoteInstanceId(requiredField(method, params, 'recipientInstanceId'), 'recipientInstanceId'),
			        body: parseRemoteBody(requiredField(method, params, 'body'), method, 'body'),
			        ...(rawSubject === undefined
			            ? {}
			            : { subject: parseRemoteOpaqueToken(rawSubject, method, 'subject') }),
			        requestToken: parseRemoteOpaqueToken(requiredField(method, params, 'requestToken'), method, 'requestToken'),
			        ...(rawPayload === undefined
			            ? {}
			            : { payload: parseRemoteLosslessRecord(rawPayload, method, 'payload') }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteMemberSendParams", { enumerable: true, get: () => parseRemoteMemberSendParams });
			/** Parse `member.followup` params. */
			function parseRemoteMemberFollowupParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_MEMBER_FOLLOWUP_FIELDS);
			    const rawPayload = optionalField(method, params, 'payload');
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        caller: parseRemoteCaller(requiredField(method, params, 'caller'), method, 'caller'),
			        targetInstanceId: parseRemoteInstanceId(requiredField(method, params, 'targetInstanceId'), 'targetInstanceId'),
			        requestToken: parseRemoteOpaqueToken(requiredField(method, params, 'requestToken'), method, 'requestToken'),
			        ...(rawPayload === undefined
			            ? {}
			            : { payload: parseRemoteLosslessRecord(rawPayload, method, 'payload') }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteMemberFollowupParams", { enumerable: true, get: () => parseRemoteMemberFollowupParams });
			/** Parse `member.archive` params. */
			function parseRemoteMemberArchiveParams(method, params) {
			    return parseMemberLifecycleParams(method, params);
			}
			Object.defineProperty(exports, "parseRemoteMemberArchiveParams", { enumerable: true, get: () => parseRemoteMemberArchiveParams });
			/** Parse `member.restore` params. */
			function parseRemoteMemberRestoreParams(method, params) {
			    return parseMemberLifecycleParams(method, params);
			}
			Object.defineProperty(exports, "parseRemoteMemberRestoreParams", { enumerable: true, get: () => parseRemoteMemberRestoreParams });
			/** Parse `member.dispose` params. */
			function parseRemoteMemberDisposeParams(method, params) {
			    return parseMemberLifecycleParams(method, params);
			}
			Object.defineProperty(exports, "parseRemoteMemberDisposeParams", { enumerable: true, get: () => parseRemoteMemberDisposeParams });
			/** The shared member-lifecycle param schema. */
			function parseMemberLifecycleParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_MEMBER_LIFECYCLE_FIELDS);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        instanceId: parseRemoteInstanceId(requiredField(method, params, 'instanceId'), 'instanceId'),
			    };
			}
			/** Parse `override.get` params. */
			function parseRemoteOverrideGetParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_OVERRIDE_GET_FIELDS);
			    const rawScope = optionalField(method, params, 'scope');
			    const rawTarget = optionalField(method, params, 'targetInstanceId');
			    const scope = rawScope === undefined
			        ? undefined
			        : parseRemoteEnum(rawScope, method, 'scope', REMOTE_MUTATION_SCOPES);
			    const targetInstanceId = rawTarget === undefined
			        ? undefined
			        : parseRemoteInstanceId(rawTarget, 'targetInstanceId');
			    assertOverrideTargetConsistency(method, scope, targetInstanceId);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        capability: parseRemoteEnum(requiredField(method, params, 'capability'), method, 'capability', REMOTE_CAPABILITY_VALUES),
			        ...(scope === undefined ? {} : { scope }),
			        ...(targetInstanceId === undefined ? {} : { targetInstanceId }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteOverrideGetParams", { enumerable: true, get: () => parseRemoteOverrideGetParams });
			/** Parse `override.set` params. */
			function parseRemoteOverrideSetParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_OVERRIDE_SET_FIELDS);
			    const rawScope = optionalField(method, params, 'scope');
			    const rawTarget = optionalField(method, params, 'targetInstanceId');
			    const scope = rawScope === undefined
			        ? undefined
			        : parseRemoteEnum(rawScope, method, 'scope', REMOTE_MUTATION_SCOPES);
			    const targetInstanceId = rawTarget === undefined
			        ? undefined
			        : parseRemoteInstanceId(rawTarget, 'targetInstanceId');
			    const actor = parseRemoteMutationActor(requiredField(method, params, 'actor'), method, 'actor');
			    assertOverrideTargetConsistency(method, scope, targetInstanceId);
			    assertActorScopeConsistency(method, actor, scope, targetInstanceId);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        capability: parseRemoteEnum(requiredField(method, params, 'capability'), method, 'capability', REMOTE_CAPABILITY_VALUES),
			        value: parseRemotePolicyEntry(requiredField(method, params, 'value'), method, 'value'),
			        actor,
			        ...(scope === undefined ? {} : { scope }),
			        ...(targetInstanceId === undefined ? {} : { targetInstanceId }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteOverrideSetParams", { enumerable: true, get: () => parseRemoteOverrideSetParams });
			/** Parse `override.reset` params. */
			function parseRemoteOverrideResetParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_OVERRIDE_RESET_FIELDS);
			    const rawScope = optionalField(method, params, 'scope');
			    const rawTarget = optionalField(method, params, 'targetInstanceId');
			    const scope = rawScope === undefined
			        ? undefined
			        : parseRemoteEnum(rawScope, method, 'scope', REMOTE_MUTATION_SCOPES);
			    const targetInstanceId = rawTarget === undefined
			        ? undefined
			        : parseRemoteInstanceId(rawTarget, 'targetInstanceId');
			    const actor = parseRemoteMutationActor(requiredField(method, params, 'actor'), method, 'actor');
			    assertOverrideTargetConsistency(method, scope, targetInstanceId);
			    assertActorScopeConsistency(method, actor, scope, targetInstanceId);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        capability: parseRemoteEnum(requiredField(method, params, 'capability'), method, 'capability', REMOTE_CAPABILITY_VALUES),
			        actor,
			        ...(scope === undefined ? {} : { scope }),
			        ...(targetInstanceId === undefined ? {} : { targetInstanceId }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteOverrideResetParams", { enumerable: true, get: () => parseRemoteOverrideResetParams });
			/** Parse `policyState.get` params. */
			function parseRemotePolicyStateGetParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_POLICY_STATE_GET_FIELDS);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			    };
			}
			Object.defineProperty(exports, "parseRemotePolicyStateGetParams", { enumerable: true, get: () => parseRemotePolicyStateGetParams });
			/** Parse `policyState.set` params. */
			function parseRemotePolicyStateSetParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_POLICY_STATE_SET_FIELDS);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        target: parseRemotePolicyStateView(requiredField(method, params, 'target'), method, 'target'),
			        actor: parseRemoteMutationActor(requiredField(method, params, 'actor'), method, 'actor'),
			    };
			}
			Object.defineProperty(exports, "parseRemotePolicyStateSetParams", { enumerable: true, get: () => parseRemotePolicyStateSetParams });
			/** Parse `compatibility.get` params. */
			function parseRemoteCompatibilityGetParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_COMPATIBILITY_GET_FIELDS);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			    };
			}
			Object.defineProperty(exports, "parseRemoteCompatibilityGetParams", { enumerable: true, get: () => parseRemoteCompatibilityGetParams });
			/** Parse `compatibility.ack` params. */
			function parseRemoteCompatibilityAckParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_COMPATIBILITY_ACK_FIELDS);
			    const rawNote = optionalField(method, params, 'note');
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        requirementId: parseRemoteOpaqueToken(requiredField(method, params, 'requirementId'), method, 'requirementId'),
			        acknowledgedBy: parseRemoteOpaqueToken(requiredField(method, params, 'acknowledgedBy'), method, 'acknowledgedBy'),
			        ...(rawNote === undefined ? {} : { note: parseRemoteNote(rawNote, method, 'note') }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteCompatibilityAckParams", { enumerable: true, get: () => parseRemoteCompatibilityAckParams });
			/** Parse `compatibility.reprobe` params. */
			function parseRemoteCompatibilityReprobeParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_COMPATIBILITY_REPROBE_FIELDS);
			    return {
			        teamSessionId: parseRemoteTeamSessionId(requiredField(method, params, 'teamSessionId'), 'teamSessionId'),
			        trigger: parseRemoteEnum(requiredField(method, params, 'trigger'), method, 'trigger', REMOTE_PROBE_TRIGGER_VALUES),
			    };
			}
			Object.defineProperty(exports, "parseRemoteCompatibilityReprobeParams", { enumerable: true, get: () => parseRemoteCompatibilityReprobeParams });
			/** Parse `handoff.prepare` params. */
			function parseRemoteHandoffPrepareParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_HANDOFF_PREPARE_FIELDS);
			    return {
			        sourceSessionId: parseRemoteSessionId(requiredField(method, params, 'sourceSessionId'), 'sourceSessionId'),
			    };
			}
			Object.defineProperty(exports, "parseRemoteHandoffPrepareParams", { enumerable: true, get: () => parseRemoteHandoffPrepareParams });
			/** Parse `handoff.create` params. */
			function parseRemoteHandoffCreateParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_HANDOFF_CREATE_FIELDS);
			    const rawStaged = optionalField(method, params, 'staged');
			    return {
			        sourceSessionId: parseRemoteSessionId(requiredField(method, params, 'sourceSessionId'), 'sourceSessionId'),
			        requestToken: parseRemoteOpaqueToken(requiredField(method, params, 'requestToken'), method, 'requestToken'),
			        ...(rawStaged === undefined
			            ? {}
			            : { staged: parseRemoteLosslessRecord(rawStaged, method, 'staged') }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteHandoffCreateParams", { enumerable: true, get: () => parseRemoteHandoffCreateParams });
			/** Parse `legacy.inspect` params. */
			function parseRemoteLegacyInspectParams(method, params) {
			    assertNoUnknownFields(method, params, REMOTE_LEGACY_INSPECT_FIELDS);
			    const rawWorkspaceCwd = optionalField(method, params, 'workspaceCwd');
			    const rawProjectDir = optionalField(method, params, 'projectDir');
			    return {
			        dshHome: parseRemotePath(requiredField(method, params, 'dshHome'), method, 'dshHome'),
			        ...(rawWorkspaceCwd === undefined
			            ? {}
			            : { workspaceCwd: parseRemotePath(rawWorkspaceCwd, method, 'workspaceCwd') }),
			        ...(rawProjectDir === undefined
			            ? {}
			            : { projectDir: parseRemotePath(rawProjectDir, method, 'projectDir') }),
			    };
			}
			Object.defineProperty(exports, "parseRemoteLegacyInspectParams", { enumerable: true, get: () => parseRemoteLegacyInspectParams });
			// ---------------------------------------------------------------------------
			// Generic entry point (used by the dispatcher)
			// ---------------------------------------------------------------------------
			/**
			 * Parse `params` for the given catalog method.
			 * @param method - a catalog method name (dotted `<category>.<action>`).
			 * @param params - the request envelope's `params` object.
			 * @returns the typed param object plus the request token echo.
			 * @throws {RemoteContractError} `unknown-method` (defensive — the dispatcher
			 *   checks membership first), `malformed-params`, or the mirrored frozen P3
			 *   ID codes on structural ID violations.
			 */
			function parseRemoteMethodParams(method, params) {
			    switch (method) {
			        case 'catalog.list':
			            return wrapParsed(method, parseRemoteCatalogListParams(method, params));
			        case 'catalog.get':
			            return wrapParsed(method, parseRemoteCatalogGetParams(method, params));
			        case 'intent.probe':
			            return wrapParsed(method, parseRemoteIntentProbeParams(method, params));
			        case 'team.create':
			            return wrapParsed(method, parseRemoteTeamCreateParams(method, params));
			        case 'team.getProjection':
			            return wrapParsed(method, parseRemoteTeamGetProjectionParams(method, params));
			        case 'team.getLedgerPage':
			            return wrapParsed(method, parseRemoteTeamGetLedgerPageParams(method, params));
			        case 'member.create':
			            return wrapParsed(method, parseRemoteMemberCreateParams(method, params));
			        case 'member.send':
			            return wrapParsed(method, parseRemoteMemberSendParams(method, params));
			        case 'member.followup':
			            return wrapParsed(method, parseRemoteMemberFollowupParams(method, params));
			        case 'member.archive':
			            return wrapParsed(method, parseRemoteMemberArchiveParams(method, params));
			        case 'member.restore':
			            return wrapParsed(method, parseRemoteMemberRestoreParams(method, params));
			        case 'member.dispose':
			            return wrapParsed(method, parseRemoteMemberDisposeParams(method, params));
			        case 'override.get':
			            return wrapParsed(method, parseRemoteOverrideGetParams(method, params));
			        case 'override.set':
			            return wrapParsed(method, parseRemoteOverrideSetParams(method, params));
			        case 'override.reset':
			            return wrapParsed(method, parseRemoteOverrideResetParams(method, params));
			        case 'policyState.get':
			            return wrapParsed(method, parseRemotePolicyStateGetParams(method, params));
			        case 'policyState.set':
			            return wrapParsed(method, parseRemotePolicyStateSetParams(method, params));
			        case 'compatibility.get':
			            return wrapParsed(method, parseRemoteCompatibilityGetParams(method, params));
			        case 'compatibility.ack':
			            return wrapParsed(method, parseRemoteCompatibilityAckParams(method, params));
			        case 'compatibility.reprobe':
			            return wrapParsed(method, parseRemoteCompatibilityReprobeParams(method, params));
			        case 'handoff.prepare':
			            return wrapParsed(method, parseRemoteHandoffPrepareParams(method, params));
			        case 'handoff.create':
			            return wrapParsed(method, parseRemoteHandoffCreateParams(method, params));
			        case 'legacy.inspect':
			            return wrapParsed(method, parseRemoteLegacyInspectParams(method, params));
			        default:
			            throw remoteContractError('unknown-method', `method '${String(method)}' is not part of the closed Remote contract v1 catalog`, { field: 'method' });
			    }
			}
			Object.defineProperty(exports, "parseRemoteMethodParams", { enumerable: true, get: () => parseRemoteMethodParams });
			/** Attach the method + request-token echo to a parsed param object. */
			function wrapParsed(method, params) {
			    const token = params.requestToken;
			    return {
			        method,
			        params,
			        requestToken: typeof token === 'string' ? token : null,
			    };
			}
			//# sourceMappingURL=params.js.map
			}, exports: {} };
		__mods["../../remote/src/contracts/types.js"] = { done: false, fn: function (exports) {
			/**
			 * Typed output value mirrors of the Remote contract v1.
			 *
			 * These are the `data` shapes the dispatcher wraps in the success result.
			 * They mirror — at the value level (deviation D-1) — the durable DTOs and
			 * service results the backing ports return (design note §3 table, "Output
			 * value (data)"). Deep validation is deliberately NOT repeated here (D-4):
			 * the backing services own their invariants; the remote layer (a) checks
			 * the top-level shape of the whole-projection DTO, (b) normalizes closed
			 * wire fields (e.g. ledger `operationId` → `string | null`), and (c)
			 * lossless-JSON-checks every value before the reply is built.
			 *
			 * `RemoteSafeRecord` marks "a lossless-JSON-checked value whose deep shape
			 * is owned by the backing service".
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/contracts/types
			 */
			// ---------------------------------------------------------------------------
			// Provenance helpers (shared by the handler modules)
			// ---------------------------------------------------------------------------
			/** The top-level fields of the P8-T1 whole-projection DTO (mirror). */
			const REMOTE_PROJECTION_FIELDS = [
			    'blueprint',
			    'generation',
			    'generatedAt',
			    'ledger',
			    'members',
			    'root',
			    'schemaVersion',
			    'teamSessionId',
			    'templates',
			];
			Object.defineProperty(exports, "REMOTE_PROJECTION_FIELDS", { enumerable: true, get: () => REMOTE_PROJECTION_FIELDS });
			/** The top-level fields of the storage `LedgerEntry` (mirror). */
			const REMOTE_LEDGER_ENTRY_FIELDS = [
			    'createdAt',
			    'factType',
			    'operationId',
			    'payload',
			    'rootSessionId',
			    'schemaVersion',
			    'sequence',
			];
			Object.defineProperty(exports, "REMOTE_LEDGER_ENTRY_FIELDS", { enumerable: true, get: () => REMOTE_LEDGER_ENTRY_FIELDS });
			//# sourceMappingURL=types.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/catalog.js"] = { done: false, fn: function (exports) {
			/**
			 * The `catalog` category handler (design note §3): pre-creation blueprint
			 * discovery. Backed by the {@link RemoteCatalogPort} (host wiring:
			 * `BlueprintCatalog`, `packages/domain/blueprint`).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/catalog
			 */
			/** Parse the union to the catalog-category param types (category-routed). */
			function asCatalogGetParams(params) {
			    return params;
			}
			/** The catalog category handler (`catalog.list`, `catalog.get`). */
			function createRemoteCatalogHandler(deps) {
			    return (method, params) => {
			        switch (method) {
			            case 'catalog.list': {
			                const blueprints = deps.list();
			                return { data: { blueprints } };
			            }
			            case 'catalog.get': {
			                const getParams = asCatalogGetParams(params);
			                const blueprint = deps.get(getParams.blueprintId, getParams.blueprintRevision);
			                return { data: { blueprint } };
			            }
			            default:
			                throw new Error(`catalog handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemoteCatalogHandler", { enumerable: true, get: () => createRemoteCatalogHandler });
			//# sourceMappingURL=catalog.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/intent.js"] = { done: false, fn: function (exports) {
			/**
			 * The `intent` category handler (design note §3): the pre-creation
			 * compatibility probe (Architecture §7 TeamIntent flow). Backed by the
			 * {@link RemoteIntentPort} (host wiring: the pure domain
			 * `evaluateCompatibility` fed by the blueprint's requirements).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/intent
			 */
			/** Parse the union to the intent-category param types (category-routed). */
			function asIntentProbeParams(params) {
			    return params;
			}
			/** The intent category handler (`intent.probe`). */
			function createRemoteIntentHandler(deps) {
			    return (method, params) => {
			        switch (method) {
			            case 'intent.probe': {
			                const probeParams = asIntentProbeParams(params);
			                const compatibility = deps.probe(probeParams.blueprintId, probeParams.blueprintRevision, probeParams.environmentFacts);
			                return { data: { compatibility } };
			            }
			            default:
			                throw new Error(`intent handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemoteIntentHandler", { enumerable: true, get: () => createRemoteIntentHandler });
			//# sourceMappingURL=intent.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/team.js"] = { done: false, fn: function (exports) {
			const __imp16 = __req("../../remote/src/contracts/errors.js");
			const remoteContractError = __imp16.remoteContractError;
			const __imp17 = __req("../../remote/src/contracts/types.js");
			const REMOTE_LEDGER_ENTRY_FIELDS = __imp17.REMOTE_LEDGER_ENTRY_FIELDS;
			const REMOTE_PROJECTION_FIELDS = __imp17.REMOTE_PROJECTION_FIELDS;
			/**
			 * The `team` category handler (design note §3): TeamSession creation,
			 * whole-projection observation, and ledger pages. Backed by three ports:
			 * {@link RemoteTeamCreatePort} (root binding, P5-T5),
			 * {@link RemoteProjectionPort} (ProjectionService, P8-T2), and
			 * {@link RemoteLedgerPort} (storage ledger behind a slicing adapter, D-5).
			 *
			 * The projection is validated at the TOP LEVEL only (D-4): the nine frozen
			 * `TeamProjectionDto` fields must be present with the right structural
			 * kinds; the nested values pass through. The whole-projection `generation`
			 * rides in the reply's provenance (G8 staleness detection).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/team
			 */
			/** Is `value` a plain (non-array) object? */
			function isPlainRecord(value) {
			    if (value === null || typeof value !== 'object' || Array.isArray(value))
			        return false;
			    const proto = Object.getPrototypeOf(value);
			    return proto === null || proto === Object.prototype;
			}
			/** A port returned a structurally wrong value: a boundary failure. */
			function portContractError(field, problem) {
			    return remoteContractError('internal-error', `remote backing port returned a malformed value at '${field}': ${problem}`, { field, reason: 'port-contract' });
			}
			/** Normalize one projection to the closed top-level shape (D-4). */
			function normalizeProjection(raw) {
			    if (!isPlainRecord(raw)) {
			        throw portContractError('projection', `expected an object, got ${String(raw)}`);
			    }
			    for (const field of REMOTE_PROJECTION_FIELDS) {
			        if (!(field in raw)) {
			            throw portContractError(`projection.${field}`, 'missing field');
			        }
			    }
			    const schemaVersion = raw['schemaVersion'];
			    const generation = raw['generation'];
			    if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
			        throw portContractError('projection.schemaVersion', 'must be a safe integer');
			    }
			    if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 1) {
			        throw portContractError('projection.generation', 'must be a safe integer >= 1');
			    }
			    return raw;
			}
			/** Normalize one ledger entry to the closed wire shape. */
			function normalizeLedgerEntry(raw) {
			    if (!isPlainRecord(raw)) {
			        throw portContractError('ledger entry', `expected an object, got ${String(raw)}`);
			    }
			    for (const field of REMOTE_LEDGER_ENTRY_FIELDS) {
			        if (field === 'operationId')
			            continue; // optional on the storage row
			        if (!(field in raw)) {
			            throw portContractError(`ledger entry.${field}`, 'missing field');
			        }
			    }
			    const schemaVersion = raw['schemaVersion'];
			    if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
			        throw portContractError('ledger entry.schemaVersion', 'must be a safe integer');
			    }
			    const sequence = raw['sequence'];
			    if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 1) {
			        throw portContractError('ledger entry.sequence', 'must be a safe integer >= 1');
			    }
			    const rootSessionId = raw['rootSessionId'];
			    if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
			        throw portContractError('ledger entry.rootSessionId', 'must be a non-empty string');
			    }
			    const factType = raw['factType'];
			    if (typeof factType !== 'string' || factType.length === 0) {
			        throw portContractError('ledger entry.factType', 'must be a non-empty string');
			    }
			    const payload = raw['payload'];
			    if (!isPlainRecord(payload)) {
			        throw portContractError('ledger entry.payload', 'must be an object');
			    }
			    const createdAt = raw['createdAt'];
			    if (typeof createdAt !== 'string' || createdAt.length === 0) {
			        throw portContractError('ledger entry.createdAt', 'must be a non-empty string');
			    }
			    const operationId = raw['operationId'];
			    if (operationId !== undefined && typeof operationId !== 'string') {
			        throw portContractError('ledger entry.operationId', 'must be a string when present');
			    }
			    return {
			        schemaVersion,
			        sequence,
			        rootSessionId,
			        factType,
			        // The port contract guarantees a lossless-JSON-safe record; the plain
			        // record check above is the structural half of that guarantee.
			        payload: payload,
			        operationId: operationId === undefined ? null : operationId,
			        createdAt,
			    };
			}
			/**
			 * The team category handler (`team.create`, `team.getProjection`,
			 * `team.getLedgerPage`).
			 */
			function createRemoteTeamHandler(ports) {
			    return (method, params) => {
			        switch (method) {
			            case 'team.create': {
			                const createParams = params;
			                const teamCreate = ports.teamCreate;
			                const created = teamCreate.create(createParams.rootSessionId, createParams.blueprintId, createParams.blueprintRevision, createParams.initialWork);
			                if (!isPlainRecord(created)) {
			                    throw portContractError('teamCreate', `expected an object, got ${String(created)}`);
			                }
			                const path = created['path'];
			                if (path !== 'fresh-root' && path !== 'cold-root') {
			                    throw portContractError('teamCreate.path', `must be 'fresh-root' or 'cold-root', got ${String(path)}`);
			                }
			                const durable = created['durable'];
			                if (durable !== undefined &&
			                    durable !== null &&
			                    (typeof durable !== 'object' || Array.isArray(durable))) {
			                    throw portContractError('teamCreate.durable', 'must be an object or null');
			                }
			                const bind = created['bind'];
			                if (!isPlainRecord(bind)) {
			                    throw portContractError('teamCreate.bind', 'must be an object');
			                }
			                return {
			                    data: {
			                        path,
			                        durable: durable === undefined ? null : durable,
			                        bind,
			                    },
			                };
			            }
			            case 'team.getProjection': {
			                const projectionParams = params;
			                const raw = ports.projection.project(projectionParams.teamSessionId);
			                const projection = normalizeProjection(raw);
			                return {
			                    data: { projection },
			                    projectionGeneration: projection.generation,
			                };
			            }
			            case 'team.getLedgerPage': {
			                const pageParams = params;
			                const allEntries = ports.ledger.listEntries(pageParams.teamSessionId);
			                const entriesAfter = [];
			                for (const rawEntry of allEntries) {
			                    const entry = normalizeLedgerEntry(rawEntry);
			                    if (entry.sequence > pageParams.afterSequence)
			                        entriesAfter.push(entry);
			                }
			                const page = entriesAfter.slice(0, pageParams.limit);
			                let nextAfterSequence = null;
			                if (entriesAfter.length > pageParams.limit) {
			                    const last = page[page.length - 1];
			                    if (last === undefined) {
			                        throw portContractError('ledger page', 'internal slicing error');
			                    }
			                    nextAfterSequence = last.sequence;
			                }
			                return {
			                    data: {
			                        entries: page,
			                        nextAfterSequence,
			                        total: ports.ledger.countEntries(pageParams.teamSessionId),
			                    },
			                };
			            }
			            default:
			                throw new Error(`team handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemoteTeamHandler", { enumerable: true, get: () => createRemoteTeamHandler });
			//# sourceMappingURL=team.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/member.js"] = { done: false, fn: function (exports) {
			/**
			 * The `member` category handler (design note §3): member admission
			 * actions (create / send / follow-up) over the P6-T2 TeamRuntime facade,
			 * and member lifecycle (archive / restore / dispose) over the P7-T3
			 * LifecycleService.
			 *
			 * The admission outcome's durable effect sequence (when the effect carries
			 * one) rides in the reply's provenance (`effectSequence`).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/member
			 */
			/**
			 * The durable effect sequence of an admission outcome, when its effect
			 * carries one. The effect is the P6-T2 `RuntimeActionEffect` closed union
			 * (runtime/admission/types.ts); the canonical sequence field per kind:
			 *
			 *  - `fact-recorded`, `work-admitted`, `lifecycle-changed` → `sequence`
			 *    (the durable ledger fact sequence — always written for these kinds);
			 *  - `member-activated` → `ledgerSequence` (the provider's durable ledger
			 *    sequence, when carried; absent otherwise);
			 *  - `none`, `config-inspected`, `members-listed`, `templates-listed` →
			 *    no sequence (read effects).
			 *
			 * Any other shape (unknown or absent `kind`, non-object effect,
			 * non-safe-integer value) yields no provenance sequence (the wire cell is
			 * `null` — the frozen Remote contract v1 surface is unchanged).
			 */
			function admissionEffectSequence(outcome) {
			    const effect = outcome['effect'];
			    if (effect === null || typeof effect !== 'object' || Array.isArray(effect))
			        return undefined;
			    const effectRecord = effect;
			    let candidate;
			    switch (typeof effectRecord['kind'] === 'string' ? effectRecord['kind'] : '') {
			        case 'fact-recorded':
			        case 'work-admitted':
			        case 'lifecycle-changed':
			            candidate = effectRecord['sequence'];
			            break;
			        case 'member-activated':
			            candidate = effectRecord['ledgerSequence'];
			            break;
			        default:
			            // `none`, `config-inspected`, `members-listed`, `templates-listed`,
			            // or an unknown/absent kind: the effect carries no sequence.
			            return undefined;
			    }
			    if (typeof candidate === 'number' && Number.isSafeInteger(candidate)) {
			        return candidate;
			    }
			    return undefined;
			}
			/**
			 * The member category handler (`member.create`, `member.send`,
			 * `member.followup`, `member.archive`, `member.restore`, `member.dispose`).
			 */
			function createRemoteMemberHandler(ports) {
			    return (method, params) => {
			        switch (method) {
			            case 'member.create': {
			                const createParams = params;
			                const request = {
			                    rootSessionId: createParams.teamSessionId,
			                    action: 'create-member',
			                    caller: createParams.caller,
			                    requestToken: createParams.requestToken,
			                    ...(createParams.delegationTemplateId !== undefined
			                        ? { delegationTemplateId: createParams.delegationTemplateId }
			                        : {}),
			                    ...(createParams.delegationInstanceId !== undefined
			                        ? { delegationInstanceId: createParams.delegationInstanceId }
			                        : {}),
			                    ...(createParams.payload !== undefined ? { payload: createParams.payload } : {}),
			                };
			                const outcome = ports.admission.performAction(request);
			                return {
			                    data: { outcome },
			                    effectSequence: admissionEffectSequence(outcome),
			                };
			            }
			            case 'member.send': {
			                const sendParams = params;
			                const request = {
			                    rootSessionId: sendParams.teamSessionId,
			                    action: 'send-message',
			                    caller: sendParams.caller,
			                    requestToken: sendParams.requestToken,
			                    targetInstanceId: sendParams.recipientInstanceId,
			                    body: sendParams.body,
			                    ...(sendParams.subject !== undefined ? { subject: sendParams.subject } : {}),
			                    ...(sendParams.payload !== undefined ? { payload: sendParams.payload } : {}),
			                };
			                const outcome = ports.admission.performAction(request);
			                return {
			                    data: { outcome },
			                    effectSequence: admissionEffectSequence(outcome),
			                };
			            }
			            case 'member.followup': {
			                const followupParams = params;
			                const request = {
			                    rootSessionId: followupParams.teamSessionId,
			                    action: 'follow-up',
			                    caller: followupParams.caller,
			                    requestToken: followupParams.requestToken,
			                    targetInstanceId: followupParams.targetInstanceId,
			                    ...(followupParams.payload !== undefined ? { payload: followupParams.payload } : {}),
			                };
			                const outcome = ports.admission.performAction(request);
			                return {
			                    data: { outcome },
			                    effectSequence: admissionEffectSequence(outcome),
			                };
			            }
			            case 'member.archive': {
			                const lifecycleParams = params;
			                const result = ports.lifecycle.archive(lifecycleParams.teamSessionId, lifecycleParams.instanceId);
			                return { data: result };
			            }
			            case 'member.restore': {
			                const lifecycleParams = params;
			                const result = ports.lifecycle.restore(lifecycleParams.teamSessionId, lifecycleParams.instanceId);
			                return { data: result };
			            }
			            case 'member.dispose': {
			                const lifecycleParams = params;
			                const result = ports.lifecycle.dispose(lifecycleParams.teamSessionId, lifecycleParams.instanceId);
			                return { data: result };
			            }
			            default:
			                throw new Error(`member handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemoteMemberHandler", { enumerable: true, get: () => createRemoteMemberHandler });
			//# sourceMappingURL=member.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/override.js"] = { done: false, fn: function (exports) {
			/**
			 * The `override` category handler (design note §3 / D-7): autonomy overlays
			 * and explicit human overrides over the P7-T2 MutationService + mutation
			 * store. `override.get` is a read (no actor); `override.set` records a
			 * durable value; `override.reset` revokes the addressed record
			 * (audit-preserving).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/override
			 */
			/**
			 * The override category handler (`override.get`, `override.set`,
			 * `override.reset`).
			 */
			function createRemoteOverrideHandler(deps) {
			    return (method, params) => {
			        switch (method) {
			            case 'override.get': {
			                const getParams = params;
			                const override = deps.get(getParams.teamSessionId, getParams.capability, getParams.scope, getParams.targetInstanceId);
			                return { data: { override } };
			            }
			            case 'override.set': {
			                const setParams = params;
			                const request = {
			                    teamSessionId: setParams.teamSessionId,
			                    capability: setParams.capability,
			                    value: setParams.value,
			                    actor: setParams.actor,
			                    ...(setParams.scope !== undefined ? { scope: setParams.scope } : {}),
			                    ...(setParams.targetInstanceId !== undefined
			                        ? { targetInstanceId: setParams.targetInstanceId }
			                        : {}),
			                };
			                const record = deps.set(request);
			                return { data: { record } };
			            }
			            case 'override.reset': {
			                const resetParams = params;
			                const request = {
			                    teamSessionId: resetParams.teamSessionId,
			                    capability: resetParams.capability,
			                    actor: resetParams.actor,
			                    ...(resetParams.scope !== undefined ? { scope: resetParams.scope } : {}),
			                    ...(resetParams.targetInstanceId !== undefined
			                        ? { targetInstanceId: resetParams.targetInstanceId }
			                        : {}),
			                };
			                const { removed } = deps.reset(request);
			                return { data: { removed } };
			            }
			            default:
			                throw new Error(`override handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemoteOverrideHandler", { enumerable: true, get: () => createRemoteOverrideHandler });
			//# sourceMappingURL=override.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/policy-state.js"] = { done: false, fn: function (exports) {
			/**
			 * The `policyState` category handler (design note §3): the TeamSession
			 * PolicyState (Architecture §20; invariant 40 — explicit switch only) over
			 * the P7-T2 mutation store + MutationService.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/policy-state
			 */
			/**
			 * The policyState category handler (`policyState.get`, `policyState.set`).
			 */
			function createRemotePolicyStateHandler(deps) {
			    return (method, params) => {
			        switch (method) {
			            case 'policyState.get': {
			                const getParams = params;
			                const state = deps.read(getParams.teamSessionId);
			                return { data: { state } };
			            }
			            case 'policyState.set': {
			                const setParams = params;
			                const transition = deps.switchState({
			                    teamSessionId: setParams.teamSessionId,
			                    target: setParams.target,
			                    actor: setParams.actor,
			                });
			                return { data: { transition } };
			            }
			            default:
			                throw new Error(`policyState handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemotePolicyStateHandler", { enumerable: true, get: () => createRemotePolicyStateHandler });
			//# sourceMappingURL=policy-state.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/compatibility.js"] = { done: false, fn: function (exports) {
			/**
			 * The `compatibility` category handler (design note §3): the durable
			 * environment-compatibility state (Architecture §27/§28) over the P7-T1
			 * CompatibilityProber. The ack is bound to the current mismatch +
			 * fingerprint (FATAL never ack-able); reprobe runs one fresh probe under a
			 * frozen trigger.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/compatibility
			 */
			/**
			 * The compatibility category handler (`compatibility.get`,
			 * `compatibility.ack`, `compatibility.reprobe`).
			 */
			function createRemoteCompatibilityHandler(deps) {
			    return (method, params) => {
			        switch (method) {
			            case 'compatibility.get': {
			                const getParams = params;
			                const verdict = deps.current(getParams.teamSessionId);
			                return { data: { verdict } };
			            }
			            case 'compatibility.ack': {
			                const ackParams = params;
			                const verdict = deps.acknowledge(ackParams.teamSessionId, ackParams.requirementId, ackParams.acknowledgedBy, ackParams.note);
			                return { data: { verdict } };
			            }
			            case 'compatibility.reprobe': {
			                const reprobeParams = params;
			                const probe = deps.probe(reprobeParams.teamSessionId, reprobeParams.trigger);
			                return { data: { probe } };
			            }
			            default:
			                throw new Error(`compatibility handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemoteCompatibilityHandler", { enumerable: true, get: () => createRemoteCompatibilityHandler });
			//# sourceMappingURL=compatibility.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/handoff.js"] = { done: false, fn: function (exports) {
			/**
			 * The `handoff` category handler (design note §3 / D-6): start-a-team-from
			 * here (Architecture §34). `handoff.prepare` is a read-only source-surface
			 * summary (zero durable writes, no team creation); `handoff.create` is
			 * `startTeamFromHere` (idempotent by `(sourceSessionId, requestToken)`).
			 * The `querySourceHistoryFromTarget` capability is deliberately NOT
			 * exposed: Architecture §34.3 forbids the new team from reading the
			 * source's history.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/handoff
			 */
			/**
			 * The handoff category handler (`handoff.prepare`, `handoff.create`).
			 */
			function createRemoteHandoffHandler(deps) {
			    return (method, params) => {
			        switch (method) {
			            case 'handoff.prepare': {
			                const prepareParams = params;
			                const summary = deps.prepareSource(prepareParams.sourceSessionId);
			                return { data: { summary, sourceSessionId: prepareParams.sourceSessionId } };
			            }
			            case 'handoff.create': {
			                const createParams = params;
			                const state = deps.start(createParams.sourceSessionId, createParams.requestToken, createParams.staged);
			                return { data: { state } };
			            }
			            default:
			                throw new Error(`handoff handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemoteHandoffHandler", { enumerable: true, get: () => createRemoteHandoffHandler });
			//# sourceMappingURL=handoff.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/legacy.js"] = { done: false, fn: function (exports) {
			/**
			 * The `legacy` category handler (design note §3): read-only legacy Team
			 * inspection (DevPlan §20.6 degradation) over the P7-T7
			 * `inspectLegacyTeam`. Read-only by construction: the legacy reader never
			 * writes.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/legacy
			 */
			/** The legacy category handler (`legacy.inspect`). */
			function createRemoteLegacyHandler(deps) {
			    return (method, params) => {
			        switch (method) {
			            case 'legacy.inspect': {
			                const inspectParams = params;
			                const inspection = deps.inspect(inspectParams.dshHome, inspectParams.workspaceCwd, inspectParams.projectDir);
			                return { data: { inspection } };
			            }
			            default:
			                throw new Error(`legacy handler routed an unknown method: ${method}`);
			        }
			    };
			}
			Object.defineProperty(exports, "createRemoteLegacyHandler", { enumerable: true, get: () => createRemoteLegacyHandler });
			//# sourceMappingURL=legacy.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/dispatch.js"] = { done: false, fn: function (exports) {
			const __imp32 = __req("../../remote/src/contracts/catalog.js");
			const REMOTE_CATEGORIES = __imp32.REMOTE_CATEGORIES;
			const isRemoteMethod = __imp32.isRemoteMethod;
			const remoteCategoryOf = __imp32.remoteCategoryOf;
			const __imp33 = __req("../../remote/src/contracts/errors.js");
			const REMOTE_CONTRACT_ERROR_CODES = __imp33.REMOTE_CONTRACT_ERROR_CODES;
			const isRemoteContractError = __imp33.isRemoteContractError;
			const remoteContractError = __imp33.remoteContractError;
			const __imp34 = __req("../../remote/src/contracts/params.js");
			const parseRemoteMethodParams = __imp34.parseRemoteMethodParams;
			const __imp35 = __req("../../remote/src/contracts/request.js");
			const parseRemoteRequest = __imp35.parseRemoteRequest;
			const __imp36 = __req("../../remote/src/contracts/response.js");
			const buildRemoteError = __imp36.buildRemoteError;
			const buildRemoteSuccess = __imp36.buildRemoteSuccess;
			const __imp37 = __req("../../remote/src/contracts/version.js");
			const REMOTE_CONTRACT_VERSION = __imp37.REMOTE_CONTRACT_VERSION;
			const __imp38 = __req("../../remote/src/handlers/catalog.js");
			const createRemoteCatalogHandler = __imp38.createRemoteCatalogHandler;
			const __imp39 = __req("../../remote/src/handlers/compatibility.js");
			const createRemoteCompatibilityHandler = __imp39.createRemoteCompatibilityHandler;
			const __imp40 = __req("../../remote/src/handlers/handoff.js");
			const createRemoteHandoffHandler = __imp40.createRemoteHandoffHandler;
			const __imp41 = __req("../../remote/src/handlers/intent.js");
			const createRemoteIntentHandler = __imp41.createRemoteIntentHandler;
			const __imp42 = __req("../../remote/src/handlers/legacy.js");
			const createRemoteLegacyHandler = __imp42.createRemoteLegacyHandler;
			const __imp43 = __req("../../remote/src/handlers/member.js");
			const createRemoteMemberHandler = __imp43.createRemoteMemberHandler;
			const __imp44 = __req("../../remote/src/handlers/override.js");
			const createRemoteOverrideHandler = __imp44.createRemoteOverrideHandler;
			const __imp45 = __req("../../remote/src/handlers/policy-state.js");
			const createRemotePolicyStateHandler = __imp45.createRemotePolicyStateHandler;
			const __imp46 = __req("../../remote/src/handlers/team.js");
			const createRemoteTeamHandler = __imp46.createRemoteTeamHandler;
			/**
			 * The throw-proof dispatcher of the Remote contract v1 (design note §6).
			 *
			 * The dispatcher is the single entry point the seam invokes per request:
			 * `(endpoint, payload) => Promise<RemoteResponse>`. It enforces the seven
			 * dispatcher invariants (design note §6, all unit-tested):
			 *
			 * 1. unknown endpoint → `unknown-method` error result (never a throw) —
			 *    checked BEFORE the envelope, so an unknown endpoint always reports
			 *    `unknown-method` even with a garbage payload;
			 * 2. envelope parse failure → `malformed-request` /
			 *    `contract-version-unsupported`;
			 * 3. param validation failure → `malformed-params` (with `field` in
			 *    details) or the mirrored frozen P3 ID codes (deviation D-1/D-3);
			 * 4. typed domain error whose string `code` is a member of the CLOSED
			 *    backing vocabulary ({@link REMOTE_BACKING_ERROR_CODE_SET}) →
			 *    pass-through code + message, source identity under `details.cause`
			 *    (never the raw exception); an `Error` with an out-of-vocabulary `code`
			 *    (a Node `ENOENT`, a synthetic code, …) is NOT a typed domain error and
			 *    degrades to invariant 5 (T12-H4);
			 * 5. untyped throw from a port → `internal-error`, generic message, no
			 *    leak;
			 * 6. the success value passes a lossless-JSON check before the reply is
			 *    built (otherwise `internal-error`);
			 * 7. the returned promise never rejects — the outermost try/catch turns
			 *    every failure path into an error result, so the seam never sees a
			 *    handler throw (the P2-T6 500 class, designed out).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/dispatch
			 */
			/** Wire the twelve ports into the nine category handlers. */
			function buildCategoryHandlers(deps) {
			    return {
			        [REMOTE_CATEGORIES.CATALOG]: createRemoteCatalogHandler(deps.catalog),
			        [REMOTE_CATEGORIES.INTENT]: createRemoteIntentHandler(deps.intent),
			        [REMOTE_CATEGORIES.TEAM]: createRemoteTeamHandler({
			            teamCreate: deps.teamCreate,
			            projection: deps.projection,
			            ledger: deps.ledger,
			        }),
			        [REMOTE_CATEGORIES.MEMBER]: createRemoteMemberHandler({
			            admission: deps.admission,
			            lifecycle: deps.lifecycle,
			        }),
			        [REMOTE_CATEGORIES.OVERRIDE]: createRemoteOverrideHandler(deps.override),
			        [REMOTE_CATEGORIES.POLICY_STATE]: createRemotePolicyStateHandler(deps.policyState),
			        [REMOTE_CATEGORIES.COMPATIBILITY]: createRemoteCompatibilityHandler(deps.compatibility),
			        [REMOTE_CATEGORIES.HANDOFF]: createRemoteHandoffHandler(deps.handoff),
			        [REMOTE_CATEGORIES.LEGACY]: createRemoteLegacyHandler(deps.legacy),
			    };
			}
			/**
			 * The CLOSED backing-service error-code vocabulary invariant 4b may pass
			 * through (T12-H4).
			 *
			 * Invariant 4 originally passed through ANY thrown `Error` carrying its own
			 * non-empty string `code`. That was a leak: a plain `Error` — a Node
			 * filesystem failure with `code: 'ENOENT'` and a path in the message, a
			 * hand-rolled error with an ad-hoc code — rode its code AND its raw message
			 * onto the wire. Invariant 4b now accepts only the explicitly-enumerated
			 * closed codes below: the stable string-code vocabularies of the backing
			 * services a remote handler port can run into.
			 *
			 * This package is pure (no runtime/domain/storage dependency), so the values
			 * are literals rather than imported class constants — the closed set is
			 * visible in exactly ONE place, at the wire boundary:
			 *
			 * - runtime/admission `TEAM_RUNTIME_ERROR_CODES` (the unified runtime facade);
			 * - runtime/compatibility `COMPATIBILITY_ERROR_CODES`;
			 * - runtime/lifecycle `LIFECYCLE_RUNTIME_ERROR_CODES`;
			 * - runtime/mutation `MUTATION_ERROR_CODES`;
			 * - runtime/handoff `HANDOFF_ERROR_CODES`;
			 * - domain/member `MEMBER_DOMAIN_ERROR_CODES`;
			 * - domain/lifecycle `LIFECYCLE_DOMAIN_ERROR_CODES`;
			 * - storage/schema `TEAM_DOMAIN_ERROR_CODES` (the TeamDomain sidecar layer);
			 * - contracts v1 `TEAM_CONTRACT_ERROR_CODES` (the frozen identity/DTO rules);
			 * - the S6 plugin's remote-facing codes (s6-principal `S6_PRINCIPAL_ERROR_CODES`
			 *   + s6-remote `S6_REMOTE_ERROR_CODES`), which the production dispatcher
			 *   raises inside its handlers.
			 *
			 * Maintenance rule: when a backing module introduces a NEW closed code that
			 * must reach a remote caller, add its literal here and re-verify the
			 * dispatcher tests. Generic platform codes (ENOENT, ECONNRESET, …) and every
			 * ad-hoc code stay OUT on purpose: they carry filesystem paths and host
			 * internals that must not reach an external browser.
			 */
			const REMOTE_BACKING_ERROR_CODES = [
			    // runtime/admission — TEAM_RUNTIME_* (P6-T2 unified runtime facade)
			    'TEAM_RUNTIME_REQUEST_MALFORMED',
			    'TEAM_RUNTIME_ACTION_UNKNOWN',
			    'TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED',
			    'TEAM_RUNTIME_INSTANCE_NOT_FOUND',
			    'TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND',
			    'TEAM_RUNTIME_TEAM_ROOT_BINDING_MISSING',
			    'TEAM_RUNTIME_BLUEPRINT_UNRESOLVED',
			    'TEAM_RUNTIME_BLUEPRINT_HASH_MISMATCH',
			    'TEAM_RUNTIME_CALLER_NOT_FOUND',
			    'TEAM_RUNTIME_CALLER_ROLE_STALE',
			    'TEAM_RUNTIME_CALLER_AUTHORITY_DENIED',
			    'TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS',
			    'TEAM_RUNTIME_COMPATIBILITY_BLOCKED',
			    'TEAM_RUNTIME_WORK_STATE_REJECTED',
			    'TEAM_RUNTIME_QUOTA_EXCEEDED_TEAM_INSTANCES',
			    'TEAM_RUNTIME_QUOTA_EXCEEDED_TEAM_CONCURRENT',
			    'TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES',
			    'TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_CONCURRENT',
			    'TEAM_RUNTIME_DELEGATION_TARGET_UNRESOLVED',
			    'TEAM_RUNTIME_LIFECYCLE_TRANSITION_REJECTED',
			    'TEAM_RUNTIME_LIFECYCLE_COMMIT_UNAVAILABLE',
			    'TEAM_RUNTIME_LIFECYCLE_NOT_QUIESCENT',
			    'TEAM_RUNTIME_LIFECYCLE_LIVE_EFFECT_FAILED',
			    'TEAM_RUNTIME_POLICY_RESOLUTION_FAILED',
			    'TEAM_RUNTIME_DURABLE_WRITE_FAILED',
			    'TEAM_RUNTIME_WORK_DELIVERY_FAILED',
			    // runtime/compatibility — COMPATIBILITY_* (P7-T1)
			    'COMPATIBILITY_NEW_WORK_BLOCKED',
			    'COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE',
			    'COMPATIBILITY_ACK_TARGET_NOT_WARNING',
			    'COMPATIBILITY_WORK_UNKNOWN',
			    'COMPATIBILITY_WORK_ALREADY_SETTLED',
			    'COMPATIBILITY_UNBRIDGEABLE_REQUIREMENT',
			    // runtime/lifecycle — LIFECYCLE_* (the runtime lifecycle service)
			    'LIFECYCLE_INVALID_INPUT',
			    'LIFECYCLE_MEMBER_NOT_FOUND',
			    'LIFECYCLE_LEADER_NOT_OPERABLE',
			    'LIFECYCLE_ILLEGAL_STATE',
			    'LIFECYCLE_NOT_QUIESCENT',
			    'LIFECYCLE_LIVE_EFFECT_FAILED',
			    'LIFECYCLE_DURABLE_STATE_FAILED',
			    // runtime/mutation — the mutation service codes
			    'MALFORMED_MUTATION_INPUT',
			    'EXTERNAL_HARD_REJECTED',
			    'UNAUTHORIZED_TRANSITION',
			    'IMMUTABLE_CREATION_FIELD',
			    'UNKNOWN_INSTANCE',
			    'OVERRIDE_IDENTITY_CONFLICT',
			    'OVERRIDE_GENERATION_CONFLICT',
			    'UNAUTHORIZED_MUTATION',
			    // runtime/handoff — HANDOFF_* (the handoff service)
			    'HANDOFF_REQUEST_MALFORMED',
			    'HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
			    'HANDOFF_SUMMARIZATION_FAILED',
			    'HANDOFF_TEAM_CREATION_FAILED',
			    'HANDOFF_SOURCE_HISTORY_ACCESS_DENIED',
			    'HANDOFF_OPERATION_UNKNOWN',
			    'HANDOFF_OPERATION_NOT_DECIDABLE',
			    'HANDOFF_OPERATION_ALREADY_FINALIZED',
			    // domain/member — MEMBER_DOMAIN_* (the member domain rules)
			    'CONTEXT_POLICY_UNKNOWN',
			    'DELEGATION_TARGET_INVALID',
			    'DELEGATION_TARGET_AMBIGUOUS',
			    'DELEGATION_TARGET_DISPOSED',
			    'INSTANCE_ID_RESERVED',
			    'WORKSPACE_MUTATION_FORBIDDEN',
			    // domain/lifecycle — the lifecycle domain rules
			    'LIFECYCLE_TERMINAL_STATE',
			    'LIFECYCLE_ILLEGAL_TRANSITION',
			    // storage/schema — TEAM_DOMAIN_* (the TeamDomain sidecar layer)
			    'TEAM_DOMAIN_EXISTS',
			    'SCHEMA_STAMP_MISSING',
			    'SCHEMA_STAMP_MISMATCH',
			    'SCHEMA_VERSION_MISMATCH',
			    'RECORD_INVALID',
			    'RECORD_DUPLICATE',
			    'NOT_OPEN',
			    'SEAM_FAILURE',
			    // contracts v1 — the frozen identity/DTO rules (TEAM_CONTRACT_ERROR_CODES)
			    'INVALID_SESSION_ID',
			    'INVALID_ROOT_SESSION_ID',
			    'INVALID_CHILD_SESSION_ID',
			    'INVALID_INSTANCE_ID',
			    'INVALID_TEMPLATE_ID',
			    'INVALID_BLUEPRINT_ID',
			    'INVALID_BLUEPRINT_REVISION',
			    'INVALID_BLUEPRINT_CONTENT_HASH',
			    'IDENTITY_SCOPE_MISMATCH',
			    'DUPLICATE_INSTANCE_ID',
			    'DUPLICATE_TEAM_SESSION',
			    'SESSION_ALREADY_BOUND',
			    'MEMBER_NOT_FOUND',
			    'LEGACY_MEMBER_ID_REJECTED',
			    'LEGACY_TEAM_SESSION_EVENT_REJECTED',
			    'SCHEMA_VERSION_UNSUPPORTED',
			    'MALFORMED_DTO',
			    'REMOTE_VALUE_NOT_JSON',
			    'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
			    // s6-principal — S6_PRINCIPAL_ERROR_CODES (A32 spoof rejections)
			    'TEAM_REMOTE_FOREIGN_TEAM',
			    'TEAM_REMOTE_PRINCIPAL_INVALID',
			    // s6-remote — S6_REMOTE_ERROR_CODES (A31 remote-facing codes)
			    'TEAM_REMOTE_LEDGER_PAGE_REJECTED',
			    'TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT',
			    'TEAM_REMOTE_COMPATIBILITY_STATE_MALFORMED',
			    'TEAM_REMOTE_POLICY_STATE_UNKNOWN',
			    'TEAM_REMOTE_CATALOG_REVISION_MALFORMED',
			    'TEAM_REMOTE_LEDGER_ENTRY_MALFORMED',
			    'TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE',
			    'TEAM_REMOTE_LEGACY_HOME_UNAVAILABLE',
			    'TEAM_REMOTE_OVERRIDE_TARGET_REQUIRED',
			    'TEAM_REMOTE_TEAM_CREATE_BLUEPRINT_MISMATCH',
			];
			/** The closed set form of {@link REMOTE_BACKING_ERROR_CODES} (O(1) lookup). */
			export const REMOTE_BACKING_ERROR_CODE_SET = new Set(REMOTE_BACKING_ERROR_CODES);
			/**
			 * Invariant 4b gate (T12-H4): is `code` a member of the closed
			 * backing-service vocabulary? Anything else degrades to `internal-error`.
			 */
			export function isRemoteBackingErrorCode(code) {
			    return typeof code === 'string' && REMOTE_BACKING_ERROR_CODE_SET.has(code);
			}
			/**
			 * Map any failure value to a typed error result (invariants 4/5).
			 * @param error - the thrown value (boundary error, typed domain error, or
			 *   anything else).
			 * @param ctx - the per-request provenance context (method/endpoint/version/
			 *   token echo as far as parsing got).
			 */
			function toRemoteErrorResult(error, ctx) {
			    // Invariant 4a: the remote layer's own typed errors keep their code —
			    // boundary codes and the mirrored frozen P3 ID codes (deviations D-1/D-3).
			    if (isRemoteContractError(error)) {
			        const details = error.details;
			        const field = details !== undefined && typeof details['field'] === 'string' ? details['field'] : undefined;
			        const reason = details !== undefined && typeof details['reason'] === 'string'
			            ? details['reason']
			            : undefined;
			        return buildRemoteError(error.code, error.message, ctx, { field, reason });
			    }
			    // Invariant 4b (T12-H4): ONLY an error whose string `code` is a member of
			    // the closed backing vocabulary passes through with code + message; the
			    // source identity rides under details.cause (never its stack, never a live
			    // object — lossless-checked under cause.details). An `Error` with an
			    // out-of-vocabulary `code` (a Node ENOENT with a path in the message, a
			    // synthetic code, …) is NOT a typed domain error — invariant 5 below maps
			    // it to internal-error with a generic message and no leak.
			    if (error instanceof Error) {
			        const typed = error;
			        if (isRemoteBackingErrorCode(typed.code)) {
			            return buildRemoteError(typed.code, typed.message, ctx, {
			                reason: 'domain-error',
			                cause: { code: typed.code, message: typed.message },
			                sourceDetails: typed.details,
			            });
			        }
			    }
			    // Invariant 5: an untyped throw — generic message, no leak.
			    return buildRemoteError(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR, 'internal error in remote handler', ctx, { reason: 'untyped-error' });
			}
			/**
			 * Create the throw-proof dispatcher for one deps object.
			 * @param deps - the twelve backing ports (injected; no global state).
			 * @returns the seam entry point: `(endpoint, payload) => Promise<RemoteResponse>`.
			 */
			export function createRemoteDispatcher(deps) {
			    const handlers = buildCategoryHandlers(deps);
			    return (endpoint, payload) => {
			        let ctx = {
			            method: endpoint,
			            endpoint,
			            contractVersion: REMOTE_CONTRACT_VERSION,
			            requestToken: null,
			        };
			        let response;
			        try {
			            // Invariant 1: unknown endpoint (checked before the envelope).
			            if (!isRemoteMethod(endpoint)) {
			                throw remoteContractError(REMOTE_CONTRACT_ERROR_CODES.UNKNOWN_METHOD, `endpoint '${endpoint}' is not a method of the closed Remote contract v1 catalog`, { reason: 'unknown-endpoint' });
			            }
			            // Invariant 2: the request envelope (closed: version + params).
			            const request = parseRemoteRequest(payload);
			            ctx = { ...ctx, contractVersion: request.version };
			            // Invariant 3: the method's closed param schema.
			            const parsed = parseRemoteMethodParams(endpoint, request.params);
			            ctx = { ...ctx, requestToken: parsed.requestToken };
			            // Invariants 4/5: the category handler (the backing port call).
			            const outcome = handlers[remoteCategoryOf(endpoint)](endpoint, parsed.params);
			            // Invariant 6: lossless check + provenance on the success value.
			            response = buildRemoteSuccess(outcome.data, {
			                ...ctx,
			                projectionGeneration: outcome.projectionGeneration ?? null,
			                effectSequence: outcome.effectSequence ?? null,
			            });
			        }
			        catch (error) {
			            response = toRemoteErrorResult(error, ctx);
			        }
			        // Invariant 7: the promise never rejects.
			        return Promise.resolve(response);
			    };
			}
			//# sourceMappingURL=dispatch.js.map
			}, exports: {} };
		__mods["../../remote/src/handlers/register.js"] = { done: false, fn: function (exports) {
			const __imp27 = __req("../../remote/src/handlers/dispatch.js");
			const createRemoteDispatcher = __imp27.createRemoteDispatcher;
			/**
			 * Seam registration of the Remote contract v1 (design note §6, P2-T6
			 * reference).
			 *
			 * `registerRemoteHandlers` is PURE w.r.t. the seam: it only calls the
			 * injected `connection.rpc.handle(channel, dispatcher)` — the public seam
			 * characterized in P2-T6 — and wraps the returned disposer (if any) in a
			 * `dispose()`. It performs no I/O of its own and keeps no global state;
			 * the host wiring (a later P8 harness task) installs it as a
			 * caller-fiber effect:
			 *
			 * ```ts
			 * ctx.effect(
			 *   () => {
			 *     const reg = registerRemoteHandlers(connection, deps)
			 *     return () => reg.dispose()
			 *   },
			 *   'p8-remote: rpc channel',
			 * )
			 * ```
			 *
			 * so stop / update / undefine removes the registration (reversible).
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions.
			 * @module @dsh-agent-team/remote/handlers/register
			 */
			/**
			 * The single RPC channel the Remote contract v1 owns (one
			 * `rpc.handle` owner; dotted method names as endpoints).
			 */
			const REMOTE_RPC_CHANNEL = '/team-remote';
			Object.defineProperty(exports, "REMOTE_RPC_CHANNEL", { enumerable: true, get: () => REMOTE_RPC_CHANNEL });
			/**
			 * Register the Remote contract v1 handlers on the public seam.
			 * @param connection - the seam connection (only `rpc.handle` is used).
			 * @param deps - the twelve backing ports (injected; no global state).
			 * @param options - optional channel override.
			 * @returns the registration (channel + dispose).
			 */
			function registerRemoteHandlers(connection, deps, options) {
			    const channel = options?.channel === undefined ? REMOTE_RPC_CHANNEL : options.channel;
			    const dispatcher = createRemoteDispatcher(deps);
			    const handleResult = connection.rpc.handle(channel, dispatcher);
			    if (typeof handleResult === 'function') {
			        const disposeRegistration = handleResult;
			        let disposed = false;
			        return {
			            channel,
			            dispose: () => {
			                if (disposed)
			                    return;
			                disposed = true;
			                disposeRegistration();
			            },
			        };
			    }
			    return { channel, dispose: () => { } };
			}
			Object.defineProperty(exports, "registerRemoteHandlers", { enumerable: true, get: () => registerRemoteHandlers });
			//# sourceMappingURL=register.js.map
			}, exports: {} };
		__mods["../../remote/src/push/reconnect.js"] = { done: false, fn: function (exports) {
			/**
			 * P8-T4 push model — the reconnect backoff rule (pure).
			 *
			 * Aligned with the P2-T6 reconnect characterization (the remote RPC seam
			 * over the frozen `REMOTE_RPC_CHANNEL`):
			 *
			 *   - the two seam states are `connected` / `reconnecting` (R1);
			 *   - on loss: state → `reconnecting`, the attempt counter increments,
			 *     and the retry delay is exponential with a hard cap:
			 *     `cap(attempt) = min(maxMs, baseMs · factor^(attempt−1))` (R2);
			 *   - the concrete delay lies within `[cap/2, cap]` (R2: the observed
			 *     delay never leaves half the cap up to the cap);
			 *   - restart-after-stop re-enters `connected` with ZERO state-change
			 *     events because the last seam state persists across the stop (R1);
			 *   - state-change reporting is deduplicated: a transition to the state
			 *     already current emits nothing (R1 / R3).
			 *
			 * The engine keeps no timers: the backoff is a computed delay the
			 * client schedules through an injected `delay` function (the test
			 * fixture drives it with a deterministic clock; a deployment injects a
			 * real timer). This module only computes caps, bounds, delays and
			 * state transitions.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions. Erasable TS only.
			 * @module @dsh-agent-team/remote/push/reconnect
			 */
			/**
			 * A local (never wire-crossed) error for a backoff picker result outside
			 * the frozen `[cap/2, cap]` bounds or a malformed delay.
			 */
			class PushBackoffRangeError extends Error {
			    constructor(message) {
			        super(message);
			        this.name = 'PushBackoffRangeError';
			    }
			}
			Object.defineProperty(exports, "PushBackoffRangeError", { enumerable: true, get: () => PushBackoffRangeError });
			/**
			 * The exponential backoff cap for one loss attempt (P2-T6 R2 formula):
			 * `min(maxMs, baseMs · factor^(attempt−1))`.
			 * @param attempt - the 1-based loss attempt number.
			 * @param cfg - the backoff configuration.
			 * @returns the cap in milliseconds (integer).
			 * @throws {PushBackoffRangeError} on a malformed attempt or configuration.
			 */
			function backoffCapMs(attempt, cfg) {
			    if (!Number.isInteger(attempt) || attempt < 1) {
			        throw new PushBackoffRangeError(`backoff attempt must be a positive integer: ${attempt}`);
			    }
			    if (!Number.isInteger(cfg.baseMs) || cfg.baseMs < 1) {
			        throw new PushBackoffRangeError(`backoff baseMs must be a positive integer: ${cfg.baseMs}`);
			    }
			    if (!Number.isInteger(cfg.maxMs) || cfg.maxMs < 1) {
			        throw new PushBackoffRangeError(`backoff maxMs must be a positive integer: ${cfg.maxMs}`);
			    }
			    if (!(cfg.factor >= 1)) {
			        throw new PushBackoffRangeError(`backoff factor must be >= 1: ${cfg.factor}`);
			    }
			    const raw = cfg.baseMs * cfg.factor ** (attempt - 1);
			    const cap = Math.min(cfg.maxMs, raw);
			    return Math.floor(cap);
			}
			Object.defineProperty(exports, "backoffCapMs", { enumerable: true, get: () => backoffCapMs });
			/**
			 * The deterministic default delay picker: the lower bound of the frozen
			 * `[cap/2, cap]` window (floor of half the cap, at least 1 ms). A
			 * deployment may inject a picker anywhere inside the window; the engine
			 * validates the result.
			 * @param capMs - the backoff cap for the attempt.
			 * @returns the delay in milliseconds, within `[capMs/2, capMs]`.
			 */
			function defaultDelayPicker(capMs) {
			    return Math.max(1, Math.floor(capMs / 2));
			}
			Object.defineProperty(exports, "defaultDelayPicker", { enumerable: true, get: () => defaultDelayPicker });
			/**
			 * Pick the concrete retry delay for one backoff cap and validate it
			 * against the frozen R2 bounds.
			 * @param capMs - the backoff cap for the attempt.
			 * @param pick - the delay picker (default: the deterministic lower bound).
			 * @returns the delay in milliseconds, guaranteed within `[capMs/2, capMs]`.
			 * @throws {PushBackoffRangeError} when the picker result leaves the window.
			 */
			function pickBackoffDelayMs(capMs, pick = defaultDelayPicker) {
			    const delay = pick(capMs);
			    const lower = capMs / 2;
			    if (!Number.isInteger(delay) || delay < lower || delay > capMs) {
			        throw new PushBackoffRangeError(`backoff delay ${delay} outside the frozen bounds [${lower}, ${capMs}]`);
			    }
			    return delay;
			}
			Object.defineProperty(exports, "pickBackoffDelayMs", { enumerable: true, get: () => pickBackoffDelayMs });
			/**
			 * The loss transition: any seam state under a channel loss becomes
			 * `reconnecting` (P2-T6 R1).
			 * @param current - the current seam state, or `null` before the first.
			 * @returns the state after the loss.
			 */
			function stateOnLoss(current) {
			    void current;
			    return 'reconnecting';
			}
			Object.defineProperty(exports, "stateOnLoss", { enumerable: true, get: () => stateOnLoss });
			/**
			 * The success transition: a completed pull/retry restores `connected`.
			 * @returns the state after the successful round trip.
			 */
			function stateOnConnect() {
			    return 'connected';
			}
			Object.defineProperty(exports, "stateOnConnect", { enumerable: true, get: () => stateOnConnect });
			/**
			 * Whether a state change event must be emitted for a transition (R1/R3
			 * deduplication): `true` only when the new state differs from the last
			 * emitted one; a restart that re-enters the persisted state emits
			 * nothing.
			 * @param last - the last emitted seam state (persisted across stops).
			 * @param next - the state to transition to.
			 * @returns whether the transition is a change.
			 */
			function isStateChange(last, next) {
			    return last !== next;
			}
			Object.defineProperty(exports, "isStateChange", { enumerable: true, get: () => isStateChange });
			//# sourceMappingURL=reconnect.js.map
			}, exports: {} };
		__mods["../../remote/src/push/generation.js"] = { done: false, fn: function (exports) {
			/**
			 * P8-T4 push model — the whole-projection generation rule (pure).
			 *
			 * The server-side truth is the monotonic `generation` of the frozen
			 * `RemoteProjectionValue` (>= 1, contracts/types). The client-side rule
			 * is the exact mirror of the frozen P8-T1 stale guard
			 * (`isStaleTeamProjection`, packages/contracts/projection):
			 *
			 *   stale  ⇔  same teamSessionId AND incoming.generation <= current
			 *
			 * which, on a per-client basis, decomposes into the closed verdict set
			 * (`generation.ts` decides; `pull.ts` lifts the decision onto a frozen
			 * `RemoteResponse`):
			 *
			 *   first frame (nothing applied yet)            → apply
			 *   different teamSessionId                      → foreign
			 *   incoming.generation >  applied.generation    → apply
			 *   incoming.generation == applied.generation    → duplicate
			 *   incoming.generation <  applied.generation    → stale
			 *
			 * Gate G8 consequence: a frame is applied IFF it is strictly newer, so a
			 * delayed / duplicated / out-of-order response can never overwrite a new
			 * state.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions. Erasable TS only.
			 * @module @dsh-agent-team/remote/push/generation
			 */
			/**
			 * The minimum legal projection generation (frozen: `generation >= 1`
			 * safe integer, contracts/types).
			 */
			const PUSH_MIN_GENERATION = 1;
			Object.defineProperty(exports, "PUSH_MIN_GENERATION", { enumerable: true, get: () => PUSH_MIN_GENERATION });
			/**
			 * Whether a candidate generation is strictly newer than the applied
			 * generation.
			 * @param candidate - the incoming frame's generation.
			 * @param applied - the applied generation, or `null` before the first
			 *   frame.
			 * @returns `true` when the frame must replace the applied state.
			 */
			function isStrictlyNewerGeneration(candidate, applied) {
			    if (applied === null) {
			        return candidate >= PUSH_MIN_GENERATION;
			    }
			    return candidate > applied;
			}
			Object.defineProperty(exports, "isStrictlyNewerGeneration", { enumerable: true, get: () => isStrictlyNewerGeneration });
			/**
			 * Decide the closed verdict of one incoming frame against the applied
			 * state (the mirror of the frozen stale guard, see module doc).
			 * @param applied - the applied identity, or `null` before the first frame.
			 * @param incoming - the frame identity (`teamSessionId` + `generation`).
			 * @returns the closed `FrameVerdict`.
			 */
			function decideFrameVerdict(applied, incoming) {
			    if (applied === null) {
			        return 'apply';
			    }
			    if (applied.teamSessionId !== incoming.teamSessionId) {
			        return 'foreign';
			    }
			    if (isStrictlyNewerGeneration(incoming.generation, applied.generation)) {
			        return 'apply';
			    }
			    if (incoming.generation === applied.generation) {
			        return 'duplicate';
			    }
			    return 'stale';
			}
			Object.defineProperty(exports, "decideFrameVerdict", { enumerable: true, get: () => decideFrameVerdict });
			//# sourceMappingURL=generation.js.map
			}, exports: {} };
		__mods["../../remote/src/push/pull.js"] = { done: false, fn: function (exports) {
			const __imp24 = __req("../../remote/src/push/generation.js");
			const decideFrameVerdict = __imp24.decideFrameVerdict;
			const PUSH_MIN_GENERATION = __imp24.PUSH_MIN_GENERATION;
			/**
			 * P8-T4 push model — the deterministic pull surface (pure).
			 *
			 * The engine never keeps its own copy of team state: the "pull" is one
			 * frozen `team.getProjection` round trip, and the assessment of the
			 * response is a pure function of (applied identity, response). This is
			 * the "versioned invalidation + pull" half of the card: the client
			 * invalidates (re-pulls) on demand, and the generation rule in
			 * `generation.ts` decides what the response may do.
			 *
			 * Two invariants, both Gate G8:
			 *   1. A frame is never applied without a generation check — a response
			 *      whose frame lacks a positive integer generation, or whose data
			 *      generation disagrees with the provenance generation, is rejected
			 *      as `inconsistent` (the client treats a server-side inconsistency
			 *      like a stale frame: no overwrite).
			 *   2. Every RPC-level outcome is typed (the frozen dispatcher never
			 *      rejects): `rpc-error` assessments carry the pass-through code and
			 *      change no state.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions. Erasable TS only.
			 * @module @dsh-agent-team/remote/push/pull
			 */
			/** The catalog endpoint that serves the whole projection (frozen). */
			const PULL_PROJECTION_ENDPOINT = 'team.getProjection';
			Object.defineProperty(exports, "PULL_PROJECTION_ENDPOINT", { enumerable: true, get: () => PULL_PROJECTION_ENDPOINT });
			/**
			 * Read the frame out of a success response, or `null` when the frame is
			 * not usable: not a structurally positive-generation projection, or the
			 * provenance generation disagrees with the data generation (both map to
			 * the `inconsistent` assessment).
			 * @param response - a frozen `RemoteResponse` of a projection pull.
			 * @returns the frame identity + the full frame, when usable.
			 */
			function readFrameShape(response) {
			    if (!response.ok) {
			        return null;
			    }
			    const data = response.value.data;
			    if (typeof data !== 'object' || data === null) {
			        return null;
			    }
			    const record = data;
			    const projection = record['projection'];
			    if (typeof projection !== 'object' || projection === null) {
			        return null;
			    }
			    const projRecord = projection;
			    const teamSessionId = projRecord['teamSessionId'];
			    const generation = projRecord['generation'];
			    if (typeof teamSessionId !== 'string' ||
			        typeof generation !== 'number' ||
			        !Number.isInteger(generation) ||
			        generation < PUSH_MIN_GENERATION) {
			        return null;
			    }
			    const identity = { teamSessionId, generation };
			    // G8 provenance cross-check: the data generation and the provenance
			    // generation must agree (the frozen provenance block exists exactly for
			    // staleness/origin detection). A mismatch makes the frame unusable —
			    // no assessment can ever apply it.
			    if (response.value.provenance.projectionGeneration !== generation) {
			        return null;
			    }
			    const frame = {
			        projection: projection,
			        provenance: response.value.provenance,
			    };
			    return { identity, frame };
			}
			/**
			 * Assess one pulled projection response against the applied identity
			 * (pure: no state mutation — the caller applies the assessment).
			 * @param applied - the applied identity, or `null` before the first frame.
			 * @param response - the frozen `RemoteResponse` of the pull.
			 * @returns the closed deterministic assessment (see module doc).
			 */
			function assessProjectionSync(applied, response) {
			    if (!response.ok) {
			        return {
			            status: 'rpc-error',
			            code: response.error.code,
			            receivedGeneration: null,
			        };
			    }
			    const shape = readFrameShape(response);
			    if (shape === null) {
			        return { status: 'inconsistent', receivedGeneration: null };
			    }
			    const verdict = decideFrameVerdict(applied, shape.identity);
			    return { status: verdict, receivedGeneration: shape.identity.generation };
			}
			Object.defineProperty(exports, "assessProjectionSync", { enumerable: true, get: () => assessProjectionSync });
			/**
			 * Extract the frame from a response when — and only when — the frame is
			 * usable (success, structurally valid, provenance-consistent). The
			 * client calls this AFTER `assessProjectionSync` returned `apply`, so a
			 * frame can never reach the applied state without the generation check.
			 * @param response - the frozen `RemoteResponse` of the pull.
			 * @returns the frame, or `null` when the frame is not usable.
			 */
			function extractPushFrame(response) {
			    return readFrameShape(response)?.frame ?? null;
			}
			Object.defineProperty(exports, "extractPushFrame", { enumerable: true, get: () => extractPushFrame });
			/**
			 * The verdict of `apply` expressed against the applied identity — the
			 * one assessment status that permits a state change.
			 * @param assessment - a deterministic pull assessment.
			 * @returns `true` only for `apply`.
			 */
			function isApplyAssessment(assessment) {
			    return assessment.status === 'apply';
			}
			Object.defineProperty(exports, "isApplyAssessment", { enumerable: true, get: () => isApplyAssessment });
			//# sourceMappingURL=pull.js.map
			}, exports: {} };
		__mods["../../remote/src/push/ledger-page.js"] = { done: false, fn: function (exports) {
			/**
			 * P8-T4 push model — the ledger page anchor rule (pure).
			 *
			 * The server side is the frozen D-5 slicer (P8-T3): `team.getLedgerPage`
			 * returns the entries with `sequence > afterSequence`, sliced to `limit`,
			 * and sets `nextAfterSequence` to the last included sequence IFF more
			 * entries remain. This module is the client-side mirror of that contract
			 * — the "page anchor" of the card:
			 *
			 *   1. every entry sits strictly after the anchor;
			 *   2. entry sequences are strictly ascending;
			 *   3. the page never exceeds `limit`;
			 *   4. a page carrying a cursor is a full page (`limit` entries) and the
			 *      cursor equals the last included sequence; an empty page has no
			 *      cursor;
			 *   5. `total` is non-negative and never decreases (the ledger is
			 *      append-only) — this is what makes paging stable under growth:
			 *      re-reading an anchor yields the same page, and the total only
			 *      moves up.
			 *
			 * The tracker enforces the correlation guard on top of the shape checks:
			 * only the tracker's CURRENT anchor may advance the cursor, so a stale
			 * or duplicate in-flight page response (one answering an older anchor)
			 * can never move the cursor backward or double-apply.
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions. Erasable TS only.
			 * @module @dsh-agent-team/remote/push/ledger-page
			 */
			/**
			 * Check one page against its anchor request (pure shape checks 1–5 from
			 * the module doc; no correlation — the tracker adds that).
			 * @param request - the anchored request the page answers.
			 * @param page - the frozen `RemoteLedgerPageValue` page.
			 * @param lastTotal - the total seen by the caller so far, or `null`.
			 * @returns the closed deterministic check result.
			 */
			function verifyLedgerPageAnchor(request, page, lastTotal) {
			    if (page.total < 0) {
			        return { ok: false, reason: 'total-negative' };
			    }
			    if (lastTotal !== null && page.total < lastTotal) {
			        return { ok: false, reason: 'total-decreased' };
			    }
			    if (page.entries.length > request.limit) {
			        return { ok: false, reason: 'page-exceeds-limit' };
			    }
			    let previous = -1;
			    for (const entry of page.entries) {
			        if (entry.sequence <= request.afterSequence) {
			            return { ok: false, reason: 'sequence-before-anchor' };
			        }
			        if (entry.sequence <= previous) {
			            return { ok: false, reason: 'not-strictly-ascending' };
			        }
			        previous = entry.sequence;
			    }
			    const last = page.entries[page.entries.length - 1];
			    if (page.nextAfterSequence !== null) {
			        if (last === undefined || page.nextAfterSequence !== last.sequence) {
			            return { ok: false, reason: 'cursor-mismatch' };
			        }
			        if (page.entries.length < request.limit) {
			            return { ok: false, reason: 'non-terminal-page-short' };
			        }
			    }
			    return { ok: true, entriesCount: page.entries.length, total: page.total };
			}
			Object.defineProperty(exports, "verifyLedgerPageAnchor", { enumerable: true, get: () => verifyLedgerPageAnchor });
			/**
			 * Create a ledger page tracker starting at `afterSequence` (default 0:
			 * the ledger head).
			 * @param afterSequence - the initial cursor.
			 * @returns the tracker.
			 */
			function createLedgerPageTracker(afterSequence = 0) {
			    let anchor = afterSequence;
			    let lastTotal = null;
			    let pagesApplied = 0;
			    let pagesRejected = 0;
			    const applyPage = (request, page) => {
			        if (request.afterSequence !== anchor) {
			            pagesRejected += 1;
			            return { ok: false, reason: 'anchor-mismatch' };
			        }
			        const result = verifyLedgerPageAnchor(request, page, lastTotal);
			        if (!result.ok) {
			            pagesRejected += 1;
			            return result;
			        }
			        pagesApplied += 1;
			        lastTotal = result.total;
			        if (page.nextAfterSequence !== null) {
			            anchor = page.nextAfterSequence;
			        }
			        return result;
			    };
			    const state = () => ({
			        anchor,
			        lastTotal,
			        pagesApplied,
			        pagesRejected,
			    });
			    return { state, applyPage };
			}
			Object.defineProperty(exports, "createLedgerPageTracker", { enumerable: true, get: () => createLedgerPageTracker });
			//# sourceMappingURL=ledger-page.js.map
			}, exports: {} };
		__mods["../../remote/src/push/types.js"] = { done: false, fn: function (exports) {
			/**
			 * P8-T4 push model — shared wire/state types of the client-side sync engine.
			 *
			 * Push model (plan §21.4, "correctness first"): the server side is the
			 * frozen P8-T3 contract v1 surface — `team.getProjection` (whole
			 * generation: the full `RemoteProjectionValue` + `generation`) and
			 * `team.getLedgerPage` (versioned paging). "Push" is therefore a
			 * versioned state + deterministic pull: every projection the client
			 * receives carries a monotonic generation, and the client applies a
			 * frame only when it is strictly newer than the applied generation
			 * (Gate G8: a new state must never be overwritten by a stale response).
			 *
			 * This module is the vocabulary shared by the pure engine modules
			 * (`generation`, `pull`, `reconnect`, `ledger-page`) and by the test
			 * client / fake server fixtures (`test/p8t4-*`). It defines no behavior.
			 *
			 * Frozen authorities mirrored here (no redefinition):
			 *   - `RemoteResponse` / `RemoteProvenance` (contracts/response)
			 *   - `RemoteProjectionValue` / `RemoteLedgerPageValue` (contracts/types)
			 *   - stale rule: `isStaleTeamProjection` (packages/contracts, P8-T1)
			 *   - reconnect state + backoff bounds (P2-T6 characterization R1–R2)
			 *
			 * Pure module: no I/O, no node: builtins, no runtime environment
			 * assumptions. Erasable TS only.
			 * @module @dsh-agent-team/remote/push/types
			 */
			/**
			 * The sentinel thrown by a transport when the seam channel is lost.
			 * Carries no state, no stack-dependent detail: the engine maps it to the
			 * `reconnecting` state + backoff (P2-T6 R1–R2). Never serialized, never
			 * sent across the wire — transport failure is a channel property, not a
			 * message.
			 */
			class PushTransportLossError extends Error {
			    constructor(message = 'remote push transport: seam channel lost') {
			        super(message);
			        this.name = 'PushTransportLossError';
			    }
			}
			Object.defineProperty(exports, "PushTransportLossError", { enumerable: true, get: () => PushTransportLossError });
			//# sourceMappingURL=types.js.map
			}, exports: {} };
		__mods["../../contracts/src/index.js"] = { done: false, fn: function (exports) {
			/**
			 * @dsh-agent-team/contracts — frozen shared contracts v1 for DSH Agent Team vNext.
			 *
			 * The single source for the stable, serializable contract vocabulary every
			 * other vNext package consumes (Development Plan §9.1): IDs, DTOs, error
			 * codes, schema version, remote-safe values. This package contains NO
			 * business state mutation, NO Cordis service, NO storage, NO React, and NO
			 * live Agent dependency (TaskDoc §11.4 P3-T1).
			 *
			 * FROZEN as of contract v1 (P3-T1). After this freeze no other task may
			 * modify contracts v1 semantics; changes go through a new version per the
			 * rule in CHANGELOG.md.
			 *
			 * Authority: `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`
			 * (Architecture Frozen), in particular:
			 *
			 * - object model TeamBlueprint -> TeamSession + TeamDomain -> MemberInstance;
			 * - invariant 8: one Root Session -> 0 or 1 TeamSession;
			 * - invariant 9: **TeamSessionId = RootSessionId**;
			 * - invariant 10: one TeamSession binds exactly one immutable Blueprint snapshot;
			 * - invariant 13: a blueprint carries exactly one complete LeaderTemplate;
			 * - invariant 14: LeaderInstance is the only special MemberInstance (no childSessionId);
			 * - invariant 17: one MemberTemplate produces 0..N MemberInstances;
			 * - invariant 18: **member runtime identity = (rootSessionId, instanceId)**;
			 * - invariant 19: label / templateId / groupId are NOT runtime identities;
			 * - invariant 20: groupId has no state/permission/lifecycle/activation semantics;
			 * - invariant 23: every MemberInstance binds exactly one durable child Session;
			 * - invariant 29: contextPolicy freezes at creation (carried by later versions);
			 * - invariant 41: Team control-plane durable authority = TeamDomain;
			 * - invariant 42: **no Team-specific DSH SessionEvent vocabulary**;
			 * - invariant 65: existing legacy Team Sessions are READ-ONLY, never auto-migrated;
			 * - §29: MemberInstance lifecycle = CREATED | RUNNING | SETTLED | ARCHIVED | DISPOSED.
			 *
			 * Skeleton status note: the P1-T1 skeleton marker (`PACKAGE_ID`) is retained
			 * for compatibility with the skeleton tests; all contract content below is
			 * the P3-T1 v1 freeze.
			 * @module @dsh-agent-team/contracts
			 */
			/**
			 * Stable identity marker of the contracts package (retained from the P1-T1
			 * skeleton; asserted by the package unit test).
			 */
			const PACKAGE_ID = 'contracts';
			Object.defineProperty(exports, "PACKAGE_ID", { enumerable: true, get: () => PACKAGE_ID });
			// --- schema version -------------------------------------------------------
			Object.defineProperty(exports, "TEAM_CONTRACT_SCHEMA_VERSION", { enumerable: true, get: () => __re0.TEAM_CONTRACT_SCHEMA_VERSION });
			Object.defineProperty(exports, "LEADER_INSTANCE_RECORD_SCHEMA_VERSION", { enumerable: true, get: () => __re0.LEADER_INSTANCE_RECORD_SCHEMA_VERSION });
			Object.defineProperty(exports, "SUPPORTED_SCHEMA_VERSIONS", { enumerable: true, get: () => __re0.SUPPORTED_SCHEMA_VERSIONS });
			Object.defineProperty(exports, "isSupportedSchemaVersion", { enumerable: true, get: () => __re0.isSupportedSchemaVersion });
			Object.defineProperty(exports, "assertSupportedSchemaVersion", { enumerable: true, get: () => __re0.assertSupportedSchemaVersion });
			Object.defineProperty(exports, "assertSchemaVersion", { enumerable: true, get: () => __re0.assertSchemaVersion });
			const __re0 = __req("../../contracts/src/schema-version.js");
			// --- errors ----------------------------------------------------------------
			Object.defineProperty(exports, "TeamContractErrorCode", { enumerable: true, get: () => __re1.TeamContractErrorCode });
			Object.defineProperty(exports, "TEAM_CONTRACT_ERROR_CODE_VALUES", { enumerable: true, get: () => __re1.TEAM_CONTRACT_ERROR_CODE_VALUES });
			Object.defineProperty(exports, "TeamContractError", { enumerable: true, get: () => __re1.TeamContractError });
			Object.defineProperty(exports, "teamContractError", { enumerable: true, get: () => __re1.teamContractError });
			Object.defineProperty(exports, "isTeamContractError", { enumerable: true, get: () => __re1.isTeamContractError });
			const __re1 = __req("../../contracts/src/errors.js");
			// --- remote-safe (lossless-JSON) values -------------------------------------
			Object.defineProperty(exports, "isRemoteSafeJsonValue", { enumerable: true, get: () => __re2.isRemoteSafeJsonValue });
			Object.defineProperty(exports, "assertRemoteSafeJsonValue", { enumerable: true, get: () => __re2.assertRemoteSafeJsonValue });
			Object.defineProperty(exports, "toRemoteSafeDetail", { enumerable: true, get: () => __re2.toRemoteSafeDetail });
			Object.defineProperty(exports, "canonicalJsonStringify", { enumerable: true, get: () => __re2.canonicalJsonStringify });
			Object.defineProperty(exports, "deepFreeze", { enumerable: true, get: () => __re2.deepFreeze });
			const __re2 = __req("../../contracts/src/remote-safe.js");
			// --- identities -------------------------------------------------------------
			Object.defineProperty(exports, "SESSION_ID_MAX_LENGTH", { enumerable: true, get: () => __re3.SESSION_ID_MAX_LENGTH });
			Object.defineProperty(exports, "parseSessionId", { enumerable: true, get: () => __re3.parseSessionId });
			Object.defineProperty(exports, "parseRootSessionId", { enumerable: true, get: () => __re3.parseRootSessionId });
			Object.defineProperty(exports, "parseTeamSessionId", { enumerable: true, get: () => __re3.parseTeamSessionId });
			Object.defineProperty(exports, "parseChildSessionId", { enumerable: true, get: () => __re3.parseChildSessionId });
			Object.defineProperty(exports, "isSessionId", { enumerable: true, get: () => __re3.isSessionId });
			Object.defineProperty(exports, "isRootSessionId", { enumerable: true, get: () => __re3.isRootSessionId });
			Object.defineProperty(exports, "isChildSessionId", { enumerable: true, get: () => __re3.isChildSessionId });
			Object.defineProperty(exports, "teamSessionIdOf", { enumerable: true, get: () => __re3.teamSessionIdOf });
			const __re3 = __req("../../contracts/src/ids/session-id.js");
			Object.defineProperty(exports, "INSTANCE_ID_PATTERN", { enumerable: true, get: () => __re4.INSTANCE_ID_PATTERN });
			Object.defineProperty(exports, "INSTANCE_ID_MAX_LENGTH", { enumerable: true, get: () => __re4.INSTANCE_ID_MAX_LENGTH });
			Object.defineProperty(exports, "parseInstanceId", { enumerable: true, get: () => __re4.parseInstanceId });
			Object.defineProperty(exports, "isInstanceId", { enumerable: true, get: () => __re4.isInstanceId });
			const __re4 = __req("../../contracts/src/ids/instance-id.js");
			Object.defineProperty(exports, "TEMPLATE_ID_PATTERN", { enumerable: true, get: () => __re5.TEMPLATE_ID_PATTERN });
			Object.defineProperty(exports, "TEMPLATE_ID_MAX_LENGTH", { enumerable: true, get: () => __re5.TEMPLATE_ID_MAX_LENGTH });
			Object.defineProperty(exports, "parseTemplateId", { enumerable: true, get: () => __re5.parseTemplateId });
			Object.defineProperty(exports, "isTemplateId", { enumerable: true, get: () => __re5.isTemplateId });
			const __re5 = __req("../../contracts/src/ids/template-id.js");
			Object.defineProperty(exports, "BLUEPRINT_ID_MAX_LENGTH", { enumerable: true, get: () => __re6.BLUEPRINT_ID_MAX_LENGTH });
			Object.defineProperty(exports, "BLUEPRINT_REVISION_MAX_LENGTH", { enumerable: true, get: () => __re6.BLUEPRINT_REVISION_MAX_LENGTH });
			Object.defineProperty(exports, "BLUEPRINT_CONTENT_HASH_MAX_LENGTH", { enumerable: true, get: () => __re6.BLUEPRINT_CONTENT_HASH_MAX_LENGTH });
			Object.defineProperty(exports, "parseBlueprintId", { enumerable: true, get: () => __re6.parseBlueprintId });
			Object.defineProperty(exports, "parseBlueprintRevision", { enumerable: true, get: () => __re6.parseBlueprintRevision });
			Object.defineProperty(exports, "parseBlueprintContentHash", { enumerable: true, get: () => __re6.parseBlueprintContentHash });
			Object.defineProperty(exports, "isBlueprintId", { enumerable: true, get: () => __re6.isBlueprintId });
			const __re6 = __req("../../contracts/src/ids/blueprint-id.js");
			// --- member identity (composite key) ----------------------------------------
			Object.defineProperty(exports, "LEADER_INSTANCE_ID", { enumerable: true, get: () => __re7.LEADER_INSTANCE_ID });
			Object.defineProperty(exports, "createMemberIdentity", { enumerable: true, get: () => __re7.createMemberIdentity });
			Object.defineProperty(exports, "leaderMemberIdentityOf", { enumerable: true, get: () => __re7.leaderMemberIdentityOf });
			Object.defineProperty(exports, "memberIdentityKey", { enumerable: true, get: () => __re7.memberIdentityKey });
			Object.defineProperty(exports, "parseMemberIdentityKey", { enumerable: true, get: () => __re7.parseMemberIdentityKey });
			Object.defineProperty(exports, "memberIdentitiesEqual", { enumerable: true, get: () => __re7.memberIdentitiesEqual });
			Object.defineProperty(exports, "assertMemberIdentityInTeam", { enumerable: true, get: () => __re7.assertMemberIdentityInTeam });
			const __re7 = __req("../../contracts/src/identity.js");
			// --- DTOs --------------------------------------------------------------------
			Object.defineProperty(exports, "TEAM_SESSION_RECORD_FIELDS", { enumerable: true, get: () => __re8.TEAM_SESSION_RECORD_FIELDS });
			Object.defineProperty(exports, "parseTeamSessionRecord", { enumerable: true, get: () => __re8.parseTeamSessionRecord });
			Object.defineProperty(exports, "createTeamSessionRecord", { enumerable: true, get: () => __re8.createTeamSessionRecord });
			Object.defineProperty(exports, "serializeTeamSessionRecord", { enumerable: true, get: () => __re8.serializeTeamSessionRecord });
			Object.defineProperty(exports, "deserializeTeamSessionRecord", { enumerable: true, get: () => __re8.deserializeTeamSessionRecord });
			const __re8 = __req("../../contracts/src/dto/team-session-record.js");
			Object.defineProperty(exports, "MEMBER_LIFECYCLE_STATES", { enumerable: true, get: () => __re9.MEMBER_LIFECYCLE_STATES });
			Object.defineProperty(exports, "MEMBER_LIFECYCLE_STATE_VALUES", { enumerable: true, get: () => __re9.MEMBER_LIFECYCLE_STATE_VALUES });
			Object.defineProperty(exports, "isMemberLifecycleState", { enumerable: true, get: () => __re9.isMemberLifecycleState });
			Object.defineProperty(exports, "MEMBER_INSTANCE_RECORD_FIELDS", { enumerable: true, get: () => __re9.MEMBER_INSTANCE_RECORD_FIELDS });
			Object.defineProperty(exports, "LEADER_INSTANCE_RECORD_FIELDS", { enumerable: true, get: () => __re9.LEADER_INSTANCE_RECORD_FIELDS });
			Object.defineProperty(exports, "LEADER_INSTANCE_RECORD_INPUT_FIELDS", { enumerable: true, get: () => __re9.LEADER_INSTANCE_RECORD_INPUT_FIELDS });
			Object.defineProperty(exports, "parseMemberInstanceRecord", { enumerable: true, get: () => __re9.parseMemberInstanceRecord });
			Object.defineProperty(exports, "createMemberInstanceRecord", { enumerable: true, get: () => __re9.createMemberInstanceRecord });
			Object.defineProperty(exports, "createLeaderInstanceRecord", { enumerable: true, get: () => __re9.createLeaderInstanceRecord });
			Object.defineProperty(exports, "memberIdentityOf", { enumerable: true, get: () => __re9.memberIdentityOf });
			Object.defineProperty(exports, "serializeMemberInstanceRecord", { enumerable: true, get: () => __re9.serializeMemberInstanceRecord });
			Object.defineProperty(exports, "deserializeMemberInstanceRecord", { enumerable: true, get: () => __re9.deserializeMemberInstanceRecord });
			const __re9 = __req("../../contracts/src/dto/member-instance-record.js");
			Object.defineProperty(exports, "SESSION_BINDING_KINDS", { enumerable: true, get: () => __re10.SESSION_BINDING_KINDS });
			Object.defineProperty(exports, "parseSessionBinding", { enumerable: true, get: () => __re10.parseSessionBinding });
			Object.defineProperty(exports, "serializeSessionBinding", { enumerable: true, get: () => __re10.serializeSessionBinding });
			Object.defineProperty(exports, "deserializeSessionBinding", { enumerable: true, get: () => __re10.deserializeSessionBinding });
			const __re10 = __req("../../contracts/src/dto/session-binding.js");
			Object.defineProperty(exports, "BLUEPRINT_SNAPSHOT_FIELDS", { enumerable: true, get: () => __re11.BLUEPRINT_SNAPSHOT_FIELDS });
			Object.defineProperty(exports, "parseBlueprintSnapshotRef", { enumerable: true, get: () => __re11.parseBlueprintSnapshotRef });
			Object.defineProperty(exports, "createBlueprintSnapshotRef", { enumerable: true, get: () => __re11.createBlueprintSnapshotRef });
			Object.defineProperty(exports, "blueprintSnapshotKey", { enumerable: true, get: () => __re11.blueprintSnapshotKey });
			Object.defineProperty(exports, "parseBlueprintSnapshotKey", { enumerable: true, get: () => __re11.parseBlueprintSnapshotKey });
			const __re11 = __req("../../contracts/src/dto/blueprint-snapshot.js");
			// --- legacy vocabulary quarantine ---------------------------------------------
			Object.defineProperty(exports, "LEGACY_FORBIDDEN_FIELDS", { enumerable: true, get: () => __re12.LEGACY_FORBIDDEN_FIELDS });
			Object.defineProperty(exports, "LEGACY_TEAM_SESSION_EVENT_NAMES", { enumerable: true, get: () => __re12.LEGACY_TEAM_SESSION_EVENT_NAMES });
			Object.defineProperty(exports, "isLegacyTeamSessionEventName", { enumerable: true, get: () => __re12.isLegacyTeamSessionEventName });
			Object.defineProperty(exports, "assertNotLegacyTeamSessionEvent", { enumerable: true, get: () => __re12.assertNotLegacyTeamSessionEvent });
			Object.defineProperty(exports, "assertNoLegacyFields", { enumerable: true, get: () => __re12.assertNoLegacyFields });
			const __re12 = __req("../../contracts/src/legacy-vocabulary.js");
			// --- uniqueness / scoping assertions -------------------------------------------
			Object.defineProperty(exports, "assertTeamSessionUnique", { enumerable: true, get: () => __re13.assertTeamSessionUnique });
			Object.defineProperty(exports, "assertInstanceIdUniqueWithinTeam", { enumerable: true, get: () => __re13.assertInstanceIdUniqueWithinTeam });
			Object.defineProperty(exports, "assertChildSessionBindingUnique", { enumerable: true, get: () => __re13.assertChildSessionBindingUnique });
			const __re13 = __req("../../contracts/src/uniqueness.js");
			// --- projection contract (P8-T1 v1 + S7-R2 additive v2; own schema-version track) ------
			Object.defineProperty(exports, "PROJECTION_SCHEMA_VERSION", { enumerable: true, get: () => __re14.PROJECTION_SCHEMA_VERSION });
			Object.defineProperty(exports, "PROJECTION_SCHEMA_VERSION_V2", { enumerable: true, get: () => __re14.PROJECTION_SCHEMA_VERSION_V2 });
			Object.defineProperty(exports, "SUPPORTED_PROJECTION_SCHEMA_VERSIONS", { enumerable: true, get: () => __re14.SUPPORTED_PROJECTION_SCHEMA_VERSIONS });
			Object.defineProperty(exports, "isSupportedProjectionSchemaVersion", { enumerable: true, get: () => __re14.isSupportedProjectionSchemaVersion });
			Object.defineProperty(exports, "assertProjectionSchemaVersion", { enumerable: true, get: () => __re14.assertProjectionSchemaVersion });
			const __re14 = __req("../../contracts/src/projection/schema.js");
			Object.defineProperty(exports, "ADMISSION_STATES", { enumerable: true, get: () => __re15.ADMISSION_STATES });
			Object.defineProperty(exports, "ADMISSION_STATE_VALUES", { enumerable: true, get: () => __re15.ADMISSION_STATE_VALUES });
			Object.defineProperty(exports, "isAdmissionState", { enumerable: true, get: () => __re15.isAdmissionState });
			Object.defineProperty(exports, "RESIDENCY_STATES", { enumerable: true, get: () => __re15.RESIDENCY_STATES });
			Object.defineProperty(exports, "RESIDENCY_STATE_VALUES", { enumerable: true, get: () => __re15.RESIDENCY_STATE_VALUES });
			Object.defineProperty(exports, "isResidencyState", { enumerable: true, get: () => __re15.isResidencyState });
			Object.defineProperty(exports, "TEMPLATE_KINDS", { enumerable: true, get: () => __re15.TEMPLATE_KINDS });
			Object.defineProperty(exports, "TEMPLATE_KIND_VALUES", { enumerable: true, get: () => __re15.TEMPLATE_KIND_VALUES });
			Object.defineProperty(exports, "isTemplateKind", { enumerable: true, get: () => __re15.isTemplateKind });
			Object.defineProperty(exports, "CONTEXT_POLICIES", { enumerable: true, get: () => __re15.CONTEXT_POLICIES });
			Object.defineProperty(exports, "CONTEXT_POLICY_VALUES", { enumerable: true, get: () => __re15.CONTEXT_POLICY_VALUES });
			Object.defineProperty(exports, "isContextPolicy", { enumerable: true, get: () => __re15.isContextPolicy });
			Object.defineProperty(exports, "PROGRESS_VALUES", { enumerable: true, get: () => __re15.PROGRESS_VALUES });
			Object.defineProperty(exports, "isProgressValue", { enumerable: true, get: () => __re15.isProgressValue });
			Object.defineProperty(exports, "LEDGER_CATEGORIES", { enumerable: true, get: () => __re15.LEDGER_CATEGORIES });
			Object.defineProperty(exports, "LEDGER_CATEGORY_VALUES", { enumerable: true, get: () => __re15.LEDGER_CATEGORY_VALUES });
			Object.defineProperty(exports, "isLedgerCategory", { enumerable: true, get: () => __re15.isLedgerCategory });
			const __re15 = __req("../../contracts/src/projection/states.js");
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_VALUE_MAX_LENGTH", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_VALUE_MAX_LENGTH });
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_SOURCES", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_SOURCES });
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_SOURCE_VALUES", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_SOURCE_VALUES });
			Object.defineProperty(exports, "isEffectiveConfigSource", { enumerable: true, get: () => __re16.isEffectiveConfigSource });
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_STATES", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_STATES });
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_STATE_VALUES", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_STATE_VALUES });
			Object.defineProperty(exports, "isEffectiveConfigState", { enumerable: true, get: () => __re16.isEffectiveConfigState });
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_ENTRY_FIELDS", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_ENTRY_FIELDS });
			Object.defineProperty(exports, "parseEffectiveConfigEntry", { enumerable: true, get: () => __re16.parseEffectiveConfigEntry });
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_FIELDS", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_FIELDS });
			Object.defineProperty(exports, "parseEffectiveConfigDto", { enumerable: true, get: () => __re16.parseEffectiveConfigDto });
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_ENTRY_FIELDS_V2", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_ENTRY_FIELDS_V2 });
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH", { enumerable: true, get: () => __re16.EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH });
			const __re16 = __req("../../contracts/src/projection/effective-config.js");
			Object.defineProperty(exports, "COMPATIBILITY_FINGERPRINT_MAX_LENGTH", { enumerable: true, get: () => __re17.COMPATIBILITY_FINGERPRINT_MAX_LENGTH });
			Object.defineProperty(exports, "COMPATIBILITY_SUMMARY_FIELDS", { enumerable: true, get: () => __re17.COMPATIBILITY_SUMMARY_FIELDS });
			Object.defineProperty(exports, "parseCompatibilitySummary", { enumerable: true, get: () => __re17.parseCompatibilitySummary });
			const __re17 = __req("../../contracts/src/projection/compatibility.js");
			Object.defineProperty(exports, "ACTIVITY_CORRELATION_MAX_LENGTH", { enumerable: true, get: () => __re18.ACTIVITY_CORRELATION_MAX_LENGTH });
			Object.defineProperty(exports, "ACTIVITY_TEXT_MAX_LENGTH", { enumerable: true, get: () => __re18.ACTIVITY_TEXT_MAX_LENGTH });
			Object.defineProperty(exports, "ACTIVITY_SUMMARY_MAX_LENGTH", { enumerable: true, get: () => __re18.ACTIVITY_SUMMARY_MAX_LENGTH });
			Object.defineProperty(exports, "ACTIVITY_INTERVAL_FIELDS", { enumerable: true, get: () => __re18.ACTIVITY_INTERVAL_FIELDS });
			Object.defineProperty(exports, "parseActivityInterval", { enumerable: true, get: () => __re18.parseActivityInterval });
			Object.defineProperty(exports, "MEMBER_ACTIVITY_SUMMARY_FIELDS", { enumerable: true, get: () => __re18.MEMBER_ACTIVITY_SUMMARY_FIELDS });
			Object.defineProperty(exports, "parseMemberActivitySummary", { enumerable: true, get: () => __re18.parseMemberActivitySummary });
			Object.defineProperty(exports, "MEMBER_LIVE_ACTIVITY_FIELDS", { enumerable: true, get: () => __re18.MEMBER_LIVE_ACTIVITY_FIELDS });
			Object.defineProperty(exports, "parseMemberLiveActivity", { enumerable: true, get: () => __re18.parseMemberLiveActivity });
			const __re18 = __req("../../contracts/src/projection/activity.js");
			Object.defineProperty(exports, "TEMPLATE_DESCRIPTION_MAX_LENGTH", { enumerable: true, get: () => __re19.TEMPLATE_DESCRIPTION_MAX_LENGTH });
			Object.defineProperty(exports, "TEMPLATE_PROJECTION_FIELDS", { enumerable: true, get: () => __re19.TEMPLATE_PROJECTION_FIELDS });
			Object.defineProperty(exports, "parseTemplateProjection", { enumerable: true, get: () => __re19.parseTemplateProjection });
			Object.defineProperty(exports, "createTemplateProjection", { enumerable: true, get: () => __re19.createTemplateProjection });
			const __re19 = __req("../../contracts/src/projection/template.js");
			Object.defineProperty(exports, "TEAM_ROOT_PROJECTION_FIELDS", { enumerable: true, get: () => __re20.TEAM_ROOT_PROJECTION_FIELDS });
			Object.defineProperty(exports, "parseTeamRootProjection", { enumerable: true, get: () => __re20.parseTeamRootProjection });
			Object.defineProperty(exports, "createTeamRootProjection", { enumerable: true, get: () => __re20.createTeamRootProjection });
			const __re20 = __req("../../contracts/src/projection/root.js");
			Object.defineProperty(exports, "MEMBER_PROJECTION_FIELDS", { enumerable: true, get: () => __re21.MEMBER_PROJECTION_FIELDS });
			Object.defineProperty(exports, "MEMBER_PROJECTION_FIELDS_V2", { enumerable: true, get: () => __re21.MEMBER_PROJECTION_FIELDS_V2 });
			Object.defineProperty(exports, "parseMemberProjection", { enumerable: true, get: () => __re21.parseMemberProjection });
			Object.defineProperty(exports, "createMemberProjection", { enumerable: true, get: () => __re21.createMemberProjection });
			const __re21 = __req("../../contracts/src/projection/member.js");
			Object.defineProperty(exports, "MODEL_STATE_FIELDS", { enumerable: true, get: () => __re22.MODEL_STATE_FIELDS });
			Object.defineProperty(exports, "MODEL_STATE_OPTIONAL_FIELDS", { enumerable: true, get: () => __re22.MODEL_STATE_OPTIONAL_FIELDS });
			Object.defineProperty(exports, "MODEL_STATE_ENTRY_FIELDS", { enumerable: true, get: () => __re22.MODEL_STATE_ENTRY_FIELDS });
			Object.defineProperty(exports, "MODEL_STATE_ENTRY_OPTIONAL_FIELDS", { enumerable: true, get: () => __re22.MODEL_STATE_ENTRY_OPTIONAL_FIELDS });
			Object.defineProperty(exports, "MODEL_STATE_PROVENANCE_FIELDS", { enumerable: true, get: () => __re22.MODEL_STATE_PROVENANCE_FIELDS });
			Object.defineProperty(exports, "MODEL_STATE_VALUE_MAX_LENGTH", { enumerable: true, get: () => __re22.MODEL_STATE_VALUE_MAX_LENGTH });
			Object.defineProperty(exports, "MODEL_STATE_DENIED_BY_MAX_LENGTH", { enumerable: true, get: () => __re22.MODEL_STATE_DENIED_BY_MAX_LENGTH });
			Object.defineProperty(exports, "MODEL_STATE_EXPLANATION_MAX_LENGTH", { enumerable: true, get: () => __re22.MODEL_STATE_EXPLANATION_MAX_LENGTH });
			Object.defineProperty(exports, "MODEL_STATE_LAYER_VALUES", { enumerable: true, get: () => __re22.MODEL_STATE_LAYER_VALUES });
			Object.defineProperty(exports, "MODEL_STATE_ORIGIN_VALUES", { enumerable: true, get: () => __re22.MODEL_STATE_ORIGIN_VALUES });
			Object.defineProperty(exports, "MODEL_STATE_AVAILABILITY_VALUES", { enumerable: true, get: () => __re22.MODEL_STATE_AVAILABILITY_VALUES });
			Object.defineProperty(exports, "parseModelStateEntry", { enumerable: true, get: () => __re22.parseModelStateEntry });
			Object.defineProperty(exports, "parseModelStateProvenance", { enumerable: true, get: () => __re22.parseModelStateProvenance });
			Object.defineProperty(exports, "parseMemberModelState", { enumerable: true, get: () => __re22.parseMemberModelState });
			const __re22 = __req("../../contracts/src/projection/model-state.js");
			Object.defineProperty(exports, "DISPOSED_MEMBER_HISTORY_FIELDS", { enumerable: true, get: () => __re23.DISPOSED_MEMBER_HISTORY_FIELDS });
			Object.defineProperty(exports, "DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS", { enumerable: true, get: () => __re23.DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS });
			Object.defineProperty(exports, "parseDisposedMemberHistory", { enumerable: true, get: () => __re23.parseDisposedMemberHistory });
			Object.defineProperty(exports, "createDisposedMemberHistory", { enumerable: true, get: () => __re23.createDisposedMemberHistory });
			const __re23 = __req("../../contracts/src/projection/disposed-history.js");
			Object.defineProperty(exports, "LEDGER_SUMMARY_FIELDS", { enumerable: true, get: () => __re24.LEDGER_SUMMARY_FIELDS });
			Object.defineProperty(exports, "parseLedgerSummary", { enumerable: true, get: () => __re24.parseLedgerSummary });
			Object.defineProperty(exports, "createLedgerSummary", { enumerable: true, get: () => __re24.createLedgerSummary });
			const __re24 = __req("../../contracts/src/projection/ledger.js");
			Object.defineProperty(exports, "TEAM_PROJECTION_FIELDS", { enumerable: true, get: () => __re25.TEAM_PROJECTION_FIELDS });
			Object.defineProperty(exports, "TEAM_PROJECTION_FIELDS_V2", { enumerable: true, get: () => __re25.TEAM_PROJECTION_FIELDS_V2 });
			Object.defineProperty(exports, "parseTeamProjection", { enumerable: true, get: () => __re25.parseTeamProjection });
			Object.defineProperty(exports, "createTeamProjection", { enumerable: true, get: () => __re25.createTeamProjection });
			Object.defineProperty(exports, "serializeTeamProjection", { enumerable: true, get: () => __re25.serializeTeamProjection });
			Object.defineProperty(exports, "deserializeTeamProjection", { enumerable: true, get: () => __re25.deserializeTeamProjection });
			Object.defineProperty(exports, "isStaleTeamProjection", { enumerable: true, get: () => __re25.isStaleTeamProjection });
			const __re25 = __req("../../contracts/src/projection/projection.js");
			//# sourceMappingURL=index.js.map
			}, exports: {} };
		__mods["../../contracts/src/schema-version.js"] = { done: false, fn: function (exports) {
			const __imp18 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp18.teamContractError;
			const __imp19 = __req("../../contracts/src/remote-safe.js");
			const toRemoteSafeDetail = __imp19.toRemoteSafeDetail;
			/**
			 * Schema version discipline for contract values.
			 *
			 * Every versioned DTO record carries a top-level `schemaVersion` stamped at
			 * creation. Version 1 is the v1 freeze of P3-T1 (see CHANGELOG.md).
			 *
			 * Rules:
			 * - a record whose version differs from the consumer's expected version is a
			 *   `SCHEMA_VERSION_MISMATCH` error;
			 * - a record whose version is not in the supported set (older than the oldest
			 *   supported or from the future) is a `SCHEMA_VERSION_UNSUPPORTED` error;
			 * - version bumps are contract changes: a new version is introduced by a new
			 *   contracts version that adds (never edits) the supported set semantics,
			 *   and old records remain readable per the freeze rule in CHANGELOG.md.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/schema-version
			 */
			/**
			 * The schema version stamped by contract v1 records.
			 * Frozen by P3-T1; changing or replacing it is a contract change.
			 */
			const TEAM_CONTRACT_SCHEMA_VERSION = 1;
			Object.defineProperty(exports, "TEAM_CONTRACT_SCHEMA_VERSION", { enumerable: true, get: () => TEAM_CONTRACT_SCHEMA_VERSION });
			/**
			 * The schema version stamp of the LeaderInstance record (v2, P8-S2;
			 * Architecture §9.2). The v2 row is the same identity core with
			 * `childSessionId` and `lifecycle` ABSENT (the LeaderInstance is the
			 * Root Agent + Root Session: no child Session, no ordinary member
			 * lifecycle — invariants 14/15). Added by an explicit contract change
			 * (see CHANGELOG.md); v1 records are untouched and stay readable.
			 */
			const LEADER_INSTANCE_RECORD_SCHEMA_VERSION = 2;
			Object.defineProperty(exports, "LEADER_INSTANCE_RECORD_SCHEMA_VERSION", { enumerable: true, get: () => LEADER_INSTANCE_RECORD_SCHEMA_VERSION });
			/**
			 * All schema versions this build reads and writes: `[1]` (every v1
			 * record) + `[2]` (the LeaderInstance record added by P8-S2). The v1 set
			 * itself is frozen: this constant only ever GROWS through an explicit
			 * contract change, it never rewrites v1 semantics.
			 */
			const SUPPORTED_SCHEMA_VERSIONS = [1, 2];
			Object.defineProperty(exports, "SUPPORTED_SCHEMA_VERSIONS", { enumerable: true, get: () => SUPPORTED_SCHEMA_VERSIONS });
			/**
			 * Is `value` a supported schema version (a positive integer in the supported set)?
			 * @param value - the raw value found in a `schemaVersion` field.
			 * @returns `true` iff `value` is one of `SUPPORTED_SCHEMA_VERSIONS`.
			 */
			function isSupportedSchemaVersion(value) {
			    return (typeof value === 'number' &&
			        Number.isInteger(value) &&
			        value >= 1 &&
			        SUPPORTED_SCHEMA_VERSIONS.includes(value));
			}
			Object.defineProperty(exports, "isSupportedSchemaVersion", { enumerable: true, get: () => isSupportedSchemaVersion });
			/**
			 * Assert that `value` is a supported schema version.
			 * @param value - the raw value found in a `schemaVersion` field.
			 * @throws `SCHEMA_VERSION_MISMATCH` for a well-formed version that is not
			 *   supported by this build, or `SCHEMA_VERSION_UNSUPPORTED` when the value
			 *   is not even a positive integer (structurally corrupt version field).
			 */
			function assertSupportedSchemaVersion(value) {
			    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
			        throw teamContractError('SCHEMA_VERSION_UNSUPPORTED', `schema version must be a positive integer, got ${JSON.stringify(value)}`, { schemaVersion: toRemoteSafeDetail(value) });
			    }
			    if (!SUPPORTED_SCHEMA_VERSIONS.includes(value)) {
			        throw teamContractError('SCHEMA_VERSION_MISMATCH', `unsupported schema version ${value}; this build supports [${SUPPORTED_SCHEMA_VERSIONS.join(', ')}]`, { schemaVersion: toRemoteSafeDetail(value), supported: [...SUPPORTED_SCHEMA_VERSIONS] });
			    }
			}
			Object.defineProperty(exports, "assertSupportedSchemaVersion", { enumerable: true, get: () => assertSupportedSchemaVersion });
			/**
			 * Assert that `value` equals the exact version `expected` (the default is the
			 * current v1 version). Used by DTO parsers, which must reject a record from
			 * a different schema generation even when both versions are individually
			 * "well-formed".
			 * @param value - the raw value found in a `schemaVersion` field.
			 * @param expected - the version the parsing consumer requires.
			 * @throws `SCHEMA_VERSION_MISMATCH` when `value !== expected`,
			 *   `SCHEMA_VERSION_UNSUPPORTED` when `value` is not a positive integer.
			 */
			function assertSchemaVersion(value, expected = TEAM_CONTRACT_SCHEMA_VERSION) {
			    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
			        throw teamContractError('SCHEMA_VERSION_UNSUPPORTED', `schema version must be a positive integer, got ${JSON.stringify(value)}`, { schemaVersion: toRemoteSafeDetail(value), expected });
			    }
			    if (value !== expected) {
			        throw teamContractError('SCHEMA_VERSION_MISMATCH', `schema version ${value} does not match expected version ${expected}`, { schemaVersion: toRemoteSafeDetail(value), expected });
			    }
			}
			Object.defineProperty(exports, "assertSchemaVersion", { enumerable: true, get: () => assertSchemaVersion });
			//# sourceMappingURL=schema-version.js.map
			}, exports: {} };
		__mods["../../contracts/src/errors.js"] = { done: false, fn: function (exports) {
			/**
			 * Contract error codes and the shared error object for @dsh-agent-team/contracts.
			 *
			 * `TeamContractErrorCode` is a CLOSED vocabulary as of contract v1. Adding or
			 * renaming a code is a contract change: it requires a new version (see
			 * CHANGELOG.md freeze rule), never a silent v1 edit.
			 *
			 * Producers outside this package (domain / runtime / remote tasks) MUST throw
			 * `TeamContractError` with one of these codes when a contract rule is
			 * violated; consumers MUST branch on `code`, never on message text.
			 *
			 * Authority: Architecture §42 invariants (identity, binding, legacy
			 * vocabulary, schema), Development Plan §9.1 (error codes live in contracts).
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/errors
			 */
			/** Closed set of v1 contract error codes. */
			const TeamContractErrorCode = {
			    /** A DSH session id (generic context, e.g. an `ordinary` session binding) violates the session id rule. */
			    INVALID_SESSION_ID: 'INVALID_SESSION_ID',
			    /** A root session id — which is the TeamSessionId, Architecture invariant 9 — violates the session id rule. */
			    INVALID_ROOT_SESSION_ID: 'INVALID_ROOT_SESSION_ID',
			    /** A member child session id (a durable DSH Session bound to a MemberInstance) violates the session id rule. */
			    INVALID_CHILD_SESSION_ID: 'INVALID_CHILD_SESSION_ID',
			    /** An instance id violates the `inst-<1..32 lowercase alphanumerics>` rule. */
			    INVALID_INSTANCE_ID: 'INVALID_INSTANCE_ID',
			    /** A template id (static identity of a Leader/MemberTemplate) violates the slug rule. */
			    INVALID_TEMPLATE_ID: 'INVALID_TEMPLATE_ID',
			    /** A blueprint id (stable logical identity) violates the blueprint id rule. */
			    INVALID_BLUEPRINT_ID: 'INVALID_BLUEPRINT_ID',
			    /** A blueprint revision (human-readable) violates the revision rule. */
			    INVALID_BLUEPRINT_REVISION: 'INVALID_BLUEPRINT_REVISION',
			    /** A blueprint content hash (machine content identity) violates the content hash rule. */
			    INVALID_BLUEPRINT_CONTENT_HASH: 'INVALID_BLUEPRINT_CONTENT_HASH',
			    /** A member identity is used outside the TeamSession it belongs to (cross-scope confusion). */
			    IDENTITY_SCOPE_MISMATCH: 'IDENTITY_SCOPE_MISMATCH',
			    /** The same instance id is used twice inside one TeamSession (violates §10.2 uniqueness). */
			    DUPLICATE_INSTANCE_ID: 'DUPLICATE_INSTANCE_ID',
			    /** A second TeamSession would be bound to a root session that already has one (invariant 8). */
			    DUPLICATE_TEAM_SESSION: 'DUPLICATE_TEAM_SESSION',
			    /** A child session that is already bound to a member would be bound again (invariant 23). */
			    SESSION_ALREADY_BOUND: 'SESSION_ALREADY_BOUND',
			    /** A roster lookup found no member with the given (rootSessionId, instanceId) identity. */
			    MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
			    /** A value carries the legacy `memberId` field, the forbidden legacy identity authority. */
			    LEGACY_MEMBER_ID_REJECTED: 'LEGACY_MEMBER_ID_REJECTED',
			    /** A value uses a legacy Team SessionEvent name (vNext has no Team SessionEvents, invariant 42). */
			    LEGACY_TEAM_SESSION_EVENT_REJECTED: 'LEGACY_TEAM_SESSION_EVENT_REJECTED',
			    /** A record carries a schema version different from the version the consumer expects. */
			    SCHEMA_VERSION_MISMATCH: 'SCHEMA_VERSION_MISMATCH',
			    /** A record carries a schema version outside the supported range (older or from the future). */
			    SCHEMA_VERSION_UNSUPPORTED: 'SCHEMA_VERSION_UNSUPPORTED',
			    /** A DTO value failed structural validation (wrong type, missing/unknown field, bad lifecycle state, ...). */
			    MALFORMED_DTO: 'MALFORMED_DTO',
			    /** A value crossing a boundary is not a lossless-JSON (remote-safe) value. */
			    REMOTE_VALUE_NOT_JSON: 'REMOTE_VALUE_NOT_JSON',
			    /**
			     * Architecture §13.5: the root AgentPreset's effective persona is
			     * `complete:true`, so the Blueprint persona cannot be composed without a
			     * core seam. Structural FATAL compatibility outcome; frozen here so the
			     * P3-T5 compatibility engine reports the exact architecture-named code.
			     */
			    TEAM_PERSONA_COMPLETE_PRESET_CONFLICT: 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT',
			};
			Object.defineProperty(exports, "TeamContractErrorCode", { enumerable: true, get: () => TeamContractErrorCode });
			/** Every v1 code value, for membership checks and closed-set tests. */
			const TEAM_CONTRACT_ERROR_CODE_VALUES = Object.values(TeamContractErrorCode);
			Object.defineProperty(exports, "TEAM_CONTRACT_ERROR_CODE_VALUES", { enumerable: true, get: () => TEAM_CONTRACT_ERROR_CODE_VALUES });
			/**
			 * The single error object thrown by contract violations.
			 *
			 * `code` is the stable machine contract; `message` is a human-readable
			 * summary (never branch on it); `details` is an optional lossless-JSON
			 * record with structured context (e.g. the offending field path or value).
			 */
			class TeamContractError extends Error {
			    /** Stable machine-readable contract error code. */
			    code;
			    /** Optional structured context; must be a lossless-JSON record. */
			    details;
			    constructor(code, message, details) {
			        super(message);
			        this.name = 'TeamContractError';
			        this.code = code;
			        if (details !== undefined)
			            this.details = details;
			    }
			}
			Object.defineProperty(exports, "TeamContractError", { enumerable: true, get: () => TeamContractError });
			/**
			 * Build a `TeamContractError`.
			 * @param code - the contract error code.
			 * @param message - human-readable summary.
			 * @param details - optional lossless-JSON structured context.
			 * @returns the error instance (callers throw it).
			 */
			function teamContractError(code, message, details) {
			    return new TeamContractError(code, message, details);
			}
			Object.defineProperty(exports, "teamContractError", { enumerable: true, get: () => teamContractError });
			/**
			 * Type guard: is `value` a `TeamContractError` carrying a known v1 code?
			 * @param value - the value to check.
			 * @returns `true` iff `value` is an `Error` whose `code` is a v1 contract code.
			 */
			function isTeamContractError(value) {
			    if (!(value instanceof Error))
			        return false;
			    const code = value.code;
			    return typeof code === 'string' && TEAM_CONTRACT_ERROR_CODE_VALUES.includes(code);
			}
			Object.defineProperty(exports, "isTeamContractError", { enumerable: true, get: () => isTeamContractError });
			//# sourceMappingURL=errors.js.map
			}, exports: {} };
		__mods["../../contracts/src/remote-safe.js"] = { done: false, fn: function (exports) {
			const __imp18 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp18.teamContractError;
			/**
			 * Remote-safe (lossless-JSON) value discipline for the contracts package.
			 *
			 * Everything this package exports across a package, wire, or storage
			 * boundary must be a lossless-JSON value: `null`, boolean, finite number,
			 * string, plain array, or plain object (prototype `Object.prototype` or
			 * `null`). Class instances, `Date`, `Map`/`Set`, `undefined`, `NaN`,
			 * `Infinity`, functions, and symbol-keyed properties are NOT lossless JSON
			 * and are rejected (error code `REMOTE_VALUE_NOT_JSON`).
			 *
			 * Authority: Development Plan §9.1 (contracts hold "stable serializable
			 * contracts" / "remote-safe values"); Architecture §14.2 (Team control-plane
			 * facts live in TeamDomain, never in session events, so cross-boundary
			 * values must be plain serializable records).
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/remote-safe
			 */
			function isPlainObject(value) {
			    const proto = Object.getPrototypeOf(value);
			    return proto === Object.prototype || proto === null;
			}
			/**
			 * Deep-check whether `value` is a lossless-JSON value.
			 * @param value - the value to check.
			 * @returns `true` iff `value` round-trips through `JSON.stringify`/`JSON.parse` unchanged.
			 */
			function isRemoteSafeJsonValue(value) {
			    if (value === null)
			        return true;
			    switch (typeof value) {
			        case 'boolean':
			        case 'string':
			            return true;
			        case 'number':
			            return Number.isFinite(value);
			        case 'object': {
			            if (Array.isArray(value))
			                return value.every((item) => isRemoteSafeJsonValue(item));
			            if (!isPlainObject(value))
			                return false;
			            return Object.entries(value).every(([key, item]) => key.length > 0 && isRemoteSafeJsonValue(item));
			        }
			        default:
			            return false;
			    }
			}
			Object.defineProperty(exports, "isRemoteSafeJsonValue", { enumerable: true, get: () => isRemoteSafeJsonValue });
			/**
			 * Assert that `value` is a lossless-JSON value.
			 * @param value - the value to check.
			 * @param path - optional pointer into the value, used in the error message.
			 * @throws `REMOTE_VALUE_NOT_JSON` when the value (or a nested member) is not lossless JSON.
			 */
			function assertRemoteSafeJsonValue(value, path = '$') {
			    if (value === null)
			        return;
			    switch (typeof value) {
			        case 'boolean':
			        case 'string':
			            return;
			        case 'number':
			            if (Number.isFinite(value))
			                return;
			            throw teamContractError('REMOTE_VALUE_NOT_JSON', `non-finite number at ${path}`, { path, problem: 'non-finite number' });
			        case 'object': {
			            if (Array.isArray(value)) {
			                value.forEach((item, index) => assertRemoteSafeJsonValue(item, `${path}[${index}]`));
			                return;
			            }
			            if (!isPlainObject(value)) {
			                throw teamContractError('REMOTE_VALUE_NOT_JSON', `non-plain object at ${path} (class instances, Date, Map/Set are not lossless JSON)`, { path, problem: 'non-plain object' });
			            }
			            for (const [key, item] of Object.entries(value)) {
			                assertRemoteSafeJsonValue(item, `${path}.${key}`);
			            }
			            return;
			        }
			        default:
			            throw teamContractError('REMOTE_VALUE_NOT_JSON', `value of type ${typeof value} at ${path} is not lossless JSON`, { path, problem: `type ${typeof value}` });
			    }
			}
			Object.defineProperty(exports, "assertRemoteSafeJsonValue", { enumerable: true, get: () => assertRemoteSafeJsonValue });
			/**
			 * Coerce an arbitrary unknown into a lossless-JSON value for error
			 * `details` records: primitives pass through (non-finite numbers become
			 * their string tag), arrays/records are deep-coerced, and anything else
			 * (functions, undefined, class instances) becomes a `<type>` tag string.
			 * Never throws.
			 * @param value - the unknown value to coerce.
			 * @returns a lossless-JSON representation of it.
			 */
			function toRemoteSafeDetail(value) {
			    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
			        return value;
			    }
			    if (typeof value === 'number')
			        return Number.isFinite(value) ? value : String(value);
			    if (typeof value === 'object') {
			        if (Array.isArray(value))
			            return value.map((item) => toRemoteSafeDetail(item));
			        if (isPlainObject(value)) {
			            const record = {};
			            for (const [key, item] of Object.entries(value)) {
			                record[key] = toRemoteSafeDetail(item);
			            }
			            return record;
			        }
			    }
			    return `<${typeof value}>`;
			}
			Object.defineProperty(exports, "toRemoteSafeDetail", { enumerable: true, get: () => toRemoteSafeDetail });
			/**
			 * Deterministic JSON encoding: objects are emitted with keys in ascending
			 * (code-unit) order, arrays keep their order. Two calls with deeply-equal
			 * lossless-JSON input always return the same string, independent of the
			 * property-insertion order in which the object was constructed.
			 * @param value - a lossless-JSON value (interfaces without an index
			 *   signature are accepted; the runtime check is authoritative).
			 * @returns the canonical JSON text.
			 * @throws `REMOTE_VALUE_NOT_JSON` when the value is not lossless JSON.
			 */
			function canonicalJsonStringify(value) {
			    assertRemoteSafeJsonValue(value);
			    return canonical(value);
			}
			Object.defineProperty(exports, "canonicalJsonStringify", { enumerable: true, get: () => canonicalJsonStringify });
			function canonical(value) {
			    if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
			        return JSON.stringify(value);
			    }
			    if (Array.isArray(value)) {
			        return `[${value.map((item) => canonical(item)).join(',')}]`;
			    }
			    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
			    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
			}
			/**
			 * Recursively freeze a lossless-JSON value and return it. Used to make
			 * parsed contract values immutable snapshots (Architecture §5.6/§8.4:
			 * blueprint snapshots and records are immutable).
			 * @param value - a lossless-JSON value (interfaces without an index
			 *   signature are accepted; the runtime check is authoritative).
			 * @returns the same value, deeply frozen.
			 * @throws `REMOTE_VALUE_NOT_JSON` when the value is not lossless JSON.
			 */
			function deepFreeze(value) {
			    assertRemoteSafeJsonValue(value);
			    freezeDeep(value);
			    return value;
			}
			Object.defineProperty(exports, "deepFreeze", { enumerable: true, get: () => deepFreeze });
			function freezeDeep(value) {
			    if (value === null || typeof value !== 'object')
			        return;
			    for (const item of Array.isArray(value) ? value : Object.values(value)) {
			        freezeDeep(item);
			    }
			    Object.freeze(value);
			}
			//# sourceMappingURL=remote-safe.js.map
			}, exports: {} };
		__mods["../../contracts/src/ids/session-id.js"] = { done: false, fn: function (exports) {
			const __imp22 = __req("../../contracts/src/ids/common.js");
			const assertIsString = __imp22.assertIsString;
			const assertStringRules = __imp22.assertStringRules;
			const __imp23 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp23.teamContractError;
			/**
			 * Session id contracts: the DSH session id as seen by the Team contract,
			 * plus the Team identity rules built on top of it.
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **TeamSessionId = RootSessionId** (invariant 9). A TeamSession is
			 *   identified by its root DSH session id; no separate TeamSession UUID
			 *   exists (Architecture §8.2). The type alias `TeamSessionId =
			 *   RootSessionId` encodes this at the type level.
			 * - **One Root Session -> 0 or 1 TeamSession** (invariant 8).
			 * - **Every MemberInstance binds exactly one durable child DSH Session**
			 *   (invariant 23); the child session id uses the same structural rules.
			 *
			 * The upstream DSH session id is an opaque branded string (upstream public
			 * contract; minted as `session-<n>` by the session store). The vNext
			 * boundary rules here only reject structurally unusable values:
			 * non-empty, <= 255 chars, no control characters, no whitespace.
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/ids/session-id
			 */
			/** Maximum structural length of any DSH session id in vNext contracts. */
			const SESSION_ID_MAX_LENGTH = 255;
			Object.defineProperty(exports, "SESSION_ID_MAX_LENGTH", { enumerable: true, get: () => SESSION_ID_MAX_LENGTH });
			function assertSessionIdValue(raw, field, code) {
			    const value = assertIsString(raw, field, code);
			    assertStringRules(value, { field, code, maxLength: SESSION_ID_MAX_LENGTH });
			    return value;
			}
			/**
			 * Parse and validate a generic DSH session id.
			 * @param raw - the unknown input.
			 * @returns the branded `SessionId`.
			 * @throws `INVALID_SESSION_ID` when the value violates the session id rule.
			 */
			function parseSessionId(raw) {
			    return assertSessionIdValue(raw, 'sessionId', 'INVALID_SESSION_ID');
			}
			Object.defineProperty(exports, "parseSessionId", { enumerable: true, get: () => parseSessionId });
			/**
			 * Parse and validate a root session id (i.e. the id of a TeamSession's root,
			 * which is its TeamSessionId per invariant 9).
			 * @param raw - the unknown input.
			 * @returns the branded `RootSessionId`.
			 * @throws `INVALID_ROOT_SESSION_ID` when the value violates the session id rule.
			 */
			function parseRootSessionId(raw) {
			    return assertSessionIdValue(raw, 'rootSessionId', 'INVALID_ROOT_SESSION_ID');
			}
			Object.defineProperty(exports, "parseRootSessionId", { enumerable: true, get: () => parseRootSessionId });
			/**
			 * Parse and validate a TeamSession id.
			 *
			 * Identity function of {@link parseRootSessionId} (invariant 9); kept as a
			 * separate entry point so call sites read the Team vocabulary.
			 * @param raw - the unknown input.
			 * @returns the branded `TeamSessionId` (identical to `RootSessionId`).
			 * @throws `INVALID_ROOT_SESSION_ID` when the value violates the session id rule.
			 */
			function parseTeamSessionId(raw) {
			    return parseRootSessionId(raw);
			}
			Object.defineProperty(exports, "parseTeamSessionId", { enumerable: true, get: () => parseTeamSessionId });
			/**
			 * Parse and validate a member child session id.
			 * @param raw - the unknown input.
			 * @returns the branded `ChildSessionId`.
			 * @throws `INVALID_CHILD_SESSION_ID` when the value violates the session id rule.
			 */
			function parseChildSessionId(raw) {
			    return assertSessionIdValue(raw, 'childSessionId', 'INVALID_CHILD_SESSION_ID');
			}
			Object.defineProperty(exports, "parseChildSessionId", { enumerable: true, get: () => parseChildSessionId });
			/** Type guard for the generic session id rule. */
			function isSessionId(raw) {
			    try {
			        parseSessionId(raw);
			        return true;
			    }
			    catch {
			        return false;
			    }
			}
			Object.defineProperty(exports, "isSessionId", { enumerable: true, get: () => isSessionId });
			/** Type guard for the root session / TeamSession id rule. */
			function isRootSessionId(raw) {
			    try {
			        parseRootSessionId(raw);
			        return true;
			    }
			    catch {
			        return false;
			    }
			}
			Object.defineProperty(exports, "isRootSessionId", { enumerable: true, get: () => isRootSessionId });
			/** Type guard for the member child session id rule. */
			function isChildSessionId(raw) {
			    try {
			        parseChildSessionId(raw);
			        return true;
			    }
			    catch {
			        return false;
			    }
			}
			Object.defineProperty(exports, "isChildSessionId", { enumerable: true, get: () => isChildSessionId });
			/**
			 * The TeamSession record id accessor: per invariant 9 the team session id is
			 * the root session id, so this returns the same branded value. Provided so
			 * producers read the Team vocabulary without re-deriving the invariant.
			 * @param rootSessionId - the root session id of a TeamSession.
			 * @returns the TeamSession id (identical value).
			 */
			function teamSessionIdOf(rootSessionId) {
			    return rootSessionId;
			}
			Object.defineProperty(exports, "teamSessionIdOf", { enumerable: true, get: () => teamSessionIdOf });
			//# sourceMappingURL=session-id.js.map
			}, exports: {} };
		__mods["../../contracts/src/ids/instance-id.js"] = { done: false, fn: function (exports) {
			const __imp25 = __req("../../contracts/src/ids/common.js");
			const assertIsString = __imp25.assertIsString;
			const assertStringRules = __imp25.assertStringRules;
			const __imp26 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp26.teamContractError;
			/**
			 * Instance id contract: the stable runtime identity of a MemberInstance.
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **Member runtime identity is the composite key `(rootSessionId, instanceId)`**
			 *   (invariant 18, Architecture §10.2). The composite key prevents
			 *   cross-TeamSession confusion: the same `instanceId` under two different
			 *   roots names two different members.
			 * - **`instanceId` is system-generated, stable, and unique within one
			 *   TeamSession** (Architecture §10.2). The generator lives in the runtime
			 *   (ActivationProvider, invariant 26); this module freezes only the
			 *   format, the validators, and the composite-key helpers.
			 * - **label / templateId / groupId are NOT runtime identities**
			 *   (invariant 19).
			 *
			 * Format: `inst-` followed by 1..32 lowercase alphanumerics
			 * (`inst-A`, `inst-a1b2c3`). The architecture's own examples use the
			 * `inst-` prefix (§10.2: `instanceId = inst-A`); the strict charset keeps
			 * ids safe in file names, log lines, and remote addressing (§24.1
			 * instance-first addressing).
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/ids/instance-id
			 */
			/** The single strict format of an instance id. */
			const INSTANCE_ID_PATTERN = /^inst-[a-z0-9]{1,32}$/;
			Object.defineProperty(exports, "INSTANCE_ID_PATTERN", { enumerable: true, get: () => INSTANCE_ID_PATTERN });
			/** Structural max length: `inst-` (5) + 32 alphanumerics. */
			const INSTANCE_ID_MAX_LENGTH = 37;
			Object.defineProperty(exports, "INSTANCE_ID_MAX_LENGTH", { enumerable: true, get: () => INSTANCE_ID_MAX_LENGTH });
			/**
			 * Parse and validate an instance id.
			 * @param raw - the unknown input.
			 * @returns the branded `InstanceId`.
			 * @throws `INVALID_INSTANCE_ID` when the value does not match `inst-<1..32 lowercase alphanumerics>`.
			 */
			function parseInstanceId(raw) {
			    const value = assertIsString(raw, 'instanceId', 'INVALID_INSTANCE_ID');
			    assertStringRules(value, {
			        field: 'instanceId',
			        code: 'INVALID_INSTANCE_ID',
			        maxLength: INSTANCE_ID_MAX_LENGTH,
			    });
			    if (!INSTANCE_ID_PATTERN.test(value)) {
			        throw teamContractError('INVALID_INSTANCE_ID', `instanceId must match inst-<1..32 lowercase alphanumerics>, got ${JSON.stringify(value)}`, { field: 'instanceId' });
			    }
			    return value;
			}
			Object.defineProperty(exports, "parseInstanceId", { enumerable: true, get: () => parseInstanceId });
			/** Type guard for the instance id rule. */
			function isInstanceId(raw) {
			    try {
			        parseInstanceId(raw);
			        return true;
			    }
			    catch {
			        return false;
			    }
			}
			Object.defineProperty(exports, "isInstanceId", { enumerable: true, get: () => isInstanceId });
			//# sourceMappingURL=instance-id.js.map
			}, exports: {} };
		__mods["../../contracts/src/ids/template-id.js"] = { done: false, fn: function (exports) {
			const __imp22 = __req("../../contracts/src/ids/common.js");
			const assertIsString = __imp22.assertIsString;
			const assertStringRules = __imp22.assertStringRules;
			const __imp23 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp23.teamContractError;
			/**
			 * Template id contract: the STATIC identity of a LeaderTemplate /
			 * MemberTemplate inside a TeamBlueprint.
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **`templateId` is the static identity of a MemberTemplate and is NOT a
			 *   runtime identity** (invariant 19, Architecture §10.2: "templateId,
			 *   label, groupId 均不是运行时 identity"). Two instances of the same
			 *   template are distinct members distinguished by `instanceId` (§10.2
			 *   example: same templateId `researcher`, same label `Fourier`, but
			 *   `inst-A` vs `inst-B` are two persistent MemberInstances).
			 * - **One MemberTemplate can produce 0..N MemberInstances** (invariant 17).
			 * - Templates are not runtime actors (invariant 16, §6.3).
			 *
			 * Format: a lowercase slug — first character a-z, then a-z / 0-9 / `-`,
			 * 1..64 characters total (`researcher`, `developer`, `reviewer`, matching
			 * the architecture's examples).
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/ids/template-id
			 */
			/** The single strict format of a template id (lowercase slug). */
			const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9-]{0,63}$/;
			Object.defineProperty(exports, "TEMPLATE_ID_PATTERN", { enumerable: true, get: () => TEMPLATE_ID_PATTERN });
			/** Structural max length of a template id. */
			const TEMPLATE_ID_MAX_LENGTH = 64;
			Object.defineProperty(exports, "TEMPLATE_ID_MAX_LENGTH", { enumerable: true, get: () => TEMPLATE_ID_MAX_LENGTH });
			/**
			 * Parse and validate a template id.
			 * @param raw - the unknown input.
			 * @returns the branded `TemplateId`.
			 * @throws `INVALID_TEMPLATE_ID` when the value is not a lowercase slug.
			 */
			function parseTemplateId(raw) {
			    const value = assertIsString(raw, 'templateId', 'INVALID_TEMPLATE_ID');
			    assertStringRules(value, {
			        field: 'templateId',
			        code: 'INVALID_TEMPLATE_ID',
			        maxLength: TEMPLATE_ID_MAX_LENGTH,
			    });
			    if (!TEMPLATE_ID_PATTERN.test(value)) {
			        throw teamContractError('INVALID_TEMPLATE_ID', `templateId must be a lowercase slug (a-z first, then a-z/0-9/-, 1..64 chars), got ${JSON.stringify(value)}`, { field: 'templateId' });
			    }
			    return value;
			}
			Object.defineProperty(exports, "parseTemplateId", { enumerable: true, get: () => parseTemplateId });
			/** Type guard for the template id rule. */
			function isTemplateId(raw) {
			    try {
			        parseTemplateId(raw);
			        return true;
			    }
			    catch {
			        return false;
			    }
			}
			Object.defineProperty(exports, "isTemplateId", { enumerable: true, get: () => isTemplateId });
			//# sourceMappingURL=template-id.js.map
			}, exports: {} };
		__mods["../../contracts/src/ids/blueprint-id.js"] = { done: false, fn: function (exports) {
			const __imp22 = __req("../../contracts/src/ids/common.js");
			const assertIsString = __imp22.assertIsString;
			const assertStringRules = __imp22.assertStringRules;
			const __imp23 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp23.teamContractError;
			/**
			 * Blueprint identity contract: the stable identity of a TeamBlueprint and
			 * of the immutable snapshot a TeamSession binds.
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **Blueprint identity** (§5.2): `blueprintId` (stable logical identity)
			 *   + `revision` (human-readable) + `contentHash` (machine content
			 *   identity). Filesystem path, workspace path, cwd, displayName, and
			 *   AgentPreset id must NOT define blueprint identity; moving a blueprint
			 *   file or renaming its display name must not change `blueprintId`.
			 * - **One TeamSession binds exactly one immutable Blueprint snapshot**
			 *   (invariant 10, §8.4): the binding cannot be replaced in place —
			 *   `AIUED-ALGO@17` cannot become `AIEO@4` (the `blueprintId@revision`
			 *   display form used in the architecture text).
			 * - **A valid blueprint contains exactly one complete LeaderTemplate**
			 *   (invariant 13) — that validation is the P3-T2 domain's job; this module
			 *   freezes only the identity fields.
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/ids/blueprint-id
			 */
			/** Structural max length of a blueprint id. */
			const BLUEPRINT_ID_MAX_LENGTH = 128;
			Object.defineProperty(exports, "BLUEPRINT_ID_MAX_LENGTH", { enumerable: true, get: () => BLUEPRINT_ID_MAX_LENGTH });
			/** Structural max length of a human-readable blueprint revision. */
			const BLUEPRINT_REVISION_MAX_LENGTH = 64;
			Object.defineProperty(exports, "BLUEPRINT_REVISION_MAX_LENGTH", { enumerable: true, get: () => BLUEPRINT_REVISION_MAX_LENGTH });
			/** Structural max length of a blueprint content hash. */
			const BLUEPRINT_CONTENT_HASH_MAX_LENGTH = 256;
			Object.defineProperty(exports, "BLUEPRINT_CONTENT_HASH_MAX_LENGTH", { enumerable: true, get: () => BLUEPRINT_CONTENT_HASH_MAX_LENGTH });
			/**
			 * Parse and validate a blueprint id.
			 * @param raw - the unknown input.
			 * @returns the branded `BlueprintId`.
			 * @throws `INVALID_BLUEPRINT_ID` when the value is empty, over 128 chars,
			 *   contains control characters or whitespace, or contains the reserved `@`.
			 */
			function parseBlueprintId(raw) {
			    const value = assertIsString(raw, 'blueprintId', 'INVALID_BLUEPRINT_ID');
			    assertStringRules(value, {
			        field: 'blueprintId',
			        code: 'INVALID_BLUEPRINT_ID',
			        maxLength: BLUEPRINT_ID_MAX_LENGTH,
			    });
			    if (value.includes('@')) {
			        throw teamContractError('INVALID_BLUEPRINT_ID', `blueprintId must not contain '@' (reserved for the blueprintId@revision form), got ${JSON.stringify(value)}`, { field: 'blueprintId' });
			    }
			    return value;
			}
			Object.defineProperty(exports, "parseBlueprintId", { enumerable: true, get: () => parseBlueprintId });
			/**
			 * Parse and validate a human-readable blueprint revision.
			 * @param raw - the unknown input.
			 * @returns the revision string.
			 * @throws `INVALID_BLUEPRINT_REVISION` when the value is empty, over 64
			 *   chars, contains control characters or whitespace, or contains `@`.
			 */
			function parseBlueprintRevision(raw) {
			    const value = assertIsString(raw, 'revision', 'INVALID_BLUEPRINT_REVISION');
			    assertStringRules(value, {
			        field: 'revision',
			        code: 'INVALID_BLUEPRINT_REVISION',
			        maxLength: BLUEPRINT_REVISION_MAX_LENGTH,
			    });
			    if (value.includes('@')) {
			        throw teamContractError('INVALID_BLUEPRINT_REVISION', `revision must not contain '@', got ${JSON.stringify(value)}`, { field: 'revision' });
			    }
			    return value;
			}
			Object.defineProperty(exports, "parseBlueprintRevision", { enumerable: true, get: () => parseBlueprintRevision });
			/**
			 * Parse and validate a blueprint content hash.
			 * @param raw - the unknown input.
			 * @returns the content hash string.
			 * @throws `INVALID_BLUEPRINT_CONTENT_HASH` when the value is empty, over
			 *   256 chars, or contains control characters or whitespace.
			 */
			function parseBlueprintContentHash(raw) {
			    const value = assertIsString(raw, 'contentHash', 'INVALID_BLUEPRINT_CONTENT_HASH');
			    assertStringRules(value, {
			        field: 'contentHash',
			        code: 'INVALID_BLUEPRINT_CONTENT_HASH',
			        maxLength: BLUEPRINT_CONTENT_HASH_MAX_LENGTH,
			    });
			    return value;
			}
			Object.defineProperty(exports, "parseBlueprintContentHash", { enumerable: true, get: () => parseBlueprintContentHash });
			/** Type guard for the blueprint id rule. */
			function isBlueprintId(raw) {
			    try {
			        parseBlueprintId(raw);
			        return true;
			    }
			    catch {
			        return false;
			    }
			}
			Object.defineProperty(exports, "isBlueprintId", { enumerable: true, get: () => isBlueprintId });
			//# sourceMappingURL=blueprint-id.js.map
			}, exports: {} };
		__mods["../../contracts/src/identity.js"] = { done: false, fn: function (exports) {
			const __imp24 = __req("../../contracts/src/ids/instance-id.js");
			const parseInstanceId = __imp24.parseInstanceId;
			const __imp25 = __req("../../contracts/src/ids/session-id.js");
			const parseRootSessionId = __imp25.parseRootSessionId;
			const __imp26 = __req("../../contracts/src/remote-safe.js");
			const canonicalJsonStringify = __imp26.canonicalJsonStringify;
			const deepFreeze = __imp26.deepFreeze;
			const __imp27 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp27.teamContractError;
			/**
			 * Member identity: the composite runtime identity of a MemberInstance.
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **Member runtime identity = `(rootSessionId, instanceId)`** (invariant
			 *   18, §10.2). `instanceId` is unique within one TeamSession; the
			 *   composite key prevents cross-TeamSession confusion.
			 * - **TeamSessionId = RootSessionId** (invariant 9), so the first component
			 *   of the key IS the TeamSession id: a member identity names its team
			 *   without a separate team id.
			 * - **label / templateId / groupId are NOT runtime identities**
			 *   (invariant 19): the same templateId + label under two instanceIds are
			 *   two different members (§10.2 example).
			 * - **LeaderInstance** is the only special member (invariant 14): the Root
			 *   Agent/Session of the TeamSession, with no childSessionId (§9.2). It
			 *   participates in the unified identity model with a RESERVED instance id
			 *   (`LEADER_INSTANCE_ID`) so instance-first message addressing (§24.1)
			 *   and ledger actor identity work for the leader without a second
			 *   vocabulary.
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/identity
			 */
			/** Reserved instance id of the LeaderInstance of a TeamSession (see module docs). */
			const LEADER_INSTANCE_ID = 'inst-leader';
			Object.defineProperty(exports, "LEADER_INSTANCE_ID", { enumerable: true, get: () => LEADER_INSTANCE_ID });
			/**
			 * The stable serialization key of a member identity: the canonical (sorted-
			 * key) JSON of the two components. Two identities produce the same key iff
			 * they are the same member; a different rootSessionId always changes the
			 * key, which is what makes cross-TeamSession confusion impossible at the
			 * string level.
			 * @param identity - the member identity.
			 * @returns the canonical JSON key, e.g. `{"instanceId":"inst-a","rootSessionId":"session-1"}`.
			 */
			function memberIdentityKey(identity) {
			    const record = {
			        instanceId: identity.instanceId,
			        rootSessionId: identity.rootSessionId,
			    };
			    return canonicalJsonStringify(record);
			}
			Object.defineProperty(exports, "memberIdentityKey", { enumerable: true, get: () => memberIdentityKey });
			/**
			 * Parse a member identity key produced by {@link memberIdentityKey}.
			 *
			 * Strict: the input must be exactly the canonical encoding of two valid
			 * components (extra or missing fields, malformed ids, or a different key
			 * order are all rejected).
			 * @param key - the identity key string.
			 * @returns the parsed member identity.
			 * @throws `MALFORMED_DTO` when the key is not canonical encoding of a
			 *   member identity, and the id-specific code when a component is malformed.
			 */
			function parseMemberIdentityKey(key) {
			    let parsed;
			    try {
			        parsed = JSON.parse(key);
			    }
			    catch {
			        throw teamContractError('MALFORMED_DTO', 'member identity key is not valid JSON', { key });
			    }
			    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
			        throw teamContractError('MALFORMED_DTO', 'member identity key must encode a plain object', { key });
			    }
			    const record = parsed;
			    const fields = Object.keys(record).sort();
			    if (fields.length !== 2 || fields[0] !== 'instanceId' || fields[1] !== 'rootSessionId') {
			        throw teamContractError('MALFORMED_DTO', 'member identity key must encode exactly the fields instanceId and rootSessionId', { key, fields });
			    }
			    const identity = createMemberIdentity(parseRootSessionId(record['rootSessionId']), parseInstanceId(record['instanceId']));
			    if (memberIdentityKey(identity) !== key) {
			        throw teamContractError('MALFORMED_DTO', 'member identity key is not in canonical encoding', { key });
			    }
			    return identity;
			}
			Object.defineProperty(exports, "parseMemberIdentityKey", { enumerable: true, get: () => parseMemberIdentityKey });
			/**
			 * Build a member identity from its two components.
			 *
			 * Both inputs must already be branded (use the `parse*` functions first).
			 * The result is deeply frozen: identities are immutable values.
			 * @param rootSessionId - the TeamSession (root session) the member belongs to.
			 * @param instanceId - the member's stable instance id.
			 * @returns the frozen composite identity.
			 */
			function createMemberIdentity(rootSessionId, instanceId) {
			    return deepFreeze({ rootSessionId, instanceId });
			}
			Object.defineProperty(exports, "createMemberIdentity", { enumerable: true, get: () => createMemberIdentity });
			/**
			 * Build the member identity of the (special) LeaderInstance of a TeamSession.
			 * @param teamSessionId - the TeamSession id (which is its root session id, invariant 9).
			 * @returns the leader's composite identity under the reserved `inst-leader` id.
			 */
			function leaderMemberIdentityOf(teamSessionId) {
			    return createMemberIdentity(teamSessionId, LEADER_INSTANCE_ID);
			}
			Object.defineProperty(exports, "leaderMemberIdentityOf", { enumerable: true, get: () => leaderMemberIdentityOf });
			/**
			 * Are two member identities the same member (same TeamSession, same instance)?
			 * @param a - first identity.
			 * @param b - second identity.
			 * @returns `true` iff both components are equal.
			 */
			function memberIdentitiesEqual(a, b) {
			    return (a.rootSessionId === b.rootSessionId && a.instanceId === b.instanceId);
			}
			Object.defineProperty(exports, "memberIdentitiesEqual", { enumerable: true, get: () => memberIdentitiesEqual });
			/**
			 * Assert that a member identity belongs to the given TeamSession.
			 *
			 * This is the guard against the cross-TeamSession confusion the composite
			 * key exists to prevent (invariant 18): an identity minted under root A
			 * must never be accepted in the context of root B, even when the
			 * `instanceId` values collide.
			 * @param identity - the member identity to check.
			 * @param teamSessionId - the TeamSession context (its root session id).
			 * @throws `IDENTITY_SCOPE_MISMATCH` when `identity.rootSessionId` differs from `teamSessionId`.
			 */
			function assertMemberIdentityInTeam(identity, teamSessionId) {
			    if (identity.rootSessionId !== teamSessionId) {
			        throw teamContractError('IDENTITY_SCOPE_MISMATCH', `member identity belongs to TeamSession '${identity.rootSessionId}' but was used in TeamSession '${teamSessionId}'; instanceId values are only unique within one TeamSession`, {
			            identityRootSessionId: identity.rootSessionId,
			            teamSessionId,
			            instanceId: identity.instanceId,
			        });
			    }
			}
			Object.defineProperty(exports, "assertMemberIdentityInTeam", { enumerable: true, get: () => assertMemberIdentityInTeam });
			//# sourceMappingURL=identity.js.map
			}, exports: {} };
		__mods["../../contracts/src/dto/team-session-record.js"] = { done: false, fn: function (exports) {
			const __imp30 = __req("../../contracts/src/schema-version.js");
			const TEAM_CONTRACT_SCHEMA_VERSION = __imp30.TEAM_CONTRACT_SCHEMA_VERSION;
			const assertSchemaVersion = __imp30.assertSchemaVersion;
			const __imp31 = __req("../../contracts/src/ids/session-id.js");
			const parseRootSessionId = __imp31.parseRootSessionId;
			const parseSessionId = __imp31.parseSessionId;
			const __imp32 = __req("../../contracts/src/dto/common.js");
			const assertFieldPresent = __imp32.assertFieldPresent;
			const assertNoUnknownFields = __imp32.assertNoUnknownFields;
			const assertPlainRecord = __imp32.assertPlainRecord;
			const parseIso8601TimestampField = __imp32.parseIso8601TimestampField;
			const parseWorkspaceField = __imp32.parseWorkspaceField;
			const __imp33 = __req("../../contracts/src/dto/blueprint-snapshot.js");
			const parseBlueprintSnapshotRef = __imp33.parseBlueprintSnapshotRef;
			const __imp34 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp34.assertNoLegacyFields;
			const __imp35 = __req("../../contracts/src/ids/common.js");
			const assertPositiveInteger = __imp35.assertPositiveInteger;
			const __imp36 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp36.teamContractError;
			const __imp37 = __req("../../contracts/src/remote-safe.js");
			const canonicalJsonStringify = __imp37.canonicalJsonStringify;
			const deepFreeze = __imp37.deepFreeze;
			/**
			 * TeamSessionRecordDto — the TeamDomain record of a TeamSession
			 * (Architecture §14.3 category A).
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **TeamSessionId = RootSessionId** (invariant 9): the record's
			 *   `rootSessionId` field IS the TeamSession id; no separate TeamSession
			 *   UUID is minted (§8.2).
			 * - **One Root Session -> 0 or 1 TeamSession** (invariant 8) — enforced by
			 *   {@link import('../uniqueness.js').assertTeamSessionUnique}.
			 * - **One TeamSession binds exactly one immutable Blueprint snapshot**
			 *   (invariant 10); the snapshot ref is embedded, not replaced in place.
			 * - The record is the durable sidecar authority's (TeamDomain's, invariant
			 *   41) row for the session; TeamSession has no Member-style lifecycle
			 *   (§8.6) — hence no lifecycle field here.
			 *
			 * The v1 record freezes the identity core of category A
			 * (rootSessionId, blueprint snapshot, default workspace, creation
			 * timestamp, version/generation). Category A's remaining fields
			 * (PolicyState, overrides, admission state, ledger refs, handoff provenance)
			 * are added by later versions with their owning tasks — the freeze rule in
			 * CHANGELOG.md governs how. P8-S7-R4 adds the first of them: the
			 * one-shot handoff provenance field `handoffSourceSessionId` (optional;
			 * present exactly for teams created through a Start-Team-from-Here
			 * handoff — Architecture §34, BQ-16).
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/dto/team-session-record
			 */
			/** The exact frozen fields of a TeamSessionRecordDto (v1). */
			const TEAM_SESSION_RECORD_FIELDS = [
			    'schemaVersion',
			    'rootSessionId',
			    'blueprint',
			    'defaultWorkspace',
			    'createdAt',
			    'generation',
			    'handoffSourceSessionId',
			];
			Object.defineProperty(exports, "TEAM_SESSION_RECORD_FIELDS", { enumerable: true, get: () => TEAM_SESSION_RECORD_FIELDS });
			function validateTeamSessionRecord(record) {
			    assertNoLegacyFields(record, 'TeamSessionRecord');
			    assertNoUnknownFields(record, TEAM_SESSION_RECORD_FIELDS, 'TeamSessionRecord');
			    for (const field of TEAM_SESSION_RECORD_FIELDS) {
			        if (field !== 'defaultWorkspace' && field !== 'handoffSourceSessionId') {
			            assertFieldPresent(record, field, 'TeamSessionRecord');
			        }
			    }
			    assertSchemaVersion(record['schemaVersion']);
			    const base = {
			        schemaVersion: record['schemaVersion'],
			        rootSessionId: parseRootSessionId(record['rootSessionId']),
			        blueprint: parseBlueprintSnapshotRef(record['blueprint']),
			        createdAt: parseIso8601TimestampField(record['createdAt']),
			        generation: assertPositiveInteger(record['generation'], 'generation'),
			    };
			    // An absent optional field must not become an own `undefined` key: the
			    // frozen DTO is a lossless-JSON value (remote-safe.ts rejects undefined).
			    const withWorkspace = record['defaultWorkspace'] === undefined
			        ? base
			        : {
			            ...base,
			            defaultWorkspace: parseWorkspaceField(record['defaultWorkspace'], 'defaultWorkspace'),
			        };
			    return deepFreeze(record['handoffSourceSessionId'] === undefined
			        ? withWorkspace
			        : {
			            ...withWorkspace,
			            handoffSourceSessionId: parseSessionId(record['handoffSourceSessionId']),
			        });
			}
			/**
			 * Parse and validate a TeamSessionRecordDto from an untrusted value.
			 * @param value - the unknown input (e.g. a decoded TeamDomain row).
			 * @returns the frozen record.
			 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
			 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
			 *   `INVALID_ROOT_SESSION_ID`, or the blueprint id-specific codes.
			 */
			function parseTeamSessionRecord(value) {
			    return validateTeamSessionRecord(assertPlainRecord(value, 'TeamSessionRecord'));
			}
			Object.defineProperty(exports, "parseTeamSessionRecord", { enumerable: true, get: () => parseTeamSessionRecord });
			/**
			 * Build a fresh TeamSessionRecordDto (generation 1 creation path).
			 * @param input - the identity fields; ids must already be branded.
			 * @returns the frozen record with `schemaVersion` stamped to the v1 version.
			 */
			function createTeamSessionRecord(input) {
			    const record = {
			        schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
			        rootSessionId: input.rootSessionId,
			        blueprint: {
			            blueprintId: input.blueprint.blueprintId,
			            revision: input.blueprint.revision,
			            contentHash: input.blueprint.contentHash,
			        },
			        createdAt: input.createdAt,
			        generation: input.generation,
			    };
			    if (input.defaultWorkspace !== undefined) {
			        record['defaultWorkspace'] = input.defaultWorkspace;
			    }
			    if (input.handoffSourceSessionId !== undefined) {
			        record['handoffSourceSessionId'] = input.handoffSourceSessionId;
			    }
			    return validateTeamSessionRecord(record);
			}
			Object.defineProperty(exports, "createTeamSessionRecord", { enumerable: true, get: () => createTeamSessionRecord });
			/**
			 * Serialize a record to its stable canonical JSON form (sorted keys).
			 * @param record - the record.
			 * @returns the canonical JSON text.
			 */
			function serializeTeamSessionRecord(record) {
			    return canonicalJsonStringify(record);
			}
			Object.defineProperty(exports, "serializeTeamSessionRecord", { enumerable: true, get: () => serializeTeamSessionRecord });
			/**
			 * Deserialize canonical JSON back into a validated, frozen record.
			 * @param json - the canonical JSON text.
			 * @returns the parsed record.
			 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
			 *   validation codes a malformed record triggers.
			 */
			function deserializeTeamSessionRecord(json) {
			    let value;
			    try {
			        value = JSON.parse(json);
			    }
			    catch (error) {
			        throw teamContractError('MALFORMED_DTO', `TeamSessionRecord JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, {});
			    }
			    return parseTeamSessionRecord(value);
			}
			Object.defineProperty(exports, "deserializeTeamSessionRecord", { enumerable: true, get: () => deserializeTeamSessionRecord });
			//# sourceMappingURL=team-session-record.js.map
			}, exports: {} };
		__mods["../../contracts/src/dto/member-instance-record.js"] = { done: false, fn: function (exports) {
			const __imp32 = __req("../../contracts/src/schema-version.js");
			const LEADER_INSTANCE_RECORD_SCHEMA_VERSION = __imp32.LEADER_INSTANCE_RECORD_SCHEMA_VERSION;
			const TEAM_CONTRACT_SCHEMA_VERSION = __imp32.TEAM_CONTRACT_SCHEMA_VERSION;
			const assertSchemaVersion = __imp32.assertSchemaVersion;
			const __imp33 = __req("../../contracts/src/ids/session-id.js");
			const parseRootSessionId = __imp33.parseRootSessionId;
			const __imp34 = __req("../../contracts/src/ids/session-id.js");
			const parseChildSessionId = __imp34.parseChildSessionId;
			const __imp35 = __req("../../contracts/src/ids/instance-id.js");
			const parseInstanceId = __imp35.parseInstanceId;
			const __imp36 = __req("../../contracts/src/ids/template-id.js");
			const parseTemplateId = __imp36.parseTemplateId;
			const __imp37 = __req("../../contracts/src/identity.js");
			const createMemberIdentity = __imp37.createMemberIdentity;
			const LEADER_INSTANCE_ID = __imp37.LEADER_INSTANCE_ID;
			const __imp38 = __req("../../contracts/src/dto/common.js");
			const GROUP_ID_MAX_LENGTH = __imp38.GROUP_ID_MAX_LENGTH;
			const LABEL_MAX_LENGTH = __imp38.LABEL_MAX_LENGTH;
			const assertFieldPresent = __imp38.assertFieldPresent;
			const assertNoUnknownFields = __imp38.assertNoUnknownFields;
			const assertPlainRecord = __imp38.assertPlainRecord;
			const parseIso8601TimestampField = __imp38.parseIso8601TimestampField;
			const parseLabelLikeField = __imp38.parseLabelLikeField;
			const parseWorkspaceField = __imp38.parseWorkspaceField;
			const __imp39 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp39.assertNoLegacyFields;
			const __imp40 = __req("../../contracts/src/ids/common.js");
			const assertPositiveInteger = __imp40.assertPositiveInteger;
			const __imp41 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp41.teamContractError;
			const __imp42 = __req("../../contracts/src/remote-safe.js");
			const canonicalJsonStringify = __imp42.canonicalJsonStringify;
			const deepFreeze = __imp42.deepFreeze;
			/**
			 * MemberInstanceRecordDto — the TeamDomain record of a MemberInstance
			 * (Architecture §14.3 category B).
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **Member runtime identity = `(rootSessionId, instanceId)`**
			 *   (invariant 18): both components are stored; addressing a member by
			 *   label/templateId is the forbidden legacy pattern (invariant 19).
			 * - **Every MemberInstance binds exactly one durable child Session**
			 *   (invariant 23): `childSessionId` is a required field; the binding is
			 *   never re-pointed (invariant 24).
			 * - **Lifecycle is `CREATED | RUNNING | SETTLED | ARCHIVED | DISPOSED`**
			 *   (Architecture §29; §8.6 confirms these five are the MemberInstance
			 *   lifecycle states, and `PROVISIONING_FAILED` is explicitly NOT a
			 *   user-visible lifecycle).
			 * - **groupId is opaque grouping metadata with no state/permission/
			 *   lifecycle/activation semantics** (invariant 20, §12); optional.
			 * - **LeaderInstance** (Architecture §9.1/§9.2, invariants 13/14/15): the
			 *   Leader is the Root Agent + the Root Session itself. It has NO durable
			 *   child Session and NO ordinary member lifecycle, and it cannot be
			 *   independently archived or disposed. The v2 record shape (P8-S2,
			 *   `LEADER_INSTANCE_RECORD_SCHEMA_VERSION = 2`) encodes that in the
			 *   record: `childSessionId` and `lifecycle` are ABSENT keys (rejected on
			 *   presence, never defaulted) and `instanceId` must be the reserved
			 *   `inst-leader` id. Every v1 record — including legacy harness-style
			 *   leader rows that carry both fields — stays parseable (the freeze
			 *   rule adds a version, it never rewrites v1).
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/dto/member-instance-record
			 */
			/** The five frozen MemberInstance lifecycle states (Architecture §29). */
			const MEMBER_LIFECYCLE_STATES = {
			    /** Identity, binding, and creation config are durably committed; no work turn yet (§29.1). */
			    CREATED: 'CREATED',
			    /** An active admitted execution/turn exists (§29.2). */
			    RUNNING: 'RUNNING',
			    /** Current admitted work finished; identity/child Session/conversation preserved (§29.3). */
			    SETTLED: 'SETTLED',
			    /** Left the main active work set, durably retained (§29.4). */
			    ARCHIVED: 'ARCHIVED',
			    /** Terminal: durably removed (§29.5). */
			    DISPOSED: 'DISPOSED',
			};
			Object.defineProperty(exports, "MEMBER_LIFECYCLE_STATES", { enumerable: true, get: () => MEMBER_LIFECYCLE_STATES });
			/** Every lifecycle state value, for membership checks. */
			const MEMBER_LIFECYCLE_STATE_VALUES = Object.values(MEMBER_LIFECYCLE_STATES);
			Object.defineProperty(exports, "MEMBER_LIFECYCLE_STATE_VALUES", { enumerable: true, get: () => MEMBER_LIFECYCLE_STATE_VALUES });
			/**
			 * Is `value` one of the five frozen lifecycle states?
			 * @param value - the raw value found in a `lifecycle` field.
			 * @returns `true` iff it is a frozen lifecycle state.
			 */
			function isMemberLifecycleState(value) {
			    return typeof value === 'string' && MEMBER_LIFECYCLE_STATE_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isMemberLifecycleState", { enumerable: true, get: () => isMemberLifecycleState });
			/** The exact frozen fields of a MemberInstanceRecordDto (v1). */
			const MEMBER_INSTANCE_RECORD_FIELDS = [
			    'schemaVersion',
			    'rootSessionId',
			    'instanceId',
			    'templateId',
			    'label',
			    'groupId',
			    'childSessionId',
			    'workspace',
			    'lifecycle',
			    'createdAt',
			    'activityVersion',
			];
			Object.defineProperty(exports, "MEMBER_INSTANCE_RECORD_FIELDS", { enumerable: true, get: () => MEMBER_INSTANCE_RECORD_FIELDS });
			/**
			 * The exact frozen fields of a LeaderInstanceRecordDto (v2): the v1 field
			 * set minus `childSessionId` and `lifecycle` (Architecture §9.2 — the
			 * Leader is the Root Session; those keys are absent, never optional).
			 */
			const LEADER_INSTANCE_RECORD_FIELDS = [
			    'schemaVersion',
			    'rootSessionId',
			    'instanceId',
			    'templateId',
			    'label',
			    'groupId',
			    'workspace',
			    'createdAt',
			    'activityVersion',
			];
			Object.defineProperty(exports, "LEADER_INSTANCE_RECORD_FIELDS", { enumerable: true, get: () => LEADER_INSTANCE_RECORD_FIELDS });
			/**
			 * The exact accepted fields of a LeaderInstanceRecordInput (the v2
			 * creation input; no schemaVersion — stamped by the factory). Any other
			 * key on the input (schemaVersion / childSessionId / lifecycle) is a
			 * half-hack and fails closed.
			 */
			const LEADER_INSTANCE_RECORD_INPUT_FIELDS = [
			    'rootSessionId',
			    'instanceId',
			    'templateId',
			    'label',
			    'groupId',
			    'workspace',
			    'createdAt',
			    'activityVersion',
			];
			Object.defineProperty(exports, "LEADER_INSTANCE_RECORD_INPUT_FIELDS", { enumerable: true, get: () => LEADER_INSTANCE_RECORD_INPUT_FIELDS });
			function validateMemberInstanceRecord(record) {
			    assertNoLegacyFields(record, 'MemberInstanceRecord');
			    assertNoUnknownFields(record, MEMBER_INSTANCE_RECORD_FIELDS, 'MemberInstanceRecord');
			    for (const field of MEMBER_INSTANCE_RECORD_FIELDS) {
			        if (field !== 'groupId' && field !== 'workspace') {
			            assertFieldPresent(record, field, 'MemberInstanceRecord');
			        }
			    }
			    assertSchemaVersion(record['schemaVersion']);
			    const base = {
			        schemaVersion: record['schemaVersion'],
			        rootSessionId: parseRootSessionId(record['rootSessionId']),
			        instanceId: parseInstanceId(record['instanceId']),
			        templateId: parseTemplateId(record['templateId']),
			        label: parseLabelLikeField(record['label'], 'label', LABEL_MAX_LENGTH),
			        childSessionId: parseChildSessionId(record['childSessionId']),
			        lifecycle: (() => {
			            const raw = record['lifecycle'];
			            if (!isMemberLifecycleState(raw)) {
			                throw teamContractError('MALFORMED_DTO', `lifecycle must be one of ${MEMBER_LIFECYCLE_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field: 'lifecycle' });
			            }
			            return raw;
			        })(),
			        createdAt: parseIso8601TimestampField(record['createdAt']),
			        activityVersion: assertPositiveInteger(record['activityVersion'], 'activityVersion'),
			    };
			    // Absent optional fields must not become own `undefined` keys: the frozen
			    // record is a lossless-JSON value (remote-safe.ts rejects undefined).
			    const group = record['groupId'] === undefined
			        ? {}
			        : { groupId: parseLabelLikeField(record['groupId'], 'groupId', GROUP_ID_MAX_LENGTH) };
			    const workspace = record['workspace'] === undefined
			        ? {}
			        : { workspace: parseWorkspaceField(record['workspace'], 'workspace') };
			    return deepFreeze({ ...base, ...group, ...workspace });
			}
			function validateLeaderInstanceRecord(record) {
			    // The v2 forbidden keys are checked BEFORE the unknown-field gate so
			    // the rejection carries the specific §9.2 reason (mirroring the frozen
			    // P8-T1 projection rule LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION).
			    if (record['childSessionId'] !== undefined) {
			        throw teamContractError('MALFORMED_DTO', 'the LeaderInstance record must not carry a childSessionId (Architecture §9.2: the Leader is the Root Session itself)', { field: 'childSessionId', reason: 'LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION' });
			    }
			    if (record['lifecycle'] !== undefined) {
			        throw teamContractError('MALFORMED_DTO', 'the LeaderInstance record must not carry a member lifecycle (Architecture §9.2 / invariant 15: the Leader has no ordinary member lifecycle)', { field: 'lifecycle', reason: 'LEADER_INSTANCE_MUST_NOT_CARRY_LIFECYCLE' });
			    }
			    assertNoLegacyFields(record, 'LeaderInstanceRecord');
			    assertNoUnknownFields(record, LEADER_INSTANCE_RECORD_FIELDS, 'LeaderInstanceRecord');
			    for (const field of LEADER_INSTANCE_RECORD_FIELDS) {
			        if (field !== 'groupId' && field !== 'workspace') {
			            assertFieldPresent(record, field, 'LeaderInstanceRecord');
			        }
			    }
			    assertSchemaVersion(record['schemaVersion'], LEADER_INSTANCE_RECORD_SCHEMA_VERSION);
			    const instanceId = parseInstanceId(record['instanceId']);
			    if (instanceId !== LEADER_INSTANCE_ID) {
			        throw teamContractError('MALFORMED_DTO', `a schemaVersion-2 member record is the LeaderInstance record and must carry the reserved leader id (got ${String(instanceId)})`, { field: 'instanceId' });
			    }
			    const base = {
			        schemaVersion: record['schemaVersion'],
			        rootSessionId: parseRootSessionId(record['rootSessionId']),
			        instanceId,
			        templateId: parseTemplateId(record['templateId']),
			        label: parseLabelLikeField(record['label'], 'label', LABEL_MAX_LENGTH),
			        createdAt: parseIso8601TimestampField(record['createdAt']),
			        activityVersion: assertPositiveInteger(record['activityVersion'], 'activityVersion'),
			    };
			    const group = record['groupId'] === undefined
			        ? {}
			        : { groupId: parseLabelLikeField(record['groupId'], 'groupId', GROUP_ID_MAX_LENGTH) };
			    const workspace = record['workspace'] === undefined
			        ? {}
			        : { workspace: parseWorkspaceField(record['workspace'], 'workspace') };
			    return deepFreeze({ ...base, ...group, ...workspace });
			}
			/**
			 * Parse and validate a MemberInstanceRecordDto from an untrusted value.
			 *
			 * The v2 branch (P8-S2): a row stamped `schemaVersion: 2` is the
			 * LeaderInstance record and is validated as a {@link LeaderInstanceRecordDto}.
			 * Documented type lie at the return type: the v1 `MemberInstanceRecordDto`
			 * stays the declared parse contract because the unowned storage repository
			 * and domain consumers assign the result to that type; a v2 row is a
			 * `LeaderInstanceRecordDto` whose identity core (`rootSessionId`,
			 * `instanceId`) is shared, and whose absent `childSessionId`/`lifecycle`
			 * keys stay absent at runtime (no value is ever defaulted).
			 *
			 * @param value - the unknown input (e.g. a decoded TeamDomain row).
			 * @returns the frozen record.
			 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
			 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
			 *   `INVALID_ROOT_SESSION_ID`, `INVALID_INSTANCE_ID`,
			 *   `INVALID_TEMPLATE_ID`, or `INVALID_CHILD_SESSION_ID`.
			 */
			function parseMemberInstanceRecord(value) {
			    const record = assertPlainRecord(value, 'MemberInstanceRecord');
			    // Version routing: a numeric (or numeric-string) stamp of 2 targets the
			    // v2 leader validator, so a corrupt stamp such as the string '2' surfaces
			    // as SCHEMA_VERSION_UNSUPPORTED from the v2 validator — exactly the way a
			    // string-form '1' stamp does on the v1 path. Every other value (1, 3,
			    // anything else) takes the v1 path, whose expected version is 1.
			    const stamp = record['schemaVersion'];
			    const targetsV2 = (typeof stamp === 'number' || typeof stamp === 'string') &&
			        Number(stamp) === LEADER_INSTANCE_RECORD_SCHEMA_VERSION;
			    if (targetsV2) {
			        // Documented type lie (see the function JSDoc): the v2 row is a
			        // LeaderInstanceRecordDto; the declared v1 return keeps the unowned
			        // storage/domain assignment surface compiling.
			        return validateLeaderInstanceRecord(record);
			    }
			    return validateMemberInstanceRecord(record);
			}
			/**
			 * Shape guard for the union factory input (C2): the honest leader input
			 * is the one that (a) carries the reserved leader id and (b) carries NEITHER
			 * `childSessionId` NOR `lifecycle` as own defined values. A half-hack
			 * (the leader id with exactly one of the two fields, as in the legacy
			 * harness seeding pattern) fails this guard and falls to the v1 path,
			 * where the missing/extra field is rejected fail-closed — the factory
			 * never defaults a value.
			 */
			function isLeaderInstanceRecordInput(input) {
			    const candidate = input;
			    return (candidate['instanceId'] === LEADER_INSTANCE_ID &&
			        candidate['childSessionId'] === undefined &&
			        candidate['lifecycle'] === undefined);
			}
			/**
			 * Build a fresh LeaderInstanceRecordDto (creation path, v2).
			 * @param input - the identity fields; ids must already be branded. The
			 *   input must carry exactly the v2 identity fields — any
			 *   schemaVersion/childSessionId/lifecycle key fails closed.
			 * @returns the frozen record with `schemaVersion` stamped to `2`.
			 */
			export function createLeaderInstanceRecord(input) {
			    assertNoUnknownFields(input, LEADER_INSTANCE_RECORD_INPUT_FIELDS, 'LeaderInstanceRecordInput');
			    const record = {
			        schemaVersion: LEADER_INSTANCE_RECORD_SCHEMA_VERSION,
			        rootSessionId: input.rootSessionId,
			        instanceId: input.instanceId,
			        templateId: input.templateId,
			        label: input.label,
			        createdAt: input.createdAt,
			        activityVersion: input.activityVersion,
			    };
			    if (input.groupId !== undefined)
			        record['groupId'] = input.groupId;
			    if (input.workspace !== undefined)
			        record['workspace'] = input.workspace;
			    return validateLeaderInstanceRecord(record);
			}
			/**
			 * Build a fresh MemberInstanceRecordDto (creation path).
			 *
			 * C2 (P8-S2): the input is the union of the v1 member input and the v2
			 * leader input. The shape branch mints the honest v2 leader record when
			 * the input is structurally the leader input (see
			 * {@link isLeaderInstanceRecordInput}); every other input takes the v1
			 * path byte-identical to the frozen v1 factory.
			 *
			 * Documented type lie at the return type: a v2 mint is a
			 * `LeaderInstanceRecordDto`; the v1 `MemberInstanceRecordDto` stays the
			 * declared return contract because the unowned storage repository and
			 * domain consumers assign the result to that type (the shared identity
			 * core makes those assignments safe; the absent v2 keys stay absent).
			 *
			 * @param input - the identity fields; ids must already be branded.
			 * @returns the frozen record (`schemaVersion` stamped `1` for members,
			 *   `2` for the leader shape).
			 */
			export function createMemberInstanceRecord(input) {
			    if (isLeaderInstanceRecordInput(input)) {
			        // Documented type lie (see the function JSDoc): the honest v2 mint is
			        // a LeaderInstanceRecordDto; the declared v1 return keeps the unowned
			        // storage/domain assignment surface compiling.
			        return createLeaderInstanceRecord(input);
			    }
			    const memberInput = input;
			    const record = {
			        schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
			        rootSessionId: memberInput.rootSessionId,
			        instanceId: memberInput.instanceId,
			        templateId: memberInput.templateId,
			        label: memberInput.label,
			        childSessionId: memberInput.childSessionId,
			        lifecycle: memberInput.lifecycle,
			        createdAt: memberInput.createdAt,
			        activityVersion: memberInput.activityVersion,
			    };
			    if (memberInput.groupId !== undefined)
			        record['groupId'] = memberInput.groupId;
			    if (memberInput.workspace !== undefined)
			        record['workspace'] = memberInput.workspace;
			    return validateMemberInstanceRecord(record);
			}
			/**
			 * The composite runtime identity carried by a record (invariant 18).
			 * @param record - the member record.
			 * @returns the frozen `(rootSessionId, instanceId)` identity.
			 */
			export function memberIdentityOf(record) {
			    return createMemberIdentity(record.rootSessionId, record.instanceId);
			}
			/**
			 * Serialize a record to its stable canonical JSON form (sorted keys).
			 * @param record - the record.
			 * @returns the canonical JSON text.
			 */
			export function serializeMemberInstanceRecord(record) {
			    return canonicalJsonStringify(record);
			}
			/**
			 * Deserialize canonical JSON back into a validated, frozen record.
			 * @param json - the canonical JSON text.
			 * @returns the parsed record.
			 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
			 *   validation codes a malformed record triggers.
			 */
			export function deserializeMemberInstanceRecord(json) {
			    let value;
			    try {
			        value = JSON.parse(json);
			    }
			    catch (error) {
			        throw teamContractError('MALFORMED_DTO', `MemberInstanceRecord JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, {});
			    }
			    return parseMemberInstanceRecord(value);
			}
			//# sourceMappingURL=member-instance-record.js.map
			}, exports: {} };
		__mods["../../contracts/src/dto/session-binding.js"] = { done: false, fn: function (exports) {
			const __imp23 = __req("../../contracts/src/schema-version.js");
			const TEAM_CONTRACT_SCHEMA_VERSION = __imp23.TEAM_CONTRACT_SCHEMA_VERSION;
			const assertSchemaVersion = __imp23.assertSchemaVersion;
			const __imp24 = __req("../../contracts/src/ids/session-id.js");
			const parseChildSessionId = __imp24.parseChildSessionId;
			const parseRootSessionId = __imp24.parseRootSessionId;
			const parseSessionId = __imp24.parseSessionId;
			const __imp25 = __req("../../contracts/src/ids/instance-id.js");
			const parseInstanceId = __imp25.parseInstanceId;
			const __imp26 = __req("../../contracts/src/dto/common.js");
			const assertNoUnknownFields = __imp26.assertNoUnknownFields;
			const assertPlainRecord = __imp26.assertPlainRecord;
			const __imp27 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp27.assertNoLegacyFields;
			const __imp28 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp28.teamContractError;
			const __imp29 = __req("../../contracts/src/remote-safe.js");
			const canonicalJsonStringify = __imp29.canonicalJsonStringify;
			const deepFreeze = __imp29.deepFreeze;
			/**
			 * SessionBindingDto — the TeamDomain association between a DSH Session id
			 * and Team root/member identity (Architecture §14.3 category C).
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **Any relevant DSH Session must be resolvable to
			 *   `ordinary | team-root | team-member`** (§14.3 C). This is the vNext
			 *   replacement for the legacy projection's event-scan heuristics: the
			 *   binding is a durable TeamDomain fact, not a session-event vocabulary.
			 * - **A member binding provides `childSessionId -> rootSessionId ->
			 *   instanceId`** (§14.3 C): from a child session you recover the exact
			 *   composite member identity (invariant 18) — never a label, never a
			 *   legacy `memberId`.
			 * - **TeamSessionId = RootSessionId** (invariant 9): in a `team-root`
			 *   binding the `sessionId` IS the TeamSession id; no second field.
			 * - **Every MemberInstance binds exactly one durable child Session**
			 *   (invariant 23) — uniqueness enforced by
			 *   {@link import('../uniqueness.js').assertChildSessionBindingUnique}.
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/dto/session-binding
			 */
			/** The three frozen binding kinds (Architecture §14.3 C). */
			const SESSION_BINDING_KINDS = {
			    /** An ordinary DSH session: no Team binding. */
			    ORDINARY: 'ordinary',
			    /** The root DSH session of a TeamSession (its id IS the TeamSessionId). */
			    TEAM_ROOT: 'team-root',
			    /** The durable child DSH session of one MemberInstance. */
			    TEAM_MEMBER: 'team-member',
			};
			Object.defineProperty(exports, "SESSION_BINDING_KINDS", { enumerable: true, get: () => SESSION_BINDING_KINDS });
			const FIELDS_BY_KIND = {
			    ordinary: ['schemaVersion', 'kind', 'sessionId'],
			    'team-root': ['schemaVersion', 'kind', 'sessionId'],
			    'team-member': ['schemaVersion', 'kind', 'sessionId', 'rootSessionId', 'instanceId'],
			};
			function isSessionBindingKind(value) {
			    return (value === SESSION_BINDING_KINDS.ORDINARY ||
			        value === SESSION_BINDING_KINDS.TEAM_ROOT ||
			        value === SESSION_BINDING_KINDS.TEAM_MEMBER);
			}
			function validateSessionBinding(record) {
			    assertNoLegacyFields(record, 'SessionBinding');
			    const kind = record['kind'];
			    if (!isSessionBindingKind(kind)) {
			        throw teamContractError('MALFORMED_DTO', `SessionBinding.kind must be one of ordinary | team-root | team-member, got ${JSON.stringify(kind)}`, { field: 'kind' });
			    }
			    assertNoUnknownFields(record, FIELDS_BY_KIND[kind], 'SessionBinding');
			    assertSchemaVersion(record['schemaVersion']);
			    if (kind === SESSION_BINDING_KINDS.ORDINARY) {
			        return deepFreeze({
			            schemaVersion: record['schemaVersion'],
			            kind,
			            sessionId: parseSessionId(record['sessionId']),
			        });
			    }
			    if (kind === SESSION_BINDING_KINDS.TEAM_ROOT) {
			        return deepFreeze({
			            schemaVersion: record['schemaVersion'],
			            kind,
			            sessionId: parseRootSessionId(record['sessionId']),
			        });
			    }
			    return deepFreeze({
			        schemaVersion: record['schemaVersion'],
			        kind,
			        sessionId: parseChildSessionId(record['sessionId']),
			        rootSessionId: parseRootSessionId(record['rootSessionId']),
			        instanceId: parseInstanceId(record['instanceId']),
			    });
			}
			/**
			 * Parse and validate a SessionBindingDto from an untrusted value.
			 * @param value - the unknown input (e.g. a decoded TeamDomain row).
			 * @returns the frozen binding row.
			 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
			 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
			 *   `INVALID_SESSION_ID`, `INVALID_ROOT_SESSION_ID`,
			 *   `INVALID_CHILD_SESSION_ID`, or `INVALID_INSTANCE_ID`.
			 */
			function parseSessionBinding(value) {
			    return validateSessionBinding(assertPlainRecord(value, 'SessionBinding'));
			}
			Object.defineProperty(exports, "parseSessionBinding", { enumerable: true, get: () => parseSessionBinding });
			/**
			 * Serialize a binding row to its stable canonical JSON form (sorted keys).
			 * @param binding - the binding row.
			 * @returns the canonical JSON text.
			 */
			function serializeSessionBinding(binding) {
			    return canonicalJsonStringify(binding);
			}
			Object.defineProperty(exports, "serializeSessionBinding", { enumerable: true, get: () => serializeSessionBinding });
			/**
			 * Deserialize canonical JSON back into a validated, frozen binding row.
			 * @param json - the canonical JSON text.
			 * @returns the parsed binding row.
			 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
			 *   validation codes a malformed row triggers.
			 */
			function deserializeSessionBinding(json) {
			    let value;
			    try {
			        value = JSON.parse(json);
			    }
			    catch (error) {
			        throw teamContractError('MALFORMED_DTO', `SessionBinding JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, {});
			    }
			    return parseSessionBinding(value);
			}
			Object.defineProperty(exports, "deserializeSessionBinding", { enumerable: true, get: () => deserializeSessionBinding });
			//# sourceMappingURL=session-binding.js.map
			}, exports: {} };
		__mods["../../contracts/src/dto/blueprint-snapshot.js"] = { done: false, fn: function (exports) {
			const __imp21 = __req("../../contracts/src/ids/blueprint-id.js");
			const parseBlueprintContentHash = __imp21.parseBlueprintContentHash;
			const parseBlueprintId = __imp21.parseBlueprintId;
			const parseBlueprintRevision = __imp21.parseBlueprintRevision;
			const __imp22 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp22.assertNoLegacyFields;
			const __imp23 = __req("../../contracts/src/dto/common.js");
			const assertNoUnknownFields = __imp23.assertNoUnknownFields;
			const assertPlainRecord = __imp23.assertPlainRecord;
			const __imp24 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp24.teamContractError;
			const __imp25 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp25.deepFreeze;
			/**
			 * BlueprintSnapshotRef — the immutable identity of the Blueprint snapshot a
			 * TeamSession binds.
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **One TeamSession binds exactly one immutable Blueprint snapshot**
			 *   (invariant 10, §8.4): once bound, the snapshot cannot be replaced in
			 *   place; switching blueprints means a new TeamIntent / new Root Session.
			 * - **The snapshot freezes Blueprint-owned semantics, not the external
			 *   environment** (invariant 12).
			 * - The snapshot is identified by `blueprintId` + `revision` +
			 *   `contentHash` (§5.2); the display form is `blueprintId@revision`
			 *   (e.g. `AIUED-ALGO@17`, §8.4).
			 *
			 * The snapshot ref is an embedded value: the enclosing versioned record
			 * owns the schema version, so the ref carries none of its own.
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/dto/blueprint-snapshot
			 */
			/** The exact frozen fields of a blueprint snapshot ref. */
			const BLUEPRINT_SNAPSHOT_FIELDS = [
			    'blueprintId',
			    'revision',
			    'contentHash',
			];
			Object.defineProperty(exports, "BLUEPRINT_SNAPSHOT_FIELDS", { enumerable: true, get: () => BLUEPRINT_SNAPSHOT_FIELDS });
			/**
			 * Parse and validate a blueprint snapshot ref from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen snapshot ref.
			 * @throws `MALFORMED_DTO` for a malformed container/field set,
			 *   `LEGACY_MEMBER_ID_REJECTED` for legacy fields, and the id-specific
			 *   codes for malformed components.
			 */
			function parseBlueprintSnapshotRef(value) {
			    const record = assertPlainRecord(value, 'BlueprintSnapshotRef');
			    assertNoLegacyFields(record, 'BlueprintSnapshotRef');
			    assertNoUnknownFields(record, BLUEPRINT_SNAPSHOT_FIELDS, 'BlueprintSnapshotRef');
			    return deepFreeze({
			        blueprintId: parseBlueprintId(record['blueprintId']),
			        revision: parseBlueprintRevision(record['revision']),
			        contentHash: parseBlueprintContentHash(record['contentHash']),
			    });
			}
			Object.defineProperty(exports, "parseBlueprintSnapshotRef", { enumerable: true, get: () => parseBlueprintSnapshotRef });
			/**
			 * Build a blueprint snapshot ref from already-validated components
			 * (use the `parse*` id functions first).
			 * @param input - the three snapshot components.
			 * @returns the frozen snapshot ref.
			 */
			function createBlueprintSnapshotRef(input) {
			    return deepFreeze({
			        blueprintId: input.blueprintId,
			        revision: input.revision,
			        contentHash: input.contentHash,
			    });
			}
			Object.defineProperty(exports, "createBlueprintSnapshotRef", { enumerable: true, get: () => createBlueprintSnapshotRef });
			/**
			 * The stable display/serialization form of a snapshot ref:
			 * `blueprintId@revision` (the architecture's `AIUED-ALGO@17` form, §8.4).
			 * Unambiguous because neither component may contain `@`.
			 * @param ref - the snapshot ref.
			 * @returns the `blueprintId@revision` string.
			 */
			function blueprintSnapshotKey(ref) {
			    return `${ref.blueprintId}@${ref.revision}`;
			}
			Object.defineProperty(exports, "blueprintSnapshotKey", { enumerable: true, get: () => blueprintSnapshotKey });
			/**
			 * Parse a `blueprintId@revision` display key back into its two components
			 * (the content hash is not recoverable from the display form; pass it
			 * separately when a full ref is needed).
			 * @param key - the display key string.
			 * @returns the parsed components.
			 * @throws `MALFORMED_DTO` when the key is not exactly one `@`-separated pair,
			 *   and the id-specific codes when a component is malformed.
			 */
			function parseBlueprintSnapshotKey(key) {
			    const index = key.indexOf('@');
			    if (index < 0 || index !== key.lastIndexOf('@')) {
			        throw teamContractError('MALFORMED_DTO', 'blueprint snapshot key must be exactly blueprintId@revision', { key });
			    }
			    return {
			        blueprintId: parseBlueprintId(key.slice(0, index)),
			        revision: parseBlueprintRevision(key.slice(index + 1)),
			    };
			}
			Object.defineProperty(exports, "parseBlueprintSnapshotKey", { enumerable: true, get: () => parseBlueprintSnapshotKey });
			//# sourceMappingURL=blueprint-snapshot.js.map
			}, exports: {} };
		__mods["../../contracts/src/legacy-vocabulary.js"] = { done: false, fn: function (exports) {
			const __imp31 = __req("../../contracts/src/remote-safe.js");
			const toRemoteSafeDetail = __imp31.toRemoteSafeDetail;
			const __imp32 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp32.teamContractError;
			/**
			 * Legacy vocabulary quarantine.
			 *
			 * The legacy Team implementation (frozen fork, reference-only) addressed
			 * members by a `memberId` that doubled as definition AND runtime identity,
			 * and expressed Team coordination facts as Team-specific DSH SessionEvents
			 * (`team/member-bound`, `team/progress`, `team/control-request`,
			 * `team/control-decision`, `team/message`) written into the upstream
			 * session log. Both are exactly what vNext must not do:
			 *
			 * - the legacy `memberId` authority is the acceptance-criterion anti-pattern
			 *   of P3-T1 (contracts must not carry legacy MemberId authority);
			 * - **no Team-specific DSH SessionEvent vocabulary** (invariant 42,
			 *   Architecture §14.2): Team control-plane facts live in the TeamDomain
			 *   durable sidecar (TeamLedger / operation journal), never in session events.
			 *
			 * What this module provides:
			 *
			 * - `LEGACY_FORBIDDEN_FIELDS` — field names that no vNext DTO may carry
			 *   (`memberId`). DTO parsers reject them with `LEGACY_MEMBER_ID_REJECTED`.
			 * - `LEGACY_TEAM_SESSION_EVENT_NAMES` — the legacy event vocabulary,
			 *   frozen as DETECTION vocabulary only: it exists so the read-only legacy
			 *   import path (invariant 65: existing legacy Team Sessions are read-only,
			 *   never auto-migrated) can recognize legacy records, and so any attempt
			 *   to emit a name from this list through a vNext surface fails with
			 *   `LEGACY_TEAM_SESSION_EVENT_REJECTED`. vNext itself defines NO team
			 *   session event names in this contract.
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/legacy-vocabulary
			 */
			/**
			 * Field names that no vNext DTO or record may carry. Their presence means
			 * the value carries the legacy `memberId` identity authority.
			 */
			const LEGACY_FORBIDDEN_FIELDS = ['memberId'];
			Object.defineProperty(exports, "LEGACY_FORBIDDEN_FIELDS", { enumerable: true, get: () => LEGACY_FORBIDDEN_FIELDS });
			/**
			 * The legacy Team SessionEvent vocabulary (frozen fork `packages/team`).
			 *
			 * DETECTION ONLY. vNext has no Team SessionEvents (invariant 42); these
			 * names appear in vNext code solely to recognize and reject legacy values
			 * on the read-only import path.
			 */
			const LEGACY_TEAM_SESSION_EVENT_NAMES = [
			    'team/member-bound',
			    'team/progress',
			    'team/control-request',
			    'team/control-decision',
			    'team/message',
			];
			Object.defineProperty(exports, "LEGACY_TEAM_SESSION_EVENT_NAMES", { enumerable: true, get: () => LEGACY_TEAM_SESSION_EVENT_NAMES });
			/**
			 * Does `name` belong to the legacy Team SessionEvent vocabulary?
			 * @param name - the event name to check.
			 * @returns `true` iff `name` is one of `LEGACY_TEAM_SESSION_EVENT_NAMES`.
			 */
			function isLegacyTeamSessionEventName(name) {
			    return typeof name === 'string' && LEGACY_TEAM_SESSION_EVENT_NAMES.includes(name);
			}
			Object.defineProperty(exports, "isLegacyTeamSessionEventName", { enumerable: true, get: () => isLegacyTeamSessionEventName });
			/**
			 * Assert that `name` is not a legacy Team SessionEvent name.
			 * @param name - the event name to check.
			 * @throws `LEGACY_TEAM_SESSION_EVENT_REJECTED` when the name is a legacy
			 *   Team SessionEvent name (vNext has no such vocabulary, invariant 42).
			 */
			function assertNotLegacyTeamSessionEvent(name) {
			    if (isLegacyTeamSessionEventName(name)) {
			        throw teamContractError('LEGACY_TEAM_SESSION_EVENT_REJECTED', `legacy Team SessionEvent name ${JSON.stringify(name)} is not vNext vocabulary; Team control-plane facts belong to TeamDomain, not session events`, { name: toRemoteSafeDetail(name) });
			    }
			}
			Object.defineProperty(exports, "assertNotLegacyTeamSessionEvent", { enumerable: true, get: () => assertNotLegacyTeamSessionEvent });
			/**
			 * Assert that a DTO record carries no legacy-forbidden field (notably
			 * `memberId`). Called by every DTO parser before field validation.
			 * @param record - the plain record to check.
			 * @param dtoName - the DTO name, used in the error message.
			 * @throws `LEGACY_MEMBER_ID_REJECTED` when a forbidden legacy field is present.
			 */
			function assertNoLegacyFields(record, dtoName) {
			    for (const field of LEGACY_FORBIDDEN_FIELDS) {
			        if (Object.hasOwn(record, field)) {
			            throw teamContractError('LEGACY_MEMBER_ID_REJECTED', `${dtoName} carries the legacy field '${field}'; vNext runtime identity is the composite (rootSessionId, instanceId), never a legacy memberId`, { field });
			        }
			    }
			}
			Object.defineProperty(exports, "assertNoLegacyFields", { enumerable: true, get: () => assertNoLegacyFields });
			//# sourceMappingURL=legacy-vocabulary.js.map
			}, exports: {} };
		__mods["../../contracts/src/uniqueness.js"] = { done: false, fn: function (exports) {
			const __imp22 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp22.teamContractError;
			/**
			 * Uniqueness / scoping assertions over contract values.
			 *
			 * Pure checks over already-parsed contract values that encode the
			 * cardinality invariants of the object model. They take the existing
			 * records as input (the caller owns the roster) and throw the corresponding
			 * contract error — no authority, no I/O.
			 *
			 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
			 *
			 * - **One Root Session -> 0 or 1 TeamSession** (invariant 8) →
			 *   {@link assertTeamSessionUnique}.
			 * - **`instanceId` unique within one TeamSession** (Architecture §10.2;
			 *   the composite key, invariant 18, is what makes "within" precise) →
			 *   {@link assertInstanceIdUniqueWithinTeam}.
			 * - **Every MemberInstance binds exactly one durable child Session**
			 *   (invariant 23; a child session is never shared) →
			 *   {@link assertChildSessionBindingUnique}.
			 *
			 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/uniqueness
			 */
			/**
			 * Assert that no TeamSession is already recorded for this root session
			 * (invariant 8: one Root Session -> 0 or 1 TeamSession).
			 * @param rootSessionId - the root session id about to be bound.
			 * @param existing - the already-recorded TeamSession records.
			 * @throws `DUPLICATE_TEAM_SESSION` when a record already binds this root.
			 */
			function assertTeamSessionUnique(rootSessionId, existing) {
			    const clash = existing.find((record) => record.rootSessionId === rootSessionId);
			    if (clash !== undefined) {
			        throw teamContractError('DUPLICATE_TEAM_SESSION', `root session '${rootSessionId}' already has a TeamSession (invariant: 0 or 1 per root); switch blueprints through a new TeamIntent / new Root Session`, { rootSessionId });
			    }
			}
			Object.defineProperty(exports, "assertTeamSessionUnique", { enumerable: true, get: () => assertTeamSessionUnique });
			/**
			 * Assert that no member with this instance id exists in this TeamSession.
			 *
			 * Scoping is by the composite key: records under a different
			 * `rootSessionId` are ignored — the same instance id under another team
			 * is a different member (invariant 18).
			 * @param rootSessionId - the TeamSession (root session id) being checked.
			 * @param instanceId - the instance id about to be minted.
			 * @param existing - the already-recorded member records (any teams).
			 * @throws `DUPLICATE_INSTANCE_ID` when the same team already has this instance id.
			 */
			function assertInstanceIdUniqueWithinTeam(rootSessionId, instanceId, existing) {
			    const clash = existing.find((record) => record.rootSessionId === rootSessionId && record.instanceId === instanceId);
			    if (clash !== undefined) {
			        throw teamContractError('DUPLICATE_INSTANCE_ID', `TeamSession '${rootSessionId}' already has instance '${instanceId}'; instanceId is unique within one TeamSession`, { rootSessionId, instanceId });
			    }
			}
			Object.defineProperty(exports, "assertInstanceIdUniqueWithinTeam", { enumerable: true, get: () => assertInstanceIdUniqueWithinTeam });
			/**
			 * Assert that no member binding already claims this child session
			 * (invariant 23: each MemberInstance binds exactly one durable child
			 * Session; a child session belongs to at most one member).
			 * @param childSessionId - the child session id about to be bound.
			 * @param existing - the already-recorded session binding rows.
			 * @throws `SESSION_ALREADY_BOUND` when a team-member binding already carries this child session.
			 */
			function assertChildSessionBindingUnique(childSessionId, existing) {
			    const memberBindings = existing.filter((binding) => binding.kind === 'team-member');
			    const clash = memberBindings.find((binding) => binding.sessionId === childSessionId);
			    if (clash !== undefined) {
			        throw teamContractError('SESSION_ALREADY_BOUND', `child session '${childSessionId}' is already bound to member ('${clash.rootSessionId}', '${clash.instanceId}'); a child session is never shared between members`, { childSessionId });
			    }
			}
			Object.defineProperty(exports, "assertChildSessionBindingUnique", { enumerable: true, get: () => assertChildSessionBindingUnique });
			//# sourceMappingURL=uniqueness.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/schema.js"] = { done: false, fn: function (exports) {
			const __imp17 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp17.teamContractError;
			const __imp18 = __req("../../contracts/src/remote-safe.js");
			const toRemoteSafeDetail = __imp18.toRemoteSafeDetail;
			/**
			 * Schema version discipline for the projection DTO family.
			 *
			 * TeamProjectionDto (P8-T1) is a new versioned record family. It carries its
			 * OWN `schemaVersion` track — frozen at `1` by P8-T1 — instead of re-stamping
			 * the package-wide `TEAM_CONTRACT_SCHEMA_VERSION` (P3-T1 freeze). Rationale:
			 * the three record families (TeamSessionRecord, MemberInstanceRecord,
			 * TeamProjection) evolve independently; a projection-shape change must not
			 * bump the stamp of the TeamDomain record family, and vice versa. The
			 * freeze rule in CHANGELOG.md governs bumps in either direction.
			 *
			 * The error codes are the shared closed set (`SCHEMA_VERSION_MISMATCH` /
			 * `SCHEMA_VERSION_UNSUPPORTED`); no new codes are introduced.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/schema
			 */
			/**
			 * The schema version stamped by projection v1 records.
			 * Frozen by P8-T1; changing or replacing it is a contract change.
			 */
			const PROJECTION_SCHEMA_VERSION = 1;
			Object.defineProperty(exports, "PROJECTION_SCHEMA_VERSION", { enumerable: true, get: () => PROJECTION_SCHEMA_VERSION });
			/**
			 * The schema version stamped by projection v2 records (S7-R2, repair
			 * R2-2..R2-6): v1 plus ADDITIVE optional fields — the per-entry
			 * provenance fields of the effective-config view (effective-config.ts)
			 * and the version-gated optional member/top-level fields of the same
			 * repair line. v1 records remain valid and are parsed byte-identically
			 * through the v1 field sets; a v2 record may carry the additive keys
			 * (and may also omit them — every v2 addition is DURATIONAL-optional).
			 *
			 * This is the version-track change required by the contracts freeze rule
			 * (CHANGELOG.md): a new version, new stamp, v1 semantics untouched.
			 */
			const PROJECTION_SCHEMA_VERSION_V2 = 2;
			Object.defineProperty(exports, "PROJECTION_SCHEMA_VERSION_V2", { enumerable: true, get: () => PROJECTION_SCHEMA_VERSION_V2 });
			/**
			 * All projection schema versions this build reads and writes:
			 * `[1, 2]` (S7-R2 R2-2 additive v2).
			 */
			const SUPPORTED_PROJECTION_SCHEMA_VERSIONS = [1, 2];
			Object.defineProperty(exports, "SUPPORTED_PROJECTION_SCHEMA_VERSIONS", { enumerable: true, get: () => SUPPORTED_PROJECTION_SCHEMA_VERSIONS });
			/**
			 * Is `value` a supported projection schema version (a positive integer in
			 * the supported set)?
			 * @param value - the raw value found in a `schemaVersion` field.
			 * @returns `true` iff `value` is one of `SUPPORTED_PROJECTION_SCHEMA_VERSIONS`.
			 */
			function isSupportedProjectionSchemaVersion(value) {
			    return (typeof value === 'number' &&
			        Number.isInteger(value) &&
			        value >= 1 &&
			        SUPPORTED_PROJECTION_SCHEMA_VERSIONS.includes(value));
			}
			Object.defineProperty(exports, "isSupportedProjectionSchemaVersion", { enumerable: true, get: () => isSupportedProjectionSchemaVersion });
			/**
			 * Assert that `value` is a supported projection schema version.
			 * @param value - the raw value found in a `schemaVersion` field.
			 * @throws `SCHEMA_VERSION_MISMATCH` for a well-formed version that is not
			 *   supported by this build, or `SCHEMA_VERSION_UNSUPPORTED` when the value
			 *   is not even a positive integer (structurally corrupt version field).
			 */
			function assertProjectionSchemaVersion(value) {
			    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
			        throw teamContractError('SCHEMA_VERSION_UNSUPPORTED', `projection schema version must be a positive integer, got ${JSON.stringify(value)}`, { schemaVersion: toRemoteSafeDetail(value) });
			    }
			    if (!SUPPORTED_PROJECTION_SCHEMA_VERSIONS.includes(value)) {
			        throw teamContractError('SCHEMA_VERSION_MISMATCH', `unsupported projection schema version ${value}; this build supports [${SUPPORTED_PROJECTION_SCHEMA_VERSIONS.join(', ')}]`, { schemaVersion: toRemoteSafeDetail(value), supported: [...SUPPORTED_PROJECTION_SCHEMA_VERSIONS] });
			    }
			}
			Object.defineProperty(exports, "assertProjectionSchemaVersion", { enumerable: true, get: () => assertProjectionSchemaVersion });
			//# sourceMappingURL=schema.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/states.js"] = { done: false, fn: function (exports) {
			const __imp31 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp31.teamContractError;
			/**
			 * Closed state vocabularies of the projection DTO family (P8-T1).
			 *
			 * Each vocabulary is a FROZEN closed set: the constants are `as const`
			 * objects (or fixed arrays), the values are the exact wire strings, and the
			 * guards are membership checks. Producers must never invent a value outside
			 * the set; consumers may branch on the full set.
			 *
			 * Authorities (frozen 20260829 plan docs):
			 *
			 * - admission states: Architecture §28 (the four frozen admission states of
			 *   the TeamSession admission gate, surfaced on the projection root);
			 * - residency states: UI §24 (the three frozen agent-residency states of the
			 *   live overlay);
			 * - template kinds: Architecture §6.1 (exactly one LeaderTemplate per
			 *   blueprint, invariant 13; MemberTemplate, invariant 17);
			 * - context policies: Architecture §11 / invariant 29 (frozen at instance
			 *   creation: `persistent` | `fresh_per_delegation`);
			 * - progress values: the closed P6-T2 admission progress set, mirrored as
			 *   the durable activity status (no invented vocabulary);
			 * - ledger categories: UI §27.4 (the eight frozen filter categories of the
			 *   TeamLedger view; the projection carries the summary only, never the
			 *   entries).
			 *
			 * The MemberInstance lifecycle vocabulary (CREATED | RUNNING | SETTLED |
			 * ARCHIVED | DISPOSED, Architecture §29) is NOT re-declared here: it is the
			 * P3-T1 frozen `MemberLifecycleState`, re-exported by the family barrel.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/states
			 */
			// --- admission (Architecture §28) ------------------------------------------------
			/** The four frozen admission states of a TeamSession (Architecture §28). */
			const ADMISSION_STATES = {
			    /** All admission checks pass; work may be admitted (§28). */
			    OPEN: 'OPEN',
			    /** Warnings present; admission allowed, warnings surfaced to the human (§28). */
			    BLOCKED_WARNING: 'BLOCKED_WARNING',
			    /** A fatal check failed; admission blocked until resolved (§28). */
			    BLOCKED_FATAL: 'BLOCKED_FATAL',
			    /** Degraded operation after an explicit human acknowledgement (§28). */
			    DEGRADED_ACKNOWLEDGED: 'DEGRADED_ACKNOWLEDGED',
			};
			Object.defineProperty(exports, "ADMISSION_STATES", { enumerable: true, get: () => ADMISSION_STATES });
			/** Every admission state value, for membership checks. */
			const ADMISSION_STATE_VALUES = Object.values(ADMISSION_STATES);
			Object.defineProperty(exports, "ADMISSION_STATE_VALUES", { enumerable: true, get: () => ADMISSION_STATE_VALUES });
			/** Is `value` one of the four frozen admission states? */
			function isAdmissionState(value) {
			    return typeof value === 'string' && ADMISSION_STATE_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isAdmissionState", { enumerable: true, get: () => isAdmissionState });
			/**
			 * Parse an admission state field from an untrusted value.
			 * @throws `MALFORMED_DTO` when the value is not a frozen admission state.
			 */
			function parseAdmissionStateField(raw, field) {
			    if (!isAdmissionState(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be one of ${ADMISSION_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseAdmissionStateField", { enumerable: true, get: () => parseAdmissionStateField });
			// --- residency (UI §24) -----------------------------------------------------------
			/** The three frozen agent-residency states of the live overlay (UI §24). */
			const RESIDENCY_STATES = {
			    /** The agent runtime is resident in memory. */
			    resident: 'resident',
			    /** The agent runtime is not resident; state is durable and restorable. */
			    cold: 'cold',
			    /** A cold agent is being resumed. */
			    resuming: 'resuming',
			};
			Object.defineProperty(exports, "RESIDENCY_STATES", { enumerable: true, get: () => RESIDENCY_STATES });
			/** Every residency state value, for membership checks. */
			const RESIDENCY_STATE_VALUES = Object.values(RESIDENCY_STATES);
			Object.defineProperty(exports, "RESIDENCY_STATE_VALUES", { enumerable: true, get: () => RESIDENCY_STATE_VALUES });
			/** Is `value` one of the three frozen residency states? */
			function isResidencyState(value) {
			    return typeof value === 'string' && RESIDENCY_STATE_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isResidencyState", { enumerable: true, get: () => isResidencyState });
			/**
			 * Parse a residency state field from an untrusted value.
			 * @throws `MALFORMED_DTO` when the value is not a frozen residency state.
			 */
			function parseResidencyStateField(raw, field) {
			    if (!isResidencyState(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be one of ${RESIDENCY_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseResidencyStateField", { enumerable: true, get: () => parseResidencyStateField });
			// --- template kind (Architecture §6.1) ----------------------------------------------
			/** The two frozen template kinds of a TeamBlueprint (Architecture §6.1). */
			const TEMPLATE_KINDS = {
			    /** The single LeaderTemplate of the blueprint (invariant 13). */
			    leader: 'leader',
			    /** A MemberTemplate producing 0..N MemberInstances (invariant 17). */
			    member: 'member',
			};
			Object.defineProperty(exports, "TEMPLATE_KINDS", { enumerable: true, get: () => TEMPLATE_KINDS });
			/** Every template kind value, for membership checks. */
			const TEMPLATE_KIND_VALUES = Object.values(TEMPLATE_KINDS);
			Object.defineProperty(exports, "TEMPLATE_KIND_VALUES", { enumerable: true, get: () => TEMPLATE_KIND_VALUES });
			/** Is `value` one of the two frozen template kinds? */
			function isTemplateKind(value) {
			    return typeof value === 'string' && TEMPLATE_KIND_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isTemplateKind", { enumerable: true, get: () => isTemplateKind });
			/**
			 * Parse a template kind field from an untrusted value.
			 * @throws `MALFORMED_DTO` when the value is not a frozen template kind.
			 */
			function parseTemplateKindField(raw, field) {
			    if (!isTemplateKind(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be one of ${TEMPLATE_KIND_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseTemplateKindField", { enumerable: true, get: () => parseTemplateKindField });
			// --- context policy (Architecture §11; invariant 29) --------------------------------
			/** The two frozen context policies, frozen at instance creation (invariant 29). */
			const CONTEXT_POLICIES = {
			    /** The member context persists across delegations. */
			    persistent: 'persistent',
			    /** Each delegation starts a fresh context. */
			    fresh_per_delegation: 'fresh_per_delegation',
			};
			Object.defineProperty(exports, "CONTEXT_POLICIES", { enumerable: true, get: () => CONTEXT_POLICIES });
			/** Every context policy value, for membership checks. */
			const CONTEXT_POLICY_VALUES = Object.values(CONTEXT_POLICIES);
			Object.defineProperty(exports, "CONTEXT_POLICY_VALUES", { enumerable: true, get: () => CONTEXT_POLICY_VALUES });
			/** Is `value` one of the two frozen context policies? */
			function isContextPolicy(value) {
			    return typeof value === 'string' && CONTEXT_POLICY_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isContextPolicy", { enumerable: true, get: () => isContextPolicy });
			/**
			 * Parse a context policy field from an untrusted value.
			 * @throws `MALFORMED_DTO` when the value is not a frozen context policy.
			 */
			function parseContextPolicyField(raw, field) {
			    if (!isContextPolicy(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be one of ${CONTEXT_POLICY_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseContextPolicyField", { enumerable: true, get: () => parseContextPolicyField });
			// --- progress (closed P6-T2 set) ------------------------------------------------------
			/**
			 * The three frozen progress values of a member's current admitted work.
			 * Mirrors the closed P6-T2 admission progress set exactly (no invented
			 * vocabulary); used as the durable activity status.
			 */
			const PROGRESS_VALUES = ['in-progress', 'completed', 'blocked'];
			Object.defineProperty(exports, "PROGRESS_VALUES", { enumerable: true, get: () => PROGRESS_VALUES });
			/** Is `value` one of the three frozen progress values? */
			function isProgressValue(value) {
			    return typeof value === 'string' && PROGRESS_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isProgressValue", { enumerable: true, get: () => isProgressValue });
			/**
			 * Parse a progress value field from an untrusted value.
			 * @throws `MALFORMED_DTO` when the value is not a frozen progress value.
			 */
			function parseProgressValueField(raw, field) {
			    if (!isProgressValue(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be one of ${PROGRESS_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseProgressValueField", { enumerable: true, get: () => parseProgressValueField });
			// --- ledger category (UI §27.4) -------------------------------------------------------
			/**
			 * The eight frozen TeamLedger filter categories (UI §27.4). The projection
			 * carries the per-category summary only (ledger.ts); the ledger entries
			 * themselves are TeamDomain facts (invariant 41) and never projection fields.
			 */
			const LEDGER_CATEGORIES = {
			    /** Team-level lifecycle facts (creation, admission, handoff, archive). */
			    team: 'team',
			    /** Member lifecycle facts (creation, settle, archive, dispose). */
			    member: 'member',
			    /** Lifecycle transition entries. */
			    lifecycle: 'lifecycle',
			    /** Message routing entries. */
			    message: 'message',
			    /** Control request / decision entries. */
			    control: 'control',
			    /** Policy state and override entries (UI "Policy / Overrides" filter). */
			    policy: 'policy',
			    /** Compatibility probe / drift / acknowledgement entries. */
			    compatibility: 'compatibility',
			    /** Progress entries. */
			    progress: 'progress',
			};
			Object.defineProperty(exports, "LEDGER_CATEGORIES", { enumerable: true, get: () => LEDGER_CATEGORIES });
			/** Every ledger category value, for membership checks. */
			const LEDGER_CATEGORY_VALUES = Object.values(LEDGER_CATEGORIES);
			Object.defineProperty(exports, "LEDGER_CATEGORY_VALUES", { enumerable: true, get: () => LEDGER_CATEGORY_VALUES });
			/** Is `value` one of the eight frozen ledger categories? */
			function isLedgerCategory(value) {
			    return typeof value === 'string' && LEDGER_CATEGORY_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isLedgerCategory", { enumerable: true, get: () => isLedgerCategory });
			/**
			 * Parse a ledger category field from an untrusted value.
			 * @throws `MALFORMED_DTO` when the value is not a frozen ledger category.
			 */
			function parseLedgerCategoryField(raw, field) {
			    if (!isLedgerCategory(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be one of ${LEDGER_CATEGORY_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseLedgerCategoryField", { enumerable: true, get: () => parseLedgerCategoryField });
			//# sourceMappingURL=states.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/effective-config.js"] = { done: false, fn: function (exports) {
			const __imp29 = __req("../../contracts/src/dto/common.js");
			const LABEL_MAX_LENGTH = __imp29.LABEL_MAX_LENGTH;
			const assertFieldPresent = __imp29.assertFieldPresent;
			const assertNoUnknownFields = __imp29.assertNoUnknownFields;
			const assertPlainRecord = __imp29.assertPlainRecord;
			const parseLabelLikeField = __imp29.parseLabelLikeField;
			const __imp30 = __req("../../contracts/src/ids/common.js");
			const hasControlChars = __imp30.hasControlChars;
			const __imp31 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp31.teamContractError;
			const __imp32 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp32.deepFreeze;
			/**
			 * EffectiveConfigEntry / EffectiveConfigDto — the per-member effective
			 * configuration view of the projection (UI §18.2 example: Model, Workspace,
			 * Bash/Web permission rows, Autonomy overlay — each with provenance).
			 *
			 * Design facts (frozen 20260829 plan docs):
			 *
			 * - Every effective value carries its RESOLVED provenance: `source` (which
			 *   factor of the §19.6 effective-policy intersection produced it) and
			 *   `state` (the frozen UI §18.3 state of the value). The projection is a
			 *   VIEW: it carries the resolved result, never the resolver.
			 * - `value` is an opaque display string, or `null` when the factor produced
			 *   no value (e.g. a denied permission: source + state are meaningful, the
			 *   value is absent as null — never as an absent key: `value` is a required
			 *   key of the entry).
			 * - `permissions` is the map lane: permission name -> entry. Keys are
			 *   validated opaque names (non-empty, <= 128, no control characters); the
			 *   map may be empty.
			 * - The four lanes model / workspace / permissions / autonomy cover the
			 *   §18.2 example exactly; adding a lane is a projection contract change
			 *   (a new schema version), never a silent field addition.
			 *
			 * Both types are embedded values: the enclosing versioned record owns the
			 * schema version, so neither carries one of its own (same discipline as
			 * BlueprintSnapshotRef).
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/effective-config
			 */
			/** Max length of an opaque effective-config value (display string). */
			const EFFECTIVE_CONFIG_VALUE_MAX_LENGTH = 512;
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_VALUE_MAX_LENGTH", { enumerable: true, get: () => EFFECTIVE_CONFIG_VALUE_MAX_LENGTH });
			// --- source vocabulary -----------------------------------------------------------
			/**
			 * The frozen sources of an effective configuration value: the factors of
			 * the §19.6 effective-policy intersection, in the order the UI §18.2
			 * example renders them.
			 */
			const EFFECTIVE_CONFIG_SOURCES = {
			    /** Inherited from the bound blueprint snapshot. */
			    blueprint: 'blueprint',
			    /** Set by the member's template. */
			    member_template: 'member-template',
			    /** Set at instance creation (e.g. the locked workspace). */
			    instance_creation: 'instance-creation',
			    /** Resolved by the current PolicyState. */
			    policy_state: 'policy-state',
			    /** Resolved by the autonomy overlay. */
			    autonomy_overlay: 'autonomy-overlay',
			    /** Set by an explicit human override. */
			    explicit_human_override: 'explicit-human-override',
			    /** Set by an external hard policy (winning over every Team factor). */
			    external_hard_policy: 'external-hard-policy',
			    /** Resolved from the runtime capability set (e.g. model availability). */
			    capability: 'capability',
			};
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_SOURCES", { enumerable: true, get: () => EFFECTIVE_CONFIG_SOURCES });
			/** Every source value, for membership checks. */
			const EFFECTIVE_CONFIG_SOURCE_VALUES = Object.values(EFFECTIVE_CONFIG_SOURCES);
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_SOURCE_VALUES", { enumerable: true, get: () => EFFECTIVE_CONFIG_SOURCE_VALUES });
			/** Is `value` one of the frozen effective-config sources? */
			function isEffectiveConfigSource(value) {
			    return typeof value === 'string' && EFFECTIVE_CONFIG_SOURCE_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isEffectiveConfigSource", { enumerable: true, get: () => isEffectiveConfigSource });
			/**
			 * Parse an effective-config source field from an untrusted value.
			 * @throws `MALFORMED_DTO` when the value is not a frozen source.
			 */
			function parseEffectiveConfigSourceField(raw, field) {
			    if (!isEffectiveConfigSource(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be one of ${EFFECTIVE_CONFIG_SOURCE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseEffectiveConfigSourceField", { enumerable: true, get: () => parseEffectiveConfigSourceField });
			// --- state vocabulary (UI §18.3) ----------------------------------------------------
			/** The frozen states of an effective configuration value (UI §18.3). */
			const EFFECTIVE_CONFIG_STATES = {
			    /** The value flows from the inherited source unmodified. */
			    inherited: 'inherited',
			    /** The value was overridden by a closer source. */
			    overridden: 'overridden',
			    /** The value is suppressed (hidden from the effective set). */
			    suppressed: 'suppressed',
			    /** The value is currently unavailable (source not resolvable). */
			    unavailable: 'unavailable',
			    /** The value is denied by a winning policy factor. */
			    denied: 'denied',
			    /** The value is locked (e.g. the workspace after first run). */
			    locked: 'locked',
			    /** The change is accepted but applies at the next boundary. */
			    pending_next_boundary: 'pending-next-boundary',
			    /** The value is degraded (operating with reduced capability). */
			    degraded: 'degraded',
			};
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_STATES", { enumerable: true, get: () => EFFECTIVE_CONFIG_STATES });
			/** Every state value, for membership checks. */
			const EFFECTIVE_CONFIG_STATE_VALUES = Object.values(EFFECTIVE_CONFIG_STATES);
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_STATE_VALUES", { enumerable: true, get: () => EFFECTIVE_CONFIG_STATE_VALUES });
			/** Is `value` one of the frozen effective-config states? */
			function isEffectiveConfigState(value) {
			    return typeof value === 'string' && EFFECTIVE_CONFIG_STATE_VALUES.includes(value);
			}
			Object.defineProperty(exports, "isEffectiveConfigState", { enumerable: true, get: () => isEffectiveConfigState });
			/**
			 * Parse an effective-config state field from an untrusted value.
			 * @throws `MALFORMED_DTO` when the value is not a frozen state.
			 */
			function parseEffectiveConfigStateField(raw, field) {
			    if (!isEffectiveConfigState(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be one of ${EFFECTIVE_CONFIG_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseEffectiveConfigStateField", { enumerable: true, get: () => parseEffectiveConfigStateField });
			// --- entry -------------------------------------------------------------------------
			/** The exact frozen fields of an EffectiveConfigEntry. */
			const EFFECTIVE_CONFIG_ENTRY_FIELDS = ['value', 'source', 'state'];
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_ENTRY_FIELDS", { enumerable: true, get: () => EFFECTIVE_CONFIG_ENTRY_FIELDS });
			/**
			 * The exact frozen fields of an EffectiveConfigEntry under projection v2
			 * (S7-R2, repair R2-2): the v1 core plus the ADDITIVE optional
			 * provenance fields (UI §18.1: `suppressed?`, `unavailable?`, `deniedBy?`,
			 * "when change takes effect" = `effectiveFrom`, plus `locked?`). Every
			 * additive field is DURATIONAL-optional: the KEY is absent when the fact
			 * does not hold (never an own `undefined` key). v1 records remain valid
			 * through the v1 field set above.
			 */
			const EFFECTIVE_CONFIG_ENTRY_FIELDS_V2 = [
			    'value',
			    'source',
			    'state',
			    'suppressed',
			    'unavailable',
			    'deniedBy',
			    'effectiveFrom',
			    'locked',
			];
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_ENTRY_FIELDS_V2", { enumerable: true, get: () => EFFECTIVE_CONFIG_ENTRY_FIELDS_V2 });
			/** Max length of the v2 `deniedBy` provenance string (opaque reason). */
			const EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH = 128;
			Object.defineProperty(exports, "EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH", { enumerable: true, get: () => EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH });
			/**
			 * Parse and validate an EffectiveConfigEntry from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen entry.
			 * @throws `MALFORMED_DTO` for a malformed container, field set, or value.
			 */
			function parseEffectiveConfigEntry(value, schemaVersion = 1) {
			    const record = assertPlainRecord(value, 'EffectiveConfigEntry');
			    if (schemaVersion === 2) {
			        assertNoUnknownFields(record, EFFECTIVE_CONFIG_ENTRY_FIELDS_V2, 'EffectiveConfigEntry');
			        for (const field of EFFECTIVE_CONFIG_ENTRY_FIELDS) {
			            assertFieldPresent(record, field, 'EffectiveConfigEntry');
			        }
			    }
			    else {
			        // v1 path — byte-identical frozen behavior (P8-T1).
			        assertNoUnknownFields(record, EFFECTIVE_CONFIG_ENTRY_FIELDS, 'EffectiveConfigEntry');
			        for (const field of EFFECTIVE_CONFIG_ENTRY_FIELDS) {
			            assertFieldPresent(record, field, 'EffectiveConfigEntry');
			        }
			    }
			    const rawValue = record['value'];
			    let parsedValue;
			    if (rawValue === null) {
			        parsedValue = null;
			    }
			    else {
			        if (typeof rawValue !== 'string' ||
			            rawValue.length === 0 ||
			            rawValue.length > EFFECTIVE_CONFIG_VALUE_MAX_LENGTH ||
			            hasControlChars(rawValue)) {
			            throw teamContractError('MALFORMED_DTO', `EffectiveConfigEntry value must be null or a non-empty string of at most ${EFFECTIVE_CONFIG_VALUE_MAX_LENGTH} chars without control characters`, { field: 'value' });
			        }
			        parsedValue = rawValue;
			    }
			    const core = {
			        value: parsedValue,
			        source: parseEffectiveConfigSourceField(record['source'], 'source'),
			        state: parseEffectiveConfigStateField(record['state'], 'state'),
			    };
			    if (schemaVersion === 2) {
			        // The additive v2 provenance fields (all DURATIONAL-optional).
			        let suppressed;
			        if (record['suppressed'] !== undefined) {
			            if (typeof record['suppressed'] !== 'boolean') {
			                throw teamContractError('MALFORMED_DTO', 'EffectiveConfigEntry suppressed must be a boolean', { field: 'suppressed' });
			            }
			            suppressed = record['suppressed'];
			        }
			        let unavailable;
			        if (record['unavailable'] !== undefined) {
			            if (typeof record['unavailable'] !== 'boolean') {
			                throw teamContractError('MALFORMED_DTO', 'EffectiveConfigEntry unavailable must be a boolean', { field: 'unavailable' });
			            }
			            unavailable = record['unavailable'];
			        }
			        let deniedBy;
			        if (record['deniedBy'] !== undefined) {
			            const rawDeniedBy = record['deniedBy'];
			            if (typeof rawDeniedBy !== 'string' ||
			                rawDeniedBy.length === 0 ||
			                rawDeniedBy.length > EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH ||
			                hasControlChars(rawDeniedBy)) {
			                throw teamContractError('MALFORMED_DTO', `EffectiveConfigEntry deniedBy must be a non-empty string of at most ${EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH} chars without control characters`, { field: 'deniedBy' });
			            }
			            deniedBy = rawDeniedBy;
			        }
			        let effectiveFrom;
			        if (record['effectiveFrom'] !== undefined) {
			            const rawEffectiveFrom = record['effectiveFrom'];
			            if (typeof rawEffectiveFrom !== 'number' ||
			                !Number.isSafeInteger(rawEffectiveFrom) ||
			                rawEffectiveFrom < 1) {
			                throw teamContractError('MALFORMED_DTO', 'EffectiveConfigEntry effectiveFrom must be a safe integer >= 1', { field: 'effectiveFrom' });
			            }
			            effectiveFrom = rawEffectiveFrom;
			        }
			        let locked;
			        if (record['locked'] !== undefined) {
			            if (typeof record['locked'] !== 'boolean') {
			                throw teamContractError('MALFORMED_DTO', 'EffectiveConfigEntry locked must be a boolean', { field: 'locked' });
			            }
			            locked = record['locked'];
			        }
			        return deepFreeze({
			            ...core,
			            ...(suppressed !== undefined ? { suppressed } : {}),
			            ...(unavailable !== undefined ? { unavailable } : {}),
			            ...(deniedBy !== undefined ? { deniedBy } : {}),
			            ...(effectiveFrom !== undefined ? { effectiveFrom } : {}),
			            ...(locked !== undefined ? { locked } : {}),
			        });
			    }
			    return deepFreeze(core);
			}
			// --- the four-lane container ----------------------------------------------------------
			/** The exact frozen lanes of an EffectiveConfigDto (UI §18.2 example). */
			export const EFFECTIVE_CONFIG_FIELDS = [
			    'model',
			    'workspace',
			    'permissions',
			    'autonomy',
			];
			/**
			 * Parse and validate an EffectiveConfigDto from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen effective config.
			 * @throws `MALFORMED_DTO` for a malformed container, lane set, permission
			 *   key, or entry.
			 */
			export function parseEffectiveConfigDto(value, schemaVersion = 1) {
			    const record = assertPlainRecord(value, 'EffectiveConfig');
			    assertNoUnknownFields(record, EFFECTIVE_CONFIG_FIELDS, 'EffectiveConfig');
			    for (const field of EFFECTIVE_CONFIG_FIELDS) {
			        assertFieldPresent(record, field, 'EffectiveConfig');
			    }
			    const permissionsRecord = assertPlainRecord(record['permissions'], 'EffectiveConfig.permissions');
			    const permissions = {};
			    for (const name of Object.keys(permissionsRecord)) {
			        parseLabelLikeField(name, `permissions['${name}']`, LABEL_MAX_LENGTH);
			        permissions[name] = parseEffectiveConfigEntry(permissionsRecord[name], schemaVersion);
			    }
			    return deepFreeze({
			        model: parseEffectiveConfigEntry(record['model'], schemaVersion),
			        workspace: parseEffectiveConfigEntry(record['workspace'], schemaVersion),
			        permissions,
			        autonomy: parseEffectiveConfigEntry(record['autonomy'], schemaVersion),
			    });
			}
			//# sourceMappingURL=effective-config.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/compatibility.js"] = { done: false, fn: function (exports) {
			const __imp28 = __req("../../contracts/src/dto/common.js");
			const assertFieldPresent = __imp28.assertFieldPresent;
			const assertNoUnknownFields = __imp28.assertNoUnknownFields;
			const assertPlainRecord = __imp28.assertPlainRecord;
			const parseIso8601TimestampField = __imp28.parseIso8601TimestampField;
			const __imp29 = __req("../../contracts/src/ids/common.js");
			const assertPositiveInteger = __imp29.assertPositiveInteger;
			const __imp30 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp30.teamContractError;
			const __imp31 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp31.deepFreeze;
			const __imp32 = __req("../../contracts/src/projection/common.js");
			const parseOpaqueField = __imp32.parseOpaqueField;
			const assertNonNegativeInteger = __imp32.assertNonNegativeInteger;
			const __imp33 = __req("../../contracts/src/projection/states.js");
			const parseAdmissionStateField = __imp33.parseAdmissionStateField;
			/**
			 * CompatibilitySummaryDto — the TeamSession compatibility/admission summary
			 * carried by the projection root (UI §18.1 admission + compatibility card).
			 *
			 * Design facts (frozen 20260829 plan docs):
			 *
			 * - `status` is the frozen four-state admission vocabulary (Architecture
			 *   §28, states.ts): the compatibility card of the UI is a rendering of
			 *   the same state — no second vocabulary.
			 * - `probeGeneration` is the P7-T1 compatibility probe generation: a
			 *   monotonically increasing positive integer (the projection itself is
			 *   re-stamped with its own generation; the probe generation records the
			 *   probe facts the summary was built from).
			 * - The two fingerprints are opaque strings (requirement fingerprint of the
			 *   bound blueprint snapshot, environment fingerprint of the probed
			 *   environment): the contract does not interpret them.
			 * - `acknowledgedWarningCount` is bounded by `warningCount` (validated at
			 *   parse: you cannot acknowledge more warnings than exist).
			 * - `lastProbedAt` is a DURATIONAL-optional field: the KEY is absent when
			 *   the summary was built without a probe timestamp (never an own
			 *   `undefined` key).
			 *
			 * The summary is an embedded value: the enclosing projection record owns
			 * the schema version, so the summary carries none of its own.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/compatibility
			 */
			/** Max length of a compatibility fingerprint (opaque string). */
			const COMPATIBILITY_FINGERPRINT_MAX_LENGTH = 128;
			Object.defineProperty(exports, "COMPATIBILITY_FINGERPRINT_MAX_LENGTH", { enumerable: true, get: () => COMPATIBILITY_FINGERPRINT_MAX_LENGTH });
			/** The exact frozen fields of a CompatibilitySummaryDto. */
			const COMPATIBILITY_SUMMARY_FIELDS = [
			    'status',
			    'probeGeneration',
			    'requirementFingerprint',
			    'environmentFingerprint',
			    'warningCount',
			    'fatalCount',
			    'acknowledgedWarningCount',
			    'lastProbedAt',
			];
			Object.defineProperty(exports, "COMPATIBILITY_SUMMARY_FIELDS", { enumerable: true, get: () => COMPATIBILITY_SUMMARY_FIELDS });
			/**
			 * Parse and validate a CompatibilitySummaryDto from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen summary.
			 * @throws `MALFORMED_DTO` for a malformed container, field set, field value,
			 *   or a `acknowledgedWarningCount > warningCount` violation.
			 */
			function parseCompatibilitySummary(value) {
			    const record = assertPlainRecord(value, 'CompatibilitySummary');
			    assertNoUnknownFields(record, COMPATIBILITY_SUMMARY_FIELDS, 'CompatibilitySummary');
			    for (const field of COMPATIBILITY_SUMMARY_FIELDS) {
			        if (field !== 'lastProbedAt') {
			            assertFieldPresent(record, field, 'CompatibilitySummary');
			        }
			    }
			    const status = parseAdmissionStateField(record['status'], 'status');
			    const probeGeneration = assertPositiveInteger(record['probeGeneration'], 'probeGeneration');
			    const warningCount = assertNonNegativeInteger(record['warningCount'], 'warningCount');
			    const fatalCount = assertNonNegativeInteger(record['fatalCount'], 'fatalCount');
			    const acknowledgedWarningCount = assertNonNegativeInteger(record['acknowledgedWarningCount'], 'acknowledgedWarningCount');
			    if (acknowledgedWarningCount > warningCount) {
			        throw teamContractError('MALFORMED_DTO', `acknowledgedWarningCount (${acknowledgedWarningCount}) must not exceed warningCount (${warningCount})`, { reason: 'ACKNOWLEDGED_COUNT_EXCEEDS_WARNING_COUNT' });
			    }
			    const base = {
			        status,
			        probeGeneration,
			        requirementFingerprint: parseOpaqueField(record['requirementFingerprint'], 'requirementFingerprint', COMPATIBILITY_FINGERPRINT_MAX_LENGTH),
			        environmentFingerprint: parseOpaqueField(record['environmentFingerprint'], 'environmentFingerprint', COMPATIBILITY_FINGERPRINT_MAX_LENGTH),
			        warningCount,
			        fatalCount,
			        acknowledgedWarningCount,
			    };
			    return deepFreeze(record['lastProbedAt'] === undefined
			        ? base
			        : {
			            ...base,
			            lastProbedAt: parseIso8601TimestampField(record['lastProbedAt']),
			        });
			}
			Object.defineProperty(exports, "parseCompatibilitySummary", { enumerable: true, get: () => parseCompatibilitySummary });
			//# sourceMappingURL=compatibility.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/activity.js"] = { done: false, fn: function (exports) {
			const __imp29 = __req("../../contracts/src/dto/common.js");
			const assertNoUnknownFields = __imp29.assertNoUnknownFields;
			const assertPlainRecord = __imp29.assertPlainRecord;
			const parseIso8601TimestampField = __imp29.parseIso8601TimestampField;
			const __imp30 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp30.teamContractError;
			const __imp31 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp31.deepFreeze;
			const __imp32 = __req("../../contracts/src/projection/common.js");
			const parseOpaqueField = __imp32.parseOpaqueField;
			const __imp33 = __req("../../contracts/src/projection/states.js");
			const parseProgressValueField = __imp33.parseProgressValueField;
			const parseResidencyStateField = __imp33.parseResidencyStateField;
			/**
			 * Activity DTOs of the projection family (P8-T1): the durable per-member
			 * activity summary and the per-member LIVE activity overlay.
			 *
			 * Design facts (frozen 20260829 plan docs):
			 *
			 * - The Durable side (MemberActivitySummaryDto) is a summary of TeamDomain
			 *   activity facts (invariant 41): status (the closed P6-T2 progress set),
			 *   subject/summary/lastAction text, correlation id, last progress
			 *   timestamp, and the open live-work intervals. Every field is a
			 *   DURATIONAL-optional field: absent key when the durable fact does not
			 *   exist (never an own `undefined` key). A member with no durable activity
			 *   facts omits the whole `activity` key on its member projection.
			 * - The Live side (MemberLiveActivityDto) is the non-durable overlay of the
			 *   current page state (UI §24 residency + current turn activity): it is
			 *   ALWAYS the present key `liveActivity` on the member projection, with
			 *   value `null` when the live source has no facts for that member (the
			 *   nullable overlay, DevPlan §21.2). Residency is the one required field:
			 *   a present overlay always says where the agent lives.
			 * - The projection NEVER carries session-log facts: activity here is a
			 *   TeamDomain summary, never a scan of Root+child Session logs (DevPlan
			 *   §21.2).
			 *
			 * Both types are embedded values: the enclosing versioned record owns the
			 * schema version, so neither carries one of its own.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/activity
			 */
			/** Max length of an activity correlation id (opaque string). */
			const ACTIVITY_CORRELATION_MAX_LENGTH = 128;
			Object.defineProperty(exports, "ACTIVITY_CORRELATION_MAX_LENGTH", { enumerable: true, get: () => ACTIVITY_CORRELATION_MAX_LENGTH });
			/** Max length of an activity text field (subject, lastAction, currentAction). */
			const ACTIVITY_TEXT_MAX_LENGTH = 256;
			Object.defineProperty(exports, "ACTIVITY_TEXT_MAX_LENGTH", { enumerable: true, get: () => ACTIVITY_TEXT_MAX_LENGTH });
			/** Max length of an activity summary field. */
			const ACTIVITY_SUMMARY_MAX_LENGTH = 512;
			Object.defineProperty(exports, "ACTIVITY_SUMMARY_MAX_LENGTH", { enumerable: true, get: () => ACTIVITY_SUMMARY_MAX_LENGTH });
			// --- open work interval ----------------------------------------------------------------
			/** The exact frozen fields of an ActivityIntervalSummary. */
			const ACTIVITY_INTERVAL_FIELDS = ['correlation', 'openedAt'];
			Object.defineProperty(exports, "ACTIVITY_INTERVAL_FIELDS", { enumerable: true, get: () => ACTIVITY_INTERVAL_FIELDS });
			/**
			 * Parse and validate an ActivityIntervalSummary from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen interval summary.
			 * @throws `MALFORMED_DTO` for a malformed container, field set, or value.
			 */
			function parseActivityInterval(value) {
			    const record = assertPlainRecord(value, 'ActivityInterval');
			    assertNoUnknownFields(record, ACTIVITY_INTERVAL_FIELDS, 'ActivityInterval');
			    return deepFreeze({
			        correlation: parseOpaqueField(record['correlation'], 'correlation', ACTIVITY_CORRELATION_MAX_LENGTH),
			        openedAt: parseIso8601TimestampField(record['openedAt']),
			    });
			}
			Object.defineProperty(exports, "parseActivityInterval", { enumerable: true, get: () => parseActivityInterval });
			// --- durable activity summary ---------------------------------------------------------
			/** The exact frozen fields of a MemberActivitySummaryDto (all optional). */
			const MEMBER_ACTIVITY_SUMMARY_FIELDS = [
			    'status',
			    'subject',
			    'summary',
			    'lastAction',
			    'correlation',
			    'lastProgressAt',
			    'openIntervals',
			];
			Object.defineProperty(exports, "MEMBER_ACTIVITY_SUMMARY_FIELDS", { enumerable: true, get: () => MEMBER_ACTIVITY_SUMMARY_FIELDS });
			/**
			 * Parse and validate a MemberActivitySummaryDto from an untrusted value.
			 * All fields are optional; a present field must be valid.
			 * @param value - the unknown input.
			 * @returns the frozen summary (possibly empty).
			 * @throws `MALFORMED_DTO` for a malformed container, unknown field, or
			 *   invalid present field.
			 */
			function parseMemberActivitySummary(value) {
			    const record = assertPlainRecord(value, 'MemberActivitySummary');
			    assertNoUnknownFields(record, MEMBER_ACTIVITY_SUMMARY_FIELDS, 'MemberActivitySummary');
			    const status = record['status'] === undefined
			        ? {}
			        : { status: parseProgressValueField(record['status'], 'status') };
			    const subject = record['subject'] === undefined
			        ? {}
			        : { subject: parseOpaqueField(record['subject'], 'subject', ACTIVITY_TEXT_MAX_LENGTH) };
			    const summary = record['summary'] === undefined
			        ? {}
			        : { summary: parseOpaqueField(record['summary'], 'summary', ACTIVITY_SUMMARY_MAX_LENGTH) };
			    const lastAction = record['lastAction'] === undefined
			        ? {}
			        : { lastAction: parseOpaqueField(record['lastAction'], 'lastAction', ACTIVITY_TEXT_MAX_LENGTH) };
			    const correlation = record['correlation'] === undefined
			        ? {}
			        : {
			            correlation: parseOpaqueField(record['correlation'], 'correlation', ACTIVITY_CORRELATION_MAX_LENGTH),
			        };
			    const lastProgressAt = record['lastProgressAt'] === undefined
			        ? {}
			        : { lastProgressAt: parseIso8601TimestampField(record['lastProgressAt']) };
			    let openIntervals = {};
			    if (record['openIntervals'] !== undefined) {
			        if (!Array.isArray(record['openIntervals'])) {
			            throw teamContractError('MALFORMED_DTO', `openIntervals must be an array, got ${typeof record['openIntervals']}`, { field: 'openIntervals' });
			        }
			        openIntervals = {
			            openIntervals: record['openIntervals'].map((item) => parseActivityInterval(item)),
			        };
			    }
			    return deepFreeze({ ...status, ...subject, ...summary, ...lastAction, ...correlation, ...lastProgressAt, ...openIntervals });
			}
			Object.defineProperty(exports, "parseMemberActivitySummary", { enumerable: true, get: () => parseMemberActivitySummary });
			// --- live activity overlay --------------------------------------------------------------
			/** The exact frozen fields of a MemberLiveActivityDto (residency required). */
			const MEMBER_LIVE_ACTIVITY_FIELDS = [
			    'residency',
			    'currentAction',
			    'lastActivityAt',
			    'runningSince',
			    'admittedWorkCorrelation',
			];
			Object.defineProperty(exports, "MEMBER_LIVE_ACTIVITY_FIELDS", { enumerable: true, get: () => MEMBER_LIVE_ACTIVITY_FIELDS });
			/**
			 * Parse and validate a MemberLiveActivityDto from an untrusted value.
			 * `residency` is required; the rest are optional live facts.
			 * @param value - the unknown input.
			 * @returns the frozen live overlay.
			 * @throws `MALFORMED_DTO` for a malformed container, unknown field, missing
			 *   residency, or invalid field.
			 */
			function parseMemberLiveActivity(value) {
			    const record = assertPlainRecord(value, 'MemberLiveActivity');
			    assertNoUnknownFields(record, MEMBER_LIVE_ACTIVITY_FIELDS, 'MemberLiveActivity');
			    const base = {
			        residency: parseResidencyStateField(record['residency'], 'residency'),
			    };
			    const currentAction = record['currentAction'] === undefined
			        ? {}
			        : { currentAction: parseOpaqueField(record['currentAction'], 'currentAction', ACTIVITY_TEXT_MAX_LENGTH) };
			    const lastActivityAt = record['lastActivityAt'] === undefined
			        ? {}
			        : { lastActivityAt: parseIso8601TimestampField(record['lastActivityAt']) };
			    const runningSince = record['runningSince'] === undefined
			        ? {}
			        : { runningSince: parseIso8601TimestampField(record['runningSince']) };
			    const admittedWorkCorrelation = record['admittedWorkCorrelation'] === undefined
			        ? {}
			        : {
			            admittedWorkCorrelation: parseOpaqueField(record['admittedWorkCorrelation'], 'admittedWorkCorrelation', ACTIVITY_CORRELATION_MAX_LENGTH),
			        };
			    return deepFreeze({ ...base, ...currentAction, ...lastActivityAt, ...runningSince, ...admittedWorkCorrelation });
			}
			Object.defineProperty(exports, "parseMemberLiveActivity", { enumerable: true, get: () => parseMemberLiveActivity });
			//# sourceMappingURL=activity.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/template.js"] = { done: false, fn: function (exports) {
			const __imp24 = __req("../../contracts/src/dto/common.js");
			const LABEL_MAX_LENGTH = __imp24.LABEL_MAX_LENGTH;
			const assertFieldPresent = __imp24.assertFieldPresent;
			const assertNoUnknownFields = __imp24.assertNoUnknownFields;
			const assertPlainRecord = __imp24.assertPlainRecord;
			const parseLabelLikeField = __imp24.parseLabelLikeField;
			const __imp25 = __req("../../contracts/src/ids/template-id.js");
			const parseTemplateId = __imp25.parseTemplateId;
			const __imp26 = __req("../../contracts/src/ids/common.js");
			const assertPositiveInteger = __imp26.assertPositiveInteger;
			const __imp27 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp27.assertNoLegacyFields;
			const __imp28 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp28.deepFreeze;
			const __imp29 = __req("../../contracts/src/projection/states.js");
			const parseTemplateKindField = __imp29.parseTemplateKindField;
			const parseContextPolicyField = __imp29.parseContextPolicyField;
			/**
			 * TemplateProjectionDto — the projection row of one LeaderTemplate or
			 * MemberTemplate of the bound blueprint snapshot (Architecture §6.1).
			 *
			 * Design facts (frozen 20260829 plan docs):
			 *
			 * - A projection carries the templates of its bound snapshot verbatim by
			 *   identity (`kind` + `templateId`); the enclosing projection references
			 *   the immutable snapshot (invariant 10), so template content is never
			 *   duplicated here — the row is a THIN identity + display record: counts
			 *   (0..N instances per template, invariant 17) are derived by the client
			 *   from the members array, never stored.
			 * - `contextPolicy` is the frozen-at-creation policy of the template
			 *   (invariant 29): instances inherit it and may override at creation; the
			 *   member projection carries the EFFECTIVE per-instance value.
			 * - `instanceQuota` is a template-level cap (>= 1) when the blueprint
			 *   defines one; key absent when the template has no cap.
			 *
			 * The template row is an embedded value: the enclosing versioned record
			 * owns the schema version, so the row carries none of its own.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/template
			 */
			/** Max length of a template description. */
			const TEMPLATE_DESCRIPTION_MAX_LENGTH = 512;
			Object.defineProperty(exports, "TEMPLATE_DESCRIPTION_MAX_LENGTH", { enumerable: true, get: () => TEMPLATE_DESCRIPTION_MAX_LENGTH });
			/** The exact frozen fields of a TemplateProjectionDto. */
			const TEMPLATE_PROJECTION_FIELDS = [
			    'kind',
			    'templateId',
			    'displayName',
			    'description',
			    'contextPolicy',
			    'instanceQuota',
			];
			Object.defineProperty(exports, "TEMPLATE_PROJECTION_FIELDS", { enumerable: true, get: () => TEMPLATE_PROJECTION_FIELDS });
			function validateTemplateProjection(record) {
			    assertNoLegacyFields(record, 'TemplateProjection');
			    assertNoUnknownFields(record, TEMPLATE_PROJECTION_FIELDS, 'TemplateProjection');
			    for (const field of TEMPLATE_PROJECTION_FIELDS) {
			        if (field !== 'description' && field !== 'instanceQuota') {
			            assertFieldPresent(record, field, 'TemplateProjection');
			        }
			    }
			    const base = {
			        kind: parseTemplateKindField(record['kind'], 'kind'),
			        templateId: parseTemplateId(record['templateId']),
			        displayName: parseLabelLikeField(record['displayName'], 'displayName', LABEL_MAX_LENGTH),
			        contextPolicy: parseContextPolicyField(record['contextPolicy'], 'contextPolicy'),
			    };
			    const description = record['description'] === undefined
			        ? {}
			        : {
			            description: parseLabelLikeField(record['description'], 'description', TEMPLATE_DESCRIPTION_MAX_LENGTH),
			        };
			    const instanceQuota = record['instanceQuota'] === undefined
			        ? {}
			        : { instanceQuota: assertPositiveInteger(record['instanceQuota'], 'instanceQuota') };
			    return deepFreeze({ ...base, ...description, ...instanceQuota });
			}
			/**
			 * Parse and validate a TemplateProjectionDto from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen template row.
			 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
			 *   `INVALID_TEMPLATE_ID`, or the field-specific codes.
			 */
			function parseTemplateProjection(value) {
			    return validateTemplateProjection(assertPlainRecord(value, 'TemplateProjection'));
			}
			Object.defineProperty(exports, "parseTemplateProjection", { enumerable: true, get: () => parseTemplateProjection });
			/**
			 * Build a fresh TemplateProjectionDto from producer input (already branded
			 * ids; the input must not carry own `undefined` keys).
			 * @param input - the template fields.
			 * @returns the frozen template row, validated through the same pipeline as
			 *   `parseTemplateProjection`.
			 */
			function createTemplateProjection(input) {
			    const record = {
			        kind: input.kind,
			        templateId: input.templateId,
			        displayName: input.displayName,
			        contextPolicy: input.contextPolicy,
			    };
			    if (input.description !== undefined)
			        record['description'] = input.description;
			    if (input.instanceQuota !== undefined)
			        record['instanceQuota'] = input.instanceQuota;
			    return validateTemplateProjection(record);
			}
			Object.defineProperty(exports, "createTemplateProjection", { enumerable: true, get: () => createTemplateProjection });
			//# sourceMappingURL=template.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/root.js"] = { done: false, fn: function (exports) {
			const __imp31 = __req("../../contracts/src/dto/common.js");
			const LABEL_MAX_LENGTH = __imp31.LABEL_MAX_LENGTH;
			const assertFieldPresent = __imp31.assertFieldPresent;
			const assertNoUnknownFields = __imp31.assertNoUnknownFields;
			const assertPlainRecord = __imp31.assertPlainRecord;
			const parseIso8601TimestampField = __imp31.parseIso8601TimestampField;
			const parseLabelLikeField = __imp31.parseLabelLikeField;
			const parseWorkspaceField = __imp31.parseWorkspaceField;
			const __imp32 = __req("../../contracts/src/ids/session-id.js");
			const parseSessionId = __imp32.parseSessionId;
			const parseTeamSessionId = __imp32.parseTeamSessionId;
			const __imp33 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp33.assertNoLegacyFields;
			const __imp34 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp34.deepFreeze;
			const __imp35 = __req("../../contracts/src/projection/common.js");
			const assertNonNegativeInteger = __imp35.assertNonNegativeInteger;
			const toRecord = __imp35.toRecord;
			const __imp36 = __req("../../contracts/src/projection/compatibility.js");
			const parseCompatibilitySummary = __imp36.parseCompatibilitySummary;
			const __imp37 = __req("../../contracts/src/projection/states.js");
			const parseAdmissionStateField = __imp37.parseAdmissionStateField;
			/**
			 * TeamRootProjectionDto — the TeamSession identity + admission view carried
			 * by the projection root (Architecture §14.3 category A + §28 + §34.1).
			 *
			 * Design facts (frozen 20260829 plan docs):
			 *
			 * - `teamSessionId` IS the root DSH session id (invariant 9); it must equal
			 *   the top-level projection `teamSessionId` (validated by the top-level
			 *   parser).
			 * - **NO lifecycle field** (Architecture §8.6): a TeamSession has no
			 *   Member-style lifecycle; its identity and admission are the frozen root
			 *   facts. The negative surface is asserted by the P8-T1 tests.
			 * - `policyState` is the current PolicyState name: opaque to the contract
			 *   (policy states are blueprint-defined), label-validated only.
			 * - `compatibility` is the frozen CompatibilitySummaryDto (states.ts
			 *   vocabulary for `status`).
			 * - `creationBudgetConsumed` is the count of root creations consumed by
			 *   handoff into this session (>= 0; the handoff rule of Architecture
			 *   §34.1 — a handoff may continue the session only while the budget is not
			 *   exhausted).
			 * - `handoffSourceSessionId` is the generic DSH session id of the session a
			 *   handoff continued from (Architecture §34.1); key absent for a session
			 *   that was created fresh (DURATIONAL-optional discipline: absent key,
			 *   never an own `undefined` key).
			 *
			 * The root is an embedded value: the enclosing versioned record owns the
			 * schema version, so the root carries none of its own.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/root
			 */
			/** The exact frozen fields of a TeamRootProjectionDto. */
			const TEAM_ROOT_PROJECTION_FIELDS = [
			    'teamSessionId',
			    'defaultWorkspace',
			    'createdAt',
			    'policyState',
			    'admission',
			    'compatibility',
			    'creationBudgetConsumed',
			    'handoffSourceSessionId',
			];
			Object.defineProperty(exports, "TEAM_ROOT_PROJECTION_FIELDS", { enumerable: true, get: () => TEAM_ROOT_PROJECTION_FIELDS });
			function validateTeamRootProjection(record) {
			    assertNoLegacyFields(record, 'TeamRootProjection');
			    assertNoUnknownFields(record, TEAM_ROOT_PROJECTION_FIELDS, 'TeamRootProjection');
			    for (const field of TEAM_ROOT_PROJECTION_FIELDS) {
			        if (field !== 'defaultWorkspace' && field !== 'handoffSourceSessionId') {
			            assertFieldPresent(record, field, 'TeamRootProjection');
			        }
			    }
			    const base = {
			        teamSessionId: parseTeamSessionId(record['teamSessionId']),
			        createdAt: parseIso8601TimestampField(record['createdAt']),
			        policyState: parseLabelLikeField(record['policyState'], 'policyState', LABEL_MAX_LENGTH),
			        admission: parseAdmissionStateField(record['admission'], 'admission'),
			        compatibility: parseCompatibilitySummary(record['compatibility']),
			        creationBudgetConsumed: assertNonNegativeInteger(record['creationBudgetConsumed'], 'creationBudgetConsumed'),
			    };
			    const defaultWorkspace = record['defaultWorkspace'] === undefined
			        ? {}
			        : { defaultWorkspace: parseWorkspaceField(record['defaultWorkspace'], 'defaultWorkspace') };
			    const handoffSourceSessionId = record['handoffSourceSessionId'] === undefined
			        ? {}
			        : { handoffSourceSessionId: parseSessionId(record['handoffSourceSessionId']) };
			    return deepFreeze({ ...base, ...defaultWorkspace, ...handoffSourceSessionId });
			}
			/**
			 * Parse and validate a TeamRootProjectionDto from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen root view.
			 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
			 *   `INVALID_ROOT_SESSION_ID`, `INVALID_SESSION_ID`, or the field-specific
			 *   codes of the embedded summary.
			 */
			function parseTeamRootProjection(value) {
			    return validateTeamRootProjection(assertPlainRecord(value, 'TeamRootProjection'));
			}
			Object.defineProperty(exports, "parseTeamRootProjection", { enumerable: true, get: () => parseTeamRootProjection });
			/**
			 * Build a fresh TeamRootProjectionDto from producer input (already branded
			 * ids; the input must not carry own `undefined` keys).
			 * @param input - the root fields.
			 * @returns the frozen root view, validated through the same pipeline as
			 *   `parseTeamRootProjection`.
			 */
			function createTeamRootProjection(input) {
			    const record = {
			        teamSessionId: input.teamSessionId,
			        createdAt: input.createdAt,
			        policyState: input.policyState,
			        admission: input.admission,
			        compatibility: toRecord(input.compatibility),
			        creationBudgetConsumed: input.creationBudgetConsumed,
			    };
			    if (input.defaultWorkspace !== undefined)
			        record['defaultWorkspace'] = input.defaultWorkspace;
			    if (input.handoffSourceSessionId !== undefined) {
			        record['handoffSourceSessionId'] = input.handoffSourceSessionId;
			    }
			    return validateTeamRootProjection(record);
			}
			Object.defineProperty(exports, "createTeamRootProjection", { enumerable: true, get: () => createTeamRootProjection });
			//# sourceMappingURL=root.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/member.js"] = { done: false, fn: function (exports) {
			const __imp38 = __req("../../contracts/src/dto/common.js");
			const GROUP_ID_MAX_LENGTH = __imp38.GROUP_ID_MAX_LENGTH;
			const LABEL_MAX_LENGTH = __imp38.LABEL_MAX_LENGTH;
			const assertFieldPresent = __imp38.assertFieldPresent;
			const assertNoUnknownFields = __imp38.assertNoUnknownFields;
			const assertPlainRecord = __imp38.assertPlainRecord;
			const parseIso8601TimestampField = __imp38.parseIso8601TimestampField;
			const parseLabelLikeField = __imp38.parseLabelLikeField;
			const parseWorkspaceField = __imp38.parseWorkspaceField;
			const __imp39 = __req("../../contracts/src/ids/session-id.js");
			const parseChildSessionId = __imp39.parseChildSessionId;
			const __imp40 = __req("../../contracts/src/ids/instance-id.js");
			const parseInstanceId = __imp40.parseInstanceId;
			const __imp41 = __req("../../contracts/src/ids/template-id.js");
			const parseTemplateId = __imp41.parseTemplateId;
			const __imp42 = __req("../../contracts/src/identity.js");
			const LEADER_INSTANCE_ID = __imp42.LEADER_INSTANCE_ID;
			const __imp43 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp43.assertNoLegacyFields;
			const __imp44 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp44.teamContractError;
			const __imp45 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp45.deepFreeze;
			const __imp46 = __req("../../contracts/src/projection/common.js");
			const toRecord = __imp46.toRecord;
			const __imp47 = __req("../../contracts/src/projection/effective-config.js");
			const parseEffectiveConfigDto = __imp47.parseEffectiveConfigDto;
			const __imp48 = __req("../../contracts/src/projection/model-state.js");
			const parseMemberModelState = __imp48.parseMemberModelState;
			const __imp49 = __req("../../contracts/src/projection/activity.js");
			const parseMemberActivitySummary = __imp49.parseMemberActivitySummary;
			const parseMemberLiveActivity = __imp49.parseMemberLiveActivity;
			const __imp50 = __req("../../contracts/src/projection/states.js");
			const parseContextPolicyField = __imp50.parseContextPolicyField;
			const __imp51 = __req("../../contracts/src/dto/member-instance-record.js");
			const isMemberLifecycleState = __imp51.isMemberLifecycleState;
			const MEMBER_LIFECYCLE_STATE_VALUES = __imp51.MEMBER_LIFECYCLE_STATE_VALUES;
			/**
			 * MemberProjectionDto — the projection row of one MemberInstance (or the
			 * LeaderInstance) of a TeamSession (Architecture §10, §14.3 category B +
			 * the §16/§24 live view).
			 *
			 * Design facts (frozen 20260829 plan docs):
			 *
			 * - **Unified leader/member shape** (invariant 14): the LeaderInstance is
			 *   the only special member, recorded through the same row with the
			 *   reserved instance id `inst-leader`. Unlike the TeamDomain record DTO
			 *   (where the leader's child-session absence is enforced by the producer),
			 *   the PROJECTION shape encodes it: for `instanceId = inst-leader` the
			 *   `childSessionId` key MUST be absent; for every other member it is
			 *   REQUIRED (invariant 23: every MemberInstance binds exactly one durable
			 *   child Session, and the binding is never re-pointed, invariant 24 —
			 *   hence the key stays present even for ARCHIVED/DISPOSED rows).
			 * - `contextPolicy` is the EFFECTIVE per-instance policy (invariant 29):
			 *   the instance-creation value, or the template value when not overridden
			 *   — frozen from then on.
			 * - `effectiveConfig` is the four-lane effective configuration view with
			 *   provenance (effective-config.ts, UI §18.2).
			 * - `activity` is the durable activity summary (activity.ts): DURATIONAL-
			 *   optional — the KEY is absent when the member has no durable activity
			 *   facts (never an own `undefined` key).
			 * - `liveActivity` is the nullable LIVE overlay: ALWAYS the present key,
			 *   value `null` when the live source has no facts for the member (the
			 *   nullable overlay of DevPlan §21.2 — the durable bytes of the projection
			 *   do not change when the overlay appears or disappears).
			 * - NO session-log facts: the row is built from TeamDomain (invariant 41)
			 *   + the optional live overlay; it never scans Root+child Session logs
			 *   (DevPlan §21.2).
			 *
			 * The member row is an embedded value: the enclosing versioned record owns
			 * the schema version, so the row carries none of its own.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/member
			 */
			/** The exact frozen fields of a MemberProjectionDto. */
			const MEMBER_PROJECTION_FIELDS = [
			    'instanceId',
			    'templateId',
			    'label',
			    'groupId',
			    'childSessionId',
			    'workspace',
			    'createdAt',
			    'lifecycle',
			    'contextPolicy',
			    'effectiveConfig',
			    'activity',
			    'liveActivity',
			];
			Object.defineProperty(exports, "MEMBER_PROJECTION_FIELDS", { enumerable: true, get: () => MEMBER_PROJECTION_FIELDS });
			/**
			 * The exact frozen fields of a MemberProjectionDto under projection v2
			 * (S7-R2). v2 is ADDITIVE: the v1 set plus the optional v2 member fields
			 * (repair R2-3 adds `modelState`; every addition is DURATIONAL-optional).
			 * v1 rows remain valid through the v1 field set above.
			 */
			const MEMBER_PROJECTION_FIELDS_V2 = [
			    ...MEMBER_PROJECTION_FIELDS,
			    'modelState',
			];
			Object.defineProperty(exports, "MEMBER_PROJECTION_FIELDS_V2", { enumerable: true, get: () => MEMBER_PROJECTION_FIELDS_V2 });
			function validateMemberProjection(record, schemaVersion = 1) {
			    // R2-2 (S7-R2): schema version 2 admits the additive `MEMBER_PROJECTION_FIELDS_V2`
			    // set and threads the version into the effective-config parse. The declared
			    // return type stays `MemberProjectionDto` (v1-typed `effectiveConfig`) by the
			    // documented type-lie precedent: v2 entries carry the same v1 core fields
			    // plus additive optional keys, so v1-typed reads remain structurally sound.
			    const fields = schemaVersion === 2 ? MEMBER_PROJECTION_FIELDS_V2 : MEMBER_PROJECTION_FIELDS;
			    assertNoLegacyFields(record, 'MemberProjection');
			    assertNoUnknownFields(record, fields, 'MemberProjection');
			    for (const field of fields) {
			        if (field !== 'groupId' &&
			            field !== 'childSessionId' &&
			            field !== 'activity' &&
			            field !== 'modelState') {
			            assertFieldPresent(record, field, 'MemberProjection');
			        }
			    }
			    const instanceId = parseInstanceId(record['instanceId']);
			    const isLeader = instanceId === LEADER_INSTANCE_ID;
			    // The projection shape encodes invariant 14 directly: the leader row has
			    // NO childSessionId key; every other member row requires it (invariant
			    // 23) — for all lifecycle states, including ARCHIVED and DISPOSED.
			    const childSessionId = (() => {
			        if (isLeader) {
			            if (record['childSessionId'] !== undefined) {
			                throw teamContractError('MALFORMED_DTO', 'the LeaderInstance (inst-leader) must not carry a childSessionId (invariant 14)', { reason: 'LEADER_INSTANCE_MUST_NOT_CARRY_CHILD_SESSION' });
			            }
			            return undefined;
			        }
			        assertFieldPresent(record, 'childSessionId', 'MemberProjection');
			        return parseChildSessionId(record['childSessionId']);
			    })();
			    const workspace = (() => {
			        const parsed = parseWorkspaceField(record['workspace'], 'workspace');
			        if (parsed === undefined) {
			            throw teamContractError('MALFORMED_DTO', "MemberProjection is missing required field 'workspace'", { field: 'workspace' });
			        }
			        return parsed;
			    })();
			    const base = {
			        instanceId,
			        templateId: parseTemplateId(record['templateId']),
			        label: parseLabelLikeField(record['label'], 'label', LABEL_MAX_LENGTH),
			        workspace,
			        createdAt: parseIso8601TimestampField(record['createdAt']),
			        lifecycle: (() => {
			            const raw = record['lifecycle'];
			            if (!isMemberLifecycleState(raw)) {
			                throw teamContractError('MALFORMED_DTO', `lifecycle must be one of ${MEMBER_LIFECYCLE_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`, { field: 'lifecycle' });
			            }
			            return raw;
			        })(),
			        contextPolicy: parseContextPolicyField(record['contextPolicy'], 'contextPolicy'),
			        effectiveConfig: parseEffectiveConfigDto(record['effectiveConfig'], schemaVersion),
			        liveActivity: record['liveActivity'] === null
			            ? null
			            : parseMemberLiveActivity(record['liveActivity']),
			    };
			    const groupId = record['groupId'] === undefined
			        ? {}
			        : { groupId: parseLabelLikeField(record['groupId'], 'groupId', GROUP_ID_MAX_LENGTH) };
			    const child = childSessionId === undefined ? {} : { childSessionId };
			    const activity = record['activity'] === undefined
			        ? {}
			        : { activity: parseMemberActivitySummary(record['activity']) };
			    // R2-3 (S7-R2): the v2 model-state view (BQ-11). The key is DURATIONAL-
			    // optional: absent when the producer could not derive the view (or the
			    // row is v1 — the v1 field set rejects the key above).
			    const modelState = record['modelState'] === undefined
			        ? {}
			        : { modelState: parseMemberModelState(record['modelState']) };
			    return deepFreeze({ ...base, ...groupId, ...child, ...activity, ...modelState });
			}
			/**
			 * Parse and validate a MemberProjectionDto from an untrusted value.
			 * @param value - the unknown input.
			 * @param schemaVersion - the enclosing projection schema version: `2`
			 *   admits the additive v2 field set and parses the effective-config
			 *   entries as v2; defaults to `1` (v1, byte-identical behavior).
			 * @returns the frozen member row.
			 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
			 *   `INVALID_INSTANCE_ID`, `INVALID_TEMPLATE_ID`,
			 *   `INVALID_CHILD_SESSION_ID`, or the field-specific codes.
			 */
			function parseMemberProjection(value, schemaVersion = 1) {
			    return validateMemberProjection(assertPlainRecord(value, 'MemberProjection'), schemaVersion);
			}
			Object.defineProperty(exports, "parseMemberProjection", { enumerable: true, get: () => parseMemberProjection });
			/**
			 * Build a fresh MemberProjectionDto from producer input (already branded
			 * ids; the input must not carry own `undefined` keys except the documented
			 * optionals, which are omitted when `undefined`).
			 * @param input - the member fields.
			 * @returns the frozen member row, validated through the same pipeline as
			 *   `parseMemberProjection`. Always v1-stamped; v2 member rows are
			 *   produced through `createTeamProjection` (S7-R2).
			 */
			function createMemberProjection(input) {
			    // R2-3 (S7-R2): the v1-stamped builder cannot produce a v2 field — fail
			    // closed instead of silently dropping the view.
			    if (input.modelState !== undefined) {
			        throw teamContractError('MALFORMED_DTO', "createMemberProjection is v1-stamped and must not carry the v2 'modelState' field", { field: 'modelState' });
			    }
			    const record = {
			        instanceId: input.instanceId,
			        templateId: input.templateId,
			        label: input.label,
			        workspace: input.workspace,
			        createdAt: input.createdAt,
			        lifecycle: input.lifecycle,
			        contextPolicy: input.contextPolicy,
			        effectiveConfig: toRecord(input.effectiveConfig),
			        liveActivity: input.liveActivity === null ? null : toRecord(input.liveActivity),
			    };
			    if (input.groupId !== undefined)
			        record['groupId'] = input.groupId;
			    if (input.childSessionId !== undefined)
			        record['childSessionId'] = input.childSessionId;
			    if (input.activity !== undefined)
			        record['activity'] = toRecord(input.activity);
			    return validateMemberProjection(record);
			}
			//# sourceMappingURL=member.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/model-state.js"] = { done: false, fn: function (exports) {
			const __imp43 = __req("../../contracts/src/dto/common.js");
			const assertFieldPresent = __imp43.assertFieldPresent;
			const assertNoUnknownFields = __imp43.assertNoUnknownFields;
			const assertPlainRecord = __imp43.assertPlainRecord;
			const __imp44 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp44.teamContractError;
			const __imp45 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp45.deepFreeze;
			const __imp46 = __req("../../contracts/src/projection/effective-config.js");
			const EFFECTIVE_CONFIG_SOURCE_VALUES = __imp46.EFFECTIVE_CONFIG_SOURCE_VALUES;
			const EFFECTIVE_CONFIG_STATE_VALUES = __imp46.EFFECTIVE_CONFIG_STATE_VALUES;
			const isEffectiveConfigSource = __imp46.isEffectiveConfigSource;
			const isEffectiveConfigState = __imp46.isEffectiveConfigState;
			/**
			 * MemberModelStateDto — the BQ-11 model state view of one member (or the
			 * LeaderInstance) of a TeamSession (DevPlan P8-S §22 BQ-11: "current model
			 * / next-boundary pending model / Team constraint/provenance /
			 * availability"; UI §18.2 model row, rows D09/H06/H09/H10/H12).
			 *
			 * Design facts (frozen 20260829 plan docs + the S7-R2 R80 ruling):
			 *
			 * - The view is a per-member embedded value under the member projection
			 *   row: DURATIONAL-optional at the member level (the `modelState` key is
			 *   ABSENT when the view cannot be derived — never an own `undefined` key),
			 *   present for every row of a projection v2 (S7-R2) production read.
			 * - `current` is the model of the CURRENT boundary (the NOW horizon: the
			 *   production step clock is pinned to 0, so the policy state active at
			 *   step 0; record-backed winning values are conservatively
			 *   pending, same two-horizon ruling as the R2-2 effective-config view).
			 * - `pendingNextBoundary` is DURATIONAL-optional at the view level: the
			 *   key is ABSENT when nothing is pending for the model cell (no pending
			 *   PolicyState transition, no admitted-but-unapplied override record);
			 *   present when either exists, carrying the model of the NEXT boundary
			 *   (the maximum step horizon) and, when derivable, the step it applies
			 *   from (`effectiveFrom`).
			 * - `provenance` is the winning Team layer of the model cell at the NOW
			 *   horizon (the §18.3 source: layer / origin / record id) plus the frozen
			 *   resolver's per-cell explanation line (the p7t2 provenance fact,
			 *   consumed verbatim — H12 "Team provenance on the Root model").
			 * - `availability` is the TEAM-SIDE availability (H10): `unavailable`
			 *   when the Team constraint denies or makes the current model
			 *   inapplicable (team deny, capability absence, external hard facts,
			 *   malformed item); `available` otherwise (a concrete selection applies,
			 *   including the world baseline for `unspecified` cells). The ND-03
			 *   substrate/browser adapter facts are a DIFFERENT concern (the R1
			 *   cluster) and are intentionally OUT of this view.
			 * - The entry field shape reuses the R2-2 effective-config entry
			 *   vocabularies (value / source / state + the optional `deniedBy` /
			 *   `unavailable` / `effectiveFrom` provenance keys) so the UI renders the
			 *   model row from one closed vocabulary. The `suppressed` and `locked`
			 *   keys of the effective-config entry are NOT part of this view:
			 *   suppressed overlays and the workspace lock belong to their own lanes.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/model-state
			 */
			// --- closed vocabularies -----------------------------------------------------------
			/**
			 * The model value display bound (one `provider/model` selection string, or
			 * `null` when no model applies). Same bound as the effective-config entry.
			 */
			const MODEL_STATE_VALUE_MAX_LENGTH = 512;
			Object.defineProperty(exports, "MODEL_STATE_VALUE_MAX_LENGTH", { enumerable: true, get: () => MODEL_STATE_VALUE_MAX_LENGTH });
			/** The `deniedBy` provenance string bound (opaque, same as effective-config). */
			const MODEL_STATE_DENIED_BY_MAX_LENGTH = 128;
			Object.defineProperty(exports, "MODEL_STATE_DENIED_BY_MAX_LENGTH", { enumerable: true, get: () => MODEL_STATE_DENIED_BY_MAX_LENGTH });
			/** The resolver explanation line bound (defensive clamp at the producer). */
			const MODEL_STATE_EXPLANATION_MAX_LENGTH = 512;
			Object.defineProperty(exports, "MODEL_STATE_EXPLANATION_MAX_LENGTH", { enumerable: true, get: () => MODEL_STATE_EXPLANATION_MAX_LENGTH });
			/**
			 * The winning Team layer of the model cell (the §18.3 source vocabulary —
			 * the closed `TeamLayerOrUnspecified` set of the domain policy package,
			 * mirrored here: the contracts package does not import the domain).
			 */
			const MODEL_STATE_LAYER_VALUES = [
			    'blueprint',
			    'policyState',
			    'template',
			    'templateOverlay',
			    'instanceOverlay',
			    'humanOverride',
			    'unspecified',
			];
			Object.defineProperty(exports, "MODEL_STATE_LAYER_VALUES", { enumerable: true, get: () => MODEL_STATE_LAYER_VALUES });
			/**
			 * Who supplied the winning value (the closed `TeamValueOrigin` set of the
			 * domain policy package, mirrored here).
			 */
			const MODEL_STATE_ORIGIN_VALUES = [
			    'static',
			    'leader',
			    'member',
			    'human',
			];
			Object.defineProperty(exports, "MODEL_STATE_ORIGIN_VALUES", { enumerable: true, get: () => MODEL_STATE_ORIGIN_VALUES });
			/** The team-side availability states of the model (H10). */
			const MODEL_STATE_AVAILABILITY_VALUES = ['available', 'unavailable'];
			Object.defineProperty(exports, "MODEL_STATE_AVAILABILITY_VALUES", { enumerable: true, get: () => MODEL_STATE_AVAILABILITY_VALUES });
			// --- field sets ----------------------------------------------------------------------
			/** The exact frozen fields of the MemberModelStateDto (closed). */
			const MODEL_STATE_FIELDS = [
			    'current',
			    'pendingNextBoundary',
			    'provenance',
			    'availability',
			];
			Object.defineProperty(exports, "MODEL_STATE_FIELDS", { enumerable: true, get: () => MODEL_STATE_FIELDS });
			/** The DURATIONAL-optional view keys (present when the fact holds; ABSENT otherwise). */
			const MODEL_STATE_OPTIONAL_FIELDS = ['pendingNextBoundary'];
			Object.defineProperty(exports, "MODEL_STATE_OPTIONAL_FIELDS", { enumerable: true, get: () => MODEL_STATE_OPTIONAL_FIELDS });
			/** The exact frozen fields of one model state entry (closed). */
			const MODEL_STATE_ENTRY_FIELDS = [
			    'value',
			    'source',
			    'state',
			    'deniedBy',
			    'unavailable',
			    'effectiveFrom',
			];
			Object.defineProperty(exports, "MODEL_STATE_ENTRY_FIELDS", { enumerable: true, get: () => MODEL_STATE_ENTRY_FIELDS });
			/** The DURATIONAL-optional entry keys (present when the fact holds; ABSENT otherwise). */
			const MODEL_STATE_ENTRY_OPTIONAL_FIELDS = [
			    'deniedBy',
			    'unavailable',
			    'effectiveFrom',
			];
			Object.defineProperty(exports, "MODEL_STATE_ENTRY_OPTIONAL_FIELDS", { enumerable: true, get: () => MODEL_STATE_ENTRY_OPTIONAL_FIELDS });
			/** The exact frozen fields of the model state provenance (closed). */
			const MODEL_STATE_PROVENANCE_FIELDS = [
			    'layer',
			    'origin',
			    'recordId',
			    'explanation',
			];
			Object.defineProperty(exports, "MODEL_STATE_PROVENANCE_FIELDS", { enumerable: true, get: () => MODEL_STATE_PROVENANCE_FIELDS });
			// --- parsing ---------------------------------------------------------------------------
			function parseBoundedString(record, field, maxLength) {
			    const raw = record[field];
			    if (typeof raw !== 'string' || raw.length === 0 || raw.length > maxLength) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be a non-empty string of at most ${maxLength} characters, got ${JSON.stringify(raw)}`, { field });
			    }
			    return raw;
			}
			/**
			 * Parse one model state entry (closed field set; the optional provenance
			 * keys are rejected when they are own `undefined` keys — the parse input
			 * is a plain record the producer built by omitting absent keys).
			 * @param value - the raw entry value.
			 * @param field - the enclosing field name (for error context).
			 * @returns the frozen entry.
			 * @throws `MALFORMED_DTO` on any closed-set violation.
			 */
			function parseModelStateEntry(value, field) {
			    const record = assertPlainRecord(value, field);
			    assertNoUnknownFields(record, MODEL_STATE_ENTRY_FIELDS, field);
			    for (const key of MODEL_STATE_ENTRY_FIELDS) {
			        if (MODEL_STATE_ENTRY_OPTIONAL_FIELDS.includes(key))
			            continue;
			        assertFieldPresent(record, key, field);
			    }
			    const valueField = record['value'];
			    if (valueField !== null &&
			        !(typeof valueField === 'string' && valueField.length > 0 && valueField.length <= MODEL_STATE_VALUE_MAX_LENGTH)) {
			        throw teamContractError('MALFORMED_DTO', `${field}.value must be a non-empty string of at most ${MODEL_STATE_VALUE_MAX_LENGTH} characters or null, got ${JSON.stringify(valueField)}`, { field: `${field}.value` });
			    }
			    const source = record['source'];
			    if (!isEffectiveConfigSource(source)) {
			        throw teamContractError('MALFORMED_DTO', `${field}.source must be one of ${EFFECTIVE_CONFIG_SOURCE_VALUES.join(' | ')}, got ${JSON.stringify(source)}`, { field: `${field}.source` });
			    }
			    const state = record['state'];
			    if (!isEffectiveConfigState(state)) {
			        throw teamContractError('MALFORMED_DTO', `${field}.state must be one of ${EFFECTIVE_CONFIG_STATE_VALUES.join(' | ')}, got ${JSON.stringify(state)}`, { field: `${field}.state` });
			    }
			    const out = { value: valueField, source, state };
			    const deniedBy = record['deniedBy'];
			    if (deniedBy !== undefined) {
			        if (typeof deniedBy !== 'string' || deniedBy.length === 0 || deniedBy.length > MODEL_STATE_DENIED_BY_MAX_LENGTH) {
			            throw teamContractError('MALFORMED_DTO', `${field}.deniedBy must be a non-empty string of at most ${MODEL_STATE_DENIED_BY_MAX_LENGTH} characters, got ${JSON.stringify(deniedBy)}`, { field: `${field}.deniedBy` });
			        }
			        out.deniedBy = deniedBy;
			    }
			    const unavailable = record['unavailable'];
			    if (unavailable !== undefined) {
			        if (typeof unavailable !== 'boolean') {
			            throw teamContractError('MALFORMED_DTO', `${field}.unavailable must be a boolean, got ${JSON.stringify(unavailable)}`, { field: `${field}.unavailable` });
			        }
			        out.unavailable = unavailable;
			    }
			    const effectiveFrom = record['effectiveFrom'];
			    if (effectiveFrom !== undefined) {
			        if (typeof effectiveFrom !== 'number' ||
			            !Number.isSafeInteger(effectiveFrom) ||
			            effectiveFrom < 0) {
			            throw teamContractError('MALFORMED_DTO', `${field}.effectiveFrom must be a non-negative safe integer, got ${JSON.stringify(effectiveFrom)}`, { field: `${field}.effectiveFrom` });
			        }
			        out.effectiveFrom = effectiveFrom;
			    }
			    return deepFreeze(out);
			}
			Object.defineProperty(exports, "parseModelStateEntry", { enumerable: true, get: () => parseModelStateEntry });
			/**
			 * Parse the model state provenance (closed field set).
			 * @param value - the raw provenance value.
			 * @returns the frozen provenance.
			 * @throws `MALFORMED_DTO` on any closed-set violation.
			 */
			function parseModelStateProvenance(value) {
			    const record = assertPlainRecord(value, 'provenance');
			    assertNoUnknownFields(record, MODEL_STATE_PROVENANCE_FIELDS, 'provenance');
			    for (const key of MODEL_STATE_PROVENANCE_FIELDS)
			        assertFieldPresent(record, key, 'provenance');
			    const layer = record['layer'];
			    if (typeof layer !== 'string' || !MODEL_STATE_LAYER_VALUES.includes(layer)) {
			        throw teamContractError('MALFORMED_DTO', `provenance.layer must be one of ${MODEL_STATE_LAYER_VALUES.join(' | ')}, got ${JSON.stringify(layer)}`, { field: 'provenance.layer' });
			    }
			    const origin = record['origin'];
			    if (typeof origin !== 'string' || !MODEL_STATE_ORIGIN_VALUES.includes(origin)) {
			        throw teamContractError('MALFORMED_DTO', `provenance.origin must be one of ${MODEL_STATE_ORIGIN_VALUES.join(' | ')}, got ${JSON.stringify(origin)}`, { field: 'provenance.origin' });
			    }
			    const recordId = record['recordId'];
			    if (recordId !== null &&
			        !(typeof recordId === 'string' && recordId.length > 0 && recordId.length <= 128)) {
			        throw teamContractError('MALFORMED_DTO', 'provenance.recordId must be a non-empty string of at most 128 characters or null, got ' +
			            `${JSON.stringify(recordId)}`, { field: 'provenance.recordId' });
			    }
			    const explanation = record['explanation'];
			    if (typeof explanation !== 'string' || explanation.length > MODEL_STATE_EXPLANATION_MAX_LENGTH) {
			        throw teamContractError('MALFORMED_DTO', `provenance.explanation must be a string of at most ${MODEL_STATE_EXPLANATION_MAX_LENGTH} characters, got ${JSON.stringify(explanation)}`, { field: 'provenance.explanation' });
			    }
			    return deepFreeze({ layer, origin, recordId, explanation });
			}
			Object.defineProperty(exports, "parseModelStateProvenance", { enumerable: true, get: () => parseModelStateProvenance });
			/**
			 * Parse the BQ-11 model state view of one member (closed field set).
			 * @param value - the raw model state value.
			 * @returns the frozen view.
			 * @throws `MALFORMED_DTO` on any closed-set violation.
			 */
			function parseMemberModelState(value) {
			    const record = assertPlainRecord(value, 'modelState');
			    assertNoUnknownFields(record, MODEL_STATE_FIELDS, 'modelState');
			    for (const key of MODEL_STATE_FIELDS) {
			        if (MODEL_STATE_OPTIONAL_FIELDS.includes(key))
			            continue;
			        assertFieldPresent(record, key, 'modelState');
			    }
			    const availability = record['availability'];
			    if (typeof availability !== 'string' ||
			        !MODEL_STATE_AVAILABILITY_VALUES.includes(availability)) {
			        throw teamContractError('MALFORMED_DTO', `modelState.availability must be one of ${MODEL_STATE_AVAILABILITY_VALUES.join(' | ')}, got ${JSON.stringify(availability)}`, { field: 'modelState.availability' });
			    }
			    const out = {
			        current: parseModelStateEntry(record['current'], 'modelState.current'),
			        provenance: parseModelStateProvenance(record['provenance']),
			        availability,
			    };
			    const pending = record['pendingNextBoundary'];
			    if (pending !== undefined)
			        out.pendingNextBoundary = parseModelStateEntry(pending, 'modelState.pendingNextBoundary');
			    return deepFreeze(out);
			}
			Object.defineProperty(exports, "parseMemberModelState", { enumerable: true, get: () => parseMemberModelState });
			//# sourceMappingURL=model-state.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/disposed-history.js"] = { done: false, fn: function (exports) {
			const __imp44 = __req("../../contracts/src/dto/common.js");
			const GROUP_ID_MAX_LENGTH = __imp44.GROUP_ID_MAX_LENGTH;
			const LABEL_MAX_LENGTH = __imp44.LABEL_MAX_LENGTH;
			const assertFieldPresent = __imp44.assertFieldPresent;
			const assertNoUnknownFields = __imp44.assertNoUnknownFields;
			const assertPlainRecord = __imp44.assertPlainRecord;
			const parseIso8601TimestampField = __imp44.parseIso8601TimestampField;
			const parseLabelLikeField = __imp44.parseLabelLikeField;
			const __imp45 = __req("../../contracts/src/ids/session-id.js");
			const parseChildSessionId = __imp45.parseChildSessionId;
			const __imp46 = __req("../../contracts/src/ids/instance-id.js");
			const parseInstanceId = __imp46.parseInstanceId;
			const __imp47 = __req("../../contracts/src/ids/template-id.js");
			const parseTemplateId = __imp47.parseTemplateId;
			const __imp48 = __req("../../contracts/src/ids/common.js");
			const assertPositiveInteger = __imp48.assertPositiveInteger;
			const __imp49 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp49.assertNoLegacyFields;
			const __imp50 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp50.teamContractError;
			const __imp51 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp51.deepFreeze;
			const __imp52 = __req("../../contracts/src/projection/common.js");
			const assertNonNegativeInteger = __imp52.assertNonNegativeInteger;
			const __imp53 = __req("../../contracts/src/projection/states.js");
			const LEDGER_CATEGORY_VALUES = __imp53.LEDGER_CATEGORY_VALUES;
			/**
			 * DisposedMemberHistoryDto — the retained-history bundle of one DISPOSED
			 * member (S7-R2 R2-6, repair D14 / UI-D14): one entry of the additive v2
			 * `disposedHistory` top-level key of the whole-team projection.
			 *
			 * Design facts (frozen 20260829 plan docs + the S7-R2 repair scope):
			 *
			 * - The bundle is the DISCOVERABILITY layer for disposed history: it names
			 *   every DISPOSED member, anchors its retained timeline (the durable
			 *   creation stamp + the dispose stamp derived from the lifecycle facts),
			 *   and DIGESTS the member's share of the TeamLedger — per-category counts
			 *   over the eight frozen ledger categories plus the first/last attributed
			 *   sequence. It does NOT duplicate fact payloads: the full facts stay on
			 *   the TeamLedger (invariant 41) and remain reachable through the frozen
			 *   `team.getLedgerPage` pagination (BQ-16) — the digest's sequence span is
			 *   the client's navigation anchor into that page stream.
			 * - The bundle is DURATIONAL-optional at the projection TOP LEVEL: the
			 *   `disposedHistory` key is ABSENT when the team has no DISPOSED member
			 *   (the default projection is byte-identical to the pre-repair shape —
			 *   the live view (BQ-04) semantics are unchanged) and PRESENT (non-empty)
			 *   exactly when at least one DISPOSED member exists. An empty array is
			 *   malformed (fabricated presence).
			 * - Cross-field (validated at the enclosing TeamProjection parse): the
			 *   bundle's instance ids are EXACTLY the DISPOSED member rows of
			 *   `members` — every DISPOSED row has one entry, every entry references a
			 *   DISPOSED row, no duplicates. The LeaderInstance can never appear
			 *   (it has no lifecycle and therefore cannot be DISPOSED).
			 * - `factCount` equals the sum of `byCategory` (mirrors the frozen ledger
			 *   summary invariant). Attribution is the CLOSED read-port rule (runtime
			 *   `projection-source.ts`): a root ledger entry is attributed to a member
			 *   when one of its closed addressing keys — `instanceId`,
			 *   `targetInstanceId`, `recipientInstanceId`, `deliveredToInstanceId` —
			 *   names the member. Team-level facts (policy / compatibility / team
			 *   session) carry no instance key and are therefore never attributed.
			 * - `firstSequence` / `lastSequence` form a DURATIONAL-optional PAIR: both
			 *   ABSENT together iff `factCount` is 0, both PRESENT together otherwise
			 *   (a positive sequence span, `firstSequence <= lastSequence`).
			 *
			 * The bundle is an embedded value: the enclosing versioned record owns the
			 * schema version, so the bundle carries none of its own.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/disposed-history
			 */
			/** The exact frozen fields of a DisposedMemberHistoryDto. */
			const DISPOSED_MEMBER_HISTORY_FIELDS = [
			    'instanceId',
			    'label',
			    'templateId',
			    'childSessionId',
			    'groupId',
			    'createdAt',
			    'disposedAt',
			    'factCount',
			    'byCategory',
			    'firstSequence',
			    'lastSequence',
			];
			Object.defineProperty(exports, "DISPOSED_MEMBER_HISTORY_FIELDS", { enumerable: true, get: () => DISPOSED_MEMBER_HISTORY_FIELDS });
			/**
			 * The DURATIONAL-optional keys of a DisposedMemberHistoryDto: ABSENT when
			 * the fact is not carried (never an own-`undefined` key).
			 */
			const DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS = [
			    'groupId',
			    'disposedAt',
			    'firstSequence',
			    'lastSequence',
			];
			Object.defineProperty(exports, "DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS", { enumerable: true, get: () => DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS });
			function validateDisposedMemberHistory(record) {
			    assertNoLegacyFields(record, 'DisposedMemberHistory');
			    assertNoUnknownFields(record, DISPOSED_MEMBER_HISTORY_FIELDS, 'DisposedMemberHistory');
			    for (const field of DISPOSED_MEMBER_HISTORY_FIELDS) {
			        if (!DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS.includes(field)) {
			            assertFieldPresent(record, field, 'DisposedMemberHistory');
			        }
			    }
			    const instanceId = parseInstanceId(record['instanceId']);
			    const createdAt = parseIso8601TimestampField(record['createdAt']);
			    const disposedAt = record['disposedAt'] === undefined
			        ? undefined
			        : parseIso8601TimestampField(record['disposedAt']);
			    const byCategoryRecord = assertPlainRecord(record['byCategory'], 'DisposedMemberHistory.byCategory');
			    assertNoUnknownFields(byCategoryRecord, LEDGER_CATEGORY_VALUES, 'DisposedMemberHistory.byCategory');
			    const byCategory = {};
			    let sum = 0;
			    for (const category of LEDGER_CATEGORY_VALUES) {
			        assertFieldPresent(byCategoryRecord, category, 'DisposedMemberHistory.byCategory');
			        const count = assertNonNegativeInteger(byCategoryRecord[category], `DisposedMemberHistory.byCategory.${category}`);
			        byCategory[category] = count;
			        sum += count;
			    }
			    const factCount = assertNonNegativeInteger(record['factCount'], 'DisposedMemberHistory.factCount');
			    if (sum !== factCount) {
			        throw teamContractError('MALFORMED_DTO', `factCount (${factCount}) must equal the sum of byCategory (${sum})`, { field: 'DisposedMemberHistory.factCount', reason: 'FACT_COUNT_CATEGORY_SUM_MISMATCH' });
			    }
			    // The DURATIONAL-optional sequence span: both keys are present or absent
			    // TOGETHER, and present exactly when at least one fact was attributed.
			    const hasFirst = record['firstSequence'] !== undefined;
			    const hasLast = record['lastSequence'] !== undefined;
			    if (hasFirst !== hasLast) {
			        throw teamContractError('MALFORMED_DTO', 'firstSequence and lastSequence must be present or absent together', { field: 'DisposedMemberHistory.firstSequence', reason: 'SEQUENCE_SPAN_KEYS_SPLIT' });
			    }
			    let firstSequence;
			    let lastSequence;
			    if (hasFirst && hasLast) {
			        firstSequence = assertPositiveInteger(record['firstSequence'], 'DisposedMemberHistory.firstSequence');
			        lastSequence = assertPositiveInteger(record['lastSequence'], 'DisposedMemberHistory.lastSequence');
			        if (firstSequence > lastSequence) {
			            throw teamContractError('MALFORMED_DTO', `firstSequence (${firstSequence}) must not exceed lastSequence (${lastSequence})`, { field: 'DisposedMemberHistory.firstSequence', reason: 'SEQUENCE_SPAN_INVERTED' });
			        }
			        if (factCount === 0) {
			            throw teamContractError('MALFORMED_DTO', 'firstSequence / lastSequence must be absent when factCount is 0', { field: 'DisposedMemberHistory.firstSequence', reason: 'SEQUENCE_SPAN_WITHOUT_FACTS' });
			        }
			    }
			    else if (factCount > 0) {
			        throw teamContractError('MALFORMED_DTO', 'firstSequence / lastSequence must be present when factCount is greater than 0', { field: 'DisposedMemberHistory.firstSequence', reason: 'FACTS_WITHOUT_SEQUENCE_SPAN' });
			    }
			    return deepFreeze({
			        instanceId,
			        label: parseLabelLikeField(record['label'], 'DisposedMemberHistory.label', LABEL_MAX_LENGTH),
			        templateId: parseTemplateId(record['templateId']),
			        childSessionId: parseChildSessionId(record['childSessionId']),
			        ...(record['groupId'] !== undefined
			            ? { groupId: parseLabelLikeField(record['groupId'], 'DisposedMemberHistory.groupId', GROUP_ID_MAX_LENGTH) }
			            : {}),
			        createdAt,
			        ...(disposedAt !== undefined ? { disposedAt } : {}),
			        factCount,
			        byCategory,
			        ...(firstSequence !== undefined && lastSequence !== undefined
			            ? { firstSequence, lastSequence }
			            : {}),
			    });
			}
			/**
			 * Parse and validate a DisposedMemberHistoryDto from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen bundle entry.
			 * @throws `MALFORMED_DTO` for a malformed container, field set, field value,
			 *   category key set, a `factCount` / sum-of-categories mismatch, a split or
			 *   inverted sequence span, or a span that disagrees with `factCount`;
			 *   `LEGACY_MEMBER_ID_REJECTED`, `INVALID_INSTANCE_ID`, `INVALID_TEMPLATE_ID`,
			 *   or `INVALID_CHILD_SESSION_ID` for the embedded identity fields.
			 */
			function parseDisposedMemberHistory(value) {
			    return validateDisposedMemberHistory(assertPlainRecord(value, 'DisposedMemberHistory'));
			}
			Object.defineProperty(exports, "parseDisposedMemberHistory", { enumerable: true, get: () => parseDisposedMemberHistory });
			/**
			 * Build a fresh DisposedMemberHistoryDto from producer input (already
			 * branded ids; the input must not carry own `undefined` keys).
			 * @param input - the bundle fields.
			 * @returns the frozen bundle entry (validated through the same pipeline as
			 *   `parseDisposedMemberHistory`).
			 */
			function createDisposedMemberHistory(input) {
			    const record = {
			        instanceId: input.instanceId,
			        label: input.label,
			        templateId: input.templateId,
			        childSessionId: input.childSessionId,
			        createdAt: input.createdAt,
			        factCount: input.factCount,
			        byCategory: { ...input.byCategory },
			    };
			    if (input.groupId !== undefined)
			        record['groupId'] = input.groupId;
			    if (input.disposedAt !== undefined)
			        record['disposedAt'] = input.disposedAt;
			    if (input.firstSequence !== undefined)
			        record['firstSequence'] = input.firstSequence;
			    if (input.lastSequence !== undefined)
			        record['lastSequence'] = input.lastSequence;
			    return validateDisposedMemberHistory(record);
			}
			Object.defineProperty(exports, "createDisposedMemberHistory", { enumerable: true, get: () => createDisposedMemberHistory });
			//# sourceMappingURL=disposed-history.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/ledger.js"] = { done: false, fn: function (exports) {
			const __imp27 = __req("../../contracts/src/dto/common.js");
			const assertFieldPresent = __imp27.assertFieldPresent;
			const assertNoUnknownFields = __imp27.assertNoUnknownFields;
			const assertPlainRecord = __imp27.assertPlainRecord;
			const __imp28 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp28.assertNoLegacyFields;
			const __imp29 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp29.teamContractError;
			const __imp30 = __req("../../contracts/src/remote-safe.js");
			const deepFreeze = __imp30.deepFreeze;
			const __imp31 = __req("../../contracts/src/projection/common.js");
			const assertNonNegativeInteger = __imp31.assertNonNegativeInteger;
			const __imp32 = __req("../../contracts/src/projection/states.js");
			const LEDGER_CATEGORY_VALUES = __imp32.LEDGER_CATEGORY_VALUES;
			/**
			 * LedgerSummaryDto — the TeamLedger summary carried by the projection
			 * (UI §27: the projection shows the ledger summary; the entries themselves
			 * are TeamDomain facts, invariant 41, and never projection fields).
			 *
			 * Design facts (frozen 20260829 plan docs):
			 *
			 * - `byCategory` is the per-category count over the EIGHT frozen ledger
			 *   categories (states.ts, UI §27.4): every category key is REQUIRED (zero
			 *   counts are carried as explicit zeros), and no other key is allowed —
			 *   a closed shape, so the UI filter row is fully described by the
			 *   contract.
			 * - `totalEntries` must equal the sum of `byCategory` (validated at parse:
			 *   a summary that disagrees with itself is malformed).
			 * - `latestSequence` is the highest durable ledger sequence so far (0 for
			 *   an empty ledger); it is a lower-bound hint for the client's ledger
			 *   view, not a completeness proof (completeness is the TeamDomain's
			 *   durable journal, invariant 41).
			 * - `pendingControlCount` is the number of control requests awaiting a
			 *   decision (the UI §27 pending badge).
			 *
			 * The summary is an embedded value: the enclosing versioned record owns
			 * the schema version, so the summary carries none of its own.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/ledger
			 */
			/** The exact frozen fields of a LedgerSummaryDto. */
			const LEDGER_SUMMARY_FIELDS = [
			    'latestSequence',
			    'totalEntries',
			    'byCategory',
			    'pendingControlCount',
			];
			Object.defineProperty(exports, "LEDGER_SUMMARY_FIELDS", { enumerable: true, get: () => LEDGER_SUMMARY_FIELDS });
			function validateLedgerSummary(record) {
			    assertNoLegacyFields(record, 'LedgerSummary');
			    assertNoUnknownFields(record, LEDGER_SUMMARY_FIELDS, 'LedgerSummary');
			    for (const field of LEDGER_SUMMARY_FIELDS) {
			        assertFieldPresent(record, field, 'LedgerSummary');
			    }
			    const latestSequence = assertNonNegativeInteger(record['latestSequence'], 'latestSequence');
			    const totalEntries = assertNonNegativeInteger(record['totalEntries'], 'totalEntries');
			    const pendingControlCount = assertNonNegativeInteger(record['pendingControlCount'], 'pendingControlCount');
			    const byCategoryRecord = assertPlainRecord(record['byCategory'], 'LedgerSummary.byCategory');
			    assertNoUnknownFields(byCategoryRecord, LEDGER_CATEGORY_VALUES, 'LedgerSummary.byCategory');
			    const byCategory = {};
			    let sum = 0;
			    for (const category of LEDGER_CATEGORY_VALUES) {
			        assertFieldPresent(byCategoryRecord, category, 'LedgerSummary.byCategory');
			        const count = assertNonNegativeInteger(byCategoryRecord[category], `byCategory.${category}`);
			        byCategory[category] = count;
			        sum += count;
			    }
			    if (sum !== totalEntries) {
			        throw teamContractError('MALFORMED_DTO', `totalEntries (${totalEntries}) must equal the sum of byCategory (${sum})`, { reason: 'TOTAL_ENTRIES_MISMATCH' });
			    }
			    return deepFreeze({
			        latestSequence,
			        totalEntries,
			        byCategory,
			        pendingControlCount,
			    });
			}
			/**
			 * Parse and validate a LedgerSummaryDto from an untrusted value.
			 * @param value - the unknown input.
			 * @returns the frozen summary.
			 * @throws `MALFORMED_DTO` for a malformed container, field set, field value,
			 *   category key set, or a `totalEntries` / sum-of-categories mismatch.
			 */
			function parseLedgerSummary(value) {
			    return validateLedgerSummary(assertPlainRecord(value, 'LedgerSummary'));
			}
			Object.defineProperty(exports, "parseLedgerSummary", { enumerable: true, get: () => parseLedgerSummary });
			/**
			 * Build a fresh LedgerSummaryDto from producer input (the input must not
			 * carry own `undefined` keys).
			 * @param input - the summary fields.
			 * @returns the frozen summary, validated through the same pipeline as
			 *   `parseLedgerSummary`.
			 */
			function createLedgerSummary(input) {
			    const record = {
			        latestSequence: input.latestSequence,
			        totalEntries: input.totalEntries,
			        byCategory: { ...input.byCategory },
			        pendingControlCount: input.pendingControlCount,
			    };
			    return validateLedgerSummary(record);
			}
			Object.defineProperty(exports, "createLedgerSummary", { enumerable: true, get: () => createLedgerSummary });
			//# sourceMappingURL=ledger.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/projection.js"] = { done: false, fn: function (exports) {
			const __imp36 = __req("../../contracts/src/dto/common.js");
			const assertFieldPresent = __imp36.assertFieldPresent;
			const assertNoUnknownFields = __imp36.assertNoUnknownFields;
			const assertPlainRecord = __imp36.assertPlainRecord;
			const parseIso8601TimestampField = __imp36.parseIso8601TimestampField;
			const __imp37 = __req("../../contracts/src/dto/blueprint-snapshot.js");
			const parseBlueprintSnapshotRef = __imp37.parseBlueprintSnapshotRef;
			const __imp38 = __req("../../contracts/src/ids/session-id.js");
			const parseTeamSessionId = __imp38.parseTeamSessionId;
			const __imp39 = __req("../../contracts/src/ids/common.js");
			const assertPositiveInteger = __imp39.assertPositiveInteger;
			const __imp40 = __req("../../contracts/src/identity.js");
			const LEADER_INSTANCE_ID = __imp40.LEADER_INSTANCE_ID;
			const __imp41 = __req("../../contracts/src/legacy-vocabulary.js");
			const assertNoLegacyFields = __imp41.assertNoLegacyFields;
			const __imp42 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp42.teamContractError;
			const __imp43 = __req("../../contracts/src/remote-safe.js");
			const canonicalJsonStringify = __imp43.canonicalJsonStringify;
			const deepFreeze = __imp43.deepFreeze;
			const __imp44 = __req("../../contracts/src/projection/common.js");
			const toRecord = __imp44.toRecord;
			const __imp45 = __req("../../contracts/src/projection/schema.js");
			const PROJECTION_SCHEMA_VERSION = __imp45.PROJECTION_SCHEMA_VERSION;
			const PROJECTION_SCHEMA_VERSION_V2 = __imp45.PROJECTION_SCHEMA_VERSION_V2;
			const assertProjectionSchemaVersion = __imp45.assertProjectionSchemaVersion;
			const __imp46 = __req("../../contracts/src/projection/root.js");
			const parseTeamRootProjection = __imp46.parseTeamRootProjection;
			const __imp47 = __req("../../contracts/src/projection/template.js");
			const parseTemplateProjection = __imp47.parseTemplateProjection;
			const __imp48 = __req("../../contracts/src/projection/member.js");
			const parseMemberProjection = __imp48.parseMemberProjection;
			const __imp49 = __req("../../contracts/src/projection/ledger.js");
			const parseLedgerSummary = __imp49.parseLedgerSummary;
			const __imp50 = __req("../../contracts/src/projection/disposed-history.js");
			const parseDisposedMemberHistory = __imp50.parseDisposedMemberHistory;
			const __imp51 = __req("../../contracts/src/dto/member-instance-record.js");
			const MEMBER_LIFECYCLE_STATES = __imp51.MEMBER_LIFECYCLE_STATES;
			/**
			 * TeamProjectionDto — the frozen v1 projection contract (P8-T1): the whole
			 * read-only view of one TeamSession that the P8-T2 read service produces
			 * from TeamDomain (+ an optional live overlay) and the client renders
			 * (Development Plan §21).
			 *
			 * Frozen facts (frozen 20260829 plan docs; invariant numbers refer to
			 * Architecture §42):
			 *
			 * - **Source**: TeamDomain (invariant 41) + an optional live overlay
			 *   (DevPlan §21.2). The projection NEVER scans Root+child Session logs
			 *   and never carries session-log facts.
			 * - **Identity**: `teamSessionId` IS the root DSH session id (invariant
			 *   9); the projection binds exactly one immutable blueprint snapshot
			 *   (invariant 10, embedded ref).
			 * - **Generation**: `generation` is the WHOLE-projection monotonic
			 *   generation (DevPlan §21.4): it starts at 1 and only increases; a
			 *   client applying an incoming projection MUST reject a stale overwrite
			 *   (`isStaleTeamProjection` below is the frozen guard).
			 * - **Root**: the identity + admission view (root.ts) — NO lifecycle field
			 *   (Architecture §8.6).
			 * - **Templates**: exactly ONE leader template (invariant 13) and the
			 *   member templates (invariant 17) of the bound snapshot.
			 * - **Members**: every MemberInstance plus the LeaderInstance as one
			 *   unified row (invariant 14, member.ts); `instanceId` is unique within
			 *   the team (invariant 18); each non-leader row references an existing
			 *   member template; the leader row references the leader template.
			 * - **Ledger**: the summary only (ledger.ts, UI §27).
			 *
			 * The v1 freeze covers every field of every embedded record; adding a
			 * field is a new projection schema version (schema.ts track), never a
			 * silent edit of this v1.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/projection
			 */
			/** The exact frozen fields of a TeamProjectionDto (v1). */
			const TEAM_PROJECTION_FIELDS = [
			    'schemaVersion',
			    'teamSessionId',
			    'blueprint',
			    'generation',
			    'generatedAt',
			    'root',
			    'templates',
			    'members',
			    'ledger',
			];
			Object.defineProperty(exports, "TEAM_PROJECTION_FIELDS", { enumerable: true, get: () => TEAM_PROJECTION_FIELDS });
			/**
			 * The top-level projection fields of schema version 2 (S7-R2, repairs
			 * R2-2..R2-6): the v1 set plus the DURATIONAL-optional additive key
			 * `disposedHistory` (R2-6, D14 — the retained-history bundle of every
			 * DISPOSED member; see disposed-history.ts). A v2 record may carry exactly
			 * the v1 key set — every additive key is optional (absent, never
			 * own-undefined; the key is ABSENT when the team has no DISPOSED member, so
			 * the default projection is byte-identical to the pre-repair shape). The
			 * member-level v2 additions live in `MEMBER_PROJECTION_FIELDS_V2`.
			 */
			const TEAM_PROJECTION_FIELDS_V2 = [
			    ...TEAM_PROJECTION_FIELDS,
			    'disposedHistory',
			];
			Object.defineProperty(exports, "TEAM_PROJECTION_FIELDS_V2", { enumerable: true, get: () => TEAM_PROJECTION_FIELDS_V2 });
			function assertDtoArray(value, field) {
			    if (!Array.isArray(value)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be an array, got ${typeof value}`, { field });
			    }
			    return value;
			}
			function assertCrossFieldInvariant(condition, reason, message) {
			    if (!condition) {
			        throw teamContractError('MALFORMED_DTO', message, { reason });
			    }
			}
			function validateTeamProjection(record) {
			    assertNoLegacyFields(record, 'TeamProjection');
			    // R2-2 (S7-R2): the field set and the per-member parse version follow the
			    // record's own schema version (v1 set for `1`, the additive v2 set for
			    // `2`). `assertProjectionSchemaVersion` accepts the supported [1, 2].
			    const fields = record['schemaVersion'] === 2 ? TEAM_PROJECTION_FIELDS_V2 : TEAM_PROJECTION_FIELDS;
			    assertNoUnknownFields(record, fields, 'TeamProjection');
			    for (const field of fields) {
			        // R2-6 (S7-R2): `disposedHistory` is DURATIONAL-optional (absent when
			        // the team has no DISPOSED member) — admitted by the v2 set, exempt
			        // from the presence loop.
			        if (field !== 'disposedHistory') {
			            assertFieldPresent(record, field, 'TeamProjection');
			        }
			    }
			    assertProjectionSchemaVersion(record['schemaVersion']);
			    const schemaVersion = record['schemaVersion'] === 2 ? 2 : 1;
			    const teamSessionId = parseTeamSessionId(record['teamSessionId']);
			    const generation = assertPositiveInteger(record['generation'], 'generation');
			    const generatedAt = parseIso8601TimestampField(record['generatedAt']);
			    const blueprint = parseBlueprintSnapshotRef(record['blueprint']);
			    const root = parseTeamRootProjection(record['root']);
			    assertCrossFieldInvariant(root.teamSessionId === teamSessionId, 'ROOT_TEAM_SESSION_MISMATCH', 'root.teamSessionId must equal the projection teamSessionId (invariant 9)');
			    const templates = assertDtoArray(record['templates'], 'templates').map((item) => parseTemplateProjection(item));
			    const members = assertDtoArray(record['members'], 'members').map((item) => parseMemberProjection(item, schemaVersion));
			    // Invariant 13: exactly one leader template.
			    const leaderTemplates = templates.filter((template) => template.kind === 'leader');
			    assertCrossFieldInvariant(leaderTemplates.length === 1, leaderTemplates.length === 0 ? 'LEADER_TEMPLATE_MISSING' : 'LEADER_TEMPLATE_NOT_UNIQUE', `templates must contain exactly one leader template, got ${leaderTemplates.length}`);
			    // Length is 1 (asserted above); the assertion operator documents that.
			    const leaderTemplateId = leaderTemplates[0].templateId;
			    const memberTemplateIds = new Set(templates.filter((template) => template.kind === 'member').map((template) => template.templateId));
			    const seenTemplateIds = new Set();
			    for (const template of templates) {
			        assertCrossFieldInvariant(!seenTemplateIds.has(template.templateId), 'TEMPLATE_ID_DUPLICATE', `templateId ${template.templateId} appears more than once in templates`);
			        seenTemplateIds.add(template.templateId);
			    }
			    // Invariants 14/17/18: leader instance exactly once, instance ids unique,
			    // every non-leader member references an existing member template.
			    const seenInstanceIds = new Set();
			    let leaderInstance = null;
			    for (const member of members) {
			        assertCrossFieldInvariant(!seenInstanceIds.has(member.instanceId), 'INSTANCE_ID_DUPLICATE', `instanceId ${member.instanceId} appears more than once in members`);
			        seenInstanceIds.add(member.instanceId);
			        if (member.instanceId === LEADER_INSTANCE_ID) {
			            assertCrossFieldInvariant(leaderInstance === null, 'LEADER_INSTANCE_DUPLICATE', 'the LeaderInstance (inst-leader) appears more than once in members');
			            leaderInstance = member;
			            assertCrossFieldInvariant(member.templateId === leaderTemplateId, 'LEADER_TEMPLATE_MISMATCH', `the LeaderInstance must reference the leader template (${leaderTemplateId}), got ${member.templateId}`);
			        }
			        else {
			            assertCrossFieldInvariant(memberTemplateIds.has(member.templateId), 'UNKNOWN_MEMBER_TEMPLATE', `member ${member.instanceId} references unknown member template ${member.templateId}`);
			        }
			    }
			    assertCrossFieldInvariant(leaderInstance !== null, 'LEADER_INSTANCE_MISSING', 'members must contain exactly one LeaderInstance (inst-leader)');
			    // R2-6 (S7-R2, D14): the additive v2 retained-history bundle. The v1
			    // field set rejected the key above, so its presence implies schema
			    // version 2. DURATIONAL-optional semantics: ABSENT when no DISPOSED
			    // member exists; PRESENT means non-empty, and the bundle must be EXACTLY
			    // the set of DISPOSED member rows (live view (BQ-04) semantics unchanged
			    // — the member rows themselves are untouched).
			    let disposedHistory;
			    if (record['disposedHistory'] !== undefined) {
			        const entries = assertDtoArray(record['disposedHistory'], 'disposedHistory').map((item) => parseDisposedMemberHistory(item));
			        if (entries.length === 0) {
			            throw teamContractError('MALFORMED_DTO', 'disposedHistory must be non-empty when present (a team with no DISPOSED member carries no key)', { field: 'disposedHistory', reason: 'DISPOSED_HISTORY_EMPTY' });
			        }
			        const disposedIds = new Set(members
			            .filter((member) => member.lifecycle === MEMBER_LIFECYCLE_STATES.DISPOSED)
			            .map((member) => member.instanceId));
			        const seen = new Set();
			        for (const entry of entries) {
			            if (seen.has(entry.instanceId)) {
			                throw teamContractError('MALFORMED_DTO', `disposedHistory carries duplicate instance id ${entry.instanceId}`, { field: 'disposedHistory', reason: 'DISPOSED_HISTORY_DUPLICATE_INSTANCE' });
			            }
			            seen.add(entry.instanceId);
			            if (!disposedIds.has(entry.instanceId)) {
			                throw teamContractError('MALFORMED_DTO', `disposedHistory entry ${entry.instanceId} does not reference a DISPOSED member row`, { field: 'disposedHistory', reason: 'DISPOSED_HISTORY_UNKNOWN_INSTANCE' });
			            }
			        }
			        assertCrossFieldInvariant(seen.size === disposedIds.size, 'DISPOSED_HISTORY_INCOMPLETE', `disposedHistory must cover every DISPOSED member row exactly once (bundle: ${entries.length}, DISPOSED rows: ${disposedIds.size})`);
			        disposedHistory = entries;
			    }
			    return deepFreeze({
			        schemaVersion: schemaVersion,
			        teamSessionId,
			        blueprint,
			        generation,
			        generatedAt,
			        root,
			        templates,
			        members,
			        ledger: parseLedgerSummary(record['ledger']),
			        ...(disposedHistory !== undefined ? { disposedHistory } : {}),
			    });
			}
			/**
			 * Parse and validate a TeamProjectionDto from an untrusted value. The
			 * schema version is read from the record itself: v1 records parse through
			 * the v1 field sets, v2 records (S7-R2, R2-2..R2-6) through the additive
			 * v2 field sets.
			 * @param value - the unknown input (e.g. a value decoded from the wire).
			 * @returns the frozen projection.
			 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
			 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
			 *   `INVALID_ROOT_SESSION_ID`, or the field/cross-field codes of the
			 *   embedded records.
			 */
			function parseTeamProjection(value) {
			    return validateTeamProjection(assertPlainRecord(value, 'TeamProjection'));
			}
			Object.defineProperty(exports, "parseTeamProjection", { enumerable: true, get: () => parseTeamProjection });
			/**
			 * Build a fresh TeamProjectionDto from producer input (already branded
			 * ids; input records must not carry own `undefined` keys). The result is
			 * validated through the same pipeline as `parseTeamProjection`.
			 * @param input - the projection fields.
			 * @returns the frozen projection stamped with the requested projection
			 *   schema version (v1 by default; v2 for the additive S7-R2 repair
			 *   fields).
			 */
			function createTeamProjection(input) {
			    const record = {
			        schemaVersion: input.schemaVersion === 2 ? PROJECTION_SCHEMA_VERSION_V2 : PROJECTION_SCHEMA_VERSION,
			        teamSessionId: input.teamSessionId,
			        blueprint: {
			            blueprintId: input.blueprint.blueprintId,
			            revision: input.blueprint.revision,
			            contentHash: input.blueprint.contentHash,
			        },
			        generation: input.generation,
			        generatedAt: input.generatedAt,
			        root: toRecord(input.root),
			        templates: input.templates.map((template) => toRecord(template)),
			        members: input.members.map((member) => toRecord(member)),
			        ledger: toRecord(input.ledger),
			    };
			    // R2-6 (S7-R2, D14): the additive retained-history bundle. Stamped only
			    // for schema version 2 (a v1 projection never carries the key) and only
			    // when the producer derived bundles (ABSENT when no DISPOSED member
			    // exists — the default projection stays byte-identical).
			    if (input.schemaVersion === 2 && input.disposedHistory !== undefined) {
			        record['disposedHistory'] = input.disposedHistory.map((entry) => toRecord(entry));
			    }
			    return validateTeamProjection(record);
			}
			/**
			 * Serialize a projection to canonical JSON (keys in ascending order;
			 * deterministic for deeply-equal values).
			 * @param projection - the projection to serialize.
			 * @returns the canonical JSON text.
			 */
			export function serializeTeamProjection(projection) {
			    return canonicalJsonStringify(projection);
			}
			/**
			 * Deserialize a canonical JSON projection back into a validated, frozen
			 * projection.
			 * @param json - the canonical JSON text.
			 * @returns the parsed projection.
			 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
			 *   validation codes a malformed projection triggers.
			 */
			export function deserializeTeamProjection(json) {
			    let value;
			    try {
			        value = JSON.parse(json);
			    }
			    catch (error) {
			        throw teamContractError('MALFORMED_DTO', `TeamProjection JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, {});
			    }
			    return parseTeamProjection(value);
			}
			/**
			 * Stale-overwrite guard (DevPlan §21.4): the whole-projection generation is
			 * monotonic per team. A client applying an incoming projection must reject
			 * it when it would not advance the generation it already holds.
			 *
			 * @param current - the projection the client already holds.
			 * @param incoming - the incoming projection.
			 * @returns `true` when `incoming` is stale: same TeamSession AND
			 *   `incoming.generation <= current.generation`. A projection of a
			 *   different teamSessionId is never comparable and is NOT stale (the
			 *   guard is per-team; the client keys projections by teamSessionId).
			 */
			export function isStaleTeamProjection(current, incoming) {
			    if (current.teamSessionId !== incoming.teamSessionId) {
			        return false;
			    }
			    return incoming.generation <= current.generation;
			}
			//# sourceMappingURL=projection.js.map
			}, exports: {} };
		__mods["../../contracts/src/ids/common.js"] = { done: false, fn: function (exports) {
			const __imp14 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp14.teamContractError;
			const __imp15 = __req("../../contracts/src/remote-safe.js");
			const toRemoteSafeDetail = __imp15.toRemoteSafeDetail;
			/**
			 * Low-level string rules shared by the identity modules.
			 *
			 * These are the vNext boundary rules for values that originate outside the
			 * Team contract (upstream DSH session ids, blueprint identifiers, labels,
			 * workspace paths). They reject structurally unusable strings (empty,
			 * control characters, over-length) without inventing an upstream format:
			 * the upstream DSH session id is an opaque branded string minted as
			 * `session-<n>` by the session store, so no charset beyond the rules here is
			 * assumed or required.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/ids/common
			 */
			/** Rejects ASCII control characters and DEL (0x00-0x1F, 0x7F). */
			function hasControlChars(value) {
			    for (let i = 0; i < value.length; i++) {
			        const code = value.charCodeAt(i);
			        if (code < 0x20 || code === 0x7f)
			            return true;
			    }
			    return false;
			}
			Object.defineProperty(exports, "hasControlChars", { enumerable: true, get: () => hasControlChars });
			/** Rejects any Unicode whitespace character. */
			function hasWhitespace(value) {
			    return /\s/.test(value);
			}
			Object.defineProperty(exports, "hasWhitespace", { enumerable: true, get: () => hasWhitespace });
			/**
			 * Assert `raw` is a string and return it.
			 * @param raw - the unknown input.
			 * @param field - the field name, used in the error.
			 * @param code - the contract error code to throw.
			 * @returns the input as a string.
			 * @throws the given `code` when the input is not a string.
			 */
			function assertIsString(raw, field, code) {
			    if (typeof raw !== 'string') {
			        throw teamContractError(code, `${field} must be a string, got ${typeof raw}`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "assertIsString", { enumerable: true, get: () => assertIsString });
			/**
			 * Apply the shared structural string rules: non-empty, at most `maxLength`
			 * characters, no control characters, and (optionally) no whitespace.
			 * @param value - the string to check (already asserted to be a string).
			 * @param options - `field` (error field name), `code` (error code), `maxLength`, and `allowWhitespace` (default false).
			 * @throws the given `code` with a truncated preview of the value.
			 */
			function assertStringRules(value, options) {
			    const { field, code, maxLength, allowWhitespace = false } = options;
			    const preview = value.length > 64 ? `${value.slice(0, 64)}...` : value;
			    if (value.length === 0) {
			        throw teamContractError(code, `${field} must not be empty`, { field });
			    }
			    if (value.length > maxLength) {
			        throw teamContractError(code, `${field} exceeds max length ${maxLength} (got ${value.length})`, { field, length: value.length, maxLength });
			    }
			    if (hasControlChars(value)) {
			        throw teamContractError(code, `${field} must not contain control characters (preview: ${JSON.stringify(preview)})`, { field });
			    }
			    if (!allowWhitespace && hasWhitespace(value)) {
			        throw teamContractError(code, `${field} must not contain whitespace (preview: ${JSON.stringify(preview)})`, { field });
			    }
			}
			Object.defineProperty(exports, "assertStringRules", { enumerable: true, get: () => assertStringRules });
			/**
			 * Assert `raw` is a positive integer >= 1 (safe integer range).
			 * @param raw - the unknown input.
			 * @param field - the field name, used in the error.
			 * @throws `MALFORMED_DTO` when the input is not a positive integer.
			 */
			function assertPositiveInteger(raw, field) {
			    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 1 || !Number.isSafeInteger(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be a positive integer, got ${JSON.stringify(raw)}`, { field, value: toRemoteSafeDetail(raw) });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "assertPositiveInteger", { enumerable: true, get: () => assertPositiveInteger });
			//# sourceMappingURL=common.js.map
			}, exports: {} };
		__mods["../../contracts/src/dto/common.js"] = { done: false, fn: function (exports) {
			const __imp12 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp12.teamContractError;
			/**
			 * Shared strict-validation pipeline for versioned DTO records.
			 *
			 * Every vNext DTO is a CLOSED, lossless-JSON record: plain object only, no
			 * legacy-forbidden fields, no unknown fields (frozen shape — unknown
			 * fields mean the value comes from a different schema generation or a
			 * foreign vocabulary), schema version stamped and checked, every field
			 * individually validated, result deeply frozen.
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/dto/common
			 */
			/** Structural max length of a workspace path field. */
			const WORKSPACE_PATH_MAX_LENGTH = 1024;
			Object.defineProperty(exports, "WORKSPACE_PATH_MAX_LENGTH", { enumerable: true, get: () => WORKSPACE_PATH_MAX_LENGTH });
			/** Structural max length of a human-facing label field. */
			const LABEL_MAX_LENGTH = 128;
			Object.defineProperty(exports, "LABEL_MAX_LENGTH", { enumerable: true, get: () => LABEL_MAX_LENGTH });
			/** Structural max length of the opaque groupId field. */
			const GROUP_ID_MAX_LENGTH = 128;
			Object.defineProperty(exports, "GROUP_ID_MAX_LENGTH", { enumerable: true, get: () => GROUP_ID_MAX_LENGTH });
			/** ISO-8601 timestamp form accepted in `createdAt` fields (second precision + optional 1..6 fractional digits + UTC offset). */
			const ISO_8601_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;
			Object.defineProperty(exports, "ISO_8601_TIMESTAMP_PATTERN", { enumerable: true, get: () => ISO_8601_TIMESTAMP_PATTERN });
			/**
			 * Assert `value` is a plain record (object, not array, prototype
			 * `Object.prototype` or null) — the container every DTO must be.
			 * @param value - the unknown input.
			 * @param dtoName - the DTO name, used in the error message.
			 * @returns the input as a plain record.
			 * @throws `MALFORMED_DTO` when the input is not a plain record.
			 */
			function assertPlainRecord(value, dtoName) {
			    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
			        throw teamContractError('MALFORMED_DTO', `${dtoName} must be a plain object, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`, {});
			    }
			    const proto = Object.getPrototypeOf(value);
			    if (proto !== Object.prototype && proto !== null) {
			        throw teamContractError('MALFORMED_DTO', `${dtoName} must be a plain object (class instances are not lossless JSON)`, {});
			    }
			    return value;
			}
			Object.defineProperty(exports, "assertPlainRecord", { enumerable: true, get: () => assertPlainRecord });
			/**
			 * Reject fields not in the frozen field set of the DTO.
			 * @param record - the plain record to check.
			 * @param allowedFields - the exact frozen field names.
			 * @param dtoName - the DTO name, used in the error message.
			 * @throws `MALFORMED_DTO` when unknown fields are present (with the list).
			 */
			function assertNoUnknownFields(record, allowedFields, dtoName) {
			    const unknown = Object.keys(record).filter((key) => !allowedFields.includes(key));
			    if (unknown.length > 0) {
			        throw teamContractError('MALFORMED_DTO', `${dtoName} has unknown fields: ${unknown.sort().join(', ')}`, { unknownFields: [...unknown] });
			    }
			}
			Object.defineProperty(exports, "assertNoUnknownFields", { enumerable: true, get: () => assertNoUnknownFields });
			/**
			 * Require the presence of a field on the record.
			 * @param record - the plain record to check.
			 * @param field - the required field name.
			 * @param dtoName - the DTO name, used in the error message.
			 * @throws `MALFORMED_DTO` when the field is absent.
			 */
			function assertFieldPresent(record, field, dtoName) {
			    if (!Object.hasOwn(record, field) || record[field] === undefined) {
			        throw teamContractError('MALFORMED_DTO', `${dtoName} is missing required field '${field}'`, { field });
			    }
			}
			Object.defineProperty(exports, "assertFieldPresent", { enumerable: true, get: () => assertFieldPresent });
			/**
			 * Validate an optional workspace path field: absent is fine; present it
			 * must be a non-empty string without control characters, <= 1024 chars.
			 *
			 * Workspace paths never define Team identity (invariant 27); they are
			 * carried as plain strings only.
			 * @param raw - the raw field value.
			 * @param field - the field name, used in the error.
			 * @returns the path string, or `undefined` when the field is absent.
			 * @throws `MALFORMED_DTO` when the present value is invalid.
			 */
			function parseWorkspaceField(raw, field) {
			    if (raw === undefined)
			        return undefined;
			    if (typeof raw !== 'string' || raw.length === 0 || raw.length > WORKSPACE_PATH_MAX_LENGTH) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be a non-empty string of at most ${WORKSPACE_PATH_MAX_LENGTH} chars`, { field });
			    }
			    for (let i = 0; i < raw.length; i++) {
			        const code = raw.charCodeAt(i);
			        if (code < 0x20 || code === 0x7f) {
			            throw teamContractError('MALFORMED_DTO', `${field} must not contain control characters`, { field });
			        }
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseWorkspaceField", { enumerable: true, get: () => parseWorkspaceField });
			/**
			 * Validate a human-facing label / opaque groupId field: non-empty string,
			 * no control characters, <= 128 chars. Neither value is an identity
			 * (invariant 19 / invariant 20).
			 * @param raw - the raw field value.
			 * @param field - the field name, used in the error.
			 * @param max - the max length (LABEL_MAX_LENGTH or GROUP_ID_MAX_LENGTH).
			 * @returns the validated string.
			 * @throws `MALFORMED_DTO` when the value is invalid.
			 */
			function parseLabelLikeField(raw, field, max) {
			    if (typeof raw !== 'string' || raw.length === 0 || raw.length > max) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be a non-empty string of at most ${max} chars`, { field });
			    }
			    for (let i = 0; i < raw.length; i++) {
			        const code = raw.charCodeAt(i);
			        if (code < 0x20 || code === 0x7f) {
			            throw teamContractError('MALFORMED_DTO', `${field} must not contain control characters`, { field });
			        }
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseLabelLikeField", { enumerable: true, get: () => parseLabelLikeField });
			/**
			 * Validate a `createdAt` field: ISO-8601 timestamp (second precision,
			 * optional 1..6 fractional digits, explicit UTC offset).
			 * @param raw - the raw field value.
			 * @returns the timestamp string.
			 * @throws `MALFORMED_DTO` when the value is not a valid ISO-8601 timestamp.
			 */
			function parseIso8601TimestampField(raw) {
			    if (typeof raw !== 'string' ||
			        !ISO_8601_TIMESTAMP_PATTERN.test(raw) ||
			        Number.isNaN(Date.parse(raw))) {
			        throw teamContractError('MALFORMED_DTO', `createdAt must be an ISO-8601 timestamp (e.g. 2026-08-29T12:00:00Z), got ${JSON.stringify(raw)}`, { field: 'createdAt' });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseIso8601TimestampField", { enumerable: true, get: () => parseIso8601TimestampField });
			//# sourceMappingURL=common.js.map
			}, exports: {} };
		__mods["../../contracts/src/projection/common.js"] = { done: false, fn: function (exports) {
			const __imp17 = __req("../../contracts/src/ids/common.js");
			const hasControlChars = __imp17.hasControlChars;
			const __imp18 = __req("../../contracts/src/errors.js");
			const teamContractError = __imp18.teamContractError;
			const __imp19 = __req("../../contracts/src/remote-safe.js");
			const toRemoteSafeDetail = __imp19.toRemoteSafeDetail;
			/**
			 * Shared strict-validation helpers for the projection DTO family (P8-T1).
			 *
			 * The projection family (TeamProjectionDto and the records it embeds) reuses
			 * the shared DTO pipeline (../dto/common.js) and adds the two projection-local
			 * helpers that have no place in the P3-T1-frozen shared modules:
			 *
			 * - non-negative safe-integer assertions, for counters that may legitimately
			 *   be zero (ledger entry counts, creation budget consumed) — the shared
			 *   `assertPositiveInteger` rejects 0 by design of the record family;
			 * - a bounded opaque-string parser, for fingerprint / correlation fields that
			 *   are opaque to the contract (no charset beyond the structural rules is
			 *   assumed or required, mirroring the session-id boundary discipline).
			 *
			 * Pure module: no I/O, no runtime environment assumptions.
			 * @module @dsh-agent-team/contracts/projection/common
			 */
			/**
			 * Copy a producer input value into a plain record for the validation
			 * pipeline (the single lossless-JSON trust point of the `create*` paths).
			 *
			 * Inputs to the `create*` functions are contract values: branded ids,
			 * strings, numbers, `null`, nested plain records, and arrays of them —
			 * never class instances, `Date`, `Map`/`Set`, or functions. The cast
			 * erases only the interface types; the SAME validation pipeline as
			 * `parse*` then re-validates every field (structure, field set, types,
			 * invariants) before anything is returned, so an input that violates the
			 * discipline still fails with a contract error.
			 * @param value - the producer input value (a plain contract value).
			 * @returns a fresh plain record for the validation pipeline.
			 */
			function toRecord(value) {
			    return { ...value };
			}
			Object.defineProperty(exports, "toRecord", { enumerable: true, get: () => toRecord });
			/**
			 * Assert `raw` is a non-negative safe integer (>= 0) and return it.
			 * @param raw - the raw field value.
			 * @param field - the field name, used in the error.
			 * @returns the validated number.
			 * @throws `MALFORMED_DTO` when the value is not a non-negative safe integer.
			 */
			function assertNonNegativeInteger(raw, field) {
			    if (typeof raw !== 'number' ||
			        !Number.isInteger(raw) ||
			        raw < 0 ||
			        !Number.isSafeInteger(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be a non-negative safe integer, got ${JSON.stringify(raw)}`, { field, value: toRemoteSafeDetail(raw) });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "assertNonNegativeInteger", { enumerable: true, get: () => assertNonNegativeInteger });
			/**
			 * Validate an opaque bounded string field (fingerprint, correlation id):
			 * non-empty, no control characters, <= `max` chars. The contract does not
			 * interpret the value; the structural rules only keep it usable across the
			 * wire and in storage.
			 * @param raw - the raw field value.
			 * @param field - the field name, used in the error.
			 * @param max - the max length.
			 * @returns the validated string.
			 * @throws `MALFORMED_DTO` when the value is not a valid opaque string.
			 */
			function parseOpaqueField(raw, field, max) {
			    if (typeof raw !== 'string' || raw.length === 0 || raw.length > max) {
			        throw teamContractError('MALFORMED_DTO', `${field} must be a non-empty string of at most ${max} chars`, { field });
			    }
			    if (hasControlChars(raw)) {
			        throw teamContractError('MALFORMED_DTO', `${field} must not contain control characters`, { field });
			    }
			    return raw;
			}
			Object.defineProperty(exports, "parseOpaqueField", { enumerable: true, get: () => parseOpaqueField });
			//# sourceMappingURL=common.js.map
			}, exports: {} };
		__req("plugin/client.js");
		return module.exports;
	}
});
