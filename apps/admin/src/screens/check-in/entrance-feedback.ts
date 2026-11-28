let audio: AudioContext | null = null;

/** A short tone and buzz, so the person at the door knows without reading the screen. */
export function playEntranceFeedback(allowed: boolean) {
  navigator.vibrate?.(allowed ? 80 : [60, 60, 60]);
  try {
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = allowed ? 880 : 220;
    gain.gain.setValueAtTime(0.15, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.25);
  } catch {
    // No audio until someone taps the page (browser autoplay rules): the screen is enough.
  }
}
