import * as React from 'react';

interface StartPageProps {
}

function StartPage(props: StartPageProps): any {
  return (
    <div>
      <h1>The Slate Interactive Theorem Prover</h1>
      <p>
        Slate is a project to build a web-based <a href="https://en.wikipedia.org/wiki/Proof_assistant">interactive theorem prover</a> with a focus on abstract mathematics.
      </p>
      <p>
        Its unique rendering concept makes formalized definitions and theorems intuitively understandable without detailed explanation.
        So please just follow these links to some examples in the library – and then hover over the expressions therein to start exploring:
      </p>
      <div className="examples">
        <p>TODO</p>
      </div>
      <h2>Background</h2>
      <p>
        Slate is essentially a web-based reimplementation of the now-abandoned <a href="http://hlm.sourceforge.net/">HLM</a> project.
        The basic idea is that the user never needs to edit the source code of formalized content, but always works with nicely rendered expressions instead.
      </p>
      <p>
        Using modern web technologies, Slate functions as both a website and an application.
        One can think of it as a wiki for formalized mathematics.
        Indeed, the primary goal is to build a large library of definitions and theorems that follow mathematical practice as closely as possible – while still being suitable for formal verification.
      </p>
      <h2>Current Status</h2>
      <p>
        Non-mathematical content can be edited.
      </p>
      <p>TODO</p>
      <p>
        <img src="http://hlm.sourceforge.net/screenshots/input-formula.png" width="403" height="210" alt="Screenshot of formula input in desktop version"/>
      </p>
      <h2>Mathematical Properties</h2>
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
      <p>TODO</p>
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
        To review the licensing terms of third-party components, please refer to the their respective documentation.
      </p>
    </div>
  );
}

export default StartPage;
