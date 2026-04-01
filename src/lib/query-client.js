import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: 'always',
			retry: 1,
			staleTime: 1000 * 60 * 5,
			gcTime: 1000 * 60 * 5,
		},
	},
});
