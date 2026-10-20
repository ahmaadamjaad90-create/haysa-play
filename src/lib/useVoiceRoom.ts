import {
  Participant,
  Room,
  RoomEvent,
  Track,
  type RemoteTrack,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getVoiceToken } from './rooms';

// TODO(الجوال): livekit-client بيشتغل بالمتصفح. على iOS/Android منحتاج @livekit/react-native
// و registerGlobals() ونسخة development build.

export type Seat = {
  identity: string;
  name: string;
  avatar: string;
  muted: boolean;
  speaking: boolean;
  isMe: boolean;
};

export type ChatLine = { id: string; name?: string; text: string; system?: boolean };

type Status = 'connecting' | 'connected' | 'error' | 'closed';

const enc = new TextEncoder();
const dec = new TextDecoder();

function avatarOf(p: Participant) {
  try {
    return (JSON.parse(p.metadata || '{}').avatar as string) || 'dalla';
  } catch {
    return 'dalla';
  }
}

function seatOf(p: Participant) {
  const s = p.attributes?.seat;
  return s === undefined || s === '' ? null : Number(s);
}

// المقعد الأول (رقم 0) محجوز لصاحب الغرفة
export function useVoiceRoom(number: number, seatsCount: number, ownerIdentity: string) {
  const roomRef = useRef<Room | null>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [error, setError] = useState('');
  const [seats, setSeats] = useState<(Seat | null)[]>(() => Array(seatsCount).fill(null));
  const [listeners, setListeners] = useState(0);
  const [mySeat, setMySeat] = useState<number | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [needsAudioTap, setNeedsAudioTap] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const seatsCountRef = useRef(seatsCount);

  const addLine = useCallback((line: Omit<ChatLine, 'id'>) => {
    setChat((c) => [...c.slice(-80), { ...line, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  // نبني المقاعد من جديد من حالة كل المشاركين
  const refresh = useCallback(() => {
    const room = roomRef.current;
    if (!room || room.state !== 'connected') {
      setSeats(Array(seatsCountRef.current).fill(null));
      return;
    }
    const speaking = new Set(room.activeSpeakers.map((p) => p.identity));
    const all: Participant[] = [room.localParticipant, ...room.remoteParticipants.values()];
    // اللي دخل أول بياخد المقعد إذا اتنين اختاروا نفسه
    all.sort((a, b) => (a.joinedAt?.getTime() ?? 0) - (b.joinedAt?.getTime() ?? 0));
    const next: (Seat | null)[] = Array(seatsCountRef.current).fill(null);
    for (const p of all) {
      const s = seatOf(p);
      if (s === null || s < 0 || s >= next.length || next[s]) continue;
      if (s === 0 && p.identity !== ownerIdentity) continue;
      next[s] = {
        identity: p.identity,
        name: p.name || p.identity,
        avatar: avatarOf(p),
        muted: !p.isMicrophoneEnabled,
        speaking: speaking.has(p.identity),
        isMe: p === room.localParticipant,
      };
    }
    setSeats(next);
    setListeners(room.numParticipants);
    const mine = next.findIndex((s) => s?.isMe);
    setMySeat(mine === -1 ? null : mine);
    setMicOn(room.localParticipant.isMicrophoneEnabled);
  }, [ownerIdentity]);

  useEffect(() => {
    seatsCountRef.current = seatsCount;
    refresh();
  }, [seatsCount, refresh]);

  useEffect(() => {
    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    room
      .on(RoomEvent.ParticipantConnected, (p) => {
        addLine({ system: true, text: `${p.name || p.identity} دخل الغرفة` });
        refresh();
      })
      .on(RoomEvent.ParticipantDisconnected, refresh)
      .on(RoomEvent.ParticipantAttributesChanged, refresh)
      .on(RoomEvent.TrackMuted, refresh)
      .on(RoomEvent.TrackUnmuted, refresh)
      .on(RoomEvent.LocalTrackPublished, refresh)
      .on(RoomEvent.LocalTrackUnpublished, refresh)
      .on(RoomEvent.TrackPublished, refresh)
      .on(RoomEvent.TrackUnpublished, refresh)
      .on(RoomEvent.ActiveSpeakersChanged, refresh)
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        // صوت الناس: عنصر audio مخفي بالصفحة
        if (track.kind === Track.Kind.Audio) document.body.appendChild(track.attach());
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        track.detach().forEach((el) => el.remove());
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => setNeedsAudioTap(!room.canPlaybackAudio))
      .on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const msg = JSON.parse(dec.decode(payload));
          if (msg.t === 'chat') addLine({ name: participant?.name || participant?.identity, text: msg.text });
        } catch {}
      })
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) setStatus('closed');
      });

    (async () => {
      try {
        const { token, url, isOwner } = await getVoiceToken(number);
        if (cancelled) return;
        await room.connect(url, token);
        if (cancelled) return room.disconnect();
        setStatus('connected');
        setNeedsAudioTap(!room.canPlaybackAudio);
        // صاحب الغرفة بيقعد على مقعده تلقائياً
        if (isOwner) await room.localParticipant.setAttributes({ seat: '0' });
        refresh();
      } catch (e) {
        if (cancelled) return;
        setStatus('error');
        setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      room.disconnect();
      roomRef.current = null;
    };
  }, [number, addLine, refresh]);

  const takeSeat = async (i: number) => {
    const room = roomRef.current;
    if (!room || seats[i]) return;
    await room.localParticipant.setAttributes({ seat: String(i) });
    await room.localParticipant.setMicrophoneEnabled(true);
    refresh();
  };

  const leaveSeat = async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(false);
    await room.localParticipant.setAttributes({ seat: '' });
    refresh();
  };

  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room || mySeat === null) return;
    await room.localParticipant.setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled);
    refresh();
  };

  const sendChat = async (text: string) => {
    const room = roomRef.current;
    if (!room || !text.trim()) return;
    await room.localParticipant.publishData(enc.encode(JSON.stringify({ t: 'chat', text: text.trim() })), {
      reliable: true,
    });
    addLine({ name: 'إنت', text: text.trim() });
  };

  const startAudio = async () => {
    await roomRef.current?.startAudio();
    setNeedsAudioTap(false);
  };

  return {
    status,
    error,
    seats,
    listeners,
    mySeat,
    micOn,
    needsAudioTap,
    chat,
    addLine,
    takeSeat,
    leaveSeat,
    toggleMic,
    sendChat,
    startAudio,
  };
}
