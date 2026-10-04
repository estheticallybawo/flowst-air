Thinking Orbs canvas engine by Jakub Antalik. MIT license retained in LICENSE.
Source: https://github.com/Jakubantalik/thinking-orbs
Pinned commit: de85557ca220332586d070d8788c0e1d6e877a0d
Local adaptation: types.ts omits React-specific component types. Bounded array accesses in lattice.ts, morph.ts and web.ts have non-null type assertions for Flowst’s noUncheckedIndexedAccess setting. These erase at compilation; engine geometry is unchanged.
