import { levels, commissions, getLevel } from './content/levels.js';
import { chapters } from './content/chapters.js';
import {
  newRun,
  chooseStart,
  move,
  undo,
  graphFor,
  confirmBlueprint,
  restoreRun,
} from './model/commands.js';
import { applyEdits, repairSolution } from './model/repair.js';
import {
  actionableBridges,
  bridgeAction,
  candidateFor,
  isProtected,
  nodeAction,
  visibleEdges,
} from './model/interaction.js';
import { degrees } from './model/graph.js';
import { storageAdapter, recordCompletion } from './storage.js';
import {
  resolveSaveKey,
  resolveSavedSelection,
  levelUnlocked as isLevelUnlocked,
  sanitizeProgress,
  chapterUnlocked as isChapterUnlocked,
} from './services/progress.js';
import { initialSettings } from './services/settings.js';
import { dailyEntry, dailyKey } from './services/daily.js';
import { manifest } from './content/daily-manifest.js';
import { hint } from './services/hints.js';
import { postcardBlob, downloadBlob } from './services/export.js';
import { geometry } from './render/geometry.js';
import { citySVG } from './render/city.js';
import { bridgeLabel, bridgeName } from './render/labels.js';
import { motionController } from './render/motion.js';
import { attachPointer } from './input/pointer.js';
import { attachKeyboard } from './input/keyboard.js';
import { audioService } from './audio.js';
import { t, name } from './i18n.js';
const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export function startGame() {
  const store = storageAdapter(),
    sound = audioService();
  let snapshot = sanitizeProgress(store.read()),
    settings = initialSettings(snapshot.settings, location.search, navigator.language);
  let level = null,
    run = null,
    key = null,
    daily = null,
    view = 'city',
    counts = false,
    highlight = [],
    message = '',
    hintResult = null,
    geo = null,
    dialogAction = null,
    sceneGeneration = 0,
    dialogCleanup = null;
  const tr = (k) => t(settings.lang, k),
    nm = (p) => name(settings.lang, p);
  const dailyMode = () => key?.startsWith('daily:');
  const motion = motionController((next) => {
    if (next && !document.hidden) submit(next);
  });
  const frozenKey = (entry, type) => dailyKey(entry, type);
  const resolveKey = resolveSaveKey;
  const objectiveText = () =>
    tr(level.kind === 'discovery' ? 'discover' : level.fixedEnd ? 'fixed' : level.objective);
  function save() {
    snapshot = { ...snapshot, settings, runs: { ...snapshot.runs, [key]: run }, lastLevel: key };
    const success = store.trySet(snapshot);
    $('save-warning').hidden = success;
    $('save-warning').querySelector('span').textContent = tr('saveFailed');
    $('retry-save').textContent = tr('retry');
    $('saved-state').textContent = success ? tr('saved') : '';
    return success;
  }
  function graph() {
    return graphFor(level, run);
  }
  const chapterUnlocked = (id) => isChapterUnlocked(snapshot, id);
  const levelUnlocked = (target) => isLevelUnlocked(snapshot, target);
  const canSelect = (selection) =>
    !!selection && (!!selection.entry || levelUnlocked(selection.level));
  function markAssistance() {
    run = { ...run, assistance: true };
    if (dailyMode()) snapshot.assistance[key] = true;
    save();
  }
  function complete() {
    if (run.phase !== 'complete') return;
    const cost = level.kind === 'repair' ? applyEdits(level, run.finalEditSet).cost : 0;
    snapshot = recordCompletion(snapshot, key, level, run, cost);
    save();
  }
  function select(l, k = l.id, entry = null) {
    if (run) save();
    motion.cancel();
    cancelPointer();
    sceneGeneration++;
    level = l;
    key = k;
    daily = entry;
    view = 'city';
    counts = false;
    highlight = [];
    hintResult = null;
    message = '';
    run =
      restoreRun(level, snapshot.runs[key]) ??
      newRun(level, !!snapshot.assistance[key] && k.startsWith('daily:'));
    if (dailyMode() && snapshot.assistance[key]) run.assistance = true;
    if (run.phase === 'discovery') {
      view = 'graph';
    }
    save();
    render();
    complete();
    const hash = daily
      ? `daily/${daily.date}/${key.endsWith('repair') ? 'repair' : 'walk'}`
      : level.id;
    history.replaceState(null, '', `#${hash}`);
  }
  function showDialog(title, html, onAction = null) {
    dialogCleanup?.();
    dialogCleanup = null;
    dialogAction = onAction;
    $('dialog-title').textContent = title;
    $('dialog-content').innerHTML = html;
    $('dialog-close').ariaLabel = tr('close');
    if (!$('dialog').open) $('dialog').showModal();
  }
  function closeDialog() {
    dialogCleanup?.();
    dialogCleanup = null;
    $('dialog').close();
    dialogAction = null;
  }
  $('dialog-close').onclick = closeDialog;
  $('dialog').addEventListener('close', () => {
    dialogCleanup?.();
    dialogCleanup = null;
  });
  $('dialog-content').addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (button && !button.disabled) dialogAction?.(button.dataset.action, button);
  });
  function renderScene() {
    geo = geometry(level, matchMedia('(max-width:700px)').matches);
    const focused = document.activeElement?.closest('[data-bridge],[data-node]')?.dataset;
    $('stage').innerHTML = citySVG(level, graph(), run, geo, {
      lang: settings.lang,
      view,
      counts,
      hintIds: highlight,
    });
    if (focused?.bridge)
      $('stage').querySelector(`[data-bridge="${focused.bridge}"]`)?.focus({ preventScroll: true });
    if (focused?.node)
      $('stage').querySelector(`[data-node="${focused.node}"]`)?.focus({ preventScroll: true });
  }
  function render() {
    document.documentElement.lang = settings.lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.theme = settings.theme;
    for (const [id, text] of [
      ['brand-title', 'title'],
      ['map-button', 'map'],
      ['help-button', 'help'],
      ['tagline', 'tagline'],
      ['subtitle', 'subtitle'],
      ['daily-label', 'daily'],
      ['route-title', 'route'],
      ['collection-link', 'allGames'],
    ])
      $(id).textContent = tr(text);
    $('settings-button').ariaLabel = tr('settings');
    $('main-nav').ariaLabel = tr('mainNav');
    $('journey-controls').ariaLabel = tr('journeyControls');
    $('daily-date').textContent = dailyEntry()?.date ?? '—';
    $('chapter-label').textContent = nm([
      chapters[level.chapter - 1]?.zh,
      chapters[level.chapter - 1]?.en,
    ]);
    $('view-label').textContent = view === 'city' ? 'CITY ATLAS' : 'RELATION GRAPH';
    $('level-number').textContent = daily ? daily.date : level.id;
    $('mobile-level-title').textContent = `${level.id} · ${nm(level.title)}`;
    $('stage-note').textContent = objectiveText();
    $('mode-label').textContent =
      level.kind === 'repair'
        ? tr('planning')
        : level.kind === 'discovery'
          ? tr('discoveryStamp')
          : daily
            ? tr('daily')
            : `${String(level.chapter).padStart(2, '0')} / 04`;
    $('level-title').textContent = nm(level.title);
    $('objective').textContent = objectiveText();
    const g = graph();
    $('progress-number').textContent = `${run.walkedEdgeIds.length} / ${g.edges.length}`;
    $('progress-label').textContent = tr('walked');
    $('progress-dots').innerHTML = g.edges
      .map((e) => `<i class="${run.walkedEdgeIds.includes(e.id) ? 'lit' : ''}"></i>`)
      .join('');
    $('start-fact').textContent =
      `${tr('from')} · ${level.fixedStart ?? run.startNode ?? tr('free')}`;
    $('end-fact').textContent =
      `${tr('to')} · ${level.objective === 'return' ? (run.startNode ?? tr('free')) : (level.fixedEnd ?? tr('free'))}`;
    $('route-history').textContent = run.history.join(' → ') || '—';
    const defaultMessage =
      run.phase === 'planning'
        ? tr('planTip')
        : run.phase === 'complete'
          ? tr('finish')
          : run.phase === 'stuck'
            ? tr('stuck')
            : !run.currentNode
              ? tr('start')
              : level.story
                ? nm(level.story)
                : tr('ready');
    $('message').textContent = message || defaultMessage;
    $('undo-button').querySelector('span:last-child').textContent = tr(
      run.phase === 'planning' ? 'planUndo' : 'undo',
    );
    $('undo-button').disabled =
      run.phase === 'planning'
        ? !run.editHistory.length
        : run.phase === 'discovery' || !run.walkedEdgeIds.length;
    $('lens-button').querySelector('span:last-child').textContent = tr(
      view === 'city' ? 'lens' : 'city',
    );
    $('lens-button').setAttribute('aria-pressed', String(view === 'graph'));
    $('hint-button').querySelector('span:last-child').textContent = tr('hint');
    $('hint-button').disabled = ['planning', 'complete', 'discovery'].includes(run.phase);
    $('restart-button').querySelector('span:last-child').textContent = tr('restart');
    renderEngineering();
    renderDiscovery();
    renderHint();
    renderCompletion();
    renderScene();
    if (store.failed) {
      $('save-warning').querySelector('span').textContent = tr('saveFailed');
      $('retry-save').textContent = tr('retry');
    }
  }
  function renderEngineering() {
    const host = $('engineering');
    host.hidden = level.kind !== 'repair';
    if (host.hidden) {
      host.innerHTML = '';
      return;
    }
    if (run.phase === 'planning') {
      const cost = run.draftEdits.reduce(
        (n, id) => n + (level.candidateEdits.find((e) => e.id === id)?.cost ?? 1),
        0,
      );
      host.innerHTML = `<small>${tr('budget')} · ${cost} / ${level.budget}</small><p class="dialog-note">${tr('serviceAreas')} · ${level.protectedEdges.length ? `${tr('protectedCount')}: ${level.protectedEdges.length}` : ''}</p><div class="works-list">${level.candidateEdits
        .filter((edit) => !(edit.kind === 'remove' && isProtected(level, edit.edgeId)))
        .map(
          (edit) =>
            `<button data-edit="${edit.id}" aria-pressed="${run.draftEdits.includes(edit.id)}"><span>${tr(edit.kind)} · ${escape(bridgeName(level, edit.kind === 'add' ? edit.edge : level.edges.find((e) => e.id === edit.edgeId), settings.lang))}</span><span>${run.draftEdits.includes(edit.id) ? '✓' : '+'}</span></button>`,
        )
        .join('')}</div><button id="confirm-blueprint" class="primary">${tr('confirm')}</button>`;
      host
        .querySelectorAll('[data-edit]')
        .forEach((b) => (b.onclick = () => toggleEdit(b.dataset.edit)));
      $('confirm-blueprint').onclick = () => {
        try {
          const confirmed = confirmBlueprint(level, run);
          run = confirmed;
          message = tr('built');
          save();
          render();
        } catch {
          message = tr('invalidPlan');
          render();
        }
      };
    } else {
      host.innerHTML = `<small>${tr('cost')} · ${applyEdits(level, run.finalEditSet).cost}</small><button id="edit-blueprint">${tr('edit')}</button>`;
      $('edit-blueprint').onclick = () =>
        showDialog(
          tr('edit'),
          `<p class="help-copy">${tr('editWarn')}</p><button class="primary" data-action="edit">${tr('confirmEdit')}</button>`,
          () => {
            motion.cancel();
            cancelPointer();
            run = { ...newRun(level, run.assistance), draftEdits: [...run.finalEditSet] };
            message = '';
            save();
            closeDialog();
            render();
          },
        );
    }
  }
  function toggleEdit(id) {
    if (run.phase !== 'planning') return;
    const edit = level.candidateEdits.find((e) => e.id === id);
    if (!edit) return;
    if (edit.kind === 'remove' && level.protectedEdges.includes(edit.edgeId)) {
      message = tr('protected');
      render();
      return;
    }
    const proposed = run.draftEdits.includes(id)
      ? run.draftEdits.filter((e) => e !== id)
      : [...run.draftEdits, id];
    const cost = proposed.reduce(
      (n, e) => n + (level.candidateEdits.find((c) => c.id === e)?.cost ?? 1),
      0,
    );
    if (cost > level.budget) {
      message = tr('overBudget');
      render();
      return;
    }
    run = { ...run, draftEdits: proposed, editHistory: [...run.editHistory, [...run.draftEdits]] };
    message = '';
    save();
    render();
  }
  function renderDiscovery() {
    const host = $('discovery');
    host.hidden = level.kind !== 'discovery' || run.phase === 'complete';
    if (host.hidden) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML = `<button id="begin-discovery">${tr('discover')}</button>${run.phase === 'discovery' ? `<p class="dialog-note">${tr('discoverTip')}</p><div class="pairing" role="img" aria-label="${settings.lang === 'zh' ? '进入离开两两配对，剩一个端头' : 'Arrivals and departures pair, leaving one end'}">${level.nodes.map((n) => `<span>${n.id}: ${'Ⅱ'.repeat(Math.floor(degrees(level)[n.id] / 2))} •</span>`).join('')}</div><button id="explain-discovery" class="primary">${tr('explain')}</button>` : ''}<button id="counts-button" aria-pressed="${counts}">${tr('counts')}</button>`;
    $('begin-discovery').onclick = () => {
      motion.cancel();
      run = { ...run, phase: 'discovery' };
      view = 'graph';
      message = '';
      save();
      render();
    };
    $('counts-button').onclick = () => {
      counts = !counts;
      markAssistance();
      render();
    };
    if ($('explain-discovery'))
      $('explain-discovery').onclick = () => {
        if (new Set(run.discoveryNodes).size !== 4) {
          message = tr('chooseFour');
          render();
          return;
        }
        showDialog(
          tr('discover'),
          `<div class="stamp">Ⅱ •</div><p class="help-copy">${tr('explainText')}</p><button class="primary" data-action="understand">${tr('understand')}</button>`,
          () => {
            run = { ...run, phase: 'complete', explained: true };
            closeDialog();
            complete();
            render();
          },
        );
      };
  }
  function renderHint() {
    const host = $('hint-detail');
    host.innerHTML = '';
    if (!hintResult) return;
    let text = '';
    if (hintResult.kind === 'remaining') text = tr('hintRemaining') + hintResult.groups;
    if (hintResult.kind === 'pair') text = tr('hintPair');
    if (hintResult.kind === 'next') text = tr('hintNext') + (hintResult.edge ?? '—');
    if (hintResult.kind === 'start') text = tr('hintStart');
    if (hintResult.kind === 'rewind') text = tr('hintRewind') + hintResult.node;
    host.innerHTML = `<div class="hint-card">${escape(text)}${hintResult.kind === 'rewind' ? `<button id="rewind-hint">${tr('rewind')} · ${hintResult.steps}</button>` : ''}</div>`;
    if ($('rewind-hint'))
      $('rewind-hint').onclick = () => {
        motion.cancel();
        cancelPointer();
        while (run.walkedEdgeIds.length > hintResult.index) run = undo(run);
        hintResult = null;
        highlight = [];
        message = '';
        save();
        render();
      };
  }
  function renderCompletion() {
    const banner = $('complete-banner'),
      host = $('journal-actions');
    banner.hidden = run.phase !== 'complete';
    host.innerHTML = '';
    if (run.walkedEdgeIds.length > 1) {
      host.innerHTML = `<button id="replay-button">${tr('replay')}</button>`;
      $('replay-button').onclick = openReplay;
    }
    if (banner.hidden) {
      banner.innerHTML = '';
      return;
    }
    const bucket = level.kind === 'discovery' ? snapshot.discoveries : snapshot.completions;
    const stamp =
      level.kind === 'discovery'
        ? tr('discoveryStamp')
        : run.assistance
          ? tr('assisted')
          : tr('independent');
    let optimal = false;
    if (level.kind === 'repair') {
      const proof = repairSolution(level);
      optimal = proof && proof.cost === applyEdits(level, run.finalEditSet).cost;
    }
    banner.innerHTML = `<div><strong>${escape(stamp)}</strong><small>${optimal ? tr('optimal') : nm(level.title)}</small></div><button class="primary" id="next-level">${tr('next')} →</button>`;
    $('next-level').onclick = () => {
      if (dailyMode()) {
        openAtlas();
        return;
      }
      const index = levels.findIndex((l) => l.id === level.id);
      if (index < 0) {
        openAtlas('works');
        return;
      }
      const next = levels[index + 1];
      if (next && chapterUnlocked(next.chapter)) select(next);
      else openAtlas();
    };
    host.innerHTML += `<button id="postcard-button">${tr('postcard')} ↗</button>${bucket[key]?.independent && bucket[key]?.assisted ? `<small>${tr('independent')} ✓ · ${tr('assisted')} ✓</small>` : ''}`;
    if ($('replay-button')) $('replay-button').onclick = openReplay;
    $('postcard-button').onclick = () => openPostcard();
  }
  function submit(id) {
    if (document.hidden || $('dialog').open || $('stage').classList.contains('morphing')) return;
    if (run.phase === 'planning') {
      if (bridgeAction(level, graph(), run, id) === 'edit') toggleEdit(candidateFor(level, id).id);
      else {
        message = tr(isProtected(level, id) ? 'protected' : 'notEditable');
        render();
      }
      return;
    }
    // Discovery and completed runs have no crossings to take; keep their guidance in place.
    // Walking phases still reach move() so used or remote bridges explain why they are closed.
    if (!['walking', 'stuck'].includes(run.phase)) return;
    if (motion.busy) {
      motion.enqueue(id);
      return;
    }
    const g = graph(),
      from = run.currentNode,
      result = move(g, run, id);
    if (result.error) {
      message = tr(result.error);
      $('message').textContent = message;
      return;
    }
    run = result.run;
    message = '';
    highlight = [];
    hintResult = null;
    save();
    complete();
    render();
    if (run.phase === 'complete' && document.activeElement?.closest('[data-bridge]'))
      $('next-level')?.focus({ preventScroll: true });
    const edge = g.edges.find((e) => e.id === id);
    if (!settings.muted) void sound.step(edge.material, () => !settings.muted && !document.hidden);
    motion.walk(
      $('stage').querySelector('.traveler'),
      geo.curves[id],
      geo.nodes[from],
      geo.nodes[run.currentNode],
    );
  }
  function selectNode(id) {
    if (document.hidden || motion.busy || $('dialog').open) return;
    const action = nodeAction(level, run, id);
    if (!action) return;
    if (action === 'toggle') {
      const selected = run.discoveryNodes.includes(id)
        ? run.discoveryNodes.filter((n) => n !== id)
        : [...run.discoveryNodes, id];
      run = { ...run, discoveryNodes: selected };
      message = '';
    } else {
      run = chooseStart(level, run, id);
      message = '';
    }
    save();
    render();
  }
  function chooseBridge(edges) {
    showDialog(
      tr('chooseBridge'),
      edges
        .map(
          (e) =>
            `<button data-action="${e.id}">${escape(bridgeLabel(level, graph(), run, e, settings.lang))}</button>`,
        )
        .join(''),
      (id) => {
        closeDialog();
        submit(id);
      },
    );
  }
  const cancelPointer = attachPointer(
    $('stage'),
    () => {
      const g = graph();
      return {
        geo,
        graph: { ...g, edges: visibleEdges(level, g, run) },
        run,
        canSelectNode: (id) => !!nodeAction(level, run, id),
        walkable: (id) => bridgeAction(level, g, run, id) === 'walk',
        locked: motion.busy || run.phase === 'discovery' || $('dialog').open,
      };
    },
    submit,
    selectNode,
    chooseBridge,
  );
  attachKeyboard($('stage'), submit, selectNode, () => actionableBridges(level, graph(), run));
  $('undo-button').onclick = () => {
    motion.cancel();
    cancelPointer();
    if (run.phase === 'planning') {
      if (run.editHistory.length)
        run = {
          ...run,
          draftEdits: run.editHistory.at(-1),
          editHistory: run.editHistory.slice(0, -1),
        };
    } else run = undo(run);
    hintResult = null;
    highlight = [];
    message = '';
    save();
    render();
  };
  $('restart-button').onclick = () => {
    motion.cancel();
    cancelPointer();
    const fresh = newRun(level, dailyMode() ? run.assistance || !!snapshot.assistance[key] : false);
    if (level.kind === 'repair' && run.phase !== 'planning') {
      fresh.phase = 'walking';
      fresh.finalEditSet = [...run.finalEditSet];
      fresh.draftEdits = [...run.finalEditSet];
    }
    run = fresh;
    message = '';
    highlight = [];
    hintResult = null;
    counts = false;
    save();
    render();
  };
  $('lens-button').onclick = () => {
    cancelPointer();
    view = view === 'city' ? 'graph' : 'city';
    $('lens-button').querySelector('span:last-child').textContent = tr(
      view === 'city' ? 'lens' : 'city',
    );
    $('lens-button').setAttribute('aria-pressed', String(view === 'graph'));
    $('view-label').textContent = view === 'city' ? 'CITY ATLAS' : 'RELATION GRAPH';
    motion.morph($('stage'), view);
  };
  $('hint-button').onclick = () => {
    if (level.kind === 'discovery') {
      markAssistance();
      $('begin-discovery')?.click();
      return;
    }
    motion.cancel();
    cancelPointer();
    if (!run.currentNode) {
      markAssistance();
      counts = true;
      message = Object.values(degrees(graph())).some((degree) => degree % 2)
        ? tr('hintStart')
        : tr('start');
      render();
      return;
    }
    markAssistance();
    run = { ...run, hintTier: Math.min(3, (run.hintTier ?? 0) + 1) };
    hintResult = hint(graph(), run, run.hintTier);
    highlight = hintResult.ids ?? (hintResult.edge ? [hintResult.edge] : []);
    if (run.hintTier === 2) counts = true;
    save();
    render();
  };
  $('retry-save').onclick = save;
  $('help-button').onclick = () =>
    showDialog(tr('help'), `<p class="help-copy">${tr('helpText')}</p>`);
  $('settings-button').onclick = openSettings;
  function openSettings() {
    motion.cancel();
    cancelPointer();
    showDialog(
      tr('settings'),
      `<label class="settings-row">${tr('language')}<select id="lang-select"><option value="zh" ${settings.lang === 'zh' ? 'selected' : ''}>简体中文</option><option value="en" ${settings.lang === 'en' ? 'selected' : ''}>English</option></select></label><label class="settings-row">${tr('theme')}<select id="theme-select"><option value="light" ${settings.theme === 'light' ? 'selected' : ''}>${tr('light')}</option><option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>${tr('dark')}</option></select></label><div class="settings-row"><span>${tr('sound')}</span><button data-action="sound">${tr(settings.muted ? 'muted' : 'on')}</button></div>`,
      async (action, button) => {
        if (action !== 'sound') return;
        if (!settings.muted) {
          settings.muted = true;
          sound.suspend();
        } else {
          const enabled = await sound.enable();
          if (!enabled) {
            button.textContent = tr('soundFail');
            return;
          }
          settings.muted = false;
        }
        save();
        button.textContent = tr(settings.muted ? 'muted' : 'on');
      },
    );
    $('lang-select').onchange = (e) => {
      settings.lang = e.target.value;
      save();
      render();
      openSettings();
    };
    $('theme-select').onchange = (e) => {
      settings.theme = e.target.value;
      save();
      render();
    };
  }
  function levelCard(l, disabled = false) {
    const completion = snapshot.completions[l.id] ?? snapshot.discoveries[l.id];
    const done = completion?.independent || completion?.assisted;
    return `<button class="level-card" data-action="level:${l.id}" ${disabled ? 'disabled' : ''}><strong>${l.id.slice(2)}${done ? ' · ✓' : ''}</strong>${escape(nm(l.title))}<small>${done ? `<br>${completion.independent ? tr('independent') : tr('assisted')}` : ''}${snapshot.runs[l.id]?.walkedEdgeIds?.length && !done ? `<br>${tr('resume')}` : ''}</small></button>`;
  }
  function openAtlas(tab = 'main') {
    motion.cancel();
    cancelPointer();
    save();
    const tabs = `<div class="dialog-tabs">${[
      ['main', 'map'],
      ['works', 'commissions'],
      ['collection', 'collection'],
    ]
      .map(
        ([id, k]) =>
          `<button data-action="tab:${id}" class="${tab === id ? 'primary' : ''}">${tr(k)}</button>`,
      )
      .join('')}</div>`;
    let html;
    if (tab === 'main')
      html =
        `<p class="dialog-note">${tr('atlasNote')}</p>` +
        chapters
          .map(
            (ch) =>
              `<section class="chapter"><div class="chapter-heading"><span>0${ch.id} · ${settings.lang === 'zh' ? ch.zh : ch.en}</span><small>${chapterUnlocked(ch.id) ? nm(ch.subtitle) : tr('chapterLocked')}</small></div><div class="level-grid">${levels
                .filter((l) => l.chapter === ch.id)
                .map((l) => levelCard(l, !levelUnlocked(l)))
                .join('')}</div></section>`,
          )
          .join('');
    else if (tab === 'works')
      html = `<div class="level-grid">${commissions.map((l) => levelCard(l)).join('')}</div>`;
    else {
      const records = Object.entries({ ...snapshot.completions, ...snapshot.discoveries }).filter(
        ([, r]) => r.independent || r.assisted,
      );
      html = `<div class="level-grid">${records
        .map(([k, r]) => {
          const l = resolveKey(k);
          return l
            ? `<button class="level-card" data-action="postcard:${escape(k)}"><span class="stamp">${l.id.startsWith('EC') ? l.id.slice(2) : '⌒'}</span>${escape(nm(l.title))}<small><br>${escape(k.startsWith('daily:') ? k.split(':')[1] : l.id)}</small></button>`
            : '';
        })
        .join('')}</div>`;
    }
    showDialog(tr('map'), tabs + html, (action) => {
      const colon = action.indexOf(':'),
        kind = action.slice(0, colon),
        id = action.slice(colon + 1);
      if (kind === 'tab') openAtlas(id);
      if (kind === 'level') {
        const l = getLevel(id);
        if (levelUnlocked(l)) {
          closeDialog();
          select(l);
        }
      }
      if (kind === 'postcard') openPostcard(id);
    });
  }
  $('map-button').onclick = () => openAtlas();
  function openDaily() {
    const entry = dailyEntry();
    if (!entry) {
      showDialog(tr('daily'), `<p class="help-copy">${tr('dailyUnavailable')}</p>`);
      return;
    }
    showDialog(
      tr('daily'),
      `<p class="dialog-note">${entry.date} · ${tr('dailyDate')}</p><button class="primary" data-action="walk">${tr('daily')} →</button>${entry.repair ? ` <button data-action="repair">${tr('weekend')} →</button>` : ''}`,
      (type) => {
        const l = getLevel(entry[type]);
        if (l) {
          closeDialog();
          select(l, frozenKey(entry, type), entry);
        }
      },
    );
  }
  $('daily-button').onclick = openDaily;
  function openReplay() {
    motion.cancel();
    cancelPointer();
    const captured = run,
      capturedLevel = level,
      capturedGraph = graph(),
      total = run.walkedEdgeIds.length;
    let timer = 0;
    const stop = () => clearTimeout(timer);
    showDialog(
      tr('replay'),
      `<div id="replay-scene" class="replay-scene"></div><label class="replay-slider">${tr('route')} <input id="replay-slider" type="range" min="0" max="${total}" value="0"><output id="replay-step"></output></label><div class="export-buttons"><button id="hold-replay">${tr('holdReplay')}</button><button class="primary" data-action="rewind">${tr('rewindHere')}</button></div>`,
      () => {
        if (run.runId !== captured.runId) return;
        const index = Number($('replay-slider').value);
        while (run.walkedEdgeIds.length > index) run = undo(run);
        message = '';
        hintResult = null;
        highlight = [];
        closeDialog();
        save();
        render();
      },
    );
    dialogCleanup = stop;
    const refresh = () => {
      const index = Number($('replay-slider').value);
      const preview = {
        ...captured,
        walkedEdgeIds: captured.walkedEdgeIds.slice(0, index),
        history: captured.history.slice(0, index + 1),
        currentNode: captured.history[index],
      };
      $('replay-scene').innerHTML = citySVG(
        capturedLevel,
        capturedGraph,
        preview,
        geometry(capturedLevel, false),
        { lang: settings.lang, view, interactive: false },
      );
      $('replay-step').textContent = `${index} / ${total}`;
    };
    const play = () => {
      stop();
      if (!$('dialog').open || document.hidden) return;
      const slider = $('replay-slider');
      slider.value = String((Number(slider.value) + 1) % (total + 1));
      refresh();
      timer = setTimeout(play, 450);
    };
    $('replay-slider').oninput = () => {
      stop();
      refresh();
    };
    $('hold-replay').onpointerdown = (e) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      play();
    };
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'])
      $('hold-replay').addEventListener(event, stop);
    $('hold-replay').onkeydown = (e) => {
      if (['Enter', ' '].includes(e.key) && !e.repeat) {
        e.preventDefault();
        play();
      }
    };
    $('hold-replay').onkeyup = stop;
    refresh();
  }
  function openPostcard(recordKey = key) {
    const l = resolveKey(recordKey),
      bucket = l.kind === 'discovery' ? snapshot.discoveries : snapshot.completions,
      r = bucket[recordKey]?.independent ?? bucket[recordKey]?.assisted;
    if (!r) return;
    showDialog(
      tr('postcard'),
      `<p class="help-copy">${escape(nm(l.title))}</p><p class="dialog-note">${escape(recordKey.startsWith('daily:') ? recordKey.split(':')[1] : l.id)} · ${tr(bucket[recordKey]?.independent ? 'independent' : 'assisted')}</p><label class="postcard-options"><input id="include-route" type="checkbox">${tr('routeOpt')}</label><div class="export-buttons"><button class="primary" data-action="download">${tr('download')}</button><button data-action="share">${tr('share')}</button></div><p id="export-status" class="dialog-note" role="status"></p>`,
      async (action, button) => {
        if (action === 'share') {
          // Call navigator.share synchronously from the click so the user gesture still counts.
          if (!ready) return;
          if (!navigator.canShare?.({ files: [ready] })) {
            $('export-status').textContent = tr('exportFail');
            return;
          }
          $('export-status').textContent = '';
          try {
            await navigator.share({ files: [ready], title: tr('title') });
          } catch {
            $('export-status').textContent = tr('exportFail');
          }
          return;
        }
        if (action !== 'download') return;
        button.disabled = true;
        try {
          const file = await pending;
          if (generation === sceneGeneration && button.isConnected) downloadBlob(file, filename);
        } catch {
          if (button.isConnected) $('export-status').textContent = tr('exportFail');
        } finally {
          button.disabled = false;
        }
      },
    );
    const generation = sceneGeneration,
      filename = `seven-bridges-${recordKey.replaceAll(':', '-')}.png`,
      shareButton = $('dialog-content').querySelector('[data-action="share"]');
    let pending = null,
      ready = null;
    async function drawPostcard(includeRoute) {
      const g = l.kind === 'repair' ? applyEdits(l, r.edits).graph : l,
        saved = {
          ...newRun(l),
          phase: 'complete',
          startNode: r.start,
          currentNode: r.start,
          walkedEdgeIds: includeRoute ? r.edges : [],
          finalEditSet: r.edits,
          draftEdits: r.edits,
        };
      const holder = document.createElement('div');
      holder.innerHTML = citySVG(l, g, saved, geometry(l, false), {
        lang: settings.lang,
        interactive: false,
      });
      const blob = await postcardBlob(holder.querySelector('svg'), {
        title: `${tr('title')} · ${nm(l.title)}`,
        subtitle: recordKey.startsWith('daily:') ? recordKey.split(':')[1] : l.id,
        includeRoute,
      });
      return new File([blob], filename, { type: 'image/png' });
    }
    function prepare() {
      ready = null;
      shareButton.disabled = true;
      const job = (pending = drawPostcard($('include-route').checked));
      job.then(
        (file) => {
          if (job !== pending || generation !== sceneGeneration || !shareButton.isConnected) return;
          ready = file;
          shareButton.disabled = false;
        },
        () => {
          if (job === pending && shareButton.isConnected)
            $('export-status').textContent = tr('exportFail');
        },
      );
    }
    $('include-route').onchange = prepare;
    prepare();
  }
  document.addEventListener('visibilitychange', () => {
    motion.cancel();
    cancelPointer();
    if (document.hidden) {
      dialogCleanup?.();
      sound.suspend();
      save();
    } else render();
  });
  window.addEventListener('pagehide', () => {
    motion.cancel();
    sound.suspend();
    save();
  });
  matchMedia('(max-width:700px)').addEventListener('change', () => {
    motion.cancel();
    cancelPointer();
    renderScene();
  });
  window.addEventListener('hashchange', navigateHash);
  function navigateHash() {
    const hash = location.hash.slice(1);
    const dailyParts = hash.split('/');
    if (
      dailyParts.length === 3 &&
      dailyParts[0] === 'daily' &&
      ['walk', 'repair'].includes(dailyParts[2])
    ) {
      const entry = manifest.find((e) => e.date === dailyParts[1]);
      const requested = entry && resolveSavedSelection(frozenKey(entry, dailyParts[2]));
      if (canSelect(requested)) {
        select(requested.level, requested.key, requested.entry);
        return;
      }
    }
    const requested = resolveSavedSelection(hash);
    if (canSelect(requested)) {
      select(requested.level, requested.key, requested.entry);
      return;
    }
    const fallback = resolveSavedSelection(snapshot.lastLevel);
    if (canSelect(fallback)) {
      select(fallback.level, fallback.key, fallback.entry);
      return;
    }
    select(levels[0]);
  }
  navigateHash();
}
