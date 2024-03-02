# Squint (CLJS)

```js echo
function foo(x) {
  return x+x+x;
}
```

```cljs echo
(defn squint [x]
    (> (:frequency x) 0.06))
```

```js echo
Plot.rectY(alphabet, {
  x: "letter",
  y: "frequency",
  fill: squint,
}).plot()
```

```cljs echo
(def two (+ 1 1))
(defn add [a b]
    (prn "hi") ;; squint_core function
    [(foo a) (foo b)]) ;; CLJS calling JS
```

```js echo
view(two);
view(add(2,3)); // JS calling CLJS
```
