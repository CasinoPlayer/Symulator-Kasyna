/** Opcjonalne scenariusze serwera. Brak konfiguracji lub enabled=false pozostawia cały panel ukryty. */
import { api } from '../api.js';

export class DebugRounds {
  #ready = false;
  #buttons = [];

  constructor({ code, onRun }) {
    this.root = document.querySelector('#debug-panel');
    if (!this.root) return;
    const toggle = this.root.querySelector('#debug-toggle');
    const content = this.root.querySelector('#debug-content');
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      content.hidden = !open;
    });
    // Jedno pobranie na wejście do gry; ustawienia nie są przechowywane między rundami.
    void this.#load(code, onRun);
  }

  async #load(code, onRun) {
    try {
      const config = await api.slotDebug(code);
      if (config?.enabled !== true || !Array.isArray(config.scenarios)) return;
      const list = this.root.querySelector('#debug-scenarios');
      const seen = new Set();
      for (const scenario of config.scenarios) {
        if (!scenario || !/^[a-z][a-z0-9-]{0,39}$/.test(scenario.id) || seen.has(scenario.id)
            || typeof scenario.label !== 'string' || !scenario.label.trim()
            || !/^[0-9a-f]{16}$/i.test(scenario.seed)) continue;
        seen.add(scenario.id);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'debug-rounds__scenario';
        button.dataset.debugScenario = scenario.id;
        button.textContent = scenario.label;
        button.disabled = !this.#ready;
        button.addEventListener('click', () => {
          if (button.disabled || !this.#ready) return;
          void onRun(scenario.seed);
        });
        this.#buttons.push(button);
        list.append(button);
      }
      if (!this.#buttons.length) return;
      this.root.hidden = false;
      this.root.closest('.game')?.classList.add('has-debug-rounds');
    } catch {
      // Opcjonalny panel nie blokuje gry, także na serwerze bez endpointu debug.
    }
  }

  setState(state, autoplay) {
    this.#ready = state === 'ready' && !autoplay;
    for (const button of this.#buttons) button.disabled = !this.#ready;
  }
}
