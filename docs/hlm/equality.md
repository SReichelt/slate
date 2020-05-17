# Equality in the HLM logic

This document describes the treatment of equality in the HLM logic, especially regarding equality of isomorphic structures.

TBD

## What is special about equality in HLM?

* Restrictions:
  * Elements of the same set/type.
  * Sets that are subsets of a given superset (i.e. have the same type). => Equal iff same elements.
  * Arbitrary sets cannot be compared (i.e. different types).
* When are two terms referring to the same constructor equal?
  * Usual answer: Equal iff all subterms are.
  * Not possible if subterms include arbitrary sets.
  * Solution: Equality must be defined, subject to properties of an equivalence relation.
  * Impossible to distinguish isomorphic structures.

## How should I think about equality of isomorphic structures?

* Dealing with _bundled_ structures really means dealing with isomorphism classes of these structures.
  * Type system guarantees that all definable properties are invariant under isomorphism.
* "Let G be a group" really means "Let G be an isomorphism class of groups".
  * Deconstructing G yields a representative set and operation.

## Why does this not lead to problems?

* Short answer: Lean translation.
  * Equality in HLM mapped to equivalence relation in Lean.
* Longer answer: If a structure contains an "arbitrary set" parameter, this essentially introduces a type variable wherever an element of the structure is deconstructed. This type variable can only be eliminated by expressions that preserve isomorphism.

## What practical effects does this have?

I.e.: What should be done differently in the presence of isomorphism=equality?

* Can mostly be ignored.
* A subgroup is simply a subset of the carrier with certain properties.
  * Can be treated as a group: "Forgetful" operation.
* Convention: Use equality instead of asking whether an isomorphism exists.
* Category theory:
  * Definition of a category does not necessary need to be modified.
  * However, all commonly used categories are skeletal.
  * For skeletal categories, isomorphism and equivalence are the same.
  * We want this, so that categories are equal iff they are equivalent (as opposed to isomorphic).
  * Could define "precategories" without the skeletality requirement if necessary.

## Are there any specific benefits?

* Major simplification when dealing with things "up to isomorphism".
  * E.g. counting all non-isomorphic groups of order n.
* Rewriting can be used to prove properties.
  * E.g. if group G has property p and H is isomorphic to G, simply substitute H for G to show that H has property p as well.

## Restrictions on rewriting

## HoTT

## Similar situation in e.g. Lean
