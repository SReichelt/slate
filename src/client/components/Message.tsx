import * as React from 'react';
import { AlertType, AlertComponentPropsWithStyle } from 'react-alert';

import './Message.css';


interface MessageProps {
  type: AlertType;
}

interface MessageState {
  visible: boolean;
}

export function getAlertTemplate(props: AlertComponentPropsWithStyle): React.ReactElement {
  props.style['textTransform'] = 'initial';
  const AlertTemplate = require('react-alert-template-basic').default;
  return AlertTemplate(props);
}

class Message extends React.Component<MessageProps, MessageState> {
  constructor(props: MessageProps) {
    super(props);

    this.state = {visible: true};
  }

  render(): React.ReactNode {
    if (this.state.visible) {
      let props: AlertComponentPropsWithStyle = {
        id: 'message',
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
      return <div className={'message'}>{getAlertTemplate(props)}</div>;
    } else {
      return null;
    }
  }
}

export default Message;
