import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

const INVALID_MARKERS = new Set([
	'your_supabase_url',
	'your_project_url',
	'your_supabase_anon_key',
	'your_key',
])

const isLikelyValidUrl = (value: string) => {
	if (!value || INVALID_MARKERS.has(value)) return false
	try {
		const parsed = new URL(value)
		return parsed.protocol === 'https:' || parsed.protocol === 'http:'
	} catch {
		return false
	}
}

const isLikelyValidAnonKey = (value: string) => {
	return Boolean(value && !INVALID_MARKERS.has(value) && value.length > 20)
}

const disabledMessage =
	'[Supabase] Client is disabled. Set valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Frontend/.env and restart Vite.'

const makeDisabledError = () => ({ message: disabledMessage })

const makeQueryBuilder = (): any => {
	const terminalResult = Promise.resolve({ data: null, error: makeDisabledError(), count: 0 })
	const passthrough = () => builder

	const builder = {
		select: passthrough,
		insert: passthrough,
		update: passthrough,
		upsert: passthrough,
		delete: passthrough,
		eq: passthrough,
		neq: passthrough,
		gt: passthrough,
		gte: passthrough,
		lt: passthrough,
		lte: passthrough,
		like: passthrough,
		ilike: passthrough,
		in: passthrough,
		is: passthrough,
		order: passthrough,
		limit: passthrough,
		range: passthrough,
		single: () => terminalResult,
		maybeSingle: () => terminalResult,
		then: terminalResult.then.bind(terminalResult),
		catch: terminalResult.catch.bind(terminalResult),
		finally: terminalResult.finally.bind(terminalResult),
	}

	return builder
}

const createDisabledSupabaseClient = (): any => ({
	auth: {
		getUser: async () => ({ data: { user: null }, error: null }),
		getSession: async () => ({ data: { session: null }, error: null }),
		onAuthStateChange: () => ({
			data: {
				subscription: {
					unsubscribe: () => {},
				},
			},
		}),
		signInWithPassword: async () => ({ data: { user: null, session: null }, error: makeDisabledError() }),
		signUp: async () => ({ data: { user: null, session: null }, error: makeDisabledError() }),
		signOut: async () => ({ error: null }),
		resetPasswordForEmail: async () => ({ data: null, error: makeDisabledError() }),
		updateUser: async () => ({ data: null, error: makeDisabledError() }),
	},
	from: () => makeQueryBuilder(),
	rpc: async () => ({ data: null, error: makeDisabledError() }),
	channel: () => ({
		on() {
			return this
		},
		subscribe() {
			return this
		},
		unsubscribe() {},
	}),
	removeChannel: () => {},
	storage: {
		from: () => ({
			upload: async () => ({ data: null, error: makeDisabledError() }),
			download: async () => ({ data: null, error: makeDisabledError() }),
			remove: async () => ({ data: null, error: makeDisabledError() }),
			getPublicUrl: () => ({ data: { publicUrl: '' } }),
		}),
	},
	functions: {
		invoke: async () => ({ data: null, error: makeDisabledError() }),
	},
})

const hasValidConfig = isLikelyValidUrl(supabaseUrl) && isLikelyValidAnonKey(supabaseKey)

if (!hasValidConfig) {
	console.warn(
		'[Supabase] Invalid or missing env config. The app can render, but Supabase-dependent features are disabled until env values are corrected.'
	)
}

// Custom In-Memory Storage to prevent JWT tokens from touching localStorage (XSS Mitigation)
const inMemoryStorage = {
	items: new Map<string, string>(),
	getItem(key: string) {
		return this.items.get(key) || null;
	},
	setItem(key: string, value: string) {
		this.items.set(key, value);
	},
	removeItem(key: string) {
		this.items.delete(key);
	}
};

export const supabase: SupabaseClient = hasValidConfig
	? createClient(supabaseUrl, supabaseKey, {
			auth: {
				storage: inMemoryStorage,
				persistSession: true, // Will persist to our secure in-memory Map instead of localStorage
				autoRefreshToken: true,
				detectSessionInUrl: true
			}
	  })
	: createDisabledSupabaseClient()
