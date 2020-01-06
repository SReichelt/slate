import * as React from 'react';
import StandardDialog from './StandardDialog';
import ValidationMessage from './ValidationMessage';
import { LibraryDataProvider, LibraryDefinition } from '../../shared/data/libraryDataProvider';
import * as Fmt from '../../shared/format/format';
import * as FmtLibrary from '../../shared/logics/library';
import * as Logic from '../../shared/logics/logic';

interface InsertDialogProps {
  libraryDataProvider: LibraryDataProvider;
  section: LibraryDefinition;
  definitionType: Logic.LogicDefinitionTypeDescription | undefined;
  onOK: (name: string, title: string | undefined, type: string | undefined) => void;
  onCancel: () => void;
}

interface InsertDialogState {
  okEnabled: boolean;
  name: string;
  nameError?: Error;
  title: string;
  titleError?: Error;
  type?: string;
}

class InsertDialog extends React.Component<InsertDialogProps, InsertDialogState> {
  constructor(props: InsertDialogProps) {
    super(props);

    this.state = {
      okEnabled: false,
      name: '',
      title: ''
    };
  }

  render(): React.ReactNode {
    let titleLabel: React.ReactNode = 'Title';
    if (this.props.definitionType) {
      titleLabel = [titleLabel, ' ', <span className={'dialog-optional-label'} key={'optional'}>(optional)</span>];
    }
    let typeRow: React.ReactNode = null;
    if (this.props.definitionType && this.props.definitionType.types) {
      typeRow = (
        <tr className={'dialog-row separated-below'}>
          <td className={'dialog-cell'} colSpan={2}>
            <fieldset className={'dialog-group'}>
              <div className={'dialog-radio-button-group'}>
                {this.props.definitionType.types.map((type: string, index: number) => {
                  let internalType = index ? type : undefined;
                  let checked = this.state.type === internalType;
                  return (
                    <div key={type}>
                      <input type={'radio'} id={type} name={'type-radio'} value={internalType} checked={checked} onChange={this.onChangeType}/>
                      <label htmlFor={type}>{type}</label>
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </td>
        </tr>
      );
    }
    return (
      <StandardDialog onOK={this.onOK} onCancel={this.props.onCancel} okEnabled={this.state.okEnabled}>
        <table className={'dialog-contents'}>
          <tbody>
            <tr className={'dialog-row separated-above'}>
              <td className={'dialog-cell'}>Name:</td>
              <td className={'dialog-cell'}>
                <ValidationMessage error={this.state.nameError}>
                  <input type={'text'} value={this.state.name} onChange={this.onChangeName} onBlur={this.onBlurName} autoFocus={true}/>
                </ValidationMessage>
              </td>
            </tr>
            <tr className={'dialog-row separated-below'}>
              <td className={'dialog-cell'}>{titleLabel}:</td>
              <td className={'dialog-cell'}>
                <ValidationMessage error={this.state.titleError}>
                  <input type={'text'} value={this.state.title} onChange={this.onChangeTitle}/>
                </ValidationMessage>
              </td>
            </tr>
            {typeRow}
          </tbody>
        </table>
      </StandardDialog>
    );
  }

  private onChangeName = (event: React.ChangeEvent<HTMLInputElement>): void => {
    let newName = event.target.value;
    let nameError = this.checkName(newName);
    this.setState((prevState) => ({
      name: newName,
      nameError: nameError,
      okEnabled: !(nameError || this.checkTitle(prevState.title))
    }));
  }

  private onBlurName = (event: React.ChangeEvent<HTMLInputElement>): void => {
    let newName = event.target.value;
    if (newName && !this.props.definitionType && !this.state.title) {
      let titleError = this.checkTitle(newName);
      this.setState((prevState) => ({
        title: newName,
        titleError: titleError,
        okEnabled: !(prevState.nameError || titleError)
      }));
    }
  }

  private onChangeTitle = (event: React.ChangeEvent<HTMLInputElement>): void => {
    let newTitle = event.target.value;
    let titleError = this.checkTitle(newTitle);
    this.setState((prevState) => ({
      title: newTitle,
      titleError: titleError,
      okEnabled: !(prevState.nameError || titleError)
    }));
  }

  private checkName(name: string): Error | undefined {
    if (!name) {
      return new Error('Name is required');
    }
    for (let c of name) {
      if (!((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === ' ' || c === '(' || c === ')')) {
        return new Error('Name can only contain alphanumeric characters, spaces, and parentheses');
      }
    }
    let firstChar = name[0];
    if (this.props.definitionType && (this.props.definitionType.definitionType === Logic.LogicDefinitionType.Operator || this.props.definitionType.definitionType === Logic.LogicDefinitionType.Predicate)) {
      if (!(firstChar >= 'a' && firstChar <= 'z')) {
        return new Error(`${this.getDefinitionTypeName()} name must start with a lowercase letter`);
      }
    } else {
      if (!(firstChar >= 'A' && firstChar <= 'Z')) {
        return new Error(`${this.getDefinitionTypeName()} name must start with an uppercase letter`);
      }
    }
    let nameLower = name.toLowerCase();
    let sectionContents = this.props.section.definition.contents as FmtLibrary.ObjectContents_Section;
    for (let item of sectionContents.items) {
      if ((item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection)
          && item.ref instanceof Fmt.DefinitionRefExpression
          && nameLower === item.ref.path.name.toLowerCase()) {
        return new Error('An object with this name already exists');
      }
    }
    return undefined;
  }

  private checkTitle(title: string): Error | undefined {
    title = InsertDialog.trimString(title);
    if (!this.props.definitionType && !title) {
      return new Error('Title is required');
    }
    return undefined;
  }

  private static trimString(s: string): string {
    while (s.startsWith(' ')) {
      s = s.substring(1);
    }
    while (s.endsWith(' ')) {
      s = s.substring(0, s.length - 1);
    }
    return s;
  }

  private getDefinitionTypeName(): string {
    if (this.props.definitionType) {
      let name = this.props.definitionType.name.toLowerCase();
      return name[0].toUpperCase() + name.substring(1);
    } else {
      return 'Section';
    }
  }

  private onChangeType = (event: React.ChangeEvent<HTMLInputElement>): void => {
    let newType = event.target.value;
    this.setState({type: newType ? newType : undefined});
  }

  private onOK = (): void => {
    let name = InsertDialog.trimString(this.state.name);
    let title = InsertDialog.trimString(this.state.title);
    this.props.onOK(name, title ? title : undefined, this.state.type);
  }
}

export default InsertDialog;
