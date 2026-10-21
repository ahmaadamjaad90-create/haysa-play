import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useState } from 'react';

// موسيقى الألعاب والمؤثرات (ألّفناها بـ assets/sounds/compose.py و sfx.py)
const SFX = {
  tap: require('../../assets/sounds/tap.m4a'),
  card: require('../../assets/sounds/card.m4a'),
  dice: require('../../assets/sounds/dice.m4a'),
  move: require('../../assets/sounds/move.m4a'),
  turn: require('../../assets/sounds/turn.m4a'),
  correct: require('../../assets/sounds/correct.m4a'),
  wrong: require('../../assets/sounds/wrong.m4a'),
  tick: require('../../assets/sounds/tick.m4a'),
  win: require('../../assets/sounds/win.m4a'),
  lose: require('../../assets/sounds/lose.m4a'),
  coins: require('../../assets/sounds/coins.m4a'),
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

function applyMusic() {
  const on = settings.music && musicWanted > 0;
  try {
    if (on) {
      if (!music) {
        music = createAudioPlayer(require('../../assets/sounds/music.m4a'));
        music.loop = true;
      }
      music.volume = ducked ? MUSIC_DUCKED : MUSIC_VOLUME;
      music.play();
    } else {
      music?.pause();
    }
  } catch {}
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
