import * as React from 'react';
import clsx from 'clsx';

import ExpressionMenu from './ExpressionMenu';

import { disableDefaultBehavior, limitDefaultBehaviorToElement } from '../utils/event';
import { isLatexInput, getLatexInputSuggestions, replaceLatexCodeOrPrefix, replaceExactLatexCodeOnly } from '../utils/latexInput';

import * as Notation from 'slate-shared/notation/notation';
import * as Menu from 'slate-shared/notation/menu';
import CachedPromise from 'slate-shared/data/cachedPromise';


export interface UnicodeTextInputProps {
  className?: string;
  value: string;
  size: number;
  onChangeValue: (newValue: string) => void;
  onKeyPress?: React.KeyboardEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  supportLatexInput: boolean;
  previewStyleClasses?: string[];
  inputRef?: React.Ref<HTMLInputElement>;
}

interface UnicodeTextInputState {
  inputFocused: boolean;
}

export default class UnicodeTextInput extends React.Component<UnicodeTextInputProps, UnicodeTextInputState> {
  constructor(props: UnicodeTextInputProps) {
    super(props);

    this.state = {
      inputFocused: false
    };
  }

  render(): React.ReactNode {
    const latexInput = this.props.supportLatexInput && isLatexInput(this.props.value);
    const performLatexReplacement = () => {
      const textAfterReplacement = replaceLatexCodeOrPrefix(this.props.value);
      if (textAfterReplacement !== this.props.value) {
        this.props.onChangeValue(textAfterReplacement);
      }
    };
    const onFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      this.props.onFocus?.(event);
      this.setState({inputFocused: true});
    };
    const onBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      this.props.onBlur?.(event);
      this.setState({inputFocused: false});
      if (this.props.supportLatexInput) {
        performLatexReplacement();
      }
    };
    const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = event.target.value;
      if (this.props.supportLatexInput) {
        newValue = replaceExactLatexCodeOnly(newValue);
      }
      this.props.onChangeValue(newValue);
    };
    const onKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (this.props.supportLatexInput && (event.key === 'Enter' || event.key === ' ')) {
        performLatexReplacement();
        disableDefaultBehavior(event);
      }
      this.props.onKeyPress?.(event);
    };
    const className = clsx(this.props.className, {
      'input-latex': latexInput
    });
    const style = {'width': `${this.props.size}ch`, 'minWidth': `${this.props.size}ex`};
    let menu: React.ReactNode = null;
    if (latexInput && this.state.inputFocused) {
      const suggestions = getLatexInputSuggestions(this.props.value);
      const rows = suggestions.map((suggestion, rowIndex) => {
        const action = new Menu.ImmediateExpressionMenuAction(() => {
          this.props.onChangeValue(suggestion.unicodeCharacters);
        });
        const preview = new Notation.TextExpression(suggestion.unicodeCharacters);
        preview.styleClasses = this.props.previewStyleClasses;
        const item = new Menu.ExpressionMenuItem(preview, action);
        item.selected = rowIndex === 0;
        const row = new Menu.StandardExpressionMenuRow(suggestion.latexCode);
        row.subMenu = item;
        return row;
      });
      if (rows.length) {
        const expressionMenu = new Menu.ExpressionMenu(CachedPromise.resolve(rows));
        const onMenuItemClicked = (action: Menu.ExpressionMenuAction) => {
          if (action instanceof Menu.ImmediateExpressionMenuAction) {
            let result = action.onExecute();
            if (!(result instanceof CachedPromise)) {
              result = CachedPromise.resolve();
            }
            result.then(() => this.setState({inputFocused: false}));
          }
        };
        menu = <ExpressionMenu menu={expressionMenu} onItemClicked={onMenuItemClicked}/>;
      }
    }
    return (
      <span className={'menu-container'} onTouchStart={limitDefaultBehaviorToElement} onTouchCancel={limitDefaultBehaviorToElement} onTouchEnd={limitDefaultBehaviorToElement}>
        <input
          type={'text'}
          className={className}
          value={this.props.value}
          style={style}
          onChange={onChange}
          onMouseDown={limitDefaultBehaviorToElement}
          onMouseUp={limitDefaultBehaviorToElement}
          onTouchStart={limitDefaultBehaviorToElement}
          onTouchCancel={limitDefaultBehaviorToElement}
          onTouchEnd={limitDefaultBehaviorToElement}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyPress={onKeyPress}
          ref={this.props.inputRef}
        />
        {menu}
      </span>
    );
  }
}
