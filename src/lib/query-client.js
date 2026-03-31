import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: true,
			refetchOnReconnect: true,
			retry: 1,
			staleTime: 1000 * 60 * 2, // 2 min — balance between freshness and avoiding refetch storms
			gcTime: 1000 * 60 * 10,
		},
	},
});
