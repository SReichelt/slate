import init.data.set

namespace hlm

-- Dependend "and" as used by HLM maps to ∃ in Lean.
def and_dep_left {P : Prop} {e : P → Prop} (h : ∃ p : P, e p) : P := (begin
  apply exists.elim h,
  intro p,
  assume h1,
  exact p
end)
def and_dep_right {P : Prop} {e : P → Prop} (h : ∃ p : P, e p) : e (and_dep_left h) := (begin
  apply exists.elim h,
  assume h1 h2,
  exact h2
end)

universes u v

structure BaseType := (α : Type u) (equality : setoid α)
instance BaseType_is_setoid {base_type : BaseType} : setoid base_type.α := base_type.equality
def make_base_type (α : Type u) (equality : α → α → Prop) (is_equivalence : equivalence equality) := BaseType.mk α (setoid.mk equality is_equivalence)
def base_class_of {base_type : BaseType} (x : base_type.α) := ⟦x⟧
def base_equals {base_type : BaseType} (x y : base_type.α) := x ≈ y

@[refl] lemma base_refl {base_type : BaseType} (x : base_type.α) : base_equals x x := setoid.refl x
@[symm] lemma base_symm {base_type : BaseType} {x y : base_type.α} (h1 : base_equals x y) : base_equals y x := setoid.symm h1
@[trans] lemma base_trans {base_type : BaseType} {x y z : base_type.α} (h1 : base_equals x y) (h2 : base_equals y z) : base_equals x z := setoid.trans h1 h2

-- Do we really need to prove that equality is an equivalence relation?
def lean_type_to_base_type (α : Type u) := make_base_type α (=) (begin
  split, intro x, refl,
  split, intros x y, assume h1, symmetry, exact h1,
         intros x y z, assume h1 h2, transitivity y, exact h1, exact h2
end)

def lean_set_respects_equality (base_type : BaseType) (lean_set : set base_type.α) := ∀ x y : base_type.α, (x ∈ lean_set ∧ base_equals x y) → y ∈ lean_set

structure BaseSet (base_type : BaseType) := (lean_set : set base_type.α) (respects_equality : lean_set_respects_equality base_type lean_set)
def make_base_set (base_type : BaseType) (lean_set : set base_type.α) (respects_equality : lean_set_respects_equality base_type lean_set) := @BaseSet.mk base_type lean_set respects_equality

def universal_base_set {base_type : BaseType} := make_base_set base_type set.univ (begin
  intros x y,
  assume h1,
  trivial
end)

def lean_set_to_base_set {α : Type u} (lean_set : set α) := make_base_set (lean_type_to_base_type α) lean_set (begin
  intros x y,
  assume h1,
  have h2 : x = y, from h1.right,
  rewrite ← h2,
  exact h1.left
end)

class has_base_type (H : Sort v) := (base_type : H → BaseType)
class has_base_set (H : Sort v) extends has_base_type H := (base_set : Π S : H, BaseSet (has_base_type.base_type S))

def lean_type_of {H : Sort v} [has_base_type H] (S : H) := (has_base_type.base_type S).α
def lean_set_of {H : Sort v} [has_base_set H] (S : H) := (has_base_set.base_set S).lean_set

-- The coercions do not seem to have any effect within definitions. Need to figure out why.
-- However, they seem to be used implicitly in proofs, as can be seen by commenting them out.

structure Set := (base_type : BaseType) (base_set : BaseSet base_type)
instance Set_has_base_type : has_base_type Set := ⟨λ S, S.base_type⟩
instance Set_has_base_set : has_base_set Set := ⟨λ S, S.base_set⟩
def make_set (base_type : BaseType) (base_set : BaseSet base_type) := Set.mk base_type base_set
def lean_type_to_set (α : Type u) := Set.mk (lean_type_to_base_type α) universal_base_set
def lean_type_to_set_with_equality (α : Type u) (equality : α → α → Prop) (is_equivalence : equivalence equality) := Set.mk (make_base_type α equality is_equivalence) universal_base_set
def lean_set_to_set {α : Type u} (lean_set : set α) := Set.mk (lean_type_to_base_type α) (lean_set_to_base_set lean_set)

structure Subset {H : Sort v} [has_base_set H] (S : H) := (base_set : BaseSet (has_base_type.base_type S)) (is_subset : base_set.lean_set ⊆ lean_set_of S)
instance Subset_has_base_type {H : Sort v} [has_base_set H] {S : H} : has_base_type (Subset S) := ⟨λ _, has_base_type.base_type S⟩
instance Subset_has_base_set {H : Sort v} [has_base_set H] {S : H} : has_base_set (Subset S) := ⟨λ T, T.base_set⟩
def make_subset {H : Sort v} [h : has_base_set H] (S : H) (lean_set : set (lean_type_of S)) (is_subset : lean_set ⊆ lean_set_of S) (respects_equality : lean_set_respects_equality (has_base_type.base_type S) lean_set) : Subset S := @Subset.mk H h S (BaseSet.mk lean_set respects_equality) is_subset
def subset_to_set {H : Sort v} [has_base_set H] {S : H} (T : Subset S) := Set.mk (has_base_type.base_type S) T.base_set
instance Subset_to_Set {H : Sort v} [has_base_set H] {S : H} : has_coe (Subset S) Set := ⟨subset_to_set⟩

