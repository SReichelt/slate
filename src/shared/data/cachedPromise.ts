class CachedPromise<T> implements PromiseLike<T> {
  private sourceIsPromise: boolean = false;

  constructor(private source: T | Promise<T>, allowPromise: boolean = true) {
    this.sourceIsPromise = allowPromise && (source instanceof Promise || Object.prototype.toString.call(source) === '[object Promise]');
    if (this.sourceIsPromise) {
      (source as Promise<T>).then((result) => {
        this.source = result;
        this.sourceIsPromise = false;
      });
    }
  }

  static resolve<U>(value: U): CachedPromise<U>;
  static resolve(): CachedPromise<void>;

  static resolve<U>(value?: U): CachedPromise<U> {
    return new CachedPromise<U>(value!, false);
  }

  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): CachedPromise<TResult1 | TResult2> {
    if (this.sourceIsPromise) {
      return new CachedPromise<TResult1>((this.source as Promise<T>).then(
        (value) => {
          let result = onfulfilled ? onfulfilled(value) : value;
          if (result instanceof CachedPromise) {
            return result.source;
          } else {
            return result;
          }
        },
        onrejected)
      );
    } else {
      try {
        let value = this.source as T;
        let result = onfulfilled ? onfulfilled(value) : value;
        if (result instanceof CachedPromise) {
          return result;
        } else {
          return new CachedPromise<TResult1>(result as any);
        }
      } catch (error) {
        return new CachedPromise<TResult1>(Promise.reject(error));
      }
    }
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): CachedPromise<T | TResult> {
    if (this.sourceIsPromise) {
      return new CachedPromise<T | TResult>((this.source as Promise<T>).catch(onrejected));
    } else {
      return this;
    }
  }

  getImmediateResult(): T | undefined {
    if (this.sourceIsPromise) {
      return undefined;
    } else {
      return this.source as T;
    }
  }
}

export default CachedPromise;
