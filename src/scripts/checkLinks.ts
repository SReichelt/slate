import * as fs from 'fs';
import * as Fmt from 'slate-shared/format/format';
import * as FmtReader from 'slate-shared/format/read';
import { getMetaModelWithFallback } from 'slate-env-node/format/dynamic';
import * as Logics from 'slate-shared/logics/logics';

const Remarkable = require('remarkable').Remarkable;
const linkify = require('remarkable/linkify').linkify;
const linkCheck = require('link-check');

let linksFound = 0;
let linksChecking = 0;
let linksChecked = 0;

class LinkExtractor {
  constructor(private fileName: string) {}

  render(tokens: any[] = []): void {
    for (const token of tokens) {
      if (token.type === 'link_open') {
        const uri: string = token.href;
        if (uri.startsWith('http://') || uri.startsWith('https://')) {
          linksFound++;
          this.triggerLinkCheck(uri);
        }
      } else if (token.children) {
        this.render(token.children);
      }
    }
  }

  private triggerLinkCheck(uri: string): void {
    if (linksChecking < 10) {
      linksChecking++;
      linkCheck(uri, (err: any, result: any) => {
        if (err) {
          console.error(`${this.fileName}: ${err}`);
        } else if (result.status !== 'alive') {
          console.error(`${this.fileName}: ${result.status} link: ${result.link}`);
        }
        linksChecking--;
        linksChecked++;
        if (linksChecked === linksFound) {
          console.log(`${linksChecked} links checked.`);
        }
      });
    } else {
      setTimeout(() => this.triggerLinkCheck(uri), 1000);
    }
  }
}

function checkDefinitionLinks(fileName: string, definition: Fmt.Definition): void {
  if (definition.documentation) {
    for (const documentationItem of definition.documentation.items) {
      const md = new Remarkable;
      md.use(linkify);
      md.renderer = new LinkExtractor(fileName);
      md.render(documentationItem.text);
    }
  }

  for (const innerDefinition of definition.innerDefinitions) {
    checkDefinitionLinks(fileName, innerDefinition);
  }
}

function checkLinks(fileName: string): void {
  const fileStr = fs.readFileSync(fileName, 'utf8');
  const getMetaModel = (path: Fmt.Path) => {
    const logic = Logics.findLogic(path.name);
    if (logic) {
      return logic.getMetaModel(path);
    }
    return getMetaModelWithFallback(fileName, path);
  };
  const file = FmtReader.readString(fileStr, fileName, getMetaModel);
  for (const definition of file.definitions) {
    checkDefinitionLinks(fileName, definition);
  }
}

if (process.argv.length < 3) {
  console.error('usage: src/scripts/checkLinks.sh <file1> [<file2>...]');
  process.exit(2);
}

for (const fileName of process.argv.slice(2)) {
  checkLinks(fileName);
}

console.log(`${linksFound} links found.`);
