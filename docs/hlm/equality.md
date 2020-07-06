# Equality in HLM

This document describes the treatment of equality in the HLM logic, especially regarding equality of isomorphic structures.

## What is special about equality in HLM?

### Equality in General

Similarly to equality in a type theory or structural set theory, equality in HLM is restricted to terms of the same type, as described in the document "[The HLM Type System](types.md)." In addition, equality between set terms is distinct from equality between element terms.

* For element terms x and y, "x = y" is well-typed if there is a set S such that both x and y have been introduced as members of S (taking subset relations into account).
* For set terms S and T, "S = T" is well-typed if there is a set U such that both S and T have been introduced as subsets of U. Under this condition, we can define "S = T" to be true if S and T have the same elements.
* In particular, for two sets introduced as "Let S,T be sets," the formula "S = T" is _not_ well-typed.

### Equality of Constructors

Although the rules given above are very simple, and similar rules exist in any type theory, they lead to a fundamental question when introducing the concept of a "construction" which is essentially an inductive data type. Since a "constructor" can be equipped with parameters, including those of the form "Let S be a set," it is not immediately obvious when two terms involving the same constructor should be considered equal.

E.g. when defining the following construction C with constructor c

> C :=: {c(S,x) | S is a set, x ∈ S},

the question that arises is: When is a proposition of the form "c(S,x) = c(T,y)" true?

Note that in general, S and T are not required to be subset of a common superset U, so the formula "S = T" is not necessarily well-typed (and, as a consequence, neither is "x = y"). Therefore, the usual answer that

> c(S,x) = c(T,y) ⇔ S = T and x = y

is problematic because in general this formula is not well-typed.

The solution chosen in HLM is that a definition for "c(S,x) = c(T,y)" is part of the construction, i.e. supplied by the user. This definition is required to satisfy the properties of an equivalence relation.

In the given example, while the definition

> c(S,x) = c(T,y) :⇔ S = T and x = y

would be ill-typed, the definition

> c(S,x) = c(T,y) :⇔ there exists a bijection between S and T that maps x to y

is legal and is in fact the most "general" definition, in the sense that any terms c(S,x) and c(T,y) that are identified by this definition in fact cannot be distinguished by _any_ alternative definition of equality.

### Isomorphism

A natural follow-up question is: Given a particular constructor c with parameters, what exactly are the terms c(...) that cannot be distinguished by _any_ equality definition? The answer is twofold:

1. If none of the parameters are of the form "S is a set," the equality definition necessarily identifies terms c(x,y,...) with equal arguments x,y,..., i.e. all terms that are extensionally equal.
2. If at least one of the parameters has the form "S is a set," and we regard a term c(S,x,...) as a mathematical structure, then the equality definition cannot distinguish any terms that represent isomorphic structures. This is because the type restrictions ensure that the equality definition given by the user can only refer to structural properties of the given arguments.

In short the HLM type system forces isomorphic structures to be equal.

#### Remarks

Two important points:
* This property of HLM is an implicit consequence of the type system. HLM itself does not specify what a "structure" is or when two structures are "isomorphic."
* Borrowing the terminology of "bundled" vs. "unbundled" structures from other systems, the above only applies to _bundled_ structures. E.g., the example above,

  > C :=: {c(S,x) | S is a set, x ∈ S},

  defines a bundled "pointed set" structure in such a way that two isomorphic bundled sets are forced to be equal. The corresponding unbundled version could be written as:

  > Let S be a set.
  >
  > C(S) :=: {c(S,x) | x ∈ S}.

  This case is fundamentally different because S is a parameter of the construction, not a parameter of the constructor. Therefore, the equality definition must be given for a fixed S, and

  > c(S,x) = c(S,y) :⇔ x = y

  is perfectly well-typed. (In contrast, expressions of the form "c(S,x) = c(T,y)" are then ill-typed if S and T differ, as c(S,x) has type C(S) and c(T,y) has type C(T).)

## How should I think about equality of isomorphic structures?

