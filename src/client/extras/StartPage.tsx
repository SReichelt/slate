import * as React from 'react';
import './StartPage.css';
import * as Fmt from '../../shared/format/format';
import * as Notation from '../../shared/notation/notation';
import { LibraryDataProvider, LibraryDefinition } from '../../shared/data/libraryDataProvider';
import * as Logic from '../../shared/logics/logic';
import * as Logics from '../../shared/logics/logics';
import { HLMRenderer } from '../../shared/logics/hlm/renderer';
import Button from '../components/Button';
import Expression, { ExpressionInteractionHandler } from '../components/Expression';
import { OnLinkClicked } from '../components/InteractionHandler';
import DocLink, { OnDocLinkClicked } from './DocLink';

const Loading = require('react-loading-animation');

interface StartPageProps {
  isLoggedIn: boolean;
  libraryDataProvider?: LibraryDataProvider;
  templates?: Fmt.File;
  createInteractionHandler: (libraryDataProvider: LibraryDataProvider) => ExpressionInteractionHandler | undefined;
  onStartTutorial: (withTouchWarning: boolean) => void;
  onLinkClicked: OnLinkClicked;
  onDocLinkClicked: OnDocLinkClicked;
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
  let interactionHandler = props.createInteractionHandler(props.libraryDataProvider!);
  let result: React.ReactNode = <Expression expression={expression} interactionHandler={interactionHandler}/>;
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
    let definitionRenderer = Logics.hlm.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, props.templates!, rendererOptions);
    return definitionRenderer.renderDefinitionSummary(undefined, true)!;
  });
  let expression = new Notation.PromiseExpression(expressionPromise);
  let interactionHandler = props.createInteractionHandler(libraryDataProvider);
  let result = <Expression expression={expression} interactionHandler={interactionHandler}/>;
  return wrapExample(result, examplePath, props);
}

function StartPage(props: StartPageProps) {
  if (props.isLoggedIn) {
    // Once we display high scores, latest additions, etc., we will still want to display those here.
    return <div className="start-page"/>;
  }

  let exampleContents: React.ReactNode = null;

  if (props.libraryDataProvider && props.templates) {
    let dummyDefinition = new Fmt.Definition;
    dummyDefinition.name = '';
    let rendererOptions: Logic.LogicRendererOptions = {
      includeProofs: false
    };
    let renderer = Logics.hlm.getDisplay().getDefinitionRenderer(dummyDefinition, props.libraryDataProvider, props.templates, rendererOptions);
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
        Slate is a project to build a web-based <a href="https://en.wikipedia.org/wiki/Proof_assistant" target="_blank">interactive theorem prover</a> with a focus on abstract mathematics.
        It is optimized for being easy to learn.
      </p>
      <div className="tutorial-button-container">
        <Button className="tutorial-button standalone" onClick={props.onStartTutorial} key="tutorial-button">
          Start the five-minute interactive tutorial
        </Button>
      </div>
      <h2>Examples</h2>
      <p>
        Perhaps you are more interested in seeing specific pieces of formalized mathematics. In this web GUI, you will usually see <em>rendered</em> formal definitions and theorems, such as:
      </p>
      <div className="examples">
        {exampleContents}
      </div>
      <p>
        To explore the library, hover over any expression to see its definition (if applicable), and jump to that definition by clicking.
      </p>
      <h2>Current Status</h2>
      <p>
        Graphical input of simple definitions and theorem statements is mostly implemented. Proof input will follow soon.
      </p>
      <p>
        The entire web GUI is also integrated into an <a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate" target="_blank">extension for Microsoft Visual Studio Code</a> which supports more complex workflows.
        In particular, it provides side-by-side textual and graphical editing, combining the best of both worlds.
      </p>
      <h2>Foundations</h2>
      <p>
        Slate, as an application, is built to support different logics. However, the rendering and editing concepts of Slate works particularly well for a logic that is close to mathematical practice. Therefore, only one logic (called "HLM") is currently implemented.
      </p>
      <p>
        HLM is based on classical logic and has a set-theoretic flavor. It can be viewed as a <a href="https://ncatlab.org/nlab/show/structural+set+theory" target="_blank">structural set theory</a> but is conceptually closer to a <a href="https://en.wikipedia.org/wiki/Type_theory#Dependent_types" target="_blank">dependent type theory</a>.
        <br/>
        <DocLink href="docs/hlm/types" onDocLinkClicked={props.onDocLinkClicked}>Read about the HLM type system.</DocLink>
      </p>
      <p>
        In fact, a reasonably direct translation to the theorem provers <a href="https://coq.inria.fr/" target="_blank">Coq</a> and <a href="https://leanprover.github.io/" target="_blank">Lean</a> exists.
      </p>
      <p>
        Existing theorem provers can potentially be integrated into Slate, reusing its rendering and editing mechanisms.
      </p>
      <h2>Development</h2>
      <p>
        All relevant code and documentation is contained in the <a href="https://github.com/SReichelt/slate" target="_blank">GitHub repository</a>.
      </p>
      <p>
        For a list of third-party software used in Slate, see <DocLink href="docs/dependencies" onDocLinkClicked={props.onDocLinkClicked}>here</DocLink>.
      </p>
      <h2>Contact</h2>
      <p>
        Please send feedback via <a href="mailto:SebastianR@gmx.de">email</a>.
      </p>
    </div>
  );
}

export default StartPage;
