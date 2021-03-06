/-
This file experimentally maps the primitives of the HLM logic to the Lean proof assistant.
In particular, for HLM parameters of type `Set`, `Subset`, and `Element`, we provide three
Lean types with the same names. Some usage examples are included at the bottom.

The translation serves several purposes:
* It gives HLM expressions an unambiguous meaning via their corresponding Lean expressions
  (even in cases like homomorphisms between equivalence classes of structures, where the
  mathematical meaning could be in doubt).
* It can serve as a basis for independent checking of the library.
* If a theorem has been proved in HLM, the corresponding Lean theorem and proof can be
  used in other Lean libraries. (However, complicated structures are always difficult to
  translate between libraries.)
* Conversely, a Lean proof of a translated statement could be accepted as a proof of the
  original statement.
* The definitions in this file provide an alternative way of dealing with sets in Lean,
  which could be useful in itself. (Unfortunately, it requires many trivial proofs, which
  can be generated automatically when translating from HLM, but which need to be written
  manually otherwise. Perhaps it is possible to write Lean tactics for them.)

The most idiomatic translation of HLM sets to Lean would be as follows:
* An HLM parameter `S: Set` ("let S be a set") is simply translated to `S : Type*`, with
  the intention of translating subsets as subtypes wherever applicable.
* An HLM parameter `T: Subset(S)` ("let T ⊆ S") is translated to `T : set S` if `S` is of
  (HLM) type `Set`, or `T : set (subtype S)` if `S` if of (HLM) type `Subset`.
* An HLM parameter `x: Element(S)` ("let x ∈ S") is translated to `x : S` if `S` is of
  (HLM) type `Set`, or `x : subtype S` if `S` if of (HLM) type `Subset`. (An alternative
  translation for the second case would simply be `x ∈ S`, which uses special Lean
  syntactic sugar.)

However, the following (pseudocode) translation more closely matches the HLM-specific
concept of sets:
* An HLM parameter `S: Set` ("let S be a set") is translated to `S : Set`, where
    `structure Set := (α : Type u) (s : set α)`.
  That is, `Set` bundles a Lean type with a Lean set of that type.
* An HLM parameter `T: Subset(S)` ("let T ⊆ S") is translated to `T : Subset S`, where
    `structure Subset (S : {Set | Subset ?}) := (s : set S.α) (is_subset : s ⊆ S.s)`.
  That is, `Subset` inherits the type `α` from the given superset. (In reality, `S.α` does
  not work if `S` is itself of type `Subset`; this is solved using type classes.) It
  bundles a set of that type with a proof that this set is indeed a subset of the given
  argument.
* An HLM parameter `x: Element(S)` ("let x ∈ S") is translated to `x : Element S`, where
    `structure Element (S : {Set | Subset ?}) := (a : S.α) (is_element : a ∈ S.s)`.
  The `Element` structure simply bundles an element of the required type with a proof that
  it is indeed an element of the given set. Note that this is exactly the same as
  `subtype S.s`.

These definitions translate the type system of HLM, in the sense that a translated
expression is well-typed in Lean if and only if the original expression is well-typed in
HLM.

These definitions would be sufficient to translate simple definitions, but not HLM
constructions that contain sets: Their custom equality definition in HLM necessarily
identifies isomorphic elements, but it is still possible to obtain "arbitrary
representatives" of such sets and even return them (or elements of them, etc.) from
definitions. When working with concrete instances of such structures, one can then infer
information about specific sets, not just equivalence classes.
Therefore, when translating a construction with a custom equality definition, we cannot
immediately take the quotient with respect to that equality definition (as that would lose
too much information), but we need to bundle the equality definition together with the type
(as a setoid), and use it whenever we translate a formula containing "=". Specifically, in
the pseudo-definitions above, we replace α with a new structure called `BaseType`.
Sets of a given `BaseType` must respect the equality definition, in the sense that two
HLM-equal objects must either both be in the set or both not be in the set. This is encoded
in the structure `BaseSet`. (Equivalently, we could define `BaseSet` as a set of quotients.)
Each translated definitions must also respect the equality definition "in the obvious way".

