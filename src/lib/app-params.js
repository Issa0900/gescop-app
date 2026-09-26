import { getAccessToken } from '@base44/sdk';

const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
	!isNode && new URLSearchParams(window.location.search).get("clear_access_token") === 'true';

const clearStoredAccessToken = () => {
	window.localStorage.removeItem('base44_access_token');
	window.localStorage.removeItem('token');
}

// Valeurs de secours : un build fait sans les variables VITE_BASE44_* (ex. `npm run build`
// au lieu de `base44 build`) partait en production avec appId undefined, et toute
// connexion tombait sur « Invalid id value -> Object not found ». L'ID d'app n'est pas un
// secret (il est visible dans chaque requête /api/apps/<id>/...).
const DEFAULT_APP_ID = '6aa428eadfaf8d99d50d10b7';

const getAppParams = () => {
	if (isClearAccessTokenRequested()) {
		clearStoredAccessToken();
	}
	return {
		appId: import.meta.env.VITE_BASE44_APP_ID || DEFAULT_APP_ID,
		token: getAccessToken(),
		functionsVersion: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION,
		appBaseUrl: import.meta.env.VITE_BASE44_APP_BASE_URL || (isNode ? undefined : window.location.origin),
	}
}


export const appParams = {
	...getAppParams()
}
