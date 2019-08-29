class CachedPromise<T> implements PromiseLike<T> {
  private promise?: PromiseLike<T>;
  private result?: T;

  constructor(source: T | PromiseLike<T>, allowPromise: boolean = true) {
    if (allowPromise && source instanceof Object && 'then' in (source as any)) {
      this.promise = (source as PromiseLike<T>).then((result) => {
        this.result = result;
        this.promise = undefined;
        return result;
      });
    } else {
      this.result = source as T;
    }
  }

  static resolve<U>(value: U): CachedPromise<U>;
  static resolve(): CachedPromise<void>;

  static resolve<U>(value?: U): CachedPromise<U> {
    return new CachedPromise<U>(value!, false);
  }

  static reject<U = never>(reason?: any): CachedPromise<U> {
    return new CachedPromise<U>(Promise.reject(reason));
  }

  then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): CachedPromise<TResult1 | TResult2> {
    if (this.promise) {
      return new CachedPromise(this.promise.then(onfulfilled, onrejected));
    } else {
      try {
        let value = this.result as T;
        let result = onfulfilled ? onfulfilled(value) : value;
        if (result instanceof CachedPromise) {
          return result;
        } else {
          return new CachedPromise<TResult1>(result as any);
        }
      } catch (error) {
        if (onrejected) {
          try {
            let result = onrejected(error);
            if (result instanceof CachedPromise) {
              return result;
            } else {
              return new CachedPromise<TResult2>(result as any);
            }
          } catch (rejectionError) {
            return new CachedPromise<TResult2>(Promise.reject(rejectionError));
          }
        } else {
          return new CachedPromise<TResult2>(Promise.reject(error));
        }
      }
    }
  }

  catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): CachedPromise<T | TResult> {
    if (this.promise) {
      return new CachedPromise(this.promise.then(undefined, onrejected));
    } else {
      return this;
    }
  }

  getImmediateResult(): T | undefined {
    return this.result;
  }
}

export default CachedPromise;
