import * as vscode from 'vscode';
import { ParsedDocumentMap } from '../parsedDocument';
import { RangeInfo } from '../../utils';
import { getSignatureInfo } from '../navigate';
import { readRange } from '../utils';

export class SlateSignatureHelpProvider implements vscode.SignatureHelpProvider {
    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SignatureHelp> {
        const parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            for (const rangeInfo of parsedDocument.rangeList) {
                if (token.isCancellationRequested) {
                    break;
                }
                if (rangeInfo.range.contains(position)) {
                    const signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, true, document);
                    if (signatureInfo && signatureInfo.signatureCode && signatureInfo.parameters) {
                        const signature = new vscode.SignatureInformation(signatureInfo.signatureCode);
                        for (const param of signatureInfo.parameters) {
                            const paramRangeInfo = signatureInfo.parsedDocument.rangeMap.get(param);
                            let paramCode: string | undefined = undefined;
                            if (paramRangeInfo) {
                                paramCode = readRange(signatureInfo.parsedDocument.uri, paramRangeInfo.range, true, document);
                            }
                            signature.parameters.push(new vscode.ParameterInformation(paramCode || param.name));
                        }
                        let paramIndex = 0;
                        if (signatureInfo.arguments && signatureInfo.arguments.length) {
                            let argIndex = 0;
                            let paramIsList = false;
                            let prevArgRangeInfo: RangeInfo | undefined = undefined;
                            for (const arg of signatureInfo.arguments) {
                                const argRangeInfo = parsedDocument.rangeMap.get(arg);
                                if (argRangeInfo && position.isAfterOrEqual(argRangeInfo.range.start)) {
                                    paramIndex = 0;
                                    for (const param of signatureInfo.parameters) {
                                        paramIsList = param.list;
                                        if (arg.name ? arg.name === param.name : paramIsList ? argIndex >= paramIndex : argIndex === paramIndex) {
                                            break;
                                        }
                                        paramIndex++;
                                    }
                                } else {
                                    break;
                                }
                                prevArgRangeInfo = argRangeInfo;
                                argIndex++;
                            }
                            if (prevArgRangeInfo && position.isAfter(prevArgRangeInfo.range.end)) {
                                const afterRange = new vscode.Range(prevArgRangeInfo.range.end, position);
                                const afterText = document.getText(afterRange).trim();
                                if (afterText) {
                                    if (afterText === ',') {
                                        if (!paramIsList) {
                                            paramIndex++;
                                        }
                                    } else {
                                        return undefined;
                                    }
                                }
                            }
                        }
                        return {
                            signatures: [signature],
                            activeSignature: 0,
                            activeParameter: paramIndex
                        };
                    }
                }
            }
        }
        return undefined;
    }
}

