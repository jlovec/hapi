import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { createEventsRoutes } from './events'
import { VisibilityTracker } from '../../visibility/visibilityTracker'
import type { WebAppEnv } from '../middleware/auth'

function createApp(namespace: string, tracker: VisibilityTracker | null = new VisibilityTracker()) {
    const app = new Hono<WebAppEnv>()
    app.use('*', async (c, next) => {
        c.set('namespace', namespace)
        await next()
    })
    app.route('/', createEventsRoutes(() => null, () => null, () => tracker))
    return app
}

describe('events visibility route', () => {
    it('returns classified 404 for unknown subscription', async () => {
        const app = createApp('alpha')

        const response = await app.request('/visibility', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                subscriptionId: 'missing',
                visibility: 'visible',
            }),
        })

        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
            error: 'Subscription not found',
            reason: 'subscription_not_found',
            trackedNamespace: null,
        })
    })

    it('returns classified 404 for namespace mismatch', async () => {
        const tracker = new VisibilityTracker()
        tracker.registerConnection('sub-1', 'beta', 'hidden')
        const app = createApp('alpha', tracker)

        const response = await app.request('/visibility', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                subscriptionId: 'sub-1',
                visibility: 'visible',
            }),
        })

        expect(response.status).toBe(404)
        expect(await response.json()).toEqual({
            error: 'Subscription not found',
            reason: 'namespace_mismatch',
            trackedNamespace: 'beta',
        })
    })

    it('keeps success response unchanged for valid visibility updates', async () => {
        const tracker = new VisibilityTracker()
        tracker.registerConnection('sub-1', 'alpha', 'hidden')
        const app = createApp('alpha', tracker)

        const response = await app.request('/visibility', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                subscriptionId: 'sub-1',
                visibility: 'visible',
            }),
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(tracker.isVisibleConnection('sub-1')).toBe(true)
    })
})
