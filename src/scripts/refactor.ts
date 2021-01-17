import * as Fmt from 'slate-shared/format/format';
import * as FmtHLM from 'slate-shared/logics/hlm/meta';

// This code can be used for systematic refactoring operations.
// Uncomment the corresponding code in tidy.ts, edit this file, then run tidyLibrary.sh.

function refactorPath(path: Fmt.Path): void {
  if (path.parentPath instanceof Fmt.Path) {
    refactorPath(path.parentPath);
  }
}

function refactorExpression(expression: Fmt.Expression): void {
  if (expression instanceof Fmt.DefinitionRefExpression) {
    refactorPath(expression.path);
  } else if (expression instanceof Fmt.ParameterExpression) {
    refactorParameterList(expression.parameters);
  } else if (expression instanceof FmtHLM.MetaRefExpression_structural || expression instanceof FmtHLM.MetaRefExpression_setStructuralCases || expression instanceof FmtHLM.MetaRefExpression_structuralCases) {
    for (let structuralCase of expression.cases) {
      if (structuralCase.parameters) {
        refactorParameterList(structuralCase.parameters);
      }
    }
  } else if (expression instanceof FmtHLM.MetaRefExpression_forall || expression instanceof FmtHLM.MetaRefExpression_exists || expression instanceof FmtHLM.MetaRefExpression_existsUnique || expression instanceof FmtHLM.MetaRefExpression_extendedSubset) {
    refactorParameterList(expression.parameters);
  }
}

function refactorParameterList(parameterList: Fmt.ParameterList): void {
  for (let param of parameterList) {
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      refactorParameterList(type.sourceParameters);
      refactorParameterList(type.targetParameters);
    } else {
      type.traverse(refactorExpression);
    }
  }
}

function refactorDefinitionContents(contents: Fmt.ObjectContents): void {
  if (contents instanceof FmtHLM.ObjectContents_Constructor && contents.equalityDefinition) {
    refactorParameterList(contents.equalityDefinition.leftParameters);
    refactorParameterList(contents.equalityDefinition.rightParameters);
  }
  contents.traverse(refactorExpression);
}

function refactorDefinition(definition: Fmt.Definition): void {
  refactorParameterList(definition.parameters);
  if (definition.contents) {
    refactorDefinitionContents(definition.contents);
  }
  refactorDefinitions(definition.innerDefinitions);
}

function refactorDefinitions(definitions: Fmt.DefinitionList): void {
  for (let definition of definitions) {
    refactorDefinition(definition);
  }
}

export function refactorFile(file: Fmt.File): void {
  refactorDefinitions(file.definitions);
}
