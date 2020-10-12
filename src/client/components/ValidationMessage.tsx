import * as React from 'react';

import './ValidationMessage.css';


interface ValidationMessageProps {
  error: Error | undefined;
}

function ValidationMessage(props: React.PropsWithChildren<ValidationMessageProps>): React.ReactElement {
  return (
    <div className={'validation-message-container'}>
      {props.children}
      {props.error ? <div className={'validation-message'} key="validation-message">{props.error.message}.</div> : null}
    </div>
  );
}

export default ValidationMessage;
