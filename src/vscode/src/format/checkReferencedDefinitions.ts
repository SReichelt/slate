'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../shared/format/format';
import * as FmtDynamic from '../../../shared/format/dynamic';
import * as FmtMeta from '../../../shared/format/meta';
import { ParsedDocument } from './parsedDocument';
import { findReferencedDefinition, getArgumentTypeOfReferencedDefinitionParameter } from './navigate';

function checkArgumentValueOfReferencedDefinition(metaModel: FmtDynamic.DynamicMetaModel, param: Fmt.Parameter, value: Fmt.Expression): void {
    let argumentTypeExpression = getArgumentTypeOfReferencedDefinitionParameter(param);
    if (argumentTypeExpression) {
        let argumentType = new Fmt.Type;
        argumentType.expression = argumentTypeExpression;
        argumentType.arrayDimensions = param.type.arrayDimensions;
        metaModel.checkValue(argumentType, value);
    }
}

function checkArgumentsOfReferencedDefinition(metaModel: FmtDynamic.DynamicMetaModel, parameterList: Fmt.ParameterList, argumentList: Fmt.ArgumentList): void {
    let paramIndex = 0;
    for (let param of parameterList) {
        let paramName = param.list ? undefined : param.name;
        let value: Fmt.Expression | undefined;
        if (param.optional || param.defaultValue || (param.type.expression instanceof FmtDynamic.DynamicMetaRefExpression && param.type.expression.metaDefinition.contents instanceof FmtMeta.ObjectContents_ParameterType && param.type.expression.metaDefinition.contents.optional instanceof FmtMeta.MetaRefExpression_true)) {
            value = argumentList.getOptionalValue(paramName, paramIndex);
        } else {
            value = argumentList.getValue(paramName, paramIndex);
        }
        if (value) {
            checkArgumentValueOfReferencedDefinition(metaModel, param, value);
        }
        paramIndex++;
        if (param.list) {
            while (value) {
                value = argumentList.getOptionalValue(paramName, paramIndex);
                if (value) {
                    checkArgumentValueOfReferencedDefinition(metaModel, param, value);
                }
                paramIndex++;
            }
        }
    }
    let foundParams = new Set<Fmt.Parameter>();
    let argIndex = 0;
    for (let arg of argumentList) {
        let param = parameterList.getParameter(arg.name, argIndex);
        if (foundParams.has(param) && !param.list) {
            throw new Error(`Duplicate argument for "${param.name}"`);
        } else {
            foundParams.add(param);
        }
        argIndex++;
    }
}

export function checkReferencedDefinitions(parsedDocument: ParsedDocument, diagnostics: vscode.Diagnostic[], sourceDocument?: vscode.TextDocument): void {
    parsedDocument.hasBrokenReferences = false;
    for (let rangeInfo of parsedDocument.rangeList) {
        if (rangeInfo.object instanceof Fmt.Path && rangeInfo.context && rangeInfo.context.metaModel instanceof FmtDynamic.DynamicMetaModel) {
            try {
                let referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, rangeInfo.context, sourceDocument);
                if (referencedDefinition === undefined) {
                    throw new Error(`Definition "${rangeInfo.object.name}" not found`);
                }
                if (referencedDefinition && referencedDefinition.arguments && referencedDefinition.arguments.length) {
                    checkArgumentsOfReferencedDefinition(rangeInfo.context.metaModel, referencedDefinition.definition.parameters, referencedDefinition.arguments);
                }
            } catch (error) {
                parsedDocument.hasBrokenReferences = true;
                diagnostics.push({
                    message: error.message,
                    range: rangeInfo.range,
                    severity: vscode.DiagnosticSeverity.Error
                });
            }
        }
    }
}

