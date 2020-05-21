'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../shared/format/format';
import * as FmtDynamic from '../../../shared/format/dynamic';
import * as FmtMeta from '../../../shared/format/meta';
import { ParsedDocument } from './parsedDocument';
import { findReferencedDefinition, getArgumentTypeOfReferencedDefinitionParameter, ReferencedDefinition } from './navigate';

class ReferenceChecker {
    referencedDefinition?: ReferencedDefinition;

    constructor(private parsedDocument: ParsedDocument, private diagnostics: vscode.Diagnostic[] | undefined, private metaModel: FmtDynamic.DynamicMetaModel, private range: vscode.Range, sourceDocument?: vscode.TextDocument) {}

    checkNestedArgumentList(outerParamType: FmtDynamic.DynamicMetaRefExpression, parameterListIndex: number, argumentList: Fmt.ArgumentList): void {
        let paramTypeParamIndex = 0;
        for (let paramTypeParam of outerParamType.metaDefinition.parameters) {
            if (paramTypeParam.type.expression instanceof FmtMeta.MetaRefExpression_ParameterList) {
                let paramTypeArg = outerParamType.arguments.getOptionalValue(paramTypeParam.name, paramTypeParamIndex);
                if (paramTypeArg instanceof Fmt.ParameterExpression) {
                    if (parameterListIndex) {
                        parameterListIndex--;
                    } else {
                        if (this.referencedDefinition) {
                            this.parsedDocument.nestedArgumentListsMap?.set(argumentList, {
                                targetDocument: this.referencedDefinition.parsedDocument,
                                parameterExpression: paramTypeArg
                            });
                        }
                        this.checkArgumentsOfReferencedDefinition(paramTypeArg.parameters, argumentList);
                        break;
                    }
                }
            }
            paramTypeParamIndex++;
        }
    }

    checkArgumentValueOfReferencedDefinition(param: Fmt.Parameter, value: Fmt.Expression): void {
        let argumentTypeExpression = getArgumentTypeOfReferencedDefinitionParameter(param);
        if (argumentTypeExpression) {
            let argumentType = new Fmt.Type;
            argumentType.expression = argumentTypeExpression;
            argumentType.arrayDimensions = param.type.arrayDimensions;
            let onObjectContentsCreated: FmtDynamic.ObjectContentsCallbackFn | undefined = undefined;
            if (this.parsedDocument.objectContentsMap) {
                onObjectContentsCreated = (expression: Fmt.CompoundExpression, objectContents: FmtDynamic.DynamicObjectContents) => this.parsedDocument.objectContentsMap?.set(expression, objectContents);
            }
            let onMemberFound: FmtDynamic.MemberCallbackFn | undefined = undefined;
            if (param.type.expression instanceof FmtDynamic.DynamicMetaRefExpression) {
                let paramType = param.type.expression;
                let parameterListIndex = 0;
                onMemberFound = (member: Fmt.Parameter, memberValue: Fmt.Expression) => {
                    if (member.type.expression instanceof FmtMeta.MetaRefExpression_ArgumentList && memberValue instanceof Fmt.CompoundExpression) {
                        try {
                            this.checkNestedArgumentList(paramType, parameterListIndex++, memberValue.arguments);
                        } catch (error) {
                            this.error(error.message, memberValue);
                        }
                    }
                };
            }
            try {
                this.metaModel.checkValue(argumentType, value, onObjectContentsCreated, onMemberFound);
            } catch (error) {
                this.error(error.message, value);
            }
        }
    }

    checkArgumentsOfReferencedDefinition(parameterList: Fmt.ParameterList, argumentList: Fmt.ArgumentList): void {
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
                this.checkArgumentValueOfReferencedDefinition(param, value);
            }
            paramIndex++;
            if (param.list) {
                while (value) {
                    value = argumentList.getOptionalValue(paramName, paramIndex);
                    if (value) {
                        this.checkArgumentValueOfReferencedDefinition(param, value);
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
                this.error(`Duplicate argument for "${param.name}"`, arg);
            } else {
                foundParams.add(param);
            }
            argIndex++;
        }
    }

    error(message: string, object?: Object): void {
        this.parsedDocument.hasBrokenReferences = true;
        if (this.diagnostics) {
            let range = this.range;
            if (object !== undefined) {
                let rangeInfo = this.parsedDocument.rangeMap.get(object);
                if (rangeInfo) {
                    range = rangeInfo.range;
                }
            }
            this.diagnostics.push({
                message: message,
                range: range,
                severity: vscode.DiagnosticSeverity.Error
            });
        }
    }
}

export function checkReferencedDefinitions(parsedDocument: ParsedDocument, diagnostics: vscode.Diagnostic[] | undefined, sourceDocument?: vscode.TextDocument): void {
    parsedDocument.hasBrokenReferences = false;
    for (let rangeInfo of parsedDocument.rangeList) {
        if (rangeInfo.object instanceof Fmt.Path && rangeInfo.context && rangeInfo.context.metaModel instanceof FmtDynamic.DynamicMetaModel) {
            let referenceChecker = new ReferenceChecker(parsedDocument, diagnostics, rangeInfo.context.metaModel, rangeInfo.range, sourceDocument);
            let referencedDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object, rangeInfo.context, sourceDocument);
            if (referencedDefinition === undefined) {
                referenceChecker.error(`Definition "${rangeInfo.object.name}" not found`);
            }
            if (referencedDefinition && referencedDefinition.arguments && referencedDefinition.arguments.length) {
                referenceChecker.referencedDefinition = referencedDefinition;
                try {
                    referenceChecker.checkArgumentsOfReferencedDefinition(referencedDefinition.definition.parameters, referencedDefinition.arguments);
                } catch (error) {
                    referenceChecker.error(error.message);
                }
            }
        }
    }
}

