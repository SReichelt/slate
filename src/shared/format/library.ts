// Generated from data/format/library.hlm by generateMetaDeclarations.ts.
// tslint:disable:class-name
// tslint:disable:variable-name

import * as Fmt from './format';

export class ObjectContents_Section extends Fmt.ObjectContents {
  items?: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.items = argumentList.getOptionalValue('items', 0);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    if (this.items !== undefined) {
      argumentList.add(this.items, 'items');
    }
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Section, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = false;
    if (this.items) {
      result.items = this.items.substitute(fn, replacedParameters);
      if (result.items !== this.items) {
        changed = true;
      }
    }
    return changed;
  }
}

export class MetaRefExpression_Section extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Section';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_Section;
  }
}

export class ObjectContents_Library extends ObjectContents_Section {
  logic: Fmt.Expression;

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    super.fromArgumentList(argumentList);
    this.logic = argumentList.getValue('logic', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    super.toArgumentList(argumentList);
    argumentList.add(this.logic, 'logic');
  }

  substituteExpression(fn: Fmt.ExpressionSubstitutionFn, result: ObjectContents_Library, replacedParameters: Fmt.ReplacedParameter[] = []): boolean {
    let changed = super.substituteExpression(fn, result, replacedParameters);
    if (this.logic) {
      result.logic = this.logic.substitute(fn, replacedParameters);
      if (result.logic !== this.logic) {
        changed = true;
      }
    }
    return changed;
  }
}

export class MetaRefExpression_Library extends Fmt.MetaRefExpression {
  getName(): string {
    return 'Library';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
  }

  createDefinitionContents(): Fmt.ObjectContents | undefined {
    return new ObjectContents_Library;
  }
}

export class MetaRefExpression_item extends Fmt.MetaRefExpression {
  ref: Fmt.Expression;
  type?: string;
  title?: Fmt.Expression;

  getName(): string {
    return 'item';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.ref = argumentList.getValue('ref', 0);
    let typeRaw = argumentList.getOptionalValue('type', 1);
    if (typeRaw !== undefined) {
      if (typeRaw instanceof Fmt.StringExpression) {
        this.type = typeRaw.value;
      } else {
        throw new Error('type: String expected');
      }
    }
    this.title = argumentList.getOptionalValue('title', 2);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.ref);
    if (this.type !== undefined) {
      let typeExpr = new Fmt.StringExpression;
      typeExpr.value = this.type;
      argumentList.add(typeExpr, 'type');
    }
    if (this.title !== undefined) {
      argumentList.add(this.title, 'title');
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_item;
    let changed = false;
    if (this.ref) {
      result.ref = this.ref.substitute(fn, replacedParameters);
      if (result.ref !== this.ref) {
        changed = true;
      }
    }
    if (this.title) {
      result.title = this.title.substitute(fn, replacedParameters);
      if (result.title !== this.title) {
        changed = true;
      }
    }
    if (!changed) {
      result = this;
    }
    return fn(result);
  }
}

export class MetaRefExpression_subsection extends Fmt.MetaRefExpression {
  ref: Fmt.Expression;
  title?: Fmt.Expression;

  getName(): string {
    return 'subsection';
  }

  fromArgumentList(argumentList: Fmt.ArgumentList): void {
    this.ref = argumentList.getValue('ref', 0);
    this.title = argumentList.getOptionalValue('title', 1);
  }

  toArgumentList(argumentList: Fmt.ArgumentList): void {
    argumentList.length = 0;
    argumentList.add(this.ref);
    if (this.title !== undefined) {
      argumentList.add(this.title, 'title');
    }
  }

  substitute(fn: Fmt.ExpressionSubstitutionFn, replacedParameters: Fmt.ReplacedParameter[] = []): Fmt.Expression {
    let result = new MetaRefExpression_subsection;
    let changed = false;
    if (this.ref) {
      result.ref = this.ref.substitute(fn, replacedParameters);
      if (result.ref !== this.ref) {
        changed = true;
      }
    }
    if (this.title) {
      result.title = this.title.substitute(fn, replacedParameters);
      if (result.title !== this.title) {
        changed = true;
      }
    }
    if (!changed) {
      result = this;
    }
    return fn(result);
  }
}

const definitionTypes: Fmt.MetaDefinitionList = {'Library': MetaRefExpression_Library, 'Section': MetaRefExpression_Section};
const expressionTypes: Fmt.MetaDefinitionList = {};
const functions: Fmt.MetaDefinitionList = {'item': MetaRefExpression_item, 'subsection': MetaRefExpression_subsection};

export const metaModel = new Fmt.MetaModel(
  new Fmt.StandardMetaDefinitionFactory(definitionTypes),
  new Fmt.StandardMetaDefinitionFactory(expressionTypes),
  new Fmt.StandardMetaDefinitionFactory(functions)
);

export function getMetaModel(path: Fmt.Path) {
  if (path.name !== 'library') {
    throw new Error('File of type "library" expected');
  }
  return metaModel;
}