-- We should be able to coerce from Subset S to (type of S) instead of just Set.
-- Unfortunately, I haven't figured out a way to specify that the lean type of the result will be the same.
-- That makes these definitions rather useless.
--def subset_to_superset {H : Sort v} [is_set H] {S : H} (T : Subset S) := is_set.construct S T.base_set
--instance Subset_to_Superset {H : Sort v} [is_set H] {S : H} : has_coe (Subset S) H := ⟨subset_to_superset⟩

structure Element {H : Sort v} [has_base_set H] (S : H) := (element : lean_type_of S) (is_element : element ∈ lean_set_of S)
instance Element_has_base_type {H : Sort v} [has_base_set H] {S : H} : has_base_type (Element S) := ⟨λ _, has_base_type.base_type S⟩
def make_element {H : Sort v} [h : has_base_set H] (S : H) (element : lean_type_of S) (is_element : element ∈ lean_set_of S) : Element S := @Element.mk H h S element is_element

def class_of {H : Sort v} [has_base_set H] {S : H} (x : Element S) :=
base_class_of x.element

def equals {H : Sort v} [has_base_set H] {S : H} (x y : Element S) :=
base_equals x.element y.element

@[refl] lemma refl {H : Sort v} [has_base_set H] {S : H} (x : Element S) : equals x x := base_refl x.element
@[symm] lemma symm {H : Sort v} [has_base_set H] {S : H} {x y : Element S} (h1 : equals x y) : equals y x := base_symm h1
@[trans] lemma trans {H : Sort v} [has_base_set H] {S : H} {x y z : Element S} (h1 : equals x y) (h2 : equals y z) : equals x z := base_trans h1 h2

instance Element_is_setoid {H : Sort v} [has_base_set H] {S : H} : setoid (Element S) := setoid.mk equals (begin
  split, intro x, refl,
  split, intros x y, assume h1, symmetry, exact h1,
         intros x y z, assume h1 h2, transitivity y, exact h1, exact h2
end)

def eliminate_subset_to_set {H : Sort v} [has_base_set H] {S : H} {T : Subset S} (x : Element (subset_to_set T)) :=
make_element T x.element x.is_element
instance Eliminate_subset_to_set {H : Sort v} [has_base_set H] {S : H} {T : Subset S} : has_coe (Element (subset_to_set T)) (Element T) := ⟨eliminate_subset_to_set⟩

def superset_element {H : Sort v} [has_base_set H] (S : H) {T : Subset S} (x : Element T) :=
make_element S x.element (T.is_subset x.is_element)
instance Superset_element {H : Sort v} [has_base_set H] {S : H} {T : Subset S} : has_coe (Element T) (Element S) := ⟨λ x, superset_element S x⟩

def subset {H : Sort v} [has_base_set H] {S : H} (s : set (Element S)) (s_respects_equality : ∀ x y : Element S, (x ∈ s ∧ equals x y) → y ∈ s) : Subset S :=
let lean_set := {x : lean_type_of S | ∃ p : x ∈ lean_set_of S, (make_element S x p) ∈ s} in
make_subset S lean_set (begin
  intros a h1,
  exact and_dep_left h1
end) (begin
  intros x_base y_base,
  assume h1,
  let h2 := and_dep_left h1.left,
  let h3 := (has_base_set.base_set S).respects_equality x_base y_base (and.intro h2 h1.right),
  existsi h3,
  let x := make_element S x_base h2,
  let y := make_element S y_base h3,
  apply s_respects_equality x y,
  split,
  apply and_dep_right h1.left,
  exact h1.right
end)

lemma trivially_respects_equality {α : Type u} {s : set (Element (lean_type_to_set α))} :
∀ x y : Element (lean_type_to_set α), (x ∈ s ∧ equals x y) → y ∈ s := begin
  intros x y,
  assume h1,
  cases x,
  cases y,
  have h2 : x_element = y_element, from h1.right,
  rewrite ← h2,
  exact h1.left
end

def exists_unique_element {H : Sort v} [has_base_set H] {S : H} (p : Element S → Prop) :=
∃ x : Element S, p x ∧ ∀ y : Element S, p y → equals y x

structure unique_element_desc {H : Sort v} [has_base_set H] (S : H) :=
(p : Element S → Prop) (h : exists_unique_element p)

