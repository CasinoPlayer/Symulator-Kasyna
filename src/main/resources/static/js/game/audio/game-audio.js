/**
 * game/audio/game-audio.js — zdarzenia gry → dźwięki (05 § 6.1, ID z briefu § 10).
 *
 * Jedno miejsce z mapowaniem zamiast `audio.play(…)` rozsianych po kodzie efektów: student pokazuje na obronie
 * „tu jest tabela z 05, a tu ta sama tabela w kodzie”. Silnik (js/audio/audio-engine.js) zapewnia ciszę bez
 * błędów, gdy pliku jeszcze nie ma — pipeline dźwięku dostarcza pliki do static/assets/audio/ niezależnie.
 *
 * Poziomy, pętle, warianty wysokości i tonację gry ustala MANIFEST (`gainDb`, `loopStart`/`loopEnd`,
 * `pitchCents`, `keyTrack`) — tutaj są tylko warianty zdarzeń z 05 (np. autoplay −6 dB, drabina linii +100 c).
 *
 * Synchronizacja (R6 z 04, 05 § 2.7): stopy bębnów planujemy na zegarze audio z wyprzedzeniem — bęben zapowiada
 * stop ~170 ms wcześniej z dokładnym czasem (`approach`), a dźwięk dostaje `delay` co do milisekundy. Pliki
 * z narastaniem (WILD, antycypacja, stinger big winu, eskalacja, błysk) mają w manifeście `syncPoint` — podajemy
 * silnikowi chwilę zdarzenia (`hitIn`), a on sam startuje plik odpowiednio wcześniej (z poprawką na transpozycję).
 */

import { audio } from '../../audio/audio-engine.js';

export class GameAudio {
  #loop = null;
  #tick = null;
  #fountain = null;
  #heart = null;
  #rise = null;
  #resumeMusic = null;

  /**
   * @param {{key: 's1'|'s2'|'s3', music: string, reelLoop: string|null, reels: number}} game
   *   key — pakiet dźwięków strony gry i kontekst tonacji (`keyTrack`)
   */
  constructor(game) {
    this.game = game;
    this.engine = audio;
    audio.setKeyContext(game.key);
  }

  /** Ekran ładowania: pobranie bajtów pakietu krytycznego (dekodowanie wymaga gestu — po „Graj” trwa ms). */
  async prefetchCritical() {
    try {
      await audio.prefetch(await audio.gameSounds(this.game.key, 'critical'));
    } catch {
      /* brak manifestu / sieci — gra działa w ciszy */
    }
  }

  /** Po odblokowaniu (gest „Graj”): dekodowanie pakietu krytycznego — `ui`, `gry-krytyczne` i pakiet gry (05 § 2.4). */
  async preloadCritical() {
    await audio.unlock();
    await audio.preload(await audio.gameSounds(this.game.key, 'critical'));
  }

  /** Pakiet dalszy (`gry-dalsze`): w tle, po intro (nigdy w trakcie spinu — dekodowanie zjada CPU). */
  async preloadLater() {
    await audio.preload(await audio.gameSounds(this.game.key, 'later'));
  }

  // ------------------------------------------------------------------------------------- E21–E26

  /** E21: muzyka gry z wejściem 1500 ms (stan CISZA → GRA, 05 § 4.5 przejście 4); start od `loopStart`. */
  intro() {
    audio.setKeyContext(this.game.key);
    audio.playMusic(this.game.music, { fadeMs: 1500 });
  }

  /** E24 + E25: wciśnięcie SPIN i pętla obrotu po 40 ms (wejście 60 ms). Autoplay −6 dB. */
  spinStart({ autoplay = false, free = false } = {}) {
    if (!free) audio.play('sfx_spin_start', { volume: autoplay ? 0.5 : 1 });
    this.#loop?.stop(60);
    this.#loop = this.game.reelLoop ? audio.play(this.game.reelLoop, { delay: 0.04, fadeIn: 60 }) : null;
    this.loopLevel = 1;
  }

  /** Zapowiedź stopu bębna (~170 ms przed) — planowanie dźwięków co do milisekundy. */
  reelApproach(reel, inMs, { quick = false, codes = [], wildCode = 'wild' } = {}) {
    const n = this.game.reels;
    const pan = n > 1 ? ((reel / (n - 1)) * 2 - 1) * (n > 3 ? 0.4 : 0.3) : 0;
    audio.play(`sfx_beben_stop_${Math.min(6, reel + 1)}`, { delay: inMs / 1000, pan, volume: quick ? 0.7 : 1 });
    if (codes.includes(wildCode)) {
      // `syncPoint` sfx_wild (150 ms) → silnik startuje plik tak, by uderzenie trafiło w lądowanie (05 § 6.1, E33)
      audio.play('sfx_wild', { hitIn: inMs / 1000, pan });
    }
  }

