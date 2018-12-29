import * as Fmt from '../../shared/format/format';
import * as Display from '../../shared/display/display';
import { LibraryDataProvider } from '../../shared/data/libraryDataProvider';
import { ExpressionInteractionHandler, OnExpressionChanged, OnHoverChanged } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import { LibraryItemProps, renderLibraryItem } from './LibraryItem';

export type OnLinkClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path) => void;

export class ExpressionInteractionHandlerImpl implements ExpressionInteractionHandler {
  private expressionChangeHandlers: OnExpressionChanged[] = [];
  private hoverChangeHandlers: OnHoverChanged[] = [];

  registerExpressionChangeHandler(handler: OnExpressionChanged): void {
    this.expressionChangeHandlers.push(handler);
  }

  unregisterExpressionChangeHandler(handler: OnExpressionChanged): void {
    let index = this.expressionChangeHandlers.indexOf(handler);
    if (index >= 0) {
      this.expressionChangeHandlers.splice(index, 1);
    }
  }

  expressionChanged(editorUpdateRequired: boolean = true): void {
    for (let handler of this.expressionChangeHandlers) {
      handler(editorUpdateRequired);
    }
  }

  registerHoverChangeHandler(handler: OnHoverChanged): void {
    this.hoverChangeHandlers.push(handler);
  }

  unregisterHoverChangeHandler(handler: OnHoverChanged): void {
    let index = this.hoverChangeHandlers.indexOf(handler);
    if (index >= 0) {
      this.hoverChangeHandlers.splice(index, 1);
    }
  }

  hoverChanged(hover: Display.SemanticLink[]): void {
    let objects = hover.map((semanticLink) => semanticLink.linkedObject);
    for (let handler of this.hoverChangeHandlers) {
      handler(objects);
    }
  }

  getURI(semanticLink: Display.SemanticLink): string | undefined {
    return undefined;
  }

  linkClicked(semanticLink: Display.SemanticLink): void {
  }

  hasPreview(semanticLink: Display.SemanticLink): boolean {
    return false;
  }

  getPreviewContents(semanticLink: Display.SemanticLink): any {
    return null;
  }
}

export class LibraryItemInteractionHandler extends ExpressionInteractionHandlerImpl {
  constructor(private libraryDataProvider: LibraryDataProvider, private templates: Fmt.File, private definition: CachedPromise<Fmt.Definition>, private onLinkClicked?: OnLinkClicked) {
    super();
  }

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
    return semanticLink.isMathematical && semanticLink.linkedObject instanceof Fmt.DefinitionRefExpression;
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
        includeLabel: false,
        includeExtras: true,
        includeProofs: false,
        includeRemarks: false,
        editing: false
      };
      return renderLibraryItem(props);
    } else {
      return null;
    }
  }

  private getPath(semanticLink: Display.SemanticLink): Fmt.Path | undefined {
    if (semanticLink.isMathematical && semanticLink.linkedObject instanceof Fmt.DefinitionRefExpression) {
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
