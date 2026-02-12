/**
 * Mappe les codes d'erreur Firebase Auth vers des messages simples et conviviaux.
 */
export const getFriendlyErrorMessage = (error: unknown): string => {
    const err = error as { code?: string; message?: string };
    const code = err?.code || "";
    const message = err?.message || "";

    switch (code) {
        case 'auth/invalid-email':
            return "Format d'email invalide.";
        case 'auth/user-disabled':
            return "Ce compte a été désactivé.";
        case 'auth/user-not-found':
            return "Ce compte n'existe pas.";
        case 'auth/wrong-password':
            return "Mot de passe erroné.";
        case 'auth/email-already-in-use':
            return "Cet email est déjà utilisé. Veuillez vous connecter.";
        case 'auth/weak-password':
            return "Mot de passe trop court (min. 6 caractères).";
        case 'auth/operation-not-allowed':
            return "Inscription désactivée pour le moment.";
        case 'auth/network-request-failed':
            return "Problème de connexion réseau. Vérifiez votre internet.";
        case 'auth/too-many-requests':
            return "Trop de tentatives. Réessayez plus tard.";
        case 'auth/internal-error':
            return "Erreur interne. Réessayez.";
        default:
            // Fallback sur des messages génériques basés sur le texte si le code est inconnu
            if (message.includes('password')) return "Problème de mot de passe.";
            if (message.includes('email')) return "Problème d'identifiant (email).";
            return "Une erreur est survenue. Vérifiez vos informations.";
    }
};