  /** E26: po każdym stopie pętla cichnie (S1: 100 → 66 → 33%), po ostatnim gaśnie w 120 ms (turbo 60 ms). */
  reelStop(reel, { last = false, turbo = false } = {}) {
    if (last) {
      this.#loop?.stop(turbo ? 60 : 120);
      this.#loop = null;
      return;
    }
    this.loopLevel = Math.max(0.2, 1 - (reel + 1) / this.game.reels);
    this.#loop?.setVolume(this.loopLevel, 80);
  }

  /** E40: „zjazd taśmy” — prędkość pętli 1,0 → 0,5 i wyciszenie w 300 ms; potem ui_blad. */
  networkError() {
    this.#loop?.setRate(0.5);
    this.#loop?.stop(300);
    this.#loop = null;
    this.anticipationEnd(false);
    audio.play('ui_blad', { delay: 0.3 });
  }

  // ------------------------------------------------------------------------------------- E27 antycypacja

  /**
   * E27: narastanie kończy się na stopie antycypowanego bębna — `syncPoint` pliku (1,2 s = szczyt) trafia w stop;
   * przy krótszej antycypacji (S1: 900 ms) silnik wchodzi w środek pliku. Serce w pętli, warstwa napięcia,
   * filtr muzyki 1200 Hz, ducking −4 dB.
   */
  anticipationStart(durationMs) {
    this.#rise?.stop(80);
    this.#rise = audio.play('sfx_antycypacja_narastanie', { hitIn: durationMs / 1000 });
    // serce startuje 2 dB ciszej; każdy kolejny antycypowany bęben (S2/S3) podbija je o +2 dB do pełnej głośności
    if (!this.#heart?.playing) this.#heart = audio.play('sfx_bicie_serca', { loop: true, volume: 0.79 });
    else this.#heart.setVolume(1, 100);
    audio.setLayer('mus_napiecie', true, { fadeMs: 400 });
    audio.setMusicFilter(1200, 400);
    audio.duck('napiecie', -4, { attack: 0.4 });
  }

  /** Koniec antycypacji: sukces — gaśnie na rozładowaniu; porażka — wyciszenie 250–600 ms. */
  anticipationEnd(success) {
    this.#rise?.stop(success ? 80 : 250);
    this.#rise = null;
    this.#heart?.stop(250);
    this.#heart = null;
    audio.setLayer('mus_napiecie', false, { fadeMs: 250 });
    audio.setMusicFilter(20000, 600);
    audio.unduck('napiecie', { release: 0.6 });
  }

  // ------------------------------------------------------------------------------------- E28 / E29

  /** E28: wariant według mnożnika m (`_1` m < 1 — ciszej o 6 dB, bez linii i tiku; R3 „nie świętujemy straty”). */
  winSmall(m) {
    const n = m < 1 ? 1 : m < 2.5 ? 2 : 3;
    audio.play(`sfx_wygrana_small_${n}`, { volume: n === 1 ? 0.5 : 1 });
    audio.duck('wygrana', -3, { attack: 0.04 });
  }

  winMedium() {
    audio.play('sfx_wygrana_medium');
    audio.duck('wygrana', -3, { attack: 0.04 });
  }

  /** Linia wygranej: +100 c × numer pokazywanej linii (maks. +700 c — świadomy wyjątek od limitu ±400 c, 05 § 2.6). */
  line(nth, { quiet = false } = {}) {
    audio.play('sfx_linia', { detune: Math.min(7, nth) * 100, detuneLimit: 700, volume: quiet ? 0.4 : 1 });
  }

  coins(count = 6, spanMs = 350) {
    for (let i = 0; i < count; i++) {
      audio.playVariant('sfx_moneta_', 5, { delay: (50 + (i * spanMs) / count) / 1000 });
    }
  }

  /** Pętla tików licznika — prędkość według postępu u = t/T (05 § 3.2: tiki przyspieszają). */
  counterStart() {
    this.#tick?.stop(30);
    this.#tick = audio.play('sfx_licznik_tik', { loop: true });
  }

  counterProgress(u, levelBoost = 0) {
    this.#tick?.setRate(Math.min(1.6, 1 + 0.25 * u + levelBoost));
  }

  counterStop(fadeMs = 60) {
    this.#tick?.stop(fadeMs);
    this.#tick = null;
  }

  counterEnd({ volume = 1 } = {}) {
    this.counterStop(60);
    audio.play('sfx_licznik_koniec', { volume });
  }

  /** E08: zaksięgowanie wygranej small (przy medium+ saldo rośnie bez osobnego dźwięku). */
  balancePulse() {
    audio.play('sfx_saldo_puls');
  }

  releaseWinDuck() {
    audio.unduck('wygrana', { release: 0.5 });
  }

  // ------------------------------------------------------------------------------------- E30–E32 big win

  /**
   * E30: stinger wejścia; `mus_bigwin` startuje od `loopStart` DOKŁADNIE w chwili uderzenia stingera (jego
   * `syncPoint`, 300 ms) — planowane na zegarze audio, nie setTimeoutem. Ducking −6 dB, tonacja BIG_WIN (0 c).
   * Pozycję muzyki gry zapamiętujemy, żeby po big winie wznowić ją od początku taktu (05 § 4.5).
   * @param {{jackpot?: boolean}} o NEON JACKPOT: `sfx_s1_jackpot` zastąpił już stinger; muzyka startuje od razu
   *   (wywołanie przychodzi w chwili uderzenia banera, 05 § 4.5 przejście 8)
   */
  bigwinEnter({ jackpot = false } = {}) {
    this.#resumeMusic = audio.musicState();
    audio.setKeyContext('bigwin');
    let hit = 0;
    if (!jackpot) {
      audio.play('sfx_bigwin_wejscie');
      hit = audio.leadTime('sfx_bigwin_wejscie') || 0.3;
      audio.play('sfx_blysk', { hitIn: hit });
    }
    audio.duck('bigwin', -6, { attack: 0.12 });
    audio.playMusic('mus_bigwin', { fadeMs: jackpot ? 200 : 400, delay: hit });
  }

  /** Start liczenia big win: tiki + fontanna monet (poziomy z manifestu). */
  bigwinCount() {
    this.counterStart();
    this.#fountain?.stop(100);
    this.#fountain = audio.play('sfx_monety_fontanna', { loop: true });
  }

  /** Wyprzedzenie zapowiedzi eskalacji w ms = `syncPoint` `sfx_poziom_w_gore` po transpozycji wariantu. */
  levelLeadMs(levelIndex) {
    return (audio.leadTime('sfx_poziom_w_gore', { detune: this.#levelCents(levelIndex) }) || 0.25) * 1000;
  }

  #levelCents(levelIndex) {
    return [0, 200, 400][levelIndex - 1] ?? 0;   // MEGA 0 c, EPIC +200 c, ULTRA +400 c
  }

  /** E31: `sfx_poziom_w_gore` tak, by uderzenie (syncPoint) trafiło w próg za `inMs` ms (MEGA 0 c, EPIC +200, ULTRA +400). */
  bigwinLevelSoon(levelIndex, inMs = this.levelLeadMs(levelIndex)) {
    audio.play('sfx_poziom_w_gore', { detune: this.#levelCents(levelIndex), hitIn: Math.max(0, inMs) / 1000 });
  }

  /** E31 uderzenie: bas + błysk (transjent błysku w tej chwili); tiki +0,15 prędkości, fontanna +2 dB na poziom. */
  bigwinLevelHit(levelIndex) {
    audio.play('sfx_uderzenie_basu');
    audio.play('sfx_blysk', { hitIn: 0 });
    this.#fountain?.setVolume(10 ** ((2 * levelIndex) / 20), 200);
  }

  /** E32: slam — koniec liczenia; tik gaśnie 60 ms, fontanna 800 ms, mus_bigwin wycisza się, gra wraca po ~800 ms. */
  bigwinEnd() {
    this.counterStop(60);
    audio.play('sfx_licznik_koniec');
    audio.play('sfx_bigwin_koniec');
    this.#fountain?.stop(800);
    this.#fountain = null;
    audio.setKeyContext(this.game.key);
    const resume = this.#resumeMusic;
    const id = resume?.id && resume.id !== 'mus_bigwin' ? resume.id : this.game.music;
    // wznowienie od początku zapamiętanego taktu (bez pozycji → od loopStart)
    audio.playMusic(id, { fadeMs: 1200, offset: id === resume?.id ? resume.position : undefined, delay: 0.8 });
    setTimeout(() => audio.unduck('bigwin', { release: 0.8 }), 800);
  }

  whoosh() {
    audio.play('sfx_przejscie_whoosh');
  }

  blysk() {
    audio.play('sfx_blysk', { hitIn: 0 });
  }

  play(id, opts) {
    return audio.play(id, opts);
  }

  stopAll() {
    this.counterStop(60);
    this.#fountain?.stop(200);
    this.#fountain = null;
    this.anticipationEnd(false);
  }
}
