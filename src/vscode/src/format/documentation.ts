'use strict';

import * as vscode from 'vscode';
import * as Fmt from '../../../shared/format/format';

export function appendDocumentation(documentation: Fmt.DocumentationComment, includeAll: boolean, specificParameter: Fmt.Parameter | undefined, result: vscode.MarkdownString): void {
    for (let item of documentation.items) {
        if (specificParameter) {
            if (specificParameter !== item.parameter) {
                continue;
            }
        } else if (item.kind) {
            if (!includeAll) {
                break;
            }
            result.appendMarkdown(`_@${item.kind}_`);
            if (item.parameter) {
                result.appendMarkdown(` \`${item.parameter.name}\``);
            }
            result.appendMarkdown(' —\n');
        }
        result.appendMarkdown(item.text + '\n\n');
        if (!includeAll) {
            break;
        }
    }
}
