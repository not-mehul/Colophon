<script lang="ts">
  // Inspection: the verdict, the diagnostic ledger (seven checks), the
  // validation list with one-tap fixes, and the report card.
  import { tierOf, type Check } from '../epub/audit';
  import type { Issue } from '../epub/validate';
  import { settle } from '../lib/appear';
  import { fileSize, plural } from '../lib/format';
  import { bench } from '../state/bench.svelte';
  import { settings } from '../state/settings.svelte';
  import { ui } from '../state/ui.svelte';
  import Icon from './ui/Icon.svelte';
  import type { IconName } from './ui/icons';
  import Meter from './ui/Meter.svelte';
  import ScoreDial from './ui/ScoreDial.svelte';

  const edition = $derived(bench.edition!);
  const tier = $derived(tierOf(bench.audit.score));
  const images = $derived(edition.manifest.filter((m) => m.mediaType.startsWith('image/')).length);
  const fixable = $derived(bench.issues.filter((i) => i.fix && i.fix.kind !== 'on-bind'));
  const failing = $derived(bench.issues.filter((i) => i.severity === 'fail').length);

  const STATUS_ICON: Record<string, IconName> = { pass: 'check', warn: 'triangle-alert', fail: 'circle-x' };
  const KIND_ICON: Record<Issue['kind'], IconName> = {
    container: 'package',
    'missing-file': 'file-warning',
    spine: 'list-ordered',
    malformed: 'file-code',
    'broken-link': 'link-2-off',
    'missing-image': 'image-off',
    'missing-style': 'file-warning',
    'missing-font': 'type',
  };

  /** Fixes the ledger can make without leaving Inspection. */
  function quickFixes(check: Check): { label: string; icon: IconName; run: () => void }[] {
    const out: { label: string; icon: IconName; run: () => void }[] = [];
    if (check.id === 'cover' && check.items.some((i) => i.text.startsWith('Tagged for one')) && !bench.draft.dualCoverTags) {
      out.push({ label: 'Write both tags', icon: 'tags', run: () => bench.fixCoverTags() });
    }
    if (check.id === 'manifest' && bench.orphans.length) out.push({ label: 'Remove orphans', icon: 'trash-2', run: () => bench.removeOrphans() });
    if (check.id === 'access' && bench.access) {
      if (bench.access.missingAlt.length) out.push({ label: 'Add alt text', icon: 'image', run: () => ui.open('altText') });
      if (bench.access.missingLang.length) out.push({ label: 'Declare language', icon: 'languages', run: () => bench.addLanguage() });
      if (!bench.access.readingOrder) out.push({ label: 'Order contents', icon: 'list-tree', run: () => bench.orderToc() });
      out.push({ label: bench.access.missingMetadata.length ? 'Add metadata' : 'Metadata', icon: 'accessibility', run: () => ui.open('a11y') });
    }
    return out;
  }
</script>

<section class="panel verdict-panel" aria-labelledby="verdictHeading" use:settle={`verdict:${bench.id}`}>
  <div class="verdict">
    <ScoreDial score={bench.audit.score} size={112} stroke={6} labelled label="Score {bench.audit.score} of 100" />
    <div class="verdict-text">
      <p class="eyebrow" style:color="var({tier.cssVar})">{tier.name}</p>
      <h2 class="t-verdict" id="verdictHeading">{tier.verdict}</h2>
      <p class="t-body-small dim">{tier.hint}</p>
    </div>
  </div>
  <div class="hairline-grid stat-grid">
    <div class="stat-tile"><span class="t-stat tabular">{edition.chapters.length}</span><span class="t-field-label">Chapters</span></div>
    <div class="stat-tile"><span class="t-stat tabular">{edition.totalWords >= 10000 ? `${Math.round(edition.totalWords / 1000)}k` : edition.totalWords.toLocaleString('en')}</span><span class="t-field-label">Words</span></div>
    <div class="stat-tile"><span class="t-stat tabular">{images}</span><span class="t-field-label">Images</span></div>
    <div class="stat-tile"><span class="t-stat tabular">{fileSize(edition.fileSize)}</span><span class="t-field-label">EPUB {edition.version}</span></div>
  </div>
  <div class="btn-row btn-row-start">
    <button type="button" class="btn btn-secondary" id="shareReport" onclick={() => ui.open('report')}><Icon name="share-2" />Report card</button>
  </div>
</section>

<section class="section-block" aria-labelledby="ledgerHeading">
  <div class="section-head">
    <h2 class="t-section-heading" id="ledgerHeading">Diagnostic <em>ledger</em></h2>
  </div>
  <ol class="panel ledger" aria-label="Checks">
    {#each bench.audit.checks as check (check.id)}
      {@const fixes = quickFixes(check)}
      <li class="ledger-row" id="check-{check.id}" use:settle={`row:${bench.id}:${check.id}`}>
        <div class="ledger-head">
          <h3 class="t-card-title">{check.title}</h3>
          <span class="t-data-small tabular" class:amber={check.score < check.max}>{check.score} / {check.max}</span>
        </div>
        <Meter value={check.score} max={check.max} key="{bench.id}:{check.id}" label="{check.title}: {check.score} of {check.max}" />
        <ul class="check-items">
          {#each check.items as item, i (i)}
            <li class="check-item is-{item.status}"><Icon name={STATUS_ICON[item.status]!} /><span>{item.text}</span></li>
          {/each}
        </ul>
        {#if fixes.length || check.action}
          <div class="chip-row">
            {#each fixes as fix (fix.label)}
              <button type="button" class="chip" onclick={fix.run}><Icon name={fix.icon} />{fix.label}</button>
            {/each}
            {#if check.action}
              {@const action = check.action}
              <button type="button" class="chip" onclick={() => ui.go(action.tab)}>{action.label}<Icon name="chevron-right" /></button>
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
</section>

<section class="section-block" aria-labelledby="validationHeading">
  <div class="section-head">
    <h2 class="t-section-heading" id="validationHeading"><em>Validation</em></h2>
    <span class="t-data-small dim">{bench.issues.length ? `${plural(failing, 'error')}, ${plural(bench.issues.length - failing, 'warning')}` : 'clean'}</span>
    {#if fixable.length > 1}
      <button type="button" class="btn btn-secondary section-head-action" id="fixAll" onclick={() => bench.fixAll()}><Icon name="wrench" />Fix {fixable.length}</button>
    {/if}
  </div>
  {#if !bench.issues.length}
    <p class="empty-match">No problems found. Every file the package lists is present, well formed and linked.</p>
  {:else}
    <ul class="panel issue-list" aria-label="Problems">
      {#each bench.issues as issue (issue.key)}
        <li class="issue-row is-{issue.severity}" use:settle={`issue:${bench.id}:${issue.key}`}>
          <Icon name={KIND_ICON[issue.kind]} />
          <div class="issue-text">
            <p class="issue-title">{issue.title}</p>
            <p class="t-body-small dim">{issue.detail}</p>
            <p class="t-data-small faint ellipsis">{issue.path}</p>
          </div>
          {#if issue.fix}
            {@const fix = issue.fix}
            {#if fix.kind === 'on-bind'}
              <span class="chip-status is-done">{fix.label}</span>
            {:else}
              <button type="button" class="btn btn-secondary" onclick={() => bench.applyFix(fix)}>{fix.label}</button>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

{#if settings.value.purgeOrphans && edition.orphans.length}
  <p class="field-hint">Orphan files are left out when you bind (Settings).</p>
{/if}
