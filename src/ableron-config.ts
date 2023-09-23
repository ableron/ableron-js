export class AbleronConfig {
  /**
   * Whether UI composition is enabled.
   */
  readonly enabled: boolean = true;

  constructor(init?: Partial<AbleronConfig>) {
    Object.assign(this, init);
  }
}
