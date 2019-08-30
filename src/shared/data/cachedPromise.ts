// Custom promise wrapper which stores the result of the given promise when fulfilled, and then executes all then() calls immediately.
class CachedPromise<T> implements PromiseLike<T> {
  private promise?: PromiseLike<T>;
  private result?: T;

  constructor(source: T | PromiseLike<T>, allowPromise: boolean = true) {
    if (allowPromise && source instanceof Object && 'then' in (source as any)) {
      this.promise = (source as PromiseLike<T>).then((result: T) => {
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

  static construct<U>(source: U | PromiseLike<U>): CachedPromise<U> {
    if (source instanceof CachedPromise) {
      return source;
    } else {
      return new CachedPromise<U>(source);
    }
  }

  then<TResult1 = T, TResult2 = never>(onfulfilled?: (value: T) => TResult1 | PromiseLike<TResult1>, onrejected?: (reason: any) => TResult2 | PromiseLike<TResult2>): CachedPromise<TResult1 | TResult2> {
    if (this.promise) {
      return new CachedPromise(this.promise.then(onfulfilled, onrejected));
    } else if (onfulfilled) {
      try {
        let result = onfulfilled(this.result as T);
        return CachedPromise.construct<TResult1>(result);
      } catch (error) {
        if (onrejected) {
          try {
            let result = onrejected(error);
            return CachedPromise.construct<TResult2>(result);
          } catch (rejectionError) {
            return CachedPromise.reject<TResult2>(rejectionError);
          }
        } else {
          return CachedPromise.reject<TResult2>(error);
        }
      }
    } else {
      return this as any as CachedPromise<TResult1>;
    }
  }

  catch<TResult = never>(onrejected?: (reason: any) => TResult | PromiseLike<TResult>): CachedPromise<T | TResult> {
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
