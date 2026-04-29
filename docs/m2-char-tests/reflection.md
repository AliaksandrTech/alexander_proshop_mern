# Reflection — characterization tests around `createProductReview`

## What I learned

The function looked simple at the route level — `POST /api/products/:id/reviews` —
but writing characterization tests forced me to enumerate eight rating-coercion
edge cases (`"5"`, `undefined`, `"abc"`, `null`, `""`, `999`, plus happy and
already-reviewed) and notice that `Number(rating)` silently produces `NaN`,
which then divides by `reviews.length` and lands in `product.rating` — a number
field that Mongoose's permissive cast lets through. Without those tests I
would have "tidied" the function by replacing `Number(rating)` with `parseInt`
or by adding range validation, both of which silently fix bugs the team may
not realise it has. The exercise was a good reminder that *form refactors and
behavior fixes need to ship in separate PRs*: the test suite is the contract,
and the only honest way to change behavior is to change a test on purpose.

## What failed and why

**No tests failed during the refactor itself** — I traced all 13 cases through
the new control flow on paper before the first run, and the suite went green
on the first attempt (1.0s, then 0.4s after the warm cache). The only red I
hit during the session was self-inflicted: the very first draft of the test
file contained a stub helper `res_status_was` that I'd forgotten to remove,
which I caught on re-reading, not from a failing assertion. The other gotcha
was environmental, not behavioral: the project has `"type": "module"` so the
mock setup uses `jest.unstable_mockModule` + top-level `await import(...)`,
which Jest only supports under `NODE_OPTIONS=--experimental-vm-modules`.
Without that flag the test file doesn't even load — it fails at module
resolution, not at any specific assertion. Worth pinning in a `"test"` script
once the team adopts Jest properly, otherwise the next contributor will
think the suite is broken.
