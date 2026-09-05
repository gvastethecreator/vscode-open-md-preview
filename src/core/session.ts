export class PreviewSessionState {
  readonly #suppressed = new Set<string>();
  #generation = 0;
  #warningReported = false;

  nextGeneration(): number {
    this.#generation += 1;
    return this.#generation;
  }

  isCurrent(generation: number): boolean {
    return generation === this.#generation;
  }

  suppress(uri: string): void {
    this.#suppressed.add(uri);
  }

  clearSuppression(uri: string): void {
    this.#suppressed.delete(uri);
  }

  isSuppressed(uri: string): boolean {
    return this.#suppressed.has(uri);
  }

  claimWarning(): boolean {
    if (this.#warningReported) return false;
    this.#warningReported = true;
    return true;
  }
}
