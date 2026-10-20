import type { RemoteTrack } from 'livekit-client';

// الويب: livekit-client بيشتغل لحاله، وصوت الناس بعناصر audio مخفية بالصفحة.
// نسخة الجوال بملف livekitPlatform.native.ts

export async function startVoice() {}

export async function stopVoice() {}

export function attachAudio(track: RemoteTrack) {
  document.body.appendChild(track.attach());
}

export function detachAudio(track: RemoteTrack) {
  track.detach().forEach((el) => el.remove());
}