As described above, a consequence of the HLM type rules is that isomorphic structures are equal; however in current mathematical practice this is generally false (but sometimes regarded as informally true). Therefore, users need to know how to interpret definitions and theorems formalized in HLM.

Most of the difference can be summarized as:

> Dealing with structures in HLM really means dealing with _isomorphism classes_ of structures.

For example, it is not possible to define a collection of groups (G,∗) as objects in HLM. Instead, due to the equality definition of such a collection, the individual elements are not really groups but isomorphism classes of groups, i.e. equivalence classes with respect to the relation of being isomorphic.  
To avoid confusion, we write such isomorphism classes as \[G,∗\] instead of (G,∗). This is intended to clarify that "\[G,∗\] = \[H,⋆\]" does not imply "G = H" and/or "∗ = ⋆", but simply means that (G,∗) and (H,⋆) are isomorphic.

We do write "Let **G** be a group" instead of "Let **G** be an isomorphism class of groups." The latter is not only overly verbose but also redundant because in HLM it is impossible to talk about groups that are _not_ isomorphism classes.

The type system guarantees that all properties that can be defined on an isomorphism class are actually invariant under isomorphism. Therefore in many cases the fact that **G** is really an isomorphism class can be ignored.  
Furthermore, **G** can be decomposed into a representative set G and an operation ∗. Even though G and ∗ are not actually uniquely defined by **G**, they can effectively be treated as such. (See next section.) This eliminates most practical differences between "Let **G** be a group" and "Let **G** be an isomorphism class of groups."

### Remark

While this treatment of e.g. structures such as groups may seem unusual, it does in fact correspond to the ordinary mathematical treatment of one particular type of structure: ordinal numbers. Although "officially," ordinal numbers are defined in ZFC as specific sets that happen to be well-ordered, in practice a more "structural" definition of ordinal numbers is often used.

According to this structural definition, ordinal numbers are equivalence classes \[S,⪯\] of sets with well-orderings, quite similarly to our treatment of groups as equivalence classes \[G,∗\]. In order to define e.g. the sum of two ordinal numbers α and β, we decompose α and β into α=\[S,⪯\] and β=\[T,⊑\], and define α+β in terms of S, T, ⪯, and ⊑. Although S and T are not unique, the result α+β (as an equivalence class) is in fact independent of the choice of S and T (and in HLM, the type system guarantees this).

HLM extends this approach to other structures. One could say that groups in HLM are to groups in ordinary mathematics what ordinal numbers are to well-ordered sets.

## Why does this not lead to problems?

In some cases (e.g. in the case of ordinals as described above), the idea of working with isomorphism classes of structures instead of directly working with structures can be taken literally, and is thus unproblematic. However, potential problems arise when something depends on a specific choice of a representative set. For example, we may say that the neutral element of the group \[ℤ,+\] is 0, but we can easily define an isomorphic (and thus equal) group whose neutral element is 1.

The type rules of HLM are designed to prevent such problems. Instead of describing the solution directly, it is actually easier to describe what happens in the (currently experimental) [translation to the Lean proof assistant](experimental/lean/hlm-defs.lean). In this way, the translation to Lean validates the semantics of HLM, or could even be said to indirectly define the meaning of HLM expressions.

In the translation, an isomorphism class like \[ℤ,+\] does not directly map to the corresponding isomorphism class in Lean, as the surrounding expression may contain other subexpressions that depend on the specific choice of representative (such as 0 in the statement above). Instead, \[ℤ,+\] maps to the pair (ℤ,+), preserving the specific representative set and operation. As a consequence, equality in HLM does _not_ map to equality in Lean, but is encoded as an equivalence relation.

## What practical effects does this have?

More specifically, what must or should be done differently if isomorphic structures are equal?

### Mandatory Differences

As indicated in the preceding sections, in many cases the distinction between structures and their isomorphism classes can be ignored. Thus, most definitions and theorems look exactly the same as they would if isomorphic structures were not equal.

