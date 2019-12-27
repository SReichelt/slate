import * as React from 'react';
import './StartPage.css';
import * as Fmt from '../../shared/format/format';
import * as Display from '../../shared/display/display';
import { LibraryDataProvider } from '../../shared/data/libraryDataProvider';
import { HLMRenderer } from '../../shared/logics/hlm/renderer';
import Expression, { ExpressionInteractionHandler } from './Expression';
import { OnLinkClicked } from './InteractionHandler';

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
  let definitionPromise = libraryDataProvider.fetchLocalItem(examplePath.name);
  let expressionPromise = definitionPromise.then((definition) => {
    let definitionRenderer = new HLMRenderer(definition, false, libraryDataProvider, props.templates!);
    return definitionRenderer.renderDefinitionSummary(undefined, true)!;
  });
  let expression = new Display.PromiseExpression(expressionPromise);
  let result = <Expression expression={expression}/>;
  return wrapExample(result, examplePath, props);
}

function StartPage(props: StartPageProps) {
  let exampleContainer: React.ReactNode = undefined;

  if (props.libraryDataProvider && props.templates) {
    let dummyDefinition = new Fmt.Definition;
    dummyDefinition.name = '';
    let renderer = new HLMRenderer(dummyDefinition, false, props.libraryDataProvider, props.templates);
    let examples = [
      renderDefinitionExample(['Essentials', 'Sets', 'finite'], props, renderer, ['multiple definitions', 'of finiteness']),
      renderDefinitionExample(['Essentials', 'Numbers', 'Natural', 'Prime', 'prime'], props, renderer, ['definition']),
      renderTheoremExample(['Essentials', 'Numbers', 'Real', 'Roots of primes are irrational'], props),
      renderTheoremExample(['Algebra', 'Semirings', 'Formulas', 'Binomial theorem'], props)
    ];
    exampleContainer = (
      <div className="examples">
        {examples.map((example: React.ReactNode, index: number) => <div className="example-container" key={index}>{example}</div>)}
      </div>
    );
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
      {exampleContainer}
      <h2>Background</h2>
      <p>
        Slate is a web-based successor to the <a href="http://hlm.sourceforge.net/">HLM</a> project.
        The basic idea of HLM was that the user never needs to edit the source code of formalized content, but always works with nicely rendered expressions instead.
      </p>
      <p>
        Using modern web technologies, Slate functions as both a website and an application.
        One can think of it as a wiki-like collaboration tool for formalized mathematics.
        Indeed, the primary goal is to build a large library of definitions and theorems that follow mathematical practice as closely as possible – but still have clearly defined formal semantics, making them suitable for formal verification.
      </p>
      <h2>Current Status</h2>
      <p>
        Slate is not yet ready to be used for any practical purpose.
        To explore and demonstrate the editing capabilities, we have added the ability to modify non-mathematical content, including the display specifications of definitions (but user-friendliness is still to be improved).
        Other than that, you can browse the library by clicking on sub-expressions, and view the source code of a definition or theorem by clicking on the button in the lower-right corner.
        Hover over an expression to see the connection between the source code and the rendered version:
      </p>
      <p>
        <img src="/docs/screenshots/source-code.png" width="657" height="357" alt="Screenshot of source code display"/>
      </p>
      <p>
        Editing definitions and theorem statements is planned as the next step, but will take some time.
        Meanwhile, here is a screenshot of the original desktop version:
      </p>
      <p>
        <img src="/docs/screenshots/desktop/input-formula.png" width="403pt" height="210pt" alt="Screenshot of formula input in desktop version"/>
      </p>
      <h2>Foundations</h2>
      <p>
        In contrast to the desktop version, Slate is not tied to any particular logic.
        We continue using the name "HLM" for the specialized logic that is implemented in Slate, but other logics can be implemented side-by-side.
        This means that other theorem provers can potentially be integrated into Slate, reusing its rendering and editing mechanisms.
      </p>
      <p>
        HLM is classical and set-theoretic, and can be described as either a <a href="https://ncatlab.org/nlab/show/structural+set+theory">structural set theory</a>, or a <a href="https://en.wikipedia.org/wiki/Type_theory">type theory</a> where all references to types are made implicitly.
        It is not based on any familiar axiomatization, and avoids some of the limitations of Zermelo-Fraenkel and other set theories.
      </p>
      <h2>Visual Studio Code Extension</h2>
      <p>
        Although the web interface is intended to be sufficient for most users, we have additionally developed a language extension for Microsoft <a href="https://code.visualstudio.com/">Visual Studio Code</a>.
        All applicable language features are supported. In addition, expressions are rendered (as text) according to their display specifications, both in tooltips and inline as code lenses:
      </p>
      <p>
        <img src="/docs/screenshots/vscode.png" width="529pt" height="292pt" alt="Screenshot of Visual Studio Code extension"/>
      </p>
      <p>
        We have not made the extension available via official channels yet, but it is included in the <a href="http://github.com/sreichelt/slate/">GitHub repository</a>.
      </p>
      <h2>Third-Party Software</h2>
      <p>
        Slate builds upon the following third-party software packages.
      </p>
      <p>Generic:</p>
      <ul>
        <li><a href="https://nodejs.org/">Node.js</a></li>
        <li><a href="https://www.typescriptlang.org/">TypeScript</a></li>
        <li><a href="https://github.com/gilamran/fullstack-typescript">fullstack-typescript</a> template</li>
        <li><a href="https://github.com/kemitchell/markdown-escape.js">markdown-escape</a></li>
      </ul>
      <p>Frontend:</p>
      <ul>
        <li><a href="https://reactjs.org/">React</a></li>
        <li><a href="https://github.com/tomkp/react-split-pane">react-split-pane</a></li>
        <li><a href="https://github.com/schiehll/react-alert">react-alert</a></li>
        <li><a href="https://github.com/nathanhoad/react-loading-animation">react-loading-animation</a></li>
        <li><a href="https://github.com/romainberger/react-portal-tooltip">react-portal-tooltip</a></li>
        <li><a href="https://github.com/pradel/react-responsive-modal">react-responsive-modal</a></li>
        <li><a href="https://github.com/InsidersByte/react-markdown-renderer">react-markdown-renderer</a></li>
        <li><a href="https://www.npmjs.com/package/react-simplemde-editor">react-simplemde-editor</a></li>
        <li><a href="https://www.mathjax.org/">MathJax</a> (currently just the font, not the rendering engine)</li>
      </ul>
      <p>Backend:</p>
      <ul>
        <li><a href="https://expressjs.com/">Express</a></li>
        <li><a href="https://github.com/chimurai/http-proxy-middleware">http-proxy-middleware</a></li>
        <li><a href="https://nodemailer.com/">Nodemailer</a></li>
      </ul>
      <p>
        Slate itself is licensed under the <a href="https://github.com/SReichelt/slate/blob/master/LICENSE">MIT license</a>.
        To review the licensing terms of third-party components, please consult their respective documentation.
      </p>
      <h2>Contact</h2>
      <p>
        Please send feedback via <a href="mailto:SebastianR@gmx.de">email</a>.
      </p>
    </div>
  );
}

export default StartPage;