noncomputable def unique_element {H : Sort v} [has_base_set H] {S : H} (desc : unique_element_desc S) :=
classical.some desc.h

theorem unique_element_spec {H : Sort v} [has_base_set H] {S : H} (desc : unique_element_desc S) : desc.p (unique_element desc) :=
(classical.some_spec desc.h).left

theorem unique_element_equality {H : Sort v} [has_base_set H] {S : H} (desc : unique_element_desc S) : ∀ y : Element S, desc.p y → equals y (unique_element desc) :=
(classical.some_spec desc.h).right

theorem unique_elements_equality {H : Sort v} [has_base_set H] {S : H} (desc : unique_element_desc S) : ∀ x y : Element S, desc.p x ∧ desc.p y → equals x y := begin
  intros x y,
  assume h1,
  transitivity unique_element desc,
  exact unique_element_equality desc x h1.left,
  symmetry,
  exact unique_element_equality desc y h1.right
end

end hlm



-- Examples

open hlm

def Intersection (U : Set) (S T : Subset U) :=
subset {x : Element U | x.element ∈ S.base_set.lean_set ∧ x.element ∈ T.base_set.lean_set} (begin
  intros x y,
  assume h1,
  split,
  exact S.base_set.respects_equality x.element y.element (and.intro h1.left.left h1.right),
  exact T.base_set.respects_equality x.element y.element (and.intro h1.left.right h1.right)
end)

def Natural_numbers :=
lean_type_to_set ℕ

def Initial_segment (n : Element Natural_numbers) :=
subset {m : Element Natural_numbers | nat.lt m.element n.element} trivially_respects_equality

def Functions (X Y : Set) :=
let base_type := make_base_type (Element X → Element Y) (λ f g : Element X → Element Y, ∀ x : Element X, equals (f x) (g x)) (begin
  split,
  {
    intros f x,
    reflexivity
  },
  split,
  {
    intros f g,
    assume h1,
    intro x,
    symmetry,
    exact h1 x
  },
  {
    intros f g h,
    assume h1 h2,
    intro x,
    transitivity (g x),
    exact h1 x,
    exact h2 x
  }
end) in
let base_set := make_base_set base_type {f : Element X → Element Y | ∀ x y : Element X, equals x y → equals (f x) (f y)} (begin
  intros f g,
  assume h1,
  intros x y,
  assume h2,
  transitivity (f x),
  {
    symmetry,
    exact h1.right x
  },
  transitivity (f y),
  {
    exact h1.left x y h2
  },
  {
    exact h1.right y
  }
end) in
make_set base_type base_set

def value {X Y : Set} (f : Element (Functions X Y)) (x : Element X) :=
f.element x

def identity (X : Set) :=
make_element (Functions X X) id (begin
  intros x y,
  assume h1,
  exact h1
end)

def composition {X Y Z : Set} (g : Element (Functions Y Z)) (f : Element (Functions X Y)) :=
make_element (Functions X Z) (λ x : Element X, value g (value f x)) (begin
  intros x y,
  assume h1,
  let h2 := (f.is_element x y) h1,
  exact (g.is_element (value f x) (value f y)) h2
end)

def Image {X Y : Set} (f : Element (Functions X Y)) (S : Subset X) :=
subset {y : Element Y | ∃ x : Element X, equals (value f x) y} (begin
  intros y1 y2,
  assume h1,
  apply exists.elim h1.left,
  intros x h3,
  existsi x,
  transitivity y1,
  exact h3,
  exact h1.right
end)

def injective {X Y : Set} (f : Element (Functions X Y)) :=
∀ (x y : Element X) (h : equals (value f x) (value f y)), equals x y

def surjective {X Y : Set} (f : Element (Functions X Y)) :=
∀ y : Element Y, ∃ x : Element X, equals (value f x) y

def bijective {X Y : Set} (f : Element (Functions X Y)) :=
injective f ∧ surjective f

def Bijections (X Y : Set) :=
subset {f : Element (Functions X Y) | bijective f} (begin
  intros f g,
  assume h1,
  split,
  {
    intros x y,
    assume h2,
    apply h1.left.left,
    transitivity value g x,
    exact (h1.right x),
    transitivity value g y,
    exact h2,
    symmetry,
    exact h1.right y
  },
  {
    intro y,
    apply exists.elim (h1.left.right y),
    intro x,
    assume h2,
    existsi x,
    symmetry,
    transitivity value f x,
    symmetry,
    exact h2,
    exact h1.right x
  }
end)

def preimage_desc {X Y : Set} (f : Element (Functions X Y)) (h1 : bijective f) (y : Element Y) :=
let is_preimage (x : Element X) := equals (value f x) y in
unique_element_desc.mk is_preimage (begin
  apply exists.elim (h1.right y),
  intro x,
  assume h2,
  existsi x,
  split,
  {
    exact h2
  },
  {
    intro z,
    assume h3,
    apply h1.left z x,
    symmetry,
    transitivity y,
    exact h2,
    symmetry,
    exact h3
  }
end)

