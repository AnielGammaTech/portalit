import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchOnReconnect: 'always',
			refetchOnMount: true,
			retry: 2,
			staleTime: 1000 * 60 * 2,    // Data is fresh for 2 min — won't refetch within this window
			gcTime: 1000 * 60 * 5,
			retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
		},
	},
});
