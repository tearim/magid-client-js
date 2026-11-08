// Framework-free (candidate for @magiden/client-core/dom). Background music: loops `src` at `volume` (0..1) until the
// returned function stops it. Autoplay may be refused by the browser until the user has interacted with the page.
export function playLoop(src: string, volume: number): () => void {
  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = Math.max(0, Math.min(1, volume));
  // play() returns a promise in current browsers (rejected when autoplay is refused); older ones return nothing.
  try {
    void Promise.resolve(audio.play()).catch(() => {});
  } catch {
    // not playable here
  }
  return () => audio.pause();
}
