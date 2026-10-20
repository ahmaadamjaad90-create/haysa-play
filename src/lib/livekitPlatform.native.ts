import { AudioSession, registerGlobals } from '@livekit/react-native';
import type { RemoteTrack } from 'livekit-client';

// الجوال: livekit-client بيحتاج WebRTC من @livekit/react-native قبل أول غرفة
registerGlobals();

export async function startVoice() {
  await AudioSession.startAudioSession();
}

export async function stopVoice() {
  await AudioSession.stopAudioSession();
}

// صوت الناس بيشتغل لحاله على الجوال
export function attachAudio(_track: RemoteTrack) {}

export function detachAudio(_track: RemoteTrack) {}
