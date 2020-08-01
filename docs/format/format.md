# The Slate file format

This document describes the format of `.slate` files, which are used to store and transfer data throughout Slate.

Although the Slate file format is primarily designed to hold mathematical contents, at its core it is actually quite generic, similarly to e.g. XML, JSON, or YAML. In fact, it would be perfectly possible to use one of these established formats instead, but the resulting files would be much larger and more difficult for humans to read or edit. Therefore, the Slate format provides a few additional primitives to help express mathematics in a more concise fashion:
* *Variables* can be declared using a specific syntax, and then simply be referenced by name, as in any programming language.
* The top-level entries in a file are called *definitions*, and there is a specific syntax to declare them and to reference them both from the same file and from other files.
* A definition has a signature consisting of *parameters*. Inside the definition, these act as variables. When referencing the definition, an *argument* can be specified for each parameter.
* Each file references a *metamodel*, which is itself a `.slate` file that acts as a DTD or schema. Definitions in the metamodel can be exported to files that reference the metamodel, where they take the role of keywords.

Note that at the level of the Slate file format, no semantics are specified for these primitives: Although the file format offers the ability to reference definitions and variables, there is no general answer to the question what it _means_ to reference a definition or variable; the answer depends on the metamodel referenced by the file (see below).

## Language specification

See [slate.ebnf](slate.ebnf) for an informal EBNF grammar for the `.slate` format.

The source code to read and write data in this format can be found in `src/shared/format/read.ts` and `src/shared/format/write.ts`, respectively. This code is used both by the web application and by the Visual Studio Code extension.

## Metamodels

The type, or purpose, of a `.slate` file is defined by the metamodel it references at the top. Currently, four metamodels have been defined:
* The `hlm` metamodel defines the mathematical primitives of the HLM logic. Since HLM is currently the only logic implemented in Slate, all files with mathematical content reference this metamodel.
* The `library` metamodel is used in files that specify the structure of a mathematical library.
* The `notation` metamodel contains rendering primitives. It is referenced by `templates.slate`, which defines notation templates, and is also included in the `hlm` metamodel since each mathematical object can be equipped with a custom notation.
* Finally, since the metamodels are `.slate` files themselves, they also need to reference a specific metamodel which is called `meta`.

When reading a `.slate` file, the code typically expects a file of a specific type, i.e. a file that references a specific metamodel. In fact, the code in `read.ts` expects its caller to provide an "implementation" of the metamodel, of which there are three different kinds:
* The *dummy* implementation ignores the metamodel specification of the file and accepts all files that match the grammar. The resulting objects are not really semantically meaningful. E.g. when reading a variable reference, the code cannot determine the referenced variable without knowing the metamodel. Therefore, all identifiers are accepted as variable names, and each reference simply points to a newly created parameter.
* The *dynamic* implementation is used in situations where any arbitrary metamodel should be supported. Based on the metamodel reference in the file, it loads the `.slate` file defining the metamodel, and analyzes the file contents based on the loaded metamodel. The most prominent use case of the dynamic implementation is the Visual Studio Code extension, which uses it for all non-mathematical features such as diagnostics, jumping to definitions, displaying signatures, providing suggestions, etc.
* In all cases where a specific metamodel is expected, the metamodel implementation can be *generated* from the metamodel `.slate` file, using the code generation scripts in `src/scripts`. This has the advantage that a specific TypeScript class (with appropriate members) is generated for each definition in the metamodel. When reading a corresponding file, these classes are instantiated and filled appropriately, as if the metamodel defined a new domain-specific language.

The functionality that is implemented by a metamodel is a little ad-hoc and has been extended somewhat frequently to fit specific needs, but in general it can be described as follows:
* First, a metamodel exports certain definitions to be used as *meta references* in files. E.g. the metamodel file `library.slate` contains a definition `$Section`, and this definition is referenced as `%Section` in `_index.slate` files, which reference this metamodel. (Note that in the Visual Studio Code extension, "go to definition" also works on meta references, even though they are displayed as keywords.)
* Then, depending on where a definition can be used as a meta reference, it can supply additional information regarding:
  * Contents: In the case of `%Section`, the metamodel specifies that it can be used as a definition type and that a definition of this type has the members `logic` and `items`.
  * Variables: In particular, the metamodel specifies which variables are in scope at which locations.

## Specific types of files

### HLM files

HLM files are `.slate` files that reference the `hlm` metamodel. Beyond the constraints defined by the metamodel, these files are governed by the HLM *logic*, i.e. by mathematical rules that impose further restrictions. As with any theorem prover, a lot of these rules fall under the topic of *type checking*.

An exact description of HLM files does not exist yet, and the details are still somewhat subject to change. However, there is a strong connection between the definitions in the `hlm` metamodel and the items of context-specific menus in the Slate GUI. E.g. consider the menu that appears when entering a formula. The items in this menu are, in that order:
* Variable references (though formula variables are rare).
* Meta references like `%and`, `%forall`, etc., which are defined in `hlm.slate`.
* Definition references.
