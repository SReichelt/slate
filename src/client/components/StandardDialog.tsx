import * as React from 'react';
import Modal from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';

import './StandardDialog.css';

import Button from './Button';

import { disableDefaultBehavior, limitDefaultBehaviorToElement } from '../utils/event';
import { getButtonIcon, ButtonType } from '../utils/icons';


interface StandardDialogProps {
  onOK: () => void;
  onCancel: () => void;
  okVisible: boolean;
  okEnabled: boolean;
}

const modalClassNames = {
  root: 'dialog-root',
  overlay: 'dialog-overlay',
  modal: 'dialog'
};

function StandardDialog(props: React.PropsWithChildren<StandardDialogProps>): React.ReactElement {
  const onOK = (event: React.FormEvent<HTMLFormElement>) => {
    if (props.okEnabled) {
      props.onOK();
    }
    disableDefaultBehavior(event);
  };
  let buttons: React.ReactNode[];
  if (props.okVisible) {
    buttons = [
      (
        <Button toolTipText={'OK'} onClick={props.onOK} enabled={props.okEnabled} key="ok">
          {getButtonIcon(ButtonType.OK, props.okEnabled)}
        </Button>
      ),
      (
        <Button toolTipText={'Cancel'} onClick={props.onCancel} key="cancel">
          {getButtonIcon(ButtonType.Cancel)}
        </Button>
      )
    ];
  } else {
    buttons = [
      (
        <Button toolTipText={'Close'} onClick={props.onCancel} key="close">
          {getButtonIcon(ButtonType.Close)}
        </Button>
      )
    ];
  }
  return (
    <Modal open={true} onClose={props.onCancel} showCloseIcon={false} center={true} classNames={modalClassNames} animationDuration={0} key="dialog">
      <form onSubmit={onOK} onTouchStart={limitDefaultBehaviorToElement} onTouchCancel={limitDefaultBehaviorToElement} onTouchEnd={limitDefaultBehaviorToElement}>
        {props.children}
        <div className={'dialog-button-row'} key="buttons">
          {buttons}
        </div>
        <input type="submit" value="OK" style={{'display': 'none'}} key="submit"/>
      </form>
    </Modal>
  );
}

export default StandardDialog;
