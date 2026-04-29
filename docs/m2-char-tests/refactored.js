/**
 * Snapshot of `createProductReview` AFTER the refactor.
 * Source: backend/controllers/productController.js (line ~110).
 *
 * Form changes (NO behavior change — all 13 characterization tests stay green):
 *   - Guard clauses replace nested if/else.
 *   - Three pure helpers: findUserReview, buildReview, computeRatingStats.
 *   - One httpError helper unifies the `res.status(x); throw` pattern.
 *
 * Preserved (deliberate, captured by tests):
 *   - Number(rating) coercion → NaN for undefined / "abc".
 *   - reduce/length → NaN when reviews is empty (division by zero).
 *   - comment passed through with no validation (Mongoose validates downstream).
 *   - rating range never bounded.
 *   - product.reviews.push(...) mutates in place (Mongoose DocumentArray
 *     contract — replacing the array would lose subdoc behavior).
 *
 * This is documentation only — not imported by tests.
 */

import asyncHandler from 'express-async-handler'
import Product from '../../backend/models/productModel.js'

const findUserReview = (reviews, userId) =>
  reviews.find((r) => r.user.toString() === userId.toString())

const buildReview = ({ user, name, rating, comment }) => ({
  name,
  rating: Number(rating),
  comment,
  user,
})

const computeRatingStats = (reviews) => ({
  numReviews: reviews.length,
  rating:
    reviews.reduce((acc, item) => item.rating + acc, 0) / reviews.length,
})

const httpError = (res, status, message) => {
  res.status(status)
  throw new Error(message)
}

// @desc    Create new review
// @route   POST /api/products/:id/reviews
// @access  Private
const createProductReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body
  const product = await Product.findById(req.params.id)

  if (!product) {
    httpError(res, 404, 'Product not found')
  }

  if (findUserReview(product.reviews, req.user._id)) {
    httpError(res, 400, 'Product already reviewed')
  }

  product.reviews.push(
    buildReview({
      user: req.user._id,
      name: req.user.name,
      rating,
      comment,
    })
  )

  Object.assign(product, computeRatingStats(product.reviews))

  await product.save()
  res.status(201).json({ message: 'Review added' })
})

export { createProductReview }
