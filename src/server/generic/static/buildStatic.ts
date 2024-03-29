import { URL } from 'url';
import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { FileAccessor } from 'slate-shared/data/fileAccessor';
import { PhysicalFileAccessor } from 'slate-env-node/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDataProviderOptions, LibraryDefinition, LibraryItemInfo } from 'slate-shared/data/libraryDataProvider';
import { fileExtension, indexFileName } from 'slate-shared/data/constants';
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import * as FmtLibrary from 'slate-shared/logics/library';
import * as FmtNotation from 'slate-shared/notation/meta';
import * as Logic from 'slate-shared/logics/logic';
import * as Logics from 'slate-shared/logics/logics';
import * as Notation from 'slate-shared/notation/notation';
import { renderAsHTML, HTMLAttributes, HTMLRenderer, RenderAsHTMLOptions } from 'slate-shared/notation/htmlOutput';
import CachedPromise from 'slate-shared/data/cachedPromise';

const Remarkable = require('remarkable').Remarkable;
const linkify = require('remarkable/linkify').linkify;

const renderedDefinitionOptions: Logic.RenderedDefinitionOptions = {
  includeLabel: true,
  includeExtras: true,
  includeRemarks: true
};

const ejsOptions: ejs.Options = {
  escape: (text) => text,
  rmWhitespace: true
};

function escapeCharacter(c: string): string {
  // Unfortunately, the established libraries either don't do exactly what we want or have broken Unicode support.
  switch (c) {
  case '&':
    return '&amp;';
  case '<':
    return '&lt;';
  case '>':
    return '&gt;';
  case '"':
    return '&quot;';
  default:
    return c;
  }
}

function escapeText(text: string): string {
  if (text.indexOf('&') >= 0 || text.indexOf('<') >= 0 || text.indexOf('>') >= 0 || text.indexOf('"') >= 0) {
    let result = '';
    for (const c of text) {
      result += escapeCharacter(c);
    }
    return result;
  } else {
    return text;
  }
}

class StaticHTMLRenderer implements HTMLRenderer<string> {
  renderText(text: string): string {
    return escapeText(text);
  }

  renderElement(tagName: string, attrs?: HTMLAttributes, content?: string): string {
    let tag = tagName;
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        tag += ` ${key}="${escapeText(value)}"`;
      }
    }
    if (content) {
      return `<${tag}>${content}</${tagName}>`;
    } else {
      return `<${tag} />`;
    }
  }

  concat(items: string[]): string {
    return items.join('');
  }

  renderMarkdown(markdown: string): string {
    const md = new Remarkable;
    md.use(linkify);
    return md.render(markdown);
  }
}

const htmlRenderer = new StaticHTMLRenderer;

class StaticSiteGenerator {
  private libraryURLWithSlash: string;

  constructor(private htmlTemplateFileName: string, private templates: Fmt.File, private libraryURL: string, private libraryURI: string, private gitHubURL: string, private outputFileAccessor: FileAccessor) {
    this.libraryURLWithSlash = libraryURL.endsWith('/') ? libraryURL : libraryURL + '/';
  }

