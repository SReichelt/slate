import * as fs from 'fs';
import * as Fmt from '../shared/format/format';
import * as FmtReader from '../shared/format/read';
import * as FmtWriter from '../shared/format/write';
import { getMetaModelWithFallback } from '../fs/format/dynamic';
import * as Logics from '../shared/logics/logics';
import * as FmtHLM from '../shared/logics/hlm/meta';

function manipulatePath(path: Fmt.Path): void {
/*  for (let arg of path.arguments) {
    if (arg.name && arg.value instanceof Fmt.CompoundExpression && arg.value.arguments.length === 2 && arg.value.arguments[0].value instanceof Fmt.ParameterExpression && arg.value.arguments[1].value instanceof Fmt.CompoundExpression) {
      arg.name = '_' + arg.name;
      let innerValue = arg.value.arguments[1].value;
      while (innerValue.arguments.length === 1 && innerValue.arguments[0].value instanceof Fmt.CompoundExpression && innerValue.arguments[0].value.arguments.length === 2 && innerValue.arguments[0].value.arguments[0].value instanceof Fmt.ParameterExpression && innerValue.arguments[0].value.arguments[1].value instanceof Fmt.CompoundExpression) {
        let prevParam = arg.value.arguments[0].value.parameters[arg.value.arguments[0].value.parameters.length - 1];
        for (let param of innerValue.arguments[0].value.arguments[0].value.parameters) {
          if (param.type.expression.isEquivalentTo(prevParam.type.expression) && param.type.expression instanceof FmtHLM.MetaRefExpression_Element) {
            param.type.expression._set = new FmtHLM.MetaRefExpression_previous;
          }
          arg.value.arguments[0].value.parameters.push(param);
        }
        innerValue = innerValue.arguments[0].value.arguments[1].value;
        arg.value.arguments[1].value = innerValue;
      }
      console.log(arg.toString());
    }
  }*/
  if (path.parentPath instanceof Fmt.Path) {
    manipulatePath(path.parentPath);
  }
}

function manipulateExpression(expression: Fmt.Expression): void {
/*  if (expression instanceof Fmt.ParameterExpression) {
    manipulateParameterList(expression.parameters);
  } else if (expression instanceof Fmt.VariableRefExpression && expression.indices) {
    let curBinding = expression.variable.previousParameter;
    for (let indexArgs of expression.indices) {
      for (let indexIndex = indexArgs.length - 1; indexIndex >= 0; indexIndex--) {
        let indexArg = indexArgs[indexIndex];
        while (curBinding) {
          if (curBinding.type.expression instanceof FmtHLM.MetaRefExpression_Binding) {
            indexArg.name = curBinding.name;
            let newValue = new Fmt.CompoundExpression;
            newValue.arguments.add(indexArg.value);
            indexArg.value = newValue;
            curBinding = curBinding.previousParameter;
            break;
          }
          curBinding = curBinding.previousParameter;
        }
      }
    }
    console.log(expression.toString());
  } else if (expression instanceof FmtHLM.MetaRefExpression_structural || expression instanceof FmtHLM.MetaRefExpression_setStructuralCases || expression instanceof FmtHLM.MetaRefExpression_structuralCases) {
    for (let structuralCase of expression.cases) {
      if (structuralCase.parameters) {
        manipulateParameterList(structuralCase.parameters);
      }
    }
  } else if (expression instanceof FmtHLM.MetaRefExpression_forall || expression instanceof FmtHLM.MetaRefExpression_exists || expression instanceof FmtHLM.MetaRefExpression_existsUnique || expression instanceof FmtHLM.MetaRefExpression_extendedSubset) {
    manipulateParameterList(expression.parameters);
  }*/
  if (expression instanceof Fmt.DefinitionRefExpression) {
    manipulatePath(expression.path);
  }
}

/*function convertBinding(oldType: FmtHLM.MetaRefExpression_Binding, newType: FmtHLM.MetaRefExpression_Binder, paramName: string): void {
  let paramTypeExpression = new FmtHLM.MetaRefExpression_Element;
  paramTypeExpression._set = oldType._set;
  paramTypeExpression._set.traverse(manipulateExpression);
  let paramType = new Fmt.Type;
  paramType.expression = paramTypeExpression;
  let param = new Fmt.Parameter;
  param.name = paramName;
  param.type = paramType;
  newType.sourceParameters.push(param);
  if (oldType.parameters.length === 1 && oldType.parameters[0].type.expression instanceof FmtHLM.MetaRefExpression_Binding) {
    convertBinding(oldType.parameters[0].type.expression, newType, oldType.parameters[0].name);
  } else {
    newType.targetParameters = oldType.parameters;
    manipulateParameterList(newType.targetParameters);
  }
}*/

function manipulateParameterList(parameterList: Fmt.ParameterList): void {
/*  for (let param of parameterList) {
    if (param.type.expression instanceof FmtHLM.MetaRefExpression_Binding) {
      let newType = new FmtHLM.MetaRefExpression_Binder;
      newType.sourceParameters = Object.create(Fmt.ParameterList.prototype);
      convertBinding(param.type.expression, newType, param.name);
      param.name = '_' + param.name;
      param.type.expression = newType;
      console.log(param.toString());
    } else {
      param.type.expression.traverse(manipulateExpression);
    }
  }*/
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
  manipulateDefinitions(file.definitions);
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
