export interface ReadingState {
  progress: number;
  scrollable: boolean;
  showBackToTop: boolean;
}

export function getReadingState(scrollTop: number, scrollHeight: number, viewportHeight: number): ReadingState {
  const maximum = Math.max(0, scrollHeight - viewportHeight);
  const safeTop = Math.min(Math.max(0, scrollTop), maximum);
  const progress = maximum === 0 ? 0 : safeTop / maximum;
  return {
    progress,
    scrollable: maximum > 1,
    showBackToTop: maximum >= 600 && safeTop >= Math.max(320, maximum * 0.5),
  };
}
