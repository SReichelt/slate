class CachedPromise<R> {
  private sourceIsPromise: boolean = false;

  constructor(private source: R | Promise<R>, allowPromise: boolean = true) {
    this.sourceIsPromise = allowPromise && (source instanceof Promise || Object.prototype.toString.call(source) === '[object Promise]');
    if (this.sourceIsPromise) {
      (source as Promise<R>).then((result) => {
        this.source = result;
        this.sourceIsPromise = false;
      });
    }
  }

  static resolve<U>(value: U): CachedPromise<U> {
    return new CachedPromise<U>(value, false);
  }

  then<U>(onFulfilled: (value: R) => U | Promise<U> | CachedPromise<U>): CachedPromise<U> {
    if (this.sourceIsPromise) {
      return new CachedPromise<U>((this.source as Promise<R>).then((value) => {
        let result = onFulfilled(value);
        if (result instanceof CachedPromise) {
          return result.source;
        } else {
          return result;
        }
      }));
    } else {
      try {
        let result = onFulfilled(this.source as R);
        if (result instanceof CachedPromise) {
          return result;
        } else {
          return new CachedPromise<U>(result);
        }
      } catch (error) {
        return new CachedPromise<U>(Promise.reject(error));
      }
    }
  }

  catch(onRejected: (error: any) => void): void {
    if (this.sourceIsPromise) {
      (this.source as Promise<R>).catch(onRejected);
    }
  }

  getImmediateResult(): R | undefined {
    if (this.sourceIsPromise) {
      return undefined;
    } else {
      return this.source as R;
    }
  }
}

export default CachedPromise;