The most visible difference arises when dealing with an equality that is more fine-grained than isomorphism. For example, when dealing with subgroups of a group \[G,∗\], it makes a difference whether to consider
* subsets of G that satisfy the properties of being a subgroup, or
* isomorphism classes of these subsets.

Most of the time the term "subgroup" refers to the first case, i.e. distinct isomorphic subsets are considered different subgroups. In HLM, this means that we need to deal with a subset H ⊆ G instead of the group \[H,...\] which is in fact an isomorphism class. However occasionally in mathematics, "H is a subgroup of G" is intended to mean that H can be embedded into G, which corresponds exactly to the second case in the sense that now it is sufficient for H to be an isomorphism class.

In the HLM library, you will find distinct definitions for both properties: We use the word "subgroup" for the first case, and the symbol "≤" for the second case.

### Conventions

In the HLM library, there is essentially a single convention that arises from equality of isomorphic structures: Prefer equality over other ways of declaring that two structures are isomorphic.

This convention does not extend to the case where a _specific_ isomorphism is given.

### Category Theory

If all isomorphic structures are equal, this obviously has implications for the formalization of category theory. However, the implications are not particularly dramatic.

First of all, it is possible to formalize category without any HLM-specific modifications, except that when defining a concrete category, the objects of this category are isomorphism classes because HLM can only talk about those (when using bundled structures). Note that the ability to formalize category theory in this setting is not entirely obvious and depends on details of the type system that are not entirely spelled out in this document.

Since categories are themselves structures, two categories in HLM are equal if they are isomorphic; this is expected but somewhat unsatisfactory: One would additionally want all _equivalent_ categories to be equal.

This suggests a slight change in the formalization of category theory in HLM: Since all commonly used categories are skeletal in HLM, we can simply modify the definition of a category to include skeletality as an additional axiom. With this change, we get the theorem that two categories are equal if and only if they are equivalent.

### Benefits

Equality of isomorphic structures simplifies some definitions, theorems, and proofs. These simplifications mostly correspond to cases where isomorphism is already _informally_ treated as equality in ordinary mathematics.

* In mathematics, we often deal with objects "up to isomorphism," which can lead to quite lengthy sentences when spelled out in detail. In HLM, the corresponding objects are already isomorphism classes, so the phrase "up to isomorphism" is always implied. For example, to count the number of non-isomorphic groups of order n, we simply define the subset of all groups with order n and take its cardinality.

  (To be fair, in other systems it may be perfectly possible to define isomorphism classes of mathematical structures; it is just not commonly done.)

* In a proof, equality of two structures is especially valuable because all properties proved about one structure immediately apply to the other structure as well, by rewriting. E.g. if a group **G** has property p and **H** is isomorphic to **G**, simply substitute **H** for **G** to show that **H** has property p as well.  
However, such rewriting operations are not always legal:

#### Restrictions on Rewriting

In the example above, **G** and **H** are treated purely as isomorphism classes without considering any particular representatives. In such cases, rewriting is unproblematic. However, if particular representatives are involved, rewriting would quickly lead to inconsistency: 

For example, if we define a group operation ∗ on ℤ by

> ∗ : ℤ×ℤ → ℤ, (a,b) ↦ a+b-1,

then we can prove two theorems about the group \[ℤ,∗\]:
* 1 is a neutral element of \[ℤ,∗\].
* \[ℤ,∗\] = \[ℤ,+\].

Rewriting the first statement along the equality in the second would yield the contradiction that the neutral element of \[ℤ,+\] is also 1.

Thus, rewriting along an equality is not allowed if the rewritten statement involves a decomposition of the structure into concrete representatives. It can, however, be used for any theorem whose _proof_ depends on such a decomposition. For example, a proof that **G**:=\[ℤ,+\] is infinite may depend on the specific decomposition into ℤ and +, but the statement that **G** is infinite does not. By rewriting, we may conclude that \[ℤ,∗\] is infinite as well.

## Are there relationships to other logics?

### Homotopy Type Theory

