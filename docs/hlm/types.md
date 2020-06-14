# The HLM Type System

This document briefly describes the type system of the HLM logic, which is the foundation used by the Slate proof assistant.

In contrast to most logics, types in HLM are invisible in the sense that the user never sees or needs to know the type of an expression. From a user's perspective, HLM can be regarded as set-theoretic. Intuitively, the type system restricts expressions to those that mathematically "make sense."

## Formulas and Terms

At the most basic level, expressions in HLM fall into three categories: set terms, element terms, and formulas. These categories are _not_ considered part of the type system, as the logic is defined in such a way that every placeholder accepts exactly one of these categories. Both set terms and element terms are typed, but formulas are not (which roughly corresponds to the existence of a single `Prop` type in other logics).

In the Slate user interface, these three categories are immediately apparent because different icons are used to distinguish them both in placeholders and in definitions:
* A green circle indicates a set term.
* A red square indicates an element term.
* A rotated blue square indicates a formula.

## Sets as Types

On top of these three basic categories, set terms and element terms are governed by type restrictions. Although no explicit type declarations exist, we can assign types as follows:

* A variable x introduced as "Let x ∈ S" is an element term that inherits the type of the set term S.
* A variable T introduced as "Let T ⊆ S" is a set term that inherits the type of S.
* A variable S introduced as "Let S be a set" also introduces a type variable. (Alternatively, we can treat S itself as a type variable.)
* All expressions are typed in the obvious way, for example {x ∈ S : ...} inherits the type of S.
* A "construction" introduces a new type, as a construction is fundamentally the same as an inductive data type.

In all cases where terms are required to be "compatible" in some sense, e.g. in formulas like "x = y" or "x ∈ S" (as a formula, not introducing a variable), we require these terms to have the same type according to the above rules.

**Informally, we may say that two set terms are compatible if and only if they have been declared as subsets of some common superset. Likewise, two element terms are compatible if and only if they have been declared as elements of the same set, taking subset declarations into account.**

## Advanced Features

While the previous section describes the basic ideas underlying the HLM type system, the actual implementation needs to deal with a lot of details and also extends the type system in a few ways. Two aspects are especially important:

* Since "constructions" define types, and equality between two element terms is well-typed if and only if both sides have the same type, constructions play an important role in defining the "meaning" of equality. However, "constructors" can carry parameters of the form "let S be set", so for a constructor c with such a parameter we may ask whether "c(S) = c(T)" for two set terms S and T with different types. In this case, the formula "S = T" is not well-typed.

  This issue leads to a somewhat special treatment of equality with the remarkable consequence that (bundled) isomorphic structures are necessarily equal. [Read more.](equality.md)

* "Embedding" one set in another can be added as a feature in a specific way: When defining a construction, a previously defined set can be embedded in it according to a given injective map. In this case the new construction does not define a new type but can be regarded as inheriting the type of the embedded set (even though it defines a superset, not a subset).

  Since elements of the new construction and elements of the embedded set have the same type, they are "compatible" in exactly the same way as elements of a single construction are. This makes embeddings more powerful than type coercions in other logics: The embedded set simply becomes a subset like any other. Still, every formula involving an embedding can equivalently be written in a way that does not use the embedding.

## Relationship to Other Foundations

A distinguishing property of HLM is that a formula like "x = y" or "x ∈ S" can be well-typed or ill-typed depending on the terms involved. In particular, for the formula to be well-typed, the terms must be a priori related in a specific way. Foundationally, this characterizes HLM in two alternative ways:

1. If HLM is interpreted as a set theory, then the above property characterizes HLM as a [structural](https://ncatlab.org/nlab/show/structural+set+theory) rather than [material](https://ncatlab.org/nlab/show/material+set+theory) set theory.

   Every element term in HLM is declared as an element of a specific set. Although this set is not the _only_ set that the given term is a member of, there is (ignoring type variables and embeddings) a single construction that determines the identity of the element. Unlike in a material set theory, the element does not have a global identity outside of this construction, and it cannot be used to "build" sets.

2. Even though HLM appears set-theoretic, it can also be interpreted as a (dependent) type theory, essentially by taking its "type" concept literally.

   E.g. one might replace a variable introduced as "Let x ∈ S" with "Let x : T such that S(x)", where T is the type corresponding to S (i.e. the largest known superset), and S(x) is the proposition that formalizes "x ∈ S".

   Alternatively, HLM can be treated as a type theory with subtypes. Then "Let x ∈ S" can literally be translated as "x : S", where S is a type that is possibly a subtype of some larger type. (Taken to the extreme, such a type theory is not really distinguishable from a structural set theory, which is ultimately the reason why HLM can be interpreted as either.)

### Relationship to Other Provers

The interpretation of HLM as a type theory enables a translation from HLM to theorem provers with sufficiently powerful type-theoretic foundations. The [Coq](https://coq.inria.fr/) and [Lean](https://leanprover.github.io/) provers meet these criteria.

In fact, Lean is an especially interesting target because the Lean core library defines a "set" type that behaves quite similarly to subsets in HLM, even though sets in Lean are merely syntactic sugar on top of a purely type-theoretic system. While sets in Lean help users translate set-theoretic mathematics to type theory, HLM essentially performs the same translation automatically under the hood.

To make the relationship between HLM and Lean more explicit, the file [hlm-defs.lean](experimental/lean/hlm-defs.lean) contains the basics of an experimental translation from HLM to Lean, with examples.
