import * as fs from 'fs';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtWriter from '../shared/format/write';
import { getMetaModelWithFallback } from '../fs/format/dynamic';
import * as Logics from '../shared/logics/logics';
import * as FmtHLM from '../shared/logics/hlm/meta';

/*

function manipulatePath(path: Fmt.Path): void {
  if (path.parentPath instanceof Fmt.Path) {
    manipulatePath(path.parentPath);
  }
}

function manipulateExpression(expression: Fmt.Expression): void {
  if (expression instanceof Fmt.DefinitionRefExpression) {
    manipulatePath(expression.path);
  } else if (expression instanceof Fmt.ParameterExpression) {
    manipulateParameterList(expression.parameters);
  } else if (expression instanceof FmtHLM.MetaRefExpression_structural || expression instanceof FmtHLM.MetaRefExpression_setStructuralCases || expression instanceof FmtHLM.MetaRefExpression_structuralCases) {
    for (let structuralCase of expression.cases) {
      if (structuralCase.parameters) {
        manipulateParameterList(structuralCase.parameters);
      }
    }
  } else if (expression instanceof FmtHLM.MetaRefExpression_forall || expression instanceof FmtHLM.MetaRefExpression_exists || expression instanceof FmtHLM.MetaRefExpression_existsUnique || expression instanceof FmtHLM.MetaRefExpression_extendedSubset) {
    manipulateParameterList(expression.parameters);
  }
}

function manipulateParameterList(parameterList: Fmt.ParameterList): void {
  for (let param of parameterList) {
    let type = param.type;
    if (type instanceof FmtHLM.MetaRefExpression_Binder) {
      manipulateParameterList(type.sourceParameters);
      manipulateParameterList(type.targetParameters);
    } else {
      type.traverse(manipulateExpression);
    }
  }
}

function manipulateDefinitionContents(contents: Fmt.ObjectContents): void {
  if (contents instanceof FmtHLM.ObjectContents_Constructor && contents.equalityDefinition) {
    manipulateParameterList(contents.equalityDefinition.leftParameters);
    manipulateParameterList(contents.equalityDefinition.rightParameters);
  }
  contents.traverse(manipulateExpression);
}

function manipulateDefinition(definition: Fmt.Definition): void {
  manipulateParameterList(definition.parameters);
  if (definition.contents) {
    manipulateDefinitionContents(definition.contents);
  }
  manipulateDefinitions(definition.innerDefinitions);
}

function manipulateDefinitions(definitions: Fmt.DefinitionList): void {
  for (let definition of definitions) {
    manipulateDefinition(definition);
  }
}

*/

function tidy(fileName: string): void {
  let fileStr = fs.readFileSync(fileName, 'utf8');
  let getMetaModel = (path: Fmt.Path) => {
    let logic = Logics.findLogic(path.name);
    if (logic) {
      return logic.getMetaModel(path);
    }
    return getMetaModelWithFallback(fileName, path);
  };
  let file = FmtReader.readString(fileStr, fileName, getMetaModel);
  //manipulateDefinitions(file.definitions);
  let newFileStr = FmtWriter.writeString(file);
  if (newFileStr !== fileStr) {
    fs.writeFileSync(fileName, newFileStr, 'utf8');
    console.log(`Tidied ${fileName}.`);
  }
}

if (process.argv.length < 3) {
  console.error('usage: src/scripts/tidy.sh <file1> [<file2>...]');
  process.exit(2);
}

for (let fileName of process.argv.slice(2)) {
  tidy(fileName);
}