The property that isomorphic structures in HLM are equal suggests a possible relationship to [Homotopy Type Theory](https://homotopytypetheory.org/) (HoTT). E.g., although HLM and HoTT were developed independently, they might lead to a similar style of doing mathematics. An expert on HoTT would be needed to analyze whether this is the case.

One similarity between HLM and HoTT seems to be that equality of isomorphic structures is not fundamentally built into the logic but is actually a consequence of more general logical principles. In HLM, this property arises from the type rules; in HoTT it is related to the ∞-groupoid structure on types.

An important difference between HLM and HoTT is that in HLM, there is no proposition that internally formalizes the fact that isomorphic structures are equal. (To state such a proposition, one would first need to internalize the notion of a "structure.") Instead, equality of isomorphic structures is an _external_ property of HLM. In HoTT, equality of isomorphic structures is encoded in the univalence axiom, and is thus an _internal_ statement. An _external_ statement about HoTT that corresponds most closely to the HLM version of "isomorphic structures are equal" is not the univalence axiom itself but the statement that the univalence axiom is _consistent_ with the other axioms and rules of HoTT.

It should be noted that the idea that isomorphic structures are equal is not exactly specific to either HLM or HoTT, but (as an idea) is actually quite common in mathematics. For example, when counting the number of groups of a specific order, it is intuitively obvious that the "correct" way to count such groups is to count their isomorphism classes.

### Lean (and similar systems)

HLM can be regarded as a dependent type theory, and in general, equality in HLM is quite similar to equality in e.g. [Lean](https://leanprover.github.io/). For example, in Lean, we may write:

```
def elem_eq {U : Type} (S T : set U) (x ∈ S) (y ∈ T) := x = y
```

An HLM-specific interpretation would be: Since `S` and `T` are "subsets" of `U`, `x` and `y` are known to be elements of `U` and thus comparable. However, if we alter this to

```
def elem_eq {U V : Type} (S : set U) (T : set V) (x ∈ S) (y ∈ T) := x = y
```

we get a type mismatch, as we would in HLM.

However, while in HLM, we cannot ask whether two arbitrary sets are equal, in Lean one may ask whether two types are equal. For this reason, the special HLM-specific properties of equality described earlier in this document do _not_ apply to Lean.  
To illustrate this, we can translate the initial example quite literally into Lean. We translate the "construction" C as an inductive type, and the set S becomes a type variable:

```
universe u

inductive C : Type (u + 1)
| c (S : Type u) (x : S)
```

Then, in contrast to HLM, given `C.c S x = C.c T y` we can infer `S = T`:

```
theorem c_inj_S {S T : Type u} {x : S} {y : T} (h : C.c S x = C.c T y) : S = T :=
(C.c.inj h).left
```

As stated above, in HLM the proposition `S = T` would be ill-typed.

However, this difference between HLM and Lean is actually smaller than it seems because in Lean, the concept of equality of types is rarely useful. This is because given two specific types, their equality is often neither provable nor disprovable.

Therefore, one can easily imagine a variant of Lean where it is not possible to ask whether two types are equal. This restriction would lead to consequences quite similar to what is described earlier in this document: In the example just given, from `C.c S x = C.c T y` one could no longer infer `S = T`, and if one were forced to provide a _definition_ for this equality in terms of `S`, `T`, `x`, and `y`, the existence of a bijection mapping `x` to `y` would be an obvious candidate with properties similar to those described above.

Since the type systems of HLM and Lean are similar except for equality of types in Lean, and equality of types in Lean is often undecidable, one might conjecture that "isomorphic structures are equal" in the style of HLM is actually consistent with Lean. However, this is not the case because injectivity of constructors in Lean is too strong. Using the example above, we also have:

```
theorem c_inj_x {S : Type u} {x y : S} (h : C.c S x = C.c S y) : x = y :=
eq_of_heq (C.c.inj h).right
```

That is, given two pointed sets that have the same carrier `S` and are also equal, we can conclude that their base points must be equal. For two pointed sets that are merely _isomorphic_, that is clearly not the case.
