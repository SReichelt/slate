import * as React from 'react';
import { AlertType } from 'react-alert';

import './Message.css';


interface MessageProps {
  type: AlertType;
}

interface MessageState {
  visible: boolean;
}

const AlertTemplate = require('react-alert-template-basic').default;
export function getAlertTemplate(ref: any) {
  ref.style['textTransform'] = 'initial';
  return AlertTemplate(ref);
}

class Message extends React.Component<MessageProps, MessageState> {
  constructor(props: MessageProps) {
    super(props);

    this.state = {visible: true};
  }

  render(): React.ReactNode {
    if (this.state.visible) {
      let ref = {
        message: this.props.children,
        options: {
          type: this.props.type
        },
        style: {
          'width': '100%',
          'backgroundColor': '#404040',
          'border': '1px dashed yellow',
          'borderRadius': '5px'
        },
        close: () => this.setState({visible: false})
      };
      return <div className={'message'}>{getAlertTemplate(ref)}</div>;
    } else {
      return null;
    }
  }
}

export default Message;
