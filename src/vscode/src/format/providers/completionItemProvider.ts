import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';  // TODO replace with vscode.workspace.fs / WorkspaceFileAccessor
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import { escapeIdentifier } from 'slate-shared/format/common';
import * as FmtDynamic from 'slate-shared/format/dynamic';
import * as FmtMeta from 'slate-shared/format/meta';
import { fileExtension } from 'slate-shared/data/constants';
import { getFileNameFromPath, getFileNameFromPathStr } from 'slate-env-node/format/dynamic';
import { ParsedDocument, ParsedDocumentMap } from '../parsedDocument';
import { ReferencedDefinition, findReferencedDefinition, SignatureInfo, getSignatureInfo, getArgumentType } from '../navigate';
import { readRange } from '../utils';
import { RangeInfo } from '../../utils';
import { parseFile } from '../parse';
import { appendDocumentation } from '../documentation';

export class SlateCompletionItemProvider implements vscode.CompletionItemProvider {
    private static readonly knownDocumentationItemKinds = ['param', 'example', 'remarks', 'references'];

    constructor(private parsedDocuments: ParsedDocumentMap) {}

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        const parsedDocument = this.parsedDocuments.get(document);
        if (parsedDocument) {
            const result: vscode.CompletionItem[] = [];
            const variableNames = new Set<string>();
            const rangeList = parsedDocument.rangeList;
            for (let rangeInfoIndex = 0; rangeInfoIndex < rangeList.length; rangeInfoIndex++) {
                const rangeInfo = rangeList[rangeInfoIndex];
                if (rangeInfo.range.contains(position)) {
                    if (token.isCancellationRequested) {
                        break;
                    }
                    const finished = this.appendCompletionItems(document, parsedDocument, position, rangeInfo, rangeInfoIndex, variableNames, context, result);
                    if (finished || (rangeInfo.object instanceof Fmt.Expression && !(rangeInfo.object instanceof Fmt.VariableRefExpression))) {
                        break;
                    }
                }
            }
            this.setSortTexts(result);
            return result;
        }
        return undefined;
    }

    private appendCompletionItems(document: vscode.TextDocument, parsedDocument: ParsedDocument, position: vscode.Position, rangeInfo: RangeInfo, rangeInfoIndex: number, variableNames: Set<string>, context: vscode.CompletionContext, result: vscode.CompletionItem[]): boolean {
        if (rangeInfo.object instanceof Fmt.DocumentationComment || rangeInfo.object instanceof Fmt.DocumentationItem) {
            this.appendDocumentationItems(parsedDocument, rangeInfoIndex, context, result);
            return true;
        }
        let isEmptyExpression = rangeInfo.object instanceof FmtReader.EmptyExpression || (rangeInfo.object instanceof Fmt.ArrayExpression && !rangeInfo.object.items.length && position.isAfter(rangeInfo.range.start) && position.isBefore(rangeInfo.range.end));
        let signatureInfo: SignatureInfo | undefined = undefined;
        let argNameRange: vscode.Range | null | undefined = undefined;
        if (!(rangeInfo.linkRange && rangeInfo.linkRange.contains(position))) {
            signatureInfo = getSignatureInfo(parsedDocument, rangeInfo, position, false, document);
            if (signatureInfo?.isMetaModel && context.triggerKind !== vscode.CompletionTriggerKind.Invoke && context.triggerCharacter !== '\n') {
                signatureInfo = undefined;
            }
            if (signatureInfo && signatureInfo.parameters) {
                const filledParameters = new Set<Fmt.Parameter>();
                if (signatureInfo.arguments) {
                    argNameRange = this.determineArgNameRangeAndFilledParameters(parsedDocument, position, signatureInfo.parameters, signatureInfo.arguments, filledParameters);
                    if (argNameRange === null) {
                        signatureInfo = undefined;
                    }
                }
                if (signatureInfo && signatureInfo.parameters) {
                    this.appendArguments(document, rangeInfo, signatureInfo, signatureInfo.parameters, filledParameters, argNameRange ?? undefined, result);
                    if (rangeInfo.object instanceof Fmt.MetaRefExpression || rangeInfo.object instanceof Fmt.CompoundExpression) {
                        isEmptyExpression = true;
                    }
                }
            }
        }
        if ((context.triggerCharacter === '(' || context.triggerCharacter === '[' || context.triggerCharacter === ' ' || context.triggerCharacter === '\n') && argNameRange !== null) {
            return false;
        }
        if (context.triggerKind === vscode.CompletionTriggerKind.Invoke || signatureInfo) {
            if ((isEmptyExpression && (!rangeInfo.metaDefinitions || rangeInfo.metaDefinitions.allowArbitraryReferences())) || rangeInfo.object instanceof Fmt.VariableRefExpression) {
                this.appendVariables(document, parsedDocument, rangeInfo, variableNames, result);
            }
        }
        if (isEmptyExpression || (rangeInfo.object instanceof Fmt.MetaRefExpression && rangeInfo.nameRange && rangeInfo.nameRange.contains(position))) {
            this.appendMetaDefinitions(document, parsedDocument, rangeInfo, isEmptyExpression, result);
        }
        if ((isEmptyExpression && (!rangeInfo.metaDefinitions || rangeInfo.metaDefinitions.allowArbitraryReferences())) || (rangeInfo.object instanceof Fmt.NamedPathItem && rangeInfo.nameRange && rangeInfo.nameRange.contains(position))) {
            this.appendPaths(document, parsedDocument, rangeInfo, result);
        }
        return signatureInfo !== undefined;
    }

    private appendMetaDefinitions(document: vscode.TextDocument, parsedDocument: ParsedDocument, rangeInfo: RangeInfo, isEmptyExpression: boolean, result: vscode.CompletionItem[]): void {
        if (rangeInfo.metaDefinitions instanceof FmtDynamic.DynamicMetaDefinitionFactory && parsedDocument.metaModelDocuments) {
            const metaModelDocument = parsedDocument.metaModelDocuments.get(rangeInfo.metaDefinitions.metaModel);
            if (metaModelDocument) {
                const prefix = isEmptyExpression ? '%' : '';
                let range: vscode.Range | undefined = undefined;
                if (rangeInfo.object instanceof FmtDynamic.DynamicMetaRefExpression && rangeInfo.object.name && rangeInfo.nameRange && !isEmptyExpression) {
                    range = rangeInfo.nameRange;
                }
                for (const definition of rangeInfo.metaDefinitions.metaDefinitions.values()) {
                    this.appendDefinition(document, metaModelDocument, definition, prefix, range, vscode.CompletionItemKind.Keyword, result);
                }
            }
        }
    }

    private appendPaths(document: vscode.TextDocument, parsedDocument: ParsedDocument, rangeInfo: RangeInfo, result: vscode.CompletionItem[]): void {
        let range: vscode.Range | undefined = undefined;
        if (rangeInfo.object instanceof Fmt.NamedPathItem && rangeInfo.object.name) {
            range = rangeInfo.nameRange;
        }
        if (rangeInfo.object instanceof Fmt.Path && rangeInfo.object.parentPath instanceof Fmt.Path) {
            const parentDefinition = findReferencedDefinition(parsedDocument, rangeInfo.object.parentPath, rangeInfo.context, document);
            if (parentDefinition) {
                this.appendInnerDefinitions(document, range, parentDefinition, result);
            }
        } else {
            this.appendOuterPaths(document, parsedDocument, rangeInfo, range, result);
        }
    }

    private appendOuterPaths(document: vscode.TextDocument, parsedDocument: ParsedDocument, rangeInfo: RangeInfo, range: vscode.Range | undefined, result: vscode.CompletionItem[]): void {
        let prefix = rangeInfo.object instanceof Fmt.NamedPathItem ? '' : '$';
        if (rangeInfo.object instanceof Fmt.NamedPathItem && rangeInfo.object.parentPath) {
            const parentPathRange = parsedDocument.rangeMap.get(rangeInfo.object.parentPath);
            if (parentPathRange && parentPathRange.range.isEqual(rangeInfo.range)) {
                prefix = '/';
            }
        } else {
            this.appendPathAliases(parsedDocument, range, prefix, result);
        }
        let addParent = false;
        if (parsedDocument.file && rangeInfo.object instanceof Fmt.Path && rangeInfo.object === parsedDocument.file.metaModelPath) {
            this.appendMetaModelPaths(parsedDocument, rangeInfo.object, range, prefix, result);
            addParent = true;
        } else {
            addParent = this.appendDefinitionPaths(document, parsedDocument, rangeInfo, range, prefix, result);
        }
        if (addParent) {
            result.push({
                label: prefix + '..',
                range: range,
                kind: vscode.CompletionItemKind.Folder
            });
        }
    }

    private appendPathAliases(parsedDocument: ParsedDocument, range: vscode.Range | undefined, prefix: string, result: vscode.CompletionItem[]): void {
        for (const pathAlias of parsedDocument.pathAliases) {
            const documentation = new vscode.MarkdownString;
            documentation.appendCodeblock('$' + pathAlias.path.toString());
            result.push({
                label: prefix + '~' + escapeIdentifier(pathAlias.name),
                range: range,
                documentation: documentation,
                kind: vscode.CompletionItemKind.Constant
            });
        }
    }

    private appendMetaModelPaths(parsedDocument: ParsedDocument, parentPath: Fmt.Path, range: vscode.Range | undefined, prefix: string, result: vscode.CompletionItem[]): void {
        const currentPath = getFileNameFromPath(parsedDocument.uri.fsPath, parentPath, true, false);
        try {
            for (const fileName of fs.readdirSync(currentPath)) {
                const fullPath = path.join(currentPath, fileName);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    result.push({
                        label: prefix + escapeIdentifier(fileName),
                        range: range,
                        kind: vscode.CompletionItemKind.Folder
                    });
                }
                else if (stat.isFile() && fileName.endsWith(fileExtension)) {
                    result.push({
                        label: prefix + escapeIdentifier(fileName.substring(0, fileName.length - fileExtension.length)),
                        range: range,
                        kind: vscode.CompletionItemKind.File
                    });
                }
            }
        }
        catch (error) {
        }
    }

    private appendDefinitionPaths(document: vscode.TextDocument, parsedDocument: ParsedDocument, rangeInfo: RangeInfo, range: vscode.Range | undefined, prefix: string, result: vscode.CompletionItem[]): boolean {
        const metaModel = rangeInfo.context?.metaModel;
        if (metaModel instanceof FmtDynamic.DynamicMetaModel && metaModel.definitions.length) {
            const metaModelDefinition = metaModel.definitions[0];
            if (metaModelDefinition.contents instanceof FmtMeta.ObjectContents_MetaModel) {
                const lookup = metaModelDefinition.contents.lookup;
                return this.appendValidDefinitionPaths(document, parsedDocument, rangeInfo, range, prefix, metaModel, lookup, result);
            }
        }
        return false;
    }

    private appendValidDefinitionPaths(document: vscode.TextDocument, parsedDocument: ParsedDocument, rangeInfo: RangeInfo, range: vscode.Range | undefined, prefix: string, metaModel: FmtDynamic.DynamicMetaModel, lookup: Fmt.Expression | undefined, result: vscode.CompletionItem[]): boolean {
        let addParent = true;
        let currentFile: string | undefined = undefined;
        let currentDirectory: string | undefined = undefined;
        let referencedDocument: ParsedDocument | undefined = undefined;
        if (lookup instanceof FmtMeta.MetaRefExpression_self) {
            if (rangeInfo.object instanceof Fmt.NamedPathItem && rangeInfo.object.parentPath) {
                const fileName = getFileNameFromPath(parsedDocument.uri.fsPath, rangeInfo.object, true);
                if (fileName && fs.existsSync(fileName)) {
                    currentFile = fileName;
                }
                else {
                    currentDirectory = getFileNameFromPath(parsedDocument.uri.fsPath, rangeInfo.object, true, false);
                }
            }
            else {
                result.push({
                    label: prefix + '.',
                    range: range,
                    kind: vscode.CompletionItemKind.Folder
                });
                referencedDocument = parsedDocument;
            }
        }
        else if (lookup instanceof FmtMeta.MetaRefExpression_Any) {
            if (rangeInfo.object instanceof Fmt.NamedPathItem) {
                currentDirectory = getFileNameFromPath(parsedDocument.uri.fsPath, rangeInfo.object, true, false);
            }
            else {
                currentDirectory = path.dirname(parsedDocument.uri.fsPath);
            }
        }
        else if (lookup instanceof Fmt.StringExpression) {
            currentFile = getFileNameFromPathStr(metaModel.fileName, lookup.value);
            addParent = false;
        }
        try {
            if (currentFile) {
                referencedDocument = parseFile(vscode.Uri.file(currentFile));
            }
            if (currentDirectory) {
                const dirStat = fs.statSync(currentDirectory);
                if (!dirStat.isDirectory()) {
                    currentDirectory = undefined;
                }
            }
            if (currentDirectory) {
                for (const fileName of fs.readdirSync(currentDirectory)) {
                    const fullPath = path.join(currentDirectory, fileName);
                    const fileStat = fs.statSync(fullPath);
                    if (fileStat.isDirectory()) {
                        result.push({
                            label: prefix + escapeIdentifier(fileName),
                            range: range,
                            kind: vscode.CompletionItemKind.Folder
                        });
                    }
                    else if (fileStat.isFile() && fileName.endsWith(fileExtension)) {
                        if (lookup instanceof FmtMeta.MetaRefExpression_Any) {
                            try {
                                const fileDocument = parseFile(vscode.Uri.file(fullPath));
                                if (fileDocument && fileDocument.file && fileDocument.file.definitions.length) {
                                    const definition = fileDocument.file.definitions[0];
                                    if (definition.name + fileExtension === fileName) {
                                        this.appendDefinition(document, fileDocument, definition, prefix, range, vscode.CompletionItemKind.Reference, result);
                                    }
                                }
                            }
                            catch (error) {
                            }
                        }
                        else {
                            result.push({
                                label: prefix + escapeIdentifier(fileName.substring(0, fileName.length - fileExtension.length)),
                                range: range,
                                kind: vscode.CompletionItemKind.File
                            });
                        }
                    }
                }
            } else {
                addParent = false;
            }
        }
        catch (error) {
            addParent = false;
        }
        if (referencedDocument && referencedDocument.file) {
            for (const definition of referencedDocument.file.definitions) {
                this.appendDefinition(document, referencedDocument, definition, prefix, range, vscode.CompletionItemKind.Reference, result);
            }
        }
        return addParent;
    }

    private appendInnerDefinitions(document: vscode.TextDocument, range: vscode.Range | undefined, parentDefinition: ReferencedDefinition, result: vscode.CompletionItem[]): void {
        for (const definition of parentDefinition.definition.innerDefinitions) {
            this.appendDefinition(document, parentDefinition.parsedDocument, definition, '', range, vscode.CompletionItemKind.Reference, result);
        }
    }

    private appendDefinition(document: vscode.TextDocument, referencedDocument: ParsedDocument, definition: Fmt.Definition, prefix: string, range: vscode.Range | undefined, completionItemKind: vscode.CompletionItemKind, result: vscode.CompletionItem[]): void {
        const definitionRangeInfo = referencedDocument.rangeMap.get(definition);
        const signature = definitionRangeInfo ? readRange(referencedDocument.uri, definitionRangeInfo.signatureRange, true, document) : undefined;
        let documentation: vscode.MarkdownString | undefined = undefined;
        if (signature) {
            documentation = new vscode.MarkdownString;
            documentation.appendCodeblock(signature);
            if (definition.documentation) {
                appendDocumentation(definition.documentation, false, undefined, documentation);
            }
        }
        result.push({
            label: prefix + escapeIdentifier(definition.name),
            range: range,
            documentation: documentation,
            kind: completionItemKind
        });
    }

    private determineArgNameRangeAndFilledParameters(parsedDocument: ParsedDocument, position: vscode.Position, params: Fmt.Parameter[], args: Fmt.Argument[], filledParameters: Set<Fmt.Parameter>): vscode.Range | null | undefined {
        let argIndex = 0;
        for (const arg of args) {
            const argRangeInfo = parsedDocument.rangeMap.get(arg);
            if (argRangeInfo && !argRangeInfo.range.isEmpty) {
                if (argRangeInfo.range.contains(position)) {
                    if (!arg.name && arg.value instanceof Fmt.VariableRefExpression) {
                        // Looks like a variable, but could turn into an argument name.
                        return argRangeInfo.range;
                    } else {
                        return null;
                    }
                }
                if (arg.name || argRangeInfo.range.end.isBefore(position)) {
                    let paramIndex = 0;
                    for (const param of params) {
                        const paramIsList = param.list;
                        if (arg.name ? arg.name === param.name : paramIsList ? argIndex >= paramIndex : argIndex === paramIndex) {
                            filledParameters.add(param);
                            break;
                        }
                        paramIndex++;
                    }
                }
            }
            argIndex++;
        }
        return undefined;
    }

    private appendArguments(document: vscode.TextDocument, rangeInfo: RangeInfo, signatureInfo: SignatureInfo, params: Fmt.Parameter[], filledParameters: Set<Fmt.Parameter>, argNameRange: vscode.Range | undefined, result: vscode.CompletionItem[]): void {
        for (const param of params) {
            if (!filledParameters.has(param)) {
                this.appendArgument(document, rangeInfo, signatureInfo, param, argNameRange, result);
            }
        }
    }

    private appendArgument(document: vscode.TextDocument, rangeInfo: RangeInfo, signatureInfo: SignatureInfo, param: Fmt.Parameter, argNameRange: vscode.Range | undefined, result: vscode.CompletionItem[]): void {
        const paramRangeInfo = signatureInfo.parsedDocument.rangeMap.get(param);
        if (paramRangeInfo && paramRangeInfo.nameRange) {
            const paramCode = readRange(signatureInfo.parsedDocument.uri, paramRangeInfo.nameRange, false, document);
            if (paramCode) {
                const assignment = paramCode + ' = ';
                let insertText: vscode.SnippetString | undefined = undefined;
                const type = signatureInfo.isMetaModel ? param.type : getArgumentType(param);
                if (type) {
                    if (type instanceof Fmt.IndexedExpression) {
                        insertText = new vscode.SnippetString(assignment + '[$0]');
                    } else if (type instanceof Fmt.DefinitionRefExpression) {
                        if (!type.path.parentPath && rangeInfo.context && rangeInfo.context.metaModel instanceof FmtDynamic.DynamicMetaModel) {
                            const metaModel = rangeInfo.context.metaModel;
                            try {
                                const metaDefinition = metaModel.definitions.getDefinition(type.path.name);
                                if (metaDefinition.type instanceof FmtMeta.MetaRefExpression_ExpressionType && metaModel.hasObjectContents(metaDefinition) && !metaModel.canOmitBraces(metaDefinition)) {
                                    insertText = new vscode.SnippetString(assignment + '{$0}');
                                }
                            } catch (error) {
                            }
                        }
                    } else if (type instanceof FmtMeta.MetaRefExpression_ParameterList || type instanceof FmtMeta.MetaRefExpression_SingleParameter) {
                        insertText = new vscode.SnippetString(assignment + '#($0)');
                    } else if (type instanceof FmtMeta.MetaRefExpression_ArgumentList) {
                        insertText = new vscode.SnippetString(assignment + '{$0}');
                    } else if (type instanceof FmtMeta.MetaRefExpression_String) {
                        insertText = new vscode.SnippetString(assignment + '\'$0\'');
                    }
                }
                const paramDefinition = readRange(signatureInfo.parsedDocument.uri, paramRangeInfo.range, true, document);
                let documentation: vscode.MarkdownString | undefined = undefined;
                if (paramDefinition) {
                    documentation = new vscode.MarkdownString;
                    documentation.appendCodeblock(paramDefinition);
                    const definitionDocumentation = signatureInfo.referencedDefinition?.definition.documentation;
                    if (definitionDocumentation) {
                        appendDocumentation(definitionDocumentation, false, param, documentation);
                    }
                }
                result.push({
                    label: assignment,
                    range: argNameRange,
                    insertText: insertText,
                    documentation: documentation,
                    kind: vscode.CompletionItemKind.Field
                });
            }
        }
    }

    private appendVariables(document: vscode.TextDocument, parsedDocument: ParsedDocument, rangeInfo: RangeInfo, variableNames: Set<string>, result: vscode.CompletionItem[]): void {
        if (rangeInfo.context) {
            for (const variableInfo of rangeInfo.context.getVariables()) {
                if (variableInfo.parameter.name !== '_') {
                    this.appendVariable(document, parsedDocument, rangeInfo, variableInfo.parameter, result);
                }
            }
        }
    }

    private appendVariable(document: vscode.TextDocument, parsedDocument: ParsedDocument, rangeInfo: RangeInfo, param: Fmt.Parameter, result: vscode.CompletionItem[]): void {
        const paramRangeInfo = parsedDocument.rangeMap.get(param);
        if (paramRangeInfo && paramRangeInfo.nameRange) {
            const paramCode = readRange(parsedDocument.uri, paramRangeInfo.nameRange, false, document);
            if (paramCode) {
                const paramDefinition = readRange(parsedDocument.uri, paramRangeInfo.range, true, document);
                let documentation: vscode.MarkdownString | undefined = undefined;
                if (paramDefinition) {
                    documentation = new vscode.MarkdownString;
                    documentation.appendCodeblock(paramDefinition);
                }
                result.push({
                    label: paramCode,
                    range: rangeInfo.object instanceof Fmt.VariableRefExpression ? (rangeInfo.nameRange ?? rangeInfo.range) : undefined,
                    documentation: documentation,
                    kind: vscode.CompletionItemKind.Variable
                });
            }
        }
    }

    private appendDocumentationItems(parsedDocument: ParsedDocument, rangeInfoIndex: number, context: vscode.CompletionContext, result: vscode.CompletionItem[]): void {
        if (context.triggerKind === vscode.CompletionTriggerKind.Invoke || context.triggerCharacter === '@') {
            const prefix = context.triggerKind === vscode.CompletionTriggerKind.Invoke ? '@' : '';
            for (const kind of SlateCompletionItemProvider.knownDocumentationItemKinds) {
                this.appendDocumentationItem(parsedDocument, rangeInfoIndex, prefix, kind, result);
            }
        }
    }

    private appendDocumentationItem(parsedDocument: ParsedDocument, rangeInfoIndex: number, prefix: string, kind: string, result: vscode.CompletionItem[]): void {
        const itemCode = prefix + kind + ' ';
        if (kind === 'param') {
            const rangeList = parsedDocument.rangeList;
            let documentationComment: Fmt.DocumentationComment | undefined = undefined;
            for (let currentIndex = rangeInfoIndex; currentIndex < rangeList.length; currentIndex++) {
                const currentRangeInfo = rangeList[currentIndex];
                if (currentRangeInfo.object instanceof Fmt.DocumentationComment) {
                    documentationComment = currentRangeInfo.object;
                } else if (currentRangeInfo.object instanceof Fmt.Definition) {
                    if (documentationComment && currentRangeInfo.object.documentation === documentationComment) {
                        for (const param of currentRangeInfo.object.parameters) {
                            result.push({
                                label: itemCode + escapeIdentifier(param.name) + ' ',
                                kind: vscode.CompletionItemKind.Keyword
                            });
                        }
                    }
                    break;
                }
            }
        } else {
            result.push({
                label: itemCode,
                kind: vscode.CompletionItemKind.Keyword
            });
        }
    }

    private setSortTexts(items: vscode.CompletionItem[]): void {
        // Make VSCode keep the order of items by using the indices as sort texts.
        let index = 0;
        for (const item of items) {
            let sortText = index.toString();
            while (sortText.length < 10) {
                sortText = '0' + sortText;
            }
            item.sortText = sortText;
            index++;
        }
    }
}