  async buildSection(libraryDataProvider: LibraryDataProvider, sectionItemInfo: LibraryItemInfo, htmlNavigation: string, uri?: string) {
    const section = await libraryDataProvider.fetchLocalSection();
    const contents = section.definition.contents as FmtLibrary.ObjectContents_Section;
    const htmlItems: string[] = [];
    let index = 0;
    for (const item of contents.items) {
      if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) {
        try {
          const ref = item.ref as Fmt.DefinitionRefExpression;
          const itemURI = libraryDataProvider.pathToURI(ref.path);
          const itemInfo: LibraryItemInfo = {
            itemNumber: [...sectionItemInfo.itemNumber, index + 1],
            type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
            title: item.title
          };
          let htmlItem: string | undefined = undefined;
          if (item instanceof FmtLibrary.MetaRefExpression_item) {
            const definition = await libraryDataProvider.fetchLocalItem(ref.path.name, true);
            htmlItem = await this.buildItem(libraryDataProvider, itemInfo, definition, htmlNavigation, itemURI);
          } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
            const childProvider = await libraryDataProvider.getProviderForSection(ref.path);
            htmlItem = htmlRenderer.renderText(item.title ?? ref.path.name);
            const htmlItemNavigation = htmlNavigation + ' ▹ ' + this.createLink(htmlItem, itemURI);
            await this.buildSection(childProvider, itemInfo, htmlItemNavigation, itemURI);
          }
          if (!htmlItem) {
            htmlItem = htmlRenderer.renderText(item.title ?? ref.path.name);
          }
          htmlItem = this.createLink(htmlItem, itemURI);
          htmlItems.push(htmlRenderer.renderElement('li', {}, htmlItem));
        } catch (error) {
          console.error(error);
        }
      }
      index++;
    }
    let htmlContent = '';
    if (htmlItems.length) {
      htmlContent = htmlRenderer.renderElement('ul', {}, htmlRenderer.concat(htmlItems));
    }
    await this.outputFile(sectionItemInfo.title, htmlContent, htmlNavigation, uri ? uri + '/' + indexFileName : section.definition.name, uri);
  }

  async buildItem(libraryDataProvider: LibraryDataProvider, itemInfo: LibraryItemInfo, definition: LibraryDefinition, htmlNavigation: string, uri: string) {
    const rendererOptions: Logic.LogicRendererOptions = {
      includeProofs: true
    };
    const renderer = Logics.hlm.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, this.templates, rendererOptions);
    const renderedDefinition = renderer.renderDefinition(CachedPromise.resolve(itemInfo), renderedDefinitionOptions);
    if (renderedDefinition) {
      const title = itemInfo.title ?? definition.definition.name;
      const htmlContent = await this.renderExpression(renderedDefinition, libraryDataProvider, definition.definition, false);
      await this.outputFile(title, htmlContent, htmlNavigation, uri, uri);
      const renderedSummary = renderer.renderDefinitionSummary();
      if (renderedSummary) {
        return await this.renderExpression(renderedSummary, libraryDataProvider, definition.definition, true);
      }
    }
    return undefined;
  }

  private async outputFile(title: string | undefined, htmlContent: string, htmlNavigation: string, uri: string, targetURI?: string) {
    htmlContent =
      htmlRenderer.renderElement('nav', {}, htmlNavigation)
      + htmlContent
      + htmlRenderer.renderElement('footer', {}, '[' + htmlRenderer.renderElement('a', {'href': this.gitHubURL + uri + fileExtension}, 'View Source') + ']');
    const data: ejs.Data = {
      'isStatic': true,
      'isEmbedded': false,
      'title': escapeText(title ? `Slate - ${title}` : 'Slate'),
      'canonicalURL': targetURI ? this.libraryURLWithSlash + targetURI : this.libraryURL,
      'content': htmlContent
    };
    const html = await ejs.renderFile(this.htmlTemplateFileName, data, ejsOptions);
    const outputFileReference = this.outputFileAccessor.openFile((targetURI ?? 'index') + '.html', true);
    outputFileReference.write!(html, true);
  }

  private async renderExpression(expression: Notation.RenderedExpression, libraryDataProvider: LibraryDataProvider, definition: Fmt.Definition, summary: boolean) {
    const getLinkURI = summary ? undefined : (semanticLink: Notation.SemanticLink) => {
      const linkPath = this.getPath(semanticLink, definition);
      if (linkPath) {
        return this.libraryURI + libraryDataProvider.pathToURI(linkPath);
      }
      return undefined;
    };
    const options: RenderAsHTMLOptions = {
      convertStandardCharacters: false,
      shrinkMathSpaces: false,
      getLinkURI: getLinkURI
    };
    let htmlContent = await renderAsHTML(expression, htmlRenderer, options);
    if (htmlContent) {
      htmlContent = htmlRenderer.renderElement(summary ? 'span' : 'div', {'class': 'expr'}, htmlContent);
    }
    return htmlContent;
  }

  private createLink(content: string, uri: string): string {
    return htmlRenderer.renderElement('a', {'href': this.libraryURI + uri}, content);
  }

  private getPath(semanticLink: Notation.SemanticLink, definition: Fmt.Definition): Fmt.Path | undefined {
    if (semanticLink.isMathematical && semanticLink.linkedObject instanceof Fmt.DefinitionRefExpression) {
      let linkPath = semanticLink.linkedObject.path;
      while (linkPath.parentPath instanceof Fmt.Path) {
        linkPath = linkPath.parentPath;
      }
      if (!linkPath.parentPath && linkPath.name === definition.name) {
        return undefined;
      }
      return linkPath;
    } else {
      return undefined;
    }
  }
}

function buildStaticPages(libraryFileName: string, logicName: string, htmlTemplateFileName: string, notationTemplateFileName: string, libraryURL: string, gitHubURL: string, outputDirName: string) {
  const logic = Logics.findLogic(logicName);
  if (!logic) {
    throw new Error(`Logic ${logicName} not found`);
  }
  const libraryDataProviderOptions: LibraryDataProviderOptions = {
    logic: logic,
    fileAccessor: new PhysicalFileAccessor(path.dirname(libraryFileName)),
    watchForChanges: false,
    enablePrefetching: true,
    checkMarkdownCode: false,
    allowPlaceholders: false
  };
  const libraryDataProvider = new LibraryDataProvider(libraryDataProviderOptions, path.basename(libraryFileName, fileExtension));
  const templateFileContents = fs.readFileSync(notationTemplateFileName, 'utf8');
  const templates = FmtReader.readString(templateFileContents, notationTemplateFileName, FmtNotation.getMetaModel);
  const libraryTitle = 'Library';
  const libraryItemInfo: LibraryItemInfo = {
    itemNumber: [],
    title: libraryTitle
  };
  let libraryURI = (new URL(libraryURL)).pathname;
  if (libraryURI.startsWith('/')) {
    libraryURI = libraryURI.substring(1);
  }
  const htmlNavigation = htmlRenderer.renderElement('a', {'href': libraryURI}, escapeText(libraryTitle));
  if (!libraryURI.endsWith('/')) {
    libraryURI += '/';
  }
  if (!gitHubURL.endsWith('/')) {
    gitHubURL += '/';
  }
  const outputFileAccessor = new PhysicalFileAccessor(outputDirName);
  const staticSiteGenerator = new StaticSiteGenerator(htmlTemplateFileName, templates, libraryURL, libraryURI, gitHubURL, outputFileAccessor);
  return staticSiteGenerator.buildSection(libraryDataProvider, libraryItemInfo, htmlNavigation)
    .then(() => libraryDataProvider.close());
}

if (process.argv.length === 9) {
  buildStaticPages(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6], process.argv[7], process.argv[8])
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
} else {
  console.error('usage: node buildStatic.js <libraryFile> <logic> <htmlTemplateFile> <notationTemplateFile> <libraryURL> <gitHubURL> <outputDir>');
  process.exitCode = 2;
}