This file is known to compile in Lean 3.4.2 and 3.17.1.
-/

namespace hlm

-- Conjunction and disjunction are dependent in HLM.
-- This is equivalent to a sigma type; can it be simplified?
def and_dep {left : Prop} (right : left → Prop) := left ∧ (Π l : left, right l)
def and_dep_left {left : Prop} {right : left → Prop} (h : and_dep (λ l : left, right l)) := and.left h
def and_dep_right {left : Prop} {right : left → Prop} (h : and_dep (λ l : left, right l)) := and.right h (and_dep_left h)

universes u v

structure BaseType := (α : Type u) (equality : setoid α)
instance BaseType_is_setoid {base_type : BaseType} : setoid base_type.α := base_type.equality
def make_base_type (α : Type u) (equality : α → α → Prop) (is_equivalence : equivalence equality) := BaseType.mk α (setoid.mk equality is_equivalence)
def base_class_of {base_type : BaseType} (x : base_type.α) := ⟦x⟧
def base_equals {base_type : BaseType} (x y : base_type.α) := x ≈ y

@[refl] lemma base_refl {base_type : BaseType} (x : base_type.α) : base_equals x x := setoid.refl x
@[symm] lemma base_symm {base_type : BaseType} {x y : base_type.α} (h1 : base_equals x y) : base_equals y x := setoid.symm h1
@[trans] lemma base_trans {base_type : BaseType} {x y z : base_type.α} (h1 : base_equals x y) (h2 : base_equals y z) : base_equals x z := setoid.trans h1 h2

def lean_type_to_base_type (α : Type u) := make_base_type α (=) ⟨@eq.refl _, @eq.symm _, @eq.trans _⟩

def lean_set_respects_equality (base_type : BaseType) (lean_set : set base_type.α) := ∀ x y : base_type.α, base_equals x y → x ∈ lean_set → y ∈ lean_set

structure BaseSet (base_type : BaseType) := (lean_set : set base_type.α) (respects_equality : lean_set_respects_equality base_type lean_set)
def make_base_set (base_type : BaseType) (lean_set : set base_type.α) (respects_equality : lean_set_respects_equality base_type lean_set) := @BaseSet.mk base_type lean_set respects_equality

def universal_base_set {base_type : BaseType} := make_base_set base_type set.univ (λ _ _ _ _, trivial)

def lean_set_to_base_set {α : Type u} (lean_set : set α) := make_base_set (lean_type_to_base_type α) lean_set (λ _ _, eq.subst)

structure BaseElement {base_type : BaseType} (base_set: BaseSet base_type) := (element : base_type.α) (is_element : element ∈ base_set.lean_set)
def make_base_element {base_type : BaseType} (base_set: BaseSet base_type) (element : base_type.α) (is_element : element ∈ base_set.lean_set) : BaseElement base_set := @BaseElement.mk base_type base_set element is_element

def class_of {base_type : BaseType} {base_set: BaseSet base_type} (x : BaseElement base_set) :=
base_class_of x.element

def equals {base_type : BaseType} {x_base_set: BaseSet base_type} (x : BaseElement x_base_set) {y_base_set: BaseSet base_type} (y : BaseElement y_base_set) :=
base_equals x.element y.element

@[refl] lemma refl {base_type : BaseType} {x_base_set: BaseSet base_type} (x : BaseElement x_base_set) : equals x x := base_refl x.element
@[symm] lemma symm {base_type : BaseType} {x_base_set: BaseSet base_type} {x : BaseElement x_base_set} {y_base_set: BaseSet base_type} {y : BaseElement y_base_set} (h1 : equals x y) : equals y x := base_symm h1
@[trans] lemma trans {base_type : BaseType} {x_base_set: BaseSet base_type} {x : BaseElement x_base_set} {y_base_set: BaseSet base_type} {y : BaseElement y_base_set} {z_base_set: BaseSet base_type} {z : BaseElement z_base_set} (h1 : equals x y) (h2 : equals y z) : equals x z := base_trans h1 h2

