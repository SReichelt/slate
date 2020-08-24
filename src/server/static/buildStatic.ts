import * as path from 'path';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { FileAccessor } from '../../shared/data/fileAccessor';
import { PhysicalFileAccessor } from '../../fs/data/physicalFileAccessor';
import { LibraryDataProvider, LibraryDataProviderOptions, LibraryDefinition, LibraryItemInfo } from '../../shared/data/libraryDataProvider';
import { fileExtension } from '../../shared/data/constants';
import * as Fmt from '../../shared/format/format';
import * as FmtReader from '../../shared/format/read';
import * as FmtLibrary from '../../shared/logics/library';
import * as FmtNotation from '../../shared/notation/meta';
import * as Logic from '../../shared/logics/logic';
import * as Logics from '../../shared/logics/logics';
import * as Notation from '../../shared/notation/notation';
import { renderAsHTML, HTMLAttributes, HTMLRenderer } from '../../shared/notation/htmlOutput';
import { UnicodeConversionOptions } from '../../shared/notation/unicode';
import CachedPromise from '../../shared/data/cachedPromise';

const Remarkable = require('remarkable').Remarkable;
const linkify = require('remarkable/linkify').linkify;

const renderedDefinitionOptions: Logic.RenderedDefinitionOptions = {
  includeLabel: true,
  includeExtras: true,
  includeRemarks: true
};

const unicodeConversionOptions: UnicodeConversionOptions = {
  convertStandardCharacters: false,
  shrinkMathSpaces: false
};

const ejsOptions: ejs.Options = {
  escape: (text) => text
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
    for (let c of text) {
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
      for (let [key, value] of Object.entries(attrs)) {
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
    let md = new Remarkable;
    md.use(linkify);
    return md.render(markdown);
  }
}

const htmlRenderer = new StaticHTMLRenderer;

class StaticSiteGenerator {
  constructor(private htmlTemplateFileName: string, private templates: Fmt.File, private libraryURL: string, private outputFileAccessor: FileAccessor) {}

  async buildSection(libraryDataProvider: LibraryDataProvider, sectionItemInfo: LibraryItemInfo, uri: string) {
    let section = await libraryDataProvider.fetchLocalSection();
    let contents = section.definition.contents as FmtLibrary.ObjectContents_Section;
    let htmlItems: string[] = [];
    let index = 0;
    for (let item of contents.items) {
      if (item instanceof FmtLibrary.MetaRefExpression_item || item instanceof FmtLibrary.MetaRefExpression_subsection) {
        try {
          let ref = item.ref as Fmt.DefinitionRefExpression;
          let itemURI = libraryDataProvider.pathToURI(ref.path);
          let itemInfo: LibraryItemInfo = {
            itemNumber: [...sectionItemInfo.itemNumber, index + 1],
            type: item instanceof FmtLibrary.MetaRefExpression_item ? item.type : undefined,
            title: item.title
          };
          let htmlItem: string | undefined = undefined;
          if (item instanceof FmtLibrary.MetaRefExpression_item) {
            let definition = await libraryDataProvider.fetchLocalItem(ref.path.name, true);
            htmlItem = await this.buildItem(libraryDataProvider, itemInfo, definition, itemURI);
          } else if (item instanceof FmtLibrary.MetaRefExpression_subsection) {
            let childProvider = await libraryDataProvider.getProviderForSection(ref.path);
            await this.buildSection(childProvider, itemInfo, itemURI);
            htmlItem = htmlRenderer.renderText(item.title ?? ref.path.name);
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
    await this.outputFile(htmlContent, uri);
  }

  async buildItem(libraryDataProvider: LibraryDataProvider, itemInfo: LibraryItemInfo, definition: LibraryDefinition, uri: string) {
    let rendererOptions: Logic.LogicRendererOptions = {
      includeProofs: true
    };
    let renderer = Logics.hlm.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, this.templates, rendererOptions);
    let renderedDefinition = renderer.renderDefinition(CachedPromise.resolve(itemInfo), renderedDefinitionOptions);
    if (renderedDefinition) {
      let htmlContent = await this.renderExpression(renderedDefinition, false);
      await this.outputFile(htmlContent, uri);
      let renderedSummary = renderer.renderDefinitionSummary();
      if (renderedSummary) {
        return await this.renderExpression(renderedSummary, true);
      }
    }
    return undefined;
  }

  private async outputFile(htmlContent: string, uri: string) {
    let html = await ejs.renderFile(this.htmlTemplateFileName, {'content': htmlContent}, ejsOptions);
    let outputFileReference = this.outputFileAccessor.openFile(uri + '.html', true);
    outputFileReference.write!(html, true);
  }

  private async renderExpression(expression: Notation.RenderedExpression, inline: boolean) {
    let htmlContent = await renderAsHTML(expression, htmlRenderer, unicodeConversionOptions);
    if (htmlContent) {
      htmlContent = htmlRenderer.renderElement(inline ? 'span' : 'div', {'class': 'expr'}, htmlContent);
    }
    return htmlContent;
  }

  private createLink(content: string, uri: string): string {
    return htmlRenderer.renderElement('a', {'href': this.libraryURL + uri}, content);
  }
}

function buildStaticPages(libraryFileName: string, logicName: string, htmlTemplateFileName: string, notationTemplateFileName: string, libraryURL: string, outputDirName: string) {
  let logic = Logics.findLogic(logicName);
  if (!logic) {
    throw new Error(`Logic ${logicName} not found`);
  }
  let libraryDataProviderOptions: LibraryDataProviderOptions = {
    logic: logic,
    fileAccessor: new PhysicalFileAccessor(path.dirname(libraryFileName)),
    watchForChanges: false,
    checkMarkdownCode: false,
    allowPlaceholders: false
  };
  let libraryDataProvider = new LibraryDataProvider(libraryDataProviderOptions, path.basename(libraryFileName, fileExtension));
  let templateFileContents = fs.readFileSync(notationTemplateFileName, 'utf8');
  let templates = FmtReader.readString(templateFileContents, notationTemplateFileName, FmtNotation.getMetaModel);
  if (!libraryURL.endsWith('/')) {
    libraryURL += '/';
  }
  let outputFileAccessor = new PhysicalFileAccessor(outputDirName);
  let staticSiteGenerator = new StaticSiteGenerator(htmlTemplateFileName, templates, libraryURL, outputFileAccessor);
  return staticSiteGenerator.buildSection(libraryDataProvider, {itemNumber: []}, 'index');
}

if (process.argv.length !== 8) {
  console.error('usage: node buildStatic.js <libraryFile> <logic> <htmlTemplateFile> <notationTemplateFile> <libraryURL> <outputDir>');
  process.exit(2);
}

buildStaticPages(process.argv[2], process.argv[3], process.argv[4], process.argv[5], process.argv[6], process.argv[7])
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
