import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from './supabase';

// TODO(الجوال): متل useVoiceRoom، livekit-client بيشتغل بالمتصفح بس هلأ.

export type GameChatLine = { id: string; name: string; text: string; mine?: boolean };

const enc = new TextEncoder();
const dec = new TextDecoder();

async function getGameToken(game: string, id: number): Promise<{ token: string; url: string }> {
  const { data, error } = await supabase.functions.invoke('livekit', { body: { action: 'game', game, id } });
  if (error) throw error;
  return data;
}

// صوت ورسائل طاولة اللعبة: الكل بيدخل والمايك مسكّر، وكل واحد بيفتحه لما بدّه
export function useGameVoice(game: string, id: number, enabled: boolean) {
  const roomRef = useRef<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [micOn, setMicOn] = useState(false);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [chat, setChat] = useState<GameChatLine[]>([]);

  const addLine = useCallback((line: Omit<GameChatLine, 'id'>) => {
    setChat((c) => [...c.slice(-60), { ...line, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Audio) document.body.appendChild(track.attach());
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
      })
      // مين عم يحكي هلأ (بالاسم)
      .on(RoomEvent.ActiveSpeakersChanged, (ps) => setSpeaking(ps.map((p) => p.name || p.identity)))
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudioTap(!room.canPlaybackAudio))
      .on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const msg = JSON.parse(dec.decode(payload));
          if (msg.t === 'chat') addLine({ name: participant?.name || participant?.identity || '', text: msg.text });
        } catch {}
      })
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) setConnected(false);
      });

    (async () => {
      try {
        const { token, url } = await getGameToken(game, id);
        if (cancelled) return;
        await room.connect(url, token);
        if (cancelled) return room.disconnect();
        setConnected(true);
        setNeedsAudioTap(!room.canPlaybackAudio);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
      setConnected(false);
      setMicOn(false);
      setSpeaking([]);
    };
  }, [game, id, enabled, addLine]);

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    // أول ضغطة كمان بتشغّل الصوت إذا المتصفح مانعه
    await room.startAudio().catch(() => {});
    setNeedsAudioTap(false);
    try {
      await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
    } catch {
      setError('mic');
    }
    setMicOn(room.localParticipant.isMicrophoneEnabled);
  };

  const sendChat = async (text: string) => {
    const room = roomRef.current;
    const t = text.trim().slice(0, 200);
    if (!room || !t) return;
    await room.localParticipant.publishData(enc.encode(JSON.stringify({ t: 'chat', text: t })), { reliable: true });
    addLine({ name: 'إنت', text: t, mine: true });
  };

  const startAudio = async () => {
    await roomRef.current?.startAudio();
    setNeedsAudioTap(false);
  };

  return { connected, error, micOn, speaking, needsAudioTap, chat, toggleMic, sendChat, startAudio };
}