class has_base_type (H : Sort v) := (base_type : H → BaseType)
class has_base_set (H : Sort v) extends has_base_type H := (base_set : Π S : H, BaseSet (has_base_type.base_type S))

def lean_type_of {H : Sort v} [h : has_base_type H] (S : H) := (has_base_type.base_type S).α
def lean_set_of {H : Sort v} [has_base_set H] (S : H) := (has_base_set.base_set S).lean_set

-- The coercions do not seem to work within definitions, even with `↑`. Need to figure out why.
-- However, they seem to be used implicitly in proofs, as can be seen by commenting them out.

structure Set := (base_type : BaseType) (base_set : BaseSet base_type)
instance Set_has_base_type : has_base_type Set := ⟨Set.base_type⟩
instance Set_has_base_set : has_base_set Set := ⟨Set.base_set⟩
def make_set (base_type : BaseType) (base_set : BaseSet base_type) := Set.mk base_type base_set
def lean_type_to_set (α : Type u) := Set.mk (lean_type_to_base_type α) universal_base_set
instance Lean_Type_to_Set : has_coe (Type u) Set := ⟨lean_type_to_set⟩
def lean_type_to_set_with_equality (α : Type u) (equality : α → α → Prop) (is_equivalence : equivalence equality) := Set.mk (make_base_type α equality is_equivalence) universal_base_set
def lean_setoid_to_set (α : Type u) [h : setoid α] := Set.mk (BaseType.mk α h) universal_base_set
def lean_set_to_set {α : Type u} (lean_set : set α) := Set.mk (lean_type_to_base_type α) (lean_set_to_base_set lean_set)
instance Lean_Set_to_Set {α : Type u} : has_coe (set α) Set := ⟨lean_set_to_set⟩

