// Custom promise wrapper which stores the result of the given promise when fulfilled, and then executes all then() calls immediately.
class CachedPromise<T> implements PromiseLike<T> {
  private promise?: PromiseLike<T>;
  private result?: T;

  constructor(source: T | PromiseLike<T>, allowPromise: boolean = true) {
    if (allowPromise && source && typeof source === 'object' && 'then' in (source as any)) {
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
        const result = onfulfilled(this.result!);
        return CachedPromise.construct<TResult1>(result);
      } catch (error) {
        if (onrejected) {
          try {
            const result = onrejected(error);
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

  and(ontrue: () => T | PromiseLike<T>): CachedPromise<T> {
    return this.then((value: T) => (value && ontrue()));
  }

  or(onfalse: () => T | PromiseLike<T>): CachedPromise<T> {
    return this.then((value: T) => (value || onfalse()));
  }

  isResolved(): boolean {
    return !this.promise;
  }

  getImmediateResult(): T | undefined {
    return this.result;
  }

  static all<U>(promises: CachedPromise<U>[]): CachedPromise<U[]> {
    const values: (U | PromiseLike<U>)[] = [];
    let pending = false;
    for (const promise of promises) {
      if (promise.promise) {
        values.push(promise.promise);
        pending = true;
      } else {
        values.push(promise.result!);
      }
    }
    if (pending) {
      return new CachedPromise(Promise.all(values));
    } else {
      return CachedPromise.resolve(values as U[]);
    }
  }
}

export default CachedPromise;
