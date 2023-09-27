import { Fragment } from './fragment';
import * as crypto from 'crypto';

export class Include {
  /**
   * Name of the attribute which contains the ID of the include - an optional unique name.
   */
  private readonly ATTR_ID: string = 'id';

  /**
   * Name of the attribute which contains the source URl to resolve the include to.
   */
  private readonly ATTR_SOURCE: string = 'src';

  /**
   * Name of the attribute which contains the timeout for requesting the src URL.
   */
  private readonly ATTR_SOURCE_TIMEOUT_MILLIS: string = 'src-timeout-millis';

  /**
   * Name of the attribute which contains the fallback URL to resolve the include to in case the
   * source URL could not be loaded.
   */
  private readonly ATTR_FALLBACK_SOURCE: string = 'fallback-src';

  /**
   * Name of the attribute which contains the timeout for requesting the fallback-src URL.
   */
  private readonly ATTR_FALLBACK_SOURCE_TIMEOUT_MILLIS: string = 'fallback-src-timeout-millis';

  /**
   * Name of the attribute which denotes a fragment whose response code is set as response code
   * for the page.
   */
  private readonly ATTR_PRIMARY: string = 'primary';

  /**
   * Raw include tag.
   */
  private readonly rawIncludeTag: string;

  /**
   * Raw attributes of the include tag.
   */
  private readonly rawAttributes: Map<string, string>;

  /**
   * Fragment ID. Either generated or passed via attribute.
   */
  readonly id: string;

  /**
   * Fallback content to use in case the include could not be resolved.
   */
  private readonly fallbackContent: string | undefined;

  /**
   * Constructs a new Include.
   *
   * @param rawAttributes Raw attributes of the include tag
   * @param fallbackContent Fallback content to use in case the include could not be resolved
   * @param rawIncludeTag Raw include tag
   */
  constructor(rawAttributes?: Map<string, string>, fallbackContent?: string, rawIncludeTag?: string) {
    this.rawIncludeTag = typeof rawIncludeTag !== 'undefined' ? rawIncludeTag : '';
    this.rawAttributes = typeof rawAttributes !== 'undefined' ? rawAttributes : new Map<string, string>();
    this.id = this.buildIncludeId(this.rawAttributes.get(this.ATTR_ID));
    this.fallbackContent = typeof fallbackContent !== 'undefined' ? fallbackContent : '';
  }

  resolve(): Promise<Fragment> {
    return Promise.resolve(new Fragment('fallback'));
  }

  private buildIncludeId(providedId?: string): string {
    if (typeof providedId !== 'undefined') {
      const sanitizedId = providedId.replaceAll(/[^A-Za-z0-9_-]/, '');

      if (sanitizedId !== '') {
        return sanitizedId;
      }
    }

    return crypto.createHash('sha1').update(this.rawIncludeTag).digest('hex');
  }
}
