import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: 1,
			staleTime: 1000 * 60 * 5, // 5 min — data doesn't change that often, reduces refetch storms
			gcTime: 1000 * 60 * 10,   // 10 min — keep cache longer to avoid re-fetching recently viewed data
		},
	},
});