noncomputable def preimage {X Y : Set} (f : Element (Functions X Y)) (h1 : bijective f) (y : Element Y) :=
unique_element (preimage_desc f h1 y)

def inverse_desc {X Y : Set} (f : Element (Bijections X Y)) :=
let is_inverse (g : Element (Bijections Y X)) := equals (composition (superset_element (Functions Y X) g) (superset_element (Functions X Y) f)) (identity X) in
unique_element_desc.mk is_inverse (begin
  let f_is_bijective := and_dep_right f.is_element,
  let f_is_injective := f_is_bijective.left,
  let f_is_surjective := f_is_bijective.right,
  let g_base := preimage ↑f f_is_bijective,
  let g := make_element (Bijections Y X) g_base (begin
    have h1 : g_base ∈ lean_set_of (Functions Y X), begin
      intros y1 y2,
      assume h2,
      let x1 := g_base y1,
      apply unique_element_equality (preimage_desc ↑f f_is_bijective y2) x1,
      show equals (f.element x1) y2,
      transitivity y1,
      exact unique_element_spec (preimage_desc ↑f f_is_bijective y1),
      exact h2
    end,
    existsi h1,
    split,
    {
      intros y1 y2,
      assume h2,
      let x1 := g_base y1,
      let x2 := g_base y2,
      transitivity f.element x1,
      symmetry,
      exact unique_element_spec (preimage_desc ↑f f_is_bijective y1),
      transitivity f.element x2,
      exact (and_dep_left f.is_element) x1 x2 h2,
      exact unique_element_spec (preimage_desc ↑f f_is_bijective y2)
    },
    {
      intro x,
      let y := f.element x,
      existsi y,
      let z := g_base y,
      apply f_is_injective z x,
      exact unique_element_spec (preimage_desc ↑f f_is_bijective y)
    }
  end),
  existsi g,
  split,
  {
    intro x,
    let y := f.element x,
    symmetry,
    apply unique_element_equality (preimage_desc ↑f f_is_bijective y) x,
    show equals y y, reflexivity
  },
  {
    intro h,
    assume h1,
    intro y,
    let h2 := h1 (g.element y),
    let fgy := f.element (g.element y),
    have h3 : equals fgy y, from unique_element_spec (preimage_desc ↑f f_is_bijective y),
    let h4 := and_dep_left h.is_element fgy y h3,
    transitivity h.element fgy,
    symmetry,
    exact h4,
    exact h2
  }
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
  apply exists.elim h1,
  intro n,
  assume h2,
  apply exists.elim h2,
  intro f,
  assume h3,
  existsi [n, (restriction f T)],
  exact Restriction_preserves_injectivity f h3 T
end

def Cardinal_numbers :=
lean_type_to_set_with_equality Set (λ S T : Set, ∃ f : Element (Bijections S T), true) (begin
  split,
  {
    intro S,
    let id := identity S,
    let id_bijection := make_element (Bijections S S) id.element (begin
      existsi id.is_element,
      split,
      {
        exact id.is_element
      },
      {
        intro y,
        existsi y,
        reflexivity
      }
    end),
    existsi id_bijection,
    trivial
  },
  split,
  {
    intros S T,
    assume h1,
    apply exists.elim h1,
    intros f _,
    existsi inverse f,
    trivial
  },
  {
    intros S T U,
    assume h1 h2,
    apply exists.elim h1,
    intros f _,
    apply exists.elim h2,
    intros g _,
    let comp := composition (superset_element (Functions T U) g) (superset_element (Functions S T) f),
    let comp_bijection := make_element (Bijections S U) comp.element (begin
      existsi comp.is_element,
      let f_is_bijective := and_dep_right f.is_element,
      let g_is_bijective := and_dep_right g.is_element,
      split,
      {
        intros x y,
        assume h1,
        apply f_is_bijective.left,
        apply g_is_bijective.left,
        exact h1
      },
      {
        intro z,
        apply exists.elim (g_is_bijective.right z),
        intro y,
        assume h1,
        apply exists.elim (f_is_bijective.right y),
        intro x,
        assume h2,
        existsi x,
        let h3 := (and_dep_left g.is_element) (f.element x) y h2,
        transitivity g.element y,
        exact h3,
        exact h1
      }
    end),
    existsi comp_bijection,
    trivial
  }
end)

def Carrier (k : Element Cardinal_numbers) :=
k.element

def Homomorphisms (k j : Element Cardinal_numbers) :=
Functions (Carrier k) (Carrier j)

universes u v

def cardinality_of_lower_universe :=
make_element Cardinal_numbers.{(u + 1) (v + 1)} Cardinal_numbers.{u v} trivial
