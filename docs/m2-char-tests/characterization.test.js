/**
 * Characterization tests — DOCUMENTATION SNAPSHOT.
 *
 * The runnable copy lives at:
 *   backend/__tests__/createProductReview.test.js
 * Run with:
 *   NODE_OPTIONS=--experimental-vm-modules npx jest backend/__tests__/createProductReview.test.js
 *
 * (Imports below use paths relative to the runnable location, not this file.)
 *
 * These tests pin down the controller's CURRENT behavior — including bugs.
 * Tests that capture buggy behavior are marked with a "BUGGY BEHAVIOR" comment.
 */

import { jest } from '@jest/globals'

jest.unstable_mockModule('../models/productModel.js', () => ({
  default: { findById: jest.fn() },
}))

const Product = (await import('../models/productModel.js')).default
const { createProductReview } = await import('../controllers/productController.js')

const makeRes = () => {
  const res = {}
  res.statusCode = 200
  res.status = jest.fn((code) => {
    res.statusCode = code
    return res
  })
  res.json = jest.fn(() => res)
  return res
}

const makeProduct = (reviews = []) => ({
  reviews,
  rating: 0,
  numReviews: 0,
  save: jest.fn().mockResolvedValue(true),
})

const userId = { toString: () => 'user-123' }
const otherUserId = { toString: () => 'user-999' }

const makeReq = (overrides = {}) => ({
  params: { id: 'prod-1' },
  user: { _id: userId, name: 'Alice' },
  body: { rating: 5, comment: 'great' },
  ...overrides,
})

afterEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test('happy path: pushes review, updates numReviews and rating, returns 201', async () => {
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)

  const req = makeReq({ body: { rating: 4, comment: 'nice' } })
  const res = makeRes()

  await createProductReview(req, res)

  expect(Product.findById).toHaveBeenCalledWith('prod-1')
  expect(product.reviews).toHaveLength(1)
  expect(product.reviews[0]).toEqual({
    name: 'Alice',
    rating: 4,
    comment: 'nice',
    user: userId,
  })
  expect(product.numReviews).toBe(1)
  expect(product.rating).toBe(4)
  expect(product.save).toHaveBeenCalledTimes(1)
  expect(res.status).toHaveBeenCalledWith(201)
  expect(res.json).toHaveBeenCalledWith({ message: 'Review added' })
})

test('average is recomputed across existing + new review', async () => {
  const existing = { user: otherUserId, rating: 4, name: 'Bob', comment: 'ok' }
  const product = makeProduct([existing])
  product.rating = 4
  product.numReviews = 1
  Product.findById.mockResolvedValue(product)

  await createProductReview(
    makeReq({ body: { rating: 2, comment: 'meh' } }),
    makeRes()
  )

  expect(product.numReviews).toBe(2)
  expect(product.rating).toBe(3) // (4 + 2) / 2
})

// ---------------------------------------------------------------------------
// Branch: product not found
// ---------------------------------------------------------------------------

test('product not found: sets 404 and throws "Product not found"', async () => {
  Product.findById.mockResolvedValue(null)
  const res = makeRes()

  await expect(createProductReview(makeReq(), res)).rejects.toThrow(
    'Product not found'
  )
  expect(res.status).toHaveBeenCalledWith(404)
  expect(res.json).not.toHaveBeenCalled()
})

// ---------------------------------------------------------------------------
// Branch: already reviewed
// ---------------------------------------------------------------------------

test('same user already reviewed: sets 400, throws, does NOT save', async () => {
  const existing = { user: userId, rating: 5, name: 'Alice', comment: 'old' }
  const product = makeProduct([existing])
  Product.findById.mockResolvedValue(product)
  const res = makeRes()

  await expect(createProductReview(makeReq(), res)).rejects.toThrow(
    'Product already reviewed'
  )
  expect(res.status).toHaveBeenCalledWith(400)
  expect(product.save).not.toHaveBeenCalled()
  expect(product.reviews).toHaveLength(1) // not pushed
})

// ---------------------------------------------------------------------------
// Branch: rating coercion via Number(...)
// ---------------------------------------------------------------------------

test('rating as numeric string "5" is coerced to number 5', async () => {
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)

  await createProductReview(
    makeReq({ body: { rating: '5', comment: 'ok' } }),
    makeRes()
  )

  expect(product.reviews[0].rating).toBe(5)
  expect(typeof product.reviews[0].rating).toBe('number')
})

