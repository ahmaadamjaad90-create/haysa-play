import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

// موسيقى الألعاب والمؤثرات (ألّفناها بـ assets/sounds/compose.py و sfx.py)
const SFX = {
  tap: require('../../assets/sounds/tap.mp3'),
  card: require('../../assets/sounds/card.mp3'),
  dice: require('../../assets/sounds/dice.mp3'),
  move: require('../../assets/sounds/move.mp3'),
  turn: require('../../assets/sounds/turn.mp3'),
  correct: require('../../assets/sounds/correct.mp3'),
  wrong: require('../../assets/sounds/wrong.mp3'),
  tick: require('../../assets/sounds/tick.mp3'),
  win: require('../../assets/sounds/win.mp3'),
  lose: require('../../assets/sounds/lose.mp3'),
  coins: require('../../assets/sounds/coins.mp3'),
};
export type Sfx = keyof typeof SFX;

const MUSIC_VOLUME = 0.35;
// لما المايك مفتوح بتوطى الموسيقى عشان الصوت يوصل واضح
const MUSIC_DUCKED = 0.1;
const KEY = 'haysa-sound';

let settings = { music: true, sfx: true };
const listeners = new Set<() => void>();
AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v) settings = { ...settings, ...JSON.parse(v) };
    listeners.forEach((l) => l());
    applyMusic();
  })
  .catch(() => {});

function save() {
  AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => {});
  listeners.forEach((l) => l());
}

// كل مؤثر إله مشغّل واحد بينعمل أول مرة
const players: Partial<Record<Sfx, AudioPlayer>> = {};
export function playSfx(name: Sfx) {
  if (!settings.sfx) return;
  try {
    const p = (players[name] ??= createAudioPlayer(SFX[name]));
    p.seekTo(0);
    p.play();
  } catch {}
}

let music: AudioPlayer | null = null;
let musicWanted = 0;
let ducked = false;

function makeMusic() {
  const m = createAudioPlayer(require('../../assets/sounds/music.mp3'));
  m.loop = true;
  return m;
}

function applyMusic() {
  const on = settings.music && musicWanted > 0;
  try {
    if (on) {
      music ??= makeMusic();
      music.volume = ducked ? MUSIC_DUCKED : MUSIC_VOLUME;
      music.play();
    } else {
      music?.pause();
    }
  } catch {}
}

// المتصفح (خصوصاً سفاري على الآيفون) ما بيشغّل صوت إلا من جوّا لمسة.
// فأول لمسة منفتح فيها كل الأصوات بصمت، وأي لمسة بعدها بترجّع الموسيقى إذا انمنعت.
let primed = false;
function unlock() {
  if (!primed) {
    primed = true;
    for (const name of Object.keys(SFX) as Sfx[]) {
      try {
        const p = (players[name] ??= createAudioPlayer(SFX[name]));
        p.muted = true;
        p.play();
        p.pause();
        p.muted = false;
      } catch {}
    }
    // نفس الشي للموسيقى، عشان تقدر تشتغل لحالها لما تفوت على لعبة
    try {
      music ??= makeMusic();
      if (!musicWanted) {
        music.muted = true;
        music.play();
        music.pause();
        music.muted = false;
      }
    } catch {}
  }
  if (settings.music && musicWanted > 0 && !music?.playing) applyMusic();
}
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  for (const ev of ['touchend', 'pointerup', 'keydown']) document.addEventListener(ev, unlock, { capture: true });
}

// الموسيقى بتشتغل طول ما في شاشة لعبة مفتوحة
export function useGameMusic(active: boolean) {
  useEffect(() => {
    if (!active) return;
    musicWanted++;
    applyMusic();
    return () => {
      musicWanted--;
      applyMusic();
    };
  }, [active]);
}

export function setMusicDucked(d: boolean) {
  if (ducked === d) return;
  ducked = d;
  applyMusic();
}

export function useSoundSettings() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    music: settings.music,
    sfx: settings.sfx,
    // زر واحد: الكل شغّال ← الكل مسكّر
    toggle: () => {
      const on = !(settings.music || settings.sfx);
      settings = { music: on, sfx: on };
      save();
      applyMusic();
    },
  };
}

// صوت لما يصير دوري
export function useTurnSound(myTurn: boolean) {
  useEffect(() => {
    if (myTurn) playSfx('turn');
  }, [myTurn]);
}

// صوت الربح أو الخسارة آخر اللعبة (null لسا ما عرفنا)
export function useResultSound(won: boolean | null) {
  useEffect(() => {
    if (won !== null) playSfx(won ? 'win' : 'lose');
  }, [won]);
}
