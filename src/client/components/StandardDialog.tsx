import * as React from 'react';
import './StandardDialog.css';
import Modal from 'react-responsive-modal';
import Button from './Button';
import { getButtonIcon, ButtonType } from '../utils/icons';

interface StandardDialogProps {
  onOK: () => void;
  onCancel: () => void;
  okEnabled: boolean;
}

const modalClassNames = {
  modal: 'dialog',
  overlay: 'dialog-overlay'
};

function StandardDialog(props: React.PropsWithChildren<StandardDialogProps>): React.ReactElement {
  let onOK = (event: React.FormEvent<HTMLFormElement>) => {
    if (props.okEnabled) {
      props.onOK();
    }
    event.stopPropagation();
    event.preventDefault();
  };
  return (
    <Modal open={true} onClose={props.onCancel} showCloseIcon={false} classNames={modalClassNames} key={'dialog'}>
      <form onSubmit={onOK}>
        {props.children}
        <div className={'dialog-button-row'} key={'buttons'}>
          <Button toolTipText={'OK'} onClick={props.onOK} enabled={props.okEnabled} key={'OK'}>
            {getButtonIcon(ButtonType.OK, props.okEnabled)}
          </Button>
          <Button toolTipText={'Cancel'} onClick={props.onCancel} key={'Cancel'}>
            {getButtonIcon(ButtonType.Cancel)}
          </Button>
        </div>
        <input type="submit" value="OK" style={{'display': 'none'}} key={'submit'}/>
      </form>
    </Modal>
  );
}

export default StandardDialog;
