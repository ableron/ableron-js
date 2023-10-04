export class AbleronConfig {
  /**
   * Whether UI composition is enabled.
   */
  readonly enabled: boolean = true;

  /**
   * Timeout for requesting fragments.
   */
  readonly fragmentRequestTimeoutMillis: number = 3000;

  /**
   * Whether to append UI composition stats as HTML comment to the content.
   */
  readonly statsAppendToContent: boolean = false;

  constructor(init?: Partial<AbleronConfig>) {
    Object.assign(this, init);
  }
}
