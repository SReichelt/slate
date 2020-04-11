import * as React from 'react';
import './StartPage.css';
import * as Fmt from '../../shared/format/format';
import * as Display from '../../shared/display/display';
import { LibraryDataProvider, LibraryDefinition } from '../../shared/data/libraryDataProvider';
import * as Logic from '../../shared/logics/logic';
import { HLMRenderer } from '../../shared/logics/hlm/renderer';
import Expression, { ExpressionInteractionHandler } from './Expression';
import { OnLinkClicked } from './InteractionHandler';

const Loading = require('react-loading-animation');

interface StartPageProps {
  libraryDataProvider?: LibraryDataProvider;
  templates?: Fmt.File;
  interactionHandler?: ExpressionInteractionHandler;
  onLinkClicked: OnLinkClicked;
}

function fillPathItem(names: string[], pathItem: Fmt.NamedPathItem): void {
  pathItem.name = names.pop()!;
  if (names.length) {
    let parentPath = new Fmt.NamedPathItem;
    fillPathItem(names, parentPath);
    pathItem.parentPath = parentPath;
  }
}

function buildExamplePath(names: string[]): Fmt.Path {
  let result = new Fmt.Path;
  fillPathItem(names, result);
  return result;
}

function buildExample(names: string[]): Fmt.DefinitionRefExpression {
  let result = new Fmt.DefinitionRefExpression;
  result.path = buildExamplePath(names);
  return result;
}

function wrapExample(example: React.ReactNode, path: Fmt.Path, props: StartPageProps): React.ReactNode {
  let href = props.libraryDataProvider!.pathToURI(path);
  let onClick = (event: React.MouseEvent) => {
    if (event.button < 1) {
      event.preventDefault();
      props.onLinkClicked(props.libraryDataProvider!, path);
    }
  };
  return (
    <a className="example" href={href} onClick={onClick}>
      {example}
    </a>
  );
}

function renderDefinitionExample(names: string[], props: StartPageProps, renderer: HLMRenderer, title?: string[]): React.ReactNode {
  let example = buildExample(names);
  let expression = renderer.renderExampleExpression(example);
  let result: React.ReactNode = <Expression expression={expression} interactionHandler={props.interactionHandler}/>;
  if (title) {
    let titleLines = [];
    for (let line of title) {
      if (titleLines.length) {
        titleLines.push(<br key={titleLines.length}/>);
      }
      titleLines.push(line);
    }
    result = [
      <div key="result">{result}</div>,
      <div className="example-title" key="title">({titleLines})</div>
    ];
  }
  return wrapExample(result, example.path, props);
}

function renderTheoremExample(names: string[], props: StartPageProps): React.ReactNode {
  let examplePath = buildExamplePath(names);
  let libraryDataProvider = props.libraryDataProvider!.getProviderForSection(examplePath.parentPath);
  let definitionPromise = libraryDataProvider.fetchLocalItem(examplePath.name, false);
  let expressionPromise = definitionPromise.then((definition: LibraryDefinition) => {
    let rendererOptions: Logic.LogicRendererOptions = {
      includeProofs: false
    };
    let definitionRenderer = new HLMRenderer(definition.definition, libraryDataProvider, props.templates!, rendererOptions);
    return definitionRenderer.renderDefinitionSummary(undefined, true)!;
  });
  let expression = new Display.PromiseExpression(expressionPromise);
  let result = <Expression expression={expression}/>;
  return wrapExample(result, examplePath, props);
}

function StartPage(props: StartPageProps) {
  let exampleContents: React.ReactNode = null;

  if (props.libraryDataProvider && props.templates) {
    let dummyDefinition = new Fmt.Definition;
    dummyDefinition.name = '';
    let rendererOptions: Logic.LogicRendererOptions = {
      includeProofs: false
    };
    let renderer = new HLMRenderer(dummyDefinition, props.libraryDataProvider, props.templates, rendererOptions);
    let examples = [
      renderDefinitionExample(['Essentials', 'Sets', 'finite'], props, renderer, ['multiple definitions', 'of finiteness']),
      renderDefinitionExample(['Essentials', 'Numbers', 'Natural', 'Prime', 'prime'], props, renderer, ['definition']),
      renderTheoremExample(['Essentials', 'Numbers', 'Real', 'Roots of primes are irrational'], props),
      renderTheoremExample(['Algebra', 'Semirings', 'Formulas', 'Binomial theorem'], props)
    ];
    exampleContents = examples.map((example: React.ReactNode, index: number) => <div className="example-container" key={index}>{example}</div>);
  } else {
    exampleContents = <div className="loading"><Loading width={'2em'} height={'2em'}/></div>;
  }

  return (
    <div className="start-page">
      <h1>The Slate Interactive Theorem Prover</h1>
      <p>
        Slate is a project to build a web-based <a href="https://en.wikipedia.org/wiki/Proof_assistant">interactive theorem prover</a> with a focus on abstract mathematics.
      </p>
      <p>
        Its unique rendering concept makes formalized definitions and theorems intuitively understandable without detailed explanation.
        So please just follow these links to some examples in the library – and then hover over the expressions therein to start exploring:
      </p>
      <div className="examples">
        {exampleContents}
      </div>
      <h2>Current Status</h2>
      <p>
        In this web GUI, it is currently possible to create simple definitions and theorems. Proof input will follow soon.
      </p>
      <p>
        The entire web GUI is also integrated into an <a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate">extension for Microsoft Visual Studio Code</a> which supports more complex workflows.
      </p>
      <h2>Foundations</h2>
      <p>
        Slate, as an application, is built to support different logics. However, the rendering and editing concepts of Slate works particularly well for a logic that is close to mathematical practice. Therefore, only one logic (called "HLM") is currently implemented.
      </p>
      <p>
        HLM is classical and set-theoretic, and can be described as either a <a href="https://ncatlab.org/nlab/show/structural+set+theory">structural set theory</a>, or a <a href="https://en.wikipedia.org/wiki/Type_theory">type theory</a> where all references to types are made implicitly.
        It is not based on any familiar axiomatization, and avoids some of the limitations of Zermelo-Fraenkel and other set theories.
      </p>
      <p>
        Existing theorem provers can potentially be integrated into Slate, reusing its rendering and editing mechanisms.
      </p>
      <h2>Third-Party Software</h2>
      <p>
        For a list of third-party software used in Slate, see <a href="docs/dependencies.html" target="_blank">here</a>.
      </p>
      <h2>Contact</h2>
      <p>
        Please send feedback via <a href="mailto:SebastianR@gmx.de">email</a>.
      </p>
    </div>
  );
}

export default StartPage;
