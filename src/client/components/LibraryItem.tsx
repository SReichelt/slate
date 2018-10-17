import * as React from 'react';
import * as Fmt from '../../shared/format/format';
import * as Display from '../../shared/display/display';
import { LibraryDataProvider, LibraryItemInfo } from '../../shared/data/libraryDataProvider';
import Expression, { ExpressionInteractionHandler } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import renderPromise from './PromiseHelper';

type OnLinkClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path) => void;

class LibraryItemInteractionHandler implements ExpressionInteractionHandler {
  constructor(private libraryDataProvider: LibraryDataProvider, private templates: Fmt.File, private definition: CachedPromise<Fmt.Definition>, private onLinkClicked?: OnLinkClicked) {}

  getURI(semanticLink: Display.SemanticLink): string | undefined {
    let path = this.getPath(semanticLink);
    if (path) {
      return this.libraryDataProvider.pathToURI(path);
    } else {
      return undefined;
    }
  }

  linkClicked(semanticLink: Display.SemanticLink): void {
    if (this.onLinkClicked) {
      let path = this.getPath(semanticLink);
      if (path) {
        this.onLinkClicked(this.libraryDataProvider, path);
      }
    }
  }

  hasPreview(semanticLink: Display.SemanticLink): boolean {
    return semanticLink.linkedObject instanceof Fmt.DefinitionRefExpression;
  }

  getPreviewContents(semanticLink: Display.SemanticLink): any {
    let path = this.getPath(semanticLink);
    if (path) {
      let parentProvider = this.libraryDataProvider.getProviderForSection(path.parentPath);
      let definition = parentProvider.fetchLocalItem(path.name);
      // Call function directly instead of creating a component, so that tooltip is not even displayed if it returns null.
      let props: LibraryItemProps = {
        libraryDataProvider: parentProvider,
        definition: definition,
        templates: this.templates,
        interactive: false,
        includeLabel: false,
        includeExtras: true,
        includeProofs: false,
        includeRemarks: false
      };
      return LibraryItem(props);
    } else {
      return null;
    }
  }

  private getPath(semanticLink: Display.SemanticLink): Fmt.Path | undefined {
    if (semanticLink.linkedObject instanceof Fmt.DefinitionRefExpression) {
      let path = semanticLink.linkedObject.path;
      while (path.parentPath instanceof Fmt.Path) {
        path = path.parentPath;
      }
      if (!path.parentPath) {
        let ownDefinition = this.definition.getImmediateResult();
        if (ownDefinition && path.name === ownDefinition.name) {
          return undefined;
        }
      }
      return path;
    } else {
      return undefined;
    }
  }
}

export interface LibraryItemProps {
  libraryDataProvider: LibraryDataProvider;
  templates: Fmt.File;
  definition: CachedPromise<Fmt.Definition>;
  itemInfo?: CachedPromise<LibraryItemInfo>;
  interactive: boolean;
  includeLabel: boolean;
  includeExtras: boolean;
  includeProofs: boolean;
  includeRemarks: boolean;
  onLinkClicked?: OnLinkClicked;
}

function LibraryItem(props: LibraryItemProps): any {
  let logic = props.libraryDataProvider.logic;
  let logicDisplay = logic.getDisplay();
  let renderer = logicDisplay.getRenderer(props.libraryDataProvider, props.templates);
  let interactionHandler = props.interactive ? new LibraryItemInteractionHandler(props.libraryDataProvider, props.templates, props.definition, props.onLinkClicked) : undefined;

  let render = props.definition.then((definition: Fmt.Definition) => {
    let expression = renderer.renderDefinition(definition, props.itemInfo, props.includeLabel, props.includeExtras, props.includeProofs, props.includeRemarks);
    if (expression) {
      return <Expression expression={expression} interactionHandler={interactionHandler}/>;
    } else {
      return null;
    }
  });

  return renderPromise(render);
}

export default LibraryItem;
