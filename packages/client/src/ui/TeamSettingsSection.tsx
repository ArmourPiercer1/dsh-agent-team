/**
 * The minimal Team settings section (plan P9-S6: "settings.section ->
 * optional minimal Team settings/help"): the adapted legacy help surface
 * (the reuse-audit ADAPT list; the frozen legacy fork's
 * `ui-team/src/client/TeamSettingsSection.tsx` is the evidence source).
 *
 * No store, no inject face, no service: the section renders the migrated
 * T1 locale dictionary through the standard `t` seat. The migrated copy
 * still describes the legacy Markdown teammate mechanism; refreshing it to
 * the vNext blueprint flow is a follow-up outside the T9 mount scope (the
 * plan calls this section "optional minimal").
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import styles from './TeamSettingsSection.module.css'

/** The settings-section props: the runtime share (owner `close`) + the locale seat. */
export type TeamSettingsSectionProps =
  & PropsRuntime<'settings.section'>
  & PropsLocale<'team'>

/**
 * Team settings section: shows the configuration status and the
 * instructions for configuring team members.
 * @param props - the composed section props (only the `t` seat is consumed).
 */
export function TeamSettingsSection({ t }: TeamSettingsSectionProps): React.JSX.Element {
  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{t('title')}</h3>
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>{t('empty.title')}</p>
        <p className={styles.emptyDescription}>{t('empty.description')}</p>
        <ol className={styles.steps}>
          <li><code>{t('empty.step1')}</code></li>
          <li><code>{t('empty.step2')}</code></li>
          <li>{t('empty.step3')}</li>
        </ol>
      </div>
    </div>
  )
}
