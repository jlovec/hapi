import { describe, expect, it } from 'bun:test'
import { VisibilityTracker } from './visibilityTracker'

describe('VisibilityTracker', () => {
    it('classifies missing subscription as subscription_not_found', () => {
        const tracker = new VisibilityTracker()

        expect(tracker.setVisibilityDetailed('missing', 'alpha', 'visible')).toEqual({
            ok: false,
            reason: 'subscription_not_found',
            trackedNamespace: null,
        })
    })

    it('classifies namespace mismatch separately', () => {
        const tracker = new VisibilityTracker()
        tracker.registerConnection('sub-1', 'alpha', 'hidden')

        expect(tracker.setVisibilityDetailed('sub-1', 'beta', 'visible')).toEqual({
            ok: false,
            reason: 'namespace_mismatch',
            trackedNamespace: 'alpha',
        })
    })

    it('keeps boolean setVisibility contract for successful updates', () => {
        const tracker = new VisibilityTracker()
        tracker.registerConnection('sub-1', 'alpha', 'hidden')

        expect(tracker.setVisibility('sub-1', 'alpha', 'visible')).toBe(true)
        expect(tracker.isVisibleConnection('sub-1')).toBe(true)
        expect(tracker.hasVisibleConnection('alpha')).toBe(true)
    })
})
