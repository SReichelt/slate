import * as Fmt from '../../shared/format/format';
import * as Display from '../../shared/display/display';
import { LibraryDataProvider, LibraryDefinition } from '../../shared/data/libraryDataProvider';
import * as Logic from '../../shared/logics/logic';
import { ExpressionInteractionHandler, OnExpressionChanged, OnHoverChanged } from './Expression';
import CachedPromise from '../../shared/data/cachedPromise';
import { LibraryItemProps, renderLibraryItem } from './LibraryItem';

export type OnLinkClicked = (libraryDataProvider: LibraryDataProvider, path: Fmt.Path) => void;

export class ExpressionInteractionHandlerImpl implements ExpressionInteractionHandler {
  private expressionChangeListeners: OnExpressionChanged[] = [];
  private hoverChangeListeners: OnHoverChanged[] = [];
  private blockCounter = 0;

  registerExpressionChangeListener(listener: OnExpressionChanged): void {
    this.expressionChangeListeners.push(listener);
  }

  unregisterExpressionChangeListener(listener: OnExpressionChanged): void {
    let index = this.expressionChangeListeners.indexOf(listener);
    if (index >= 0) {
      this.expressionChangeListeners.splice(index, 1);
    }
  }

  expressionChanged(editorUpdateRequired: boolean = true): void {
    for (let handler of this.expressionChangeListeners) {
      handler(editorUpdateRequired);
    }
  }

  registerHoverChangeListener(listener: OnHoverChanged): void {
    this.hoverChangeListeners.push(listener);
  }

  unregisterHoverChangeListener(listener: OnHoverChanged): void {
    let index = this.hoverChangeListeners.indexOf(listener);
    if (index >= 0) {
      this.hoverChangeListeners.splice(index, 1);
    }
  }

  hoverChanged(hover: Display.SemanticLink[]): void {
    let objects = hover.map((semanticLink) => semanticLink.linkedObject);
    for (let handler of this.hoverChangeListeners) {
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

  getPreviewContents(semanticLink: Display.SemanticLink): React.ReactNode {
    return undefined;
  }

  enterBlocker(): void {
    this.blockCounter++;
  }

  leaveBlocker(): void {
    if (this.blockCounter <= 0) {
      throw new Error('Internal error: update block counter underflow');
    }
    this.blockCounter--;
  }

  isBlocked(): boolean {
    return this.blockCounter !== 0;
  }
}

export class LibraryItemInteractionHandler extends ExpressionInteractionHandlerImpl {
  constructor(private libraryDataProvider: LibraryDataProvider, private templates: Fmt.File, private definition?: CachedPromise<LibraryDefinition>, private onLinkClicked?: OnLinkClicked) {
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

  getPreviewContents(semanticLink: Display.SemanticLink): React.ReactNode {
    let path = this.getPath(semanticLink);
    if (path) {
      let parentProvider = this.libraryDataProvider.getProviderForSection(path.parentPath);
      let definition = parentProvider.fetchLocalItem(path.name);
      let renderedDefinitionOptions: Logic.FullRenderedDefinitionOptions = {
        includeProofs: false,
        maxListLength: 20,
        includeLabel: false,
        includeExtras: true,
        includeRemarks: false
      };
      // Call function directly instead of creating a component, so that tooltip is not even displayed if it returns undefined.
      let props: LibraryItemProps = {
        libraryDataProvider: parentProvider,
        definition: definition,
        templates: this.templates,
        options: renderedDefinitionOptions
      };
      return renderLibraryItem(props);
    } else {
      return undefined;
    }
  }

  private getPath(semanticLink: Display.SemanticLink): Fmt.Path | undefined {
    if (semanticLink.isMathematical && semanticLink.linkedObject instanceof Fmt.DefinitionRefExpression) {
      let path = semanticLink.linkedObject.path;
      while (path.parentPath instanceof Fmt.Path) {
        path = path.parentPath;
      }
      if (!path.parentPath && this.definition) {
        let ownDefinition = this.definition.getImmediateResult();
        if (ownDefinition && path.name === ownDefinition.definition.name) {
          return undefined;
        }
      }
      return path;
    } else {
      return undefined;
    }
  }
}
