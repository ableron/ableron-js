export class CaseInsensitiveMap<K, V> extends Map<K, V> {
  set(key: K, value: V): this {
    return super.set(this.toLower(key), value);
  }

  get(key: K): V | undefined {
    return super.get(this.toLower(key));
  }

  has(key: K): boolean {
    return super.has(this.toLower(key));
  }

  private toLower(key: K): K {
    return typeof key === 'string' ? (key.toLowerCase() as any as K) : key;
  }
}
