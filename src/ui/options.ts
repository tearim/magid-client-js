import { h, replaceChildren } from '../dom/h';
import { PREF_KEYS } from '../prefs';
import { watch, watchAll, type Ctx } from '../render/common';

export interface OptionsDialogProps {
  onBaseUrlChange: (url: string) => void;
  onClose: () => void;
  onMessage: (text: string) => void;
  onOpenStats: () => void;
  focusOnUrl: boolean;
}

// The player's runtime options: server address (with history), story XML (select and arm), toggles, music volume.
export function renderOptionsDialog(ctx: Ctx, props: OptionsDialogProps): HTMLElement {
  const { magid } = ctx;
  const { prefs } = magid;
  const state = magid.store.get();

  const serverAddr = h('input', {
    type: 'text', class: 'mg-options-input', placeholder: 'http://localhost:8090',
    value: prefs.get(PREF_KEYS.SERVER_ADDRESS, state.baseUrl), attrs: { list: 'magid-url-history' },
  });
  const history = h('datalist', { id: 'magid-url-history' }, ...magid.urlHistory.get().map((u) => h('option', { value: u })));

  let selectedXml = prefs.get(PREF_KEYS.STORY_XML);
  const xmlSelect = h('select', { class: 'mg-options-input', on: { change: () => { selectedXml = xmlSelect.value; showXml(); } } });
  const refresh = h('button', {
    class: 'mg-options-refreshBtn', title: 'Refresh XML list from server',
    on: {
      click: async () => {
        refresh.disabled = true;
        refresh.textContent = '…';
        await magid.client.refreshXmlList();
        refresh.disabled = false;
        refresh.textContent = '↻';
      },
    },
  }, '↻');
  const arm = h('button', { class: 'mg-options-armBtn', on: { click: () => void armXml() } }, 'Arm XML');
  const activeHint = h('p', { class: 'mg-options-hint' });
  const showXml = () => {
    arm.disabled = !selectedXml;
    activeHint.hidden = !selectedXml;
    activeHint.textContent = `Active XML: ${selectedXml}`;
  };
  watch(ctx, (s) => s.xmlList, (xmlList) => {
    replaceChildren(xmlSelect,
      h('option', { value: '' }, '— none —'),
      ...(Array.isArray(xmlList) ? xmlList : []).map((x) => h('option', { value: x.path }, x.name || x.path)),
    );
    xmlSelect.value = selectedXml;
  });
  showXml();

  const armXml = async () => {
    if (!selectedXml) return;
    arm.disabled = true;
    arm.textContent = 'Arming…';
    try {
      if (!(await magid.client.selectStory(selectedXml))) {
        // Server rejected the XML (e.g. a parse error) — the message/block state is already shown; stay open.
        arm.disabled = false;
        arm.textContent = 'Arm XML';
        return;
      }
      prefs.set(PREF_KEYS.STORY_XML, selectedXml);
      const entry = magid.store.get().xmlList.find((x) => x.path === selectedXml);
      const fileName = selectedXml.split(/[\\/]/).pop() || selectedXml;
      props.onMessage(`XML armed: ${entry?.name || fileName} (${entry?.absolutePath || selectedXml})`);
      props.onClose();
    } catch {
      props.onMessage('Failed to arm XML');
      arm.disabled = false;
      arm.textContent = 'Arm XML';
    }
  };

  const check = (key: string, label: string) => {
    const box = h('input', { type: 'checkbox', checked: prefs.getBoolean(key) });
    return { box, row: h('label', { class: 'mg-options-checkRow' }, box, label) };
  };
  const startupArm = check(PREF_KEYS.STARTUP_ARM_XML, 'Auto-load XML on startup');
  const ignoreTimelines = check(PREF_KEYS.NARRATION_IGNORE_TIMELINES, 'Ignore narration timelines');
  const ignoreTextTL = check(PREF_KEYS.NARRATION_IGNORE_TEXT_TL, 'Ignore text timelines (skip typewriter)');
  const ignoreMaximize = check(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE, 'Ignore maximization requests');
  const debugConnectivity = check(PREF_KEYS.DEBUG_ALWAYS_ALLOW_CONNECTIVITY, 'Debug mode: Always allow connectivity');

  const storedVolume = parseFloat(prefs.get(PREF_KEYS.MUSIC_VOLUME, ''));
  const volume = h('input', {
    type: 'range', min: '0', max: '1', step: '0.01', class: 'mg-options-slider',
    value: String(isNaN(storedVolume) ? 0.8 : storedVolume),
    on: { input: () => showVolume() },
  });
  const volumeLabel = document.createTextNode('');
  const showVolume = () => { volumeLabel.textContent = `Music volume (${Math.round(parseFloat(volume.value) * 100)}%)`; };
  showVolume();

  const save = () => {
    prefs.set(PREF_KEYS.SERVER_ADDRESS, serverAddr.value);
    prefs.set(PREF_KEYS.STORY_XML, selectedXml);
    prefs.setBoolean(PREF_KEYS.STARTUP_ARM_XML, startupArm.box.checked);
    prefs.setBoolean(PREF_KEYS.NARRATION_IGNORE_TIMELINES, ignoreTimelines.box.checked);
    prefs.setBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL, ignoreTextTL.box.checked);
    prefs.setBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE, ignoreMaximize.box.checked);
    prefs.setBoolean(PREF_KEYS.DEBUG_ALWAYS_ALLOW_CONNECTIVITY, debugConnectivity.box.checked);
    prefs.setDouble(PREF_KEYS.MUSIC_VOLUME, parseFloat(volume.value));
    props.onBaseUrlChange(serverAddr.value);
    props.onClose();
  };

  const storySection = h('div', { class: 'mg-options-storySection' },
    h('label', { class: 'mg-options-field' },
      h('span', { class: 'mg-options-xmlLabel' }, 'Story XML', refresh),
      h('div', { class: 'mg-options-xmlRow' }, xmlSelect, arm),
    ),
    activeHint,
    startupArm.row,
  );
  const statsButton = h('button', { class: 'mg-options-statsBtn', on: { click: props.onOpenStats } }, 'Server Stats');
  watchAll(ctx, [(s) => s.allowedCommands], () => {
    storySection.hidden = !magid.client.can('set-xml');
    statsButton.hidden = !magid.client.can('server-stats');
  });

  const modal = h('div', { class: 'mg-options-modal', attrs: { role: 'dialog', 'aria-label': 'Options' } },
    h('h2', { class: 'mg-options-title' }, 'Options'),
    h('label', { class: 'mg-options-field' }, 'Server address', serverAddr, history),
    storySection,
    ignoreTimelines.row,
    ignoreTextTL.row,
    ignoreMaximize.row,
    debugConnectivity.row,
    h('label', { class: 'mg-options-field' }, volumeLabel, volume),
    h('div', { class: 'mg-options-actions' },
      statsButton,
      h('button', { class: 'mg-options-saveBtn', on: { click: save } }, 'Save'),
      h('button', { class: 'mg-options-cancelBtn', on: { click: props.onClose } }, 'Cancel'),
    ),
  );
  const backdrop = h('div', { class: 'mg-options-backdrop', on: { click: (e) => { if (e.target === backdrop) props.onClose(); } } }, modal);
  if (props.focusOnUrl) ctx.scope.timeout(() => serverAddr.focus(), 0);
  return backdrop;
}
