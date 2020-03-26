import * as React from 'react';
import * as Fmt from '../../shared/format/format';
import * as FmtReader from '../../shared/format/read';
import * as Ctx from '../../shared/format/context';
import * as Display from '../../shared/display/display';
import { LibraryDataProvider, LibraryDefinition } from '../../shared/data/libraryDataProvider';
import * as Logic from '../../shared/logics/logic';
import CachedPromise from '../../shared/data/cachedPromise';
import Expression, { ExpressionInteractionHandler, OnExpressionChanged, OnHoverChanged } from './Expression';
import renderPromise from './PromiseHelper';

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

  renderCode(code: string): React.ReactNode {
    return undefined;
  }
}

export class LibraryItemInteractionHandler extends ExpressionInteractionHandlerImpl {
  constructor(private libraryDataProvider: LibraryDataProvider, private templates: Fmt.File, private definition?: CachedPromise<LibraryDefinition>, private onLinkClicked?: OnLinkClicked) {
    super();
  }

  expressionChanged(editorUpdateRequired: boolean = true, notifyLibraryDataProvider: boolean = true): void {
    if (notifyLibraryDataProvider && this.definition) {
      this.definition.then((definition: LibraryDefinition) => this.libraryDataProvider.localItemModified(definition));
    }
    super.expressionChanged(editorUpdateRequired);
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
      let definitionPromise = parentProvider.fetchLocalItem(path.name, false);

      // Render library item directly instead of creating a component, so that tooltip is not even displayed if it returns null.
      let render = definitionPromise.then((definition: LibraryDefinition) => {
        let renderedDefinitionOptions: Logic.FullRenderedDefinitionOptions = {
          includeProofs: false,
          maxListLength: 20,
          includeLabel: false,
          includeExtras: true,
          includeRemarks: false
        };
        let renderer = parentProvider.logic.getDisplay().getDefinitionRenderer(definition.definition, parentProvider, this.templates, renderedDefinitionOptions);
        let expression = renderer.renderDefinition(undefined, renderedDefinitionOptions);
        if (expression) {
          return <Expression expression={expression}/>;
        } else {
          return null;
        }
      });
      return renderPromise(render);
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

  renderCode(code: string): React.ReactNode {
    if (this.definition) {
      try {
        let logic = this.libraryDataProvider.logic;
        let metaModel = logic.getMetaModel();
        let stream = new FmtReader.StringInputStream(code);
        let errorHandler = new FmtReader.DefaultErrorHandler;
        let reader = new FmtReader.Reader(stream, errorHandler, () => metaModel);
        let context = new Ctx.DummyContext(metaModel);
        let expression = reader.readExpression(false, metaModel.functions, context);
        let renderedExpressionPromise = this.definition.then((definition: LibraryDefinition) => {
          let renderedDefinitionOptions: Logic.FullRenderedDefinitionOptions = {
            includeProofs: true,
            includeLabel: true,
            includeExtras: true,
            includeRemarks: true
          };
          let renderer = logic.getDisplay().getDefinitionRenderer(definition.definition, this.libraryDataProvider, this.templates, renderedDefinitionOptions);
          return renderer.renderExpression(expression);
        });
        let renderedExpression = new Display.PromiseExpression(renderedExpressionPromise);
        return <Expression expression={renderedExpression} interactionHandler={this}/>;
      } catch (error) {
        return <span className="error">Error: {error.message}</span>;
      }
    } else {
      return undefined;
    }
  }
}