structure Subset {H : Sort v} [has_base_set H] (S : H) := (base_set : BaseSet (has_base_type.base_type S)) (is_subset : base_set.lean_set ⊆ lean_set_of S)
instance Subset_has_base_type {H : Sort v} [has_base_set H] {S : H} : has_base_type (Subset S) := ⟨λ _, has_base_type.base_type S⟩
instance Subset_has_base_set {H : Sort v} [has_base_set H] {S : H} : has_base_set (Subset S) := ⟨Subset.base_set⟩
def make_subset {H : Sort v} [h : has_base_set H] (S : H) (lean_set : set (lean_type_of S)) (is_subset : lean_set ⊆ lean_set_of S) (respects_equality : lean_set_respects_equality (has_base_type.base_type S) lean_set) : Subset S := @Subset.mk H h S (BaseSet.mk lean_set respects_equality) is_subset
def subset_to_set {H : Sort v} [has_base_set H] {S : H} (T : Subset S) := make_set (has_base_type.base_type S) T.base_set
instance Subset_to_Set {H : Sort v} [has_base_set H] {S : H} : has_coe (Subset S) Set := ⟨subset_to_set⟩
def subset_to_superset {H : Sort v} [has_base_set H] {S : H} {S' : Subset S} (T : Subset S') : Subset S := Subset.mk T.base_set (λ _ h, S'.is_subset (T.is_subset h))
instance Subset_to_Superset {H : Sort v} [has_base_set H] {S : H} {S' : Subset S} : has_coe (Subset S') (Subset S) := ⟨subset_to_superset⟩
def set_to_subset (S : Set) : Subset S := Subset.mk S.base_set (λ _, id)

def Element {H : Sort v} [has_base_set H] (S : H) := BaseElement (has_base_set.base_set S)
instance Element_has_base_type {H : Sort v} [has_base_set H] {S : H} : has_base_type (Element S) := ⟨λ _, has_base_type.base_type S⟩
instance Element_is_setoid {H : Sort v} [has_base_set H] {S : H} : setoid (Element S) := setoid.mk (λ x y, equals x y) ⟨refl, λ _ _, symm, λ _ _ _, trans⟩
def make_element {H : Sort v} [h : has_base_set H] (S : H) (element : lean_type_of S) (is_element : element ∈ lean_set_of S) : Element S := make_base_element (has_base_set.base_set S) element is_element
instance Lean_Object_to_Element {α : Type u} : has_coe α (Element (lean_type_to_set α)) := ⟨λ x, make_element _ x trivial⟩

def eliminate_subset_to_set {H : Sort v} [has_base_set H] {S : H} {T : Subset S} (x : Element (subset_to_set T)) :=
make_element T x.element x.is_element
instance Eliminate_subset_to_set {H : Sort v} [has_base_set H] {S : H} {T : Subset S} : has_coe (Element (subset_to_set T)) (Element T) := ⟨eliminate_subset_to_set⟩

def superset_element {H : Sort v} [has_base_set H] (S : H) {T : Subset S} (x : Element T) :=
make_element S x.element (T.is_subset x.is_element)
instance Superset_element {H : Sort v} [has_base_set H] {S : H} {T : Subset S} : has_coe (Element T) (Element S) := ⟨superset_element S⟩

def is_element {H : Sort v} [has_base_set H] {S : H} {x_base_set : BaseSet (has_base_type.base_type S)} (x : BaseElement x_base_set) (T : Subset S) :=
x.element ∈ T.base_set.lean_set
instance {H : Sort v} [has_base_set H] {S : H} : has_mem (Element S) (Subset S) :=
⟨is_element⟩

def is_subset {H : Sort v} [has_base_set H] {S : H} (X Y : Subset S) :=
∀ s : Element S, s ∈ X → s ∈ Y
instance {H : Sort v} [has_base_set H] {S : H} : has_subset (Subset S) :=
⟨is_subset⟩

@[refl] lemma is_subset_refl {H : Sort v} [has_base_set H] {S : H} (X : Subset S) : is_subset X X := λ _, id
@[trans] lemma is_subset_trans {H : Sort v} [has_base_set H] {S : H} {X Y Z : Subset S} (h1 : is_subset X Y) (h2 : is_subset Y Z) : is_subset X Z := λ s h3, h2 s (h1 s h3)

def set_equals {H : Sort v} [has_base_set H] {S : H} (X Y : Subset S) :=
X ⊆ Y ∧ Y ⊆ X

instance Subset_is_setoid {H : Sort v} [has_base_set H] {S : H} : setoid (Subset S) :=
setoid.mk set_equals ⟨(λ X, ⟨is_subset_refl X, is_subset_refl X⟩), (λ X Y h, ⟨h.right, h.left⟩), (λ X Y Z h1 h2, ⟨is_subset_trans h1.left h2.left, is_subset_trans h2.right h1.right⟩)⟩

theorem is_element_respects_equality_x {H : Sort v} [has_base_set H] {S : H} (x1 x2 : Element S) (h : x1 ≈ x2) (T : Subset S) :
x1 ∈ T → x2 ∈ T :=
T.base_set.respects_equality x1.element x2.element h

theorem is_element_respects_equality_T {H : Sort v} [has_base_set H] {S : H} (x : Element S) (T1 T2 : Subset S) (h : T1 ≈ T2) :
x ∈ T1 → x ∈ T2 :=
h.left x

theorem is_subset_respects_equality_X {H : Sort v} [has_base_set H] {S : H} (X1 X2 : Subset S) (h : X1 ≈ X2) (Y : Subset S) :
X1 ⊆ Y → X2 ⊆ Y :=
λ h1 x h2, h1 x (h.right x h2)

theorem is_subset_respects_equality_Y {H : Sort v} [has_base_set H] {S : H} (X : Subset S) (Y1 Y2 : Subset S) (h : Y1 ≈ Y2) :
X ⊆ Y1 → X ⊆ Y2 :=
λ h1 x h2, h.left x (h1 x h2)

def subset {H : Sort v} [has_base_set H] {S : H} (s : set (Element S)) (s_respects_equality : ∀ x y : Element S, x ≈ y → x ∈ s → y ∈ s) : Subset S :=
let lean_set := {x : lean_type_of S | and_dep (λ p : x ∈ lean_set_of S, (make_element S x p) ∈ s)} in
make_subset S lean_set (λ _, and_dep_left) (λ x_base y_base,
  assume h1 h2,
  let h3 := and_dep_left h2 in
  let h4 := and_dep_right h2 in
  ⟨(has_base_set.base_set S).respects_equality x_base y_base h1 h3,
   (assume h5,
    let x := make_element S x_base h3 in
    let y := make_element S y_base h5 in
    s_respects_equality x y h1 h4)⟩
)

lemma trivially_respects_equality {α : Type u} {s : set (Element (lean_type_to_set α))} (x y : Element (lean_type_to_set α)) (h : x ≈ y) :
x ∈ s → y ∈ s := begin
  intro h1,
  cases x with x_base _, cases y with y_base _,
  have h2 : x_base = y_base, from h,
  rewrite ← h2,
  exact h1
end

def exists_unique_element {H : Sort v} [has_base_set H] {S : H} (p : Element S → Prop) :=
∃ x : Element S, p x ∧ ∀ y : Element S, p y → y ≈ x

structure unique_element_desc {H : Sort v} [has_base_set H] (S : H) :=
(p : Element S → Prop) (h : exists_unique_element p)

noncomputable def unique_element {H : Sort v} [has_base_set H] {S : H} (desc : unique_element_desc S) :=
classical.some desc.h

theorem unique_element_spec {H : Sort v} [has_base_set H] {S : H} (desc : unique_element_desc S) :
desc.p (unique_element desc) :=
(classical.some_spec desc.h).left

theorem unique_element_equality {H : Sort v} [has_base_set H] {S : H} (desc : unique_element_desc S) :
∀ y : Element S, desc.p y → y ≈ (unique_element desc) :=
(classical.some_spec desc.h).right

theorem unique_elements_equality {H : Sort v} [has_base_set H] {S : H} (desc : unique_element_desc S) :
∀ x y : Element S, desc.p x → desc.p y → x ≈ y := begin
  intros x y h1 h2,
  transitivity unique_element desc,
  exact unique_element_equality desc x h1,
  symmetry, exact unique_element_equality desc y h2
end

class has_embedding (S : Set) (T : Set) :=
(f : Element S → Element T) (is_well_defined : ∀ x y : Element S, x ≈ y ↔ f x ≈ f y)

instance embed (S : Set) (T : Set) [h : has_embedding S T] : has_coe (Element S) (Element T) := ⟨h.f⟩

end hlm



-- Examples

open hlm

def Intersection (U : Set) (S T : Subset U) :=
subset {x : Element U | x ∈ S ∧ x ∈ T} (begin
  intros x y h1 h2,
  split,
  exact is_element_respects_equality_x x y h1 S h2.left,
  exact is_element_respects_equality_x x y h1 T h2.right
end)

theorem Intersection_respects_equality_S (U : Set) (S1 S2 : Subset U) (h : S1 ≈ S2) (T : Subset U) :
Intersection U S1 T ⊆ Intersection U S2 T := begin
  intros x h1,
  split,
  { exact x.is_element },
  { intro,
    split,
    { apply is_element_respects_equality_T x S1 S2 h,
      exact (and_dep_right h1).left },
    { exact (and_dep_right h1).right } }
end

theorem Intersection_respects_equality_T (U : Set) (S : Subset U) (T1 T2 : Subset U) (h : T1 ≈ T2) :
Intersection U S T1 ⊆ Intersection U S T2 := begin
  intros x h1,
  split,
  { exact x.is_element },
  { intro,
    split,
    { exact (and_dep_right h1).left },
    { apply is_element_respects_equality_T x T1 T2 h,
      exact (and_dep_right h1).right } }
end

def Natural_numbers :=
lean_type_to_set ℕ

def Natural_numbers_zero :=
make_element Natural_numbers nat.zero trivial

def Natural_numbers_sum (m n : Element Natural_numbers) :=
make_element Natural_numbers (nat.add m.element n.element) trivial

theorem Natural_numbers_sum_respects_equality_m (m1 m2 : Element Natural_numbers) (h : m1 ≈ m2) (n : Element Natural_numbers) :
Natural_numbers_sum m1 n ≈ Natural_numbers_sum m2 n := begin
  have h1 : m1.element = m2.element, from h,
  unfold Natural_numbers_sum,
  rewrite h1
end

theorem Natural_numbers_sum_respects_equality_n (m n1 n2 : Element Natural_numbers) (h : n1 ≈ n2) :
Natural_numbers_sum m n1 ≈ Natural_numbers_sum m n2 := begin
  have h1 : n1.element = n2.element, from h,
  unfold Natural_numbers_sum,
  rewrite h1
end

theorem Natural_numbers_sum_associative (k m n : Element Natural_numbers) :
Natural_numbers_sum (Natural_numbers_sum k m) n ≈ Natural_numbers_sum k (Natural_numbers_sum m n) :=
nat.add_assoc k.element m.element n.element

theorem Natural_numbers_sum_commutative (m n : Element Natural_numbers) :
Natural_numbers_sum m n ≈ Natural_numbers_sum n m :=
nat.add_comm m.element n.element

theorem Natural_numbers_sum_right_cancel (k m n : Element Natural_numbers) :
Natural_numbers_sum k n ≈ Natural_numbers_sum m n → k ≈ m :=
nat.add_right_cancel

def Natural_numbers_less (m n : Element Natural_numbers) :=
nat.lt m.element n.element

def Initial_segment (n : Element Natural_numbers) :=
subset {m : Element Natural_numbers | Natural_numbers_less m n} trivially_respects_equality

def Functions (X Y : Set) :=
let base_type := make_base_type (Element X → Element Y) (λ f g : Element X → Element Y, ∀ x : Element X, f x ≈ g x) (begin
  split,
  { intros f x,
    reflexivity },
  split,
  { intros f g h1 x,
    symmetry, exact h1 x },
  { intros f g h h1 h2 x,
    transitivity (g x),
    exact h1 x,
    exact h2 x }
end) in
let base_set := make_base_set base_type {f : Element X → Element Y | ∀ x y : Element X, x ≈ y → f x ≈ f y} (begin
  intros f g h1 h2 x y h3,
  transitivity (f x),
  symmetry, exact h1 x,
  transitivity (f y),
  exact h2 x y h3,
  exact h1 y
end) in
make_set base_type base_set

def value {X Y : Set} (f : Element (Functions X Y)) (x : Element X) :=
f.element x

theorem value_respects_equality_f {X Y : Set} (f1 f2 : Element (Functions X Y)) (h : f1 ≈ f2) (x : Element X)
: value f1 x ≈ value f2 x :=
h x

theorem value_respects_equality_x {X Y : Set} (f : Element (Functions X Y)) (x1 x2 : Element X) (h : x1 ≈ x2)
: value f x1 ≈ value f x2 :=
f.is_element x1 x2 h

def identity (X : Set) :=
make_element (Functions X X) id (λ x y, id)

def composition {X Y Z : Set} (g : Element (Functions Y Z)) (f : Element (Functions X Y)) :=
make_element (Functions X Z) (λ x : Element X, value g (value f x)) (begin
  intros x y h1,
  let h2 := value_respects_equality_x f x y h1,
  exact value_respects_equality_x g (value f x) (value f y) h2
end)

theorem composition_respects_equality_g {X Y Z : Set} (g1 g2 : Element (Functions Y Z)) (h : g1 ≈ g2) (f : Element (Functions X Y)) :
composition g1 f ≈ composition g2 f := begin
  intro x,
  apply value_respects_equality_f g1 g2 h (value f x)
end

theorem composition_respects_equality_f {X Y Z : Set} (g : Element (Functions Y Z)) (f1 f2 : Element (Functions X Y)) (h : f1 ≈ f2) :
composition g f1 ≈ composition g f2 := begin
  intro x,
  let h1 := value_respects_equality_f f1 f2 h x,
  exact value_respects_equality_x g (value f1 x) (value f2 x) h1
end

def Image {X Y : Set} (f : Element (Functions X Y)) (S : Subset X) :=
subset {y : Element Y | ∃ x : Element X, value f x ≈ y} (begin
  intros y1 y2 h1 h2,
  cases h2 with x h3,
  existsi x,
  transitivity y1,
  exact h3,
  exact h1
end)

def injective {X Y : Set} (f : Element (Functions X Y)) :=
∀ (x y : Element X) (h : value f x ≈ value f y), x ≈ y

theorem injective_respects_equality_f {X Y : Set} (f1 f2 : Element (Functions X Y)) (h : f1 ≈ f2)
: injective f1 → injective f2 := begin
  intros h1 x y h2,
  apply h1 x y,
  transitivity value f2 x,
  exact value_respects_equality_f f1 f2 h x,
  transitivity value f2 y,
  exact h2,
  symmetry, exact value_respects_equality_f f1 f2 h y
end

def surjective {X Y : Set} (f : Element (Functions X Y)) :=
∀ y : Element Y, ∃ x : Element X, value f x ≈ y

theorem surjective_respects_equality_f {X Y : Set} (f1 f2 : Element (Functions X Y)) (h : f1 ≈ f2)
: surjective f1 → surjective f2 := begin
  intros h1 y,
  cases h1 y with x h2,
  existsi x,
  transitivity value f1 x,
  symmetry, exact value_respects_equality_f f1 f2 h x,
  exact h2
end

def bijective {X Y : Set} (f : Element (Functions X Y)) :=
injective f ∧ surjective f

theorem bijective_respects_equality_f {X Y : Set} (f1 f2 : Element (Functions X Y)) (h : f1 ≈ f2)
: bijective f1 → bijective f2 := begin
  intro h1,
  split,
  exact injective_respects_equality_f f1 f2 h h1.left,
  exact surjective_respects_equality_f f1 f2 h h1.right
end

def Bijections (X Y : Set) :=
subset {f : Element (Functions X Y) | bijective f} (begin
  intros f g h1 h2,
  exact bijective_respects_equality_f f g h1 h2
end)

def preimage_desc {X Y : Set} (f : Element (Functions X Y)) (h1 : bijective f) (y : Element Y) :=
let is_preimage (x : Element X) := value f x ≈ y in
unique_element_desc.mk is_preimage (begin
  cases (h1.right y) with x h2,
  existsi x,
  split,
  { exact h2 },
  { intros z h3,
    apply h1.left z x,
    symmetry,
    transitivity y,
    exact h2,
    symmetry, exact h3 }
end)

noncomputable def preimage {X Y : Set} (f : Element (Functions X Y)) (h1 : bijective f) (y : Element Y) :=
unique_element (preimage_desc f h1 y)

def inverse_desc {X Y : Set} (f : Element (Bijections X Y)) :=
let is_inverse (g : Element (Bijections Y X)) := composition (superset_element (Functions Y X) g) (superset_element (Functions X Y) f) ≈ identity X in
unique_element_desc.mk is_inverse (begin
  let f_is_bijective := and_dep_right f.is_element,
  let f_is_injective := f_is_bijective.left,
  let f_is_surjective := f_is_bijective.right,
  let g_base := preimage ↑f f_is_bijective,
  let g := make_element (Bijections Y X) g_base (begin
    split,
    { intros y1 y2 h1,
      let x1 := g_base y1,
      apply unique_element_equality (preimage_desc ↑f f_is_bijective y2) x1,
      show f.element x1 ≈ y2,
      transitivity y1,
      exact unique_element_spec (preimage_desc ↑f f_is_bijective y1),
      exact h1 },
    { intro,
      split,
      { intros y1 y2 h1,
        let x1 := g_base y1,
        let x2 := g_base y2,
        transitivity f.element x1,
        symmetry,
        exact unique_element_spec (preimage_desc ↑f f_is_bijective y1),
        transitivity f.element x2,
        exact value_respects_equality_x (superset_element (Functions X Y) f) x1 x2 h1,
        exact unique_element_spec (preimage_desc ↑f f_is_bijective y2) },
      { intro x,
        let y := f.element x,
        existsi y,
        let z := g_base y,
        apply f_is_injective z x,
        exact unique_element_spec (preimage_desc ↑f f_is_bijective y) } }
  end),
  existsi g,
  split,
  { intro x,
    let y := f.element x,
    symmetry,
    apply unique_element_equality (preimage_desc ↑f f_is_bijective y) x,
    show y ≈ y, reflexivity },
  { intros h h1 y,
    let h2 := h1 (g.element y),
    let fgy := f.element (g.element y),
    have h3 : fgy ≈ y, from unique_element_spec (preimage_desc ↑f f_is_bijective y),
    transitivity h.element fgy,
    symmetry, exact value_respects_equality_x (superset_element (Functions Y X) h) fgy y h3,
    exact h2 }
end)

noncomputable def inverse {X Y : Set} (f : Element (Bijections X Y)) :=
unique_element (inverse_desc f)

def restriction {X Y : Set} (f : Element (Functions X Y)) (T : Subset X) :=
make_element (Functions (subset_to_set T) Y) (λ t : Element (subset_to_set T), value f (superset_element X (eliminate_subset_to_set t))) (begin
  intros x y,
  exact f.is_element x y
end)

theorem Restriction_preserves_injectivity {X Y : Set} (f : Element (Functions X Y)) (h1 : injective f) (T : Subset X) :
injective (restriction f T) := begin
  intros x y,
  exact h1 x y
end

def finite (S : Set) :=
∃ (n : Element Natural_numbers) (f : Element (Functions S (subset_to_set (Initial_segment n)))), injective f

theorem Subsets_of_finite_sets_are_finite (S : Set) (h1 : finite S) (T : Subset S) :
finite (subset_to_set T) := begin
  cases h1 with n h2,
  cases h2 with f h3,
  existsi [n, (restriction f T)],
  exact Restriction_preserves_injectivity f h3 T
end

def Cardinal_numbers :=
lean_type_to_set_with_equality Set (λ S T : Set, ∃ f : Element (Bijections S T), true) (begin
  split,
  { intro S,
    let id := identity S,
    let id_bijection := make_element (Bijections S S) id.element ⟨id.is_element, (begin
      intro,
      split,
      { intros x y h1,
        exact h1 },
      { intro y,
        existsi y,
        reflexivity }
    end)⟩,
    existsi id_bijection,
    trivial },
  split,
  { intros S T h1,
    cases h1 with f _,
    existsi inverse f,
    trivial },
  { intros S T U h1 h2,
    cases h1 with f _,
    cases h2 with g _,
    let comp := composition (superset_element (Functions T U) g) (superset_element (Functions S T) f),
    let comp_bijection := make_element (Bijections S U) comp.element (begin
      let f_is_bijective := and_dep_right f.is_element,
      let g_is_bijective := and_dep_right g.is_element,
      split,
      { exact comp.is_element },
      { intro,
        split,
        { intros x y h1,
          apply f_is_bijective.left,
          apply g_is_bijective.left,
          exact h1 },
        { intro z,
          cases (g_is_bijective.right z) with y h1,
          cases (f_is_bijective.right y) with x h2,
          existsi x,
          let h3 := (and_dep_left g.is_element) (f.element x) y h2,
          transitivity g.element y,
          exact h3,
          exact h1 } }
    end),
    existsi comp_bijection,
    trivial }
end)

def Carrier (k : Element Cardinal_numbers) :=
k.element

def Homomorphisms (k l : Element Cardinal_numbers) :=
Functions (Carrier k) (Carrier l)