test('rating undefined produces NaN, which propagates to product.rating', async () => {
  // BUGGY BEHAVIOR.
  // The controller does Number(undefined) === NaN, pushes the review with
  // rating: NaN, then computes product.rating = NaN / 1 = NaN and calls
  // product.save() with NaN. Mongoose's Number cast lets NaN through, so
  // a NaN rating ends up in the DB.
  // Correct would be: 400 "rating is required" before touching the product.
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)

  await createProductReview(
    makeReq({ body: { comment: 'no rating field' } }),
    makeRes()
  )

  expect(Number.isNaN(product.reviews[0].rating)).toBe(true)
  expect(Number.isNaN(product.rating)).toBe(true)
  expect(product.save).toHaveBeenCalledTimes(1)
})

test('rating "abc" becomes NaN and is still pushed + saved', async () => {
  // BUGGY BEHAVIOR.
  // Number("abc") === NaN. Controller does no validation, so a garbage
  // rating reaches save() and (via Mongoose's permissive cast) the DB.
  // Correct would be: 400 "rating must be a number between 1 and 5".
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)

  await createProductReview(
    makeReq({ body: { rating: 'abc', comment: 'x' } }),
    makeRes()
  )

  expect(Number.isNaN(product.reviews[0].rating)).toBe(true)
  expect(product.save).toHaveBeenCalledTimes(1)
})

test('rating null is coerced to 0 and accepted', async () => {
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)

  await createProductReview(
    makeReq({ body: { rating: null, comment: 'x' } }),
    makeRes()
  )

  // Number(null) === 0
  expect(product.reviews[0].rating).toBe(0)
  expect(product.rating).toBe(0)
  expect(product.save).toHaveBeenCalledTimes(1)
})

test('rating empty string is coerced to 0 and accepted', async () => {
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)

  await createProductReview(
    makeReq({ body: { rating: '', comment: 'x' } }),
    makeRes()
  )

  // Number("") === 0
  expect(product.reviews[0].rating).toBe(0)
})

test('rating out of range (999) is accepted as-is', async () => {
  // BUGGY BEHAVIOR.
  // The controller never bounds-checks rating; 999 (or -5, or Infinity) is
  // happily averaged into product.rating.
  // Correct would be: 400 "rating must be between 1 and 5".
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)
  const res = makeRes()

  await createProductReview(
    makeReq({ body: { rating: 999, comment: 'x' } }),
    res
  )

  expect(product.reviews[0].rating).toBe(999)
  expect(product.rating).toBe(999)
  expect(res.status).toHaveBeenCalledWith(201)
  expect(product.save).toHaveBeenCalledTimes(1)
})

// ---------------------------------------------------------------------------
// Branch: malformed body
// ---------------------------------------------------------------------------

test('comment undefined: review is still pushed with comment === undefined', async () => {
  // The controller does NOT validate comment. It pushes
  // { name, rating, comment: undefined, user } and calls save(). In
  // production, Mongoose's `comment: { required: true }` would reject the
  // save — but here save() is mocked, so we capture only the controller's
  // own behavior: it does not short-circuit on missing comment.
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)

  await createProductReview(
    makeReq({ body: { rating: 5 } }),
    makeRes()
  )

  expect(product.reviews).toHaveLength(1)
  expect(product.reviews[0].comment).toBeUndefined()
  expect(product.save).toHaveBeenCalledTimes(1)
})

test('empty body {}: pushes review with rating NaN and comment undefined', async () => {
  const product = makeProduct([])
  Product.findById.mockResolvedValue(product)
  const res = makeRes()

  await createProductReview(makeReq({ body: {} }), res)

  expect(product.reviews).toHaveLength(1)
  expect(Number.isNaN(product.reviews[0].rating)).toBe(true)
  expect(product.reviews[0].comment).toBeUndefined()
  expect(res.status).toHaveBeenCalledWith(201)
  expect(res.json).toHaveBeenCalledWith({ message: 'Review added' })
})

test('user matching uses .toString() — string-equal ids count as already-reviewed', async () => {
  // Existing review's user is a string (simulating ObjectId.toString());
  // req.user._id is a different shape but stringifies to the same value.
  const existing = {
    user: { toString: () => 'user-123' },
    rating: 5,
    name: 'Alice',
    comment: 'old',
  }
  const product = makeProduct([existing])
  Product.findById.mockResolvedValue(product)

  await expect(
    createProductReview(makeReq(), makeRes())
  ).rejects.toThrow('Product already reviewed')
})
