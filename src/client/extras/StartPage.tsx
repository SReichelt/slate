import * as React from 'react';
const Loading = require('react-loading-animation');

import './StartPage.css';

import Button from '../components/Button';
import Expression from '../components/Expression';
import { OnLinkClicked } from '../components/InteractionHandler';
import DocLink, { OnDocLinkClicked } from './DocLink';

import config from '../utils/config';
import { disableOwnDefaultBehavior } from '../utils/event';

import * as Fmt from 'slate-shared/format/format';
import * as Notation from 'slate-shared/notation/notation';
import { LibraryDataProvider, LibraryDefinition } from 'slate-shared/data/libraryDataProvider';
import * as Logic from 'slate-shared/logics/logic';
import * as Logics from 'slate-shared/logics/logics';
import { HLMRenderer } from 'slate-shared/logics/hlm/renderer';


interface StartPageProps {
  isLoggedIn: boolean;
  libraryDataProvider?: LibraryDataProvider;
  templates?: Fmt.File;
  onStartTutorial: (withTouchWarning: boolean) => void;
  onLinkClicked: OnLinkClicked;
  onDocLinkClicked: OnDocLinkClicked;
}

function getParentPath(names: string[]): Fmt.PathItem | undefined {
  if (names.length) {
    const name = names.pop()!;
    return new Fmt.NamedPathItem(name, getParentPath(names));
  } else {
    return undefined;
  }
}

function buildExamplePath(names: string[]): Fmt.Path {
  const name = names.pop()!;
  return new Fmt.Path(name, undefined, getParentPath(names));
}

function buildExample(names: string[]): Fmt.DefinitionRefExpression {
  const path = buildExamplePath(names);
  return new Fmt.DefinitionRefExpression(path);
}

function wrapExample(example: React.ReactNode, path: Fmt.Path, props: StartPageProps): React.ReactNode {
  const href = props.libraryDataProvider!.pathToURI(path);
  const onClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button < 1) {
      disableOwnDefaultBehavior(event);
      props.onLinkClicked(props.libraryDataProvider!, path);
    }
  };
  return (
    <a className="example" href={href} onClick={onClick}>
      {example}
    </a>
  );
}

function renderDefinitionExample(names: string[], props: StartPageProps, renderer: HLMRenderer): React.ReactNode {
  const example = buildExample(names);
  const expression = renderer.renderExampleExpression(example);
  const result = [
    <div className="example-title" key="title">Definition:</div>,
    <div key="result"><Expression expression={expression}/></div>
  ];
  return wrapExample(result, example.path, props);
}

function renderTheoremExample(names: string[], props: StartPageProps): React.ReactNode {
  const examplePath = buildExamplePath(names);
  const libraryDataProvider = props.libraryDataProvider!.getProviderForSection(examplePath.parentPath);
  const definitionPromise = libraryDataProvider.fetchLocalItem(examplePath.name, false);
  const expressionPromise = definitionPromise.then((definition: LibraryDefinition) => {
    const rendererOptions: Logic.LogicRendererOptions = {
      includeProofs: false
    };
    const definitionRenderer = Logics.hlm.getDisplay().getDefinitionRenderer(definition.definition, libraryDataProvider, props.templates!, rendererOptions);
    return definitionRenderer.renderDefinitionSummary(undefined, true)!;
  });
  const expression = new Notation.PromiseExpression(expressionPromise);
  const result = <Expression expression={expression}/>;
  return wrapExample(result, examplePath, props);
}

function StartPage(props: StartPageProps): React.ReactElement {
  if (props.isLoggedIn) {
    // Once we display high scores, latest additions, etc., we will still want to display those here.
    return <div className="start-page"/>;
  }

  let exampleContents: React.ReactNode = null;

  if (props.libraryDataProvider && props.templates) {
    const dummyDefinition = new Fmt.Definition('', new Fmt.PlaceholderExpression(undefined), new Fmt.ParameterList);
    const rendererOptions: Logic.LogicRendererOptions = {
      includeProofs: false
    };
    const renderer = Logics.hlm.getDisplay().getDefinitionRenderer(dummyDefinition, props.libraryDataProvider, props.templates, rendererOptions);
    const examples = [
      renderDefinitionExample(['Essentials', 'Sets', 'finite'], props, renderer),
      renderDefinitionExample(['Essentials', 'Numbers', 'Natural', 'Prime', 'prime'], props, renderer),
      renderTheoremExample(['Essentials', 'Numbers', 'Real', 'Roots of primes are irrational'], props),
      renderTheoremExample(['Algebra', 'Semirings', 'Formulas', 'Binomial theorem for commutative semirings'], props)
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
          Start the built-in five-minute tutorial
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
        Graphical input of simple definitions and theorem statements is mostly implemented. Proof input is not fully functional yet, but can be experimented with.
      </p>
      <p>
        The entire web GUI is also integrated into an <a href="https://marketplace.visualstudio.com/items?itemName=sreichelt.slate" target="_blank">extension for Microsoft Visual Studio Code</a> which supports more complex workflows.
        In particular, it provides side-by-side textual and graphical editing, combining the best of both worlds.
      </p>
      <h2>Feedback/Discussion</h2>
      <p>
        Feel free to join the <a href={`${config.projectRepositoryURL}/discussions`} target="_blank">discussion forum</a> over at GitHub. Any feedback is welcome.
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
        All relevant code and documentation is contained in the <a href={config.projectRepositoryURL} target="_blank">GitHub repository</a>.
      </p>
      <p>
        For a list of third-party software used in Slate, see <DocLink href="docs/dependencies" onDocLinkClicked={props.onDocLinkClicked}>here</DocLink>.
      </p>
    </div>
  );
}

export default StartPage;
