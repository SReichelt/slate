import * as React from 'react';
import './PromiseHelper.css';
import CachedPromise from '../../shared/data/cachedPromise';

const Loading = require('react-loading-animation');

interface PromiseHelperProps {
  promise: CachedPromise<React.ReactNode>;
  getFallback?: () => React.ReactNode;
}

interface PromiseHelperState {
  promiseResult?: React.ReactNode;
  errorMessage?: string;
}

class PromiseHelper extends React.Component<PromiseHelperProps, PromiseHelperState> {
  private currentPromise?: CachedPromise<any>;

  constructor(props: PromiseHelperProps) {
    super(props);

    this.state = {};
  }

  componentDidMount(): void {
    this.updatePromise(this.props);
  }

  componentDidUpdate(prevProps: PromiseHelperProps): void {
    if (this.props.promise !== prevProps.promise) {
      this.updatePromise(this.props);
    }
  }

  private updatePromise(props: PromiseHelperProps): void {
    let promise = props.promise;

    this.currentPromise = promise;
    if (this.state.promiseResult !== undefined || this.state.errorMessage !== undefined) {
      this.setState({
        promiseResult: undefined,
        errorMessage: undefined
      });
    }

    promise
      .then((result) => {
        if (this.currentPromise === promise) {
          this.setState({promiseResult: result});
        }
      })
      .catch((error) => {
        console.error(error);
        this.setState({errorMessage: error.message});
      });
  }

  componentWillUnmount(): void {
    this.currentPromise = undefined;
  }

  render(): React.ReactNode {
    if (this.state.promiseResult !== undefined) {
      return this.state.promiseResult;
    } else if (this.state.errorMessage) {
      return <div className={'error'}>Error: {this.state.errorMessage}</div>;
    } else if (this.props.getFallback) {
      return this.props.getFallback();
    } else {
      return <div className={'loading'}><Loading width={'1em'} height={'1em'}/></div>;
    }
  }
}

function renderPromise<T extends React.ReactNode>(promise: CachedPromise<T>, key?: string, getFallback?: () => React.ReactNode): React.ReactElement | T {
  let immediateResult = promise.getImmediateResult();
  if (immediateResult === undefined) {
    return <PromiseHelper promise={promise} getFallback={getFallback} key={key}/>;
  } else {
    return immediateResult;
  }
}

export default renderPromise;
